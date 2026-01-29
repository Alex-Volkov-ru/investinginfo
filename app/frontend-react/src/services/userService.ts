import { apiClient } from '../lib/api';

export interface UserInfo {
  id: number;
  email: string;
  tg_username?: string;
  has_tinkoff: boolean;
  is_staff?: boolean;
}

export interface UserListItem {
  id: number;
  email: string;
  tg_username?: string;
  is_staff: boolean;
  created_at: string;
  last_login_at?: string;
}

export const userService = {
  async getMe(): Promise<UserInfo> {
    const response = await apiClient.get<UserInfo>('/users/me');
    return response.data;
  },

  async updateTinkoffToken(token: string): Promise<UserInfo> {
    const response = await apiClient.put<UserInfo>('/users/me/token', {
      tinkoff_token: token,
    });
    return response.data;
  },

  async removeTinkoffToken(): Promise<UserInfo> {
    const response = await apiClient.put<UserInfo>('/users/me/token', {
      tinkoff_token: null,
    });
    return response.data;
  },

  async updateName(tg_username: string): Promise<UserInfo> {
    const response = await apiClient.put<UserInfo>('/users/me/name', {
      tg_username,
    });
    return response.data;
  },

  async updateEmail(email: string): Promise<UserInfo> {
    const response = await apiClient.put<UserInfo>('/users/me/email', {
      email,
    });
    return response.data;
  },

  async listUsers(): Promise<UserListItem[]> {
    const response = await apiClient.get<UserListItem[]>('/users/list');
    return response.data;
  },

  async toggleStaff(userId: number, isStaff: boolean): Promise<UserListItem> {
    const response = await apiClient.put<UserListItem>('/users/toggle-staff', {
      user_id: userId,
      is_staff: isStaff,
    });
    return response.data;
  },

  async adminUpdateName(userId: number, tg_username: string): Promise<UserListItem> {
    const response = await apiClient.put<UserListItem>(`/users/${userId}/name`, {
      tg_username,
    });
    return response.data;
  },

  async adminUpdateEmail(userId: number, email: string): Promise<UserListItem> {
    const response = await apiClient.put<UserListItem>(`/users/${userId}/email`, {
      email,
    });
    return response.data;
  },
};

