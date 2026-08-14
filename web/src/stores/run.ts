import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { answerGate, fetchGate, fetchRun, streamEvents } from "@/api/client";
import type { PendingGate, RunEvent, RunState } from "@/api/types";

/** How often the run state is refetched, in case an event was missed. */
const REFRESH_MS = 1500;

/**
 * The state of the page: what the run is doing, what it has said, and whether
 * it is waiting for an answer.
 *
 * Components read from here and never call the server themselves. The events
 * arrive live; the run state is refetched on a slow timer as well, so a dropped
 * connection shows stale data for a second rather than forever.
 */
export const useRunStore = defineStore("run", () => {
  const run = ref<RunState | undefined>();
  const events = ref<RunEvent[]>([]);
  const gate = ref<PendingGate | null>(null);
  const error = ref<string | undefined>();

  let stopStream: (() => void) | undefined;
  let timer: number | undefined;

  const phases = computed(() => run.value?.phases ?? []);

  const isWaiting = computed(() => gate.value !== null);

  const isOver = computed(
    () => run.value !== undefined && run.value.status !== "running",
  );

  async function refresh(): Promise<void> {
    try {
      run.value = await fetchRun();
      gate.value = await fetchGate();
      error.value = undefined;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  function connect(): void {
    void refresh();

    stopStream = streamEvents((event) => {
      events.value = [...events.value, event];
      if (event.type.startsWith("gate_") || event.type.startsWith("phase_")) void refresh();
    });

    timer = window.setInterval(() => void refresh(), REFRESH_MS);
  }

  function disconnect(): void {
    stopStream?.();
    if (timer !== undefined) window.clearInterval(timer);
  }

  /** Returns false when the run had already moved on — a click arriving too late. */
  async function decide(approved: boolean, note: string): Promise<boolean> {
    const accepted = await answerGate(approved, note);

    await refresh();

    return accepted;
  }

  return { run, events, gate, error, phases, isWaiting, isOver, connect, disconnect, decide, refresh };
});
