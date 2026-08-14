<script setup lang="ts">
import { ref, watch } from "vue";

import { fetchArtifact } from "@/api/client";
import type { PhaseRecord } from "@/api/types";

const props = defineProps<{ phases: PhaseRecord[] }>();

const selected = ref<string | undefined>();
const text = ref("");
const failed = ref(false);

/** Only phases that finished have something to read. */
function readable(): PhaseRecord[] {
  return props.phases.filter((phase) => phase.status === "done");
}

async function show(name: string): Promise<void> {
  selected.value = name;
  failed.value = false;

  try {
    text.value = await fetchArtifact(name);
  } catch {
    failed.value = true;
    text.value = "";
  }
}

watch(
  () => readable().map((phase) => phase.output).join(),
  (outputs) => {
    if (selected.value === undefined && outputs !== "") {
      void show(readable()[0]!.output);
    }
  },
  { immediate: true },
);
</script>

<template>
  <section class="artifacts">
    <nav>
      <button
        v-for="phase in readable()"
        :key="phase.output"
        class="tab"
        :class="{ on: phase.output === selected }"
        @click="show(phase.output)"
      >
        {{ phase.output }}
      </button>
    </nav>

    <pre v-if="text" class="body">{{ text }}</pre>
    <p v-else-if="failed" class="empty">That artifact could not be read.</p>
    <p v-else class="empty">Nothing has been written yet.</p>
  </section>
</template>

<style scoped>
.artifacts {
  display: grid;
  gap: 11px;
  min-height: 0;
}

nav {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tab {
  font-family: var(--mono);
  font-size: 12px;
  padding: 5px 11px;
  color: var(--dim);
}

.tab.on {
  border-color: var(--accent);
  color: var(--accent);
}

.body {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 15px 17px;
  overflow: auto;
  max-height: 52vh;
}

.empty {
  color: var(--faint);
  font-size: 13px;
  margin: 0;
}
</style>
