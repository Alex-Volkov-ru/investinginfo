import { apiClient } from '../lib/api';
import { Whiteboard, WhiteboardListItem, WhiteboardPayload } from '../types';

export const whiteboardService = {
  async getLatest(): Promise<Whiteboard | null> {
    const response = await apiClient.get<Whiteboard | null>('/whiteboard/latest');
    return response.data;
  },

  async list(): Promise<WhiteboardListItem[]> {
    const response = await apiClient.get<WhiteboardListItem[]>('/whiteboard/list');
    return response.data;
  },

  async getById(id: number): Promise<Whiteboard> {
    const response = await apiClient.get<Whiteboard>(`/whiteboard/${id}`);
    return response.data;
  },

  async create(payload: WhiteboardPayload): Promise<Whiteboard> {
    const response = await apiClient.post<Whiteboard>('/whiteboard', payload);
    return response.data;
  },

  async update(id: number, payload: Partial<WhiteboardPayload>): Promise<Whiteboard> {
    const response = await apiClient.put<Whiteboard>(`/whiteboard/${id}`, payload);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/whiteboard/${id}`);
  },
};
