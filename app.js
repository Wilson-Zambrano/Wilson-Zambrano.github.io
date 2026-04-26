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
    if (document.getElementById('dash-positions-table')) {
        fetchFinanceData();
    }
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
  const login = document.getElementById('login-screen');
  if (login) login.style.display = 'flex';
  const appScreen = document.getElementById('app-screen');
  if (appScreen) appScreen.style.display = 'none';
  
  const accessVal = document.getElementById('nav-access-val');
  if (accessVal) { accessVal.textContent = '● Locked'; accessVal.style.color = 'var(--red)'; }
  const topLogout = document.getElementById('top-logout-btn');
  if (topLogout) topLogout.style.display = 'none';
}

function showApp() {
  const login = document.getElementById('login-screen');
  if (login) login.style.display = 'none';
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
  if (!document.getElementById('dash-positions-table')) return;

  try {
    const res = await apiFetch('/api/finance/dashboard');
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const availEl = document.getElementById('dash-margin-avail');
    if (availEl) {
        const rawMargin = data.availableMargin;
        availEl.textContent = (typeof rawMargin === 'number') 
            ? '$' + rawMargin.toLocaleString(undefined, {minimumFractionDigits: 2}) 
            : rawMargin || '—';
    }
    
    const vixEl = document.getElementById('dash-vix');
    if (vixEl) vixEl.textContent = data.vix || '—';
    
    const netEl = document.getElementById('dash-net');
    if (netEl) {
        const rawNet = data.netEarnings;
        netEl.textContent = (typeof rawNet === 'number') 
            ? '$' + rawNet.toLocaleString(undefined, {minimumFractionDigits: 2}) 
            : rawNet || '—';
        const numericNet = parseFloat(String(rawNet).replace(/[^0-9.-]+/g,""));
        if (!isNaN(numericNet)) netEl.style.color = numericNet >= 0 ? 'var(--green)' : 'var(--red)';
    }

    const tableBody = document.getElementById('dash-positions-table');
    if (tableBody) {
        tableBody.innerHTML = ''; 
        if (data.portfolioTable && data.portfolioTable.length > 1) {
            data.portfolioTable.slice(1).forEach(row => {
                const ticker = row[0]; if (!ticker) return; 
                const shares = row[2] || 0;     
                const avgCost = row[3] || 0;    
                let price = row[4] || 0;    
                
                if (data.liveMarket && data.liveMarket[ticker]?.latestTrade) {
                    price = data.liveMarket[ticker].latestTrade.p;
                }

                let roi = row[18] || 0; 
                const numCost = parseFloat(avgCost);
                const numPrice = parseFloat(price);
                if (numCost > 0 && numPrice > 0) roi = (numPrice - numCost) / numCost;

                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--line)';
                tr.innerHTML = `
                  <td style="padding: 8px 10px; font-weight: 700; border-right: 1px solid var(--line);">${ticker}</td>
                  <td style="padding: 8px 10px; border-right: 1px solid var(--line);">${shares}</td>
                  <td style="padding: 8px 10px; border-right: 1px solid var(--line);">$${Number(numCost).toFixed(2)}</td>
                  <td style="padding: 8px 10px; border-right: 1px solid var(--line);">$${Number(numPrice).toFixed(2)}</td>
                  <td style="padding: 8px 10px; font-weight: 600; color: ${roi >= 0 ? 'var(--green)' : 'var(--red)'};">${(roi * 100).toFixed(2)}%</td>
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

    renderTerminalCharts();

  } catch (err) {
    console.error(err);
    ['dash-margin-avail', 'dash-vix', 'dash-net'].forEach(id => {
       const el = document.getElementById(id);
       if (el) el.textContent = "ERR";
    });
    showToast('Ledger Sync Error: ' + err.message, true);
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

function calculateRSI(data, period = 14) {
    if (data.length < period) return [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = data[i] - data[i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period; let avgLoss = losses / period;
    const rsiArray = Array(period).fill(null);
    rsiArray.push(100 - (100 / (1 + (avgGain / (avgLoss || 1)))));
    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        avgGain = ((avgGain * (period - 1)) + (diff > 0 ? diff : 0)) / period;
        avgLoss = ((avgLoss * (period - 1)) + (diff < 0 ? -diff : 0)) / period;
        rsiArray.push(100 - (100 / (1 + (avgGain / (avgLoss || 1)))));
    }
    return rsiArray;
}

// ── Drag-to-Scroll Logic ──
function enableChartDrag(id) {
    const slider = document.getElementById(id);
    if (!slider) return;
    let isDown = false; let startX; let scrollLeft;
    slider.addEventListener('mousedown', (e) => {
        isDown = true; slider.style.cursor = 'grabbing';
        startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => { isDown = false; slider.style.cursor = 'grab'; });
    slider.addEventListener('mouseup', () => { isDown = false; slider.style.cursor = 'grab'; });
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; slider.scrollLeft = scrollLeft - walk;
    });
}

let chartVixInstance = null;
let chartS5FIInstance = null;
let chartRSIInstance = null;

async function renderTerminalCharts() {
  if (!document.getElementById('chartVix')) return;

  try {
    const res = await apiFetch('/api/finance/charts');
    const data = await res.json();
    
    if(!data.vix?.chart?.result?.[0] || !data.spy?.chart?.result?.[0]) return;

    const vixRes = data.vix.chart.result[0];
    const spyRes = data.spy.chart.result[0];

    const timestamps = vixRes.timestamp.map(t => new Date(t * 1000).toLocaleDateString(undefined, {month:'short', day:'numeric'}));
    const vixPrices = vixRes.indicators.quote[0].close;
    const spyPrices = spyRes.indicators.quote[0].close;

    // Calculate a dynamic width based on the number of data points
    // 18 pixels per day ensures the data is never squished
    const dataPointWidth = 18; 
    const baseWidth = document.getElementById('scroll-vix').clientWidth;
    const dynamicWidth = Math.max(baseWidth, timestamps.length * dataPointWidth);

    // Apply the dynamic width to all chart wrappers
    document.querySelectorAll('.chart-canvas-wrapper').forEach(wrapper => {
        wrapper.style.width = `${dynamicWidth}px`;
    });

    const vixSMA30 = calculateSMA(vixPrices, 30);
    const { sma: spySMA20, upper: spyUpper, lower: spyLower } = calculateBollingerBands(spyPrices, 20, 2);
    const spyRSI = calculateRSI(spyPrices, 14);

    // ── Diagnostics Math ──
    const latestRSI = spyRSI[spyRSI.length - 1];
    const latestPrice = spyPrices[spyPrices.length - 1];
    const latestUpperBand = spyUpper[spyUpper.length - 1];
    const latestLowerBand = spyLower[spyLower.length - 1];
    const latestSMA = spySMA20[spySMA20.length - 1];
    const latestVix = vixPrices[vixPrices.length - 1];
    const latestVixSMA = vixSMA30[vixSMA30.length - 1];

    // Update Sidebar Diagnostics
    document.getElementById('diag-rsi').textContent = latestRSI ? latestRSI.toFixed(1) : '—';
    document.getElementById('diag-rsi').style.color = latestRSI > 70 ? 'var(--red)' : (latestRSI < 30 ? 'var(--green)' : 'var(--ink)');
    
    document.getElementById('diag-trend').textContent = latestPrice > latestSMA ? 'BULLISH' : 'BEARISH';
    document.getElementById('diag-trend').style.color = latestPrice > latestSMA ? 'var(--green)' : 'var(--red)';
    
    let bandPos = 'MID-RANGE';
    if (latestPrice >= latestUpperBand) bandPos = 'UPPER BAND TOUCH';
    else if (latestPrice <= latestLowerBand) bandPos = 'LOWER BAND TOUCH';
    document.getElementById('diag-bands').textContent = bandPos;

    document.getElementById('diag-vix').textContent = latestVix > latestVixSMA ? 'EXPANDING' : 'CONTRACTING';

    // Update Automated Alerts Scanner
    let alertsHTML = '';
    if (latestRSI > 70) alertsHTML += `<div style="border-left: 3px solid var(--red); padding: 8px; font-size: 0.6rem; background: var(--paper); border-top: 1px solid var(--line); border-right: 1px solid var(--line); border-bottom: 1px solid var(--line);"><strong>CRITICAL:</strong> SPY Overbought (RSI > 70). Risk of pullback elevated.</div>`;
    else if (latestRSI < 30) alertsHTML += `<div style="border-left: 3px solid var(--green); padding: 8px; font-size: 0.6rem; background: var(--paper); border-top: 1px solid var(--line); border-right: 1px solid var(--line); border-bottom: 1px solid var(--line);"><strong>SIGNAL:</strong> SPY Oversold (RSI < 30). Potential bounce forming.</div>`;
    
    if (latestPrice >= latestUpperBand) alertsHTML += `<div style="border-left: 3px solid var(--gold); padding: 8px; font-size: 0.6rem; background: var(--paper); border-top: 1px solid var(--line); border-right: 1px solid var(--line); border-bottom: 1px solid var(--line);"><strong>WARNING:</strong> Price piercing upper Bollinger Band.</div>`;

    if (alertsHTML === '') alertsHTML = `<div style="padding: 12px; border: 1px dashed var(--line-bold); font-size: 0.55rem; color: var(--ink-dim); text-align: center; text-transform: uppercase; letter-spacing: 0.1em;">No active extreme signals</div>`;
    document.getElementById('screener-results').innerHTML = alertsHTML;


    // ── Render Charts ──
    const gridColor = "rgba(10,22,40,0.1)";
    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, labels: { boxWidth: 10, font: { size: 9, family: "'IBM Plex Mono', monospace" } } } },
        scales: { 
            x: { grid: { color: gridColor }, ticks: { font: { size: 8, family: "'IBM Plex Mono', monospace" }, maxRotation: 0 } }, 
            y: { grid: { color: gridColor }, ticks: { font: { size: 8, family: "'IBM Plex Mono', monospace" } } } 
        }
    };

    const ctxVix = document.getElementById('chartVix');
    if (chartVixInstance) chartVixInstance.destroy();
    chartVixInstance = new Chart(ctxVix, {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [
                { label: 'VIX Index', data: vixPrices, borderColor: '#0a1628', borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
                { label: '30D SMA', data: vixSMA30, borderColor: '#b01020', borderWidth: 1, borderDash: [5, 5], pointRadius: 0, tension: 0.1 }
            ]
        },
        options: commonOptions
    });

    const ctxS5 = document.getElementById('chartS5FI');
    if (chartS5FIInstance) chartS5FIInstance.destroy();
    chartS5FIInstance = new Chart(ctxS5, {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [
                { label: 'Market Proxy (Price)', data: spyPrices, borderColor: '#0a1628', borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
                { label: 'Upper Band', data: spyUpper, borderColor: 'rgba(42,122,42,0.5)', backgroundColor: 'rgba(42,122,42,0.05)', borderWidth: 1, pointRadius: 0, fill: '+1' },
                { label: 'Lower Band', data: spyLower, borderColor: 'rgba(176,16,32,0.5)', borderWidth: 1, pointRadius: 0, fill: false },
                { label: '20D SMA', data: spySMA20, borderColor: '#2a4060', borderWidth: 1, borderDash: [3, 3], pointRadius: 0 }
            ]
        },
        options: commonOptions
    });

    const ctxRSI = document.getElementById('chartRSI');
    if (chartRSIInstance) chartRSIInstance.destroy();
    
    // Arrays for constant horizontal lines on RSI
    const rsi70 = Array(timestamps.length).fill(70);
    const rsi30 = Array(timestamps.length).fill(30);

    chartRSIInstance = new Chart(ctxRSI, {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [
                { label: '14D RSI', data: spyRSI, borderColor: '#2a4060', borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
                { label: 'Overbought (70)', data: rsi70, borderColor: '#b01020', borderWidth: 1, borderDash: [2, 2], pointRadius: 0, tension: 0 },
                { label: 'Oversold (30)', data: rsi30, borderColor: '#2a7a2a', borderWidth: 1, borderDash: [2, 2], pointRadius: 0, tension: 0 }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: { ...commonOptions.scales.y, min: 10, max: 90 } // Lock RSI Y-Axis
            }
        }
    });

// Initialize drag interactions
    enableChartDrag('scroll-vix');
    enableChartDrag('scroll-spy');
    enableChartDrag('scroll-rsi');

    // Auto-scroll to the absolute right edge (latest data)
    // Using a slight timeout ensures the DOM has finished resizing the canvas
    setTimeout(() => {
        ['scroll-vix', 'scroll-spy', 'scroll-rsi'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.scrollLeft = el.scrollWidth;
        });
    }, 150);
  } catch (err) {
      console.error("Failed to render charts", err);
  }
}

// ═══════════════════════════════════════════════
//  DROP ZONE LOGIC
// ═══════════════════════════════════════════════

// FIXED: Added missing renderLog function
function renderLog() {
  const list = document.getElementById('log-list');
  if(!list) return;
  list.innerHTML = '';
  
  if (!drops.length) { 
    list.innerHTML = '<div class="log-empty">Clipboard is empty.</div>'; 
    return; 
  }
  
  drops.forEach(item => {
    const div = document.createElement('div'); 
    div.className = 'log-item';
    const ts = item.timestamp ? item.timestamp.replace('T',' ').substring(0,16) : '—';
    const nameEsc = escapeHTML(item.name || '');
    
    // Determine icon/type badge
    let badgeClass = 'file-type';
    let typeTxt = 'FILE';
    if (item.type === 'text') { badgeClass = ''; typeTxt = 'TEXT'; }
    if (item.type === 'url') { badgeClass = 'url-type'; typeTxt = 'URL'; }

    div.innerHTML = `
      <div class="log-item-header">
        <span class="log-type-badge ${badgeClass}">${typeTxt}</span>
        <span class="log-name" style="cursor:pointer;" onclick='updateSpec(${JSON.stringify(item).replace(/'/g, "&apos;")})'>${nameEsc}</span>
      </div>
      <div class="log-meta"><span>${ts}</span><span>${item.size||'—'}</span></div>
    `;
    list.appendChild(div);
  });
}

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
  const sm = document.getElementById('status-mode'); if (sm) sm.textContent = mode === 'file' ? 'File' : mode === 'text' ? 'Text/Code' : 'URL';
  const pt = document.getElementById('public-toggle-container'); if (pt) pt.style.display = mode === 'file' ? 'flex' : 'none';
}

function setupDragDrop() {
  const zone = document.getElementById('drop-zone'); if(!zone) return;
  ['dragenter', 'dragover'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.add('drag-over'); }));
  ['dragleave', 'dragend'].forEach(e => zone.addEventListener(e, () => { zone.classList.remove('drag-over'); }));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); if (e.dataTransfer.files.length) setFiles(e.dataTransfer.files); });
  document.body.addEventListener('dragover', e => e.preventDefault());
  document.body.addEventListener('drop', e => { e.preventDefault(); if (currentMode !== 'file') switchMode('file'); if (e.dataTransfer.files.length) setFiles(e.dataTransfer.files); });
}

function setupFileInput() { const fi = document.getElementById('file-input'); if(fi) fi.addEventListener('change', e => { if (e.target.files.length) setFiles(e.target.files); }); }

function setFiles(files) {
  selectedFiles = Array.from(files); const zone = document.getElementById('drop-zone'); if(!zone) return;
  zone.classList.add('has-file'); document.getElementById('file-selected-info').style.display = 'block';
  if (selectedFiles.length === 1) { document.getElementById('file-name-display').textContent = selectedFiles[0].name; document.getElementById('file-size-display').textContent = formatBytes(selectedFiles[0].size); updateSpec({ type: 'file', name: selectedFiles[0].name, size: formatBytes(selectedFiles[0].size) }); }
  else { const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0); document.getElementById('file-name-display').textContent = `${selectedFiles.length} files selected`; document.getElementById('file-size-display').textContent = formatBytes(totalSize) + ' Total'; updateSpec({ type: 'file', name: `Batch: ${selectedFiles.length} files`, size: formatBytes(totalSize) }); }
}

async function handleSubmit() {
  const btn = document.getElementById('submit-btn'); if(!btn) return;
  const note = document.getElementById('drop-note').value.trim();
  const ttl = document.getElementById('drop-ttl').value;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>&nbsp; Uploading...';
  try {
    let itemToSpec; let successMessage = '';
    if (currentMode === 'file') {
      if (!selectedFiles.length) throw new Error('No files selected');
      const fd = new FormData(); selectedFiles.forEach(file => fd.append('file', file));
      if (note) fd.append('note', note);
      fd.append('isPublic', document.getElementById('is-public-toggle').checked);
      fd.append('ttl', ttl);
      const res = await apiFetch('/api/drop/file', { method: 'POST', body: fd });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Upload failed');
      drops = [...data.items, ...drops]; itemToSpec = data.items[0]; successMessage = selectedFiles.length > 1 ? `${selectedFiles.length} files received` : (data.items[0].name || '').substring(0, 32);
      resetFileZone(); document.getElementById('is-public-toggle').checked = false;
    } else if (currentMode === 'text') {
      const title = document.getElementById('text-title').value.trim(); const content = document.getElementById('text-content').value.trim(); const lang = document.getElementById('text-lang').value; if (!content) throw new Error('No text entered');
      const res = await apiFetch('/api/drop/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, note, lang, ttl }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Upload failed');
      drops.unshift(data.item); itemToSpec = data.item; successMessage = (data.item.name || '').substring(0, 32);
      document.getElementById('text-title').value = ''; document.getElementById('text-content').value = '';
    } else if (currentMode === 'url') {
      const label = document.getElementById('url-label').value.trim(); const url = document.getElementById('url-input').value.trim(); if (!url) throw new Error('No URL entered');
      const res = await apiFetch('/api/drop/url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, label, note, ttl }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Upload failed');
      drops.unshift(data.item); itemToSpec = data.item; successMessage = (data.item.name || '').substring(0, 32);
      document.getElementById('url-label').value = ''; document.getElementById('url-input').value = '';
    }
    document.getElementById('drop-note').value = ''; renderLog(); 
    const countEl = document.getElementById('status-count'); if (countEl) countEl.textContent = drops.length;
    updateSpec(itemToSpec); calculateStorage(); showToast('Received — ' + successMessage);
  } catch (err) { showToast(err.message || 'Error', true); } finally { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send to Clipboard'; }
}

function formatBytes(b) { if (b<1024) return b+' B'; if (b<1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }
function escapeHTML(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function resetFileZone() { selectedFiles = []; const dz=document.getElementById('drop-zone'); if(dz) dz.classList.remove('has-file'); const fsi=document.getElementById('file-selected-info'); if(fsi) fsi.style.display = 'none'; const fi=document.getElementById('file-input'); if(fi) fi.value = ''; }
let toastTimer; function showToast(msg, isError=false) { const t = document.getElementById('toast'); if(!t) return; t.textContent = msg; t.className = 'show' + (isError ? ' error' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, 2600); }

async function calculateStorage() {
  try {
    const res = await apiFetch('/api/storage/usage'); const data = await res.json(); if (!res.ok) throw new Error();
    const percent = Math.min((data.totalBytes / 10737418240) * 100, 100);
    const txt = document.getElementById('storage-used-text'); if(txt) txt.textContent = formatBytes(data.totalBytes) + ' Used';
    const bar = document.getElementById('storage-bar'); if(bar) { bar.style.width = percent + '%'; bar.style.background = percent > 90 ? 'var(--red)' : (percent > 75 ? 'var(--gold)' : 'var(--blue)'); }
  } catch (err) { console.error("Storage calc failed", err); }
}

function updateSpec(item) {
  if (!item) { ['spec-type','spec-name','spec-size','spec-time'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent = '—';}); return; }
  const st = document.getElementById('spec-type'); if(st) st.textContent = (item.type||'—').toUpperCase();
  const sn = document.getElementById('spec-name'); if(sn) sn.textContent = (item.name||'—').substring(0,28);
  const ss = document.getElementById('spec-size'); if(ss) ss.textContent = item.size||'—';
  const tm = document.getElementById('spec-time'); if(tm) tm.textContent = item.timestamp ? item.timestamp.replace('T',' ').substring(0,19) : '—';
}