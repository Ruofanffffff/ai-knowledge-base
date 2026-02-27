import { api } from './api';

export interface UserStats {
  total: any;
  daily: any[];
}

export interface TokenUsage {
  usage: any[];
  model_stats?: any;
}

export interface Model {
  id: number;
  user_id: string;
  model_name: string;
  model_type: string;
  api_key: string;
  endpoint: string;
  priority: number;
  is_enabled: boolean;
  created_at?: string;
}

export interface Agent {
  id: number;
  user_id: string;
  name: string;
  description: string;
  system_prompt: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  is_public: number;
  icon: string;
  created_at?: string;
}

export const userCenterService = {
  async getStats(): Promise<UserStats> {
    const response = await api.get('/user-center/stats/overview');
    return response.data.data;
  },

  async getTokenUsage(params?: { start_date?: string; end_date?: string; model_name?: string }): Promise<TokenUsage> {
    const response = await api.get('/user-center/stats/token-usage', { params });
    return response.data.data;
  },

  async getModels(): Promise<Model[]> {
    const response = await api.get('/user-center/models');
    return response.data.data;
  },

  async createModel(data: Partial<Model>): Promise<Model> {
    const response = await api.post('/user-center/models', data);
    return response.data.data;
  },

  async updateModel(id: number, data: Partial<Model>): Promise<void> {
    await api.put(`/user-center/models/${id}`, data);
  },

  async deleteModel(id: number): Promise<void> {
    await api.delete(`/user-center/models/${id}`);
  },

  async getAgents(): Promise<Agent[]> {
    const response = await api.get('/user-center/agents');
    return response.data.data;
  },

  async createAgent(data: Partial<Agent>): Promise<Agent> {
    const response = await api.post('/user-center/agents', data);
    return response.data.data;
  },

  async updateAgent(id: number, data: Partial<Agent>): Promise<void> {
    await api.put(`/user-center/agents/${id}`, data);
  },

  async deleteAgent(id: number): Promise<void> {
    await api.delete(`/user-center/agents/${id}`);
  },

  async getPublicAgents(): Promise<Agent[]> {
    const response = await api.get('/user-center/agents/public');
    return response.data.data;
  }
};
