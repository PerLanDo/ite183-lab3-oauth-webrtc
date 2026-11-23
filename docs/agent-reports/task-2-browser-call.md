# Task 2 report

Branch: agent/browser-call   Last commit: (see `git log -1` on the branch)   Browser(s): the Claude desktop app's built-in browser pane, Chromium/Chrome 156.0.8078.100, Windows 11. Each tab has its own `sessionStorage`, so each tab is a separate session (decision #14).

Done by the integrator (Claude, main session) on 2026-11-24, with the BSL v1.3.4 server on port 3002 and `devLogin: 1`.

**Camera and microphone:** the browser pane blocks `getUserMedia` (`NotAllowedError`), so every tab sent the app's fallback: a canvas test pattern (the name and a running clock on a colour) plus a quiet oscillator tone. Real camera and microphone capture is **not yet tested**.

| Check | Result | Evidence |
|---|---|---|
| A sees B | PASS | `docs/screenshots/01-alice-connected.jpg`: Bob's green test pattern; pill `connected` |
| B sees A | PASS | `docs/screenshots/01-bob-connected.jpg`: Alice's blue test pattern; pill `connected` |
| A hears B / B hears A | PASS (tone only) | Bob's `inbound-rtp` audio `audioLevel` was 0.020 while Alice was unmuted (the test tone). No real voice tested. |
| chat A->B | PASS | Bob's chat shows `Alice: Hi Bob, Alice here 😀 <b>bold?</b>`: the emoji arrives intact, and the HTML is shown as text |
| chat B->A | PASS | Alice's chat shows `Bob: Hello Alice, Bob replying é` |
| mute | PASS | After Alice clicked Mute, Bob's received `audioLevel` went from 0.020 to 0; the button became "Unmute" |
| camera toggle | PASS | `docs/screenshots/02-bob-sees-alice-camera-off.jpg`: Bob's remote video is black; Alice's button became "Camera on" |
| room isolation (Carol) | PASS | `docs/screenshots/04-carol-other-room-sees-nothing.jpg`: Carol in `other` saw only "You joined room "other"" after Alice sent `SECRET-for-lab3-only` in `lab3` |
| room full | PASS | `docs/screenshots/03-carol-room-full.jpg`: "room is full (1:1 calls only)"; console shows the expected 409 |
| hang up + rejoin | PASS | `05-bob-sees-alice-hang-up.jpg`: Bob shows "Alice left (hang up)." and Alice is back in the lobby; `06-alice-rejoined-connected.jpg`: after rejoining, both sides show `connected` again |
| tab close -> timeout leave | PASS | `07-alice-sees-bob-timeout.jpg`: Bob's tab closed at 02:40:30; Alice showed "Bob left (timeout)." by 02:40:54 (not yet at 02:40:40). That is under 24 s; the exact second was not measured. |
| console errors | PASS | Alice: none. Carol: only the expected `409 (Conflict)` from the room-full join. |

## Bugs fixed (file:line, cause -> fix)

- `public/app.js:238-242` and `:254-257`: the peer label showed **"With Bob ()"** with empty brackets on the side that learns about the peer from a `join` poll message. **Cause:** `onMessage` (l.275) calls `setPeer` with `provider: ''`, because the server's `join` message carries no provider. **Fix:** `setPeer` leaves out the brackets when the provider is unknown, and the poll loop fills the provider in from `r.peers`, which the server already sends. Checked: after the fix, Alice showed "With Bob (dev)" (`docs/screenshots/08-peer-label-fixed.jpg`).

## Server issues found (not fixed)

- None that block the call.
- **Observation:** closing the tab did not produce a "hang up" leave; the server's 15 s timeout handled it. The client's `pagehide` keepalive `POST /leave` (`public/app.js`, near the end) either did not fire when the browser pane closed the tab, or did not reach the server. This matches the expected "timeout" result in the brief, so nothing was changed.

## API test after the changes

`BASE=http://localhost:3002 bash tests/api_test.sh`: `RESULT pass=29 fail=0`, `EXTRA fail=0`, `static /app.js byte-identical (16346 bytes)`, server alive afterwards.

## Not checked

- Real camera and microphone (blocked in the browser pane). This needs the owner in a normal browser (two Chrome profiles, or Chrome plus an incognito window) on `http://localhost:3002`.
- Hearing actual audio (only the test tone's level was measured).
- Two different browsers, or two machines on one LAN (no ICE servers, so only one machine or one LAN can work).
- Google and Facebook sign-in (they need the owner's client IDs).
