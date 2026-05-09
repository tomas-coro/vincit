import { useEffect, useCallback } from 'react';
import { fetchState } from './api.js';

export function useSync(setState, groupId, token) {
  const ready = !!(groupId && token);

  const refresh = useCallback(async () => {
    if (!ready) return;
    try {
      const data = await fetchState(groupId);
      setState(data);
    } catch (e) {
      console.error('fetchState failed:', e);
    }
  }, [setState, ready, groupId]);

  useEffect(() => {
    if (!ready) return;
    refresh();
  }, [refresh, ready]);

  useEffect(() => {
    if (!groupId || !token) {
      console.warn('[useSync] missing groupId or token — not syncing', { groupId, token: !!token });
      return;
    }
    const url = `/api/state/stream?token=${encodeURIComponent(token)}&groupId=${encodeURIComponent(groupId)}`;
    let es = null;
    let retryCount = 0;
    let timer = null;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      es = new EventSource(url);
      es.onmessage = () => { retryCount = 0; refresh(); };
      es.onerror = () => {
        es.close();
        if (destroyed) return;
        const delay = Math.min(1000 * 2 ** retryCount + Math.random() * 500, 30000);
        retryCount++;
        timer = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      destroyed = true;
      clearTimeout(timer);
      es?.close();
    };
  }, [ready, token, groupId, refresh]);

  return refresh;
}
