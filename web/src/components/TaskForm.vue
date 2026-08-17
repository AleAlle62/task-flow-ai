<script setup lang="ts">
import { computed, ref } from "vue";

import PhaseStepper from "@/components/PhaseStepper.vue";
import type { Step } from "@/stores/run";

const props = defineProps<{ steps: Step[] }>();

const emit = defineEmits<{ submit: [task: string] }>();

const task = ref("");
const sending = ref(false);

/** Computed, not read once: the flow arrives from the server after first paint. */
const writer = computed(() => props.steps.find((step) => step.canWrite));

function send(): void {
  if (task.value.trim() === "" || sending.value) return;

  sending.value = true;
  emit("submit", task.value.trim());
}
</script>

<template>
  <section class="ask">
    <h1>What should be done?</h1>
    <p class="lede">
      Describe it the way you would to a colleague. The first phase turns this into a
      specification, and you will read the plan before anything is written.
    </p>

    <div class="sheet" :class="{ filled: task.length > 0 }">
      <textarea
        v-model="task"
        rows="3"
        autofocus
        placeholder="The cart page shows a spinner forever when the cart is empty."
        @keydown.meta.enter="send"
        @keydown.ctrl.enter="send"
      />

      <footer>
        <span class="shortcut">⌘ ↵</span>
        <button class="go" :disabled="sending || task.trim() === ''" @click="send">
          {{ sending ? "Starting…" : "Start" }}
        </button>
      </footer>
    </div>

    <div v-if="props.steps.length > 0" class="promise">
      <p class="caption">
        Then this happens. Only
        <strong>{{ writer ? writer.id.replace(/-ai$/, "") : "one phase" }}</strong>
        can change your code.
      </p>

      <PhaseStepper :steps="props.steps" preview />
    </div>
  </section>
</template>

<style scoped>
.ask {
  display: grid;
  gap: 18px;
  max-width: 680px;
  margin: 6vh auto 0;
}

h1 {
  font-family: var(--serif);
  font-size: clamp(30px, 5vw, 40px);
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.1;
  margin: 0;
  text-wrap: balance;
}

.lede {
  margin: -6px 0 0;
  color: var(--dim);
  font-size: 15px;
  max-width: 54ch;
  text-wrap: pretty;
}

/*
 * A sheet to write on rather than a form field: the border stays quiet until
 * there is something in it, and the actions sit inside the same surface.
 */
.sheet {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 6px 6px 8px;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.sheet:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent);
}

.sheet textarea {
  border: none;
  background: transparent;
  padding: 12px 12px 4px;
  font-size: 16px;
  line-height: 1.55;
  min-height: 84px;
}

.sheet textarea:focus {
  outline: none;
}

footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 0 8px 2px;
}

.shortcut {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
  letter-spacing: 0.04em;
}

.go {
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.go:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 8%, var(--panel));
  border-color: var(--accent);
}

.promise {
  margin-top: 10px;
  display: grid;
  gap: 14px;
  padding-top: 20px;
  border-top: 1px solid var(--line-soft);
}

.caption {
  margin: 0;
  font-size: 13px;
  color: var(--dim);
  text-wrap: pretty;
}

.caption strong {
  font-family: var(--mono);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--writes);
}
</style>
