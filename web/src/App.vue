<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";

import ArtifactPanel from "@/components/ArtifactPanel.vue";
import EventLog from "@/components/EventLog.vue";
import GatePanel from "@/components/GatePanel.vue";
import NowLine from "@/components/NowLine.vue";
import PhaseStepper from "@/components/PhaseStepper.vue";
import RunMeters from "@/components/RunMeters.vue";
import TaskForm from "@/components/TaskForm.vue";
import { useRunStore } from "@/stores/run";

const store = useRunStore();
const stale = ref(false);

/** Which phase's document is on screen. Unset means: follow the run. */
const showing = ref<string | undefined>();

/** A new run is a clean slate: stop showing a document from the last one. */
watch(() => store.run?.id, () => (showing.value = undefined));

onMounted(() => store.connect());
onUnmounted(() => store.disconnect());

/**
 * A refused answer means the run had already moved on — this page was showing a
 * question nobody is waiting on any more. Saying so beats pretending it worked.
 */
async function decide(approved: boolean, note: string): Promise<void> {
  stale.value = !(await store.decide(approved, note));
}
</script>

<template>
  <main>
    <TaskForm v-if="!store.run" :busy="store.starting" @submit="store.start" />

    <template v-else>
      <header class="bar">
        <div class="titles">
          <h1>{{ store.run.task }}</h1>
          <p class="where tabular">{{ store.run.id }}</p>
        </div>

        <PhaseStepper :steps="store.steps" :showing="showing" @show="showing = $event" />
      </header>

      <NowLine
        :status="store.run.status"
        :active="store.activePhase"
        :waiting-on="store.gate?.phase"
      />

      <RunMeters
        :started-at="store.run.startedAt"
        :ended-at="store.run.endedAt"
        :cost-usd="store.totals.costUsd"
        :tokens-in="store.totals.tokensIn"
        :tokens-out="store.totals.tokensOut"
        :done="store.totals.done"
        :of="store.totals.of"
      />

      <GatePanel v-if="store.gate" :gate="store.gate" @decide="decide" />

      <TaskForm v-if="store.needsTask" compact :busy="store.starting" @submit="store.start" />

      <p v-if="stale" class="error">
        That question had already been answered — this page was out of date.
      </p>

      <ArtifactPanel :phases="store.phases" :showing="showing" />

      <details v-if="store.events.length > 0">
        <summary>Events</summary>
        <EventLog :events="store.events" />
      </details>
    </template>

    <p v-if="store.error" class="error">{{ store.error }}</p>
  </main>
</template>

<style scoped>
main {
  max-width: 1020px;
  margin: 0 auto;
  padding: 0 24px 72px;
  display: grid;
  gap: 18px;
  align-content: start;
}

/*
 * The steps stay in view while you scroll an artifact: knowing where the run is
 * matters more than the four lines of text the header would otherwise cost.
 */
.bar {
  position: sticky;
  top: 0;
  z-index: 5;
  background: color-mix(in srgb, var(--ground) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line-soft);
  margin: 0 -24px;
  padding: 18px 24px 14px;
  display: grid;
  gap: 16px;
}

.titles {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

h1 {
  margin: 0;
  font-family: var(--serif);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.where {
  margin: 0;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
  white-space: nowrap;
  flex: none;
}

/* Side by side needs room the phone does not have; below it, they stack. */
@media (max-width: 620px) {
  .titles {
    display: block;
  }

  .where {
    margin-top: 4px;
  }

  .bar {
    margin: 0 -16px;
    padding: 14px 16px 12px;
  }

  main {
    padding: 0 16px 56px;
  }
}

.error {
  margin: 0;
  color: var(--writes);
  font-size: 13px;
}

summary {
  cursor: pointer;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
  text-transform: uppercase;
  letter-spacing: 0.09em;
}

details[open] summary {
  margin-bottom: 10px;
}
</style>
