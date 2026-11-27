import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";
import { isDrawn } from "#registry/legion/lib/utils";
import { Heading } from "#registry/legion/ui/heading";
import { Text } from "#registry/legion/ui/text";

interface StateMessageProps {
  /** A 32 px muted icon above the title. */
  icon?: ReactNode;
  /** One line. */
  title: ReactNode;
  /** One sentence that says why. */
  description: ReactNode;
  /** At most one action, with its key. */
  action?: ReactNode;
}

/** The whole width of its column, with the message in the middle. */
function StateMessage({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: StateMessageProps & Omit<ComponentProps<"div">, "title">) {
  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className
      )}
      {...props}
    >
      {isDrawn(icon) ? (
        <div aria-hidden className="mb-2 text-muted-foreground [&>svg]:size-8">
          {icon}
        </div>
      ) : null}
      <Heading className="max-w-full truncate" size="section">
        {title}
      </Heading>
      <Text render={<p />} tone="muted">
        {description}
      </Text>
      {isDrawn(action) ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** A view with nothing to show (ES1, ES2). */
function EmptyState(props: StateMessageProps) {
  return <StateMessage data-slot="empty-state" {...props} />;
}

/** A view whose read failed: announced at once, with its retry as the action. */
function ErrorState(props: StateMessageProps) {
  return <StateMessage data-slot="error-state" role="alert" {...props} />;
}

/** A view whose read is under way: still, with no spinner and no shimmer. `children` is the
 *  view's own placeholder, such as its rows or its frame; `label` is what a reader hears. The
 *  caller waits about 200 ms before it draws this (ES4), so a quick read draws none. */
function LoadingState({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div aria-label={label} className="w-full" data-slot="loading-state" role="status">
      {children}
    </div>
  );
}

export { EmptyState, ErrorState, LoadingState, type StateMessageProps };
