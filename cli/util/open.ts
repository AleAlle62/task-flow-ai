import { spawn } from "node:child_process";

const OPENERS: Record<string, string> = {
  darwin: "open",
  win32: "start",
  linux: "xdg-open",
};

/**
 * Opens the dashboard in whatever browser this machine uses.
 *
 * Failing to open is not an error: the address has already been printed, and a
 * machine with no browser — a server, a container — is a perfectly normal place
 * to run this from.
 */
export function openInBrowser(url: string): void {
  const opener = OPENERS[process.platform];
  if (!opener) return;

  try {
    const child = spawn(opener, [url], { stdio: "ignore", detached: true });

    /* A missing opener is reported on this event, not thrown — and an "error"
     * event nobody listens for is an uncaught exception, which would take down
     * a run for the sake of a browser window that was never essential. */
    child.on("error", () => {});
    child.unref();
  } catch {
    // The URL is on screen; that is enough.
  }
}
