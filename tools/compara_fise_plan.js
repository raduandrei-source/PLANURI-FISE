// Compară orele și creditele din fișe (rândul propriu din _DATE) cu planul oficial (INFO → PLAN_FOAIE_CURENTA).
// Intrare: work/fise_extras.json (din extrage.py). Ieșire: work/comparatie.json
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'Centralizator.gs'), 'utf8'));
const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'work', 'fise_extras.json'), 'utf8'));
const plan = parsePlan_(d.plan, ['Limba engleză', 'Limba franceză']);   // ca limbiStraine_() cu INFO implicit
const rows = plan.map((p, i) => Object.assign({}, p, { row: i, url: '' }));
const n = x => Number(x) || 0;
const folosit = {};
// ca în „Generează URL/stare fișe” rulat de două ori: fișele legate primesc URL, apoi se reîncearcă cele rămase
const leg = {};
for (let runda = 0; runda < 2; runda++) d.fise.forEach((f, i) => {
  if (leg[i]) return;
  const p = potrivesteFisa_({ cheie: f.cheie, cod: f.cod, den: '', sem: f.rand[3] }, rows, 'id' + i);
  if (p && (!p.url || p.url === 'x/d/id' + i)) { p.url = 'x/d/id' + i; leg[i] = p; }
  else if (p && runda === 1) leg[i] = p;            // rând deja luat de altă fișă: se raportează ca dublură
});
const out = d.fise.map((f, i) => {
  const r = f.rand;
  const p = leg[i] || null;
  const fisa = { cod: r[0], den: r[1], an: n(r[2]), sem: n(r[3]), cred: n(r[4]), h: [5, 6, 7, 8].map(k => n(r[k])), forma: String(r[10] || '') };
  if (!p) return { fisier: f.fisier, cheie: f.cheie, fisa, plan: null, dif: ['NEGĂSIT ÎN PLAN'] };
  (folosit[p.row] = folosit[p.row] || []).push(f.fisier);
  const pl = { cod: p.cod, den: p.den, an: p.an, sem: p.sem, cred: n(p.cred), h: p.h.map(n), forma: String(p.forma || '').replace(/\*/g, '') };
  const dif = [];
  if (fisa.cred !== pl.cred) dif.push(`credite ${fisa.cred} → ${pl.cred}`);
  ['C', 'S', 'L', 'P'].forEach((k, i) => { if (fisa.h[i] !== pl.h[i]) dif.push(`${k} ${fisa.h[i]} → ${pl.h[i]}`); });
  if (fisa.sem !== pl.sem) dif.push(`semestru ${fisa.sem} → ${pl.sem}`);
  if (fisa.forma && pl.forma && fisa.forma !== pl.forma) dif.push(`formă ${fisa.forma} → ${pl.forma}`);
  return { fisier: f.fisier, cheie: f.cheie, fisa, plan: pl, dif, planRow: p.row };
});
out.forEach(o => { if (o.plan && folosit[o.planRow].length > 1) o.dublura = folosit[o.planRow].filter(x => x !== o.fisier); });
const faraFisa = rows.filter(r => !folosit[r.row]).map(r => ({ cod: r.cod, den: r.den, an: r.an, sem: r.sem, cred: r.cred, h: r.h.map(n) }));
fs.writeFileSync(path.join(ROOT, 'work', 'comparatie.json'), JSON.stringify({ out, faraFisa, nPlan: plan.length }, null, 1));
console.log('plan:', plan.length, '| fișe:', out.length, '| negăsite:', out.filter(o => !o.plan).length,
  '| cu diferențe:', out.filter(o => o.plan && o.dif.length).length, '| corecte:', out.filter(o => o.plan && !o.dif.length).length,
  '| discipline din plan fără fișă:', faraFisa.length, '| fișe pe același rând de plan:', out.filter(o => o.dublura).length);
