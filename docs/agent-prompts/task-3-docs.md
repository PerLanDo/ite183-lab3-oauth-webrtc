# Task 3: README, GAPS and test checklist (wave 1, parallel with Task 1)

- **Branch:** `agent/docs` (from `main`)
- **You own:** `README.md`, `GAPS.md`, `TESTING.md` (all new). Read anything else; edit nothing else.
- **Report:** `docs/agent-reports/task-3-docs.md`

## Context

Read `AGENTS.md`, `docs/decisions.md`, `docs/bsl-findings.md`, `server.bzg`, `public/app.js`, and the owner's brief `Lab 3 Agent Prompt Google OAuth + WebRTC.md`. Write for a student and their instructor: plain English, short sentences, no marketing words. Don't invent results; anything not yet tested is marked "not yet tested".

## Steps

1. **README.md**
   - What the app does (sign in, join a room, 1:1 video call, chat).
   - Install BSL (Windows: Microsoft Store "Bonezegei Scripting Language"; Linux `.deb`), check with `bonezegei --version`.
   - Setup: `bzg install`, `copy config.example.json config.json`, fill IDs, run `bonezegei server.bzg`, open `http://localhost:3000`. Note the port setting and the "port already in use" trap from bsl-findings.
   - Architecture: one diagram in text (browser ⇄ BSL server over HTTP polling; browser ⇄ browser over WebRTC media). List the endpoints from `server.bzg`.
   - Which parts are BSL and which are browser JS, and why (table).
   - "Unverified identity, lab demo only" for Google and Facebook. No ICE servers: works on one machine or one LAN only.
   - **Provider setup (owner does these):**
     - Google: Cloud Console → APIs & Services → Credentials → OAuth client ID → Web application; Authorized JavaScript origin `http://localhost:3000`; put the client ID in `config.json` `googleClientId`. Configure the OAuth consent screen and add test users.
     - Facebook: developers.facebook.com → Create app → add Facebook Login → add `http://localhost:3000` to allowed domains/Valid OAuth Redirect URIs and the JS SDK allowed domains; app ID into `facebookAppId`. Dev-mode apps work only for listed testers/admins.
     - GitHub: not possible in strict BSL (link GAPS.md).
   - devLogin: what it is, and "turn it off for the demo".
2. **GAPS.md**: one section per gap: what was wanted, why strict BSL can't do it, evidence (point to the exact row in `docs/bsl-findings.md` or a line in `server.bzg`), and what would fix it (e.g. "a minimal HTTPS helper, needs owner approval"). Cover at least:
   - Google ID-token signature not verified (no RSA, no outbound HTTPS client; `https` package is server-only).
   - Facebook access token not verified (no outbound HTTPS to graph.facebook.com); Facebook may refuse plain-HTTP pages; "not yet tested" until the owner provides an app ID.
   - GitHub sign-in impossible (code exchange needs client secret + HTTPS POST from the server; GitHub's token endpoint has no CORS for a browser-only flow).
   - Session tokens from a non-cryptographic RNG seeded by the clock.
   - No TLS for the app itself (http only; fine on localhost because browsers treat it as a secure context for camera/mic).
   - Socket limits: single `recv`, stale buffer, no timeouts, blocking accept; JSON 4 KB string limit; `+` 8 KB limit.
   - WebSocket was possible (`http` package, `base64`, `hash` exist) but not used by owner decision #3.
3. **TESTING.md**: the acceptance checklist as a table with empty Result columns: each provider login, two-window call, mute/camera/hang up, chat both ways, third window in another room gets nothing, room full, timeout leave, and the `tests/api_test.sh` run. Results get filled in after Tasks 1 and 2.
4. Check every command you write by running it (where it doesn't need credentials). Check every link and file path exists.

## Report format

```
# Task 3 report
Branch: agent/docs   Last commit: <hash>
## Files written (with line counts)
## Commands I ran to check the README (and output)
## Statements I could not verify (marked "not yet tested" in the docs)
## Questions for the owner
```
