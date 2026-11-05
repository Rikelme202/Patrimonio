'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { ativo: 'Ativo', manutencao: 'Em manutenção', baixado: 'Baixado' };
const MTYPE = { cadastro: 'Cadastro', transferencia: 'Transferência', baixa: 'Baixa', edicao: 'Edição' };
const MODES = { manual: ['Manual', 'digitar'], leitor: ['Leitor USB', 'pistola'], camera: ['Câmera', 'celular'] };

const PAGE = 50;
const ROLES = { admin: 'Administrador', user: 'Usuário', viewer: 'Consulta' };
const S = { page: 1, lock: false, user: null, view: 'dash', assets: [], opts: { categories: [], sectors: [], responsibles: [] }, f: { q: '', category: '', sector: '', status: '' }, sel: new Set() };

// ---------- util ----------
async function api(path, opts = {}) {
  const r = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  try { data = await r.json(); } catch { /* vazio */ }
  if (r.status === 401 && path !== '/login') { S.user = null; render(); }
  if (!r.ok) throw new Error(data.error || 'Erro na requisição');
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
const opts = (arr, sel, first) => (first !== undefined ? `<option value="">${esc(first)}</option>` : '') + arr.map(v => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
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
const photoURL = a => `/api/assets/${a.id}/photo?v=${encodeURIComponent(a.updated_at)}`;
const IC = {
  dash: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  assets: '<svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  inv: '<svg viewBox="0 0 24 24"><path d="M9 11l2 2 4-4"/><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 4V3h6v1"/></svg>',
  movements: '<svg viewBox="0 0 24 24"><path d="M4 8h14l-3-3"/><path d="M20 16H6l3 3"/></svg>',
  users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18.5 14.8c1.8.7 2.9 2.4 3.2 5"/></svg>',
  audit: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.7-2.5 1.8 0 2.4 5 1.2 5 3.7 0 1.1-1.1 1.8-2.5 1.8-1.1 0-2-.4-2.5-1.2M12 6v2M12 16v2"/></svg>',
  wrench: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 005 5L21 13l-8 8-3-3 8-8-1.3-1.7z" transform="translate(-4 -2)"/><path d="M3 21l5-5"/></svg>',
  archive: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 12h4"/></svg>',
};
const canEdit = () => S.user && S.user.role !== 'viewer';
const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const badge = s => `<span class="badge b-${esc(s)}">${esc(STATUS[s] || s)}</span>`;

// ---------- modal ----------
let scanStop = null;
function openModal(html) {
  const o = $('#modal'); $('.modal', o).innerHTML = html; o.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  if (S.lock) return;
  if (scanStop) { scanStop(); scanStop = null; }
  $('#modal').hidden = true; $('#modal .modal').innerHTML = '';
  document.body.style.overflow = '';
}
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

// ---------- impressão / exportação ----------
function printHTML(html) {
  $('#printArea').innerHTML = html;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); $('#printArea').innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}
function printLabels(list) {
  if (!list.length) return toast('Selecione ao menos um patrimônio.');
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
function printReport(list) {
  printHTML(`<div class="rep"><div class="rep-head"><img src="/logo.webp" alt="Hola.com"><div><b>Relatório de patrimônio</b><br><small>${new Date().toLocaleString('pt-BR')} — ${list.length} item(ns)</small></div></div>
  <table><thead><tr><th>Número</th><th>Nº barras</th><th>Descrição</th><th>Categoria</th><th>Setor</th><th>Responsável</th><th>Situação</th></tr></thead><tbody>
  ${list.map(a => `<tr><td>${esc(a.number)}</td><td>${esc(a.barcode)}</td><td>${esc(a.description)}</td><td>${esc(a.category)}</td><td>${esc(a.sector)}</td><td>${esc(a.responsible)}</td><td>${esc(STATUS[a.status])}</td></tr>`).join('')}
  </tbody></table></div>`);
}

// ---------- layout geral ----------
function renderChrome() {
  const nav = $('#nav'), ub = $('#userbox');
  if (!S.user) { nav.hidden = ub.hidden = true; return; }
  const tabs = [['dash', 'Painel'], ['assets', 'Patrimônios'], ['inv', 'Inventário'], ['movements', 'Movimentos']];
  if (S.user.role === 'admin') tabs.push(['users', 'Usuários'], ['audit', 'Auditoria']);
  nav.hidden = ub.hidden = false;
  nav.innerHTML = tabs.map(([k, l]) => `<button data-view="${k}" class="${S.view === k ? 'on' : ''}" ${S.view === k ? 'aria-current="page"' : ''}>${IC[k]}<span>${l}</span></button>`).join('');
  const ini = S.user.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  ub.innerHTML = `<button class="avatar" id="avBtn" aria-haspopup="true" aria-expanded="false" aria-label="Menu do usuário">${esc(ini)}</button>`;
  nav.querySelectorAll('button').forEach(b => b.onclick = () => { S.view = b.dataset.view; render(); });
  $('#avBtn').onclick = e => {
    e.stopPropagation();
    const open = $('.umenu', ub);
    if (open) { open.remove(); return; }
    ub.insertAdjacentHTML('beforeend', `<div class="umenu" role="menu"><div class="who"><b>${esc(S.user.name)}</b><span>${esc(ROLES[S.user.role] || '')} · ${esc(S.user.username)}</span></div><button id="pwBtn" role="menuitem">Alterar senha</button><button id="outBtn" class="out" role="menuitem">Sair</button></div>`);
    $('#outBtn').onclick = async () => { await api('/logout', { method: 'POST' }); S.user = null; render(); };
    $('#pwBtn').onclick = () => { $('.umenu', ub)?.remove(); openPassword(); };
  };
}
document.addEventListener('click', e => { const m = $('.umenu'); if (m && !m.contains(e.target)) m.remove(); });
async function render() {
  renderChrome();
  if (!S.user) return renderLogin();
  if (S.user.must_change) { $('#app').innerHTML = ''; return openPassword(true); }
  if (S.view === 'dash') return renderDash();
  if (S.view === 'inv') return renderInv();
  if (S.view === 'assets') return renderAssets();
  if (S.view === 'movements') return renderMovements();
  if (S.view === 'users') return renderUsers();
  if (S.view === 'audit') return renderAudit();
}

// ---------- login ----------
function renderLogin() {
  $('#app').innerHTML = `<div class="auth">
    <aside class="auth-art" aria-hidden="false">
      <svg viewBox="0 0 400 260" fill="none" stroke="#00c8f0" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M0 60h90l30 30h70" opacity=".7"/><circle cx="196" cy="90" r="6" fill="#050810"/><path d="M0 130h150" /><circle cx="158" cy="130" r="6" fill="#050810"/><path d="M0 200h80l36-40h60" opacity=".7"/><circle cx="182" cy="160" r="6" fill="#050810"/><path d="M400 40h-70l-26 26h-40" stroke="#7c4dff" opacity=".8"/><circle cx="258" cy="66" r="6" fill="#050810" stroke="#7c4dff"/><path d="M400 110h-110" stroke="#7c4dff" opacity=".6"/></svg>
      <h2>Cada bem<br>no seu lugar.</h2>
      <p>Controle patrimonial com código de barras, fotos, histórico e inventário.</p>
      <ul><li>Leitor USB e câmera do celular</li><li>Histórico completo de movimentações</li><li>Etiquetas e relatórios prontos</li></ul>
    </aside>
    <form class="auth-form" id="lf" autocomplete="on">
      <h1>Bem-vindo</h1><p class="sub">Acesse o Controle de Patrimônio</p>
      <div class="field"><label for="u">Usuário</label><input id="u" name="username" autocomplete="username" value="${esc(pref.get('lastUser') || '')}" required></div>
      <div class="field"><label for="p">Senha</label><div class="pw"><input id="p" name="password" type="password" autocomplete="current-password" required><button type="button" id="tp" aria-label="Mostrar senha">Mostrar</button></div></div>
      <label class="inl" style="margin-bottom:12px"><input type="checkbox" class="check" id="rem" ${pref.get('lastUser') ? 'checked' : ''}> Lembrar meu usuário</label>
      <p class="err" id="le" role="alert"></p>
      <button class="btn primary" id="lb" style="width:100%">Entrar</button>
      <p class="hint" style="text-align:center;margin-top:16px">Problemas para acessar? Fale com o administrador do sistema.</p>
    </form></div>`;
  ($('#u').value ? $('#p') : $('#u')).focus();
  $('#tp').onclick = () => { const p = $('#p'); const show = p.type === 'password'; p.type = show ? 'text' : 'password'; $('#tp').textContent = show ? 'Ocultar' : 'Mostrar'; };
  $('#lf').onsubmit = async e => {
    e.preventDefault(); $('#lb').disabled = true; $('#le').textContent = '';
    try {
      const r = await api('/login', { method: 'POST', body: { username: $('#u').value, password: $('#p').value } });
      pref.set('lastUser', $('#rem').checked ? $('#u').value : '');
      S.user = r.user; S.view = 'dash'; render();
    } catch (er) { $('#le').textContent = er.message; $('#lb').disabled = false; $('#p').select(); }
  };
}
function openPassword(forced) {
  S.lock = false;
  openModal(`<h2>${forced ? 'Defina uma nova senha' : 'Alterar minha senha'}</h2>${forced ? '<p class="sub">Por segurança, troque a senha provisória antes de continuar.</p>' : ''}<form id="pf">
    <div class="field"><label>Senha atual</label><input type="password" id="pc" autocomplete="current-password" required></div>
    <div class="field"><label>Nova senha</label><input type="password" id="pn" autocomplete="new-password" required minlength="8"><div class="hint">Mínimo 8 caracteres, com letras e números.</div></div>
    <p class="err" id="pe"></p>
    <div class="modal-actions">${forced ? '<button type="button" class="btn" id="cx">Sair</button>' : '<button type="button" class="btn" id="cx">Cancelar</button>'}<button class="btn primary">Salvar</button></div></form>`);
  S.lock = !!forced;
  $('#cx').onclick = forced ? async () => { S.lock = false; await api('/logout', { method: 'POST' }); closeModal(); S.user = null; render(); } : closeModal;
  $('#pf').onsubmit = async e => {
    e.preventDefault();
    try {
      await api('/me/password', { method: 'POST', body: { current: $('#pc').value, password: $('#pn').value } });
      S.lock = false; closeModal(); toast('Senha alterada.');
      if (forced) { S.user.must_change = false; render(); }
    } catch (er) { $('#pe').textContent = er.message; }
  };
}

// ---------- patrimônios ----------
async function loadAssets() {
  const p = new URLSearchParams(Object.entries(S.f).filter(([, v]) => v));
  const r = await api('/assets?' + p);
  S.assets = r.assets; S.opts = r;
}
async function renderAssets() {
  $('#app').innerHTML = `
  <div class="row" style="margin-bottom:14px">
    <div><h1>Patrimônios</h1><p class="sub" style="margin:0">Cadastre, localize e controle os bens.</p></div><div class="spacer"></div>
    ${canEdit() ? '<button class="btn" id="impBtn">Importar planilha</button><input type="file" id="impFile" accept=".csv,text/csv" hidden><button class="btn primary" id="addBtn">+ Novo patrimônio</button>' : ''}
  </div>
  <div class="filters">
    <div class="field"><label for="fq">Buscar</label><input id="fq" type="search" placeholder="Número, nº de barras, descrição, responsável…" value="${esc(S.f.q)}"></div>
    <div class="field"><label for="fc">Categoria</label><select id="fc"></select></div>
    <div class="field"><label for="fs">Setor/Local</label><select id="fsec"></select></div>
    <div class="field"><label for="fst">Situação</label><select id="fst"><option value="">Todas</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${S.f.status === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
  </div>
  <div class="row" style="margin-bottom:8px"><p class="count" id="cnt" style="margin:0"></p><div class="spacer"></div>
    <button class="btn sm" id="bLab">Etiquetas (selecionados)</button>
    <button class="btn sm" id="bCsv">Excel (CSV)</button>
    <button class="btn sm" id="bPdf">PDF</button></div>
  <div class="tablewrap" id="tw"></div><div class="row pager" id="pg"></div>`;
  if (canEdit()) { $('#addBtn').onclick = () => openForm(); $('#impBtn').onclick = openImport; }
  let t;
  $('#fq').oninput = e => { S.f.q = e.target.value; S.page = 1; clearTimeout(t); t = setTimeout(refresh, 250); };
  $('#fq').onkeydown = e => { if (e.key === 'Enter') { clearTimeout(t); S.f.q = e.target.value; refresh(true); } };
  $('#fc').onchange = e => { S.f.category = e.target.value; S.page = 1; refresh(); };
  $('#fsec').onchange = e => { S.f.sector = e.target.value; S.page = 1; refresh(); };
  $('#fst').onchange = e => { S.f.status = e.target.value; S.page = 1; refresh(); };
  $('#bLab').onclick = () => printLabels(S.assets.filter(a => S.sel.has(a.id)));
  $('#bCsv').onclick = () => S.assets.length ? exportCSV(S.assets) : toast('Nada para exportar.');
  $('#bPdf').onclick = () => S.assets.length ? printReport(S.assets) : toast('Nada para exportar.');
  await refresh();
}
async function refresh(openIfSingle) {
  try { await loadAssets(); } catch (e) { return toast(e.message); }
  if (!$('#tw')) return;
  $('#fc').innerHTML = opts(S.opts.categories, S.f.category, 'Todas');
  $('#fsec').innerHTML = opts(S.opts.sectors, S.f.sector, 'Todos');
  const pages = Math.max(1, Math.ceil(S.assets.length / PAGE));
  if (S.page > pages) S.page = pages;
  const view = S.assets.slice((S.page - 1) * PAGE, S.page * PAGE);
  $('#cnt').textContent = S.assets.length + ' item(ns)';
  $('#pg').innerHTML = pages > 1 ? `<button class="btn sm" id="pp" ${S.page === 1 ? 'disabled' : ''}>‹ Anterior</button><span class="count" style="margin:0">Página ${S.page} de ${pages}</span><button class="btn sm" id="pn2" ${S.page === pages ? 'disabled' : ''}>Próxima ›</button>` : '';
  if (pages > 1) { $('#pp').onclick = () => { S.page--; refresh(); }; $('#pn2').onclick = () => { S.page++; refresh(); }; }
  if (!S.assets.length) $('#tw').innerHTML = '<div class="empty">Nenhum patrimônio encontrado.</div>';
  else $('#tw').innerHTML = `<table><thead><tr><th style="width:34px"><input type="checkbox" class="check" id="all" aria-label="Selecionar todos"></th><th>Número</th><th class="hide-m">Nº de barras</th><th>Descrição</th><th class="hide-m">Setor</th><th class="hide-m">Responsável</th><th>Situação</th></tr></thead><tbody>
    ${view.map(a => `<tr class="click" data-id="${a.id}"><td><input type="checkbox" class="check sel" data-id="${a.id}" ${S.sel.has(a.id) ? 'checked' : ''} aria-label="Selecionar"></td>
    <td class="mono"><b>${esc(a.number)}</b></td><td class="mono hide-m">${esc(a.barcode)}</td><td><div class="cellph">${a.photo ? `<img class="thumb" loading="lazy" src="${photoURL(a)}" alt="">` : '<span class="thumb ph"></span>'}<div>${esc(a.description)}<div class="hint">${esc(a.category)}</div></div></div></td>
    <td class="hide-m">${esc(a.sector)}</td><td class="hide-m">${esc(a.responsible)}</td><td>${badge(a.status)}</td></tr>`).join('')}</tbody></table>`;
  $('#tw').querySelectorAll('tr.click').forEach(tr => tr.onclick = e => { if (e.target.classList.contains('check')) return; openDetail(Number(tr.dataset.id)); });
  $('#tw').querySelectorAll('.sel').forEach(c => c.onchange = () => { c.checked ? S.sel.add(Number(c.dataset.id)) : S.sel.delete(Number(c.dataset.id)); });
  const all = $('#all'); if (all) all.onchange = () => { $('#tw').querySelectorAll('.sel').forEach(c => { c.checked = all.checked; all.checked ? S.sel.add(Number(c.dataset.id)) : S.sel.delete(Number(c.dataset.id)); }); };
  if (openIfSingle === true && S.assets.length === 1) openDetail(S.assets[0].id);
}

async function openDetail(id) {
  let a, mv;
  try { a = (await api('/assets/' + id)).asset; mv = (await api(`/assets/${id}/history`)).movements; } catch (e) { return toast(e.message); }
  openModal(`<h2>Patrimônio Nº ${esc(a.number)}</h2>
  <div style="margin:0 0 14px;border:1px solid var(--line);border-radius:8px;padding:6px 10px;text-align:center"><div style="height:56px">${barcodeSVG(a.barcode).replace('<svg ', '<svg style="width:100%;height:100%" ')}</div><span class="mono">${esc(a.barcode)}</span></div>
  ${a.photo ? `<img class="detph" src="${photoURL(a)}" alt="Foto do bem ${esc(a.number)}">` : ''}
  <dl class="kv"><dt>Descrição</dt><dd>${esc(a.description)}</dd><dt>Categoria</dt><dd>${esc(a.category) || '—'}</dd><dt>Setor/Local</dt><dd>${esc(a.sector) || '—'}</dd>
  <dt>Responsável</dt><dd>${esc(a.responsible) || '—'}</dd><dt>Situação</dt><dd>${badge(a.status)}</dd><dt>Valor</dt><dd>${a.value != null ? money(a.value) : '—'}</dd><dt>Aquisição</dt><dd>${a.acquired_at ? a.acquired_at.split('-').reverse().join('/') : '—'}</dd><dt>Observações</dt><dd>${esc(a.notes) || '—'}</dd><dt>Cadastrado em</dt><dd>${fmtDate(a.created_at)} <span class="hint">(${esc(MODES[a.entry_mode]?.[0] || '')})</span></dd></dl>
  <h2 style="font-size:15px">Histórico</h2><ul class="hist">${mv.map(m => `<li><span class="badge b-${esc(m.type)}">${esc(MTYPE[m.type] || m.type)}</span> ${esc(m.detail)}${m.note ? `<br><i>“${esc(m.note)}”</i>` : ''}<small>${fmtDate(m.created_at)} — ${esc(m.user_name)}</small></li>`).join('')}</ul>
  <div class="modal-actions">${S.user.role === 'admin' ? '<button class="btn danger" id="dl">Excluir</button>' : ''}<div class="spacer"></div>
  <button class="btn" id="lb">Etiqueta</button>${canEdit() ? '<button class="btn" id="ed">Editar / Movimentar</button>' : ''}<button class="btn primary" id="cl">Fechar</button></div>`);
  $('#cl').onclick = closeModal;
  $('#lb').onclick = () => printLabels([a]);
  if ($('#ed')) $('#ed').onclick = () => openForm(a);
  const dl = $('#dl');
  if (dl) dl.onclick = async () => {
    if (!confirm(`Excluir definitivamente o patrimônio ${a.number} e seu histórico?`)) return;
    try { await api('/assets/' + id, { method: 'DELETE' }); closeModal(); S.sel.delete(id); toast('Patrimônio excluído.'); refresh(); } catch (e) { toast(e.message); }
  };
}

// ---------- formulário (cadastro/edição) com forma de entrada ----------
function openForm(a) {
  const editing = !!a;
  let mode = editing ? (a.entry_mode || 'manual') : (pref.get('entryMode') || 'manual');
  if (!MODES[mode]) mode = 'manual';
  const v = k => esc(a ? a[k] : '');
  openModal(`<h2>${editing ? 'Editar patrimônio' : 'Novo patrimônio'}</h2>
  <form id="af" autocomplete="off">
    ${editing ? '' : `<label>Como deseja adicionar?</label><div class="seg" id="seg">${Object.entries(MODES).map(([k, [l, s]]) => `<button type="button" data-m="${k}">${l}<small>${s}</small></button>`).join('')}</div>`}
    <div id="scanArea"></div>
    <div class="grid2">
      <div class="field"><label for="fb">Número de barras *</label><input id="fb" class="mono" value="${v('barcode')}" required maxlength="80" inputmode="text"><div class="hint" id="bh"></div></div>
      <div class="field"><label for="fn">Número do patrimônio *</label><input id="fn" class="mono" value="${v('number')}" required maxlength="40"></div>
    </div>
    <div class="field"><label for="fd">Descrição *</label><input id="fd" value="${v('description')}" required maxlength="200"></div>
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
    <div class="field"><label for="fph">Foto do bem</label>
      <div class="phrow"><img id="phprev" class="detph sm" alt="" ${a && a.photo ? `src="${photoURL(a)}"` : 'hidden'}>
      <div><input id="fph" type="file" accept="image/*"><div class="hint">No celular abre a câmera ou a galeria. A imagem é reduzida automaticamente.</div>
      ${a && a.photo ? '<label class="inl" style="margin-top:6px"><input type="checkbox" class="check" id="rmph"> Remover foto atual</label>' : ''}</div></div></div>
    <div class="field"><label for="fo">Observações</label><textarea id="fo" rows="2" maxlength="500">${v('notes')}</textarea></div>
    ${editing ? '<div class="field"><label for="fnote">Observação da movimentação (opcional)</label><input id="fnote" maxlength="300" placeholder="Ex.: transferido para a sala 12"><div class="hint">Mudanças de setor, responsável ou situação ficam registradas no histórico.</div></div>' : ''}
    <p class="err" id="fe"></p>
    <div class="modal-actions"><button type="button" class="btn" id="cx">Cancelar</button><button class="btn primary" id="sv">Salvar</button></div>
  </form>`);
  $('#cx').onclick = closeModal;

  const bar = $('#fb');
  function setMode(m) {
    mode = m; if (!editing) pref.set('entryMode', m);
    if (scanStop) { scanStop(); scanStop = null; }
    $('#scanArea').innerHTML = '';
    document.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    const hint = $('#bh');
    if (m === 'leitor') { hint.textContent = 'Aponte o leitor para a etiqueta — o código entra sozinho e o cursor avança.'; bar.focus(); }
    else if (m === 'camera') { hint.textContent = 'Aponte a câmera para o código de barras.'; startCamera(); }
    else { hint.textContent = 'Digite o número que está abaixo das barras.'; }
  }
  function startCamera() {
    const area = $('#scanArea');
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
      area.innerHTML = '<div class="scanmsg">A leitura por câmera não é suportada neste navegador. Use Chrome/Edge (Android ou computador) ou escolha outra forma de entrada.</div>'; return;
    }
    if (!window.isSecureContext) {
      area.innerHTML = '<div class="scanmsg">O navegador só libera a câmera em conexão segura (HTTPS) ou em localhost. Acesse o sistema por HTTPS para usar a câmera no celular.</div>'; return;
    }
    area.innerHTML = '<div class="scanbox"><video playsinline muted></video></div>';
    const video = $('video', area); let stream, timer, stopped = false;
    scanStop = () => { stopped = true; clearInterval(timer); stream && stream.getTracks().forEach(t => t.stop()); };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(async s => {
      if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s; video.srcObject = s; await video.play();
      const det = new BarcodeDetector();
      timer = setInterval(async () => {
        try {
          const r = await det.detect(video);
          if (r.length && r[0].rawValue) {
            bar.value = r[0].rawValue; navigator.vibrate?.(80); toast('Código lido: ' + r[0].rawValue);
            scanStop(); scanStop = null; area.innerHTML = ''; checkDup(); $('#fn').focus();
          }
        } catch { /* quadro sem código */ }
      }, 300);
    }).catch(() => { area.innerHTML = '<div class="scanmsg">Não foi possível acessar a câmera. Verifique a permissão do navegador.</div>'; });
  }
  async function checkDup() {
    const c = bar.value.trim(); if (!c) return;
    try {
      const r = await api('/assets/lookup?code=' + encodeURIComponent(c));
      if (r.asset && (!a || r.asset.id !== a.id)) $('#bh').innerHTML = `<span style="color:var(--danger)">Já cadastrado: Nº ${esc(r.asset.number)} — ${esc(r.asset.description)}</span>`;
    } catch { /* ignora */ }
  }
  bar.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); checkDup(); $('#fn').focus(); } };
  bar.onblur = checkDup;
  document.querySelectorAll('#seg button').forEach(b => b.onclick = () => setMode(b.dataset.m));
  let photoBlob = null;
  $('#fph').onchange = async e => {
    const f = e.target.files[0]; photoBlob = null; if (!f) return;
    try { photoBlob = await shrink(f); const pv = $('#phprev'); pv.src = URL.createObjectURL(photoBlob); pv.hidden = false; }
    catch { $('#fe').textContent = 'Não foi possível ler essa imagem.'; e.target.value = ''; }
  };
  if (!editing) setMode(mode);

  $('#af').onsubmit = async e => {
    e.preventDefault(); $('#sv').disabled = true;
    const body = { barcode: bar.value, number: $('#fn').value, description: $('#fd').value, category: $('#fcat').value, sector: $('#fsc').value, responsible: $('#fr').value, status: $('#fst2').value, value: $('#fv').value, acquired_at: $('#fa').value, notes: $('#fo').value, entry_mode: mode, note: $('#fnote')?.value || '' };
    try {
      const saved = editing ? await api('/assets/' + a.id, { method: 'PUT', body }) : await api('/assets', { method: 'POST', body });
      const aid = saved.asset.id;
      try {
        if (photoBlob) await uploadPhoto(aid, photoBlob);
        else if (editing && $('#rmph')?.checked) await api(`/assets/${aid}/photo`, { method: 'DELETE' });
      } catch (pe) { toast('Salvo, mas a foto falhou: ' + pe.message); }
      closeModal(); toast(editing ? 'Alterações salvas.' : 'Patrimônio cadastrado.'); refresh();
      if (!editing && mode !== 'manual') setTimeout(() => openForm(), 350); // cadastro em sequência (leitor/câmera)
    } catch (er) { $('#fe').textContent = er.message; $('#sv').disabled = false; }
  };
}

// ---------- movimentações ----------
async function renderMovements() {
  $('#app').innerHTML = `<h1>Movimentações</h1><p class="sub">Histórico de cadastros, transferências, baixas e edições.</p>
  <div class="row" style="margin-bottom:14px"><div class="field" style="flex:2;min-width:200px;margin:0"><input id="mq" type="search" placeholder="Buscar por número, barras, descrição…"></div>
  <div class="field" style="flex:1;min-width:150px;margin:0"><select id="mt"><option value="">Todos os tipos</option>${Object.entries(MTYPE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div></div>
  <div class="tablewrap" id="mw"></div>`;
  let t;
  const load = async () => {
    const p = new URLSearchParams({ q: $('#mq').value, type: $('#mt').value });
    try {
      const { movements } = await api('/movements?' + p);
      $('#mw').innerHTML = movements.length ? `<table><thead><tr><th>Data</th><th>Tipo</th><th>Patrimônio</th><th>Detalhe</th><th class="hide-m">Usuário</th></tr></thead><tbody>
      ${movements.map(m => `<tr><td style="white-space:nowrap">${fmtDate(m.created_at)}</td><td><span class="badge b-${esc(m.type)}">${esc(MTYPE[m.type] || m.type)}</span></td>
      <td><b class="mono">${esc(m.number)}</b><div class="hint">${esc(m.description)}</div></td><td>${esc(m.detail)}${m.note ? `<div class="hint">“${esc(m.note)}”</div>` : ''}</td><td class="hide-m">${esc(m.user_name)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhuma movimentação.</div>';
    } catch (e) { toast(e.message); }
  };
  $('#mq').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  $('#mt').onchange = load;
  load();
}

// ---------- usuários ----------
async function renderUsers() {
  $('#app').innerHTML = `<div class="row" style="margin-bottom:14px"><div><h1>Usuários</h1><p class="sub" style="margin:0">Quem pode acessar o sistema.</p></div><div class="spacer"></div><a class="btn" href="/api/backup" download>Baixar backup</a><button class="btn primary" id="nu">+ Novo usuário</button></div><div class="tablewrap" id="uw"></div>`;
  $('#nu').onclick = () => openUserForm();
  let users; try { users = (await api('/users')).users; } catch (e) { return toast(e.message); }
  $('#uw').innerHTML = `<table><thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th></th></tr></thead><tbody>
  ${users.map(u => `<tr><td>${esc(u.name)}</td><td class="mono">${esc(u.username)}</td><td>${ROLES[u.role] || u.role}</td><td style="text-align:right"><button class="btn sm" data-id="${u.id}">Editar</button></td></tr>`).join('')}</tbody></table>`;
  $('#uw').querySelectorAll('button').forEach(b => b.onclick = () => openUserForm(users.find(u => u.id === Number(b.dataset.id))));
}
function openUserForm(u) {
  const ed = !!u;
  openModal(`<h2>${ed ? 'Editar usuário' : 'Novo usuário'}</h2><form id="uf" autocomplete="off">
  <div class="field"><label>Nome</label><input id="un" value="${esc(u?.name)}" required></div>
  <div class="field"><label>Usuário (login)</label><input id="ul" value="${esc(u?.username)}" ${ed ? 'disabled' : 'required'}></div>
  <div class="field"><label>Perfil</label><select id="ur"><option value="viewer"${u?.role === 'viewer' ? ' selected' : ''}>Consulta (somente visualiza)</option><option value="user"${u?.role === 'user' ? ' selected' : ''}>Usuário (cadastra e movimenta)</option><option value="admin"${u?.role === 'admin' ? ' selected' : ''}>Administrador (também exclui e gerencia usuários)</option></select></div>
  <div class="field"><label>${ed ? 'Nova senha (deixe vazio para manter)' : 'Senha provisória (mín. 8, letras e números)'}</label><input id="up" type="password" autocomplete="new-password" ${ed ? '' : 'required'} minlength="8"><div class="hint">O usuário precisará trocá-la no primeiro acesso.</div></div>
  <p class="err" id="ue"></p>
  <div class="modal-actions">${ed ? '<button type="button" class="btn danger" id="ud">Excluir</button><div class="spacer"></div>' : ''}<button type="button" class="btn" id="cx">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
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


// ---------- painel ----------
async function renderDash() {
  $('#app').innerHTML = '<h1>Painel</h1><p class="sub">Visão geral do patrimônio.</p><div id="dw" class="empty">Carregando…</div>';
  let d; try { d = await api('/dashboard'); } catch (e) { return toast(e.message); }
  const st = k => d.byStatus.find(x => x.k === k)?.n || 0;
  const bars = (rows) => { const max = Math.max(1, ...rows.map(r => r.n)); return rows.length ? rows.map(r => `<div class="bar"><span class="bl">${esc(r.k)}</span><span class="bt"><i style="width:${Math.round(r.n / max * 100)}%"></i></span><b>${r.n}</b></div>`).join('') : '<div class="hint">Sem dados.</div>'; };
  const tot = d.total || 0, a1 = st('ativo'), a2 = st('manutencao'), a3 = st('baixado');
  const p1 = tot ? a1 / tot * 100 : 0, p2 = p1 + (tot ? a2 / tot * 100 : 0);
  const ring = tot ? `conic-gradient(var(--ok) 0 ${p1}%, var(--warn) ${p1}% ${p2}%, var(--danger) ${p2}% 100%)` : 'conic-gradient(var(--line) 0 100%)';
  $('#dw').className = ''; $('#dw').innerHTML = `
  <div class="kpis">
    <div class="kpi"><div class="ic ic-c">${IC.assets}</div><div><small>Total de bens</small><b>${d.total}</b></div></div>
    <div class="kpi"><div class="ic ic-p">${IC.coin}</div><div><small>Valor patrimonial</small><b>${money(d.value)}</b></div></div>
    <div class="kpi"><div class="ic ic-w">${IC.wrench}</div><div><small>Em manutenção</small><b>${a2}</b></div></div>
    <div class="kpi"><div class="ic ic-d">${IC.archive}</div><div><small>Baixados</small><b>${a3}</b></div></div>
  </div>
  <div class="cols3">
    <div class="card"><h2>Situação dos bens</h2><div class="donutwrap"><div class="donut" style="background:${ring}" role="img" aria-label="${a1} ativos, ${a2} em manutenção, ${a3} baixados"><span>${tot}<small>bens</small></span></div>
      <div class="legend"><div><i style="background:var(--ok)"></i>Ativos<b>${a1}</b></div><div><i style="background:var(--warn)"></i>Manutenção<b>${a2}</b></div><div><i style="background:var(--danger)"></i>Baixados<b>${a3}</b></div></div></div></div>
    <div class="card"><h2>Por categoria</h2>${bars(d.byCategory)}</div>
    <div class="card"><h2>Por setor/local</h2>${bars(d.bySector)}</div>
  </div>
  <div class="card" style="margin-top:14px"><h2>Últimas movimentações</h2>${d.recent.length ? `<ul class="hist">${d.recent.map(m => `<li><span class="badge b-${esc(m.type)}">${esc(MTYPE[m.type] || m.type)}</span> <b class="mono">${esc(m.number)}</b> ${esc(m.description)}<small>${esc(m.detail)} — ${fmtDate(m.created_at)} — ${esc(m.user_name)}</small></li>`).join('')}</ul>` : '<div class="empty">Nenhuma movimentação ainda.</div>'}</div>`;
}

// ---------- inventário ----------
async function renderInv() {
  $('#app').innerHTML = `<div class="row" style="margin-bottom:14px"><div><h1>Inventário</h1><p class="sub" style="margin:0">Confira os bens de um setor lendo os códigos e veja o que falta.</p></div><div class="spacer"></div>${canEdit() ? '<button class="btn primary" id="ni">+ Novo inventário</button>' : ''}</div><div class="tablewrap" id="iw"></div>`;
  if (canEdit()) $('#ni').onclick = async () => {
    try { await loadAssets(); } catch { /* usa opções antigas */ }
    openModal(`<h2>Novo inventário</h2><form id="nf"><div class="field"><label for="is">Setor/Local a conferir</label><select id="is">${opts(S.opts.sectors, '', 'Todos os setores')}</select></div>
    <div class="modal-actions"><button type="button" class="btn" id="cx">Cancelar</button><button class="btn primary">Iniciar</button></div></form>`);
    $('#cx').onclick = closeModal;
    $('#nf').onsubmit = async e => { e.preventDefault(); try { const r = await api('/inventories', { method: 'POST', body: { sector: $('#is').value } }); closeModal(); openInv(r.id); } catch (er) { toast(er.message); } };
  };
  let list; try { list = (await api('/inventories')).inventories; } catch (e) { return toast(e.message); }
  $('#iw').innerHTML = list.length ? `<table><thead><tr><th>Nº</th><th>Setor</th><th>Início</th><th>Lidos</th><th>Situação</th></tr></thead><tbody>${list.map(i => `<tr class="click" data-id="${i.id}"><td>${i.id}</td><td>${esc(i.sector) || 'Todos'}</td><td>${fmtDate(i.created_at)}<div class="hint">${esc(i.created_by)}</div></td><td>${i.found}</td><td>${i.closed_at ? '<span class="badge b-edicao">Encerrado</span>' : '<span class="badge b-ativo">Em andamento</span>'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhum inventário ainda.</div>';
  $('#iw').querySelectorAll('tr.click').forEach(tr => tr.onclick = () => openInv(Number(tr.dataset.id)));
}
async function openInv(id) {
  let data; try { data = await api('/inventories/' + id); } catch (e) { return toast(e.message); }
  const inv = data.inventory, closed = !!inv.closed_at;
  const found = data.expected.filter(a => a.found_at), missing = data.expected.filter(a => !a.found_at);
  const rows = (arr, cls) => arr.map(a => `<tr><td class="mono" style="white-space:nowrap"><b>${esc(a.number)}</b></td><td>${esc(a.description)}<div class="hint">${esc(a.sector)}</div></td><td style="white-space:nowrap">${cls}</td></tr>`).join('');
  openModal(`<h2>Inventário #${inv.id} — ${esc(inv.sector) || 'Todos os setores'}</h2>
  <div class="stats" style="grid-template-columns:repeat(3,1fr)"><div class="stat"><small>Esperados</small><b>${data.expected.length}</b></div><div class="stat"><small>Encontrados</small><b style="color:var(--ok)">${found.length}</b></div><div class="stat"><small>Faltando</small><b style="color:var(--danger)">${missing.length}</b></div></div>
  ${closed || !canEdit() ? `<p class="hint">${closed ? `Encerrado em ${fmtDate(inv.closed_at)}.` : 'Perfil somente consulta.'}</p>` : `<div class="field"><label for="sc">Leia o código (leitor USB) ou digite e tecle Enter</label><input id="sc" class="mono" autocomplete="off" autofocus></div><p class="hint" id="sr" role="status" style="min-height:20px"></p>`}
  <div class="tablewrap" style="max-height:min(440px,50vh);overflow:auto"><table style="min-width:0"><tbody>
    ${rows(missing, '<span class="badge b-baixa">Faltando</span>')}${rows(found, '<span class="badge b-ativo">Encontrado</span>')}${rows(data.extra, '<span class="badge b-manutencao">Fora do setor/baixado</span>')}
  </tbody></table></div>
  <div class="modal-actions" style="margin-top:12px">${missing.length ? '<button class="btn" id="px">Imprimir faltantes</button>' : ''}<button class="btn" id="cl">Fechar</button>${closed || !canEdit() ? '' : '<button class="btn primary" id="en">Encerrar inventário</button>'}</div>`);
  $('#cl').onclick = () => { closeModal(); renderInv(); };
  if ($('#px')) $('#px').onclick = () => printReport(missing);
  if ($('#en')) $('#en').onclick = async () => { if (confirm(`Encerrar? ${missing.length} item(ns) ficarão como faltantes.`)) { await api(`/inventories/${id}/close`, { method: 'POST' }); openInv(id); } };
  const sc = $('#sc');
  if (sc) sc.onkeydown = async e => {
    if (e.key !== 'Enter') return; e.preventDefault();
    const code = sc.value.trim(); if (!code) return;
    try {
      const r = await api(`/inventories/${id}/scan`, { method: 'POST', body: { code } });
      const msg = { ok: '✔ Encontrado', outside: '⚠ Encontrado, mas fora do setor/baixado', duplicate: 'Já lido antes', unknown: '✖ Código não cadastrado' }[r.result];
      if (r.result === 'ok' || r.result === 'outside') { await openInv(id); const n = $('#sr'); if (n) n.textContent = `${msg}: ${r.asset.number} — ${r.asset.description}`; $('#sc')?.focus(); }
      else { $('#sr').textContent = msg + (r.asset ? `: ${r.asset.number}` : ` (${code})`); sc.value = ''; sc.focus(); }
    } catch (er) { toast(er.message); }
  };
}

// ---------- auditoria ----------
const ACT = { login: 'Login', login_falha: 'Login recusado', senha_alterada: 'Senha alterada', senha_redefinida: 'Senha redefinida', bem_excluido: 'Bem excluído', usuario_criado: 'Usuário criado', usuario_excluido: 'Usuário excluído', perfil_alterado: 'Perfil alterado', backup: 'Backup', importacao: 'Importação' };
async function renderAudit() {
  $('#app').innerHTML = '<h1>Auditoria</h1><p class="sub">Registro de acessos e ações sensíveis (últimos 300).</p><div class="tablewrap" id="aw"></div>';
  let list; try { list = (await api('/audit')).audit; } catch (e) { return toast(e.message); }
  $('#aw').innerHTML = list.length ? `<table><thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Detalhe</th><th class="hide-m">IP</th></tr></thead><tbody>${list.map(a => `<tr><td style="white-space:nowrap">${fmtDate(a.created_at)}</td><td class="mono">${esc(a.user_name)}</td><td><span class="badge ${a.action === 'login_falha' || a.action === 'bem_excluido' || a.action === 'usuario_excluido' ? 'b-baixa' : 'b-edicao'}">${esc(ACT[a.action] || a.action)}</span></td><td>${esc(a.detail)}</td><td class="mono hide-m">${esc(a.ip)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem registros.</div>';
}

// ---------- importação de planilha (CSV) ----------
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const delim = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
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
const norm = h => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const HEAD = { numero: 'number', nbarras: 'barcode', numerodebarras: 'barcode', codigodebarras: 'barcode', barras: 'barcode', codigo: 'barcode', descricao: 'description', categoria: 'category', setor: 'sector', setorlocal: 'sector', local: 'sector', responsavel: 'responsible', situacao: 'status', valor: 'value', aquisicao: 'acquired_at', dataaquisicao: 'acquired_at', observacoes: 'notes', observacao: 'notes' };
function openImport() {
  openModal(`<h2>Importar planilha</h2><p class="sub">Envie um arquivo <b>CSV</b> (exportado do Excel em "CSV UTF-8"). A primeira linha deve ter os títulos: <span class="mono">Número; Nº de barras; Descrição; Categoria; Setor; Responsável; Situação; Valor; Aquisição; Observações</span>. Obrigatórios: número, nº de barras e descrição. Datas no formato AAAA-MM-DD.</p>
  <div class="field"><input type="file" id="cf" accept=".csv,text/csv"></div><p class="err" id="ie"></p><div id="ir"></div>
  <div class="modal-actions"><button class="btn" id="cx">Fechar</button><button class="btn primary" id="go" disabled>Importar</button></div>`);
  $('#cx').onclick = closeModal;
  let rows = [];
  $('#cf').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const data = parseCSV(await f.text());
    if (data.length < 2) { $('#ie').textContent = 'Arquivo vazio ou sem dados.'; return; }
    const keys = data[0].map(h => HEAD[norm(h)] || null);
    if (!keys.includes('number') || !keys.includes('barcode') || !keys.includes('description')) { $('#ie').textContent = 'Cabeçalho não reconhecido: faltam Número, Nº de barras ou Descrição.'; return; }
    const stMap = { ativo: 'ativo', manutencao: 'manutencao', baixado: 'baixado' };
    rows = data.slice(1).map(r => { const o = {}; keys.forEach((k, i) => { if (k) o[k] = (r[i] || '').trim(); }); if (o.status) o.status = stMap[norm(o.status)] || o.status; return o; });
    $('#ie').textContent = ''; $('#ir').innerHTML = `<p><b>${rows.length}</b> linha(s) prontas para importar.</p>`; $('#go').disabled = false;
  };
  $('#go').onclick = async () => {
    $('#go').disabled = true;
    try {
      const r = await api('/assets/import', { method: 'POST', body: { rows } });
      $('#ir').innerHTML = `<p style="color:var(--ok)"><b>${r.created}</b> importado(s).</p>` + (r.errorCount ? `<p style="color:var(--danger)"><b>${r.errorCount}</b> linha(s) com erro:</p><ul class="hint">${r.errors.map(x => `<li>Linha ${x.line}: ${esc(x.msg)}</li>`).join('')}</ul>` : '');
      refresh();
    } catch (er) { $('#ie').textContent = er.message; }
  };
}

// ---------- início ----------
(async () => {
  try { S.user = (await api('/me')).user; } catch { S.user = null; }
  render();
})();
