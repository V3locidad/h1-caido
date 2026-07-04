import {
  programPageParser,
  scopePageParser,
  type H1,
  type H1Credentials,
  type Program,
  type ProgramPage,
  type Scope,
  type ScopePage,
} from "@h1caido/common";
import { authHeaders, AuthError, fetchTyped, RateLimited } from "./utils";

const API = "https://api.hackerone.com/v1/hackers";

// GET /v1/hackers/programs — paginated list of programs the hacker can access.
// We follow JSON:API `links.next` until it is null.
export const loadPrograms = async (sdk: H1.BackendSDK, creds: H1Credentials): Promise<void> => {
  sdk.api.send("stateChanged", "loading");
  const headers = authHeaders(creds);
  try {
    let url: string | null = `${API}/programs?page[size]=100`;
    while (url) {
      const page: ProgramPage = await fetchTyped(url, programPageParser, headers);

      for (const item of page.data) {
        const a = item.attributes;
        const program: Program = {
          handle: a.handle,
          name: a.name || a.handle,
          currency: a.currency,
          submission_state: a.submission_state,
          offers_bounties: a.offers_bounties,
          offers_swag: a.offers_swag,
        };
        if (program.handle) {
          sdk.api.send("program", program);
        }
      }

      url = page.links.next ?? null;
    }
  } catch (error) {
    reportError(sdk, error);
    throw error;
  } finally {
    sdk.api.send("stateChanged", "loaded");
  }
};

// GET /v1/hackers/programs/{handle}/structured_scopes — loaded on demand only.
// This endpoint has a stricter 50 req/min rate limit, so the frontend calls it
// lazily (when a program is opened) rather than eagerly for every program.
export const loadScopes = async (
  sdk: H1.BackendSDK,
  handle: string,
  creds: H1Credentials
): Promise<void> => {
  const headers = authHeaders(creds);
  try {
    const scopes: Scope[] = [];
    let url: string | null = `${API}/programs/${encodeURIComponent(handle)}/structured_scopes?page[size]=100`;
    while (url) {
      const page: ScopePage = await fetchTyped(url, scopePageParser, headers);

      for (const item of page.data) {
        const a = item.attributes;
        scopes.push({
          id: item.id,
          asset_type: a.asset_type,
          asset_identifier: a.asset_identifier,
          eligible_for_bounty: a.eligible_for_bounty,
          eligible_for_submission: a.eligible_for_submission,
          instruction: a.instruction,
          max_severity: a.max_severity,
        });
      }

      url = page.links.next ?? null;
    }

    sdk.api.send("scopes", { handle, scopes });
  } catch (error) {
    reportError(sdk, error);
    throw error;
  }
};

function reportError(sdk: H1.BackendSDK, error: unknown): void {
  if (error instanceof AuthError) {
    sdk.api.send("invalidCreds");
    return;
  }
  if (error instanceof RateLimited) {
    sdk.api.send("error", "HackerOne rate limit reached — wait a minute and retry.");
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  sdk.api.send("error", message);
}
