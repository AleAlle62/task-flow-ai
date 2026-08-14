<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{ submit: [task: string] }>();

const task = ref("");
const sending = ref(false);

function send(): void {
  if (task.value.trim() === "") return;

  sending.value = true;
  emit("submit", task.value.trim());
}
</script>

<template>
  <section class="ask">
    <h2>What should be done?</h2>
    <p class="hint">
      Describe it the way you would to a colleague. The first phase turns this into a
      specification, and you will see it before anything is written.
    </p>

    <textarea
      v-model="task"
      rows="4"
      autofocus
      placeholder="The cart page shows a spinner forever when the cart is empty."
      @keydown.meta.enter="send"
      @keydown.ctrl.enter="send"
    />

    <footer>
      <span class="shortcut">⌘↵</span>
      <button class="go" :disabled="sending || task.trim() === ''" @click="send">
        {{ sending ? "starting…" : "Start" }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.ask {
  border: 1px solid var(--accent);
  border-radius: 12px;
  background: var(--panel);
  padding: 20px 22px;
  display: grid;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.hint {
  margin: 0;
  font-size: 13px;
  color: var(--dim);
  max-width: 62ch;
}

footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.shortcut {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
}

.go {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
