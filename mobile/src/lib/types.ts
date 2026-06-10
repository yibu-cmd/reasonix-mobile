// Message types matching the backend session events
export interface SessionEvent {
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

export interface WSMessage {
  type: string;
  text?: string;
  sessionId?: string;
  model?: string;
  mode?: string;
  effort?: string;
  title?: string;
  [key: string]: unknown;
}

export interface ChatItem {
  id: string;
  kind: "user" | "assistant" | "tool" | "phase" | "notice" | "error" | "compaction";
  text: string;
  reasoning?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  toolStatus?: "running" | "done" | "error";
  toolId?: string;
  streaming?: boolean;
  level?: "info" | "warn" | "error";
  timestamp: number;
}

export interface SessionInfo {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  messageCount: number;
  workspaceRoot?: string;
  scope: "global" | "project";
  topicId?: string;
}

export interface ModelInfo {
  id: string;
  label: string;
  description: string;
}

export interface EffortInfo {
  id: string;
  label: string;
  description: string;
}

export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type AgentMode = "normal" | "plan" | "yolo";
export type CollaborationMode = "normal" | "plan" | "goal";
export type ToolApprovalMode = "ask" | "yolo";

// Todo from todo_write tool
export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
}