import { useState } from "react";
import { X, ChevronRight, Sun, Moon, Monitor, Cpu, Globe, Server, Wrench, BookmarkCheck, Link2, Brain, Zap } from "lucide-react";

type SettingsTab = "general" | "appearance" | "models" | "providers" | "mcp" | "skills" | "hooks" | "memory";

interface Props {
  onClose: () => void;
  currentModel: string;
  onModelChange: (model: string) => void;
}

const TABS: { id: SettingsTab; label: string; icon: typeof Sun }[] = [
  { id: "general", label: "General", icon: Cpu },
  { id: "appearance", label: "Appearance", icon: Sun },
  { id: "models", label: "Models", icon: Brain },
  { id: "providers", label: "Providers", icon: Server },
  { id: "mcp", label: "MCP", icon: Link2 },
  { id: "skills", label: "Skills", icon: Wrench },
  { id: "hooks", label: "Hooks", icon: BookmarkCheck },
  { id: "memory", label: "Memory", icon: Zap },
];

export function SettingsPanel({ onClose, currentModel, onModelChange }: Props) {
  const [tab, setTab] = useState<SettingsTab>("general");
  const [theme, setTheme] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.getAttribute("data-theme") || "dark";
    }
    return "dark";
  });
  const [language, setLanguage] = useState("zh");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const applyTheme = (t: string) => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("reasonix-theme", t);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet modal-sheet--full" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__header">
          <h2>Settings</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {tab === "general" && (
          <div className="settings-section">
            <div className="settings-group">
              <h3>API Configuration</h3>
              <div className="settings-field">
                <label>DeepSeek API Key</label>
                <div className="settings-input-row">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                  <button onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-group">
              <h3>Language</h3>
              <div className="settings-field">
                <div className="settings-options">
                  {[
                    { id: "zh", label: "中文" },
                    { id: "en", label: "English" },
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      className={`settings-option${language === lang.id ? " settings-option--active" : ""}`}
                      onClick={() => setLanguage(lang.id)}
                    >
                      <Globe size={14} />
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "appearance" && (
          <div className="settings-section">
            <div className="settings-group">
              <h3>Theme</h3>
              <div className="settings-options settings-options--grid">
                {[
                  { id: "dark", label: "Dark", icon: Moon },
                  { id: "light", label: "Light", icon: Sun },
                  { id: "auto", label: "System", icon: Monitor },
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      className={`settings-option theme-card${theme === t.id ? " settings-option--active" : ""}`}
                      onClick={() => applyTheme(t.id)}
                    >
                      <Icon size={24} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "models" && (
          <div className="settings-section">
            <div className="settings-group">
              <h3>Active Model</h3>
              <div className="settings-options">
                {[
                    { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", desc: "Fast & cost-efficient" },
                    { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", desc: "Deep reasoning" },
                  ].map((m) => (
                  <button
                    key={m.id}
                    className={`settings-option settings-option--wide${currentModel === m.id ? " settings-option--active" : ""}`}
                    onClick={() => onModelChange(m.id)}
                  >
                    <div>
                      <span className="settings-option__title">{m.label}</span>
                      <span className="settings-option__desc">{m.desc}</span>
                    </div>
                    {currentModel === m.id && <Zap size={14} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "providers" && (
          <div className="settings-section">
            <div className="settings-group">
              <h3>Provider</h3>
              <div className="settings-options">
                <button className="settings-option settings-option--wide settings-option--active">
                  <Server size={16} />
                  <div>
                    <span className="settings-option__title">DeepSeek</span>
                    <span className="settings-option__desc">api.deepseek.com</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "mcp" && (
          <div className="settings-section">
            <div className="settings-group">
              <h3>MCP Servers</h3>
              <p className="settings-hint">Configure MCP (Model Context Protocol) servers to extend capabilities.</p>
              <div className="empty-state">
                <Link2 size={24} />
                <p>No MCP servers configured</p>
              </div>
            </div>
          </div>
        )}

        {tab === "skills" && (
          <div className="settings-section">
            <div className="settings-group">
              <h3>Skills</h3>
              <p className="settings-hint">Custom skills written as Markdown instructions.</p>
              <div className="empty-state">
                <Wrench size={24} />
                <p>No skills installed</p>
              </div>
            </div>
          </div>
        )}

        {tab === "hooks" && (
          <div className="settings-section">
            <div className="settings-group">
              <h3>Hooks</h3>
              <p className="settings-hint">Custom scripts triggered on session events.</p>
              <div className="empty-state">
                <BookmarkCheck size={24} />
                <p>No hooks configured</p>
              </div>
            </div>
          </div>
        )}

        {tab === "memory" && (
          <div className="settings-section">
            <div className="settings-group">
              <h3>Memory</h3>
              <p className="settings-hint">Persistent context that Reasonix remembers across sessions.</p>
              <div className="empty-state">
                <Brain size={24} />
                <p>No memories stored</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="settings-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`settings-tab${tab === t.id ? " settings-tab--active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <Icon size={16} />
                <span>{t.label}</span>
                {tab === t.id && <div className="settings-tab__indicator" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}