import { useCallback, useRef, useState } from 'react';

// The ref locks immediately, before React renders the disabled state.
export default function useInFlightLock() {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const run = useCallback(async (action) => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    try {
      return await action();
    } finally {
      locked.current = false;
      setPending(false);
    }
  }, []);
  return [pending, run];
}
