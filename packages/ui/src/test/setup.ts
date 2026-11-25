// The DOM APIs Base UI reads that happy-dom lacks, as stand-ins that measure zero.

import { afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;

Element.prototype.getAnimations ??= () => [];
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};

// A failed expectation prints a node as its markup, not happy-dom's whole object graph, which
// takes seconds and runs on every retry inside waitFor.
Object.defineProperty(Node.prototype, Bun.inspect.custom, {
  value(this: Node) {
    return this instanceof Element ? this.outerHTML.slice(0, 200) : this.nodeName;
  },
});
