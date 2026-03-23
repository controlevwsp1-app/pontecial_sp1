// ============================================================
// app.js — CARBANK · Potencial Leste/Norte/GRU
// ============================================================

const CFG      = window.CARBANK_CONFIG || {};
const SUPA_URL = CFG.supabaseUrl || 'https://rgutyxnpbucwipfvtybu.supabase.co';
const SUPA_KEY = CFG.supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJndXR5eG5wYnVjd2lwZnZ0eWJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDE5NTgsImV4cCI6MjA4OTcxNzk1OH0.EGjSCaTN8y8jT9_4mU4jj9TBGNo-JjbjDGXwkmlBBY8';

const MR_META = {
  'MR-L1': { nome:'Brás · Moóca · Tatuapé · Carrão',                    zona:'Zona Leste',  cor:'#D85A30', bg:'#FAECE7', txt:'#712B13', lat:-23.548, lng:-46.590, scatter:0.025 },
  'MR-L2': { nome:'São Lucas · Vila Matilde · Penha · Cangaíba',         zona:'Zona Leste',  cor:'#993C1D', bg:'#F5C4B3', txt:'#4A1B0C', lat:-23.572, lng:-46.540, scatter:0.025 },
  'MR-L3': { nome:'Ermelino Matarazzo · São Mateus · Guaianazes',        zona:'Zona Leste',  cor:'#F0997B', bg:'#FAECE7', txt:'#712B13', lat:-23.548, lng:-46.478, scatter:0.025 },
  'MR-L4': { nome:'São Miguel Paulista · Itaim Paulista · Itaquera',     zona:'Zona Leste',  cor:'#7F2B10', bg:'#F5C4B3', txt:'#4A1B0C', lat:-23.506, lng:-46.438, scatter:0.025 },
  'MR-N1': { nome:'Santana · Tucuruvi · Vila Guilherme · Vila Maria',    zona:'Zona Norte',  cor:'#534AB7', bg:'#EEEDFE', txt:'#26215C', lat:-23.492, lng:-46.628, scatter:0.022 },
  'MR-N2': { nome:'Casa Verde · Brasilândia · Freq. do Ó · Pirituba',    zona:'Zona Norte',  cor:'#7F77DD', bg:'#CECBF6', txt:'#26215C', lat:-23.468, lng:-46.682, scatter:0.022 },
  'MR-G1': { nome:'Guarulhos',                                           zona:'Guarulhos',   cor:'#0F6E56', bg:'#E1F5EE', txt:'#04342C', lat:-23.455, lng:-46.533, scatter:0.030 },
  'MR-G2': { nome:'Arujá · Santa Isabel',                                zona:'Guarulhos',   cor:'#1D9E75', bg:'#9FE1CB', txt:'#04342C', lat:-23.398, lng:-46.321, scatter:0.018 },
  'MR-M1': { nome:'Mogi das Cruzes',                                     zona:'ABC/Leste',   cor:'#185FA5', bg:'#E6F1FB', txt:'#042C53', lat:-23.522, lng:-46.188, scatter:0.025 },
  'MR-M2': { nome:'Suzano',                                              zona:'ABC/Leste',   cor:'#378ADD', bg:'#B5D4F4', txt:'#042C53', lat:-23.542, lng:-46.312, scatter:0.020 },
  'MR-M3': { nome:'Itaquaquecetuba · Ferraz de Vasconcelos · Poá',       zona:'ABC/Leste',   cor:'#85B7EB', bg:'#E6F1FB', txt:'#042C53', lat:-23.487, lng:-46.348, scatter:0.022 },
  'MR-S1': { nome:'Zona Sul · São Bernardo do Campo',                    zona:'Zona Sul',    cor:'#BA7517', bg:'#FAEEDA', txt:'#633806', lat:-23.648, lng:-46.665, scatter:0.025 },
  'MR-C1': { nome:'Centro · Zona Oeste',                                 zona:'Centro',      cor:'#888780', bg:'#F1EFE8', txt:'#2C2C2A', lat:-23.549, lng:-46.643, scatter:0.018 },
};

const GCM_COLORS = [
  '#D85A30','#534AB7','#0F6E56','#185FA5','#BA7517',
  '#993C1D','#7F77DD','#1D9E75','#378ADD','#854F0B',
  '#F0997B','#3C3489','#085041',
];

let allLojas = [];
let filteredLojas = [];
let mapaInitialized = false;
let mapInstance = null;
let mapMarkers = [];
let gcmColorMap = {};
let pendingToggleId = null;

let currentPage = 1;
const PAGE_SIZE = 50;

let sb = null;
function initSupabase() {
  if (!SUPA_URL || !SUPA_KEY) return false;
  sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
  window.SUPABASE_CLIENT = sb;
  return true;
}

async function loadLojas() {
  showLoading(true);
  try {
    // Timeout de 8 segundos para não travar
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 8000)
    );
    const query = sb.from('lojas').select('*').order('gcm').order('razao_social');
    const { data, error } = await Promise.race([query, timeout]);
    if (error) throw error;
    allLojas = data || [];
    processGCMColors();
    renderAll();
  } catch(e) {
    if (e.message === 'timeout') {
      showToast('Supabase demorou — verifique config.js', 'error');
    } else {
      showToast('Erro: ' + e.message, 'error');
    }
    allLojas = [];
    renderAll();
  } finally {
    showLoading(false);
  }
}

async function loadSeed() {
  try {
    const r = await fetch('data_seed.json');
    allLojas = (await r.json()).map((d,i) => ({...d, id:i+1}));
    processGCMColors();
    renderAll();
    showToast('Modo offline — configure Supabase', 'error');
  } catch(e) { showToast('Erro ao carregar dados locais','error'); }
}

function processGCMColors() {
  const gcms = [...new Set(allLojas.map(l=>l.gcm).filter(Boolean))].sort();
  gcms.forEach((g,i) => { gcmColorMap[g] = GCM_COLORS[i % GCM_COLORS.length]; });
}

function renderAll() {
  const active = allLojas.filter(l => l.ativo !== false);
  document.getElementById('badge-total').textContent = active.length + ' lojas ativas';
  renderDashboard();
  renderGCMPage();
  populateFilters();
  applyTableFilters();
}

// ── DASHBOARD ──
function renderDashboard() {
  const active = allLojas.filter(l => l.ativo !== false);
  const totalLojas     = active.length;
  const totalContratos = active.reduce((s,l)=>s+(l.contratos_carbank||0),0);
  const totalVolume    = active.reduce((s,l)=>s+(l.volume_carbank||0),0);
  const totalGCMs      = new Set(active.map(l=>l.gcm).filter(Boolean)).size;

  document.getElementById('m-lojas').textContent     = totalLojas;
  document.getElementById('m-lojas-sub').textContent = `em ${Object.keys(MR_META).length} micro regiões`;
  document.getElementById('m-contratos').textContent = totalContratos.toLocaleString('pt-BR');
  document.getElementById('m-volume').textContent    = fmtK(totalVolume);
  document.getElementById('m-gcms').textContent      = totalGCMs;

  renderMRCards(active);
  renderComparativoMR(active);
  renderPorteChart(active);
}

function renderMRCards(active) {
  const container = document.getElementById('mr-cards-dash');
  container.innerHTML = '';
  const maxLojas = Math.max(...Object.keys(MR_META).map(mr => active.filter(l=>l.micro_regiao===mr).length), 1);

  Object.entries(MR_META).forEach(([mr, meta]) => {
    const lojas = active.filter(l => l.micro_regiao === mr);
    if (lojas.length === 0) return;
    const gcms = [...new Set(lojas.map(l=>l.gcm).filter(Boolean))];
    const contratos = lojas.reduce((s,l)=>s+(l.contratos_carbank||0),0);
    const volume    = lojas.reduce((s,l)=>s+(l.volume_carbank||0),0);
    const pct = Math.round(lojas.length/maxLojas*100);

    container.innerHTML += `
    <div class="card" style="border-top:3px solid ${meta.cor};">
      <div class="card-header" style="background:${meta.bg};">
        <div>
          <span class="mr-pill" style="background:${meta.cor};">${mr}</span>
          <span class="badge" style="margin-left:6px;background:${meta.bg};color:${meta.txt};border:1px solid ${meta.cor}40;font-size:10px;">${meta.zona}</span>
        </div>
        <span style="font-size:11px;color:${meta.txt};font-weight:600;">${lojas.length} lojas</span>
      </div>
      <div class="card-body">
        <div style="font-size:12px;font-weight:500;color:var(--gray-700);margin-bottom:10px;line-height:1.3;">${meta.nome}</div>
        <div class="progress" style="margin-bottom:12px;">
          <div class="progress-fill" style="width:${pct}%;background:${meta.cor};"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div>
            <div style="font-size:10px;color:var(--gray-600);text-transform:uppercase;letter-spacing:.3px;">Contratos CB</div>
            <div style="font-size:18px;font-weight:700;color:${meta.cor};">${contratos}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--gray-600);text-transform:uppercase;letter-spacing:.3px;">Volume CB</div>
            <div style="font-size:18px;font-weight:700;color:${meta.cor};">${fmtK(volume)}</div>
          </div>
        </div>
        <div style="border-top:1px solid var(--gray-100);padding-top:8px;">
          <div style="font-size:10px;color:var(--gray-600);margin-bottom:4px;">GCMs NESTA MR</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${gcms.map(g=>`<span style="background:${gcmColorMap[g]||'#888'}20;color:${gcmColorMap[g]||'#888'};font-size:10px;font-weight:600;padding:2px 6px;border-radius:8px;">${g.split(' ')[0]}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  });
}

function renderComparativoMR(active) {
  const container = document.getElementById('comparativo-mr');
  container.innerHTML = '';
  const data = Object.entries(MR_META).map(([mr,meta]) => ({
    mr, meta,
    lojas:    active.filter(l=>l.micro_regiao===mr).length,
    volume:   active.filter(l=>l.micro_regiao===mr).reduce((s,l)=>s+(l.volume_carbank||0),0),
  })).filter(d=>d.lojas>0).sort((a,b)=>b.volume-a.volume);
  const maxV = data[0]?.volume || 1;
  data.forEach(d => {
    container.innerHTML += `
    <div class="bar-chart-row">
      <div class="bar-chart-label">
        <span class="mr-pill" style="background:${d.meta.cor};font-size:10px;">${d.mr}</span>
        <span style="margin-left:5px;font-size:11px;color:var(--gray-600);">${d.lojas}</span>
      </div>
      <div class="bar-chart-track">
        <div class="bar-chart-fill" style="width:${Math.round(d.volume/maxV*100)}%;background:${d.meta.cor};"></div>
      </div>
      <div class="bar-chart-val" style="color:${d.meta.cor};">${fmtK(d.volume)}</div>
    </div>`;
  });
}

function renderPorteChart(active) {
  const container = document.getElementById('porte-chart');
  const portes = [
    { key:'F. > 30 GRAVAMES',   bg:'#1565C0', color:'#fff' },
    { key:'E. 21-30 GRAVAMES',  bg:'#42A5F5', color:'#fff' },
    { key:'D. 11-20 GRAVAMES',  bg:'#26A69A', color:'#fff' },
    { key:'C. 6-10 GRAVAMES',   bg:'#66BB6A', color:'#fff' },
    { key:'B. 2-5 GRAVAMES',    bg:'#FFA726', color:'#fff' },
    { key:'A. 1 GRAVAME',       bg:'#EF5350', color:'#fff' },
  ];
  const total = active.length;
  const maxN = Math.max(...portes.map(p => active.filter(l=>l.porte===p.key).length), 1);
  container.innerHTML = portes.map(p => {
    const n = active.filter(l=>l.porte===p.key).length;
    if (!n) return '';
    const pct = Math.round(n/total*100);
    return `<div class="bar-chart-row" style="margin-bottom:10px;">
      <div style="width:160px;flex-shrink:0;">
        <span style="background:${p.bg};color:${p.color};font-size:10px;font-weight:600;padding:3px 7px;border-radius:5px;white-space:nowrap;">${p.key}</span>
      </div>
      <div class="bar-chart-track">
        <div class="bar-chart-fill" style="width:${Math.round(n/maxN*100)}%;background:${p.bg};"></div>
      </div>
      <div style="font-size:11px;font-weight:600;min-width:50px;text-align:right;color:${p.bg};">${n} <span style="color:var(--gray-400);font-weight:400;">(${pct}%)</span></div>
    </div>`;
  }).join('');
}

// ── GCM PAGE ──
function renderGCMPage() {
  const active = allLojas.filter(l => l.ativo !== false);
  const container = document.getElementById('gcm-cards');
  container.innerHTML = '';

  const gcmMap = {};
  active.forEach(l => {
    const g = l.gcm || 'Sem GCM';
    if (!gcmMap[g]) gcmMap[g] = { lojas:[], contratos:0, volume:0, contGeral:0, volGeral:0, mrs:new Set() };
    gcmMap[g].lojas.push(l);
    gcmMap[g].contratos  += (l.contratos_carbank||0);
    gcmMap[g].volume     += (l.volume_carbank||0);
    gcmMap[g].contGeral  += (l.contratos_geral||0);
    gcmMap[g].volGeral   += (l.volume_geral||0);
    gcmMap[g].mrs.add(l.micro_regiao);
  });

  const sorted = Object.entries(gcmMap).sort((a,b)=>b[1].volume-a[1].volume);
  const maxVol = sorted[0]?.[1].volume || 1;

  sorted.forEach(([nome, d]) => {
    const cor = gcmColorMap[nome] || '#888';
    const pct = Math.round(d.volume/maxVol*100);
    const initials = nome.split(' ').slice(0,2).map(w=>w[0]).join('');
    const mrs = [...d.mrs].sort();

    // Porte distribution
    const porteCounts = {};
    d.lojas.forEach(l => { porteCounts[l.porte] = (porteCounts[l.porte]||0)+1; });

    container.innerHTML += `
    <div class="card" style="border-top:3px solid ${cor};">
      <div class="card-header" style="background:${cor}10;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:40px;height:40px;border-radius:50%;background:${cor}25;color:${cor};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">${initials}</div>
          <div>
            <div style="font-weight:600;font-size:13px;color:var(--gray-800);">${nome}</div>
            <div style="font-size:11px;color:var(--gray-500);">${d.lojas.length} lojas · ${mrs.join(', ')}</div>
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
            <div style="font-size:18px;font-weight:700;color:${cor};">${d.contratos}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase;">Vol. CB</div>
            <div style="font-size:16px;font-weight:700;color:${cor};">${fmtK(d.volume)}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase;">Lojas</div>
            <div style="font-size:18px;font-weight:700;color:var(--gray-700);">${d.lojas.length}</div>
          </div>
        </div>
        <div style="border-top:1px solid var(--gray-100);padding-top:8px;">
          <div style="font-size:10px;color:var(--gray-500);margin-bottom:5px;">DISTRIBUIÇÃO POR PORTE</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${Object.entries(porteCounts).sort((a,b)=>b[1]-a[1]).map(([p,n])=>`<span style="background:${porteBg(p)};color:#fff;font-size:10px;font-weight:600;padding:2px 6px;border-radius:5px;">${p.charAt(0)} ×${n}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  });
}

// ── PLANILHA ──
function populateFilters() {
  const gcms = [...new Set(allLojas.map(l=>l.gcm).filter(Boolean))].sort();
  const gcmSel  = document.getElementById('f-gcm');
  const mapGcm  = document.getElementById('mapa-gcm-filter');
  const opts = gcms.map(g=>`<option value="${g}">${g}</option>`).join('');
  if (gcmSel)  gcmSel.innerHTML  = '<option value="">Todos os GCMs</option>' + opts;
  if (mapGcm)  mapGcm.innerHTML  = '<option value="">Todos os GCMs</option>' + opts;

  ['f-busca','f-zona','f-mr','f-gcm','f-porte','f-status'].forEach(id => {
    document.getElementById(id)?.addEventListener('input',  applyTableFilters);
    document.getElementById(id)?.addEventListener('change', applyTableFilters);
  });
  ['mapa-mr-filter','mapa-gcm-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', refreshMapa);
  });
}

function applyTableFilters() {
  const search = document.getElementById('f-busca')?.value?.toLowerCase()||'';
  const zona   = document.getElementById('f-zona')?.value||'';
  const mr     = document.getElementById('f-mr')?.value||'';
  const gcm    = document.getElementById('f-gcm')?.value||'';
  const porte  = document.getElementById('f-porte')?.value||'';
  const status = document.getElementById('f-status')?.value||'';

  filteredLojas = allLojas.filter(l => {
    if (status==='ativo'   && l.ativo===false) return false;
    if (status==='inativo' && l.ativo!==false) return false;
    if (zona  && l.zona !== zona) return false;
    if (mr    && l.micro_regiao !== mr) return false;
    if (gcm   && l.gcm !== gcm) return false;
    if (porte && l.porte !== porte) return false;
    if (search) {
      const h = [l.razao_social,l.bairro,l.gcm,l.cnpj].join(' ').toLowerCase();
      if (!h.includes(search)) return false;
    }
    return true;
  });
  currentPage = 1;
  renderTable();
  document.getElementById('tbl-count').textContent = `${filteredLojas.length} registros`;
}

function renderTable() {
  const tbody = document.getElementById('lojas-tbody');
  const start = (currentPage-1)*PAGE_SIZE;
  const pageData = filteredLojas.slice(start, start+PAGE_SIZE);
  const gcmCol = gcmColorMap;

  tbody.innerHTML = pageData.map(l => {
    const meta    = MR_META[l.micro_regiao]||{};
    const cor     = gcmCol[l.gcm]||'#888';
    const inativo = l.ativo===false;
    return `
    <tr class="${inativo?'inativo':''}" data-id="${l.id}">
      <td style="text-align:center;">
        ${l.dealer_cod
          ? `<span style="background:#F3F0FF;color:#4C1D95;font-size:11px;font-weight:700;padding:2px 7px;border-radius:6px;">${l.dealer_cod}</span>`
          : `<span style="color:#ccc;font-size:11px;">—</span>`}
      </td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:${cor};">
          <span style="width:8px;height:8px;border-radius:50%;background:${cor};flex-shrink:0;"></span>
          ${l.gcm||'—'}
        </span>
      </td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${l.razao_social}">${l.razao_social}</td>
      <td style="font-size:12px;">${l.bairro}</td>
      <td><span style="font-size:11px;color:var(--gray-600);">${l.zona}</span></td>
      <td><span class="mr-pill" style="background:${meta.cor||'#888'};">${l.micro_regiao}</span></td>
      <td>${porteBadge(l.porte)}</td>
      <td style="text-align:center;background:#f0faf3;">${prodQtdBadge(l.prod_qtd, l.contratos_carbank)}</td>
      <td style="text-align:right;background:#f0faf3;">${prodValorBadge(l.prod_valor, l.volume_carbank)}</td>
      <td style="text-align:center;font-weight:600;color:#185FA5;background:#EBF4FF;">${l.contratos_carbank||0}</td>
      <td style="text-align:right;font-weight:600;color:#185FA5;background:#EBF4FF;">${fmtBRL(l.volume_carbank)}</td>
      <td style="text-align:center;color:var(--gray-600);">${l.contratos_geral||0}</td>
      <td style="text-align:right;color:var(--gray-600);">${fmtBRL(l.volume_geral)}</td>
    </tr>`;
  }).join('');

  renderPagination();
}

function renderPagination() {
  const total = filteredLojas.length;
  const pages = Math.ceil(total/PAGE_SIZE);
  const container = document.getElementById('paginacao');
  if (pages<=1) { container.innerHTML=''; return; }
  let html = `<span style="font-size:12px;color:var(--gray-600);">Pág. ${currentPage} de ${pages}</span>`;
  if (currentPage>1)     html += `<button class="btn btn-ghost btn-sm" onclick="goPage(${currentPage-1})">← Ant.</button>`;
  if (currentPage<pages) html += `<button class="btn btn-ghost btn-sm" onclick="goPage(${currentPage+1})">Próx. →</button>`;
  container.innerHTML = html;
}

function goPage(p) { currentPage=p; renderTable(); window.scrollTo(0,0); }

// ── EXCLUIR / REATIVAR ──
function confirmarExclusao(id) {
  pendingToggleId = id;
  const loja = allLojas.find(l=>l.id===id);
  const acao = loja?.ativo===false ? 'reativar' : 'desativar';
  document.getElementById('modal-msg').textContent = `Deseja ${acao} "${loja?.razao_social}"?`;
  document.getElementById('modal-confirm-btn').textContent = acao==='reativar' ? 'Sim, reativar' : 'Sim, desativar';
  document.getElementById('modal-confirm-btn').className = acao==='reativar' ? 'btn btn-primary' : 'btn btn-danger';
  document.getElementById('confirm-modal').classList.remove('hidden');
}

async function executarToggle() {
  document.getElementById('confirm-modal').classList.add('hidden');
  const id  = pendingToggleId;
  const idx = allLojas.findIndex(l=>l.id===id);
  if (idx<0) return;
  const novoAtivo = !(allLojas[idx].ativo!==false);
  allLojas[idx].ativo = novoAtivo;
  if (sb) {
    const { error } = await sb.from('lojas').update({ativo:novoAtivo}).eq('id',id);
    if (error) { showToast('Erro: '+error.message,'error'); return; }
  }
  showToast(novoAtivo ? 'Loja reativada ✓' : 'Loja desativada ✓','success');
  applyTableFilters();
  renderDashboard();
  renderGCMPage();
}

// ── MAPA ──
function initMapa() {
  if (mapaInitialized) return;
  mapaInitialized = true;
  mapInstance = L.map('mapa-container',{zoomControl:true,scrollWheelZoom:true})
    .setView([-23.510, -46.430], 10);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
    attribution:'&copy; OpenStreetMap &copy; CARTO', maxZoom:18
  }).addTo(mapInstance);
  refreshMapa();
}

function refreshMapa() {
  if (!mapInstance) return;
  mapMarkers.forEach(m=>m.remove());
  mapMarkers = [];

  const active = allLojas.filter(l=>l.ativo!==false);
  const filterMR  = document.getElementById('mapa-mr-filter')?.value||'';
  const filterGCM = document.getElementById('mapa-gcm-filter')?.value||'';

  const toPlot = active.filter(l => {
    if (filterMR  && l.micro_regiao!==filterMR)  return false;
    if (filterGCM && l.gcm!==filterGCM)          return false;
    return true;
  });

  // MR area circles
  Object.entries(MR_META).forEach(([mr,meta]) => {
    const lojas = toPlot.filter(l=>l.micro_regiao===mr);
    if (!lojas.length) return;
    const c = L.circleMarker([meta.lat,meta.lng],{
      radius:22+(lojas.length/608)*35, fillColor:meta.cor,
      color:'#fff', weight:2, opacity:1, fillOpacity:0.12
    }).addTo(mapInstance);
    mapMarkers.push(c);
  });

  // Individual store dots
  toPlot.forEach(l => {
    const meta = MR_META[l.micro_regiao]||{};
    const cor  = gcmColorMap[l.gcm]||meta.cor;
    const jLat = meta.lat + (Math.random()-.5)*meta.scatter;
    const jLng = meta.lng + (Math.random()-.5)*(meta.scatter*1.2);

    const dot = L.circleMarker([jLat,jLng],{
      radius:5, fillColor:cor, color:'#fff', weight:1, opacity:1, fillOpacity:0.88
    }).addTo(mapInstance);

    dot.bindPopup(`
      <div style="font-family:sans-serif;min-width:210px;">
        <div style="background:${meta.bg||'#eee'};padding:8px 10px;border-radius:6px 6px 0 0;margin:-12px -12px 8px;">
          <span style="background:${meta.cor};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;">${l.micro_regiao}</span>
          <div style="font-size:11px;font-weight:600;color:${meta.txt||'#333'};margin-top:4px;line-height:1.3;">${l.razao_social}</div>
        </div>
        <div style="font-size:11px;color:#777;margin-bottom:6px;">${l.bairro} · ${l.zona}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;margin-bottom:6px;">
          <div><span style="color:#aaa;">Contr. CB</span><br><strong style="color:#185FA5;">${l.contratos_carbank||0}</strong></div>
          <div><span style="color:#aaa;">Vol. CB</span><br><strong style="color:#185FA5;">${fmtBRL(l.volume_carbank)}</strong></div>
        </div>
        <div style="background:${cor}20;color:${cor};font-size:11px;font-weight:600;padding:4px 8px;border-radius:6px;">${porteBadgeStr(l.porte)}</div>
        ${l.gcm ? `<div style="margin-top:5px;font-size:11px;font-weight:600;color:${cor};">👤 ${l.gcm}</div>` : ''}
      </div>`, {offset:[0,-3]});

    dot.on('mouseover',function(){this.setStyle({radius:7,weight:2});});
    dot.on('mouseout', function(){this.setStyle({radius:5,weight:1});});
    mapMarkers.push(dot);
  });

  // Legend
  const legEl = document.getElementById('mapa-legend');
  if (legEl) {
    const gcms = [...new Set(toPlot.map(l=>l.gcm).filter(Boolean))];
    legEl.innerHTML = gcms.length > 0
      ? gcms.map(g=>`<span style="display:inline-flex;align-items:center;gap:5px;background:${gcmColorMap[g]}18;color:${gcmColorMap[g]};font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px;"><span style="width:8px;height:8px;border-radius:50%;background:${gcmColorMap[g]};"></span>${g.split(' ')[0]}</span>`).join('')
      : Object.entries(MR_META).map(([mr,m])=>`<span style="display:inline-flex;align-items:center;gap:5px;background:${m.bg};color:${m.txt};font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px;"><span style="width:8px;height:8px;border-radius:50%;background:${m.cor};"></span>${mr}</span>`).join('');
  }
}

// ── NAV ──
function switchPage(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelector(`[data-page="${id}"]`).classList.add('active');
  if (id==='mapa') {
    // Reseta modo comparação ao trocar de aba
    if (modoComparacao) {
      modoComparacao = false;
      const modoNorm = document.getElementById('modo-normal');
      const modoComp = document.getElementById('modo-comparacao');
      const compPanel= document.getElementById('comp-panel');
      if (modoNorm)  modoNorm.style.display  = 'flex';
      if (modoComp)  modoComp.style.display  = 'none';
      if (compPanel) compPanel.style.display = 'none';
    }
    setTimeout(initMapa, 100);
  }
}

// ── IMPORT ──
async function importarSeed() {
  if (!sb) { showToast('Supabase não configurado', 'error'); return; }
  showLoading(true, 'Importando dados...');
  try {
    const r = await fetch('data_seed.json');
    if (!r.ok) throw new Error('data_seed.json não encontrado');
    const raw = await r.json();

    const seen = new Set();
    const data = raw.filter(l => {
      if (!l.cnpj || seen.has(l.cnpj)) return false;
      seen.add(l.cnpj);
      return true;
    });

    // Limpa primeiro
    showLoading(true, 'Limpando dados antigos...');
    await sb.from('lojas').delete().neq('id', 0);

    // Importa em lotes de 50
    const BATCH = 50;
    let total = 0;
    for (let i = 0; i < data.length; i += BATCH) {
      const batch = data.slice(i, i + BATCH);
      showLoading(true, `Importando ${Math.min(i+BATCH, data.length)} de ${data.length}...`);
      const { error } = await sb.from('lojas').insert(batch);
      if (error) throw error;
      total += batch.length;
    }

    showToast(`${total} lojas importadas ✓`, 'success');
    await loadLojas();
  } catch(e) {
    showToast('Erro: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ── UTILS ──
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
  if (!porte) return '<span style="color:#aaa;font-size:11px;">—</span>';
  const bg = porteBg(porte);
  return `<span style="display:inline-block;background:${bg};color:#fff;font-size:10px;font-weight:600;padding:3px 7px;border-radius:6px;white-space:nowrap;" title="${porte}">${porte}</span>`;
}

function porteBadgeStr(porte) {
  return porte || '—';
}

function getProdCor(pct) {
  if (pct > 15)  return { cor:'#185FA5', label:'Azul',    bg:'#E6F1FB' };
  if (pct >= 10) return { cor:'#1D9E75', label:'Verde',   bg:'#E1F5EE' };
  if (pct >= 6)  return { cor:'#BA7517', label:'Amarelo', bg:'#FAEEDA' };
  if (pct >= 1)  return { cor:'#D85A30', label:'Laranja', bg:'#FAECE7' };
  return           { cor:'#E24B4A', label:'Vermelho', bg:'#FCEBEB' };
}

function prodQtdBadge(qtd, meta) {
  if (qtd === null || qtd === undefined || qtd === '') return '<span style="color:#aaa;font-size:11px;">—</span>';
  const pct = meta > 0 ? Math.round(qtd/meta*100) : 0;
  const { cor, bg } = getProdCor(pct);
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:${cor};background:${bg};padding:2px 7px;border-radius:6px;">
    ${qtd}
    <span style="font-size:10px;font-weight:400;opacity:.85;">(${pct}%)</span>
  </span>`;
}

function prodValorBadge(valor, metaVol) {
  if (valor === null || valor === undefined || valor === '') return '<span style="color:#aaa;font-size:11px;">—</span>';
  const pct = metaVol > 0 ? Math.round(valor/metaVol*100) : 0;
  const { cor, bg } = getProdCor(pct);
  return `<span style="font-size:12px;font-weight:600;color:${cor};background:${bg};padding:2px 7px;border-radius:6px;" title="${pct}% do potencial">
    ${fmtBRL(valor)}
  </span>`;
}

function atualizarTipoUpload() {
  const tipo = document.querySelector('input[name="tipo"]:checked')?.value || 'base';
  const modoDiv = document.getElementById('modo-importacao');
  if (modoDiv) modoDiv.style.display = tipo === 'base' ? 'block' : 'none';
  resetDropZone();
  document.getElementById('preview-box').style.display  = 'none';
  document.getElementById('btn-importar').style.display = 'none';
  parsedData = [];
}

function fmtBRL(n) {
  if (!n) return 'R$ 0';
  return 'R$ ' + Number(n).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0});
}
function fmtK(n) {
  if (!n) return 'R$ 0';
  if (n>=1e6) return 'R$ '+(n/1e6).toFixed(1)+'M';
  return 'R$ '+(n/1e3).toFixed(0)+'K';
}
function showToast(msg,type='') {
  const t = document.getElementById('toast');
  t.textContent=msg; t.className='toast show '+type;
  setTimeout(()=>{t.className='toast';},3000);
}
function showLoading(show,msg='Carregando dados...') {
  const el = document.getElementById('loading-overlay');
  el.querySelector('span').textContent=msg;
  el.classList.toggle('hidden',!show);
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  if (initSupabase()) await loadLojas();
  else await loadSeed();
});

// ============================================================
// UPLOAD / PROCESSAR PLANILHA
// ============================================================

let parsedData = [];

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').style.background = '#fff';
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
    <div style="font-size:14px;font-weight:600;color:#D85A30;">Processando ${file.name}...</div>`;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(e.target.result, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
      const tipo = document.querySelector('input[name="tipo"]:checked')?.value || 'base';

      if (tipo === 'analitico') {
        parsedData = processarAnalitico(rows);
        mostrarPreviewAnalitico(parsedData, file.name);
      } else {
        parsedData = processarPlanilha(rows);
        mostrarPreview(parsedData, file.name);
      }
    } catch(err) {
      showToast('Erro ao ler planilha: ' + err.message, 'error');
      resetDropZone();
    }
  };
  reader.readAsArrayBuffer(file);
}

function processarAnalitico(rows) {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  const findCol = (...names) => keys.find(k => names.some(n => k.toUpperCase().trim() === n.toUpperCase().trim())) 
    || keys.find(k => names.some(n => k.toUpperCase().includes(n.toUpperCase()))) 
    || '';

  const colDealer = findCol('DEALER');
  const colValor  = findCol('VLR FINANCIADO','VALOR FINANCIADO','VLR FIN');
  const colGCM    = findCol('GCM');
  const colMes    = findCol('PAGAMENTO','DATA','MES');
  const colDN     = findCol('DN'); // coluna DN adicionada manualmente

  console.log('Colunas detectadas:', {colDealer, colValor, colGCM, colMes, colDN});

  // Agrupa por dealer_cod
  const grouped = {};
  rows.forEach(r => {
    // Prioriza coluna DN se existir e tiver valor; senão usa DEALER com split
    let cod = '', nome = '';
    if (colDN && r[colDN] && String(r[colDN]).trim() !== '' && String(r[colDN]).trim() !== 'nan') {
      cod  = String(r[colDN]).trim().replace('.0','');
      const dealerRaw = String(r[colDealer]||'');
      nome = dealerRaw.includes('-') ? dealerRaw.split('-').slice(1).join('-').trim() : dealerRaw;
    } else if (colDealer && r[colDealer]) {
      const dealerRaw = String(r[colDealer]||'');
      const parts     = dealerRaw.split('-');
      cod  = parts[0].trim();
      nome = parts.slice(1).join('-').trim();
    }

    if (!cod || cod === 'nan' || cod === '0') return;

    if (!grouped[cod]) {
      grouped[cod] = { dealer_cod: cod, dealer_nome: nome,
                       gcm: String(r[colGCM]||''), qtd: 0, valor: 0, mes: '' };
    }
    grouped[cod].qtd++;
    grouped[cod].valor += parseFloat(r[colValor]||0)||0;

    if (!grouped[cod].mes && r[colMes]) {
      const d = new Date(r[colMes]);
      if (!isNaN(d)) {
        grouped[cod].mes = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      }
    }
  });

  const result = Object.values(grouped).map(g => ({...g, valor: Math.round(g.valor*100)/100}));
  console.log(`processarAnalitico: ${result.length} dealers, ex:`, result.slice(0,3));
  return result;
}

function mostrarPreviewAnalitico(data, filename) {
  document.getElementById('drop-zone').innerHTML = `
    <div style="font-size:28px;margin-bottom:8px;">✅</div>
    <div style="font-size:14px;font-weight:600;color:#854D0E;">${filename}</div>
    <div style="font-size:12px;color:var(--gray-600);margin-top:4px;">${data.length} dealers · ${data.reduce((s,d)=>s+d.qtd,0)} contratos</div>
    <div style="font-size:11px;color:var(--gray-400);margin-top:6px;cursor:pointer;text-decoration:underline;" onclick="document.getElementById('file-input').click()">Trocar arquivo</div>
    <input type="file" id="file-input" accept=".xlsx,.xlsm" style="display:none" onchange="handleFile(this.files[0])"/>`;

  const totalQtd   = data.reduce((s,d)=>s+d.qtd,0);
  const totalValor = data.reduce((s,d)=>s+d.valor,0);
  const mes        = data[0]?.mes || '—';

  document.getElementById('preview-metrics').innerHTML = `
    <div class="metric" style="padding:10px;"><div class="metric-label">Dealers</div><div class="metric-value" style="font-size:20px;">${data.length}</div></div>
    <div class="metric" style="padding:10px;"><div class="metric-label">Contratos</div><div class="metric-value" style="font-size:20px;color:#854D0E;">${totalQtd}</div></div>
    <div class="metric" style="padding:10px;"><div class="metric-label">Val. Financiado</div><div class="metric-value" style="font-size:16px;color:#854D0E;">${fmtK(totalValor)}</div></div>
    <div class="metric" style="padding:10px;"><div class="metric-label">Mês ref.</div><div class="metric-value" style="font-size:16px;">${mes}</div></div>`;

  document.getElementById('preview-sample').innerHTML = `
    <div style="font-size:11px;font-weight:600;color:var(--gray-600);margin-bottom:6px;">DEALERS PROCESSADOS:</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr style="background:var(--gray-50);">
        <th style="padding:4px 8px;text-align:left;border-bottom:1px solid var(--gray-200);">Cód.</th>
        <th style="padding:4px 8px;text-align:left;border-bottom:1px solid var(--gray-200);">Nome</th>
        <th style="padding:4px 8px;text-align:left;border-bottom:1px solid var(--gray-200);">GCM</th>
        <th style="padding:4px 8px;text-align:center;border-bottom:1px solid var(--gray-200);">Qtd</th>
        <th style="padding:4px 8px;text-align:right;border-bottom:1px solid var(--gray-200);">Val. Financiado</th>
      </tr></thead>
      <tbody>${data.map(d=>`<tr>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);font-weight:600;color:#854D0E;">${d.dealer_cod}</td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.dealer_nome}</td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);font-size:10px;">${d.gcm.split(' ')[0]}</td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);text-align:center;font-weight:600;">${d.qtd}</td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);text-align:right;font-weight:600;color:#854D0E;">${fmtBRL(d.valor)}</td>
      </tr>`).join('')}</tbody>
    </table>`;

  document.getElementById('preview-status').textContent = `${data.length} dealers · ${mes}`;
  document.getElementById('preview-box').style.display  = 'block';
  document.getElementById('btn-importar').style.display = 'block';
  document.getElementById('btn-importar').style.background = '#854D0E';
  document.getElementById('btn-importar').style.borderColor = '#854D0E';
  document.getElementById('btn-importar').textContent = '↑ Importar produção para o banco';
}

async function executarImportAnalitico() {
  const logEl = document.getElementById('import-log');
  const logContent = document.getElementById('log-content');
  logEl.style.display = 'block';
  logContent.textContent = '';
  document.getElementById('btn-importar').disabled = true;

  const log = msg => { logContent.textContent += msg + '\n'; logContent.scrollTop = logContent.scrollHeight; };

  log('Importando planilha analítica...');
  log(`Total de dealers: ${parsedData.length}`);
  log('─'.repeat(40));
  console.log('parsedData sample:', parsedData.slice(0,3));

  let ok = 0, semMatch = 0;
  const mes = parsedData[0]?.mes || '';

  for (const dealer of parsedData) {
    // Busca loja pelo dealer_cod
    const { data: lojas } = await sb.from('lojas')
      .select('id, razao_social, dealer_cod')
      .eq('dealer_cod', dealer.dealer_cod)
      .limit(10);

    if (lojas && lojas.length > 0) {
      // Atualiza todas as lojas com esse dealer_cod
      for (const loja of lojas) {
        await sb.from('lojas').update({
          prod_qtd:   dealer.qtd,
          prod_valor: dealer.valor,
          prod_mes:   mes,
        }).eq('id', loja.id);
      }
      log(`✅ ${dealer.dealer_cod} - ${dealer.dealer_nome.slice(0,35)} → ${dealer.qtd} contratos / ${fmtBRL(dealer.valor)}`);
      ok++;
    } else {
      // Normaliza nome: maiúsculas, remove sufixos e caracteres especiais
      const normName = s => s.toUpperCase()
        .replace(/\b(LTDA|EIRELI|S\.?A\.?|ME|EPP|COM\b|DE\b|DO\b|DA\b|\bE\b)\b\.?/g, '')
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ').trim().slice(0, 20);

      const nBusca = normName(dealer.dealer_nome);
      // Tenta com os primeiros 12 chars do nome normalizado
      const busca  = dealer.dealer_nome.replace(/\b(ltda|eireli|s\.?a\.?|me|epp)\b\.?/gi,'').trim().slice(0,12);

      const { data: porNome } = await sb.from('lojas')
        .select('id, razao_social')
        .ilike('razao_social', `%${busca}%`)
        .limit(10);

      // Filtra os que têm maior similaridade
      const matched = porNome ? porNome.filter(loja => {
        const lNorm = normName(loja.razao_social);
        return lNorm.slice(0,12) === nBusca.slice(0,12) ||
               nBusca.includes(lNorm.slice(0,10)) ||
               lNorm.includes(nBusca.slice(0,10));
      }) : [];

      if (matched.length > 0) {
        for (const loja of matched) {
          await sb.from('lojas').update({
            dealer_cod: dealer.dealer_cod,
            prod_qtd:   dealer.qtd,
            prod_valor: dealer.valor,
            prod_mes:   mes,
          }).eq('id', loja.id);
        }
        log(`🔍 ${dealer.dealer_cod} - ${dealer.dealer_nome.slice(0,35)} → por nome (${matched[0].razao_social.slice(0,30)})`);
        ok++;
      } else if (porNome && porNome.length > 0) {
        // Fallback mais amplo — pega o primeiro resultado
        for (const loja of porNome.slice(0,1)) {
          await sb.from('lojas').update({
            dealer_cod: dealer.dealer_cod,
            prod_qtd:   dealer.qtd,
            prod_valor: dealer.valor,
            prod_mes:   mes,
          }).eq('id', loja.id);
        }
        log(`🔎 ${dealer.dealer_cod} - ${dealer.dealer_nome.slice(0,35)} → fallback (${porNome[0].razao_social.slice(0,30)})`);
        ok++;
      } else {
        log(`⚠️  ${dealer.dealer_cod} - ${dealer.dealer_nome.slice(0,35)} → não encontrado`);
        semMatch++;
      }
    }
  }

  // Salva também na tabela de histórico
  const histData = parsedData.map(d => ({
    dealer_cod:  d.dealer_cod,
    dealer_nome: d.dealer_nome,
    gcm:         d.gcm,
    mes:         d.mes || mes,
    qtd:         d.qtd,
    valor:       d.valor,
  }));
  await sb.from('producao').upsert(histData, { onConflict: 'dealer_cod,mes' }).catch(() => {});

  log('─'.repeat(40));
  log(`✅ ${ok} dealers atualizados, ${semMatch} sem correspondência.`);
  showToast(`${ok} dealers importados ✓`, 'success');
  document.getElementById('btn-importar').disabled = false;
  await loadLojas();
}
function processarPlanilha(rows) {
  // Detecta colunas automaticamente pelo cabeçalho
  if (!rows.length) return [];

  const sample = rows[0];
  const keys   = Object.keys(sample);

  // Mapeia colunas pelos nomes (flexível)
  const findCol = (...names) => keys.find(k => names.some(n => k.toUpperCase().includes(n.toUpperCase()))) || '';

  const colCNPJ    = findCol('CNPJ');
  const colGCM     = findCol('GCM');
  const colRazao   = findCol('RAZÃO','RAZAO','SOCIAL');
  const colBairro  = findCol('BAIRRO');
  const colCEP     = findCol('CEP');
  const colZona    = findCol('ZONA');
  const colPorte   = findCol('PORTE');
  const colContG   = findCol('CONTRATOS - GERAL','CONTRATOS GERAL');
  const colVolG    = findCol('VOLUME - GERAL','VOLUME GERAL');
  const colContCB  = findCol('CONTRATOS PERFIL','CONTRATOS CB');
  const colVolCB   = findCol('VOLUME PERFIL','VOLUME CB');
  const colStatus  = findCol('STATUS');
  const colDN      = findCol('DN','DEALER_COD','COD DN','CODIGO DN');

  const MR_NOMES = {
    'MR-L1':'Brás · Moóca · Tatuapé · Carrão',
    'MR-L2':'São Lucas · Vila Matilde · Penha · Cangaíba',
    'MR-L3':'Ermelino Matarazzo · São Mateus · Guaianazes',
    'MR-L4':'São Miguel Paulista · Itaim Paulista · Itaquera',
    'MR-N1':'Santana · Tucuruvi · Vila Guilherme · Vila Maria',
    'MR-N2':'Casa Verde · Brasilândia · Freq. do Ó · Pirituba',
    'MR-G1':'Guarulhos',
    'MR-G2':'Arujá · Santa Isabel',
    'MR-M1':'Mogi das Cruzes',
    'MR-M2':'Suzano',
    'MR-M3':'Itaquaquecetuba · Ferraz de Vasconcelos · Poá',
    'MR-S1':'Zona Sul · São Bernardo do Campo',
    'MR-C1':'Centro · Zona Oeste',
    'MR-O1':'Zona Oeste',
  };

  function getMR(zona, cepStr) {
    const p4 = parseInt((cepStr||'00000000').toString().padStart(8,'0').slice(0,4));
    const z  = (zona||'').trim();
    if (z === 'Zona Leste') {
      if (p4 >= 300 && p4 <= 319) return 'MR-L1';
      if (p4 >= 320 && p4 <= 359) return 'MR-L2';
      if (p4 >= 360 && p4 <= 399) return 'MR-L3';
      if (p4 >= 800 && p4 <= 849) return 'MR-L4';
      return 'MR-L2';
    }
    if (z === 'Zona Norte')  return p4 >= 240 ? 'MR-N2' : 'MR-N1';
    if (z === 'Guarulhos')   return 'MR-G1';
    if (z === 'Arujá' || z === 'Santa Isabel') return 'MR-G2';
    if (z === 'Mogi das Cruzes') return 'MR-M1';
    if (z === 'Suzano')      return 'MR-M2';
    if (z === 'Itaquaquecetuba' || z === 'Ferraz De Vasconcelos' || z === 'Poá') return 'MR-M3';
    if (z === 'Zona Sul' || z === 'São Bernardo do Campo') return 'MR-S1';
    if (z === 'Francisco Morato') return 'MR-N2';
    return 'MR-C1';
  }

  function cleanCNPJ(v) {
    const s = String(v||'').replace(/\D/g,'').padStart(14,'0');
    return s.slice(-14);
  }

  const seen = new Set();
  const result = [];

  rows.forEach(r => {
    const cnpj = cleanCNPJ(r[colCNPJ]);
    if (!cnpj || cnpj === '00000000000000') return;
    if (seen.has(cnpj)) return;
    seen.add(cnpj);

    const cepRaw = String(r[colCEP]||'0').replace(/\D/g,'').padStart(8,'0');
    const zona   = String(r[colZona]||'');
    const mr     = getMR(zona, cepRaw);

    result.push({
      cnpj,
      gcm:              String(r[colGCM]||''),
      razao_social:     String(r[colRazao]||''),
      bairro:           String(r[colBairro]||''),
      cep:              cepRaw,
      zona,
      micro_regiao:     mr,
      micro_regiao_nome: MR_NOMES[mr] || mr,
      porte:            String(r[colPorte]||''),
      contratos_geral:  parseInt(r[colContG]||0)||0,
      volume_geral:     parseFloat(r[colVolG]||0)||0,
      contratos_carbank: parseInt(r[colContCB]||0)||0,
      volume_carbank:   parseFloat(r[colVolCB]||0)||0,
      status:           String(r[colStatus]||''),
      dealer_cod:       colDN && r[colDN] ? String(Math.round(parseFloat(r[colDN]))||'').trim() || null : null,
      ativo:            true,
    });
  });

  return result;
}

function mostrarPreview(data, filename) {
  document.getElementById('drop-zone').innerHTML = `
    <div style="font-size:28px;margin-bottom:8px;">✅</div>
    <div style="font-size:14px;font-weight:600;color:#1D9E75;">${filename}</div>
    <div style="font-size:12px;color:var(--gray-600);margin-top:4px;">${data.length} lojas únicas processadas</div>
    <div style="font-size:11px;color:var(--gray-400);margin-top:6px;cursor:pointer;text-decoration:underline;" onclick="document.getElementById('file-input').click()">Trocar arquivo</div>
    <input type="file" id="file-input" accept=".xlsx,.xlsm" style="display:none" onchange="handleFile(this.files[0])"/>`;

  // Metrics
  const gcms  = new Set(data.map(d=>d.gcm).filter(Boolean)).size;
  const mrs   = new Set(data.map(d=>d.micro_regiao)).size;
  const volCB = data.reduce((s,d)=>s+(d.volume_carbank||0),0);
  const contCB= data.reduce((s,d)=>s+(d.contratos_carbank||0),0);

  document.getElementById('preview-metrics').innerHTML = `
    <div class="metric" style="padding:10px;"><div class="metric-label">Lojas</div><div class="metric-value" style="font-size:20px;">${data.length}</div></div>
    <div class="metric" style="padding:10px;"><div class="metric-label">GCMs</div><div class="metric-value" style="font-size:20px;">${gcms}</div></div>
    <div class="metric" style="padding:10px;"><div class="metric-label">Micro Regiões</div><div class="metric-value" style="font-size:20px;">${mrs}</div></div>
    <div class="metric" style="padding:10px;"><div class="metric-label">Vol. Carbank</div><div class="metric-value" style="font-size:16px;">${fmtK(volCB)}</div></div>`;

  // Sample table
  const sample = data.slice(0,5);
  document.getElementById('preview-sample').innerHTML = `
    <div style="font-size:11px;font-weight:600;color:var(--gray-600);margin-bottom:6px;">PRIMEIRAS 5 LINHAS:</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr style="background:var(--gray-50);">
        <th style="padding:4px 8px;text-align:left;border-bottom:1px solid var(--gray-200);">GCM</th>
        <th style="padding:4px 8px;text-align:left;border-bottom:1px solid var(--gray-200);">Razão Social</th>
        <th style="padding:4px 8px;text-align:left;border-bottom:1px solid var(--gray-200);">Bairro</th>
        <th style="padding:4px 8px;text-align:left;border-bottom:1px solid var(--gray-200);">MR</th>
        <th style="padding:4px 8px;text-align:right;border-bottom:1px solid var(--gray-200);">Vol CB</th>
      </tr></thead>
      <tbody>${sample.map(d=>`<tr>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);">${d.gcm}</td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.razao_social}</td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);">${d.bairro}</td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);"><span class="mr-pill" style="background:${MR_META[d.micro_regiao]?.cor||'#888'};font-size:9px;">${d.micro_regiao}</span></td>
        <td style="padding:4px 8px;border-bottom:1px solid var(--gray-100);text-align:right;">${fmtBRL(d.volume_carbank)}</td>
      </tr>`).join('')}</tbody>
    </table>`;

  document.getElementById('preview-status').textContent = `${data.length} lojas · ${gcms} GCMs`;
  document.getElementById('preview-box').style.display  = 'block';
  document.getElementById('btn-importar').style.display = 'block';
}

async function executarImport() {
  if (!sb)           { showToast('Supabase não configurado','error'); return; }
  if (!parsedData.length) { showToast('Nenhum dado para importar','error'); return; }

  const tipo = document.querySelector('input[name="tipo"]:checked')?.value || 'base';

  if (tipo === 'analitico') {
    await executarImportAnalitico();
    return;
  }
  const logEl = document.getElementById('log-content');
  document.getElementById('import-log').style.display = 'block';
  document.getElementById('btn-importar').disabled = true;
  logEl.textContent = '';

  const log = msg => { logEl.textContent += msg + '\n'; logEl.scrollTop = logEl.scrollHeight; };

  log(`Modo: ${modo === 'replace' ? 'SUBSTITUIR TUDO' : 'ATUALIZAR'}`);
  log(`Total de registros: ${parsedData.length}`);
  log('─'.repeat(40));

  try {
    if (modo === 'replace') {
      log('Apagando dados existentes...');
      const { error } = await sb.from('lojas').delete().neq('id', 0);
      if (error) throw error;
      log('✓ Dados apagados.');
    }

    const BATCH = 100;
    let total = 0;
    for (let i = 0; i < parsedData.length; i += BATCH) {
      const batch = parsedData.slice(i, i + BATCH);
      const { error } = modo === 'replace'
        ? await sb.from('lojas').insert(batch)
        : await sb.from('lojas').upsert(batch, { onConflict:'cnpj', ignoreDuplicates:false });
      if (error) throw error;
      total += batch.length;
      log(`✓ ${Math.min(i+BATCH, parsedData.length)} / ${parsedData.length} importadas...`);
    }

    log('─'.repeat(40));
    log(`✅ Concluído! ${total} lojas importadas com sucesso.`);
    showToast(`${total} lojas importadas ✓`, 'success');
    document.getElementById('btn-importar').disabled = false;
    setTimeout(() => { switchPage('dashboard'); loadLojas(); }, 1500);
  } catch(e) {
    log('❌ ERRO: ' + e.message);
    showToast('Erro na importação: ' + e.message, 'error');
    document.getElementById('btn-importar').disabled = false;
  }
}

function resetDropZone() {
  document.getElementById('drop-zone').innerHTML = `
    <div style="font-size:40px;margin-bottom:12px;">📊</div>
    <div style="font-size:16px;font-weight:600;color:#D85A30;margin-bottom:6px;">Arraste a planilha aqui</div>
    <div style="font-size:13px;color:var(--gray-600);">ou clique para selecionar</div>
    <div style="font-size:11px;color:var(--gray-400);margin-top:8px;">Aceita .xlsx e .xlsm</div>
    <input type="file" id="file-input" accept=".xlsx,.xlsm" style="display:none" onchange="handleFile(this.files[0])"/>`;
}

// ============================================================
// MODO COMPARAÇÃO DE GCMs
// ============================================================

let modoComparacao = false;

function toggleComparacao() {
  modoComparacao = !modoComparacao;
  const btnComp   = document.getElementById('btn-comparar');
  const modoNorm  = document.getElementById('modo-normal');
  const modoComp  = document.getElementById('modo-comparacao');
  const compPanel = document.getElementById('comp-panel');
  const separador = btnComp.previousElementSibling;

  if (modoComparacao) {
    // Garante que o mapa foi iniciado
    if (!mapaInitialized) initMapa();

    modoNorm.style.display   = 'none';
    if (separador) separador.style.display = 'none';
    modoComp.style.display   = 'flex';
    btnComp.style.background = '#534AB720';
    btnComp.style.color      = '#534AB7';

    // Popula selects com GCMs ativos
    const gcms = [...new Set(
      allLojas.filter(l => l.ativo !== false).map(l => l.gcm).filter(Boolean)
    )].sort();

    if (gcms.length < 2) {
      showToast('Precisa de pelo menos 2 GCMs para comparar', 'error');
      toggleComparacao();
      return;
    }

    const optsA = gcms.map((g, i) =>
      `<option value="${g}" ${i===0?'selected':''}>${g}</option>`).join('');
    const optsB = gcms.map((g, i) =>
      `<option value="${g}" ${i===1?'selected':''}>${g}</option>`).join('');

    document.getElementById('gcm-comp-a').innerHTML = optsA;
    document.getElementById('gcm-comp-b').innerHTML = optsB;

    aplicarComparacao();

  } else {
    modoNorm.style.display   = 'flex';
    if (separador) separador.style.display = '';
    modoComp.style.display   = 'none';
    compPanel.style.display  = 'none';
    btnComp.style.background = '';
    btnComp.style.color      = '#534AB7';
    refreshMapa();
  }
}

function aplicarComparacao() {
  const gcmA = document.getElementById('gcm-comp-a').value;
  const gcmB = document.getElementById('gcm-comp-b').value;
  if (!gcmA || !gcmB) return;

  const active = allLojas.filter(l => l.ativo !== false);
  const lojasA = active.filter(l => l.gcm === gcmA);
  const lojasB = active.filter(l => l.gcm === gcmB);
  const corA   = gcmColorMap[gcmA] || '#D85A30';
  const corB   = gcmColorMap[gcmB] || '#534AB7';

  // MRs em comum
  const mrsA      = new Set(lojasA.map(l => l.micro_regiao));
  const mrsB      = new Set(lojasB.map(l => l.micro_regiao));
  const mrsComuns = [...mrsA].filter(mr => mrsB.has(mr));

  // Lojas nas MRs em comum
  const lojasAcomuns = lojasA.filter(l => mrsComuns.includes(l.micro_regiao));
  const lojasBcomuns = lojasB.filter(l => mrsComuns.includes(l.micro_regiao));

  // Atualiza painel
  document.getElementById('comp-panel').style.display = 'block';

  const cardA = document.getElementById('comp-card-a');
  cardA.innerHTML = `
    <div style="padding:12px 14px;background:${corA}12;border-bottom:1px solid var(--gray-100);">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:32px;height:32px;border-radius:50%;background:${corA}25;color:${corA};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">${gcmA.split(' ')[0][0]}${gcmA.split(' ')[1]?.[0]||''}</div>
        <div style="font-size:12px;font-weight:600;color:${corA};line-height:1.2;">${gcmA}</div>
      </div>
    </div>
    <div style="padding:12px 14px;">
      ${statRow('Lojas totais', lojasA.length, corA)}
      ${statRow('Contratos CB', lojasA.reduce((s,l)=>s+(l.contratos_carbank||0),0), corA)}
      ${statRow('Volume CB', fmtK(lojasA.reduce((s,l)=>s+(l.volume_carbank||0),0)), corA)}
      ${statRow('MRs atendidas', [...mrsA].join(', '), corA)}
      <div style="margin-top:10px;padding:8px;background:${corA}10;border-radius:6px;font-size:11px;color:${corA};font-weight:500;">
        ${lojasAcomuns.length} lojas em MRs compartilhadas
      </div>
    </div>`;

  const cardB = document.getElementById('comp-card-b');
  cardB.style.borderTopColor = corB;
  cardB.innerHTML = `
    <div style="padding:12px 14px;background:${corB}12;border-bottom:1px solid var(--gray-100);">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:32px;height:32px;border-radius:50%;background:${corB}25;color:${corB};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">${gcmB.split(' ')[0][0]}${gcmB.split(' ')[1]?.[0]||''}</div>
        <div style="font-size:12px;font-weight:600;color:${corB};line-height:1.2;">${gcmB}</div>
      </div>
    </div>
    <div style="padding:12px 14px;">
      ${statRow('Lojas totais', lojasB.length, corB)}
      ${statRow('Contratos CB', lojasB.reduce((s,l)=>s+(l.contratos_carbank||0),0), corB)}
      ${statRow('Volume CB', fmtK(lojasB.reduce((s,l)=>s+(l.volume_carbank||0),0)), corB)}
      ${statRow('MRs atendidas', [...mrsB].join(', '), corB)}
      <div style="margin-top:10px;padding:8px;background:${corB}10;border-radius:6px;font-size:11px;color:${corB};font-weight:500;">
        ${lojasBcomuns.length} lojas em MRs compartilhadas
      </div>
    </div>`;

  const overlap = document.getElementById('comp-card-overlap');
  const temSobreposicao = mrsComuns.length > 0;
  overlap.innerHTML = `
    <div style="padding:12px 14px;background:#F1EFE8;border-bottom:1px solid var(--gray-100);">
      <div style="font-size:12px;font-weight:600;color:#2C2C2A;">⇄ Análise de Remanejamento</div>
    </div>
    <div style="padding:12px 14px;">
      ${temSobreposicao ? `
        <div style="padding:8px;background:#FEF9C3;border-radius:6px;font-size:11px;color:#854D0E;font-weight:600;margin-bottom:10px;">
          ⚠️ MRs em comum: ${mrsComuns.join(', ')}
        </div>
        <div style="font-size:11px;color:var(--gray-600);margin-bottom:8px;">Lojas que podem ser remanejadas entre os GCMs:</div>
        ${mrsComuns.map(mr => {
          const metaMR = MR_META[mr] || {};
          const nA = lojasA.filter(l=>l.micro_regiao===mr).length;
          const nB = lojasB.filter(l=>l.micro_regiao===mr).length;
          return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
            <span class="mr-pill" style="background:${metaMR.cor||'#888'};font-size:9px;">${mr}</span>
            <span style="font-size:11px;color:${corA};font-weight:600;">${nA}</span>
            <span style="font-size:10px;color:var(--gray-400);">↔</span>
            <span style="font-size:11px;color:${corB};font-weight:600;">${nB}</span>
          </div>`;
        }).join('')}
        <div style="margin-top:12px;font-size:11px;color:var(--gray-500);line-height:1.5;">
          💡 Sugestão: considere transferir lojas da MR com mais concentração para equilibrar as carteiras.
        </div>
      ` : `
        <div style="padding:12px;background:#F0FFF4;border-radius:6px;font-size:12px;color:#166534;font-weight:500;text-align:center;">
          ✅ Sem sobreposição de MRs!<br/>
          <span style="font-weight:400;font-size:11px;">Estes GCMs atendem regiões completamente distintas.</span>
        </div>
      `}
    </div>`;

  // Atualiza mapa com só esses 2 GCMs
  renderMapaComparacao(gcmA, gcmB, corA, corB, mrsComuns);
}

function statRow(label, value, cor) {
  return `<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px;">
    <span style="color:var(--gray-500);">${label}</span>
    <span style="font-weight:600;color:${cor};">${value}</span>
  </div>`;
}

function renderMapaComparacao(gcmA, gcmB, corA, corB, mrsComuns) {
  if (!mapInstance) initMapa();
  mapMarkers.forEach(m => m.remove());
  mapMarkers = [];

  const active = allLojas.filter(l => l.ativo !== false);
  const lojasA = active.filter(l => l.gcm === gcmA);
  const lojasB = active.filter(l => l.gcm === gcmB);

  // Círculos de área por MR
  const mrsTodas = [...new Set([...lojasA, ...lojasB].map(l => l.micro_regiao))];
  mrsTodas.forEach(mr => {
    const meta = MR_META[mr] || {};
    if (!meta.lat) return;
    const isComum = mrsComuns.includes(mr);
    const c = L.circleMarker([meta.lat, meta.lng], {
      radius: 28,
      fillColor: isComum ? '#F59E0B' : meta.cor,
      color: isComum ? '#D97706' : '#fff',
      weight: isComum ? 2.5 : 1.5,
      opacity: 1,
      fillOpacity: isComum ? 0.22 : 0.10,
      dashArray: isComum ? '6,3' : null,
    }).addTo(mapInstance);
    if (isComum) {
      c.bindTooltip(`⚠️ ${mr} — MR compartilhada`, {permanent:false, direction:'top'});
    }
    mapMarkers.push(c);
  });

  // Pontos GCM A
  lojasA.forEach(l => {
    const meta = MR_META[l.micro_regiao] || {};
    const jLat = meta.lat + (Math.random()-.5)*(meta.scatter||0.025);
    const jLng = meta.lng + (Math.random()-.5)*((meta.scatter||0.025)*1.2);
    const dot = L.circleMarker([jLat, jLng], {
      radius:6, fillColor:corA, color:'#fff', weight:1.5, opacity:1, fillOpacity:0.9
    }).addTo(mapInstance);
    dot.bindPopup(popupLoja(l, corA, 'A'));
    dot.on('mouseover',function(){this.setStyle({radius:8});});
    dot.on('mouseout', function(){this.setStyle({radius:6});});
    mapMarkers.push(dot);
  });

  // Pontos GCM B (quadrados via divIcon para diferenciar)
  lojasB.forEach(l => {
    const meta = MR_META[l.micro_regiao] || {};
    const jLat = meta.lat + (Math.random()-.5)*(meta.scatter||0.025);
    const jLng = meta.lng + (Math.random()-.5)*((meta.scatter||0.025)*1.2);
    const dot = L.circleMarker([jLat, jLng], {
      radius:6, fillColor:corB, color:'#fff', weight:1.5, opacity:1, fillOpacity:0.9
    }).addTo(mapInstance);
    dot.bindPopup(popupLoja(l, corB, 'B'));
    dot.on('mouseover',function(){this.setStyle({radius:8});});
    dot.on('mouseout', function(){this.setStyle({radius:6});});
    mapMarkers.push(dot);
  });

  // Legend
  const legEl = document.getElementById('mapa-legend');
  if (legEl) {
    legEl.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:5px;background:${corA}18;color:${corA};font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${corA};"></span>${gcmA.split(' ')[0]}
      </span>
      <span style="display:inline-flex;align-items:center;gap:5px;background:${corB}18;color:${corB};font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${corB};"></span>${gcmB.split(' ')[0]}
      </span>
      ${mrsComuns.length ? `<span style="display:inline-flex;align-items:center;gap:5px;background:#FEF9C3;color:#854D0E;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;">⚠️ MR compartilhada</span>` : ''}`;
  }

  // Fit bounds para mostrar os 2 GCMs
  if (lojasA.length || lojasB.length) {
    const allMrs = [...new Set([...lojasA,...lojasB].map(l=>l.micro_regiao))];
    const coords = allMrs.map(mr=>MR_META[mr]).filter(m=>m&&m.lat).map(m=>[m.lat,m.lng]);
    if (coords.length) mapInstance.fitBounds(L.latLngBounds(coords).pad(0.15));
  }
}

function popupLoja(l, cor, gcmLabel) {
  const meta = MR_META[l.micro_regiao] || {};
  return `<div style="font-family:sans-serif;min-width:200px;">
    <div style="background:${meta.bg||'#eee'};padding:8px 10px;border-radius:6px 6px 0 0;margin:-12px -12px 8px;">
      <span style="background:${meta.cor};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;">${l.micro_regiao}</span>
      <span style="background:${cor};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;margin-left:4px;">GCM ${gcmLabel}</span>
      <div style="font-size:11px;font-weight:600;color:${meta.txt||'#333'};margin-top:4px;line-height:1.3;">${l.razao_social}</div>
    </div>
    <div style="font-size:11px;color:#777;margin-bottom:6px;">${l.bairro} · ${l.zona}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;">
      <div><span style="color:#aaa;">Contr. CB</span><br><strong style="color:${cor};">${l.contratos_carbank||0}</strong></div>
      <div><span style="color:#aaa;">Vol. CB</span><br><strong style="color:${cor};">${fmtBRL(l.volume_carbank)}</strong></div>
    </div>
    <div style="margin-top:6px;font-size:11px;font-weight:600;color:${cor};">👤 ${l.gcm}</div>
    ${porteBadge(l.porte)}
  </div>`;
}

// ============================================================
// GEOCODIFICAÇÃO — busca coordenadas reais pelo endereço
// ============================================================

let geoRunning  = false;
let geoPaused   = false;
let geoAbort    = false;

async function carregarStatusGeo() {
  if (!sb) return;
  const { data, error } = await sb.from('lojas')
    .select('id, geocoded')
    .eq('ativo', true);
  if (error || !data) return;

  const total   = data.length;
  const done    = data.filter(l => l.geocoded).length;
  const pending = total - done;
  const pct     = total > 0 ? Math.round(done/total*100) : 0;

  document.getElementById('geo-total').textContent   = total;
  document.getElementById('geo-done').textContent    = done;
  document.getElementById('geo-pending').textContent = pending;
  document.getElementById('geo-progress-bar').style.width = pct + '%';
  document.getElementById('geo-status-badge').textContent =
    done === total ? '✅ Todas geocodificadas!' : `${pct}% concluído`;
}

function geoLog(msg) {
  const el = document.getElementById('geo-log');
  if (!el) return;
  el.textContent += msg + '\n';
  el.scrollTop = el.scrollHeight;
}

async function geocodeAddress(address, cep) {
  // Tenta pelo CEP primeiro (mais preciso), depois pelo endereço completo
  const queries = [
    cep ? `${cep}, Brasil` : null,
    address,
    // Fallback simplificado
    address.split(',').slice(0,3).join(',') + ', Brasil'
  ].filter(Boolean);

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'CarbankSP/1.0 (carbank@sp.com.br)' }
      });
      const data = await r.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), query: q };
      }
    } catch(e) {
      // continua para próxima tentativa
    }
    await sleep(300);
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function iniciarGeocodificacao() {
  if (!sb) { showToast('Supabase não configurado', 'error'); return; }
  if (geoRunning) return;

  geoRunning = true;
  geoAbort   = false;
  geoPaused  = false;

  document.getElementById('btn-geo-start').style.display = 'none';
  document.getElementById('btn-geo-pause').style.display = 'inline-flex';
  document.getElementById('geo-log').textContent = '';

  geoLog('Buscando lojas sem coordenadas...');

  // Busca lojas pendentes
  const { data: lojas, error } = await sb.from('lojas')
    .select('id, cnpj, razao_social, bairro, zona, cep')
    .or('geocoded.is.null,geocoded.eq.false')
    .eq('ativo', true)
    .order('id');

  if (error) { geoLog('❌ Erro: ' + error.message); geoRunning = false; return; }
  if (!lojas || lojas.length === 0) {
    geoLog('✅ Todas as lojas já possuem coordenadas!');
    geoRunning = false;
    document.getElementById('btn-geo-start').style.display = 'inline-flex';
    document.getElementById('btn-geo-pause').style.display = 'none';
    return;
  }

  geoLog(`${lojas.length} lojas para geocodificar. Iniciando...\n${'─'.repeat(40)}`);

  // Busca lista de endereços do arquivo local
  let enderecos = {};
  try {
    const r = await fetch('geocode_list.json');
    const list = await r.json();
    list.forEach(item => { enderecos[item.cnpj] = item; });
  } catch(e) {
    geoLog('⚠️ geocode_list.json não encontrado, usando CEP como fallback.');
  }

  let ok = 0, fail = 0, i = 0;

  for (const loja of lojas) {
    if (geoAbort) break;
    while (geoPaused) { await sleep(500); }

    i++;
    const info    = enderecos[loja.cnpj];
    const address = info ? info.address : `${loja.bairro}, ${loja.zona}, SP, Brasil`;
    const cep     = info ? info.cep : (loja.cep || '');

    document.getElementById('geo-current').textContent = `[${i}/${lojas.length}] ${loja.razao_social}`;

    const coords = await geocodeAddress(address, cep);

    if (coords) {
      const { error: upErr } = await sb.from('lojas').update({
        lat: coords.lat, lng: coords.lng, geocoded: true
      }).eq('id', loja.id);

      if (upErr) {
        geoLog(`❌ [${i}] ${loja.razao_social} — erro ao salvar`);
        fail++;
      } else {
        ok++;
        geoLog(`✅ [${i}] ${loja.razao_social.slice(0,40)} → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
        // Atualiza progresso
        const total = lojas.length;
        document.getElementById('geo-progress-bar').style.width = Math.round(i/total*100) + '%';
      }
    } else {
      geoLog(`⚠️ [${i}] ${loja.razao_social.slice(0,40)} — não encontrado`);
      // Marca como tentado para não ficar em loop
      await sb.from('lojas').update({ geocoded: false }).eq('id', loja.id);
      fail++;
    }

    // Respeita limite do Nominatim: 1 req/s
    await sleep(1100);
  }

  geoLog(`\n${'─'.repeat(40)}`);
  geoLog(`✅ Concluído! ${ok} geocodificadas, ${fail} não encontradas.`);
  geoRunning = false;
  geoAbort   = false;
  document.getElementById('btn-geo-start').style.display = 'inline-flex';
  document.getElementById('btn-geo-pause').style.display = 'none';
  document.getElementById('btn-geo-start').textContent   = '▶ Continuar';
  document.getElementById('geo-current').textContent     = '';
  carregarStatusGeo();
  showToast(`${ok} lojas geocodificadas ✓`, 'success');
}

function pausarGeocodificacao() {
  geoPaused = !geoPaused;
  document.getElementById('btn-geo-pause').textContent = geoPaused ? '▶ Retomar' : '⏸ Pausar';
  if (geoPaused) geoLog('⏸ Pausado...');
  else geoLog('▶ Retomando...');
}

// ── Mapa (scatter por MR, sem geocodificação) ──
function refreshMapa() {
  if (!mapInstance) return;
  mapMarkers.forEach(m => m.remove());
  mapMarkers = [];

  const active    = allLojas.filter(l => l.ativo !== false);
  const filterMR  = document.getElementById('mapa-mr-filter')?.value  || '';
  const filterGCM = document.getElementById('mapa-gcm-filter')?.value || '';

  const toPlot = active.filter(l => {
    if (filterMR  && l.micro_regiao !== filterMR)  return false;
    if (filterGCM && l.gcm !== filterGCM)          return false;
    return true;
  });

  // Círculos de área por MR
  Object.entries(MR_META).forEach(([mr, meta]) => {
    const lojas = toPlot.filter(l => l.micro_regiao === mr);
    if (!lojas.length || !meta.lat) return;
    const c = L.circleMarker([meta.lat, meta.lng], {
      radius: 20 + (lojas.length / 103) * 30,
      fillColor: meta.cor, color: '#fff',
      weight: 1.5, opacity: 1, fillOpacity: 0.10
    }).addTo(mapInstance);
    mapMarkers.push(c);
  });

  // Pontos individuais com scatter por MR
  toPlot.forEach(l => {
    const meta   = MR_META[l.micro_regiao] || {};
    if (!meta.lat) return;
    const gcmCor = gcmColorMap[l.gcm] || meta.cor || '#888';
    const sc     = meta.scatter || 0.025;
    const jLat   = meta.lat + (Math.random() - 0.5) * sc;
    const jLng   = meta.lng + (Math.random() - 0.5) * sc * 1.2;

    // Calcula faixa de produção
    const pct      = l.volume_carbank > 0 ? Math.round((l.prod_valor||0) / l.volume_carbank * 100) : -1;
    const prodInfo = (l.prod_valor !== null && l.prod_valor !== undefined) ? getProdCor(pct) : null;
    const isZero   = prodInfo && prodInfo.label === 'Vermelho';
    const ringCor  = prodInfo ? prodInfo.cor : '#fff';

    let dot;

    if (isZero) {
      // Ponto pulsante APENAS para lojas zeradas (0%)
      const pulseIcon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:26px;height:26px;">
          <style>
            @keyframes cb-pulse {
              0%   { transform:translate(-50%,-50%) scale(1);   opacity:.7; }
              70%  { transform:translate(-50%,-50%) scale(2.4); opacity:0; }
              100% { transform:translate(-50%,-50%) scale(1);   opacity:0; }
            }
          </style>
          <div style="
            position:absolute;top:50%;left:50%;
            transform:translate(-50%,-50%);
            width:14px;height:14px;border-radius:50%;
            background:${gcmCor};border:2.5px solid #E24B4A;z-index:2;
          "></div>
          <div style="
            position:absolute;top:50%;left:50%;
            width:14px;height:14px;border-radius:50%;
            background:#E24B4A;opacity:.55;
            animation:cb-pulse 1.2s ease-out infinite;
          "></div>
        </div>`,
        iconSize:   [26, 26],
        iconAnchor: [13, 13],
      });
      dot = L.marker([jLat, jLng], { icon: pulseIcon, zIndexOffset: 200 }).addTo(mapInstance);

    } else {
      // Todos os outros pontos: círculo com borda colorida pela faixa
      dot = L.circleMarker([jLat, jLng], {
        radius:      7,
        fillColor:   gcmCor,
        color:       ringCor,
        weight:      prodInfo ? 2.5 : 1.5,
        opacity:     1,
        fillOpacity: 0.88
      }).addTo(mapInstance);
      dot.on('mouseover', function(){ this.setStyle({radius:9}); });
      dot.on('mouseout',  function(){ this.setStyle({radius:7}); });
    }

    dot.bindPopup(`
      <div style="font-family:sans-serif;min-width:210px;">
        <div style="background:${meta.bg||'#eee'};padding:8px 10px;border-radius:6px 6px 0 0;margin:-12px -12px 8px;">
          <span style="background:${meta.cor};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;">${l.micro_regiao}</span>
          <div style="font-size:11px;font-weight:600;color:${meta.txt||'#333'};margin-top:4px;line-height:1.3;">${l.razao_social}</div>
        </div>
        <div style="font-size:11px;color:#777;margin-bottom:6px;">${l.bairro} · ${l.zona}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;margin-bottom:6px;">
          <div><span style="color:#aaa;">Contr. CB</span><br><strong style="color:#185FA5;">${l.contratos_carbank||0}</strong></div>
          <div><span style="color:#aaa;">Vol. CB</span><br><strong style="color:#185FA5;">${fmtBRL(l.volume_carbank)}</strong></div>
        </div>
        ${prodInfo ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;margin-bottom:6px;">
          <div><span style="color:#aaa;">Prod. Qtd</span><br><strong style="color:${prodInfo.cor};">${l.prod_qtd||0}</strong></div>
          <div><span style="color:#aaa;">Val. Financiado</span><br><strong style="color:${prodInfo.cor};">${fmtBRL(l.prod_valor)}</strong></div>
        </div>
        <div style="background:${prodInfo.bg};color:${prodInfo.cor};font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;margin-bottom:4px;">
          ${pct >= 0 ? pct+'% do potencial · ' : ''}${prodInfo.label}
        </div>` : ''}
        <div style="background:${gcmCor}20;color:${gcmCor};font-size:11px;font-weight:600;padding:4px 8px;border-radius:6px;">${porteBadgeStr(l.porte)}</div>
        ${l.gcm ? `<div style="margin-top:5px;font-size:11px;font-weight:600;color:${gcmCor};">👤 ${l.gcm}</div>` : ''}
      </div>`, { offset:[0,-3] });

    dot.on('mouseover', function(){ this.setStyle({radius: dotRadius+2, weight: ringWeight+1}); });
    dot.on('mouseout',  function(){ this.setStyle({radius: dotRadius,   weight: ringWeight}); });
    mapMarkers.push(dot);
  });

  // Legenda
  const legEl = document.getElementById('mapa-legend');
  if (legEl) {
    const gcms = [...new Set(toPlot.map(l => l.gcm).filter(Boolean))];
    const gcmLeg = gcms.length > 0
      ? gcms.map(g => `<span style="display:inline-flex;align-items:center;gap:5px;background:${gcmColorMap[g]}18;color:${gcmColorMap[g]};font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${gcmColorMap[g]};"></span>${g.split(' ')[0]}
        </span>`).join('')
      : Object.entries(MR_META).map(([mr, m]) => `<span style="display:inline-flex;align-items:center;gap:5px;background:${m.bg};color:${m.txt};font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${m.cor};"></span>${mr}
        </span>`).join('');

    legEl.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:5px;">${gcmLeg}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;padding-top:6px;border-top:1px solid var(--gray-200);align-items:center;">
        <span style="font-size:10px;color:var(--gray-500);">Produção:</span>
        <span style="display:inline-flex;align-items:center;gap:4px;background:#E6F1FB;color:#185FA5;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;border:2px solid #185FA5;">● &gt;15%</span>
        <span style="display:inline-flex;align-items:center;gap:4px;background:#E1F5EE;color:#1D9E75;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;border:2px solid #1D9E75;">● 10-15%</span>
        <span style="display:inline-flex;align-items:center;gap:4px;background:#FAEEDA;color:#BA7517;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;border:2px solid #BA7517;">● 6-9%</span>
        <span style="display:inline-flex;align-items:center;gap:4px;background:#FAECE7;color:#D85A30;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;border:2px solid #D85A30;">● 1-5%</span>
        <span style="display:inline-flex;align-items:center;gap:4px;background:#FCEBEB;color:#E24B4A;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;border:2px solid #E24B4A;animation:cb-pulse-leg 1.2s ease-out infinite;">◉ 0% crítico</span>
      </div>`;
  }

  const mapGcmSel = document.getElementById('mapa-gcm-filter');
  if (mapGcmSel) {
    const gcms = [...new Set(active.map(l => l.gcm).filter(Boolean))].sort();
    const cur  = mapGcmSel.value;
    mapGcmSel.innerHTML = '<option value="">Todos os GCMs</option>' +
      gcms.map(g => `<option value="${g}" ${g===cur?'selected':''}>${g}</option>`).join('');
  }
}
