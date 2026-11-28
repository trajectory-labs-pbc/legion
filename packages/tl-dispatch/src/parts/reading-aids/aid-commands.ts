import { defineActions, whenPresent } from "@/commands/actions";
import { appCatalog } from "@/commands/app-catalog";
import { useRegisterCommands } from "@/commands/use-register-commands";

/** What the aids' keys do on the document that shows; an absent action shuts its command's gate. */
export interface AidActions {
  nextDecision?: () => void;
  previousDecision?: () => void;
  toggleOnlyChanges?: () => void;
  nextHeading?: () => void;
  previousHeading?: () => void;
  toggleFolds?: () => void;
}

const useAidActions = defineActions(appCatalog, "reading-aids", (actions: AidActions) => ({
  "next-decision": whenPresent(actions.nextDecision),
  "previous-decision": whenPresent(actions.previousDecision),
  "toggle-only-changes": whenPresent(actions.toggleOnlyChanges),
  "next-heading": whenPresent(actions.nextHeading),
  "previous-heading": whenPresent(actions.previousHeading),
  "toggle-folds": whenPresent(actions.toggleFolds),
}));

/** Registers the aids' commands for the one document that shows. */
export function useAidCommands(actions: AidActions): void {
  useRegisterCommands(appCatalog, "reading-aids", useAidActions(actions));
}
