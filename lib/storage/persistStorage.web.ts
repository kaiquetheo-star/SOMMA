import type { StateStorage } from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';

/** Synchronous web localStorage — avoids AsyncStorage rehydrate races on PWA reload. */
function webLocalStorage(): StateStorage {
  return {
    getItem: (name) => {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(name);
    },
    setItem: (name, value) => {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(name, value);
    },
    removeItem: (name) => {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(name);
    },
  };
}

export const sommaPersistStorage = createJSONStorage(() => webLocalStorage());
