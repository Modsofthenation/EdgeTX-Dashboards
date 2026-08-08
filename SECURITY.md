# Security Policy

## Supported use

This project is designed primarily as a **local / desktop** EdgeTX dashboard studio. The default security model is:

- `npm run dev` / desktop app on **loopback** (`localhost` / `127.0.0.1`) — API routes are open without a shared secret
- **Internet-facing** hosts — set `GENERATOR_API_SECRET` (or intentionally set `GENERATOR_ALLOW_UNAUTHENTICATED=1`)

Do **not** put long-lived `CURSOR_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` on a public server unless `GENERATOR_API_SECRET` is set and you accept that same-origin browser users of that host can spend those keys.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Email the maintainers via the GitHub profile for [Modsofthenation](https://github.com/Modsofthenation), or open a **private** security advisory on the repository (GitHub → Security → Advisories → New draft advisory) if that feature is enabled.

Include:

- Affected version / commit
- Reproduction steps
- Impact (key theft, chat DB access, disk fill, SSRF, etc.)

We aim to acknowledge reports within a few days.

## Deployment checklist

1. Prefer local or desktop use; treat hosted demos as untrusted multi-tenant unless you add real auth.
2. Set `GENERATOR_API_SECRET` on any non-loopback deploy. Same-origin browser calls from the web UI are allowed; external API clients must send `Authorization: Bearer …` or `x-generator-secret`.
3. Prefer **browser-entered** AI keys (Settings → AI) over server env keys on shared hosts.
4. Keep chat SQLite under `data/` (gitignored). Do not expose `WIDGET_GEN_DATA_DIR` backups publicly.
5. WASM firmware downloads default to a project blob mirror (`EDGETX_WASM_BASE`). Override that env var if you host your own mirror so public traffic does not depend on a single personal store.

## Known intentional limits

- Chat history APIs are **single-tenant** (no per-user accounts). With `GENERATOR_API_SECRET` set, same-origin browser users of that host can still call generate/chat APIs — do not treat a shared deploy as multi-tenant auth.
- Rate limits are in-process memory (per Node instance).
- `/api/health` is unauthenticated: loopback returns desktop readiness fields; non-loopback returns only `{ ok, service }`.
- Default WASM downloads use a project blob mirror. Public clones will hit that URL unless `EDGETX_WASM_BASE` is set (see [NOTICE.md](./NOTICE.md)).
