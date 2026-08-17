<script setup lang="ts">
import { computed } from "vue";

import type { RunEvent } from "@/api/types";

const props = defineProps<{ events: RunEvent[] }>();

/** Newest first: what just happened is what you are looking for. */
const recent = computed(() => [...props.events].reverse());

function time(event: RunEvent): string {
  return event.ts.slice(11, 19);
}

/** Everything except the fields every event already carries. */
function detail(event: RunEvent): string {
  const { ts, run, type, ...rest } = event;

  void ts;
  void run;
  void type;

  const parts = Object.entries(rest).map(([key, value]) => `${key}=${format(value)}`);

  return parts.join(" ");
}

function format(value: unknown): string {
  if (typeof value === "number") return value.toFixed(value % 1 === 0 ? 0 : 4);
  if (typeof value === "string") return value.length > 60 ? `${value.slice(0, 60)}…` : value;

  return JSON.stringify(value);
}
</script>

<template>
  <ol class="log">
    <li v-for="(event, index) in recent" :key="index">
      <span class="time">{{ time(event) }}</span>
      <span class="type" :class="event.type">{{ event.type }}</span>
      <span class="detail">{{ detail(event) }}</span>
    </li>
  </ol>
</template>

<style scoped>
.log {
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: var(--mono);
  font-size: 11.5px;
  max-height: 30vh;
  overflow: auto;
}

li {
  display: flex;
  gap: 9px;
  padding: 3px 0;
  border-bottom: 1px solid var(--line);
}

.time {
  color: var(--faint);
}

.type {
  color: var(--dim);
  min-width: 128px;
}

.detail {
  color: var(--faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phase_failed,
.write_paths_violated {
  color: var(--writes);
}

.gate_opened,
.gate_answered {
  color: var(--waiting);
}
</style>
