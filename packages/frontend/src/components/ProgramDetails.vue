<script setup lang="ts">
import { computed } from "vue";
import type { Program, Scope } from "@h1caido/common";
import Chip from "./Chip.vue";
import { useCaidoConfig } from "@/composables/useCaidoConfig";
import { useSDK } from "@/plugins/sdk";
import { isWebAsset } from "@/utils/scope";
import { money } from "@/utils/format";

const props = defineProps<{
  program: Program;
  scopes?: Scope[];
  loadingScopes: boolean;
  headerName: string;
  headerValue: string;
}>();
defineEmits<{ (e: "back"): void }>();

const sdk = useSDK();
const caido = useCaidoConfig();

const isPublic = computed(() => (props.program.state ?? "").toLowerCase().includes("public"));
const inScope = computed(() => (props.scopes ?? []).filter((s) => s.eligible_for_submission !== false));
const outOfScope = computed(() => (props.scopes ?? []).filter((s) => s.eligible_for_submission === false));

const rewardRange = computed(() => {
  const p = props.program;
  if (p.reward_low != null || p.reward_high != null) {
    return `${money(p.reward_low, p.currency)} - ${money(p.reward_high, p.currency)}`;
  }
  return null;
});

// Show a row-label column when the table has more than one tier.
const showRowLabels = computed(() => (props.program.reward_table ?? []).length > 1);
const rowLabel = (name: string | null, i: number) => name || `Tier ${i + 1}`;

// Format a severity cell: a range when min/max differ, a single amount, or n/a.
function range(min: number | null, max: number | null): string {
  if (min == null && max == null) return "n/a";
  if (min != null && max != null && min !== max) {
    return `${money(min, props.program.currency)} - ${money(max, props.program.currency)}`;
  }
  return money(max ?? min, props.program.currency);
}

function copy(text: string) {
  navigator.clipboard?.writeText(text);
  sdk.window.showToast(`Copied: ${text}`, { variant: "info", duration: 1500 });
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <button class="self-start flex items-center gap-2 text-sm opacity-70 hover:opacity-100" @click="$emit('back')">
      <i class="fas fa-arrow-left"></i> Back to programs
    </button>

    <!-- Header -->
    <div class="flex items-start gap-4">
      <img v-if="program.profile_picture" :src="program.profile_picture" :alt="program.name"
        class="h-16 w-16 object-contain rounded-lg bg-surface-900/60 p-1" referrerpolicy="no-referrer" />
      <div class="flex-1">
        <h2 class="text-xl font-bold">{{ program.name }}</h2>
        <p class="opacity-50 font-mono text-sm">{{ program.handle }}</p>
        <div class="flex flex-wrap gap-2 mt-3">
          <Chip :icon="program.offers_bounties ? 'fa-coins' : 'fa-shield'" tone="bounty">
            {{ program.offers_bounties ? "Bug Bounty" : "VDP" }}
          </Chip>
          <Chip :icon="isPublic ? 'fa-globe' : 'fa-lock'">{{ isPublic ? "Public" : "Private" }}</Chip>
          <Chip v-if="scopes" icon="fa-database">{{ scopes.length }} scopes</Chip>
        </div>
      </div>
      <a class="text-xs underline opacity-70 hover:opacity-100 whitespace-nowrap"
        :href="`https://hackerone.com/${program.handle}`" target="_blank" rel="noreferrer">
        Open on HackerOne ↗
      </a>
    </div>

    <hr class="border-surface-700" />

    <!-- Stats -->
    <dl class="text-sm flex flex-col gap-1.5">
      <div class="flex justify-between">
        <dt class="font-semibold">Reports resolved</dt>
        <dd>{{ program.resolved_reports ?? "—" }}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="font-semibold">Hunters</dt>
        <dd>{{ program.participants ?? "—" }}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="font-semibold">Response efficiency</dt>
        <dd>{{ program.response_efficiency != null ? program.response_efficiency + "%" : "—" }}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="font-semibold">Rewards</dt>
        <dd :class="rewardRange ? 'text-rose-400' : 'opacity-60'">
          {{ program.offers_bounties ? (rewardRange ?? "see program page") : "no rewards" }}
        </dd>
      </div>
      <div v-if="program.bounty_earned_for_user" class="flex justify-between">
        <dt class="font-semibold">You earned</dt>
        <dd class="text-amber-300">{{ money(program.bounty_earned_for_user, program.currency) }}</dd>
      </div>
    </dl>

    <!-- Rewards summary table (only when enriched from GraphQL) -->
    <div v-if="program.reward_table?.length">
      <h3 class="font-bold tracking-wide mb-2">REWARDS SUMMARY</h3>
      <div class="overflow-x-auto rounded-lg border border-surface-700">
        <table class="w-full text-sm">
          <thead class="opacity-60 text-left">
            <tr>
              <th v-if="showRowLabels" class="p-2">Tier</th>
              <th class="p-2"><span class="text-emerald-400">Low</span></th>
              <th class="p-2"><span class="text-amber-400">Medium</span></th>
              <th class="p-2"><span class="text-orange-400">High</span></th>
              <th class="p-2"><span class="text-rose-400">Critical</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in program.reward_table" :key="i" class="border-t border-surface-700">
              <td v-if="showRowLabels" class="p-2 font-medium">{{ rowLabel(row.name, i) }}</td>
              <td class="p-2">{{ range(row.low_min, row.low_max) }}</td>
              <td class="p-2">{{ range(row.medium_min, row.medium_max) }}</td>
              <td class="p-2">{{ range(row.high_min, row.high_max) }}</td>
              <td class="p-2">{{ range(row.critical_min, row.critical_max) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Scopes -->
    <div>
      <div class="flex items-center gap-3 mb-2">
        <h3 class="font-bold tracking-wide">SCOPES</h3>
        <button class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-800/80 hover:bg-rose-700 text-white text-xs"
          @click="caido.importScope(program.handle, scopes ?? [])">
          <i class="fas fa-crosshairs"></i> Import all scopes
        </button>
        <button class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-700 hover:bg-surface-600 text-xs"
          @click="caido.deleteScope(program.handle)">
          <i class="fas fa-trash"></i> Remove program scopes
        </button>
        <button v-if="headerValue"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-700 hover:bg-surface-600 text-xs"
          :title="`Adds ${headerName}: ${headerValue}`"
          @click="caido.addResearchHeader(program.handle, headerName, headerValue)">
          <i class="fas fa-id-badge"></i> Add ID header
        </button>
      </div>

      <div v-if="loadingScopes" class="opacity-60">Loading scopes…</div>
      <div v-else-if="inScope.length" class="overflow-x-auto rounded-lg border border-surface-700">
        <table class="w-full text-sm">
          <thead class="opacity-60 text-left">
            <tr>
              <th class="p-2">Scope</th>
              <th class="p-2">Type</th>
              <th class="p-2">Severity</th>
              <th class="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in inScope" :key="s.id" class="border-t border-surface-700 align-top">
              <td class="p-2">
                <div class="font-mono" :class="{ 'opacity-50': !isWebAsset(s) }">{{ s.asset_identifier }}</div>
                <div v-if="s.instruction" class="opacity-50 text-[11px] whitespace-pre-wrap max-w-[420px] mt-1">
                  {{ s.instruction }}
                </div>
              </td>
              <td class="p-2 whitespace-nowrap">{{ s.asset_type }}</td>
              <td class="p-2">
                <span v-if="s.max_severity"
                  class="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-500/80 text-black font-bold">
                  {{ s.max_severity }}
                </span>
                <span v-else class="opacity-40">—</span>
              </td>
              <td class="p-2">
                <div class="flex items-center gap-1.5 justify-end">
                  <button class="h-7 w-7 rounded border border-surface-600 hover:bg-surface-700" title="Copy"
                    @click="copy(s.asset_identifier)"><i class="fas fa-copy"></i></button>
                  <button class="h-7 w-7 rounded border border-green-700 text-green-400 hover:bg-green-900/30 disabled:opacity-30"
                    title="Add to Caido scope" :disabled="!isWebAsset(s)"
                    @click="caido.addAsset(program.handle, s)"><i class="fas fa-plus"></i></button>
                  <button class="h-7 w-7 rounded border border-rose-700 text-rose-400 hover:bg-rose-900/30 disabled:opacity-30"
                    title="Remove from Caido scope" :disabled="!isWebAsset(s)"
                    @click="caido.removeAsset(program.handle, s)"><i class="fas fa-trash"></i></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="opacity-60">No structured scopes returned.</div>
    </div>

    <!-- Out of scope -->
    <div v-if="outOfScope.length">
      <h3 class="font-bold tracking-wide mb-2">OUT OF SCOPE</h3>
      <ul class="text-sm opacity-70 flex flex-col gap-1">
        <li v-for="s in outOfScope" :key="s.id" class="font-mono">{{ s.asset_identifier }}</li>
      </ul>
    </div>

    <p class="opacity-40 text-[11px]">
      Reports, response efficiency and the reward table come from HackerOne's public GraphQL API. Private
      programs do not expose them, so those fields stay "—".
    </p>
  </div>
</template>
