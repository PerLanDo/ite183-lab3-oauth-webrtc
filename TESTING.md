# Test checklist and results

Results are filled in only from tests that were actually run. Anything else says **not yet tested**.

Environment so far: Windows 11, BSL v1.3.4 (build v1.3.4a), server on port 3002 (3000 is used by another app on the test PC), `devLogin: 1`. Browser: the Claude desktop app's built-in Chromium pane (Chrome 156). It blocks the camera and microphone, so the app's fallback test pattern (canvas video + a quiet tone) was used.

## Sign-in

| # | Check | How | Result | Evidence |
|---|---|---|---|---|
| L1 | Google sign-in | Sign in with a Google test user, then `/me` shows the name, provider `google` | **not yet tested**: needs the owner's Google client ID | — |
| L2 | Google: wrong client ID rejected | Token for another app → 401 "audience does not match" | **not yet tested** (with a real token) | — |
| L3 | Google disabled without a client ID | `POST /auth/google` with empty `googleClientId` → 503 | PASS | `tests/api_test.sh` "google without client id is 503" |
| L4 | Facebook sign-in | Sign in with a Facebook tester account | **not yet tested**: needs the owner's Meta app ID; plain-HTTP behaviour unknown | — |
| L5 | GitHub sign-in | Button disabled; `GET /auth/github` → 501 with reason | PASS (gap, as documented) | `tests/api_test.sh` "github endpoint explains gap (501)"; GAPS.md |
| L6 | Dev login | Name-only sign-in when `devLogin` is 1 | PASS | `docs/screenshots/01-*.jpg` |
| L7 | Not signed in → no access | `/poll` without a token → 401 | PASS | `tests/api_test.sh` "poll without login is 401" |
| L8 | Logout ends the session | After `/logout`, `/me` → "not signed in" | PASS | `tests/api_test.sh` "logout kills token" |

## Call and chat (two sessions, same room)

| # | Check | Result | Evidence |
|---|---|---|---|
| C1 | Two sessions join the same room; both show the other's video; state `connected` | PASS (test pattern, not a real camera) | `docs/screenshots/01-alice-connected.jpg`, `01-bob-connected.jpg` |
| C2 | Audio arrives both ways | PASS (test tone level only, no real voice) | Bob received audio level 0.020 from Alice's tone (`docs/agent-reports/task-2-browser-call.md`) |
| C3 | Chat A → B | PASS | Emoji and `<b>` shown as plain text, received intact |
| C4 | Chat B → A | PASS | `Hello Alice, Bob replying é` received |
| C5 | Mute silences the other side | PASS | Received audio level went 0.020 → 0 |
| C6 | Camera off blacks out the other side | PASS | `docs/screenshots/02-bob-sees-alice-camera-off.jpg` |
| C7 | Hang up: the other side sees "left (hang up)"; caller returns to the lobby | PASS | `docs/screenshots/05-bob-sees-alice-hang-up.jpg` |
| C8 | Rejoin after hang up reconnects the call | PASS | `docs/screenshots/06-alice-rejoined-connected.jpg` |
| C9 | Closing a tab: the other side sees "left (timeout)" within about 15–25 s | PASS | `docs/screenshots/07-alice-sees-bob-timeout.jpg` (under 24 s) |
| C10 | Real camera and microphone, two separate browsers (normal + incognito) | **not yet tested**: needs the owner's PC with a camera, in a normal browser | — |

## Room isolation

| # | Check | Result | Evidence |
|---|---|---|---|
| R1 | A third session in another room sees nothing from the first room | PASS | `docs/screenshots/04-carol-other-room-sees-nothing.jpg`; `tests/api_test.sh` "Carol (r2) sees no r1 messages" |
| R2 | A third session can't join a full room | PASS | `docs/screenshots/03-carol-room-full.jpg` ("room is full (1:1 calls only)"); `tests/api_test.sh` "room full for 3rd" |
| R3 | A session can't poll a room it isn't in | PASS | `tests/api_test.sh` "Carol cannot poll r1" |
| R4 | Can't send before joining | PASS | `tests/api_test.sh` "send before join is 403" |

## Automated endpoint test

```
BASE=http://localhost:3002 bash tests/api_test.sh
```

| Date | BSL | Result |
|---|---|---|
| 2026-11-24 | v1.3.3 | `RESULT pass=29 fail=0`, `EXTRA fail=0`, three runs in a row on fresh servers |
| 2026-11-24 | v1.3.4 | `RESULT pass=29 fail=0`, `EXTRA fail=0`, six runs (four on the Task 1 branch, one on main after merging it, one after the Task 2 client change) |

The extra checks cover emoji and `<script>` text round-trips, 50 rapid polls, surviving an idle client, and dropping an idle peer after 15 s. Known limit: an idle client blocks the server for about 5 s (see GAPS.md).

## Acceptance test (from the brief)

Two separate sessions (normal and incognito, or two browsers), different users, same room: see and hear each other, chat both ways, a third window in another room gets nothing, then hang up cleanly.

| Step | Result |
|---|---|
| With dev login and the test pattern (built-in browser) | PASS: C1–C9, R1, R2 |
| With real Google/Facebook sign-in and a real camera | **not yet tested**: owner to run on `http://localhost:3000` once the client IDs are in `config.json` and `devLogin` is 0 |
