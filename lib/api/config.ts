import axios, { AxiosError, AxiosInstance } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api-v1";

const WSS_URL = process.env.NEXT_PUBLIC_API_WSS || "ws://localhost:8000";
const WSS_BASE = process.env.NEXT_PUBLIC_API_BASE_WSS || "/ws";

// Log the API URL in development to help debug
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log("API Configuration:", {
    API_URL,
    API_BASE,
    fullURL: `${API_URL}${API_BASE}`,
  });
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}${API_BASE}`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("auth_token");
      if (token) {
        config.headers.Authorization = `Token ${token}`;
      }

      // Log request in development
      if (process.env.NODE_ENV === "development") {
        console.log(
          `🔵 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${
            config.url
          }`,
          {
            params: config.params,
            hasAuth: !!token,
          }
        );
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => {
    // Log successful response in development
    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "development"
    ) {
      const url = response.config.url || "";
      const method = response.config.method?.toUpperCase() || "";
      console.log(`🟢 API Response: ${method} ${url}`, {
        status: response.status,
        dataType: Array.isArray(response.data) ? "array" : typeof response.data,
        dataLength: Array.isArray(response.data)
          ? response.data.length
          : response.data?.results
          ? response.data.results.length
          : "N/A",
      });
    }
    return response;
  },
  (error: AxiosError) => {
    // Log error response in development
    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "development"
    ) {
      try {
        const url =
          typeof error.config?.url === "string" ? error.config!.url : "";
        const method =
          typeof error.config?.method === "string"
            ? error.config!.method.toUpperCase()
            : "";

        // Build a safe, serializable summary string instead of passing potentially
        // complex objects directly to console.error which can throw in some environments.
        let status: string | number | undefined = undefined;
        let statusText: string | undefined = undefined;
        let data: any = undefined;
        try {
          // Access nested properties in a guarded way — protect against getters that may throw
          status =
            error.response &&
            typeof (error.response as any).status !== "undefined"
              ? (error.response as any).status
              : undefined;
          statusText =
            error.response &&
            typeof (error.response as any).statusText === "string"
              ? (error.response as any).statusText
              : undefined;
          data =
            error.response &&
            typeof (error.response as any).data !== "undefined"
              ? (error.response as any).data
              : undefined;
        } catch (_) {
          // ignore any issues accessing nested properties
        }

        const safeStringify = (v: any) => {
          try {
            return JSON.stringify(v);
          } catch (_) {
            try {
              return String(v);
            } catch (__) {
              return "[unserializable]";
            }
          }
        };

        const parts = [`🔴 API Error: ${method} ${url}`];
        if (typeof status !== "undefined") parts.push(`status=${status}`);
        if (typeof statusText !== "undefined")
          parts.push(`statusText=${statusText}`);
        if (typeof data !== "undefined")
          parts.push(`data=${safeStringify(data)}`);

        console.error(parts.join(" | "));
      } catch (logErr) {
        try {
          console.error("🔴 API Error (logging failed):", String(logErr));
        } catch (_) {}
      }
    }

    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

type WSHandlers = {
  onOpen?: (ev: Event) => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;
  onMessage?: (data: any) => void;
};

export class WebSocketClient {
  private url: string;
  private token?: string | null;

  private ws: WebSocket | null = null;
  private handlers: WSHandlers;

  private reconnectInterval = 3000;
  private shouldReconnect = true;

  // NEW: prevent duplicate connects + allow reconnect timer cleanup
  private isConnecting = false;
  private reconnectTimer: number | null = null;

  // NEW: queue messages attempted before OPEN
  private sendQueue: string[] = [];

  // request/response support for one-off requests (resolve room, history_request, etc.)
  private pendingRequests: Map<
    string,
    {
      resolve: (v: any) => void;
      reject: (e: any) => void;
      timer?: number | null;
    }
  > = new Map();
  private requestTimeoutMs = 8000;

  // NEW: keepalive (helps prevent silent disconnects / slow “first load”)
  private heartbeatTimer: number | null = null;
  private heartbeatMs = 25000;

  constructor(url: string, token?: string | null, handlers: WSHandlers = {}) {
    this.url = url;
    this.token = token;
    this.handlers = handlers;
  }

  private buildUrlWithToken() {
    const sep = this.url.includes("?") ? "&" : "?";
    return this.token
      ? `${this.url}${sep}token=${encodeURIComponent(this.token)}`
      : this.url;
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // send a ping regularly to keep connection alive (server may ignore)
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
        } catch {
          // ignore
        }
      }
    }, this.heartbeatMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer != null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private flushQueue() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.sendQueue.length > 0) {
      const msg = this.sendQueue.shift();
      if (!msg) continue;
      try {
        this.ws.send(msg);
      } catch {
        // if send fails, push it back and stop trying
        this.sendQueue.unshift(msg);
        break;
      }
    }
  }

  connect() {
    // Idempotent: don't open multiple sockets
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    if (this.isConnecting) return;

    this.isConnecting = true;
    this.clearReconnectTimer();

    const urlWithToken = this.buildUrlWithToken();
    console.log("WebSocketClient.connect: opening", { urlWithToken });

    try {
      this.ws = new WebSocket(urlWithToken);
    } catch (err) {
      this.isConnecting = false;
      console.warn("WebSocketClient.connect: constructor threw", err, {
        urlWithToken,
      });
      throw err;
    }

    this.ws.onopen = (ev) => {
      this.isConnecting = false;
      console.log("WebSocketClient.onopen", { urlWithToken });

      this.startHeartbeat();

      // IMPORTANT: flush queued messages immediately so "load history" works
      this.flushQueue();

      this.handlers.onOpen?.(ev);
    };

    this.ws.onclose = (ev) => {
      this.isConnecting = false;
      this.stopHeartbeat();

      console.log("WebSocketClient.onclose", {
        code: ev?.code,
        reason: ev?.reason,
        urlWithToken,
      });

      this.handlers.onClose?.(ev);

      if (this.shouldReconnect) {
        this.clearReconnectTimer();
        this.reconnectTimer = window.setTimeout(
          () => this.connect(),
          this.reconnectInterval
        );
      }
    };

    this.ws.onerror = (ev) => {
      this.isConnecting = false;
      this.handlers.onError?.(ev);
    };

    this.ws.onmessage = (ev) => {
      try {
        try {
          console.debug("WebSocketClient.onmessage.raw", ev.data);
        } catch {
          // ignore
        }

        const payload = JSON.parse(ev.data);

        // Normalize chatroom avatar paths
        try {
          const apiRaw = WSS_URL + WSS_BASE || "https://api.oysloe.com/api-v1";
          let apiOrigin = "";
          try {
            apiOrigin = new URL(apiRaw).origin;
          } catch {
            apiOrigin = apiRaw.replace(/\/+$/, "");
          }

          const normalizeSrc = (src: any) => {
            if (src == null) return null;
            const s = String(src).trim();
            if (s === "") return null;
            if (s.startsWith("http://") || s.startsWith("https://")) return s;
            if (s.startsWith("/")) return `${apiOrigin}${s}`;
            return `${apiOrigin}/${s.replace(/^\/+/, "")}`;
          };

          const normalizeRoomObj = (r: any) => {
            if (!r || typeof r !== "object") return;
            if (r.other_user_avatar != null)
              r.other_user_avatar = normalizeSrc(r.other_user_avatar);
            if (r.avatar != null) r.avatar = normalizeSrc(r.avatar);
            if (r.image != null) r.image = normalizeSrc(r.image);
            if (r.last_message && typeof r.last_message === "object") {
              if (r.last_message.avatar != null)
                r.last_message.avatar = normalizeSrc(r.last_message.avatar);
            }
          };

          if (payload && typeof payload === "object") {
            if (Array.isArray((payload as any).chatrooms))
              (payload as any).chatrooms.forEach(normalizeRoomObj);
            if (Array.isArray((payload as any).rooms))
              (payload as any).rooms.forEach(normalizeRoomObj);
            if (
              (payload as any).room &&
              typeof (payload as any).room === "object"
            )
              normalizeRoomObj((payload as any).room);
            if (Array.isArray(payload)) payload.forEach(normalizeRoomObj);
          }
        } catch {
          // ignore
        }

        try {
          console.debug("WebSocketClient.onmessage.parsed", payload);
        } catch {
          // ignore
        }

        // Request/response handling: if payload contains `req_id`, resolve the associated Promise
        try {
          if (
            payload &&
            typeof payload === "object" &&
            (payload as any).req_id
          ) {
            try {
              const reqId = String((payload as any).req_id);
              const pending = this.pendingRequests.get(reqId);
              if (pending) {
                try {
                  if (pending.timer != null) clearTimeout(pending.timer);
                } catch {}
                try {
                  pending.resolve(payload);
                } catch {
                  // ignore resolution errors
                }
                this.pendingRequests.delete(reqId);
              }
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }

        // Save normalized chatrooms list
        try {
          if (
            typeof window !== "undefined" &&
            window.localStorage &&
            payload &&
            typeof payload === "object"
          ) {
            let toSave: any = null;
            if (
              Array.isArray((payload as any).chatrooms) &&
              (payload as any).chatrooms.length > 0
            ) {
              toSave = (payload as any).chatrooms;
            } else if (Array.isArray(payload) && payload.length > 0) {
              toSave = payload;
            }
            if (toSave) {
              try {
                localStorage.setItem(
                  "oysloe_chatrooms",
                  JSON.stringify(toSave)
                );
              } catch {
                // ignore
              }
            }
          }
        } catch {
          // ignore
        }

        this.handlers.onMessage?.(payload);
      } catch (err) {
        try {
          console.debug("WebSocketClient.onmessage.rawNonJson", ev.data);
        } catch {
          // ignore
        }
        this.handlers.onMessage?.(ev.data);
      }
    };
  }

  // NEW behavior: if not open yet, queue it (don’t throw)
  send(data: unknown) {
    const payload = typeof data === "string" ? data : JSON.stringify(data);

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      // ensure we connect if someone tries to send early
      this.sendQueue.push(payload);
      this.connect();
      return;
    }

    if (this.ws.readyState === WebSocket.CONNECTING) {
      this.sendQueue.push(payload);
      return;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      this.sendQueue.push(payload);
      return;
    }

    this.ws.send(payload);
  }

  /**
   * Send a request and await a single response that includes the same `req_id`.
   * The server must echo back the `req_id` property in the reply for this to work.
   */
  sendRequest(data: unknown, timeoutMs?: number): Promise<any> {
    const reqId =
      typeof crypto !== "undefined" &&
      typeof (crypto as any).randomUUID === "function"
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payloadObj =
      typeof data === "string" ? { payload: data } : (data as any) || {};
    payloadObj.req_id = reqId;

    // queue/send
    try {
      this.send(payloadObj);
    } catch (err) {
      // will still be rejected by timeout below
    }

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error("WebSocket request timeout"));
      }, timeoutMs ?? this.requestTimeoutMs);
      this.pendingRequests.set(reqId, { resolve, reject, timer });
    });
  }

  close() {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.stopHeartbeat();

    // reject any pending requests
    try {
      this.pendingRequests.forEach((p) => {
        try {
          if (p.timer != null) clearTimeout(p.timer);
        } catch {}
        try {
          p.reject(new Error("WebSocket closed"));
        } catch {}
      });
    } catch {
      // ignore
    }
    this.pendingRequests.clear();

    this.sendQueue = [];
    this.ws?.close();
    this.ws = null;
    this.isConnecting = false;
  }

  isOpen() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default apiClient;
