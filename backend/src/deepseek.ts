import { randomUUID } from "crypto";

// DeepSeek API types
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  reasoning_content?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface StreamChunk {
  kind: "text" | "reasoning" | "tool_call" | "done" | "error" | "usage";
  content?: string;
  toolCall?: ToolCall;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: string;
}

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

const TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Path to the file to read" },
          offset: { type: "number", description: "Line number to start reading from" },
          limit: { type: "number", description: "Number of lines to read" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Path to the file to write" },
          content: { type: "string", description: "Content to write" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_command",
      description: "Execute a shell command",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command to execute" },
          cwd: { type: "string", description: "Working directory for the command" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search for files matching a pattern",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern to search for" },
          path: { type: "string", description: "Directory to search in" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep",
      description: "Search file contents using regex pattern",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regular expression pattern" },
          path: { type: "string", description: "File or directory to search" },
          glob: { type: "string", description: "Glob pattern to filter files" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files and directories in a path",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path to list" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "todo_write",
      description: "Create and manage a structured task list for the current session",
      parameters: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            description: "Array of todo items",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Unique identifier" },
                content: { type: "string", description: "Description of the task" },
                status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                priority: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["id", "content", "status", "priority"],
            },
          },
          merge: { type: "boolean", description: "Whether to merge with existing todos" },
        },
        required: ["todos", "merge"],
      },
    },
  },
];

export class DeepSeekClient {
  private apiKey: string;
  private baseUrl: string;
  public model: string;

  constructor(config: DeepSeekConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://api.deepseek.com/v1";
    this.model = config.model || "deepseek-chat";
  }

  setModel(model: string) {
    this.model = model;
  }

  async chat(
    messages: ChatMessage[],
    options?: { tools?: ToolDefinition[]; stream?: boolean }
  ): Promise<{
    content: string;
    reasoning?: string;
    toolCalls?: ToolCall[];
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools: options?.tools || TOOLS,
        tool_choice: "auto",
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${err}`);
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];
    const msg = choice?.message;
    return {
      content: msg?.content || "",
      reasoning: msg?.reasoning_content,
      toolCalls: msg?.tool_calls,
      usage: data.usage,
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: { tools?: ToolDefinition[]; effort?: string }
  ): AsyncGenerator<StreamChunk> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      tools: options?.tools || TOOLS,
      tool_choice: "auto",
      stream: true,
      stream_options: { include_usage: true },
    };

    const isReasoner = this.model === "deepseek-reasoner";
    if (!isReasoner && options?.effort) {
      // Pass effort for models that support it (e.g., deepseek-chat with reasoning)
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      yield { kind: "error", error: `API error ${response.status}: ${err}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { kind: "error", error: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    const toolCallBuilders = new Map<number, { id: string; name: string; args: string }>();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") {
            yield { kind: "done" };
            continue;
          }

          try {
            const event = JSON.parse(jsonStr);
            if (event.usage) {
              yield {
                kind: "usage",
                usage: {
                  promptTokens: event.usage.prompt_tokens || 0,
                  completionTokens: event.usage.completion_tokens || 0,
                  totalTokens: event.usage.total_tokens || 0,
                },
              };
              continue;
            }

            const delta = event.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.reasoning_content) {
              yield { kind: "reasoning", content: delta.reasoning_content };
            }
            if (delta.content) {
              yield { kind: "text", content: delta.content };
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallBuilders.has(idx)) {
                  toolCallBuilders.set(idx, { id: tc.id || "", name: "", args: "" });
                }
                const builder = toolCallBuilders.get(idx)!;
                if (tc.id) builder.id = tc.id;
                if (tc.function?.name) builder.name += tc.function.name;
                if (tc.function?.arguments) builder.args += tc.function.arguments;

                // When we have a complete tool call (has id + name), yield it
                if (builder.id && builder.name) {
                  yield {
                    kind: "tool_call",
                    toolCall: {
                      id: builder.id,
                      type: "function",
                      function: { name: builder.name, arguments: builder.args },
                    },
                  };
                }
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { kind: "done" };
  }

  // Helper to make tool results message
  static toolResultMessage(toolCallId: string, result: string): ChatMessage {
    return {
      role: "tool",
      content: result,
      tool_call_id: toolCallId,
    };
  }
}