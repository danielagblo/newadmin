"use client";

import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { chatRoomsApi, messagesApi } from "@/lib/api/chats";
import { feedbackApi } from "@/lib/api/feedback";
import { usersApi } from "@/lib/api/users";
import useWsChat from "@/lib/hooks/useWsChat";
import { ChatRoom, Message, User } from "@/lib/types";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  File,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  MessageSquare,
  Mic,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Unlock,
  UserCheck,
  User as UserIcon,
  Users,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Extended types to handle missing properties
type ExtendedChatRoom = ChatRoom & {
  status?: "open" | "closed";
  last_message?: any;
  updated_at?: string;
  messages?: ExtendedMessage[];
  profile_picture?: string | null;
  other_user_name?: string;
  other_user_avatar?: string | null;
  unread?: number;
  is_pending_request?: boolean;
  pending_feedback?: any;
};

type ExtendedUser = User & {
  profile_picture?: string | null;
};

type MessageSender = {
  id: number;
  name?: string | null;
  email?: string | null;
  profile_picture?: string | null;
  is_staff?: boolean;
  is_superuser?: boolean;
};

const PENDING_REQUESTS_KEY = 'pending_feedback_requests_v1';

// Renders data URLs/blobs with a regular <img> to avoid Next.js image optimizer errors.
const SafeImage: React.FC<any> = ({ src, alt, className, style, fill, ...rest }) => {
  if (!src) return null;
  const s = String(src || "");
  if (s.startsWith("data:") || s.startsWith("blob:")) {
    return (
      // eslint-disable-next-line jsx-a11y/alt-text
      <img src={s} alt={alt} className={className} style={style} {...rest} />
    );
  }
  // For regular URLs use next/image (keeps existing behavior)
  return <Image src={s} alt={alt} className={className} style={style} {...(fill ? { fill: true } : {})} {...rest} />;
};

const getPendingRequestIds = (): number[] => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(PENDING_REQUESTS_KEY) || '[]');
  } catch {
    return [];
  }
};

const loadPendingRequests = (): any[] => {
  if (typeof window === 'undefined') return [];
  try {
    const ids: number[] = getPendingRequestIds();
    return ids
      .map((id) => {
        try {
          const raw = localStorage.getItem(`pending_request_${id}`);
          if (!raw) return null;
          const fb = JSON.parse(raw);
          return {
            // use negative id to avoid colliding with real rooms
            id: -fb.id,
            room_id: `pending_${fb.id}`,
            name: fb.subject ? `New Request: ${fb.subject}` : `New Request: Feedback #${fb.id}`,
            status: 'pending',
            is_group: false,
            last_message: { text: fb.message, created_at: fb.created_at, sender: (fb.user && fb.user.name) || 'User' },
            messages: [],
            profile_picture: fb.user?.profile_picture || null,
            other_user_name: (fb.user && (fb.user.name || fb.user.email)) || 'Unknown User',
            other_user_avatar: fb.user?.profile_picture || null,
            unread: 1,
            is_pending_request: true,
            pending_feedback: fb,
          } as any;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const removePendingRequest = (id: number) => {
  if (typeof window === 'undefined') return;
  try {
    const ids = getPendingRequestIds().filter((x) => x !== id);
    localStorage.setItem(PENDING_REQUESTS_KEY, JSON.stringify(ids));
    localStorage.removeItem(`pending_request_${id}`);
  } catch { }
};

// Ensure room arrays are unique by `id` or `room_id` to avoid duplicates
const uniqRooms = (rooms: ExtendedChatRoom[]) => {
  const seen = new Map<string, ExtendedChatRoom>();
  for (const r of rooms || []) {
    const key = r.id != null ? `id:${r.id}` : r.room_id ? `rid:${r.room_id}` : JSON.stringify(r);
    if (!seen.has(key)) seen.set(key, r);
  }
  return Array.from(seen.values());
};

const addPendingRequest = (feedback: any) => {
  if (typeof window === 'undefined') return;
  try {
    const key = PENDING_REQUESTS_KEY;
    const ids = getPendingRequestIds();
    if (!ids.includes(feedback.id)) {
      ids.push(feedback.id);
      localStorage.setItem(key, JSON.stringify(ids));
      localStorage.setItem(`pending_request_${feedback.id}`, JSON.stringify(feedback));
    }
  } catch (e) {
    console.warn('Failed to add pending request', e);
  }
};

// Fix the base Message type to use MessageSender
type ExtendedMessage = Omit<Message, "sender"> & {
  attachments?: Array<{
    id: number;
    file_type: "image" | "audio" | "video" | "document";
    file_url: string;
    file_name?: string;
    file_size?: number;
  }>;
  chat_room?: number;
  sender?: MessageSender;
  updated_at: string;
  is_reply?: boolean;
  reply_to?: ExtendedMessage;
  temp_id?: string;
  __temp_id?: string;
};

export default function ChatRoomsPage() {
  const [chatRooms, setChatRooms] = useState<ExtendedChatRoom[]>([]);
  const [users, setUsers] = useState<ExtendedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<ExtendedChatRoom | null>(
    null
  );
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [filterOption, setFilterOption] = useState("All");
  const [openFilter, setOpenFilter] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [isSwitchingRoom, setIsSwitchingRoom] = useState(false);
  const [lastSelectedRoomId, setLastSelectedRoomId] = useState<number | null>(
    null
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [replyingTo, setReplyingTo] = useState<ExtendedMessage | null>(null);
  const user =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("user") || "null")
      : null;

  // Store a ref to track if we're currently switching rooms
  const switchingRoomRef = useRef(false);

  const handleReplyToMessage = (message: ExtendedMessage) => {
    setReplyingTo(message);
    setNewMessage("");
    setTimeout(() => {
      const input = document.querySelector(
        'input[type="text"]'
      ) as HTMLInputElement;
      input?.focus();
    }, 100);
  };

  const getMessageType = (message: ExtendedMessage) => {
    const sender = message.sender;
    if (sender?.is_superuser) return "admin";
    if (sender?.is_staff) return "staff";
    return "customer";
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case "admin":
        return UserCheck;
      case "staff":
        return AlertCircle;
      case "customer":
        return MessageCircle;
      default:
        return MessageCircle;
    }
  };

  const getMessageTypeColor = (type: string, isStaffOrAdmin: boolean) => {
    if (isStaffOrAdmin) {
      return "bg-blue-100 text-blue-800 border-blue-200";
    }
    switch (type) {
      case "admin":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "staff":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "customer":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const handleCloseCase = async () => {
    if (!selectedRoom) return;

    if (
      window.confirm(
        `Are you sure you want to close "${selectedRoom.name}"? This will archive the conversation.`
      )
    ) {
      try {
        if (messages.length > 0) {
          const messageToClose = messages.find((msg) => msg.sender?.id !== 0);
          if (messageToClose) {
            await messagesApi.close(messageToClose.id);
          }
        }

        setSelectedRoom((prev) =>
          prev ? { ...prev, status: "closed" } : null
        );

        setChatRooms((prev) =>
          prev.map((room) =>
            room.id === selectedRoom.id ? { ...room, status: "closed" } : room
          )
        );

        const systemMessage: ExtendedMessage = {
          id: Date.now(),
          content: "Case closed by support agent.",
          sender: {
            id: 0,
            name: "System",
            email: "system@example.com",
          } as MessageSender,
          room: selectedRoom.id,
          is_read: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, systemMessage]);
        alert("Case closed successfully");
      } catch (error) {
        console.error("Error closing case:", error);
        setSelectedRoom((prev) =>
          prev ? { ...prev, status: "closed" } : null
        );
        setChatRooms((prev) =>
          prev.map((room) =>
            room.id === selectedRoom.id ? { ...room, status: "closed" } : room
          )
        );
        alert("Case closed locally");
      }
    }
  };

  const ws = useWsChat();
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current && !switchingRoomRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    try {
      ws.connectToChatroomsList();
      ws.connectToUnreadCount();
    } catch { }
    // Fetch users and also feedbacks so pending requests are available
    // in this view without visiting the Feedback tab.
    const fetchInitial = async () => {
      fetchUsers();
      try {
        const data = await feedbackApi.list({ ordering: '-created_at' } as any);
        if (Array.isArray(data)) {
          data.forEach((fb: any) => {
            if (typeof fb.rating === 'number' && fb.rating > 5) {
              addPendingRequest(fb);
            }
          });
          // trigger re-render so loadPendingRequests is used by filtered list
          setChatRooms((prev) => uniqRooms(prev));
        }
      } catch (e) {
        // non-fatal: if feedback API fails, we still show existing chatrooms
        console.warn('Failed to fetch feedbacks for pending requests:', e);
      }
    };
    fetchInitial();
    return () => {
      try {
        ws.closeAll();
      } catch { }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRoom && !switchingRoomRef.current) {
      // Scroll to bottom after a short delay to ensure messages are rendered
      const scrollTimer = setTimeout(() => {
        scrollToBottom();
      }, 300);

      return () => clearTimeout(scrollTimer);
    }
  }, [selectedRoom]);

  // Use a ref to store the latest messages for WebSocket comparison
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Use a ref to store the latest selected room
  const selectedRoomRef = useRef(selectedRoom);
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  // No global event listener — rely on wsRef polling to sync messages

  useEffect(() => {
    try {
      if (Array.isArray(ws.chatrooms)) {
        const incoming = uniqRooms(ws.chatrooms as ExtendedChatRoom[]);
        // shallow compare by id/room_id to avoid unnecessary state updates
        const prevKeys = chatRooms.map((r) => String(r.room_id ?? r.id)).join(",");
        const newKeys = incoming.map((r) => String(r.room_id ?? r.id)).join(",");
        if (prevKeys !== newKeys) {
          setChatRooms(incoming);
        }

        const newUnreadCounts: Record<number, number> = {};
        ws.chatrooms.forEach((room: any) => {
          if (room.id && room.unread !== undefined) {
            newUnreadCounts[room.id] = room.unread;
          }
        });
        // update unread counts only when changed
        const prevUnreadKeys = Object.keys(unreadCounts)
          .map((k) => `${k}:${unreadCounts[Number(k)]}`)
          .join(",");
        const newUnreadKeys = Object.keys(newUnreadCounts)
          .map((k) => `${k}:${newUnreadCounts[Number(k)]}`)
          .join(",");
        if (prevUnreadKeys !== newUnreadKeys) setUnreadCounts(newUnreadCounts);
      }
    } catch {
      // ignore
    }
  }, [ws.chatrooms, chatRooms, unreadCounts]);

  // Keep a stable ref to `ws` so we don't include the whole object in deps
  const wsRef = useRef(ws);
  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);

  // Sync messages for the selected room by retrying until they arrive or timeout
  useEffect(() => {
    if (!selectedRoom || switchingRoomRef.current) return;

    const key = String(selectedRoom.room_id ?? selectedRoom.id ?? "");
    let syncAttempts = 0;
    const maxSyncAttempts = 40; // ~8 seconds at 200ms intervals
    let syncIntervalId: number | null = null;

    const syncNow = async () => {
      try {
        // Try several key forms: room_id, numeric id, or detect by scanning messages
        const altKey = String(selectedRoom?.id ?? "");
        let wsMessages = wsRef.current?.messages?.[key];
        if (!wsMessages) wsMessages = wsRef.current?.messages?.[altKey];
        // If still not found, search any room key whose messages reference this room id
        if (!wsMessages && wsRef.current?.messages) {
          for (const k of Object.keys(wsRef.current.messages)) {
            const arr = wsRef.current.messages[k];
            if (Array.isArray(arr) && arr.some((m: any) => String(m.room) === String(selectedRoom?.id))) {
              wsMessages = arr;
              break;
            }
          }
        }
        if (wsMessages && Array.isArray(wsMessages)) {
          // Messages found — stop retrying
          if (syncIntervalId !== null) {
            clearInterval(syncIntervalId);
            syncIntervalId = null;
          }
          setLoadingMessages(true);

          const formattedMessages: ExtendedMessage[] = wsMessages.map(
            (msg: any) => {
              let senderInfo: MessageSender = {
                id: 0,
                name: "Unknown",
                email: null,
                profile_picture: null,
              };

              if (typeof msg.sender === "string") {
                senderInfo.name = msg.sender;
                senderInfo.email = msg.email || null;
              } else if (msg.sender && typeof msg.sender === "object") {
                senderInfo = { ...senderInfo, ...msg.sender };
              }

              const isStaffOrAdmin =
                msg.email === user?.email ||
                (msg.sender && typeof msg.sender === "string" && msg.sender === user?.name);

              return {
                id: msg.id,
                content: msg.content,
                sender: senderInfo,
                room: selectedRoom.id,
                chat_room: selectedRoom.id,
                created_at: msg.created_at || msg.timestamp || new Date().toISOString(),
                updated_at: msg.updated_at || msg.created_at || msg.timestamp || new Date().toISOString(),
                is_read: isStaffOrAdmin ? true : msg.is_read || false,
              } as ExtendedMessage;
            }
          );

          // Merge optimistic and incoming messages to avoid duplicates
          try {
            const existing = messagesRef.current || [];
            // Use a Map to deduplicate by ID first, preserving order
            const msgMap = new Map<number | string, ExtendedMessage>();

            // Add existing messages to map
            for (const m of existing) {
              const key = m.id || (m as any).__temp_id || `${m.sender?.id}_${m.created_at}`;
              msgMap.set(key, m);
            }

            // Process incoming messages — replace if ID/temp_id match, add if new
            const incomingToProcess = formattedMessages.map((m, idx) => ({ msg: m, raw: wsMessages[idx] }));
            for (const item of incomingToProcess) {
              const incoming = { ...item.msg } as ExtendedMessage & { temp_id?: string };
              incoming.temp_id = (item.raw && (item.raw.temp_id || item.raw.__temp_id)) || (incoming as any).temp_id;

              // Primary: match by server ID
              if (incoming.id && incoming.id > 0) {
                msgMap.set(incoming.id, incoming);
                continue;
              }

              // Secondary: match by temp_id (optimistic placeholder)
              if ((incoming as any).temp_id) {
                const existingByTemp = Array.from(msgMap.values()).find(
                  (m) => ((m as any).__temp_id || (m as any).temp_id) === (incoming as any).temp_id
                );
                if (existingByTemp) {
                  // Replace optimistic with server response
                  const key = existingByTemp.id || (existingByTemp as any).__temp_id;
                  msgMap.set(key, incoming);
                  continue;
                }
                // No existing optimistic found; add as new
                const tempKey = (incoming as any).temp_id;
                msgMap.set(tempKey, incoming);
                continue;
              }

              // Tertiary: fuzzy match on content+sender+time (within 5s) for server echoes
              const incomingTime = incoming.created_at ? new Date(incoming.created_at).getTime() : 0;
              let found = false;
              for (const [key, existing] of msgMap.entries()) {
                if (!existing || !incoming) continue;
                if (existing.sender?.id && incoming.sender?.id && existing.sender.id !== incoming.sender.id) continue;
                if (existing.content !== incoming.content) continue;
                const existingTime = existing.created_at ? new Date(existing.created_at).getTime() : 0;
                if (Math.abs(existingTime - incomingTime) <= 5000) {
                  // Always replace with server version (more authoritative)
                  msgMap.set(key, incoming);
                  found = true;
                  break;
                }
              }
              if (found) continue;

              // No match found — add as genuinely new message
              const newKey = incoming.id || (incoming as any).temp_id || `${incoming.sender?.id}_${incoming.created_at}`;
              msgMap.set(newKey, incoming);
            }

            // Convert map back to sorted array
            const merged = Array.from(msgMap.values()).sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );

            // Avoid updating state if content is identical to prevent render loops
            try {
              const existing = messagesRef.current || [];
              const same =
                existing.length === merged.length &&
                existing.every((m: any, i: number) =>
                  String(m.id) === String(merged[i]?.id) &&
                  String(m.created_at) === String(merged[i]?.created_at) &&
                  String(m.content) === String(merged[i]?.content)
                );
              if (!same) setMessages(merged);
            } catch {
              setMessages(merged);
            }
          } catch (err) {
            try {
              const existing = messagesRef.current || [];
              const same =
                existing.length === formattedMessages.length &&
                existing.every((m: any, i: number) =>
                  String(m.id) === String(formattedMessages[i]?.id) &&
                  String(m.created_at) === String(formattedMessages[i]?.created_at) &&
                  String(m.content) === String(formattedMessages[i]?.content)
                );
              if (!same) setMessages(formattedMessages);
            } catch {
              setMessages(formattedMessages);
            }
          }

          if (formattedMessages.length > 0) {
            try {
              await wsRef.current?.markAsRead?.(key);
            } catch { }
            setUnreadCounts((prev) => ({ ...prev, [selectedRoom.id]: 0 }));
          }

          setLoadingMessages(false);
          return;
        }

        // No messages found yet — try to connect to room and keep retrying
        syncAttempts++;
        if (syncAttempts === 1) {
          // First attempt: connect to room
          try {
            await wsRef.current?.connectToRoom?.(key);
          } catch (err) {
            console.error("Failed to connect to room:", err);
          }
        }

        // If we've exceeded max attempts, stop retrying and show "no messages"
        if (syncAttempts >= maxSyncAttempts) {
          if (syncIntervalId !== null) {
            clearInterval(syncIntervalId);
            syncIntervalId = null;
          }
          setLoadingMessages(false);
          return;
        }
      } catch (e) {
        console.error("Error syncing messages:", e);
      }
    };

    // Run immediately and also set a short interval to catch rapid updates
    syncNow();
    syncIntervalId = window.setInterval(syncNow, 200);

    return () => {
      if (syncIntervalId !== null) {
        clearInterval(syncIntervalId);
      }
    };
  }, [selectedRoom?.room_id, selectedRoom?.id, user?.id, selectedRoom, user?.email, user?.name, ws.lastUpdateTime]);

  // Add this useEffect to save messages to localStorage when they change
  useEffect(() => {
    if (selectedRoom && messages.length > 0) {
      try {
        // Only save messages that:
        // 1. Belong to this room
        // 2. Have a proper server ID (not optimistic/timestamp-based IDs like Date.now())
        // 3. Are not marked as optimistic placeholders
        const messagesToSave = messages.filter((m) => {
          // Must belong to current room
          if (String(m.room ?? m.chat_room) !== String(selectedRoom.id)) {
            return false;
          }
          // Skip optimistic messages (ID looks like Date.now() - very large numbers)
          // Proper IDs from server are typically smaller (< 10 million)
          if (typeof m.id === "number" && m.id > 1000000000000) {
            return false; // Skip timestamp-based optimistic IDs
          }
          // Skip if explicitly marked as optimistic
          if ((m as any).__optimistic) {
            return false;
          }
          return true;
        });
        if (messagesToSave.length > 0) {
          localStorage.setItem(
            `chat_messages_${selectedRoom.id}`,
            JSON.stringify(messagesToSave)
          );
        }
      } catch (error) {
        console.error("Failed to cache messages:", error);
      }
    }
  }, [selectedRoom, messages]);

  // Add this useEffect to clear old cache when component mounts
  useEffect(() => {
    // Clear old cached messages (older than 1 day)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("chat_messages_")) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || "[]");
          if (data[0]?.timestamp) {
            const messageTime = new Date(data[0].timestamp).getTime();
            if (messageTime < oneDayAgo) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          // Ignore invalid data
        }
      }
    });
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await usersApi.list();
      setUsers(data as ExtendedUser[]);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Failed to load users");
      setLoading(false);
    }
  };

  const handleCreateCase = useCallback(async (selectedUser: ExtendedUser, initialMessage?: string): Promise<ExtendedChatRoom | null> => {
    try {
      // Clear current messages
      setMessages([]);
      setReplyingTo(null);
      switchingRoomRef.current = true;

      const roomPayload: any = {
        name: `${selectedUser.name} - Support Case`,
        email: selectedUser?.email,
        is_group: false,
        members: [selectedUser.id],
      };

      // Create the chat room via API
      const newRoom = await chatRoomsApi.getByEmail(roomPayload?.email);

      // Create extended room with proper structure
      const extendedRoom: ExtendedChatRoom = {
        ...newRoom,
        id: newRoom.id,
        room_id: newRoom.room_id || `private_${Date.now()}`,
        status: "open",
        last_message: {
          text: "Case opened by support agent.",
          is_media: false,
          created_at: new Date().toISOString(),
          sender: "System",
        },
        updated_at: new Date().toISOString(),
        messages: [],
        profile_picture: selectedUser.profile_picture,
        members: [selectedUser],
        other_user_name: selectedUser.name,
        other_user_avatar: selectedUser.profile_picture,
        unread: 0,
      };

      // Immediately update chat rooms list (deduplicated)
      setChatRooms((prev) => uniqRooms([extendedRoom, ...prev]));

      // Immediately select the new room
      setSelectedRoom(extendedRoom);
      setLastSelectedRoomId(extendedRoom.id);

      // Connect to the room via WebSocket
      const roomKey = String(extendedRoom.room_id ?? extendedRoom.id ?? "");
      try {
        await ws.connectToRoom(roomKey);
      } catch (e) {
        console.error("Failed to connect to room via websocket", e);
      }

      // Create initial message: if initialMessage provided use it as the
      // first chat message (from the user); otherwise create the default
      // system message.
      const firstMessage: ExtendedMessage = {
        id: Date.now(),
        content: initialMessage || 'Case opened by support agent.',
        sender: (initialMessage
          ? ({ id: selectedUser.id || 0, name: selectedUser.name || selectedUser.email || 'User', email: selectedUser.email || null } as MessageSender)
          : ({ id: 0, name: 'System', email: 'system@example.com' } as MessageSender)
        ),
        room: extendedRoom.id,
        is_read: !!initialMessage ? false : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as ExtendedMessage;

      setMessages([firstMessage]);
      setIsUsersModalOpen(false);
      switchingRoomRef.current = false;

      // Also manually refresh chatrooms list to ensure WebSocket picks it up
      setTimeout(() => {
        try {
          ws.connectToChatroomsList();
        } catch { }
      }, 1000);
      return extendedRoom;
    } catch (error: any) {
      console.error("Error creating case:", error);
      alert(error.response?.data?.detail || "Failed to create case");
      switchingRoomRef.current = false;
      return null;
    }
  }, [ws]);

  const handleSelectRoom = useCallback<(room: ExtendedChatRoom) => Promise<void>>(
    async (room: ExtendedChatRoom) => {
      if (selectedRoom?.id === room.id || switchingRoomRef.current) return;

      // If this is a pending feedback request, convert it to a real room first
      if ((room as any).is_pending_request) {
        try {
          // Inline conversion logic to avoid circular dependency
          const fb = room.pending_feedback || (room.id && room.id < 0
            ? JSON.parse(localStorage.getItem(`pending_request_${Math.abs(room.id)}`) || 'null')
            : null);

          if (fb) {
            const pendingUser: ExtendedUser = {
              id: (fb.user && typeof fb.user === 'object' && fb.user.id) ? fb.user.id : Math.abs(fb.id) + 1000000,
              name: (fb.user && typeof fb.user === 'object' && (fb.user.name || fb.user.email)) || `User ${fb.id}`,
              email: fb.user && typeof fb.user === 'object' ? fb.user.email : undefined,
              profile_picture: fb.user?.profile_picture || null,
            } as any;

            const created = await handleCreateCase(pendingUser, fb.message);
            if (created && created.id) {
              try {
                await chatRoomsApi.sendMessage(created.id, fb.message);
              } catch (sendErr) {
                console.warn('Failed to send initial message to server room:', sendErr);
              }

              try {
                await feedbackApi.update(fb.id, { status: 'RESOLVED' } as any);
              } catch (updateErr) {
                console.warn('Failed to update feedback status:', updateErr);
              }

              removePendingRequest(fb.id);
            }
          }
        } catch (e) {
          console.error('Failed to convert pending request:', e);
        }
        return;
      }

      setIsSwitchingRoom(true);
      switchingRoomRef.current = true;
      setLoadingMessages(true);

      try {
        // Clear messages immediately to prevent showing messages from the previous room
        setMessages([]);
        setReplyingTo(null);

        // Set new room
        setSelectedRoom(room);
        setLastSelectedRoomId(room.id);

        // Get the room key
        const key = String(room.room_id ?? room.id ?? "");

        // Connect to the room via WebSocket with a timeout
        const connectPromise = ws.connectToRoom(key);

        // Timeout for connection
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 10000)
        );

        try {
          await Promise.race([connectPromise, timeoutPromise]);
        } catch (error) {
          console.error("Failed to connect to room:", error);
          // Continue anyway - messages might load from cache
        }

        // Mark as read
        try {
          await ws.markAsRead(key);
        } catch (error) {
          console.error("Failed to mark as read:", error);
        }

        // Update unread counts
        setUnreadCounts((prev) => ({
          ...prev,
          [room.id]: 0,
        }));

        // Check if we have cached messages in localStorage and verify they belong to this room
        try {
          const cached = localStorage.getItem(`chat_messages_${room.id}`);
          if (cached) {
            const parsed = JSON.parse(cached) as ExtendedMessage[];
            // Only show cached messages if they're not empty AND they belong to this room
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Verify at least one message belongs to this room to avoid contamination
              // AND skip any optimistic/timestamp-based IDs
              const validMessages = parsed.filter(
                (m) =>
                  String(m.room ?? m.chat_room) === String(room.id) &&
                  !(typeof m.id === "number" && m.id > 1000000000000) &&
                  !(m as any).__optimistic
              );
              if (validMessages.length > 0) {
                setMessages(validMessages);
              } else {
                console.warn("Cached messages belong to different room or are optimistic, skipping");
              }
            }
          }
        } catch (error) {
          console.error("Failed to load cached messages:", error);
        }
      } finally {
        // Don't set loading to false immediately - wait a bit. If we have cached
        // messages, keep `loadingMessages` true to indicate background fetch.
        setTimeout(() => {
          setIsSwitchingRoom(false);
          switchingRoomRef.current = false;
          if (messages.length === 0) {
            // Show "no messages" state after 3 seconds
            setTimeout(() => {
              setLoadingMessages(false);
            }, 3000);
          } else {
            // if we displayed cached messages, keep loadingMessages true for a short
            // grace period so the UI can show an inline updater; then clear it.
            setTimeout(() => setLoadingMessages(false), 1500);
          }
        }, 200);
      }
    },
    [selectedRoom, ws, messages.length, handleCreateCase]
  );

  const convertPendingToRoom = useCallback(async (pendingRoom: any) => {
    const fb = pendingRoom.pending_feedback || (pendingRoom.id && pendingRoom.id < 0
      ? JSON.parse(localStorage.getItem(`pending_request_${Math.abs(pendingRoom.id)}`) || 'null')
      : null);

    if (!fb) {
      try {
        await handleSelectRoom(pendingRoom);
      } catch { }
      return;
    }

    const pendingUser: ExtendedUser = {
      id: (fb.user && typeof fb.user === 'object' && fb.user.id) ? fb.user.id : Math.abs(fb.id) + 1000000,
      name: (fb.user && typeof fb.user === 'object' && (fb.user.name || fb.user.email)) || `User ${fb.id}`,
      email: fb.user && typeof fb.user === 'object' ? fb.user.email : undefined,
      profile_picture: fb.user?.profile_picture || null,
    } as any;

    try {
      const created = await handleCreateCase(pendingUser, fb.message);
      if (created && created.id) {
        // Send the original feedback message to the newly created room on the server
        try {
          await chatRoomsApi.sendMessage(created.id, fb.message);
        } catch (sendErr) {
          console.warn('Failed to send initial message to server room:', sendErr);
        }

        // Mark feedback as resolved on server so it no longer appears as pending
        try {
          await feedbackApi.update(fb.id, { status: 'RESOLVED' } as any);
        } catch (updateErr) {
          console.warn('Failed to update feedback status:', updateErr);
        }

        // Remove local pending record
        removePendingRequest(fb.id);
      } else {
        // If room was not created, fall back to selecting the pending virtual room
        await handleSelectRoom(pendingRoom);
      }
    } catch (e) {
      console.error('Failed to convert pending request:', e);
      alert('Failed to create support case from pending request');
    }
  }, [handleCreateCase, handleSelectRoom]);



  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || selectedRoom.status === "closed")
      return;

    // Store message and clear input immediately
    const messageText = newMessage.trim();
    setNewMessage("");

    try {
      const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const roomKey = String(selectedRoom.room_id ?? selectedRoom.id ?? "");

      // Use MessageSender type for optimistic message
      const optimistic: ExtendedMessage = {
        id: Date.now(),
        temp_id: tempId,
        __temp_id: tempId,
        __optimistic: true,
        content: messageText,
        sender: {
          id: user?.id || 1,
          name: user?.name || "Support Agent",
          email: user?.email || "agent@example.com",
          profile_picture: null,
          is_staff: true,
        } as MessageSender,
        room: selectedRoom.id,
        chat_room: selectedRoom.id,
        is_read: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Only add optimistic UI if we already have an active room websocket connection.
      // If the room WS is not connected, attempt to connect and rely on the server echo
      // to render the authoritative message (avoid showing optimistic placeholder).
      let usedOptimistic = false;
      try {
        const isConnected = ws.isRoomConnected(roomKey);
        if (isConnected) {
          ws.addLocalMessage(roomKey, optimistic as any);
          usedOptimistic = true;
        } else {
          try {
            await ws.connectToRoom(roomKey);
          } catch {
            // ignore connect errors; we'll still attempt to send below
          }
        }
      } catch {
        // ignore
      }

      setTimeout(() => {
        scrollToBottom();
      }, 100);

      // Send via websocket
      try {
        await ws.sendMessage(roomKey, messageText, tempId);

        // Update chat room's last message locally
        setChatRooms((prev) =>
          prev.map((room) =>
            room.id === selectedRoom.id
              ? {
                ...room,
                last_message: {
                  text: messageText,
                  is_media: false,
                  created_at: new Date().toISOString(),
                  sender: user?.name || "Support Agent",
                },
                updated_at: new Date().toISOString(),
              }
              : room
          )
        );

        // If this was a pending request, mark it as a normal open support chat now
        if (selectedRoom && (selectedRoom as any).is_pending_request) {
          setChatRooms((prev) =>
            prev.map((r) =>
              r.id === selectedRoom.id
                ? { ...r, is_pending_request: false, status: 'open' }
                : r
            )
          );
          setSelectedRoom((prev) => (prev ? { ...prev, is_pending_request: false, status: 'open' } : prev));
        }
      } catch (err) {
        console.error("WS send failed", err);
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setReplyingTo(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom || selectedRoom.status === "closed") return;

    try {
      const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const roomKey = String(selectedRoom.room_id ?? selectedRoom.id ?? "");
      const fileType = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : "image";

      // Create preview URL for immediate UI display
      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // This is the full data URL: data:image/jpeg;base64,...
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      // Create optimistic message with ACTUAL base64 image
      const optimistic: ExtendedMessage = {
        id: Date.now(),
        content: base64DataUrl, // T
        sender: {
          id: user?.id || 1,
          name: user?.name || "Support Agent",
          email: user?.email || "agent@example.com",
          profile_picture: null,
          is_staff: true,
        } as MessageSender,
        room: selectedRoom.id,
        chat_room: selectedRoom.id,
        is_read: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        attachments: [
          {
            id: Date.now(),
            file_type: fileType,
            file_url: base64DataUrl,
            file_name: file.name,
            file_size: file.size,
          },
        ],
      };

      // Only add optimistic UI if room WS is connected; otherwise rely on server echo
      try {
        const isConnected = ws.isRoomConnected(roomKey);
        if (isConnected) {
          // use hook-local optimistic add (which handles dedupe)
          ws.addLocalMessage(roomKey, optimistic as any);
        } else {
          try {
            await ws.connectToRoom(roomKey);
          } catch {
            // ignore
          }
        }
      } catch (error) {
        console.error("Failed to add optimistic image message:", error);
      }

      setTimeout(() => {
        scrollToBottom();
      }, 100);

      // SEND THE FILE VIA WEBSOCKET - THIS IS WHAT WAS MISSING!
      try {
        await ws.sendMessage(roomKey, "", tempId, file);

        // Update chat room's last message locally
        setChatRooms((prev) =>
          prev.map((room) =>
            room.id === selectedRoom.id
              ? {
                ...room,
                last_message: {
                  text:
                    fileType === "image"
                      ? "📷 Image"
                      : fileType === "video"
                        ? "🎥 Video"
                        : "🎵 Audio",
                  is_media: true,
                  created_at: new Date().toISOString(),
                  sender: user?.name || "Support Agent",
                },
                updated_at: new Date().toISOString(),
              }
              : room
          )
        );
      } catch (err) {
        console.error("WS send failed", err);
        // Update optimistic message to show error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimistic.id
              ? { ...msg, content: `❌ Failed to upload ${file.name}` }
              : msg
          )
        );
      }
    } catch (error) {
      console.error("Error handling file upload:", error);
      alert("Failed to upload file");
    } finally {
      e.target.value = "";
    }
  };

  const handleStartRecording = async () => {
    if (!selectedRoom || selectedRoom.status === "closed") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];

      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(recordedChunksRef.current, {
          type: "audio/webm",
        });
        const audioUrl = URL.createObjectURL(audioBlob);

        const audioMessage: ExtendedMessage = {
          id: Date.now(),
          content: "",
          sender: {
            id: user?.id || 1,
            name: user?.name || "Support Agent",
            email: user?.email || "agent@example.com",
          } as MessageSender,
          room: selectedRoom.id,
          is_read: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          attachments: [
            {
              id: Date.now(),
              file_type: "audio",
              file_url: audioUrl,
              file_name: "voice-message.webm",
              file_size: audioBlob.size,
            },
          ],
        };

        // Only add optimistic UI if room WS is connected; otherwise rely on server echo
        try {
          const isConnected = ws.isRoomConnected(roomKey);
          if (isConnected) {
            ws.addLocalMessage(roomKey, audioMessage as any);
          } else {
            try {
              await ws.connectToRoom(roomKey);
            } catch {
              // ignore
            }
          }
        } catch (err) {
          console.error("Failed to add optimistic audio message:", err);
        }
        setChatRooms((prev) =>
          prev.map((room) =>
            room.id === selectedRoom.id
              ? {
                ...room,
                last_message: "🎵 Voice message",
                updated_at: new Date().toISOString(),
              }
              : room
          )
        );

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const handleStopRecording = async () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();

      // Wait a bit for the recording to finish
      setTimeout(async () => {
        const audioBlob = new Blob(recordedChunksRef.current, {
          type: "audio/webm",
        });

        const tempId = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        const roomKey = String(selectedRoom?.room_id ?? selectedRoom?.id ?? "");

        if (!selectedRoom || !roomKey) return;

        // Create preview URL
        const audioUrl = URL.createObjectURL(audioBlob);

        // Create optimistic message
        const optimistic: ExtendedMessage = {
          id: Date.now(),
          content: "Recording...",
          sender: {
            id: user?.id || 1,
            name: user?.name || "Support Agent",
            email: user?.email || "agent@example.com",
          } as MessageSender,
          room: selectedRoom.id,
          is_read: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          attachments: [
            {
              id: Date.now(),
              file_type: "audio",
              file_url: audioUrl,
              file_name: "voice-message.webm",
              file_size: audioBlob.size,
            },
          ],
        };

        // Add optimistic message only if WS connected; otherwise rely on server echo
        try {
          const isConnected = ws.isRoomConnected(roomKey);
          if (isConnected) ws.addLocalMessage(roomKey, optimistic as any);
          else await ws.connectToRoom(roomKey);
        } catch (err) {
          console.error("Failed to add optimistic message:", err);
        }
        setTimeout(() => {
          scrollToBottom();
        }, 100);
        // SEND THE AUDIO VIA WEBSOCKET - THIS WAS MISSING!
        try {
          await ws.sendMessage(roomKey, "", tempId, audioBlob);

          // Update chat room
          setChatRooms((prev) =>
            prev.map((room) =>
              room.id === selectedRoom.id
                ? {
                  ...room,
                  last_message: {
                    text: "🎵 Voice message",
                    is_media: true,
                    created_at: new Date().toISOString(),
                    sender: user?.name || "Support Agent",
                  },
                  updated_at: new Date().toISOString(),
                }
                : room
            )
          );
        } catch (error) {
          console.error("Error sending audio:", error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === optimistic.id
                ? { ...msg, content: "❌ Failed to send audio" }
                : msg
            )
          );
        }

        recordedChunksRef.current = [];
      }, 100);
    }

    setIsRecording(false);

    // Stop all tracks
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
    }
  };

  const handleReopenCase = async () => {
    if (!selectedRoom) return;

    if (
      window.confirm(`Are you sure you want to reopen "${selectedRoom.name}"?`)
    ) {
      try {
        setSelectedRoom((prev) => (prev ? { ...prev, status: "open" } : null));
        setChatRooms((prev) =>
          prev.map((room) =>
            room.id === selectedRoom.id ? { ...room, status: "open" } : room
          )
        );

        const systemMessage: ExtendedMessage = {
          id: Date.now(),
          content: "Case reopened by support agent.",
          sender: {
            id: 0,
            name: "System",
            email: "system@example.com",
          } as MessageSender,
          room: selectedRoom.id,
          is_read: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, systemMessage]);
      } catch (error) {
        console.error("Error reopening case:", error);
        alert("Failed to reopen case. Please try again.");
      }
    }
  };

  const getDateLabel = (dateString: string) => {
    if (!dateString) return "Invalid date";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid date";
      if (isToday(date)) return "Today";
      if (isYesterday(date)) return "Yesterday";
      return format(date, "MMM dd, yyyy");
    } catch {
      return "Invalid date";
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "--:--";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "--:--";
      return format(date, "HH:mm");
    } catch {
      return "--:--";
    }
  };

  const formatTimeDistance = (dateString: string) => {
    if (!dateString) return "Just now";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Just now";
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "Just now";
    }
  };

  const groupMessagesByDate = useCallback((messages: ExtendedMessage[]) => {
    const groups: { [key: string]: ExtendedMessage[] } = {};
    messages.forEach((message) => {
      const dateLabel = getDateLabel(message.created_at);
      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(message);
    });
    return Object.entries(groups).map(([label, msgs]) => ({
      label,
      messages: msgs,
    }));
  }, []);

  const getUnreadCount = useCallback((roomId: number) => {
    return unreadCounts[roomId] || 0;
  }, [unreadCounts]);

  const getFilteredChatRooms = useCallback(() => {
    const pending = loadPendingRequests();
    let filtered = [...(pending || []), ...chatRooms];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (room) =>
          room.name.toLowerCase().includes(term) ||
          room.other_user_name?.toLowerCase().includes(term) ||
          room.members?.some((member: any) => {
            if (typeof member === "object") {
              return (
                member.name?.toLowerCase().includes(term) ||
                member.email?.toLowerCase().includes(term)
              );
            }
            return false;
          }) ||
          room.room_id?.toLowerCase().includes(term)
      );
    }
    if (filterOption === "Open") {
      filtered = filtered.filter((room) => room.status !== "closed");
    } else if (filterOption === "Closed") {
      filtered = filtered.filter((room) => room.status === "closed");
    } else if (filterOption === "Unread") {
      filtered = filtered.filter((room) => getUnreadCount(room.id) > 0);
    } else if (filterOption === "Recent") {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      filtered = filtered.filter(
        (room) => room.updated_at && new Date(room.updated_at) > oneDayAgo
      );
    }
    return filtered.sort((a, b) => {
      const timeA = new Date(getRoomUpdatedTime(a)).getTime();
      const timeB = new Date(getRoomUpdatedTime(b)).getTime();
      return timeB - timeA; // Descending
    });
  }, [chatRooms, searchTerm, filterOption, getUnreadCount]);



  const getLastMessage = (room: ExtendedChatRoom) => {
    // If last_message is an object
    if (room.last_message && typeof room.last_message === "object") {
      const lastMsg = room.last_message as any;
      const text = lastMsg.text || "";

      // Check if text contains data URLs
      if (text.includes("data:image/")) {
        return "📷 Image";
      }
      if (text.includes("data:audio/")) {
        return "🎵 Audio";
      }
      if (text.includes("data:video/")) {
        return "🎥 Video";
      }

      return text || "No messages yet";
    }

    // If last_message is a string
    if (typeof room.last_message === "string") {
      const lastMsg = room.last_message;

      if (lastMsg.includes("data:image/")) {
        return "📷 Image";
      }
      if (lastMsg.includes("data:audio/")) {
        return "🎵 Audio";
      }
      if (lastMsg.includes("data:video/")) {
        return "🎥 Video";
      }

      return lastMsg || "No messages yet";
    }

    // Default fallback
    return "No messages yet";
  };

  const getAvatarForRoom = (room: ExtendedChatRoom) => {
    if (room.is_group) {
      return { type: "icon" as const, icon: Users };
    }
    if (room.other_user_avatar) {
      return {
        type: "image" as const,
        url: room.other_user_avatar,
      };
    }
    if (room.members && room.members.length > 0) {
      const otherMember = room.members.find((member: any) =>
        typeof member === "object" ? member.id !== 1 : member !== 1
      );
      if (otherMember && typeof otherMember === "object") {
        const extendedMember = otherMember as ExtendedUser;
        if (extendedMember.profile_picture) {
          return {
            type: "image" as const,
            url: extendedMember.profile_picture,
          };
        }
      }
    }
    return { type: "icon" as const, icon: UserIcon };
  };

  const getRoomDisplayName = (room: ExtendedChatRoom) => {
    if (room?.other_user_name) {
      return room?.other_user_name;
    }
    return room.name;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const getRoomUpdatedTime = (room: ExtendedChatRoom) => {
    if (room.last_message && typeof room.last_message === "object") {
      return (room.last_message as any).created_at || "";
    }
    return room.updated_at || room.created_at || "";
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "image":
        return ImageIcon;
      case "video":
        return Video;
      case "audio":
        return Mic;
      default:
        return File;
    }
  };

  // Memoize filtered chat rooms
  const filteredChatRooms = useMemo(
    () => getFilteredChatRooms(),
    [getFilteredChatRooms]
  );

  // Memoize grouped messages
  const groupedMessages = useMemo(
    () => groupMessagesByDate(messages),
    [messages, groupMessagesByDate]
  );

  // Debug: inspect ws.message keys and whether any map to the selected room
  useEffect(() => {
    try {
      const wsMessages = (ws as any)?.messages || {};
      console.debug("[debug] ws.messages keys:", Object.keys(wsMessages));
      console.debug(
        "[debug] selectedRoom:",
        { id: selectedRoom?.id, room_id: selectedRoom?.room_id }
      );
      console.debug("[debug] messages length:", messages.length);

      const keys = Object.keys(wsMessages);
      const matchedKeys = keys.filter(
        (k) => k === String(selectedRoom?.id) || k === selectedRoom?.room_id
      );
      console.debug("[debug] matched keys for selectedRoom:", matchedKeys);

      if (matchedKeys.length > 0) {
        const sample = wsMessages[matchedKeys[0]];
        console.debug("[debug] sample messages for key:", matchedKeys[0], sample?.slice?.(0, 5));
      } else {
        // Scan a few messages to see if any contain a room pointer matching selectedRoom
        const found: any[] = [];
        for (const k of keys) {
          const arr = wsMessages[k];
          if (Array.isArray(arr)) {
            for (const m of arr) {
              if (
                m?.room === selectedRoom?.id ||
                m?.room_id === selectedRoom?.room_id ||
                m?.chatroom_id === selectedRoom?.id
              ) {
                found.push({ key: k, msg: m });
                if (found.length >= 5) break;
              }
            }
          }
          if (found.length >= 5) break;
        }
        console.debug("[debug] scanned messages matching selectedRoom:", found.slice(0, 5));
      }
    } catch (err) {
      console.error("[debug] error inspecting ws.messages", err);
    }
    // Intentionally only run when selectedRoom or messages count changes
  }, [selectedRoom?.id, selectedRoom?.room_id, messages.length]);

  return (
    <Layout>
      <div className="flex h-[calc(100vh-80px)] gap-4 p-4">
        <div className="w-[35%] bg-white rounded-lg shadow flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Chat Rooms
              </h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setLoading(true);
                    try {
                      ws.connectToChatroomsList();
                    } catch (e) {
                      console.error("Failed to refresh chatrooms via WS", e);
                    } finally {
                      setTimeout(() => setLoading(false), 800);
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </div>

            <form onSubmit={handleSearchSubmit} className="relative mb-4">
              <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden">
                <button type="submit" aria-label="Search" className="p-2">
                  <Search className="h-5 w-5 text-gray-400" />
                </button>
                <input
                  type="search"
                  placeholder="Search cases"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-2 py-2 border-0 outline-none focus:ring-0"
                />
              </div>
            </form>

            <div className="relative z-50 mb-4">
              <div
                className="flex items-center justify-between bg-gray-100 rounded-xl px-4 py-2 cursor-pointer flex-row-reverse"
                onClick={() => setOpenFilter(!openFilter)}
              >
                <span className="text-sm font-medium w-full text-center">
                  {filterOption}
                </span>
                <button type="button" className="p-1">
                  <ChevronLeft
                    className={`h-4 w-4 transition-transform duration-200 ${openFilter ? "-rotate-90" : ""
                      }`}
                  />
                </button>
              </div>

              {openFilter && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50">
                  {["All", "Open", "Closed", "Unread", "Recent"].map(
                    (option) => (
                      <button
                        key={option}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-50 text-sm ${filterOption === option
                          ? "bg-blue-50 text-blue-600"
                          : ""
                          }`}
                        onClick={() => {
                          setFilterOption(option);
                          setOpenFilter(false);
                        }}
                      >
                        {option}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-600">{error}</div>
            ) : filteredChatRooms.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchTerm
                  ? "No chat rooms found matching your search"
                  : "No chat rooms found"}
              </div>
            ) : (
              <div className="divide-y">
                {filteredChatRooms?.map((room) => {
                  const isActive = selectedRoom?.id === room.id;
                  const isClosed = room.status === "closed";
                  const unreadCount = getUnreadCount(room.id);
                  const avatarInfo = getAvatarForRoom(room);
                  const displayName = getRoomDisplayName(room);
                  const updatedTime = getRoomUpdatedTime(room);

                  return (
                    <div
                      key={room?.id || room?.room_id}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isActive ? "bg-blue-50" : ""
                        } ${isClosed ? "opacity-75" : ""}`}
                      onClick={() => handleSelectRoom(room)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${isClosed ? "bg-gray-100" : "bg-blue-100"
                              }`}
                          >
                            {avatarInfo.type === "image" ? (
                              <div className="relative w-full h-full">
                                <SafeImage
                                  src={
                                    avatarInfo.url?.replace(
                                      "wss://",
                                      "https://"
                                    ) || ""
                                  }
                                  alt={displayName}
                                  fill
                                  className="rounded-full object-cover"
                                  sizes="48px"
                                />
                              </div>
                            ) : (
                              <avatarInfo.icon
                                className={`h-6 w-6 ${isClosed ? "text-gray-400" : "text-blue-600"
                                  }`}
                              />
                            )}
                          </div>
                          {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900 truncate">
                                {displayName}
                              </h3>
                              {(room as any).is_pending_request && (
                                <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full ml-2">
                                  New Request
                                </span>
                              )}
                              {isClosed && (
                                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                                  Closed
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-sm text-gray-600 truncate mt-1">
                            {getLastMessage(room)}
                          </p>

                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {formatTimeDistance(updatedTime)}
                          </span>

                          <div className="flex items-center gap-2 mt-1">
                            {unreadCount > 0 && (
                              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                                {unreadCount} unread
                              </span>
                            )}
                            {room.is_group && (
                              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded-full">
                                {room.members?.length || 0} members
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 border-t">
            <Button
              onClick={() => setIsUsersModalOpen(true)}
              className="w-full justify-between flex items-center"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="w-full">Make Case</span>
            </Button>
          </div>
        </div>

        <div className="w-[65%] bg-white rounded-lg shadow flex flex-col">
          {!selectedRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <MessageSquare className="h-16 w-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Select a chat</h3>
              <p>Choose a conversation from the list to start messaging</p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedRoom(null);
                      setReplyingTo(null);
                    }}
                    className="md:hidden mr-2"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedRoom.status === "closed"
                          ? "bg-gray-100"
                          : "bg-blue-100"
                          }`}
                      >
                        {selectedRoom.other_user_avatar ? (
                          <div className="relative w-full h-full">
                            <SafeImage
                              src={
                                selectedRoom.other_user_avatar?.replace(
                                  "wss://",
                                  "https://"
                                ) || ""
                              }
                              alt={getRoomDisplayName(selectedRoom)}
                              fill
                              className="rounded-full object-cover"
                              sizes="40px"
                            />
                          </div>
                        ) : selectedRoom.is_group ? (
                          <Users
                            className={`h-5 w-5 ${selectedRoom.status === "closed"
                              ? "text-gray-400"
                              : "text-blue-600"
                              }`}
                          />
                        ) : (
                          <UserIcon
                            className={`h-5 w-5 ${selectedRoom.status === "closed"
                              ? "text-gray-400"
                              : "text-blue-600"
                              }`}
                          />
                        )}
                      </div>
                      {selectedRoom.status !== "closed" && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {getRoomDisplayName(selectedRoom)}
                        </h3>
                        {selectedRoom.status === "closed" && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                            Closed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedRoom.is_group
                          ? "Group chat"
                          : "Direct message"}{" "}
                        • {selectedRoom.members?.length || 0} members
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedRoom.status === "closed" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReopenCase}
                      className="flex items-center gap-2 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200"
                    >
                      <Unlock className="h-4 w-4" />
                      Reopen Case
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCloseCase}
                      className="flex items-center gap-2 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border-red-200"
                    >
                      <Lock className="h-4 w-4" />
                      Close Case
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (
                        window.confirm(
                          `Are you sure you want to permanently delete "${selectedRoom.name}"? This action cannot be undone.`
                        )
                      ) {
                        try {
                          await chatRoomsApi.delete(selectedRoom.id);
                          setChatRooms((prev) =>
                            prev.filter((room) => room.id !== selectedRoom.id)
                          );
                          setSelectedRoom(null);
                          setReplyingTo(null);
                        } catch (error) {
                          console.error("Error deleting chat room:", error);
                          alert("Failed to delete chat room");
                        }
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                {(isSwitchingRoom || loadingMessages) && messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <MessageSquare className="h-16 w-16 mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium mb-2">
                      No messages yet
                    </h3>
                    <p>Send the first message to start the conversation</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-4">
                    {loadingMessages && (
                      <div className="text-sm text-gray-500 mb-3 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        Loading recent messages...
                      </div>
                    )}
                    {replyingTo && (
                      <div className="mb-4 bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Reply className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium text-blue-600">
                                Replying to:
                              </span>
                            </div>
                            <div className="text-sm text-gray-700 bg-white p-2 rounded border border-blue-100">
                              {replyingTo.content ? (
                                <p className="truncate">{replyingTo.content}</p>
                              ) : replyingTo.attachments ? (
                                <p className="text-gray-500">
                                  {replyingTo.attachments[0]?.file_type ===
                                    "image"
                                    ? "📷 Image"
                                    : replyingTo.attachments[0]?.file_type ===
                                      "video"
                                      ? "🎥 Video"
                                      : "🎵 Audio"}
                                </p>
                              ) : (
                                <p className="text-gray-500">Message</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setReplyingTo(null)}
                            className="text-gray-400 hover:text-gray-600 ml-2"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {groupedMessages.map((group) => (
                      <div key={group.label} className="mb-6">
                        <div className="flex items-center justify-center my-4">
                          <div className="px-4 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                            {group.label}
                          </div>
                        </div>

                        {group.messages.map((message) => {
                          const isSystemMessage = message.sender?.id === 0;
                          const isStaffOrAdmin =
                            message.sender?.email === user?.email;
                          const senderAvatar = selectedRoom.other_user_avatar;
                          const senderInitial =
                            message.sender?.name?.charAt(0)?.toUpperCase() ||
                            "U";
                          const messageType = getMessageType(message);
                          const MessageTypeIcon =
                            getMessageTypeIcon(messageType);
                          const messageTypeColor = getMessageTypeColor(
                            messageType,
                            isStaffOrAdmin
                          );

                          return (
                            <div
                              key={message.id}
                              className={`flex gap-3 mb-4 group ${isStaffOrAdmin ? "justify-end" : ""
                                } ${isSystemMessage ? "justify-start" : ""}`}
                            >
                              {!isStaffOrAdmin && (
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                    {senderAvatar ? (
                                      <div className="relative w-full h-full">
                                        <SafeImage
                                          src={senderAvatar?.replace(
                                            "wss://",
                                            "https://"
                                          )}
                                          alt={message.sender?.name || "User"}
                                          fill
                                          className="object-cover"
                                          sizes="32px"
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-xs font-medium">
                                        {senderInitial}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className={`${"max-w-[70%]"}`}>
                                {!isStaffOrAdmin && !isSystemMessage && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs font-medium text-gray-700">
                                      {typeof message.sender === "object"
                                        ? message.sender.name ||
                                        message.sender.email
                                        : `User ${message.sender}`}
                                    </p>
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full border ${messageTypeColor} flex items-center gap-1`}
                                    >
                                      <MessageTypeIcon className="h-3 w-3" />
                                      {messageType}
                                    </span>
                                  </div>
                                )}

                                <div
                                  className={`px-4 py-2 relative ${isStaffOrAdmin
                                    ? "bg-blue-600 text-white rounded-2xl rounded-tr-none"
                                    : !isSystemMessage
                                      ? "bg-gray-100 text-gray-700 text-left rounded-lg "
                                      : "bg-gray-100 text-gray-900 rounded-2xl rounded-tl-none"
                                    }`}
                                >
                                  {message.content &&
                                    (() => {
                                      const content = message.content;

                                      // Handle image data URLs - FIXED: Maintain aspect ratio
                                      if (content.includes("data:image/")) {
                                        return (
                                          <div className="mt-2 first:mt-0">
                                            <div className="relative group">
                                              <div
                                                className="relative rounded-lg overflow-hidden border border-gray-200 max-w-full cursor-pointer"
                                                onClick={() => {
                                                  // This actually works for viewing in new tab!
                                                  const newTab = window.open(
                                                    "",
                                                    "_blank"
                                                  );
                                                  if (newTab) {
                                                    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Image</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            background: #1a1a1a; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh;
            padding: 20px;
          }
          img { 
            max-width: 100%; 
            max-height: 95vh; 
            object-fit: contain; 
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          }
        </style>
      </head>
      <body>
        <img src="${content}" alt="Image" />
      </body>
      </html>
    `;

                                                    newTab.document.open();
                                                    newTab.document.write(html);
                                                    newTab.document.close();
                                                  }
                                                }}
                                              >
                                                {/* Remove fixed width/height, let image determine size */}
                                                <div className="relative rounded-lg overflow-hidden border border-gray-200 max-w-full">
                                                  {/* Use regular img tag for data URLs or Next Image without fill */}
                                                  <SafeImage
                                                    src={content}
                                                    alt="Uploaded image"
                                                    className="w-auto h-auto max-h-[400px] max-w-full object-contain hover:scale-105 transition-transform duration-200"
                                                    style={{
                                                      maxWidth: "100%",
                                                      height: "auto",
                                                    }}
                                                    onLoad={(e: any) => {
                                                      console.log(
                                                        "Image loaded:",
                                                        e.currentTarget
                                                          .naturalWidth,
                                                        "x",
                                                        e.currentTarget
                                                          .naturalHeight
                                                      );
                                                    }}
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }

                                      // Handle audio data URLs - FIXED: Make audio player wider
                                      if (content.includes("data:audio/")) {
                                        return (
                                          <div className="mt-2 first:mt-0 w-full">
                                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 w-full min-w-[300px]">
                                              <div className="flex items-center gap-3 mb-2">
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                  <Mic className="h-5 w-5 text-blue-600" />
                                                </div>
                                                <div className="flex-1">
                                                  <p className="text-sm font-medium text-gray-900">
                                                    Voice message
                                                  </p>
                                                </div>
                                              </div>
                                              {/* Audio player takes full width with proper controls */}
                                              <audio
                                                controls
                                                src={content}
                                                className="w-full"
                                                style={{ minWidth: "250px" }}
                                              />
                                            </div>
                                          </div>
                                        );
                                      }

                                      // Handle video data URLs
                                      if (content.includes("data:video/")) {
                                        return (
                                          <div className="mt-2 first:mt-0">
                                            <div className="relative group">
                                              <a
                                                href={content}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block"
                                              >
                                                {/* Video with aspect ratio */}
                                                <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-black max-w-full aspect-video">
                                                  <video
                                                    src={content}
                                                    className="w-full h-full object-contain"
                                                    controls
                                                    preload="metadata"
                                                  />
                                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                                                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                                      <Video className="h-8 w-8 text-white" />
                                                    </div>
                                                  </div>
                                                </div>
                                              </a>
                                            </div>
                                          </div>
                                        );
                                      }

                                      // Regular text content
                                      return (
                                        <p className="break-words whitespace-pre-wrap mb-2">
                                          {content}
                                        </p>
                                      );
                                    })()}

                                  {!isSystemMessage && (
                                    <div className="flex items-center justify-end gap-2 mt-2">
                                      <span
                                        className={`text-xs ${isStaffOrAdmin
                                          ? "text-blue-200"
                                          : "text-gray-500"
                                          }`}
                                      >
                                        {formatTime(message.created_at)}
                                      </span>
                                      {isStaffOrAdmin && message.is_read && (
                                        <Check className="h-3 w-3 text-blue-200" />
                                      )}
                                    </div>
                                  )}

                                  {!isStaffOrAdmin && !isSystemMessage && (
                                    <div className="absolute -bottom-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() =>
                                          handleReplyToMessage(message)
                                        }
                                        className="bg-white border border-gray-300 rounded-full p-1.5 shadow-md hover:bg-gray-50 hover:border-gray-400 transition-all"
                                        title="Reply to this message"
                                      >
                                        <Reply className="h-4 w-4 text-gray-600" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {isStaffOrAdmin && (
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span className="text-xs font-medium text-blue-600">
                                      A
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {selectedRoom.status === "closed" ? (
                <div className="p-4 border-t bg-gray-50 text-center text-gray-500 text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <Lock className="h-4 w-4" />
                    This case is closed. You cannot send messages.
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReopenCase}
                    className="mt-2 text-blue-600 hover:text-blue-800"
                  >
                    Reopen case to continue conversation
                  </Button>
                </div>
              ) : (
                <div className="p-4 border-t">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 flex items-end border border-gray-300 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-gray-500 hover:text-gray-700 self-end"
                        title="Attach file"
                      >
                        <ImageIcon className="h-5 w-5" />
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                        className="hidden"
                        onChange={handleImageUpload}
                      />

                      <textarea
                        placeholder={
                          replyingTo
                            ? `Replying to message...`
                            : "Type a message..."
                        }
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="flex-1 px-3 py-3 border-0 outline-none focus:ring-0 resize-none overflow-hidden"
                        rows={1}
                        style={{
                          minHeight: "44px",
                          maxHeight: "120px",
                        }}
                        ref={(el) => {
                          if (el) {
                            // Auto-expand textarea based on content
                            el.style.height = "auto";
                            const newHeight = Math.min(
                              Math.max(el.scrollHeight, 44),
                              120
                            );
                            el.style.height = `${newHeight}px`;
                          }
                        }}
                      />

                      <button
                        type="button"
                        onClick={
                          isRecording
                            ? handleStopRecording
                            : handleStartRecording
                        }
                        className={`p-3 self-end ${isRecording
                          ? "text-red-600 animate-pulse"
                          : "text-gray-500 hover:text-gray-700"
                          }`}
                        className={`p-3 ${isRecording
                          ? "text-red-600 animate-pulse"
                          : "text-gray-500 hover:text-gray-700"
                          }`}
                        title={
                          isRecording
                            ? "Stop recording"
                            : "Record voice message"
                        }
                      >
                        <Mic className="h-5 w-5" />
                      </button>
                    </div>

                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="h-[44px] px-4 self-end"
                    >
                      {replyingTo ? (
                        <>
                          <Reply className="h-4 w-4 mr-2" />
                          Reply
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={isUsersModalOpen}
        onClose={() => setIsUsersModalOpen(false)}
        title="Create New Case"
        size="lg"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search users..."
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg max-h-[400px] overflow-y-auto">
            {users
              .filter(
                (u) =>
                  u.name
                    ?.toLowerCase()
                    .includes(userSearchTerm.toLowerCase()) ||
                  u.email?.toLowerCase().includes(userSearchTerm.toLowerCase())
              )
              .map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                      {u.profile_picture ? (
                        <div className="relative w-full h-full">
                          <SafeImage
                            src={u.profile_picture?.replace(
                              "wss://",
                              "https://"
                            )}
                            alt={u.name || "User"}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                      ) : (
                        <span className="font-medium text-blue-600">
                          {u.name?.charAt(0).toUpperCase() || "U"}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <p className="text-sm text-gray-600">{u.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {u.admin_verified && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                            Verified
                          </span>
                        )}
                        {u.is_active && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button onClick={() => handleCreateCase(u)} size="sm">
                    Open Case
                  </Button>
                </div>
              ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsUsersModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
