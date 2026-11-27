// The marks that tell upstream's DOM from the fork's, for the axe run and the one-primary check.
import type { ComponentType, ReactNode } from "react";

/** An upstream component drawn inside the upstream mark, which gives no box. */
export function upstreamView<Props extends object>(
  Component: ComponentType<Props>
): ComponentType<Props> {
  function UpstreamView(props: Props) {
    return (
      <span className="contents" data-upstream-view>
        <Component {...props} />
      </span>
    );
  }
  UpstreamView.displayName = `upstreamView(${Component.displayName ?? Component.name})`;
  return UpstreamView;
}

/** The fork mark's attribute, which fork DOM drawn outside React inside a marked view carries too. */
export const FORK_VIEW_ATTRIBUTE = "data-fork-view";

/** Fork elements that a fork part passes into a marked upstream component. */
export function ForkView({ children }: { children: ReactNode }) {
  return (
    <span className="contents" {...{ [FORK_VIEW_ATTRIBUTE]: true }}>
      {children}
    </span>
  );
}
