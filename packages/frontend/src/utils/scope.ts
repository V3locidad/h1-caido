import type { Scope } from "@h1caido/common";

// HackerOne asset types that map to a network host Caido can put in scope.
const WEB_ASSET_TYPES = new Set(["URL", "WILDCARD", "DOMAIN", "IP_ADDRESS", "CIDR"]);

export function isWebAsset(scope: Scope): boolean {
  return WEB_ASSET_TYPES.has(scope.asset_type.toUpperCase());
}

// Convert a HackerOne asset identifier into a Caido-compatible host pattern.
// Returns null for identifiers that cannot be represented as a host (e.g. a
// CIDR range, or a mobile app id).
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

// Build the Caido allowlist (unique hosts) from a program's structured scopes.
export function scopesToAllowlist(scopes: Scope[]): string[] {
  const hosts = new Set<string>();
  for (const scope of scopes) {
    if (!isWebAsset(scope)) continue;
    const host = toCaidoHost(scope.asset_identifier);
    if (host) hosts.add(host);
  }
  return Array.from(hosts);
}
