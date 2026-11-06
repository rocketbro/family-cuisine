// Which sections are folded away, remembered on this device.
import { useState } from 'react';

export function useCollapsed(key: string) {
  const storageKey = `cuisine.collapsed.${key}`;
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) ?? '[]') as string[]); } catch { return new Set(); }
  });
  const toggle = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id); else next.add(id);
    localStorage.setItem(storageKey, JSON.stringify([...next]));
    setCollapsed(next);
  };
  return { isCollapsed: (id: string) => collapsed.has(id), toggle };
}
