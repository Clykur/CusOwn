import { useState, useCallback } from 'react';

export function useOptimisticUpdate<T>(
  initialData: T,
  updateFn: (data: T, optimisticData: Partial<T>) => T
) {
  const [data, setData] = useState<T>(initialData);
  const [isOptimistic, setIsOptimistic] = useState(false);

  const updateOptimistic = useCallback(
    (optimisticData: Partial<T>) => {
      const newData = updateFn(data, optimisticData);
      setData(newData);
      setIsOptimistic(true);
      return newData;
    },
    [data, updateFn]
  );

  const confirmUpdate = useCallback((confirmedData: T) => {
    setData(confirmedData);
    setIsOptimistic(false);
  }, []);

  const rollbackUpdate = useCallback((originalData: T) => {
    setData(originalData);
    setIsOptimistic(false);
  }, []);

  return {
    data,
    isOptimistic,
    updateOptimistic,
    confirmUpdate,
    rollbackUpdate,
  };
}
