# ITE183 Lab 3: sign-in + 1:1 video call + room chat (BSL server)

Two people sign in, join the same room, and get a 1:1 WebRTC video and audio call with a shared text chat. The server is written only in **Bonezegei Scripting Language (BSL)**. The browser part is plain HTML, CSS and JavaScript, with no frameworks.

- Sign in with Google or Facebook (unverified identity, lab demo only; see below). GitHub sign-in is not possible in strict BSL (see [GAPS.md](GAPS.md)).
- Join a room by name. A room holds at most 2 people.
- Video and audio go directly between the two browsers (WebRTC). Mute, camera on/off and hang up are supported.
- Chat goes only to the people in the same room.

## Install BSL

- **Windows:** install "Bonezegei Scripting Language" from the Microsoft Store (or `winget install --id XP9LZSQ13RSLNN --source msstore`).
- **Linux:** install the `.deb` package from the Bonezegei release page.

Check it:

```
bonezegei --version
```

This project was tested with **v1.3.4** (build v1.3.4a) and v1.3.3 on Windows 11.

## Run

```
bzg install
copy config.example.json config.json
bonezegei server.bzg
```

Then open **http://localhost:3000**.

- `bzg install` reads `package.json` and installs the BSL packages the server uses (`socket`, `base64`, `time`, `rng`) into `lib/`.
- On Linux or Git Bash, use `cp` instead of `copy`.
- `config.json` is git-ignored. Fill it in as described under "Provider setup".

### config.json

| Key | Meaning |
|---|---|
| `googleClientId` | Google OAuth Web client ID. Empty disables Google sign-in. |
| `facebookAppId` | Meta (Facebook) app ID. Empty disables Facebook sign-in. |
| `port` | Port to listen on (default 3000). |
| `devLogin` | `1` adds a name-only "Dev login" for local testing. **Set it to `0` for the demo.** |

**"Port already in use" trap:** on Windows, BSL can bind a port that another program already uses, and then some requests go to the other program. If the page looks wrong, run `netstat -ano | findstr :3000`, and change `port` if something else is listening there. The browser-side Google/Facebook settings must then use the same port.

## Architecture

```
 Browser A  (HTML + vanilla JS)                        Browser B
   |   ^                                                 |   ^
   |   |  HTTP: POST /send, GET /poll every 500 ms       |   |
   v   |  (sign-in, room join, chat, WebRTC signaling)   v   |
 +------------------------------------------------------------+
 |  server.bzg  (BSL, one connection at a time, in memory)    |
 |  sessions, rooms (max 2), message queue per room           |
 +------------------------------------------------------------+

 Browser A  <====== WebRTC audio + video (direct, peer to peer) ======>  Browser B
```

- The server only relays small messages: chat text and WebRTC signaling (offer, answer, ICE candidates). The video and audio never pass through it.
- Signaling uses **short polling**: each browser asks `GET /poll` about every 500 ms for new messages since the last one it saw.
- Sessions, rooms and messages live in memory. Restarting the server signs everyone out.
- **No ICE servers** (no STUN/TURN). The browsers use their local (host) addresses only, so a call works **on one machine or on one LAN**, not across the internet.

### Endpoints (`server.bzg`)

| Method | Path | What it does |
|---|---|---|
| GET | `/`, `/app.js`, `/style.css` | The client files from `public/`. |
| GET | `/config` | Public settings for the browser (client IDs, `devLogin`). No secrets. |
| GET | `/me` | The signed-in user. |
| GET | `/poll?room=R&since=N` | New messages in room R after number N, plus who is in the room. |
| GET | `/auth/github` | Returns 501 with the reason GitHub can't work (see GAPS.md). |
| POST | `/auth/google` | Google ID token → session (claims checked, signature not verified). |
| POST | `/auth/facebook` | Facebook login result → session (not verified). |
| POST | `/auth/dev` | Name-only sign-in, only when `devLogin` is 1. |
| POST | `/join` | Join a room (409 when it already has 2 people). |
| POST | `/send` | Send `kind: "chat"` or `kind: "signal"` to the room. |
| POST | `/leave` | Leave the room (hang up). |
| POST | `/logout` | End the session. |

Rules the server enforces:
- Only signed-in sessions (`Authorization: Bearer <token>`) can join, send or poll.
- A session can only send to and poll its own room.
- Someone who doesn't poll for 15 s is removed from the room, and the other person sees "left (timeout)".
- Each POST carries a one-time `nonce`, and replayed requests are rejected.

### What is BSL and what is browser JavaScript, and why

| Part | Where | Why there |
|---|---|---|
| HTTP server, static files | BSL (`server.bzg`) | Lab rule: the server is BSL only. |
| Sessions, rooms, room-only delivery, 15 s timeout | BSL | Must be enforced on the server, not trusted from the browser. |
| Google ID-token claim checks (`aud`, `iss`, `exp`) | BSL | Decoding base64url and JSON is possible in BSL. Verifying the RSA signature is not (GAPS.md). |
| Google / Facebook sign-in pop-ups | Browser (Google Identity Services, Facebook JS SDK) | These are browser SDKs; BSL has no outbound HTTPS client to talk to the providers. |
| Camera and microphone (`getUserMedia`), the call (`RTCPeerConnection`) | Browser | WebRTC exists only in browsers. Media goes peer to peer. |
| Polling loop, chat UI, mute/camera/hang up | Browser (`public/app.js`) | UI work; vanilla JS as required. |
| Splitting signaling into 900-character pieces | Browser | BSL's `parseJSON` fails on strings longer than about 4 KB, and an SDP offer can be bigger. |
| URI-encoding chat text | Browser | BSL corrupts emoji (surrogate pairs) inside JSON; encoding keeps the text ASCII on the way through. |

## Sign-in: what is and isn't verified

- **Google: unverified identity, lab demo only.** The browser gets a signed ID token from Google. The server checks the token's audience (your client ID), issuer and expiry, but **cannot verify the signature**, so a forged token with the right claims would be accepted.
- **Facebook: unverified identity, lab demo only.** The server accepts the name the browser sends after the Facebook SDK login. It **cannot check the access token** with Facebook.
- **GitHub: not available.** See [GAPS.md](GAPS.md).
- **Dev login:** a name only, no password. It exists so the call can be tested without provider accounts. It is turned on by `devLogin: 1` and **must be off (`0`) for the graded demo**.

## Provider setup (the owner does these)

Nobody else should type your passwords or create these for you.

### Google
1. Google Cloud Console → APIs & Services → **OAuth consent screen**: set it up (External, testing), and add your test users.
2. APIs & Services → **Credentials** → Create credentials → **OAuth client ID** → Application type **Web application**.
3. Under **Authorized JavaScript origins** add `http://localhost:3000` (and `http://localhost` if Google asks for it). Use your port if you changed it.
4. Copy the client ID (it ends in `.apps.googleusercontent.com`) into `config.json` → `googleClientId`. The client **secret is not needed and must not be put anywhere** in this project.

### Facebook
1. developers.facebook.com → **Create app** → add the **Facebook Login** product.
2. In Facebook Login settings, add `http://localhost:3000` where Meta asks for allowed domains and **Valid OAuth Redirect URIs**, and allow the **JavaScript SDK** for that domain.
3. Copy the **App ID** into `config.json` → `facebookAppId`. The app secret is not needed.
4. While the app is in development mode, only accounts listed as admins, developers or testers of the app can sign in.
5. Facebook may refuse plain `http://` pages. If it does, that's logged in GAPS.md. *Not yet tested.*

### GitHub
Not possible in strict BSL. See [GAPS.md](GAPS.md#github-sign-in).

## Testing

- Automated endpoint test (needs `curl` and `node`, used only by the test, not by the app):
  ```
  BASE=http://localhost:3000 bash tests/api_test.sh
  ```
  Expected: `RESULT pass=29 fail=0` and `EXTRA fail=0`.
- Manual checklist and results: [TESTING.md](TESTING.md). Screenshots are in `docs/screenshots/`.

## Project files

| Path | What |
|---|---|
| `server.bzg` | The whole server (BSL). |
| `public/index.html`, `public/app.js`, `public/style.css` | The browser client. |
| `config.example.json` | Template for `config.json` (committed; `config.json` is not). |
| `package.json` | BSL package list for `bzg install`. |
| `tests/api_test.sh` | Endpoint test. |
| `GAPS.md` | What strict BSL could not do, and why. |
| `TESTING.md` | Test checklist and results. |
| `docs/bsl-findings.md` | Measured BSL limits (the evidence for GAPS.md). |
| `docs/decisions.md` | Decision log. |
