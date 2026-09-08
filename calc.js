// ============================================================
// MATERIAL DATABASE
// ============================================================
const materials = {
  steel_a36: { name: "Structural Steel (A36)", density: 7.85, youngs_modulus: 200, shear_modulus: 79.3, yield_strength: 250, uts: 400, poisson: 0.30 },
  steel_4140: { name: "Alloy Steel (4140, Q&T)", density: 7.85, youngs_modulus: 205, shear_modulus: 80.0, yield_strength: 655, uts: 1020, poisson: 0.29 },
  al_6061: { name: "Aluminum (6061-T6)", density: 2.70, youngs_modulus: 69, shear_modulus: 26.0, yield_strength: 275, uts: 310, poisson: 0.33 },
  al_7075: { name: "Aluminum (7075-T6)", density: 2.81, youngs_modulus: 71.7, shear_modulus: 26.9, yield_strength: 503, uts: 572, poisson: 0.33 },
  ti_6al: { name: "Titanium (Ti-6Al-4V)", density: 4.43, youngs_modulus: 114, shear_modulus: 44.0, yield_strength: 880, uts: 950, poisson: 0.34 },
  brass_360: { name: "Brass (C360)", density: 8.50, youngs_modulus: 97, shear_modulus: 37.0, yield_strength: 310, uts: 400, poisson: 0.34 },
  cast_iron: { name: "Gray Cast Iron", density: 7.15, youngs_modulus: 110, shear_modulus: 44.0, yield_strength: 150, uts: 250, poisson: 0.28 },
  delrin: { name: "Delrin/Acetal", density: 1.42, youngs_modulus: 3.1, shear_modulus: 1.10, yield_strength: 65, uts: 70, poisson: 0.35 },
  abs: { name: "ABS Plastic", density: 1.05, youngs_modulus: 2.3, shear_modulus: 0.80, yield_strength: 40, uts: 43, poisson: 0.35 },
  carbon_fiber: { name: "Carbon Fiber (UD, 0°)", density: 1.60, youngs_modulus: 135, shear_modulus: 5.0, yield_strength: 1500, uts: 1700, poisson: 0.30 },
  wood_pine: { name: "Douglas Fir (along grain)", density: 0.53, youngs_modulus: 13.1, shear_modulus: 0.85, yield_strength: 40, uts: 50, poisson: 0.30 }
};

function updateMaterial() {
  const key = document.getElementById('material-select').value;
  const mat = materials[key];
  document.getElementById('material-specs').innerHTML = `
    <strong>Young's Modulus (E):</strong> ${mat.youngs_modulus} GPa<br>
    <strong>Shear Modulus (G):</strong> ${mat.shear_modulus} GPa<br>
    <strong>Yield Strength:</strong> ${mat.yield_strength} MPa<br>
    <strong>Ultimate Tensile Strength:</strong> ${mat.uts} MPa<br>
    <strong>Density:</strong> ${mat.density} g/cm³<br>
    <strong>Poisson's Ratio:</strong> ${mat.poisson}
  `;
  populateMaterialDropdowns();
}

function populateMaterialDropdowns() {
  document.querySelectorAll('.material-dropdown').forEach(sel => {
    if (sel.dataset.filled) return;
    sel.innerHTML = Object.keys(materials).map(k => `<option value="${k}">${materials[k].name}</option>`).join('');
    sel.dataset.filled = "1";
  });
}

// ============================================================
// BEAM MECHANICS ENGINE
// ============================================================
// Units: length mm, force N, E in MPa (converted from GPa), I in mm^4
// deflection in mm, stress in MPa, moment in N*mm

function sectionProps(shape, dims) {
  // returns {I, c} in mm^4 / mm
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

// Each beam case returns arrays of x, y (deflection, mm, positive = downward),
// and a function M(x) for bending moment (N*mm), plus max values & the formula string.
const beamCases = {
  cantilever_point: {
    label: "Cantilever — Point Load at Free End",
    diagram: "fixed_free",
    formula: "y(x) = Px²(3L − x) / 6EI    |    y_max = PL³ / 3EI    |    M_max = PL (at wall)",
    compute(L, E, I, P) {
      const y = x => (P * x * x * (3 * L - x)) / (6 * E * I);
      const M = x => P * (L - x);
      return { y, M, yMax: (P * L ** 3) / (3 * E * I), Mmax: P * L, loadDesc: `Point load ${P} N at free end` };
    }
  },
  cantilever_udl: {
    label: "Cantilever — Uniformly Distributed Load",
    diagram: "fixed_free",
    formula: "y(x) = w x²(x² − 4Lx + 6L²) / 24EI    |    y_max = wL⁴ / 8EI    |    M_max = wL²/2 (at wall)",
    compute(L, E, I, w) {
      const y = x => (w * x * x * (x * x - 4 * L * x + 6 * L * L)) / (24 * E * I);
      const M = x => (w * Math.pow(L - x, 2)) / 2;
      return { y, M, yMax: (w * L ** 4) / (8 * E * I), Mmax: (w * L * L) / 2, loadDesc: `UDL ${w} N/mm over full span` };
    }
  },
  ss_point_center: {
    label: "Simply Supported — Point Load at Center",
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
    label: "Simply Supported — Point Load at Position a",
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
    label: "Simply Supported — Uniformly Distributed Load",
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
  const E = mat.youngs_modulus * 1000; // GPa -> MPa

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

  const N = 60;
  const xs = [], ys = [], Ms = [];
  for (let i = 0; i <= N; i++) {
    const x = (L * i) / N;
    xs.push(x);
    ys.push(result.y(x));
    Ms.push(result.M(x));
  }
  const yMax = result.yMax !== null ? result.yMax : Math.max(...ys.map(Math.abs));
  const Mmax = result.Mmax;
  const sigmaMax = (Mmax * c) / I; // MPa
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
  const exaggeration = 60 / maxDisplay; // px per mm at max
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

  const svg = `
  <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:auto; font-family:'IBM Plex Mono',monospace;">
    <line x1="${xMargin}" y1="${baseY}" x2="${W - xMargin}" y2="${baseY}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="4,3" opacity="0.4"/>
    ${supports}
    ${loadArrows}
    <polyline points="${pathPts}" fill="none" stroke="var(--red)" stroke-width="2.5"/>
    <text x="${xMargin}" y="${H - 15}" font-size="11" fill="var(--ink)">0</text>
    <text x="${W - xMargin - 30}" y="${H - 15}" font-size="11" fill="var(--ink)">L = ${L} mm</text>
    <text x="${W/2 - 60}" y="${H - 15}" font-size="11" fill="var(--red)">deflection ×${exaggeration.toFixed(0)} (exaggerated)</text>
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
    `<div class="spec-row"><span class="spec-key">Stress σ</span><span class="spec-val">${sigma.toFixed(2)} MPa</span></div>
     <div class="spec-row"><span class="spec-key">Factor of Safety</span><span class="spec-val">${fos.toFixed(2)}</span></div>`;
  setStatusResult(`σ ${sigma.toFixed(1)} MPa`);
}

function calcTorsion() {
  const T = parseFloat(document.getElementById('torsion-T').value); // N*mm
  const d = parseFloat(document.getElementById('torsion-d').value); // mm
  const Lg = parseFloat(document.getElementById('torsion-L').value); // mm
  const matKey = document.getElementById('torsion-material').value;
  const mat = materials[matKey];
  const G = mat.shear_modulus * 1000; // MPa
  const J = (Math.PI * Math.pow(d, 4)) / 32;
  const tau = (T * (d / 2)) / J;
  const theta = (T * Lg) / (G * J); // radians
  document.getElementById('torsion-result').innerHTML =
    `<div class="spec-row"><span class="spec-key">Shear Stress τ</span><span class="spec-val">${tau.toFixed(2)} MPa</span></div>
     <div class="spec-row"><span class="spec-key">Angle of Twist</span><span class="spec-val">${(theta * 180 / Math.PI).toFixed(3)}° over ${Lg} mm</span></div>`;
  setStatusResult(`τ ${tau.toFixed(1)} MPa`);
}

function calcBuckling() {
  const E = parseFloat(document.getElementById('buckle-material').value ? materials[document.getElementById('buckle-material').value].youngs_modulus * 1000 : 0);
  const I = parseFloat(document.getElementById('buckle-I').value);
  const Lg = parseFloat(document.getElementById('buckle-L').value);
  const K = parseFloat(document.getElementById('buckle-K').value);
  const Pcr = (Math.PI ** 2 * E * I) / Math.pow(K * Lg, 2);
  document.getElementById('buckle-result').innerHTML =
    `<div class="spec-row"><span class="spec-key">Critical Load</span><span class="spec-val">${Pcr.toFixed(1)} N (${(Pcr/1000).toFixed(2)} kN)</span></div>`;
  setStatusResult(`P_cr ${(Pcr/1000).toFixed(2)} kN`);
}

function calcSpring() {
  const matKey = document.getElementById('spring-material').value;
  const G = materials[matKey].shear_modulus * 1000; // MPa
  const d = parseFloat(document.getElementById('spring-d').value);
  const D = parseFloat(document.getElementById('spring-D').value);
  const n = parseFloat(document.getElementById('spring-n').value);
  const k = (G * Math.pow(d, 4)) / (8 * Math.pow(D, 3) * n);
  document.getElementById('spring-result').innerHTML =
    `<div class="spec-row"><span class="spec-key">Spring Rate k</span><span class="spec-val">${k.toFixed(2)} N/mm</span></div>`;
  setStatusResult(`k ${k.toFixed(2)} N/mm`);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  updateMaterial();
  populateMaterialDropdowns();
  onBeamTypeChange();
  onSectionChange();
});