import { useState, useCallback } from 'react';

export function useToast(durationMs = 3500) {
  const [toast, setToast] = useState(null);

  const notify = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), durationMs);
  }, [durationMs]);

  return { toast, notify };
}
