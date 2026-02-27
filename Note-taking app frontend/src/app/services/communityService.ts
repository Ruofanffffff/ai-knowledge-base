import { api } from './api';

export interface Post {
  id: number;
  userId: string;
  documentId: number;
  title: string;
  summary: string;
  coverImage?: string;
  tags: string[];
  likes: number;
  viewCount: number;
  status: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorAvatar: string;
  isLiked: boolean;
  isBookmarked: boolean;
  commentCount: number;
  contentImages?: string[];
  indexData?: any;
}

export interface Comment {
  id: number;
  postId: number;
  userId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string;
}

export const communityService = {
  async publish(documentIds: string[], isPublic: boolean = false): Promise<{ published: any[]; skipped: any[] }> {
    const response = await api.post('/community/publish', { documentIds, isPublic });
    return response.data.data;
  },

  async getPosts(params?: { page?: number; limit?: number; sort?: 'latest' | 'hottest'; filter?: 'mine' | 'liked'; search?: string }): Promise<{ posts: Post[]; total: number }> {
    const response = await api.get('/community/posts', { params });
    return response.data.data;
  },

  async getPost(id: number): Promise<Post> {
    const response = await api.get(`/community/posts/${id}`);
    return response.data.data;
  },

  async deletePost(id: number): Promise<void> {
    await api.delete(`/community/posts/${id}`);
  },

  async likePost(id: number): Promise<{ liked: boolean; likes: number }> {
    const response = await api.post(`/community/posts/${id}/like`);
    return response.data.data;
  },

  async bookmarkPost(id: number): Promise<{ bookmarked: boolean }> {
    const response = await api.post(`/community/posts/${id}/bookmark`);
    return response.data.data;
  },

  async commentPost(id: number, content: string): Promise<Comment> {
    const response = await api.post(`/community/posts/${id}/comments`, { content });
    return response.data.data;
  },

  async getComments(id: number): Promise<{ comments: Comment[]; total: number }> {
    const response = await api.get(`/community/posts/${id}/comments`);
    return response.data.data;
  }
};
