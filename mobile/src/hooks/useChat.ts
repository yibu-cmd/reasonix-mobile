import { useState, useEffect, useCallback, useRef } from "react";
import { wsClient } from "../lib/wsclient";
import type { ChatItem, SessionInfo, SessionEvent, TodoItem } from "./types";

interface UseChatReturn {
  items: ChatItem[];
  liveText: string;
  liveReasoning: string;
  streaming: boolean;
  sessionId: string | null;
  isConnected: boolean;
  sessions: SessionInfo[];
  todos: TodoItem[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  cost: string;
  send: (text: string, model?: string, mode?: string, effort?: string) => void;
  cancel: () => void;
  clearItems: () => void;
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  newSession: () => void;
  setModel: (model: string) => void;
  refreshSessions: () => void;
}

export function useChat(): UseChatReturn {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [liveText, setLiveText] = useState("");
  const [liveReasoning, setLiveReasoning] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [usage, setUsage] = useState<{ promptTokens: number; completionTokens: number; totalTokens: number } | null>(null);
  const [cost, setCost] = useState("$0.00");
  const itemsRef = useRef<ChatItem[]>([]);

  // Keep ref in sync
  itemsRef.current = items;

  useEffect(() => {
    wsClient.connect();

    const unsubEvent = wsClient.onEvent((event: SessionEvent) => {
      handleEvent(event);
    });

    const unsubConn = wsClient.onConnection((connected) => {
      setIsConnected(connected);
    });

    return () => {
      unsubEvent();
      unsubConn();
    };
  }, []);

  const handleEvent = useCallback((event: SessionEvent) => {
    switch (event.kind) {
      case "text":
        setLiveText((prev) => prev + (event.content || ""));
        setStreaming(true);
        break;

      case "reasoning":
        setLiveReasoning((prev) => prev + (event.content || ""));
        break;

      case "tool_start":
        setItems((prev) => [
          ...prev,
          {
            id: event.toolId || `tool-${Date.now()}`,
            kind: "tool",
            text: "",
            toolName: event.toolName,
            toolArgs: event.toolArgs,
            toolStatus: "running",
            toolId: event.toolId,
            timestamp: Date.now(),
          },
        ]);
        break;

      case "tool_end": {
        const tid = event.toolId;
        setItems((prev) =>
          prev.map((item) =>
            item.toolId === tid
              ? {
                  ...item,
                  toolResult: event.toolResult,
                  toolStatus: event.toolResult?.includes('"error"') ? "error" : "done",
                }
              : item
          )
        );
        // Parse todo_write results
        if (event.toolName === "todo_write" && event.toolResult) {
          try {
            const result = JSON.parse(event.toolResult);
            if (result.todos) {
              setTodos(result.todos);
            }
          } catch {}
        }
        break;
      }

      case "turn_end": {
        // Flush live text into items
        if (liveText || liveReasoning) {
          setItems((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              kind: "assistant",
              text: liveText,
              reasoning: liveReasoning,
              timestamp: Date.now(),
            },
          ]);
        }
        setLiveText("");
        setLiveReasoning("");
        setStreaming(false);
        if (event.meta?.sessionId) {
          setSessionId(event.meta.sessionId as string);
          wsClient.setSessionId(event.meta.sessionId as string);
        }
        break;
      }

      case "notice":
        setItems((prev) => [
          ...prev,
          {
            id: `notice-${Date.now()}`,
            kind: "notice",
            text: event.content || "",
            timestamp: Date.now(),
          },
        ]);
        break;

      case "error":
        setItems((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            kind: "error",
            text: event.content || "Unknown error",
            timestamp: Date.now(),
          },
        ]);
        setStreaming(false);
        break;

      case "status":
        if (event.meta) {
          if (event.meta.sessions) {
            setSessions(event.meta.sessions as SessionInfo[]);
          }
          if (event.meta.usage) {
            setUsage(event.meta.usage as typeof usage);
          }
          if (event.meta.cost) {
            setCost(event.meta.cost as string);
          }
          if (event.meta.sessionId) {
            setSessionId(event.meta.sessionId as string);
            wsClient.setSessionId(event.meta.sessionId as string);
          }
          if (event.meta.sessionLoaded && event.meta.messages) {
            const msgs = event.meta.messages as Array<{ role: string; content: string; reasoning_content?: string; tool_call_id?: string }>;
            const chatItems: ChatItem[] = msgs.map((m, i) => ({
              id: `hist-${i}`,
              kind: m.role as ChatItem["kind"],
              text: m.content || "",
              reasoning: m.reasoning_content,
              timestamp: Date.now() - msgs.length + i,
            }));
            setItems(chatItems);
          }
          if (event.meta.newSession) {
            setItems([]);
            setSessionId(null);
            setLiveText("");
            setLiveReasoning("");
            setTodos([]);
            wsClient.setSessionId(null);
          }
        }
        break;
    }
  }, [liveText, liveReasoning]);

  const send = useCallback((text: string, model?: string, mode?: string, effort?: string) => {
    if (!text.trim()) return;

    // Add user message
    setItems((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        kind: "user",
        text,
        timestamp: Date.now(),
      },
    ]);
    setLiveText("");
    setLiveReasoning("");

    wsClient.send({
      type: "chat",
      text,
      sessionId: sessionId || undefined,
      model: model || undefined,
      mode: mode || "normal",
      effort: effort || "medium",
    });
  }, [sessionId]);

  const cancel = useCallback(() => {
    wsClient.send({ type: "cancel" });
    setStreaming(false);
  }, []);

  const clearItems = useCallback(() => {
    setItems([]);
    setTodos([]);
  }, []);

  const loadSession = useCallback((id: string) => {
    wsClient.send({ type: "load_session", sessionId: id });
  }, []);

  const deleteSession = useCallback((id: string) => {
    wsClient.send({ type: "delete_session", sessionId: id });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const renameSession = useCallback((id: string, title: string) => {
    wsClient.send({ type: "rename_session", sessionId: id, title });
  }, []);

  const newSession = useCallback(() => {
    wsClient.send({ type: "new_session" });
    setItems([]);
    setSessionId(null);
    setLiveText("");
    setLiveReasoning("");
    setTodos([]);
    wsClient.setSessionId(null);
  }, []);

  const setModel = useCallback((model: string) => {
    wsClient.send({ type: "set_model", model });
  }, []);

  const refreshSessions = useCallback(() => {
    wsClient.send({ type: "get_sessions" });
  }, []);

  return {
    items,
    liveText,
    liveReasoning,
    streaming,
    sessionId,
    isConnected,
    sessions,
    todos,
    usage,
    cost,
    send,
    cancel,
    clearItems,
    loadSession,
    deleteSession,
    renameSession,
    newSession,
    setModel,
    refreshSessions,
  };
}