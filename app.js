// ═══════════════════════════════════════════════
//  DYNAMIC ASSET LOADER (PERFORMANCE OPTIMIZATION)
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
//  CONFIG
// ═══════════════════════════════════════════════
const API_BASE = 'https://ancient-credit-7433.wilsonzambrano.workers.dev';

// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
let jwt = null;
let currentMode = 'file';
let selectedFiles = []; 
let drops = [];
let currentAppView = 'drop'; 

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('footer-year').textContent = new Date().getFullYear();
  jwt = sessionStorage.getItem('wz_drop_jwt');
  if (jwt) {
    showApp();
    loadDrops();
  } else {
    showLogin();
    loadPublicDrops();
  }
  setupDragDrop();
  setupFileInput();
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('login-username').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-password').focus(); });
});

// ═══════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  if (!username || !password) { errEl.textContent = 'Username and password required.'; errEl.style.display = 'block'; return; }
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>&nbsp;Authenticating...';
  errEl.style.display = 'none';
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) throw new Error(data.error || 'Login failed');
    jwt = data.token;
    sessionStorage.setItem('wz_drop_jwt', jwt);
    showApp();
    await loadDrops();
  } catch (err) {
    errEl.textContent = err.message || 'Authentication failed.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Authenticate';
  }
}

function doLogout() {
  jwt = null;
  sessionStorage.removeItem('wz_drop_jwt');
  drops = [];
  if (currentAppView === 'finance') {
    toggleAppView();
  }
  showLogin();
  loadPublicDrops();
  showToast('Logged out');
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('nav-access-val').textContent = '● Locked';
  document.getElementById('nav-access-val').style.color = 'var(--red)';
  document.getElementById('status-dot').classList.add('offline');
  document.getElementById('status-text').innerHTML = 'System <strong>Locked</strong>';
  document.getElementById('top-logout-btn').style.display = 'none'; 
  document.getElementById('nav-app-toggle').style.display = 'none';
  document.getElementById('login-username').focus();
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('nav-access-val').textContent = '● Authenticated';
  document.getElementById('nav-access-val').style.color = 'var(--green)';
  document.getElementById('status-dot').classList.remove('offline');
  document.getElementById('status-text').innerHTML = 'System <strong>Online</strong>';
  document.getElementById('top-logout-btn').style.display = 'inline-flex'; 
  document.getElementById('nav-app-toggle').style.display = 'inline-flex';
}

// ═══════════════════════════════════════════════
//  API & DATA LOADING
// ═══════════════════════════════════════════════
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), 'Authorization': `Bearer ${jwt}` },
  });
  if (res.status === 401) { doLogout(); throw new Error('Session expired. Please log in again.'); }
  return res;
}

async function loadDrops() {
  const list = document.getElementById('log-list');
  list.innerHTML = '<div class="log-loading"><span class="spinner"></span>&nbsp; Loading...</div>';
  try {
    const res = await apiFetch('/api/drop/list');
    const data = await res.json();
    drops = data.items || [];
    renderLog();
    document.getElementById('status-count').textContent = drops.length;
    calculateStorage();
  } catch (err) {
    list.innerHTML = `<div class="log-loading" style="color:var(--red);">Error: ${escapeHTML(err.message)}</div>`;
  }
}

async function loadPublicDrops() {
  const list = document.getElementById('public-log-list');
  list.innerHTML = '<div class="log-loading" style="padding: 20px;"><span class="spinner"></span>&nbsp; Loading...</div>';
  try {
    const res = await fetch(`${API_BASE}/api/drop/public/list`);
    const data = await res.json();
    const publicDrops = data.items || [];
    
    list.innerHTML = '';
    if (!publicDrops.length) {
      list.innerHTML = '<div class="log-empty">No public files available.</div>';
      return;
    }
    
    publicDrops.forEach(item => {
      const div = document.createElement('div');
      div.className = 'log-item';
      const ts = item.timestamp ? item.timestamp.replace('T',' ').substring(0,16) : '—';
      const nameEsc = escapeHTML(item.name || '');
      div.innerHTML = `
        <div class="log-item-header">
          <span class="log-type-badge file-type">FILE</span>
          <span class="log-name">${nameEsc}</span>
        </div>
        <div class="log-meta">
          <span>${ts}</span>
          <span>${item.size||'—'}</span>
        </div>
        <div class="log-actions">
          <a href="${API_BASE}/api/drop/public/item/${item.id}" download="${nameEsc}" class="log-btn" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </a>
        </div>`;
      list.appendChild(div);
    });
  } catch (err) {
    list.innerHTML = `<div class="log-empty" style="color:var(--red);">Failed to load public files.</div>`;
  }
}

// ═══════════════════════════════════════════════
//  MODE
// ═══════════════════════════════════════════════
function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
  document.getElementById('file-mode-panel').style.display = mode === 'file' ? 'block' : 'none';
  document.getElementById('text-mode-panel').style.display = mode === 'text' ? 'block' : 'none';
  document.getElementById('url-mode-panel').style.display  = mode === 'url'  ? 'block' : 'none';
  document.getElementById('status-mode').textContent = mode === 'file' ? 'File' : mode === 'text' ? 'Text/Code' : 'URL';
  document.getElementById('public-toggle-container').style.display = mode === 'file' ? 'flex' : 'none';
}

// ═══════════════════════════════════════════════
//  APP VIEW ROUTING & FINANCE
// ═══════════════════════════════════════════════
function toggleAppView() {
  const toggleBtn = document.getElementById('nav-app-toggle');
  const btnSpan = toggleBtn.querySelector('span');

  if (currentAppView === 'drop') {
    currentAppView = 'finance';
    document.getElementById('view-drop').style.display = 'none';
    document.getElementById('view-finance').style.display = 'block';
    
    document.getElementById('nav-access-val').textContent = '● Terminal';
    toggleBtn.classList.replace('btn-outline', 'btn-solid');
    btnSpan.textContent = 'Return to Drop Zone';
    
    fetchFinanceData(); 
  } else {
    currentAppView = 'drop';
    document.getElementById('view-drop').style.display = 'block';
    document.getElementById('view-finance').style.display = 'none';
    
    document.getElementById('nav-access-val').textContent = '● Authenticated';
    toggleBtn.classList.replace('btn-solid', 'btn-outline');
    btnSpan.textContent = 'Portfolio Terminal';
  }
}

async function fetchFinanceData() {
  try {
    const res = await apiFetch('/api/finance/dashboard');
    const data = await res.json();
    
    if (data.error) throw new Error(data.error);

    document.getElementById('dash-margin-avail').textContent = '$' + Number(data.availableMargin).toLocaleString(undefined, {minimumFractionDigits: 2});
    
    if (typeof data.safetyLevel === 'number') {
        document.getElementById('dash-margin-safe').textContent = (data.safetyLevel * 100).toFixed(1) + '%';
    } else {
        document.getElementById('dash-margin-safe').textContent = data.safetyLevel; 
    }
    
    document.getElementById('dash-interest').textContent = '$' + Number(data.totalInterest).toLocaleString(undefined, {minimumFractionDigits: 2});

    const tableBody = document.getElementById('dash-positions-table');
    tableBody.innerHTML = ''; 

    if (data.portfolioTable && data.portfolioTable.length > 1) {
        data.portfolioTable.slice(1).forEach(row => {
            const ticker = row[0]; 
            if (!ticker || typeof ticker !== 'string') return; 

            const shares = row[2] || 0;     
            const avgCost = row[3] || 0;    
            const price = row[4] || 0;      
            const roi = row[18] || 0;       

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--line)';

            const roiColor = roi >= 0 ? 'var(--green)' : 'var(--red)';
            const roiFormatted = (roi * 100).toFixed(2) + '%';

            tr.innerHTML = `
              <td style="padding: 8px 10px; font-weight: 700; border-right: 1px solid var(--line);">${ticker}</td>
              <td style="padding: 8px 10px; border-right: 1px solid var(--line);">${shares}</td>
              <td style="padding: 8px 10px; border-right: 1px solid var(--line);">$${Number(avgCost).toFixed(2)}</td>
              <td style="padding: 8px 10px; border-right: 1px solid var(--line);">$${Number(price).toFixed(2)}</td>
              <td style="padding: 8px 10px; font-weight: 600; color: ${roiColor};">${roiFormatted}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    const statusBox = document.querySelector('#view-finance > div > div:nth-child(3)');
    if (statusBox) {
        statusBox.style.borderColor = 'var(--green)';
        statusBox.innerHTML = '<p style="font-size: 0.6rem; color: var(--green); text-transform: uppercase; letter-spacing: 0.1em;">Secure Google Sheets Bridge Connected.</p>';
    }

  } catch (err) {
    document.getElementById('dash-margin-avail').textContent = "ERR";
    document.getElementById('dash-margin-safe').textContent = "ERR";
    document.getElementById('dash-interest').textContent = "ERR";
    showToast('Failed to sync with Google Sheets', true);
  }
}

// ═══════════════════════════════════════════════
//  DRAG & DROP
// ═══════════════════════════════════════════════
function setupDragDrop() {
  const zone = document.getElementById('drop-zone');
  
  ['dragenter', 'dragover'].forEach(e => zone.addEventListener(e, ev => { 
    ev.preventDefault(); 
    zone.classList.add('drag-over'); 
  }));
  
  ['dragleave', 'dragend'].forEach(e => zone.addEventListener(e, () => { 
    zone.classList.remove('drag-over'); 
  }));
  
  zone.addEventListener('drop', e => { 
    e.preventDefault(); 
    zone.classList.remove('drag-over'); 
    if (e.dataTransfer.files.length) setFiles(e.dataTransfer.files); 
  });
  
  document.body.addEventListener('dragover', e => e.preventDefault());
  
  document.body.addEventListener('drop', e => { 
    e.preventDefault(); 
    if (currentMode !== 'file') switchMode('file'); 
    if (e.dataTransfer.files.length) setFiles(e.dataTransfer.files); 
  });
}

function setupFileInput() {
  document.getElementById('file-input').addEventListener('change', e => { 
    if (e.target.files.length) setFiles(e.target.files); 
  });
}

function setFiles(files) {
  selectedFiles = Array.from(files);
  document.getElementById('drop-zone').classList.add('has-file');
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

// ═══════════════════════════════════════════════
//  SUBMIT
// ═══════════════════════════════════════════════
async function handleSubmit() {
  const btn = document.getElementById('submit-btn');
  const note = document.getElementById('drop-note').value.trim();
  const ttl = document.getElementById('drop-ttl').value;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>&nbsp; Uploading...';
  
  try {
    let itemToSpec; 
    let successMessage = '';

    if (currentMode === 'file') {
      if (!selectedFiles.length) throw new Error('No files selected');
      const fd = new FormData();
      selectedFiles.forEach(file => fd.append('file', file));
      if (note) fd.append('note', note);
      
      const isPublic = document.getElementById('is-public-toggle').checked;
      fd.append('isPublic', isPublic);
      fd.append('ttl', ttl);

      const res = await apiFetch('/api/drop/file', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      drops = [...data.items, ...drops];
      itemToSpec = data.items[0]; 
      successMessage = selectedFiles.length > 1 ? `${selectedFiles.length} files received` : (data.items[0].name || '').substring(0, 32);

      resetFileZone();
      document.getElementById('is-public-toggle').checked = false;
      
    } else if (currentMode === 'text') {
      const title   = document.getElementById('text-title').value.trim();
      const content = document.getElementById('text-content').value.trim();
      const lang    = document.getElementById('text-lang').value;
      if (!content) throw new Error('No text entered');
      
      const res = await apiFetch('/api/drop/text', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ title, content, note, lang, ttl }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      drops.unshift(data.item);
      itemToSpec = data.item;
      successMessage = (data.item.name || '').substring(0, 32);
      
      document.getElementById('text-title').value = '';
      document.getElementById('text-content').value = '';

    } else if (currentMode === 'url') {
      const label = document.getElementById('url-label').value.trim();
      const url   = document.getElementById('url-input').value.trim();
      if (!url) throw new Error('No URL entered');
      
      const res = await apiFetch('/api/drop/url', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ url, label, note, ttl }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      drops.unshift(data.item);
      itemToSpec = data.item;
      successMessage = (data.item.name || '').substring(0, 32);
      
      document.getElementById('url-label').value = '';
      document.getElementById('url-input').value = '';
    }

    document.getElementById('drop-note').value = '';
    renderLog();
    document.getElementById('status-count').textContent = drops.length;
    updateSpec(itemToSpec);
    calculateStorage();
    showToast('Received — ' + successMessage);
  } catch (err) {
    showToast(err.message || 'Error', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send to Clipboard';
  }
}

// ═══════════════════════════════════════════════
//  LOG
// ═══════════════════════════════════════════════
function renderLog() {
  const list = document.getElementById('log-list');
  list.innerHTML = '';
  if (!drops.length) {
    list.innerHTML = '<div class="log-empty">NO ENTRIES<br><span style="font-size:0.45rem;margin-top:4px;display:block;">Awaiting first drop</span></div>';
    return;
  }
  drops.forEach(item => {
    const div = document.createElement('div');
    div.className = 'log-item';
    const badge = item.type === 'file' ? 'file-type' : item.type === 'url' ? 'url-type' : '';
    const ts = item.timestamp ? item.timestamp.replace('T',' ').substring(0,16) : '—';
    const nameEsc = escapeHTML(item.name || '');
    
    let ttlBadge = '';
    if (item.ttl === 'burn') ttlBadge = '<span style="font-size:0.45rem; background:var(--red); color:var(--paper); padding:1px 4px; border-radius:2px; margin-left:6px;">🔥 BURN</span>';
    else if (item.ttl && item.ttl !== '2592000') ttlBadge = '<span style="font-size:0.45rem; border:1px solid var(--gold); color:var(--gold); padding:1px 4px; border-radius:2px; margin-left:6px;">⏱ TEMP</span>';
    const publicBadge = item.isPublic ? '<span style="font-size:0.45rem; background:var(--blue); color:var(--paper); padding:1px 4px; border-radius:2px; margin-left:6px;">PUBLIC</span>' : '';

    div.innerHTML = `
      <div class="log-item-header">
        <span class="log-type-badge ${badge}">${(item.type||'').toUpperCase()}</span>
        <span class="log-name">${nameEsc}${publicBadge}${ttlBadge}</span>
      </div>
      <div class="log-meta">
        <span>${ts}</span>
        <span>${item.size||'—'}</span>
        ${item.note ? `<span>· ${escapeHTML(item.note)}</span>` : ''}
      </div>
      <div class="log-actions">
        <button class="log-btn" onclick="previewItem('${item.id}','${item.type}','${nameEsc.replace(/'/g,"\\'")}')">Preview</button>
        <button class="log-btn" onclick="copyItem('${item.id}','${item.type}')">Copy</button>
        ${item.type === 'file' ? `<button class="log-btn" onclick="downloadItem('${item.id}','${nameEsc.replace(/'/g,"\\'")}')">Download</button>` : ''}
        <button class="log-btn danger" onclick="deleteItem('${item.id}')">Delete</button>
      </div>`;
    div.addEventListener('mouseenter', () => updateSpec(item));
    list.appendChild(div);
  });
}

// ═══════════════════════════════════════════════
//  ITEM ACTIONS
// ═══════════════════════════════════════════════
async function previewItem(id, type, name) {
  const item = drops.find(d => d.id == id);
  if (!item) return;

  document.getElementById('preview-title').textContent = name;
  const content = document.getElementById('preview-content');
  content.innerHTML = '<div class="preview-center"><span class="spinner"></span>&nbsp; Loading...</div>';
  document.getElementById('preview-overlay').classList.add('open');
  
  try {
    const res = await apiFetch(`/api/drop/item/${id}`);
    
    if (type === 'file') {
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const lowerName = name.toLowerCase();
      
      if (lowerName.endsWith('.stl')) {
        content.innerHTML = '<div class="preview-center"><span class="spinner"></span>&nbsp; Fetching 3D Engine...</div>';
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js');
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
        renderSTLViewer(url, name, content);

      } else if (lowerName.endsWith('.dxf')) {
        content.innerHTML = '<div class="preview-center"><span class="spinner"></span>&nbsp; Fetching Vector Engine...</div>';
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
        await loadScript('https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/dist/dxf-parser.js');
        renderDXFViewer(url, name, content);

      } else if (lowerName.endsWith('.pdf')) {
        renderPDFViewer(url, name, content);

      } else if (lowerName.endsWith('.docx')) {
        renderDOCXViewer(blob, name, content);

      } else if (lowerName.endsWith('.sldprt') || lowerName.endsWith('.slprt')) {
        content.innerHTML = `
          <div class="preview-center">
            <span class="log-type-badge file-type" style="font-size: 1rem; padding: 4px 12px; margin-bottom: 12px; display: inline-block;">PROPRIETARY CAD DATA</span><br><br>
            <strong style="font-size: 1.2rem; color: var(--ink);">${escapeHTML(name)}</strong><br><br>
            <span style="color:var(--red);">Client-side web preview is unavailable for native SolidWorks part files.</span><br>
            <span style="color:var(--ink-dim);">Please download the file to view it in SolidWorks, eDrawings, or export as .STL / .STEP prior to upload.</span><br><br>
            <a href="${url}" download="${escapeHTML(name)}" class="btn btn-solid" style="display:inline-flex;margin-top:16px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Part File
            </a>
          </div>`;
      } else if (blob.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = url; img.className = 'preview-img';
        content.innerHTML = ''; content.appendChild(img);
      } else {
        content.innerHTML = `<div class="preview-center">${blob.type === 'application/pdf' ? 'PDF' : 'File'}: <strong>${escapeHTML(name)}</strong><br><br><a href="${url}" download="${escapeHTML(name)}" class="btn btn-outline" style="display:inline-flex;margin-top:8px;">Download →</a></div>`;
      }
    } else {
      const data = await res.json();
      const val = data.value || '';
      
      if (type === 'url') {
        content.innerHTML = `<p class="preview-url">${escapeHTML(val)}</p><a href="${escapeHTML(val)}" target="_blank" rel="noopener" class="btn btn-outline" style="display:inline-flex;margin-top:12px;">Open URL →</a>`;
      } else {
        const lang = item.lang || 'plaintext';
        content.innerHTML = `<pre class="language-${lang}"><code class="language-${lang}">${escapeHTML(val)}</code></pre>`;
        Prism.highlightAllUnder(content); 
      }
    }
  } catch (err) {
    content.innerHTML = `<div class="preview-center" style="color:var(--red);">Error: ${escapeHTML(err.message)}</div>`;
  }
}

function renderSTLViewer(url, name, container) {
  container.innerHTML = `
    <div id="stl-viewer-container">
      <div class="viewer-overlay">DWG REF: ${escapeHTML(name)}<br>RENDER: SolidWorks / Fusion 360 Object Data</div>
    </div>
    <a href="${url}" download="${escapeHTML(name)}" class="btn btn-outline" style="display:inline-flex;margin-top:12px;">Download STL →</a>
  `;
  const target = document.getElementById('stl-viewer-container');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, target.clientWidth / target.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(target.clientWidth, target.clientHeight);
  target.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(1, 1, 1);
  scene.add(dirLight);

  const loader = new THREE.STLLoader();
  loader.load(url, function (geometry) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xdce8f0,
      emissive: 0x1a3a5c,
      wireframe: true,
      wireframeLinewidth: 1.5
    });
    const mesh = new THREE.Mesh(geometry, material);

    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    mesh.position.sub(center);

    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 50 / maxDim;
    mesh.scale.set(scale, scale, scale);

    scene.add(mesh);
    camera.position.z = 100;

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
  });
}

function renderDXFViewer(url, name, container) {
  container.innerHTML = `
    <div id="stl-viewer-container" style="background-color: var(--paper);">
      <div class="viewer-overlay">DWG REF: ${escapeHTML(name)}<br>RENDER: 2D DXF Vector Data</div>
    </div>
    <a href="${url}" download="${escapeHTML(name)}" class="btn btn-outline" style="display:inline-flex;margin-top:12px;">Download DXF →</a>
  `;
  const target = document.getElementById('stl-viewer-container');

  fetch(url).then(res => res.text()).then(text => {
    let dxf = null;
    try {
      const parser = new DxfParser();
      dxf = parser.parseSync(text);
    } catch(err) {
      target.innerHTML = `<div class="preview-center" style="color:var(--red);">Error parsing DXF geometry.<br>Ensure the file is an ASCII DXF (not binary).</div>`;
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, target.clientWidth / target.clientHeight, 0.1, 10000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(target.clientWidth, target.clientHeight);
    target.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false; 
    controls.enableDamping = true;

    const material = new THREE.LineBasicMaterial({ color: 0x1a3a5c, linewidth: 1 });

    if (dxf.entities) {
      dxf.entities.forEach(ent => {
        if (ent.type === 'LINE') {
          const points = [
            new THREE.Vector3(ent.vertices[0].x, ent.vertices[0].y, 0),
            new THREE.Vector3(ent.vertices[1].x, ent.vertices[1].y, 0)
          ];
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          scene.add(new THREE.Line(geometry, material));
        } 
        else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
          const points = ent.vertices.map(v => new THREE.Vector3(v.x, v.y, 0));
          if (ent.shape) points.push(points[0]); 
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          scene.add(new THREE.Line(geometry, material));
        } 
        else if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
          const curve = new THREE.EllipseCurve(
            ent.center.x, ent.center.y,
            ent.radius, ent.radius,
            ent.startAngle || 0, ent.endAngle || (2 * Math.PI),
            false, 0
          );
          const points = curve.getPoints(50).map(p => new THREE.Vector3(p.x, p.y, 0));
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          scene.add(new THREE.Line(geometry, material));
        }
      });
    }

    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    scene.position.sub(center); 
    
    const maxDim = Math.max(size.x, size.y);
    camera.position.z = maxDim === 0 ? 100 : maxDim * 1.2;

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
  }).catch(err => {
    target.innerHTML = `<div class="preview-center" style="color:var(--red);">Failed to read DXF file data.</div>`;
  });
}

function renderPDFViewer(url, name, container) {
  container.innerHTML = `
    <div style="width: 100%; height: 60vh; border: 1px solid var(--line-bold); background: #333;">
      <iframe src="${url}" width="100%" height="100%" style="border: none;"></iframe>
    </div>
    <a href="${url}" download="${escapeHTML(name)}" class="btn btn-outline" style="display:inline-flex;margin-top:12px;">Download Original PDF →</a>
  `;
}

async function renderDOCXViewer(blob, name, container) {
  container.innerHTML = '<div class="preview-center"><span class="spinner"></span>&nbsp; Parsing Word Document...</div>';
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    const arrayBuffer = await blob.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
    const url = URL.createObjectURL(blob);
    
    container.innerHTML = `
      <div style="background: var(--white); padding: 40px; color: #000; border: 1px solid var(--line-bold); overflow-y: auto; max-height: 60vh; font-family: 'Times New Roman', serif; line-height: 1.6;">
        ${result.value || '<p style="color:red;">Document is empty or cannot be parsed.</p>'}
      </div>
      <a href="${url}" download="${escapeHTML(name)}" class="btn btn-outline" style="display:inline-flex;margin-top:12px;">Download Original DOCX →</a>
    `;
  } catch (err) {
    container.innerHTML = `<div class="preview-center" style="color:var(--red);">Failed to render DOCX. The file may be corrupted or password protected.</div>`;
  }
}

async function copyItem(id, type) {
  if (type === 'file') { showToast('Cannot copy binary file', true); return; }
  try {
    const res  = await apiFetch(`/api/drop/item/${id}`);
    const data = await res.json();
    await navigator.clipboard.writeText(data.value || '');
    showToast('Copied to clipboard');
  } catch { showToast('Copy failed', true); }
}

async function downloadItem(id, name) {
  try {
    const res  = await apiFetch(`/api/drop/item/${id}`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  } catch { showToast('Download failed', true); }
}

async function deleteItem(id) {
  try {
    const res = await apiFetch(`/api/drop/item/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    drops = drops.filter(i => i.id !== id);
    renderLog();
    document.getElementById('status-count').textContent = drops.length;
    calculateStorage();
    showToast('Item deleted');
  } catch { showToast('Delete failed', true); }
}

function closePreview() { document.getElementById('preview-overlay').classList.remove('open'); }
document.getElementById('preview-overlay').addEventListener('click', function(e) { if (e.target === this) closePreview(); });

// ═══════════════════════════════════════════════
//  SPEC
// ═══════════════════════════════════════════════
function updateSpec(item) {
  if (!item) { ['spec-type','spec-name','spec-size','spec-time'].forEach(id => document.getElementById(id).textContent = '—'); return; }
  document.getElementById('spec-type').textContent = (item.type||'—').toUpperCase();
  document.getElementById('spec-name').textContent = (item.name||'—').substring(0,28);
  document.getElementById('spec-size').textContent = item.size||'—';
  document.getElementById('spec-time').textContent = item.timestamp ? item.timestamp.replace('T',' ').substring(0,19) : '—';
}

// ═══════════════════════════════════════════════
//  STORAGE CALCULATOR
// ═══════════════════════════════════════════════
async function calculateStorage() {
  try {
    const res = await apiFetch('/api/storage/usage');
    const data = await res.json();
    if (!res.ok) throw new Error();
    
    const totalBytes = data.totalBytes || 0;
    const MAX_BYTES = 10737418240; 
    let percent = (totalBytes / MAX_BYTES) * 100;
    if (percent > 100) percent = 100;

    document.getElementById('storage-used-text').textContent = formatBytes(totalBytes) + ' Used';
    const bar = document.getElementById('storage-bar');
    bar.style.width = percent + '%';
    bar.style.background = percent > 90 ? 'var(--red)' : (percent > 75 ? 'var(--gold)' : 'var(--blue)');
  } catch (err) {
    console.error("Storage calc failed", err);
  }
}

// ═══════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════
function resetFileZone() {
  selectedFiles = [];
  document.getElementById('drop-zone').classList.remove('has-file');
  document.getElementById('file-selected-info').style.display = 'none';
  document.getElementById('file-input').value = '';
}
function formatBytes(b) { if (b<1024) return b+' B'; if (b<1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }
function escapeHTML(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
let toastTimer;
function showToast(msg, isError=false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 2600);
}