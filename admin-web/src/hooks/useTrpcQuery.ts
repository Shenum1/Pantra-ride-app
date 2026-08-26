import { useCallback, useEffect, useRef, useState } from 'react';
import { trpcQuery } from '../lib/api';

export function useTrpcQuery<T>(procedure: string, input?: unknown, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    trpcQuery<T>(procedure, inputRef.current)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procedure, ...deps]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch, setData };
}
