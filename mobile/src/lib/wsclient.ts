const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "ws://localhost:3456";

type EventHandler = (event: import("./types").SessionEvent) => void;
type ConnectionHandler = (connected: boolean) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private handlers = new Set<EventHandler>();
  private connectionHandlers = new Set<ConnectionHandler>();
  private messageQueue: string[] = [];
  private sessionId: string | null = null;

  connect(url?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    const wsUrl = url || BACKEND_URL;
    
    console.log(`Connecting to ${wsUrl}...`);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.connectionHandlers.forEach(h => h(true));
      // Flush queued messages
      while (this.messageQueue.length > 0) {
        const msg = this.messageQueue.shift()!;
        this.ws?.send(msg);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {
          console.log("Connected to backend:", data);
          return;
        }
        if (data.type === "session_event") {
          // If we get a new session ID, store it
          if (data.meta?.sessionId) {
            this.sessionId = data.meta.sessionId;
          }
          this.handlers.forEach(h => h(data as import("./types").SessionEvent));
        }
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
      this.connectionHandlers.forEach(h => h(false));
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  send(msg: WSMessageType) {
    const data = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.messageQueue.push(data);
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
      }
    }
  }

  onEvent(handler: EventHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onConnection(handler: ConnectionHandler) {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  setSessionId(id: string | null) {
    this.sessionId = id;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

type WSMessageType = import("./types").WSMessage;

export const wsClient = new WSClient();