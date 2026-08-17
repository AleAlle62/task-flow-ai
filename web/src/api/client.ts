import type { PendingGate, PlannedPhase, RunEvent, RunState } from "./types";

/**
 * The only place in the dashboard that knows the server exists.
 *
 * The token comes from the address the CLI opened. Without it every request is
 * refused, which is what stops another page in this browser from answering a
 * gate on your behalf.
 */
const token = new URLSearchParams(window.location.search).get("t") ?? "";

/** Null until the run exists — the page opens before anything is decided. */
export async function fetchRun(): Promise<RunState | null> {
  return getJson<RunState | null>("/api/run");
}

/** The flow this run will follow, known from the pipeline file before it starts. */
export async function fetchPlan(): Promise<PlannedPhase[]> {
  return (await getJson<{ phases: PlannedPhase[] }>("/api/plan")).phases;
}

export async function isAwaitingTask(): Promise<boolean> {
  return (await getJson<{ waiting: boolean }>("/api/task")).waiting;
}

export async function submitTask(task: string): Promise<boolean> {
  const response = await fetch(withToken("/api/task"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task }),
  });

  const body = (await response.json()) as { accepted?: boolean };

  return body.accepted === true;
}

export async function fetchGate(): Promise<PendingGate | null> {
  return getJson<PendingGate | null>("/api/gate");
}

export async function fetchArtifact(name: string): Promise<string> {
  const response = await fetch(withToken(`/api/artifact?name=${encodeURIComponent(name)}`));

  if (!response.ok) throw new Error(`could not read ${name}`);

  return response.text();
}

/**
 * The phase is named in the answer, not left implicit. A second tab still
 * showing yesterday's question must not be able to approve today's.
 */
export async function answerGate(
  phase: string,
  approved: boolean,
  note: string,
): Promise<boolean> {
  const response = await fetch(withToken("/api/gate"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phase, approved, note }),
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
