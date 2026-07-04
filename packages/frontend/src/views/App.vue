<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useH1Programs } from "@/composables/useH1Programs";
import ProgramCard from "@/components/ProgramCard.vue";
import ProgramDetails from "@/components/ProgramDetails.vue";

const store = useH1Programs();

const search = ref("");
const onlyBounties = ref(false);
const showInactive = ref(false);
const selected = ref<string | null>(null);

// Identification header many H1 programs require. Name configurable; value
// defaults to the researcher's H1 username (the API "username" credential).
const headerName = ref("X-HackerOne-Research");
const headerValue = computed(() => store.username.value.trim());

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return store.programs.value
    // Hide paused/disabled programs (e.g. migrated ones) unless asked.
    .filter((p) => showInactive.value || p.submission_state === "open")
    .filter((p) => !onlyBounties.value || p.offers_bounties)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const selectedProgram = computed(() => store.programs.value.find((p) => p.handle === selected.value));

function open(handle: string) {
  selected.value = handle;
  store.loadScopes(handle);
  store.enrich(handle);
}

// Enrich a set of programs (Reports/Rewards) via GraphQL, throttled to avoid
// hammering the endpoint.
async function enrichHandles(handles: string[]) {
  for (const handle of handles) {
    store.enrich(handle);
    await new Promise((r) => setTimeout(r, 120));
  }
}

const enrichVisible = () => enrichHandles(filtered.value.map((p) => p.handle));

// Auto-enrich every program in the background once the list finishes loading.
let autoEnrichedFor = 0;
watch(
  () => [store.loading.value, store.programs.value.length] as const,
  ([loading, count]) => {
    if (!loading && count > 0 && count !== autoEnrichedFor) {
      autoEnrichedFor = count;
      enrichHandles(store.programs.value.map((p) => p.handle));
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="h-full w-full flex flex-col gap-3 p-4 text-sm overflow-auto">
    <header class="flex items-center gap-2">
      <i class="fas fa-bullseye text-lg"></i>
      <h1 class="text-lg font-semibold">H1Caido</h1>
      <span class="opacity-60">— HackerOne programs &amp; scopes</span>
    </header>

    <!-- Credentials -->
    <section class="flex flex-wrap items-end gap-2 border-b border-surface-700 pb-3">
      <label class="flex flex-col gap-1">
        <span class="opacity-70">API username (token identifier)</span>
        <input v-model="store.username.value" type="text" placeholder="e.g. your-h1-username"
          class="px-2 py-1 rounded bg-surface-800 border border-surface-600 min-w-[220px]" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="opacity-70">API token</span>
        <input v-model="store.token.value" type="password" placeholder="••••••••••••"
          class="px-2 py-1 rounded bg-surface-800 border border-surface-600 min-w-[260px]" />
      </label>
      <button class="px-3 py-1 rounded bg-rose-800/80 hover:bg-rose-700 text-white" @click="store.refresh()">
        <i class="fas fa-rotate mr-1"></i> Refresh
      </button>
      <button v-if="store.hasCreds.value" class="px-3 py-1 rounded bg-surface-700 hover:bg-surface-600"
        @click="store.logout()">Log out</button>
      <a class="ml-auto text-xs underline opacity-70 hover:opacity-100"
        href="https://hackerone.com/settings/api_token/edit" target="_blank" rel="noreferrer">
        Get an API token ↗
      </a>
    </section>

    <p v-if="!store.hasCreds.value" class="opacity-70">
      Enter your HackerOne API credentials above. They are stored locally in this browser only and sent
      directly to HackerOne's API.
    </p>

    <!-- Details view -->
    <ProgramDetails
      v-else-if="selected && selectedProgram"
      :program="selectedProgram"
      :scopes="store.getScopes(selected)"
      :loading-scopes="store.isLoadingScopes(selected)"
      :header-name="headerName"
      :header-value="headerValue"
      @back="selected = null"
    />

    <!-- Grid view -->
    <template v-else-if="store.hasCreds.value">
      <section class="flex flex-wrap items-center gap-3">
        <input v-model="search" type="text" placeholder="Filter by name or handle…"
          class="px-2 py-1 rounded bg-surface-800 border border-surface-600 flex-1 min-w-[180px]" />
        <label class="flex items-center gap-1 whitespace-nowrap">
          <input v-model="onlyBounties" type="checkbox" /> bounties only
        </label>
        <label class="flex items-center gap-1 whitespace-nowrap"
          title="Show programs that are paused or disabled (e.g. migrated)">
          <input v-model="showInactive" type="checkbox" /> show paused
        </label>
        <label class="flex items-center gap-1 whitespace-nowrap"
          title="Header added by 'Add ID header'. Check each program's policy for the exact name it requires.">
          <span class="opacity-70 text-xs">ID header</span>
          <input v-model="headerName" type="text"
            class="px-2 py-1 rounded bg-surface-800 border border-surface-600 w-[170px] font-mono text-xs" />
          <span class="opacity-50 text-xs">: {{ headerValue || "&lt;username&gt;" }}</span>
        </label>
        <button
          class="px-2.5 py-1 rounded bg-surface-700 hover:bg-surface-600 text-xs whitespace-nowrap"
          title="Fetch Reports & Rewards for the visible programs via HackerOne's public GraphQL"
          @click="enrichVisible()">
          <i class="fas fa-coins mr-1"></i> Load rewards
        </button>
        <span class="opacity-60 whitespace-nowrap">
          {{ filtered.length }} / {{ store.programs.value.length }}
          <span v-if="store.loading.value"> · loading…</span>
        </span>
      </section>

      <section class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));">
        <ProgramCard
          v-for="p in filtered"
          :key="p.handle"
          :program="p"
          :scope-count="store.getScopes(p.handle)?.length"
          @open="open(p.handle)"
        />
      </section>

      <div v-if="!store.loading.value && store.programs.value.length === 0" class="opacity-60 text-center py-8">
        No programs found for these credentials.
      </div>
    </template>
  </div>
</template>
