import type { StateStorage } from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';
import { decrypt, encrypt } from '@/lib/crypto';

function getDeviceKey(): string {
  if (typeof window === 'undefined') return 'somma-ssr-device-key';

  const nav = window.navigator;
  const screenInfo = window.screen
    ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
    : 'screen-unavailable';

  return [
    nav.userAgent,
    nav.language,
    nav.platform,
    screenInfo,
    window.location.origin,
  ].join('|');
}

/** Synchronous web localStorage — avoids AsyncStorage rehydrate races on PWA reload. */
function webLocalStorage(): StateStorage {
  return {
    getItem: (name) => {
      if (typeof localStorage === 'undefined') return null;
      const encrypted = localStorage.getItem(name);
      if (!encrypted) return null;

      try {
        return decrypt(encrypted, getDeviceKey());
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(name, encrypt(value, getDeviceKey()));
    },
    removeItem: (name) => {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(name);
    },
  };
}

export const sommaPersistStorage = createJSONStorage(() => webLocalStorage());
