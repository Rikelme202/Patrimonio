'use strict';
// Controle de Patrimônio — servidor sem dependências externas (Node 22+).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
fs.mkdirSync(DATA, { recursive: true });
const PHOTOS = path.join(DATA, 'photos');
fs.mkdirSync(PHOTOS, { recursive: true });

const db = new DatabaseSync(path.join(DATA, 'patrimonio.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  pass TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barcode TEXT NOT NULL UNIQUE,
  number TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  responsible TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ativo',
  entry_mode TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  detail TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_mov_asset ON movements(asset_id);
`);

// Migração: colunas adicionais de patrimônio + tabelas de inventário
{
  const cols = db.prepare('PRAGMA table_info(assets)').all().map(c => c.name);
  if (!cols.includes('value')) db.exec('ALTER TABLE assets ADD COLUMN value REAL');
  if (!cols.includes('acquired_at')) db.exec("ALTER TABLE assets ADD COLUMN acquired_at TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('photo')) db.exec("ALTER TABLE assets ADD COLUMN photo TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('notes')) db.exec("ALTER TABLE assets ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
  const ucols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!ucols.includes('must_change')) db.exec('ALTER TABLE users ADD COLUMN must_change INTEGER NOT NULL DEFAULT 0');
  db.exec(`
  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS inventories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sector TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    closed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS inventory_items (
    inventory_id INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    found_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (inventory_id, asset_id)
  );`);
}

// ---------- senhas ----------
function hashPass(p) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + crypto.scryptSync(p, salt, 64).toString('hex');
}
function checkPass(p, stored) {
  const [s, h] = stored.split(':');
  const calc = crypto.scryptSync(p, Buffer.from(s, 'hex'), 64);
  const real = Buffer.from(h, 'hex');
  return calc.length === real.length && crypto.timingSafeEqual(calc, real);
}

// Primeiro uso: cria o administrador com senha aleatória (mostrada uma única vez no console).
if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) {
  const pwd = crypto.randomBytes(5).toString('hex');
  db.prepare('INSERT INTO users (username,name,role,pass,must_change) VALUES (?,?,?,?,1)')
    .run('admin', 'Administrador', 'admin', hashPass(pwd));
  console.log('\n=====================================================');
  console.log(' Primeiro acesso criado:');
  console.log('   usuário: admin');
  console.log('   senha:   ' + pwd);
  console.log(' (o sistema exigirá a troca da senha no primeiro acesso)');
  console.log('=====================================================\n');
}

// ---------- utilidades ----------
const STATUS = ['ativo', 'manutencao', 'baixado'];
const MODES = ['manual', 'leitor', 'camera'];
const COOKIE = 'sid';
const SESSION_MS = 1000 * 60 * 60 * 12;
const attempts = new Map(); // ip -> {n, until}

class HttpError extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 1e6) { reject(new HttpError(413, 'Requisição muito grande')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'JSON inválido')); }
    });
    req.on('error', reject);
  });
}
const SEC = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
const secure = req => (req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https') ? '; Secure' : '';
function readRaw(req, max = 3e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > max) { reject(new HttpError(413, 'Imagem muito grande (máx. 3 MB).')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function sniffImage(b) {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ['jpg', 'image/jpeg'];
  if (b.length > 12 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ['png', 'image/png'];
  if (b.length > 12 && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return ['webp', 'image/webp'];
  return null;
}
const PHOTO_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
function send(res, code, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC, ...headers });
  res.end(body);
}
function getCookie(req, name) {
  const m = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function currentUser(req) {
  const token = getCookie(req, COOKIE);
  if (!token) return null;
  const row = db.prepare(`SELECT u.id,u.username,u.name,u.role,u.must_change,s.expires FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?`).get(token);
  if (!row) return null;
  if (row.expires < Date.now()) { db.prepare('DELETE FROM sessions WHERE token=?').run(token); return null; }
  return row;
}
const ipOf = req => req.socket.remoteAddress || '';
function audit(user, action, detail, req) {
  db.prepare('INSERT INTO audit (user_name,action,detail,ip) VALUES (?,?,?,?)')
    .run(typeof user === 'string' ? user : user.username, action, detail || '', req ? ipOf(req) : '');
}
function policy(p) {
  p = String(p || '');
  if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) throw new HttpError(400, 'A senha deve ter ao menos 8 caracteres, com letras e números.');
}
const publicUser = u => ({ id: u.id, username: u.username, name: u.name, role: u.role, must_change: !!u.must_change });

function validateAsset(b) {
  const a = {
    barcode: str(b.barcode, 80), number: str(b.number, 40), description: str(b.description, 200),
    category: str(b.category, 80), sector: str(b.sector, 80), responsible: str(b.responsible, 80),
    status: str(b.status, 20) || 'ativo', entry_mode: str(b.entry_mode, 10) || 'manual',
    acquired_at: str(b.acquired_at, 10), notes: str(b.notes, 500),
    value: b.value === '' || b.value == null ? null : Number(String(b.value).includes(',') ? String(b.value).replace(/\./g, '').replace(',', '.') : b.value),
  };
  if (a.value !== null && (!Number.isFinite(a.value) || a.value < 0)) throw new HttpError(400, 'Valor inválido.');
  if (a.acquired_at && !/^\d{4}-\d{2}-\d{2}$/.test(a.acquired_at)) throw new HttpError(400, 'Data de aquisição inválida.');
  if (!a.barcode) throw new HttpError(400, 'Informe o número de barras.');
  if (!/^[\x20-\x7E]+$/.test(a.barcode)) throw new HttpError(400, 'O número de barras só pode ter caracteres ASCII simples.');
  if (!a.number) throw new HttpError(400, 'Informe o número do patrimônio.');
  if (!a.description) throw new HttpError(400, 'Informe a descrição.');
  if (!STATUS.includes(a.status)) throw new HttpError(400, 'Situação inválida.');
  if (!MODES.includes(a.entry_mode)) a.entry_mode = 'manual';
  return a;
}
function uniqueError(e) {
  if (/UNIQUE/i.test(String(e.message))) {
    if (/barcode/.test(e.message)) return new HttpError(409, 'Já existe um patrimônio com esse número de barras.');
    if (/number/.test(e.message)) return new HttpError(409, 'Já existe um patrimônio com esse número.');
    if (/username/.test(e.message)) return new HttpError(409, 'Esse usuário já existe.');
  }
  return e;
}
function addMovement(assetId, type, detail, note, user) {
  db.prepare('INSERT INTO movements (asset_id,type,detail,note,user_name) VALUES (?,?,?,?,?)')
    .run(assetId, type, detail, note || '', user.name);
}
const LABEL = { ativo: 'Ativo', manutencao: 'Em manutenção', baixado: 'Baixado' };

// ---------- rotas da API ----------
async function api(req, res, url) {
  const m = req.method, p = url.pathname;

  if (m === 'POST' && p === '/api/login') {
    const ip = req.socket.remoteAddress;
    const at = attempts.get(ip);
    if (at && at.until > Date.now() && at.n >= 8) throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos.');
    const b = await readBody(req);
    const u = db.prepare('SELECT * FROM users WHERE username=?').get(str(b.username, 60));
    if (!u || typeof b.password !== 'string' || !checkPass(b.password, u.pass)) {
      attempts.set(ip, { n: (at && at.until > Date.now() ? at.n : 0) + 1, until: Date.now() + 5 * 60000 });
      audit(str(b.username, 60) || '?', 'login_falha', 'Tentativa de login recusada', req);
      throw new HttpError(401, 'Usuário ou senha incorretos.');
    }
    attempts.delete(ip);
    audit(u, 'login', 'Login realizado', req);
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)').run(token, u.id, Date.now() + SESSION_MS);
    return send(res, 200, { user: publicUser(u) }, {
      'Set-Cookie': `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure(req)}`,
    });
  }
  if (m === 'POST' && p === '/api/logout') {
    const t = getCookie(req, COOKIE);
    if (t) db.prepare('DELETE FROM sessions WHERE token=?').run(t);
    return send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
  }

  const user = currentUser(req);
  if (!user) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  const isAdmin = user.role === 'admin';
  const free = ['/api/me', '/api/me/password'];
  if (user.must_change && !free.includes(p)) throw new HttpError(403, 'Troque a senha para continuar.');
  if (user.role === 'viewer' && m !== 'GET' && p !== '/api/me/password') throw new HttpError(403, 'Seu perfil é somente consulta.');

  if (m === 'GET' && p === '/api/me') return send(res, 200, { user: publicUser(user) });

  if (m === 'POST' && p === '/api/me/password') {
    const b = await readBody(req);
    const row = db.prepare('SELECT pass FROM users WHERE id=?').get(user.id);
    if (!checkPass(String(b.current || ''), row.pass)) throw new HttpError(400, 'Senha atual incorreta.');
    policy(b.password);
    if (b.password === b.current) throw new HttpError(400, 'A nova senha deve ser diferente da atual.');
    db.prepare('UPDATE users SET pass=?, must_change=0 WHERE id=?').run(hashPass(b.password), user.id);
    audit(user, 'senha_alterada', 'Senha alterada pelo próprio usuário', req);
    return send(res, 200, { ok: true });
  }

  // ----- patrimônios -----
  if (m === 'GET' && p === '/api/assets') {
    const q = str(url.searchParams.get('q'), 100);
    const where = [], args = [];
    if (q) {
      const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
      where.push(`(barcode LIKE ? ESCAPE '\\' OR number LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR responsible LIKE ? ESCAPE '\\')`);
      args.push(like, like, like, like);
    }
    for (const f of ['category', 'sector', 'status']) {
      const v = str(url.searchParams.get(f), 80);
      if (v) { where.push(`${f}=?`); args.push(v); }
    }
    const rows = db.prepare(`SELECT * FROM assets ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 5000`).all(...args);
    const opt = col => db.prepare(`SELECT DISTINCT ${col} v FROM assets WHERE ${col}<>'' ORDER BY ${col} COLLATE NOCASE`).all().map(r => r.v);
    return send(res, 200, { assets: rows, categories: opt('category'), sectors: opt('sector'), responsibles: opt('responsible') });
  }
  if (m === 'GET' && p === '/api/assets/lookup') {
    const c = str(url.searchParams.get('code'), 80);
    const a = db.prepare('SELECT * FROM assets WHERE barcode=? OR number=?').get(c, c);
    return send(res, 200, { asset: a || null });
  }
  if (m === 'POST' && p === '/api/assets') {
    const a = validateAsset(await readBody(req));
    try {
      const r = db.prepare(`INSERT INTO assets (barcode,number,description,category,sector,responsible,status,entry_mode,value,acquired_at,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(a.barcode, a.number, a.description, a.category, a.sector, a.responsible, a.status, a.entry_mode, a.value, a.acquired_at, a.notes);
      const id = Number(r.lastInsertRowid);
      addMovement(id, 'cadastro', `Cadastrado (entrada: ${a.entry_mode}). Local: ${a.sector || '—'}; responsável: ${a.responsible || '—'}.`, '', user);
      return send(res, 201, { asset: db.prepare('SELECT * FROM assets WHERE id=?').get(id) });
    } catch (e) { throw uniqueError(e); }
  }

  let mm;
  if ((mm = p.match(/^\/api\/assets\/(\d+)$/))) {
    const id = Number(mm[1]);
    const cur = db.prepare('SELECT * FROM assets WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Patrimônio não encontrado.');
    if (m === 'GET') return send(res, 200, { asset: cur });
    if (m === 'PUT') {
      const body = await readBody(req);
      const a = validateAsset(body);
      const note = str(body.note, 300);
      try {
        db.prepare(`UPDATE assets SET barcode=?,number=?,description=?,category=?,sector=?,responsible=?,status=?,value=?,acquired_at=?,notes=?,updated_at=datetime('now','localtime') WHERE id=?`)
          .run(a.barcode, a.number, a.description, a.category, a.sector, a.responsible, a.status, a.value, a.acquired_at, a.notes, id);
      } catch (e) { throw uniqueError(e); }
      const ch = [];
      if (cur.sector !== a.sector) ch.push(`Local: ${cur.sector || '—'} → ${a.sector || '—'}`);
      if (cur.responsible !== a.responsible) ch.push(`Responsável: ${cur.responsible || '—'} → ${a.responsible || '—'}`);
      if (cur.status !== a.status) ch.push(`Situação: ${LABEL[cur.status]} → ${LABEL[a.status]}`);
      const type = cur.status !== a.status && a.status === 'baixado' ? 'baixa'
        : (cur.sector !== a.sector || cur.responsible !== a.responsible || cur.status !== a.status) ? 'transferencia' : null;
      if (type) addMovement(id, type, ch.join('; '), note, user);
      const other = ['barcode', 'number', 'description', 'category'].filter(k => cur[k] !== a[k]);
      if (other.length) addMovement(id, 'edicao', 'Dados alterados: ' + other.map(k => ({ barcode: 'nº de barras', number: 'número', description: 'descrição', category: 'categoria' }[k])).join(', '), type ? '' : note, user);
      return send(res, 200, { asset: db.prepare('SELECT * FROM assets WHERE id=?').get(id) });
    }
    if (m === 'DELETE') {
      if (!isAdmin) throw new HttpError(403, 'Apenas administradores podem excluir.');
      db.prepare('DELETE FROM assets WHERE id=?').run(id);
      if (cur.photo) fs.rm(path.join(PHOTOS, path.basename(cur.photo)), { force: true }, () => {});
      audit(user, 'bem_excluido', `Nº ${cur.number} (${cur.barcode}) — ${cur.description}`, req);
      return send(res, 200, { ok: true });
    }
  }
  if ((mm = p.match(/^\/api\/assets\/(\d+)\/photo$/))) {
    const id = Number(mm[1]);
    const cur = db.prepare('SELECT * FROM assets WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Patrimônio não encontrado.');
    if (m === 'GET') {
      const file = cur.photo && path.join(PHOTOS, path.basename(cur.photo));
      if (!file || !fs.existsSync(file)) throw new HttpError(404, 'Sem foto.');
      res.writeHead(200, { 'Content-Type': PHOTO_TYPES[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600', ...SEC });
      return fs.createReadStream(file).pipe(res);
    }
    const drop = () => { if (cur.photo) fs.rm(path.join(PHOTOS, path.basename(cur.photo)), { force: true }, () => {}); };
    if (m === 'PUT') {
      const buf = await readRaw(req);
      const kind = sniffImage(buf);
      if (!kind) throw new HttpError(400, 'Envie uma imagem JPG, PNG ou WebP.');
      const name = `${id}-${crypto.randomBytes(4).toString('hex')}.${kind[0]}`;
      fs.writeFileSync(path.join(PHOTOS, name), buf);
      drop();
      db.prepare("UPDATE assets SET photo=?, updated_at=datetime('now','localtime') WHERE id=?").run(name, id);
      addMovement(id, 'edicao', cur.photo ? 'Foto substituída' : 'Foto adicionada', '', user);
      return send(res, 200, { asset: db.prepare('SELECT * FROM assets WHERE id=?').get(id) });
    }
    if (m === 'DELETE') {
      drop();
      db.prepare("UPDATE assets SET photo='', updated_at=datetime('now','localtime') WHERE id=?").run(id);
      addMovement(id, 'edicao', 'Foto removida', '', user);
      return send(res, 200, { ok: true });
    }
  }
  if ((mm = p.match(/^\/api\/assets\/(\d+)\/history$/)) && m === 'GET') {
    return send(res, 200, { movements: db.prepare('SELECT * FROM movements WHERE asset_id=? ORDER BY id DESC').all(Number(mm[1])) });
  }

  // ----- movimentações -----
  if (m === 'GET' && p === '/api/movements') {
    const q = str(url.searchParams.get('q'), 100);
    const type = str(url.searchParams.get('type'), 20);
    const where = [], args = [];
    if (q) {
      const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
      where.push(`(a.number LIKE ? ESCAPE '\\' OR a.barcode LIKE ? ESCAPE '\\' OR a.description LIKE ? ESCAPE '\\' OR mv.detail LIKE ? ESCAPE '\\')`);
      args.push(like, like, like, like);
    }
    if (type) { where.push('mv.type=?'); args.push(type); }
    const rows = db.prepare(`SELECT mv.*, a.number, a.barcode, a.description FROM movements mv JOIN assets a ON a.id=mv.asset_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY mv.id DESC LIMIT 500`).all(...args);
    return send(res, 200, { movements: rows });
  }

  // ----- importação em massa -----
  if (m === 'POST' && p === '/api/assets/import') {
    const rows = (await readBody(req)).rows;
    if (!Array.isArray(rows) || !rows.length) throw new HttpError(400, 'Nenhuma linha para importar.');
    if (rows.length > 2000) throw new HttpError(400, 'Máximo de 2000 linhas por importação.');
    const errors = []; let created = 0;
    const ins = db.prepare(`INSERT INTO assets (barcode,number,description,category,sector,responsible,status,entry_mode,value,acquired_at,notes) VALUES (?,?,?,?,?,?,?,'manual',?,?,?)`);
    db.exec('BEGIN');
    try {
      rows.forEach((row, i) => {
        try {
          const a = validateAsset(row || {});
          const r = ins.run(a.barcode, a.number, a.description, a.category, a.sector, a.responsible, a.status, a.value, a.acquired_at, a.notes);
          addMovement(Number(r.lastInsertRowid), 'cadastro', 'Importado em massa (planilha).', '', user);
          created++;
        } catch (e) { const ee = uniqueError(e); errors.push({ line: i + 2, msg: ee.message }); }
      });
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    audit(user, 'importacao', `${created} importado(s), ${errors.length} erro(s)`, req);
    return send(res, 200, { created, errors: errors.slice(0, 50), errorCount: errors.length });
  }

  // ----- backup e auditoria (admin) -----
  if (m === 'GET' && p === '/api/backup') {
    if (!isAdmin) throw new HttpError(403, 'Apenas administradores.');
    const tmp = path.join(DATA, `backup-${Date.now()}.tmp`);
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    audit(user, 'backup', 'Backup baixado', req);
    const name = 'patrimonio-backup-' + new Date().toISOString().slice(0, 10) + '.db';
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store', ...SEC });
    const rs = fs.createReadStream(tmp);
    rs.pipe(res);
    const clean = () => fs.rm(tmp, { force: true }, () => {});
    rs.on('close', clean); res.on('close', clean);
    return;
  }
  if (m === 'GET' && p === '/api/audit') {
    if (!isAdmin) throw new HttpError(403, 'Apenas administradores.');
    return send(res, 200, { audit: db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 300').all() });
  }

  // ----- painel -----
  if (m === 'GET' && p === '/api/dashboard') {
    const one = sql => db.prepare(sql).get();
    const all = sql => db.prepare(sql).all();
    return send(res, 200, {
      total: one('SELECT COUNT(*) c FROM assets').c,
      value: one("SELECT COALESCE(SUM(value),0) v FROM assets WHERE status<>'baixado'").v,
      byStatus: all('SELECT status k, COUNT(*) n FROM assets GROUP BY status'),
      byCategory: all("SELECT COALESCE(NULLIF(category,''),'Sem categoria') k, COUNT(*) n FROM assets GROUP BY k ORDER BY n DESC LIMIT 8"),
      bySector: all("SELECT COALESCE(NULLIF(sector,''),'Sem setor') k, COUNT(*) n FROM assets GROUP BY k ORDER BY n DESC LIMIT 8"),
      recent: all('SELECT mv.*, a.number, a.description FROM movements mv JOIN assets a ON a.id=mv.asset_id ORDER BY mv.id DESC LIMIT 6'),
    });
  }

  // ----- inventário (conferência por leitura) -----
  if (p === '/api/inventories' && m === 'GET') {
    return send(res, 200, { inventories: db.prepare(`SELECT i.*, (SELECT COUNT(*) FROM inventory_items x WHERE x.inventory_id=i.id) found FROM inventories i ORDER BY i.id DESC LIMIT 50`).all() });
  }
  if (p === '/api/inventories' && m === 'POST') {
    const b = await readBody(req);
    const r = db.prepare('INSERT INTO inventories (sector,created_by) VALUES (?,?)').run(str(b.sector, 80), user.name);
    return send(res, 201, { id: Number(r.lastInsertRowid) });
  }
  if ((mm = p.match(/^\/api\/inventories\/(\d+)(\/scan|\/close)?$/))) {
    const id = Number(mm[1]);
    const inv = db.prepare('SELECT * FROM inventories WHERE id=?').get(id);
    if (!inv) throw new HttpError(404, 'Inventário não encontrado.');
    if (!mm[2] && m === 'GET') {
      const expected = db.prepare(`SELECT a.*, (SELECT found_at FROM inventory_items x WHERE x.inventory_id=? AND x.asset_id=a.id) found_at FROM assets a WHERE a.status<>'baixado' AND (?='' OR a.sector=?) ORDER BY a.number`).all(id, inv.sector, inv.sector);
      const extra = db.prepare(`SELECT a.*, x.found_at FROM inventory_items x JOIN assets a ON a.id=x.asset_id WHERE x.inventory_id=? AND (a.status='baixado' OR (?<>'' AND a.sector<>?)) ORDER BY x.found_at DESC`).all(id, inv.sector, inv.sector);
      return send(res, 200, { inventory: inv, expected, extra });
    }
    if (mm[2] === '/scan' && m === 'POST') {
      if (inv.closed_at) throw new HttpError(400, 'Inventário já encerrado.');
      const code = str((await readBody(req)).code, 80);
      const a = db.prepare('SELECT * FROM assets WHERE barcode=? OR number=?').get(code, code);
      if (!a) return send(res, 200, { result: 'unknown', code });
      const ins = db.prepare('INSERT OR IGNORE INTO inventory_items (inventory_id,asset_id) VALUES (?,?)').run(id, a.id);
      const outside = a.status === 'baixado' || (inv.sector && a.sector !== inv.sector);
      return send(res, 200, { result: ins.changes ? (outside ? 'outside' : 'ok') : 'duplicate', asset: a });
    }
    if (mm[2] === '/close' && m === 'POST') {
      db.prepare("UPDATE inventories SET closed_at=datetime('now','localtime') WHERE id=?").run(id);
      return send(res, 200, { ok: true });
    }
  }

  // ----- usuários (admin) -----
  if (p === '/api/users' || p.startsWith('/api/users/')) {
    if (!isAdmin) throw new HttpError(403, 'Apenas administradores.');
    if (m === 'GET' && p === '/api/users') {
      return send(res, 200, { users: db.prepare('SELECT id,username,name,role,created_at FROM users ORDER BY name COLLATE NOCASE').all() });
    }
    if (m === 'POST' && p === '/api/users') {
      const b = await readBody(req);
      const username = str(b.username, 40), name = str(b.name, 80), role = ['admin', 'viewer'].includes(b.role) ? b.role : 'user';
      if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) throw new HttpError(400, 'Usuário: 3 a 40 letras, números, ponto, hífen ou _.');
      if (!name) throw new HttpError(400, 'Informe o nome.');
      policy(b.password);
      try { db.prepare('INSERT INTO users (username,name,role,pass,must_change) VALUES (?,?,?,?,1)').run(username, name, role, hashPass(b.password)); }
      catch (e) { throw uniqueError(e); }
      audit(user, 'usuario_criado', `${username} (${role})`, req);
      return send(res, 201, { ok: true });
    }
    if ((mm = p.match(/^\/api\/users\/(\d+)$/))) {
      const id = Number(mm[1]);
      const target = db.prepare('SELECT * FROM users WHERE id=?').get(id);
      if (!target) throw new HttpError(404, 'Usuário não encontrado.');
      const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get().c;
      if (m === 'PUT') {
        const b = await readBody(req);
        const name = str(b.name, 80) || target.name;
        const role = ['admin', 'user', 'viewer'].includes(b.role) ? b.role : target.role;
        if (target.role === 'admin' && role !== 'admin' && admins <= 1) throw new HttpError(400, 'Deve existir ao menos um administrador.');
        db.prepare('UPDATE users SET name=?, role=? WHERE id=?').run(name, role, id);
        if (b.password) {
          policy(b.password);
          db.prepare('UPDATE users SET pass=?, must_change=1 WHERE id=?').run(hashPass(b.password), id);
          db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
          audit(user, 'senha_redefinida', target.username, req);
        }
        if (role !== target.role) { audit(user, 'perfil_alterado', `${target.username}: ${target.role} → ${role}`, req); db.prepare('DELETE FROM sessions WHERE user_id=? AND ?<>?').run(id, id, user.id); }
        return send(res, 200, { ok: true });
      }
      if (m === 'DELETE') {
        if (id === user.id) throw new HttpError(400, 'Você não pode excluir a si mesmo.');
        if (target.role === 'admin' && admins <= 1) throw new HttpError(400, 'Deve existir ao menos um administrador.');
        db.prepare('DELETE FROM users WHERE id=?').run(id);
        audit(user, 'usuario_excluido', target.username, req);
        return send(res, 200, { ok: true });
      }
    }
  }
  throw new HttpError(404, 'Rota não encontrada.');
}

// ---------- arquivos estáticos ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.join(PUBLIC, path.normalize(rel));
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Não encontrado');
  }
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    ...SEC,
  });
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
        throw new HttpError(403, 'Origem não permitida.');
      await api(req, res, url);
    } else serveStatic(req, res, url);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.code, { error: e.message });
    console.error(e);
    send(res, 500, { error: 'Erro interno do servidor.' });
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Controle de Patrimônio rodando em http://localhost:${PORT}`);
});

setInterval(() => db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now()), 3600000).unref();
