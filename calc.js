// ============================================================
// MATERIAL DATABASE
// ============================================================
const materials = {
  steel_a36: { name: "Structural Steel (A36)", density: 7.85, youngs_modulus: 200, shear_modulus: 79.3, yield_strength: 250, uts: 400, poisson: 0.30 },
  steel_4140: { name: "Alloy Steel (4140, Q&T)", density: 7.85, youngs_modulus: 205, shear_modulus: 80.0, yield_strength: 655, uts: 1020, poisson: 0.29 },
  stainless_304: { name: "Stainless Steel (304)", density: 8.00, youngs_modulus: 193, shear_modulus: 75.0, yield_strength: 215, uts: 505, poisson: 0.29 },
  al_6061: { name: "Aluminum (6061-T6)", density: 2.70, youngs_modulus: 69.0, shear_modulus: 26.0, yield_strength: 275, uts: 310, poisson: 0.33 },
  al_7075: { name: "Aluminum (7075-T6)", density: 2.81, youngs_modulus: 71.7, shear_modulus: 26.9, yield_strength: 503, uts: 572, poisson: 0.33 },
  al_2024: { name: "Aluminum (2024-T4)", density: 2.78, youngs_modulus: 73.1, shear_modulus: 28.0, yield_strength: 324, uts: 469, poisson: 0.33 },
  ti_6al: { name: "Titanium (Ti-6Al-4V)", density: 4.43, youngs_modulus: 114, shear_modulus: 44.0, yield_strength: 880, uts: 950, poisson: 0.34 },
  copper_c110: { name: "Copper (C11000)", density: 8.89, youngs_modulus: 115, shear_modulus: 44.0, yield_strength: 69, uts: 220, poisson: 0.33 },
  brass_360: { name: "Brass (C360)", density: 8.50, youngs_modulus: 97.0, shear_modulus: 37.0, yield_strength: 310, uts: 400, poisson: 0.34 },
  invar_36: { name: "Invar 36 (Low CTE)", density: 8.05, youngs_modulus: 141, shear_modulus: 57.0, yield_strength: 240, uts: 490, poisson: 0.29 },
  cast_iron: { name: "Gray Cast Iron", density: 7.15, youngs_modulus: 110, shear_modulus: 44.0, yield_strength: 150, uts: 250, poisson: 0.28 },
  delrin: { name: "Delrin/Acetal", density: 1.42, youngs_modulus: 3.1, shear_modulus: 1.10, yield_strength: 65, uts: 70, poisson: 0.35 },
  polycarbonate: { name: "Polycarbonate", density: 1.20, youngs_modulus: 2.4, shear_modulus: 0.85, yield_strength: 62, uts: 65, poisson: 0.37 },
  nylon_66: { name: "Nylon 6/6", density: 1.14, youngs_modulus: 2.7, shear_modulus: 1.00, yield_strength: 55, uts: 82, poisson: 0.39 },
  abs: { name: "ABS Plastic", density: 1.05, youngs_modulus: 2.3, shear_modulus: 0.80, yield_strength: 40, uts: 43, poisson: 0.35 },
  carbon_fiber: { name: "Carbon Fiber (UD, 0°)", density: 1.60, youngs_modulus: 135, shear_modulus: 5.0, yield_strength: 1500, uts: 1700, poisson: 0.30 },
  wood_pine: { name: "Douglas Fir (along grain)", density: 0.53, youngs_modulus: 13.1, shear_modulus: 0.85, yield_strength: 40, uts: 50, poisson: 0.30 }
};

function renderMaterialTable() {
  const tbody = document.getElementById('materials-table');
  if (!tbody) return;
  
  let html = `<thead><tr>
      <th>Material</th>
      <th>E (GPa)</th>
      <th>G (GPa)</th>
      <th>Yield (MPa)</th>
      <th>UTS (MPa)</th>
      <th>ρ (g/cm³)</th>
      <th>ν</th>
    </tr></thead><tbody>`;
    
  for (const key in materials) {
    const m = materials[key];
    html += `<tr>
      <td class="eq">${m.name}</td>
      <td>${m.youngs_modulus.toFixed(1)}</td>
      <td>${m.shear_modulus.toFixed(1)}</td>
      <td>${m.yield_strength}</td>
      <td>${m.uts}</td>
      <td>${m.density.toFixed(2)}</td>
      <td>${m.poisson.toFixed(2)}</td>
    </tr>`;
  }
  html += '</tbody>';
  tbody.innerHTML = html;
}

function populateMaterialDropdowns() {
  document.querySelectorAll('.material-dropdown').forEach(sel => {
    if (sel.dataset.filled) return;
    sel.innerHTML = Object.keys(materials).map(k => `<option value="${k}">${materials[k].name}</option>`).join('');
    sel.dataset.filled = "1";
  });
}

// ============================================================
// CALCULATION LOGGING
// ============================================================
function addToLog(operationName, inputDetails, result, unit = '', isWarning = false) {
  const logContainer = document.getElementById('calc-log-list');
  if (!logContainer) return;

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const entry = document.createElement('div');
  entry.className = `log-entry ${isWarning ? 'red-edge' : ''}`;
  
  entry.innerHTML = `
      <div class="log-time">${timeString}</div>
      <div class="log-title">${operationName}</div>
      <div class="log-details">${inputDetails}</div>
      <div class="log-result" style="color: ${isWarning ? 'var(--red)' : 'var(--blue)'};">${result} <span style="font-size: 0.85em; font-weight: normal; color: var(--ink-dim);">${unit}</span></div>
  `;

  logContainer.insertBefore(entry, logContainer.firstChild);
}

function clearLog() {
  const logContainer = document.getElementById('calc-log-list');
  if (logContainer) logContainer.innerHTML = '';
}

function toggleLog() {
  const sidebar = document.getElementById('calc-log-sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// ============================================================
// BEAM MECHANICS ENGINE
// ============================================================
function sectionProps(shape, dims) {
  if (shape === 'rect') {
    const { b, h } = dims;
    return { I: (b * Math.pow(h, 3)) / 12, c: h / 2 };
  } else if (shape === 'circle') {
    const { d } = dims;
    return { I: (Math.PI * Math.pow(d, 4)) / 64, c: d / 2 };
  } else if (shape === 'tube') {
    const { do: dOuter, di } = dims;
    return { I: (Math.PI * (Math.pow(dOuter, 4) - Math.pow(di, 4))) / 64, c: dOuter / 2 };
  } else if (shape === 'custom') {
    return { I: dims.I, c: dims.c };
  }
}

const beamCases = {
  cantilever_point: {
    label: "Cantilever Point",
    diagram: "fixed_free",
    formula: "y(x) = Px²(3L − x) / 6EI    |    y_max = PL³ / 3EI    |    M_max = PL (at wall)",
    compute(L, E, I, P) {
      const y = x => (P * x * x * (3 * L - x)) / (6 * E * I);
      const M = x => P * (L - x);
      return { y, M, yMax: (P * L ** 3) / (3 * E * I), Mmax: P * L, loadDesc: `Point load ${P} N at free end` };
    }
  },
  cantilever_udl: {
    label: "Cantilever UDL",
    diagram: "fixed_free",
    formula: "y(x) = w x²(x² − 4Lx + 6L²) / 24EI    |    y_max = wL⁴ / 8EI    |    M_max = wL²/2 (at wall)",
    compute(L, E, I, w) {
      const y = x => (w * x * x * (x * x - 4 * L * x + 6 * L * L)) / (24 * E * I);
      const M = x => (w * Math.pow(L - x, 2)) / 2;
      return { y, M, yMax: (w * L ** 4) / (8 * E * I), Mmax: (w * L * L) / 2, loadDesc: `UDL ${w} N/mm over full span` };
    }
  },
  ss_point_center: {
    label: "SS Point Center",
    diagram: "pin_pin",
    formula: "y(x) = Px(3L² − 4x²) / 48EI  [0≤x≤L/2]    |    y_max = PL³ / 48EI    |    M_max = PL/4 (center)",
    compute(L, E, I, P) {
      const y = x => {
        const xx = x <= L / 2 ? x : L - x;
        return (P * xx * (3 * L * L - 4 * xx * xx)) / (48 * E * I);
      };
      const M = x => (x <= L / 2 ? (P * x) / 2 : (P * (L - x)) / 2);
      return { y, M, yMax: (P * L ** 3) / (48 * E * I), Mmax: (P * L) / 4, loadDesc: `Point load ${P} N at center` };
    }
  },
  ss_point_offset: {
    label: "SS Point Offset",
    diagram: "pin_pin",
    formula: "y(x) = Pbx(L² − b² − x²) / 6LEI  [0≤x≤a]    |    M_max = Pab / L (at load)",
    compute(L, E, I, P, a) {
      const b = L - a;
      const y = x => {
        if (x <= a) return (P * b * x * (L * L - b * b - x * x)) / (6 * L * E * I);
        const xp = L - x, ap = a;
        return (P * ap * xp * (L * L - ap * ap - xp * xp)) / (6 * L * E * I);
      };
      const M = x => (x <= a ? (P * b * x) / L : (P * a * (L - x)) / L);
      return { y, M, yMax: null, Mmax: (P * a * b) / L, loadDesc: `Point load ${P} N at x = ${a} mm from left support` };
    }
  },
  ss_udl: {
    label: "SS UDL",
    diagram: "pin_pin",
    formula: "y(x) = wx(L³ − 2Lx² + x³) / 24EI    |    y_max = 5wL⁴ / 384EI    |    M_max = wL²/8 (center)",
    compute(L, E, I, w) {
      const y = x => (w * x * (L ** 3 - 2 * L * x * x + x ** 3)) / (24 * E * I);
      const M = x => (w * x * (L - x)) / 2;
      return { y, M, yMax: (5 * w * L ** 4) / (384 * E * I), Mmax: (w * L * L) / 8, loadDesc: `UDL ${w} N/mm over full span` };
    }
  }
};

function runBeamSimulation() {
  const beamType = document.getElementById('beam-type').value;
  const shape = document.getElementById('cross-section').value;
  const matKey = document.getElementById('beam-material').value;
  const L = parseFloat(document.getElementById('beam-length').value);
  const loadVal = parseFloat(document.getElementById('beam-load').value);
  const posA = parseFloat(document.getElementById('beam-position')?.value || 0);

  const mat = materials[matKey];
  const E = mat.youngs_modulus * 1000;

  let dims = {};
  if (shape === 'rect') {
    dims = { b: parseFloat(document.getElementById('dim-b').value), h: parseFloat(document.getElementById('dim-h').value) };
  } else if (shape === 'circle') {
    dims = { d: parseFloat(document.getElementById('dim-d').value) };
  } else if (shape === 'tube') {
    dims = { do: parseFloat(document.getElementById('dim-do').value), di: parseFloat(document.getElementById('dim-di').value) };
  } else if (shape === 'custom') {
    dims = { I: parseFloat(document.getElementById('dim-I').value), c: parseFloat(document.getElementById('dim-c').value) };
  }
  const { I, c } = sectionProps(shape, dims);

  const bc = beamCases[beamType];
  const result = beamType === 'ss_point_offset' ? bc.compute(L, E, I, loadVal, posA) : bc.compute(L, E, I, loadVal);

  const N = 150;
  const xs = [], ys = [], Ms = [];
  for (let i = 0; i <= N; i++) {
    const x = (L * i) / N;
    xs.push(x);
    ys.push(result.y(x));
    Ms.push(result.M(x));
  }
  const yMax = result.yMax !== null ? result.yMax : Math.max(...ys.map(Math.abs));
  const Mmax = result.Mmax;
  const sigmaMax = (Mmax * c) / I;
  const fos = mat.yield_strength / sigmaMax;

  drawBeamSVG(bc.diagram, xs, ys, L, yMax, beamType, posA);

  const fosColor = fos < 1.2 ? 'var(--red)' : (fos < 2 ? 'var(--gold)' : 'var(--green)');
  document.getElementById('beam-result').innerHTML = `
    <div class="spec-row"><span class="spec-key">Load Case</span><span class="spec-val">${result.loadDesc}</span></div>
    <div class="spec-row"><span class="spec-key">Section</span><span class="spec-val">I = ${I.toFixed(0)} mm⁴, c = ${c.toFixed(2)} mm</span></div>
    <div class="spec-row"><span class="spec-key">Max Moment</span><span class="spec-val">${(Mmax / 1000).toFixed(2)} N·m</span></div>
    <div class="spec-row"><span class="spec-key">Max Bending Stress</span><span class="spec-val">${sigmaMax.toFixed(1)} MPa</span></div>
    <div class="spec-row"><span class="spec-key">Max Deflection</span><span class="spec-val">${yMax.toFixed(3)} mm (${(yMax / L * 100).toFixed(2)}%)</span></div>
    <div class="spec-row"><span class="spec-key">Factor of Safety</span><span class="spec-val" style="color:${fosColor};">${fos.toFixed(2)}</span></div>
    <div class="formula-line">${bc.formula}</div>
  `;
  setStatusResult(`FoS ${fos.toFixed(2)}`);
  
  addToLog(`Beam: ${bc.label}`, `L=${L}mm, P/w=${loadVal}`, sigmaMax.toFixed(2), `MPa (FoS ${fos.toFixed(2)})`, fos < 1.2);
}

function setStatusResult(text) {
  const el = document.getElementById('status-result');
  if (el) el.textContent = text;
}

function drawBeamSVG(diagramType, xs, ys, L, yMaxAbs, beamType, posA) {
  const W = 760, H = 260, baseY = 110, xMargin = 60;
  const spanPx = W - 2 * xMargin;
  const scaleX = x => xMargin + (x / L) * spanPx;

  const maxDisplay = Math.max(yMaxAbs, 1e-9);
  const exaggeration = 60 / maxDisplay; 
  const scaleY = y => baseY + y * exaggeration;

  let pathPts = xs.map((x, i) => `${scaleX(x).toFixed(1)},${scaleY(ys[i]).toFixed(1)}`).join(' ');

  let supports = '';
  if (diagramType === 'fixed_free') {
    supports += `<line x1="${xMargin}" y1="${baseY - 45}" x2="${xMargin}" y2="${baseY + 45}" stroke="var(--ink)" stroke-width="4"/>`;
    for (let i = 0; i < 6; i++) {
      const hy = baseY - 40 + i * 16;
      supports += `<line x1="${xMargin}" y1="${hy}" x2="${xMargin - 12}" y2="${hy + 14}" stroke="var(--ink)" stroke-width="2"/>`;
    }
  } else if (diagramType === 'pin_pin') {
    const rx = xMargin, lx = W - xMargin;
    [rx, lx].forEach(px => {
      supports += `<polygon points="${px},${baseY} ${px - 12},${baseY + 22} ${px + 12},${baseY + 22}" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
      supports += `<line x1="${px - 18}" y1="${baseY + 22}" x2="${px + 18}" y2="${baseY + 22}" stroke="var(--ink)" stroke-width="2"/>`;
    });
  }

  let loadArrows = '';
  if (beamType === 'cantilever_point') {
    const px = scaleX(L);
    loadArrows = arrow(px, baseY - 50, px, baseY - 5);
  } else if (beamType === 'ss_point_center') {
    const px = scaleX(L / 2);
    loadArrows = arrow(px, baseY - 50, px, baseY - 5);
  } else if (beamType === 'ss_point_offset') {
    const px = scaleX(posA);
    loadArrows = arrow(px, baseY - 50, px, baseY - 5);
  } else if (beamType === 'cantilever_udl' || beamType === 'ss_udl') {
    for (let i = 0; i <= 8; i++) {
      const x = (L * i) / 8;
      const px = scaleX(x);
      loadArrows += arrow(px, baseY - 32, px, baseY - 5);
    }
  }

  const posTicks = niceTicks(0, L, 4).map(t => `
    <line x1="${scaleX(t).toFixed(1)}" y1="${baseY - 3}" x2="${scaleX(t).toFixed(1)}" y2="${baseY + 3}" stroke="var(--ink)" stroke-width="1" opacity="0.5"/>
    ${label(scaleX(t), baseY + 34, `${t.toFixed(0)}mm`, { size: 8, anchor: 'middle', color: 'var(--ink-dim)' })}
  `).join('');

  const svg = `
  <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:auto; font-family:'IBM Plex Mono',monospace;">
    <line x1="${xMargin}" y1="${baseY}" x2="${W - xMargin}" y2="${baseY}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="4,3" opacity="0.4"/>
    ${posTicks}
    ${supports}
    ${loadArrows}
    <polyline points="${pathPts}" fill="none" stroke="var(--red)" stroke-width="2.5"/>
    <text x="${W/2 - 70}" y="${H - 10}" font-size="11" fill="var(--red)">deflection ×${exaggeration.toFixed(0)} (exaggerated)</text>
  </svg>`;
  document.getElementById('beam-svg-container').innerHTML = svg;
}

function arrow(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--blue)" stroke-width="2"/>
    <polygon points="${x2},${y2} ${x2-5},${y2-9} ${x2+5},${y2-9}" fill="var(--blue)"/>`;
}

function onBeamTypeChange() {
  const beamType = document.getElementById('beam-type').value;
  document.getElementById('position-field').style.display = (beamType === 'ss_point_offset') ? 'block' : 'none';
  document.getElementById('load-label').textContent = (beamType.includes('udl')) ? 'Load w (N/mm)' : 'Load P (N)';
}

function onSectionChange() {
  const shape = document.getElementById('cross-section').value;
  ['rect', 'circle', 'tube', 'custom'].forEach(s => {
    document.getElementById(`section-${s}`).style.display = (s === shape) ? 'flex' : 'none';
  });
}

// ============================================================
// QUICK DESIGN CALCULATORS
// ============================================================
function calcStress() {
  const F = parseFloat(document.getElementById('stress-F').value);
  const A = parseFloat(document.getElementById('stress-A').value);
  const matKey = document.getElementById('stress-material').value;
  const mat = materials[matKey];
  const sigma = F / A;
  const fos = mat.yield_strength / sigma;
  document.getElementById('stress-result').innerHTML =
    `<div class="eq-live">σ = F/A = ${F}/${A} = <strong>${sigma.toFixed(2)} MPa</strong></div>
     <div class="spec-row"><span class="spec-key">Factor of Safety</span><span class="spec-val">${fos.toFixed(2)}</span></div>`;
  setStatusResult(`σ ${sigma.toFixed(1)} MPa`);
  addToLog('Axial Stress', `F=${F}N, A=${A}mm²`, sigma.toFixed(2), `MPa (FoS ${fos.toFixed(2)})`, fos < 1.2);
}

function calcTorsion() {
  const T = parseFloat(document.getElementById('torsion-T').value); 
  const d = parseFloat(document.getElementById('torsion-d').value); 
  const Lg = parseFloat(document.getElementById('torsion-L').value); 
  const matKey = document.getElementById('torsion-material').value;
  const mat = materials[matKey];
  const G = mat.shear_modulus * 1000; 
  const J = (Math.PI * Math.pow(d, 4)) / 32;
  const tau = (T * (d / 2)) / J;
  const theta = (T * Lg) / (G * J); 
  document.getElementById('torsion-result').innerHTML =
    `<div class="eq-live">τ = Tr/J = ${T}×${(d/2).toFixed(1)}/${J.toFixed(0)} = <strong>${tau.toFixed(2)} MPa</strong></div>
     <div class="spec-row"><span class="spec-key">Angle of Twist</span><span class="spec-val">${(theta * 180 / Math.PI).toFixed(3)}° over ${Lg} mm</span></div>`;
  setStatusResult(`τ ${tau.toFixed(1)} MPa`);
  addToLog('Torsion', `T=${T}N·mm, d=${d}mm`, tau.toFixed(2), 'MPa');
}

function calcBuckling() {
  const E = parseFloat(document.getElementById('buckle-material').value ? materials[document.getElementById('buckle-material').value].youngs_modulus * 1000 : 0);
  const I = parseFloat(document.getElementById('buckle-I').value);
  const Lg = parseFloat(document.getElementById('buckle-L').value);
  const K = parseFloat(document.getElementById('buckle-K').value);
  const Pcr = (Math.PI ** 2 * E * I) / Math.pow(K * Lg, 2);
  document.getElementById('buckle-result').innerHTML =
    `<div class="eq-live">P_cr = π²EI/(KL)² = <strong>${Pcr.toFixed(1)} N</strong> (${(Pcr/1000).toFixed(2)} kN)</div>`;
  setStatusResult(`P_cr ${(Pcr/1000).toFixed(2)} kN`);
  addToLog('Euler Buckling', `L=${Lg}mm, I=${I}mm⁴, K=${K}`, (Pcr/1000).toFixed(2), 'kN');
}

function calcSpring() {
  const matKey = document.getElementById('spring-material').value;
  const G = materials[matKey].shear_modulus * 1000; 
  const d = parseFloat(document.getElementById('spring-d').value);
  const D = parseFloat(document.getElementById('spring-D').value);
  const n = parseFloat(document.getElementById('spring-n').value);
  const k = (G * Math.pow(d, 4)) / (8 * Math.pow(D, 3) * n);
  document.getElementById('spring-result').innerHTML =
    `<div class="eq-live">k = Gd⁴/8D³n = <strong>${k.toFixed(2)} N/mm</strong></div>`;
  setStatusResult(`k ${k.toFixed(2)} N/mm`);
  addToLog('Helical Spring', `d=${d}mm, D=${D}mm, n=${n}`, k.toFixed(2), 'N/mm');
}

// ============================================================
// GEAR / PULLEY POWER TRANSMISSION
// ============================================================
function onPTModeChange() {
  const mode = document.getElementById('pt-mode').value;
  document.getElementById('pt-gear-fields').style.display = mode === 'gear' ? 'flex' : 'none';
  document.getElementById('pt-pulley-fields').style.display = mode === 'pulley' ? 'flex' : 'none';
}

function calcPowerTransmission() {
  const mode = document.getElementById('pt-mode').value;
  const rpmIn = parseFloat(document.getElementById('pt-rpm-in').value);
  const torqueIn = parseFloat(document.getElementById('pt-torque-in').value); 
  const eff = parseFloat(document.getElementById('pt-eff').value) / 100;

  let ratio, driverDesc;
  if (mode === 'gear') {
    const Nin = parseFloat(document.getElementById('pt-n-in').value);
    const Nout = parseFloat(document.getElementById('pt-n-out').value);
    ratio = Nout / Nin;
    driverDesc = `${Nin}T → ${Nout}T (${(1/ratio).toFixed(2)}:1 speed reduction)`;
  } else {
    const Din = parseFloat(document.getElementById('pt-d-in').value);
    const Dout = parseFloat(document.getElementById('pt-d-out').value);
    ratio = Dout / Din;
    driverDesc = `Ø${Din} → Ø${Dout} mm (${(1/ratio).toFixed(2)}:1 speed reduction)`;
  }

  const rpmOut = rpmIn / ratio;
  const torqueOut = torqueIn * ratio * eff;
  const omegaIn = (rpmIn * 2 * Math.PI) / 60;
  const omegaOut = (rpmOut * 2 * Math.PI) / 60;
  const powerIn = torqueIn * omegaIn; 
  const powerOut = torqueOut * omegaOut; 

  let belt = '';
  if (mode === 'pulley') {
    const Din = parseFloat(document.getElementById('pt-d-in').value);
    const beltSpeed = omegaIn * (Din / 2 / 1000); 
    belt = `<div class="spec-row"><span class="spec-key">Belt Speed</span><span class="spec-val">${beltSpeed.toFixed(2)} m/s</span></div>`;
  }

  document.getElementById('pt-result').innerHTML = `
    <div class="eq-live">ω₂ = ω₁ / ratio = ${rpmIn}/${ratio.toFixed(3)} = <strong>${rpmOut.toFixed(1)} RPM</strong></div>
    <div class="spec-row"><span class="spec-key">Train</span><span class="spec-val">${driverDesc}</span></div>
    <div class="spec-row"><span class="spec-key">Output Torque</span><span class="spec-val">${torqueOut.toFixed(3)} N·m</span></div>
    ${belt}
    <div class="spec-row"><span class="spec-key">Power In / Out</span><span class="spec-val">${powerIn.toFixed(1)} W / ${powerOut.toFixed(1)} W</span></div>
  `;
  setStatusResult(`${rpmOut.toFixed(0)} RPM out`);
  addToLog('Power Trans.', `${mode.toUpperCase()}, in=${rpmIn}RPM`, rpmOut.toFixed(1), 'RPM out');
}

// ============================================================
// PRESS FIT / INTERFERENCE FIT 
// ============================================================
function calcPressFit() {
  const matKey = document.getElementById('fit-material').value;
  const mat = materials[matKey];
  const E = mat.youngs_modulus * 1000; 

  const D = parseFloat(document.getElementById('fit-D').value);
  const Do = parseFloat(document.getElementById('fit-Do').value);
  const Di = parseFloat(document.getElementById('fit-Di').value);
  const deltaD = parseFloat(document.getElementById('fit-delta').value);
  const L = parseFloat(document.getElementById('fit-L').value);
  const mu = parseFloat(document.getElementById('fit-mu').value);

  const R = D / 2, b = Do / 2, a = Di / 2;
  const delta = deltaD / 2; 

  const p = ((E * delta) / (2 * R)) * ((b * b - R * R) * (R * R - a * a)) / (R * R * (b * b - a * a));
  const sigmaHubInner = (p * (b * b + R * R)) / (b * b - R * R);
  const sigmaShaftOuter = a === 0 ? -p : -(p * (R * R + a * a)) / (R * R - a * a);
  const fosHub = mat.yield_strength / sigmaHubInner;
  const Tmax = (2 * Math.PI * R * R * L * p * mu) / 1000; 
  const Faxial = 2 * Math.PI * R * L * p * mu; 

  const fosColor = fosHub < 1.2 ? 'var(--red)' : (fosHub < 2 ? 'var(--gold)' : 'var(--green)');
  document.getElementById('fit-result').innerHTML = `
    <div class="spec-row"><span class="spec-key">Contact Pressure p</span><span class="spec-val">${p.toFixed(2)} MPa</span></div>
    <div class="spec-row"><span class="spec-key">Hub Hoop Stress (bore)</span><span class="spec-val">${sigmaHubInner.toFixed(1)} MPa</span></div>
    <div class="spec-row"><span class="spec-key">Shaft Surface Stress</span><span class="spec-val">${sigmaShaftOuter.toFixed(1)} MPa (compressive)</span></div>
    <div class="spec-row"><span class="spec-key">Hub FoS (yield)</span><span class="spec-val" style="color:${fosColor};">${fosHub.toFixed(2)}</span></div>
    <div class="spec-row"><span class="spec-key">Max Transmissible Torque</span><span class="spec-val">${Tmax.toFixed(2)} N·m</span></div>
    <div class="spec-row"><span class="spec-key">Axial Press/Pull Force</span><span class="spec-val">${(Faxial/1000).toFixed(2)} kN</span></div>
    <div class="formula-line">p = Eδ(b²−R²)(R²−a²) / [2R³(b²−a²)] &nbsp;|&nbsp; T = 2πR²Lpμ &nbsp;|&nbsp; F = 2πRLpμ</div>
  `;
  setStatusResult(`p = ${p.toFixed(1)} MPa`);
  addToLog('Press Fit', `D=${D}mm, Δ=${deltaD}mm`, p.toFixed(2), `MPa (FoS ${fosHub.toFixed(2)})`, fosHub < 1.2);
}

// ============================================================
// GENERAL MACHINE DESIGN
// ============================================================
function calcWeld() {
  const P = parseFloat(document.getElementById('weld-P').value);
  const leg = parseFloat(document.getElementById('weld-leg').value);
  const L = parseFloat(document.getElementById('weld-L').value);
  const mat = materials[document.getElementById('weld-material').value];

  const throat = 0.707 * leg;
  const tau = P / (throat * L);
  const allow = 0.3 * mat.uts;
  const fos = allow / tau;
  const fosColor = fos < 1.2 ? 'var(--red)' : (fos < 2 ? 'var(--gold)' : 'var(--green)');

  document.getElementById('weld-result').innerHTML = `
    <div class="eq-live">τ = P/(0.707·leg·L) = ${P}/(0.707×${leg}×${L}) = <strong>${tau.toFixed(2)} MPa</strong></div>
    <div class="spec-row"><span class="spec-key">Throat Thickness</span><span class="spec-val">${throat.toFixed(2)} mm</span></div>
    <div class="spec-row"><span class="spec-key">Allowable Shear (≈0.3×UTS)</span><span class="spec-val">${allow.toFixed(1)} MPa</span></div>
    <div class="spec-row"><span class="spec-key">Factor of Safety</span><span class="spec-val" style="color:${fosColor};">${fos.toFixed(2)}</span></div>
  `;
  setStatusResult(`τ_weld ${tau.toFixed(1)} MPa`);
  addToLog('Weld Strength', `P=${P}N, L=${L}mm, leg=${leg}`, tau.toFixed(2), `MPa (FoS ${fos.toFixed(2)})`, fos < 1.2);
}

function calcBoltPattern() {
  const n = parseInt(document.getElementById('bolt-n').value, 10);
  const R = parseFloat(document.getElementById('bolt-R').value);
  const d = parseFloat(document.getElementById('bolt-d').value);
  const V = parseFloat(document.getElementById('bolt-V').value);
  const M = parseFloat(document.getElementById('bolt-M').value);
  const mat = materials[document.getElementById('bolt-material').value];

  const Fdirect = V / n;
  const Fmoment = M / (n * R);
  const Fmax = Fdirect + Fmoment;
  const area = (Math.PI * d * d) / 4;
  const tau = Fmax / area;
  const allowShear = 0.577 * mat.yield_strength; 
  const fos = allowShear / tau;
  const fosColor = fos < 1.2 ? 'var(--red)' : (fos < 2 ? 'var(--gold)' : 'var(--green)');

  document.getElementById('bolt-result').innerHTML = `
    <div class="eq-live">F_max = V/n + M/(nR) = ${V}/${n} + ${M}/(${n}×${R}) = <strong>${Fmax.toFixed(1)} N</strong></div>
    <div class="spec-row"><span class="spec-key">Direct Shear / Bolt</span><span class="spec-val">${Fdirect.toFixed(1)} N</span></div>
    <div class="spec-row"><span class="spec-key">Moment Shear / Bolt (worst-case)</span><span class="spec-val">${Fmoment.toFixed(1)} N</span></div>
    <div class="spec-row"><span class="spec-key">Bolt Shear Stress</span><span class="spec-val">${tau.toFixed(1)} MPa</span></div>
    <div class="spec-row"><span class="spec-key">Factor of Safety (0.577·Sy)</span><span class="spec-val" style="color:${fosColor};">${fos.toFixed(2)}</span></div>
  `;
  setStatusResult(`FoS_bolt ${fos.toFixed(2)}`);
  addToLog('Bolt Pattern', `n=${n}, V=${V}N, M=${M}N·mm`, Fmax.toFixed(1), `N max load (FoS ${fos.toFixed(2)})`, fos < 1.2);
}

function calcKey() {
  const T = parseFloat(document.getElementById('key-T').value);
  const d = parseFloat(document.getElementById('key-d').value);
  const w = parseFloat(document.getElementById('key-w').value);
  const h = parseFloat(document.getElementById('key-h').value);
  const L = parseFloat(document.getElementById('key-L').value);
  const mat = materials[document.getElementById('key-material').value];

  const F = (2 * T) / d;
  const tau = F / (w * L);
  const sigmaB = (2 * F) / (h * L);
  const fosShear = (0.577 * mat.yield_strength) / tau;
  const fosBearing = mat.yield_strength / sigmaB;
  const worstFos = Math.min(fosShear, fosBearing);
  const fosColor = worstFos < 1.2 ? 'var(--red)' : (worstFos < 2 ? 'var(--gold)' : 'var(--green)');

  document.getElementById('key-result').innerHTML = `
    <div class="eq-live">F = 2T/d = 2×${T}/${d} = <strong>${F.toFixed(1)} N</strong></div>
    <div class="spec-row"><span class="spec-key">Shear Stress τ</span><span class="spec-val">${tau.toFixed(2)} MPa (FoS ${fosShear.toFixed(2)})</span></div>
    <div class="spec-row"><span class="spec-key">Bearing Stress σ_b</span><span class="spec-val">${sigmaB.toFixed(2)} MPa (FoS ${fosBearing.toFixed(2)})</span></div>
    <div class="spec-row"><span class="spec-key">Governing Factor of Safety</span><span class="spec-val" style="color:${fosColor};">${worstFos.toFixed(2)}</span></div>
  `;
  setStatusResult(`FoS_key ${worstFos.toFixed(2)}`);
  addToLog('Key Shear/Brg', `T=${T}N·mm, d=${d}mm`, worstFos.toFixed(2), 'Min FoS', worstFos < 1.2);
}

function calcBearingLife() {
  const C = parseFloat(document.getElementById('brg-C').value);
  const P = parseFloat(document.getElementById('brg-P').value);
  const k = parseFloat(document.getElementById('brg-type').value);
  const rpm = parseFloat(document.getElementById('brg-rpm').value);

  const L10 = Math.pow(C / P, k); 
  const L10h = (L10 * 1e6) / (60 * rpm);

  document.getElementById('brg-result').innerHTML = `
    <div class="eq-live">L10 = (C/P)^k = (${C}/${P})^${k.toFixed(2)} = <strong>${L10.toFixed(2)} million rev</strong></div>
    <div class="spec-row"><span class="spec-key">Life in Hours</span><span class="spec-val">${L10h.toFixed(0)} hrs (${(L10h/8760).toFixed(2)} yrs continuous)</span></div>
  `;
  setStatusResult(`L10 ${L10h.toFixed(0)} hrs`);
  addToLog('Bearing Life', `C=${C}N, P=${P}N, ${rpm}RPM`, L10h.toFixed(0), 'hrs');
}

// ============================================================
// PLOTTING HELPER
// ============================================================
function makePlot(xDomain, yDomain, opts = {}) {
  const W = opts.width || 680, H = opts.height || 320;
  const margin = opts.margin || { left: 55, right: 20, top: 20, bottom: 40 };
  const pw = W - margin.left - margin.right;
  const ph = H - margin.top - margin.bottom;
  const logX = !!opts.logX, logY = !!opts.logY;
  const fx = x => logX ? Math.log10(x) : x;
  const fy = y => logY ? Math.log10(y) : y;
  const x0 = fx(xDomain[0]), x1 = fx(xDomain[1]);
  const y0 = fy(yDomain[0]), y1 = fy(yDomain[1]);
  const sx = x => margin.left + ((fx(x) - x0) / (x1 - x0)) * pw;
  const sy = y => margin.top + ph - ((fy(y) - y0) / (y1 - y0)) * ph;
  const axes = `
    <line x1="${margin.left}" y1="${margin.top + ph}" x2="${margin.left + pw}" y2="${margin.top + ph}" stroke="var(--ink)" stroke-width="1.5"/>
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + ph}" stroke="var(--ink)" stroke-width="1.5"/>`;
  return { W, H, margin, pw, ph, sx, sy, axes };
}

function svgWrap(W, H, inner) {
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:auto; font-family:'IBM Plex Mono',monospace;">${inner}</svg>`;
}

function label(x, y, text, opts = {}) {
  const size = opts.size || 10, color = opts.color || 'var(--ink)', anchor = opts.anchor || 'start';
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${text}</text>`;
}

function niceTicks(min, max, count = 5) {
  const ticks = [];
  for (let i = 0; i <= count; i++) ticks.push(min + ((max - min) * i) / count);
  return ticks;
}

function tickMarks(plot, xTicks, yTicks, xFmt, yFmt) {
  xFmt = xFmt || (v => v.toFixed(0));
  yFmt = yFmt || (v => v.toFixed(0));
  let s = '';
  xTicks.forEach(t => {
    const px = plot.sx(t);
    s += `<line x1="${px.toFixed(1)}" y1="${plot.margin.top}" x2="${px.toFixed(1)}" y2="${plot.margin.top + plot.ph}" stroke="var(--line)" stroke-width="1" opacity="0.4"/>`;
    s += `<line x1="${px.toFixed(1)}" y1="${plot.margin.top + plot.ph}" x2="${px.toFixed(1)}" y2="${plot.margin.top + plot.ph + 4}" stroke="var(--ink)"/>`;
    s += label(px, plot.margin.top + plot.ph + 16, xFmt(t), { size: 8, anchor: 'middle', color: 'var(--ink-dim)' });
  });
  yTicks.forEach(t => {
    const py = plot.sy(t);
    s += `<line x1="${plot.margin.left}" y1="${py.toFixed(1)}" x2="${plot.margin.left + plot.pw}" y2="${py.toFixed(1)}" stroke="var(--line)" stroke-width="1" opacity="0.4"/>`;
    s += `<line x1="${plot.margin.left - 4}" y1="${py.toFixed(1)}" x2="${plot.margin.left}" y2="${py.toFixed(1)}" stroke="var(--ink)"/>`;
    s += label(plot.margin.left - 8, py + 3, yFmt(t), { size: 8, anchor: 'end', color: 'var(--ink-dim)' });
  });
  return s;
}

const OVERLAY_COLORS = ['var(--red)', 'var(--blue)', 'var(--gold)', 'var(--green)'];

function selectedMaterials(selectId, max = 4) {
  const opts = Array.from(document.getElementById(selectId).selectedOptions).map(o => o.value);
  return (opts.length ? opts : [document.getElementById(selectId).options[0]?.value]).filter(Boolean).slice(0, max);
}

// ============================================================
// GRAPHS & DIAGRAMS
// ============================================================
function onGraphTypeChange() {
  const type = document.getElementById('graph-type').value;
  ['mohr', 'stress_strain', 'hardening', 'motor', 'fatigue'].forEach(t => {
    document.getElementById(`graph-fields-${t}`).style.display = (t === type) ? 'flex' : 'none';
  });
}

function drawGraph() {
  const type = document.getElementById('graph-type').value;
  const titles = {
    mohr: "Mohr's Circle — Principal Stresses",
    stress_strain: 'Stress-Strain Curve',
    hardening: 'Steel Hardening Sequence (schematic — not to time/temp scale)',
    motor: 'Motor Torque–Speed Curve',
    fatigue: 'Fatigue (S-N) Curve — Estimated per Shigley Method'
  };
  document.getElementById('graph-title').textContent = titles[type];
  ({ mohr: drawMohrCircle, stress_strain: drawStressStrain, hardening: drawHardening,
     motor: drawMotorCurve, fatigue: drawFatigueCurve })[type]();
}

function drawMohrCircle() {
  const sx = parseFloat(document.getElementById('mohr-sx').value);
  const sy = parseFloat(document.getElementById('mohr-sy').value);
  const txy = parseFloat(document.getElementById('mohr-txy').value);
  const C = (sx + sy) / 2;
  const R = Math.sqrt(Math.pow((sx - sy) / 2, 2) + txy * txy);
  const s1 = C + R, s2 = C - R;
  const thetaP = 0.5 * Math.atan2(2 * txy, sx - sy) * 180 / Math.PI;

  const maxAbs = Math.max(Math.abs(s1), Math.abs(s2), Math.abs(txy), 1) * 1.35;
  const plot = makePlot([-maxAbs, maxAbs], [-maxAbs, maxAbs], { width: 480, height: 480, margin: { left: 55, right: 25, top: 20, bottom: 40 } });
  const rPx = plot.sx(C + R) - plot.sx(C);
  const ticks = niceTicks(-maxAbs, maxAbs, 6);

  const inner = `
    ${plot.axes}
    ${tickMarks(plot, ticks, ticks, v => v.toFixed(0), v => v.toFixed(0))}
    <circle cx="${plot.sx(C)}" cy="${plot.sy(0)}" r="${rPx}" fill="none" stroke="var(--red)" stroke-width="2"/>
    <line x1="${plot.sx(sx)}" y1="${plot.sy(txy)}" x2="${plot.sx(sy)}" y2="${plot.sy(-txy)}" stroke="var(--blue)" stroke-width="1.5"/>
    <circle cx="${plot.sx(sx)}" cy="${plot.sy(txy)}" r="3.5" fill="var(--blue)"/>
    <circle cx="${plot.sx(sy)}" cy="${plot.sy(-txy)}" r="3.5" fill="var(--blue)"/>
    <circle cx="${plot.sx(s1)}" cy="${plot.sy(0)}" r="4" fill="var(--red)"/>
    <circle cx="${plot.sx(s2)}" cy="${plot.sy(0)}" r="4" fill="var(--red)"/>
    ${label(plot.sx(sx) + 6, plot.sy(txy) - 6, 'X (σx,τxy)', { size: 9, color: 'var(--blue)' })}
    ${label(plot.sx(sy) + 6, plot.sy(-txy) + 12, 'Y (σy,−τxy)', { size: 9, color: 'var(--blue)' })}
    ${label(plot.sx(s1), plot.sy(0) - 10, `σ1=${s1.toFixed(1)}`, { size: 9, color: 'var(--red)', anchor: 'middle' })}
    ${label(plot.sx(s2), plot.sy(0) - 10, `σ2=${s2.toFixed(1)}`, { size: 9, color: 'var(--red)', anchor: 'middle' })}
    ${label(plot.margin.left + plot.pw, plot.margin.top + plot.ph + 30, 'σ (MPa)', { size: 10, anchor: 'end' })}
    ${label(plot.margin.left, plot.margin.top + 10, 'τ (MPa)', { size: 10 })}
  `;
  document.getElementById('graph-svg-container').innerHTML = svgWrap(plot.W, plot.H, inner);
  document.getElementById('graph-result').innerHTML = `
    <div class="spec-row"><span class="spec-key">σ1 (max principal)</span><span class="spec-val">${s1.toFixed(2)} MPa</span></div>
    <div class="spec-row"><span class="spec-key">σ2 (min principal)</span><span class="spec-val">${s2.toFixed(2)} MPa</span></div>
    <div class="spec-row"><span class="spec-key">τmax (in-plane)</span><span class="spec-val">${R.toFixed(2)} MPa</span></div>
    <div class="spec-row"><span class="spec-key">Principal angle θp</span><span class="spec-val">${thetaP.toFixed(1)}°</span></div>
    <div class="formula-line">σ1,2 = (σx+σy)/2 ± √[((σx−σy)/2)² + τxy²] &nbsp;|&nbsp; θp = ½·atan2(2τxy, σx−σy)</div>
  `;
  setStatusResult(`σ1 ${s1.toFixed(0)} MPa`);
}

function drawStressStrain() {
  const matKeys = selectedMaterials('ss-material');
  const epsUTS = parseFloat(document.getElementById('ss-eps-uts').value) / 100;
  const epsF = parseFloat(document.getElementById('ss-eps-f').value) / 100;

  const curves = matKeys.map((key, idx) => {
    const mat = materials[key];
    const E = mat.youngs_modulus * 1000;
    const sy = mat.yield_strength, suts = mat.uts;
    const epsY = sy / E;
    const pts = [];
    for (let i = 0; i <= 20; i++) { const e = (epsY * i) / 20; pts.push({ x: e, y: E * e }); }
    for (let i = 1; i <= 60; i++) {
      const t = i / 60, e = epsY + (epsUTS - epsY) * t;
      pts.push({ x: e, y: sy + (suts - sy) * (1 - Math.pow(1 - t, 2)) });
    }
    const sFrac = suts * 0.85;
    for (let i = 1; i <= 30; i++) {
      const t = i / 30, e = epsUTS + (epsF - epsUTS) * t;
      pts.push({ x: e, y: suts + (sFrac - suts) * t });
    }
    return { mat, pts, epsY, sy, suts, color: OVERLAY_COLORS[idx % OVERLAY_COLORS.length] };
  });

  const yMax = Math.max(...curves.map(c => c.suts)) * 1.15;
  const plot = makePlot([0, epsF * 1.05], [0, yMax]);
  const xTicks = niceTicks(0, epsF * 1.05, 6);
  const yTicks = niceTicks(0, yMax, 6);

  const curveSvg = curves.map(c => {
    const pathPts = c.pts.map(pt => `${plot.sx(pt.x).toFixed(1)},${plot.sy(pt.y).toFixed(1)}`).join(' ');
    return `<polyline points="${pathPts}" fill="none" stroke="${c.color}" stroke-width="2.5"/>
      <circle cx="${plot.sx(c.epsY).toFixed(1)}" cy="${plot.sy(c.sy).toFixed(1)}" r="3" fill="${c.color}"/>
      <circle cx="${plot.sx(c.epsY + (epsUTS-c.epsY)).toFixed(1)}" cy="${plot.sy(c.suts).toFixed(1)}" r="3" fill="${c.color}"/>`;
  }).join('');

  const inner = `
    ${plot.axes}
    ${tickMarks(plot, xTicks, yTicks, v => (v*100).toFixed(1)+'%', v => v.toFixed(0))}
    ${curveSvg}
    ${label(plot.margin.left + plot.pw, plot.margin.top + plot.ph + 30, 'strain ε', { size: 10, anchor: 'end' })}
    ${label(plot.margin.left, plot.margin.top + 10, 'σ (MPa)', { size: 10 })}
  `;
  document.getElementById('graph-svg-container').innerHTML = svgWrap(plot.W, plot.H, inner);

  const legend = curves.map(c => `<span><span class="legend-swatch" style="background:${c.color};"></span>${c.mat.name} — εy=${(c.epsY*100).toFixed(2)}%, UTS=${c.suts} MPa</span>`).join('');
  document.getElementById('graph-result').innerHTML = `
    <div class="legend-row">${legend}</div>
    <div class="formula-line">Elastic region: σ=Eε. Plastic region beyond εy is an idealized ease-out curve to UTS, then to fracture — illustrative, not measured data.</div>
  `;
  setStatusResult(`${curves.length} material(s)`);
}

function drawHardening() {
  const Ta = parseFloat(document.getElementById('hard-aust').value);
  const Tq = parseFloat(document.getElementById('hard-quench').value);
  const Tt = parseFloat(document.getElementById('hard-temper').value);
  const room = 25;
  const pts = [
    { x: 0, y: room }, { x: 0.6, y: Ta }, { x: 2.2, y: Ta },
    { x: 2.5, y: Tq }, { x: 3.6, y: Tq },
    { x: 4.0, y: Tt }, { x: 6.0, y: Tt }, { x: 6.6, y: room }
  ];
  const yMin = Math.min(room, Tq) - 20, yMax = Ta * 1.1;
  const plot = makePlot([0, 7], [yMin, yMax]);
  const pathPts = pts.map(pt => `${plot.sx(pt.x).toFixed(1)},${plot.sy(pt.y).toFixed(1)}`).join(' ');
  const marks = [
    { x: 1.4, y: Ta, t: 'Austenitize & Soak' },
    { x: 3.0, y: Tq, t: 'Quench' },
    { x: 5.0, y: Tt, t: 'Temper & Soak' },
    { x: 6.6, y: room, t: 'Air Cool' }
  ];
  const markSvg = marks.map(m => `
    <circle cx="${plot.sx(m.x)}" cy="${plot.sy(m.y)}" r="3" fill="var(--red)"/>
    ${label(plot.sx(m.x), plot.sy(m.y) - 10, m.t, { size: 9, anchor: 'middle', color: 'var(--red)' })}
  `).join('');
  const inner = `
    ${plot.axes}
    ${tickMarks(plot, niceTicks(0, 7, 7), niceTicks(yMin, yMax, 6), v => v.toFixed(1), v => v.toFixed(0))}
    <polyline points="${pathPts}" fill="none" stroke="var(--blue)" stroke-width="2.5"/>
    ${markSvg}
    ${label(plot.margin.left + plot.pw, plot.margin.top + plot.ph + 30, 'time (schematic)', { size: 10, anchor: 'end' })}
    ${label(plot.margin.left, plot.margin.top + 10, 'Temp (°C)', { size: 10 })}
  `;
  document.getElementById('graph-svg-container').innerHTML = svgWrap(plot.W, plot.H, inner);
  document.getElementById('graph-result').innerHTML = `
    <div class="spec-row"><span class="spec-key">Austenitize</span><span class="spec-val">${Ta} °C</span></div>
    <div class="spec-row"><span class="spec-key">Quench To</span><span class="spec-val">${Tq} °C</span></div>
    <div class="spec-row"><span class="spec-key">Temper At</span><span class="spec-val">${Tt} °C</span></div>
    <div class="formula-line">Schematic process cycle only — real hardening curves (CCT/TTT) are alloy-specific and depend on cooling rate, not shown here.</div>
  `;
  setStatusResult(`Temper ${Tt}°C`);
}

function drawMotorCurve() {
  const Tstall = parseFloat(document.getElementById('motor-tstall').value);
  const rpmNL = parseFloat(document.getElementById('motor-rpm').value);
  const n = 100;
  const torquePts = [], powerPts = [];
  let Pmax = 0;
  for (let i = 0; i <= n; i++) {
    const rpm = (rpmNL * i) / n;
    const T = Tstall * (1 - rpm / rpmNL);
    const omega = (rpm * 2 * Math.PI) / 60;
    const P = T * omega;
    if (P > Pmax) Pmax = P;
    torquePts.push({ x: rpm, y: T });
    powerPts.push({ x: rpm, y: P });
  }
  const powerScaled = powerPts.map(p => ({ x: p.x, y: (p.y / Pmax) * Tstall }));

  const plot = makePlot([0, rpmNL], [0, Tstall * 1.1]);
  const tPath = torquePts.map(p => `${plot.sx(p.x).toFixed(1)},${plot.sy(p.y).toFixed(1)}`).join(' ');
  const pPath = powerScaled.map(p => `${plot.sx(p.x).toFixed(1)},${plot.sy(p.y).toFixed(1)}`).join(' ');
  const inner = `
    ${plot.axes}
    ${tickMarks(plot, niceTicks(0, rpmNL, 6), niceTicks(0, Tstall * 1.1, 5), v => v.toFixed(0), v => v.toFixed(2))}
    <polyline points="${tPath}" fill="none" stroke="var(--red)" stroke-width="2.5"/>
    <polyline points="${pPath}" fill="none" stroke="var(--blue)" stroke-width="2" stroke-dasharray="5,4"/>
    ${label(plot.sx(rpmNL * 0.15), plot.sy(Tstall * 0.85), 'Torque', { size: 10, color: 'var(--red)' })}
    ${label(plot.sx(rpmNL * 0.55), plot.sy(Tstall * 0.55), 'Power (scaled)', { size: 10, color: 'var(--blue)' })}
    ${label(plot.margin.left + plot.pw, plot.margin.top + plot.ph + 30, 'Speed (RPM)', { size: 10, anchor: 'end' })}
    ${label(plot.margin.left, plot.margin.top + 10, 'Torque (N·m)', { size: 10 })}
  `;
  document.getElementById('graph-svg-container').innerHTML = svgWrap(plot.W, plot.H, inner);
  document.getElementById('graph-result').innerHTML = `
    <div class="spec-row"><span class="spec-key">Stall Torque</span><span class="spec-val">${Tstall} N·m at 0 RPM</span></div>
    <div class="spec-row"><span class="spec-key">No-Load Speed</span><span class="spec-val">${rpmNL} RPM at 0 N·m</span></div>
    <div class="spec-row"><span class="spec-key">Peak Power</span><span class="spec-val">${Pmax.toFixed(1)} W at ${(rpmNL/2).toFixed(0)} RPM / ${(Tstall/2).toFixed(2)} N·m</span></div>
    <div class="formula-line">T(ω) = T_stall(1 − ω/ω_NL) &nbsp;|&nbsp; P = Tω, peaks at half stall torque &amp; half no-load speed (linear DC motor model)</div>
  `;
  setStatusResult(`Pmax ${Pmax.toFixed(0)} W`);
}

function drawFatigueCurve() {
  const matKeys = selectedMaterials('fatigue-material');
  const curves = matKeys.map((key, idx) => {
    const mat = materials[key];
    const Sut = mat.uts;
    const Se = Sut < 1400 ? 0.5 * Sut : 700;
    const S1000 = 0.9 * Sut;
    return { mat, Sut, Se, S1000, color: OVERLAY_COLORS[idx % OVERLAY_COLORS.length] };
  });
  const maxS1000 = Math.max(...curves.map(c => c.S1000));
  const minSe = Math.min(...curves.map(c => c.Se));

  const plot = makePlot([1e3, 1e8], [minSe * 0.5, maxS1000 * 1.15], { logX: true });
  const ticks = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8];
  const tickSvg = ticks.map(t => `
    <line x1="${plot.sx(t)}" y1="${plot.margin.top}" x2="${plot.sx(t)}" y2="${plot.margin.top + plot.ph}" stroke="var(--line)" stroke-width="1" opacity="0.4"/>
    <line x1="${plot.sx(t)}" y1="${plot.margin.top + plot.ph}" x2="${plot.sx(t)}" y2="${plot.margin.top + plot.ph + 4}" stroke="var(--ink)"/>
    ${label(plot.sx(t), plot.margin.top + plot.ph + 16, `10^${Math.log10(t)}`, { size: 9, anchor: 'middle' })}
  `).join('');
  const yTicks = niceTicks(minSe * 0.5, maxS1000 * 1.15, 5);
  const yTickSvg = yTicks.map(t => `
    <line x1="${plot.margin.left}" y1="${plot.sy(t).toFixed(1)}" x2="${plot.margin.left + plot.pw}" y2="${plot.sy(t).toFixed(1)}" stroke="var(--line)" stroke-width="1" opacity="0.4"/>
    ${label(plot.margin.left - 8, plot.sy(t) + 3, t.toFixed(0), { size: 8, anchor: 'end', color: 'var(--ink-dim)' })}
  `).join('');

  const curveSvg = curves.map(c => {
    const pts = [{ x: 1e3, y: c.S1000 }, { x: 1e6, y: c.Se }, { x: 1e8, y: c.Se }];
    const pathPts = pts.map(p => `${plot.sx(p.x).toFixed(1)},${plot.sy(p.y).toFixed(1)}`).join(' ');
    return `<polyline points="${pathPts}" fill="none" stroke="${c.color}" stroke-width="2.5"/>
      <circle cx="${plot.sx(1e6).toFixed(1)}" cy="${plot.sy(c.Se).toFixed(1)}" r="3.5" fill="${c.color}"/>`;
  }).join('');

  const inner = `
    ${plot.axes}
    ${tickSvg}${yTickSvg}
    ${curveSvg}
    ${label(plot.margin.left, plot.margin.top + 10, 'S (MPa)', { size: 10 })}
  `;
  document.getElementById('graph-svg-container').innerHTML = svgWrap(plot.W, plot.H, inner);

  const legend = curves.map(c => `<span><span class="legend-swatch" style="background:${c.color};"></span>${c.mat.name} — Se≈${c.Se.toFixed(0)} MPa</span>`).join('');
  document.getElementById('graph-result').innerHTML = `
    <div class="legend-row">${legend}</div>
    <div class="formula-line">Se ≈ 0.5·Sut (Sut&lt;1400 MPa, else 700 MPa cap) &nbsp;|&nbsp; S(10³)≈0.9·Sut — Shigley rule-of-thumb estimate, not test data.</div>
  `;
  setStatusResult(`${curves.length} material(s)`);
}

// ============================================================
// DIFFERENTIAL EQUATION SOLVERS
// ============================================================
function solveLinearODE2() {
  const a = parseFloat(document.getElementById('ode1-a').value);
  const b = parseFloat(document.getElementById('ode1-b').value);
  const c = parseFloat(document.getElementById('ode1-c').value);
  const y0 = parseFloat(document.getElementById('ode1-y0').value);
  const v0 = parseFloat(document.getElementById('ode1-v0').value);
  const tmax = parseFloat(document.getElementById('ode1-tmax').value);

  const disc = b * b - 4 * a * c;
  let y, formula, caseDesc;

  if (disc > 1e-9) {
    const r1 = (-b + Math.sqrt(disc)) / (2 * a);
    const r2 = (-b - Math.sqrt(disc)) / (2 * a);
    const C2 = (v0 - r1 * y0) / (r2 - r1);
    const C1 = y0 - C2;
    y = t => C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t);
    formula = `y(t) = ${C1.toFixed(3)}·e^(${r1.toFixed(3)}t) + ${C2.toFixed(3)}·e^(${r2.toFixed(3)}t)`;
    caseDesc = `Overdamped — real distinct roots r₁=${r1.toFixed(3)}, r₂=${r2.toFixed(3)}`;
  } else if (Math.abs(disc) <= 1e-9) {
    const r = -b / (2 * a);
    const C1 = y0, C2 = v0 - r * y0;
    y = t => (C1 + C2 * t) * Math.exp(r * t);
    formula = `y(t) = (${C1.toFixed(3)} + ${C2.toFixed(3)}t)·e^(${r.toFixed(3)}t)`;
    caseDesc = `Critically damped — repeated root r=${r.toFixed(3)}`;
  } else {
    const alpha = -b / (2 * a);
    const beta = Math.sqrt(-disc) / (2 * a);
    const C1 = y0, C2 = (v0 - alpha * y0) / beta;
    y = t => Math.exp(alpha * t) * (C1 * Math.cos(beta * t) + C2 * Math.sin(beta * t));
    formula = `y(t) = e^(${alpha.toFixed(3)}t)·[${C1.toFixed(3)}cos(${beta.toFixed(3)}t) + ${C2.toFixed(3)}sin(${beta.toFixed(3)}t)]`;
    caseDesc = `Underdamped — complex roots ${alpha.toFixed(3)} ± ${beta.toFixed(3)}i`;
  }

  const n = 100, pts = [];
  for (let i = 0; i <= n; i++) { const t = (tmax * i) / n; pts.push({ x: t, y: y(t) }); }
  const yVals = pts.map(p => p.y);
  const yMax = Math.max(...yVals, 0.01), yMin = Math.min(...yVals, -0.01);
  const pad = (yMax - yMin) * 0.15 || 1;
  const plot = makePlot([0, tmax], [yMin - pad, yMax + pad], { width: 680, height: 260 });
  const pathPts = pts.map(p => `${plot.sx(p.x).toFixed(1)},${plot.sy(p.y).toFixed(1)}`).join(' ');
  document.getElementById('ode1-svg-container').innerHTML = svgWrap(plot.W, plot.H, `
    ${plot.axes}
    <polyline points="${pathPts}" fill="none" stroke="var(--red)" stroke-width="2.5"/>
    ${label(plot.margin.left + plot.pw, plot.margin.top + plot.ph + 16, 't', { size: 10, anchor: 'end' })}
    ${label(plot.margin.left, plot.margin.top + 10, 'y(t)', { size: 10 })}
  `);
  document.getElementById('ode1-result').innerHTML = `
    <div class="spec-row"><span class="spec-key">Case</span><span class="spec-val">${caseDesc}</span></div>
    <div class="spec-row"><span class="spec-key">Solution</span><span class="spec-val">${formula}</span></div>
  `;
  setStatusResult(caseDesc.split(' — ')[0]);
  addToLog(`ODE2: ${caseDesc.split(' — ')[0]}`, `a=${a}, b=${b}, c=${c}`, '', '');
}

function evalExpr(expr, x, y) {
  const safe = expr.replace(/\^/g, '**');
  const fn = new Function('x', 'y', 'sin', 'cos', 'tan', 'exp', 'sqrt', 'log', 'abs', 'PI',
    `return ${safe};`);
  return fn(x, y, Math.sin, Math.cos, Math.tan, Math.exp, Math.sqrt, Math.log, Math.abs, Math.PI);
}

function solveODENumeric() {
  const fnStr = document.getElementById('ode2-fn').value;
  const x0 = parseFloat(document.getElementById('ode2-x0').value);
  const y0 = parseFloat(document.getElementById('ode2-y0').value);
  const xf = parseFloat(document.getElementById('ode2-xf').value);
  const steps = parseInt(document.getElementById('ode2-steps').value, 10);
  const h = (xf - x0) / steps;

  let x = x0, y = y0;
  const pts = [{ x, y }];
  try {
    for (let i = 0; i < steps; i++) {
      const f = (xx, yy) => evalExpr(fnStr, xx, yy);
      const k1 = f(x, y);
      const k2 = f(x + h / 2, y + (h / 2) * k1);
      const k3 = f(x + h / 2, y + (h / 2) * k2);
      const k4 = f(x + h, y + h * k3);
      y = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      x = x + h;
      pts.push({ x, y });
    }
  } catch (e) {
    document.getElementById('ode2-result').innerHTML = `<div class="spec-row"><span class="spec-key">Error</span><span class="spec-val" style="color:var(--red);">Could not parse f(x,y) — check syntax</span></div>`;
    return;
  }

  const yVals = pts.map(p => p.y);
  const yMax = Math.max(...yVals), yMin = Math.min(...yVals);
  const pad = (yMax - yMin) * 0.15 || 1;
  const plot = makePlot([x0, xf], [yMin - pad, yMax + pad], { width: 680, height: 260 });
  const pathPts = pts.map(p => `${plot.sx(p.x).toFixed(1)},${plot.sy(p.y).toFixed(1)}`).join(' ');
  document.getElementById('ode2-svg-container').innerHTML = svgWrap(plot.W, plot.H, `
    ${plot.axes}
    <polyline points="${pathPts}" fill="none" stroke="var(--blue)" stroke-width="2.5"/>
    ${label(plot.margin.left + plot.pw, plot.margin.top + plot.ph + 16, 'x', { size: 10, anchor: 'end' })}
    ${label(plot.margin.left, plot.margin.top + 10, 'y', { size: 10 })}
  `);
  document.getElementById('ode2-result').innerHTML = `
    <div class="spec-row"><span class="spec-key">y(x final)</span><span class="spec-val">${y.toFixed(5)}</span></div>
    <div class="spec-row"><span class="spec-key">Step size h</span><span class="spec-val">${h.toFixed(4)}</span></div>
    <div class="formula-line">4th-order Runge-Kutta — works for any f(x,y), linear or nonlinear.</div>
  `;
  setStatusResult(`y(${xf})=${y.toFixed(3)}`);
  addToLog('ODE (RK4)', fnStr, y.toFixed(4), `@ x=${xf}`);
}

// ============================================================
// STATICS — CENTROID & MOMENT OF INERTIA
// ============================================================
function onCentroidShapeChange(which) {
  const type = document.getElementById(`cen${which}-type`).value;
  document.getElementById(`cen${which}-rect`).style.display = type === 'rect' ? 'block' : 'none';
  document.getElementById(`cen${which}-circle`).style.display = type === 'circle' ? 'block' : 'none';
  calcCentroidMOI();
}

function shapeProps(prefix) {
  const type = document.getElementById(`${prefix}-type`).value;
  const y = parseFloat(document.getElementById(`${prefix}-y`).value);
  let A, Iown;
  if (type === 'rect') {
    const b = parseFloat(document.getElementById(`${prefix}-b`).value);
    const h = parseFloat(document.getElementById(`${prefix}-h`).value);
    A = b * h; Iown = (b * Math.pow(h, 3)) / 12;
  } else {
    const d = parseFloat(document.getElementById(`${prefix}-d`).value);
    const r = d / 2;
    A = Math.PI * r * r; Iown = (Math.PI * Math.pow(r, 4)) / 4;
  }
  return { A, Iown, y };
}

function calcCentroidMOI() {
  const a = shapeProps('cenA');
  const opB = document.getElementById('cenB-op').value;
  const shapes = [{ ...a, sign: 1 }];
  if (opB !== 'none') {
    const b = shapeProps('cenB');
    shapes.push({ ...b, sign: opB === 'subtract' ? -1 : 1 });
  }
  const totalA = shapes.reduce((s, sh) => s + sh.sign * sh.A, 0);
  const ybar = shapes.reduce((s, sh) => s + sh.sign * sh.A * sh.y, 0) / totalA;
  const Itotal = shapes.reduce((s, sh) => s + sh.sign * (sh.Iown + sh.A * Math.pow(sh.y - ybar, 2)), 0);

  document.getElementById('centroid-result').innerHTML = `
    <div class="eq-live">ȳ = ΣAᵢyᵢ/ΣAᵢ = <strong>${ybar.toFixed(3)} mm</strong></div>
    <div class="spec-row"><span class="spec-key">Total Area</span><span class="spec-val">${totalA.toFixed(1)} mm²</span></div>
    <div class="spec-row"><span class="spec-key">I about combined centroidal axis</span><span class="spec-val">${Itotal.toFixed(0)} mm⁴</span></div>
  `;
  setStatusResult(`I ${Itotal.toFixed(0)} mm⁴`);
  addToLog('Centroid & MOI', `Area=${totalA.toFixed(1)}mm²`, Itotal.toFixed(0), 'mm⁴');
}

// ============================================================
// DYNAMICS — PROJECTILE MOTION
// ============================================================
function calcProjectile() {
  const v0 = parseFloat(document.getElementById('proj-v0').value);
  const thetaDeg = parseFloat(document.getElementById('proj-theta').value);
  const y0 = parseFloat(document.getElementById('proj-y0').value);
  const g = parseFloat(document.getElementById('proj-g').value);
  const theta = (thetaDeg * Math.PI) / 180;
  const vx = v0 * Math.cos(theta), vy = v0 * Math.sin(theta);

  const disc = vy * vy + 2 * g * y0;
  const t = (vy + Math.sqrt(Math.max(disc, 0))) / g;
  const range = vx * t;
  const hmax = y0 + (vy * vy) / (2 * g);

  document.getElementById('proj-result').innerHTML = `
    <div class="eq-live">t = [v0sinθ + √((v0sinθ)² + 2gy0)]/g = <strong>${t.toFixed(3)} s</strong></div>
    <div class="spec-row"><span class="spec-key">Range</span><span class="spec-val">${range.toFixed(2)} m</span></div>
    <div class="spec-row"><span class="spec-key">Max Height</span><span class="spec-val">${hmax.toFixed(2)} m</span></div>
    <div class="spec-row"><span class="spec-key">vx, vy at launch</span><span class="spec-val">${vx.toFixed(2)}, ${vy.toFixed(2)} m/s</span></div>
  `;
  setStatusResult(`Range ${range.toFixed(1)} m`);
  addToLog('Projectile', `v0=${v0}m/s, θ=${thetaDeg}°`, range.toFixed(2), 'm range');
}

// ============================================================
// ENGINEERING ECONOMICS — TIME VALUE OF MONEY
// ============================================================
function onEconModeChange() {
  const mode = document.getElementById('econ-mode').value;
  const eqMap = {
    F_from_P: 'F = P(1+i)ⁿ', P_from_F: 'P = F/(1+i)ⁿ',
    F_from_A: 'F = A[((1+i)ⁿ−1)/i]', A_from_F: 'A = F[i/((1+i)ⁿ−1)]',
    P_from_A: 'P = A[((1+i)ⁿ−1)/(i(1+i)ⁿ)]', A_from_P: 'A = P[i(1+i)ⁿ/((1+i)ⁿ−1)]'
  };
  const labelMap = {
    F_from_P: 'Known Value P', P_from_F: 'Known Value F', F_from_A: 'Known Value A',
    A_from_F: 'Known Value F', P_from_A: 'Known Value A', A_from_P: 'Known Value P'
  };
  document.getElementById('econ-eq-display').textContent = eqMap[mode];
  document.getElementById('econ-known-label').textContent = labelMap[mode];
  calcEngEcon();
}

function calcEngEcon() {
  const mode = document.getElementById('econ-mode').value;
  const known = parseFloat(document.getElementById('econ-known').value);
  const i = parseFloat(document.getElementById('econ-i').value) / 100;
  const n = parseFloat(document.getElementById('econ-n').value);
  let result, formula, resultLabel;
  const c = Math.pow(1 + i, n);

  switch (mode) {
    case 'F_from_P':
      result = known * c;
      formula = `F = P(1+i)ⁿ = ${known}×${c.toFixed(4)} = <strong>$${result.toFixed(2)}</strong>`;
      resultLabel = 'Future Value F'; break;
    case 'P_from_F':
      result = known / c;
      formula = `P = F/(1+i)ⁿ = ${known}/${c.toFixed(4)} = <strong>$${result.toFixed(2)}</strong>`;
      resultLabel = 'Present Value P'; break;
    case 'F_from_A':
      result = known * ((c - 1) / i);
      formula = `F = A[((1+i)ⁿ−1)/i] = <strong>$${result.toFixed(2)}</strong>`;
      resultLabel = 'Future Value F'; break;
    case 'A_from_F':
      result = known * (i / (c - 1));
      formula = `A = F[i/((1+i)ⁿ−1)] = <strong>$${result.toFixed(2)}</strong>`;
      resultLabel = 'Annuity A'; break;
    case 'P_from_A':
      result = known * ((c - 1) / (i * c));
      formula = `P = A[((1+i)ⁿ−1)/(i(1+i)ⁿ)] = <strong>$${result.toFixed(2)}</strong>`;
      resultLabel = 'Present Value P'; break;
    case 'A_from_P':
      result = known * ((i * c) / (c - 1));
      formula = `A = P[i(1+i)ⁿ/((1+i)ⁿ−1)] = <strong>$${result.toFixed(2)}</strong>`;
      resultLabel = 'Annuity A'; break;
  }

  document.getElementById('econ-result').innerHTML = `
    <div class="eq-live">${formula}</div>
    <div class="spec-row"><span class="spec-key">${resultLabel}</span><span class="spec-val">$${result.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
  `;
  setStatusResult(`${resultLabel.split(' ')[0]} $${result.toFixed(0)}`);
  addToLog('Eng Econ', `${mode}, i=${i}, n=${n}`, '$'+result.toFixed(2), '');
}

// ============================================================
// GLOBAL REFERENCE FLATTENER
// ============================================================
function initializeReferenceSearch() {
  const searchInput = document.getElementById('global-ref-search');
  const appScreen = document.getElementById('app-screen');
  
  if (!searchInput || !appScreen) return;

  searchInput.addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase().trim();
    // Select all the major structural blocks across all tabs
    const searchableBlocks = appScreen.querySelectorAll('.login-box, .cheat-section');

    if (term.length === 0) {
      appScreen.classList.remove('is-searching');
      // Restore cheat table rows
      document.querySelectorAll('.cheat-table tr').forEach(r => r.style.display = '');
      searchableBlocks.forEach(b => b.classList.remove('search-match'));
      return;
    }

    appScreen.classList.add('is-searching');

    searchableBlocks.forEach(block => {
      let blockMatches = false;

      // Handle Reference Tables
      if (block.classList.contains('cheat-section') || block.querySelector('.cheat-table')) {
        const rows = block.querySelectorAll('tbody tr, tr:not(:first-child)');
        const titleMatch = block.querySelector('.cheat-section-title, .login-header-title')?.textContent.toLowerCase().includes(term);
        
        rows.forEach(row => {
          if(row.querySelector('th')) return;
          const text = row.textContent.toLowerCase();
          // If title matches, show all rows, else filter rows
          if (titleMatch || text.includes(term)) {
            row.style.display = '';
            blockMatches = true;
          } else {
            row.style.display = 'none';
          }
        });

        // Catch for purely textual cheat sections with no table
        if (rows.length === 0 && block.textContent.toLowerCase().includes(term)) {
          blockMatches = true;
        }
      } 
      // Handle Calculation Modules (login-boxes without tables)
      else {
        // Just checking inner text captures titles, labels, equations (.eq-display), and formulas
        if (block.textContent.toLowerCase().includes(term)) {
          blockMatches = true;
        }
      }

      if (blockMatches) {
        block.classList.add('search-match');
      } else {
        block.classList.remove('search-match');
      }
    });
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  renderMaterialTable();
  populateMaterialDropdowns();
  onBeamTypeChange();
  onSectionChange();
  onPTModeChange();
  onGraphTypeChange();
  onCentroidShapeChange('A');
  onCentroidShapeChange('B');
  onEconModeChange();
  calcProjectile();
  initializeReferenceSearch();
});