'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { ativo: 'Ativo', manutencao: 'Em manutenção', baixado: 'Baixado' };
const MTYPE = { cadastro: 'Cadastro', transferencia: 'Transferência', baixa: 'Baixa', edicao: 'Edição' };
const MODES = { gerar: ['Gerar etiqueta', 'bem sem código'], leitor: ['Leitor USB', 'já etiquetado'], camera: ['Câmera', 'já etiquetado'], manual: ['Digitar', 'já etiquetado'] };
const FLAGS = { sem_responsavel: 'Sem responsável', sem_foto: 'Sem foto' };
const PAGE = 50;
const ROLES = { admin: 'Administrador', user: 'Usuário', viewer: 'Consulta' };
const S = {
  page: 1, lock: false, user: null, view: 'dash', adminTab: 'users', labelTab: 'pendente', assets: [], showFilters: false, pending: 0,
  opts: { responsibles: [] }, lists: null, selecting: false, invRefill: null,
  f: { q: '', category: '', sector: '', status: '', responsible: '', flag: '' }, sel: new Set(),
};

// ---------- ícones ----------
const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const IC = {
  dash: svg('<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2"/><rect x="3" y="15" width="7.5" height="6" rx="2"/>'),
  assets: svg('<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'),
  labels: svg('<path d="M3 12V4a1 1 0 011-1h8l9 9-9 9-9-9z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  inv: svg('<rect x="4.5" y="4" width="15" height="17" rx="2.5"/><path d="M9 4V3h6v1M8.5 12l2.3 2.3L15.5 9.5"/>'),
  movements: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  admin: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  wrench: svg('<path d="M14.5 5.5a4 4 0 00-5 5L4 16a2 2 0 102.9 2.9l5.6-5.5a4 4 0 005-5l-2.4 2.4-2.6-.4-.4-2.6 2.4-2.4z"/>'),
  archive: svg('<rect x="3" y="4" width="18" height="4.5" rx="1.2"/><path d="M5 8.5V19a1 1 0 001 1h12a1 1 0 001-1V8.5M10 12.5h4"/>'),
  swap: svg('<path d="M7 4L3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7"/>'),
  edit: svg('<path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
  printer: svg('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>'),
  doc: svg('<path d="M6 3h8l5 5v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h7"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  photo: svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M21 16l-5-5-8.5 8"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  filter: svg('<path d="M4 6h16M7 12h10M10 18h4"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  boxes: svg('<path d="M3 7l5-3 5 3-5 3-5-3zM3 7v6l5 3 5-3V7M11 14l5-3 5 3-5 3-5-3zM11 14v6l5 3 5-3v-6"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>'),
};
const CHEV = '<svg class="chev" viewBox="0 0 9 15" aria-hidden="true"><path d="M1.5 1.5L7.5 7.5 1.5 13.5"/></svg>';

// ---------- utilidades ----------
async function api(path, opts = {}) {
  let r;
  try {
    r = await fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
  } catch { const e = new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.'); e.offline = true; throw e; }
  let data = {};
  try { data = await r.json(); } catch { /* vazio */ }
  if (r.status === 401 && path !== '/login') { S.user = null; render(); }
  if (!r.ok) throw new Error(data.error || `O servidor respondeu com erro (${r.status}).`);
  return data;
}
let toastT;
// toast('Mensagem') ou toast('Mensagem', { label: 'Desfazer', fn: async () => {} })
function toast(msg, action) {
  const t = $('#toast'), b = $('#toastAct');
  $('#toastMsg').textContent = msg;
  b.hidden = !action; t.classList.toggle('act', !!action);
  if (action) { b.textContent = action.label; b.onclick = () => { t.classList.remove('show'); clearTimeout(toastT); action.fn(); }; }
  t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), action ? 7000 : 2800);
}
async function undoMoves(items, after) {
  if (!items || !items.length) return;
  try { const r = await api('/assets/undo', { method: 'POST', body: { items } }); toast(r.updated === 1 ? 'Desfeito.' : `${r.updated} alterações desfeitas.`); feedback('ok'); }
  catch (e) { toast(e.message); return; }
  after && after();
  if (S.view === 'assets') refresh(); else if (S.view === 'dash') renderDash();
}
const pref = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignora */ } },
};
const fmtDate = s => { const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)/.exec(s || ''); return m ? `${m[3]}/${m[2]}/${m[1]} às ${m[4]}` : (s || ''); };
const daysSince = s => { const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? 0 : Math.max(0, Math.floor((Date.now() - d) / 864e5)); };
const opts = (arr, sel, first) => (first !== undefined ? `<option value="">${esc(first)}</option>` : '') + arr.map(v => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
const badge = s => `<span class="badge b-${esc(s)}">${esc(STATUS[s] || s)}</span>`;
const canEdit = () => S.user && S.user.role !== 'viewer';
const isAdmin = () => S.user && S.user.role === 'admin';
const photoURL = a => `/api/assets/${a.id}/photo?v=${encodeURIComponent(a.updated_at)}`;
const thumb = a => a.photo ? `<img class="thumb" loading="lazy" src="${photoURL(a)}" alt="">` : `<span class="thumb ph">${IC.photo}</span>`;
const vibrate = ms => { try { navigator.vibrate?.(ms); } catch { /* sem suporte */ } };
// Som curto de confirmação nas leituras (o iPhone não vibra pelo navegador, então o som é o retorno principal)
let actx = null;
const soundOn = () => pref.get('sound') !== 'off';
function tone(freq, start, dur, type = 'sine', vol = 0.18) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, actx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, actx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + start + dur);
  o.connect(g).connect(actx.destination); o.start(actx.currentTime + start); o.stop(actx.currentTime + start + dur + 0.02);
}
function feedback(kind) {
  vibrate(kind === 'ok' ? 40 : kind === 'warn' ? [50, 60, 50] : [90, 50, 90]);
  if (!soundOn()) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    if (kind === 'ok') { tone(1320, 0, 0.09); }
    else if (kind === 'warn') { tone(880, 0, 0.08); tone(880, 0.13, 0.08); }
    else { tone(240, 0, 0.28, 'square', 0.12); }
  } catch { /* áudio indisponível */ }
}
// libera o áudio no primeiro toque (exigência dos navegadores)
document.addEventListener('pointerdown', () => { if (!actx && soundOn()) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* sem áudio */ } } }, { once: true });
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const days = n => n === 1 ? '1 dia' : `${n} dias`;
async function shrink(file, max = 1024) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error('Imagem inválida')), 'image/jpeg', 0.82));
}
async function uploadPhoto(id, blob) {
  const r = await fetch(`/api/assets/${id}/photo`, { method: 'PUT', body: blob, credentials: 'same-origin' });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Falha ao enviar a foto');
}
async function loadLists(force) {
  if (S.lists && !force) return S.lists;
  try { S.lists = await api('/lists'); } catch { S.lists = { categories: [], sectors: [] }; }
  return S.lists;
}
const names = arr => (arr || []).map(x => x.name);
async function loadResponsibles() {
  if ((S.opts.responsibles || []).length) return;
  try { S.opts.responsibles = (await api('/assets?status=ativo')).responsibles; } catch { /* sem sugestões */ }
}
function paintPending() {
  const d = $('#nav [data-view=labels] .dot');
  if (d) { d.textContent = S.pending; d.hidden = !S.pending; }
}
async function refreshPending() {
  try { S.pending = (await api('/labels?status=pendente')).labels.length; } catch { /* ignora */ }
  paintPending();
}

// ---------- tema claro / escuro ----------
const sysDark = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = () => document.documentElement.getAttribute('data-theme') || (sysDark.matches ? 'dark' : 'light');
function paintTheme() {
  const dark = currentTheme() === 'dark';
  const b = $('#themeBtn');
  b.innerHTML = dark ? IC.sun : IC.moon;
  b.setAttribute('aria-label', dark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro');
  b.title = dark ? 'Tema claro' : 'Tema escuro';
  $('#themeColor').setAttribute('content', dark ? '#000000' : '#eef1f3');
}
$('#themeBtn').onclick = () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  pref.set('theme', next); paintTheme();
};
sysDark.addEventListener?.('change', paintTheme);
paintTheme();

// ---------- folha / modal ----------
let scanStop = null;
function stopScanner() { if (scanStop) { scanStop(); scanStop = null; } }
function openModal(html) {
  stopScanner();
  const o = $('#modal'); $('.modal', o).innerHTML = '<div class="grabber" aria-hidden="true"></div>' + html; o.hidden = false;
  document.body.style.overflow = 'hidden';
  $('.modal', o).scrollTop = 0;
}
function closeModal() {
  if (S.lock) return;
  stopScanner();
  $('#modal').hidden = true; $('#modal .modal').innerHTML = '';
  document.body.style.overflow = '';
}
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

// ---------- câmera ----------
function startScanner(area, onCode) {
  stopScanner();
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    area.innerHTML = '<div class="notice">Este navegador não lê códigos pela câmera. Use o Chrome no Android ou no computador, ou digite o código.</div>'; return;
  }
  if (!window.isSecureContext) {
    area.innerHTML = '<div class="notice">A câmera só funciona em conexão segura (HTTPS). Digite o código ou acesse o sistema por HTTPS.</div>'; return;
  }
  area.innerHTML = '<div class="scanbox"><video playsinline muted></video></div><p class="hint" style="text-align:center;margin:-6px 0 12px">Centralize o código de barras no quadro.</p>';
  const video = $('video', area); let stream, timer, stopped = false;
  scanStop = () => { stopped = true; clearInterval(timer); stream && stream.getTracks().forEach(t => t.stop()); };
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(async s => {
    if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
    stream = s; video.srcObject = s; await video.play();
    const det = new BarcodeDetector();
    let busy = false;
    timer = setInterval(async () => {
      if (busy || stopped) return; busy = true;
      try { const r = await det.detect(video); if (r.length && r[0].rawValue) await onCode(r[0].rawValue); } catch { /* sem código no quadro */ }
      busy = false;
    }, 280);
  }).catch(() => { area.innerHTML = '<div class="notice">Não foi possível abrir a câmera. Permita o acesso à câmera nas configurações do navegador.</div>'; });
}

// ---------- impressão ----------
function printHTML(html, page = '@page{size:A4;margin:12mm}', after) {
  $('#printArea').innerHTML = `<style>${page}</style>` + html;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); $('#printArea').innerHTML = ''; window.removeEventListener('afterprint', done); after && after(); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 60);
}
const labelHTML = a => `<div class="plabel"><div class="h"><span>Patrimônio</span><span>${esc(a.sector || '')}</span></div>${barcodeSVG(a.barcode)}<div class="n">${esc(a.number)}</div><div class="d">${esc(a.description)}</div></div>`;
function printLabels(list, after) {
  if (!list.length) return toast('Nenhuma etiqueta para imprimir.');
  const thermal = (pref.get('labelFormat') || 'a4') === 'termica';
  printHTML(`<div class="labels ${thermal ? 'thermal' : ''}">${list.map(labelHTML).join('')}</div>`, thermal ? '@page{size:50mm 30mm;margin:1mm}' : '@page{size:A4;margin:10mm}', after);
}
function printAndMark(list, then) {
  if (!list.length) return toast('Nenhuma etiqueta para imprimir.');
  printLabels(list, async () => {
    try { await api('/labels/mark', { method: 'POST', body: { ids: list.map(a => a.id), status: 'impressa' } }); } catch (e) { toast(e.message); }
    refreshPending(); then && then();
  });
}
function exportCSV(list) {
  const head = ['Número', 'Nº de barras', 'Descrição', 'Categoria', 'Setor', 'Responsável', 'Situação', 'Observações', 'Cadastrado em'];
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = list.map(a => [a.number, a.barcode, a.description, a.category, a.sector, a.responsible, STATUS[a.status], a.notes, fmtDate(a.created_at)].map(q).join(';'));
  const blob = new Blob(['\ufeff' + [head.map(q).join(';'), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'patrimonio-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function printReport(list, title = 'Relatório de patrimônio') {
  printHTML(`<div class="rep"><h1>${esc(title)}</h1><div class="metaline">Emitido em ${new Date().toLocaleString('pt-BR')}, ${plural(list.length, 'item', 'itens')}</div>
  <table><thead><tr><th>Número</th><th>Descrição</th><th>Categoria</th><th>Setor</th><th>Responsável</th><th>Situação</th></tr></thead><tbody>
  ${list.map(a => `<tr><td>${esc(a.number)}</td><td>${esc(a.description)}</td><td>${esc(a.category)}</td><td>${esc(a.sector)}</td><td>${esc(a.responsible)}</td><td>${esc(STATUS[a.status])}</td></tr>`).join('')}
  </tbody></table></div>`);
}
async function printTerm(responsible) {
  if (!responsible) return toast('Este bem não tem responsável definido.');
  let list;
  try { list = (await api('/assets?responsible=' + encodeURIComponent(responsible))).assets.filter(a => a.status !== 'baixado'); } catch (e) { return toast(e.message); }
  printHTML(`<div class="rep"><h1>Termo de responsabilidade</h1><div class="metaline">Emitido em ${new Date().toLocaleString('pt-BR')}</div>
  <p>Eu, <b>${esc(responsible)}</b>, declaro ter recebido e estar sob minha guarda os bens patrimoniais relacionados abaixo, comprometendo-me a zelar por sua conservação, a utilizá-los exclusivamente em atividades da empresa e a comunicar imediatamente qualquer dano, extravio ou transferência.</p>
  <table><thead><tr><th>Número</th><th>Descrição</th><th>Categoria</th><th>Setor</th><th>Situação</th></tr></thead><tbody>
  ${list.map(a => `<tr><td>${esc(a.number)}</td><td>${esc(a.description)}</td><td>${esc(a.category)}</td><td>${esc(a.sector)}</td><td>${esc(STATUS[a.status])}</td></tr>`).join('')}
  </tbody></table><p><b>${plural(list.length, 'bem', 'bens')}</b> sob responsabilidade.</p>
  <div class="sign"><div>${esc(responsible)}<br>Responsável</div><div>Gestor patrimonial</div></div></div>`);
}

// ---------- estrutura ----------
function renderChrome() {
  const nav = $('#nav'), fab = $('#scanFab'), top = $('#scanTop'), ub = $('#userbox');
  if (!S.user || S.user.must_change) { nav.hidden = fab.hidden = top.hidden = true; ub.innerHTML = ''; return; }
  const tabs = [['dash', 'Painel'], ['assets', 'Bens'], ['labels', 'Etiquetas'], ['inv', 'Inventário'], ['movements', 'Histórico']];
  if (isAdmin()) tabs.push(['admin', 'Admin']);
  nav.hidden = fab.hidden = top.hidden = false;
  nav.innerHTML = tabs.map(([k, l]) => `<button data-view="${k}" class="${S.view === k ? 'on' : ''}" ${S.view === k ? 'aria-current="page"' : ''}>${IC[k]}<span>${l}</span>${k === 'labels' ? `<i class="dot" ${S.pending ? '' : 'hidden'}>${S.pending}</i>` : ''}</button>`).join('');
  nav.querySelectorAll('button').forEach(b => b.onclick = () => go(b.dataset.view));
  const ini = S.user.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  ub.innerHTML = `<button class="avatar" id="avBtn" aria-haspopup="menu" aria-label="Conta de ${esc(S.user.name)}">${esc(ini)}</button>`;
  $('#avBtn').onclick = e => {
    e.stopPropagation();
    const open = $('.umenu', ub); if (open) { open.remove(); return; }
    ub.insertAdjacentHTML('beforeend', `<div class="umenu" role="menu"><div class="who"><b>${esc(S.user.name)}</b><span>${esc(ROLES[S.user.role] || '')}, login ${esc(S.user.username)}</span></div><button id="sndBtn" role="menuitemcheckbox" aria-checked="${soundOn()}">Som nas leituras: ${soundOn() ? 'ligado' : 'desligado'}</button>${installItem()}<button id="pwBtn" role="menuitem">Alterar senha</button><button id="outBtn" class="out" role="menuitem">Sair</button></div>`);
    $('#sndBtn').onclick = () => { pref.set('sound', soundOn() ? 'off' : 'on'); $('.umenu', ub)?.remove(); toast(soundOn() ? 'Som ligado.' : 'Som desligado.'); if (soundOn()) feedback('ok'); };
    if ($('#instBtn')) $('#instBtn').onclick = () => { $('.umenu', ub)?.remove(); installApp(); };
    $('#outBtn').onclick = async () => { try { await api('/logout', { method: 'POST' }); } catch { /* ignora */ } S.user = null; S.lists = null; render(); };
    $('#pwBtn').onclick = () => { $('.umenu', ub)?.remove(); openPassword(); };
  };
}
document.addEventListener('click', e => { const m = $('.umenu'); if (m && !m.contains(e.target)) m.remove(); });
$('#scanTop').onclick = () => openScan();
$('#scanFab').onclick = () => openScan();
function go(view, filters) {
  S.view = view;
  if (filters) { S.f = { q: '', category: '', sector: '', status: '', responsible: '', flag: '', ...filters }; S.page = 1; S.sel.clear(); }
  window.scrollTo(0, 0);
  render();
}
async function render() {
  renderChrome();
  if (!S.user) return renderLogin();
  if (S.user.must_change) { $('#app').innerHTML = ''; return openPassword(true); }
  const views = { dash: renderDash, assets: renderAssets, labels: renderLabels, inv: renderInv, movements: renderMovements, admin: renderAdmin };
  return (views[S.view] || renderDash)();
}
const head = (title, sub, actions = '') => `<div class="head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="spacer"></div>${actions}</div>`;

// ---------- login ----------
function renderLogin() {
  $('#app').innerHTML = `<div class="auth">
    <img class="appicon" src="/icon.svg" alt="">
    <h1>Patrimônio</h1><p class="sub">Entre para controlar os bens da empresa.</p>
    <form id="lf" autocomplete="on">
      <div class="field"><label for="u">Usuário</label><input id="u" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" value="${esc(pref.get('lastUser') || '')}" required></div>
      <div class="field"><label for="p">Senha</label><div class="pw"><input id="p" name="password" type="password" autocomplete="current-password" required><button type="button" id="tp" aria-label="Mostrar senha">Mostrar</button></div></div>
      <label class="inl" style="margin:4px 0 16px"><input type="checkbox" class="check" id="rem" ${pref.get('lastUser') ? 'checked' : ''}> Lembrar meu usuário</label>
      <p class="err" id="le" role="alert"></p>
      <button class="btn primary block" id="lb">Entrar</button>
    </form>
    <p class="foot">Esqueceu a senha? Peça ao administrador para redefinir.</p></div>`;
  ($('#u').value ? $('#p') : $('#u')).focus();
  $('#tp').onclick = () => { const p = $('#p'); const show = p.type === 'password'; p.type = show ? 'text' : 'password'; $('#tp').textContent = show ? 'Ocultar' : 'Mostrar'; };
  $('#lf').onsubmit = async e => {
    e.preventDefault(); $('#lb').disabled = true; $('#lb').textContent = 'Entrando…'; $('#le').textContent = '';
    try {
      const r = await api('/login', { method: 'POST', body: { username: $('#u').value.trim(), password: $('#p').value } });
      pref.set('lastUser', $('#rem').checked ? $('#u').value.trim() : '');
      S.user = r.user; S.view = 'dash'; S.lists = null; render();
    } catch (er) { $('#le').textContent = er.message; $('#lb').disabled = false; $('#lb').textContent = 'Entrar'; $('#p').select(); }
  };
}
function openPassword(forced) {
  S.lock = false;
  openModal(`<h2>${forced ? 'Crie sua senha' : 'Alterar senha'}</h2>${forced ? '<p class="sub" style="margin:-4px 0 16px">Por segurança, troque a senha provisória antes de continuar.</p>' : ''}<form id="pf">
    <div class="field"><label for="pc">Senha atual</label><input type="password" id="pc" autocomplete="current-password" required></div>
    <div class="field"><label for="pn">Nova senha</label><input type="password" id="pn" autocomplete="new-password" required minlength="8"><div class="hint">Mínimo de 8 caracteres, com letras e números.</div></div>
    <p class="err" id="pe"></p>
    <div class="modal-actions"><button type="button" class="btn" id="cx">${forced ? 'Sair' : 'Cancelar'}</button><button class="btn primary">Salvar senha</button></div></form>`);
  S.lock = !!forced;
  $('#cx').onclick = forced ? async () => { S.lock = false; try { await api('/logout', { method: 'POST' }); } catch { /* ignora */ } closeModal(); S.user = null; render(); } : closeModal;
  $('#pf').onsubmit = async e => {
    e.preventDefault();
    try {
      await api('/me/password', { method: 'POST', body: { current: $('#pc').value, password: $('#pn').value } });
      S.lock = false; closeModal(); toast('Senha salva.');
      if (forced) { S.user.must_change = false; render(); }
    } catch (er) { $('#pe').textContent = er.message; }
  };
}

// ---------- ler código (acesso rápido) ----------
function openScan() {
  const mode = pref.get('scanMode') || 'camera';
  openModal(`<h2>Ler código</h2>
    <div class="seg" id="smode" style="margin-bottom:14px"><button data-m="camera">Câmera</button><button data-m="type">Leitor ou digitação</button></div>
    <div id="sarea"></div>
    <form id="sform" autocomplete="off"><div class="field"><label for="scode">Código de barras ou número do patrimônio</label><input id="scode" class="mono" enterkeyhint="search" placeholder="Ex.: PAT-000101"></div></form>
    <div id="sres"></div>
    <div class="modal-actions"><button class="btn" id="cx">Fechar</button></div>`);
  $('#cx').onclick = closeModal;
  const area = $('#sarea'), input = $('#scode');
  const lookup = async code => {
    code = String(code).trim(); if (!code) return;
    let r; try { r = await api('/assets/lookup?code=' + encodeURIComponent(code)); } catch (e) { toast(e.message); return; }
    if (r.asset) { feedback('ok'); stopScanner(); openDetail(r.asset.id); return; }
    feedback('bad'); stopScanner(); area.innerHTML = ''; input.value = code;
    $('#sres').innerHTML = `<div class="result bad">Nenhum bem tem o código ${esc(code)}.</div>${canEdit() ? '<button class="btn primary block" id="snew">Cadastrar bem com este código</button>' : ''}`;
    if ($('#snew')) $('#snew').onclick = () => openForm(null, { barcode: code, mode: 'manual' });
  };
  const setMode = m => {
    pref.set('scanMode', m); $('#sres').innerHTML = '';
    $$('#smode button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    if (m === 'camera') startScanner(area, lookup); else { stopScanner(); area.innerHTML = ''; input.focus(); }
  };
  $$('#smode button').forEach(b => b.onclick = () => setMode(b.dataset.m));
  $('#sform').onsubmit = e => { e.preventDefault(); lookup(input.value); };
  setMode(mode);
}

// ---------- bens ----------
async function loadAssets() {
  const p = new URLSearchParams(Object.entries(S.f).filter(([, v]) => v));
  const r = await api('/assets?' + p);
  S.assets = r.assets; S.opts.responsibles = r.responsibles;
}
async function renderAssets() {
  $('#app').innerHTML = head('Bens', 'Encontre, cadastre e movimente o patrimônio.',
    canEdit() ? `<button class="btn hide-m" id="impBtn">Importar planilha</button><button class="btn primary" id="addBtn">${IC.plus}Novo bem</button>` : '') + `
  <div class="toolbar">
    <div class="search">${IC.search}<input id="fq" type="search" enterkeyhint="search" placeholder="Buscar por número, descrição ou pessoa" value="${esc(S.f.q)}" aria-label="Buscar bens"></div>
    <button class="btn" id="fBtn" aria-expanded="${S.showFilters}">${IC.filter}<span id="fBtnT">Filtros</span></button>
  </div>
  <div class="chips" id="chips"></div>
  <div class="filters" id="fpanel" ${S.showFilters ? '' : 'hidden'}>
    <div class="field"><label for="fc">Categoria</label><select id="fc"></select></div>
    <div class="field"><label for="fsec">Setor</label><select id="fsec"></select></div>
    <div class="field"><label for="fres">Responsável</label><select id="fres"></select></div>
  </div>
  <div class="actbar"><span class="count" id="cnt"></span><div class="spacer"></div>
    ${canEdit() ? `<button class="btn sm show-m" id="bSel">${S.selecting ? 'Concluir' : 'Selecionar'}</button><button class="btn sm" id="bMove">${IC.swap}<span id="bMoveT">Transferir vários</span></button>` : ''}
    <button class="btn sm" id="bTerm" hidden>${IC.doc}Termo</button>
    <button class="btn sm" id="bLab">${IC.printer}Etiquetas</button>
    <button class="btn sm" id="bCsv">Excel</button>
    <button class="btn sm" id="bPdf">PDF</button></div>
  <div class="tablewrap assets" id="tw"></div><div class="list" id="lw"></div><div class="pager" id="pg"></div>`;
  if (canEdit()) { $('#addBtn').onclick = () => openForm(); $('#impBtn').onclick = openImport; }
  let t;
  $('#fq').oninput = e => { S.f.q = e.target.value; S.page = 1; clearTimeout(t); t = setTimeout(refresh, 250); };
  $('#fq').onkeydown = e => { if (e.key === 'Enter') { clearTimeout(t); S.f.q = e.target.value; e.target.blur(); refresh(true); } };
  $('#fBtn').onclick = () => { S.showFilters = !S.showFilters; $('#fpanel').hidden = !S.showFilters; $('#fBtn').setAttribute('aria-expanded', S.showFilters); };
  const setF = (k, v) => { S.f[k] = v; S.page = 1; refresh(); };
  $('#fc').onchange = e => setF('category', e.target.value);
  $('#fsec').onchange = e => setF('sector', e.target.value);
  $('#fres').onchange = e => setF('responsible', e.target.value);
  $('#bLab').onclick = () => printAndMark(S.sel.size ? S.assets.filter(a => S.sel.has(a.id)) : S.assets, () => refresh());
  $('#bCsv').onclick = () => S.assets.length ? exportCSV(S.assets) : toast('Nada para exportar.');
  $('#bPdf').onclick = () => S.assets.length ? printReport(S.assets) : toast('Nada para exportar.');
  $('#bTerm').onclick = () => printTerm(S.f.responsible);
  if ($('#bMove')) $('#bMove').onclick = () => openBatch(S.assets.filter(a => S.sel.has(a.id)));
  if ($('#bSel')) $('#bSel').onclick = () => { S.selecting = !S.selecting; if (!S.selecting) S.sel.clear(); $('#bSel').textContent = S.selecting ? 'Concluir' : 'Selecionar'; refresh(); };
  await loadLists();
  refresh();
}
function renderChips() {
  const st = [['', 'Todos'], ['ativo', 'Ativos'], ['manutencao', 'Em manutenção'], ['baixado', 'Baixados']];
  let html = st.map(([k, l]) => `<button class="chip ${S.f.status === k ? 'on' : ''}" data-st="${k}" aria-pressed="${S.f.status === k}">${l}</button>`).join('');
  const extra = [];
  if (S.f.flag) extra.push(['flag', FLAGS[S.f.flag]]);
  if (S.f.category) extra.push(['category', S.f.category]);
  if (S.f.sector) extra.push(['sector', S.f.sector]);
  if (S.f.responsible) extra.push(['responsible', S.f.responsible]);
  html += extra.map(([k, l]) => `<button class="chip on" data-clear="${k}" aria-label="Remover filtro ${esc(l)}">${esc(l)} <span aria-hidden="true">✕</span></button>`).join('');
  $('#chips').innerHTML = html;
  $$('#chips [data-st]').forEach(b => b.onclick = () => { S.f.status = b.dataset.st; S.page = 1; refresh(); });
  $$('#chips [data-clear]').forEach(b => b.onclick = () => { S.f[b.dataset.clear] = ''; S.page = 1; refresh(); });
  const n = ['category', 'sector', 'responsible'].filter(k => S.f[k]).length;
  $('#fBtnT').textContent = n ? `Filtros (${n})` : 'Filtros';
}
async function refresh(openIfSingle) {
  try { await loadAssets(); } catch (e) { return toast(e.message); }
  if (!$('#tw')) return;
  renderChips();
  $('#fc').innerHTML = opts(names(S.lists.categories), S.f.category, 'Todas');
  $('#fsec').innerHTML = opts(names(S.lists.sectors), S.f.sector, 'Todos');
  $('#fres').innerHTML = opts(S.opts.responsibles || [], S.f.responsible, 'Todos');
  $('#bTerm').hidden = !S.f.responsible;
  const labBtn = () => { $('#bLab').innerHTML = `${IC.printer}${S.sel.size ? `Etiquetas (${S.sel.size})` : 'Etiquetas'}`; if ($('#bMoveT')) $('#bMoveT').textContent = S.sel.size ? `Transferir (${S.sel.size})` : 'Transferir vários'; };
  labBtn();
  const pages = Math.max(1, Math.ceil(S.assets.length / PAGE));
  if (S.page > pages) S.page = pages;
  const view = S.assets.slice((S.page - 1) * PAGE, S.page * PAGE);
  $('#cnt').textContent = plural(S.assets.length, 'bem', 'bens');
  $('#pg').innerHTML = pages > 1 ? `<button class="btn sm" id="pp" ${S.page === 1 ? 'disabled' : ''}>Anterior</button><span class="count">Página ${S.page} de ${pages}</span><button class="btn sm" id="pn2" ${S.page === pages ? 'disabled' : ''}>Próxima</button>` : '';
  if (pages > 1) { $('#pp').onclick = () => { S.page--; refresh(); window.scrollTo(0, 0); }; $('#pn2').onclick = () => { S.page++; refresh(); window.scrollTo(0, 0); }; }
  if (!S.assets.length) {
    const filtered = Object.values(S.f).some(Boolean);
    const empty = `<div class="empty"><b>Nenhum bem encontrado</b>${filtered ? 'Tente outra busca ou limpe os filtros.' : 'Cadastre o primeiro bem ou importe uma planilha.'}${!filtered && canEdit() ? `<br><button class="btn primary" data-new>${IC.plus}Novo bem</button>` : ''}</div>`;
    $('#tw').innerHTML = empty; $('#lw').innerHTML = empty;
    $$('[data-new]').forEach(b => b.onclick = () => openForm());
    return;
  }
  $('#tw').innerHTML = `<table><thead><tr><th style="width:40px"><input type="checkbox" class="check" id="all" aria-label="Selecionar todos desta página"></th><th>Número</th><th>Descrição</th><th>Setor</th><th>Responsável</th><th>Situação</th></tr></thead><tbody>
    ${view.map(a => `<tr class="click" data-id="${a.id}"><td><input type="checkbox" class="check sel" data-id="${a.id}" ${S.sel.has(a.id) ? 'checked' : ''} aria-label="Selecionar ${esc(a.number)}"></td>
    <td><span class="num">${esc(a.number)}</span>${a.label_status === 'pendente' ? '<div style="margin-top:4px"><span class="badge b-pendente">Etiqueta a imprimir</span></div>' : ''}</td><td><div class="cellph">${thumb(a)}<div>${esc(a.description)}<div class="hint">${esc(a.category) || 'Sem categoria'}</div></div></div></td>
    <td>${esc(a.sector) || '—'}</td><td>${esc(a.responsible) || '<span class="hint">—</span>'}</td><td>${badge(a.status)}</td></tr>`).join('')}</tbody></table>`;
  $('#lw').innerHTML = view.map(a => `<button class="li ${S.selecting ? 'selecting' : ''} ${S.sel.has(a.id) ? 'picked' : ''}" data-id="${a.id}" ${S.selecting ? `role="checkbox" aria-checked="${S.sel.has(a.id)}"` : ''}>${S.selecting ? `<span class="tick" aria-hidden="true">${IC.check}</span>` : ''}${thumb(a)}<span class="t"><b>${esc(a.description)}</b><span class="meta"><span class="num">${esc(a.number)}</span><span>${esc(a.sector || 'Sem setor')}</span></span></span><span class="r">${badge(a.status)}</span>${CHEV}</button>`).join('');
  $$('#tw tr.click').forEach(tr => tr.onclick = e => { if (e.target.classList.contains('check')) return; openDetail(Number(tr.dataset.id)); });
  $$('#lw .li').forEach(b => b.onclick = () => {
    const id = Number(b.dataset.id);
    if (!S.selecting) return openDetail(id);
    S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id);
    b.classList.toggle('picked', S.sel.has(id)); b.setAttribute('aria-checked', S.sel.has(id)); labBtn();
  });
  $$('#tw .sel').forEach(c => c.onchange = () => { c.checked ? S.sel.add(Number(c.dataset.id)) : S.sel.delete(Number(c.dataset.id)); labBtn(); });
  const all = $('#all'); if (all) all.onchange = () => { $$('#tw .sel').forEach(c => { c.checked = all.checked; all.checked ? S.sel.add(Number(c.dataset.id)) : S.sel.delete(Number(c.dataset.id)); }); labBtn(); };
  if (openIfSingle === true && S.assets.length === 1) openDetail(S.assets[0].id);
}

// ---------- detalhe ----------
async function openDetail(id) {
  let a, mv;
  try { [a, mv] = await Promise.all([api('/assets/' + id).then(r => r.asset), api(`/assets/${id}/history`).then(r => r.movements)]); } catch (e) { return toast(e.message); }
  const edit = canEdit();
  const labelLine = a.label_status === 'pendente' ? '<span class="badge b-pendente">Na fila para imprimir</span>'
    : a.label_status === 'impressa' ? `Impressa em ${fmtDate(a.label_printed_at)}` : 'Não impressa pelo sistema';
  openModal(`<div class="row" style="align-items:flex-start;margin-bottom:12px"><div style="flex:1;min-width:0"><h2 style="margin:0">${esc(a.description)}</h2><div class="num" style="font-size:17px;margin-top:2px">${esc(a.number)}</div></div>${badge(a.status)}</div>
  ${a.photo ? `<img class="detph" src="${photoURL(a)}" alt="Foto do bem ${esc(a.number)}">` : ''}
  <div class="qa">
    ${edit ? `<button class="btn" id="qMove">${IC.swap}Transferir</button>` : ''}
    ${edit ? `<button class="btn" id="qEdit">${IC.edit}Editar</button>` : ''}
    <button class="btn" id="qLab">${IC.printer}Imprimir etiqueta</button>
    ${a.responsible ? `<button class="btn" id="qTerm">${IC.doc}Termo</button>` : ''}
  </div>
  <div class="group">
    <div class="gi"><span>Setor</span><b>${esc(a.sector) || '—'}</b></div>
    <div class="gi"><span>Responsável</span><b>${esc(a.responsible) || '—'}</b></div>
    <div class="gi"><span>Categoria</span><b>${esc(a.category) || '—'}</b></div>
    ${a.notes ? `<div class="gi"><span>Observações</span><b>${esc(a.notes)}</b></div>` : ''}
    <div class="gi"><span>Cadastrado em</span><b>${fmtDate(a.created_at)}</b></div>
    <div class="gi"><span>Etiqueta</span><b>${labelLine}</b></div>
  </div>
  <div class="barcode"><div>${barcodeSVG(a.barcode).replace('<svg ', '<svg style="width:100%;height:100%" ')}</div><span class="mono">${esc(a.barcode)}</span></div>
  ${edit && a.label_status !== 'pendente' ? `<button class="btn block" id="qQueue" style="margin-bottom:16px">${IC.labels}Colocar na fila de etiquetas</button>` : ''}
  <h3>Histórico</h3><div class="card" style="padding:4px 16px"><ul class="hist">${mv.map(m => `<li><span class="badge b-${esc(m.type)}">${esc(MTYPE[m.type] || m.type)}</span> ${esc(m.detail)}${m.note ? `<br><i>“${esc(m.note)}”</i>` : ''}<small>${fmtDate(m.created_at)}, por ${esc(m.user_name)}</small></li>`).join('')}</ul></div>
  <div class="modal-actions">${isAdmin() ? `<button class="btn danger" id="dl">${IC.trash}Excluir</button><div class="spacer"></div>` : ''}<button class="btn primary" id="cl">Concluído</button></div>`);
  $('#cl').onclick = closeModal;
  $('#qLab').onclick = () => printAndMark([a], () => { if (S.view === 'labels') renderLabels(); });
  if ($('#qTerm')) $('#qTerm').onclick = () => printTerm(a.responsible);
  if ($('#qMove')) $('#qMove').onclick = () => openTransfer(a);
  if ($('#qEdit')) $('#qEdit').onclick = () => openForm(a);
  if ($('#qQueue')) $('#qQueue').onclick = async () => {
    try { await api('/labels/mark', { method: 'POST', body: { ids: [a.id], status: 'pendente' } }); toast('Etiqueta colocada na fila.'); refreshPending(); openDetail(a.id); } catch (e) { toast(e.message); }
  };
  if ($('#dl')) $('#dl').onclick = async () => {
    if (!confirm(`Excluir definitivamente o bem ${a.number} e todo o histórico? Para tirar de uso, prefira "Transferir" e marcar como Baixado.`)) return;
    try { await api('/assets/' + id, { method: 'DELETE' }); closeModal(); S.sel.delete(id); toast('Bem excluído.'); refreshPending(); render(); } catch (e) { toast(e.message); }
  };
}

// seletor por toque para as listas cadastradas
function pickHTML(id, items, selected, emptyMsg) {
  const all = [...items]; if (selected && !all.includes(selected)) all.unshift(selected);
  return `<div class="pick" id="${id}" role="radiogroup">${all.length ? all.map(v => `<button type="button" role="radio" aria-checked="${v === selected}" class="${v === selected ? 'on' : ''}" data-v="${esc(v)}">${esc(v)}</button>`).join('') : `<span class="empty-pick">${emptyMsg}</span>`}</div>`;
}
function bindPick(id, allowNone = true) {
  const el = $('#' + id); if (!el) return () => '';
  $$('button', el).forEach(b => b.onclick = () => {
    const was = b.classList.contains('on');
    $$('button', el).forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
    if (!(was && allowNone)) { b.classList.add('on'); b.setAttribute('aria-checked', 'true'); }
  });
  return () => $('button.on', el)?.dataset.v || '';
}
const manageLink = () => isAdmin() ? '<button type="button" class="btn sm" id="goLists" style="margin-top:10px">Gerenciar categorias e setores</button>' : '';

// ---------- transferência rápida ----------
async function openTransfer(a) {
  await Promise.all([loadLists(), loadResponsibles()]);
  let status = a.status;
  openModal(`<h2>Transferir ou mudar situação</h2><p class="sub" style="margin:-6px 0 16px"><span class="num">${esc(a.number)}</span>, ${esc(a.description)}</p>
  <form id="tf" autocomplete="off">
    <div class="field"><span class="lbl">Setor</span>${pickHTML('tsec', names(S.lists.sectors), a.sector, 'Nenhum setor cadastrado.')}</div>
    <div class="field"><label for="tr">Responsável</label><input id="tr" list="dres" value="${esc(a.responsible)}"><datalist id="dres">${(S.opts.responsibles || []).map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
    <div class="field"><span class="lbl">Situação</span><div class="seg" id="tst">${Object.entries(STATUS).map(([k, l]) => `<button type="button" data-s="${k}" class="${k === status ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="field"><label for="tn">Motivo</label><input id="tn" maxlength="300" placeholder="Ex.: mudou para a sala 12"></div>
    <p class="err" id="te"></p>
    <div class="modal-actions"><button type="button" class="btn" id="cx">Voltar</button><button class="btn primary" id="tsv">Salvar transferência</button></div>
  </form>`);
  const getSec = bindPick('tsec');
  $$('#tst button').forEach(b => b.onclick = () => { status = b.dataset.s; $$('#tst button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#cx').onclick = () => openDetail(a.id);
  $('#tf').onsubmit = async e => {
    e.preventDefault();
    const body = { ...a, sector: getSec(), responsible: $('#tr').value.trim(), status, note: $('#tn').value };
    if (body.sector === a.sector && body.responsible === a.responsible && status === a.status) { $('#te').textContent = 'Nada mudou. Escolha outro setor, responsável ou situação.'; return; }
    if (status === 'baixado' && a.status !== 'baixado' && !confirm('Marcar este bem como baixado? Ele sai da contagem do patrimônio ativo.')) return;
    $('#tsv').disabled = true;
    try {
      await api('/assets/' + a.id, { method: 'PUT', body });
      const prev = [{ id: a.id, sector: a.sector, responsible: a.responsible, status: a.status }];
      toast(status === 'baixado' && a.status !== 'baixado' ? 'Bem baixado.' : 'Transferência salva.', { label: 'Desfazer', fn: () => undoMoves(prev, () => { if (!$('#modal').hidden) openDetail(a.id); }) });
      feedback('ok'); openDetail(a.id); if (S.view === 'assets') refresh(); else if (S.view === 'dash') renderDash();
    }
    catch (er) { $('#te').textContent = er.message; $('#tsv').disabled = false; }
  };
}

// ---------- transferir vários bens ----------
async function openBatch(initial = []) {
  await Promise.all([loadLists(), loadResponsibles()]);
  const items = new Map(initial.map(a => [a.id, a]));
  let status = '';
  openModal(`<h2>Transferir vários bens</h2><p class="sub" style="margin:-6px 0 16px">Escolha o destino e depois leia ou digite os códigos dos bens que vão junto.</p>
  <form id="bf" autocomplete="off">
    <div class="card" style="margin-bottom:14px">
      <div class="field"><span class="lbl">Novo setor</span>${pickHTML('bsec', names(S.lists.sectors), '', 'Nenhum setor cadastrado.')}<div class="hint">Sem escolha, cada bem continua no setor atual.</div></div>
      <div class="field"><label for="bres">Novo responsável</label><input id="bres" list="dres" placeholder="Deixe vazio para manter o atual"><datalist id="dres">${(S.opts.responsibles || []).map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="field" style="margin-bottom:0"><span class="lbl">Situação</span><div class="seg" id="bst"><button type="button" data-s="" class="on">Manter</button>${Object.entries(STATUS).map(([k, l]) => `<button type="button" data-s="${k}">${l}</button>`).join('')}</div></div>
    </div>
    <span class="lbl">Bens que vão ser transferidos</span>
    <div class="seg" id="bmode" style="margin-bottom:12px"><button type="button" data-m="type">Leitor ou digitação</button><button type="button" data-m="camera">Câmera</button></div>
    <div id="barea"></div>
    <div class="addrow"><input id="bcode" class="mono" enterkeyhint="go" placeholder="Código ou número do patrimônio" aria-label="Código do bem"><button type="button" class="btn" id="badd">${IC.plus}Adicionar</button></div>
    <div id="bmsg" role="status" aria-live="polite"></div>
    <div class="group" id="blist"></div>
    <div class="field"><label for="bnote">Motivo</label><input id="bnote" maxlength="300" placeholder="Ex.: mudança da equipe para o 2º andar"></div>
    <p class="err" id="be"></p>
    <div class="modal-actions"><button type="button" class="btn" id="cx">Cancelar</button><button class="btn primary" id="bgo" disabled>Transferir</button></div>
  </form>`);
  const getSec = bindPick('bsec');
  $$('#bst button').forEach(b => b.onclick = () => { status = b.dataset.s; $$('#bst button').forEach(x => x.classList.toggle('on', x === b)); paint(); });
  $$('#bsec button').forEach(b => b.addEventListener('click', () => setTimeout(paint)));
  $('#bres').oninput = () => paint();
  const paint = () => {
    const list = [...items.values()];
    $('#blist').innerHTML = list.length ? list.map(a => `<div class="gi"><span style="color:var(--ink);flex:1;min-width:0"><b class="num">${esc(a.number)}</b> ${esc(a.description)}<div class="hint" style="margin:0">Hoje em ${esc(a.sector || 'nenhum setor')}${a.responsible ? `, com ${esc(a.responsible)}` : ''}</div></span><button type="button" class="btn sm" data-rm="${a.id}" aria-label="Tirar ${esc(a.number)} da lista">Tirar</button></div>`).join('')
      : '<div class="gi"><span>Nenhum bem na lista ainda.</span></div>';
    $$('#blist [data-rm]').forEach(b => b.onclick = () => { items.delete(Number(b.dataset.rm)); paint(); });
    const changes = getSec() || $('#bres').value.trim() || status;
    const n = list.length;
    $('#bgo').disabled = !n || !changes;
    $('#bgo').textContent = !n ? 'Transferir' : `Transferir ${plural(n, 'bem', 'bens')}`;
  };
  const msg = (kind, text) => { $('#bmsg').innerHTML = `<div class="result ${kind}">${text}</div>`; feedback(kind === 'ok' ? 'ok' : kind === 'warn' ? 'warn' : 'bad'); };
  let last = '', lastAt = 0;
  const add = async code => {
    code = String(code).trim(); if (!code) return;
    if (code === last && Date.now() - lastAt < 2500) return; last = code; lastAt = Date.now();
    $('#bcode').value = '';
    let r; try { r = await api('/assets/lookup?code=' + encodeURIComponent(code)); } catch (e) { msg('bad', esc(e.message)); return; }
    if (!r.asset) return msg('bad', `Código não cadastrado: ${esc(code)}`);
    if (items.has(r.asset.id)) return msg('warn', `${esc(r.asset.number)} já está na lista.`);
    items.set(r.asset.id, r.asset); paint();
    msg('ok', `Adicionado: ${esc(r.asset.number)}, ${esc(r.asset.description)}`);
    if (!scanStop) $('#bcode').focus();
  };
  $('#badd').onclick = () => add($('#bcode').value);
  $('#bcode').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add($('#bcode').value); } };
  const setMode = m => {
    pref.set('batchMode', m);
    $$('#bmode button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    if (m === 'camera') startScanner($('#barea'), add); else { stopScanner(); $('#barea').innerHTML = ''; }
  };
  $$('#bmode button').forEach(b => b.onclick = () => setMode(b.dataset.m));
  setMode(pref.get('batchMode') || 'type');
  $('#cx').onclick = closeModal;
  paint();
  $('#bf').onsubmit = async e => {
    e.preventDefault();
    const ids = [...items.keys()], sector = getSec(), responsible = $('#bres').value.trim();
    if (!ids.length) return;
    if (status === 'baixado' && !confirm(`Marcar ${plural(ids.length, 'bem', 'bens')} como baixado? Eles saem da contagem do patrimônio ativo.`)) return;
    $('#bgo').disabled = true; $('#bgo').textContent = 'Transferindo…';
    const body = { ids, note: $('#bnote').value };
    if (sector) body.sector = sector;
    if (responsible) body.responsible = responsible;
    if (status) body.status = status;
    try {
      const r = await api('/assets/batch', { method: 'POST', body });
      closeModal(); S.sel.clear(); S.selecting = false;
      feedback('ok');
      toast(`${plural(r.updated, 'bem transferido', 'bens transferidos')}${r.skipped ? `, ${r.skipped} já estava${r.skipped > 1 ? 'm' : ''} assim` : ''}.`, r.updated ? { label: 'Desfazer', fn: () => undoMoves(r.previous) } : null);
      if (S.view === 'assets') renderAssets(); else if (S.view === 'dash') renderDash();
    } catch (er) { $('#be').textContent = er.message; paint(); }
  };
}

// ---------- inventário sem internet: fila de leituras ----------
const queue = {
  get: () => { try { return JSON.parse(pref.get('invQueue') || '[]'); } catch { return []; } },
  set: q => pref.set('invQueue', JSON.stringify(q)),
};
let flushing = false;
async function flushQueue() {
  if (flushing || !navigator.onLine || !S.user) return;
  let q = queue.get(); if (!q.length) return;
  flushing = true; let sent = 0;
  for (const item of [...q]) {
    try { await api(`/inventories/${item.inv}/scan`, { method: 'POST', body: { code: item.code } }); sent++; q = q.filter(x => x !== item && !(x.inv === item.inv && x.code === item.code && x.at === item.at)); }
    catch (e) { if (e.offline) break; q = q.filter(x => !(x.inv === item.inv && x.code === item.code && x.at === item.at)); }
    queue.set(q);
  }
  flushing = false;
  if (sent) { toast(`${plural(sent, 'leitura guardada foi enviada', 'leituras guardadas foram enviadas')}.`); S.invRefill && S.invRefill(); }
}
function paintOnline() { $('#offline').hidden = navigator.onLine; if (navigator.onLine) flushQueue(); }
window.addEventListener('online', paintOnline);
window.addEventListener('offline', paintOnline);
setInterval(flushQueue, 30000);

// ---------- instalar como aplicativo ----------
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const installItem = () => standalone() ? '' : (installEvt || isIOS()) ? '<button id="instBtn" role="menuitem">Instalar no celular</button>' : '';
async function installApp() {
  if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice; if (r.outcome === 'accepted') toast('Aplicativo instalado.'); installEvt = null; return; }
  openModal(`<h2>Instalar no iPhone</h2><div class="group"><div class="gi"><b style="text-align:left">1. Toque no botão Compartilhar do Safari, o quadrado com a seta para cima.</b></div><div class="gi"><b style="text-align:left">2. Escolha "Adicionar à Tela de Início".</b></div><div class="gi"><b style="text-align:left">3. Toque em "Adicionar". O ícone do Patrimônio aparece junto com seus aplicativos.</b></div></div><div class="modal-actions"><button class="btn primary" id="cl">Entendi</button></div>`);
  $('#cl').onclick = closeModal;
}
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { /* sem suporte */ }));

// ---------- cadastro / edição ----------
async function openForm(a, pre = {}) {
  await Promise.all([loadLists(), loadResponsibles()]);
  const editing = !!a;
  let mode = editing ? 'manual' : (pre.mode || pref.get('entryMode') || 'gerar');
  if (!MODES[mode]) mode = 'gerar';
  const v = k => esc(a ? a[k] : (pre[k] || ''));
  const cat = a ? a.category : (pre.category ?? pref.get('lastCat') ?? '');
  const sec = a ? a.sector : (pre.sector ?? pref.get('lastSec') ?? '');
  openModal(`<h2>${editing ? 'Editar bem' : 'Novo bem'}</h2>
  <form id="af" autocomplete="off">
    ${editing ? '' : `<span class="lbl">O bem já tem etiqueta?</span><div class="seg big" id="seg" style="margin-bottom:14px">${Object.entries(MODES).map(([k, [l, s]]) => `<button type="button" data-m="${k}">${l}<small>${s}</small></button>`).join('')}</div>`}
    <div id="genInfo" class="notice info" hidden>O sistema cria o número e o código de barras. Depois é só imprimir a etiqueta e colar no bem.</div>
    <div id="scanArea"></div>
    <div class="grid2" id="codeFields">
      <div class="field"><label for="fb">Código de barras</label><input id="fb" class="mono" value="${v('barcode')}" maxlength="80" autocapitalize="none" enterkeyhint="next"><div class="hint" id="bh"></div></div>
      <div class="field"><label for="fn">Número do patrimônio</label><input id="fn" class="mono" value="${v('number')}" maxlength="40" autocapitalize="characters" enterkeyhint="next"></div>
    </div>
    <div class="field"><label for="fd">Descrição</label><input id="fd" value="${v('description')}" required maxlength="200" placeholder="Ex.: Notebook Dell Latitude 5440"></div>
    <div class="field"><span class="lbl">Categoria</span>${pickHTML('pcat', names(S.lists.categories), cat, 'Nenhuma categoria cadastrada.')}</div>
    <div class="field"><span class="lbl">Setor</span>${pickHTML('psec', names(S.lists.sectors), sec, 'Nenhum setor cadastrado.')}${manageLink()}</div>
    <div class="grid2">
      <div class="field"><label for="fr">Responsável</label><input id="fr" list="dres" value="${v('responsible')}" maxlength="80" placeholder="Quem usa ou guarda o bem"><datalist id="dres">${(S.opts.responsibles || []).map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="field"><label for="fst2">Situação</label><select id="fst2">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}"${(a ? a.status : 'ativo') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="fph">Foto (opcional)</label>
      <div class="phrow"><img id="phprev" class="detph sm" alt="" ${a && a.photo ? `src="${photoURL(a)}"` : 'hidden'}>
      <div><input id="fph" type="file" accept="image/*"><div class="hint">No celular, abre a câmera ou a galeria.</div>
      ${a && a.photo ? '<label class="inl" style="margin-top:8px;font-size:15px"><input type="checkbox" class="check" id="rmph"> Remover foto atual</label>' : ''}</div></div></div>
    <div class="field"><label for="fo">Observações (opcional)</label><textarea id="fo" rows="2" maxlength="500">${v('notes')}</textarea></div>
    ${editing ? '<div class="field"><label for="fnote">Motivo da alteração (opcional)</label><input id="fnote" maxlength="300"><div class="hint">Mudanças de setor, responsável ou situação vão para o histórico.</div></div>' : '<p class="hint" style="margin:-4px 0 14px">A data de cadastro é registrada automaticamente.</p>'}
    <p class="err" id="fe"></p>
    <div class="modal-actions"><button type="button" class="btn" id="cx">Cancelar</button><button class="btn primary" id="sv">Salvar</button></div>
  </form>`);
  $('#cx').onclick = () => editing ? openDetail(a.id) : closeModal();
  if ($('#goLists')) $('#goLists').onclick = () => { closeModal(); S.adminTab = 'lists'; go('admin'); };
  const getCat = bindPick('pcat'), getSec = bindPick('psec');
  const bar = $('#fb');
  async function checkDup() {
    const c = bar.value.trim(); if (!c) return;
    try {
      const r = await api('/assets/lookup?code=' + encodeURIComponent(c));
      $('#bh').innerHTML = r.asset && (!a || r.asset.id !== a.id) ? `<span style="color:var(--bad);font-weight:650">Já cadastrado: ${esc(r.asset.number)}, ${esc(r.asset.description)}</span>` : '';
    } catch { /* ignora */ }
  }
  function setMode(m) {
    mode = m;
    stopScanner(); $('#scanArea').innerHTML = '';
    $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    const gen = m === 'gerar';
    $('#codeFields').hidden = gen; $('#genInfo').hidden = !gen;
    $('#sv').textContent = gen ? 'Gerar etiqueta' : 'Salvar bem';
    $('#sv').className = gen ? 'btn tagbtn' : 'btn primary';
    const hint = $('#bh');
    if (m === 'leitor') { hint.textContent = 'Aponte o leitor para a etiqueta. O código entra sozinho.'; bar.focus(); }
    else if (m === 'camera') { hint.textContent = ''; startScanner($('#scanArea'), async code => { feedback('ok'); bar.value = code; stopScanner(); $('#scanArea').innerHTML = ''; toast('Código lido: ' + code); await checkDup(); $('#fn').focus(); }); }
    else if (m === 'manual') hint.textContent = 'Digite o número que aparece abaixo das barras.';
    else hint.textContent = '';
  }
  bar.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); checkDup(); $('#fn').focus(); } };
  bar.onblur = checkDup;
  $$('#seg button').forEach(b => b.onclick = () => { pref.set('entryMode', b.dataset.m); setMode(b.dataset.m); });
  let photoBlob = null;
  $('#fph').onchange = async e => {
    const f = e.target.files[0]; photoBlob = null; if (!f) return;
    try { photoBlob = await shrink(f); const pv = $('#phprev'); pv.src = URL.createObjectURL(photoBlob); pv.hidden = false; }
    catch { $('#fe').textContent = 'Não foi possível ler essa imagem.'; e.target.value = ''; }
  };
  if (editing) $('#sv').textContent = 'Salvar alterações'; else { setMode(mode); if (pre.barcode) { checkDup(); $('#fn').focus(); } }

  $('#af').onsubmit = async e => {
    e.preventDefault();
    const gen = !editing && mode === 'gerar';
    if (!gen && (!bar.value.trim() || !$('#fn').value.trim())) { $('#fe').textContent = 'Informe o código de barras e o número do patrimônio, ou escolha "Gerar etiqueta".'; return; }
    const label = $('#sv').textContent; $('#sv').disabled = true; $('#sv').textContent = gen ? 'Gerando…' : 'Salvando…';
    const body = { barcode: bar.value, number: $('#fn').value, description: $('#fd').value, category: getCat(), sector: getSec(), responsible: $('#fr').value.trim(), status: $('#fst2').value, notes: $('#fo').value, entry_mode: mode, note: $('#fnote')?.value || '' };
    if (a) { body.value = a.value; body.acquired_at = a.acquired_at; }
    if (gen) body.generate = true;
    try {
      const saved = editing ? await api('/assets/' + a.id, { method: 'PUT', body }) : await api('/assets', { method: 'POST', body });
      const asset = saved.asset;
      try {
        if (photoBlob) await uploadPhoto(asset.id, photoBlob);
        else if (editing && $('#rmph')?.checked) await api(`/assets/${asset.id}/photo`, { method: 'DELETE' });
      } catch (pe) { toast('Salvo, mas a foto falhou: ' + pe.message); }
      if (!editing) { pref.set('lastCat', body.category); pref.set('lastSec', body.sector); }
      S.opts.responsibles = [];
      vibrate(30);
      if (editing) { toast('Alterações salvas.'); openDetail(asset.id); }
      else if (gen) { refreshPending(); openGenerated(asset); }
      else { closeModal(); toast('Bem salvo.'); if (mode === 'leitor' || mode === 'camera') setTimeout(() => openForm(null, { mode }), 350); }
      if (S.view === 'assets') refresh(); else if (S.view === 'dash') renderDash(); else if (S.view === 'labels') renderLabels();
    } catch (er) { $('#fe').textContent = er.message; $('#sv').disabled = false; $('#sv').textContent = label; }
  };
}

// plaqueta (tela)
const tagHTML = (a, extra = '') => `<div class="top"><span>Patrimônio</span><span>${esc(a.sector || 'Sem setor')}</span></div><div class="bc">${barcodeSVG(a.barcode).replace('<svg ', '<svg style="width:100%;height:100%" ')}</div><div class="no">${esc(a.number)}</div><div class="ds">${esc(a.description)}</div>${extra}`;
function openGenerated(a) {
  openModal(`<h2>Etiqueta gerada</h2><p class="sub" style="margin:-6px 0 16px">O bem já está no sistema. A etiqueta fica na fila até ser impressa.</p>
  <div class="tag preview">${tagHTML(a)}</div>
  <div class="modal-actions"><button class="btn" id="gAnother">${IC.plus}Gerar outra</button><button class="btn" id="gList">Ver etiquetas</button><button class="btn tagbtn" id="gPrint">${IC.printer}Imprimir agora</button></div>`);
  $('#gAnother').onclick = () => openForm(null, { mode: 'gerar', category: a.category, sector: a.sector });
  $('#gList').onclick = () => { closeModal(); S.labelTab = 'pendente'; go('labels'); };
  $('#gPrint').onclick = () => printAndMark([a], () => { closeModal(); toast('Etiqueta impressa.'); if (S.view === 'labels') renderLabels(); });
}

// ---------- etiquetas geradas ----------
async function renderLabels() {
  const tab = S.labelTab;
  $('#app').innerHTML = head('Etiquetas geradas', 'Imprima as etiquetas e cole nos bens.', canEdit() ? `<button class="btn tagbtn" id="lNew">${IC.plus}Gerar etiqueta</button>` : '') + `
  <div class="row" style="margin-bottom:12px">
    <div class="seg" id="ltab" style="min-width:260px"><button data-t="pendente">A imprimir</button><button data-t="impressa">Impressas</button></div><div class="spacer"></div>
    <select id="lfmt" aria-label="Formato da impressão" style="width:auto;min-width:240px"><option value="a4">Folha A4, 3 colunas</option><option value="termica">Etiqueta térmica 50 × 30 mm</option></select>
  </div>
  <div class="actbar" id="lbar"></div><div id="lw"></div>`;
  $$('#ltab button').forEach(b => { b.classList.toggle('on', b.dataset.t === tab); b.onclick = () => { S.labelTab = b.dataset.t; renderLabels(); }; });
  $('#lfmt').value = pref.get('labelFormat') || 'a4'; $('#lfmt').onchange = e => pref.set('labelFormat', e.target.value);
  if ($('#lNew')) $('#lNew').onclick = () => openForm(null, { mode: 'gerar' });
  let list; try { list = (await api('/labels?status=' + tab)).labels; } catch (e) { return toast(e.message); }
  if (tab === 'pendente') { S.pending = list.length; paintPending(); }
  const chosen = new Set(tab === 'pendente' ? list.map(a => a.id) : []);
  const sel = () => list.filter(a => chosen.has(a.id));
  const bar = () => {
    const n = chosen.size;
    if (!list.length) { $('#lbar').innerHTML = ''; return; }
    $('#lbar').innerHTML = `<span class="count">${plural(list.length, 'etiqueta', 'etiquetas')}${n ? `, ${plural(n, 'selecionada', 'selecionadas')}` : ''}</span><div class="spacer"></div>
      <button class="btn sm" id="lAll">${n === list.length ? 'Limpar seleção' : 'Selecionar todas'}</button>
      ${tab === 'impressa' && canEdit() ? `<button class="btn sm" id="lBack" ${n ? '' : 'disabled'}>Voltar para a fila</button>` : ''}
      ${canEdit() ? `<button class="btn sm ${tab === 'pendente' ? 'tagbtn' : 'primary'}" id="lPrint" ${n ? '' : 'disabled'}>${IC.printer}${tab === 'pendente' ? 'Imprimir' : 'Reimprimir'}${n ? ` (${n})` : ''}</button>` : ''}`;
    $('#lAll').onclick = () => { if (chosen.size === list.length) chosen.clear(); else list.forEach(a => chosen.add(a.id)); paint(); };
    if ($('#lPrint')) $('#lPrint').onclick = () => printAndMark(sel(), () => { toast(tab === 'pendente' ? 'Etiquetas marcadas como impressas.' : 'Etiquetas reimpressas.'); renderLabels(); });
    if ($('#lBack')) $('#lBack').onclick = async () => { try { await api('/labels/mark', { method: 'POST', body: { ids: [...chosen], status: 'pendente' } }); toast('Etiquetas voltaram para a fila.'); refreshPending(); renderLabels(); } catch (e) { toast(e.message); } };
  };
  const paint = () => {
    $('#lw').innerHTML = list.length ? `<div class="tags">${list.map(a => `<div class="tag ${chosen.has(a.id) ? 'chosen' : ''}" role="checkbox" tabindex="0" aria-checked="${chosen.has(a.id)}" data-id="${a.id}">${tagHTML(a, `<div class="ds" style="font-size:13px;margin-top:-6px">${tab === 'impressa' ? `Impressa em ${fmtDate(a.label_printed_at)}` : `Gerada em ${fmtDate(a.created_at)}`}</div>`)}</div>`).join('')}</div><p class="hint" style="margin-top:12px">Toque numa etiqueta para marcar ou desmarcar. Toque duas vezes para abrir o bem.</p>`
      : `<div class="card empty"><b>${tab === 'pendente' ? 'Nenhuma etiqueta para imprimir' : 'Nenhuma etiqueta impressa ainda'}</b>${tab === 'pendente' ? 'Use "Gerar etiqueta" para cadastrar um bem que ainda não tem código.' : 'As etiquetas impressas ficam aqui para reimprimir quando precisar.'}${tab === 'pendente' && canEdit() ? `<br><button class="btn tagbtn" id="lNew2">${IC.plus}Gerar etiqueta</button>` : ''}</div>`;
    if ($('#lNew2')) $('#lNew2').onclick = () => openForm(null, { mode: 'gerar' });
    $$('#lw .tag').forEach(el => {
      const toggle = () => { const id = Number(el.dataset.id); chosen.has(id) ? chosen.delete(id) : chosen.add(id); paint(); };
      el.onclick = toggle; el.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } };
      el.ondblclick = () => openDetail(Number(el.dataset.id));
    });
    bar();
  };
  paint();
}

// ---------- painel ----------
async function renderDash() {
  $('#app').innerHTML = head('Painel', `Olá, ${esc(S.user.name.split(' ')[0])}. Veja como está o patrimônio hoje.`) + '<div id="dw" class="empty">Carregando…</div>';
  let d; try { d = await api('/dashboard'); } catch (e) { return toast(e.message); }
  S.pending = d.pendingLabels; paintPending();
  const st = k => d.byStatus.find(x => x.k === k)?.n || 0;
  const tot = d.total || 0, a1 = st('ativo'), a2 = st('manutencao'), a3 = st('baixado');
  const pct = n => tot ? (n / tot * 100).toFixed(2) : 0;
  const bars = rows => { const max = Math.max(1, ...rows.map(r => r.n)); return rows.length ? rows.map(r => `<div class="bar"><span class="bl">${esc(r.k)}</span><span class="bt"><i style="width:${Math.round(r.n / max * 100)}%"></i></span><b>${r.n}</b></div>`).join('') : '<div class="hint">Sem dados ainda.</div>'; };
  const attnCount = d.maintenance.length + (d.noResponsible ? 1 : 0) + (d.noPhoto ? 1 : 0);
  $('#dw').className = ''; $('#dw').innerHTML = `
  <div class="kpis">
    <button class="kpi" data-go="all"><div class="lb"><i class="i-pri">${IC.assets}</i>Total de bens</div><b>${tot}</b></button>
    <button class="kpi" data-go="manutencao"><div class="lb"><i class="i-warn">${IC.wrench}</i>Em manutenção</div><b>${a2}</b></button>
    <button class="kpi" data-go="baixado"><div class="lb"><i class="i-bad">${IC.archive}</i>Baixados</div><b>${a3}</b></button>
    <button class="kpi amber" data-labels><div class="lb"><i class="i-ink">${IC.labels}</i>Etiquetas a imprimir</div><b>${d.pendingLabels}</b></button>
  </div>
  <div class="cols">
    <div class="card"><h2>Precisa de atenção</h2>
      <div class="attn">
        ${d.maintenance.map(m => `<button class="ai" data-id="${m.id}"><span class="t"><b>${esc(m.description)}</b><span>Em manutenção, ${esc(m.sector || 'sem setor')}</span></span><em>${days(daysSince(m.since))}</em>${CHEV}</button>`).join('')}
        ${d.noResponsible ? `<button class="ai" data-flag="sem_responsavel"><span class="t"><b>${plural(d.noResponsible, 'bem sem responsável', 'bens sem responsável')}</b><span>Defina quem responde por eles</span></span>${CHEV}</button>` : ''}
        ${d.noPhoto ? `<button class="ai" data-flag="sem_foto"><span class="t"><b>${plural(d.noPhoto, 'bem sem foto', 'bens sem foto')}</b><span>Fotos ajudam a reconhecer o bem no inventário</span></span>${CHEV}</button>` : ''}
        ${attnCount ? '' : '<div class="hint" style="padding:8px 0">Tudo em ordem por aqui.</div>'}
      </div></div>
    <div class="card"><h2>Situação dos bens</h2>
      <div class="stack" role="img" aria-label="${a1} ativos, ${a2} em manutenção, ${a3} baixados"><i style="width:${pct(a1)}%;background:var(--ok)"></i><i style="width:${pct(a2)}%;background:var(--warn)"></i><i style="width:${pct(a3)}%;background:var(--bad)"></i></div>
      <div class="legend"><span><i style="background:var(--ok)"></i>Ativos <b>${a1}</b></span><span><i style="background:var(--warn)"></i>Manutenção <b>${a2}</b></span><span><i style="background:var(--bad)"></i>Baixados <b>${a3}</b></span></div>
      <h3 style="margin-top:20px">Por categoria</h3>${bars(d.byCategory)}</div>
  </div>
  <div class="cols">
    <div class="card"><h2>Bens por setor</h2>${bars(d.bySector)}</div>
    <div class="card"><h2>Últimas movimentações</h2>${d.recent.length ? `<ul class="hist">${d.recent.map(m => `<li><span class="badge b-${esc(m.type)}">${esc(MTYPE[m.type] || m.type)}</span> <b>${esc(m.description)}</b><small>${esc(m.detail)}<br>${fmtDate(m.created_at)}, por ${esc(m.user_name)}</small></li>`).join('')}</ul>` : '<div class="hint">Nenhuma movimentação ainda.</div>'}</div>
  </div>`;
  $$('#dw [data-go]').forEach(b => b.onclick = () => go('assets', { status: b.dataset.go === 'all' ? '' : b.dataset.go }));
  $$('#dw [data-flag]').forEach(b => b.onclick = () => go('assets', { flag: b.dataset.flag }));
  $$('#dw .ai[data-id]').forEach(b => b.onclick = () => openDetail(Number(b.dataset.id)));
  $('#dw [data-labels]').onclick = () => { S.labelTab = 'pendente'; go('labels'); };
}

// ---------- inventário ----------
async function renderInv() {
  $('#app').innerHTML = head('Inventário', 'Leia os códigos de um setor e veja na hora o que está faltando.', canEdit() ? `<button class="btn primary" id="ni">${IC.plus}Novo inventário</button>` : '') + '<div class="tablewrap" id="iw"></div>';
  if (canEdit()) $('#ni').onclick = async () => {
    await loadLists();
    openModal(`<h2>Novo inventário</h2><form id="nf"><div class="field"><span class="lbl">Qual setor você vai conferir?</span>${pickHTML('isec', ['Todos os setores', ...names(S.lists.sectors)], 'Todos os setores', '')}</div>
    <div class="modal-actions"><button type="button" class="btn" id="cx">Cancelar</button><button class="btn primary">Começar conferência</button></div></form>`);
    const getSec = bindPick('isec', false);
    $('#cx').onclick = closeModal;
    $('#nf').onsubmit = async e => { e.preventDefault(); const s = getSec(); try { const r = await api('/inventories', { method: 'POST', body: { sector: s === 'Todos os setores' ? '' : s } }); openInv(r.id); renderInv(); } catch (er) { toast(er.message); } };
  };
  let list; try { list = (await api('/inventories')).inventories; } catch (e) { return toast(e.message); }
  $('#iw').innerHTML = list.length ? `<table><thead><tr><th>Setor</th><th>Início</th><th>Lidos</th><th>Situação</th></tr></thead><tbody>${list.map(i => `<tr class="click" data-id="${i.id}"><td><b>${esc(i.sector) || 'Todos os setores'}</b><div class="hint">Conferência nº ${i.id}</div></td><td>${fmtDate(i.created_at)}<div class="hint">${esc(i.created_by)}</div></td><td class="num">${i.found}</td><td>${i.closed_at ? '<span class="badge b-edicao">Encerrado</span>' : '<span class="badge b-ativo">Em andamento</span>'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty"><b>Nenhum inventário ainda</b>Comece uma conferência por setor.</div>';
  $$('#iw tr.click').forEach(tr => tr.onclick = () => openInv(Number(tr.dataset.id)));
}
async function openInv(id) {
  let data; try { data = await api('/inventories/' + id); } catch (e) { return toast(e.message); }
  const inv = data.inventory, closed = !!inv.closed_at, can = canEdit() && !closed;
  openModal(`<h2>Inventário de ${esc(inv.sector) || 'todos os setores'}</h2>
  <div class="stats" id="ist"></div>
  ${can ? `<div class="seg" id="imode" style="margin-bottom:12px"><button data-m="type">Leitor ou digitação</button><button data-m="camera">Câmera</button></div>
    <div id="iarea"></div>
    <form id="iform" autocomplete="off"><div class="field"><label for="sc">Código lido</label><input id="sc" class="mono" enterkeyhint="go" placeholder="Leia com o leitor ou digite e confirme"></div></form>
    <div id="sr" role="status" aria-live="polite"></div>` : `<p class="hint">${closed ? `Encerrado em ${fmtDate(inv.closed_at)}.` : 'Seu perfil é somente consulta.'}</p>`}
  <div class="tablewrap" style="max-height:min(420px,46vh)"><table><tbody id="il"></tbody></table></div>
  <div class="modal-actions"><button class="btn" id="px">Imprimir faltantes</button><div class="spacer"></div><button class="btn" id="cl">Fechar</button>${can ? '<button class="btn primary" id="en">Encerrar</button>' : ''}</div>`);
  let missing = [];
  const fill = d => {
    const found = d.expected.filter(a => a.found_at); missing = d.expected.filter(a => !a.found_at);
    $('#ist').innerHTML = `<div class="stat"><small>Esperados</small><b>${d.expected.length}</b></div><div class="stat"><small>Encontrados</small><b style="color:var(--ok)">${found.length}</b></div><div class="stat"><small>Faltando</small><b style="color:var(--bad)">${missing.length}</b></div>`;
    const rows = (arr, b) => arr.map(a => `<tr><td style="white-space:nowrap"><span class="num">${esc(a.number)}</span></td><td>${esc(a.description)}<div class="hint">${esc(a.sector)}</div></td><td style="text-align:right">${b}</td></tr>`).join('');
    $('#il').innerHTML = rows(missing, '<span class="badge b-baixa">Faltando</span>') + rows(found, '<span class="badge b-ativo">Encontrado</span>') + rows(d.extra, '<span class="badge b-manutencao">Fora do setor</span>');
    $('#px').disabled = !missing.length;
  };
  fill(data);
  $('#cl').onclick = () => { S.invRefill = null; closeModal(); renderInv(); };
  $('#px').onclick = () => printReport(missing, `Itens faltantes em ${inv.sector || 'todos os setores'}`);
  if ($('#en')) $('#en').onclick = async () => { if (confirm(`Encerrar o inventário? ${plural(missing.length, 'item ficará registrado', 'itens ficarão registrados')} como faltante.`)) { try { await api(`/inventories/${id}/close`, { method: 'POST' }); openInv(id); } catch (e) { toast(e.message); } } };
  if (!can) return;
  const sc = $('#sc');
  S.invRefill = async () => { if ($('#il')) { try { fill(await api('/inventories/' + id)); } catch { /* ignora */ } } };
  const pendingHere = () => queue.get().filter(x => x.inv === id).length;
  let last = '', lastAt = 0;
  const scan = async code => {
    code = String(code).trim(); if (!code) return;
    if (code === last && Date.now() - lastAt < 2500) return;
    last = code; lastAt = Date.now();
    try {
      const r = await api(`/inventories/${id}/scan`, { method: 'POST', body: { code } });
      const m = { ok: ['ok', 'Encontrado'], outside: ['warn', 'Encontrado, mas é de outro setor ou está baixado'], duplicate: ['warn', 'Já tinha sido lido'], unknown: ['bad', 'Código não cadastrado'] }[r.result];
      $('#sr').innerHTML = `<div class="result ${m[0]}">${m[1]}: ${r.asset ? `${esc(r.asset.number)}, ${esc(r.asset.description)}` : esc(code)}</div>`;
      feedback(m[0]);
      if (r.result === 'ok' || r.result === 'outside') fill(await api('/inventories/' + id));
    } catch (er) {
      if (er.offline) {
        queue.set([...queue.get(), { inv: id, code, at: Date.now() }]);
        $('#sr').innerHTML = `<div class="result warn">Sem internet. Leitura de ${esc(code)} guardada; ${plural(pendingHere(), 'leitura será enviada', 'leituras serão enviadas')} quando a conexão voltar.</div>`;
        feedback('warn');
      } else toast(er.message);
    }
    sc.value = ''; if (!scanStop) sc.focus();
  };
  const setMode = m => {
    pref.set('invMode', m);
    $$('#imode button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    if (m === 'camera') startScanner($('#iarea'), scan); else { stopScanner(); $('#iarea').innerHTML = ''; sc.focus(); }
  };
  $$('#imode button').forEach(b => b.onclick = () => setMode(b.dataset.m));
  $('#iform').onsubmit = e => { e.preventDefault(); scan(sc.value); };
  setMode(pref.get('invMode') || 'type');
}

// ---------- histórico ----------
async function renderMovements() {
  $('#app').innerHTML = head('Histórico', 'Cadastros, transferências, baixas e edições.') + `
  <div class="toolbar"><div class="search">${IC.search}<input id="mq" type="search" placeholder="Buscar por número ou descrição" aria-label="Buscar no histórico"></div><span></span></div>
  <div class="chips" id="mchips">${[['', 'Todos'], ...Object.entries(MTYPE)].map(([k, l]) => `<button class="chip ${k === '' ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>
  <div class="tablewrap" id="mw"></div>`;
  let t, type = '';
  const load = async () => {
    const p = new URLSearchParams({ q: $('#mq').value, type });
    try {
      const { movements } = await api('/movements?' + p);
      $('#mw').innerHTML = movements.length ? `<table><thead><tr><th>Data</th><th>Bem</th><th>Movimentação</th><th class="hide-m">Usuário</th></tr></thead><tbody>
      ${movements.map(m => `<tr class="click" data-id="${m.asset_id}"><td style="white-space:nowrap">${fmtDate(m.created_at)}</td>
      <td><b>${esc(m.description)}</b><div class="hint num">${esc(m.number)}</div></td><td><span class="badge b-${esc(m.type)}">${esc(MTYPE[m.type] || m.type)}</span><div style="margin-top:4px">${esc(m.detail)}</div>${m.note ? `<div class="hint">“${esc(m.note)}”</div>` : ''}</td><td class="hide-m">${esc(m.user_name)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty"><b>Nada encontrado</b>Tente outra busca.</div>';
      $$('#mw tr.click').forEach(tr => tr.onclick = () => openDetail(Number(tr.dataset.id)));
    } catch (e) { toast(e.message); }
  };
  $('#mq').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  $$('#mchips .chip').forEach(b => b.onclick = () => { type = b.dataset.t; $$('#mchips .chip').forEach(x => x.classList.toggle('on', x === b)); load(); });
  load();
}

// ---------- administração ----------
function renderAdmin() {
  if (!isAdmin()) return go('dash');
  const tabs = [['users', 'Usuários'], ['lists', 'Categorias e setores'], ['audit', 'Auditoria']];
  $('#app').innerHTML = head('Administração', 'Usuários, listas de cadastro e registro de acessos.', '<a class="btn" href="/api/backup" download>Baixar backup</a>') +
    `<div class="seg" id="atab" style="margin-bottom:16px;max-width:560px">${tabs.map(([k, l]) => `<button data-t="${k}" class="${S.adminTab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="ab"></div>`;
  $$('#atab button').forEach(b => b.onclick = () => { S.adminTab = b.dataset.t; renderAdmin(); });
  ({ users: renderUsers, lists: renderLists, audit: renderAudit }[S.adminTab] || renderUsers)($('#ab'));
}
async function renderLists(el) {
  const l = await loadLists(true);
  const block = (kind, title, items, ph) => `<div class="card"><h2>${title}</h2>
    <form class="addrow" data-kind="${kind}"><input placeholder="${ph}" maxlength="80" aria-label="Novo item em ${title}"><button class="btn primary">${IC.plus}Adicionar</button></form>
    ${items.length ? items.map(i => `<div class="litem"><b>${esc(i.name)}</b><span>${plural(i.uses, 'bem', 'bens')}</span><button class="btn sm" data-ren="${i.id}" data-name="${esc(i.name)}">Renomear</button><button class="btn sm danger" data-del="${i.id}" data-name="${esc(i.name)}" data-uses="${i.uses}" aria-label="Remover ${esc(i.name)}">${IC.trash}</button></div>`).join('') : '<p class="hint">Nada cadastrado ainda.</p>'}</div>`;
  el.innerHTML = `<p class="sub" style="margin:0 0 14px">Tudo o que estiver aqui aparece como opção de toque no cadastro, na transferência e no inventário.</p><div class="lists">${block('category', 'Categorias', l.categories, 'Ex.: Informática')}${block('sector', 'Setores', l.sectors, 'Ex.: Financeiro')}</div>`;
  $$('.addrow', el).forEach(f => f.onsubmit = async e => {
    e.preventDefault(); const name = $('input', f).value.trim(); if (!name) return;
    try { await api('/lists', { method: 'POST', body: { kind: f.dataset.kind, name } }); toast(`${name} adicionado.`); renderLists(el); } catch (er) { toast(er.message); }
  });
  $$('[data-ren]', el).forEach(b => b.onclick = async () => {
    const name = prompt('Novo nome:', b.dataset.name); if (!name || name.trim() === b.dataset.name) return;
    try { const r = await api('/lists/' + b.dataset.ren, { method: 'PUT', body: { name: name.trim() } }); toast(`Renomeado. ${plural(r.updated, 'bem atualizado', 'bens atualizados')}.`); renderLists(el); } catch (er) { toast(er.message); }
  });
  $$('[data-del]', el).forEach(b => b.onclick = async () => {
    const uses = Number(b.dataset.uses);
    if (!confirm(`Remover ${b.dataset.name} da lista?${uses ? ` Os ${uses} bens que já usam esse nome continuam com ele.` : ''}`)) return;
    try { await api('/lists/' + b.dataset.del, { method: 'DELETE' }); toast('Removido da lista.'); renderLists(el); } catch (er) { toast(er.message); }
  });
}
async function renderUsers(el) {
  el.innerHTML = `<div class="actbar"><div class="spacer"></div><button class="btn primary" id="nu">${IC.plus}Novo usuário</button></div><div class="tablewrap" id="uw"></div>`;
  $('#nu').onclick = () => openUserForm();
  let users; try { users = (await api('/users')).users; } catch (e) { return toast(e.message); }
  $('#uw').innerHTML = `<table><thead><tr><th>Nome</th><th>Perfil</th><th></th></tr></thead><tbody>
  ${users.map(u => `<tr><td><b>${esc(u.name)}</b><div class="hint">login ${esc(u.username)}</div></td><td>${ROLES[u.role] || esc(u.role)}</td><td style="text-align:right"><button class="btn sm" data-id="${u.id}">Editar</button></td></tr>`).join('')}</tbody></table>`;
  $$('#uw button').forEach(b => b.onclick = () => openUserForm(users.find(u => u.id === Number(b.dataset.id))));
}
function openUserForm(u) {
  const ed = !!u;
  openModal(`<h2>${ed ? 'Editar usuário' : 'Novo usuário'}</h2><form id="uf" autocomplete="off">
  <div class="field"><label for="un">Nome</label><input id="un" value="${esc(u?.name)}" required></div>
  <div class="field"><label for="ul">Usuário (login)</label><input id="ul" value="${esc(u?.username)}" autocapitalize="none" ${ed ? 'disabled' : 'required'}></div>
  <div class="field"><label for="ur">Perfil</label><select id="ur"><option value="viewer"${u?.role === 'viewer' ? ' selected' : ''}>Consulta: só visualiza</option><option value="user"${!u || u.role === 'user' ? ' selected' : ''}>Usuário: cadastra, gera etiquetas e movimenta</option><option value="admin"${u?.role === 'admin' ? ' selected' : ''}>Administrador: acesso total</option></select></div>
  <div class="field"><label for="up">${ed ? 'Nova senha (deixe vazio para manter)' : 'Senha provisória'}</label><input id="up" type="password" autocomplete="new-password" ${ed ? '' : 'required'} minlength="8"><div class="hint">Mínimo de 8 caracteres, com letras e números. A pessoa troca no primeiro acesso.</div></div>
  <p class="err" id="ue"></p>
  <div class="modal-actions">${ed ? `<button type="button" class="btn danger" id="ud">${IC.trash}Excluir</button><div class="spacer"></div>` : ''}<button type="button" class="btn" id="cx">Cancelar</button><button class="btn primary">Salvar usuário</button></div></form>`);
  $('#cx').onclick = closeModal;
  const back = () => { closeModal(); S.adminTab = 'users'; renderAdmin(); };
  if (ed) $('#ud').onclick = async () => {
    if (!confirm('Excluir o usuário ' + u.username + '?')) return;
    try { await api('/users/' + u.id, { method: 'DELETE' }); back(); } catch (e) { $('#ue').textContent = e.message; }
  };
  $('#uf').onsubmit = async e => {
    e.preventDefault();
    try {
      if (ed) await api('/users/' + u.id, { method: 'PUT', body: { name: $('#un').value, role: $('#ur').value, password: $('#up').value || undefined } });
      else await api('/users', { method: 'POST', body: { name: $('#un').value, username: $('#ul').value, role: $('#ur').value, password: $('#up').value } });
      toast('Usuário salvo.'); back();
    } catch (er) { $('#ue').textContent = er.message; }
  };
}
const ACT = { login: 'Login', login_falha: 'Login recusado', senha_alterada: 'Senha alterada', senha_redefinida: 'Senha redefinida', bem_excluido: 'Bem excluído', usuario_criado: 'Usuário criado', usuario_excluido: 'Usuário excluído', perfil_alterado: 'Perfil alterado', backup: 'Backup', importacao: 'Importação', lista_criada: 'Item de lista criado', lista_renomeada: 'Item de lista renomeado', lista_removida: 'Item de lista removido' };
async function renderAudit(el) {
  el.innerHTML = '<p class="sub" style="margin:0 0 14px">Últimos 300 registros de acesso e ações sensíveis.</p><div class="tablewrap" id="aw"></div>';
  let list; try { list = (await api('/audit')).audit; } catch (e) { return toast(e.message); }
  const bad = ['login_falha', 'bem_excluido', 'usuario_excluido'];
  $('#aw').innerHTML = list.length ? `<table><thead><tr><th>Data</th><th>Ação</th><th>Detalhe</th><th class="hide-m">IP</th></tr></thead><tbody>${list.map(a => `<tr><td style="white-space:nowrap">${fmtDate(a.created_at)}<div class="hint">${esc(a.user_name)}</div></td><td><span class="badge ${bad.includes(a.action) ? 'b-baixa' : 'b-edicao'}">${esc(ACT[a.action] || a.action)}</span></td><td>${esc(a.detail)}</td><td class="mono hide-m">${esc(a.ip)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty"><b>Sem registros</b></div>';
}

// ---------- importação de planilha (CSV) ----------
function parseCSV(text) {
  text = text.replace(/^\ufeff/, '');
  const first = text.split('\n')[0];
  const delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}
const norm = h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const HEAD = { numero: 'number', nbarras: 'barcode', numerodebarras: 'barcode', codigodebarras: 'barcode', barras: 'barcode', codigo: 'barcode', descricao: 'description', categoria: 'category', setor: 'sector', setorlocal: 'sector', local: 'sector', responsavel: 'responsible', situacao: 'status', observacoes: 'notes', observacao: 'notes' };
function openImport() {
  openModal(`<h2>Importar planilha</h2><p class="sub" style="margin:-6px 0 14px">Envie um arquivo CSV (no Excel: Salvar como, CSV UTF-8). A primeira linha deve ter os títulos das colunas: Número, Nº de barras, Descrição, Categoria, Setor, Responsável, Situação e Observações. Número, nº de barras e descrição são obrigatórios. Categorias e setores novos entram nas listas automaticamente.</p>
  <div class="field"><input type="file" id="cf" accept=".csv,text/csv" aria-label="Arquivo CSV"></div><p class="err" id="ie"></p><div id="ir"></div>
  <div class="modal-actions"><button class="btn" id="cx">Fechar</button><button class="btn primary" id="go" disabled>Importar</button></div>`);
  $('#cx').onclick = closeModal;
  let rows = [];
  $('#cf').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const data = parseCSV(await f.text());
    if (data.length < 2) { $('#ie').textContent = 'Arquivo vazio ou sem dados.'; return; }
    const keys = data[0].map(h => HEAD[norm(h)] || null);
    if (!keys.includes('number') || !keys.includes('barcode') || !keys.includes('description')) { $('#ie').textContent = 'Cabeçalho não reconhecido: faltam as colunas Número, Nº de barras ou Descrição.'; return; }
    const stMap = { ativo: 'ativo', manutencao: 'manutencao', emmanutencao: 'manutencao', baixado: 'baixado' };
    rows = data.slice(1).map(r => { const o = {}; keys.forEach((k, i) => { if (k) o[k] = (r[i] || '').trim(); }); if (o.status) o.status = stMap[norm(o.status)] || o.status; return o; });
    $('#ie').textContent = ''; $('#ir').innerHTML = `<div class="result ok">${plural(rows.length, 'linha pronta', 'linhas prontas')} para importar.</div>`; $('#go').disabled = false;
  };
  $('#go').onclick = async () => {
    $('#go').disabled = true;
    try {
      const r = await api('/assets/import', { method: 'POST', body: { rows } });
      $('#ir').innerHTML = `<div class="result ok">${plural(r.created, 'bem importado', 'bens importados')}.</div>` + (r.errorCount ? `<div class="result bad">${plural(r.errorCount, 'linha com erro', 'linhas com erro')}</div><ul class="hint">${r.errors.map(x => `<li>Linha ${x.line}: ${esc(x.msg)}</li>`).join('')}</ul>` : '');
      S.lists = null; S.opts.responsibles = [];
      if (S.view === 'assets') { await loadLists(); refresh(); }
    } catch (er) { $('#ie').textContent = er.message; }
  };
}

// ---------- início ----------
(async () => {
  try { S.user = (await api('/me')).user; } catch { S.user = null; }
  render();
  paintOnline();
  if (S.user && !S.user.must_change) { refreshPending(); flushQueue(); }
})();
