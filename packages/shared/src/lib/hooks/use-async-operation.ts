import { useState, useCallback, useRef } from 'react';

interface UseAsyncOperationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  debounceMs?: number;
  preventConcurrent?: boolean;
}

export function useAsyncOperation<T = any>(options: UseAsyncOperationOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const executingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const execute = useCallback(
    async (asyncFn: () => Promise<T>) => {
      if (options.preventConcurrent && executingRef.current) {
        return;
      }

      if (options.debounceMs) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        return new Promise<T>((resolve, reject) => {
          debounceTimerRef.current = setTimeout(async () => {
            try {
              executingRef.current = true;
              setLoading(true);
              setError(null);
              const result = await asyncFn();
              setData(result);
              setLoading(false);
              executingRef.current = false;
              if (options.onSuccess) options.onSuccess(result);
              resolve(result);
            } catch (err) {
              const error = err instanceof Error ? err : new Error('Operation failed');
              setError(error.message);
              setLoading(false);
              executingRef.current = false;
              if (options.onError) options.onError(error);
              reject(error);
            }
          }, options.debounceMs);
        });
      }

      try {
        executingRef.current = true;
        setLoading(true);
        setError(null);
        const result = await asyncFn();
        setData(result);
        setLoading(false);
        executingRef.current = false;
        if (options.onSuccess) options.onSuccess(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Operation failed');
        setError(error.message);
        setLoading(false);
        executingRef.current = false;
        if (options.onError) options.onError(error);
        throw error;
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setError(null);
    setData(null);
    setLoading(false);
    executingRef.current = false;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  return { execute, loading, error, data, reset };
}
