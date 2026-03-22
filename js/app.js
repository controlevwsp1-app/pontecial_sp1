// ============================================================
// app.js — CARBANK · Potencial Leste/Norte/GRU
// ============================================================

const CFG      = window.CARBANK_CONFIG || {};
const SUPA_URL = CFG.supabaseUrl || '';
const SUPA_KEY = CFG.supabaseKey || '';

const MR_META = {
  'MR-L1': { nome:'Brás · Moóca · Tatuapé · Carrão',                    zona:'Zona Leste',  cor:'#D85A30', bg:'#FAECE7', txt:'#712B13', lat:-23.548, lng:-46.590 },
  'MR-L2': { nome:'São Lucas · Vila Matilde · Penha · Cangaíba',         zona:'Zona Leste',  cor:'#993C1D', bg:'#F5C4B3', txt:'#4A1B0C', lat:-23.565, lng:-46.545 },
  'MR-L3': { nome:'Ermelino Matarazzo · São Mateus · Guaianazes',        zona:'Zona Leste',  cor:'#F0997B', bg:'#FAECE7', txt:'#712B13', lat:-23.553, lng:-46.490 },
  'MR-L4': { nome:'São Miguel Paulista · Itaim Paulista · Itaquera',     zona:'Zona Leste',  cor:'#7F2B10', bg:'#F5C4B3', txt:'#4A1B0C', lat:-23.507, lng:-46.440 },
  'MR-N1': { nome:'Santana · Tucuruvi · Vila Guilherme · Vila Maria',    zona:'Zona Norte',  cor:'#534AB7', bg:'#EEEDFE', txt:'#26215C', lat:-23.490, lng:-46.625 },
  'MR-N2': { nome:'Casa Verde · Brasilândia · Freq. do Ó · Pirituba',    zona:'Zona Norte',  cor:'#7F77DD', bg:'#CECBF6', txt:'#26215C', lat:-23.470, lng:-46.680 },
  'MR-G1': { nome:'Guarulhos',                                           zona:'Guarulhos',   cor:'#0F6E56', bg:'#E1F5EE', txt:'#04342C', lat:-23.460, lng:-46.534 },
  'MR-G2': { nome:'Arujá · Santa Isabel',                                zona:'Guarulhos',   cor:'#1D9E75', bg:'#9FE1CB', txt:'#04342C', lat:-23.398, lng:-46.321 },
  'MR-M1': { nome:'Mogi das Cruzes',                                     zona:'ABC/Leste',   cor:'#185FA5', bg:'#E6F1FB', txt:'#042C53', lat:-23.522, lng:-46.186 },
  'MR-M2': { nome:'Suzano',                                              zona:'ABC/Leste',   cor:'#378ADD', bg:'#B5D4F4', txt:'#042C53', lat:-23.543, lng:-46.311 },
  'MR-M3': { nome:'Itaquaquecetuba · Ferraz de Vasconcelos · Poá',       zona:'ABC/Leste',   cor:'#85B7EB', bg:'#E6F1FB', txt:'#042C53', lat:-23.487, lng:-46.348 },
  'MR-S1': { nome:'Zona Sul · São Bernardo do Campo',                    zona:'Zona Sul',    cor:'#BA7517', bg:'#FAEEDA', txt:'#633806', lat:-23.660, lng:-46.680 },
  'MR-C1': { nome:'Centro · Zona Oeste',                                 zona:'Centro',      cor:'#888780', bg:'#F1EFE8', txt:'#2C2C2A', lat:-23.550, lng:-46.645 },
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
    const { data, error } = await sb.from('lojas').select('*').order('gcm').order('razao_social');
    if (error) throw error;
    allLojas = data || [];
    processGCMColors();
    renderAll();
  } catch(e) {
    showToast('Erro ao carregar: ' + e.message, 'error');
    await loadSeed();
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
    const meta   = MR_META[l.micro_regiao]||{};
    const cor    = gcmCol[l.gcm]||'#888';
    const inativo = l.ativo===false;
    return `
    <tr class="${inativo?'inativo':''}" data-id="${l.id}">
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
      <td style="text-align:center;font-weight:600;color:#185FA5;">${l.contratos_carbank||0}</td>
      <td style="text-align:right;font-weight:600;color:#185FA5;">${fmtBRL(l.volume_carbank)}</td>
      <td style="text-align:center;color:var(--gray-600);">${l.contratos_geral||0}</td>
      <td style="text-align:right;color:var(--gray-600);">${fmtBRL(l.volume_geral)}</td>
      <td>
        <button class="btn btn-icon btn-danger btn-sm" onclick="confirmarExclusao(${l.id})" title="${inativo?'Reativar':'Desativar'}">
          ${inativo?'↩':'✕'}
        </button>
      </td>
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
    .setView([-23.510, -46.510], 10);
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
    const jLat = meta.lat + (Math.random()-.5)*0.06;
    const jLng = meta.lng + (Math.random()-.5)*0.07;

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
  if (id==='mapa') setTimeout(initMapa,100);
}

// ── IMPORT ──
async function importarSeed() {
  if (!sb) { showToast('Supabase não configurado','error'); return; }
  showLoading(true,'Importando dados...');
  try {
    const r = await fetch('data_seed.json');
    const raw = await r.json();

    // Remove duplicatas pelo CNPJ (mantém o primeiro)
    const seen = new Set();
    const data = raw.filter(l => {
      if (!l.cnpj || seen.has(l.cnpj)) return false;
      seen.add(l.cnpj);
      return true;
    });

    // Importa em lotes de 100 para evitar timeout
    const BATCH = 100;
    let total = 0;
    for (let i = 0; i < data.length; i += BATCH) {
      const batch = data.slice(i, i + BATCH);
      showLoading(true, `Importando ${Math.min(i+BATCH, data.length)} de ${data.length}...`);
      const { error } = await sb.from('lojas').upsert(batch, {onConflict:'cnpj'});
      if (error) throw error;
      total += batch.length;
    }

    showToast(`${total} lojas importadas ✓`, 'success');
    await loadLojas();
  } catch(e) {
    showToast('Erro: '+e.message,'error');
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
