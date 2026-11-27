import { type AidActions, useAidCommands } from "./aid-commands";
import type { PartsProps } from "./parts-slot";

function AidCommands({ actions }: { actions: AidActions }): null {
  useAidCommands(actions);
  return null;
}

/** The parts above the document's text, drawn into its parts root; the shown one holds the keys. */
export function AidParts({ shown }: PartsProps) {
  return shown ? <AidCommands actions={{}} /> : null;
}
