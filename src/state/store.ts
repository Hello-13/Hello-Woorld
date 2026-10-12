import { useEffect, useState } from 'preact/hooks';

/** localStorage that never throws: private windows, blocked storage and previews just fall back to memory. */
export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable; the in-memory copy still works for this visit.
  }
}

export interface Store<T> {
  get(): T;
  set(patch: Partial<T> | ((prev: T) => Partial<T>)): void;
  subscribe(fn: (value: T) => void): () => void;
}

export function createStore<T extends object>(key: string, initial: T): Store<T> {
  let value = loadJson(key, initial);
  const subs = new Set<(v: T) => void>();
  return {
    get: () => value,
    set(patch) {
      const p = typeof patch === 'function' ? patch(value) : patch;
      value = { ...value, ...p };
      saveJson(key, value);
      subs.forEach((fn) => fn(value));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  const [value, setValue] = useState(store.get());
  useEffect(() => {
    setValue(store.get());
    return store.subscribe(setValue);
  }, [store]);
  return value;
}
