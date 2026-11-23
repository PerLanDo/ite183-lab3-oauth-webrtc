// ITE183 Lab 3 browser client: sign-in, WebRTC 1:1 call, room chat.
// Talks to the BSL server with fetch() short polling (no WebSocket).
'use strict';

const POLL_MS = 500;
const CHUNK = 900;          // signal payload chars per POST (server JSON strings must stay < 4 KB)
const REQUEST_TIMEOUT = 6000;

const $ = (id) => document.getElementById(id);

const state = {
  token: sessionStorage.getItem('token') || '',
  me: null,
  config: null,
  room: '',
  since: 0,
  polling: false,
  pollTimer: null,
  pc: null,
  localStream: null,
  pendingCandidates: [],
  chunks: new Map(),
  peer: null,
};

// ------------------------------------------------------------------ HTTP
function nonce() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Keep request bodies pure ASCII so byte length equals character length.
function asciiJSON(obj) {
  return JSON.stringify(obj).replace(/[\u007f-￿]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

async function api(method, path, body) {
  const headers = {};
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const opts = { method, headers, cache: 'no-store' };
  if (body) {
    const n = nonce();
    body.nonce = n;
    headers['Content-Type'] = 'application/json';
    headers['X-Nonce'] = n;
    opts.body = asciiJSON(body);
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT);
  opts.signal = ctl.signal;
  try {
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => ({ ok: 0, error: 'bad response' }));
    data.status = res.status;
    return data;
  } catch (e) {
    return { ok: 0, error: e.name === 'AbortError' ? 'request timed out' : 'server unreachable', status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------------ views
function show(view) {
  for (const v of ['loginView', 'lobbyView', 'callView']) $(v).classList.toggle('hidden', v !== view);
  $('userbar').classList.toggle('hidden', !state.me);
  if (state.me) {
    $('whoami').textContent = `${state.me.name} · ${state.me.provider}` +
      (state.me.provider === 'dev' ? '' : ' (unverified)');
  }
}

function sysChat(text) { addChat(null, text, false, true); }

function addChat(who, text, mine, system) {
  const li = document.createElement('li');
  if (system) {
    li.className = 'sys';
    li.textContent = text;
  } else {
    if (mine) li.className = 'mine';
    const w = document.createElement('span');
    w.className = 'who';
    w.textContent = who + ':';
    li.append(w, document.createTextNode(text));
  }
  $('chatLog').append(li);
  $('chatLog').scrollTop = $('chatLog').scrollHeight;
}

// ------------------------------------------------------------------ sign-in
async function finishLogin(provider, payload) {
  $('loginError').textContent = '';
  const r = await api('POST', '/auth/' + provider, payload);
  if (!r.ok) {
    $('loginError').textContent = `${provider} sign-in failed: ${r.error}`;
    return;
  }
  state.token = r.token;
  state.me = r.me;
  sessionStorage.setItem('token', r.token);
  enterLobby();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('could not load ' + src));
    document.head.append(s);
  });
}

async function setupGoogle(clientId) {
  if (!clientId) {
    $('googleNote').textContent = 'Set googleClientId in config.json to enable Google sign-in.';
    return;
  }
  try {
    await loadScript('https://accounts.google.com/gsi/client');
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (resp) => finishLogin('google', { credential: resp.credential }),
    });
    google.accounts.id.renderButton($('googleBtn'), { theme: 'outline', size: 'large', text: 'continue_with' });
    $('googleNote').textContent = 'The server checks the token audience, issuer and expiry, but cannot verify its signature.';
  } catch (e) {
    $('googleNote').textContent = 'Google Identity Services did not load (offline?).';
  }
}

async function setupFacebook(appId) {
  if (!appId) {
    $('fbNote').textContent = 'Set facebookAppId in config.json to enable Facebook sign-in.';
    return;
  }
  try {
    await loadScript('https://connect.facebook.net/en_US/sdk.js');
    FB.init({ appId, version: 'v19.0', cookie: false, xfbml: false });
    $('fbBtn').disabled = false;
    $('fbNote').textContent = 'The server cannot check the Facebook token, so the name is trusted as sent.';
    $('fbBtn').onclick = () => {
      FB.login((resp) => {
        if (!resp.authResponse) {
          $('loginError').textContent = 'Facebook sign-in was cancelled or blocked.';
          return;
        }
        const { accessToken, userID } = resp.authResponse;
        FB.api('/me', { fields: 'name' }, (me) => {
          finishLogin('facebook', { accessToken, userID, name: (me && me.name) || 'Facebook user' });
        });
      }, { scope: 'public_profile' });
    };
  } catch (e) {
    $('fbNote').textContent = 'Facebook SDK did not load (offline or blocked).';
  }
}

async function boot() {
  state.config = await api('GET', '/config');
  const cfg = state.config;
  setupGoogle(cfg.googleClientId);
  setupFacebook(cfg.facebookAppId);
  if (cfg.devLogin === 1) $('devBox').classList.remove('hidden');

  const urlRoom = new URLSearchParams(location.search).get('room');
  if (urlRoom) $('roomInput').value = urlRoom;

  if (state.token) {
    const r = await api('GET', '/me');
    if (r.ok) {
      state.me = r.me;
      enterLobby();
      return;
    }
    sessionStorage.removeItem('token');
    state.token = '';
  }
  show('loginView');
}

$('devForm').addEventListener('submit', (e) => {
  e.preventDefault();
  finishLogin('dev', { name: $('devName').value.trim() });
});

$('logoutBtn').addEventListener('click', async () => {
  await endCall(false);
  await api('POST', '/logout', {});
  sessionStorage.removeItem('token');
  state.token = '';
  state.me = null;
  if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
  show('loginView');
});

function enterLobby() {
  show('lobbyView');
  $('joinError').textContent = '';
}

// ------------------------------------------------------------------ room
$('joinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const room = $('roomInput').value.trim();
  const r = await api('POST', '/join', { room });
  if (!r.ok) {
    $('joinError').textContent = r.error;
    if (r.status === 401) show('loginView');
    return;
  }
  state.room = room;
  state.since = r.since;
  $('roomName').textContent = room;
  $('chatLog').textContent = '';
  show('callView');
  history.replaceState(null, '', '?room=' + encodeURIComponent(room));
  sysChat(`You joined room "${room}".`);

  await startMedia();
  const others = r.peers.filter((p) => p.sid !== state.me.sid);
  if (others.length) {
    // The newcomer makes the offer.
    setPeer(others[0]);
    createPeer();
    await makeOffer();
  } else {
    setPeer(null);
    createPeer();
  }
  startPolling();
});

function setPeer(p) {
  state.peer = p;
  $('peerStatus').textContent = p ? `With ${p.name} (${p.provider})` : 'Waiting for someone to join...';
}

function startPolling() {
  state.polling = true;
  const loop = async () => {
    if (!state.polling) return;
    const r = await api('GET', `/poll?room=${encodeURIComponent(state.room)}&since=${state.since}`);
    if (!state.polling) return;
    if (r.ok) {
      state.since = r.seq;
      for (const m of r.messages) await onMessage(m);
    } else if (r.status === 401 || r.status === 403) {
      sysChat('Disconnected from the room: ' + r.error);
      await endCall(false);
      return;
    }
    state.pollTimer = setTimeout(loop, POLL_MS);
  };
  loop();
}

async function onMessage(m) {
  if (m.type === 'chat') {
    let text = m.data;
    try { text = decodeURIComponent(m.data); } catch (e) { /* show as received */ }
    addChat(m.name, text, false, false);
  } else if (m.type === 'join') {
    sysChat(`${m.name} joined.`);
    setPeer({ sid: m.from, name: m.name, provider: '' });
    createPeer();               // fresh connection; the newcomer will send the offer
  } else if (m.type === 'leave') {
    sysChat(`${m.name} left (${m.data}).`);
    setPeer(null);
    $('remoteVideo').srcObject = null;
    createPeer();
  } else if (m.type === 'signal') {
    const d = m.data;
    let buf = state.chunks.get(d.id);
    if (!buf) { buf = { parts: new Array(d.n), got: 0 }; state.chunks.set(d.id, buf); }
    if (buf.parts[d.i] === undefined) { buf.parts[d.i] = d.c; buf.got++; }
    if (buf.got === d.n) {
      state.chunks.delete(d.id);
      await onSignal(JSON.parse(buf.parts.join('')));
    }
  }
}

// ------------------------------------------------------------------ WebRTC
async function startMedia() {
  if (state.localStream) return;
  $('mediaNote').classList.add('hidden');
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (e1) {
    try {
      state.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      note('No camera available: audio only.');
    } catch (e2) {
      state.localStream = testPattern();
      note(`No camera or microphone (${e1.name}): sending a test pattern.`);
    }
  }
  $('localVideo').srcObject = state.localStream;
  updateButtons();
}

function note(text) {
  $('mediaNote').textContent = text;
  $('mediaNote').classList.remove('hidden');
}

// Synthetic stream so the call still connects on machines without devices.
function testPattern() {
  const canvas = Object.assign(document.createElement('canvas'), { width: 320, height: 240 });
  const ctx = canvas.getContext('2d');
  const label = state.me ? state.me.name : 'test';
  let t = 0;
  setInterval(() => {
    t++;
    ctx.fillStyle = `hsl(${(t * 3) % 360} 60% 35%)`;
    ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText(label, 20, 120);
    ctx.fillText(new Date().toLocaleTimeString(), 20, 160);
  }, 100);
  const stream = canvas.captureStream(10);
  try {
    const ac = new AudioContext();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    gain.gain.value = 0.02;
    const dest = ac.createMediaStreamDestination();
    osc.connect(gain).connect(dest);
    osc.start();
    stream.addTrack(dest.stream.getAudioTracks()[0]);
  } catch (e) { /* audio is optional */ }
  return stream;
}

function createPeer() {
  if (state.pc) {
    state.pc.onicecandidate = state.pc.ontrack = state.pc.onconnectionstatechange = null;
    state.pc.close();
  }
  state.pendingCandidates = [];
  state.chunks.clear();
  // No ICE servers: host candidates work on one machine or one LAN.
  const pc = new RTCPeerConnection({ iceServers: [] });
  state.pc = pc;
  for (const track of state.localStream.getTracks()) pc.addTrack(track, state.localStream);
  pc.onicecandidate = (e) => {
    if (e.candidate && pc === state.pc) sendSignal({ type: 'candidate', candidate: e.candidate.toJSON() });
  };
  pc.ontrack = (e) => {
    if (pc === state.pc) $('remoteVideo').srcObject = e.streams[0];
  };
  pc.onconnectionstatechange = () => {
    if (pc !== state.pc) return;
    $('connState').textContent = pc.connectionState;
    if (pc.connectionState === 'connected') sysChat('Call connected.');
  };
  $('connState').textContent = 'new';
  return pc;
}

async function makeOffer() {
  const pc = state.pc;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await sendSignal({ type: 'offer', sdp: pc.localDescription.sdp });
}

async function onSignal(s) {
  const pc = state.pc;
  if (!pc) return;
  try {
    if (s.type === 'offer') {
      await pc.setRemoteDescription({ type: 'offer', sdp: s.sdp });
      await flushCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal({ type: 'answer', sdp: pc.localDescription.sdp });
    } else if (s.type === 'answer') {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription({ type: 'answer', sdp: s.sdp });
        await flushCandidates();
      }
    } else if (s.type === 'candidate') {
      if (pc.remoteDescription) await pc.addIceCandidate(s.candidate);
      else state.pendingCandidates.push(s.candidate);
    }
  } catch (e) {
    console.warn('signal error', e);
  }
}

async function flushCandidates() {
  const list = state.pendingCandidates;
  state.pendingCandidates = [];
  for (const c of list) {
    try { await state.pc.addIceCandidate(c); } catch (e) { console.warn('candidate', e); }
  }
}

// Signals are chunked: BSL's parseJSON rejects strings over ~4 KB and SDP is larger.
let sendQueue = Promise.resolve();
function sendSignal(obj) {
  const text = JSON.stringify(obj);
  const id = nonce();
  const n = Math.ceil(text.length / CHUNK);
  sendQueue = sendQueue.then(async () => {
    for (let i = 0; i < n; i++) {
      const c = text.slice(i * CHUNK, (i + 1) * CHUNK);
      const r = await api('POST', '/send', { room: state.room, kind: 'signal', data: { id, i, n, c } });
      if (!r.ok) console.warn('signal send failed', r.error);
    }
  });
  return sendQueue;
}

// ------------------------------------------------------------------ controls
function updateButtons() {
  const s = state.localStream;
  const a = s && s.getAudioTracks()[0];
  const v = s && s.getVideoTracks()[0];
  $('muteBtn').textContent = a && !a.enabled ? 'Unmute' : 'Mute';
  $('muteBtn').classList.toggle('off', !!a && !a.enabled);
  $('muteBtn').disabled = !a;
  $('camBtn').textContent = v && !v.enabled ? 'Camera on' : 'Camera off';
  $('camBtn').classList.toggle('off', !!v && !v.enabled);
  $('camBtn').disabled = !v;
}

$('muteBtn').addEventListener('click', () => {
  const a = state.localStream && state.localStream.getAudioTracks()[0];
  if (a) a.enabled = !a.enabled;
  updateButtons();
});

$('camBtn').addEventListener('click', () => {
  const v = state.localStream && state.localStream.getVideoTracks()[0];
  if (v) v.enabled = !v.enabled;
  updateButtons();
});

$('hangupBtn').addEventListener('click', () => endCall(true));

async function endCall(notify) {
  if (!state.room) return;
  state.polling = false;
  clearTimeout(state.pollTimer);
  if (notify) await api('POST', '/leave', { room: state.room });
  if (state.pc) { state.pc.close(); state.pc = null; }
  if (state.localStream) { state.localStream.getTracks().forEach((t) => t.stop()); state.localStream = null; }
  $('remoteVideo').srcObject = null;
  $('localVideo').srcObject = null;
  state.room = '';
  setPeer(null);
  history.replaceState(null, '', location.pathname);
  enterLobby();
}

$('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('chatInput').value.trim();
  if (!text) return;
  // URI-encode so the BSL server only sees ASCII (its JSON parser breaks emoji).
  const data = encodeURIComponent(text);
  if (data.length > 2000) {
    sysChat('Message too long (emoji count extra). Please shorten it.');
    return;
  }
  $('chatInput').value = '';
  const r = await api('POST', '/send', { room: state.room, kind: 'chat', data });
  if (r.ok) addChat(state.me.name, text, true, false);
  else sysChat('Message not sent: ' + r.error);
});

window.addEventListener('pagehide', () => {
  if (state.room && state.token) {
    // Best effort; the server also drops peers that stop polling for 15 s.
    const n = nonce();
    fetch('/leave', {
      method: 'POST', keepalive: true,
      headers: { Authorization: 'Bearer ' + state.token, 'Content-Type': 'application/json', 'X-Nonce': n },
      body: asciiJSON({ room: state.room, nonce: n }),
    });
  }
});

boot();
