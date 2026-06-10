import { X, CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import type { TodoItem } from "../lib/types";

interface Props {
  todos: TodoItem[];
  onDismiss: () => void;
}

const priorityColors: Record<string, string> = {
  high: "var(--color-red)",
  medium: "var(--color-yellow)",
  low: "var(--color-muted)",
};

export function TodoPanel({ todos, onDismiss }: Props) {
  if (todos.length === 0) return null;

  const statusIcon = (todo: TodoItem) => {
    switch (todo.status) {
      case "completed":
        return <CheckCircle2 size={14} color="var(--color-green)" />;
      case "in_progress":
        return <Loader2 size={14} className="spin" color="var(--color-accent)" />;
      default:
        return <Circle size={14} color={priorityColors[todo.priority] || "var(--color-muted)"} />;
    }
  };

  return (
    <div className="todo-panel">
      <div className="todo-panel__header">
        <span className="todo-panel__title">Tasks</span>
        <button className="todo-panel__dismiss" onClick={onDismiss}>
          <X size={14} />
        </button>
      </div>
      <div className="todo-panel__list">
        {todos.map((todo) => (
          <div key={todo.id} className={`todo-panel__item todo-panel__item--${todo.status}`}>
            {statusIcon(todo)}
            <span className={`todo-panel__text${todo.status === "completed" ? " todo-panel__text--done" : ""}`}>
              {todo.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}