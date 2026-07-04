import type { z } from "zod";
import { fetch } from "caido:http";
import type { H1Credentials } from "@h1caido/common";

export class FetchError extends Error {}
export class AuthError extends FetchError {}
export class NotFound extends FetchError {}
export class RateLimited extends FetchError {}

// The Caido backend runtime does not guarantee btoa/Buffer, so we implement a
// small, dependency-free base64 encoder for the (ASCII) Basic-auth credentials.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64(input: string): string {
  let output = "";
  let i = 0;
  while (i < input.length) {
    const c1 = input.charCodeAt(i++);
    const c2 = i < input.length ? input.charCodeAt(i++) : NaN;
    const c3 = i < input.length ? input.charCodeAt(i++) : NaN;

    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4);
    const e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6);
    const e4 = isNaN(c3) ? 64 : c3 & 63;

    output += B64.charAt(e1) + B64.charAt(e2) + B64.charAt(e3 === 64 ? 64 : e3) + B64.charAt(e4);
  }
  return output;
}

export function authHeaders(creds: H1Credentials): Record<string, string> {
  const token = base64(`${creds.username}:${creds.token}`);
  return {
    Authorization: `Basic ${token}`,
    Accept: "application/json",
  };
}

// Fetch a URL and validate the JSON response against a zod schema.
export async function fetchTyped<T extends z.ZodTypeAny>(
  url: string,
  schema: T,
  headers: Record<string, string> = {}
): Promise<z.infer<T>> {
  const resp = await fetch(url, { headers });

  if (resp.status === 401) {
    throw new AuthError("HackerOne rejected the API credentials (401)");
  }
  if (resp.status === 403) {
    throw new AuthError("HackerOne denied access with these credentials (403)");
  }
  if (resp.status === 404) {
    throw new NotFound(`Not found: ${url}`);
  }
  if (resp.status === 429) {
    throw new RateLimited("HackerOne rate limit reached (429), slow down");
  }
  if (!resp.ok) {
    throw new FetchError(`Request failed (${resp.status}) for ${url}`);
  }

  return schema.parse(await resp.json());
}
