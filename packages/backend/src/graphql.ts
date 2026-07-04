import { fetch, Blob } from "caido:http";
import { z } from "zod";
import type { Enrichment, H1, H1Session } from "@h1caido/common";
import { AuthError } from "./utils";

const GRAPHQL = "https://hackerone.com/graphql";

// Build the Cookie header from whatever the user pasted: a bare __Host-session
// value, or a full "name=value; name2=value2" Cookie header.
function cookieHeader(cookie: string): string {
  const value = cookie.trim();
  return value.includes("=") ? value : `__Host-session=${value}`;
}

// Lean query over the fields the REST API does not expose. Field names come from
// HackerOne's own `LayoutDispatcher` query (the team profile page).
const QUERY = `query H1CaidoEnrich($handle: URI!) {
  resource(url: $handle) {
    __typename
    ... on Team {
      handle
      currency
      resolved_report_count
      average_bounty_lower_amount
      average_bounty_upper_amount
      assets_in_scope: structured_scopes_search(eligible_for_submission: true) {
        total_count
      }
    }
  }
}`;

const responseParser = z.object({
  data: z
    .object({
      resource: z
        .object({
          __typename: z.string().catch(""),
          currency: z.string().nullable().catch(null),
          resolved_report_count: z.number().nullable().catch(null),
          average_bounty_lower_amount: z.number().nullable().catch(null),
          average_bounty_upper_amount: z.number().nullable().catch(null),
          assets_in_scope: z
            .object({ total_count: z.number().nullable().catch(null) })
            .nullable()
            .catch(null),
        })
        .nullable()
        .catch(null),
    })
    .nullable()
    .catch(null),
  errors: z
    .array(z.object({ message: z.string().catch("") }))
    .optional(),
});

// Enrich a program with data from the internal GraphQL API. This is best-effort:
// if the token is not accepted on the GraphQL endpoint, we surface an error once
// and the UI keeps showing "—".
export const loadEnrichment = async (
  sdk: H1.BackendSDK,
  handle: string,
  session: H1Session
): Promise<void> => {
  try {
    const payload = JSON.stringify({
      operationName: "H1CaidoEnrich",
      query: QUERY,
      variables: { handle },
    });
    const resp = await fetch(GRAPHQL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Cookie: cookieHeader(session.cookie),
        ...(session.csrf ? { "X-Auth-Token": session.csrf } : {}),
      },
      body: new Blob([payload], { type: "application/json" }),
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new AuthError("GraphQL rejected the session");
    }
    if (!resp.ok) {
      throw new Error(`GraphQL request failed (${resp.status})`);
    }

    const parsed = responseParser.parse(await resp.json());
    if (parsed.errors?.length) {
      throw new Error(parsed.errors[0]?.message || "GraphQL error");
    }

    const team = parsed.data?.resource;
    const enrichment: Enrichment = {
      handle,
      resolved_reports: team?.resolved_report_count ?? null,
      reward_low: team?.average_bounty_lower_amount ?? null,
      reward_high: team?.average_bounty_upper_amount ?? null,
      currency: team?.currency ?? null,
      scopes_total: team?.assets_in_scope?.total_count ?? null,
    };
    sdk.api.send("enrichment", enrichment);
  } catch (error) {
    if (error instanceof AuthError) {
      sdk.api.send(
        "enrichmentUnavailable",
        "Your HackerOne session was rejected on hackerone.com/graphql. Re-copy your __Host-session cookie (and X-Auth-Token if needed)."
      );
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    sdk.api.send("enrichmentUnavailable", `GraphQL enrichment failed: ${message}`);
  }
};
