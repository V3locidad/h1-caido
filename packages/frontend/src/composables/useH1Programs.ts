import { useSDK } from "@/plugins/sdk";
import type { H1Credentials, Program, Scope } from "@h1caido/common";
import { watchDebounced } from "@vueuse/core";
import { computed, reactive, readonly, ref } from "vue";

const STORAGE_KEY = "h1caido:credentials";

function loadStoredCreds(): H1Credentials {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.username === "string" && typeof parsed?.token === "string") {
        return { username: parsed.username, token: parsed.token };
      }
    }
  } catch {
    /* ignore malformed storage */
  }
  return { username: "", token: "" };
}

let _store: ReturnType<typeof createStore> | null = null;

function createStore() {
  const sdk = useSDK();

  const stored = loadStoredCreds();
  const username = ref(stored.username);
  const token = ref(stored.token);

  const programs = reactive(new Map<string, Program>());
  const scopes = reactive(new Map<string, Scope[]>());
  const loadingScopes = reactive(new Set<string>());
  const state = ref<"loading" | "loaded">("loaded");

  const hasCreds = computed(() => username.value.trim().length > 0 && token.value.trim().length > 0);

  sdk.backend.onEvent("program", (program) => {
    programs.set(program.handle, program);
  });

  sdk.backend.onEvent("scopes", ({ handle, scopes: list }) => {
    scopes.set(handle, list);
    loadingScopes.delete(handle);
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

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(creds()));
    } catch {
      /* ignore */
    }
  }

  function refresh() {
    if (!hasCreds.value) return;
    persist();
    programs.clear();
    scopes.clear();
    sdk.backend.loadPrograms(creds());
  }

  function loadScopes(handle: string) {
    if (scopes.has(handle) || loadingScopes.has(handle) || !hasCreds.value) return;
    loadingScopes.add(handle);
    sdk.backend.loadScopes(handle, creds());
  }

  function logout() {
    username.value = "";
    token.value = "";
    programs.clear();
    scopes.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  // Auto-refresh when credentials change (debounced), and once on startup if set.
  watchDebounced([username, token], refresh, { debounce: 600, immediate: true });

  return {
    username,
    token,
    hasCreds,
    loading: readonly(computed(() => state.value === "loading")),
    programs: computed(() => Array.from(programs.values())),
    getScopes: (handle: string) => scopes.get(handle),
    isLoadingScopes: (handle: string) => loadingScopes.has(handle),
    refresh,
    loadScopes,
    logout,
  };
}

export function useH1Programs() {
  if (!_store) {
    _store = createStore();
  }
  return _store;
}
