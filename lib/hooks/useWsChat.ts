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
        if (Array.isArray(parsed) && parsed.length > 0) setChatrooms(parsed);
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
  const normalizeRoomId = (roomId: string) => {
    const s = String(roomId);
    const found = chatrooms.find(
      (r) => String(r.id) === s || String(r.room_id) === s
    );
    if (found && found.room_id) return String(found.room_id);
    return s;
  };

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

  const getClientForRoom = (roomId: string) => {
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
  };

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
            setChatrooms((prev) => {
              const exists = prev.find(
                (r) =>
                  String(r.room_id) === key || String(r.id) === String(found.id)
              );
              if (exists)
                return prev.map((r) =>
                  String(r.id) === String(found.id) ? found : r
                );
              return [found, ...prev];
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
                  setChatrooms((prev) => {
                    const exists = prev.find(
                      (r) =>
                        String(r.room_id) === key ||
                        String(r.id) === String(cached.id)
                    );
                    if (exists)
                      return prev.map((r) =>
                        String(r.id) === String(cached.id) ? cached : r
                      );
                    return [cached, ...prev];
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
                        setChatrooms((prev) => {
                          const exists = prev.find(
                            (r) =>
                              String(r.room_id) === key ||
                              String(r.id) === String(cached2.id)
                          );
                          if (exists)
                            return prev.map((r) =>
                              String(r.id) === String(cached2.id) ? cached2 : r
                            );
                          return [cached2, ...prev];
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
                setMessages((prev) => ({ ...prev, [key]: msgs }));
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
                setMessages((prev) => ({ ...prev, [key]: mapped }));
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
              const incoming = normalizeIncomingMessage(raw) as Message & {
                temp_id?: string;
              };
              // preserve server temp id echo if present
              if (raw?.temp_id) (incoming as any).temp_id = raw.temp_id;
              setMessages((prev) => {
                const list = prev[key] || [];

                // If `id` exists, dedupe by id first
                if ((incoming as any).id) {
                  if (
                    list.find(
                      (m) => String(m.id) === String((incoming as any).id)
                    )
                  )
                    return prev;
                }

                // If server echoed our temp_id, replace the optimistic placeholder
                const tempId = (incoming as any).temp_id;
                if (tempId) {
                  const byTemp = list.findIndex(
                    (m) =>
                      ((m as any).__temp_id || (m as any).temp_id) === tempId
                  );
                  if (byTemp !== -1) {
                    const newList = [...list];
                    newList[byTemp] = incoming;
                    return { ...prev, [key]: newList };
                  }
                }

                // dedupe by content+sender+time (within 5s) to catch optimistic echoes
                const incomingTime = incoming.created_at
                  ? new Date(incoming.created_at).getTime()
                  : 0;
                const likelyIndex = list.findIndex((m) => {
                  if (!m || !incoming) return false;
                  if (
                    m.sender?.id &&
                    incoming.sender?.id &&
                    m.sender.id !== incoming.sender.id
                  )
                    return false;
                  if (m.content !== incoming.content) return false;
                  const mTime = m.created_at
                    ? new Date(m.created_at).getTime()
                    : 0;
                  return Math.abs(mTime - incomingTime) <= 5000; // 5 seconds
                });
                if (likelyIndex !== -1) {
                  const existing = list[likelyIndex] as any;
                  if (existing && existing.__optimistic) {
                    const newList = [...list];
                    newList[likelyIndex] = incoming;
                    return { ...prev, [key]: newList };
                  }
                  // otherwise assume it's a duplicate and ignore incoming
                  return prev;
                }

                return { ...prev, [key]: [...list, incoming] };
              });
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
    [token, chatrooms]
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

  const connectToChatroomsList = useCallback(() => {
    // Check if already connected
    if (listClient.current?.isOpen()) {
      console.log("Chatrooms WebSocket already connected");
      return;
    }

    // Clean up previous connection
    if (listClient.current) {
      try {
        listClient.current.close();
      } catch {}
    }

    const wsBase = getWsBase();
    const url = `${wsBase}/chatrooms/`;

    const client = new WebSocketClient(url, token, {
      // ✅ ADD THESE MISSING HANDLERS:
      onOpen: () => {
        console.log("Chatrooms WebSocket connected successfully");
        // Optional: Send initial request for chatrooms data
        try {
          client.send({ type: "get_chatrooms" });
        } catch (e) {
          console.warn("Failed to send initial chatrooms request:", e);
        }
      },

      onClose: (ev) => {
        console.log("Chatrooms WebSocket closed:", ev?.code, ev?.reason);

        // Clear the client reference
        listClient.current = null;

        // Optional: Reconnect after delay if not intentional close
        if (ev?.code !== 1000) {
          // 1000 = normal closure
          console.log("Attempting to reconnect in 3 seconds...");
          setTimeout(() => {
            connectToChatroomsList();
          }, 3000);
        }
      },

      onError: (error) => {
        console.error("Chatrooms WebSocket error:", error);
        // Clear client reference on error
        listClient.current = null;
      },

      onMessage: (data) => {
        console.log("Received chatrooms data:", data);
        if (!data) return;

        // Your helper functions first
        const normalizeAvatar = (src?: string | null) => {
          try {
            if (!src) return null;
            if (/^https?:\/\//i.test(src)) return src;
            if (src.startsWith("//")) return window.location.protocol + src;
            const apiRaw =
              ((WSS_URL + WSS_BASE) as string) ||
              "https://api.oysloe.com/api-v1";
            let apiOrigin = "";
            try {
              apiOrigin = new URL(apiRaw).origin;
            } catch {
              apiOrigin = apiRaw.replace(/\/+$/, "");
            }
            if (src.startsWith("/")) {
              if (
                /^\/assets\/avatars\//i.test(src) ||
                /^\/media\//i.test(src) ||
                /^\/uploads\//i.test(src)
              ) {
                return apiOrigin + src;
              }
              return (
                (typeof window !== "undefined" ? window.location.origin : "") +
                src
              );
            }
            return src;
          } catch {
            return src ?? null;
          }
        };

        const getStoredUserId = (): number | null => {
          try {
            const raw = localStorage.getItem("user");
            if (!raw) return null;
            const parsed = JSON.parse(raw) as any;
            if (parsed == null) return null;
            if (typeof parsed.id === "number") return parsed.id;
            if (typeof parsed.user_id === "number") return parsed.user_id;
            return null;
          } catch (e) {
            return null;
          }
        };

        const deriveOtherFromMembers = (r: any) => {
          try {
            if (!r) return r;
            const curId = getStoredUserId();
            const members = Array.isArray(r.members) ? r.members : [];
            // prefer member whose id !== current user id
            let other = members.find(
              (m: any) => m && (curId == null || Number(m.id) !== Number(curId))
            );
            if (!other && members.length > 0) other = members[0];
            if (!other) return r;
            const avatar =
              other.avatar ??
              other.user_avatar ??
              other.photo ??
              other.image ??
              null;
            const name =
              other.name ??
              other.full_name ??
              other.username ??
              other.display_name ??
              null;
            return {
              ...r,
              other_user_avatar: normalizeAvatar(avatar) || avatar || null,
              other_user_name: name || null,
            };
          } catch {
            return r;
          }
        };

        // ========== MAIN MESSAGE HANDLING ==========

        // 1. Handle "chatrooms_list" type (what you're receiving)
        if (
          (data as any).type === "chatrooms_list" &&
          Array.isArray((data as any).chatrooms)
        ) {
          console.log(
            "Processing chatrooms_list with",
            (data as any).chatrooms.length,
            "chatrooms"
          );

          const chatroomsData = (data as any).chatrooms;

          try {
            const mapped = chatroomsData.map((r: any) => {
              // Check if backend already provides other_user and other_user_avatar
              const hasOtherUserInfo =
                r.other_user !== undefined || r.other_user_avatar !== undefined;

              if (hasOtherUserInfo) {
                // Use backend-provided other_user info
                return {
                  id: r.id,
                  room_id: r.room_id,
                  name: r.name,
                  is_group: r.is_group,
                  members: r.members || [],
                  created_at: r.created_at,
                  total_unread: r.unread || 0,
                  // Map backend fields to expected format
                  other_user_name: r.other_user || null,
                  other_user_avatar:
                    normalizeAvatar(r.other_user_avatar) || null,
                  // Preserve last_message if available
                  last_message: r.last_message || null,
                  // Additional fields from backend
                  product_id: r.product_id || "",
                  ad_name: r.ad_name || "",
                  ad_image: r.ad_image || "",
                } as any;
              } else {
                // Fallback to deriving from members
                const withOther = deriveOtherFromMembers(r);
                return {
                  ...withOther,
                  id: r.id,
                  room_id: r.room_id,
                  name: r.name,
                  is_group: r.is_group,
                  members: r.members || [],
                  created_at: r.created_at,
                  total_unread: r.unread || 0,
                  other_user_avatar:
                    normalizeAvatar((withOther as any).other_user_avatar) ||
                    null,
                  last_message: r.last_message || null,
                  product_id: r.product_id || "",
                  ad_name: r.ad_name || "",
                  ad_image: r.ad_image || "",
                };
              }
            });

            console.log("Mapped chatrooms:", mapped);
            setChatrooms(mapped as ChatRoom[]);

            // Save to localStorage for caching
            try {
              localStorage.setItem("oysloe_chatrooms", JSON.stringify(mapped));
            } catch (e) {
              console.warn("Failed to save chatrooms to localStorage:", e);
            }

            // Apply avatars to existing messages
            try {
              const avatarMap: Record<string, string> = {};
              mapped.forEach((r: any) => {
                const key = String(r.room_id ?? r.id ?? "");
                if (!key) return;
                const av = normalizeAvatar(r.other_user_avatar) || null;
                if (av) avatarMap[key] = av;
              });

              if (Object.keys(avatarMap).length > 0) {
                const getStoredUserIdLocal = getStoredUserId;
                setMessages((prev) => {
                  const next: typeof prev = { ...prev };
                  Object.keys(avatarMap).forEach((rk) => {
                    const list = next[rk];
                    if (!Array.isArray(list)) return;
                    const curId = getStoredUserIdLocal();
                    next[rk] = list.map((m) => {
                      try {
                        if (m && m.sender && m.sender.id != null) {
                          if (
                            curId == null ||
                            String(m.sender.id) !== String(curId)
                          ) {
                            return {
                              ...m,
                              sender: { ...m.sender, avatar: avatarMap[rk] },
                            } as any;
                          }
                          return m;
                        }
                        return {
                          ...m,
                          other_user_avatar: avatarMap[rk],
                        } as any;
                      } catch {
                        return m;
                      }
                    });
                  });
                  return next;
                });
              }
            } catch (e) {
              console.warn("Failed to apply avatars to messages:", e);
            }

            return;
          } catch (error) {
            console.error("Error processing chatrooms_list:", error);
          }
        }

        // 2. Handle "rooms_update" for incremental updates
        if (
          (data as any).type === "rooms_update" &&
          Array.isArray((data as any).rooms)
        ) {
          console.log("Processing rooms_update");
          try {
            const mapped = ((data as any).rooms as ChatRoom[]).map((r) => {
              const withOther = deriveOtherFromMembers(r as any);
              return {
                ...withOther,
                other_user_avatar:
                  normalizeAvatar((withOther as any).other_user_avatar) ||
                  (withOther as any).other_user_avatar ||
                  null,
              };
            });
            setChatrooms((prev) => {
              const updated = mapped as ChatRoom[];
              try {
                localStorage.setItem(
                  "oysloe_chatrooms",
                  JSON.stringify(updated)
                );
              } catch {}
              return updated;
            });

            // Apply avatars to existing messages for updated rooms
            try {
              const avatarMap: Record<string, string> = {};
              mapped.forEach((r: any) => {
                const key = String(r.room_id ?? r.id ?? r.name ?? "");
                if (!key) return;
                const av =
                  normalizeAvatar((r as any).other_user_avatar) ||
                  (r as any).other_user_avatar ||
                  null;
                if (av) avatarMap[key] = av;
              });
              if (Object.keys(avatarMap).length > 0) {
                const getStoredUserIdLocal = getStoredUserId;
                setMessages((prevMsgs) => {
                  const nextMsgs = { ...prevMsgs };
                  Object.keys(avatarMap).forEach((rk) => {
                    const list = nextMsgs[rk];
                    if (!Array.isArray(list)) return;
                    const curId = getStoredUserIdLocal();
                    nextMsgs[rk] = list.map((m) => {
                      try {
                        if (m && m.sender && m.sender.id != null) {
                          if (
                            curId == null ||
                            String(m.sender.id) !== String(curId)
                          ) {
                            return {
                              ...m,
                              sender: { ...m.sender, avatar: avatarMap[rk] },
                            } as any;
                          }
                          return m;
                        }
                        return {
                          ...m,
                          other_user_avatar: avatarMap[rk],
                        } as any;
                      } catch {
                        return m;
                      }
                    });
                  });
                  return nextMsgs;
                });
              }
            } catch (e) {
              console.warn("Failed to apply avatars from rooms_update:", e);
            }
            return;
          } catch (error) {
            console.error("Error processing rooms_update:", error);
          }
        }

        // 3. Handle single room update
        if (
          (data as any).type === "room_update" &&
          ((data as any).room_id || (data as any).id)
        ) {
          console.log("Processing room_update");
          const updated = data as ChatRoom;
          const updatedWithOther = deriveOtherFromMembers(updated as any);
          const updatedNormalized = {
            ...updatedWithOther,
            other_user_avatar: ((): any => {
              try {
                const v = (updatedWithOther as any).other_user_avatar;
                return normalizeAvatar(v) || v || null;
              } catch {
                return (updatedWithOther as any).other_user_avatar || null;
              }
            })(),
          } as ChatRoom;

          setChatrooms((prev) => {
            const found = prev.find(
              (r) =>
                String(r.id) === String(updated.id) ||
                r.room_id === (updated as any).room_id
            );
            const next = !found
              ? [updatedNormalized, ...prev]
              : prev.map((r) =>
                  String(r.id) === String(updated.id) ? updatedNormalized : r
                );

            // Save to localStorage
            try {
              localStorage.setItem("oysloe_chatrooms", JSON.stringify(next));
            } catch {}

            // Apply avatar for this single updated room
            try {
              const key = String(
                updatedNormalized.room_id ??
                  updatedNormalized.id ??
                  updatedNormalized.name ??
                  ""
              );
              const av =
                normalizeAvatar((updatedNormalized as any).other_user_avatar) ||
                (updatedNormalized as any).other_user_avatar ||
                null;
              if (key && av) {
                const getStoredUserIdLocal = getStoredUserId;
                setMessages((prevMsgs) => {
                  const nextMsgs = { ...prevMsgs };
                  const list = nextMsgs[key];
                  if (Array.isArray(list)) {
                    const curId = getStoredUserIdLocal();
                    nextMsgs[key] = list.map((m) => {
                      try {
                        if (m && m.sender && m.sender.id != null) {
                          if (
                            curId == null ||
                            String(m.sender.id) !== String(curId)
                          ) {
                            return {
                              ...m,
                              sender: { ...m.sender, avatar: av },
                            } as any;
                          }
                          return m;
                        }
                        return { ...m, other_user_avatar: av } as any;
                      } catch {
                        return m;
                      }
                    });
                  }
                  return nextMsgs;
                });
              }
            } catch (e) {
              console.warn("Failed to apply avatar from room_update:", e);
            }

            return next;
          });
          return;
        }

        // 4. Fallback: Direct array (for backward compatibility)
        if (Array.isArray(data)) {
          console.log("Processing direct array chatrooms");
          try {
            const mapped = (data as ChatRoom[]).map((r) => {
              const withOther = deriveOtherFromMembers(r as any);
              return {
                ...withOther,
                other_user_avatar:
                  normalizeAvatar((withOther as any).other_user_avatar) ||
                  (withOther as any).other_user_avatar ||
                  null,
              };
            });
            setChatrooms(mapped as ChatRoom[]);

            try {
              localStorage.setItem("oysloe_chatrooms", JSON.stringify(mapped));
            } catch {}

            // Apply avatars
            try {
              const avatarMap: Record<string, string> = {};
              mapped.forEach((r: any) => {
                const key = String(r.room_id ?? r.id ?? r.name ?? "");
                if (!key) return;
                const av =
                  normalizeAvatar((r as any).other_user_avatar) ||
                  (r as any).other_user_avatar ||
                  null;
                if (av) avatarMap[key] = av;
              });
              if (Object.keys(avatarMap).length > 0) {
                const getStoredUserIdLocal = getStoredUserId;
                setMessages((prev) => {
                  const next: typeof prev = { ...prev };
                  Object.keys(avatarMap).forEach((rk) => {
                    const list = next[rk];
                    if (!Array.isArray(list)) return;
                    const curId = getStoredUserIdLocal();
                    next[rk] = list.map((m) => {
                      try {
                        if (m && m.sender && m.sender.id != null) {
                          if (
                            curId == null ||
                            String(m.sender.id) !== String(curId)
                          ) {
                            return {
                              ...m,
                              sender: { ...m.sender, avatar: avatarMap[rk] },
                            } as any;
                          }
                          return m;
                        }
                        return {
                          ...m,
                          other_user_avatar: avatarMap[rk],
                        } as any;
                      } catch {
                        return m;
                      }
                    });
                  });
                  return next;
                });
              }
            } catch (e) {
              console.warn("Failed to apply avatars from direct array:", e);
            }
          } catch (error) {
            console.error("Error processing direct array:", error);
          }
          return;
        }

        // 5. Log unhandled message types
        console.log("Unhandled message type:", (data as any).type, data);
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
            // Send the FULL data URL including data:image/...;base64, prefix
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

      // Build the WebSocket URL
      const wsBase = getWsBase();
      const encoded = encodeURIComponent(key);
      const url = `${wsBase}/chat/${encoded}/?token=${token}`;
      console.log("WebSocket URL for sending:", url);

      // Wrap in a Promise to handle async WebSocket connection
      return new Promise<void>((resolve, reject) => {
        // Create a NEW WebSocketClient JUST for sending
        const client = new WebSocketClient(url, token, {
          onOpen: () => {
            console.log("sendMessage WebSocket connected");

            try {
              const payload = {
                type: "chat_message",
                message: messageToSend,
                temp_id: tempId,
              };

              // Add file metadata if it's a file
              if (file) {
                Object.assign(payload, {
                  file_name: fileName,
                  file_type: fileType,
                  file_size: file.size,
                  is_media: true,
                });
                console.log("Sending file as data URL");
              } else {
                Object.assign(payload, { is_media: false });
                console.log("Sending text message");
              }

              client.send(payload);
              console.log("Message sent via WebSocket");

              // Close after sending
              setTimeout(() => {
                try {
                  client.close();
                } catch (err) {
                  console.error("Error closing client:", err);
                }
                resolve(); // Resolve the promise
              }, 100);
            } catch (error) {
              console.error("Failed to send message:", error);
              reject(error);
            }
          },

          onClose: (ev) => {
            console.log("sendMessage WebSocket closed:", ev?.code, ev?.reason);
            // If we haven't resolved/rejected yet, resolve now
            // (connection might close after sending successfully)
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

          // Set a timeout for connection
          const timeout = setTimeout(() => {
            if (!client.isOpen()) {
              reject(new Error("WebSocket connection timeout"));
              try {
                client.close();
              } catch {}
            }
          }, 5000); // 5 second timeout

          // Clean up timeout on success
          client.onOpen = () => {
            clearTimeout(timeout);
          };
        } catch (error) {
          console.error("Failed to create WebSocket for sending:", error);
          reject(new Error(`WebSocket send failed: ${error}`));
        }
      });
    },
    [token]
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
    []
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
  }, []);

  const isRoomConnected = useCallback(
    (roomId: string) =>
      !!getClientForRoom(roomId) && getClientForRoom(roomId)!.isOpen(),
    []
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
      if (likelyIndex !== -1) return prev;
      // mark optimistic messages so they can be replaced when server responds
      (msg as any).__optimistic = true;
      // ensure the temp id is preserved under a known key for matching
      if ((msg as any).temp_id && !(msg as any).__temp_id) {
        (msg as any).__temp_id = (msg as any).temp_id;
      }
      return { ...prev, [k]: [...list, msg] };
    });
  }, []);

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
  }, []);

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
  };
}
