import { api } from './api';

export interface HiBrainQueryResponse {
  answer: string;
  sources?: any[];
  [key: string]: any;
}

type AnyObject = Record<string, any>;

function pickString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeQueryResponse(payload: unknown): HiBrainQueryResponse {
  const root = (payload && typeof payload === 'object') ? payload as AnyObject : {};
  const data = (root.data && typeof root.data === 'object') ? root.data as AnyObject : undefined;
  const result = (root.result && typeof root.result === 'object') ? root.result as AnyObject : undefined;

  const answer =
    pickString(root.answer) ||
    pickString(root.content) ||
    pickString(root.response) ||
    pickString(root.message) ||
    pickString(data?.answer) ||
    pickString(data?.content) ||
    pickString(data?.response) ||
    pickString(data?.message) ||
    pickString(result?.answer) ||
    pickString(result?.content) ||
    pickString(result?.response) ||
    pickString(result?.message) ||
    pickString(root.choices?.[0]?.message?.content) ||
    pickString(root.choices?.[0]?.text) ||
    '';

  return {
    ...root,
    ...(data || {}),
    ...(result || {}),
    answer,
  };
}

export const hibrainService = {
  /**
   * Send a query to HiBrain (RAG service)
   * @param query The user's question or input
   * @returns The AI's response
   */
  async query(query: string): Promise<HiBrainQueryResponse> {
    const response = await api.post<HiBrainQueryResponse>('/hibrain/query', { query });
    return normalizeQueryResponse(response.data);
  },

  /**
   * Add a memory to HiBrain
   * @param content The content to remember
   * @param type The type of memory (episodic, semantic, etc.)
   */
  async addMemory(content: string, type: string = 'episodic'): Promise<any> {
    const response = await api.post('/hibrain/memory', { content, type });
    return response.data;
  },

  /**
   * Forget all memories (GDPR)
   */
  async forgetAll(): Promise<any> {
    const response = await api.delete('/hibrain/memory/forget');
    return response.data;
  }
};
