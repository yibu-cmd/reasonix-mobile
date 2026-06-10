import { useState } from "react";
import { Bot, User, Wrench, ChevronDown, ChevronUp, AlertCircle, Info } from "lucide-react";
import type { ChatItem } from "../lib/types";

interface Props {
  item: ChatItem;
}

export function ChatBubble({ item }: Props) {
  const [reasoningExpanded, setReasoningExpanded] = useState(true);
  const [toolExpanded, setToolExpanded] = useState(true);

  if (item.kind === "user") {
    return (
      <div className="chat-bubble chat-bubble--user">
        <div className="chat-bubble__icon chat-bubble__icon--user">
          <User size={16} />
        </div>
        <div className="chat-bubble__content chat-bubble__content--user">
          <p>{item.text}</p>
        </div>
      </div>
    );
  }

  if (item.kind === "assistant") {
    return (
      <div className="chat-bubble chat-bubble--assistant">
        <div className="chat-bubble__icon chat-bubble__icon--assistant">
          <Bot size={16} />
        </div>
        <div className="chat-bubble__content chat-bubble__content--assistant">
          {item.reasoning && (
            <div className="reasoning-block">
              <button
                className="reasoning-block__toggle"
                onClick={() => setReasoningExpanded(!reasoningExpanded)}
              >
                {reasoningExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>Reasoning</span>
              </button>
              {reasoningExpanded && (
                <div className="reasoning-block__content">
                  {item.reasoning}
                </div>
              )}
            </div>
          )}
          <div className="markdown-content">{item.text}</div>
        </div>
      </div>
    );
  }

  if (item.kind === "tool") {
    return (
      <div className="chat-bubble chat-bubble--tool">
        <div className="chat-bubble__icon chat-bubble__icon--tool">
          <Wrench size={14} />
        </div>
        <div className="chat-bubble__content chat-bubble__content--tool">
          <button
            className="tool-card__toggle"
            onClick={() => setToolExpanded(!toolExpanded)}
          >
            {toolExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span className="tool-card__name">{item.toolName}</span>
            {item.toolStatus === "running" && (
              <span className="tool-card__status tool-card__status--running">Running...</span>
            )}
            {item.toolStatus === "done" && (
              <span className="tool-card__status tool-card__status--done">Done</span>
            )}
            {item.toolStatus === "error" && (
              <span className="tool-card__status tool-card__status--error">Error</span>
            )}
          </button>
          {toolExpanded && (
            <div className="tool-card__details">
              {item.toolArgs && (
                <pre className="tool-card__code">{item.toolArgs}</pre>
              )}
              {item.toolResult && (
                <pre className="tool-card__code">{item.toolResult.slice(0, 2000)}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (item.kind === "notice") {
    return (
      <div className="chat-bubble chat-bubble--notice">
        <Info size={14} />
        <span>{item.text}</span>
      </div>
    );
  }

  if (item.kind === "error") {
    return (
      <div className="chat-bubble chat-bubble--error">
        <AlertCircle size={14} />
        <span>{item.text}</span>
      </div>
    );
  }

  return null;
}

interface LiveChatBubbleProps {
  text: string;
  reasoning: string;
}

export function LiveChatBubble({ text, reasoning }: LiveChatBubbleProps) {
  const [reasoningExpanded, setReasoningExpanded] = useState(true);
  if (!text && !reasoning) return null;

  return (
    <div className="chat-bubble chat-bubble--assistant">
      <div className="chat-bubble__icon chat-bubble__icon--assistant">
        <Bot size={16} />
      </div>
      <div className="chat-bubble__content chat-bubble__content--assistant">
        {reasoning && (
          <div className="reasoning-block">
            <button
              className="reasoning-block__toggle"
              onClick={() => setReasoningExpanded(!reasoningExpanded)}
            >
              {reasoningExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>Reasoning</span>
            </button>
            {reasoningExpanded && (
              <div className="reasoning-block__content">
                {reasoning}
              </div>
            )}
          </div>
        )}
        {text && <div className="markdown-content">{text}</div>}
        <span className="streaming-cursor">|</span>
      </div>
    </div>
  );
}