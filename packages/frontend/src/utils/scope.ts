import type { Scope } from "@h1caido/common";

// HackerOne asset types that are never network hosts (mobile apps, source code,
// executables, hardware, models). Everything else is judged by its identifier,
// so URL/API/DOMAIN/OTHER entries that ARE web hosts can be imported.
const NON_WEB_TYPES = new Set([
  "GOOGLE_PLAY_APP_ID",
  "APPLE_STORE_APP_ID",
  "WINDOWS_APP_STORE_APP_ID",
  "OTHER_APK",
  "OTHER_IPA",
  "TESTFLIGHT",
  "SOURCE_CODE",
  "DOWNLOADABLE_EXECUTABLES",
  "HARDWARE_CIID",
  "AI_MODEL",
]);

// Convert a HackerOne asset identifier into a Caido-compatible host pattern.
// Returns null for identifiers that cannot be represented as a host (e.g. a
// CIDR range).
export function toCaidoHost(identifier: string): string | null {
  let value = identifier.trim();
  if (!value) return null;

  // A bare CIDR (e.g. 10.0.0.0/24) is not a host pattern Caido understands.
  if (/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(value)) {
    return null;
  }

  // Wildcard placeholder must be lowercase to survive the URL parser.
  const placeholder = "__wildcard_char__";
  if (!/^https?:\/\//i.test(value)) {
    value = `http://${value}`;
  }
  value = value.replace(/\*/g, placeholder);

  try {
    const host = new URL(value).hostname;
    return host.replace(new RegExp(placeholder, "g"), "*");
  } catch {
    return null;
  }
}

// The Caido host for a scope, or null if it can't be represented as one.
// Judged from the identifier (not the asset_type label), minus the non-web
// asset types, and requiring something that actually looks like a host.
export function caidoHostFor(scope: Scope): string | null {
  if (NON_WEB_TYPES.has(scope.asset_type.toUpperCase())) return null;
  const host = toCaidoHost(scope.asset_identifier);
  return host && host.includes(".") ? host : null;
}

// Whether a scope can be added to Caido's scope.
export function isAddable(scope: Scope): boolean {
  return caidoHostFor(scope) !== null;
}

// Build the Caido allowlist (unique hosts) from a program's structured scopes.
export function scopesToAllowlist(scopes: Scope[]): string[] {
  const hosts = new Set<string>();
  for (const scope of scopes) {
    const host = caidoHostFor(scope);
    if (host) hosts.add(host);
  }
  return Array.from(hosts);
}
