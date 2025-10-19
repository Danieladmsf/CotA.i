/**
 * Centralized Firestore Listener Manager
 * Prevents duplicate listeners and manages connection lifecycle
 */

import { Query, onSnapshot, Unsubscribe } from 'firebase/firestore';

type ListenerCallback = (snapshot: any) => void;
type ErrorCallback = (error: Error) => void;

interface ListenerConfig {
  unsubscribe: Unsubscribe;
  refCount: number;
  lastUsed: number;
}

class FirestoreListenerManager {
  private listeners: Map<string, ListenerConfig> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 30000; // 30 seconds
  private readonly IDLE_TIMEOUT = 60000; // 1 minute

  constructor() {
    if (typeof window !== 'undefined') {
      this.startCleanupCycle();

      // Cleanup all listeners when page unloads
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }

  /**
   * Subscribe to a Firestore query with deduplication
   * Multiple subscriptions to the same query will share one listener
   */
  subscribe(
    key: string,
    query: Query,
    callback: ListenerCallback,
    errorCallback?: ErrorCallback
  ): () => void {
    // If listener already exists, increment ref count and return unsubscribe
    const existing = this.listeners.get(key);
    if (existing) {
      existing.refCount++;
      existing.lastUsed = Date.now();


      // Return a function that decrements ref count
      return () => this.unsubscribe(key);
    }

    // Create new listener

    const unsubscribe = onSnapshot(
      query,
      callback,
      (error) => {
        console.error(`🔴 [FirestoreManager] Listener error for ${key}:`, error);
        if (errorCallback) errorCallback(error);
      }
    );

    this.listeners.set(key, {
      unsubscribe,
      refCount: 1,
      lastUsed: Date.now()
    });

    return () => this.unsubscribe(key);
  }

  /**
   * Unsubscribe from a listener (decrements ref count)
   */
  private unsubscribe(key: string): void {
    const listener = this.listeners.get(key);
    if (!listener) return;

    listener.refCount--;
    listener.lastUsed = Date.now();


    // If no more references, schedule for cleanup
    if (listener.refCount <= 0) {
      // Don't immediately unsubscribe - keep for a bit in case of re-subscription
    }
  }

  /**
   * Force cleanup of a specific listener
   */
  forceCleanup(key: string): void {
    const listener = this.listeners.get(key);
    if (listener) {
      listener.unsubscribe();
      this.listeners.delete(key);
    }
  }

  /**
   * Cleanup all idle listeners
   */
  private cleanupIdleListeners(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    this.listeners.forEach((listener, key) => {
      // Remove if no refs and idle for too long
      if (listener.refCount <= 0 && now - listener.lastUsed > this.IDLE_TIMEOUT) {
        toRemove.push(key);
      }
    });

    toRemove.forEach(key => {
      const listener = this.listeners.get(key);
      if (listener) {
        listener.unsubscribe();
        this.listeners.delete(key);
      }
    });

    if (toRemove.length > 0) {
    }
  }

  /**
   * Start automatic cleanup cycle
   */
  private startCleanupCycle(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleListeners();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Cleanup all listeners and stop cleanup cycle
   */
  cleanup(): void {

    this.listeners.forEach((listener, key) => {
      listener.unsubscribe();
    });

    this.listeners.clear();

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): { total: number; active: number; idle: number } {
    let active = 0;
    let idle = 0;

    this.listeners.forEach((listener) => {
      if (listener.refCount > 0) {
        active++;
      } else {
        idle++;
      }
    });

    return {
      total: this.listeners.size,
      active,
      idle
    };
  }
}

// Singleton instance
export const firestoreManager = new FirestoreListenerManager();