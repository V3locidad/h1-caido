# H1Caido

A [Caido](https://caido.io) plugin that fetches **your HackerOne bug bounty programs** and imports their scope straight into Caido — the HackerOne counterpart to [YesWeCaido](https://github.com/yeswehack/yeswecaido).

## Features

- 🔑 Connect with your **HackerOne API token** (Basic auth — token identifier + value)
- 📋 List every program your account can access (public + private invites)
- 🔍 Filter by name/handle, or show only programs offering bounties
- 🎯 One click to **import a program's scope** (URL / wildcard / domain / IP assets) into a dedicated Caido scope (`h1:<handle>`)
- 🪪 Optionally add an identifying **User-Agent** Match & Replace rule per program
- 💾 Structured scopes are loaded **on demand** to respect HackerOne's 50 req/min rate limit
- 🔒 Credentials stay in your browser's local storage and are sent only to `api.hackerone.com`

## Getting an API token

Generate one at **https://hackerone.com/settings/api_token/edit** (requires a HackerOne
Community/Pro account). The token identifier is the "username" and the token value is the "password".

## Development

```bash
pnpm install
pnpm build      # produces dist/plugin_package.zip
pnpm watch      # rebuild on change
pnpm typecheck  # type-check all packages
```

Load the built `dist/plugin_package.zip` in Caido via **Settings → Plugins → Install package**.

## Architecture

Monorepo (pnpm workspaces), mirroring the YesWeCaido layout:

| Package | Role |
|---------|------|
| `packages/common` | Shared zod parsers for HackerOne's JSON:API responses + the plugin API/event contract |
| `packages/backend` | Runs in Caido's backend runtime — talks to `api.hackerone.com` (no CORS), streams programs/scopes to the frontend via events |
| `packages/frontend` | Vue 3 UI — credential form, program list, scope import buttons |

### HackerOne endpoints used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/hackers/programs` | List accessible programs (paginated via `links.next`) |
| `GET /v1/hackers/programs/{handle}/structured_scopes` | Structured scope of a program (rate limit: 50/min) |

## Notes vs. YesWeCaido

- HackerOne uses **HTTP Basic auth with a dedicated API token** instead of a JWT lifted from local storage — more robust and revocable.
- Responses are **JSON:API** (`data[].attributes`) rather than a flat schema.
- HackerOne does **not** expose a per-program custom User-Agent, so the UA rule is built from the program handle.

## License

MIT
