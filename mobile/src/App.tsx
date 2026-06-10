import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageSquare,
  History,
  Settings,
  Plus,
  Zap,
} from "lucide-react";
import { useChat } from "./hooks/useChat";
import { ChatBubble, LiveChatBubble } from "./components/ChatBubble";
import { Composer } from "./components/Composer";
import { TodoPanel } from "./components/TodoPanel";
import { StatusBar } from "./components/StatusBar";
import { ModelSelector } from "./components/ModelSelector";
import { SessionList } from "./components/SessionList";
import { SettingsPanel } from "./components/SettingsPanel";
import type { AgentMode } from "./lib/types";

type Screen = "chat" | "history" | "settings";

const MODELS = {
  "deepseek-v4-flash": "DeepSeek V4 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
};

export default function App() {
  const {
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
    loadSession,
    deleteSession,
    renameSession,
    newSession,
    setModel,
    refreshSessions,
  } = useChat();

  const [screen, setScreen] = useState<Screen>("chat");
  const [mode, setMode] = useState<AgentMode>("normal");
  const [currentModel, setCurrentModel] = useState("deepseek-v4-flash");
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dismissedTodo, setDismissedTodo] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, liveText]);

  // Refresh sessions when switching to history
  useEffect(() => {
    if (screen === "history") refreshSessions();
  }, [screen, refreshSessions]);

  const handleSend = useCallback(
    (text: string) => {
      send(text, currentModel, mode);
    },
    [send, currentModel, mode]
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      setCurrentModel(modelId);
      setModel(modelId);
    },
    [setModel]
  );

  const handleLoadSession = useCallback(
    (id: string) => {
      loadSession(id);
      setScreen("chat");
    },
    [loadSession]
  );

  const currentTodoId = todos.length > 0 ? todos.map((t) => t.id).join(",") : null;
  const showTodos = currentTodoId && currentTodoId !== dismissedTodo;

  const turnCount = items.filter((i) => i.kind === "user").length;

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="app-header__left">
          <button className="header-btn" onClick={newSession}>
            <Plus size={20} />
          </button>
          <h1 className="app-header__title">Reasonix</h1>
          {!isConnected && <span className="dot dot--red" />}
          {streaming && <span className="dot dot--green" />}
        </div>
        <div className="app-header__right">
          <button className="header-btn" onClick={() => setShowSessionList(true)}>
            <History size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {screen === "chat" && (
          <div className="chat-screen">
            {/* Messages */}
            <div className="chat-transcript">
              {items.length === 0 && !liveText && !liveReasoning && (
                <div className="welcome">
                  <div className="welcome__logo">
                    <Zap size={40} />
                  </div>
                  <h2>Reasonix Mobile</h2>
                  <p>AI coding assistant in your pocket</p>
                  <div className="welcome__tips">
                    <p>You can ask me to:</p>
                    <ul>
                      <li>Write and debug code</li>
                      <li>Explain complex logic</li>
                      <li>Manage files and projects</li>
                      <li>Execute terminal commands</li>
                    </ul>
                  </div>
                </div>
              )}

              {items.map((item) => (
                <ChatBubble key={item.id} item={item} />
              ))}

              {(liveText || liveReasoning) && (
                <LiveChatBubble text={liveText} reasoning={liveReasoning} />
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Todo Panel */}
            {showTodos && (
              <TodoPanel todos={todos} onDismiss={() => setDismissedTodo(currentTodoId)} />
            )}

            {/* Composer */}
            <Composer
              onSend={handleSend}
              onCancel={cancel}
              running={streaming}
              mode={mode}
              onModeChange={setMode}
              modelLabel={MODELS[currentModel as keyof typeof MODELS] || currentModel}
              onModelSelect={() => setShowModelSelector(true)}
              onSettingsOpen={() => setShowSettings(true)}
            />

            {/* StatusBar */}
            <StatusBar
              modelLabel={MODELS[currentModel as keyof typeof MODELS] || currentModel}
              usage={usage}
              cost={cost}
              isConnected={isConnected}
              turnCount={turnCount}
            />
          </div>
        )}

        {screen === "history" && (
          <div className="page-screen">
            <div className="page-screen__header">
              <h2>History</h2>
              <button className="header-btn" onClick={() => setShowSessionList(true)}>
                <Plus size={18} />
              </button>
            </div>
            <SessionList
              sessions={sessions}
              onSelect={handleLoadSession}
              onDelete={deleteSession}
              onRename={renameSession}
              onClose={() => setScreen("chat")}
              currentSessionId={sessionId}
            />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          className={`bottom-nav__btn${screen === "chat" ? " bottom-nav__btn--active" : ""}`}
          onClick={() => setScreen("chat")}
        >
          <MessageSquare size={20} />
          <span>Chat</span>
        </button>
        <button
          className={`bottom-nav__btn${screen === "history" ? " bottom-nav__btn--active" : ""}`}
          onClick={() => {
            refreshSessions();
            setScreen("history");
          }}
        >
          <History size={20} />
          <span>History</span>
        </button>
        <button
          className={`bottom-nav__btn${screen === "settings" ? " bottom-nav__btn--active" : ""}`}
          onClick={() => setScreen("settings")}
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </nav>

      {/* Modals */}
      {showModelSelector && (
        <ModelSelector
          currentModel={currentModel}
          onSelect={handleModelChange}
          onClose={() => setShowModelSelector(false)}
        />
      )}

      {showSessionList && (
        <SessionList
          sessions={sessions}
          onSelect={handleLoadSession}
          onDelete={deleteSession}
          onRename={renameSession}
          onClose={() => setShowSessionList(false)}
          currentSessionId={sessionId}
        />
      )}

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          currentModel={currentModel}
          onModelChange={handleModelChange}
        />
      )}
    </div>
  );
}