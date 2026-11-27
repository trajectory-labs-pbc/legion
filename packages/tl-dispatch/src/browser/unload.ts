/** Makes the browser ask before it leaves the page, until the returned function is called. */
export function askBeforeLeaving(): () => void {
  const ask = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    // A browser older than the `preventDefault` form asks only for this.
    event.returnValue = true;
  };
  window.addEventListener("beforeunload", ask);
  return () => window.removeEventListener("beforeunload", ask);
}
