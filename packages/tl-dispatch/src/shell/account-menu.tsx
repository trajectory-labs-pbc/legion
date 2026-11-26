import { Button } from "@legion/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@legion/ui/components/dropdown-menu";
import { textVariants } from "@legion/ui/lib/typography";
import { ChevronsUpDownIcon, LogOutIcon, UserIcon } from "lucide-react";
import { PageLink } from "@/navigation/page-link";
import { people } from "@/pages/people";

/** The account's button and menu: the reader's own page, and Sign out. Sign out sits in the menu:
 *  two deliberate steps, never one stray click. Its own chunk: the menu's popup code is not needed
 *  for first paint. */
export function AccountMenu({
  login,
  onNavigate,
  onSignOut,
  pending,
}: {
  login: string;
  /** Called when the reader opens their page, so a drawer closes. */
  onNavigate?: () => void;
  onSignOut: () => void;
  /** A sign-out is under way. */
  pending: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        render={
          <Button className="w-full justify-start" loading={pending} size="sm" variant="ghost" />
        }
      >
        <span
          className={textVariants({
            className: "min-w-0 flex-1 truncate text-left",
            size: "caption",
            tone: "muted",
          })}
        >
          Signed in as {login}
        </span>
        <ChevronsUpDownIcon aria-hidden data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--anchor-width)" side="top">
        <DropdownMenuItem
          render={<PageLink onClick={onNavigate} page={people.routes.person} params={{ login }} />}
        >
          <UserIcon aria-hidden />
          Your page
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSignOut}>
          <LogOutIcon aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
