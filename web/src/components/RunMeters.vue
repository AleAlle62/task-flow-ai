<script setup lang="ts">
import { computed } from "vue";

import { humanSeconds, useNow } from "@/composables/useNow";

const props = defineProps<{
  startedAt?: string;
  endedAt?: string;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  done: number;
  of: number;
}>();

const now = useNow();

/** Stops counting when the run does, rather than ticking on after the end. */
const elapsed = computed(() => {
  if (!props.startedAt) return "—";

  const until = props.endedAt ? Date.parse(props.endedAt) : now.value;

  return humanSeconds(until - Date.parse(props.startedAt));
});

/** Thousands, because six figures of tokens is a number nobody reads. */
function compact(value: number): string {
  if (value === 0) return "—";
  if (value < 1000) return String(value);

  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
}

const cost = computed(() => (props.costUsd > 0 ? `$${props.costUsd.toFixed(3)}` : "—"));
</script>

<template>
  <dl class="meters">
    <div class="meter">
      <dt>elapsed</dt>
      <dd class="tabular">{{ elapsed }}</dd>
    </div>

    <div class="meter">
      <dt>phases</dt>
      <dd class="tabular">{{ props.done }}<span class="of">/{{ props.of }}</span></dd>
    </div>

    <div class="meter">
      <dt>tokens read</dt>
      <dd class="tabular">{{ compact(props.tokensIn) }}</dd>
    </div>

    <div class="meter">
      <dt>tokens written</dt>
      <dd class="tabular">{{ compact(props.tokensOut) }}</dd>
    </div>

    <div class="meter">
      <dt>cost</dt>
      <dd class="tabular">{{ cost }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.meters {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  overflow: hidden;
}

.meter {
  flex: 1 1 110px;
  padding: 10px 14px;
  border-right: 1px solid var(--line-soft);
  display: grid;
  gap: 1px;
}

.meter:last-child {
  border-right: none;
}

dt {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--faint);
}

dd {
  margin: 0;
  font-family: var(--mono);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.of {
  color: var(--faint);
  font-weight: 400;
  font-size: 13px;
}
</style>
