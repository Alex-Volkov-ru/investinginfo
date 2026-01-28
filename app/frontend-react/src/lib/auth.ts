import { apiClient } from './api';
import { LoginRequest, RegisterRequest, LoginResponse, User } from '../types';
import toast from 'react-hot-toast';

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
      const data = response.data;
      
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify({
        id: data.user_id,
        email: data.email,
        tg_username: data.tg_username,
        has_tinkoff: !!data.has_tinkoff,
        is_staff: !!data.is_staff,
      }));
      
      toast.success('Вход выполнен успешно');
      return data;
    } catch (error: any) {
      // Ошибка уже обработана в interceptor, но пробрасываем дальше
      throw error;
    }
  },

  async register(credentials: RegisterRequest): Promise<LoginResponse> {
    try {
      // Убираем пустые строки, заменяя их на undefined
      const cleanCredentials: RegisterRequest = {
        email: credentials.email.trim(),
        password: credentials.password,
        tg_username: credentials.tg_username?.trim() || undefined,
        phone: credentials.phone?.trim() || undefined,
        tinkoff_token: credentials.tinkoff_token?.trim() || undefined,
      };

      const response = await apiClient.post<LoginResponse>('/auth/register', cleanCredentials);
      const data = response.data;
      
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify({
        id: data.user_id,
        email: data.email,
        tg_username: data.tg_username,
        has_tinkoff: !!data.has_tinkoff,
        is_staff: !!data.is_staff,
      }));
      
      toast.success('Регистрация выполнена успешно');
      return data;
    } catch (error: any) {
      // Ошибка уже обработана в interceptor, но пробрасываем дальше
      throw error;
    }
  },

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    toast.success('Выход выполнен');
  },

  getToken(): string | null {
    return localStorage.getItem('access_token');
  },

  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};

