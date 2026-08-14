<script setup lang="ts">
import { ref } from "vue";

import type { PendingGate } from "@/api/types";
import MarkdownView from "@/components/MarkdownView.vue";

const props = defineProps<{ gate: PendingGate }>();

const emit = defineEmits<{ decide: [approved: boolean, note: string] }>();

const note = ref("");
const sending = ref(false);
const raw = ref(false);

/**
 * The approving button is deliberately the plainer of the two. This click is
 * what lets an agent write to your code, so it should feel like a decision
 * rather than the way to get rid of the panel.
 */
function decide(approved: boolean): void {
  sending.value = true;
  emit("decide", approved, note.value.trim());
}
</script>

<template>
  <section class="gate">
    <header>
      <div>
        <h2>{{ props.gate.phase.replace(/-ai$/, "") }} is waiting for you</h2>
        <p class="sub">Nothing has been written yet. Read it, then decide.</p>
      </div>

      <button class="toggle" @click="raw = !raw">
        {{ raw ? props.gate.artifact : "source" }}
      </button>
    </header>

    <div class="body">
      <pre v-if="raw">{{ props.gate.text }}</pre>
      <MarkdownView v-else :source="props.gate.text" />
    </div>

    <textarea
      v-model="note"
      rows="2"
      placeholder="A note, if you want one. It is passed to the phase that comes next."
    />

    <footer>
      <button :disabled="sending" @click="decide(false)">
        {{ props.gate.options[1] ?? "Reject" }}
      </button>
      <button class="approve" :disabled="sending" @click="decide(true)">
        {{ props.gate.options[0] ?? "Approve" }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.gate {
  border: 1px solid var(--amber);
  border-radius: 12px;
  background: var(--panel);
  padding: 18px 20px;
  display: grid;
  gap: 13px;
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}

.sub {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--faint);
}

.toggle {
  font-family: var(--mono);
  font-size: 11px;
  padding: 4px 10px;
  color: var(--faint);
}

.body {
  max-height: 48vh;
  overflow: auto;
  background: var(--panel-2);
  border-radius: 8px;
  padding: 15px 18px;
}

footer {
  display: flex;
  gap: 9px;
  justify-content: flex-end;
}

.approve {
  border-color: var(--green);
  color: var(--green);
}
</style>
