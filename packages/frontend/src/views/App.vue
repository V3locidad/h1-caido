<script setup lang="ts">
import { computed, ref } from "vue";
import { useH1Programs } from "@/composables/useH1Programs";
import { useCaidoConfig } from "@/composables/useCaidoConfig";
import { isWebAsset } from "@/utils/scope";

const store = useH1Programs();
const caido = useCaidoConfig();

const search = ref("");
const onlyBounties = ref(false);
const expanded = ref<string | null>(null);

// Identification header many H1 programs require. Name is configurable; value
// defaults to the researcher's H1 username (the API "username" credential).
const headerName = ref("X-HackerOne-Research");
const headerValue = computed(() => store.username.value.trim());

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return store.programs.value
    .filter((p) => !onlyBounties.value || p.offers_bounties)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
});

function toggle(handle: string) {
  if (expanded.value === handle) {
    expanded.value = null;
    return;
  }
  expanded.value = handle;
  store.loadScopes(handle);
}
</script>

<template>
  <div class="h-full w-full flex flex-col gap-3 p-4 text-sm">
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
      <button class="px-3 py-1 rounded bg-primary-600 hover:bg-primary-500 text-white"
        @click="store.refresh()">
        <i class="fas fa-rotate mr-1"></i> Refresh
      </button>
      <button v-if="store.hasCreds.value" class="px-3 py-1 rounded bg-surface-700 hover:bg-surface-600"
        @click="store.logout()">
        Log out
      </button>
      <a class="ml-auto text-xs underline opacity-70 hover:opacity-100"
        href="https://hackerone.com/settings/api_token/edit" target="_blank" rel="noreferrer">
        Get an API token ↗
      </a>
    </section>

    <p v-if="!store.hasCreds.value" class="opacity-70">
      Enter your HackerOne API credentials above. They are stored locally in this browser only and sent
      directly to HackerOne's API.
    </p>

    <!-- Filters -->
    <section v-if="store.hasCreds.value" class="flex flex-wrap items-center gap-3">
      <input v-model="search" type="text" placeholder="Filter by name or handle…"
        class="px-2 py-1 rounded bg-surface-800 border border-surface-600 flex-1 min-w-[180px]" />
      <label class="flex items-center gap-1 whitespace-nowrap">
        <input v-model="onlyBounties" type="checkbox" /> bounties only
      </label>
      <label class="flex items-center gap-1 whitespace-nowrap" title="Header added by the 'Add ID header' button. Check each program's policy for the exact name it requires.">
        <span class="opacity-70 text-xs">ID header</span>
        <input v-model="headerName" type="text"
          class="px-2 py-1 rounded bg-surface-800 border border-surface-600 w-[170px] font-mono text-xs" />
        <span class="opacity-50 text-xs">: {{ headerValue || "<username>" }}</span>
      </label>
      <span class="opacity-60 whitespace-nowrap">
        {{ filtered.length }} / {{ store.programs.value.length }}
        <span v-if="store.loading.value"> · loading…</span>
      </span>
    </section>

    <!-- Program list -->
    <section class="flex-1 overflow-auto flex flex-col gap-2">
      <div v-for="p in filtered" :key="p.handle"
        class="rounded border border-surface-700 bg-surface-800/50">
        <button class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-700/50"
          @click="toggle(p.handle)">
          <i class="fas" :class="expanded === p.handle ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
          <span class="font-medium">{{ p.name }}</span>
          <span class="opacity-50 text-xs">{{ p.handle }}</span>
          <span v-if="p.offers_bounties"
            class="ml-1 text-[10px] uppercase px-1.5 py-0.5 rounded bg-green-700/40 text-green-300">bounty</span>
          <span class="text-[10px] uppercase px-1.5 py-0.5 rounded bg-surface-700 opacity-80">
            {{ p.submission_state }}
          </span>
          <span v-if="p.bounty_earned_for_user"
            class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-700/30 text-amber-200"
            title="Bounty you have already earned on this program">
            earned {{ p.bounty_earned_for_user }} {{ p.currency ?? "" }}
          </span>
        </button>

        <div v-if="expanded === p.handle" class="px-3 pb-3 flex flex-col gap-2">
          <div class="flex flex-wrap gap-2">
            <button class="px-2 py-1 rounded bg-primary-600 hover:bg-primary-500 text-white text-xs"
              @click="caido.importScope(p.handle, store.getScopes(p.handle) ?? [])">
              <i class="fas fa-crosshairs mr-1"></i> Import scope
            </button>
            <button class="px-2 py-1 rounded bg-surface-700 hover:bg-surface-600 text-xs"
              :disabled="!headerValue"
              :title="`Adds Match&Replace rule: ${headerName}: ${headerValue || '<username>'}`"
              @click="caido.addResearchHeader(p.handle, headerName, headerValue)">
              <i class="fas fa-id-badge mr-1"></i> Add ID header
            </button>
            <button class="px-2 py-1 rounded bg-surface-700 hover:bg-surface-600 text-xs"
              @click="caido.deleteScope(p.handle)">
              <i class="fas fa-trash mr-1"></i> Remove scope
            </button>
            <a class="px-2 py-1 rounded bg-surface-700 hover:bg-surface-600 text-xs"
              :href="`https://hackerone.com/${p.handle}`" target="_blank" rel="noreferrer">
              Open on HackerOne ↗
            </a>
          </div>

          <div v-if="store.isLoadingScopes(p.handle)" class="opacity-60">Loading scopes…</div>
          <table v-else-if="store.getScopes(p.handle)?.length" class="w-full text-xs">
            <thead class="opacity-60 text-left">
              <tr>
                <th class="py-1 pr-2">Asset</th>
                <th class="py-1 pr-2">Type</th>
                <th class="py-1 pr-2">Bounty</th>
                <th class="py-1 pr-2">Severity</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in store.getScopes(p.handle)" :key="s.id" class="border-t border-surface-700 align-top">
                <td class="py-1 pr-2">
                  <div class="font-mono" :class="{ 'opacity-50': !isWebAsset(s) }">{{ s.asset_identifier }}</div>
                  <div v-if="s.instruction" class="opacity-50 text-[11px] whitespace-pre-wrap max-w-[420px]">
                    {{ s.instruction }}
                  </div>
                </td>
                <td class="py-1 pr-2">{{ s.asset_type }}</td>
                <td class="py-1 pr-2">{{ s.eligible_for_bounty ? "✓" : "—" }}</td>
                <td class="py-1 pr-2">{{ s.max_severity ?? "—" }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="opacity-60">No structured scopes returned.</div>

          <p class="opacity-40 text-[11px] mt-1">
            Note: HackerOne's API exposes <code>max_severity</code> per scope but not the low/medium/high/critical
            bounty table — see the full amounts on the program page. Verify the exact identification header there too.
          </p>
        </div>
      </div>

      <div v-if="store.hasCreds.value && !store.loading.value && store.programs.value.length === 0"
        class="opacity-60 text-center py-8">
        No programs found for these credentials.
      </div>
    </section>
  </div>
</template>
