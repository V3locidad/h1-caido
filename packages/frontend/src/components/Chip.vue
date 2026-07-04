<script setup lang="ts">
defineProps<{ icon?: string; tone?: "default" | "bounty" | "muted" }>();
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs whitespace-nowrap"
    :class="{
      'bg-surface-700/70 text-surface-100': !tone || tone === 'default',
      'bg-surface-700/70 text-surface-300': tone === 'muted',
      'bg-surface-700/70 text-surface-100 font-medium': tone === 'bounty',
    }"
  >
    <i v-if="icon" class="fas" :class="icon"></i>
    <slot />
  </span>
</template>
