// The page's `?q=` term, which the aids open folds by.
import { useMemo } from "react";

import { useAddress } from "@/navigation/hooks";
import { firstHighlightTerm } from "@/upstream/editor/frame";

/** The page's `?q=` term, as upstream highlights it. */
export function useHighlightTerm(): string | undefined {
  const { search } = useAddress();
  return useMemo(() => firstHighlightTerm(new URLSearchParams(search).get("q") ?? ""), [search]);
}
