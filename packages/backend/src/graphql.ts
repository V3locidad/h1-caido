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
      response_efficiency_percentage
      minimum_bounty_table_value
      maximum_bounty_table_value
      hide_bounty_amounts
      assets_in_scope: structured_scopes_search(eligible_for_submission: true) {
        total_count
      }
      bounty_table {
        bounty_table_rows {
          edges {
            node {
              name
              use_range
              low low_minimum
              medium medium_minimum
              high high_minimum
              critical critical_minimum
            }
          }
        }
      }
    }
  }
}`;

const rowNode = z.object({
  name: z.string().nullable().catch(null),
  use_range: z.boolean().catch(false),
  low: z.number().nullable().catch(null),
  low_minimum: z.number().nullable().catch(null),
  medium: z.number().nullable().catch(null),
  medium_minimum: z.number().nullable().catch(null),
  high: z.number().nullable().catch(null),
  high_minimum: z.number().nullable().catch(null),
  critical: z.number().nullable().catch(null),
  critical_minimum: z.number().nullable().catch(null),
});

const responseParser = z.object({
  data: z
    .object({
      resource: z
        .object({
          __typename: z.string().catch(""),
          currency: z.string().nullable().catch(null),
          resolved_report_count: z.number().nullable().catch(null),
          response_efficiency_percentage: z.number().nullable().catch(null),
          minimum_bounty_table_value: z.number().nullable().catch(null),
          maximum_bounty_table_value: z.number().nullable().catch(null),
          hide_bounty_amounts: z.boolean().nullable().catch(null),
          assets_in_scope: z
            .object({ total_count: z.number().nullable().catch(null) })
            .nullable()
            .catch(null),
          bounty_table: z
            .object({
              bounty_table_rows: z
                .object({ edges: z.array(z.object({ node: rowNode })).catch(() => []) })
                .nullable()
                .catch(null),
            })
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
    const hide = team?.hide_bounty_amounts === true;
    const rows = hide ? [] : (team?.bounty_table?.bounty_table_rows?.edges ?? []).map((e) => e.node);

    const enrichment: Enrichment = {
      handle,
      resolved_reports: team?.resolved_report_count ?? null,
      response_efficiency: team?.response_efficiency_percentage ?? null,
      reward_low: hide ? null : team?.minimum_bounty_table_value ?? null,
      reward_high: hide ? null : team?.maximum_bounty_table_value ?? null,
      currency: team?.currency ?? null,
      scopes_total: team?.assets_in_scope?.total_count ?? null,
      reward_table: rows.map((n) => ({
        name: n.name,
        use_range: n.use_range,
        low_min: n.low_minimum,
        low_max: n.low,
        medium_min: n.medium_minimum,
        medium_max: n.medium,
        high_min: n.high_minimum,
        high_max: n.high,
        critical_min: n.critical_minimum,
        critical_max: n.critical,
      })),
    };
    sdk.api.send("enrichment", enrichment);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sdk.api.send("enrichmentUnavailable", `GraphQL enrichment failed: ${message}`);
  }
};
