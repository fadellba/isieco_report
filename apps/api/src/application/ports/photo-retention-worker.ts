export interface PhotoRetentionLock {
  tryAcquire(): Promise<boolean>;
  release(): Promise<void>;
}
