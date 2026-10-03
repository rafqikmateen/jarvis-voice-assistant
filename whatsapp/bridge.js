// WhatsApp Web bridge for Jarvis. Started by the Python server when "whatsapp_enabled" is true in config.json.
// Incoming 1:1 messages are POSTed to the server; replies arrive on a loopback-only HTTP port and need the shared token.
const fs = require('fs');
const http = require('http');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const TOKEN = process.env.JARVIS_WA_TOKEN;
const PORT = parseInt(process.env.JARVIS_WA_PORT || '3101', 10);
const JARVIS = process.env.JARVIS_URL || 'http://127.0.0.1:8340';
if (!TOKEN) { console.error('JARVIS_WA_TOKEN missing; refusing to start.'); process.exit(1); }

// puppeteer's own Chromium download is blocked by npm here, so use the installed Google Chrome.
const CHROME = process.env.JARVIS_CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
// Pinned WhatsApp Web build (fetched once at start from the wppconnect-team/wa-version archive). The library's injected code
// can lag the live site; if sending or listing groups breaks again, try another version from that repo's versions.json.
const WEB_VERSION = process.env.JARVIS_WA_WEB_VERSION || '2.3000.1046836583-alpha';
const client = new Client({ authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    webVersion: WEB_VERSION,
    webVersionCache: { type: 'remote', remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html' },
    puppeteer: { headless: true, args: ['--no-sandbox'], ...(CHROME ? { executablePath: CHROME } : {}) } });
let ready = false;
const inviteIds = {};   // invite code -> group id, resolved once
// Console plus bridge.log (message text is never logged), so a send problem can be read back later.
function log(line) {
    const s = `${new Date().toISOString()} [whatsapp] ${line}`;
    console.log(s);
    try { fs.appendFileSync('bridge.log', s + '\n'); } catch (e) {}
}

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => { ready = true; log(`ready (web version ${WEB_VERSION})`); });
client.on('disconnected', r => { ready = false; console.log('[whatsapp] disconnected:', r); });

client.on('message', async msg => {
    if (msg.fromMe || msg.isStatus || !msg.from.endsWith('@c.us') || !msg.body) return;   // 1:1 text chats only
    let name = msg.from;
    try { const c = await msg.getContact(); name = c.pushname || c.name || c.number || msg.from; } catch (e) {}
    try {
        await fetch(JARVIS + '/wa/incoming', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-jarvis-token': TOKEN },
            body: JSON.stringify({ chatId: msg.from, from: name, body: msg.body }),
        });
    } catch (e) { console.error('[whatsapp] could not reach Jarvis:', e.message); }
});

http.createServer((req, res) => {
    const isSend = req.method === 'POST' && req.url === '/send';
    if (!isSend || req.headers['x-jarvis-token'] !== TOKEN || !ready) {
        res.writeHead(req.headers['x-jarvis-token'] === TOKEN ? 503 : 403); return res.end();
    }
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 8192) req.destroy(); });
    req.on('end', async () => {
        try {
            const { chatId, invite, text } = JSON.parse(raw);
            if (invite) {   // group addressed by its invite link or code; no chat listing is used
                if (!text) throw new Error('bad request');
                const code = String(invite).replace(/^.*chat\.whatsapp\.com\//, '').replace(/[?#].*$/, '').replace(/[^A-Za-z0-9]/g, '');
                if (code.length < 10) throw new Error('bad invite');
                if (!inviteIds[code]) {
                    const info = await client.getInviteInfo(code);
                    const gid = info && info.id && (info.id._serialized || (info.id.user && info.id.user + '@g.us'));
                    log(`invite: resolved=${gid} infoKeys=${info ? Object.keys(info).slice(0, 8).join(',') : ''}`);
                    if (!gid) { res.writeHead(404); return res.end('invite not found'); }
                    inviteIds[code] = gid;
                }
                const gsent = await client.sendMessage(inviteIds[code], String(text).slice(0, 1000));
                log(`send: group=${inviteIds[code]} sentType=${typeof gsent} msgId=${gsent && gsent.id && gsent.id._serialized} ack=${gsent && gsent.ack}`);
                if (!gsent || !gsent.id) { res.writeHead(502); return res.end('no message created'); }
                res.writeHead(200); return res.end('ok-group');
            }
            if (!/@c\.us$/.test(chatId) || !text) throw new Error('bad request');
            // Resolve the number to its real WhatsApp id first; a raw number@c.us can be accepted and then go nowhere.
            const number = chatId.replace(/@c\.us$/, '');
            const wid = await client.getNumberId(number);
            if (!wid) { log(`send: ${number} is not registered on WhatsApp`); res.writeHead(404); return res.end('not on whatsapp'); }
            const me = client.info && client.info.wid;
            const self = !!me && (me.user === number || me.user === wid.user);   // own number: arrives in "Message yourself", silently
            const target = self ? me._serialized : wid._serialized;   // the @lid form of your own number returns no message; use @c.us
            const sent = await client.sendMessage(target, String(text).slice(0, 1000));
            log(`send: number=${number} resolved=${wid._serialized} target=${target} me=${me && me._serialized} self=${self} sentType=${typeof sent} keys=${sent ? Object.keys(sent).slice(0, 8).join(',') : ''} msgId=${sent && sent.id && sent.id._serialized} ack=${sent && sent.ack}`);
            if (!sent || !sent.id) { res.writeHead(502); return res.end('no message created'); }   // the library can return nothing without throwing
            res.writeHead(200); res.end(self ? 'ok-self' : 'ok');
        } catch (e) { log('send error: ' + (e && e.message)); res.writeHead(400); res.end(); }
    });
}).listen(PORT, '127.0.0.1');

client.initialize();
