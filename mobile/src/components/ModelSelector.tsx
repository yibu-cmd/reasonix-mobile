import { useState } from "react";
import { Search, Bot, Brain, Zap, X } from "lucide-react";

interface ModelOption {
  id: string;
  label: string;
  description: string;
}

const MODELS: ModelOption[] = [
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", description: "Fast and cost-efficient model" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", description: "Deep reasoning for complex problems" },
];

interface Props {
  currentModel: string;
  onSelect: (modelId: string) => void;
  onClose: () => void;
}

export function ModelSelector({ currentModel, onSelect, onClose }: Props) {
  const [search, setSearch] = useState("");

  const filtered = MODELS.filter(
    (m) =>
      m.label.toLowerCase().includes(search.toLowerCase()) ||
      m.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__header">
          <h2>Select Model</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-sheet__search">
          <Search size={14} />
          <input
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-sheet__list">
          {filtered.map((m) => (
            <button
              key={m.id}
              className={`model-item${m.id === currentModel ? " model-item--active" : ""}`}
              onClick={() => {
                onSelect(m.id);
                onClose();
              }}
            >
              <div className="model-item__icon">
                {m.id === "deepseek-reasoner" ? <Brain size={18} /> : <Zap size={18} />}
              </div>
              <div className="model-item__info">
                <span className="model-item__name">{m.label}</span>
                <span className="model-item__desc">{m.description}</span>
              </div>
              {m.id === currentModel && (
                <span className="model-item__check">
                  <Bot size={14} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}