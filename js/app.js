// ============================================================
// app.js — CARBANK · Potencial SP (refatorado)
// Planilha: ativas → DN, CNPJ, GCM, RAZÃO SOCIAL, CNAE,
//   ENDERECO, Nº, BAIRRO, CIDADE, UF, CEP, ZONA, FILIAL,
//   STATUS, PORTE DA LOJA, CONTRATOS - GERAL, VOLUME - GERAL,
//   CONTRATOS PERFIL CARBANK, VOLUME PERFIL CARBANK,
//   CONTRATOS (prod mensal), PRODUÇÃO (valor financiado)
// ============================================================

const CFG      = window.CARBANK_CONFIG || {};
const SUPA_URL = CFG.supabaseUrl || 'https://rgutyxnpbucwipfvtybu.supabase.co';
const SUPA_KEY = CFG.supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJndXR5eG5wYnVjd2lwZnZ0eWJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDE5NTgsImV4cCI6MjA4OTcxNzk1OH0.EGjSCaTN8y8jT9_4mU4jj9TBGNo-JjbjDGXwkmlBBY8';

// ── CORES POR ZONA (dinâmicas — sem MR fixas) ──
const ZONA_CORES = {
  'Zona Leste':             { cor:'#D85A30', bg:'#FAECE7', txt:'#7F2B10' },
  'Zona Norte':             { cor:'#534AB7', bg:'#EEEDFE', txt:'#26215C' },
  'Zona Sul':               { cor:'#BA7517', bg:'#FAEEDA', txt:'#633806' },
  'Zona Oeste':             { cor:'#0891B2', bg:'#E0F5FA', txt:'#0C4A6E' },
  'Centro':                 { cor:'#6B7280', bg:'#F1F3F5', txt:'#1F2532' },
  'Guarulhos':              { cor:'#0F6E56', bg:'#E1F5EE', txt:'#04342C' },
  'Mogi das Cruzes':        { cor:'#185FA5', bg:'#E6F1FB', txt:'#042C53' },
  'Suzano':                 { cor:'#378ADD', bg:'#EAF3FB', txt:'#042C53' },
  'Itaquaquecetuba':        { cor:'#7C3AED', bg:'#F3EFFE', txt:'#3B1875' },
  'Ferraz De Vasconcelos':  { cor:'#B45309', bg:'#FEF3C7', txt:'#6B3800' },
  'Poá':                    { cor:'#065F46', bg:'#D1FAE5', txt:'#022C22' },
  'Arujá':                  { cor:'#9D174D', bg:'#FDE8F0', txt:'#500D28' },
  'Santa Isabel':           { cor:'#92400E', bg:'#FDE8CC', txt:'#451E07' },
  'Francisco Morato':       { cor:'#1E40AF', bg:'#DBEAFE', txt:'#0F1E6B' },
  'São Bernardo do Campo':  { cor:'#047857', bg:'#D1FAE5', txt:'#022C22' },
};
function zonaColor(zona) {
  return ZONA_CORES[zona] || { cor:'#9DA3B0', bg:'#F1F3F5', txt:'#1F2532' };
}

// Coordenadas centrais para o mapa (scatter por zona)
const ZONA_GEO = {
  'Zona Leste':             { lat:-23.548, lng:-46.500, scatter:0.04 },
  'Zona Norte':             { lat:-23.480, lng:-46.645, scatter:0.035 },
  'Zona Sul':               { lat:-23.660, lng:-46.660, scatter:0.04 },
  'Zona Oeste':             { lat:-23.560, lng:-46.720, scatter:0.035 },
  'Centro':                 { lat:-23.549, lng:-46.643, scatter:0.020 },
  'Guarulhos':              { lat:-23.455, lng:-46.533, scatter:0.030 },
  'Mogi das Cruzes':        { lat:-23.522, lng:-46.190, scatter:0.025 },
  'Suzano':                 { lat:-23.541, lng:-46.313, scatter:0.020 },
  'Itaquaquecetuba':        { lat:-23.487, lng:-46.348, scatter:0.018 },
  'Ferraz De Vasconcelos':  { lat:-23.541, lng:-46.370, scatter:0.015 },
  'Poá':                    { lat:-23.530, lng:-46.343, scatter:0.012 },
  'Arujá':                  { lat:-23.400, lng:-46.320, scatter:0.015 },
  'Santa Isabel':           { lat:-23.315, lng:-46.220, scatter:0.015 },
  'Francisco Morato':       { lat:-23.283, lng:-46.742, scatter:0.015 },
  'São Bernardo do Campo':  { lat:-23.694, lng:-46.564, scatter:0.028 },
};

const GCM_COLORS = [
  '#D85A30','#534AB7','#0F6E56','#185FA5','#BA7517',
  '#993C1D','#7F77DD','#1D9E75','#378ADD','#854F0B',
  '#F0997B','#3C3489','#085041','#9D174D','#0891B2',
];

const PORTE_CORES = {
  'F. > 30 GRAVAMES':  '#1565C0',
  'E. 21-30 GRAVAMES': '#42A5F5',
  'D. 11-20 GRAVAMES': '#26A69A',
  'C. 6-10 GRAVAMES':  '#66BB6A',
  'B. 2-5 GRAVAMES':   '#FFA726',
  'A. 1 GRAVAME':      '#EF5350',
};

let allLojas       = [];
let filteredLojas  = [];
let gcmColorMap    = {};
let currentPage    = 1;
const PAGE_SIZE    = 60;
let mapInstance    = null;
let mapMarkers     = [];
let mapaInit       = false;
let parsedData     = [];
let sb             = null;

// ── SUPABASE INIT ──
function initSupabase() {
  if (!SUPA_URL || !SUPA_KEY) return false;
  sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
  return true;
}

// ── LOAD LOJAS ──
async function loadLojas() {
  showLoading(true, 'Carregando lojas...');
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 12000)
    );
    const query = sb.from('lojas_sp').select('*').order('gcm').order('razao_social');
    const { data, error } = await Promise.race([query, timeout]);
    if (error) throw error;
    allLojas = data || [];
    buildGCMColors();
    renderAll();
  } catch(e) {
    showToast(e.message === 'timeout'
      ? 'Supabase demorou — verifique config.js'
      : 'Erro: ' + e.message, 'error');
    allLojas = [];
    renderAll();
  } finally {
    showLoading(false);
  }
}

function buildGCMColors() {
  const gcms = [...new Set(allLojas.map(l => l.gcm).filter(Boolean))].sort();
  gcms.forEach((g, i) => { gcmColorMap[g] = GCM_COLORS[i % GCM_COLORS.length]; });
}

// ── RENDER ALL ──
function renderAll() {
  const active = allLojas.filter(l => l.status === 'ATIVO');
  document.getElementById('badge-total').textContent = active.length + ' lojas ativas';
  renderDashboard(active);
  renderGCMPage(active);
  populateFilters();
  applyTableFilters();
}

// ═══════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════
function renderDashboard(active) {
  const totalLojas    = active.length;
  const totalContPerf = active.reduce((s, l) => s + (l.contratos_perfil || 0), 0);
  const totalVolPerf  = active.reduce((s, l) => s + (l.volume_perfil || 0), 0);
  const totalProdCont = active.reduce((s, l) => s + (l.contratos_mes || 0), 0);
  const totalProdVal  = active.reduce((s, l) => s + (l.producao_valor || 0), 0);
  const totalGCMs     = new Set(active.map(l => l.gcm).filter(Boolean)).size;

  document.getElementById('m-lojas').textContent        = totalLojas.toLocaleString('pt-BR');
  document.getElementById('m-contratos-perfil').textContent = totalContPerf.toLocaleString('pt-BR');
  document.getElementById('m-volume-perfil').textContent    = fmtK(totalVolPerf);
  document.getElementById('m-producao').textContent         = totalProdCont.toLocaleString('pt-BR');
  document.getElementById('m-producao-sub').textContent     = `R$ ${fmtK(totalProdVal)} financiados`;
  document.getElementById('m-gcms').textContent             = totalGCMs;

  renderZonaCards(active);
  renderChartVolumeZona(active);
  renderChartPorte(active);
}

function renderZonaCards(active) {
  const container = document.getElementById('zona-cards-dash');
  container.innerHTML = '';
  const zonas = [...new Set(active.map(l => l.zona).filter(Boolean))].sort();
  const maxLojas = Math.max(...zonas.map(z => active.filter(l => l.zona === z).length), 1);

  zonas.forEach(zona => {
    const lojas    = active.filter(l => l.zona === zona);
    const meta     = zonaColor(zona);
    const gcms     = [...new Set(lojas.map(l => l.gcm).filter(Boolean))];
    const contPerf = lojas.reduce((s, l) => s + (l.contratos_perfil || 0), 0);
    const volPerf  = lojas.reduce((s, l) => s + (l.volume_perfil || 0), 0);
    const prodCont = lojas.reduce((s, l) => s + (l.contratos_mes || 0), 0);
    const prodVal  = lojas.reduce((s, l) => s + (l.producao_valor || 0), 0);
    const pct      = Math.round(lojas.length / maxLojas * 100);
    const taxaProd = contPerf > 0 ? Math.round(prodCont / contPerf * 100) : 0;

    container.innerHTML += `
    <div class="card" style="border-top:3px solid ${meta.cor};">
      <div class="card-header" style="background:${meta.bg};">
        <span style="font-size:12px;font-weight:700;color:${meta.txt};">${zona}</span>
        <span style="font-size:11px;font-weight:600;color:${meta.txt};opacity:.8;">${lojas.length} lojas</span>
      </div>
      <div class="card-body">
        <div class="progress" style="margin-bottom:12px;">
          <div class="progress-fill" style="width:${pct}%;background:${meta.cor};"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div>
            <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase;letter-spacing:.3px;margin-bottom:2px;">Contr. Perfil CB</div>
            <div style="font-size:20px;font-weight:700;color:${meta.cor};">${contPerf}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase;letter-spacing:.3px;margin-bottom:2px;">Vol. Perfil CB</div>
            <div style="font-size:16px;font-weight:700;color:${meta.cor};">${fmtK(volPerf)}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;background:${meta.cor}12;border-radius:7px;margin-bottom:10px;">
          <div>
            <div style="font-size:10px;color:${meta.txt};opacity:.8;margin-bottom:2px;">Prod. Mês (qtd)</div>
            <div style="font-size:16px;font-weight:700;color:${meta.txt};">${prodCont} <span style="font-size:10px;font-weight:400;">(${taxaProd}%)</span></div>
          </div>
          <div>
            <div style="font-size:10px;color:${meta.txt};opacity:.8;margin-bottom:2px;">Prod. Mês (R$)</div>
            <div style="font-size:13px;font-weight:700;color:${meta.txt};">${fmtK(prodVal)}</div>
          </div>
        </div>
        <div style="border-top:1px solid ${meta.cor}25;padding-top:8px;">
          <div style="font-size:10px;color:var(--gray-500);margin-bottom:4px;">GCMs</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${gcms.map(g => `<span style="background:${gcmColorMap[g]||'#888'}20;color:${gcmColorMap[g]||'#888'};font-size:10px;font-weight:600;padding:2px 6px;border-radius:8px;">${g.split(' ')[0]}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  });
}

function renderChartVolumeZona(active) {
  const container = document.getElementById('chart-volume-zona');
  container.innerHTML = '';
  const zonas = [...new Set(active.map(l => l.zona).filter(Boolean))];
  const data = zonas.map(z => ({
    zona: z,
    meta: zonaColor(z),
    vol:  active.filter(l => l.zona === z).reduce((s, l) => s + (l.volume_perfil || 0), 0),
    lojas: active.filter(l => l.zona === z).length,
  })).filter(d => d.vol > 0).sort((a, b) => b.vol - a.vol);
  const maxV = data[0]?.vol || 1;

  data.forEach(d => {
    container.innerHTML += `
    <div class="bar-chart-row">
      <div class="bar-chart-label" style="color:${d.meta.txt};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;" title="${d.zona}">${d.zona}</div>
      <div class="bar-chart-track">
        <div class="bar-chart-fill" style="width:${Math.round(d.vol/maxV*100)}%;background:${d.meta.cor};"></div>
      </div>
      <div class="bar-chart-val" style="color:${d.meta.cor};">${fmtK(d.vol)}</div>
    </div>`;
  });
}

function renderChartPorte(active) {
  const container = document.getElementById('porte-chart');
  const portes = [
    { key:'F. > 30 GRAVAMES',   bg:'#1565C0' },
    { key:'E. 21-30 GRAVAMES',  bg:'#42A5F5' },
    { key:'D. 11-20 GRAVAMES',  bg:'#26A69A' },
    { key:'C. 6-10 GRAVAMES',   bg:'#66BB6A' },
    { key:'B. 2-5 GRAVAMES',    bg:'#FFA726' },
    { key:'A. 1 GRAVAME',       bg:'#EF5350' },
  ];
  const total = active.length;
  const maxN  = Math.max(...portes.map(p => active.filter(l => l.porte === p.key).length), 1);
  container.innerHTML = portes.map(p => {
    const n   = active.filter(l => l.porte === p.key).length;
    if (!n) return '';
    const pct = Math.round(n / total * 100);
    return `<div class="bar-chart-row" style="margin-bottom:10px;">
      <div style="width:165px;flex-shrink:0;">
        <span style="background:${p.bg};color:#fff;font-size:10px;font-weight:600;padding:3px 7px;border-radius:5px;white-space:nowrap;">${p.key}</span>
      </div>
      <div class="bar-chart-track">
        <div class="bar-chart-fill" style="width:${Math.round(n/maxN*100)}%;background:${p.bg};"></div>
      </div>
      <div style="font-size:11px;font-weight:600;min-width:55px;text-align:right;color:${p.bg};">${n} <span style="color:var(--gray-400);font-weight:400;">(${pct}%)</span></div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════
// GCM PAGE
// ═══════════════════════════════════════════════
function renderGCMPage(active) {
  const container = document.getElementById('gcm-cards');
  container.innerHTML = '';

  const gcmMap = {};
  active.forEach(l => {
    const g = l.gcm || 'Sem GCM';
    if (!gcmMap[g]) gcmMap[g] = { lojas:[], contPerf:0, volPerf:0, contGeral:0, volGeral:0, prodCont:0, prodVal:0, zonas:new Set() };
    gcmMap[g].lojas.push(l);
    gcmMap[g].contPerf  += (l.contratos_perfil || 0);
    gcmMap[g].volPerf   += (l.volume_perfil || 0);
    gcmMap[g].contGeral += (l.contratos_geral || 0);
    gcmMap[g].volGeral  += (l.volume_geral || 0);
    gcmMap[g].prodCont  += (l.contratos_mes || 0);
    gcmMap[g].prodVal   += (l.producao_valor || 0);
    if (l.zona) gcmMap[g].zonas.add(l.zona);
  });

  const sorted = Object.entries(gcmMap).sort((a, b) => b[1].volPerf - a[1].volPerf);
  const maxVol = sorted[0]?.[1].volPerf || 1;

  sorted.forEach(([nome, d]) => {
    const cor      = gcmColorMap[nome] || '#888';
    const pct      = Math.round(d.volPerf / maxVol * 100);
    const initials = nome.split(' ').slice(0, 2).map(w => w[0]).join('');
    const zonas    = [...d.zonas].sort();
    const taxaProd = d.contPerf > 0 ? Math.round(d.prodCont / d.contPerf * 100) : 0;

    const porteCounts = {};
    d.lojas.forEach(l => { porteCounts[l.porte] = (porteCounts[l.porte] || 0) + 1; });

    container.innerHTML += `
    <div class="card" style="border-top:3px solid ${cor};">
      <div class="card-header" style="background:${cor}0E;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:42px;height:42px;border-radius:50%;background:${cor}22;color:${cor};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">${initials}</div>
          <div>
            <div style="font-weight:600;font-size:13px;color:var(--gray-800);">${nome}</div>
            <div style="font-size:11px;color:var(--gray-500);">${d.lojas.length} lojas · ${zonas.slice(0,3).join(', ')}${zonas.length > 3 ? '...' : ''}</div>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="progress" style="margin-bottom:12px;">
          <div class="progress-fill" style="width:${pct}%;background:${cor};"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase;">Contr. CB</div>
            <div style="font-size:20px;font-weight:700;color:${cor};">${d.contPerf}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase;">Vol. CB</div>
            <div style="font-size:16px;font-weight:700;color:${cor};">${fmtK(d.volPerf)}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase;">Lojas</div>
            <div style="font-size:20px;font-weight:700;color:var(--gray-700);">${d.lojas.length}</div>
          </div>
        </div>
        <div style="padding:8px;background:${cor}10;border-radius:7px;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <div>
            <div style="font-size:10px;color:var(--gray-500);">Prod. Mês</div>
            <div style="font-size:16px;font-weight:700;color:${cor};">${d.prodCont} <span style="font-size:10px;font-weight:400;color:var(--gray-500);">(${taxaProd}%)</span></div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--gray-500);">Val. Financiado</div>
            <div style="font-size:13px;font-weight:700;color:${cor};">${fmtK(d.prodVal)}</div>
          </div>
        </div>
        <div style="border-top:1px solid var(--gray-100);padding-top:8px;">
          <div style="font-size:10px;color:var(--gray-500);margin-bottom:5px;">DISTRIBUIÇÃO POR PORTE</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${Object.entries(porteCounts).sort((a, b) => b[1] - a[1]).map(([p, n]) =>
              `<span style="background:${porteBg(p)};color:#fff;font-size:10px;font-weight:600;padding:2px 6px;border-radius:5px;">${p.charAt(0)} ×${n}</span>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>`;
  });
}

// ═══════════════════════════════════════════════
// PLANILHA
// ═══════════════════════════════════════════════
function populateFilters() {
  // GCMs
  const gcms = [...new Set(allLojas.map(l => l.gcm).filter(Boolean))].sort();
  const opts  = gcms.map(g => `<option value="${g}">${g}</option>`).join('');
  ['f-gcm', 'mapa-gcm-filter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">Todos os GCMs</option>${opts}`;
  });

  // Zonas
  const zonas = [...new Set(allLojas.map(l => l.zona).filter(Boolean))].sort();
  const zonaOpts = zonas.map(z => `<option value="${z}">${z}</option>`).join('');
  ['f-zona', 'mapa-zona-filter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">Todas as zonas</option>${zonaOpts}`;
  });

  // Eventos
  ['f-busca','f-zona','f-gcm','f-porte','f-status'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.removeEventListener('input', applyTableFilters); el.removeEventListener('change', applyTableFilters); }
    el?.addEventListener('input',  applyTableFilters);
    el?.addEventListener('change', applyTableFilters);
  });
  ['mapa-zona-filter','mapa-gcm-filter','mapa-porte-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', refreshMapa);
  });
}

function applyTableFilters() {
  const search = document.getElementById('f-busca')?.value?.toLowerCase() || '';
  const zona   = document.getElementById('f-zona')?.value || '';
  const gcm    = document.getElementById('f-gcm')?.value || '';
  const porte  = document.getElementById('f-porte')?.value || '';
  const status = document.getElementById('f-status')?.value || '';

  filteredLojas = allLojas.filter(l => {
    if (status && l.status !== status) return false;
    if (!status && l.status === 'INATIVO') return false; // padrão: sem INATIVO
    if (zona  && l.zona  !== zona)  return false;
    if (gcm   && l.gcm   !== gcm)   return false;
    if (porte && l.porte !== porte) return false;
    if (search) {
      const h = [l.razao_social, l.bairro, l.gcm, l.cnpj, l.dn].join(' ').toLowerCase();
      if (!h.includes(search)) return false;
    }
    return true;
  });
  currentPage = 1;
  renderTable();
  document.getElementById('tbl-count').textContent = `${filteredLojas.length} registros`;
}

function renderTable() {
  const tbody   = document.getElementById('lojas-tbody');
  const start   = (currentPage - 1) * PAGE_SIZE;
  const pageData = filteredLojas.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = pageData.map(l => {
    const gcmCor  = gcmColorMap[l.gcm] || '#888';
    const zmeta   = zonaColor(l.zona);
    const taxaProd = l.contratos_perfil > 0 ? Math.round((l.contratos_mes || 0) / l.contratos_perfil * 100) : 0;
    const prodCor  = prodFaixaCor(taxaProd, l.contratos_mes);

    return `
    <tr class="${l.status === 'INATIVO' ? 'inativo' : l.status === 'NAO CADASTRADO' ? 'nao-cad' : ''}">
      <td style="text-align:center;">
        ${l.dn ? `<span style="background:#F3F0FF;color:#4C1D95;font-size:11px;font-weight:700;padding:2px 7px;border-radius:6px;">${l.dn}</span>` : '<span style="color:#ccc;font-size:11px;">—</span>'}
      </td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:${gcmCor};">
          <span style="width:8px;height:8px;border-radius:50%;background:${gcmCor};flex-shrink:0;"></span>
          ${l.gcm || '—'}
        </span>
      </td>
      <td style="max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${l.razao_social}">${l.razao_social}</td>
      <td style="font-size:12px;color:var(--gray-600);">${l.bairro || '—'}</td>
      <td>
        <span style="background:${zmeta.bg};color:${zmeta.txt};font-size:10px;font-weight:600;padding:2px 7px;border-radius:8px;white-space:nowrap;">${l.zona || '—'}</span>
      </td>
      <td>${porteBadge(l.porte)}</td>
      <td style="text-align:center;background:#f0faf3;">
        ${l.contratos_mes != null
          ? `<span style="background:${prodCor.bg};color:${prodCor.cor};font-size:11px;font-weight:700;padding:2px 7px;border-radius:6px;">${l.contratos_mes} <span style="font-size:10px;font-weight:400;">(${taxaProd}%)</span></span>`
          : '<span style="color:#ccc;font-size:11px;">—</span>'}
      </td>
      <td style="text-align:right;background:#f0faf3;">
        ${l.producao_valor != null
          ? `<span style="font-size:11px;font-weight:600;color:${prodCor.cor};">${fmtBRL(l.producao_valor)}</span>`
          : '<span style="color:#ccc;font-size:11px;">—</span>'}
      </td>
      <td style="text-align:center;background:#EBF4FF;font-weight:600;color:#185FA5;">${l.contratos_perfil || 0}</td>
      <td style="text-align:right;background:#EBF4FF;color:#185FA5;">${fmtBRL(l.volume_perfil)}</td>
      <td style="text-align:center;color:var(--gray-600);">${l.contratos_geral || 0}</td>
      <td style="text-align:right;color:var(--gray-600);">${fmtBRL(l.volume_geral)}</td>
      <td style="text-align:center;">${statusBadge(l.status)}</td>
    </tr>`;
  }).join('');

  renderPagination();
}

function renderPagination() {
  const total   = filteredLojas.length;
  const pages   = Math.ceil(total / PAGE_SIZE);
  const el      = document.getElementById('paginacao');
  if (pages <= 1) { el.innerHTML = ''; return; }
  let html = `<span style="font-size:12px;color:var(--gray-600);">Pág. ${currentPage} de ${pages} · ${total} registros</span>`;
  if (currentPage > 1)     html += `<button class="btn btn-ghost btn-sm" onclick="goPage(${currentPage-1})">← Ant.</button>`;
  if (currentPage < pages) html += `<button class="btn btn-ghost btn-sm" onclick="goPage(${currentPage+1})">Próx. →</button>`;
  el.innerHTML = html;
}

function goPage(p) { currentPage = p; renderTable(); window.scrollTo(0, 200); }

// ═══════════════════════════════════════════════
// MAPA
// ═══════════════════════════════════════════════
function initMapa() {
  if (mapaInit) { refreshMapa(); return; }
  mapaInit = true;
  mapInstance = L.map('mapa-container', { zoomControl:true, scrollWheelZoom:true })
    .setView([-23.530, -46.550], 10);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution:'&copy; OpenStreetMap &copy; CARTO', maxZoom:18
  }).addTo(mapInstance);
  refreshMapa();
}

function refreshMapa() {
  if (!mapInstance) return;
  mapMarkers.forEach(m => { try { m.remove(); } catch(e) {} });
  mapMarkers = [];

  const filterZona  = document.getElementById('mapa-zona-filter')?.value  || '';
  const filterGCM   = document.getElementById('mapa-gcm-filter')?.value   || '';
  const filterPorte = document.getElementById('mapa-porte-filter')?.value || '';

  const active = allLojas.filter(l => l.status === 'ATIVO');
  const toPlot = active.filter(l => {
    if (filterZona  && l.zona  !== filterZona)  return false;
    if (filterGCM   && l.gcm   !== filterGCM)   return false;
    if (filterPorte && l.porte !== filterPorte) return false;
    return true;
  });

  // Círculos de área por zona
  const zonas = [...new Set(toPlot.map(l => l.zona).filter(Boolean))];
  zonas.forEach(zona => {
    const geo    = ZONA_GEO[zona];
    const meta   = zonaColor(zona);
    const nLojas = toPlot.filter(l => l.zona === zona).length;
    if (!geo || !nLojas) return;
    const c = L.circleMarker([geo.lat, geo.lng], {
      radius: 20 + (nLojas / 50) * 30,
      fillColor: meta.cor, color: '#fff',
      weight: 1.5, opacity: 1, fillOpacity: 0.10
    }).addTo(mapInstance);
    mapMarkers.push(c);
  });

  // Injeta keyframes de pulso uma unica vez
  if (!document.getElementById('cb-pulse-style')) {
    const s = document.createElement('style');
    s.id = 'cb-pulse-style';
    s.textContent = '@keyframes cb-pulse {' +
      '0%   { transform:translate(-50%,-50%) scale(1);   opacity:.8; }' +
      '70%  { transform:translate(-50%,-50%) scale(2.8); opacity:0; }' +
      '100% { transform:translate(-50%,-50%) scale(1);   opacity:0; } }';
    document.head.appendChild(s);
  }

  // Modo individual: GCM especifico selecionado -> cor do ponto = faixa de producao
  const modoGCM = !!filterGCM;

  // Pontos individuais com scatter por zona
  toPlot.forEach(l => {
    const geo    = ZONA_GEO[l.zona];
    const zmeta  = zonaColor(l.zona);
    const gcmCor = gcmColorMap[l.gcm] || zmeta.cor;
    if (!geo) return;

    const sc   = geo.scatter || 0.03;
    const jLat = geo.lat + (Math.random() - 0.5) * sc;
    const jLng = geo.lng + (Math.random() - 0.5) * sc * 1.2;

    const taxaProd = l.contratos_perfil > 0
      ? Math.round((l.contratos_mes || 0) / l.contratos_perfil * 100)
      : (l.contratos_mes != null ? 0 : -1);
    const prodInfo = l.contratos_mes != null ? prodFaixaCor(taxaProd, l.contratos_mes) : null;

    // No modo GCM individual: fill = cor da faixa de producao; caso contrario = cor do GCM
    const fillCor = (modoGCM && prodInfo) ? prodInfo.cor : gcmCor;
    const isZero  = modoGCM && prodInfo && taxaProd === 0;

    const taxaStr = taxaProd >= 0 ? taxaProd + '%' : '\u2014';
    const popupHtml =
      '<div style="font-family:sans-serif;min-width:215px;">' +
        '<div style="background:' + zmeta.bg + ';padding:8px 10px;border-radius:6px 6px 0 0;margin:-12px -12px 8px;">' +
          '<span style="background:' + zmeta.cor + ';color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;">' + l.zona + '</span>' +
          '<div style="font-size:11px;font-weight:600;color:' + zmeta.txt + ';margin-top:4px;line-height:1.3;">' + l.razao_social + '</div>' +
        '</div>' +
        '<div style="font-size:11px;color:#777;margin-bottom:6px;">' + (l.bairro || '') + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;margin-bottom:6px;">' +
          '<div><span style="color:#aaa;">Contr. Perfil CB</span><br><strong style="color:#185FA5;">' + (l.contratos_perfil || 0) + '</strong></div>' +
          '<div><span style="color:#aaa;">Vol. Perfil CB</span><br><strong style="color:#185FA5;">' + fmtBRL(l.volume_perfil) + '</strong></div>' +
        '</div>' +
        (prodInfo ?
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;margin-bottom:6px;">' +
            '<div><span style="color:#aaa;">Prod. (qtd)</span><br><strong style="color:' + prodInfo.cor + ';">' + (l.contratos_mes || 0) + ' (' + taxaStr + ')</strong></div>' +
            '<div><span style="color:#aaa;">Val. Financiado</span><br><strong style="color:' + prodInfo.cor + ';">' + fmtBRL(l.producao_valor) + '</strong></div>' +
          '</div>' +
          '<div style="background:' + prodInfo.cor + '22;color:' + prodInfo.cor + ';font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;margin-bottom:5px;">' +
            taxaStr + ' do potencial' + (isZero ? ' \uD83D\uDD34 CRITICO' : '') +
          '</div>'
        : '') +
        '<div style="background:' + gcmCor + '20;color:' + gcmCor + ';font-size:11px;font-weight:600;padding:4px 8px;border-radius:6px;">' + (l.porte || '\u2014') + '</div>' +
        (l.gcm ? '<div style="margin-top:5px;font-size:11px;font-weight:600;color:' + gcmCor + ';">\uD83D\uDC64 ' + l.gcm + '</div>' : '') +
      '</div>';

    let dot;
    if (isZero) {
      // Ponto pulsante vermelho para 0% critico
      const icon = L.divIcon({
        className: '',
        html: '<div style="position:relative;width:22px;height:22px;">' +
          '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
            'width:12px;height:12px;border-radius:50%;background:#C0392B;z-index:2;"></div>' +
          '<div style="position:absolute;top:50%;left:50%;' +
            'width:12px;height:12px;border-radius:50%;background:#C0392B;' +
            'animation:cb-pulse 1.3s ease-out infinite;"></div>' +
        '</div>',
        iconSize:   [22, 22],
        iconAnchor: [11, 11],
      });
      dot = L.marker([jLat, jLng], { icon: icon, zIndexOffset: 300 }).addTo(mapInstance);
    } else {
      dot = L.circleMarker([jLat, jLng], {
        radius:      7,
        fillColor:   fillCor,
        color:       '#fff',
        weight:      1.5,
        opacity:     1,
        fillOpacity: 0.92,
      }).addTo(mapInstance);
      dot.on('mouseover', function() { this.setStyle({radius:9}); });
      dot.on('mouseout',  function() { this.setStyle({radius:7}); });
    }

    dot.bindPopup(popupHtml, {offset:[0,-3]});
    mapMarkers.push(dot);
  });

  // Legenda
  const legEl = document.getElementById('mapa-legend');
  if (legEl) {
    if (modoGCM) {
      legEl.innerHTML =
        '<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">' +
        '<span style="font-size:10px;color:var(--gray-500);font-weight:600;margin-right:2px;">Performance:</span>' +
        '<span style="display:inline-flex;align-items:center;gap:4px;background:#185FA520;color:#185FA5;font-size:10px;font-weight:700;padding:3px 9px;border-radius:10px;"><span style="width:9px;height:9px;border-radius:50%;background:#185FA5;display:inline-block;"></span>&gt;15%</span>' +
        '<span style="display:inline-flex;align-items:center;gap:4px;background:#1D9E7520;color:#1D9E75;font-size:10px;font-weight:700;padding:3px 9px;border-radius:10px;"><span style="width:9px;height:9px;border-radius:50%;background:#1D9E75;display:inline-block;"></span>10-15%</span>' +
        '<span style="display:inline-flex;align-items:center;gap:4px;background:#BA751720;color:#BA7517;font-size:10px;font-weight:700;padding:3px 9px;border-radius:10px;"><span style="width:9px;height:9px;border-radius:50%;background:#BA7517;display:inline-block;"></span>6-9%</span>' +
        '<span style="display:inline-flex;align-items:center;gap:4px;background:#D85A3020;color:#D85A30;font-size:10px;font-weight:700;padding:3px 9px;border-radius:10px;"><span style="width:9px;height:9px;border-radius:50%;background:#D85A30;display:inline-block;"></span>1-5%</span>' +
        '<span style="display:inline-flex;align-items:center;gap:4px;background:#C0392B20;color:#C0392B;font-size:10px;font-weight:700;padding:3px 9px;border-radius:10px;"><span style="width:9px;height:9px;border-radius:50%;background:#C0392B;display:inline-block;animation:cb-pulse 1.3s ease-out infinite;"></span>0% cr\u00edtico</span>' +
        '</div>';
    } else {
      const gcmList = [...new Set(toPlot.map(l => l.gcm).filter(Boolean))];
      legEl.innerHTML = gcmList.map(function(g) {
        return '<span style="display:inline-flex;align-items:center;gap:5px;background:' + gcmColorMap[g] + '18;color:' + gcmColorMap[g] + ';font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px;">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' + gcmColorMap[g] + ';display:inline-block;"></span>' + g.split(' ')[0] +
        '</span>';
      }).join('');
    }
  }
// ═══════════════════════════════════════════════
// NAVEGAÇÃO
// ═══════════════════════════════════════════════
function switchPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id)?.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t => {
    if (t.getAttribute('onclick')?.includes(`'${id}'`)) t.classList.add('active');
  });
  if (id === 'mapa') setTimeout(initMapa, 120);
}

// ═══════════════════════════════════════════════
// UPLOAD / IMPORTAÇÃO
// ═══════════════════════════════════════════════
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
}

function handleFile(file) {
  if (!file) return;
  if (!file.name.match(/\.(xlsx|xlsm)$/i)) {
    showToast('Use um arquivo .xlsx ou .xlsm', 'error'); return;
  }
  document.getElementById('drop-zone').innerHTML = `
    <div style="font-size:32px;margin-bottom:8px;">⏳</div>
    <div style="font-size:14px;font-weight:600;color:var(--verde);">Lendo ${file.name}...</div>`;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(e.target.result, { type:'array' });
      // Prioriza aba "ativas", senão usa a primeira
      const sheetName = wb.SheetNames.includes('ativas') ? 'ativas' : wb.SheetNames[0];
      const ws   = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
      parsedData = processarPlanilha(rows);
      mostrarPreview(parsedData, file.name, sheetName);
    } catch(err) {
      showToast('Erro ao ler planilha: ' + err.message, 'error');
      resetDropZone();
    }
  };
  reader.readAsArrayBuffer(file);
}

function processarPlanilha(rows) {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  const findCol = (...names) =>
    keys.find(k => names.some(n => k.toUpperCase().trim() === n.toUpperCase().trim())) ||
    keys.find(k => names.some(n => k.toUpperCase().includes(n.toUpperCase()))) || '';

  // Mapeamento flexível das colunas
  const colDN       = findCol('DN');
  const colCNPJ     = findCol('CNPJ');
  const colGCM      = findCol('GCM');
  const colRazao    = findCol('RAZÃO SOCIAL', 'RAZAO SOCIAL', 'SOCIAL');
  const colCNAE     = findCol('CNAE');
  const colEnder    = findCol('ENDERECO', 'ENDEREÇO');
  const colNum      = findCol('Nº', 'NUMERO', 'NÚMERO', 'NUM');
  const colBairro   = findCol('BAIRRO');
  const colCidade   = findCol('CIDADE');
  const colUF       = findCol('UF');
  const colCEP      = findCol('CEP');
  const colZona     = findCol('ZONA');
  const colFilial   = findCol('FILIAL');
  const colStatus   = findCol('STATUS');
  const colPorte    = findCol('PORTE DA LOJA', 'PORTE');
  const colContG    = findCol('CONTRATOS - GERAL', 'CONTRATOS GERAL');
  const colVolG     = findCol('VOLUME - GERAL', 'VOLUME GERAL');
  const colContPerf = findCol('CONTRATOS PERFIL CARBANK', 'CONTRATOS PERFIL', 'CONTRATOS CB');
  const colVolPerf  = findCol('VOLUME PERFIL CARBANK', 'VOLUME PERFIL', 'VOLUME CB');
  const colContMes  = findCol('CONTRATOS');   // produção do mês (qtd)
  const colProdVal  = findCol('PRODUÇÃO', 'PRODUCAO'); // valor financiado

  function cleanNum(v) {
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  function cleanStr(v) { return String(v || '').trim(); }
  function cleanCNPJ(v) {
    return String(v || '').replace(/\D/g, '').padStart(14, '0').slice(-14);
  }

  const seen   = new Set();
  const result = [];

  rows.forEach(r => {
    const cnpj = cleanCNPJ(r[colCNPJ]);
    if (!cnpj || cnpj === '00000000000000') return;
    if (seen.has(cnpj)) return;
    seen.add(cnpj);

    const contMes = colContMes ? cleanNum(r[colContMes]) : null;
    const prodVal = colProdVal ? (cleanNum(r[colProdVal]) || null) : null;

    result.push({
      dn:              cleanStr(r[colDN]).replace('.0', '') || null,
      cnpj,
      gcm:             cleanStr(r[colGCM]),
      razao_social:    cleanStr(r[colRazao]),
      cnae:            cleanStr(r[colCNAE]),
      endereco:        cleanStr(r[colEnder]),
      numero:          cleanStr(r[colNum]),
      bairro:          cleanStr(r[colBairro]),
      cidade:          cleanStr(r[colCidade]) || 'SAO PAULO',
      uf:              cleanStr(r[colUF]) || 'SP',
      cep:             cleanStr(r[colCEP]).replace(/\D/g, '').padStart(8, '0'),
      zona:            cleanStr(r[colZona]),
      filial:          cleanStr(r[colFilial]),
      status:          cleanStr(r[colStatus]) || 'ATIVO',
      porte:           cleanStr(r[colPorte]),
      contratos_geral: cleanNum(r[colContG]),
      volume_geral:    cleanNum(r[colVolG]),
      contratos_perfil: cleanNum(r[colContPerf]),
      volume_perfil:   cleanNum(r[colVolPerf]),
      contratos_mes:   contMes !== null && contMes !== '' ? contMes : null,
      producao_valor:  prodVal,
      ativo:           cleanStr(r[colStatus]).toUpperCase() === 'ATIVO',
    });
  });

  return result;
}

function mostrarPreview(data, filename, sheetName) {
  document.getElementById('drop-zone').innerHTML = `
    <div style="font-size:28px;margin-bottom:8px;">✅</div>
    <div style="font-size:14px;font-weight:600;color:var(--verde-dk);">${filename}</div>
    <div style="font-size:12px;color:var(--gray-600);margin-top:4px;">Aba: <strong>${sheetName}</strong> · ${data.length} lojas únicas processadas</div>
    <div style="font-size:11px;color:var(--gray-400);margin-top:6px;cursor:pointer;text-decoration:underline;" onclick="document.getElementById('file-input').click()">Trocar arquivo</div>
    <input type="file" id="file-input" accept=".xlsx,.xlsm" style="display:none" onchange="handleFile(this.files[0])"/>`;

  const gcms       = new Set(data.map(d => d.gcm).filter(Boolean)).size;
  const zonas      = new Set(data.map(d => d.zona).filter(Boolean)).size;
  const totalVol   = data.reduce((s, d) => s + (d.volume_perfil || 0), 0);
  const comProd    = data.filter(d => d.contratos_mes != null).length;
  const totalProd  = data.reduce((s, d) => s + (d.contratos_mes || 0), 0);
  const statusMap  = {};
  data.forEach(d => { statusMap[d.status] = (statusMap[d.status] || 0) + 1; });

  document.getElementById('preview-metrics').innerHTML = `
    <div style="padding:10px;background:var(--gray-50);border-radius:8px;text-align:center;">
      <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase;margin-bottom:4px;">Lojas</div>
      <div style="font-size:22px;font-weight:700;">${data.length}</div>
    </div>
    <div style="padding:10px;background:var(--gray-50);border-radius:8px;text-align:center;">
      <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase;margin-bottom:4px;">GCMs</div>
      <div style="font-size:22px;font-weight:700;">${gcms}</div>
    </div>
    <div style="padding:10px;background:var(--gray-50);border-radius:8px;text-align:center;">
      <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase;margin-bottom:4px;">Zonas</div>
      <div style="font-size:22px;font-weight:700;">${zonas}</div>
    </div>
    <div style="padding:10px;background:var(--gray-50);border-radius:8px;text-align:center;">
      <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase;margin-bottom:4px;">Vol. Perfil CB</div>
      <div style="font-size:18px;font-weight:700;">${fmtK(totalVol)}</div>
    </div>`;

  document.getElementById('preview-sample').innerHTML = `
    <div style="margin-bottom:8px;display:flex;gap:6px;flex-wrap:wrap;">
      ${Object.entries(statusMap).map(([s, n]) => `
        <span style="background:${s === 'ATIVO' ? '#E0F5ED' : s === 'INATIVO' ? '#FEECEB' : '#FDF3DC'};
          color:${s === 'ATIVO' ? '#06533B' : s === 'INATIVO' ? '#C0392B' : '#C47B00'};
          font-size:11px;font-weight:600;padding:3px 10px;border-radius:10px;">${s}: ${n}</span>`).join('')}
      ${comProd > 0 ? `<span style="background:#E0F5ED;color:#06533B;font-size:11px;font-weight:600;padding:3px 10px;border-radius:10px;">Com produção: ${comProd} lojas · ${totalProd} contratos</span>` : ''}
    </div>
    <div style="font-size:11px;font-weight:600;color:var(--gray-600);margin-bottom:6px;">AMOSTRA (5 primeiras lojas):</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr style="background:var(--gray-50);">
        <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--gray-200);">DN</th>
        <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--gray-200);">GCM</th>
        <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--gray-200);">Razão Social</th>
        <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--gray-200);">Zona</th>
        <th style="padding:5px 8px;text-align:right;border-bottom:1px solid var(--gray-200);">Contr. Perfil</th>
        <th style="padding:5px 8px;text-align:right;border-bottom:1px solid var(--gray-200);">Vol. Perfil</th>
        <th style="padding:5px 8px;text-align:center;border-bottom:1px solid var(--gray-200);">Prod. Mês</th>
      </tr></thead>
      <tbody>${data.slice(0, 5).map(d => `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);font-weight:600;color:#4C1D95;">${d.dn || '—'}</td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);">${d.gcm}</td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.razao_social}</td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);">${d.zona}</td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);text-align:right;font-weight:600;color:#1A5FB4;">${d.contratos_perfil}</td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);text-align:right;">${fmtBRL(d.volume_perfil)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);text-align:center;font-weight:600;">
          ${d.contratos_mes != null ? d.contratos_mes : '<span style="color:#ccc;">—</span>'}
        </td>
      </tr>`).join('')}</tbody>
    </table>`;

  document.getElementById('preview-status').textContent = `${data.length} lojas · ${gcms} GCMs · ${zonas} zonas`;
  document.getElementById('preview-box').style.display  = 'block';
  document.getElementById('btn-importar').style.display = 'block';
}

async function executarImport() {
  if (!sb)              { showToast('Supabase não configurado', 'error'); return; }
  if (!parsedData.length) { showToast('Nenhum dado para importar', 'error'); return; }

  const logEl = document.getElementById('log-content');
  document.getElementById('import-log').style.display  = 'block';
  document.getElementById('btn-importar').disabled      = true;
  logEl.textContent = '';

  const log = msg => { logEl.textContent += msg + '\n'; logEl.scrollTop = logEl.scrollHeight; };
  const modo = document.querySelector('input[name="modo"]:checked')?.value || 'upsert';

  log(`Iniciando importação — modo: ${modo === 'replace' ? 'SUBSTITUIR TUDO' : 'ATUALIZAR (upsert)'}`);
  log(`Total de registros: ${parsedData.length}`);
  log('─'.repeat(40));

  showLoading(true, 'Importando...');
  try {
    if (modo === 'replace') {
      log('Apagando dados existentes...');
      const { error } = await sb.from('lojas_sp').delete().neq('id', 0);
      if (error) throw error;
      log('✓ Dados apagados.');
    }

    const BATCH = 100;
    let total = 0;
    for (let i = 0; i < parsedData.length; i += BATCH) {
      const batch = parsedData.slice(i, i + BATCH);
      const { error } = modo === 'replace'
        ? await sb.from('lojas_sp').insert(batch)
        : await sb.from('lojas_sp').upsert(batch, { onConflict:'cnpj', ignoreDuplicates:false });
      if (error) throw error;
      total += batch.length;
      log(`✓ ${Math.min(i + BATCH, parsedData.length)} / ${parsedData.length} processadas...`);
      showLoading(true, `Importando ${Math.min(i + BATCH, parsedData.length)}/${parsedData.length}...`);
    }

    log('─'.repeat(40));
    log(`✅ Concluído! ${total} lojas importadas.`);
    showToast(`${total} lojas importadas ✓`, 'success');
    document.getElementById('btn-importar').disabled = false;
    setTimeout(() => { switchPage('dashboard'); loadLojas(); }, 1500);
  } catch(e) {
    log('❌ ERRO: ' + e.message);
    showToast('Erro: ' + e.message, 'error');
    document.getElementById('btn-importar').disabled = false;
  } finally {
    showLoading(false);
  }
}

function resetDropZone() {
  document.getElementById('drop-zone').innerHTML = `
    <div style="font-size:40px;margin-bottom:12px;">📊</div>
    <div style="font-size:16px;font-weight:600;color:var(--verde-dk);margin-bottom:6px;">Arraste a planilha aqui</div>
    <div style="font-size:13px;color:var(--gray-600);">ou clique para selecionar</div>
    <div style="font-size:11px;color:var(--gray-400);margin-top:8px;">Aceita .xlsx e .xlsm — aba "ativas"</div>
    <input type="file" id="file-input" accept=".xlsx,.xlsm" style="display:none" onchange="handleFile(this.files[0])"/>`;
  parsedData = [];
  document.getElementById('preview-box').style.display  = 'none';
  document.getElementById('btn-importar').style.display = 'none';
  document.getElementById('import-log').style.display   = 'none';
}

// ═══════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════
function porteBg(porte) {
  if (!porte) return '#888';
  const p = porte.trim().toUpperCase();
  if (p.startsWith('F')) return '#1565C0';
  if (p.startsWith('E')) return '#42A5F5';
  if (p.startsWith('D')) return '#26A69A';
  if (p.startsWith('C')) return '#66BB6A';
  if (p.startsWith('B')) return '#FFA726';
  if (p.startsWith('A')) return '#EF5350';
  return '#888';
}

function porteBadge(porte) {
  if (!porte) return '<span style="color:#ccc;font-size:11px;">—</span>';
  const bg = porteBg(porte);
  return `<span style="display:inline-block;background:${bg};color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:6px;white-space:nowrap;" title="${porte}">${porte}</span>`;
}

function statusBadge(status) {
  const map = {
    'ATIVO':          { bg:'#E0F5ED', color:'#06533B' },
    'INATIVO':        { bg:'#FEECEB', color:'#C0392B' },
    'NAO CADASTRADO': { bg:'#FDF3DC', color:'#C47B00' },
  };
  const s = map[status] || { bg:'#F1F3F5', color:'#6B7280' };
  return `<span style="background:${s.bg};color:${s.color};font-size:10px;font-weight:600;padding:2px 7px;border-radius:8px;white-space:nowrap;">${status || '—'}</span>`;
}

function prodFaixaCor(pct, qtd) {
  if (qtd == null) return { cor:'#9DA3B0', bg:'#F1F3F5' };
  if (pct > 15)  return { cor:'#185FA5', bg:'#E6F1FB' };
  if (pct >= 10) return { cor:'#1D9E75', bg:'#E1F5EE' };
  if (pct >= 6)  return { cor:'#BA7517', bg:'#FAEEDA' };
  if (pct >= 1)  return { cor:'#D85A30', bg:'#FAECE7' };
  return               { cor:'#C0392B', bg:'#FEECEB' };
}

function fmtBRL(n) {
  if (n == null || n === 0) return '—';
  return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits:0, maximumFractionDigits:0 });
}

function fmtK(n) {
  if (!n) return 'R$ 0';
  if (n >= 1e6) return 'R$ ' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return 'R$ ' + (n / 1e3).toFixed(0) + 'K';
  return 'R$ ' + Math.round(n);
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

function showLoading(show, msg = 'Carregando...') {
  const el = document.getElementById('loading-overlay');
  el.querySelector('span').textContent = msg;
  el.classList.toggle('hidden', !show);
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  if (initSupabase()) {
    await loadLojas();
  } else {
    showToast('⚠️ Supabase não configurado — verifique config.js', 'error');
    showLoading(false);
  }
});
