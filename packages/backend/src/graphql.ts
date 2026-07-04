import { fetch, Blob } from "caido:http";
import { z } from "zod";
import type { Enrichment, H1 } from "@h1caido/common";

const GRAPHQL = "https://hackerone.com/graphql";

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

// Enrich a program with data the REST API does not expose (report count, reward
// range, scope count). This data is PUBLIC on HackerOne's GraphQL endpoint for
// public programs — no authentication is required. Sending an Authorization
// header actually gets the request rejected, so we send none. Private programs
// simply return null and the UI keeps showing "—".
export const loadEnrichment = async (sdk: H1.BackendSDK, handle: string): Promise<void> => {
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
        Origin: "https://hackerone.com",
        Referer: `https://hackerone.com/${handle}`,
        "X-Product-Area": "team_profile",
        "X-Product-Feature": "overview",
      },
      body: new Blob([payload], { type: "application/json" }),
    });

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
    const message = error instanceof Error ? error.message : String(error);
    sdk.api.send("enrichmentUnavailable", `GraphQL enrichment failed: ${message}`);
  }
};
