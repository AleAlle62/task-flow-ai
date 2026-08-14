import { defineStore } from "pinia";
import { computed, ref } from "vue";

import {
  answerGate,
  fetchGate,
  fetchRun,
  isAwaitingTask,
  streamEvents,
  submitTask,
} from "@/api/client";
import type { PendingGate, RunEvent, RunState } from "@/api/types";

/** How often the run state is refetched, in case an event was missed. */
const REFRESH_MS = 1500;

/**
 * The state of the page: what the run is doing, what it has said, and what it
 * is waiting for.
 *
 * Components read from here and never call the server themselves. Events
 * arrive live; the run state is also refetched on a slow timer, so a dropped
 * connection shows stale data for a second rather than forever.
 */
export const useRunStore = defineStore("run", () => {
  const run = ref<RunState | null>(null);
  const events = ref<RunEvent[]>([]);
  const gate = ref<PendingGate | null>(null);
  const needsTask = ref(false);
  const error = ref<string | undefined>();

  let stopStream: (() => void) | undefined;
  let timer: number | undefined;

  const phases = computed(() => run.value?.phases ?? []);

  /** The phase working right now, if any. Drives the "what is happening" line. */
  const activePhase = computed(() => phases.value.find((phase) => phase.status === "running"));

  const isWaiting = computed(() => gate.value !== null);

  const isOver = computed(() => run.value !== null && run.value.status !== "running");

  async function refresh(): Promise<void> {
    try {
      const [state, question, awaiting] = await Promise.all([
        fetchRun(),
        fetchGate(),
        isAwaitingTask(),
      ]);

      run.value = state;
      gate.value = question;
      needsTask.value = awaiting;
      error.value = undefined;

      if (state && !stopStream) follow();
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  /** The event stream only exists once a run does. */
  function follow(): void {
    stopStream = streamEvents((event) => {
      events.value = [...events.value, event];
      if (event.type.startsWith("gate_") || event.type.startsWith("phase_")) void refresh();
    });
  }

  function connect(): void {
    void refresh();
    timer = window.setInterval(() => void refresh(), REFRESH_MS);
  }

  function disconnect(): void {
    stopStream?.();
    if (timer !== undefined) window.clearInterval(timer);
  }

  async function start(task: string): Promise<void> {
    await submitTask(task);
    await refresh();
  }

  /** False when the run had already moved on — a click arriving too late. */
  async function decide(approved: boolean, note: string): Promise<boolean> {
    const accepted = await answerGate(approved, note);

    await refresh();

    return accepted;
  }

  return {
    run,
    events,
    gate,
    needsTask,
    error,
    phases,
    activePhase,
    isWaiting,
    isOver,
    connect,
    disconnect,
    start,
    decide,
    refresh,
  };
});
