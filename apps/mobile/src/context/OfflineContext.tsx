import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getPendingActions,
  enqueueOfflineAction,
  syncOfflineQueue,
} from '../services/offlineQueue.js';
import { OfflineAction } from '../types/index.js';

interface OfflineContextValue {
  isOnline: boolean;
  setIsOnline: (val: boolean) => void;
  pendingCount: number;
  syncing: boolean;
  syncNow: () => Promise<{ synced: number; failed: number }>;
  enqueueDraft: (type: OfflineAction['type'], payload: any) => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = async () => {
    const list = await getPendingActions();
    setPendingCount(list.length);
  };

  useEffect(() => {
    refreshPendingCount();
  }, []);

  const syncNow = async () => {
    if (!isOnline || syncing) return { synced: 0, failed: 0 };
    setSyncing(true);
    try {
      const res = await syncOfflineQueue();
      await refreshPendingCount();
      return { synced: res.synced, failed: res.failed };
    } finally {
      setSyncing(false);
    }
  };

  const enqueueDraft = async (type: OfflineAction['type'], payload: any) => {
    await enqueueOfflineAction(type, payload);
    await refreshPendingCount();
  };

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        setIsOnline,
        pendingCount,
        syncing,
        syncNow,
        enqueueDraft,
        refreshPendingCount,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
};
