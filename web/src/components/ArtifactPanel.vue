<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { fetchArtifact } from "@/api/client";
import type { PhaseRecord } from "@/api/types";
import MarkdownView from "@/components/MarkdownView.vue";

const props = defineProps<{ phases: PhaseRecord[] }>();

const selected = ref<string | undefined>();
const text = ref("");
const failed = ref(false);
const raw = ref(false);

/** Only phases that finished have something to read. */
const readable = computed(() => props.phases.filter((phase) => phase.status === "done"));

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

/**
 * Follows the run: the newest finished artifact is what you want to see, unless
 * you have already picked one yourself.
 */
const touched = ref(false);

watch(
  () => readable.value.map((phase) => phase.output).join(),
  (outputs) => {
    if (outputs === "") return;

    const latest = readable.value[readable.value.length - 1]!.output;

    if (!touched.value) void show(latest);
    else if (selected.value && !outputs.includes(selected.value)) void show(latest);
  },
  { immediate: true },
);

function pick(name: string): void {
  touched.value = true;
  void show(name);
}
</script>

<template>
  <section class="artifacts">
    <nav>
      <button
        v-for="phase in readable"
        :key="phase.output"
        class="tab"
        :class="{ on: phase.output === selected }"
        @click="pick(phase.output)"
      >
        {{ phase.output }}
      </button>

      <button v-if="text" class="tab raw" @click="raw = !raw">
        {{ raw ? "rendered" : "source" }}
      </button>
    </nav>

    <div v-if="text" class="body">
      <pre v-if="raw">{{ text }}</pre>
      <MarkdownView v-else :source="text" />
    </div>

    <p v-else-if="failed" class="empty">That artifact could not be read.</p>
    <p v-else class="empty">No phase has finished yet.</p>
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

.raw {
  margin-left: auto;
  color: var(--faint);
  font-size: 11px;
}

.body {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 16px 19px;
  overflow: auto;
  max-height: 52vh;
}

.empty {
  color: var(--faint);
  font-size: 13px;
  margin: 0;
}
</style>
