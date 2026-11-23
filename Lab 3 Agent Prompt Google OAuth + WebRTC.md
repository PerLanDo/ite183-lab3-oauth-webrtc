# Lab 3 Agent Prompt: Google OAuth + WebRTC

## Role

You are a senior engineer. Build ITE183 Lab 3 (Google OAuth and WebRTC) to run locally, in strict Bonezegei Scripting Language (BSL) on the server. Work autonomously, commit often, and report blockers plainly (cause, then fix). Never claim something works until you have run it.

## Goal

A web app on localhost where users sign in, join a room, video call peer-to-peer with WebRTC, and chat during the call.

## Requirements

1. **Auth:** Sign in with Google, GitHub, and Facebook. Implement each as far as strict BSL allows and log every provider that cannot work in `GAPS.md`.
2. **Video:** 1:1 video and audio calling via WebRTC (getUserMedia, RTCPeerConnection). Include mute, camera toggle, and hang up.
3. **Chat:** Real-time text chat beside the video, scoped to the room.
4. **Hosting:** Local only (`http://localhost:3000`). No deployment, no cloud backend.
5. **Language:** All server-side code is BSL (`.bzg`). The only non-BSL code allowed is the minimal vanilla HTML/CSS/JS that browsers require for the UI and WebRTC. No Node, Python, frameworks, or Firebase.

## Verified BSL limits (from the repo docs; re-check before relying on them)

- BSL is a C interpreter run with `bonezegei script.bzg`. Packages install with `bzg install <name>`.
- BSL\_Socket is TCP only: `socket_init`, `socket_create`, `socket_bind`, `socket_listen`, `socket_accept` (blocking), `socket_connect`, `socket_read`, `socket_write`, `socket_close`, `socket_cleanup`. Load it with `include("lib/socket.bzg");`. The repo shows a custom HTTP server example.
- The standard library documents only file I/O (`readFile`, `writeFile`, ...), JSON (`parseJSON`, `stringifyJSON`, `loadJSON`), and `delay`/`millis`/`sizeof`.
- Not documented: TLS/HTTPS, SHA-1, base64, process execution, UDP, and the BSL\_Thread API.

## Architecture (designed around those limits)

- One BSL server script (`server.bzg`) on BSL\_Socket. It accepts one connection at a time, handles the request, and closes it. No threads are needed because every request returns immediately.
- It serves the static client files (`index.html`, `app.js`, `style.css`) over plain HTTP.
- Signaling and chat use short polling, not WebSocket: the client sends `POST /send` and polls `GET /poll?room=...&since=...` about every 500 ms. WebSocket is out because its handshake needs SHA-1 and base64, which BSL does not document.
- The server keeps rooms, sessions, and message queues in memory. Use JSON for all payloads.
- The browser client uses vanilla JS only: `getUserMedia`, `RTCPeerConnection`, `fetch`. Use no ICE servers; host candidates are enough on one machine or one LAN. Say so in the README.

## Login plan and known gaps

- Strict BSL has no TLS, so the server cannot call Google, GitHub, or Facebook over HTTPS. It cannot exchange authorization codes or verify tokens itself.
- **Google:** use Google Identity Services in the browser to get a signed ID token. The BSL server cannot verify its signature, so it can only trust the claims. Label this "unverified identity, lab demo only" in the README.
- **Facebook:** use the Facebook JS SDK in the browser, with the same limitation. Facebook may refuse plain HTTP; if so, log it in `GAPS.md`.
- **GitHub:** has no browser-only flow, because its code exchange needs the client secret over HTTPS. Expect this to be a gap. Write down why in `GAPS.md`.
- Do not add a non-BSL helper (a Node proxy, for example) on your own. If a provider cannot work in strict BSL, stop, write it in `GAPS.md`, and ask me whether to allow a minimal helper.

## Provider setup (list the exact manual steps for me)

- **Google:** create an OAuth Web client in Google Cloud Console. Authorized JavaScript origin: `http://localhost:3000`.
- **Facebook:** create a Meta app with Facebook Login. Add `http://localhost:3000` as a valid origin or redirect. Dev-mode apps only allow listed testers.
- **GitHub:** create an OAuth App with callback `http://localhost:3000/auth/github/callback` only if a strict-BSL path exists.
- Put client IDs in a `config.json` loaded with `loadJSON`. Never commit secrets; commit `config.example.json`.
- Login still needs internet to reach the providers. Only the app itself is local.

## Security

- Only logged-in sessions can join rooms, send, or poll. Room messages go only to room participants.
- Do not enter passwords or secrets for me. Stop and ask me for any credential or login step.

## Deliverables

- GitHub repo (public or shared with my instructor) with clean commit history. Repos for Labs 3 and 5 are due Nov 29.
- One-command start (`bonezegei server.bzg`) and the localhost URL.
- `README.md`: install BSL, run steps, architecture, which parts are BSL and which are browser JS, and why.
- `GAPS.md`: everything strict BSL could not do, with the reason and the evidence.
- Test checklist and results: each login attempted, two-window call, chat both ways.

## Acceptance test

Open `http://localhost:3000` in two separate sessions (normal and incognito, or two browsers). Sign in as different users, join the same room, see and hear each other, exchange chat messages in both directions, check that a third window in another room gets nothing, then hang up cleanly.

## Rules

- Ask me only for what blocks you (credentials, provider consoles, the helper decision).
- Verify before saying done: run it and test it on localhost.
- State errors plainly: cause, then fix.
