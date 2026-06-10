import { useState, useRef, useEffect } from "react";
import { Send, StopCircle, Mic, Paperclip, Zap, Brain, ShieldCheck, Target } from "lucide-react";
import type { AgentMode } from "../lib/types";

interface Props {
  onSend: (text: string) => void;
  onCancel: () => void;
  running: boolean;
  disabled?: boolean;
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  modelLabel: string;
  onModelSelect: () => void;
  onSettingsOpen: () => void;
}

const MODES: { id: AgentMode; label: string; icon: typeof Zap; description: string }[] = [
  { id: "normal", label: "Normal", icon: Zap, description: "Standard mode" },
  { id: "plan", label: "Plan", icon: Brain, description: "Plan before acting" },
  { id: "yolo", label: "YOLO", icon: ShieldCheck, description: "Auto-approve all tools" },
];

export function Composer({ onSend, onCancel, running, disabled, mode, onModeChange, modelLabel, onModelSelect, onSettingsOpen }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (!text.trim() || running || disabled) return;
    onSend(text.trim());
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="composer">
      {/* Mode Bar */}
      <div className="composer__modes">
        {MODES.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              className={`composer__mode-btn${mode === m.id ? " composer__mode-btn--active" : ""}`}
              onClick={() => onModeChange(m.id)}
              disabled={disabled}
            >
              <Icon size={14} />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="composer__input-row">
        <textarea
          ref={inputRef}
          className="composer__input"
          placeholder="Ask Reasonix..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          style={{ height: "auto", minHeight: 40, maxHeight: 120 }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
          }}
        />
        
        {running ? (
          <button className="composer__btn composer__btn--cancel" onClick={onCancel}>
            <StopCircle size={20} />
          </button>
        ) : (
          <button
            className="composer__btn composer__btn--send"
            onClick={handleSend}
            disabled={!text.trim() || disabled}
          >
            <Send size={20} />
          </button>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="composer__bar">
        <div className="composer__bar-left">
          <button className="composer__bar-btn" onClick={onModelSelect}>
            {modelLabel}
          </button>
          <button className="composer__bar-btn" onClick={onSettingsOpen}>
            <Target size={14} />
          </button>
          <button className="composer__bar-btn" disabled>
            <Paperclip size={14} />
          </button>
          <button className="composer__bar-btn" disabled>
            <Mic size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}