import { useCallback, useEffect, useRef, useState } from "react";
import { WebSocketClient } from "../api/config";

const WSS_URL = process.env.NEXT_PUBLIC_API_WSS || "ws://localhost:8000";
const WSS_BASE = process.env.NEXT_PUBLIC_API_BASE_WSS || "/ws";
export type ChatMember = {
  id: number;
  name?: string;
  email?: string;
  avatar?: string | null;
  is_staff?: boolean;
  is_superuser?: boolean;
};

export type ChatRoom = {
  id: number;
  room_id: string;
  name: string;
  is_group: boolean;
  members: ChatMember[];
  messages?: Message[];
  created_at: string;
  total_unread?: number;

  // Backend fields from your WebSocket message
  other_user_name?: string | null;
  other_user_avatar?: string | null;
  avatar?: string | null;
  last_message?: {
    text: string;
    is_media: boolean;
    created_at: string;
    sender: string;
  } | null;

  // Additional backend fields
  product_id?: string;
  ad_name?: string;
  ad_image?: string;
  unread?: number; // Alias for total_unread from backend

  // TODO: Backend will add these fields; for now use fallbacks below
  // case_id?: string;
  // status?: string;
  // is_closed?: boolean;
};

export type Message = {
  id: number;
  room: number;
  sender: ChatMember;
  content: string;
  created_at: string;
  is_read?: boolean;
};
type RoomMessages = Record<string, Message[]>;

export type UseWsChatReturn = {
  messages: RoomMessages;
  chatrooms: ChatRoom[];
  roomUserMap: Record<string, { name?: string | null; avatar?: string | null }>;
  unreadCount: number;
  typing: Record<string, number[]>;
  connectToRoom: (
    roomId: string,
    opts?: {
      lastSeen?: string | number | null;
      lastMessageId?: string | number | null;
    }
  ) => Promise<string | undefined>;
  connectToChatroomsList: () => void;
  connectToUnreadCount: () => void;
  sendMessage: (
    roomId: string,
    text: string,
    tempId?: string,
    file?: File | Blob
  ) => Promise<void>;
  sendTyping: (roomId: string, typing: boolean) => void;
  markAsRead: (roomId: string) => Promise<void>;
  isRoomConnected: (roomId: string) => boolean;
  addLocalMessage: (roomId: string, msg: Message) => void;
  leaveRoom: (roomId: string) => void;
  closeAll: () => void;
  lastUpdateTime: number;
};

function getWsBase() {
  return `${WSS_URL.replace(/^http/, "ws")}${WSS_BASE}`;
}

export default function useWsChat(): UseWsChatReturn {
  const [messages, setMessages] = useState<RoomMessages>({});
  const [chatrooms, setChatrooms] = useState<ChatRoom[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

  // Load cached chatrooms from localStorage so UI can show avatars immediately
  useEffect(() => {
    try {
      const raw = localStorage.getItem("oysloe_chatrooms");
      if (raw) {
        const parsed = JSON.parse(raw) as ChatRoom[];
        if (Array.isArray(parsed) && parsed.length > 0)
          setChatrooms(parsed.map(normalizeChatroomData));
      }
    } catch {
      // ignore
    }
    // run only once on mount
  }, []);
  const [roomUserMap, setRoomUserMap] = useState<
    Record<string, { name?: string | null; avatar?: string | null }>
  >({});
  const [unreadCount, setUnreadCount] = useState<number>(0);
  // typing map per room: array of user ids currently typing
  const [typingMap, setTypingMap] = useState<Record<string, number[]>>({});

  const roomClients = useRef<Record<string, WebSocketClient | null>>({});
  const roomConnecting = useRef<Record<string, boolean>>({});
  // track whether we've requested REST history for a room as a fallback
  const roomHistoryRequested = useRef<Record<string, boolean>>({});
  const listClient = useRef<WebSocketClient | null>(null);
  const unreadClient = useRef<WebSocketClient | null>(null);
  // Map of temp_id -> { roomKey, content, created }
  const pendingByTempId = useRef<Record<string, { roomKey: string; content?: string; created?: number }>>({});
  useEffect(() => {
    return () => {
      // cleanup all clients on unmount
      Object.values(roomClients.current).forEach((c) => c?.close());
      listClient.current?.close();
      unreadClient.current?.close();
    };
  }, [chatrooms]);

  // keep a quick lookup map of room_id -> other user name/avatar for UI convenience
  useEffect(() => {
    try {
      const map: Record<
        string,
        { name?: string | null; avatar?: string | null }
      > = {};
      if (Array.isArray(chatrooms)) {
        for (const r of chatrooms) {
          try {
            const roomKey = String((r as any).room_id ?? r.id ?? "");
            if (!roomKey) continue;
            const name =
              (r as any).other_user_name ??
              (r as any).other_user ??
              (r as any).name ??
              null;
            const avatar =
              (r as any).other_user_avatar ?? (r as any).other_avatar ?? null;
            map[roomKey] = { name: name ?? null, avatar: avatar ?? null };
          } catch {
            // ignore per-room errors
          }
        }
      }
      setRoomUserMap(map);
      // removed debug logging
    } catch {
      // ignore
    }
  }, [chatrooms]);

  // messages are updated in onMessage handlers; no global dispatch here to avoid loops

  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

  const getStoredUserIdLocal = (): number | null => {
    try {
      const raw =
        typeof window !== "undefined"
          ? localStorage.getItem("oysloe_user")
          : null;
      if (!raw) return null;
      const parsed = JSON.parse(raw) as any;
      if (parsed == null) return null;
      if (typeof parsed.id === "number") return parsed.id;
      if (typeof parsed.user_id === "number") return parsed.user_id;
      return null;
    } catch {
      return null;
    }
  };

  // Normalize a provided room identifier to the server-side `room_id` when possible.
  // Many APIs accept either the DB primary key (`id`) or the string `room_id`.
  const normalizeRoomId = useCallback((roomId: string) => {
    const s = String(roomId);
    const found = chatrooms.find(
      (r) => String(r.id) === s || String(r.room_id) === s
    );
    if (found && found.room_id) return String(found.room_id);
    return s;
  }, [chatrooms]);

  const normalizeIncomingMessage = (m: any): Message => {
    const id = (m?.id ?? m?.message_id ?? 0) as number;
    const content = m?.content ?? m?.text ?? m?.message ?? "";
    const created_at =
      m?.created_at ?? m?.timestamp ?? new Date().toISOString();

    // Normalize sender information from multiple possible shapes returned by backend
    let sender: any = m?.sender ?? m?.user ?? m?.author ?? null;
    if (!sender) {
      const sid =
        m?.sender_id ?? m?.user_id ?? m?.author_id ?? m?.created_by ?? 0;
      const sname =
        m?.sender_name ??
        m?.name ??
        m?.user_name ??
        m?.author_name ??
        m?.username ??
        null;
      sender = {
        id: sid ?? 0,
        name: sname,
        email: m?.email ?? null,
        avatar: m?.avatar ?? m?.user_avatar ?? null,
      };
    } else if (typeof sender === "string") {
      sender = {
        id: 0,
        name: sender,
        email: m?.email ?? null,
        avatar: m?.avatar ?? null,
      };
    } else if (
      sender &&
      typeof sender === "object" &&
      (sender.id == null || sender.id === "")
    ) {
      // try to coerce common id fields
      sender.id = sender.id ?? sender.user_id ?? sender.pk ?? 0;
    }
    // preserve any other_user avatar/name fields provided on the message so UI can use them
    const other_user_avatar =
      m?.other_user_avatar ?? m?.other_avatar ?? m?.other_user?.avatar ?? null;
    const other_user_name =
      m?.other_user ?? m?.other_user_name ?? m?.other_user?.name ?? null;
    return {
      id: Number(id),
      room: (m?.room ?? m?.room_id ?? m?.chat_room ?? 0) as any,
      sender: { ...sender, id: Number(sender?.id ?? 0) },
      content: String(content ?? ""),
      created_at: String(created_at),
      // attach any other_user fields so downstream renderers can prefer them
      other_user_avatar: other_user_avatar,
      other_user_name: other_user_name,
    } as Message;
  };

    // Normalize chatroom fields for UI display: prefer other user's name/avatar for 1:1 chats
    const normalizeChatroomData = (r: any): ChatRoom => {
      try {
        const copy = { ...r } as ChatRoom;
        const isGroup = !!(r as any).is_group;
        if (!isGroup) {
          const otherName =
            (r as any).other_user_name ?? (r as any).other_user ?? null;
          if (otherName) copy.name = String(otherName);
        }
        const otherAvatar =
          (r as any).other_user_avatar ?? (r as any).other_avatar ?? null;
        if (otherAvatar != null) copy.avatar = otherAvatar;
        return copy;
      } catch {
        return r as ChatRoom;
      }
    };

  const getClientForRoom = useCallback((roomId: string) => {
    const key = normalizeRoomId(roomId);
    if (roomClients.current[key]) return roomClients.current[key];
    const alt = String(roomId);
    const altClient = roomClients.current[alt];
    if (altClient) {
      // migrate existing client under the normalized key for future lookups
      roomClients.current[key] = altClient;
      delete roomClients.current[alt];
      return roomClients.current[key];
    }
    return null;
  }, [normalizeRoomId]);

  const connectToChatroomsList = useCallback(() => {
    // Clean up previous connection
    if (listClient.current) {
      try {
        listClient.current.close();
      } catch {}
    }

    const wsBase = getWsBase();
    const url = `${wsBase}/chatrooms/`;

    const client = new WebSocketClient(url, token, {
      onOpen: () => {
        console.log("Chatrooms WebSocket connected successfully");
        try {
          client.send({ type: "get_chatrooms" });
        } catch (e) {
          console.warn("Failed to send initial chatrooms request:", e);
        }
      },

      onClose: (ev) => {
        console.log("Chatrooms WebSocket closed:", ev?.code, ev?.reason);
        listClient.current = null;
        if (ev?.code !== 1000) {
          console.log("Attempting to reconnect in 3 seconds...");
          setTimeout(() => {
            connectToChatroomsList();
          }, 3000);
        }
      },

      onError: (error) => {
        console.error("Chatrooms WebSocket error:", error);
        listClient.current = null;
      },

      onMessage: (data) => {
        if (!data) return;
        try {
          // If server sends an array of rooms directly
          if (Array.isArray(data)) {
            const rooms = data.map(normalizeChatroomData);
            setChatrooms(rooms);
            try {
              localStorage.setItem("oysloe_chatrooms", JSON.stringify(rooms));
            } catch {}
            return;
          }

          const t = (data as any).type;

          // Full list payload: { type: 'chatrooms_list', chatrooms: [...] }
          if (
            t === "chatrooms_list" ||
            t === "chatrooms" ||
            t === "list" ||
            Array.isArray((data as any).chatrooms) ||
            Array.isArray((data as any).rooms)
          ) {
            const raw = (data as any).chatrooms || (data as any).rooms || (data as any).data || [];
            if (Array.isArray(raw)) {
              const rooms = raw.map(normalizeChatroomData);
              setChatrooms(rooms);
              try {
                localStorage.setItem("oysloe_chatrooms", JSON.stringify(rooms));
              } catch {}
              // bump update time so consumers notice
              setLastUpdateTime(Date.now());
            }
            return;
          }

          // Single-room update: { type: 'chatroom'|'chatroom_update', room: {...} }
          if (t === "chatroom" || t === "chatroom_update" || t === "room_update") {
            const raw = (data as any).room || (data as any).chatroom || (data as any).data || data;
            const room = normalizeChatroomData(raw);
            setChatrooms((prev) => {
              const exists = prev.find(
                (r) => String(r.id) === String((room as any).id) || String(r.room_id) === String((room as any).room_id)
              );
              let next: ChatRoom[];
              if (exists) {
                next = prev.map((r) =>
                  String(r.id) === String((room as any).id) || String(r.room_id) === String((room as any).room_id) ? room : r
                );
              } else {
                next = [room, ...prev];
              }
              try {
                localStorage.setItem("oysloe_chatrooms", JSON.stringify(next));
              } catch {}
              setLastUpdateTime(Date.now());
              return next;
            });
            return;
          }
        } catch (err) {
          // ignore parsing errors
        }
      },
    });

    listClient.current = client;

    try {
      client.connect();
      console.log("Chatrooms WebSocket connection initiated");
    } catch (error) {
      console.error("Failed to connect to chatrooms WebSocket:", error);
      listClient.current = null;
    }
  }, [token]);

  const ensureRoomClient = useCallback(
    async (
      roomId: string,
      joinOpts?: {
        lastSeen?: string | number | null;
        lastMessageId?: string | number | null;
      }
    ) => {
      let key = normalizeRoomId(roomId);

      // If we didn't find a room_id in local `chatrooms` and the provided id
      // looks like a numeric primary key, try to resolve using local WS cache
      // (in-memory chatrooms or the WS-backed localStorage cache). We avoid
      // doing an HTTP lookup here to remain WS-first.
      if (key === String(roomId) && /^[0-9]+$/.test(String(roomId))) {
        try {
          // First try the in-memory chatrooms list
          const found = chatrooms.find(
            (r) =>
              String(r.id) === String(roomId) ||
              String(r.room_id) === String(roomId)
          );
          if (found && (found as any).room_id) {
            key = String((found as any).room_id);
            // cache/update chatrooms list so future lookups succeed
            const nf = normalizeChatroomData(found);
            setChatrooms((prev) => {
              const exists = prev.find(
                (r) =>
                  String(r.room_id) === key || String(r.id) === String(found.id)
              );
              if (exists)
                return prev.map((r) =>
                  String(r.id) === String(found.id) ? nf : r
                );
              return [nf, ...prev];
            });
          } else {
            // Try to find a mapping from previously received WS data saved to localStorage
            try {
              const raw = localStorage.getItem("oysloe_chatrooms");
              if (raw) {
                const parsed = JSON.parse(raw) as any[];
                const cached = parsed.find(
                  (r) =>
                    String(r.id) === String(roomId) ||
                    String(r.room_id) === String(roomId)
                );
                if (cached && cached.room_id) {
                  key = String(cached.room_id);
                  const nc = normalizeChatroomData(cached);
                  setChatrooms((prev) => {
                    const exists = prev.find(
                      (r) =>
                        String(r.room_id) === key ||
                        String(r.id) === String(cached.id)
                    );
                    if (exists)
                      return prev.map((r) =>
                        String(r.id) === String(cached.id) ? nc : r
                      );
                    return [nc, ...prev];
                  });
                } else {
                  // Ensure the chatrooms list WS is connected and wait briefly for it to populate
                  try {
                    connectToChatroomsList();
                  } catch {
                    // ignore
                  }
                  await new Promise((res) => setTimeout(res, 800));
                  try {
                    const raw2 = localStorage.getItem("oysloe_chatrooms");
                    if (raw2) {
                      const parsed2 = JSON.parse(raw2) as any[];
                      const cached2 = parsed2.find(
                        (r) =>
                          String(r.id) === String(roomId) ||
                          String(r.room_id) === String(roomId)
                      );
                      if (cached2 && cached2.room_id) {
                        key = String(cached2.room_id);
                        const nc2 = normalizeChatroomData(cached2);
                        setChatrooms((prev) => {
                          const exists = prev.find(
                            (r) =>
                              String(r.room_id) === key ||
                              String(r.id) === String(cached2.id)
                          );
                          if (exists)
                            return prev.map((r) =>
                              String(r.id) === String(cached2.id) ? nc2 : r
                            );
                          return [nc2, ...prev];
                        });
                      }
                    }
                  } catch {
                    // ignore
                  }
                }
              }
            } catch {
              // ignore
            }
          }
        } catch (err) {
          // ignore
        }
      }

      // If already connected or connecting, nothing to do
      if (roomClients.current[key]?.isOpen()) return;
      if (roomConnecting.current[key]) {
        return;
      }
      // mark as connecting to avoid races
      roomConnecting.current[key] = true;
      // close previous non-open client (we'll replace it)
      try {
        if (roomClients.current[key]) {
          try {
            roomClients.current[key]?.close();
          } catch {
            /* ignore */
          }
        }
      } catch {}

      const wsBase = getWsBase();
      const encoded = encodeURIComponent(key);
      const url = `${wsBase}/chat/${encoded}/`;

      // Try once with the given url; if server rejects immediately (close code 1006), try without trailing slash
      let triedAlternative = false;
      const altUrl = url.replace(/\/$/, "");

      const createClient = (attemptUrl: string) => {
        let instance: WebSocketClient | null = null;

        instance = new WebSocketClient(attemptUrl, token, {
          onOpen: () => {
            roomConnecting.current[key] = false;
            // Always send a join payload on open so servers that require an explicit
            // join to emit room history will replay messages. Include any provided
            // joinOpts when available.
            try {
              if (instance && instance.isOpen()) {
                instance.send({
                  type: "join",
                  last_seen: joinOpts?.lastSeen ?? null,
                  last_message_id: joinOpts?.lastMessageId ?? null,
                });
              }
            } catch (e) {
              /* ignore */
            }
          },
          onClose: (ev) => {
            // allow reconnect attempts later
            roomConnecting.current[key] = false;
            try {
              // clear typing state for this room on close
              setTypingMap((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
            } catch {
              // ignore
            }
            // If server closed immediately (1006) and we haven't tried the alt URL, try it once
            // If server closed immediately (1006) and we haven't tried the alt URL, try it once
            if (
              (ev?.code === 1006 || ev?.code === 1005) &&
              !triedAlternative &&
              attemptUrl !== altUrl
            ) {
              triedAlternative = true;
              const altClient = createClient(altUrl);
              roomClients.current[key] = altClient;
              try {
                altClient.connect();
              } catch (err) {
                // ignore
              }
            }
          },
          onError: () => {},
          onMessage: (data) => {
            if (!data) return;
            // typing frames: { type: 'typing', user_id, typing: true/false }
            if ((data as any).type === "typing") {
              try {
                const uid =
                  (data as any).user_id ??
                  (data as any).sender?.id ??
                  (data as any).sender_id ??
                  null;
                const isTyping = !!(data as any).typing;
                if (uid != null) {
                  setTypingMap((prev) => {
                    const cur = new Set<number>(prev[key] || []);
                    if (isTyping) cur.add(Number(uid));
                    else cur.delete(Number(uid));
                    return { ...prev, [key]: Array.from(cur) };
                  });
                }
              } catch {
                // ignore
              }
              return;
            }
            // handle message
            // If server sends an array of messages as history (or a raw chat_history payload)
            if (Array.isArray(data) || (data as any)?.type === "chat_history") {
              const raw = Array.isArray(data)
                ? data
                : (data as any).messages || (data as any).data || [];
              if (Array.isArray(raw)) {
                const msgs = raw.map(normalizeIncomingMessage);
                setMessages((prev) => {
                  const next = { ...prev, [key]: msgs } as RoomMessages;
                  try {
                    const firstRoom = msgs && msgs[0] && msgs[0].room;
                    const alt = firstRoom != null ? String(firstRoom) : null;
                    if (alt && alt !== key) next[alt] = msgs;
                  } catch {
                    // ignore
                  }
                  try { setLastUpdateTime(Date.now()); } catch {}
                  return next;
                });
              }
              return;
            }

            // If server sends an explicit history object
            if (
              (data as any).type === "room_history" ||
              (data as any).type === "history"
            ) {
              const msgs =
                (data as any).messages ||
                (data as any).history ||
                (data as any).data ||
                [];
              if (Array.isArray(msgs)) {
                const mapped = msgs.map(normalizeIncomingMessage);
                setMessages((prev) => {
                  const next = { ...prev, [key]: mapped } as RoomMessages;
                  try {
                    const first = mapped && mapped[0] && mapped[0].room;
                    const altKey = first != null ? String(first) : null;
                    if (altKey && altKey !== key) next[altKey] = mapped;
                  } catch {
                    // ignore
                  }
                  try { setLastUpdateTime(Date.now()); } catch {}
                  return next;
                });
              }
              return;
            }
            // single message (server may send message frames without an `id` yet)
            if (
              (data as any).id ||
              (data as any).type === "message" ||
              (data as any).type === "chat_message"
            ) {
              // Normalize the incoming shape to our canonical Message
              const raw = data as any;
              // DEBUG: log raw incoming for diagnosis
              try { console.debug("useWsChat incoming.raw:", raw); } catch {}
              const incoming = normalizeIncomingMessage(raw) as Message & {
                temp_id?: string;
              };
              // preserve server temp id echo if present
              if (raw?.temp_id) (incoming as any).temp_id = raw.temp_id;
              try { console.debug("useWsChat incoming.norm:", incoming); } catch {}
              setMessages((prev) => {
                const list = prev[key] || [];
                try { console.debug("useWsChat existingList:", list.map((m: any) => ({ id: m.id, temp: (m as any).__temp_id || (m as any).temp_id, content: m.content }))); } catch {}

                // If server echoed our temp_id, replace the optimistic placeholder FIRST (highest priority)
                const tempId = (incoming as any).temp_id;
                if (tempId) {
                  const byTemp = list.findIndex(
                    (m) =>
                      ((m as any).__temp_id || (m as any).temp_id) === tempId
                  );
                  if (byTemp !== -1) {
                    try { console.debug("useWsChat: matched by temp_id", tempId); } catch {}
                    const newList = [...list];
                    // remove pending mapping for this temp id
                    try { delete pendingByTempId.current[String(tempId)]; } catch {}
                    newList[byTemp] = incoming; // Server version replaces optimistic
                    try { setLastUpdateTime(Date.now()); } catch {}
                    return { ...prev, [key]: newList };
                  }
                }

                // Aggressive fuzzy match: content+sender (BEFORE checking ID to catch optimistic)
                // This prevents server echo from being added as a new message if it matches recent optimistic
                const incomingTime = incoming.created_at
                  ? new Date(incoming.created_at).getTime()
                  : 0;
                const fuzzyIndex = list.findIndex((m) => {
                  if (!m || !incoming) return false;
                  // Same sender check
                  if (
                    m.sender?.id &&
                    incoming.sender?.id &&
                    m.sender.id !== incoming.sender.id
                  )
                    return false;
                  // Same content check
                  if (m.content !== incoming.content) return false;
                  // Within 5 seconds check
                  const mTime = m.created_at
                    ? new Date(m.created_at).getTime()
                    : 0;
                  return Math.abs(mTime - incomingTime) <= 5000;
                });
                if (fuzzyIndex !== -1) {
                  try { console.debug("useWsChat: matched by fuzzyIndex", fuzzyIndex); } catch {}
                  // Replace the existing message with server version (more authoritative)
                  const existing = list[fuzzyIndex] as any;
                  try {
                    const et = existing && ((existing as any).__temp_id || (existing as any).temp_id);
                    if (et) delete pendingByTempId.current[String(et)];
                  } catch {}
                  const newList = [...list];
                  newList[fuzzyIndex] = incoming;
                  try { setLastUpdateTime(Date.now()); } catch {}
                  return { ...prev, [key]: newList };
                }

                // If `id` exists and no fuzzy match found, dedupe by id
                if ((incoming as any).id && (incoming as any).id > 0) {
                  const byId = list.findIndex(
                    (m) => String(m.id) === String((incoming as any).id)
                  );
                  if (byId !== -1) {
                    // Replace existing with server version
                    const updated = [...list];
                    updated[byId] = incoming;
                    try { setLastUpdateTime(Date.now()); } catch {}
                    return { ...prev, [key]: updated };
                  }

                  // If we have any optimistic placeholder that matches (temp_id or fuzzy/substring),
                  // replace it instead of adding a new message to avoid duplication.
                  const optimisticIndex = list.findIndex((m) => {
                    if (!m) return false;
                    // Match explicit temp ids
                    const existingTemp = (m as any).__temp_id || (m as any).temp_id;
                    if (existingTemp && (incoming as any).temp_id && String(existingTemp) === String((incoming as any).temp_id)) return true;
                    // Match messages marked optimistic
                    if ((m as any).__optimistic) {
                      try {
                        // sender must match if known
                        if (m.sender?.id && incoming.sender?.id && String(m.sender.id) !== String(incoming.sender?.id)) return false;
                        const a = String((m.content || "").trim());
                        const b = String((incoming.content || "").trim());
                        if (a === b) return true;
                        // substring checks for slight server normalization differences
                        if (a && b && (a.length > 10 ? b.includes(a) : b.includes(a) || a.includes(b))) return true;
                        // time window
                        const mTime = m.created_at ? new Date(m.created_at).getTime() : 0;
                        const incomingTime = incoming.created_at ? new Date(incoming.created_at).getTime() : 0;
                        if (Math.abs(mTime - incomingTime) <= 10000) return true;
                      } catch {
                        return false;
                      }
                    }
                    return false;
                  });
                  if (optimisticIndex !== -1) {
                    try { console.debug("useWsChat: replacing optimistic at index", optimisticIndex); } catch {}
                    const updated = [...list];
                    try {
                      const ex = updated[optimisticIndex] as any;
                      const et = ex && ((ex as any).__temp_id || (ex as any).temp_id);
                      if (et) delete pendingByTempId.current[String(et)];
                    } catch {}
                    updated[optimisticIndex] = incoming;
                    try { setLastUpdateTime(Date.now()); } catch {}
                    return { ...prev, [key]: updated };
                  }

                  // New message from server with valid ID — add it
                  const newPrev = { ...prev, [key]: [...list, incoming] } as RoomMessages;
                  try {
                    const incomingRoom = incoming.room != null ? String(incoming.room) : null;
                    if (incomingRoom && incomingRoom !== key) {
                      const altList = newPrev[incomingRoom] || [];
                      if (altList !== newPrev[key]) newPrev[incomingRoom] = [...altList, incoming];
                    }
                  } catch {
                    // ignore
                  }
                  try { setLastUpdateTime(Date.now()); } catch {}
                  return newPrev;
                }

                // No match — add as genuinely new message (should not happen if dedup above worked)
                const newPrev = { ...prev, [key]: [...list, incoming] } as RoomMessages;
                try {
                  const incomingRoom = incoming.room != null ? String(incoming.room) : null;
                  if (incomingRoom && incomingRoom !== key) {
                    const altList = newPrev[incomingRoom] || [];
                    // avoid duplicating if same array reference
                    if (altList !== newPrev[key]) newPrev[incomingRoom] = [...altList, incoming];
                  }
                } catch {
                  // ignore
                }
                return newPrev;
              });
              try { setLastUpdateTime(Date.now()); } catch {}
              // on new message, clear typing for sender (they sent so not typing now)
              try {
                const sid = (incoming as any).sender?.id ?? null;
                if (sid != null) {
                  setTypingMap((prev) => {
                    const cur = new Set<number>(prev[key] || []);
                    cur.delete(Number(sid));
                    return { ...prev, [key]: Array.from(cur) };
                  });
                }
              } catch {
                // ignore
              }
              return;
            }
            // typing or other event types are passed through
          },
        });

        return instance;
      };

      const client = createClient(url);
      roomClients.current[key] = client;
      try {
        client.connect();
      } catch {
        /* ignore */
      }

      // If the websocket server does not emit history within a short window
      // request recent messages via WS `history_request` as a one-time fallback.
      try {
        setTimeout(() => {
          (async () => {
            try {
              // already have messages? skip
              const existing = (messages as any)[key];
              if (Array.isArray(existing) && existing.length > 0) return;
              if (roomHistoryRequested.current[key]) return;

              roomHistoryRequested.current[key] = true;
              try {
                const client = roomClients.current[key];
                if (client && client.isOpen()) {
                  try {
                    client.send({ type: "history_request", limit: 200 });
                  } catch {
                    // ignore
                  }
                }
              } catch {
                // ignore
              }
            } catch {
              // ignore
            }
          })();
        }, 800);
      } catch {
        // ignore
      }

      return key;
    },
    [token, chatrooms, connectToChatroomsList, messages, normalizeRoomId]
  );

  const connectToRoom = useCallback(
    async (
      roomId: string,
      opts?: {
        lastSeen?: string | number | null;
        lastMessageId?: string | number | null;
      }
    ) => {
      // Do NOT load history via REST. Rely on the websocket server to emit
      // any history (e.g. a `room_history` or an array of messages) after connect.
      return await ensureRoomClient(roomId, opts);
    },
    [ensureRoomClient]
  );
  

  const connectToUnreadCount = useCallback(() => {
    if (unreadClient.current?.isOpen()) return;
    unreadClient.current?.close();
    const wsBase = getWsBase();
    const url = `${wsBase}/unread_count/`;
    const client = new WebSocketClient(url, token, {
      onMessage: (data) => {
        if (!data) return;
        // expect { unread: number } or a raw number
        if (typeof data === "number") {
          setUnreadCount(data);
          return;
        }
        if ((data as any).unread != null) {
          setUnreadCount(Number((data as any).unread));
        }
      },
    });
    unreadClient.current = client;
    try {
      client.connect();
    } catch {
      /* ignore */
    }
  }, [token]);

  const sendMessage = useCallback(
    async (
      roomId: string,
      text: string,
      tempId?: string,
      file?: File | Blob
    ) => {
      console.log("sendMessage called for room:", roomId, "text:", text);

      if (!token) {
        throw new Error("No authentication token available");
      }

      // Get the normalized room key
      const key = normalizeRoomId(roomId);
      console.log("Normalized room key:", key);

      // Use existing room connection if available
      const existingClient = roomClients.current[key];
      
      let messageToSend = text;
      let isMedia = false;
      let fileType = "";
      let fileName = "";

      if (file) {
        console.log("Processing file for upload:", file.type, file.size);

        // Convert file to FULL data URL (including data: prefix)
        messageToSend = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            console.log("File converted to data URL, length:", result.length);
            resolve(result);
          };
          reader.onerror = () => {
            console.error("FileReader error:", reader.error);
            reject(new Error("Failed to read file"));
          };
          reader.readAsDataURL(file);
        });

        isMedia = true;
        fileType = file.type;
        fileName = file instanceof File ? file.name : "audio.webm";
      }

      const payload: any = {
        type: "chat_message",
        message: messageToSend,
        temp_id: tempId,
        is_media: isMedia,
      };

      if (file) {
        payload.file_name = fileName;
        payload.file_type = fileType;
        payload.file_size = file.size;
      }
      // If we have an existing connected client, prefer using it.
      if (existingClient) {
        try {
          console.log("sendMessage: existing client found, isOpen=", existingClient.isOpen());
          try {
            existingClient.connect();
          } catch {}

          existingClient.send(payload);
          console.log("Message queued/sent via existing WebSocket connection");
          // Do NOT retry via a temporary socket here — avoid double-send if server doesn't echo temp_id.
          return Promise.resolve();
        } catch (error) {
          console.error("Failed to send via existing connection:", error);
          // fall through to fallback only if send throws
        }
      }

      // Fallback: Create temporary connection if no existing client or no echo
      const wsBase = getWsBase();
      const encoded = encodeURIComponent(key);
      const url = `${wsBase}/chat/${encoded}/?token=${token}`;
      console.log("Creating temporary WebSocket for sending:", url);

      return new Promise<void>((resolve, reject) => {
        const client = new WebSocketClient(url, token, {
          onOpen: () => {
            console.log("Temporary sendMessage WebSocket connected");

            try {
              client.send(payload);
              console.log("Message sent via temporary WebSocket");

              setTimeout(() => {
                try {
                  client.close();
                } catch (err) {
                  console.error("Error closing client:", err);
                }
                resolve();
              }, 100);
            } catch (error) {
              console.error("Failed to send message:", error);
              reject(error);
            }
          },

          onClose: (ev) => {
            console.log("Temporary sendMessage WebSocket closed:", ev?.code, ev?.reason);
          },

          onError: (error) => {
            console.error("sendMessage WebSocket error:", error);
            reject(error);
          },

          onMessage: (data) => {
            console.log("sendMessage received response:", data);
            // Server might send confirmation
          },
        });

        try {
          // Connect the WebSocket
          client.connect();
          console.log("sendMessage WebSocket connection initiated");
        } catch (error) {
          console.error("Failed to create WebSocket for sending:", error);
          reject(new Error(`WebSocket send failed: ${error}`));
        }
      });
    },
    [token, normalizeRoomId]
  );

  // Note: use `sendTypingOptimistic` which also updates local typing state.

  // enhanced sendTyping: update local typing map optimistically for current user
  const sendTypingOptimistic = useCallback(
    (roomId: string, typing: boolean) => {
      try {
        const key = normalizeRoomId(roomId);
        const uid = getStoredUserIdLocal();
        if (uid != null) {
          setTypingMap((prev) => {
            const cur = new Set<number>(prev[key] || []);
            if (typing) cur.add(Number(uid));
            else cur.delete(Number(uid));
            return { ...prev, [key]: Array.from(cur) };
          });
        }
      } catch {
        // ignore
      }
      try {
        const client = getClientForRoom(roomId);
        if (!client || !client.isOpen()) return;
        client.send({ type: "typing", typing });
      } catch {
        // ignore
      }
    },
    [getClientForRoom, normalizeRoomId]
  );

  const markAsRead = useCallback(async (roomId: string) => {
    // Optimistically mark messages in this room as read locally so UI updates immediately
    const k = normalizeRoomId(roomId);
    setMessages((prev) => {
      const list = prev[k] || [];
      if (list.length === 0) return prev;
      const updated = list.map((m) =>
        m.sender?.id !== undefined
          ? { ...m, is_read: true, __read_by_me: true }
          : m
      );
      return { ...prev, [k]: updated };
    });

    try {
      // Attempt to find a numeric DB id for this room from cached chatrooms
      const found = chatrooms.find(
        (r) =>
          String(r.room_id) === String(k) ||
          String(r.id) === String(roomId) ||
          String(r.name) === String(k)
      );
      const idToSend =
        found?.id ?? (String(roomId).match(/^[0-9]+$/) ? roomId : null);
    } catch (err) {
      // ignore
    }

    // also notify ws (best-effort)
    const client = getClientForRoom(roomId);
    try {
      client?.send({ type: "mark_read" });
    } catch {
      // ignore
    }
  }, [chatrooms, getClientForRoom, normalizeRoomId]);

  const isRoomConnected = useCallback(
    (roomId: string) =>
      !!getClientForRoom(roomId) && getClientForRoom(roomId)!.isOpen(),
    [getClientForRoom]
  );

  const addLocalMessage = useCallback((roomId: string, msg: Message) => {
    const k = normalizeRoomId(roomId);
    setMessages((prev) => {
      const list = prev[k] || [];
      // dedupe by id
      if (list.find((m) => String(m.id) === String(msg.id))) return prev;
      // dedupe by temp id if present
      const tempId =
        (msg as any).__temp_id || (msg as any).tempId || (msg as any).temp_id;
      if (
        tempId &&
        list.find(
          (m) =>
            ((m as any).__temp_id ||
              (m as any).tempId ||
              (m as any).temp_id) === tempId
        )
      )
        return prev;
      // fuzzy dedupe: content+sender+time within 2s
      // fuzzy dedupe: content+sender+time within 5s
      const msgTime = msg.created_at
        ? new Date(msg.created_at).getTime()
        : Date.now();
      const likelyIndex = list.findIndex((m) => {
        if (!m) return false;
        if (m.sender?.id && msg.sender?.id && m.sender.id !== msg.sender.id)
          return false;
        if (m.content !== msg.content) return false;
        const mTime = m.created_at ? new Date(m.created_at).getTime() : 0;
        return Math.abs(mTime - msgTime) <= 5000;
      });
      // Check for likely duplicates
      if (likelyIndex !== -1) return prev;
      // mark optimistic messages so they can be replaced when server responds
      (msg as any).__optimistic = true;
      // ensure the temp id is preserved under a known key for matching
      if ((msg as any).temp_id && !(msg as any).__temp_id) {
        (msg as any).__temp_id = (msg as any).temp_id;
      }
      // track pending optimistic messages by temp_id for quick reconciliation
      try {
        const t = (msg as any).__temp_id || (msg as any).temp_id;
        if (t)
          pendingByTempId.current[String(t)] = {
            roomKey: k,
            content: String(msg.content || ""),
            created: msg.created_at ? new Date(msg.created_at).getTime() : Date.now(),
          };
      } catch {
        // ignore
      }
      const primaryList = [...list, msg];
      const next = { ...prev, [k]: primaryList } as RoomMessages;
      try {
        const alt = msg.room != null ? String(msg.room) : null;
        if (alt && alt !== k) {
          const altList = next[alt] || [];
          if (!altList.find((m) => String(m.id) === String(msg.id) || ((m as any).__temp_id || (m as any).temp_id) === ((msg as any).__temp_id || (msg as any).temp_id))) {
            next[alt] = [...altList, msg];
          }
        }
      } catch {
        // ignore
      }
      return next;
    });
    try { setLastUpdateTime(Date.now()); } catch {}
  }, [normalizeRoomId]);

  const closeAll = useCallback(() => {
    Object.values(roomClients.current).forEach((c) => c?.close());
    roomClients.current = {};
    listClient.current?.close();
    listClient.current = null;
    unreadClient.current?.close();
    unreadClient.current = null;
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    const key = normalizeRoomId(roomId);
    const alt = String(roomId);
    try {
      roomClients.current[key]?.close();
      if (alt !== key) roomClients.current[alt]?.close();
    } catch {
      // ignore
    }
    roomClients.current[key] = null;
    if (alt !== key) roomClients.current[alt] = null;
    roomConnecting.current[key] = false;
  }, [normalizeRoomId]);

  return {
    messages,
    chatrooms,
    roomUserMap,
    unreadCount,
    typing: typingMap,
    connectToRoom,
    connectToChatroomsList,
    connectToUnreadCount,
    sendMessage,
    sendTyping: sendTypingOptimistic,
    markAsRead,
    isRoomConnected,
    addLocalMessage,
    leaveRoom,
    closeAll,
    lastUpdateTime,
  };
}
