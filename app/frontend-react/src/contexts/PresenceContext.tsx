import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { getPresenceWebSocketUrl, OnlineUser } from '../lib/presence';

interface PresenceContextType {
  onlineUsers: OnlineUser[];
  onlineUserIds: Set<number>;
  isConnected: boolean;
  isUserOnline: (userId: number) => boolean;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

const PING_INTERVAL_MS = 25_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export const PresenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, isInitializing } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<number | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);

  const clearTimers = useCallback(() => {
    if (pingRef.current != null) {
      window.clearInterval(pingRef.current);
      pingRef.current = null;
    }
    if (reconnectRef.current != null) {
      window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  const closeSocket = useCallback(() => {
    clearTimers();
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close();
    }
    setIsConnected(false);
  }, [clearTimers]);

  const applySnapshot = useCallback((users: OnlineUser[]) => {
    setOnlineUsers(users);
  }, []);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          type: string;
          users?: OnlineUser[];
          user_id?: number;
          email?: string;
          tg_username?: string | null;
        };

        if (msg.type === 'snapshot' && Array.isArray(msg.users)) {
          applySnapshot(msg.users);
          return;
        }

        if (msg.type === 'online' && msg.user_id != null) {
          setOnlineUsers((prev) => {
            if (prev.some((u) => u.user_id === msg.user_id)) return prev;
            return [
              ...prev,
              {
                user_id: msg.user_id!,
                email: msg.email || `#${msg.user_id}`,
                tg_username: msg.tg_username,
              },
            ];
          });
          return;
        }

        if (msg.type === 'offline' && msg.user_id != null) {
          setOnlineUsers((prev) => prev.filter((u) => u.user_id !== msg.user_id));
        }
      } catch {
        // ignore malformed messages
      }
    },
    [applySnapshot]
  );

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token || !mountedRef.current) return;

    closeSocket();

    const ws = new WebSocket(getPresenceWebSocketUrl(token));
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      attemptRef.current = 0;
      setIsConnected(true);
      pingRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      clearTimers();

      const delay = Math.min(RECONNECT_BASE_MS * 2 ** attemptRef.current, RECONNECT_MAX_MS);
      attemptRef.current += 1;
      reconnectRef.current = window.setTimeout(() => {
        if (mountedRef.current && localStorage.getItem('access_token')) {
          connect();
        }
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [clearTimers, closeSocket, handleMessage]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      closeSocket();
    };
  }, [closeSocket]);

  useEffect(() => {
    if (isInitializing) return;
    if (!isAuthenticated) {
      setOnlineUsers([]);
      closeSocket();
      return;
    }
    connect();
  }, [isAuthenticated, isInitializing, connect, closeSocket]);

  const onlineUserIds = useMemo(() => new Set(onlineUsers.map((u) => u.user_id)), [onlineUsers]);

  const isUserOnline = useCallback((userId: number) => onlineUserIds.has(userId), [onlineUserIds]);

  const value = useMemo(
    () => ({
      onlineUsers,
      onlineUserIds,
      isConnected,
      isUserOnline,
    }),
    [onlineUsers, onlineUserIds, isConnected, isUserOnline]
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};

export const usePresence = () => {
  const ctx = useContext(PresenceContext);
  if (!ctx) {
    throw new Error('usePresence must be used within PresenceProvider');
  }
  return ctx;
};
