import { apiClient } from '../lib/api';

export interface UserInfo {
  id: number;
  email: string;
  tg_username?: string;
  has_tinkoff: boolean;
  is_staff?: boolean;
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
};

