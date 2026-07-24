// ============================================================
// useWebSocket — Custom hook for WebSocket connection management
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WSMessage } from '../types';

interface UseWebSocketOptions {
  onMessage: (msg: WSMessage) => void;
}

interface UseWebSocketReturn {
  connected: boolean;
  send: (msg: WSMessage) => void;
  connect: () => void;
  disconnect: () => void;
}

function formatWsUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  let url = rawUrl.trim();
  if (!url) return null;

  if (url.startsWith('https://')) {
    url = url.replace('https://', 'wss://');
  } else if (url.startsWith('http://')) {
    url = url.replace('http://', 'ws://');
  } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
    url = `${isLocal ? 'ws' : 'wss'}://${url}`;
  }

  if (!url.endsWith('/ws')) {
    url = url.replace(/\/+$/, '');
    url = `${url}/ws`;
  }

  return url;
}

export function useWebSocket({ onMessage }: UseWebSocketOptions): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const maxReconnectAttempts = 5;
  const onMessageRef = useRef(onMessage);
  const intentionalDisconnect = useRef(false);
  onMessageRef.current = onMessage;

  const getWsUrl = useCallback((): string => {
    const envUrl = (import.meta.env.SERVER_URL as string | undefined) || (import.meta.env.VITE_SERVER_URL as string | undefined);
    const formatted = formatWsUrl(envUrl);
    if (formatted) {
      return formatted;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (import.meta.env.DEV) {
      return `${protocol}//${window.location.host}/ws`;
    }
    return `${protocol}//${window.location.hostname}:8080/ws`;
  }, []);

  const cleanupSocket = (ws: WebSocket) => {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
  };

  const connect = useCallback(() => {
    // Clear any pending reconnect timer
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    // Close and cleanup any existing connection first
    if (wsRef.current) {
      const oldWs = wsRef.current;
      wsRef.current = null;
      cleanupSocket(oldWs);
      if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
        oldWs.close(1000, 'Reconnecting');
      }
    }

    intentionalDisconnect.current = false;
    const url = getWsUrl();
    console.log('[WS] Connecting to', url);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      console.log('[WS] Connected');
      setConnected(true);
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      try {
        const msg: WSMessage = JSON.parse(event.data);
        onMessageRef.current(msg);
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return;
      console.log('[WS] Disconnected', event.code, event.reason);
      wsRef.current = null;
      setConnected(false);

      // Don't auto-reconnect if intentionally disconnected
      if (intentionalDisconnect.current) return;

      // Auto-reconnect with exponential backoff
      if (reconnectAttempt.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 10000);
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempt.current + 1})`);
        reconnectTimer.current = setTimeout(() => {
          reconnectAttempt.current++;
          connect();
        }, delay);
      }
    };

    ws.onerror = (err) => {
      if (wsRef.current !== ws) return;
      console.error('[WS] Error:', err);
    };
  }, [getWsUrl]);

  const disconnect = useCallback(() => {
    intentionalDisconnect.current = true;
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    reconnectAttempt.current = 0;
    if (wsRef.current) {
      const oldWs = wsRef.current;
      wsRef.current = null;
      cleanupSocket(oldWs);
      oldWs.close(1000, 'User disconnect');
    }
    setConnected(false);
  }, []);

  const send = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn('[WS] Cannot send — not connected');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalDisconnect.current = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        const oldWs = wsRef.current;
        wsRef.current = null;
        cleanupSocket(oldWs);
        oldWs.close(1000, 'Unmount');
      }
    };
  }, []);

  return { connected, send, connect, disconnect };
}
