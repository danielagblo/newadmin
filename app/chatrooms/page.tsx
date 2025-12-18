"use client";

import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { chatRoomsApi } from "@/lib/api/chats";
import { usersApi } from "@/lib/api/users";
import { ChatRoom, Message, User } from "@/lib/types";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import {
  Search,
  Plus,
  ChevronLeft,
  MessageSquare,
  Users,
  Mic,
  Image as ImageIcon,
  Send,
  X,
  Check,
  RefreshCw,
  User as UserIcon,
  Lock,
  Unlock,
  Video,
  File,
} from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";

// Extended types to handle missing properties
type ExtendedChatRoom = ChatRoom & {
  status?: "open" | "closed";
  last_message?: string;
  updated_at?: string;
  messages?: ExtendedMessage[];
  profile_picture?: string | null;
};

type ExtendedUser = User & {
  profile_picture?: string | null;
};

type ExtendedMessage = Message & {
  attachments?: Array<{
    id: number;
    file_type: "image" | "audio" | "video" | "document";
    file_url: string;
    file_name?: string;
    file_size?: number;
  }>;
  chat_room?: number;
  sender?: ExtendedUser;
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
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [filterOption, setFilterOption] = useState("All");
  const [openFilter, setOpenFilter] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetchChatRooms();
    fetchUsers();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize unread counts from chat rooms
    const initialUnreadCounts: Record<number, number> = {};
    chatRooms.forEach((room) => {
      initialUnreadCounts[room.id] = room.total_unread || 0;
    });
    setUnreadCounts(initialUnreadCounts);
  }, [chatRooms]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchUsers = async () => {
    try {
      const data = await usersApi.list();
      setUsers(data as ExtendedUser[]);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchChatRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        ordering: "-updated_at",
      };

      const data = await chatRoomsApi.list(params);
      setChatRooms((Array.isArray(data) ? data : []) as ExtendedChatRoom[]);
    } catch (error: any) {
      console.error("Error fetching chat rooms:", error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.message ||
        "Failed to fetch chat rooms";
      setError(errorMessage);
      setChatRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (roomId: number) => {
    if (!roomId) return;

    setLoadingMessages(true);
    try {
      const data = await chatRoomsApi.getMessages(roomId);
      setMessages(data as ExtendedMessage[]);

      // Mark messages as read when opening the room
      setUnreadCounts((prev) => ({
        ...prev,
        [roomId]: 0,
      }));
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleCreateCase = async (user: ExtendedUser) => {
    try {
      // Create a new chat room for the selected user
      const roomId =
        typeof crypto !== "undefined" &&
        typeof (crypto as any).randomUUID === "function"
          ? (crypto as any).randomUUID()
          : undefined;

      const roomPayload: any = {
        name: `${user.name} - Support Case`,
        is_group: false,
        members: [user.id],
      };

      if (roomId) roomPayload.room_id = roomId;

      // Create the chat room via API
      const newRoom = await chatRoomsApi.create(roomPayload);

      // Add the new room to the chat rooms list
      const extendedRoom: ExtendedChatRoom = {
        ...newRoom,
        status: "open",
        last_message: "Case opened by support agent.",
        updated_at: new Date().toISOString(),
        messages: [],
        profile_picture: user.profile_picture,
        members: [user],
      };

      // Add to chat rooms list and select it
      setChatRooms((prev) => [extendedRoom, ...prev]);
      setSelectedRoom(extendedRoom);

      // Create initial system message
      const systemMessage: ExtendedMessage = {
        id: Date.now(),
        content: "Case opened by support agent.",
        sender: {
          id: 0,
          name: "System",
          email: "system@example.com",
        } as ExtendedUser,
        chat_room: extendedRoom.id,
        is_read: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setMessages([systemMessage]);
      setIsUsersModalOpen(false);
    } catch (error: any) {
      console.error("Error creating case:", error);
      alert(error.response?.data?.detail || "Failed to create case");
    }
  };

  const handleSelectRoom = async (room: ExtendedChatRoom) => {
    setSelectedRoom(room);
    await fetchMessages(room.id);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || selectedRoom.status === "closed")
      return;

    try {
      const message = {
        content: newMessage.trim(),
        chat_room: selectedRoom.id,
      };

      // Send message API call would go here
      console.log("Sending message:", message);

      // For now, simulate adding message
      const tempMessage: ExtendedMessage = {
        id: Date.now(),
        content: newMessage.trim(),
        sender: {
          id: 1,
          name: "Current User",
          email: "user@example.com",
        } as ExtendedUser,
        chat_room: selectedRoom.id,
        is_read: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempMessage]);

      // Update the chat room's last message
      setChatRooms((prev) =>
        prev.map((room) =>
          room.id === selectedRoom.id
            ? {
                ...room,
                last_message: newMessage.trim(),
                updated_at: new Date().toISOString(),
              }
            : room
        )
      );

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom || selectedRoom.status === "closed") return;

    try {
      // Create a preview URL for the file
      const previewUrl = URL.createObjectURL(file);
      const fileType = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
        ? "audio"
        : "image";

      // Create message with attachment
      const messageWithAttachment: ExtendedMessage = {
        id: Date.now(),
        content: "",
        sender: {
          id: 1,
          name: "Current User",
          email: "user@example.com",
        } as ExtendedUser,
        chat_room: selectedRoom.id,
        is_read: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        attachments: [
          {
            id: Date.now(),
            file_type: fileType,
            file_url: previewUrl,
            file_name: file.name,
            file_size: file.size,
          },
        ],
      };

      setMessages((prev) => [...prev, messageWithAttachment]);

      // Update the chat room's last message
      const lastMessage =
        fileType === "image"
          ? "📷 Image"
          : fileType === "video"
          ? "🎥 Video"
          : "🎵 Audio";
      setChatRooms((prev) =>
        prev.map((room) =>
          room.id === selectedRoom.id
            ? {
                ...room,
                last_message: lastMessage,
                updated_at: new Date().toISOString(),
              }
            : room
        )
      );

      e.target.value = "";
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file");
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

        // Create audio message
        const audioMessage: ExtendedMessage = {
          id: Date.now(),
          content: "",
          sender: {
            id: 1,
            name: "Current User",
            email: "user@example.com",
          } as ExtendedUser,
          chat_room: selectedRoom.id,
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

        setMessages((prev) => [...prev, audioMessage]);

        // Update the chat room's last message
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

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const handleStopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleCloseCase = async () => {
    if (!selectedRoom) return;

    if (
      window.confirm(
        `Are you sure you want to close "${selectedRoom.name}"? This will archive the conversation.`
      )
    ) {
      try {
        // Update selected room locally
        setSelectedRoom((prev) =>
          prev ? { ...prev, status: "closed" } : null
        );

        // Update chat rooms list
        setChatRooms((prev) =>
          prev.map((room) =>
            room.id === selectedRoom.id ? { ...room, status: "closed" } : room
          )
        );

        // Add system message
        const systemMessage: ExtendedMessage = {
          id: Date.now(),
          content: "Case closed by support agent.",
          sender: {
            id: 0,
            name: "System",
            email: "system@example.com",
          } as ExtendedUser,
          chat_room: selectedRoom.id,
          is_read: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, systemMessage]);
      } catch (error) {
        console.error("Error closing case:", error);
        alert("Failed to close case. Please try again.");
      }
    }
  };

  const handleReopenCase = async () => {
    if (!selectedRoom) return;

    if (
      window.confirm(`Are you sure you want to reopen "${selectedRoom.name}"?`)
    ) {
      try {
        // Update selected room locally
        setSelectedRoom((prev) => (prev ? { ...prev, status: "open" } : null));

        // Update chat rooms list
        setChatRooms((prev) =>
          prev.map((room) =>
            room.id === selectedRoom.id ? { ...room, status: "open" } : room
          )
        );

        // Add system message
        const systemMessage: ExtendedMessage = {
          id: Date.now(),
          content: "Case reopened by support agent.",
          sender: {
            id: 0,
            name: "System",
            email: "system@example.com",
          } as ExtendedUser,
          chat_room: selectedRoom.id,
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

  const groupMessagesByDate = (messages: ExtendedMessage[]) => {
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
  };

  // Frontend search filter
  const getFilteredChatRooms = () => {
    let filtered = [...chatRooms];

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (room) =>
          room.name.toLowerCase().includes(term) ||
          room.members?.some((member) => {
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

    // Apply status filter
    if (filterOption === "Open") {
      filtered = filtered.filter((room) => room.status !== "closed");
    } else if (filterOption === "Closed") {
      filtered = filtered.filter((room) => room.status === "closed");
    } else if (filterOption === "Unread") {
      filtered = filtered.filter((room) => (unreadCounts[room.id] || 0) > 0);
    } else if (filterOption === "Recent") {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      filtered = filtered.filter(
        (room) => room.updated_at && new Date(room.updated_at) > oneDayAgo
      );
    }

    return filtered;
  };

  const getUnreadCount = (roomId: number) => {
    return unreadCounts[roomId] || 0;
  };

  const getLastMessage = (room: ExtendedChatRoom) => {
    if (room.last_message) {
      return room.last_message;
    }
    return "No messages yet";
  };

  const getAvatarForRoom = (room: ExtendedChatRoom) => {
    if (room.is_group) {
      return { type: "icon" as const, icon: Users };
    }

    // For direct messages, try to get the other user's profile picture
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
    return room.name;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  // Helper function to get room updated_at or fallback to created_at
  const getRoomUpdatedTime = (room: ExtendedChatRoom) => {
    return room.updated_at || room.created_at || "";
  };

  // Helper to get file icon based on type
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

  return (
    <Layout>
      <div className="flex h-[calc(100vh-80px)] gap-4 p-4">
        {/* Left Panel - Chat Rooms List */}
        <div className="w-[35%] bg-white rounded-lg shadow flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Chat Rooms
              </h2>
              <div className="flex gap-2">
                <Button
                  onClick={fetchChatRooms}
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

            {/* Search Box */}
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

            {/* Filter Dropdown */}
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
                    className={`h-4 w-4 transition-transform duration-200 ${
                      openFilter ? "-rotate-90" : ""
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
                        className={`w-full px-4 py-2 text-left hover:bg-gray-50 text-sm ${
                          filterOption === option
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

          {/* Chat Rooms List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-600">{error}</div>
            ) : getFilteredChatRooms().length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchTerm
                  ? "No chat rooms found matching your search"
                  : "No chat rooms found"}
              </div>
            ) : (
              <div className="divide-y">
                {getFilteredChatRooms().map((room) => {
                  const isActive = selectedRoom?.id === room.id;
                  const isClosed = room.status === "closed";
                  const lastMessage = getLastMessage(room);
                  const unreadCount = getUnreadCount(room.id);
                  const avatarInfo = getAvatarForRoom(room);
                  const displayName = getRoomDisplayName(room);
                  const updatedTime = getRoomUpdatedTime(room);

                  return (
                    <div
                      key={room.id}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        isActive ? "bg-blue-50" : ""
                      } ${isClosed ? "opacity-75" : ""}`}
                      onClick={() => handleSelectRoom(room)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar with status */}
                        <div className="relative flex-shrink-0">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              isClosed ? "bg-gray-100" : "bg-blue-100"
                            }`}
                          >
                            {avatarInfo.type === "image" ? (
                              <div className="relative w-full h-full">
                                <Image
                                  src={avatarInfo.url}
                                  alt={displayName}
                                  fill
                                  className="rounded-full object-cover"
                                  sizes="48px"
                                />
                              </div>
                            ) : (
                              <avatarInfo.icon
                                className={`h-6 w-6 ${
                                  isClosed ? "text-gray-400" : "text-blue-600"
                                }`}
                              />
                            )}
                          </div>
                          {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {unreadCount}
                            </span>
                          )}
                        </div>

                        {/* Room info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900 truncate">
                                {displayName}
                              </h3>
                              {isClosed && (
                                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                                  Closed
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-sm text-gray-600 truncate mt-1">
                            {lastMessage}
                          </p>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {formatTimeDistance(updatedTime)}
                          </span>
                          <div className="flex items-center gap-2 mt-2">
                            {room.is_group && (
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  room.is_group
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
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

          {/* Footer with Make Case button */}
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

        {/* Right Panel - Chat Messages */}
        <div className="w-[65%] bg-white rounded-lg shadow flex flex-col">
          {!selectedRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <MessageSquare className="h-16 w-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Select a chat</h3>
              <p>Choose a conversation from the list to start messaging</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedRoom(null)}
                    className="md:hidden mr-2"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          selectedRoom.status === "closed"
                            ? "bg-gray-100"
                            : "bg-blue-100"
                        }`}
                      >
                        {selectedRoom.is_group ? (
                          <Users
                            className={`h-5 w-5 ${
                              selectedRoom.status === "closed"
                                ? "text-gray-400"
                                : "text-blue-600"
                            }`}
                          />
                        ) : (
                          <UserIcon
                            className={`h-5 w-5 ${
                              selectedRoom.status === "closed"
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
                  {/* Close/Reopen Case Button */}
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

              {/* Messages Container */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {loadingMessages ? (
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
                    {groupMessagesByDate(messages).map((group) => (
                      <div key={group.label} className="mb-6">
                        <div className="flex items-center justify-center my-4">
                          <div className="px-4 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                            {group.label}
                          </div>
                        </div>

                        {group.messages.map((message) => {
                          const isCurrentUser = message.sender?.id === 1;
                          const isSystemMessage = message.sender?.id === 0;
                          const senderAvatar = message.sender?.profile_picture;
                          const senderInitial =
                            message.sender?.name?.charAt(0)?.toUpperCase() ||
                            "U";

                          return (
                            <div
                              key={message.id}
                              className={`flex gap-3 mb-4 ${
                                isCurrentUser ? "justify-end" : ""
                              } ${isSystemMessage ? "justify-center" : ""}`}
                            >
                              {!isCurrentUser && !isSystemMessage && (
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                    {senderAvatar ? (
                                      <div className="relative w-full h-full">
                                        <Image
                                          src={senderAvatar}
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

                              <div
                                className={`${
                                  isSystemMessage ? "max-w-full" : "max-w-[70%]"
                                }`}
                              >
                                {/* Sender name for incoming messages */}
                                {!isCurrentUser && !isSystemMessage && (
                                  <p className="text-xs font-medium text-gray-700 mb-1">
                                    {typeof message.sender === "object"
                                      ? message.sender.name ||
                                        message.sender.email
                                      : `User ${message.sender}`}
                                  </p>
                                )}

                                {/* Message bubble */}
                                <div
                                  className={`px-4 py-2 ${
                                    isCurrentUser
                                      ? "bg-blue-600 text-white rounded-2xl rounded-tr-none"
                                      : isSystemMessage
                                      ? "bg-gray-100 text-gray-700 text-center rounded-lg italic"
                                      : "bg-gray-100 text-gray-900 rounded-2xl rounded-tl-none"
                                  }`}
                                >
                                  {/* Text content */}
                                  {message.content && (
                                    <p className="whitespace-pre-wrap mb-2">
                                      {message.content}
                                    </p>
                                  )}

                                  {/* Attachments - Properly scaled but full size on click */}
                                  {message.attachments &&
                                    message.attachments.map((attachment) => {
                                      const FileIcon = getFileIcon(
                                        attachment.file_type
                                      );

                                      return (
                                        <div
                                          key={attachment.id}
                                          className="mt-2 first:mt-0"
                                        >
                                          {attachment.file_type === "image" && (
                                            <div className="relative group">
                                              <a
                                                href={attachment.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block"
                                              >
                                                <div className="relative w-full max-w-md h-48 md:h-64 rounded-lg overflow-hidden border border-gray-200">
                                                  <Image
                                                    src={attachment.file_url}
                                                    alt={
                                                      attachment.file_name ||
                                                      "Image"
                                                    }
                                                    fill
                                                    className="object-cover hover:scale-105 transition-transform duration-200"
                                                    sizes="(max-width: 768px) 100vw, 50vw"
                                                  />
                                                </div>
                                              </a>
                                              {attachment.file_name && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                  {attachment.file_name}
                                                </p>
                                              )}
                                            </div>
                                          )}

                                          {attachment.file_type === "video" && (
                                            <div className="relative group">
                                              <a
                                                href={attachment.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block"
                                              >
                                                <div className="relative w-full max-w-md h-48 md:h-64 rounded-lg overflow-hidden border border-gray-200 bg-black">
                                                  <video
                                                    src={attachment.file_url}
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
                                              {attachment.file_name && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                  {attachment.file_name}
                                                </p>
                                              )}
                                            </div>
                                          )}

                                          {attachment.file_type === "audio" && (
                                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                              <div className="flex items-center gap-3 mb-2">
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                  <FileIcon className="h-5 w-5 text-blue-600" />
                                                </div>
                                                <div className="flex-1">
                                                  <p className="text-sm font-medium text-gray-900">
                                                    {attachment.file_name ||
                                                      "Voice message"}
                                                  </p>
                                                  {attachment.file_size && (
                                                    <p className="text-xs text-gray-500">
                                                      {(
                                                        attachment.file_size /
                                                        1024 /
                                                        1024
                                                      ).toFixed(2)}{" "}
                                                      MB
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                              <audio
                                                controls
                                                src={attachment.file_url}
                                                className="w-full"
                                              />
                                            </div>
                                          )}

                                          {attachment.file_type ===
                                            "document" && (
                                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                              <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                                  <FileIcon className="h-5 w-5 text-gray-600" />
                                                </div>
                                                <div className="flex-1">
                                                  <p className="text-sm font-medium text-gray-900">
                                                    {attachment.file_name ||
                                                      "Document"}
                                                  </p>
                                                  {attachment.file_size && (
                                                    <p className="text-xs text-gray-500">
                                                      {(
                                                        attachment.file_size /
                                                        1024
                                                      ).toFixed(2)}{" "}
                                                      KB
                                                    </p>
                                                  )}
                                                </div>
                                                <a
                                                  href={attachment.file_url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-blue-600 hover:text-blue-800"
                                                >
                                                  <File className="h-5 w-5" />
                                                </a>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}

                                  {!isSystemMessage && (
                                    <div
                                      className={`flex items-center justify-end gap-2 mt-1 ${
                                        isCurrentUser ? "" : ""
                                      }`}
                                    >
                                      <span
                                        className={`text-xs ${
                                          isCurrentUser
                                            ? "text-blue-200"
                                            : "text-gray-500"
                                        }`}
                                      >
                                        {formatTime(message.created_at)}
                                      </span>
                                      {isCurrentUser && message.is_read && (
                                        <Check className="h-3 w-3 text-blue-200" />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Avatar for outgoing messages */}
                              {isCurrentUser && (
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span className="text-xs font-medium text-blue-600">
                                      U
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

              {/* Message Input */}
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
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center border border-gray-300 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-gray-500 hover:text-gray-700"
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

                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="flex-1 px-2 py-3 border-0 outline-none focus:ring-0"
                      />

                      <button
                        type="button"
                        onClick={
                          isRecording
                            ? handleStopRecording
                            : handleStartRecording
                        }
                        className={`p-3 ${
                          isRecording
                            ? "text-red-600 animate-pulse"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <Mic className="h-5 w-5" />
                      </button>
                    </div>

                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="h-full px-4"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Users Modal for New Chat */}
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
                (user) =>
                  user.name
                    ?.toLowerCase()
                    .includes(userSearchTerm.toLowerCase()) ||
                  user.email
                    ?.toLowerCase()
                    .includes(userSearchTerm.toLowerCase())
              )
              .map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                      {user.profile_picture ? (
                        <div className="relative w-full h-full">
                          <Image
                            src={user.profile_picture}
                            alt={user.name || "User"}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                      ) : (
                        <span className="font-medium text-blue-600">
                          {user.name?.charAt(0).toUpperCase() || "U"}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {user.admin_verified && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                            Verified
                          </span>
                        )}
                        {user.is_active && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button onClick={() => handleCreateCase(user)} size="sm">
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
