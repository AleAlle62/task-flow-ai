import type { PendingGate, RunEvent, RunState } from "./types";

/**
 * The only place in the dashboard that knows the server exists.
 *
 * The token comes from the address the CLI opened. Without it every request is
 * refused, which is what stops another page in this browser from answering a
 * gate on your behalf.
 */
const token = new URLSearchParams(window.location.search).get("t") ?? "";

export async function fetchRun(): Promise<RunState> {
  return getJson<RunState>("/api/run");
}

export async function fetchGate(): Promise<PendingGate | null> {
  return getJson<PendingGate | null>("/api/gate");
}

export async function fetchArtifact(name: string): Promise<string> {
  const response = await fetch(withToken(`/api/artifact?name=${encodeURIComponent(name)}`));

  if (!response.ok) throw new Error(`could not read ${name}`);

  return response.text();
}

export async function answerGate(approved: boolean, note: string): Promise<boolean> {
  const response = await fetch(withToken("/api/gate"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ approved, note }),
  });

  const body = (await response.json()) as { accepted?: boolean };

  return body.accepted === true;
}

/**
 * Follows the run's event log. Returns the function that stops following, so a
 * component can tidy up after itself instead of leaving a stream open.
 */
export function streamEvents(onEvent: (event: RunEvent) => void): () => void {
  const source = new EventSource(withToken("/api/events"));

  source.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data) as RunEvent);
    } catch {
      // A truncated line means the file was mid-write; the next tick resends it.
    }
  };

  return () => source.close();
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(withToken(path));

  if (!response.ok) throw new Error(`${path} answered ${response.status}`);

  return (await response.json()) as T;
}

function withToken(path: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}t=${encodeURIComponent(token)}`;
}
