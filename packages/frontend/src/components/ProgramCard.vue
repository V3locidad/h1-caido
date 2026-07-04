<script setup lang="ts">
import { computed } from "vue";
import type { Program } from "@h1caido/common";
import Chip from "./Chip.vue";
import { money } from "@/utils/format";

const props = defineProps<{ program: Program; scopeCount?: number }>();
defineEmits<{ (e: "open"): void }>();

const isPublic = computed(() => (props.program.state ?? "").toLowerCase().includes("public"));

const rewardRange = computed(() => {
  const p = props.program;
  if (p.reward_low != null || p.reward_high != null) {
    return `${money(p.reward_low, p.currency)} - ${money(p.reward_high, p.currency)}`;
  }
  return null;
});
</script>

<template>
  <div class="flex flex-col rounded-xl border border-surface-700 bg-surface-800/40 overflow-hidden">
    <!-- Logo banner -->
    <div class="h-32 flex items-center justify-center bg-surface-900/60 p-4">
      <img v-if="program.profile_picture" :src="program.profile_picture" :alt="program.name"
        class="max-h-24 max-w-[80%] object-contain rounded" referrerpolicy="no-referrer" />
      <i v-else class="fas fa-shield-halved text-4xl opacity-30"></i>
    </div>

    <div class="flex flex-col gap-3 p-4 flex-1">
      <div>
        <h3 class="font-semibold leading-tight">{{ program.name }}</h3>
        <p class="text-xs opacity-50 font-mono mt-0.5">{{ program.handle }}</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <Chip :icon="program.offers_bounties ? 'fa-coins' : 'fa-shield'" tone="bounty">
          {{ program.offers_bounties ? "Bug Bounty" : "VDP" }}
        </Chip>
        <Chip :icon="isPublic ? 'fa-globe' : 'fa-lock'">{{ isPublic ? "Public" : "Private" }}</Chip>
        <Chip v-if="scopeCount !== undefined" icon="fa-database">{{ scopeCount }} scopes</Chip>
      </div>

      <hr class="border-surface-700" />

      <!-- Stats block (REST-available + GraphQL-enriched when present) -->
      <dl class="text-sm flex flex-col gap-1">
        <div class="flex justify-between">
          <dt class="opacity-70">Reports</dt>
          <dd>{{ program.resolved_reports ?? "—" }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="opacity-70">Your reports</dt>
          <dd>{{ program.reports_for_user ?? 0 }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="opacity-70">Rewards</dt>
          <dd :class="rewardRange ? 'text-rose-400' : 'opacity-60'">
            {{ program.offers_bounties ? (rewardRange ?? "see details") : "no rewards" }}
          </dd>
        </div>
      </dl>

      <button
        class="mt-auto w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-800/80 hover:bg-rose-700 text-white text-sm"
        @click="$emit('open')"
      >
        <i class="fas fa-eye"></i> View details
      </button>
    </div>
  </div>
</template>
