// RKMAerial V2 — Frontend

// The report panel hides itself after this many seconds.
const PANEL_AUTO_HIDE_SECONDS = 120;
// Speech recognition language. Try 'en-GB', 'en-AU' or 'en-IN' if your accent is misheard.
const RECOGNITION_LANG = 'en-US';
// Sent automatically on connect. Must equal CANONICAL_ACTIVATION (first ACTIVATION_PHRASES entry) in server.py.
const ACTIVATION_MESSAGE = 'RKM Ariel activate';
// Same-browser channel so an older page pauses itself when a newer one opens.
const PAGE_CHANNEL_NAME = 'rkmaerial-active-page';
const PAGE_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);
const PAUSED_MESSAGE = 'This assistant is open in another tab, so this one is paused. You can close it.';
let assistantName = 'RKMAerial';   // replaced by the name the server sends in "hello"
let paused = false;                 // true = replaced by a newer page; never reconnects or listens again
let reconnectTimer = null;
let pageChannel = null;

const orb = document.getElementById('orb');
const status = document.getElementById('status');
const hudLabel = document.getElementById('hud-label');
const modelBadge = document.getElementById('model-badge');   // now the SVG text on the robot's belt pill
const robot = document.getElementById('robot');
const robotPower = document.getElementById('robot-power');
const robotSub = document.getElementById('robot-sub');
const robotPlain = document.getElementById('robot-plain');
const beltPill = document.getElementById('belt-pill');
const bubble = document.getElementById('bubble');
const bubbleLabel = document.getElementById('bubble-label');
const bubbleText = document.getElementById('bubble-text');
const tasksTitle = document.getElementById('tasks-title');
const tasksList = document.getElementById('tasks-list');
const micToggle = document.getElementById('mic-toggle');
const micLabel = document.getElementById('mic-label');
const textForm = document.getElementById('control-bar');
const textInput = document.getElementById('text-input');
const cdpToggle = document.getElementById('cdp-toggle');
const layoutToggle = document.getElementById('layout-toggle');
const leftCol = document.getElementById('left-col');
const clockTime = document.getElementById('clock-time');
const clockDate = document.getElementById('clock-date');
const bell = document.getElementById('bell');
const bellBadge = document.getElementById('bell-badge');
const ear = document.getElementById('ear');
let activationReplyId = null;   // the automatic activation reply must not ring the bell
let unseenAlerts = 0;
const reportPanel = document.getElementById('report-panel');
const reportBody = document.getElementById('report-body');
const reportClose = document.getElementById('report-close');
let reportTimer = null;
let micOn = true;   // false = recognition fully stopped; nothing may restart it

// Report panel. The server sends already-cleaned HTML; it is still shown only inside an iframe with an empty
// sandbox attribute (no scripts, no same-origin) and a CSP that allows inline styles and nothing else.
// Report content is never put into this page's DOM with innerHTML.
const REPORT_CSP = "default-src 'none'; style-src 'unsafe-inline'";
const REPORT_BASE_CSS = 'html,body{margin:0;background:#0a0f16;color:#cfe3f5;font:13px/1.45 Segoe UI,Arial,sans-serif}'
    + 'body{padding:10px}table{border-collapse:collapse;width:100%}'
    + 'th,td{border:1px solid #1a3a5c;padding:4px 8px;text-align:left}th{background:#0d1b2a;color:#4a9eff}'
    + 'h1,h2,h3,h4{color:#4a9eff;margin:12px 0 6px}hr{border:0;border-top:1px solid #1a3a5c}'
    + 'pre{white-space:pre-wrap;word-break:break-word;margin:0;font:12px/1.45 Consolas,monospace}';

function hideMarketReport() {
    clearTimeout(reportTimer);
    reportTimer = null;
    reportBody.replaceChildren();
    reportPanel.hidden = true;
}

function showMarketReport(reportHtml, runId) {
    hideMarketReport();                          // replaces any earlier report
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', '');
    frame.title = 'Report';
    frame.addEventListener('load', () => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'market_rendered', id: runId }));
    }, { once: true });
    frame.srcdoc = '<!DOCTYPE html><html><head>'
        + '<meta http-equiv="Content-Security-Policy" content="' + REPORT_CSP + '">'
        + '<meta charset="utf-8"><style>' + REPORT_BASE_CSS + '</style></head><body>'
        + String(reportHtml) + '</body></html>';
    reportBody.appendChild(frame);
    reportPanel.hidden = false;
    reportTimer = setTimeout(hideMarketReport, PANEL_AUTO_HIDE_SECONDS * 1000);
}

reportClose.addEventListener('click', hideMarketReport);

let ws;
let connected = false;      // WebSocket state, drives the OFFLINE label
let orbState = 'idle';      // idle | listening | thinking | speaking
// Silence (ms) with no new speech before your text is sent to the assistant. Tune here.
const SILENCE_DELAY_MS = 2000;
// Speech recognition stays off this long (ms) after a stop.
const STOP_COOLDOWN_MS = 1000;
let replyCounter = 0;
let activeReplyId = null;   // only audio/text for this id is accepted
let listenBlockedUntil = 0;
let pendingFinal = '';
let pendingInterim = '';
let silenceTimer = null;
let audioQueue = [];
let isPlaying = false;
let currentAudio = null;
let currentUrl = null;
let audioUnlocked = false;

// Unlock audio on ANY user interaction
function unlockAudio() {
    if (!audioUnlocked) {
        const silent = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNIGPkAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNIGPkAAAAAAAAAAAAAAAAAAAA');
        silent.play().then(() => {
            audioUnlocked = true;
            console.log('[rkmaerial] Audio unlocked');
        }).catch(() => {});
    }
}
document.addEventListener('click', unlockAudio, { once: false });
document.addEventListener('touchstart', unlockAudio, { once: false });
document.addEventListener('keydown', unlockAudio, { once: false });

function badgeText(d) {
    return [d.model, d.effort, d.auto ? 'auto' : ''].filter(Boolean).join(' · ');
}

// Model badge: a pill on the robot's belt.
function setBadge(text) {
    modelBadge.textContent = text;
    beltPill.style.display = text ? '' : 'none';
    if (!text) return;
}

// WhatsApp reply mode: after a message card appears, the next typed or dictated line goes back through WhatsApp.
const waCard = document.getElementById('wa-card');
const waFrom = document.getElementById('wa-from');
const waText = document.getElementById('wa-text');
const waHint = document.getElementById('wa-hint');
const WA_REPLY_WINDOW_MS = 5 * 60 * 1000;   // the reply slot closes by itself so later speech is never sent by accident
let waReply = null;                          // { chatId, timer }

function waClose() {
    if (waReply) clearTimeout(waReply.timer);
    waReply = null;
    waCard.hidden = true;
}

function waOpen(data) {
    if (waReply) clearTimeout(waReply.timer);
    waFrom.textContent = `WhatsApp · ${data.from}`;
    waText.textContent = data.text;           // text only: message content is never treated as HTML
    waHint.textContent = 'Type in the box or speak your reply. It is sent to WhatsApp as-is.';
    waCard.hidden = false;
    waReply = { chatId: data.chatId, timer: setTimeout(waClose, WA_REPLY_WINDOW_MS) };
    ringBell();
}

document.getElementById('wa-dismiss').addEventListener('click', waClose);

function sendUserText(text) {
    if (paused) return;
    if (waReply && text !== ACTIVATION_MESSAGE) {
        ws.send(JSON.stringify({ type: 'wa_reply', chatId: waReply.chatId, text }));
        waHint.textContent = 'Sending…';
        return;
    }
    activeReplyId = ++replyCounter;
    ws.send(JSON.stringify({ text, id: activeReplyId }));
}

function connect() {
    if (paused) return;
    ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onopen = () => {
        console.log('[rkmaerial] WebSocket connected');
        connected = true;
        updateHud();
        if (!micOn) { status.textContent = 'Mic off. Press M to resume.'; return; }
        status.textContent = `Click anywhere once so ${assistantName} can speak.`;
        setOrbState('thinking');
        sendUserText(ACTIVATION_MESSAGE);
        activationReplyId = activeReplyId;
    };
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'replaced') { pausePage(); return; }
        if (data.type === 'done') {
            if (data.id === activeReplyId) activeReplyId = null;
            if (data.id !== activationReplyId) ringBell();
            return;
        }
        if (data.type === 'response') {
            if (data.id !== activeReplyId) return;   // cancelled or superseded reply
            if (data.model) setBadge(badgeText(data));   // model, effort and "auto" marker of this reply
            bubbleStart(data.text, !!(data.audio && data.audio.length > 0));
            if (data.audio && data.audio.length > 0) {
                queueAudio(data.audio);
            } else {
                setOrbState('idle');
                setTimeout(startListening, 500);
            }
        } else if (data.type === 'audio') {
            // later chunks of a reply whose first chunk already started playing
            if (data.id === activeReplyId && data.audio) queueAudio(data.audio);
        } else if (data.type === 'status') {
            status.textContent = data.text;
        } else if (data.type === 'hello') {
            setBadge(badgeText(data));   // badge text comes from the server
            if (data.name) {
                assistantName = data.name;
                document.title = assistantName;
                const coreName = document.getElementById('core-name');
                if (coreName) coreName.textContent = assistantName.toUpperCase();
            }
        } else if (data.type === 'sources') {
        } else if (data.type === 'tasks') {
            renderTasks(data.tasks);
        } else if (data.type === 'wa_message') {
            waOpen(data);
        } else if (data.type === 'wa_sent') {
            setOrbState('idle');
            if (data.ok) {
                waText.textContent = `You: ${data.text}`;
                waHint.textContent = 'Sent ✓';
                if (waReply) clearTimeout(waReply.timer);
                waReply = null;
                setTimeout(() => { if (!waReply) waCard.hidden = true; }, 4000);
            } else {
                waHint.textContent = 'Could not send. Try again, or dismiss the card.';
            }
            status.textContent = 'Click the robot to speak';
            setTimeout(startListening, 500);
        } else if (data.type === 'market_report') {
            showMarketReport(data.html, data.id);
            ringBell();
        }
    };
    ws.onclose = (event) => {
        if (event.code === 4000) { pausePage(); return; }   // replaced by a newer page
        if (paused) return;
        connected = false;
        updateHud();
        status.textContent = 'Connection lost...';
        reconnectTimer = setTimeout(connect, 3000);
    };
}

// Another page took over: stop everything, release the microphone, and never come back.
function pausePage() {
    if (paused) return;
    paused = true;
    micOn = false;
    hideMarketReport();
    clearTimeout(reconnectTimer);
    clearPendingSpeech();
    audioQueue = [];
    if (currentAudio) {
        currentAudio.onended = null;
        currentAudio.onerror = null;
        currentAudio.pause();
        currentAudio = null;
    }
    if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
    }
    isPlaying = false;
    activeReplyId = null;
    if (recognition) {
        recognition.onresult = null;
        recognition.onend = null;
        recognition.onerror = null;
        try { recognition.abort(); } catch (e) {}   // abort releases the microphone
    }
    isListening = false;
    if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        try { ws.close(); } catch (e) {}
    }
    connected = false;
    setOrbState('idle');
    status.textContent = '';
    try { if (pageChannel) pageChannel.close(); } catch (e) {}
    const overlay = document.createElement('div');
    overlay.id = 'paused-overlay';
    overlay.textContent = PAUSED_MESSAGE;
    document.body.appendChild(overlay);
    try { window.close(); } catch (e) {}   // best effort; the message stays if the browser blocks it
}

function queueAudio(base64Audio) {
    audioQueue.push(base64Audio);
    if (!isPlaying) playNext();
}

function playNext() {
    if (audioQueue.length === 0) {
        isPlaying = false;
        setOrbState('listening');
        status.textContent = '';
        setTimeout(startListening, 500);
        return;
    }
    isPlaying = true;
    setOrbState('speaking');
    status.textContent = '';
    clearPendingSpeech();
    if (isListening) {
        recognition.stop();
        isListening = false;
    }

    const b64 = audioQueue.shift();
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    currentUrl = url;
    audio.onended = () => { URL.revokeObjectURL(url); playNext(); };
    audio.onerror = () => { URL.revokeObjectURL(url); playNext(); };
    audio.play().catch(err => {
        console.warn('[rkmaerial] Autoplay blocked, waiting for click...');
        status.textContent = `Click anywhere so ${assistantName} can speak.`;
        setOrbState('idle');
        // Wait for click then retry
        document.addEventListener('click', function retry() {
            document.removeEventListener('click', retry);
            if (audio !== currentAudio) return;
            audio.play().then(() => {
                setOrbState('speaking');
                status.textContent = '';
            }).catch(() => playNext());
        });
    });
}

// Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isListening = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = RECOGNITION_LANG;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        if (!micOn || isPlaying || Date.now() < listenBlockedUntil) return;
        pendingInterim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const r = event.results[i];
            if (r.isFinal) pendingFinal += ' ' + r[0].transcript;
            else pendingInterim += r[0].transcript;
        }
        armSilenceTimer();   // any new speech restarts the countdown
    };

    recognition.onend = () => {
        if (pendingInterim) { pendingFinal += ' ' + pendingInterim; pendingInterim = ''; }
        isListening = false;
        if (!isPlaying) setTimeout(startListening, 300);
    };

    recognition.onerror = (event) => {
        isListening = false;
        if (event.error === 'no-speech' || event.error === 'aborted') {
            if (!isPlaying) setTimeout(startListening, 300);
        } else {
            setTimeout(startListening, 1000);
        }
    };
}

function armSilenceTimer() {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(flushPendingSpeech, SILENCE_DELAY_MS);
}

function flushPendingSpeech() {
    silenceTimer = null;
    if (pendingInterim) { armSilenceTimer(); return; }
    const text = pendingFinal.trim();
    pendingFinal = '';
    if (!text) return;
    setOrbState('thinking');
    status.textContent = `${assistantName} is thinking...`;
    sendUserText(text);
}

function clearPendingSpeech() {
    clearTimeout(silenceTimer);
    silenceTimer = null;
    pendingFinal = '';
    pendingInterim = '';
}

function startListening() {
    if (paused || !micOn || isPlaying) return;
    const wait = listenBlockedUntil - Date.now();
    if (wait > 0) { setTimeout(startListening, wait); return; }
    try {
        recognition.start();
        isListening = true;
        setOrbState('listening');
        status.textContent = '';
    } catch(e) {}
}

// Cancel the current reply: tell the server, drop queued audio, stop playback, discard speech.
function cancelReply() {
    if (activeReplyId !== null && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'cancel', id: activeReplyId }));
    }
    activeReplyId = null;
    clearPendingSpeech();
    audioQueue = [];
    if (currentAudio) {
        currentAudio.onended = null;
        currentAudio.onerror = null;
        currentAudio.pause();
        currentAudio = null;
    }
    if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
    }
    isPlaying = false;
}

// Stop speech immediately, drop queued audio, and go back to listening.
// Deliberately independent of speech recognition (his own voice can trigger it).
function interruptSpeech() {
    if (!isPlaying && activeReplyId === null) return;
    cancelReply();
    if (isListening) { recognition.abort(); isListening = false; }
    listenBlockedUntil = Date.now() + STOP_COOLDOWN_MS;
    setOrbState('idle');
    status.textContent = '';
    setTimeout(startListening, STOP_COOLDOWN_MS);
}

function setMic(on) {
    if (paused) return;
    micOn = on;
    micLabel.textContent = on ? 'Mic on' : 'Mic off';
    micToggle.classList.toggle('off', !on);
    micToggle.setAttribute('aria-pressed', String(!on));
    if (on) {
        status.textContent = '';
        startListening();
        return;
    }
    cancelReply();
    try { recognition.abort(); } catch (e) {}   // abort releases the microphone
    isListening = false;
    setOrbState('idle');
    status.textContent = 'Mic off. Press M or click the button to resume.';
}

micToggle.addEventListener('click', () => setMic(!micOn));

// Control bar. Typed text goes through the same path as recognised speech.
textForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = textInput.value.trim();
    if (!text || paused || !ws || ws.readyState !== WebSocket.OPEN) return;
    textInput.value = '';
    cancelReply();
    setOrbState('thinking');
    status.textContent = `${assistantName} is thinking...`;
    sendUserText(text);
});

// Satellite: is the Chrome remote-debugging port open?
cdpToggle.addEventListener('click', async () => {
    cdpToggle.className = 'ctl checking';
    try {
        const d = await (await fetch('/cdp/status')).json();
        cdpToggle.className = 'ctl ' + (d.open ? 'ok' : 'bad');
        cdpToggle.title = `Chrome port ${d.port}: ${d.open ? 'open' : 'closed'}`;
        status.textContent = cdpToggle.title;
    } catch (err) {
        cdpToggle.className = 'ctl bad';
        cdpToggle.title = 'Could not reach the server';
    }
});

// Monitor: show or hide the left column (Tasks and Transcript). The clock stays.
layoutToggle.addEventListener('click', () => {
    leftCol.hidden = !leftCol.hidden;
    layoutToggle.setAttribute('aria-pressed', String(leftCol.hidden));
});

// Clock: browser time only, no network. 24-hour "21:36:30" and a dimmed date line like "02-OCT-26".
function tickClock() {
    const d = new Date();
    const z = n => String(n).padStart(2, '0');
    const time = `${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
    const mon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()];
    const date = `${z(d.getDate())}-${mon}-${z(d.getFullYear() % 100)}`;
    if (clockTime.textContent !== time) clockTime.textContent = time;
    if (clockDate.textContent !== date) clockDate.textContent = date;
}
tickClock();
setInterval(tickClock, 1000);

// Bell: flashes and counts whenever a reply or report finishes; clicking clears it.
function ringBell() {
    unseenAlerts += 1;
    bellBadge.textContent = String(unseenAlerts);
    bellBadge.hidden = false;
    bell.classList.remove('flash');
    void bell.offsetWidth;          // restart the animation
    bell.classList.add('flash');
}
bell.addEventListener('click', () => {
    unseenAlerts = 0;
    bellBadge.hidden = true;
    bell.classList.remove('flash');
});

// Ear: green while recognition is actually running with the mic on.
setInterval(() => { ear.classList.toggle('on', !paused && micOn && isListening); updateRobot(); }, 250);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') interruptSpeech();
    if (e.target && e.target.tagName === 'INPUT') return;   // typing, not the mic shortcut
    if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.repeat) {
        setMic(!micOn);
    }
});

function orbClick() {
    if (paused) return;
    if (isPlaying || activeReplyId !== null) { interruptSpeech(); return; }
    if (isListening) {
        recognition.stop();
        isListening = false;
        setOrbState('idle');
        status.textContent = 'Paused. Click to resume.';
    } else {
        startListening();
    }
}
orb.addEventListener('click', orbClick);
robot.addEventListener('click', orbClick);   // the robot stops speech exactly like the old orb

const HUD_LABELS = { idle: 'ONLINE', listening: 'LISTENING', thinking: 'THINKING', speaking: 'SPEAKING', offline: 'OFFLINE' };

// Orb class (disc color) and the status label follow the state; a closed WebSocket always wins.
function updateHud() {
    const state = connected ? orbState : 'offline';
    orb.className = state;
    hudLabel.className = state;
    hudLabel.textContent = HUD_LABELS[state];
    updateRobot();
}

// Robot: power follows the WebSocket; state follows orbState, but a muted mic beats every other state.
const SUB_LABELS = { listening: 'LISTENING', thinking: 'THINKING', speaking: 'SPEAKING', 'mic-off': 'MIC OFF' };
function updateRobot() {
    const power = connected ? 'online' : 'offline';
    const rstate = !micOn ? 'mic-off' : orbState;
    const sub = SUB_LABELS[rstate] || '';
    const plain = [power.toUpperCase(), sub].filter(Boolean).join(' · ');
    if (robot.dataset.power !== power) { robot.dataset.power = power; robotPlain.dataset.power = power; }
    if (robot.dataset.state !== rstate) robot.dataset.state = rstate;
    if (robotPower.textContent !== power.toUpperCase()) robotPower.textContent = power.toUpperCase();
    if (robotSub.textContent !== sub) robotSub.textContent = sub;
    if (robotPlain.textContent !== plain) robotPlain.textContent = plain;
}

function setOrbState(state) { orbState = state; updateHud(); }

// Display-only task panel; text is set via textContent, never as HTML.
function renderTasks(tasks) {
    tasksTitle.textContent = `Tasks (${tasks.length})`;
    tasksList.replaceChildren(...tasks.map(t => {
        const li = document.createElement('li');
        li.textContent = t;
        return li;
    }));
}

// Announce this page; any older page in the same browser pauses itself.
try {
    pageChannel = new BroadcastChannel(PAGE_CHANNEL_NAME);
    pageChannel.onmessage = (e) => {
        if (e.data && e.data.type === 'new-page' && e.data.id !== PAGE_ID) pausePage();
    };
    pageChannel.postMessage({ type: 'new-page', id: PAGE_ID });
} catch (e) {}

updateHud();
connect();

// --- Speech bubble: the latest reply, beside the robot's head ---
const BUBBLE_HOLD_MS = 8000;          // stays this long after speech ends, then fades
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let bubbleReply = null;               // { words, hasAudio, startedAt, played, playedAt, endedAt, p }
let prevOrbState = 'idle';

function bubbleStart(text, hasAudio) {
    const now = Date.now();
    bubbleReply = { words: String(text).split(/\s+/).filter(Boolean), hasAudio, startedAt: now,
                    played: false, playedAt: 0, endedAt: hasAudio ? null : now, p: 0 };   // a new reply replaces the old one
    bubbleTick();
}

function bubbleTick() {
    const now = Date.now();
    if (orbState === 'thinking' && prevOrbState !== 'thinking') bubbleReply = null;   // new turn: dots replace the old reply
    prevOrbState = orbState;
    const r = bubbleReply;
    let text = '', live = false;
    if (r) {
        if (r.hasAudio && !r.played && isPlaying) { r.played = true; r.playedAt = now; }
        if (r.hasAudio && r.endedAt === null &&
            ((r.played && !isPlaying && audioQueue.length === 0) || (!r.played && now - r.startedAt > 15000))) r.endedAt = now;
        live = r.endedAt === null || now - r.endedAt < BUBBLE_HOLD_MS;
        let p = 1;                                         // reduced motion, no audio, or finished: full text at once
        if (r.hasAudio && r.endedAt === null && !reduceMotionQuery.matches) {
            const a = currentAudio;
            if (r.played && a && isFinite(a.duration) && a.duration > 0) p = Math.min(1, a.currentTime / a.duration);
            else if (r.played) p = now - r.playedAt > 1000 ? 1 : 0;   // duration unknown: wait a second, then show it all
            else p = now - r.startedAt > 1500 ? 1 : 0;                // speech has not started (blocked?): show it all
        }
        r.p = Math.max(r.p, p);                            // words never un-type
        text = r.words.slice(0, Math.ceil(r.p * r.words.length)).join(' ');
    }
    const dots = (orbState === 'thinking' && !r) || (!!r && live && !text);
    const show = connected && (dots || (!!r && live));
    const set = (k, v) => { if (bubble.dataset[k] !== v) bubble.dataset[k] = v; };
    set('show', show ? '1' : '0'); set('dots', dots ? '1' : '0'); set('speaking', orbState === 'speaking' ? '1' : '0');
    if (bubbleText.textContent !== text) bubbleText.textContent = text;
    const name = assistantName.toUpperCase();
    if (bubbleLabel.textContent !== name) bubbleLabel.textContent = name;
}
setInterval(bubbleTick, 100);

// Placement from the robot's real box in the DOM: the bubble's right edge stops 16 px short of the robot's left edge,
// so it never covers the face or shoulders. It keeps clear of the Tasks column and shrinks (min 160 px) when space is tight.
// --bubble-left tells the report panel where the bubble starts.
function layoutBubble() {
    const r = robot.getBoundingClientRect();
    if (!r.width) { document.documentElement.style.removeProperty('--bubble-left'); return; }   // robot hidden (< 700 px)
    const minLeft = 272;   // just right of the left column (260 px)
    const w = Math.max(160, Math.min(340, window.innerWidth * 0.3, r.left - 16 - minLeft));
    const left = Math.max(8, r.left - 16 - w);
    bubble.style.width = w + 'px';
    bubble.style.left = left + 'px';
    bubble.style.top = (r.top + r.height * 0.03) + 'px';
    document.documentElement.style.setProperty('--bubble-left', left + 'px');
}
window.addEventListener('resize', layoutBubble);
if (window.ResizeObserver) new ResizeObserver(layoutBubble).observe(robot);
layoutBubble();
