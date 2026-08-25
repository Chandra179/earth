import { useEffect, type DependencyList } from "react";

/**
 * Reads location.hash once on mount (passing the parsed params to `onLoad`),
 * then serializes state back via history.replaceState whenever `deps` change.
 */
export function useUrlState(onLoad: (params: URLSearchParams) => void, toHash: () => string, deps: DependencyList) {
  useEffect(() => {
    onLoad(new URLSearchParams(location.hash.replace(/^#/, "")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      history.replaceState(null, "", "#" + toHash());
    } catch {
      /* file:// may block */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
