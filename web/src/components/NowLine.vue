<script setup lang="ts">
import { computed } from "vue";

import type { PhaseRecord, RunStatus } from "@/api/types";
import { humanSeconds, useNow } from "@/composables/useNow";

const props = defineProps<{
  status?: RunStatus;
  active?: PhaseRecord;
  waitingOn?: string;
}>();

const now = useNow();

/**
 * One sentence saying what is happening this second.
 *
 * A phase can think for minutes in silence. Saying "reading your code, 47s so
 * far" is the difference between a person waiting and a person reaching for
 * ctrl-C.
 */
const WORK: Record<string, string> = {
  "intake-ai": "working out what you actually asked for",
  "explore-ai": "reading your code",
  "plan-ai": "writing the plan",
  "implement-ai": "changing your code",
  "review-ai": "rereading the change",
  "security-ai": "looking for security problems",
};

const message = computed(() => {
  if (props.waitingOn) return "waiting for your decision";
  if (props.status === "done") return "finished";
  if (props.status === "failed") return "stopped by an error";
  if (props.status === "stopped") return "stopped — you rejected the plan";

  const phase = props.active;
  if (!phase) return "starting";

  return WORK[phase.id] ?? `running ${phase.id}`;
});

const since = computed(() => {
  const startedAt = props.active?.startedAt;
  if (!startedAt || props.waitingOn) return "";

  return humanSeconds(now.value - Date.parse(startedAt));
});

const tone = computed(() => {
  if (props.waitingOn) return "waiting";
  if (props.status && props.status !== "running") return props.status;

  return "working";
});
</script>

<template>
  <p class="now" :class="tone">
    <span class="beacon" aria-hidden="true" />
    <span class="what">{{ message }}</span>
    <span v-if="since" class="since">{{ since }}</span>
  </p>
</template>

<style scoped>
.now {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  font-size: 13.5px;
}

.beacon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--faint);
  flex: none;
}

.since {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--faint);
}

.working .beacon {
  background: var(--accent);
  animation: blink 1.4s ease-in-out infinite;
}

.waiting {
  border-color: var(--amber);
}

.waiting .beacon {
  background: var(--amber);
}

.waiting .what {
  color: var(--amber);
  font-weight: 600;
}

.done .beacon {
  background: var(--green);
}

.failed .beacon {
  background: var(--red);
}

.failed .what {
  color: var(--red);
}

@keyframes blink {
  50% {
    opacity: 0.25;
  }
}

@media (prefers-reduced-motion: reduce) {
  .beacon {
    animation: none;
  }
}
</style>
