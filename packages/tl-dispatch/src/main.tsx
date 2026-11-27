import { start } from "./app/start";
import { installChunkFailureRecovery } from "./upstream/shell";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Dispatch could not find its root element.");
}

// Before the first render, so a chunk a deploy removed reloads the page even on first paint.
installChunkFailureRecovery();
start(root);
