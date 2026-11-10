'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { ativo: 'Ativo', manutencao: 'Em manutenção', baixado: 'Baixado' };
const MTYPE = { cadastro: 'Cadastro', transferencia: 'Transferência', baixa: 'Baixa', edicao: 'Edição' };
const MODES = { manual: ['Digitar', 'teclado'], leitor: ['Leitor USB', 'pistola'], camera: ['Câmera', 'celular'] };
const FLAGS = { sem_responsavel: 'Sem responsável', sem_foto: 'Sem foto' };
const PAGE = 50;
const ROLES = { admin: 'Administrador', user: 'Usuário', viewer: 'Consulta' };
const S = {
  page: 1, lock: false, user: null, view: 'dash', assets: [], showFilters: false,
  opts: { categories: [], sectors: [], responsibles: [] },
  f: { q: '', category: '', sector: '', status: '', responsible: '', flag: '' }, sel: new Set(),
};

// ---------- ícones (traço, estilo SF Symbols) ----------
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
const IC = {
  dash: svg('<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2"/><rect x="3" y="15" width="7.5" height="6" rx="2"/>'),
  assets: svg('<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'),
  inv: svg('<rect x="4.5" y="4" width="15" height="17" rx="2.5"/><path d="M9 4V3h6v1M8.5 12l2.3 2.3L15.5 9.5"/>'),
  movements: svg('<path d="M4 8h15l-3.5-3.5M20 16H5l3.5 3.5"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.1-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18.6 14.8c1.7.8 2.7 2.4 3 5"/>'),
  audit: svg('<path d="M12 3l8 3v6c0 4.6-3.2 8.1-8 9-4.8-.9-8-4.4-8-9V6l8-3z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>'),
  coin: svg('<circle cx="12" cy="12" r="9"/><path d="M14.6 9.2c-.5-.8-1.5-1.2-2.6-1.2-1.4 0-2.5.7-2.5 1.8 0 2.4 5 1.2 5 3.7 0 1.1-1.1 1.8-2.5 1.8-1.2 0-2.1-.4-2.6-1.2M12 6v2M12 16v2"/>'),
  wrench: svg('<path d="M14.5 5.5a4 4 0 00-5 5L4 16a2 2 0 102.9 2.9l5.6-5.5a4 4 0 005-5l-2.4 2.4-2.6-.4-.4-2.6 2.4-2.4z"/>'),
  archive: svg('<rect x="3" y="4" width="18" height="4.5" rx="1.2"/><path d="M5 8.5V19a1 1 0 001 1h12a1 1 0 001-1V8.5M10 12.5h4"/>'),
  swap: svg('<path d="M7 4L3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7"/>'),
  edit: svg('<path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
  tag: svg('<path d="M3 12V4a1 1 0 011-1h8l9 9-9 9-9-9z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  doc: svg('<path d="M6 3h8l5 5v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h7"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  photo: svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M21 16l-5-5-8.5 8"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  filter: svg('<path d="M4 6h16M7 12h10M10 18h4"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  alert: svg('<path d="M12 4l9 16H3l9-16z"/><path d="M12 10v4M12 17h.01"/>'),
  person: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4 3.9-6 8-6s7.3 2 8 6"/>'),
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
  } catch { throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.'); }
  let data = {};
  try { data = await r.json(); } catch { /* vazio */ }
  if (r.status === 401 && path !== '/login') { S.user = null; render(); }
  if (!r.ok) throw new Error(data.error || `O servidor respondeu com erro (${r.status}).`);
  return data;
}
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800);
}
const pref = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignora */ } },
};
const fmtDate = s => { const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)/.exec(s || ''); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : (s || ''); };
const fmtDay = s => s ? s.slice(0, 10).split('-').reverse().join('/') : '—';
const daysSince = s => { const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? 0 : Math.max(0, Math.floor((Date.now() - d) / 864e5)); };
const opts = (arr, sel, first) => (first !== undefined ? `<option value="">${esc(first)}</option>` : '') + arr.map(v => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const badge = s => `<span class="badge b-${esc(s)}">${esc(STATUS[s] || s)}</span>`;
const canEdit = () => S.user && S.user.role !== 'viewer';
const photoURL = a => `/api/assets/${a.id}/photo?v=${encodeURIComponent(a.updated_at)}`;
const thumb = a => a.photo ? `<img class="thumb" loading="lazy" src="${photoURL(a)}" alt="">` : `<span class="thumb ph">${IC.photo}</span>`;
const vibrate = ms => { try { navigator.vibrate?.(ms); } catch { /* sem suporte */ } };
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
async function ensureOpts() {
  if (S.opts.sectors.length || S.opts.responsibles.length || S.opts.categories.length) return;
  try { const r = await api('/assets'); S.opts = r; } catch { /* segue sem sugestões */ }
}

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

// ---------- leitura por câmera (reutilizável) ----------
function startScanner(area, onCode) {
  stopScanner();
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    area.innerHTML = '<div class="scanmsg">Este navegador não lê códigos pela câmera. Use o Chrome no Android ou no computador, ou digite o código.</div>'; return;
  }
  if (!window.isSecureContext) {
    area.innerHTML = '<div class="scanmsg">A câmera só funciona em conexão segura (HTTPS). Digite o código ou acesse o sistema por HTTPS.</div>'; return;
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
      try {
        const r = await det.detect(video);
        if (r.length && r[0].rawValue) { vibrate(60); await onCode(r[0].rawValue); }
      } catch { /* quadro sem código */ }
      busy = false;
    }, 280);
  }).catch(() => { area.innerHTML = '<div class="scanmsg">Não foi possível abrir a câmera. Permita o acesso à câmera nas configurações do navegador.</div>'; });
}

// ---------- impressão / exportação ----------
function printHTML(html) {
  $('#printArea').innerHTML = html;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); $('#printArea').innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}
function printLabels(list) {
  if (!list.length) return toast('Nenhum bem para gerar etiquetas.');
  printHTML('<div class="labels">' + list.map(a => `<div class="label">${barcodeSVG(a.barcode)}<div class="c">${esc(a.barcode)}</div><div class="n">Nº ${esc(a.number)}</div><div class="d">${esc(a.description)}</div></div>`).join('') + '</div>');
}
function exportCSV(list) {
  const head = ['Número', 'Nº de barras', 'Descrição', 'Categoria', 'Setor/Local', 'Responsável', 'Situação', 'Valor', 'Aquisição', 'Observações', 'Cadastrado em'];
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = list.map(a => [a.number, a.barcode, a.description, a.category, a.sector, a.responsible, STATUS[a.status], a.value ?? '', a.acquired_at, a.notes, fmtDate(a.created_at)].map(q).join(';'));
  const blob = new Blob(['\ufeff' + [head.map(q).join(';'), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'patrimonio-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function printReport(list, title = 'Relatório de patrimônio') {
  printHTML(`<div class="rep"><h1>${esc(title)}</h1><div class="meta">Emitido em ${new Date().toLocaleString('pt-BR')} · ${list.length} item(ns)</div>
  <table><thead><tr><th>Número</th><th>Nº barras</th><th>Descrição</th><th>Categoria</th><th>Setor</th><th>Responsável</th><th>Situação</th></tr></thead><tbody>
  ${list.map(a => `<tr><td>${esc(a.number)}</td><td>${esc(a.barcode)}</td><td>${esc(a.description)}</td><td>${esc(a.category)}</td><td>${esc(a.sector)}</td><td>${esc(a.responsible)}</td><td>${esc(STATUS[a.status])}</td></tr>`).join('')}
  </tbody></table></div>`);
}
async function printTerm(responsible) {
  if (!responsible) return toast('Este bem não tem responsável definido.');
  let list;
  try { list = (await api('/assets?responsible=' + encodeURIComponent(responsible))).assets.filter(a => a.status !== 'baixado'); } catch (e) { return toast(e.message); }
  const total = list.reduce((s, a) => s + (Number(a.value) || 0), 0);
  printHTML(`<div class="rep"><h1>Termo de responsabilidade</h1><div class="meta">Emitido em ${new Date().toLocaleString('pt-BR')}</div>
  <p>Eu, <b>${esc(responsible)}</b>, declaro ter recebido e estar sob minha guarda os bens patrimoniais relacionados abaixo, comprometendo-me a zelar por sua conservação, a utilizá-los exclusivamente em atividades da empresa e a comunicar imediatamente qualquer dano, extravio ou transferência.</p>
  <table><thead><tr><th>Número</th><th>Descrição</th><th>Setor</th><th>Situação</th><th>Valor</th></tr></thead><tbody>
  ${list.map(a => `<tr><td>${esc(a.number)}</td><td>${esc(a.description)}</td><td>${esc(a.sector)}</td><td>${esc(STATUS[a.status])}</td><td>${a.value != null ? money(a.value) : '—'}</td></tr>`).join('')}
  </tbody></table><p><b>${list.length} bem(ns)</b> · valor total ${money(total)}</p>
  <div class="sign"><div>${esc(responsible)}<br>Responsável</div><div>Gestor patrimonial</div></div></div>`);
}

// ---------- estrutura ----------
function renderChrome() {
  const nav = $('#nav'), top = $('#topActions'), fab = $('#scanFab'), ub = $('#userbox');
  if (!S.user || S.user.must_change) { nav.hidden = top.hidden = fab.hidden = true; return; }
  const tabs = [['dash', 'Painel'], ['assets', 'Bens'], ['inv', 'Inventário'], ['movements', 'Histórico']];
  if (S.user.role === 'admin') tabs.push(['users', 'Usuários'], ['audit', 'Auditoria']);
  nav.hidden = top.hidden = fab.hidden = false;
  nav.innerHTML = tabs.map(([k, l]) => `<button data-view="${k}" class="${S.view === k ? 'on' : ''}" ${S.view === k ? 'aria-current="page"' : ''}>${IC[k]}<span>${l}</span></button>`).join('');
  nav.querySelectorAll('button').forEach(b => b.onclick = () => go(b.dataset.view));
  const ini = S.user.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  ub.innerHTML = `<button class="avatar" id="avBtn" aria-haspopup="menu" aria-label="Conta de ${esc(S.user.name)}">${esc(ini)}</button>`;
  $('#avBtn').onclick = e => {
    e.stopPropagation();
    const open = $('.umenu', ub); if (open) { open.remove(); return; }
    ub.insertAdjacentHTML('beforeend', `<div class="umenu" role="menu"><div class="who"><b>${esc(S.user.name)}</b><span>${esc(ROLES[S.user.role] || '')} · ${esc(S.user.username)}</span></div><button id="pwBtn" role="menuitem">Alterar senha</button><button id="outBtn" class="out" role="menuitem">Sair</button></div>`);
    $('#outBtn').onclick = async () => { try { await api('/logout', { method: 'POST' }); } catch { /* ignora */ } S.user = null; render(); };
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
  const views = { dash: renderDash, assets: renderAssets, inv: renderInv, movements: renderMovements, users: renderUsers, audit: renderAudit };
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
      S.user = r.user; S.view = 'dash'; render();
    } catch (er) { $('#le').textContent = er.message; $('#lb').disabled = false; $('#lb').textContent = 'Entrar'; $('#p').select(); }
  };
}
function openPassword(forced) {
  S.lock = false;
  openModal(`<h2>${forced ? 'Crie sua senha' : 'Alterar senha'}</h2>${forced ? '<p class="sub" style="margin:-4px 0 16px">Por segurança, troque a senha provisória antes de continuar.</p>' : ''}<form id="pf">
    <div class="field"><label for="pc">Senha atual</label><input type="password" id="pc" autocomplete="current-password" required></div>
    <div class="field"><label for="pn">Nova senha</label><input type="password" id="pn" autocomplete="new-password" required minlength="8"><div class="hint">Mínimo de 8 caracteres, com letras e números.</div></div>
    <p class="err" id="pe"></p>
    <div class="modal-actions"><button type="button" class="btn" id="cx">${forced ? 'Sair' : 'Cancelar'}</button><button class="btn primary">Salvar</button></div></form>`);
  S.lock = !!forced;
  $('#cx').onclick = forced ? async () => { S.lock = false; try { await api('/logout', { method: 'POST' }); } catch { /* ignora */ } closeModal(); S.user = null; render(); } : closeModal;
  $('#pf').onsubmit = async e => {
    e.preventDefault();
    try {
      await api('/me/password', { method: 'POST', body: { current: $('#pc').value, password: $('#pn').value } });
      S.lock = false; closeModal(); toast('Senha alterada.');
      if (forced) { S.user.must_change = false; render(); }
    } catch (er) { $('#pe').textContent = er.message; }
  };
}

// ---------- ler código (acesso rápido de qualquer tela) ----------
function openScan() {
  let mode = pref.get('scanMode') || 'camera';
  openModal(`<h2>Ler código</h2>
    <div class="seg" id="smode" style="margin-bottom:14px"><button data-m="camera">Câmera</button><button data-m="type">Leitor ou digitação</button></div>
    <div id="sarea"></div>
    <form id="sform" autocomplete="off"><div class="field"><label for="scode">Nº de barras ou número do patrimônio</label><input id="scode" class="mono" enterkeyhint="search" placeholder="Ex.: 7891000000101 ou PAT-000101"></div></form>
    <div id="sres"></div>
    <div class="modal-actions"><button class="btn" id="cx">Fechar</button></div>`);
  $('#cx').onclick = closeModal;
  const area = $('#sarea'), input = $('#scode');
  const lookup = async code => {
    code = String(code).trim(); if (!code) return;
    let r; try { r = await api('/assets/lookup?code=' + encodeURIComponent(code)); } catch (e) { toast(e.message); return; }
    if (r.asset) { stopScanner(); openDetail(r.asset.id); return; }
    stopScanner(); area.innerHTML = ''; input.value = code;
    $('#sres').innerHTML = `<div class="result bad">Nenhum bem com o código ${esc(code)}.</div>${canEdit() ? '<button class="btn primary block" id="snew">Cadastrar com este código</button>' : ''}`;
    if ($('#snew')) $('#snew').onclick = () => openForm(null, { barcode: code });
  };
  const setMode = m => {
    mode = m; pref.set('scanMode', m); $('#sres').innerHTML = '';
    $$('#smode button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    if (m === 'camera') startScanner(area, lookup);
    else { stopScanner(); area.innerHTML = ''; input.focus(); }
  };
  $$('#smode button').forEach(b => b.onclick = () => setMode(b.dataset.m));
  $('#sform').onsubmit = e => { e.preventDefault(); lookup(input.value); };
  setMode(mode);
}

// ---------- bens ----------
async function loadAssets() {
  const p = new URLSearchParams(Object.entries(S.f).filter(([, v]) => v));
  const r = await api('/assets?' + p);
  S.assets = r.assets; S.opts = r;
}
function renderAssets() {
  $('#app').innerHTML = head('Bens', 'Encontre, cadastre e movimente o patrimônio.',
    canEdit() ? `<button class="btn hide-m" id="impBtn">Importar planilha</button><button class="btn primary" id="addBtn">${IC.plus}Novo bem</button>` : '') + `
  <div class="toolbar">
    <div class="search">${IC.search}<input id="fq" type="search" enterkeyhint="search" placeholder="Buscar por número, código, descrição ou pessoa" value="${esc(S.f.q)}" aria-label="Buscar bens"></div>
    <button class="btn" id="fBtn" aria-expanded="${S.showFilters}">${IC.filter}<span id="fBtnT">Filtros</span></button>
  </div>
  <div class="chips" id="chips"></div>
  <div class="filters" id="fpanel" ${S.showFilters ? '' : 'hidden'}>
    <div class="field"><label for="fc">Categoria</label><select id="fc"></select></div>
    <div class="field"><label for="fsec">Setor/Local</label><select id="fsec"></select></div>
    <div class="field"><label for="fres">Responsável</label><select id="fres"></select></div>
  </div>
  <div class="actbar"><span class="count" id="cnt"></span><div class="spacer"></div>
    <button class="btn sm" id="bTerm" hidden>${IC.doc}Termo</button>
    <button class="btn sm" id="bLab">${IC.tag}Etiquetas</button>
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
  $('#bLab').onclick = () => printLabels(S.sel.size ? S.assets.filter(a => S.sel.has(a.id)) : S.assets);
  $('#bCsv').onclick = () => S.assets.length ? exportCSV(S.assets) : toast('Nada para exportar.');
  $('#bPdf').onclick = () => S.assets.length ? printReport(S.assets) : toast('Nada para exportar.');
  $('#bTerm').onclick = () => printTerm(S.f.responsible);
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
  html += extra.map(([k, l]) => `<button class="chip on" data-clear="${k}" aria-label="Remover filtro ${esc(l)}">${esc(l)} <span class="x">✕</span></button>`).join('');
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
  $('#fc').innerHTML = opts(S.opts.categories, S.f.category, 'Todas');
  $('#fsec').innerHTML = opts(S.opts.sectors, S.f.sector, 'Todos');
  $('#fres').innerHTML = opts(S.opts.responsibles, S.f.responsible, 'Todos');
  $('#bTerm').hidden = !S.f.responsible;
  $('#bLab').innerHTML = `${IC.tag}${S.sel.size ? `Etiquetas (${S.sel.size})` : 'Etiquetas'}`;
  const pages = Math.max(1, Math.ceil(S.assets.length / PAGE));
  if (S.page > pages) S.page = pages;
  const view = S.assets.slice((S.page - 1) * PAGE, S.page * PAGE);
  $('#cnt').textContent = S.assets.length === 1 ? '1 bem' : `${S.assets.length} bens`;
  $('#pg').innerHTML = pages > 1 ? `<button class="btn sm" id="pp" ${S.page === 1 ? 'disabled' : ''}>Anterior</button><span class="count">Página ${S.page} de ${pages}</span><button class="btn sm" id="pn2" ${S.page === pages ? 'disabled' : ''}>Próxima</button>` : '';
  if (pages > 1) { $('#pp').onclick = () => { S.page--; refresh(); window.scrollTo(0, 0); }; $('#pn2').onclick = () => { S.page++; refresh(); window.scrollTo(0, 0); }; }
  if (!S.assets.length) {
    const empty = `<div class="empty"><b>Nenhum bem encontrado</b>${Object.values(S.f).some(Boolean) ? 'Tente outra busca ou limpe os filtros.' : 'Cadastre o primeiro bem ou importe uma planilha.'}</div>`;
    $('#tw').innerHTML = empty; $('#lw').innerHTML = empty; return;
  }
  $('#tw').innerHTML = `<table><thead><tr><th style="width:40px"><input type="checkbox" class="check" id="all" aria-label="Selecionar todos desta página"></th><th>Número</th><th>Descrição</th><th>Setor</th><th>Responsável</th><th>Situação</th></tr></thead><tbody>
    ${view.map(a => `<tr class="click" data-id="${a.id}"><td><input type="checkbox" class="check sel" data-id="${a.id}" ${S.sel.has(a.id) ? 'checked' : ''} aria-label="Selecionar ${esc(a.number)}"></td>
    <td><b class="mono">${esc(a.number)}</b><div class="hint mono">${esc(a.barcode)}</div></td><td><div class="cellph">${thumb(a)}<div>${esc(a.description)}<div class="hint">${esc(a.category)}</div></div></div></td>
    <td>${esc(a.sector) || '—'}</td><td>${esc(a.responsible) || '<span class="hint">—</span>'}</td><td>${badge(a.status)}</td></tr>`).join('')}</tbody></table>`;
  $('#lw').innerHTML = view.map(a => `<button class="li" data-id="${a.id}">${thumb(a)}<span class="t"><b>${esc(a.description)}</b><span>${esc(a.number)} · ${esc(a.sector || 'Sem setor')}</span></span><span class="r">${badge(a.status)}</span>${CHEV}</button>`).join('');
  $$('#tw tr.click').forEach(tr => tr.onclick = e => { if (e.target.classList.contains('check')) return; openDetail(Number(tr.dataset.id)); });
  $$('#lw .li').forEach(b => b.onclick = () => openDetail(Number(b.dataset.id)));
  const upd = () => { $('#bLab').innerHTML = `${IC.tag}${S.sel.size ? `Etiquetas (${S.sel.size})` : 'Etiquetas'}`; };
  $$('#tw .sel').forEach(c => c.onchange = () => { c.checked ? S.sel.add(Number(c.dataset.id)) : S.sel.delete(Number(c.dataset.id)); upd(); });
  const all = $('#all'); if (all) all.onchange = () => { $$('#tw .sel').forEach(c => { c.checked = all.checked; all.checked ? S.sel.add(Number(c.dataset.id)) : S.sel.delete(Number(c.dataset.id)); }); upd(); };
  if (openIfSingle === true && S.assets.length === 1) openDetail(S.assets[0].id);
}

// ---------- detalhe do bem ----------
async function openDetail(id) {
  let a, mv;
  try { [a, mv] = await Promise.all([api('/assets/' + id).then(r => r.asset), api(`/assets/${id}/history`).then(r => r.movements)]); } catch (e) { return toast(e.message); }
  const edit = canEdit();
  openModal(`<div class="row" style="align-items:flex-start;margin-bottom:12px"><div style="flex:1;min-width:0"><h2 style="margin:0">${esc(a.description)}</h2><div class="hint mono" style="font-size:15px">${esc(a.number)}</div></div>${badge(a.status)}</div>
  ${a.photo ? `<img class="detph" src="${photoURL(a)}" alt="Foto do bem ${esc(a.number)}">` : ''}
  <div class="qa">
    ${edit ? `<button class="btn" id="qMove">${IC.swap}Transferir</button>` : ''}
    ${edit ? `<button class="btn" id="qEdit">${IC.edit}Editar</button>` : ''}
    <button class="btn" id="qLab">${IC.tag}Etiqueta</button>
    ${a.responsible ? `<button class="btn" id="qTerm">${IC.doc}Termo</button>` : ''}
  </div>
  <div class="group">
    <div class="gi"><span>Setor/Local</span><b>${esc(a.sector) || '—'}</b></div>
    <div class="gi"><span>Responsável</span><b>${esc(a.responsible) || '—'}</b></div>
    <div class="gi"><span>Categoria</span><b>${esc(a.category) || '—'}</b></div>
    <div class="gi"><span>Valor</span><b>${a.value != null ? money(a.value) : '—'}</b></div>
    <div class="gi"><span>Aquisição</span><b>${fmtDay(a.acquired_at)}</b></div>
    ${a.notes ? `<div class="gi"><span>Observações</span><b>${esc(a.notes)}</b></div>` : ''}
    <div class="gi"><span>Cadastrado em</span><b>${fmtDate(a.created_at)}</b></div>
  </div>
  <div class="barcode"><div>${barcodeSVG(a.barcode).replace('<svg ', '<svg style="width:100%;height:100%" ')}</div><span class="mono">${esc(a.barcode)}</span></div>
  <h3>Histórico</h3><div class="card" style="padding:4px 16px"><ul class="hist">${mv.map(m => `<li><span class="badge b-${esc(m.type)}">${esc(MTYPE[m.type] || m.type)}</span> ${esc(m.detail)}${m.note ? `<br><i>“${esc(m.note)}”</i>` : ''}<small>${fmtDate(m.created_at)} · ${esc(m.user_name)}</small></li>`).join('')}</ul></div>
  <div class="modal-actions">${S.user.role === 'admin' ? `<button class="btn danger" id="dl">${IC.trash}Excluir</button><div class="spacer"></div>` : ''}<button class="btn primary" id="cl">Concluído</button></div>`);
  $('#cl').onclick = closeModal;
  $('#qLab').onclick = () => printLabels([a]);
  if ($('#qTerm')) $('#qTerm').onclick = () => printTerm(a.responsible);
  if ($('#qMove')) $('#qMove').onclick = () => openTransfer(a);
  if ($('#qEdit')) $('#qEdit').onclick = () => openForm(a);
  if ($('#dl')) $('#dl').onclick = async () => {
    if (!confirm(`Excluir definitivamente o bem ${a.number} e todo o histórico? Para tirar de uso, prefira "Transferir" e marcar como Baixado.`)) return;
    try { await api('/assets/' + id, { method: 'DELETE' }); closeModal(); S.sel.delete(id); toast('Bem excluído.'); render(); } catch (e) { toast(e.message); }
  };
}

// ---------- transferência rápida ----------
async function openTransfer(a) {
  await ensureOpts();
  let status = a.status;
  openModal(`<h2>Transferir ou mudar situação</h2><p class="sub" style="margin:-6px 0 16px">${esc(a.number)} · ${esc(a.description)}</p>
  <form id="tf" autocomplete="off">
    <div class="field"><label for="ts">Setor/Local</label><input id="ts" list="dsec" value="${esc(a.sector)}"><datalist id="dsec">${S.opts.sectors.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
    <div class="field"><label for="tr">Responsável</label><input id="tr" list="dres" value="${esc(a.responsible)}"><datalist id="dres">${S.opts.responsibles.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
    <div class="field"><label>Situação</label><div class="seg" id="tst">${Object.entries(STATUS).map(([k, l]) => `<button type="button" data-s="${k}" class="${k === status ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="field"><label for="tn">Motivo ou observação</label><input id="tn" maxlength="300" placeholder="Ex.: mudou para a sala 12"></div>
    <p class="err" id="te"></p>
    <div class="modal-actions"><button type="button" class="btn" id="cx">Voltar</button><button class="btn primary" id="tsv">Salvar</button></div>
  </form>`);
  $$('#tst button').forEach(b => b.onclick = () => { status = b.dataset.s; $$('#tst button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#cx').onclick = () => openDetail(a.id);
  $('#tf').onsubmit = async e => {
    e.preventDefault();
    const body = { ...a, sector: $('#ts').value, responsible: $('#tr').value, status, note: $('#tn').value };
    if (body.sector === a.sector && body.responsible === a.responsible && status === a.status) { $('#te').textContent = 'Nada mudou. Altere setor, responsável ou situação.'; return; }
    if (status === 'baixado' && a.status !== 'baixado' && !confirm('Marcar este bem como baixado? Ele sai da contagem do patrimônio ativo.')) return;
    $('#tsv').disabled = true;
    try { await api('/assets/' + a.id, { method: 'PUT', body }); toast('Movimentação registrada.'); vibrate(30); openDetail(a.id); if (S.view === 'assets') refresh(); else if (S.view === 'dash') renderDash(); }
    catch (er) { $('#te').textContent = er.message; $('#tsv').disabled = false; }
  };
}

// ---------- cadastro / edição ----------
async function openForm(a, pre = {}) {
  await ensureOpts();
  const editing = !!a;
  let mode = editing ? 'manual' : (pref.get('entryMode') || 'manual');
  if (!MODES[mode]) mode = 'manual';
  const v = k => esc(a ? a[k] : (pre[k] || ''));
  openModal(`<h2>${editing ? 'Editar bem' : 'Novo bem'}</h2>
  <form id="af" autocomplete="off">
    ${editing ? '' : `<label>Como deseja informar o código?</label><div class="seg big" id="seg" style="margin-bottom:14px">${Object.entries(MODES).map(([k, [l, s]]) => `<button type="button" data-m="${k}">${l}<small>${s}</small></button>`).join('')}</div>`}
    <div id="scanArea"></div>
    <div class="grid2">
      <div class="field"><label for="fb">Nº de barras *</label><input id="fb" class="mono" value="${v('barcode')}" required maxlength="80" autocapitalize="none" enterkeyhint="next"><div class="hint" id="bh"></div></div>
      <div class="field"><label for="fn">Número do patrimônio *</label><input id="fn" class="mono" value="${v('number')}" required maxlength="40" autocapitalize="characters" enterkeyhint="next"></div>
    </div>
    <div class="field"><label for="fd">Descrição *</label><input id="fd" value="${v('description')}" required maxlength="200" placeholder="Ex.: Notebook Dell Latitude 5440"></div>
    <div class="grid2">
      <div class="field"><label for="fcat">Categoria</label><input id="fcat" list="dcat" value="${v('category')}" maxlength="80"><datalist id="dcat">${S.opts.categories.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="field"><label for="fsc">Setor/Local</label><input id="fsc" list="dsec" value="${v('sector')}" maxlength="80"><datalist id="dsec">${S.opts.sectors.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
    </div>
    <div class="grid2">
      <div class="field"><label for="fr">Responsável</label><input id="fr" list="dres" value="${v('responsible')}" maxlength="80"><datalist id="dres">${S.opts.responsibles.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="field"><label for="fst2">Situação</label><select id="fst2">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}"${(a ? a.status : 'ativo') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <div class="grid2">
      <div class="field"><label for="fv">Valor (R$)</label><input id="fv" inputmode="decimal" value="${a && a.value != null ? esc(String(a.value).replace('.', ',')) : ''}" placeholder="0,00"></div>
      <div class="field"><label for="fa">Data de aquisição</label><input id="fa" type="date" value="${v('acquired_at')}"></div>
    </div>
    <div class="field"><label for="fph">Foto</label>
      <div class="phrow"><img id="phprev" class="detph sm" alt="" ${a && a.photo ? `src="${photoURL(a)}"` : 'hidden'}>
      <div><input id="fph" type="file" accept="image/*"><div class="hint">No celular, abre a câmera ou a galeria.</div>
      ${a && a.photo ? '<label class="inl" style="margin-top:8px;font-size:15px"><input type="checkbox" class="check" id="rmph"> Remover foto atual</label>' : ''}</div></div></div>
    <div class="field"><label for="fo">Observações</label><textarea id="fo" rows="2" maxlength="500">${v('notes')}</textarea></div>
    ${editing ? '<div class="field"><label for="fnote">Motivo da alteração (opcional)</label><input id="fnote" maxlength="300"><div class="hint">Mudanças de setor, responsável ou situação vão para o histórico.</div></div>' : ''}
    <p class="err" id="fe"></p>
    <div class="modal-actions"><button type="button" class="btn" id="cx">Cancelar</button><button class="btn primary" id="sv">Salvar</button></div>
  </form>`);
  $('#cx').onclick = () => editing ? openDetail(a.id) : closeModal();
  const bar = $('#fb');
  async function checkDup() {
    const c = bar.value.trim(); if (!c) return;
    try {
      const r = await api('/assets/lookup?code=' + encodeURIComponent(c));
      $('#bh').innerHTML = r.asset && (!a || r.asset.id !== a.id) ? `<span style="color:var(--red);font-weight:600">Já cadastrado: ${esc(r.asset.number)} · ${esc(r.asset.description)}</span>` : '';
    } catch { /* ignora */ }
  }
  function setMode(m) {
    mode = m; if (!editing) pref.set('entryMode', m);
    stopScanner(); $('#scanArea').innerHTML = '';
    $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    const hint = $('#bh');
    if (m === 'leitor') { hint.textContent = 'Aponte o leitor para a etiqueta. O código entra sozinho.'; bar.focus(); }
    else if (m === 'camera') { hint.textContent = ''; startScanner($('#scanArea'), async code => { bar.value = code; stopScanner(); $('#scanArea').innerHTML = ''; toast('Código lido: ' + code); await checkDup(); $('#fn').focus(); }); }
    else hint.textContent = 'Digite o número que aparece abaixo das barras.';
  }
  bar.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); checkDup(); $('#fn').focus(); } };
  bar.onblur = checkDup;
  $$('#seg button').forEach(b => b.onclick = () => setMode(b.dataset.m));
  let photoBlob = null;
  $('#fph').onchange = async e => {
    const f = e.target.files[0]; photoBlob = null; if (!f) return;
    try { photoBlob = await shrink(f); const pv = $('#phprev'); pv.src = URL.createObjectURL(photoBlob); pv.hidden = false; }
    catch { $('#fe').textContent = 'Não foi possível ler essa imagem.'; e.target.value = ''; }
  };
  if (!editing) { setMode(mode); if (pre.barcode) { checkDup(); $('#fn').focus(); } }

  $('#af').onsubmit = async e => {
    e.preventDefault(); $('#sv').disabled = true; $('#sv').textContent = 'Salvando…';
    const body = { barcode: bar.value, number: $('#fn').value, description: $('#fd').value, category: $('#fcat').value, sector: $('#fsc').value, responsible: $('#fr').value, status: $('#fst2').value, value: $('#fv').value, acquired_at: $('#fa').value, notes: $('#fo').value, entry_mode: mode, note: $('#fnote')?.value || '' };
    try {
      const saved = editing ? await api('/assets/' + a.id, { method: 'PUT', body }) : await api('/assets', { method: 'POST', body });
      const aid = saved.asset.id;
      try {
        if (photoBlob) await uploadPhoto(aid, photoBlob);
        else if (editing && $('#rmph')?.checked) await api(`/assets/${aid}/photo`, { method: 'DELETE' });
      } catch (pe) { toast('Salvo, mas a foto falhou: ' + pe.message); }
      S.opts = { categories: [], sectors: [], responsibles: [] };
      vibrate(30);
      if (editing) { toast('Alterações salvas.'); openDetail(aid); }
      else { closeModal(); toast('Bem cadastrado.'); if (mode !== 'manual') setTimeout(() => openForm(), 350); }
      if (S.view === 'assets') refresh(); else if (S.view === 'dash') renderDash();
    } catch (er) { $('#fe').textContent = er.message; $('#sv').disabled = false; $('#sv').textContent = 'Salvar'; }
  };
}

// ---------- painel ----------
async function renderDash() {
  $('#app').innerHTML = head('Painel', `Olá, ${esc(S.user.name.split(' ')[0])}. Veja como está o patrimônio hoje.`) + '<div id="dw" class="empty">Carregando…</div>';
  let d; try { d = await api('/dashboard'); } catch (e) { return toast(e.message); }
  const st = k => d.byStatus.find(x => x.k === k)?.n || 0;
  const tot = d.total || 0, a1 = st('ativo'), a2 = st('manutencao'), a3 = st('baixado');
  const pct = n => tot ? (n / tot * 100).toFixed(2) : 0;
  const bars = (rows, fmt = r => r.n, val = r => r.n) => { const max = Math.max(1, ...rows.map(val)); return rows.length ? rows.map(r => `<div class="bar"><span class="bl">${esc(r.k)}</span><span class="bt"><i style="width:${Math.round(val(r) / max * 100)}%"></i></span><b>${fmt(r)}</b></div>`).join('') : '<div class="hint">Sem dados.</div>'; };
  const attnCount = d.maintenance.length + (d.noResponsible ? 1 : 0) + (d.noPhoto ? 1 : 0);
  $('#dw').className = ''; $('#dw').innerHTML = `
  <div class="kpis">
    <button class="kpi" data-go="all"><div class="lb"><i class="i-blue">${IC.assets}</i>Total de bens</div><b>${tot}</b></button>
    <div class="kpi"><div class="lb"><i class="i-indigo">${IC.coin}</i>Valor ativo</div><b>${money(d.value)}</b></div>
    <button class="kpi" data-go="manutencao"><div class="lb"><i class="i-orange">${IC.wrench}</i>Em manutenção</div><b>${a2}</b></button>
    <button class="kpi" data-go="baixado"><div class="lb"><i class="i-red">${IC.archive}</i>Baixados</div><b>${a3}</b></button>
  </div>
  <div class="cols">
    <div class="card"><h2>Precisa de atenção ${attnCount ? `<span class="badge b-manutencao" style="vertical-align:3px">${attnCount}</span>` : ''}</h2>
      <div class="attn">
        ${d.maintenance.map(m => `<button class="ai" data-id="${m.id}"><span class="t"><b>${esc(m.description)}</b><span>Em manutenção · ${esc(m.sector || 'Sem setor')}</span></span><em>${daysSince(m.since) === 1 ? '1 dia' : daysSince(m.since) + ' dias'}</em>${CHEV}</button>`).join('')}
        ${d.noResponsible ? `<button class="ai" data-flag="sem_responsavel"><span class="t"><b>${d.noResponsible} bem(ns) sem responsável</b><span>Defina quem responde por eles</span></span>${CHEV}</button>` : ''}
        ${d.noPhoto ? `<button class="ai" data-flag="sem_foto"><span class="t"><b>${d.noPhoto} bem(ns) sem foto</b><span>Fotos ajudam a identificar no inventário</span></span>${CHEV}</button>` : ''}
        ${attnCount ? '' : '<div class="hint" style="padding:8px 0">Tudo em ordem por aqui.</div>'}
      </div></div>
    <div class="card"><h2>Situação dos bens</h2>
      <div class="stack" role="img" aria-label="${a1} ativos, ${a2} em manutenção, ${a3} baixados"><i style="width:${pct(a1)}%;background:var(--green)"></i><i style="width:${pct(a2)}%;background:var(--orange)"></i><i style="width:${pct(a3)}%;background:var(--red)"></i></div>
      <div class="legend"><span><i style="background:var(--green)"></i>Ativos <b>${a1}</b></span><span><i style="background:var(--orange)"></i>Manutenção <b>${a2}</b></span><span><i style="background:var(--red)"></i>Baixados <b>${a3}</b></span></div>
      <h3 style="margin-top:20px">Por categoria</h3>${bars(d.byCategory)}</div>
  </div>
  <div class="cols">
    <div class="card"><h2>Valor por setor</h2>${bars(d.valueBySector, r => money(r.v), r => r.v)}</div>
    <div class="card"><h2>Últimas movimentações</h2>${d.recent.length ? `<ul class="hist">${d.recent.map(m => `<li><span class="badge b-${esc(m.type)}">${esc(MTYPE[m.type] || m.type)}</span> <b>${esc(m.description)}</b><small>${esc(m.detail)} · ${fmtDate(m.created_at)} · ${esc(m.user_name)}</small></li>`).join('')}</ul>` : '<div class="hint">Nenhuma movimentação ainda.</div>'}</div>
  </div>`;
  $$('#dw [data-go]').forEach(b => b.onclick = () => go('assets', { status: b.dataset.go === 'all' ? '' : b.dataset.go }));
  $$('#dw [data-flag]').forEach(b => b.onclick = () => go('assets', { flag: b.dataset.flag }));
  $$('#dw .ai[data-id]').forEach(b => b.onclick = () => openDetail(Number(b.dataset.id)));
}

// ---------- inventário ----------
async function renderInv() {
  $('#app').innerHTML = head('Inventário', 'Leia os códigos de um setor e veja na hora o que está faltando.', canEdit() ? `<button class="btn primary" id="ni">${IC.plus}Novo inventário</button>` : '') + '<div class="tablewrap" id="iw"></div>';
  if (canEdit()) $('#ni').onclick = async () => {
    await ensureOpts();
    openModal(`<h2>Novo inventário</h2><form id="nf"><div class="field"><label for="is">Qual setor você vai conferir?</label><select id="is">${opts(S.opts.sectors, '', 'Todos os setores')}</select></div>
    <div class="modal-actions"><button type="button" class="btn" id="cx">Cancelar</button><button class="btn primary">Começar</button></div></form>`);
    $('#cx').onclick = closeModal;
    $('#nf').onsubmit = async e => { e.preventDefault(); try { const r = await api('/inventories', { method: 'POST', body: { sector: $('#is').value } }); openInv(r.id); renderInv(); } catch (er) { toast(er.message); } };
  };
  let list; try { list = (await api('/inventories')).inventories; } catch (e) { return toast(e.message); }
  $('#iw').innerHTML = list.length ? `<table><thead><tr><th>Setor</th><th>Início</th><th>Lidos</th><th>Situação</th></tr></thead><tbody>${list.map(i => `<tr class="click" data-id="${i.id}"><td><b>${esc(i.sector) || 'Todos os setores'}</b><div class="hint">Nº ${i.id}</div></td><td>${fmtDate(i.created_at)}<div class="hint">${esc(i.created_by)}</div></td><td>${i.found}</td><td>${i.closed_at ? '<span class="badge b-edicao">Encerrado</span>' : '<span class="badge b-ativo">Em andamento</span>'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty"><b>Nenhum inventário ainda</b>Comece uma conferência por setor.</div>';
  $$('#iw tr.click').forEach(tr => tr.onclick = () => openInv(Number(tr.dataset.id)));
}
async function openInv(id) {
  let data; try { data = await api('/inventories/' + id); } catch (e) { return toast(e.message); }
  const inv = data.inventory, closed = !!inv.closed_at, can = canEdit() && !closed;
  openModal(`<h2>Inventário · ${esc(inv.sector) || 'Todos os setores'}</h2>
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
    $('#ist').innerHTML = `<div class="stat"><small>Esperados</small><b>${d.expected.length}</b></div><div class="stat"><small>Encontrados</small><b style="color:var(--green)">${found.length}</b></div><div class="stat"><small>Faltando</small><b style="color:var(--red)">${missing.length}</b></div>`;
    const rows = (arr, b) => arr.map(a => `<tr><td style="white-space:nowrap"><b class="mono">${esc(a.number)}</b></td><td>${esc(a.description)}<div class="hint">${esc(a.sector)}</div></td><td style="text-align:right">${b}</td></tr>`).join('');
    $('#il').innerHTML = rows(missing, '<span class="badge b-baixa">Faltando</span>') + rows(found, '<span class="badge b-ativo">Encontrado</span>') + rows(d.extra, '<span class="badge b-manutencao">Fora do setor</span>');
    $('#px').disabled = !missing.length;
  };
  fill(data);
  $('#cl').onclick = () => { closeModal(); renderInv(); };
  $('#px').onclick = () => printReport(missing, `Itens faltantes · ${inv.sector || 'Todos os setores'}`);
  if ($('#en')) $('#en').onclick = async () => { if (confirm(`Encerrar o inventário? ${missing.length} item(ns) ficarão registrados como faltantes.`)) { try { await api(`/inventories/${id}/close`, { method: 'POST' }); openInv(id); } catch (e) { toast(e.message); } } };
  if (!can) return;
  const sc = $('#sc');
  let last = '', lastAt = 0;
  const scan = async code => {
    code = String(code).trim(); if (!code) return;
    if (code === last && Date.now() - lastAt < 2500) return; // evita leitura repetida pela câmera
    last = code; lastAt = Date.now();
    try {
      const r = await api(`/inventories/${id}/scan`, { method: 'POST', body: { code } });
      const m = { ok: ['ok', 'Encontrado'], outside: ['warn', 'Encontrado, mas é de outro setor ou está baixado'], duplicate: ['warn', 'Já tinha sido lido'], unknown: ['bad', 'Código não cadastrado'] }[r.result];
      $('#sr').innerHTML = `<div class="result ${m[0]}">${m[1]}${r.asset ? `: ${esc(r.asset.number)} · ${esc(r.asset.description)}` : ` (${esc(code)})`}</div>`;
      vibrate(r.result === 'ok' ? 40 : [60, 60, 60]);
      if (r.result === 'ok' || r.result === 'outside') fill(await api('/inventories/' + id));
    } catch (er) { toast(er.message); }
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
  <div class="toolbar"><div class="search">${IC.search}<input id="mq" type="search" placeholder="Buscar por número, código ou descrição" aria-label="Buscar no histórico"></div><span></span></div>
  <div class="chips" id="mchips">${[['', 'Todos'], ...Object.entries(MTYPE)].map(([k, l]) => `<button class="chip ${k === '' ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>
  <div class="tablewrap" id="mw"></div>`;
  let t, type = '';
  const load = async () => {
    const p = new URLSearchParams({ q: $('#mq').value, type });
    try {
      const { movements } = await api('/movements?' + p);
      $('#mw').innerHTML = movements.length ? `<table><thead><tr><th>Data</th><th>Bem</th><th>Movimentação</th><th class="hide-m">Usuário</th></tr></thead><tbody>
      ${movements.map(m => `<tr class="click" data-id="${m.asset_id}"><td style="white-space:nowrap">${fmtDate(m.created_at)}</td>
      <td><b>${esc(m.description)}</b><div class="hint mono">${esc(m.number)}</div></td><td><span class="badge b-${esc(m.type)}">${esc(MTYPE[m.type] || m.type)}</span><div style="margin-top:4px">${esc(m.detail)}</div>${m.note ? `<div class="hint">“${esc(m.note)}”</div>` : ''}</td><td class="hide-m">${esc(m.user_name)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty"><b>Nada encontrado</b>Tente outra busca.</div>';
      $$('#mw tr.click').forEach(tr => tr.onclick = () => openDetail(Number(tr.dataset.id)));
    } catch (e) { toast(e.message); }
  };
  $('#mq').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  $$('#mchips .chip').forEach(b => b.onclick = () => { type = b.dataset.t; $$('#mchips .chip').forEach(x => x.classList.toggle('on', x === b)); load(); });
  load();
}

// ---------- usuários ----------
async function renderUsers() {
  $('#app').innerHTML = head('Usuários', 'Quem acessa o sistema e o que cada um pode fazer.', `<a class="btn hide-m" href="/api/backup" download>Baixar backup</a><button class="btn primary" id="nu">${IC.plus}Novo usuário</button>`) + '<div class="tablewrap" id="uw"></div>';
  $('#nu').onclick = () => openUserForm();
  let users; try { users = (await api('/users')).users; } catch (e) { return toast(e.message); }
  $('#uw').innerHTML = `<table><thead><tr><th>Nome</th><th>Perfil</th><th></th></tr></thead><tbody>
  ${users.map(u => `<tr><td><b>${esc(u.name)}</b><div class="hint mono">${esc(u.username)}</div></td><td>${ROLES[u.role] || esc(u.role)}</td><td style="text-align:right"><button class="btn sm" data-id="${u.id}">Editar</button></td></tr>`).join('')}</tbody></table>`;
  $$('#uw button').forEach(b => b.onclick = () => openUserForm(users.find(u => u.id === Number(b.dataset.id))));
}
function openUserForm(u) {
  const ed = !!u;
  openModal(`<h2>${ed ? 'Editar usuário' : 'Novo usuário'}</h2><form id="uf" autocomplete="off">
  <div class="field"><label for="un">Nome</label><input id="un" value="${esc(u?.name)}" required></div>
  <div class="field"><label for="ul">Usuário (login)</label><input id="ul" value="${esc(u?.username)}" autocapitalize="none" ${ed ? 'disabled' : 'required'}></div>
  <div class="field"><label for="ur">Perfil</label><select id="ur"><option value="viewer"${u?.role === 'viewer' ? ' selected' : ''}>Consulta: só visualiza</option><option value="user"${!u || u.role === 'user' ? ' selected' : ''}>Usuário: cadastra e movimenta</option><option value="admin"${u?.role === 'admin' ? ' selected' : ''}>Administrador: acesso total</option></select></div>
  <div class="field"><label for="up">${ed ? 'Nova senha (deixe vazio para manter)' : 'Senha provisória'}</label><input id="up" type="password" autocomplete="new-password" ${ed ? '' : 'required'} minlength="8"><div class="hint">Mínimo de 8 caracteres, com letras e números. A pessoa troca no primeiro acesso.</div></div>
  <p class="err" id="ue"></p>
  <div class="modal-actions">${ed ? `<button type="button" class="btn danger" id="ud">${IC.trash}Excluir</button><div class="spacer"></div>` : ''}<button type="button" class="btn" id="cx">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
  $('#cx').onclick = closeModal;
  if (ed) $('#ud').onclick = async () => {
    if (!confirm('Excluir o usuário ' + u.username + '?')) return;
    try { await api('/users/' + u.id, { method: 'DELETE' }); closeModal(); renderUsers(); } catch (e) { $('#ue').textContent = e.message; }
  };
  $('#uf').onsubmit = async e => {
    e.preventDefault();
    try {
      if (ed) await api('/users/' + u.id, { method: 'PUT', body: { name: $('#un').value, role: $('#ur').value, password: $('#up').value || undefined } });
      else await api('/users', { method: 'POST', body: { name: $('#un').value, username: $('#ul').value, role: $('#ur').value, password: $('#up').value } });
      closeModal(); toast('Usuário salvo.'); renderUsers();
    } catch (er) { $('#ue').textContent = er.message; }
  };
}

// ---------- auditoria ----------
const ACT = { login: 'Login', login_falha: 'Login recusado', senha_alterada: 'Senha alterada', senha_redefinida: 'Senha redefinida', bem_excluido: 'Bem excluído', usuario_criado: 'Usuário criado', usuario_excluido: 'Usuário excluído', perfil_alterado: 'Perfil alterado', backup: 'Backup', importacao: 'Importação' };
async function renderAudit() {
  $('#app').innerHTML = head('Auditoria', 'Acessos e ações sensíveis (últimos 300 registros).') + '<div class="tablewrap" id="aw"></div>';
  let list; try { list = (await api('/audit')).audit; } catch (e) { return toast(e.message); }
  const bad = ['login_falha', 'bem_excluido', 'usuario_excluido'];
  $('#aw').innerHTML = list.length ? `<table><thead><tr><th>Data</th><th>Ação</th><th>Detalhe</th><th class="hide-m">IP</th></tr></thead><tbody>${list.map(a => `<tr><td style="white-space:nowrap">${fmtDate(a.created_at)}<div class="hint mono">${esc(a.user_name)}</div></td><td><span class="badge ${bad.includes(a.action) ? 'b-baixa' : 'b-edicao'}">${esc(ACT[a.action] || a.action)}</span></td><td>${esc(a.detail)}</td><td class="mono hide-m">${esc(a.ip)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty"><b>Sem registros</b></div>';
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
const HEAD = { numero: 'number', nbarras: 'barcode', numerodebarras: 'barcode', codigodebarras: 'barcode', barras: 'barcode', codigo: 'barcode', descricao: 'description', categoria: 'category', setor: 'sector', setorlocal: 'sector', local: 'sector', responsavel: 'responsible', situacao: 'status', valor: 'value', aquisicao: 'acquired_at', dataaquisicao: 'acquired_at', observacoes: 'notes', observacao: 'notes' };
function openImport() {
  openModal(`<h2>Importar planilha</h2><p class="sub" style="margin:-6px 0 14px">Envie um arquivo <b>CSV</b> (no Excel: Salvar como → CSV UTF-8). A primeira linha deve ter os títulos das colunas, como <span class="mono">Número; Nº de barras; Descrição; Categoria; Setor; Responsável; Situação; Valor; Aquisição; Observações</span>. Obrigatórios: número, nº de barras e descrição. Datas no formato AAAA-MM-DD.</p>
  <div class="field"><input type="file" id="cf" accept=".csv,text/csv" aria-label="Arquivo CSV"></div><p class="err" id="ie"></p><div id="ir"></div>
  <div class="modal-actions"><button class="btn" id="cx">Fechar</button><button class="btn primary" id="go" disabled>Importar</button></div>`);
  $('#cx').onclick = closeModal;
  let rows = [];
  $('#cf').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const data = parseCSV(await f.text());
    if (data.length < 2) { $('#ie').textContent = 'Arquivo vazio ou sem dados.'; return; }
    const keys = data[0].map(h => HEAD[norm(h)] || null);
    if (!keys.includes('number') || !keys.includes('barcode') || !keys.includes('description')) { $('#ie').textContent = 'Cabeçalho não reconhecido: faltam Número, Nº de barras ou Descrição.'; return; }
    const stMap = { ativo: 'ativo', manutencao: 'manutencao', emmanutencao: 'manutencao', baixado: 'baixado' };
    rows = data.slice(1).map(r => { const o = {}; keys.forEach((k, i) => { if (k) o[k] = (r[i] || '').trim(); }); if (o.status) o.status = stMap[norm(o.status)] || o.status; return o; });
    $('#ie').textContent = ''; $('#ir').innerHTML = `<div class="result ok">${rows.length} linha(s) prontas para importar.</div>`; $('#go').disabled = false;
  };
  $('#go').onclick = async () => {
    $('#go').disabled = true;
    try {
      const r = await api('/assets/import', { method: 'POST', body: { rows } });
      $('#ir').innerHTML = `<div class="result ok">${r.created} bem(ns) importado(s).</div>` + (r.errorCount ? `<div class="result bad">${r.errorCount} linha(s) com erro</div><ul class="hint">${r.errors.map(x => `<li>Linha ${x.line}: ${esc(x.msg)}</li>`).join('')}</ul>` : '');
      S.opts = { categories: [], sectors: [], responsibles: [] };
      if (S.view === 'assets') refresh();
    } catch (er) { $('#ie').textContent = er.message; }
  };
}

// ---------- início ----------
(async () => {
  try { S.user = (await api('/me')).user; } catch { S.user = null; }
  render();
})();
