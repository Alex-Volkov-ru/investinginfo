export interface OnlineUser {
  user_id: number;
  email: string;
  tg_username?: string | null;
}

/** WebSocket URL without token — auth is sent as first message after connect. */
export function getPresenceWebSocketUrl(): string {
  const apiBase = import.meta.env.VITE_API_URL || '/api';
  let wsBase: string;

  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    const url = new URL(apiBase);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    wsBase = url.toString().replace(/\/$/, '');
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const path = apiBase.startsWith('/') ? apiBase : `/${apiBase}`;
    wsBase = `${protocol}//${window.location.host}${path}`.replace(/\/$/, '');
  }

  return `${wsBase}/ws/presence`;
}

export function buildPresenceAuthMessage(token: string): string {
  return JSON.stringify({ type: 'auth', token });
}
