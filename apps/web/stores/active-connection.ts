import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Connection } from '@open-query/shared';

interface ActiveConnectionStore {
  activeConnection: Connection | null;
  setActiveConnection: (connection: Connection | null) => void;
}

export const useActiveConnectionStore = create<ActiveConnectionStore>()(
  persist(
    (set) => ({
      activeConnection: null,
      setActiveConnection: (connection) => set({ activeConnection: connection }),
    }),
    { name: 'open-query-active-connection' }
  )
);
