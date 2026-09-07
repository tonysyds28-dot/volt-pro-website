const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);
const CONTENT = path.join(ROOT, 'content.json');
const UPLOADS = path.join(ROOT, 'image', 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
function send(res, status, body, type='application/json; charset=utf-8') { res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store'}); res.end(body); }
function readContent() { try { return JSON.parse(fs.readFileSync(CONTENT, 'utf8')); } catch { return { siteName:'Pop Pro', tagline:'الخبرة الكهربائية تلتقي بالذكاء التقني', phone:'966573423623', gallery:[] }; } }
function safeName(name) { return name.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase(); }

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/api/content') return send(res, 200, JSON.stringify(readContent()));
  if (req.method === 'POST' && url.pathname === '/api/content') {
    let raw = ''; req.on('data', c => { raw += c; if (raw.length > 2e6) req.destroy(); });
    req.on('end', () => { try { const data = JSON.parse(raw); fs.writeFileSync(CONTENT, JSON.stringify(data, null, 2) + '\n'); send(res, 200, JSON.stringify({ok:true, data})); } catch { send(res, 400, JSON.stringify({ok:false, error:'بيانات غير صالحة'})); } });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/upload') {
    let raw = ''; req.on('data', c => { raw += c; if (raw.length > 14e6) req.destroy(); });
    req.on('end', () => { try {
      const { name, type, data } = JSON.parse(raw); const ext = (type || 'image/jpeg').split('/')[1] || 'jpg';
      const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName(name || 'image')}.${ext}`;
      const clean = String(data).replace(/^data:[^;]+;base64,/, ''); fs.writeFileSync(path.join(UPLOADS, filename), Buffer.from(clean, 'base64'));
      const item = { name: name || filename, url: `/image/uploads/${filename}` }; const content = readContent(); content.gallery = [...(content.gallery || []), item]; fs.writeFileSync(CONTENT, JSON.stringify(content, null, 2) + '\n');
      send(res, 200, JSON.stringify({ok:true, item}));
    } catch { send(res, 400, JSON.stringify({ok:false, error:'تعذر حفظ الصورة'})); } }); return;
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/gallery/')) {
    const index = Number(url.pathname.split('/').pop()); const content = readContent(); const item = (content.gallery || [])[index];
    if (item) { try { fs.unlinkSync(path.join(ROOT, item.url.replace(/^\//, ''))); } catch {} content.gallery.splice(index, 1); fs.writeFileSync(CONTENT, JSON.stringify(content, null, 2) + '\n'); }
    return send(res, 200, JSON.stringify({ok:true}));
  }
  let file = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const full = path.normalize(path.join(ROOT, file));
  if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  send(res, 200, fs.readFileSync(full), mime[path.extname(full).toLowerCase()] || 'application/octet-stream');
});
server.listen(PORT, () => console.log(`Pop Pro local server: http://localhost:${PORT} | Admin: http://localhost:${PORT}/admin.html`));
