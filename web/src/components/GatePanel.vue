<script setup lang="ts">
import { ref } from "vue";

import type { PendingGate } from "@/api/types";

const props = defineProps<{ gate: PendingGate }>();

const emit = defineEmits<{ decide: [approved: boolean, note: string] }>();

const note = ref("");
const sending = ref(false);

/**
 * The approving option is deliberately the plainer of the two. This click is
 * the one that lets an agent write to your code, so it should feel like a
 * decision rather than the way to get rid of the panel.
 */
function decide(approved: boolean): void {
  sending.value = true;
  emit("decide", approved, note.value.trim());
}
</script>

<template>
  <section class="gate">
    <header>
      <h2>{{ props.gate.phase }} is waiting for you</h2>
      <span class="artifact">{{ props.gate.artifact }}</span>
    </header>

    <pre class="text">{{ props.gate.text }}</pre>

    <textarea
      v-model="note"
      rows="2"
      placeholder="A note, if you want one. It is passed to the next phase."
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
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}

.artifact {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--faint);
}

.text {
  max-height: 46vh;
  overflow: auto;
  background: var(--panel-2);
  border-radius: 8px;
  padding: 14px 16px;
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
