import { useState } from "react";
import { Trash2, Edit2, Check, X, Clock, MessageSquare, FolderOpen } from "lucide-react";
import type { SessionInfo } from "../lib/types";

interface Props {
  sessions: SessionInfo[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onClose: () => void;
  currentSessionId: string | null;
}

export function SessionList({ sessions, onSelect, onDelete, onRename, onClose, currentSessionId }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  const startRename = (session: SessionInfo) => {
    setRenamingId(session.id);
    setRenameText(session.title);
  };

  const commitRename = () => {
    if (renamingId && renameText.trim()) {
      onRename(renamingId, renameText.trim());
    }
    setRenamingId(null);
    setRenameText("");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet modal-sheet--full" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__header">
          <h2>Sessions</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-sheet__list">
          {sessions.length === 0 && (
            <div className="empty-state">
              <MessageSquare size={32} />
              <p>No sessions yet</p>
            </div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item${session.id === currentSessionId ? " session-item--active" : ""}`}
            >
              <div className="session-item__main" onClick={() => { onSelect(session.id); onClose(); }}>
                <div className="session-item__icon">
                  <MessageSquare size={16} />
                </div>
                <div className="session-item__info">
                  {renamingId === session.id ? (
                    <div className="session-item__rename" onClick={(e) => e.stopPropagation()}>
                      <input
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        autoFocus
                      />
                      <button onClick={commitRename}><Check size={14} /></button>
                      <button onClick={() => setRenamingId(null)}><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <span className="session-item__title">{session.title}</span>
                      <span className="session-item__meta">
                        <Clock size={10} />
                        {new Date(session.updatedAt).toLocaleDateString()}
                        <span className="session-item__count">{session.messageCount} msgs</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="session-item__actions">
                <button onClick={() => startRename(session)} title="Rename">
                  <Edit2 size={12} />
                </button>
                <button onClick={() => onDelete(session.id)} title="Delete">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}