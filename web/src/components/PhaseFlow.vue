<script setup lang="ts">
import type { PhaseRecord } from "@/api/types";
import { humanSeconds, useNow } from "@/composables/useNow";

const props = defineProps<{ phases: PhaseRecord[]; waitingOn?: string }>();

const now = useNow();

/**
 * What a phase is doing, in words rather than a symbol.
 *
 * A running phase shows a clock that keeps moving, because the alternative — a
 * static label while a model thinks for two minutes — is indistinguishable from
 * a pipeline that has died.
 */
function state(phase: PhaseRecord): string {
  if (phase.id === props.waitingOn) return "waiting for you";

  switch (phase.status) {
    case "pending":
      return "not started";
    case "running":
      return `thinking · ${elapsed(phase)}`;
    case "done":
      return phase.durationMs === undefined ? "done" : humanSeconds(phase.durationMs);
    case "failed":
      return "failed";
  }
}

function elapsed(phase: PhaseRecord): string {
  if (!phase.startedAt) return "…";

  return humanSeconds(now.value - Date.parse(phase.startedAt));
}

function classes(phase: PhaseRecord): string[] {
  return [phase.status, phase.id === props.waitingOn ? "waiting" : ""];
}
</script>

<template>
  <ol class="flow">
    <li v-for="(phase, index) in phases" :key="phase.id" class="step" :class="classes(phase)">
      <span v-if="index > 0" class="link" aria-hidden="true" />

      <span class="dot">
        <span class="pulse" />
      </span>

      <span class="name">{{ phase.id.replace(/-ai$/, "") }}</span>
      <span class="state">{{ state(phase) }}</span>
    </li>
  </ol>
</template>

<style scoped>
.flow {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-x: auto;
}

.step {
  position: relative;
  flex: 1 0 118px;
  display: grid;
  justify-items: center;
  gap: 3px;
  padding: 4px 6px 0;
  text-align: center;
}

/* The line that makes six boxes read as one sequence. */
.link {
  position: absolute;
  top: 11px;
  right: 50%;
  left: -50%;
  height: 2px;
  background: var(--line);
}

.dot {
  position: relative;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 2px solid var(--line);
  background: var(--bg);
  z-index: 1;
  margin-bottom: 4px;
}

.name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.state {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
  white-space: nowrap;
}

.pending .name {
  color: var(--faint);
  font-weight: 500;
}

.done .dot {
  border-color: var(--green);
  background: var(--green);
}

.done .link {
  background: var(--green);
}

.running .dot {
  border-color: var(--accent);
}

.running .state {
  color: var(--accent);
}

.failed .dot {
  border-color: var(--red);
  background: var(--red);
}

.failed .state {
  color: var(--red);
}

.waiting .dot {
  border-color: var(--amber);
  background: var(--amber);
}

.waiting .state {
  color: var(--amber);
  font-weight: 600;
}

/* Only the phase that is actually working breathes. */
.running .pulse,
.waiting .pulse {
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 2px solid currentColor;
  color: var(--accent);
  animation: breathe 1.8s ease-out infinite;
}

.waiting .pulse {
  color: var(--amber);
}

@keyframes breathe {
  0% {
    opacity: 0.55;
    transform: scale(0.8);
  }
  100% {
    opacity: 0;
    transform: scale(1.35);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pulse {
    animation: none;
  }
}
</style>
