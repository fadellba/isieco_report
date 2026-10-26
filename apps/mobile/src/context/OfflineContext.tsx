import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getPendingActions,
  getLegacyPendingActionCount,
  enqueueOfflineAction,
  syncOfflineQueue,
} from '../services/offlineQueue.js';
import { OfflineActionInput } from '../types/index.js';

interface OfflineContextValue {
  isOnline: boolean;
  setIsOnline: (val: boolean) => void;
  pendingCount: number;
  legacyPendingCount: number;
  queueError: string | null;
  syncing: boolean;
  syncNow: () => Promise<{ synced: number; failed: number; failedActionIds: string[] }>;
  enqueueDraft: (input: OfflineActionInput) => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [legacyPendingCount, setLegacyPendingCount] = useState(0);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = async () => {
    try {
      const [list, legacyCount] = await Promise.all([
        getPendingActions(),
        getLegacyPendingActionCount(),
      ]);
      setPendingCount(list.length);
      setLegacyPendingCount(legacyCount);
      setQueueError(null);
    } catch {
      setQueueError('La file locale ne peut pas être lue. Les données conservées ne seront pas écrasées.');
    }
  };

  useEffect(() => {
    refreshPendingCount();
  }, []);

  const syncNow = async () => {
    if (!isOnline || syncing) {
      return { synced: 0, failed: 0, failedActionIds: [] };
    }
    setSyncing(true);
    try {
      const res = await syncOfflineQueue();
      await refreshPendingCount();
      return {
        synced: res.synced,
        failed: res.failed,
        failedActionIds: res.failedActionIds,
      };
    } finally {
      setSyncing(false);
    }
  };

  const enqueueDraft = async (input: OfflineActionInput) => {
    await enqueueOfflineAction(input);
    await refreshPendingCount();
  };

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        setIsOnline,
        pendingCount,
        legacyPendingCount,
        queueError,
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
