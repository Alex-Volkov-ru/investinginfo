import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - добавляем токен
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('access_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - обрабатываем ошибки
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;

          // Обработка ошибок валидации (422)
          if (status === 422) {
            const detail = data?.detail;
            if (Array.isArray(detail)) {
              // FastAPI validation errors format
              const errors = detail.map((err: any) => {
                const field = err.loc?.slice(1).join('.') || 'поле';
                return `${field}: ${err.msg}`;
              }).join(', ');
              toast.error(`Ошибка валидации: ${errors}`);
            } else if (typeof detail === 'string') {
              toast.error(detail);
            } else {
              toast.error('Ошибка валидации данных');
            }
          } else if (status === 401) {
            // Неавторизован - очищаем токен
            const message = data?.detail || 'Неверный email или пароль';
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            
            // Редиректим на логин только если мы не на странице логина
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
              toast.error('Сессия истекла. Пожалуйста, войдите снова.');
            } else {
              // На странице логина просто показываем ошибку
              toast.error(message);
            }
          } else if (status === 403) {
            toast.error(data?.detail || 'Доступ запрещен');
          } else if (status === 404) {
            toast.error(data?.detail || 'Ресурс не найден');
          } else if (status === 409) {
            toast.error(data?.detail || 'Конфликт данных');
          } else if (status === 429) {
            toast.error('Слишком много запросов. Подождите немного.');
          } else if (status >= 500) {
            toast.error(data?.detail || 'Ошибка сервера. Попробуйте позже.');
          } else {
            const message = data?.detail || data?.message || error.message || 'Произошла ошибка';
            toast.error(message);
          }
        } else if (error.request) {
          toast.error('Нет соединения с сервером');
        } else {
          toast.error('Произошла ошибка');
        }
        return Promise.reject(error);
      }
    );
  }

  get instance() {
    return this.client;
  }
}

export const apiClient = new ApiClient().instance;

