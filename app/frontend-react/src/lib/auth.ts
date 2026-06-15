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

  setUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
  },

  startImpersonation(res: { access_token: string; user_id: number; email: string; tg_username?: string; impersonated_by: number }): void {
    const currentToken = this.getToken();
    if (currentToken) {
      localStorage.setItem('admin_token_backup', currentToken);
      const currentUser = this.getUser();
      if (currentUser) {
        localStorage.setItem('admin_user_backup', JSON.stringify(currentUser));
      }
    }
    localStorage.setItem('access_token', res.access_token);
    localStorage.setItem('user', JSON.stringify({
      id: res.user_id,
      email: res.email,
      tg_username: res.tg_username,
      is_staff: false,
      impersonated_by: res.impersonated_by,
    }));
  },

  stopImpersonation(): boolean {
    const adminToken = localStorage.getItem('admin_token_backup');
    const adminUser = localStorage.getItem('admin_user_backup');
    if (!adminToken || !adminUser) return false;
    localStorage.setItem('access_token', adminToken);
    localStorage.setItem('user', adminUser);
    localStorage.removeItem('admin_token_backup');
    localStorage.removeItem('admin_user_backup');
    return true;
  },

  isImpersonating(): boolean {
    const user = this.getUser();
    return !!user?.impersonated_by;
  },
};

