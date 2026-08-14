<script setup lang="ts">
import type { PhaseRecord } from "@/api/types";

defineProps<{ phases: PhaseRecord[]; waitingOn?: string }>();

const SYMBOL: Record<PhaseRecord["status"], string> = {
  pending: "○",
  running: "◐",
  done: "●",
  failed: "✕",
};

function seconds(phase: PhaseRecord): string {
  return phase.durationMs === undefined ? "" : `${(phase.durationMs / 1000).toFixed(1)}s`;
}
</script>

<template>
  <ol class="flow">
    <li
      v-for="phase in phases"
      :key="phase.id"
      class="phase"
      :class="[phase.status, { waiting: phase.id === waitingOn }]"
    >
      <span class="mark">{{ SYMBOL[phase.status] }}</span>
      <span class="name">{{ phase.id }}</span>
      <span class="meta">{{ phase.id === waitingOn ? "waiting for you" : seconds(phase) }}</span>
    </li>
  </ol>
</template>

<style scoped>
.flow {
  display: flex;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-x: auto;
}

.phase {
  flex: 1 0 128px;
  display: grid;
  gap: 2px;
  padding: 11px 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
}

.mark {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--faint);
}

.name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.meta {
  font-size: 11px;
  color: var(--faint);
  font-family: var(--mono);
  min-height: 16px;
}

.running {
  border-color: var(--accent);
}

.running .mark {
  color: var(--accent);
}

.done .mark {
  color: var(--green);
}

.failed {
  border-color: var(--red);
}

.failed .mark {
  color: var(--red);
}

.waiting {
  border-color: var(--amber);
}

.waiting .mark,
.waiting .meta {
  color: var(--amber);
}
</style>
