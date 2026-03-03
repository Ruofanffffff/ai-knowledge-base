import { api } from './api';
import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
  id: string | number;
  fromMe: boolean;
  text: string;
  timestamp: number;
  type?: 'text' | 'photo' | 'note';
  photoUrls?: string[];
  noteData?: { id: string; title: string; cover: string; tags: string[]; excerpt: string };
  replyTo?: { text: string; fromMe: boolean };
  sender_avatar?: string;
}

export interface Conversation {
  id: number;
  other_user_id: number;
  other_username: string;
  other_avatar: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  messages: ChatMessage[]; // Added to match frontend expectation
}

let socket: Socket | null = null;
let currentUserId: number | null = null;

// Helper to get current user ID (decoded from token or stored)
function getCurrentUserId(): number {
  if (currentUserId) return currentUserId;
  const userInfo = localStorage.getItem('user_info');
  if (userInfo) {
    try {
      const user = JSON.parse(userInfo);
      currentUserId = user.id;
      return user.id;
    } catch (e) { console.error(e); }
  }
  return 0;
}

export const chatService = {
  connect() {
    const userId = getCurrentUserId();
    if (!userId) return;

    if (!socket) {
      // Connect to the same host as API
      // If api.defaults.baseURL is full URL, parse it.
      // If relative, use window.location.origin
      let url = api.defaults.baseURL || '';
      if (url.startsWith('http')) {
        const u = new URL(url);
        url = u.origin;
      } else {
        url = window.location.origin;
      }

      socket = io(url);
      
      socket.on('connect', () => {
        console.log('Socket connected');
        socket?.emit('join', userId);
      });

      socket.on('message', (msg: any) => {
        // Dispatch event for UI to update
        window.dispatchEvent(new CustomEvent('hibrain_dm_new_message', { detail: msg }));
      });
    }
    return socket;
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  async getConversations() {
    const { data } = await api.get('/conversations');
    // Map backend response to frontend Conversation interface
    // Note: Backend returns list of convs, but frontend expects full structure. 
    // We might need to fetch messages for each if we want to fully replicate 'getAllConversations' 
    // but for performance, we should only fetch list and last message.
    // However, the frontend 'Messages.tsx' uses `conv.messages` length and last message.
    // We will adapt the frontend to use the simplified object, OR we map it here.
    
    return data.data.map((c: any) => ({
      id: c.id,
      userId: String(c.other_user_id), // Frontend uses 'userId' key for the other person
      other_username: c.other_username,
      other_avatar: c.other_avatar,
      messages: c.last_message ? [{
        id: 'latest',
        text: c.last_message,
        timestamp: new Date(c.last_message_time).getTime(),
        fromMe: false // We don't know easily without parsing, assuming false or checking sender
      }] : []
    }));
  },

  async getConversationMessages(otherUserId: string) {
    // 1. Get or create conversation ID
    const { data: convData } = await api.post('/conversations', { otherUserId });
    const conversationId = convData.data.conversationId;

    // 2. Get messages
    const { data: msgData } = await api.get(`/conversations/${conversationId}/messages`);
    
    const myId = getCurrentUserId();
    const messages: ChatMessage[] = msgData.data.map((m: any) => {
      let metadata: any = {};
      try { metadata = JSON.parse(m.metadata || '{}'); } catch {}
      
      return {
        id: m.id,
        fromMe: m.sender_id === myId,
        text: m.content,
        timestamp: new Date(m.created_at).getTime(),
        type: m.type,
        ...metadata // photoUrls, noteData, replyTo
      };
    });

    return { conversationId, messages };
  },

  async sendMessage(otherUserId: string, content: string, options: any = {}) {
    // 1. Get conversation ID (should be cached ideally)
    const { data: convData } = await api.post('/conversations', { otherUserId });
    const conversationId = convData.data.conversationId;

    // 2. Send
    const payload = {
      content,
      type: options.type || 'text',
      metadata: {
        photoUrls: options.photoUrls,
        noteData: options.noteData,
        replyTo: options.replyTo
      }
    };
    
    const { data } = await api.post(`/conversations/${conversationId}/messages`, payload);
    const m = data.data;
    const myId = getCurrentUserId();
    
    let metadata: any = {};
    try { metadata = JSON.parse(m.metadata || '{}'); } catch {}

    return {
      id: m.id,
      fromMe: m.sender_id === myId,
      text: m.content,
      timestamp: new Date(m.created_at).getTime(),
      type: m.type,
      ...metadata
    };
  }
};
