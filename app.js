// ═══════════════════════════════════════════════
//  DYNAMIC ASSET LOADER
// ═══════════════════════════════════════════════
const loadedScripts = {};
function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (loadedScripts[url]) return resolve();
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => { loadedScripts[url] = true; resolve(); };
    script.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(script);
  });
}

// ═══════════════════════════════════════════════
//  CONFIG & STATE
// ═══════════════════════════════════════════════
const API_BASE = 'https://ancient-credit-7433.wilsonzambrano.workers.dev';
let jwt = sessionStorage.getItem('wz_drop_jwt');
let currentMode = 'file';
let selectedFiles = []; 
let drops = [];

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (jwt) {
    showApp();
    triggerPageData();
  } else {
    showLogin();
    if (document.getElementById('public-log-list')) loadPublicDrops();
  }

  const loginPass = document.getElementById('login-password');
  const loginUser = document.getElementById('login-username');
  if (loginPass) loginPass.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  if (loginUser) loginUser.addEventListener('keydown', e => { if (e.key === 'Enter') loginPass.focus(); });

  if (document.getElementById('drop-zone')) {
    setupDragDrop();
    setupFileInput();
  }
});

function triggerPageData() {
    if (document.getElementById('log-list')) loadDrops();
    if (document.getElementById('dash-positions-table')) fetchFinanceData();
}

// ═══════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  
  if (!username || !password) { errEl.textContent = 'Username and password required.'; errEl.style.display = 'block'; return; }
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>&nbsp;Authenticating...'; errEl.style.display = 'none';
  
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) throw new Error(data.error || 'Login failed');
    jwt = data.token;
    sessionStorage.setItem('wz_drop_jwt', jwt);
    showApp();
    triggerPageData();
  } catch (err) {
    errEl.textContent = err.message || 'Authentication failed.'; errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Authenticate';
  }
}

function doLogout() {
  jwt = null;
  sessionStorage.removeItem('wz_drop_jwt');
  drops = [];
  showLogin();
  if (document.getElementById('public-log-list')) loadPublicDrops();
  showToast('Logged out');
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  const appScreen = document.getElementById('app-screen');
  if (appScreen) appScreen.style.display = 'none';
  
  const accessVal = document.getElementById('nav-access-val');
  if (accessVal) { accessVal.textContent = '● Locked'; accessVal.style.color = 'var(--red)'; }
  const topLogout = document.getElementById('top-logout-btn');
  if (topLogout) topLogout.style.display = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  const appScreen = document.getElementById('app-screen');
  if (appScreen) appScreen.style.display = 'block';
  
  const accessVal = document.getElementById('nav-access-val');
  if (accessVal) { accessVal.textContent = '● Authenticated'; accessVal.style.color = 'var(--green)'; }
  const topLogout = document.getElementById('top-logout-btn');
  if (topLogout) topLogout.style.display = 'inline-flex';
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...(options.headers || {}), 'Authorization': `Bearer ${jwt}` }});
  if (res.status === 401) { doLogout(); throw new Error('Session expired.'); }
  return res;
}

// ═══════════════════════════════════════════════
//  FINANCE TERMINAL LOGIC
// ═══════════════════════════════════════════════
async function fetchFinanceData() {
  try {
    const res = await apiFetch('/api/finance/dashboard');
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const margin = Number(data.availableMargin);
    const availEl = document.getElementById('dash-margin-avail');
    if (availEl) availEl.textContent = !isNaN(margin) ? '$' + margin.toLocaleString(undefined, {minimumFractionDigits: 2}) : 'ERR';
    
    const vixEl = document.getElementById('dash-vix');
    if (vixEl) vixEl.textContent = data.vix || '—';
    
    const net = Number(data.netEarnings);
    const netEl = document.getElementById('dash-net');
    if (netEl) {
        netEl.textContent = !isNaN(net) ? '$' + net.toLocaleString(undefined, {minimumFractionDigits: 2}) : 'ERR';
        netEl.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
    }

    const tableBody = document.getElementById('dash-positions-table');
    if (tableBody) {
        tableBody.innerHTML = ''; 
        if (data.portfolioTable && data.portfolioTable.length > 1) {
            data.portfolioTable.slice(1).forEach(row => {
                const ticker = row[0]; 
                if (!ticker || typeof ticker !== 'string') return; 

                const shares = row[2] || 0;     
                const avgCost = row[3] || 0;    
                let price = row[4] || 0;    
                
                if (data.liveMarket && data.liveMarket[ticker] && data.liveMarket[ticker].latestTrade) {
                    price = data.liveMarket[ticker].latestTrade.p;
                }

                let roi = row[18] || 0; 
                if (avgCost > 0 && price > 0) roi = (price - avgCost) / avgCost;

                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--line)';
                const roiColor = roi >= 0 ? 'var(--green)' : 'var(--red)';

                tr.innerHTML = `
                  <td style="padding: 8px 10px; font-weight: 700; border-right: 1px solid var(--line);">${ticker}</td>
                  <td style="padding: 8px 10px; border-right: 1px solid var(--line);">${shares}</td>
                  <td style="padding: 8px 10px; border-right: 1px solid var(--line);">$${Number(avgCost).toFixed(2)}</td>
                  <td style="padding: 8px 10px; border-right: 1px solid var(--line);">$${Number(price).toFixed(2)}</td>
                  <td style="padding: 8px 10px; font-weight: 600; color: ${roiColor};">${(roi * 100).toFixed(2)}%</td>
                `;
                tableBody.appendChild(tr);
            });
        }
    }

    const statusBox = document.getElementById('connection-status');
    if (statusBox) {
        statusBox.style.borderColor = 'var(--green)';
        statusBox.innerHTML = '<p style="font-size: 0.6rem; color: var(--green); text-transform: uppercase; letter-spacing: 0.1em;">Secure Alpaca/Sheets Bridge Connected.</p>';
    }

    // Render the charts independently so if they fail, the rest stays intact
    renderTerminalCharts().catch(e => console.error("Chart Render Failed", e));

  } catch (err) {
    console.error(err);
    ['dash-margin-avail', 'dash-vix', 'dash-net'].forEach(id => {
       const el = document.getElementById(id);
       if (el) el.textContent = "ERR";
    });
    showToast('Failed to sync financial data', true);
  }
}

async function submitTrade() {
  const btn = document.getElementById('trade-submit-btn');
  const action = document.getElementById('trade-action').value;
  const ticker = document.getElementById('trade-ticker').value.trim().toUpperCase();
  const shares = parseFloat(document.getElementById('trade-shares').value);
  const price = parseFloat(document.getElementById('trade-price').value);

  if (!ticker || isNaN(shares) || isNaN(price)) {
    showToast('Please fill out all trade fields', true);
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>&nbsp; Logging...';

  try {
    const res = await apiFetch('/api/finance/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ticker, shares, price })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to log trade');

    showToast(`Logged: ${action} ${shares} ${ticker}`);
    
    document.getElementById('trade-ticker').value = '';
    document.getElementById('trade-shares').value = '';
    document.getElementById('trade-price').value = '';

    fetchFinanceData();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><polyline points="20 6 9 17 4 12"/></svg> Log Trade';
  }
}

// ── Math Helpers for Charts ──
function calculateSMA(data, period) {
    return data.map((val, i, arr) => {
        if (i < period - 1) return null;
        let sum = 0;
        for (let j = 0; j < period; j++) sum += arr[i - j];
        return sum / period;
    });
}

function calculateBollingerBands(data, period, multiplier) {
    const sma = calculateSMA(data, period);
    const upper = []; const lower = [];
    
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) { upper.push(null); lower.push(null); } 
        else {
            let sumSq = 0;
            for (let j = 0; j < period; j++) sumSq += Math.pow(data[i - j] - sma[i], 2);
            let sd = Math.sqrt(sumSq / period);
            upper.push(sma[i] + (multiplier * sd));
            lower.push(sma[i] - (multiplier * sd));
        }
    }
    return { sma, upper, lower };
}

let chartVixInstance = null;
let chartS5FIInstance = null;

async function renderTerminalCharts() {
  try {
    const res = await apiFetch('/api/finance/charts');
    const data = await res.json();
    
    if(!data.vix || !data.spy || data.error) throw new Error("Chart data missing");

    const vixResult = data.vix.chart.result[0];
    const spyResult = data.spy.chart.result[0];

    const timestamps = vixResult.timestamp.map(t => new Date(t * 1000).toLocaleDateString(undefined, {month:'short', day:'numeric'}));
    const vixPrices = vixResult.indicators.quote[0].close;
    const spyPrices = spyResult.indicators.quote[0].close;

    const vixSMA30 = calculateSMA(vixPrices, 30);
    const { sma: spySMA20, upper: spyUpper, lower: spyLower } = calculateBollingerBands(spyPrices, 20, 2);

    Chart.defaults.font.family = "'IBM Plex Mono', monospace";
    Chart.defaults.color = "#2a4060";
    const gridColor = "rgba(10,22,40,0.1)";

    const ctxVix = document.getElementById('chartVix');
    if (ctxVix) {
        if (chartVixInstance) chartVixInstance.destroy();
        chartVixInstance = new Chart(ctxVix, {
            type: 'line',
            data: {
                labels: timestamps,
                datasets: [
                    { label: 'VIX', data: vixPrices, borderColor: '#0a1628', borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
                    { label: '30D SMA', data: vixSMA30, borderColor: '#b01020', borderWidth: 1, borderDash: [5, 5], pointRadius: 0, tension: 0.1 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { color: gridColor } }, y: { grid: { color: gridColor } } } }
        });
    }

    const ctxS5 = document.getElementById('chartS5FI');
    if (ctxS5) {
        if (chartS5FIInstance) chartS5FIInstance.destroy();
        chartS5FIInstance = new Chart(ctxS5, {
            type: 'line',
            data: {
                labels: timestamps,
                datasets: [
                    { label: 'Price', data: spyPrices, borderColor: '#0a1628', borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
                    { label: 'Upper', data: spyUpper, borderColor: 'rgba(42,122,42,0.5)', backgroundColor: 'rgba(42,122,42,0.05)', borderWidth: 1, pointRadius: 0, fill: '+1' },
                    { label: 'Lower', data: spyLower, borderColor: 'rgba(176,16,32,0.5)', borderWidth: 1, pointRadius: 0, fill: false },
                    { label: '20D SMA', data: spySMA20, borderColor: '#2a4060', borderWidth: 1, borderDash: [3, 3], pointRadius: 0 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { color: gridColor } }, y: { grid: { color: gridColor } } } }
        });
    }
  } catch (err) {
      console.error("Failed to render charts", err);
  }
}

// ═══════════════════════════════════════════════
//  DROP ZONE LOGIC
// ═══════════════════════════════════════════════
async function loadDrops() {
  const list = document.getElementById('log-list');
  if(!list) return;
  list.innerHTML = '<div class="log-loading"><span class="spinner"></span>&nbsp; Loading...</div>';
  try {
    const res = await apiFetch('/api/drop/list');
    const data = await res.json();
    drops = data.items || [];
    renderLog();
    const countEl = document.getElementById('status-count');
    if (countEl) countEl.textContent = drops.length;
    calculateStorage();
  } catch (err) {
    list.innerHTML = `<div class="log-loading" style="color:var(--red);">Error: ${escapeHTML(err.message)}</div>`;
  }
}

async function loadPublicDrops() {
  const list = document.getElementById('public-log-list');
  if(!list) return;
  list.innerHTML = '<div class="log-loading" style="padding: 20px;"><span class="spinner"></span>&nbsp; Loading...</div>';
  try {
    const res = await fetch(`${API_BASE}/api/drop/public/list`);
    const data = await res.json();
    const publicDrops = data.items || [];
    list.innerHTML = '';
    if (!publicDrops.length) { list.innerHTML = '<div class="log-empty">No public files available.</div>'; return; }
    
    publicDrops.forEach(item => {
      const div = document.createElement('div'); div.className = 'log-item';
      const ts = item.timestamp ? item.timestamp.replace('T',' ').substring(0,16) : '—';
      const nameEsc = escapeHTML(item.name || '');
      div.innerHTML = `
        <div class="log-item-header"><span class="log-type-badge file-type">FILE</span><span class="log-name">${nameEsc}</span></div>
        <div class="log-meta"><span>${ts}</span><span>${item.size||'—'}</span></div>
        <div class="log-actions"><a href="${API_BASE}/api/drop/public/item/${item.id}" download="${nameEsc}" class="log-btn" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</a></div>`;
      list.appendChild(div);
    });
  } catch (err) { list.innerHTML = `<div class="log-empty" style="color:var(--red);">Failed to load public files.</div>`; }
}

function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
  document.getElementById('file-mode-panel').style.display = mode === 'file' ? 'block' : 'none';
  document.getElementById('text-mode-panel').style.display = mode === 'text' ? 'block' : 'none';
  document.getElementById('url-mode-panel').style.display  = mode === 'url'  ? 'block' : 'none';
  
  const statusMode = document.getElementById('status-mode');
  if (statusMode) statusMode.textContent = mode === 'file' ? 'File' : mode === 'text' ? 'Text/Code' : 'URL';
  
  const publicToggle = document.getElementById('public-toggle-container');
  if (publicToggle) publicToggle.style.display = mode === 'file' ? 'flex' : 'none';
}

function setupDragDrop() {
  const zone = document.getElementById('drop-zone');
  if(!zone) return;
  ['dragenter', 'dragover'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.add('drag-over'); }));
  ['dragleave', 'dragend'].forEach(e => zone.addEventListener(e, () => { zone.classList.remove('drag-over'); }));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); if (e.dataTransfer.files.length) setFiles(e.dataTransfer.files); });
  document.body.addEventListener('dragover', e => e.preventDefault());
  document.body.addEventListener('drop', e => { e.preventDefault(); if (currentMode !== 'file') switchMode('file'); if (e.dataTransfer.files.length) setFiles(e.dataTransfer.files); });
}

function setupFileInput() {
  const fi = document.getElementById('file-input');
  if(fi) fi.addEventListener('change', e => { if (e.target.files.length) setFiles(e.target.files); });
}

function setFiles(files) {
  selectedFiles = Array.from(files);
  const zone = document.getElementById('drop-zone');
  if(!zone) return;
  
  zone.classList.add('has-file');
  document.getElementById('file-selected-info').style.display = 'block';
  if (selectedFiles.length === 1) {
    document.getElementById('file-name-display').textContent = selectedFiles[0].name;
    document.getElementById('file-size-display').textContent = formatBytes(selectedFiles[0].size);
    updateSpec({ type: 'file', name: selectedFiles[0].name, size: formatBytes(selectedFiles[0].size) });
  } else {
    const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);
    document.getElementById('file-name-display').textContent = `${selectedFiles.length} files selected`;
    document.getElementById('file-size-display').textContent = formatBytes(totalSize) + ' Total';
    updateSpec({ type: 'file', name: `Batch: ${selectedFiles.length} files`, size: formatBytes(totalSize) });
  }
}

async function handleSubmit() {
  const btn = document.getElementById('submit-btn');
  if(!btn) return;
  
  const note = document.getElementById('drop-note').value.trim();
  const ttl = document.getElementById('drop-ttl').value;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>&nbsp; Uploading...';
  try {
    let itemToSpec; let successMessage = '';
    if (currentMode === 'file') {
      if (!selectedFiles.length) throw new Error('No files selected');
      const fd = new FormData();
      selectedFiles.forEach(file => fd.append('file', file));
      if (note) fd.append('note', note);
      fd.append('isPublic', document.getElementById('is-public-toggle').checked);
      fd.append('ttl', ttl);
      const res = await apiFetch('/api/drop/file', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      drops = [...data.items, ...drops]; itemToSpec = data.items[0]; 
      successMessage = selectedFiles.length > 1 ? `${selectedFiles.length} files received` : (data.items[0].name || '').substring(0, 32);
      resetFileZone(); document.getElementById('is-public-toggle').checked = false;
    } else if (currentMode === 'text') {
      const title = document.getElementById('text-title').value.trim();
      const content = document.getElementById('text-content').value.trim();
      const lang = document.getElementById('text-lang').value;
      if (!content) throw new Error('No text entered');
      const res = await apiFetch('/api/drop/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, note, lang, ttl }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      drops.unshift(data.item); itemToSpec = data.item; successMessage = (data.item.name || '').substring(0, 32);
      document.getElementById('text-title').value = ''; document.getElementById('text-content').value = '';
    } else if (currentMode === 'url') {
      const label = document.getElementById('url-label').value.trim();
      const url = document.getElementById('url-input').value.trim();
      if (!url) throw new Error('No URL entered');
      const res = await apiFetch('/api/drop/url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, label, note, ttl }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      drops.unshift(data.item); itemToSpec = data.item; successMessage = (data.item.name || '').substring(0, 32);
      document.getElementById('url-label').value = ''; document.getElementById('url-input').value = '';
    }
    document.getElementById('drop-note').value = '';
    renderLog(); 
    const countEl = document.getElementById('status-count');
    if (countEl) countEl.textContent = drops.length;
    updateSpec(itemToSpec); calculateStorage();
    showToast('Received — ' + successMessage);
  } catch (err) { showToast(err.message || 'Error', true); } finally {
    btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send to Clipboard';
  }
}

function renderLog() {
  const list = document.getElementById('log-list');
  if(!list) return;
  list.innerHTML = '';
  if (!drops.length) { list.innerHTML = '<div class="log-empty">NO ENTRIES<br><span style="font-size:0.45rem;margin-top:4px;display:block;">Awaiting first drop</span></div>'; return; }
  drops.forEach(item => {
    const div = document.createElement('div'); div.className = 'log-item';
    const badge = item.type === 'file' ? 'file-type' : item.type === 'url' ? 'url-type' : '';
    const ts = item.timestamp ? item.timestamp.replace('T',' ').substring(0,16) : '—';
    const nameEsc = escapeHTML(item.name || '');
    let ttlBadge = '';
    if (item.ttl === 'burn') ttlBadge = '<span style="font-size:0.45rem; background:var(--red); color:var(--paper); padding:1px 4px; border-radius:2px; margin-left:6px;">🔥 BURN</span>';
    else if (item.ttl && item.ttl !== '2592000') ttlBadge = '<span style="font-size:0.45rem; border:1px solid var(--gold); color:var(--gold); padding:1px 4px; border-radius:2px; margin-left:6px;">⏱ TEMP</span>';
    const publicBadge = item.isPublic ? '<span style="font-size:0.45rem; background:var(--blue); color:var(--paper); padding:1px 4px; border-radius:2px; margin-left:6px;">PUBLIC</span>' : '';
    div.innerHTML = `
      <div class="log-item-header"><span class="log-type-badge ${badge}">${(item.type||'').toUpperCase()}</span><span class="log-name">${nameEsc}${publicBadge}${ttlBadge}</span></div>
      <div class="log-meta"><span>${ts}</span><span>${item.size||'—'}</span>${item.note ? `<span>· ${escapeHTML(item.note)}</span>` : ''}</div>
      <div class="log-actions">
        <button class="log-btn" onclick="previewItem('${item.id}','${item.type}','${nameEsc.replace(/'/g,"\\'")}')">Preview</button>
        <button class="log-btn" onclick="copyItem('${item.id}','${item.type}')">Copy</button>
        ${item.type === 'file' ? `<button class="log-btn" onclick="downloadItem('${item.id}','${nameEsc.replace(/'/g,"\\'")}')">Download</button>` : ''}
        <button class="log-btn danger" onclick="deleteItem('${item.id}')">Delete</button>
      </div>`;
    div.addEventListener('mouseenter', () => updateSpec(item)); list.appendChild(div);
  });
}

// ═══════════════════════════════════════════════
//  ITEM ACTIONS, PREVIEW & UTILS
// ═══════════════════════════════════════════════
async function previewItem(id, type, name) {
  const item = drops.find(d => d.id == id); if (!item) return;
  document.getElementById('preview-title').textContent = name;
  const content = document.getElementById('preview-content');
  content.innerHTML = '<div class="preview-center"><span class="spinner"></span>&nbsp; Loading...</div>';
  document.getElementById('preview-overlay').classList.add('open');
  try {
    const res = await apiFetch(`/api/drop/item/${id}`);
    if (type === 'file') {
      const blob = await res.blob(); const url = URL.createObjectURL(blob); const lowerName = name.toLowerCase();
      if (lowerName.endsWith('.stl')) { content.innerHTML = '<div class="preview-center"><span class="spinner"></span>&nbsp; Fetching 3D Engine...</div>'; await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'); await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js'); await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'); renderSTLViewer(url, name, content); }
      else if (lowerName.endsWith('.dxf')) { content.innerHTML = '<div class="preview-center"><span class="spinner"></span>&nbsp; Fetching Vector Engine...</div>'; await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'); await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'); await loadScript('https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/dist/dxf-parser.js'); renderDXFViewer(url, name, content); }
      else if (lowerName.endsWith('.pdf')) { renderPDFViewer(url, name, content); }
      else if (lowerName.endsWith('.docx')) { renderDOCXViewer(blob, name, content); }
      else if (lowerName.endsWith('.sldprt') || lowerName.endsWith('.slprt')) { content.innerHTML = `<div class="preview-center"><span class="log-type-badge file-type" style="font-size: 1rem; padding: 4px 12px; margin-bottom: 12px; display: inline-block;">PROPRIETARY CAD DATA</span><br><br><strong style="font-size: 1.2rem; color: var(--ink);">${escapeHTML(name)}</strong><br><br><span style="color:var(--red);">Client-side web preview is unavailable for native SolidWorks part files.</span><br><span style="color:var(--ink-dim);">Please download the file to view it in SolidWorks, eDrawings, or export as .STL / .STEP prior to upload.</span><br><br><a href="${url}" download="${escapeHTML(name)}" class="btn btn-solid" style="display:inline-flex;margin-top:16px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Part File</a></div>`; }
      else if (blob.type.startsWith('image/')) { const img = document.createElement('img'); img.src = url; img.className = 'preview-img'; content.innerHTML = ''; content.appendChild(img); }
      else { content.innerHTML = `<div class="preview-center">${blob.type === 'application/pdf' ? 'PDF' : 'File'}: <strong>${escapeHTML(name)}</strong><br><br><a href="${url}" download="${escapeHTML(name)}" class="btn btn-outline" style="display:inline-flex;margin-top:8px;">Download →</a></div>`; }
    } else {
      const data = await res.json(); const val = data.value || '';
      if (type === 'url') { content.innerHTML = `<p class="preview-url">${escapeHTML(val)}</p><a href="${escapeHTML(val)}" target="_blank" rel="noopener" class="btn btn-outline" style="display:inline-flex;margin-top:12px;">Open URL →</a>`; }
      else { const lang = item.lang || 'plaintext'; content.innerHTML = `<pre class="language-${lang}"><code class="language-${lang}">${escapeHTML(val)}</code></pre>`; Prism.highlightAllUnder(content); }
    }
  } catch (err) { content.innerHTML = `<div class="preview-center" style="color:var(--red);">Error: ${escapeHTML(err.message)}</div>`; }
}

function renderSTLViewer(url, name, container) {
  container.innerHTML = `<div id="stl-viewer-container"><div class="viewer-overlay">DWG REF: ${escapeHTML(name)}<br>RENDER: SolidWorks / Fusion 360 Object Data</div></div><a href="${url}" download="${escapeHTML(name)}" class="btn btn-outline" style="display:inline-flex;margin-top:12px;">Download STL →</a>`;
  const target = document.getElementById('stl-viewer-container');
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(75, target.clientWidth / target.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setSize(target.clientWidth, target.clientHeight); target.appendChild(renderer.domElement);
  const controls = new THREE.OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
  scene.add(new THREE.AmbientLight(0x404040)); const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(1, 1, 1); scene.add(dirLight);
  new THREE.STLLoader().load(url, function (geometry) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xdce8f0, emissive: 0x1a3a5c, wireframe: true, wireframeLinewidth: 1.5 }));
    geometry.computeBoundingBox(); const center = new THREE.Vector3(); geometry.boundingBox.getCenter(center); mesh.position.sub(center);
    const size = new THREE.Vector3(); geometry.boundingBox.getSize(size); const scale = 50 / Math.max(size.x, size.y, size.z); mesh.scale.set(scale, scale, scale);
    scene.add(mesh); camera.position.z = 100;
    function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); } animate();
  });
}

function renderDXFViewer(url, name, container) {
  container.innerHTML = `<div id="stl-viewer-container" style="background-color: var(--paper);"><div class="viewer-overlay">DWG REF: ${escapeHTML(name)}<br>RENDER: 2D DXF Vector Data</div></div><a href="${url}" download="${escapeHTML(name)}" class="btn btn-outline" style="display:inline-flex;margin-top:12px;">Download DXF →</a>`;
  const target = document.getElementById('stl-viewer-container');
  fetch(url).then(res => res.text()).then(text => {
    let dxf = null; try { dxf = new DxfParser().parseSync(text); } catch(err) { target.innerHTML = `<div class="preview-center" style="color:var(--red);">Error parsing DXF geometry.<br>Ensure the file is an ASCII DXF (not binary).</div>`; return; }
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(75, target.clientWidth / target.clientHeight, 0.1, 10000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setSize(target.clientWidth, target.clientHeight); target.appendChild(renderer.domElement);
    const controls = new THREE.OrbitControls(camera, renderer.domElement); controls.enableRotate = false; controls.enableDamping = true;
    const material = new THREE.LineBasicMaterial({ color: 0x1a3a5c, linewidth: 1 });
    if (dxf.entities) { dxf.entities.forEach(ent => {
        if (ent.type === 'LINE') scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ent.vertices[0].x, ent.vertices[0].y, 0), new THREE.Vector3(ent.vertices[1].x, ent.vertices[1].y, 0)]), material));
        else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') { const points = ent.vertices.map(v => new THREE.Vector3(v.x, v.y, 0)); if (ent.shape) points.push(points[0]); scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material)); }
        else if (ent.type === 'CIRCLE' || ent.type === 'ARC') scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(ent.center.x, ent.center.y, ent.radius, ent.radius, ent.startAngle || 0, ent.endAngle || (2 * Math.PI), false, 0).getPoints(50).map(p => new THREE.Vector3(p.x, p.y, 0))), material));
      }); }
    const box = new THREE.Box3().setFromObject(scene); const center = new THREE.Vector3(); box.getCenter(center); scene.position.sub(center);
    camera.position.z = Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).y) === 0 ? 100 : Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).y) * 1.2;
    function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); } animate();
  }).catch(err => { target.innerHTML = `<div class="preview-center" style="color:var(--red);">Failed to read DXF file data.</div>`; });
}

function renderPDFViewer(url, name, container) { container.innerHTML = `<div style="width: 100%; height: 60vh; border: 1px solid var(--line-bold); background: #333;"><iframe src="${url}" width="100%" height="100%" style="border: none;"></iframe></div><a href="${url}" download="${escapeHTML(name)}" class="btn btn-outline" style="display:inline-flex;margin-top:12px;">Download Original PDF →</a>`; }
async function renderDOCXViewer(blob, name, container) {
  container.innerHTML = '<div class="preview-center"><span class="spinner"></span>&nbsp; Parsing Word Document...</div>';
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() }); const url = URL.createObjectURL(blob);
    container.innerHTML = `<div style="background: var(--white); padding: 40px; color: #000; border: 1px solid var(--line-bold); overflow-y: auto; max-height: 60vh; font-family: 'Times New Roman', serif; line-height: 1.6;">${result.value || '<p style="color:red;">Document is empty or cannot be parsed.</p>'}</div><a href="${url}" download="${escapeHTML(name)}" class="btn btn-outline" style="display:inline-flex;margin-top:12px;">Download Original DOCX →</a>`;
  } catch (err) { container.innerHTML = `<div class="preview-center" style="color:var(--red);">Failed to render DOCX. The file may be corrupted or password protected.</div>`; }
}

async function copyItem(id, type) { if (type === 'file') { showToast('Cannot copy binary file', true); return; } try { const res = await apiFetch(`/api/drop/item/${id}`); const data = await res.json(); await navigator.clipboard.writeText(data.value || ''); showToast('Copied to clipboard'); } catch { showToast('Copy failed', true); } }
async function downloadItem(id, name) { try { const res = await apiFetch(`/api/drop/item/${id}`); const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); } catch { showToast('Download failed', true); } }
async function deleteItem(id) { try { const res = await apiFetch(`/api/drop/item/${id}`, { method: 'DELETE' }); if (!res.ok) throw new Error(); drops = drops.filter(i => i.id !== id); renderLog(); const countEl=document.getElementById('status-count'); if(countEl) countEl.textContent = drops.length; calculateStorage(); showToast('Item deleted'); } catch { showToast('Delete failed', true); } }

function closePreview() { const ov = document.getElementById('preview-overlay'); if(ov) ov.classList.remove('open'); }
const overlay = document.getElementById('preview-overlay'); if(overlay) overlay.addEventListener('click', function(e) { if (e.target === this) closePreview(); });

function updateSpec(item) {
  if (!item) { ['spec-type','spec-name','spec-size','spec-time'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent = '—';}); return; }
  const st = document.getElementById('spec-type'); if(st) st.textContent = (item.type||'—').toUpperCase();
  const sn = document.getElementById('spec-name'); if(sn) sn.textContent = (item.name||'—').substring(0,28);
  const ss = document.getElementById('spec-size'); if(ss) ss.textContent = item.size||'—';
  const tm = document.getElementById('spec-time'); if(tm) tm.textContent = item.timestamp ? item.timestamp.replace('T',' ').substring(0,19) : '—';
}

async function calculateStorage() {
  try {
    const res = await apiFetch('/api/storage/usage'); const data = await res.json(); if (!res.ok) throw new Error();
    const percent = Math.min((data.totalBytes / 10737418240) * 100, 100);
    const txt = document.getElementById('storage-used-text'); if(txt) txt.textContent = formatBytes(data.totalBytes) + ' Used';
    const bar = document.getElementById('storage-bar'); if(bar) { bar.style.width = percent + '%'; bar.style.background = percent > 90 ? 'var(--red)' : (percent > 75 ? 'var(--gold)' : 'var(--blue)'); }
  } catch (err) { console.error("Storage calc failed", err); }
}

function resetFileZone() { selectedFiles = []; const dz=document.getElementById('drop-zone'); if(dz) dz.classList.remove('has-file'); const fsi=document.getElementById('file-selected-info'); if(fsi) fsi.style.display = 'none'; const fi=document.getElementById('file-input'); if(fi) fi.value = ''; }
function formatBytes(b) { if (b<1024) return b+' B'; if (b<1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }
function escapeHTML(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
let toastTimer; function showToast(msg, isError=false) { const t = document.getElementById('toast'); if(!t) return; t.textContent = msg; t.className = 'show' + (isError ? ' error' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, 2600); }