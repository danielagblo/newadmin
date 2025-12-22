import { apiClient } from "./apiClient";
import { endpoints } from "./endpoints";

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

// Chatroom helpers
export const resolveChatroomId = async (params?: Record<string, unknown>) => {
  // Some backends expect the user id as a path parameter (e.g. /chatroomid/19/)
  if (
    params &&
    Object.prototype.hasOwnProperty.call(params, "user_id") &&
    params.user_id != null
  ) {
    const uid = encodeURIComponent(String((params as any).user_id));
    return apiClient.get<{ room_id: string }>(
      endpoints.chat.resolveChatroomId() + `${uid}/`
    );
  }

  return apiClient.get<{ room_id: string }>(
    endpoints.chat.resolveChatroomId() +
      (params ? `?${new URLSearchParams(params as any).toString()}` : "")
  );
};

export const listChatRooms = async (): Promise<ChatRoom[]> =>
  apiClient.get<ChatRoom[]>(endpoints.chat.chatrooms());

export const getChatRoom = async (id: number | string): Promise<ChatRoom> =>
  apiClient.get<ChatRoom>(endpoints.chat.chatroomDetail(id));

export const markChatRoomRead = async (id: number | string) =>
  apiClient.post(endpoints.chat.chatroomMarkRead(id), {});

export const getChatRoomMessages = async (
  id: number | string
): Promise<Message[]> =>
  apiClient.get<Message[]>(endpoints.chat.chatroomMessages(id));

// Create a chatroom. Payload depends on backend; send minimal object and allow caller to include participants or initial message.
export const createChatRoom = async (body: Record<string, unknown>) =>
  apiClient.post<ChatRoom>(endpoints.chat.chatrooms(), body);

// Messages
export const listMessages = async (): Promise<Message[]> =>
  apiClient.get<Message[]>(endpoints.chat.messages());

export const getMessage = async (id: number | string): Promise<Message> =>
  apiClient.get<Message>(endpoints.chat.messageDetail(id));

// Send message to chatroom via REST fallback
export const sendMessageToRoom = async (
  roomId: number | string,
  body: { content: string; extra?: Record<string, unknown> }
) => apiClient.post(endpoints.chat.chatroomSend(roomId), body);

const actions = {
  resolveChatroomId,
  listChatRooms,
  getChatRoom,
  markChatRoomRead,
  getChatRoomMessages,
  listMessages,
  getMessage,
  sendMessageToRoom,
  createChatRoom,
};
export default actions;
