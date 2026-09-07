// Material database pulling from your reference sheet
const materials = {
  steel_a36: {
    name: "Structural Steel (A36)",
    density: 7.85, // g/cm^3
    youngs_modulus: 200, // GPa
    yield_strength: 250, // MPa
    uts: 400, // MPa
    poisson: 0.30
  },
  al_6061: {
    name: "Aluminum (6061-T6)",
    density: 2.70,
    youngs_modulus: 69,
    yield_strength: 275,
    uts: 310,
    poisson: 0.33
  },
  ti_6al: {
    name: "Titanium (Ti-6Al-4V)",
    density: 4.43,
    youngs_modulus: 114,
    yield_strength: 880,
    uts: 950,
    poisson: 0.34
  },
  delrin: {
    name: "Delrin/Acetal",
    density: 1.42,
    youngs_modulus: 3.1,
    yield_strength: 65,
    uts: 70,
    poisson: 0.35
  }
};

function updateMaterial() {
  const key = document.getElementById('material-select').value;
  const mat = materials[key];
  
  // Display material properties sourced from the one-sheeter
  document.getElementById('material-specs').innerHTML = `
    <strong>Young's Modulus (E):</strong> ${mat.youngs_modulus} GPa<br>
    <strong>Yield Strength:</strong> ${mat.yield_strength} MPa<br>
    <strong>Ultimate Tensile Strength:</strong> ${mat.uts} MPa<br>
    <strong>Density:</strong> ${mat.density} g/cm³<br>
    <strong>Poisson's Ratio:</strong> ${mat.poisson}
  `;
}

function calculateBeam() {
  const type = document.getElementById('beam-type').value;
  let formula = "";
  
  // Formulas sourced directly from the provided reference sheet
  if (type === "cantilever_point") {
    formula = "Max Deflection (y) = PL³ / 3EI"; 
  } else if (type === "simply_uniform") {
    formula = "Max Deflection (y) = 5wL⁴ / 384EI";
  }
  
  document.getElementById('beam-result').innerHTML = `Formula: ${formula}`;
}

// Initialize default view
document.addEventListener('DOMContentLoaded', updateMaterial);