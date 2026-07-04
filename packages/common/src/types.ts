import type { DefineAPI, DefineEvents, SDK } from "caido:plugin";
import type { Caido } from "@caido/sdk-frontend";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------
// HackerOne's Hacker API uses HTTP Basic auth: the API token identifier acts as
// the username and the token value as the password.
export interface H1Credentials {
  username: string;
  token: string;
}


// ---------------------------------------------------------------------------
// HackerOne JSON:API parsers
// ---------------------------------------------------------------------------
// The Hacker API returns JSON:API documents shaped like:
//   { data: [ { id, type, attributes: {...} } ], links: { next } }
// or, for a single resource, { data: { id, type, attributes: {...} } }.

// --- Program (from GET /v1/hackers/programs and /programs/{handle}) ---
export const programAttributesParser = z.object({
  handle: z.string().catch(""),
  name: z.string().catch(""),
  currency: z.string().nullable().catch(null),
  // "open" | "paused" | "disabled" | ...
  submission_state: z.string().catch(""),
  state: z.string().catch("").optional(),
  offers_bounties: z.boolean().catch(false),
  offers_swag: z.boolean().catch(false).optional(),
  // Present on the single-program endpoint (policy / rules, markdown).
  policy: z.string().catch("").optional(),
  started_accepting_at: z.string().nullable().catch(null).optional(),
  // Per-user stats (the API does NOT expose a per-severity reward table).
  bounty_earned_for_user: z.number().nullable().catch(null).optional(),
  number_of_valid_reports_for_user: z.number().nullable().catch(null).optional(),
  number_of_reports_for_user: z.number().nullable().catch(null).optional(),
  // Program logo. May be a plain URL string; kept resilient if the shape differs.
  profile_picture: z.string().catch("").optional(),
});

export const programResourceParser = z.object({
  id: z.string().catch(""),
  type: z.string().catch("program"),
  attributes: programAttributesParser,
});

// --- Structured scope (from /programs/{handle}/structured_scopes) ---
export const scopeAttributesParser = z.object({
  // "URL" | "WILDCARD" | "DOMAIN" | "IP_ADDRESS" | "CIDR" | "APPLE_STORE_APP_ID"
  // | "GOOGLE_PLAY_APP_ID" | "SOURCE_CODE" | "OTHER" | ...
  asset_type: z.string().catch("OTHER"),
  asset_identifier: z.string().catch(""),
  eligible_for_bounty: z.boolean().nullable().catch(null),
  eligible_for_submission: z.boolean().nullable().catch(null),
  instruction: z.string().nullable().catch(null),
  max_severity: z.string().nullable().catch(null),
  created_at: z.string().nullable().catch(null).optional(),
  updated_at: z.string().nullable().catch(null).optional(),
});

export const scopeResourceParser = z.object({
  id: z.string().catch(""),
  type: z.string().catch("structured-scope"),
  attributes: scopeAttributesParser,
});

// --- Generic JSON:API list envelope ---
export const linksParser = z
  .object({
    self: z.string().optional(),
    next: z.string().nullable().optional(),
    last: z.string().nullable().optional(),
  })
  .catch(() => ({}));

export function listParser<T extends z.ZodTypeAny>(itemParser: T) {
  return z.object({
    data: z.array(itemParser).catch(() => []),
    links: linksParser,
  });
}

export function singleParser<T extends z.ZodTypeAny>(itemParser: T) {
  return z.object({
    data: itemParser,
  });
}

// Concrete page parsers + inferred types (used by the backend to avoid
// circular type inference in the pagination loops).
export const programPageParser = listParser(programResourceParser);
export const scopePageParser = listParser(scopeResourceParser);
export type ProgramPage = z.infer<typeof programPageParser>;
export type ScopePage = z.infer<typeof scopePageParser>;

// ---------------------------------------------------------------------------
// Flattened domain types used by the frontend
// ---------------------------------------------------------------------------
export interface Program {
  handle: string;
  name: string;
  currency: string | null;
  submission_state: string;
  offers_bounties: boolean;
  offers_swag?: boolean;
  state?: string;
  policy?: string;
  profile_picture?: string;
  bounty_earned_for_user?: number | null;
  valid_reports_for_user?: number | null;
  reports_for_user?: number | null;

  // Optional fields enriched from the internal GraphQL API (hackerone.com/graphql).
  // Undefined until enrichment runs; the UI shows "—" when absent.
  resolved_reports?: number | null;
  response_efficiency?: number | null; // percentage
  reward_low?: number | null; // minimum_bounty_table_value
  reward_high?: number | null; // maximum_bounty_table_value
  reward_table?: RewardRow[];
}

// A row of HackerOne's bounty table. Each severity carries a min/max (a range
// when use_range is true, otherwise min === max). `name` labels the asset tier
// (null for the program-wide default row).
export interface RewardRow {
  name: string | null;
  use_range: boolean;
  low_min: number | null;
  low_max: number | null;
  medium_min: number | null;
  medium_max: number | null;
  high_min: number | null;
  high_max: number | null;
  critical_min: number | null;
  critical_max: number | null;
}

export interface Scope {
  id: string;
  asset_type: string;
  asset_identifier: string;
  eligible_for_bounty: boolean | null;
  eligible_for_submission: boolean | null;
  instruction: string | null;
  max_severity: string | null;
}

export interface ScopeBundle {
  handle: string;
  scopes: Scope[];
}

// Data enriched from the internal GraphQL API (hackerone.com/graphql), which the
// REST Hacker API does not expose.
export interface Enrichment {
  handle: string;
  resolved_reports: number | null;
  response_efficiency: number | null;
  reward_low: number | null;
  reward_high: number | null;
  currency: string | null;
  scopes_total: number | null;
  reward_table: RewardRow[];
}

// ---------------------------------------------------------------------------
// Plugin API + events contract (shared by backend and frontend)
// ---------------------------------------------------------------------------
type API = DefineAPI<{
  loadPrograms: (sdk: H1.BackendSDK, creds: H1Credentials) => Promise<void>;
  loadScopes: (sdk: H1.BackendSDK, handle: string, creds: H1Credentials) => Promise<void>;
  loadEnrichment: (sdk: H1.BackendSDK, handle: string) => Promise<void>;
}>;

type BackendEvents = DefineEvents<{
  program: (data: Program) => void;
  scopes: (data: ScopeBundle) => void;
  enrichment: (data: Enrichment) => void;
  enrichmentUnavailable: (message: string) => void;
  invalidCreds: () => void;
  error: (message: string) => void;
  stateChanged: (state: "loading" | "loaded") => void;
}>;

export declare namespace H1 {
  export type BackendSDK = SDK<API, BackendEvents>;
  export type FrontendSDK = Caido<API, BackendEvents>;
}
