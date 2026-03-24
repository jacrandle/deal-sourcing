import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Generic data-fetching hook.
 *
 * @param {Function} fetchFn  - async function that returns data
 * @param {Array}    deps     - dependency array (re-fetches on change)
 * @param {Object}   options
 *   @param {number}  options.pollInterval  - ms between auto-refreshes (0 = off)
 *   @param {boolean} options.immediate     - fetch on mount (default true)
 */
export function useApi(fetchFn, deps = [], { pollInterval = 0, immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (isMountedRef.current) setData(result);
    } catch (err) {
      if (isMountedRef.current) setError(err.message);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    isMountedRef.current = true;
    if (immediate) fetch_();
    return () => { isMountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetch_]);

  useEffect(() => {
    if (!pollInterval) return;
    const id = setInterval(fetch_, pollInterval);
    return () => clearInterval(id);
  }, [fetch_, pollInterval]);

  return { data, loading, error, refetch: fetch_ };
}
