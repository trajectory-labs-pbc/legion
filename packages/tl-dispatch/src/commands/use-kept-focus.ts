import { type Ref, type RefCallback, useCallback, useRef } from "react";

/**
 * A ref for a control that is drawn again as another element, such as one a tooltip wraps once
 * the tooltip's code arrives: the new element takes the focus if the old one held it. `own` is
 * the control's own ref, which follows it.
 */
export function useKeptFocus<Element extends HTMLElement>(
  own?: Ref<Element>
): RefCallback<Element> {
  const held = useRef<Element | null>(null);
  const hadFocus = useRef(false);
  return useCallback(
    (node: Element | null) => {
      // React detaches the old control's ref before it removes the control, and attaches the
      // new one's in the same commit; a later attach never takes the focus.
      if (node === null) {
        hadFocus.current = document.activeElement === held.current;
        queueMicrotask(() => {
          hadFocus.current = false;
        });
      } else if (hadFocus.current) {
        hadFocus.current = false;
        node.focus();
      }
      held.current = node;
      if (typeof own === "function") own(node);
      else if (own !== null && own !== undefined) own.current = node;
    },
    [own]
  );
}
