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
type ExtendedMessage = Omit<Message, "sender"> & {
  attachments?: {
    id: number;
    file_type: "image" | "audio" | "video" | "document";
    file_url: string;
    file_name?: string;
    file_size?: number;
  }[];
  chat_room?: number;
  sender?: MessageSender | User | number | string | null;
  created_at: string;
  updated_at: string;
  temp_id?: string;
  __temp_id?: string;
  __optimistic?: boolean;
};

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

const getRoomKey = (room: any) =>
  String(room?.room_id ?? room?.chatroom_id ?? room?.id ?? "");

// Check if a room is a feedback room (should not use WebSocket)
const isFeedbackRoom = (room: any) => {
  if (!room) return false;
  const key = String(room.chatroom_id || room.room_id || room.id || "");
  return key.startsWith("feedback-");
};

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



// Ensure room arrays are unique by `id`, `room_id` or `chatroom_id` to avoid duplicates
const uniqRooms = (rooms: ExtendedChatRoom[]) => {
  const seen = new Map<string, ExtendedChatRoom>();
  for (const r of rooms || []) {
    const key = r.id != null
      ? `id:${r.id}`
      : r.room_id
        ? `rid:${r.room_id}`
        : (r as any).chatroom_id
          ? `cid:${(r as any).chatroom_id}`
          : JSON.stringify(r);
    if (!seen.has(key)) seen.set(key, r);
  }
  return Array.from(seen.values());
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
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isSwitchingRoom, setIsSwitchingRoom] = useState(false);
  // When true we are performing a pending->room creation transaction.
  // While creating, no auto-selection, cache restore, or WS connect should occur.
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [lastSelectedRoomId, setLastSelectedRoomId] = useState<number | null>(
    null
  );
  const [feedbacks, setFeedbacks] = useState<any[]>([]);

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

  // Return a stable room key preferring server-provided `room_id` when available.
  const getRoomKey = (room: any) => String(room?.room_id ?? room?.id ?? room?.chatroom_id ?? "");

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

  const asSenderObject = (sender: ExtendedMessage["sender"]) =>
    sender && typeof sender === "object"
      ? (sender as MessageSender | User)
      : null;

  const getMessageType = (message: ExtendedMessage) => {
    const sender = asSenderObject(message.sender);
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
          const messageToClose = messages.find((msg) => {
            const sender = asSenderObject(msg.sender);
            return sender?.id !== 0;
          });
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
  // Helper to determine whether a room is authoritative (exists on server/ws)


  const isRoomAuthoritative = useCallback((room: any) => {
    if (!room) return false;
    const id = Number((room as any).id ?? 0);
    if (id && id > 0) return true;
    try {
      const serverList = Array.isArray((ws as any).chatrooms) ? (ws as any).chatrooms : [];
      return serverList.some((r: any) =>
        String(r.id) === String((room as any).id) ||
        String(r.room_id) === String((room as any).room_id) ||
        String(r.chatroom_id) === String((room as any).chatroom_id)
      );
    } catch {
      return false;
    }
  }, [ws]);

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

    // Fetch users and feedbacks
    const fetchInitial = async () => {
      fetchUsers();

      try {
        const data = await feedbackApi.list({ ordering: '-created_at' } as any);
        if (Array.isArray(data)) {
          setFeedbacks(data); // just store feedbacks for display; no pending rooms
        }
      } catch (e) {
        console.warn('Failed to fetch feedbacks:', e);
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
    if (selectedRoom && (selectedRoom as any).__justCreated) {
      const timer = setTimeout(() => {
        try {
          setSelectedRoom((prev) => prev ? { ...prev, __justCreated: undefined } as any : prev);
        } catch { }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [selectedRoom]);

  useEffect(() => {
    if (selectedRoom && !switchingRoomRef.current) {
      const scrollTimer = setTimeout(() => {
        scrollToBottom();
      }, 300);

      return () => clearTimeout(scrollTimer);
    }
  }, [selectedRoom, scrollToBottom]);

  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const selectedRoomRef = useRef(selectedRoom);
  useEffect(() => { selectedRoomRef.current = selectedRoom; }, [selectedRoom]);

  useEffect(() => {
    try {
      if (Array.isArray(ws.chatrooms)) {
        const incoming = uniqRooms(ws.chatrooms as ExtendedChatRoom[]);
        const prevKeys = chatRooms.map((r) => String(r.room_id ?? r.id)).join(",");
        const newKeys = incoming.map((r) => String(r.room_id ?? r.id)).join(",");
        if (prevKeys !== newKeys) setChatRooms(incoming);

        const newUnreadCounts: Record<string, number> = {};
        ws.chatrooms.forEach((room: any) => {
          try {
            const key = String(room.room_id ?? room.id ?? room.chatroom_id ?? "");
            if (key && room.unread !== undefined) newUnreadCounts[key] = room.unread;
          } catch { }
        });

        const prevUnreadKeys = Object.keys(unreadCounts).map(k => `${k}:${unreadCounts[k]}`).join(",");
        const newUnreadKeys = Object.keys(newUnreadCounts).map(k => `${k}:${newUnreadCounts[k]}`).join(",");
        if (prevUnreadKeys !== newUnreadKeys) setUnreadCounts(newUnreadCounts);
      }
    } catch { }
  }, [ws.chatrooms, chatRooms, unreadCounts, feedbacks]);

  const wsRef = useRef(ws);
  useEffect(() => { wsRef.current = ws; }, [ws]);

  useEffect(() => {
    if (!selectedRoom || switchingRoomRef.current) return;

    // Skip WebSocket sync for feedback rooms
    if (isFeedbackRoom(selectedRoom)) {
      setLoadingMessages(false);
      setMessages([]);
      return;
    }

    const key = String(selectedRoom.room_id ?? selectedRoom.id ?? "");
    let syncAttempts = 0;
    const maxSyncAttempts = 40;
    let syncIntervalId: number | null = null;

    const syncNow = async () => {
      try {
        let wsMessages = wsRef.current?.messages?.[key];
        if (!wsMessages) wsMessages = wsRef.current?.messages?.[String(selectedRoom?.id)];
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
          if (syncIntervalId !== null) clearInterval(syncIntervalId);
          setLoadingMessages(true);

          const formattedMessages: ExtendedMessage[] = wsMessages.map((msg: any) => {
            let senderInfo: MessageSender = { id: 0, name: "Unknown", email: null, profile_picture: null };
            if (typeof msg.sender === "string") {
              senderInfo.name = msg.sender;
              senderInfo.email = msg.email || null;
            } else if (msg.sender && typeof msg.sender === "object") {
              senderInfo = { ...senderInfo, ...msg.sender };
            }
            const isStaffOrAdmin = msg.email === user?.email || (msg.sender && typeof msg.sender === "string" && msg.sender === user?.name);

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
          });

          // merge messages with existing
          const existing = messagesRef.current || [];
          const msgMap = new Map<number | string, ExtendedMessage>();
          existing.forEach(m => {
            const senderObj = asSenderObject(m.sender);
            msgMap.set(m.id || `${senderObj?.id}_${m.created_at}`, m);
          });
          formattedMessages.forEach(incoming => {
            const senderObj = asSenderObject(incoming.sender);
            const key = incoming.id || `${senderObj?.id}_${incoming.created_at}`;
            msgMap.set(key, incoming);
          });
          const merged = Array.from(msgMap.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          setMessages(merged);

          if (formattedMessages.length > 0) {
            try { await wsRef.current?.markAsRead?.(key); } catch { }
            setUnreadCounts(prev => ({ ...prev, [getRoomKey(selectedRoom)]: 0 }));
          }

          setLoadingMessages(false);
          return;
        }

        syncAttempts++;
        if (syncAttempts === 1) {
          try { await wsRef.current?.connectToRoom?.(key); } catch { }
        }

        if (syncAttempts >= maxSyncAttempts && syncIntervalId !== null) {
          clearInterval(syncIntervalId);
          syncIntervalId = null;
          setLoadingMessages(false);
        }

      } catch (e) {
        console.error("Error syncing messages:", e);
      }
    };

    syncNow();
    syncIntervalId = window.setInterval(syncNow, 200);
    return () => { if (syncIntervalId !== null) clearInterval(syncIntervalId); };

  }, [selectedRoom?.room_id, selectedRoom?.id, selectedRoom, user?.email, user?.name, ws.lastUpdateTime]);

  useEffect(() => {
    if (selectedRoom && messages.length > 0) {
      try {
        const messagesToSave = messages.filter(m =>
          String(m.room ?? m.chat_room) === getRoomKey(selectedRoom) &&
          !(typeof m.id === "number" && m.id > 1000000000000) &&
          !(m as any).__optimistic
        );
        if (messagesToSave.length > 0) {
          localStorage.setItem(`chat_messages_${getRoomKey(selectedRoom)}`, JSON.stringify(messagesToSave));
        }
      } catch { }
    }
  }, [selectedRoom, messages]);

  useEffect(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("chat_messages_")) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || "[]");
          const messageTime = data[0]?.timestamp ? new Date(data[0].timestamp).getTime() : 0;
          if (messageTime && messageTime < oneDayAgo) localStorage.removeItem(key);
        } catch { }
      }
    });
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await usersApi.list();
      setUsers(data as ExtendedUser[]);
      setLoading(false);
    } catch {
      setError("Failed to load users");
      setLoading(false);
    }
  };


  const handleCreateCase = useCallback(
    async (
      selectedUser: ExtendedUser,
      initialMessage?: string
    ): Promise<ExtendedChatRoom | null> => {
      if (!selectedUser?.email) {
        alert("User must have an email");
        return null;
      }

      try {
        // 1️⃣ Fetch or create the room from the server by email
        const room = await chatRoomsApi.getByEmail(selectedUser.email);

        if (!room || !(room.id || room.room_id || room.chatroom_id)) {
          alert("Server did not return a valid room");
          return null;
        }

        const roomKey = String(room.room_id ?? room.id ?? room.chatroom_id ?? "");

        // 2️⃣ Build extended room object for local UI
        const extendedRoom: ExtendedChatRoom = {
          ...room,
          messages: undefined, // Clear any server messages - we'll load them separately
          status: "open",
          unread: 0,
          other_user_name: selectedUser.name,
          other_user_avatar: selectedUser.profile_picture,
        };

        // 3️⃣ Inject room locally
        setChatRooms((prev) => uniqRooms([extendedRoom, ...prev]));
        setSelectedRoom(extendedRoom);

        // 4️⃣ Refresh WS chatrooms list (optional)
        try {
          ws.connectToChatroomsList();
        } catch { }

        // 5️⃣ Connect to room via WebSocket and wait for it to establish
        try {
          await ws.connectToRoom(roomKey);
          // Give WS a moment to establish connection
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.warn("Failed to connect to room WS, continuing anyway", err);
        }

        // 6️⃣ Send initial message if provided (works for both new and existing rooms)
        if (initialMessage) {
          const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          let messageSent = false;

          // Try WS first
          try {
            await ws.sendMessage(roomKey, initialMessage, tempId);
            console.log("Message sent via WS (room may be new or existing)");
            messageSent = true;
            // Wait a bit for WS to process and echo back
            await new Promise(resolve => setTimeout(resolve, 800));
          } catch (wsErr) {
            console.warn("WS send failed, trying REST fallback", wsErr);
          }

          // Fallback to REST if WS fails
          if (!messageSent) {
            try {
              if (room.id) {
                await chatRoomsApi.sendMessage(room.id, initialMessage);
                console.log("Message sent via REST (room may be new or existing)");
                // Wait for server to process
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } catch (restErr) {
              console.error("Both WS and REST send failed", restErr);
            }
          }
        }

        return extendedRoom;
      } catch (err) {
        console.error("Failed to create chat case:", err);
        return null;
      }
    }, [ws]);
  const handleSelectRoom = useCallback(
    async (roomOrUser: ExtendedChatRoom | ExtendedUser) => {
      // If we're already creating a room or switching, do nothing
      if (isCreatingRoom || switchingRoomRef.current) return;

      switchingRoomRef.current = true;
      setIsCreatingRoom(true);
      setLoadingMessages(true);
      setReplyingTo(null);

      let room: ExtendedChatRoom | null = null;
      let isNewCase = false;

      // 1️⃣ If a user object is passed instead of a room, create a new case
      if ("email" in roomOrUser) {
        isNewCase = true;
        // Extract the initial message and feedback ID if attached
        const initialMessage = (roomOrUser as any).__initialMessage || undefined;
        const feedbackId = (roomOrUser as any).__feedbackId;

        room = await handleCreateCase(roomOrUser, initialMessage);
        if (!room) {
          switchingRoomRef.current = false;
          setIsCreatingRoom(false);
          setLoadingMessages(false);
          return;
        }

        // Delete the feedback after successful room creation
        if (feedbackId) {
          try {
            await feedbackApi.delete(feedbackId);
            // Remove from local state
            setFeedbacks(prev => prev.filter(fb => fb.id !== feedbackId));
            console.log(`Feedback ${feedbackId} deleted after room creation`);
          } catch (error) {
            console.error("Failed to delete feedback:", error);
          }
        }

        // Wait longer for new cases to ensure messages are synced
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        // 2️⃣ Room object — just select it
        isNewCase = false;
        room = roomOrUser;
        setSelectedRoom(room);
        setMessages([]); // Only clear for existing rooms

        // Only connect to WebSocket for non-feedback rooms
        if (!isFeedbackRoom(room)) {
          const roomKey = getRoomKey(room);
          try {
            await ws.connectToRoom(roomKey);
            await ws.markAsRead(roomKey);
          } catch (err) {
            console.warn("WS connect/markAsRead failed:", err);
          }
        }
      }

      // 3️⃣ Update local state
      setSelectedRoom(room);
      setLastSelectedRoomId(room.id);
      setIsCreatingRoom(false);
      switchingRoomRef.current = false;

      // Don't clear loading yet - let the message sync effect handle it
      // setLoadingMessages(false);

      // Optional: scroll to bottom after short delay
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    },
    [ws, isCreatingRoom, handleCreateCase]
  );






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

      // Send via websocket with REST fallback
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
        // REST fallback if numeric id is available
        try {
          if (selectedRoom && selectedRoom.id) {
            await chatRoomsApi.sendMessage(selectedRoom.id, messageText);

            // Update UI similar to websocket success
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
          } else {
            throw err;
          }
        } catch (restErr) {
          console.error('Fallback REST send failed', restErr);
          alert('Failed to send message. Please try again.');
        }
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
    const roomKey = String(selectedRoom.room_id ?? selectedRoom.id ?? "");

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

  const getUnreadCount = useCallback((roomKeyOrId: any) => {
    return unreadCounts[String(roomKeyOrId)] || 0;
  }, [unreadCounts]);


  const getFilteredChatRooms = useCallback(() => {
    let filtered = [...chatRooms]; // just the real rooms now

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((room) =>
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
      filtered = filtered.filter((room) => getUnreadCount(getRoomKey(room)) > 0);
    } else if (filterOption === "Recent") {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      filtered = filtered.filter(
        (room) => room.updated_at && new Date(room.updated_at) > oneDayAgo
      );
    }
    return filtered;
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
        (k) => k === String(selectedRoom?.id) || k === selectedRoom?.room_id || k === String(selectedRoom?.chatroom_id)
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
                m?.chatroom_id === selectedRoom?.chatroom_id
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
  }, [selectedRoom?.id, selectedRoom?.chatroom_id, selectedRoom?.room_id, messages.length, ws]);

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
                  const unreadCount = getUnreadCount(getRoomKey(room));
                  const avatarInfo = getAvatarForRoom(room);
                  const displayName = getRoomDisplayName(room);
                  const updatedTime = getRoomUpdatedTime(room);

                  return (
                    <div
                      key={room?.id || room?.room_id}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isActive ? "bg-blue-50" : ""
                        } ${isClosed ? "opacity-75" : ""}`}
                      onClick={() => {
                        try {
                          handleSelectRoom(room);
                        } catch (e) {
                          console.error('Failed to handle room click', e);
                        }
                      }}
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
              <span className="w-full flex items-center justify-between">
                <span>Make Case</span>
                {feedbacks && feedbacks.filter((fb: any) => fb.rating > 5).length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    {feedbacks.filter((fb: any) => fb.rating > 5).length}
                  </span>
                )}
              </span>
            </Button>
          </div>
        </div>

        <div className="w-[65%] bg-white rounded-lg shadow flex flex-col">
          {isCreatingRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <h3 className="text-lg font-medium mb-2">Creating support chat…</h3>
              <p>Please wait while we create the conversation.</p>
            </div>
          ) : ((selectedRoom && isRoomAuthoritative(selectedRoom)) || (selectedRoom && (selectedRoom as any).__justCreated)) ? (
            <div key={`chat-${selectedRoom.id ?? selectedRoom.room_id ?? 'temp'}`} className="flex flex-col h-full">
              <div className="p-4 border-b flex items-center justify-between bg-gray-50 flex-none">
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
                      disabled
                      aria-disabled
                      title="Delete is disabled"
                    // onClick={async () => {
                    //   if (
                    //     window.confirm(
                    //       `Are you sure you want to permanently delete "${selectedRoom.name}"? This action cannot be undone.`
                    //     )
                    //   ) {
                    //     try {
                    //       await chatRoomsApi.delete(selectedRoom.id);
                    //       setChatRooms((prev) =>
                    //         prev.filter((room) => room.id !== selectedRoom.id)
                    //       );
                    //       setSelectedRoom(null);
                    //       setReplyingTo(null);
                    //     } catch (error) {
                    //       console.error("Error deleting chat room:", error);
                    //       alert("Failed to delete chat room");
                    //     }
                    //   }
                    // }}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                {(isSwitchingRoom || loadingMessages) && messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <MessageSquare className="h-16 w-16 mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium mb-2">
                      No messages yet
                    </h3>
                    <p>Send the first message to start the conversation</p>
                  </div>
                ) : (
                  <div className="p-4">
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
                          const senderObject = asSenderObject(message.sender);
                          const isSystemMessage = senderObject?.id === 0;
                          const isStaffOrAdmin =
                            senderObject?.email === user?.email;
                          const senderAvatar = selectedRoom.other_user_avatar;
                          const senderInitial =
                            senderObject?.name?.charAt(0)?.toUpperCase() || "U";
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
                                          alt={senderObject?.name || "User"}
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
                                      {senderObject
                                        ? senderObject.name || senderObject.email
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
                <div className="p-4 border-t bg-gray-50 text-center text-gray-500 text-sm flex-none">
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
                <div className="p-4 border-t mt-auto bg-white flex-none">
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
                        disabled={isSwitchingRoom || (selectedRoom as any)?.is_pending_request}
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
                      disabled={!newMessage.trim() || isSwitchingRoom || (selectedRoom as any)?.is_pending_request}
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
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <MessageSquare className="h-16 w-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No chat selected</h3>
              <p>Select a chat room to start messaging</p>
            </div>
          )}
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
              {/* Show feedbacks with rating > 5 first */}
              {feedbacks
                .filter((fb: any) => fb.rating > 5)
                .filter((fb: any) => {
                  const searchLower = userSearchTerm.toLowerCase();
                  const userName = fb.user?.name?.toLowerCase() || '';
                  const userEmail = fb.user?.email?.toLowerCase() || '';
                  const message = fb.message?.toLowerCase() || '';
                  const subject = fb.subject?.toLowerCase() || '';
                  return userName.includes(searchLower) ||
                    userEmail.includes(searchLower) ||
                    message.includes(searchLower) ||
                    subject.includes(searchLower);
                })
                .map((fb: any) => {
                  // Get user ID from feedback (could be object or number)
                  const userId = typeof fb.user === 'object' ? fb.user?.id : fb.user;

                  // Find the actual user from the users list
                  const actualUser = users.find((u) => u.id === userId);
                  if (!actualUser?.email) return null;

                  return (
                    <div
                      key={`feedback-${fb.id}`}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 border-b bg-yellow-50"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center overflow-hidden">
                          {actualUser.profile_picture ? (
                            <div className="relative w-full h-full">
                              <SafeImage
                                src={actualUser.profile_picture?.replace(
                                  "wss://",
                                  "https://"
                                )}
                                alt={actualUser.name || "User"}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            </div>
                          ) : (
                            <span className="font-medium text-yellow-600">
                              {actualUser.name?.charAt(0).toUpperCase() || "F"}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{actualUser.name}</p>
                            <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded font-medium">
                              New Request
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{actualUser.email}</p>
                          <p className="text-sm text-gray-700 mt-1 truncate max-w-md">
                            {(fb.message || fb.subject || 'Request received').length > 100
                              ? `${(fb.message || fb.subject || 'Request received').substring(0, 100)}...`
                              : (fb.message || fb.subject || 'Request received')}
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={async () => {
                          // Create a user object with the feedback message attached
                          const userWithMessage = {
                            ...actualUser,
                            __initialMessage: `Request: ${fb.message || fb.subject || 'User request'}`,
                            __feedbackId: fb.id // Store feedback ID for deletion
                          } as any;
                          setIsUsersModalOpen(false);
                          // Use handleSelectRoom which manages all state properly
                          await handleSelectRoom(userWithMessage);
                        }}
                        size="sm"
                        className="bg-yellow-600 hover:bg-yellow-700"
                      >
                        Open Case
                      </Button>
                    </div>
                  );
                })}

              {/* Show regular users */}
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

                    <Button
                      onClick={async () => {
                        setIsUsersModalOpen(false);
                        await handleSelectRoom(u);
                      }}
                      size="sm"
                    >
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
      </div>
    </Layout>
  );
}
