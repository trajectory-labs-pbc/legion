import { Button } from "@legion/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@legion/ui/components/dropdown-menu";
import { textVariants } from "@legion/ui/lib/typography";
import { ChevronsUpDownIcon, UserIcon } from "lucide-react";
import { commandStore } from "@/commands/command-store";
import { useCommand } from "@/commands/use-command";
import { PageLink } from "@/navigation/page-link";
import { routes } from "@/navigation/routes";

/** The account's button and menu: the reader's own page, and Sign out. Sign out sits in the menu:
 *  two deliberate steps, never one stray click; it is the palette's Sign out command, run as the
 *  palette runs it. Its own chunk: the menu's popup code is not needed for first paint. */
export function AccountMenu({
  login,
  onNavigate,
}: {
  login: string;
  /** Called when the reader opens their page, so a drawer closes. */
  onNavigate?: () => void;
}) {
  const signOut = useCommand("global.sign-out");
  const SignOutIcon = signOut?.command.icon;
  // The shell shuts the command while a sign-out is under way.
  const pending = signOut?.enabled === false;
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
          render={<PageLink onClick={onNavigate} page={routes.people.person} params={{ login }} />}
        >
          <UserIcon aria-hidden data-icon="inline-start" />
          Your page
        </DropdownMenuItem>
        {signOut === undefined ? null : (
          <DropdownMenuItem
            disabled={!signOut.enabled}
            onClick={() => commandStore.run("global.sign-out")}
          >
            {SignOutIcon === undefined ? null : (
              <SignOutIcon aria-hidden data-icon="inline-start" />
            )}
            {signOut.label}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
