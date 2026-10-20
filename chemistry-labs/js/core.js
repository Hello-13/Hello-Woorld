'use strict';
/* Chem Bench core: element data, chemistry helpers, formatting, practice engine, router. */

/* ---------- Element data (symbol, name, standard atomic mass) ---------- */
const ELEMENT_DATA = 'H,Hydrogen,1.008 He,Helium,4.003 Li,Lithium,6.94 Be,Beryllium,9.012 B,Boron,10.81 C,Carbon,12.011 N,Nitrogen,14.007 O,Oxygen,15.999 F,Fluorine,18.998 Ne,Neon,20.180 Na,Sodium,22.990 Mg,Magnesium,24.305 Al,Aluminum,26.982 Si,Silicon,28.086 P,Phosphorus,30.974 S,Sulfur,32.06 Cl,Chlorine,35.45 Ar,Argon,39.948 K,Potassium,39.098 Ca,Calcium,40.078 Sc,Scandium,44.956 Ti,Titanium,47.867 V,Vanadium,50.942 Cr,Chromium,51.996 Mn,Manganese,54.938 Fe,Iron,55.845 Co,Cobalt,58.933 Ni,Nickel,58.693 Cu,Copper,63.546 Zn,Zinc,65.38 Ga,Gallium,69.723 Ge,Germanium,72.630 As,Arsenic,74.922 Se,Selenium,78.971 Br,Bromine,79.904 Kr,Krypton,83.798 Rb,Rubidium,85.468 Sr,Strontium,87.62 Y,Yttrium,88.906 Zr,Zirconium,91.224 Nb,Niobium,92.906 Mo,Molybdenum,95.95 Tc,Technetium,98 Ru,Ruthenium,101.07 Rh,Rhodium,102.91 Pd,Palladium,106.42 Ag,Silver,107.87 Cd,Cadmium,112.41 In,Indium,114.82 Sn,Tin,118.71 Sb,Antimony,121.76 Te,Tellurium,127.60 I,Iodine,126.90 Xe,Xenon,131.29 Cs,Cesium,132.91 Ba,Barium,137.33 La,Lanthanum,138.91 Ce,Cerium,140.12 Pr,Praseodymium,140.91 Nd,Neodymium,144.24 Pm,Promethium,145 Sm,Samarium,150.36 Eu,Europium,151.96 Gd,Gadolinium,157.25 Tb,Terbium,158.93 Dy,Dysprosium,162.50 Ho,Holmium,164.93 Er,Erbium,167.26 Tm,Thulium,168.93 Yb,Ytterbium,173.05 Lu,Lutetium,174.97 Hf,Hafnium,178.49 Ta,Tantalum,180.95 W,Tungsten,183.84 Re,Rhenium,186.21 Os,Osmium,190.23 Ir,Iridium,192.22 Pt,Platinum,195.08 Au,Gold,196.97 Hg,Mercury,200.59 Tl,Thallium,204.38 Pb,Lead,207.2 Bi,Bismuth,208.98 Po,Polonium,209 At,Astatine,210 Rn,Radon,222 Fr,Francium,223 Ra,Radium,226 Ac,Actinium,227 Th,Thorium,232.04 Pa,Protactinium,231.04 U,Uranium,238.03 Np,Neptunium,237 Pu,Plutonium,244 Am,Americium,243 Cm,Curium,247 Bk,Berkelium,247 Cf,Californium,251 Es,Einsteinium,252 Fm,Fermium,257 Md,Mendelevium,258 No,Nobelium,259 Lr,Lawrencium,266 Rf,Rutherfordium,267 Db,Dubnium,268 Sg,Seaborgium,269 Bh,Bohrium,270 Hs,Hassium,277 Mt,Meitnerium,278 Ds,Darmstadtium,281 Rg,Roentgenium,282 Cn,Copernicium,285 Nh,Nihonium,286 Fl,Flerovium,289 Mc,Moscovium,290 Lv,Livermorium,293 Ts,Tennessine,294 Og,Oganesson,294';

const EL = {}, ELZ = [null];
ELEMENT_DATA.split(' ').forEach((t, i) => {
  const [sym, name, m] = t.split(',');
  const e = { sym, name, Z: i + 1, mass: +m };
  EL[sym] = e; ELZ.push(e);
});

/* Pauling electronegativity, first ionization energy (kJ/mol), atomic radius (pm) for main-group elements */
const EN = { H: 2.20, Li: 0.98, Be: 1.57, B: 2.04, C: 2.55, N: 3.04, O: 3.44, F: 3.98, Na: 0.93, Mg: 1.31, Al: 1.61, Si: 1.90, P: 2.19, S: 2.58, Cl: 3.16, K: 0.82, Ca: 1.00, Ga: 1.81, Ge: 2.01, As: 2.18, Se: 2.55, Br: 2.96, Rb: 0.82, Sr: 0.95, In: 1.78, Sn: 1.96, Sb: 2.05, Te: 2.1, I: 2.66, Cs: 0.79, Ba: 0.89, Fe: 1.83, Cu: 1.90, Zn: 1.65, Ag: 1.93, Xe: 2.6 };
const IE = { H: 1312, He: 2372, Li: 520, Be: 899, B: 801, C: 1086, N: 1402, O: 1314, F: 1681, Ne: 2081, Na: 496, Mg: 738, Al: 578, Si: 786, P: 1012, S: 1000, Cl: 1251, Ar: 1521, K: 419, Ca: 590, Ga: 579, Ge: 762, As: 947, Se: 941, Br: 1140, Kr: 1351, Rb: 403, Sr: 550, I: 1008, Xe: 1170, Cs: 376, Ba: 503 };
const RADIUS = { Li: 152, Be: 112, B: 85, C: 77, N: 75, O: 73, F: 72, Na: 186, Mg: 160, Al: 143, Si: 118, P: 110, S: 103, Cl: 99, K: 227, Ca: 197, Ga: 135, Ge: 122, As: 120, Se: 119, Br: 114, Rb: 248, Sr: 215, I: 133, Cs: 265, Ba: 222 };

const NA = 6.022e23, R_GAS = 0.08206;

/* ---------- Small utilities ---------- */
const U = {
  ri: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  rnd: (a, b) => a + Math.random() * (b - a),
  pick: a => a[Math.floor(Math.random() * a.length)],
  shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  /* random value with exactly n significant figures, returned as a number */
  sf: (lo, hi, n = 3) => Number(U.rnd(lo, hi).toPrecision(n)),
  gcd: (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; },
  lcm: (a, b) => Math.abs(a * b) / U.gcd(a, b),
  clamp: (x, a, b) => Math.min(b, Math.max(a, x)),
  esc: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
};

/* Format a number to n sig figs as HTML (scientific notation when very large/small) */
function fmt(x, n = 3) {
  if (x === null || x === undefined || !isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  let s = x.toPrecision(n);
  if (a < 1e-3 || a >= 1e6 || s.includes('e')) {
    const [m, e] = x.toExponential(n - 1).split('e');
    return `${m.replace('-', '−')} × 10<sup>${(+e).toString().replace('-', '−')}</sup>`;
  }
  return s.replace('-', '−');
}
/* Plain text version (for input values) */
function fmtP(x, n = 4) {
  if (!isFinite(x)) return '';
  const a = Math.abs(x);
  if (x !== 0 && (a < 1e-3 || a >= 1e6)) return x.toExponential(n - 1);
  return String(Number(x.toPrecision(n)));
}
/* Parse numbers like 6.02e23, 6.02 x 10^23, 6.02×10^23, 1,250 */
function parseNum(s) {
  if (s === null || s === undefined) return null;
  s = String(s).trim().replace(/,/g, '').replace(/[−–]/g, '-').replace(/\s+/g, '');
  s = s.replace(/[x×*·]10\^?\(?([+-]?\d+)\)?/i, 'e$1').replace(/^10\^([+-]?\d+)$/, '1e$1');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  return Number(s);
}

/* Chemical formula → HTML with subscripts and charge superscript.  "SO4^2-", "Ca(OH)2", "CuSO4·5H2O", "Na+" */
function fmtF(s) {
  s = String(s);
  let charge = '';
  const cm = s.match(/\^(\d*[+-])$/);
  if (cm) { charge = cm[1]; s = s.slice(0, cm.index); }
  else if (/[+-]$/.test(s)) { charge = s.slice(-1); s = s.slice(0, -1); }
  let out = '', subOK = false;
  for (const ch of s) {
    if (/\d/.test(ch) && subOK) out += `<sub>${ch}</sub>`;
    else out += ch;
    subOK = /[A-Za-z)\]]/.test(ch) || (/\d/.test(ch) && subOK);
  }
  out = out.replace(/<\/sub><sub>/g, '');
  if (charge) out += `<sup>${charge.replace('-', '−')}</sup>`;
  return out;
}
/* Equation HTML from species arrays and optional coefficients */
function fmtEq(re, pr, co, arrow = '→') {
  const side = (arr, off) => arr.map((f, i) => { const c = co ? co[i + off] : 1; return `${c && c !== 1 ? c + ' ' : ''}${fmtF(f)}`; }).join(' + ');
  return `${side(re, 0)} ${arrow} ${side(pr, re.length)}`;
}

/* ---------- Chemistry helpers ---------- */
const Chem = {
  parseFormula(str) {
    let s = String(str).trim().replace(/[−–]/g, '-');
    let charge = 0;
    const m = s.match(/(?:\^|\s)(\d*)([+-])$/);
    if (m) { charge = (m[1] ? +m[1] : 1) * (m[2] === '+' ? 1 : -1); s = s.slice(0, m.index); }
    else if (/[+-]$/.test(s)) { charge = s.endsWith('+') ? 1 : -1; s = s.slice(0, -1); }
    s = s.replace(/\s+/g, '').replace(/[·•*]/g, '.');
    if (!s) throw new Error('Type a formula, like H2O or Ca(OH)2.');
    const counts = {};
    for (let part of s.split('.')) {
      const k = part.match(/^\d+/); let mult = 1;
      if (k) { mult = +k[0]; part = part.slice(k[0].length); }
      const [c, j] = Chem._group(part, 0);
      if (j !== part.length) throw new Error(`Unmatched ")" in ${str}`);
      for (const e in c) counts[e] = (counts[e] || 0) + c[e] * mult;
    }
    return { counts, charge };
  },
  _group(s, i) {
    const counts = {};
    const num = () => { let n = ''; while (i < s.length && /\d/.test(s[i])) n += s[i++]; return n ? +n : 1; };
    while (i < s.length) {
      const c = s[i];
      if (c === '(' || c === '[') {
        const [inner, j] = Chem._group(s, i + 1);
        if (s[j] !== ')' && s[j] !== ']') throw new Error('Missing ")".');
        i = j + 1; const n = num();
        for (const e in inner) counts[e] = (counts[e] || 0) + inner[e] * n;
      } else if (c === ')' || c === ']') {
        return [counts, i];
      } else if (/[A-Z]/.test(c)) {
        let sym = c; i++;
        if (i < s.length && /[a-z]/.test(s[i])) { sym += s[i]; i++; }
        if (!EL[sym]) throw new Error(`"${sym}" isn't an element symbol. Check capitals: Co is cobalt, CO is carbon + oxygen.`);
        const n = num();
        counts[sym] = (counts[sym] || 0) + n;
      } else throw new Error(`Unexpected "${c}". Use element symbols, numbers and parentheses.`);
    }
    return [counts, i];
  },
  molarMass(f) { const c = typeof f === 'string' ? Chem.parseFormula(f).counts : f; let m = 0; for (const e in c) m += EL[e].mass * c[e]; return m; },
  sameCounts(a, b) { const k = new Set([...Object.keys(a), ...Object.keys(b)]); for (const e of k) if ((a[e] || 0) !== (b[e] || 0)) return false; return true; },
  period(Z) { const b = [2, 10, 18, 36, 54, 86, 118]; return b.findIndex(x => Z <= x) + 1; },
  group(Z) {
    const p = Chem.period(Z), starts = [0, 1, 3, 11, 19, 37, 55, 87], pos = Z - starts[p] + 1;
    if (p === 1) return Z === 1 ? 1 : 18;
    if (p <= 3) return pos <= 2 ? pos : pos + 10;
    if (p <= 5) return pos;
    if (pos <= 2) return pos;
    if (pos <= 17) return pos === 3 ? 3 : null; // lanthanides/actinides
    return pos - 14;
  },
  isMetal(sym) { const nonmetals = ['H', 'He', 'C', 'N', 'O', 'F', 'Ne', 'P', 'S', 'Cl', 'Ar', 'Se', 'Br', 'Kr', 'I', 'Xe', 'Rn', 'B', 'Si', 'Ge', 'As', 'Sb', 'Te', 'At']; return !nonmetals.includes(sym); },
  ORDER: ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p', '6s', '4f', '5d', '6p', '7s', '5f', '6d', '7p'],
  CAP: { s: 2, p: 6, d: 10, f: 14 },
  EXC: { 24: { '4s': 1, '3d': 5 }, 29: { '4s': 1, '3d': 10 }, 42: { '5s': 1, '4d': 5 }, 46: { '5s': 0, '4d': 10 }, 47: { '5s': 1, '4d': 10 }, 78: { '6s': 1, '5d': 9 }, 79: { '6s': 1, '5d': 10 } },
  config(Z) {
    let left = Z; const out = [];
    for (const o of Chem.ORDER) { if (left <= 0) break; const n = Math.min(Chem.CAP[o[1]], left); out.push([o, n]); left -= n; }
    const ex = Chem.EXC[Z];
    if (ex) { for (const o in ex) { const r = out.find(x => x[0] === o); if (r) r[1] = ex[o]; else out.push([o, ex[o]]); } }
    return out.filter(x => x[1] > 0);
  },
  configText(cfg) { return cfg.map(([o, n]) => o + n).join(' '); },
  configHTML(cfg) { return cfg.map(([o, n]) => `${o}<sup>${n}</sup>`).join(' '); },
  nobleCore(Z) { return [86, 54, 36, 18, 10, 2].find(n => n < Z) || 0; },
  shortHTML(Z) {
    const ng = Chem.nobleCore(Z); if (!ng) return Chem.configHTML(Chem.config(Z));
    const rest = Chem.config(Z).slice(Chem.config(ng).length);
    return `[${ELZ[ng].sym}] ${Chem.configHTML(rest)}`;
  },
  valence(Z) {
    const cfg = Chem.config(Z); const maxN = Math.max(...cfg.map(([o]) => +o[0]));
    return cfg.filter(([o]) => +o[0] === maxN).reduce((s, [, n]) => s + n, 0);
  },
  unpaired(Z) { return Chem.config(Z).reduce((s, [o, e]) => { const orbs = Chem.CAP[o[1]] / 2; return s + (e <= orbs ? e : 2 * orbs - e); }, 0); },
  /* Parse "1s2 2s2 2p6" or "[Ne] 3s1" (spaces required) into {orbital: count} */
  parseConfig(str) {
    const sup = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
    let s = String(str).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, c => sup[c]).replace(/\^/g, '').trim();
    const map = {};
    const core = s.match(/^\[([A-Za-z]{1,2})\]/);
    if (core) {
      const e = EL[core[1][0].toUpperCase() + core[1].slice(1).toLowerCase()];
      if (!e || ![2, 10, 18, 36, 54, 86].includes(e.Z)) return null;
      Chem.config(e.Z).forEach(([o, n]) => map[o] = n);
      s = s.slice(core[0].length).trim();
    }
    if (s) for (const tok of s.split(/\s+/)) {
      const m = tok.match(/^([1-7])([spdf])(\d{1,2})$/i);
      if (!m) return null;
      const o = m[1] + m[2].toLowerCase();
      map[o] = (map[o] || 0) + +m[3];
    }
    return map;
  },
  /* Oxidation numbers by the textbook rules. Returns {states:{El:value}, why:{El:text}} */
  oxidation(str) {
    const { counts, charge } = Chem.parseFormula(str);
    const els = Object.keys(counts);
    const states = {}, why = {};
    if (els.length === 1) {
      const e = els[0];
      states[e] = charge / counts[e];
      why[e] = charge === 0 ? 'Free element: always 0.' : (counts[e] === 1 ? 'Monatomic ion: equals the ion charge.' : 'Only one element, so the charge is shared equally.');
      return { states, why, charge, counts };
    }
    const binary = els.length === 2;
    const metalHydride = els.includes('H') && els.every(e => e === 'H' || Chem.isMetal(e));
    const rules = [
      [e => Chem.group(EL[e].Z) === 1 && e !== 'H', 1, 'Group 1 metals are +1 in compounds.'],
      [e => Chem.group(EL[e].Z) === 2, 2, 'Group 2 metals are +2 in compounds.'],
      [e => e === 'F', -1, 'Fluorine is always −1 in compounds.'],
      [e => e === 'H' && !metalHydride, 1, 'Hydrogen is +1 when bonded to nonmetals.'],
      [e => e === 'H' && metalHydride, -1, 'Hydrogen is −1 when bonded to metals.'],
      [e => e === 'O', -2, 'Oxygen is usually −2.'],
      [e => binary && ['Cl', 'Br', 'I'].includes(e), -1, 'Group 17 is −1 in binary compounds.'],
      [e => binary && ['S', 'Se', 'Te'].includes(e), -2, 'Group 16 is −2 in binary compounds.'],
      [e => binary && ['N', 'P', 'As'].includes(e), -3, 'Group 15 is −3 in binary compounds.'],
    ];
    let unknown = els.slice();
    for (const [test, val, text] of rules) {
      if (unknown.length <= 1) break;
      for (const e of unknown.slice()) {
        if (unknown.length <= 1) break;
        if (test(e)) { states[e] = val; why[e] = text; unknown = unknown.filter(x => x !== e); }
      }
    }
    if (unknown.length === 1) {
      const e = unknown[0];
      let sum = 0; for (const k in states) sum += states[k] * counts[k];
      states[e] = (charge - sum) / counts[e];
      why[e] = `Solved last: all oxidation numbers must add up to the overall charge (${charge >= 0 ? charge : '−' + -charge}).`;
    } else unknown.forEach(e => { states[e] = NaN; why[e] = 'Not enough rules to decide.'; });
    return { states, why, charge, counts };
  },
  isotope(sym, A) { return `<span class="nuc"><span class="az"><sup>${A}</sup><sub>${EL[sym] ? EL[sym].Z : ''}</sub></span>${sym}</span>`; },
};

/* Readable signed numbers */
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
const chargeStr = (n) => n === 0 ? '' : (Math.abs(n) === 1 ? '' : Math.abs(n)) + (n > 0 ? '+' : '−');
/* Fractions like 8/3 for oxidation states */
function fracStr(x) {
  if (Number.isInteger(x)) return signed(x);
  for (let d = 2; d <= 8; d++) { const n = Math.round(x * d); if (Math.abs(n / d - x) < 1e-9) return (n < 0 ? '−' : '+') + Math.abs(n) + '/' + d; }
  return x.toFixed(2);
}

/* ---------- Answer normalisation ---------- */
function normText(s) {
  return String(s).toLowerCase().replace(/[−–]/g, '-').replace(/\s+/g, ' ').replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')').trim();
}
/* Canonical "body|charge" readings of a typed formula. "CO32-" is ambiguous, so it yields both readings. */
function formulaReadings(s) {
  const map = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', '−': '-', '–': '-', '•': '.', '·': '.', '*': '.' };
  let t = String(s).replace(/[₀-₉⁰-⁹¹²³⁺⁻−–•·*]/g, c => map[c] || c).trim();
  if (!t) return [];
  const out = [];
  let m;
  if ((m = t.match(/(?:\^|\s+)(\d*)\s*([+-])$/))) out.push(t.slice(0, m.index) + '|' + (m[1] || 1) + m[2]);
  else if ((m = t.match(/(?:\^|\s+)?([+-])(\d+)$/))) out.push(t.slice(0, m.index) + '|' + m[2] + m[1]);
  else if ((m = t.match(/([+-])$/))) {
    const body = t.slice(0, -1);
    out.push(body + '|1' + m[1]);
    const d = body.match(/^(.+?)(\d)$/);
    if (d) out.push(d[1] + '|' + d[2] + m[1]);
  } else out.push(t + '|');
  return out.map(x => x.replace(/\s+|\^/g, '').replace(/\|1([+-])$/, '|$1').replace(/\|1([+-])/, '|$1'));
}
function normFormula(s) { return formulaReadings(s)[0] || ''; }

/* ---------- Progress store (per-viewer, optional) ---------- */
const Store = {
  key: 'chembench.v1', d: {},
  load() { try { this.d = JSON.parse(localStorage.getItem(this.key)) || {}; } catch (e) { this.d = {}; } },
  get(id) { return this.d[id] || (this.d[id] = { c: 0, a: 0, s: 0, b: 0 }); },
  /* reserved keys start with "_" so they never collide with lab ids */
  bag(name) { return this.d['_' + name] || (this.d['_' + name] = {}); },
  typeStat(labId, type) { const t = this.bag('types'), k = labId + '|' + type; return t[k] || (t[k] = { c: 0, a: 0 }); },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.d)); } catch (e) { /* storage unavailable */ } },
};
const MASTER = 10;

/* ---------- Theme tokens for canvas ---------- */
const tok = (name) => getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();

/* Canvas that tracks its container width and device pixel ratio */
function makeCanvas(canvas, aspect, draw) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0;
  function size() {
    const dpr = window.devicePixelRatio || 1;
    w = canvas.parentElement.clientWidth; h = Math.round(typeof aspect === 'function' ? aspect(w) : w * aspect);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (draw) draw(ctx, w, h);
  }
  const ro = new ResizeObserver(size); ro.observe(canvas.parentElement);
  size();
  return { ctx, get w() { return w; }, get h() { return h; }, redraw: () => draw && draw(ctx, w, h), stop: () => ro.disconnect() };
}

/* ---------- UI snippets ---------- */
const UI = {
  select(id, label, opts, sel) {
    return `<label class="field" for="${id}"><span class="lbl">${label}</span><select id="${id}">${opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${U.esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${t}</option>`; }).join('')}</select></label>`;
  },
  num(id, label, val, unit = '', attrs = '') {
    return `<label class="field" for="${id}"><span class="lbl">${label}</span><span class="inwrap"><input id="${id}" type="text" inputmode="decimal" value="${val}" ${attrs}>${unit ? `<span class="unit">${unit}</span>` : ''}</span></label>`;
  },
  text(id, label, val, ph = '') {
    return `<label class="field" for="${id}"><span class="lbl">${label}</span><input id="${id}" type="text" value="${U.esc(val)}" placeholder="${U.esc(ph)}" autocomplete="off" spellcheck="false"></label>`;
  },
  slider(id, label, min, max, step, val) {
    return `<label class="slider" for="${id}"><span class="lbl">${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><output id="${id}-o"></output></label>`;
  },
  stepper(id, label, val) {
    return `<div class="stepper"><span class="lbl">${label}</span><div class="stepbox"><button type="button" data-step="${id}" data-d="-1" aria-label="Fewer ${label}">−</button><output id="${id}">${val}</output><button type="button" data-step="${id}" data-d="1" aria-label="More ${label}">+</button></div></div>`;
  },
  kv(pairs) { return `<dl class="kv">${pairs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`; },
};

/* ---------- Lab registry ---------- */
const LABS = [];
const FAMILIES = {
  found: 'Foundations', atom: 'Atoms & compounds', rx: 'Reactions', state: 'States & solutions', nuc: 'Nuclear', life: 'Organic & biochem',
};
function registerLab(def) { LABS.push(def); }

/* ---------- Practice engine ---------- */
function answerHTML(p) {
  if (p.display !== undefined) return p.display;
  if (p.kind === 'num') return fmt(p.answer, p.sf || 3) + (p.unit ? ' ' + p.unit : '');
  if (p.kind === 'formula' || p.kind === 'counts') return fmtF([].concat(p.answer)[0]);
  if (p.kind === 'choice') return p.choices[p.answer];
  return [].concat(p.answer)[0];
}
function checkAnswer(p, raw) {
  if (p.check) return p.check(raw);
  if (p.kind === 'num') {
    const v = parseNum(raw); if (v === null) return null;
    const a = p.answer, tol = p.tol ?? 0.02;
    return Math.abs(v - a) <= Math.max(Math.abs(a) * tol, p.abs ?? 1e-12);
  }
  if (p.kind === 'text') { const n = normText(raw); return n ? [].concat(p.answer).some(a => normText(a) === n) : null; }
  if (p.kind === 'formula') { const rs = formulaReadings(raw); return rs.length ? [].concat(p.answer).some(a => rs.includes(normFormula(a))) : null; }
  if (p.kind === 'counts') {
    try { return Chem.sameCounts(Chem.parseFormula(raw).counts, Chem.parseFormula(p.answer).counts); } catch (e) { return null; }
  }
  return null;
}
function meterHTML(c) {
  const pct = Math.min(100, Math.round(100 * c / MASTER));
  return `<span class="meter" role="img" aria-label="${Math.min(c, MASTER)} of ${MASTER} toward mastery"><i style="width:${pct}%"></i></span>`;
}

/* Set by "practice this skill" links: the next lab view opens on that problem type */
let PRESET_TYPE = null;
function mountPractice(root, lab) {
  const st = Store.get(lab.id);
  let filter = -1, cur = null, graded = false, done = false, attempts = [];
  if (PRESET_TYPE) { const k = lab.problems.findIndex(p => p.name === PRESET_TYPE); if (k >= 0) filter = k; PRESET_TYPE = null; }
  const types = [{ name: 'Mixed' }, ...lab.problems];
  root.innerHTML = `<div class="chips" role="group" aria-label="Problem type">${types.map((t, i) => `<button type="button" class="chip" data-i="${i - 1}" aria-pressed="${i - 1 === filter}">${t.name}</button>`).join('')}</div>
    <div class="score" aria-live="polite"></div><div class="prob"></div>`;
  const chips = root.querySelector('.chips'), probEl = root.querySelector('.prob');
  chips.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    filter = +b.dataset.i;
    chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    next();
  });
  function score() {
    const mastered = st.c >= MASTER;
    root.querySelector('.score').innerHTML = `<span><b>${st.c}</b> correct</span><span>streak <b>${st.s}</b></span><span>best <b>${st.b}</b></span>${meterHTML(st.c)}${mastered ? '<span class="pill good">Mastered</span>' : ''}`;
  }
  function next() {
    const gen = filter < 0 ? U.pick(lab.problems) : lab.problems[filter];
    for (let tries = 0; tries < 5; tries++) { try { cur = gen.gen(); break; } catch (err) { console.error(err); cur = null; } }
    if (!cur) { probEl.innerHTML = '<p>That problem type failed to load. Pick another type.</p>'; return; }
    cur.type = gen.name; graded = false; done = false; attempts = [];
    render();
  }
  function render() {
    let input;
    if (cur.kind === 'choice') {
      input = `<div class="choices">${cur.choices.map((c, i) => `<button type="button" class="choice" data-i="${i}">${c}</button>`).join('')}</div>`;
    } else {
      const ph = cur.ph || (cur.kind === 'num' ? 'e.g. 2.5 or 6.02e23' : 'type your answer');
      input = `<form class="ans" novalidate><input id="ans-${lab.id}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${U.esc(ph)}" inputmode="${cur.kind === 'num' ? 'decimal' : 'text'}" aria-label="Your answer">${cur.unit ? `<span class="unit">${cur.unit}</span>` : ''}<button class="btn primary" type="submit">Check</button></form>`;
    }
    probEl.innerHTML = `<div class="ptype">${cur.type}</div><div class="q">${cur.q}</div>${input}<div class="fb" hidden></div>
      <div class="tutor-slot"></div>
      <div class="prow"><button type="button" class="btn ghost reveal">Show solution</button><button type="button" class="btn next">Next problem</button></div>`;
    if (typeof Tutor !== 'undefined') Tutor.attach(probEl.querySelector('.tutor-slot'), lab, cur, () => ({ attempts, done }));
    const fb = probEl.querySelector('.fb');
    const finish = (ok, revealed) => {
      done = true;
      fb.hidden = false;
      fb.className = 'fb ' + (revealed ? 'neutral' : ok ? 'ok' : 'no');
      fb.innerHTML = `<div class="verdict">${revealed ? 'Solution' : 'Correct'}</div>${revealed ? `<div class="answer">Answer: <b>${answerHTML(cur)}</b></div>` : ''}${cur.explain ? `<div class="explain">${cur.explain}</div>` : ''}`;
      probEl.querySelector('.next').focus();
    };
    const grade = (ok) => {
      if (ok === null) { fb.hidden = false; fb.className = 'fb no'; fb.innerHTML = `<div class="verdict">Couldn't read that</div><div>${cur.kind === 'num' ? 'Enter a number. Scientific notation works as 6.02e23.' : (cur.hint || 'Check the format and try again.')}</div>`; return; }
      if (!graded) { graded = true; st.a++; const ts = Store.typeStat(lab.id, cur.type); ts.a++; if (ok) { st.c++; st.s++; ts.c++; st.b = Math.max(st.b, st.s); } else st.s = 0; Store.save(); score(); }
      if (ok) finish(true, false);
      else { fb.hidden = false; fb.className = 'fb no'; fb.innerHTML = `<div class="verdict">Not quite</div><div>Try again, or show the solution.${cur.hint ? ' ' + cur.hint : ''}</div>`; }
    };
    if (cur.kind === 'choice') {
      probEl.querySelector('.choices').addEventListener('click', e => {
        const b = e.target.closest('.choice'); if (!b || done) return;
        const ok = +b.dataset.i === cur.answer;
        attempts.push(b.textContent.trim());
        b.classList.add(ok ? 'right' : 'wrong');
        grade(ok);
      });
    } else {
      const form = probEl.querySelector('form'), inp = form.querySelector('input');
      form.addEventListener('submit', e => { e.preventDefault(); if (done) { next(); return; } if (inp.value.trim()) attempts.push(inp.value.trim()); grade(checkAnswer(cur, inp.value)); });
    }
    probEl.querySelector('.reveal').addEventListener('click', () => {
      if (!graded) { graded = true; st.a++; Store.typeStat(lab.id, cur.type).a++; st.s = 0; Store.save(); score(); }
      if (cur.kind === 'choice') probEl.querySelectorAll('.choice')[cur.answer].classList.add('right');
      finish(false, true);
    });
    probEl.querySelector('.next').addEventListener('click', next);
  }
  score(); next();
}

/* Multiple-choice helper: returns {choices, answer} with the right answer shuffled in */
function mc(correct, wrongs) {
  const all = U.shuffle([correct, ...wrongs.filter(w => w !== correct)]);
  return { kind: 'choice', choices: all, answer: all.indexOf(correct) };
}

/* ---------- Router & views ---------- */
let cleanup = null;
/* Non-lab pages (periodic table, flashcards, test): id -> {title, render(app) -> cleanup?} */
const PAGES = {};
function registerPage(id, def) { PAGES[id] = def; }
/* Skills answered at least 4 times and under 80% right, weakest first */
function weakSpots(n = 4) {
  const t = Store.bag('types');
  return Object.entries(t).filter(([, v]) => v.a >= 4).map(([k, v]) => { const [lab, type] = k.split('|'); return { lab: LABS.find(l => l.id === lab), type, pct: v.c / v.a, ...v }; })
    .filter(x => x.lab && x.lab.problems.some(p => p.name === x.type) && x.pct < 0.8).sort((a, b) => a.pct - b.pct).slice(0, n);
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-preset]'); if (a) PRESET_TYPE = a.dataset.preset;
});
function tileHTML(lab, big) {
  const st = Store.get(lab.id);
  return `<a class="tile fam-${lab.fam}${big ? ' big' : ''}" href="#${lab.id}">
    <span class="z">${lab.ch}</span><span class="m">${st.c >= MASTER ? '★' : ''}</span>
    <span class="sym">${lab.sym}</span><span class="nm">${lab.title}</span>${meterHTML(st.c)}</a>`;
}
function renderHome(app) {
  const mastered = LABS.filter(l => Store.get(l.id).c >= MASTER).length;
  const solved = LABS.reduce((s, l) => s + Store.get(l.id).c, 0);
  app.innerHTML = `
  <section class="hero">
    <div class="hero-text">
      <p class="eyebrow">Introductory Chemistry · Chapters 2–19</p>
      <h1>Chem Bench</h1>
      <p class="lede">One hands-on lab for every chapter of your course. Build atoms, balance equations, squeeze gases and titrate acids, then practice with fresh problems until each topic sticks.</p>
    </div>
    <div class="hero-side">
      <figure class="hero-visual"><div id="hero-vis"></div><figcaption>CH<sub>4</sub> + 2 O<sub>2</sub> → CO<sub>2</sub> + 2 H<sub>2</sub>O, atom by atom</figcaption></figure>
      <div class="hero-stats">
        <div><b>${LABS.length}</b><span>labs</span></div>
        <div><b>${solved}</b><span>problems solved</span></div>
        <div><b>${mastered}</b><span>mastered</span></div>
      </div>
    </div>
  </section>
  <section aria-label="Labs by chapter">
    <div class="legend">${Object.entries(FAMILIES).map(([k, v]) => `<span class="lg fam-${k}"><i></i>${v}</span>`).join('')}</div>
    <div class="grid">${LABS.map(l => tileHTML(l)).join('')}</div>
    <p class="hint">Each tile is one chapter: the big number is the chapter, the meter fills as you answer ${MASTER} problems correctly. Progress is saved in this browser.</p>
  </section>
  ${(() => { const w = weakSpots(); return w.length ? `<section class="weak" aria-labelledby="weak-h"><h2 id="weak-h">Your weak spots</h2><p class="note">The skills you miss most often. Tap one to drill it.</p>
    <div class="weak-list">${w.map(x => `<a class="weak-item fam-${x.lab.fam}" href="#${x.lab.id}" data-preset="${U.esc(x.type)}"><span class="wl">Ch ${x.lab.ch} · ${x.lab.title}</span><b>${x.type}</b><span class="wp">${Math.round(x.pct * 100)}% right of ${x.a}</span></a>`).join('')}</div></section>` : ''; })()}
  <section class="tools" aria-label="Study tools">
    <a class="tool" href="#table"><span class="ti">Pt</span><b>Periodic table</b><span>All 118 elements. Color by family or electronegativity, tap one for its details.</span></a>
    <a class="tool" href="#cards"><span class="ti">Fc</span><b>Flashcards</b><span>Polyatomic ions, element symbols, charges and prefixes. Missed cards come back sooner.</span></a>
    <a class="tool" href="#exam"><span class="ti">Tx</span><b>Test mode</b><span>Pick chapters and take a mixed quiz. See your score by chapter and review what you missed.</span></a>
  </section>
  <section class="howto">
    <div><h2>Bench</h2><p>Interactive models you can poke at. Change a value and watch what the chemistry does.</p></div>
    <div><h2>Key ideas</h2><p>The rules and formulas for the chapter, written short enough to review in a minute.</p></div>
    <div><h2>Practice</h2><p>Endless randomized problems with worked solutions. Filter by problem type to drill one skill.</p></div>
  </section>`;
  if (typeof Storyboard !== 'undefined') { try { cleanup = Storyboard(document.getElementById('hero-vis'), reactionFrames(), { compact: true, loop: true, hold: 1700, tween: 1300 }); } catch (err) { console.error(err); } }
}
function renderLab(app, lab) {
  const i = LABS.indexOf(lab), prev = LABS[i - 1], nextL = LABS[i + 1];
  app.innerHTML = `
  <div class="lab-head">
    ${tileHTML(lab, true)}
    <div class="lab-title">
      <p class="eyebrow">Chapter ${lab.ch} · ${lab.chapter}</p>
      <h1>${lab.title}</h1>
      <p class="lede">${lab.blurb}</p>
    </div>
  </div>
  ${typeof STORIES !== 'undefined' && STORIES[lab.id] ? `<section class="watch" id="watch" aria-labelledby="watch-h"><h2 id="watch-h">Watch it <span class="story-title"></span></h2><div class="story-body"></div></section>` : ''}
  <div class="lab-grid">
    <section class="bench" aria-labelledby="bench-h"><h2 id="bench-h">Bench</h2><div id="bench"></div></section>
    <div class="rail">
      <section class="ideas" aria-labelledby="ideas-h"><h2 id="ideas-h">Key ideas</h2><ul>${lab.ideas.map(x => `<li>${x}</li>`).join('')}</ul></section>
      <section class="practice" aria-labelledby="prac-h"><h2 id="prac-h">Practice</h2><div id="practice"></div></section>
      <section class="ask" id="ask" aria-labelledby="ask-h" hidden><h2 id="ask-h">Ask Claude</h2><div id="ask-body"></div></section>
    </div>
  </div>
  <nav class="pager" aria-label="Other labs">
    ${prev ? `<a href="#${prev.id}"><span>← Ch ${prev.ch}</span>${prev.title}</a>` : '<span></span>'}
    ${nextL ? `<a href="#${nextL.id}" class="nx"><span>Ch ${nextL.ch} →</span>${nextL.title}</a>` : '<span></span>'}
  </nav>`;
  const benchEl = document.getElementById('bench');
  let benchStop = null, storyStop = null;
  try { benchStop = lab.bench(benchEl) || null; } catch (err) { console.error(err); benchEl.innerHTML = '<p>The bench failed to load.</p>'; }
  if (typeof mountStory !== 'undefined') storyStop = mountStory(document.getElementById('watch'), lab.id);
  cleanup = () => { benchStop && benchStop(); storyStop && storyStop(); };
  mountPractice(document.getElementById('practice'), lab);
  if (typeof Tutor !== 'undefined') Tutor.chat(document.getElementById('ask'), lab);
}
function route() {
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
  const id = location.hash.slice(1);
  const lab = LABS.find(l => l.id === id), page = PAGES[id];
  const app = document.getElementById('app');
  document.body.classList.toggle('in-lab', !!(lab || page));
  document.querySelectorAll('.topnav a').forEach(a => { if (a.getAttribute('href') === '#' + (lab ? '' : id)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (lab) { renderLab(app, lab); document.title = `${lab.title} · Chem Bench`; }
  else if (page) { try { cleanup = page.render(app) || null; } catch (err) { console.error(err); app.innerHTML = '<p>This page failed to load.</p>'; } document.title = `${page.title} · Chem Bench`; }
  else { renderHome(app); document.title = 'Chem Bench'; }
  window.scrollTo(0, 0);
  app.classList.remove('route-in'); void app.offsetWidth; app.classList.add('route-in');
}
function start() {
  Store.load();
  LABS.sort((a, b) => a.ch - b.ch);
  window.addEventListener('hashchange', route);
  route();
}

/* Wire +/- steppers inside a container: onChange(id, delta) */
function wireSteppers(el, onChange) {
  el.addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b) onChange(b.dataset.step, +b.dataset.d); });
}
