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
    const es = new EventSource(url);
    es.onmessage = () => refresh();
    es.onerror   = () => { es.close(); };
    return () => es.close();
  }, [ready, token, groupId, refresh]);

  return refresh;
}
