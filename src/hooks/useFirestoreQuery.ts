/**
 * Custom hook for Firestore queries with automatic deduplication
 * Prevents duplicate listeners across multiple components
 */

import { useEffect, useState, useCallback } from 'react';
import { Query } from 'firebase/firestore';
import { firestoreManager } from '@/lib/firestore-manager';

interface UseFirestoreQueryOptions<T> {
  query: Query | null;
  queryKey: string;
  enabled?: boolean;
  onError?: (error: Error) => void;
  transform?: (snapshot: any) => T[];
}

export function useFirestoreQuery<T = any>({
  query,
  queryKey,
  enabled = true,
  onError,
  transform
}: UseFirestoreQueryOptions<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const handleSnapshot = useCallback((snapshot: any) => {
    try {
      if (transform) {
        setData(transform(snapshot));
      } else {
        setData(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      }
      setLoading(false);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setLoading(false);
      if (onError) onError(error);
    }
  }, [transform, onError]);

  const handleError = useCallback((err: Error) => {
    setError(err);
    setLoading(false);
    if (onError) onError(err);
  }, [onError]);

  useEffect(() => {
    if (!query || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Subscribe using the centralized manager
    const unsubscribe = firestoreManager.subscribe(
      queryKey,
      query,
      handleSnapshot,
      handleError
    );

    return () => {
      unsubscribe();
    };
  }, [query, queryKey, enabled, handleSnapshot, handleError]);

  return { data, loading, error };
}