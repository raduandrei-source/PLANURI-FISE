// Teste offline pentru funcțiile pure din Mama.gs (node tests/run_all.js, din folderul proiectului)
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'Mama.gs'), 'utf8'));
// datele reale (plan, liste cu titulari, panourile fișelor) nu sunt publicate în depozit; testele care le cer se sar
const citeste = f => fs.existsSync(path.join(ROOT, f)) ? JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')) : null;
const d = citeste('data/nodein.json'), PANOURI = citeste('work/panouri.json');
let ok = 0, fail = 0, sarite = 0;
function t(nume, f) { try { f(); ok++; console.log('  ok  ', nume); } catch (e) { fail++; console.log('  EȘEC', nume, '-', e.message); } }
function td(nume, f, date = d) { if (!date) { sarite++; console.log('  –   ', nume, '(sărit: lipsesc datele locale)'); return; } t(nume, f); }

const plan = d ? parsePlan_(d.plan) : [];
const res = d ? mergeDisc_(plan, d.old) : null;

t('norm_ elimină diacriticele și semnele', () => assert.strictEqual(norm_('Reprezentări  (Ș,ț)'), 'reprezentarist'));
t('creditOf_ citește „3,5” și „(4)”', () => { assert.strictEqual(creditOf_('3,5'), 3.5); assert.strictEqual(creditOf_('(4)'), 4); });
t('numOrEmpty_: 0 → gol, „[2]” → 2', () => { assert.strictEqual(numOrEmpty_(0), ''); assert.strictEqual(numOrEmpty_('[2]'), 2); });
td('parsePlan_ găsește 134 de discipline în planul de test', () => assert.strictEqual(plan.length, 134));
td('parsePlan_ acoperă anii 1–6', () => assert.deepStrictEqual([...new Set(plan.map(p => p.an))].sort(), [1, 2, 3, 4, 5, 6]));
td('mergeDisc_: 107 potrivite, 27 noi, 14 orfane', () => {
  assert.strictEqual(res.rows.filter(r => r.matched).length, 107);
  assert.strictEqual(res.rows.filter(r => !r.matched).length, 27);
  assert.strictEqual(res.orphans.length, 14);
});
td('5203 Compoziție urbană: doar 2 ore P, 2 credite (diagnosticul din predare)', () => {
  const r = plan.filter(p => /compozi/i.test(p.den) && /urban/i.test(p.den) && p.sem === 10);
  assert.ok(r.length >= 1, 'nu am găsit disciplina');
  r.forEach(p => { assert.deepStrictEqual(p.h.map(x => x || 0), [0, 0, 0, 2]); assert.strictEqual(p.cred, 2); });
});
const LIMBI = ['Limba engleză', 'Limba franceză'];
const planL = d ? parsePlan_(d.plan, LIMBI) : [];
td('Limbi străine: câte un rând pe limbă (4 semestre × 2 limbi)', () => {
  const l = planL.filter(p => /^limb[ai] str/i.test(p.den));
  assert.strictEqual(l.length, 8);
  assert.strictEqual(planL.length, plan.length + 4);
  assert.ok(l.every(p => /\(Limba (engleză|franceză)\)$/.test(p.den)));
});
td('rândurile EN și FR păstrează orele și creditele rândului din plan', () => {
  const s1 = planL.filter(p => /^limb[ai] str/i.test(p.den) && p.sem === 1);
  assert.strictEqual(s1.length, 2);
  assert.deepStrictEqual(s1[0].h, s1[1].h); assert.strictEqual(s1[0].cred, s1[1].cred); assert.strictEqual(s1[0].cod, s1[1].cod);
});
td('fișele EN și FR se leagă fiecare de rândul lui (și „Limba străină” la singular)', () => {
  const rows = planL.map((r, i) => Object.assign({}, r, { row: i, url: '' }));
  const leaga = (cheie, sem) => { const m = potrivesteFisa_({ cheie, cod: cheie.split('|')[0], den: '', sem }, rows, 'id'); return m && m.den; };
  assert.match(leaga('ARA 1112 | Limbi străine (Limba engleză)', 1), /engleză/);
  assert.match(leaga('ARA 1112 | Limbi străine (Limba franceză)', 1), /franceză/);
  assert.match(leaga('ARA 2113 | Limba străină (Limba franceză)', 3), /franceză/);
  assert.match(leaga('ARA 2113 | Limbi străine (Limba engleză)', 3), /engleză/);
});
td('fără listă de limbi, planul rămâne nedespărțit', () => assert.strictEqual(parsePlan_(d.plan, []).length, plan.length));

// competențe: trecerea de la codurile vechi (CN/AP/RA) la lista ARACIS (C1–C8, A1–A8, R1–R8)
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'mapare_competente.json'), 'utf8'));
t('grupaCod_: coduri vechi și noi', () => {
  assert.strictEqual(grupaCod_('CN12'), 'CN'); assert.strictEqual(grupaCod_('A3'), 'AP'); assert.strictEqual(grupaCod_('R8'), 'RA');
  assert.strictEqual(grupaCod_('X1'), ''); assert.strictEqual(grupaCod_(''), '');
});
t('migrare: cod ARACIS vechi → cod nou, dubluri eliminate', () => {
  const vechi = Object.keys(MAP).filter(k => MAP[k].noi.length === 1 && MAP[k].noi[0] === 'C1');   // ex. CN09 și CN24 au același text
  assert.ok(vechi.length >= 2);
  const r = migreazaCompetente_([vechi.slice(0, 2), [], []], ['', '', ''], MAP);
  assert.deepStrictEqual(r.slots[0], ['C1', '', '', '', '']);
});
t('migrare: text propriu → Specificări manuale, în rândul categoriei', () => {
  const r = migreazaCompetente_([['CN20'], [], []], ['deja scris', '', ''], MAP);
  assert.deepStrictEqual(r.slots[0], ['', '', '', '', '']);
  assert.ok(r.manual[0].startsWith('deja scris\n') && /limbii engleze/.test(r.manual[0]));
  assert.strictEqual(r.log.mutate, 1);
});
t('migrare: cod ARACIS pus în alt rând trece în rândul categoriei lui (RA03 = aptitudine)', () => {
  const r = migreazaCompetente_([[], [], ['RA03']], ['', '', ''], MAP);
  assert.deepStrictEqual(r.slots[1].filter(x => x), MAP.RA03.noi);
});
t('migrare: listele de discipline (RA11) se scot', () => {
  const r = migreazaCompetente_([[], [], ['RA11']], ['', '', ''], MAP);
  assert.deepStrictEqual(r.slots[2], ['', '', '', '', '']); assert.strictEqual(r.manual[2], ''); assert.strictEqual(r.log.renuntate, 1);
});
t('migrare: a doua rulare nu mai schimbă nimic', () => {
  const r1 = migreazaCompetente_([['CN01', 'CN20'], ['AP06'], ['RA06']], ['', '', ''], MAP);
  const r2 = migreazaCompetente_(r1.slots, r1.manual, MAP);
  assert.deepStrictEqual(r2.slots, r1.slots); assert.deepStrictEqual(r2.manual, r1.manual); assert.strictEqual(r2.log.convertite, 0);
});
td('migrare pe toate cele 123 de fișe: niciun cod pierdut, nimic peste 5', () => {
  const pan = PANOURI;
  let dep = 0, nec = 0, gol = 0;
  for (const f in pan) {
    const v = pan[f], r = migreazaCompetente_(v.map(x => x.slice(0, 5)), v.map(x => x[5]), MAP);
    dep += r.log.depasite.length; nec += r.log.necunoscute.length;
    if (r.slots.every(x => x.every(c => !c)) && r.manual.every(m => !m)) gol++;
  }
  assert.strictEqual(nec, 0, 'coduri necunoscute'); assert.strictEqual(dep, 0, 'depășiri'); assert.strictEqual(gol, 0, 'fișe rămase goale');
}, PANOURI);

// ajutorul din fișă: comentarii + „ⓘ” cu link la site
const SITE = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');
t('ajutor: toate ancorele din Mama.gs există în docs/index.html', () => {
  const anc = new Set(AJUTOR_NOTE.map(x => x[1]).concat(Object.values(AJUTOR_LINKURI)));
  const lipsa = [...anc].filter(a => !SITE.includes('id="' + a + '"'));
  assert.deepStrictEqual(lipsa, []);
});
t('ajutor: comentariile stau doar în zona tipărită A:L, rândurile 1–72', () => {
  const aj = ajutorFisa_('https://x.io/site/');
  Object.keys(aj.note).forEach(a => { const [r, c] = rcDinA1_(a); assert.ok(r >= 1 && r <= AJ_RAND_MAX && c >= 1 && c <= 12, a); });
  assert.ok(Object.keys(aj.note).length >= 30);
  assert.match(aj.note.E15, /planul de învățământ[\s\S]*Detalii: https:\/\/x\.io\/site\/#denumire$/);
});
t('ajutor: linkurile ⓘ sunt formule HYPERLINK cu ancoră, una pe rând', () => {
  const aj = ajutorFisa_('https://x.io/site/#vechi');
  assert.strictEqual(aj.linkuri.length, AJ_RAND_MAX);
  assert.strictEqual(aj.linkuri[14][0], '=HYPERLINK("https://x.io/site/#denumire","ⓘ")');
  assert.strictEqual(aj.linkuri[0][0], '');
});
t('ajutor: puneAjutor_ păstrează comentariile puse de altcineva și scrie coloana M', () => {
  const note = Array.from({ length: AJ_RAND_MAX }, () => Array(12).fill(''));
  note[39][0] = 'notă a profesorului';                     // A40
  let scrise = null, formule = null;
  const rngM = { setFormulas: f => { formule = f; return rngM }, setFontColor: () => rngM, setFontSize: () => rngM, setHorizontalAlignment: () => rngM, setVerticalAlignment: () => rngM };
  const sh = { getRange: (r, c) => c === 13 ? rngM : { getNotes: () => note, setNotes: n => { scrise = n; } }, setColumnWidth: () => {} };
  puneAjutor_(sh, 'https://x.io/');
  assert.strictEqual(scrise[39][0], 'notă a profesorului');
  assert.match(scrise[30][10], /total-ore/);              // K31
  assert.strictEqual(formule.length, AJ_RAND_MAX);
});
t('PDF: exportul ia doar coloanele A:L (fără ⓘ) și fără comentarii', () => {
  const u = pdfUrl_('id', 1, 72);
  assert.match(u, /[?&]c1=0&/); assert.match(u, /[?&]c2=12&/); assert.match(u, /printnotes=false/);
});

t('keyFromFisa_ = normKey_', () => assert.strictEqual(keyFromFisa_('ARA 1102 | Reprezentări'), normKey_('ARA 1102', 'Reprezentări')));
td('potrivesteFisa_ leagă după cheie exactă', () => {
  const rows = res.rows.map((r, i) => Object.assign({}, r, { row: i + 2, url: '' }));
  const x = rows[5], m = potrivesteFisa_({ cheie: x.cod + ' | ' + x.den, cod: x.cod, den: '', sem: x.sem }, rows, 'id');
  assert.strictEqual(m && m.row, x.row);
});

console.log(`\n${ok} trecute, ${fail} eșuate` + (sarite ? `, ${sarite} sărite (fără datele locale)` : ''));
process.exit(fail ? 1 : 0);
