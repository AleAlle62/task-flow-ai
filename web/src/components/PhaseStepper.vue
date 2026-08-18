<script setup lang="ts">
import { computed } from "vue";

import type { Step } from "@/stores/run";
import { humanSeconds, useNow } from "@/composables/useNow";

const props = defineProps<{ steps: Step[]; showing?: string }>();

const emit = defineEmits<{ show: [output: string] }>();

/** A step you can open is one that has already written something. */
function readable(step: Step): boolean {
  return step.status === "done";
}

const now = useNow();

const currentIndex = computed(() =>
  props.steps.findIndex((step) => step.waiting || step.status === "running"),
);

/**
 * How far the line under the steps has filled.
 *
 * Measured in finished phases rather than elapsed time: time would run ahead of
 * the work and then stall, which is exactly the lie a progress bar should not
 * tell.
 */
const progress = computed(() => {
  const done = props.steps.filter((step) => step.status === "done").length;

  return props.steps.length === 0 ? 0 : (done / props.steps.length) * 100;
});

function name(step: Step): string {
  return step.id.replace(/-ai$/, "");
}

/**
 * What a step is doing, in words rather than a symbol. A running phase shows a
 * clock that keeps moving: a static label while a model thinks for two minutes
 * is indistinguishable from a pipeline that has died.
 */
function state(step: Step): string {
  if (step.waiting) return "waiting for you";

  switch (step.status) {
    case "pending":
      return "";
    case "running":
      return step.startedAt ? humanSeconds(now.value - Date.parse(step.startedAt)) : "…";
    case "done":
      return step.durationMs === undefined ? "done" : humanSeconds(step.durationMs);
    case "failed":
      return "failed";
  }
}

function classes(step: Step, index: number): Record<string, boolean> {
  return {
    [step.status]: true,
    waiting: step.waiting,
    writes: step.canWrite,
    readable: readable(step),
    showing: step.output === props.showing,
    current: index === currentIndex.value,
    passed: currentIndex.value > -1 && index < currentIndex.value,
  };
}
</script>

<template>
  <ol class="stepper">
    <li class="rail" aria-hidden="true">
      <span class="fill" :style="{ width: `${progress}%` }" />
    </li>

    <li
      v-for="(step, index) in props.steps"
      :key="step.id"
      class="step"
      :class="classes(step, index)"
    >
      <component
        :is="readable(step) ? 'button' : 'span'"
        class="hit"
        :type="readable(step) ? 'button' : undefined"
        :title="readable(step) ? `Read ${step.output}` : undefined"
        @click="readable(step) && emit('show', step.output)"
      >
        <span class="mark" aria-hidden="true">
          <span v-if="step.status === 'running' || step.waiting" class="pulse" />
        </span>

        <span class="name">{{ name(step) }}</span>
        <span class="state tabular">{{ state(step) }}</span>
      </component>
    </li>
  </ol>
</template>

<style scoped>
.stepper {
  position: relative;
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 2px;
}

/* One line under all of them, so six items read as one sequence. */
.rail {
  position: absolute;
  top: 5px;
  left: 6%;
  right: 6%;
  height: 2px;
  background: var(--line);
  border-radius: 2px;
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  background: var(--done);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.step {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  display: grid;
  justify-items: center;
  gap: 4px;
  padding-top: 0;
  text-align: center;
  transition: flex-grow 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

/* The step being watched takes the room it needs; the rest give it up. */
.step.current {
  flex-grow: 1.6;
}

/* The whole step is the target, not the twelve pixels of the dot. */
.hit {
  all: unset;
  display: grid;
  justify-items: center;
  gap: 4px;
  width: 100%;
  padding-bottom: 2px;
  border-bottom: 2px solid transparent;
}

.readable .hit {
  cursor: pointer;
}

.readable .hit:hover .name {
  color: var(--accent);
}

.showing .hit {
  border-bottom-color: var(--accent);
}

.hit:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 4px;
}

.mark {
  position: relative;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--line);
  background: var(--ground);
  z-index: 1;
  transition: border-color 0.3s ease, background 0.3s ease, transform 0.3s ease;
}

.name {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  transition: color 0.3s ease;
}

/* Never wider than its own step: a long label used to shove the next name aside. */
.state {
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  min-height: 1em;
}

/* States. Each hue means one thing here and nowhere else. */

.pending .name {
  color: var(--faint);
}

.done .mark {
  border-color: var(--done);
  background: var(--done);
}

.done .name {
  color: var(--dim);
}

.running .mark {
  border-color: var(--accent);
  transform: scale(1.15);
}

.running .name,
.running .state {
  color: var(--accent);
}

.running .name {
  font-weight: 650;
}

.waiting .mark {
  border-color: var(--waiting);
  background: var(--waiting);
  transform: scale(1.15);
}

.waiting .name,
.waiting .state {
  color: var(--waiting);
  font-weight: 650;
}

.failed .mark {
  border-color: var(--writes);
  background: var(--writes);
}

.failed .name,
.failed .state {
  color: var(--writes);
}

/*
 * The phase allowed to change your code is marked before it runs, not after.
 * Underlined rather than coloured in, so it does not compete with the state
 * colours it has to wear as well.
 */
.writes .name {
  text-decoration: underline;
  text-decoration-color: var(--writes);
  text-underline-offset: 3px;
  text-decoration-thickness: 1.5px;
}

.pulse {
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 2px solid currentColor;
  color: var(--accent);
  animation: breathe 1.9s ease-out infinite;
}

.waiting .pulse {
  color: var(--waiting);
}

@keyframes breathe {
  0% {
    opacity: 0.6;
    transform: scale(0.75);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

@media (max-width: 640px) {
  .stepper {
    overflow-x: auto;
  }

  .step {
    flex: 0 0 92px;
  }
}
</style>
