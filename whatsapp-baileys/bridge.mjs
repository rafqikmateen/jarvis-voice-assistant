// WhatsApp bridge for Jarvis built on Baileys (talks to WhatsApp directly; no browser). Same interface as ../whatsapp/bridge.js:
// incoming 1:1 text is POSTed to Jarvis /wa/incoming, and POST /send (loopback + shared token) sends text.
// First run: open http://127.0.0.1:<port>/qr and scan it with WhatsApp > Linked devices > Link a device.
import fs from 'node:fs';
import http from 'node:http';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';

const TOKEN = process.env.JARVIS_WA_TOKEN;
const PORT = parseInt(process.env.JARVIS_WA_PORT || '3101', 10);
const JARVIS = process.env.JARVIS_URL || 'http://127.0.0.1:8340';
if (!TOKEN) { console.error('JARVIS_WA_TOKEN missing; refusing to start.'); process.exit(1); }

// Console plus bridge.log (message text is never logged).
function log(line) {
    const s = `${new Date().toISOString()} [baileys] ${line}`;
    console.log(s);
    try { fs.appendFileSync('bridge.log', s + '\n'); } catch (e) {}
}

let sock = null, ready = false, qrText = null;
const jidByChat = {};    // "<digits>@c.us" (what Jarvis uses) -> the real jid a message came from (may be @lid)
const inviteIds = {};    // invite code -> group jid, resolved once

async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_state');
    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({ version, auth: state, logger: pino({ level: 'silent' }), browser: ['Jarvis', 'Chrome', '1.0'],
        markOnlineOnConnect: false, syncFullHistory: false });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) { qrText = qr; log(`scan the QR at http://127.0.0.1:${PORT}/qr`); }
        if (connection === 'open') { ready = true; qrText = null; log(`ready as ${sock.user && sock.user.id}`); }
        if (connection === 'close') {
            ready = false;
            const code = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode;
            if (code === DisconnectReason.loggedOut) log('logged out from the phone; delete the auth_state folder and restart to pair again');
            else { log(`connection closed (code ${code}); reconnecting`); setTimeout(connect, 3000); }
        }
    });
    // Delivery receipts: status 2 = reached WhatsApp's server, 3 = delivered to a device, 4 = read.
    sock.ev.on('messages.update', updates => { for (const u of updates) if (u.update && u.update.status !== undefined) log(`status: msgId=${u.key.id} to=${u.key.remoteJid} status=${u.update.status}`); });
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const m of messages) {
            const jid = m.key.remoteJid || '';
            if (m.key.fromMe || !m.message || jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) continue;   // 1:1 text only
            const body = m.message.conversation || (m.message.extendedTextMessage && m.message.extendedTextMessage.text);
            if (!body) continue;
            const phoneJid = (jid.endsWith('@lid') && m.key.remoteJidAlt) ? m.key.remoteJidAlt : jid;
            const chatId = jidNormalizedUser(phoneJid).replace(/@s\.whatsapp\.net$/, '@c.us');
            jidByChat[chatId] = jid;
            try {
                await fetch(JARVIS + '/wa/incoming', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', 'x-jarvis-token': TOKEN },
                    body: JSON.stringify({ chatId, from: m.pushName || chatId.replace(/@c\.us$/, ''), body }),
                });
            } catch (e) { log('could not reach Jarvis: ' + e.message); }
        }
    });
}

http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/qr') {   // pairing page; only a QR while unlinked
        let html;
        if (ready) html = '<h2>WhatsApp is linked.</h2>';
        else if (qrText) html = `<meta http-equiv="refresh" content="4"><h2>Scan with WhatsApp &gt; Linked devices</h2><img width="320" src="${await QRCode.toDataURL(qrText, { margin: 2 })}">`;
        else html = '<meta http-equiv="refresh" content="3"><h2>Starting...</h2>';
        res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><body style="font-family:sans-serif;text-align:center">${html}</body>`);
    }
    if (req.method !== 'POST' || req.url !== '/send' || req.headers['x-jarvis-token'] !== TOKEN || !ready) {
        res.writeHead(req.headers['x-jarvis-token'] === TOKEN ? 503 : 403); return res.end();
    }
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 8192) req.destroy(); });
    req.on('end', async () => {
        try {
            const { chatId, invite, text } = JSON.parse(raw);
            if (!text) throw new Error('bad request');
            let jid;
            if (invite) {   // group by invite link or code
                const code = String(invite).replace(/^.*chat\.whatsapp\.com\//, '').replace(/[?#].*$/, '').replace(/[^A-Za-z0-9]/g, '');
                if (code.length < 10) throw new Error('bad invite');
                if (!inviteIds[code]) { const info = await sock.groupGetInviteInfo(code); inviteIds[code] = info && info.id; }
                jid = inviteIds[code];
                if (!jid) { res.writeHead(404); return res.end('invite not found'); }
            } else if (/@c\.us$/.test(chatId || '')) {
                if (jidByChat[chatId]) jid = jidByChat[chatId];
                else {
                    const found = await sock.onWhatsApp(chatId.replace(/@c\.us$/, ''));
                    if (!found || !found[0] || !found[0].exists) { log('send: number is not on WhatsApp'); res.writeHead(404); return res.end('not on whatsapp'); }
                    jid = found[0].jid;
                }
            } else throw new Error('bad request');
            const sent = await sock.sendMessage(jid, { text: String(text).slice(0, 1000) });
            const id = sent && sent.key && sent.key.id;
            log(`send: to=${jid} msgId=${id}`);
            if (!id) { res.writeHead(502); return res.end('no message created'); }
            res.writeHead(200); res.end('ok');
        } catch (e) { log('send error: ' + (e && e.message)); res.writeHead(400); res.end(); }
    });
}).listen(PORT, '127.0.0.1');

connect().catch(e => { log('startup error: ' + e.message); process.exit(1); });
