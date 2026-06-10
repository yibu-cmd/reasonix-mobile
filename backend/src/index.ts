import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { DeepSeekClient } from "./deepseek.js";
import type { ChatMessage, StreamChunk } from "./deepseek.js";
import { SessionStore, DEFAULT_SYSTEM_PROMPT } from "./session.js";
import type { Session, SessionMeta } from "./session.js";
import { toolDefs, executeTool } from "./tools.js";

// Configuration
const PORT = parseInt(process.env.PORT || "3456", 10);
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";

// Initialize DeepSeek client
const ds = new DeepSeekClient({
  apiKey: DEEPSEEK_API_KEY,
  model: "deepseek-v4-flash",
});

// Available models
const MODELS = [
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", description: "Fast, cost-efficient" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", description: "Deep reasoning, powerful" },
];

// Effort levels
const EFFORTS = [
  { id: "low", label: "Low", description: "Fast responses" },
  { id: "medium", label: "Medium", description: "Balanced" },
  { id: "high", label: "High", description: "Thorough analysis" },
];

// Agent modes
type AgentMode = "normal" | "plan" | "yolo" | "goal";
type CollaborationMode = "normal" | "plan" | "goal";
type ToolApprovalMode = "ask" | "yolo";

// WebSocket message types
interface WSMessage {
  type: string;
  [key: string]: unknown;
}

// Session event types for frontend
interface SessionEvent {
  kind: "text" | "reasoning" | "tool_start" | "tool_end" | "turn_end" | "notice" | "error" | "approval_needed" | "todo_updated" | "status";
  content?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  toolId?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  sessionCost?: string;
  meta?: Record<string, unknown>;
}

// Active connections
const connections = new Map<string, { ws: WebSocket; sessionId: string | null }>();

// Express setup
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "1.5.0", timestamp: new Date().toISOString() });
});

// Get available models
app.get("/api/models", (_req, res) => {
  res.json({ models: MODELS, current: ds.model });
});

// Get effort levels
app.get("/api/efforts", (_req, res) => {
  res.json({ efforts: EFFORTS });
});

// Session management REST API
app.get("/api/sessions", async (_req, res) => {
  const sessions = await SessionStore.list();
  res.json({ sessions });
});

app.get("/api/sessions/:id", async (req, res) => {
  const session = await SessionStore.load(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ session });
});

app.delete("/api/sessions/:id", async (req, res) => {
  await SessionStore.delete(req.params.id);
  res.json({ success: true });
});

app.patch("/api/sessions/:id", async (req, res) => {
  await SessionStore.rename(req.params.id, req.body.title || "Untitled");
  res.json({ success: true });
});

// Static file serving for workspace files
app.get("/api/files", (req, res) => {
  const filePath = req.query.path as string;
  // Simple file listing for the workspace
  res.json({ path: filePath || "/workspace" });
});

// WebSocket handling
wss.on("connection", (ws) => {
  const connId = randomUUID();
  connections.set(connId, { ws, sessionId: null });
  console.log(`Client connected: ${connId}`);

  ws.send(JSON.stringify({
    type: "connected",
    connectionId: connId,
    models: MODELS,
    currentModel: ds.model,
    efforts: EFFORTS,
  }));

  ws.on("message", async (data) => {
    try {
      const msg: WSMessage = JSON.parse(data.toString());
      await handleMessage(connId, msg);
    } catch (err) {
      ws.send(JSON.stringify({
        type: "error",
        error: `Invalid message: ${err}`,
      }));
    }
  });

  ws.on("close", () => {
    connections.delete(connId);
    console.log(`Client disconnected: ${connId}`);
  });
});

function sendEvent(connId: string, event: SessionEvent) {
  const conn = connections.get(connId);
  if (conn?.ws.readyState === WebSocket.OPEN) {
    conn.ws.send(JSON.stringify({ type: "session_event", ...event }));
  }
}

async function handleMessage(connId: string, msg: WSMessage) {
  const conn = connections.get(connId);
  if (!conn) return;

  switch (msg.type) {
    case "chat": {
      const input = msg.text as string;
      const sessionId = (msg.sessionId as string) || conn.sessionId;
      const mode = (msg.mode as string) || "normal";
      const effort = (msg.effort as string) || "medium";
      const model = (msg.model as string) || ds.model;

      if (!input?.trim()) return;

      if (model !== ds.model) {
        ds.setModel(model);
      }

      let session: Session;
      if (sessionId) {
        const existing = await SessionStore.load(sessionId);
        if (existing) {
          session = existing;
        } else {
          session = await SessionStore.create(randomUUID(), DEFAULT_SYSTEM_PROMPT, model);
        }
      } else {
        session = await SessionStore.create(randomUUID(), DEFAULT_SYSTEM_PROMPT, model);
        conn.sessionId = session.meta.id;
      }

      // Send session id to client
      sendEvent(connId, {
        kind: "status",
        meta: { sessionId: session.meta.id, title: session.meta.title },
      });

      // Add user message
      const userMsg: ChatMessage = { role: "user", content: input };
      session.messages.push(userMsg);

      // Send user message acknowledgment
      sendEvent(connId, { kind: "status", meta: { status: "thinking" } });

      let turnComplete = false;
      let maxTurns = 20; // Limit agent loop

      while (!turnComplete && maxTurns > 0) {
        maxTurns--;

        // Check if in plan mode - add plan instruction
        const loopMessages = [...session.messages];
        if (mode === "plan") {
          loopMessages.push({
            role: "system",
            content: "You are in plan mode. Analyze the user's request and create a detailed plan. Do NOT execute any tools that modify files or run commands. Only use read-only operations.",
          });
        }

        const toolResults: { id: string; result: string }[] = [];

        for await (const chunk of ds.chatStream(loopMessages, { tools: toolDefs, effort })) {
          switch (chunk.kind) {
            case "text":
              sendEvent(connId, { kind: "text", content: chunk.content });
              break;
            case "reasoning":
              sendEvent(connId, { kind: "reasoning", content: chunk.content });
              break;
            case "tool_call":
              if (chunk.toolCall) {
                const tc = chunk.toolCall;
                sendEvent(connId, {
                  kind: "tool_start",
                  toolId: tc.id,
                  toolName: tc.function.name,
                  toolArgs: tc.function.arguments,
                });

                // In yolo mode, auto-approve; otherwise send for approval
                if (mode === "yolo") {
                  const result = await executeTool(tc);
                  toolResults.push({ id: tc.id, result });
                  sendEvent(connId, {
                    kind: "tool_end",
                    toolId: tc.id,
                    toolName: tc.function.name,
                    toolResult: result,
                  });
                } else {
                  // Auto-approve read-only tools, ask for write/execute
                  const isReadOnly = ["read_file", "search_files", "grep", "list_files"].includes(tc.function.name);
                  if (isReadOnly || mode === "yolo") {
                    const result = await executeTool(tc);
                    toolResults.push({ id: tc.id, result });
                    sendEvent(connId, {
                      kind: "tool_end",
                      toolId: tc.id,
                      toolName: tc.function.name,
                      toolResult: result,
                    });
                  } else {
                    // In plan mode, block write/execute
                    if (mode === "plan") {
                      const result = JSON.stringify({ blocked: "Plan mode: read-only" });
                      toolResults.push({ id: tc.id, result });
                      sendEvent(connId, {
                        kind: "tool_end",
                        toolId: tc.id,
                        toolName: tc.function.name,
                        toolResult: result,
                      });
                    } else {
                      // Normal mode: auto-approve by default for now
                      // (mobile app can add explicit approval UI later)
                      const result = await executeTool(tc);
                      toolResults.push({ id: tc.id, result });
                      sendEvent(connId, {
                        kind: "tool_end",
                        toolId: tc.id,
                        toolName: tc.function.name,
                        toolResult: result,
                      });
                    }
                  }
                }
              }
              break;
            case "usage":
              sendEvent(connId, {
                kind: "status",
                meta: {
                  usage: chunk.usage,
                  cost: calculateCost(chunk.usage?.promptTokens || 0, chunk.usage?.completionTokens || 0, ds.model),
                },
              });
              break;
            case "done":
              turnComplete = true;
              break;
            case "error":
              sendEvent(connId, { kind: "error", content: chunk.error });
              turnComplete = true;
              break;
          }
        }

        // Add tool results to conversation
        if (toolResults.length > 0) {
          const assistantMsg: ChatMessage = {
            role: "assistant",
            content: "",
            tool_calls: [], // We'll skip the tool calls in history for simplicity
          };
          session.messages.push(assistantMsg);
          
          for (const tr of toolResults) {
            session.messages.push({
              role: "tool",
              content: tr.result,
              tool_call_id: tr.id,
            });
          }
        } else {
          turnComplete = true;
        }
      }

      // Save session
      await SessionStore.save(session);

      sendEvent(connId, { kind: "turn_end", meta: { sessionId: session.meta.id } });
      break;
    }

    case "cancel": {
      sendEvent(connId, { kind: "notice", content: "Cancelled" });
      break;
    }

    case "set_model": {
      const model = msg.model as string;
      ds.setModel(model);
      sendEvent(connId, { kind: "status", meta: { model } });
      break;
    }

    case "get_sessions": {
      const sessions = await SessionStore.list();
      sendEvent(connId, {
        kind: "status",
        meta: { sessions },
      });
      break;
    }

    case "load_session": {
      const sid = msg.sessionId as string;
      const session = await SessionStore.load(sid);
      if (session) {
        conn.sessionId = sid;
        sendEvent(connId, {
          kind: "status",
          meta: {
            sessionLoaded: true,
            sessionId: sid,
            messages: session.messages.filter(m => m.role !== "system"),
            title: session.meta.title,
            model: session.meta.model,
          },
        });
      } else {
        sendEvent(connId, { kind: "error", content: "Session not found" });
      }
      break;
    }

    case "delete_session": {
      await SessionStore.delete(msg.sessionId as string);
      sendEvent(connId, { kind: "notice", content: "Session deleted" });
      break;
    }

    case "rename_session": {
      await SessionStore.rename(msg.sessionId as string, msg.title as string);
      sendEvent(connId, { kind: "notice", content: "Session renamed" });
      break;
    }

    case "new_session": {
      conn.sessionId = null;
      sendEvent(connId, {
        kind: "status",
        meta: { newSession: true, models: MODELS, currentModel: ds.model },
      });
      break;
    }

    default:
      sendEvent(connId, { kind: "notice", content: `Unknown command: ${msg.type}` });
  }
}

function calculateCost(promptTokens: number, completionTokens: number, model: string): string {
  // DeepSeek pricing (approximate per 1M tokens)
  let promptPrice = 0.27; // v4-flash
  let completionPrice = 1.10;
  if (model === "deepseek-v4-pro") {
    promptPrice = 0.55;
    completionPrice = 2.19;
  }
  const cost = (promptTokens / 1_000_000) * promptPrice + (completionTokens / 1_000_000) * completionPrice;
  return `$${cost.toFixed(4)}`;
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Reasonix Mobile Backend v1.5.0`);
  console.log(`HTTP/WS server listening on http://0.0.0.0:${PORT}`);
  if (!DEEPSEEK_API_KEY) {
    console.warn("WARNING: DEEPSEEK_API_KEY not set. Set it via environment variable.");
  }
});