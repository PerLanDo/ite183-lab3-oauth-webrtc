# Task 3 report

Branch: agent/docs   Last commit: (see `git log -1` on the branch)

Written by the integrator (Claude, main session) on 2026-11-24, after Tasks 1 and 2 were merged, so the docs include their real results.

## Files written (with line counts)

- `README.md`: 152 lines (what the app does, install, run, config, architecture diagram, endpoints, BSL vs browser table, sign-in limits, provider setup, testing, files)
- `GAPS.md`: 66 lines (Google signature, Facebook token, GitHub, RNG, no TLS, socket limits, string/memory limits, WebSocket not used, no ICE servers)
- `TESTING.md`: 64 lines (sign-in, call/chat, isolation, API test runs, acceptance test)

## Commands I ran to check the README (and output)

- `bonezegei --version` → `Bonezegei Script Interpreter v1.3.4`, `Build Version: v1.3.4a`
- `bzg --help` → lists `install  Install dependencies listed in package.json` (confirms `bzg install` with no arguments)
- `winget list --name Bonezegei` → id `XP9LZSQ13RSLNN`, source `msstore` (the id used in the README)
- `bonezegei server.bzg` + `BASE=http://localhost:3002 bash tests/api_test.sh` → `RESULT pass=29 fail=0`, `EXTRA fail=0`
- Every link and backticked path in the three files exists (scripted check).
- The README claims about the server were checked against the code: `googleSignIn()` checks `aud`, `iss`, `exp`; `facebookSignIn()` trusts the name; `/auth/github` returns 501; room full is 409; `PEER_TIMEOUT_MS = 15000`; `MAX_BODY = 4000`; the GitHub button is `disabled` in `public/index.html`.

## Statements I could not verify (marked "not yet tested" in the docs)

- Google sign-in with a real client ID and test user.
- Facebook sign-in, and whether Facebook accepts plain `http://localhost`.
- A real camera and microphone, and two separate browsers.
- The Linux `.deb` install (no Linux machine; the statement comes from the owner's brief).
- The exact Google and Meta console menu names. They are written from general knowledge of those consoles and may differ slightly.

## Questions for the owner

1. Create the Google OAuth client and the Meta app, and put the IDs in `config.json`. The steps are in README.md.
2. A minimal non-BSL helper (decision #7) would fix Google signature verification, Facebook token checks and GitHub sign-in. Default: not allowed. Do you want it?
3. Run the final acceptance test with a real camera on `http://localhost:3000` with `devLogin: 0`, or tell us which port to document if 3000 stays taken.
