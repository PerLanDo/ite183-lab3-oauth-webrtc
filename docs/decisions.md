# Decision log

| # | Date | Decision | By |
|---|------|----------|----|
| 1 | 2026-11-23 | All server-side code is BSL (`.bzg`). Only browser HTML/CSS/vanilla JS is allowed besides it. No Node, Python, frameworks or Firebase in the app. | owner |
| 2 | 2026-11-23 | Local only, `http://localhost:3000`. No deployment, no cloud backend. | owner |
| 3 | 2026-11-23 | Signaling and chat use short polling (`POST /send`, `GET /poll` about every 500 ms), not WebSocket. | owner |
| 4 | 2026-11-23 | Server handles one connection at a time with BSL_Socket; no threads. | owner |
| 5 | 2026-11-23 | No ICE servers; host candidates only (one machine or one LAN). | owner |
| 6 | 2026-11-23 | Sign-in with Google, GitHub and Facebook as far as strict BSL allows; each gap goes in `GAPS.md` with reason and evidence. | owner |
| 7 | 2026-11-23 | No non-BSL helper (e.g. a Node proxy) without asking the owner first. | owner |
| 8 | 2026-11-23 | Client IDs live in `config.json` (git-ignored); `config.example.json` is committed. No secrets in git. | owner |
| 9 | 2026-11-23 | Only signed-in sessions may join, send or poll; room messages go only to that room. | owner |
| 10 | 2026-11-23 | Nobody enters passwords or credentials for the owner; provider consoles are the owner's job. | owner |
| 11 | 2026-11-23 | Port is read from `config.json` (`"port"`, default 3000) because another app on the owner's PC already listens on 3000. Dev testing uses 3001. | proposed by Claude, review later |
| 12 | 2026-11-23 | A `devLogin` option (config flag, default off) gives a name-only sign-in so the call can be tested without provider credentials. Must be off for the graded demo. | proposed by Claude, review later |
| 13 | 2026-11-23 | Rooms hold at most 2 people (1:1 calls). | proposed by Claude, review later |
| 14 | 2026-11-23 | Sessions use a per-tab `Authorization: Bearer` token in `sessionStorage`, not cookies, so two tabs of one browser can be two users. | proposed by Claude, review later |
| 15 | 2026-11-23 | Google ID token: server decodes the payload and checks `aud`, `iss`, `exp`, but cannot verify the signature. Labelled "unverified identity, lab demo only". | proposed by Claude, review later |

Deadline: Lab 3 and Lab 5 repos due **2026-11-29**.
