import { defineStore } from "pinia";
import { computed, ref } from "vue";

import {
  answerGate,
  fetchGate,
  fetchPlan,
  fetchRun,
  isAwaitingTask,
  streamEvents,
  submitTask,
} from "@/api/client";
import type {
  PendingGate,
  PhaseStatus,
  PlannedPhase,
  RunEvent,
  RunState,
} from "@/api/types";

/**
 * One phase as the page draws it: what the pipeline says it is, plus whatever
 * has happened to it so far.
 *
 * The two are merged here rather than in a component because the page shows the
 * same six steps before the run exists and while it runs — the first time as a
 * promise, the second as progress — and only the status underneath changes.
 */
export interface Step {
  id: string;
  output: string;
  canWrite: boolean;
  status: PhaseStatus;
  waiting: boolean;
  startedAt?: string;
  durationMs?: number;
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

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
  const plan = ref<PlannedPhase[]>([]);
  const events = ref<RunEvent[]>([]);
  const gate = ref<PendingGate | null>(null);
  const needsTask = ref(false);
  const error = ref<string | undefined>();

  let stopStream: (() => void) | undefined;
  let timer: number | undefined;

  const phases = computed(() => run.value?.phases ?? []);

  /** The six steps, from the pipeline, wearing whatever has happened to them. */
  const steps = computed<Step[]>(() => {
    const shape = plan.value.length > 0 ? plan.value : phases.value.map(asPlanned);

    return shape.map((planned) => {
      const record = phases.value.find((phase) => phase.id === planned.id);

      return {
        ...planned,
        status: record?.status ?? "pending",
        waiting: gate.value?.phase === planned.id,
        ...(record?.startedAt ? { startedAt: record.startedAt } : {}),
        ...(record?.durationMs === undefined ? {} : { durationMs: record.durationMs }),
        ...(record?.costUsd === undefined ? {} : { costUsd: record.costUsd }),
        ...(record?.tokensIn === undefined ? {} : { tokensIn: record.tokensIn }),
        ...(record?.tokensOut === undefined ? {} : { tokensOut: record.tokensOut }),
        ...(record?.error ? { error: record.error } : {}),
      };
    });
  });

  /** The step the eye should be on: the one waiting for you, else the one working. */
  const currentStep = computed<Step | undefined>(
    () =>
      steps.value.find((step) => step.waiting) ??
      steps.value.find((step) => step.status === "running") ??
      [...steps.value].reverse().find((step) => step.status !== "pending"),
  );

  /** What the run has spent so far, in the three currencies worth watching. */
  const totals = computed(() => ({
    costUsd: run.value?.totalCostUsd ?? 0,
    tokensIn: sum(steps.value.map((step) => step.tokensIn)),
    tokensOut: sum(steps.value.map((step) => step.tokensOut)),
    done: steps.value.filter((step) => step.status === "done").length,
    of: steps.value.length,
  }));

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
    void loadPlan();
    void refresh();
    timer = window.setInterval(() => void refresh(), REFRESH_MS);
  }

  /**
   * Asked for once. The flow comes from a file that was read before the server
   * started, so it cannot change while the page is open.
   */
  async function loadPlan(): Promise<void> {
    try {
      plan.value = await fetchPlan();
    } catch {
      // The run state carries the same phases once there is a run.
    }
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
    const phase = gate.value?.phase;
    if (!phase) return false;

    const accepted = await answerGate(phase, approved, note);

    await refresh();

    return accepted;
  }

  return {
    run,
    plan,
    events,
    gate,
    needsTask,
    error,
    phases,
    steps,
    currentStep,
    totals,
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

function asPlanned(phase: { id: string; output: string }): PlannedPhase {
  return { ...phase, canWrite: false };
}

function sum(values: (number | undefined)[]): number {
  return values.reduce((total: number, value) => total + (value ?? 0), 0);
}
