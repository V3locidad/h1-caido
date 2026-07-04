import { useSDK } from "@/plugins/sdk";
import type { H1Credentials, H1Session, Program, Scope } from "@h1caido/common";
import { watchDebounced } from "@vueuse/core";
import { computed, reactive, readonly, ref } from "vue";

const STORAGE_KEY = "h1caido:credentials";

interface Stored extends H1Credentials {
  sessionCookie: string;
  csrf: string;
}

function loadStoredCreds(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p?.username === "string" && typeof p?.token === "string") {
        return {
          username: p.username,
          token: p.token,
          sessionCookie: typeof p.sessionCookie === "string" ? p.sessionCookie : "",
          csrf: typeof p.csrf === "string" ? p.csrf : "",
        };
      }
    }
  } catch {
    /* ignore malformed storage */
  }
  return { username: "", token: "", sessionCookie: "", csrf: "" };
}

let _store: ReturnType<typeof createStore> | null = null;

function createStore() {
  const sdk = useSDK();

  const stored = loadStoredCreds();
  const username = ref(stored.username);
  const token = ref(stored.token);
  const sessionCookie = ref(stored.sessionCookie);
  const csrf = ref(stored.csrf);

  const programs = reactive(new Map<string, Program>());
  const scopes = reactive(new Map<string, Scope[]>());
  const loadingScopes = reactive(new Set<string>());
  const enriched = reactive(new Set<string>());
  const state = ref<"loading" | "loaded">("loaded");
  // Set when the GraphQL session is rejected, to stop hammering with failures.
  const enrichmentBroken = ref(false);

  const hasCreds = computed(() => username.value.trim().length > 0 && token.value.trim().length > 0);
  const hasSession = computed(() => sessionCookie.value.trim().length > 0);

  sdk.backend.onEvent("program", (program) => {
    programs.set(program.handle, program);
  });

  sdk.backend.onEvent("scopes", ({ handle, scopes: list }) => {
    scopes.set(handle, list);
    loadingScopes.delete(handle);
  });

  sdk.backend.onEvent("enrichment", (e) => {
    const p = programs.get(e.handle);
    if (p) {
      programs.set(e.handle, {
        ...p,
        resolved_reports: e.resolved_reports,
        reward_low: e.reward_low,
        reward_high: e.reward_high,
        currency: e.currency ?? p.currency,
      });
    }
    enriched.add(e.handle);
  });

  sdk.backend.onEvent("enrichmentUnavailable", (message) => {
    if (!enrichmentBroken.value) {
      enrichmentBroken.value = true;
      sdk.window.showToast(message, { variant: "error", duration: 6000 });
    }
  });

  sdk.backend.onEvent("stateChanged", (newState) => {
    state.value = newState;
  });

  sdk.backend.onEvent("invalidCreds", () => {
    sdk.window.showToast("Invalid HackerOne API credentials", { variant: "error", duration: 5000 });
  });

  sdk.backend.onEvent("error", (message) => {
    sdk.window.showToast(message, { variant: "error", duration: 5000 });
  });

  function creds(): H1Credentials {
    return { username: username.value.trim(), token: token.value.trim() };
  }

  function session(): H1Session {
    return { cookie: sessionCookie.value.trim(), csrf: csrf.value.trim() || undefined };
  }

  function persist() {
    try {
      const data: Stored = {
        ...creds(),
        sessionCookie: sessionCookie.value.trim(),
        csrf: csrf.value.trim(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  function refresh() {
    if (!hasCreds.value) return;
    persist();
    programs.clear();
    scopes.clear();
    enriched.clear();
    sdk.backend.loadPrograms(creds());
  }

  function loadScopes(handle: string) {
    if (scopes.has(handle) || loadingScopes.has(handle) || !hasCreds.value) return;
    loadingScopes.add(handle);
    sdk.backend.loadScopes(handle, creds());
  }

  function enrich(handle: string) {
    // Only attempt GraphQL enrichment when a session is configured and working.
    if (enriched.has(handle) || !hasSession.value || enrichmentBroken.value) return;
    enriched.add(handle); // optimistic: avoid duplicate in-flight calls
    persist();
    sdk.backend.loadEnrichment(handle, session());
  }

  function logout() {
    username.value = "";
    token.value = "";
    sessionCookie.value = "";
    csrf.value = "";
    programs.clear();
    scopes.clear();
    enriched.clear();
    enrichmentBroken.value = false;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  // Auto-refresh when credentials change (debounced), and once on startup if set.
  watchDebounced([username, token], refresh, { debounce: 600, immediate: true });
  // Re-enable enrichment attempts when the session changes.
  watchDebounced([sessionCookie, csrf], () => {
    enrichmentBroken.value = false;
    enriched.clear();
    persist();
  }, { debounce: 600 });

  return {
    username,
    token,
    sessionCookie,
    csrf,
    hasCreds,
    hasSession,
    loading: readonly(computed(() => state.value === "loading")),
    programs: computed(() => Array.from(programs.values())),
    getScopes: (handle: string) => scopes.get(handle),
    isLoadingScopes: (handle: string) => loadingScopes.has(handle),
    refresh,
    loadScopes,
    enrich,
    logout,
  };
}

export function useH1Programs() {
  if (!_store) {
    _store = createStore();
  }
  return _store;
}
