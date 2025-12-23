import { ChatRoom, Message, PaginatedResponse } from "../types";
import apiClient from "./config";

export const chatRoomsApi = {
  list: async (params?: {
    ordering?: string;
    search?: string;
  }): Promise<ChatRoom[]> => {
    const response = await apiClient.get<
      ChatRoom[] | PaginatedResponse<ChatRoom>
    >("/chatrooms/", { params });

    // Handle array response
    if (Array.isArray(response.data)) {
      return response.data;
    }

    // Handle paginated response
    const paginatedData = response.data as PaginatedResponse<ChatRoom>;
    if (paginatedData.results && Array.isArray(paginatedData.results)) {
      return paginatedData.results;
    }

    return [];
  },

  get: async (id: number): Promise<ChatRoom> => {
    const response = await apiClient.get<ChatRoom>(`/chatrooms/${id}/`);
    return response.data;
  },

  create: async (data: {
    name: string;
    email?: string;
    is_group: boolean;
    room_id: string; // optional client-provided UUID
  }): Promise<ChatRoom> => {
    const response = await apiClient.post<ChatRoom>("/chatrooms/", data);
    return response.data;
  },

  /**
   * Retrieve or create a chatroom by user email using the chatroomid endpoint.
   * Expected endpoint: GET /chatroomid/?email=someone%40example.com
   */
  getByEmail: async (email: string): Promise<ChatRoom> => {
    const response = await apiClient.get<ChatRoom>(`/chatroomid/`, {
      params: { email },
    });
    return response.data;
  },

  update: async (
    id: number,
    data: {
      name?: string;
      is_group?: boolean;
      members?: number[]; // Array of user IDs
    }
  ): Promise<ChatRoom> => {
    const response = await apiClient.put<ChatRoom>(`/chatrooms/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/chatrooms/${id}/`);
  },

  getMessages: async (id: number): Promise<Message[]> => {
    const response = await apiClient.get<Message[]>(
      `/chatrooms/${id}/messages/`
    );
    return response.data;
  },

  sendMessage: async (id: number, content: string): Promise<Message> => {
    const response = await apiClient.post<Message>(`/chatrooms/${id}/send/`, {
      message: content,
    });
    return response.data;
  },

  markRead: async (id: number): Promise<{ status: string }> => {
    const response = await apiClient.post<{ status: string }>(
      `/chatrooms/${id}/mark-read/`
    );
    return response.data;
  },
};

export const messagesApi = {
  list: async (room?: number): Promise<Message[]> => {
    const params = room ? { room } : {};
    const response = await apiClient.get<Message[]>("/messages/", { params });

    const data = response.data as any;

    // If the API returned a raw array, return it
    if (Array.isArray(data)) {
      return data as Message[];
    }

    // If the API returned a paginated object, return its results
    if (data && typeof data === "object" && Array.isArray(data.results)) {
      return data.results as Message[];
    }

    // Unexpected response (HTML debug page, string, etc.) — throw so caller can fallback
    throw new Error("Unexpected messages list response");
  },

  get: async (id: number): Promise<Message> => {
    const response = await apiClient.get<Message>(`/messages/${id}/`);
    return response.data;
  },

  /**
   * Reply to a message by sending to its room. If the original message has no room,
   * create a direct chatroom with the original sender and send the message there.
   */
  replyToMessage: async (
    messageId: number,
    content: string
  ): Promise<Message> => {
    // fetch the message to learn its room or sender
    const original = await apiClient.get<Message>(`/messages/${messageId}/`);
    const msg = original.data;

    if (msg.room) {
      // send to the existing room
      const sent = await chatRoomsApi.sendMessage(msg.room as number, content);
      return sent;
    }

    // If no room, create a direct chatroom with the sender
    const senderId = (msg.sender as any)?.id;
    if (!senderId)
      throw new Error("Original message has no sender id to reply to");

    const room = await chatRoomsApi.create({
      name: "",
      is_group: false,
      room_id: "",
    });
    const sent = await chatRoomsApi.sendMessage(room.id, content);
    return sent;
  },

  /**
   * Close a support message/case. Uses a POST to the server-side close endpoint if available.
   * Endpoint: POST /messages/{id}/close/
   */
  close: async (id: number): Promise<any> => {
    const resp = await apiClient.post(`/messages/${id}/close/`);
    return resp.data;
  },
};
