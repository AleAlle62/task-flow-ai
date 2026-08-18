<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { fetchArtifact } from "@/api/client";
import type { PhaseRecord } from "@/api/types";
import MarkdownView from "@/components/MarkdownView.vue";

const props = defineProps<{ phases: PhaseRecord[]; showing?: string }>();

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
 * Follows the run until you take the wheel: the newest finished artifact is
 * what you want to see, unless you have picked a phase from the steps above.
 */
watch(
  [() => props.showing, () => readable.value.map((phase) => phase.output).join()],
  ([picked, outputs]) => {
    if (picked) {
      if (picked !== selected.value) void show(picked);
      return;
    }

    if (outputs === "") return;

    void show(readable.value[readable.value.length - 1]!.output);
  },
  { immediate: true },
);
</script>

<template>
  <section class="artifacts">
    <nav v-if="selected">
      <span class="which">{{ selected }}</span>

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

.which {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--dim);
  align-self: center;
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
