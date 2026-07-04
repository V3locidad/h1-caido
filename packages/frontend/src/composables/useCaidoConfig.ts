import { useSDK } from "@/plugins/sdk";
import type { Scope } from "@h1caido/common";
import { scopesToAllowlist, toCaidoHost } from "@/utils/scope";

// Prefix used for scope + match-and-replace entries created by this plugin,
// so users can recognise (and clean up) what H1Caido added.
const SCOPE_PREFIX = "h1:";
const HEADER_COLLECTION = "h1caido-research-header";

export function useCaidoConfig() {
  const sdk = useSDK();

  const scopeName = (handle: string) => `${SCOPE_PREFIX}${handle}`;

  function findScope(name: string) {
    return sdk.scopes.getScopes().find((s) => s.name === name);
  }

  // Import all web-testable assets of a program into a dedicated Caido scope.
  async function importScope(handle: string, scopes: Scope[]) {
    const allowlist = scopesToAllowlist(scopes);
    if (allowlist.length === 0) {
      sdk.window.showToast("No web assets (URL/domain/wildcard) to import for this program", {
        variant: "warning",
        duration: 4000,
      });
      return;
    }

    const name = scopeName(handle);
    const existing = findScope(name);

    try {
      if (existing) {
        const merged = Array.from(new Set([...existing.allowlist, ...allowlist]));
        await sdk.scopes.updateScope(existing.id, { name, allowlist: merged });
        sdk.window.showToast(`Updated scope "${name}" (${merged.length} hosts)`, {
          variant: "success",
          duration: 3000,
        });
      } else {
        await sdk.scopes.createScope({ name, allowlist, denylist: [] });
        sdk.window.showToast(`Created scope "${name}" (${allowlist.length} hosts)`, {
          variant: "success",
          duration: 3000,
        });
      }
    } catch (error) {
      sdk.window.showToast(`Failed to import scope: ${error}`, { variant: "error", duration: 5000 });
    }
  }

  // Add a single asset to the program's Caido scope.
  async function addAsset(handle: string, scope: Scope) {
    const host = toCaidoHost(scope.asset_identifier);
    if (!host) {
      sdk.window.showToast(`"${scope.asset_identifier}" is not a host Caido can scope`, {
        variant: "warning",
        duration: 3000,
      });
      return;
    }
    const name = scopeName(handle);
    const existing = findScope(name);
    try {
      if (existing) {
        if (existing.allowlist.includes(host)) {
          sdk.window.showToast(`Already in scope: ${host}`, { variant: "info", duration: 2000 });
          return;
        }
        await sdk.scopes.updateScope(existing.id, { name, allowlist: [...existing.allowlist, host] });
      } else {
        await sdk.scopes.createScope({ name, allowlist: [host], denylist: [] });
      }
      sdk.window.showToast(`Added to scope: ${host}`, { variant: "success", duration: 2000 });
    } catch (error) {
      sdk.window.showToast(`Failed to add: ${error}`, { variant: "error", duration: 5000 });
    }
  }

  // Remove a single asset from the program's Caido scope.
  async function removeAsset(handle: string, scope: Scope) {
    const host = toCaidoHost(scope.asset_identifier);
    const existing = findScope(scopeName(handle));
    if (!host || !existing) return;
    try {
      await sdk.scopes.updateScope(existing.id, {
        name: existing.name,
        allowlist: existing.allowlist.filter((h) => h !== host),
      });
      sdk.window.showToast(`Removed from scope: ${host}`, { variant: "warning", duration: 2000 });
    } catch (error) {
      sdk.window.showToast(`Failed to remove: ${error}`, { variant: "error", duration: 5000 });
    }
  }

  async function deleteScope(handle: string) {
    const scope = findScope(scopeName(handle));
    if (!scope) {
      sdk.window.showToast("No H1Caido scope to delete for this program", {
        variant: "info",
        duration: 3000,
      });
      return;
    }
    try {
      await sdk.scopes.deleteScope(scope.id);
      sdk.window.showToast(`Deleted scope "${scope.name}"`, { variant: "warning", duration: 3000 });
    } catch (error) {
      sdk.window.showToast(`Failed to delete scope: ${error}`, { variant: "error", duration: 5000 });
    }
  }

  // Add an identifying request header that HackerOne programs ask researchers
  // to include (e.g. "X-HackerOne-Research: <username>"). The header name and
  // value are supplied by the UI because the exact requirement varies per
  // program and is only stated in free-text policy/scope instructions — it is
  // not a machine-readable field in the API.
  async function addResearchHeader(handle: string, headerName: string, headerValue: string) {
    const name = headerName.trim().replace(/:\s*$/, "");
    const value = headerValue.trim();
    if (!name || !value) {
      sdk.window.showToast("Set both a header name and value first", {
        variant: "warning",
        duration: 3000,
      });
      return;
    }

    let collection = sdk.matchReplace.getCollections().find((c) => c.name === HEADER_COLLECTION);
    if (!collection) {
      collection = await sdk.matchReplace.createCollection({ name: HEADER_COLLECTION });
    }

    const ruleName = `${handle} · ${name}`;
    const existing = sdk.matchReplace
      .getRules()
      .find((r) => r.collectionId === collection!.id && r.name === ruleName);
    if (existing) {
      sdk.window.showToast(`Header rule already exists: ${ruleName}`, { variant: "info", duration: 3000 });
      return;
    }

    try {
      await sdk.matchReplace.createRule({
        name: ruleName,
        collectionId: collection.id,
        sources: [],
        query: "",
        section: {
          kind: "SectionRequestHeader",
          operation: {
            // Add the header (rather than rewrite an existing one).
            kind: "OperationHeaderAdd",
            matcher: { kind: "MatcherName", name },
            replacer: { kind: "ReplacerTerm", term: value },
          },
        },
      });
      sdk.window.showToast(`Added header rule "${name}: ${value}"`, { variant: "success", duration: 3000 });
    } catch (error) {
      sdk.window.showToast(`Failed to add header rule: ${error}`, { variant: "error", duration: 5000 });
    }
  }

  return { importScope, addAsset, removeAsset, deleteScope, addResearchHeader };
}
