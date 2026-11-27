import { headingVariants } from "@legion/ui/lib/typography";
import { cn } from "@legion/ui/lib/utils";
import { PageLink } from "@/navigation/page-link";
import { routes } from "@/navigation/routes";

const NAME = cn(
  headingVariants({ size: "group" }),
  "flex h-control-sm shrink-0 items-center truncate px-2"
);

/** The app's name at the top of the sidebar, the drawer and the narrow header: a link home. */
export function AppName({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <PageLink
      className={cn(
        NAME,
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className
      )}
      onClick={onClick}
      page={routes.inbox.home}
    >
      Dispatch
    </PageLink>
  );
}

/** The app's name as text, where a link would read before sign-in is known. */
export function AppNameText() {
  return <span className={NAME}>Dispatch</span>;
}
