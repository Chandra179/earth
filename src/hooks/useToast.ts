import { useCallback, useEffect, useRef, useState } from "react";

export function useToast(durationMs = 2200) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback(
    (msg: string) => {
      setMessage(msg);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { message, show };
}
