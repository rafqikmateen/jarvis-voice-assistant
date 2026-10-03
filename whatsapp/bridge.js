// WhatsApp Web bridge for Jarvis. Started by the Python server when "whatsapp_enabled" is true in config.json.
// Incoming 1:1 messages are POSTed to the server; replies arrive on a loopback-only HTTP port and need the shared token.
const http = require('http');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const TOKEN = process.env.JARVIS_WA_TOKEN;
const PORT = parseInt(process.env.JARVIS_WA_PORT || '3101', 10);
const JARVIS = process.env.JARVIS_URL || 'http://127.0.0.1:8340';
if (!TOKEN) { console.error('JARVIS_WA_TOKEN missing; refusing to start.'); process.exit(1); }

const client = new Client({ authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }), puppeteer: { headless: true, args: ['--no-sandbox'] } });
let ready = false;

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => { ready = true; console.log('[whatsapp] ready'); });
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
    if (req.method !== 'POST' || req.url !== '/send' || req.headers['x-jarvis-token'] !== TOKEN || !ready) {
        res.writeHead(req.headers['x-jarvis-token'] === TOKEN ? 503 : 403); return res.end();
    }
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 8192) req.destroy(); });
    req.on('end', async () => {
        try {
            const { chatId, text } = JSON.parse(raw);
            if (!/@c\.us$/.test(chatId) || !text) throw new Error('bad request');
            await client.sendMessage(chatId, String(text).slice(0, 1000));
            res.writeHead(200); res.end('ok');
        } catch (e) { res.writeHead(400); res.end(); }
    });
}).listen(PORT, '127.0.0.1');

client.initialize();
