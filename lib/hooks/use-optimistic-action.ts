'use client';

import { useState, useCallback, useRef } from 'react';

type ActionStatus = 'idle' | 'pending' | 'success' | 'error';

interface OptimisticActionState<T> {
  status: ActionStatus;
  data: T | null;
  error: string | null;
  isOptimistic: boolean;
}

interface UseOptimisticActionOptions<T, TArgs extends unknown[]> {
  /** The async action to execute */
  action: (...args: TArgs) => Promise<T>;
  /** Generate optimistic data before the action completes */
  getOptimisticData?: (...args: TArgs) => T;
  /** Called when action succeeds */
  onSuccess?: (data: T) => void;
  /** Called when action fails (after rollback) */
  onError?: (error: string, optimisticData: T | null) => void;
  /** Called to rollback optimistic state on error */
  onRollback?: (optimisticData: T | null) => void;
  /** Delay before showing loading state (avoids flicker for fast operations) */
  loadingDelay?: number;
}

interface UseOptimisticActionReturn<T, TArgs extends unknown[]> {
  execute: (...args: TArgs) => Promise<T | null>;
  status: ActionStatus;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: string | null;
  data: T | null;
  reset: () => void;
}

/**
 * Hook for executing async actions with optimistic updates.
 * Immediately updates the UI while the action is in progress,
 * and rolls back on failure.
 */
export function useOptimisticAction<T, TArgs extends unknown[] = []>(
  options: UseOptimisticActionOptions<T, TArgs>
): UseOptimisticActionReturn<T, TArgs> {
  const { action, getOptimisticData, onSuccess, onError, onRollback, loadingDelay = 0 } = options;

  const [state, setState] = useState<OptimisticActionState<T>>({
    status: 'idle',
    data: null,
    error: null,
    isOptimistic: false,
  });

  const optimisticDataRef = useRef<T | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    optimisticDataRef.current = null;
    setState({
      status: 'idle',
      data: null,
      error: null,
      isOptimistic: false,
    });
  }, []);

  const execute = useCallback(
    async (...args: TArgs): Promise<T | null> => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      const optimisticData = getOptimisticData?.(...args) ?? null;
      optimisticDataRef.current = optimisticData;

      if (optimisticData !== null) {
        setState({
          status: 'pending',
          data: optimisticData,
          error: null,
          isOptimistic: true,
        });
      } else if (loadingDelay > 0) {
        loadingTimeoutRef.current = setTimeout(() => {
          setState((prev) => ({
            ...prev,
            status: 'pending',
          }));
        }, loadingDelay);
      } else {
        setState((prev) => ({
          ...prev,
          status: 'pending',
          error: null,
        }));
      }

      try {
        const result = await action(...args);

        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }

        setState({
          status: 'success',
          data: result,
          error: null,
          isOptimistic: false,
        });

        onSuccess?.(result);
        return result;
      } catch (err) {
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }

        const errorMessage = err instanceof Error ? err.message : 'An error occurred';

        onRollback?.(optimisticDataRef.current);

        setState({
          status: 'error',
          data: null,
          error: errorMessage,
          isOptimistic: false,
        });

        onError?.(errorMessage, optimisticDataRef.current);
        optimisticDataRef.current = null;

        return null;
      }
    },
    [action, getOptimisticData, onSuccess, onError, onRollback, loadingDelay]
  );

  return {
    execute,
    status: state.status,
    isLoading: state.status === 'pending',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    error: state.error,
    data: state.data,
    reset,
  };
}

interface OptimisticMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutate?: (variables: TVariables) => TData | void | Promise<TData | void>;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables, context: TData | void) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
}

/**
 * Mutation hook with optimistic update support.
 * Similar to React Query's useMutation but lightweight.
 */
export function useOptimisticMutation<TData, TVariables>(
  options: OptimisticMutationOptions<TData, TVariables>
) {
  const { mutationFn, onMutate, onSuccess, onError, onSettled } = options;

  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TData | undefined>(undefined);
  const contextRef = useRef<TData | void>(undefined);

  const mutate = useCallback(
    async (variables: TVariables) => {
      setIsPending(true);
      setIsSuccess(false);
      setIsError(false);
      setError(null);

      try {
        contextRef.current = await onMutate?.(variables);
        const result = await mutationFn(variables);

        setData(result);
        setIsSuccess(true);
        onSuccess?.(result, variables);
        onSettled?.(result, null, variables);

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setIsError(true);
        onError?.(error, variables, contextRef.current);
        onSettled?.(undefined, error, variables);
        throw error;
      } finally {
        setIsPending(false);
      }
    },
    [mutationFn, onMutate, onSuccess, onError, onSettled]
  );

  const reset = useCallback(() => {
    setIsPending(false);
    setIsSuccess(false);
    setIsError(false);
    setError(null);
    setData(undefined);
    contextRef.current = undefined;
  }, []);

  return {
    mutate,
    mutateAsync: mutate,
    isPending,
    isSuccess,
    isError,
    error,
    data,
    reset,
  };
}

/**
 * Simple state for tracking pending actions without full optimistic support.
 */
export function usePendingAction() {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const startAction = useCallback((id: string) => {
    setPendingIds((prev) => new Set(prev).add(id));
  }, []);

  const endAction = useCallback((id: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isPending = useCallback((id: string) => pendingIds.has(id), [pendingIds]);

  const isAnyPending = pendingIds.size > 0;

  return {
    startAction,
    endAction,
    isPending,
    isAnyPending,
    pendingIds,
  };
}
