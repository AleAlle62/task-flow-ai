<script setup lang="ts">
import { computed } from "vue";

import { renderMarkdown } from "@/lib/markdown";

const props = defineProps<{ source: string }>();

/** Safe to inject: the renderer escapes the text before adding any tags. */
const html = computed(() => renderMarkdown(props.source));
</script>

<template>
  <div class="md" v-html="html" />
</template>

<style scoped>
.md {
  font-size: 14.5px;
  line-height: 1.62;
}

.md :deep(h2),
.md :deep(h3),
.md :deep(h4),
.md :deep(h5) {
  margin: 20px 0 8px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.md :deep(h2) {
  font-size: 16px;
}

.md :deep(h3) {
  font-size: 14.5px;
}

.md :deep(h4),
.md :deep(h5) {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--faint);
}

.md :deep(> *:first-child) {
  margin-top: 0;
}

.md :deep(p) {
  margin: 0 0 10px;
}

.md :deep(ul),
.md :deep(ol) {
  margin: 0 0 12px;
  padding-left: 22px;
}

.md :deep(li) {
  margin: 4px 0;
}

.md :deep(code) {
  font-family: var(--mono);
  font-size: 0.87em;
  background: var(--panel-2);
  padding: 1.5px 5px;
  border-radius: 5px;
}

.md :deep(pre) {
  background: var(--panel-2);
  border-radius: 8px;
  padding: 12px 14px;
  margin: 0 0 12px;
  overflow-x: auto;
}

.md :deep(pre code) {
  background: none;
  padding: 0;
}

.md :deep(strong) {
  font-weight: 650;
}
</style>
