<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import ArtifactPanel from "@/components/ArtifactPanel.vue";
import EventLog from "@/components/EventLog.vue";
import GatePanel from "@/components/GatePanel.vue";
import PhaseFlow from "@/components/PhaseFlow.vue";
import { useRunStore } from "@/stores/run";

const store = useRunStore();
const stale = ref(false);

onMounted(() => store.connect());
onUnmounted(() => store.disconnect());

/**
 * A rejected answer means the run had already moved on — the page was showing a
 * question nobody is waiting on any more. Saying so is better than pretending
 * the click worked.
 */
async function decide(approved: boolean, note: string): Promise<void> {
  stale.value = !(await store.decide(approved, note));
}
</script>

<template>
  <main>
    <header class="top">
      <h1>{{ store.run?.task ?? "…" }}</h1>
      <p class="where">
        <span :class="['status', store.run?.status]">{{ store.run?.status ?? "connecting" }}</span>
        <span v-if="store.run">· {{ store.run.id }}</span>
        <span v-if="store.run && store.run.totalCostUsd > 0">
          · ${{ store.run.totalCostUsd.toFixed(4) }}
        </span>
      </p>
    </header>

    <p v-if="store.error" class="error">{{ store.error }}</p>

    <PhaseFlow :phases="store.phases" :waiting-on="store.gate?.phase" />

    <GatePanel v-if="store.gate" :gate="store.gate" @decide="decide" />

    <p v-if="stale" class="error">
      That question had already been answered — this page was out of date.
    </p>

    <ArtifactPanel :phases="store.phases" />

    <details>
      <summary>Events</summary>
      <EventLog :events="store.events" />
    </details>
  </main>
</template>

<style scoped>
main {
  max-width: 1000px;
  margin: 0 auto;
  padding: 34px 24px 60px;
  display: grid;
  gap: 22px;
}

h1 {
  margin: 0 0 4px;
  font-size: 21px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.where {
  margin: 0;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--faint);
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.status {
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.status.running {
  color: var(--accent);
}

.status.done {
  color: var(--green);
}

.status.failed {
  color: var(--red);
}

.status.stopped {
  color: var(--amber);
}

.error {
  margin: 0;
  color: var(--red);
  font-size: 13px;
}

summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--faint);
  text-transform: uppercase;
  letter-spacing: 0.9px;
  font-weight: 650;
}

details[open] summary {
  margin-bottom: 10px;
}
</style>
