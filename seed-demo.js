'use strict';
// Popula uma instância NOVA do sistema com dados fictícios de demonstração.
// Uso:  DATA_DIR=data-demo PORT=3001 node server.js      (anote a senha provisória exibida)
//       INITIAL_PASSWORD=<senha provisória> node seed-demo.js
// Depois acesse http://localhost:3001 com  admin / Demo@2026
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const INITIAL = process.env.INITIAL_PASSWORD;
const DEMO_PASS = 'Demo@2026';
if (!INITIAL) { console.error('Informe INITIAL_PASSWORD (senha provisória do admin).'); process.exit(1); }

let cookie = '';
async function call(method, path, body) {
  const r = await fetch(BASE + '/api' + path, {
    method, headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: BASE },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = r.headers.getSetCookie?.() || [];
  if (sc.length) cookie = sc.map(c => c.split(';')[0]).join('; ');
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path}: ${j.error || r.status}`);
  return j;
}

const A = [
  // número, descrição, categoria, setor, responsável, valor, data
  ['Notebook Dell Latitude 5440', 'Informática', 'TI', 'Marcos Andrade', 6890, '2024-03-12'],
  ['Notebook Dell Latitude 5440', 'Informática', 'Comercial', 'Juliana Prado', 6890, '2024-03-12'],
  ['Notebook Lenovo ThinkPad E14', 'Informática', 'Financeiro', 'Renata Cardoso', 5490, '2023-08-02'],
  ['Notebook Lenovo ThinkPad E14', 'Informática', 'RH', 'Camila Duarte', 5490, '2023-08-02'],
  ['Monitor LG 24" Full HD', 'Informática', 'Financeiro', 'Renata Cardoso', 890, '2023-08-02'],
  ['Monitor LG 24" Full HD', 'Informática', 'Comercial', 'Juliana Prado', 890, '2023-08-02'],
  ['Monitor Dell 27" QHD', 'Informática', 'TI', 'Marcos Andrade', 1790, '2024-03-12'],
  ['Servidor Dell PowerEdge T150', 'Informática', 'TI', 'Marcos Andrade', 14200, '2022-11-21'],
  ['Switch Cisco 24 portas', 'Informática', 'TI', 'Marcos Andrade', 3150, '2022-11-21'],
  ['Impressora HP LaserJet Pro', 'Informática', 'Recepção', 'Patrícia Lemos', 2390, '2023-05-17'],
  ['Projetor Epson PowerLite', 'Informática', 'Diretoria', 'Eduardo Vasconcelos', 3290, '2022-06-30'],
  ['Mesa de reunião 8 lugares', 'Mobiliário', 'Diretoria', 'Eduardo Vasconcelos', 4200, '2021-09-14'],
  ['Cadeira presidente couro', 'Mobiliário', 'Diretoria', 'Eduardo Vasconcelos', 1850, '2021-09-14'],
  ['Cadeira giratória ergonômica', 'Mobiliário', 'Financeiro', 'Renata Cardoso', 980, '2023-08-02'],
  ['Cadeira giratória ergonômica', 'Mobiliário', 'Comercial', 'Juliana Prado', 980, '2023-08-02'],
  ['Cadeira giratória ergonômica', 'Mobiliário', 'RH', 'Camila Duarte', 980, '2023-08-02'],
  ['Mesa em L 1,60 m', 'Mobiliário', 'Financeiro', 'Renata Cardoso', 1390, '2023-08-02'],
  ['Mesa em L 1,60 m', 'Mobiliário', 'Comercial', 'Juliana Prado', 1390, '2023-08-02'],
  ['Armário alto com chave', 'Mobiliário', 'RH', 'Camila Duarte', 1120, '2022-02-09'],
  ['Sofá 3 lugares recepção', 'Mobiliário', 'Recepção', 'Patrícia Lemos', 2680, '2022-02-09'],
  ['Estante de aço almoxarifado', 'Mobiliário', 'Almoxarifado', 'Fábio Teixeira', 740, '2021-04-26'],
  ['Paleteira manual 2 t', 'Equipamentos', 'Almoxarifado', 'Fábio Teixeira', 2150, '2021-04-26'],
  ['Ar-condicionado Split 18.000 BTU', 'Equipamentos', 'Diretoria', 'Eduardo Vasconcelos', 3480, '2022-01-18'],
  ['Ar-condicionado Split 12.000 BTU', 'Equipamentos', 'TI', 'Marcos Andrade', 2790, '2022-11-21'],
  ['Bebedouro industrial', 'Equipamentos', 'Recepção', 'Patrícia Lemos', 1650, '2022-02-09'],
  ['Telefone IP Intelbras', 'Telefonia', 'Recepção', 'Patrícia Lemos', 420, '2023-05-17'],
  ['Smartphone Samsung Galaxy A54', 'Telefonia', 'Comercial', 'Juliana Prado', 1890, '2024-06-05'],
  ['Câmera de segurança IP', 'Segurança', 'Almoxarifado', 'Fábio Teixeira', 560, '2023-10-10'],
  ['Nobreak APC 1500 VA', 'Informática', 'TI', 'Marcos Andrade', 1480, '2022-11-21'],
];

(async () => {
  await call('POST', '/login', { username: 'admin', password: INITIAL });
  await call('POST', '/me/password', { current: INITIAL, password: DEMO_PASS });
  const ids = [];
  for (let i = 0; i < A.length; i++) {
    const [description, category, sector, responsible, value, acquired_at] = A[i];
    const n = 101 + i;
    const r = await call('POST', '/assets', {
      barcode: '78910000' + String(n).padStart(5, '0'), number: 'PAT-' + String(n).padStart(6, '0'),
      description, category, sector, responsible, value, acquired_at, status: 'ativo',
      entry_mode: ['leitor', 'camera', 'manual'][i % 3],
    });
    ids.push(r.asset);
  }
  // movimentações realistas
  const upd = (a, ch, note) => call('PUT', '/assets/' + a.id, { ...a, ...ch, note });
  await upd(ids[1], { sector: 'RH', responsible: 'Camila Duarte' }, 'Remanejado após reestruturação da equipe');
  await upd(ids[5], { sector: 'Diretoria', responsible: 'Eduardo Vasconcelos' }, 'Solicitado pela diretoria');
  await upd(ids[9], { status: 'manutencao' }, 'Atolamento recorrente de papel, enviada para assistência');
  await upd(ids[22], { status: 'manutencao' }, 'Não está gelando, aguardando técnico');
  await upd(ids[6], { responsible: 'Rafael Moura' }, 'Troca de responsável pelo setor de TI');
  await upd(ids[20], { status: 'baixado' }, 'Estrutura danificada, descartada conforme laudo');
  await upd(ids[26], { status: 'baixado' }, 'Aparelho extraviado, registrado em ocorrência');
  // usuários de exemplo
  await call('POST', '/users', { username: 'financeiro', name: 'Renata Cardoso', role: 'user', password: 'Financeiro1' });
  await call('POST', '/users', { username: 'auditoria', name: 'Auditoria Externa', role: 'viewer', password: 'Auditoria1' });
  // inventário do setor de TI (quase completo, com uma leitura fora do setor)
  const inv = await call('POST', '/inventories', { sector: 'TI' });
  const ti = ids.filter(a => a.sector === 'TI');
  for (const a of ti.slice(0, -1)) await call('POST', `/inventories/${inv.id}/scan`, { code: a.barcode });
  await call('POST', `/inventories/${inv.id}/scan`, { code: ids[2].barcode });
  console.log(`Pronto: ${ids.length} bens, 1 inventário. Login: admin / ${DEMO_PASS}`);
})().catch(e => { console.error(e.message); process.exit(1); });
