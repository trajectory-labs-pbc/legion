import { start } from "./start";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Dispatch could not find its root element.");
}

start(root);
