// Persistência do perfil. O backend é injetável (localStorage no navegador, memória nos testes).
import { createProfile, sanitizeProfile } from './profile.js';

export const SAVE_KEY = 'bastioes-do-eter.save.v1';

export function memoryBackend() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

function safeBackend(backend) {
  if (backend) return backend;
  try {
    const ls = globalThis.localStorage;
    const probe = '__probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryBackend();
  }
}

export function createStorage(backend) {
  const store = safeBackend(backend);
  return {
    load(now = Date.now()) {
      let raw = null;
      try {
        raw = store.getItem(SAVE_KEY);
      } catch {
        raw = null;
      }
      if (!raw) {
        const p = createProfile();
        p.createdAt = now;
        return { profile: p, fresh: true, recovered: false };
      }
      try {
        const parsed = JSON.parse(raw);
        return { profile: sanitizeProfile(parsed), fresh: false, recovered: false };
      } catch {
        try {
          store.setItem(`${SAVE_KEY}.corrupt`, raw);
        } catch { /* sem espaço */ }
        const p = createProfile();
        p.createdAt = now;
        return { profile: p, fresh: true, recovered: true };
      }
    },
    save(profile) {
      try {
        store.setItem(SAVE_KEY, JSON.stringify(profile));
        return true;
      } catch {
        return false;
      }
    },
    reset() {
      try {
        store.removeItem(SAVE_KEY);
      } catch { /* ignorado */ }
    },
  };
}
