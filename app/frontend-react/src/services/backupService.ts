import { apiClient } from '../lib/api';

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  size_mb: number;
  created_at?: string | null;
  compressed?: boolean;
}

export interface BackupListResponse {
  backups: BackupInfo[];
  total: number;
  disk_usage: {
    backup_dir: string;
    backup_count: number;
    backup_total_size_mb: number;
    disk_total_gb: number;
    disk_used_gb: number;
    disk_free_gb: number;
    disk_usage_percent: number;
  };
}

export interface BackupCreateResponse {
  success: boolean;
  message: string;
  backup?: BackupInfo | null;
}

export interface BackupRestoreResponse {
  success: boolean;
  message: string;
}

export const backupService = {
  async list(): Promise<BackupListResponse> {
    const res = await apiClient.get<BackupListResponse>('/backups/list');
    return res.data;
  },

  async create(): Promise<BackupCreateResponse> {
    const res = await apiClient.post<BackupCreateResponse>('/backups/create', {});
    return res.data;
  },

  async rotate(): Promise<{ success: boolean; message?: string; deleted_count?: number }> {
    const res = await apiClient.post('/backups/rotate', {});
    return res.data;
  },

  async restore(filename: string, drop_existing: boolean): Promise<BackupRestoreResponse> {
    const res = await apiClient.post<BackupRestoreResponse>('/backups/restore', { filename, drop_existing });
    return res.data;
  },

  async delete(filename: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<{ success: boolean; message: string }>(`/backups/delete/${encodeURIComponent(filename)}`);
    return res.data;
  },

  downloadUrl(filename: string): string {
    const base = (import.meta as any).env?.VITE_API_URL || '/api';
    return `${base}/backups/download/${encodeURIComponent(filename)}`;
  },
};

