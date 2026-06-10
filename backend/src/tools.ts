import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, readdir, stat } from "fs/promises";
import { glob } from "fs/promises";
import { join, relative, dirname } from "path";
import { existsSync, mkdirSync } from "fs";
import type { ToolCall, ToolDefinition } from "./deepseek.js";

const execAsync = promisify(exec);

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || "/workspace";

// Tool implementations
type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

const toolHandlers: Record<string, ToolHandler> = {
  read_file: async (args) => {
    const filePath = String(args.filePath || "");
    const offset = Number(args.offset) || 0;
    const limit = Number(args.limit) || 0;
    
    const fullPath = filePath.startsWith("/") ? filePath : join(WORKSPACE_ROOT, filePath);
    
    // Security: prevent path traversal
    if (!fullPath.startsWith(WORKSPACE_ROOT)) {
      return JSON.stringify({ error: "Access denied: path outside workspace" });
    }
    
    if (!existsSync(fullPath)) {
      return JSON.stringify({ error: `File not found: ${filePath}` });
    }
    
    const statInfo = await stat(fullPath);
    if (statInfo.isDirectory()) {
      return JSON.stringify({ error: `Path is a directory: ${filePath}` });
    }
    
    // Limit file size to 1MB
    if (statInfo.size > 1024 * 1024) {
      return JSON.stringify({ error: `File too large (${(statInfo.size / 1024 / 1024).toFixed(1)}MB): ${filePath}` });
    }
    
    const content = await readFile(fullPath, "utf-8");
    const lines = content.split("\n");
    const totalLines = lines.length;
    
    if (offset > 0 || limit > 0) {
      const start = Math.max(0, offset - 1);
      const end = limit > 0 ? start + limit : totalLines;
      const sliced = lines.slice(start, end);
      return sliced.map((l, i) => `${String(start + i + 1).padStart(4)}\t${l}`).join("\n");
    }
    
    return lines.map((l, i) => `${String(i + 1).padStart(4)}\t${l}`).join("\n");
  },
  
  write_file: async (args) => {
    const filePath = String(args.filePath || "");
    const content = String(args.content || "");
    
    const fullPath = filePath.startsWith("/") ? filePath : join(WORKSPACE_ROOT, filePath);
    
    if (!fullPath.startsWith(WORKSPACE_ROOT)) {
      return JSON.stringify({ error: "Access denied: path outside workspace" });
    }
    
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    await writeFile(fullPath, content, "utf-8");
    return JSON.stringify({ success: true, path: relative(WORKSPACE_ROOT, fullPath) });
  },
  
  execute_command: async (args) => {
    const command = String(args.command || "");
    const cwd = String(args.cwd || WORKSPACE_ROOT);
    
    // Basic command safety
    const dangerous = ["rm -rf /", "mkfs", "dd if=", ":(){ :|:& };:"];
    for (const d of dangerous) {
      if (command.includes(d)) {
        return JSON.stringify({ error: "Dangerous command blocked" });
      }
    }
    
    try {
      const safeCwd = cwd.startsWith("/") ? cwd : join(WORKSPACE_ROOT, cwd);
      const { stdout, stderr } = await execAsync(command, {
        cwd: safeCwd,
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });
      return JSON.stringify({ stdout, stderr, exitCode: 0 });
    } catch (err: any) {
      return JSON.stringify({
        stdout: err.stdout || "",
        stderr: err.stderr || err.message,
        exitCode: err.code || 1,
      });
    }
  },
  
  search_files: async (args) => {
    const pattern = String(args.pattern || "*");
    const basePath = String(args.path || ".");
    const fullPath = basePath.startsWith("/") ? basePath : join(WORKSPACE_ROOT, basePath);
    
    try {
      const matches: string[] = [];
      for await (const entry of glob(pattern, { cwd: fullPath })) {
        matches.push(entry.toString());
      }
      return JSON.stringify({ matches: matches.slice(0, 100), count: matches.length });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
  
  grep: async (args) => {
    const pattern = String(args.pattern || "");
    const basePath = String(args.path || ".");
    const fileGlob = String(args.glob || "");
    const fullPath = basePath.startsWith("/") ? basePath : join(WORKSPACE_ROOT, basePath);
    
    try {
      // Use node's built-in grep-like functionality
      const results: string[] = [];
      const searchDir = (await stat(fullPath)).isDirectory() ? fullPath : dirname(fullPath);
      const targetFile = (await stat(fullPath)).isFile() ? fullPath : null;
      
      if (targetFile) {
        const content = await readFile(targetFile, "utf-8");
        const lines = content.split("\n");
        const regex = new RegExp(pattern, "gi");
        lines.forEach((line, i) => {
          if (regex.test(line) || line.toLowerCase().includes(pattern.toLowerCase())) {
            results.push(`${relative(WORKSPACE_ROOT, targetFile)}:${i + 1}: ${line.trim()}`);
          }
        });
      } else {
        // Search in directory
        const searchGlob = fileGlob || "**/*";
        for await (const entry of glob(searchGlob, { cwd: searchDir })) {
          const filePath = join(searchDir, entry.toString());
          try {
            const st = await stat(filePath);
            if (st.isFile() && st.size < 1024 * 1024) {
              const content = await readFile(filePath, "utf-8");
              const lines = content.split("\n");
              const regex = new RegExp(pattern, "gi");
              lines.forEach((line, i) => {
                if (regex.test(line) || line.toLowerCase().includes(pattern.toLowerCase())) {
                  results.push(`${relative(WORKSPACE_ROOT, filePath)}:${i + 1}: ${line.trim()}`);
                }
              });
            }
          } catch { /* skip unreadable files */ }
          if (results.length > 200) break;
        }
      }
      
      return JSON.stringify({ matches: results.slice(0, 200), count: results.length });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
  
  list_files: async (args) => {
    const basePath = String(args.path || ".");
    const fullPath = basePath.startsWith("/") ? basePath : join(WORKSPACE_ROOT, basePath);
    
    try {
      const entries = await readdir(fullPath, { withFileTypes: true });
      const result = entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? "dir" : e.isFile() ? "file" : "other",
        isSymlink: e.isSymbolicLink(),
      }));
      return JSON.stringify({ entries: result, count: result.length });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
  
  todo_write: async (args) => {
    // Just acknowledge the todo write - the session will store this as a tool result
    const todos = args.todos as Array<{ id: string; content: string; status: string }> || [];
    return JSON.stringify({
      success: true,
      message: `Todo list updated with ${todos.length} items`,
      todos: todos.map(t => `[${t.status.toUpperCase()}] ${t.content}`),
    });
  },
};

export async function executeTool(toolCall: ToolCall): Promise<string> {
  const handler = toolHandlers[toolCall.function.name];
  if (!handler) {
    return JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });
  }
  
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(toolCall.function.arguments || "{}");
  } catch {
    args = {};
  }
  
  return handler(args);
}

export { toolHandlers };
export const toolDefs = [
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read contents of a file with line numbers",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Path to the file" },
          offset: { type: "number", description: "Line to start from" },
          limit: { type: "number", description: "Number of lines to read" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description: "Write content to a file",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          content: { type: "string" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "execute_command",
      description: "Execute a shell command",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
          cwd: { type: "string" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_files",
      description: "Search for files matching glob pattern",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          path: { type: "string" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "grep",
      description: "Search file contents with pattern",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          path: { type: "string" },
          glob: { type: "string" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_files",
      description: "List files in a directory",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "todo_write",
      description: "Create and manage a task list",
      parameters: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                content: { type: "string" },
                status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                priority: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["id", "content", "status", "priority"],
            },
          },
          merge: { type: "boolean" },
        },
        required: ["todos", "merge"],
      },
    },
  },
];