import { api } from './api';

export interface HiBrainQueryResponse {
  answer: string;
  sources?: any[];
  [key: string]: any;
}

export const hibrainService = {
  /**
   * Send a query to HiBrain (RAG service)
   * @param query The user's question or input
   * @returns The AI's response
   */
  async query(query: string): Promise<HiBrainQueryResponse> {
    const response = await api.post<HiBrainQueryResponse>('/hibrain/query', { query });
    return response.data;
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
