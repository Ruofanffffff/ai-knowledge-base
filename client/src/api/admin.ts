import apiClient from './client';
import { ApiResponse, User } from './types';

// Admin Stats Interface
export interface AdminStats {
  totalUsers: number;
  totalDocuments: number;
  totalStorage: string; // e.g., "1.2 GB"
  storagePercentage: number;
  activeUsersLast30Days: number;
}

// User Management Interface
export interface UserFilter {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
}

class AdminApi {
  /**
   * Get admin dashboard statistics
   */
  async getStats(): Promise<ApiResponse<AdminStats>> {
    try {
      const response = await apiClient.get('/admin/stats');
      return { success: true, data: response.data.data || response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || 'Failed to fetch admin stats',
      };
    }
  }

  /**
   * Get list of users with pagination and filtering
   */
  async getUsers(filter?: UserFilter): Promise<ApiResponse<UserListResponse>> {
    try {
      const response = await apiClient.get('/admin/users', { params: filter });
      return { 
        success: true, 
        data: {
          users: response.data.users || [],
          total: response.data.total || 0,
          page: response.data.page || 1,
          limit: response.data.limit || 10
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch users',
      };
    }
  }

  /**
   * Update a user's role or status
   */
  async updateUser(userId: string, data: Partial<User>): Promise<ApiResponse<User>> {
    try {
      const response = await apiClient.put(`/admin/users/${userId}`, data);
      return { success: true, data: response.data.data || response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || 'Failed to update user',
      };
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/admin/users/${userId}`);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete user',
      };
    }
  }
}

export const adminApi = new AdminApi();
export default adminApi;
