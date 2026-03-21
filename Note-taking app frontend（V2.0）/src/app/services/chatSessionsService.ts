import axios from 'axios';
import { api } from './api';
import type { PersistedSource } from '../types/sources';

type AnyObject = Record<string, any>;

function unwrapPayload<T>(payload: any): T {
  if (payload && typeof payload === 'object') {
    if ('data' in payload) return (payload as AnyObject).data as T;
    if ('result' in payload) return (payload as AnyObject).result as T;
  }
  return payload as T;
}

function toApiErrorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : String(err || '未知错误');
  }
  const status = err.response?.status;
  const data: any = err.response?.data;
  const backendMsg = data?.error || data?.message;
  return [status ? `HTTP ${status}` : null, backendMsg ? String(backendMsg) : null]
    .filter(Boolean)
    .join('｜') || '请求失败';
}

export type ChatSessionId = string;

export interface WebSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface ChatSessionMessage {
  id?: string | number;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  sources?: PersistedSource[];
  webSources?: WebSource[];
  [key: string]: any;
}

export interface ChatSessionSummary {
  id: ChatSessionId;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface ChatSessionDetail extends ChatSessionSummary {
  messages: ChatSessionMessage[];
}

export interface CreateChatSessionInput {
  id?: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  messages?: ChatSessionMessage[];
  [key: string]: any;
}

export const chatSessionsService = {
  async listSessions(): Promise<ChatSessionSummary[]> {
    try {
      const resp = await api.get('/chat/sessions');
      const data = unwrapPayload<any>(resp.data);
      return Array.isArray(data) ? (data as ChatSessionSummary[]) : [];
    } catch (err) {
      throw err;
    }
  },

  async createSession(input: CreateChatSessionInput): Promise<ChatSessionDetail> {
    try {
      const resp = await api.post('/chat/sessions', input);
      return unwrapPayload<ChatSessionDetail>(resp.data);
    } catch (err) {
      throw err;
    }
  },

  async getSession(sessionId: ChatSessionId): Promise<ChatSessionDetail> {
    try {
      const resp = await api.get(`/chat/sessions/${sessionId}`);
      return unwrapPayload<ChatSessionDetail>(resp.data);
    } catch (err) {
      throw err;
    }
  },

  async deleteSession(sessionId: ChatSessionId): Promise<void> {
    try {
      await api.delete(`/chat/sessions/${sessionId}`);
    } catch (err) {
      throw err;
    }
  },

  async renameSession(sessionId: ChatSessionId, title: string): Promise<void> {
    try {
      await api.put(`/chat/sessions/${sessionId}`, { title });
    } catch (err) {
      throw err;
    }
  },

  async addMessage(sessionId: ChatSessionId, message: ChatSessionMessage): Promise<void> {
    try {
      const payload = {
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        sources: Array.isArray(message.sources) ? message.sources : [],
        webSources: Array.isArray(message.webSources) ? message.webSources : [],
      };
      await api.post(`/chat/sessions/${sessionId}/messages`, payload);
    } catch (err) {
      throw err;
    }
  },
};
