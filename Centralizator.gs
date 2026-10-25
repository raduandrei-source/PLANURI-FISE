/**
 * CENTRALIZATOR DISCIPLINE ȘI TITULARI ARH – FIȘE DISCIPLINE  (script unic, se lipește în Extensii → Apps Script al fișierului „Centralizator discipline și titulari ARH”)
 *
 * Meniul „Fișe disciplină” (se creează automat la deschiderea fișierului, prin onOpen):
 *   1. Preia disciplinele din PLAN        – reface lista DISCIPLINE din planul definit în INFO (PLAN_FISIER_URL + PLAN_FOAIE_CURENTA)
 *      AN NOU                             – BACKUP complet (fișe + centralizatorul), apoi resetare curată a listei din plan
 *   2. Generează URL/stare fișe           – caută fișele din folder; completează URL, stare, aviz, data completării, verificare;
 *                                           fișele nelegate apar în foaia NELEGATE (roz) – alegi disciplina, la următoarea rulare se leagă singure
 *   3. Actualizează FD                    – scrie în fiecare fișă (valori) datele din centralizator: INFO, plan, titulari, competențe
 *   4. BACKUP FD                          – folder „BACKUP an-lună-zi oră.minut” cu copii după toate fișele + centralizatorul
 *   5. PDF FD                             – folder „PDF an-lună-zi oră.minut” cu câte un PDF (A4, potrivit pe lățime) pentru foaia FISA a fiecărei fișe
 *   6. Acordă drepturi de editare         – titularii + directorul departamentului devin editori ai fișei lor
 *   7. Trimite fișele (TEST / REAL)       – un singur email pentru fiecare profesor, cu toate fișele lui
 * Operațiile lungi (Generează, Actualizează FD, BACKUP) se continuă singure în fundal dacă depășesc limita de timp Google
 * și trimit un email cu raportul la final.
 */

/* ===================== CONFIGURARE ===================== */
const SH_INFO = 'INFO', SH_PROF = 'PROFESORI', SH_DISC = 'DISCIPLINE', SH_COMP = 'COMPETENTE';
const SH_FISA = 'FISA', SH_DATE = '_DATE', SH_PANOU = 'PANOU';
const MENIU_NUME = 'Fișe disciplină';      // numele meniului din bara de sus (schimbă aici dacă vrei alt nume)
const DISC_ROWS = 500;                    // câte rânduri are lista (formulele din O, S, T există până la 501)
// coloane DISCIPLINE (1-based)
const C_COD = 1, C_DEN = 2, C_AN = 3, C_SEM = 4, C_CRED = 5, C_FORMA = 6, C_TIP = 7, C_URL = 8,
      C_T1 = 9, C_T5 = 13, C_DEPT = 14, C_DIR = 15, C_EDIT = 16, C_STARE = 17, C_AVIZ = 18,
      C_EMAIL = 19, C_KEY = 20,
      C_H_C = 22, C_H_S = 23, C_H_L = 24, C_H_P = 25, C_FORMATIV = 26, C_PREC = 27,
      C_DATA = 28, C_VERIF = 29, C_SYNC = 30;
const DISC_HEADERS_NEW = ['C (ore/săpt.)', 'S (ore/săpt.)', 'L (ore/săpt.)', 'P (ore/săpt.)', 'FORMATIV (DS/DF/DC)',
  'PRECONDIȚII', 'DATA COMPLETĂRII (din fișă)', 'VERIFICARE FIȘĂ (din fișă)', 'ULTIMUL REFRESH'];
const T_LIMIT_MS = 5 * 60 * 1000;         // limita unei rulări Apps Script este 6 minute
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 };
const SITE_IMPLICIT = 'https://raduandrei-source.github.io/PLANURI-FISE/';   // INFO → SITE_INSTRUCTIUNI îl poate înlocui

/* Ajutorul din fișă: comentarii pe câmpurile completate automat și „ⓘ” în coloana M (în afara zonei tipărite A:L),
 * cu link la secțiunea din site-ul de instrucțiuni. Ancorele trebuie să existe în docs/index.html (testul le verifică). */
const AJ_PLAN = 'planul de învățământ (prin „Centralizator discipline și titulari ARH”)', AJ_INFO = 'foaia INFO a centralizatorului', AJ_DISC = 'lista DISCIPLINE a centralizatorului';
const AJUTOR_NOTE = [   // [celule, ancoră, ce este, sursa]
  [['A6'], 'date-program', 'Anul universitar', AJ_INFO],
  [['B8', 'B9', 'B11', 'B12', 'B13'], 'date-program', 'Date despre program, aceleași pentru toate fișele', AJ_INFO],
  [['B10'], 'departament', 'Departamentul disciplinei (de el depinde directorul care avizează)', AJ_DISC],
  [['E15'], 'denumire', 'Denumirea disciplinei, exact ca în plan', AJ_PLAN],
  [['E17'], 'cod', 'Codul disciplinei; prin el fișa se leagă de rândul ei din plan', AJ_PLAN],
  [['E18', 'E19', 'B69', 'B70'], 'titulari', 'Titularii stabiliți de departament', AJ_DISC],
  [['B20', 'E20'], 'an-semestru', 'Anul de studii și semestrul (numerotat 1–12 pe tot programul)', AJ_PLAN],
  [['I20'], 'evaluare-tip', 'Forma de evaluare (E = examen, V = verificare)', AJ_PLAN],
  [['L20'], 'tip-disciplina', 'Regimul și categoria disciplinei (ex. DOB-DS)', AJ_PLAN],
  [['B22', 'D22', 'F22', 'H22', 'J22', 'L22'], 'ore-saptamana', 'Ore pe săptămână de curs, seminar, laborator, proiect, practică', AJ_PLAN],
  [['B23', 'D23', 'F23', 'H23', 'J23', 'L23'], 'ore-semestru', 'Ore pe semestru = ore pe săptămână × săptămâni (INFO → SAPT_SEMESTRU). Orele din capitolul 9 trebuie să dea exact aceste totaluri', AJ_PLAN],
  [['K31'], 'total-ore', 'Total ore pe semestru = credite × ore pe credit (INFO → ORE_CREDIT). Trebuie să fie egal cu 3.4 + 3.7', AJ_PLAN],
  [['K32'], 'credite', 'Credite ECTS', AJ_PLAN],
  [['B42', 'B43', 'B44'], 'rezultate', 'Textul rezultatelor învățării alese în PANOU (coduri C/A/R), cu referința (ARACIS-n, D46-x), plus specificările manuale. Se schimbă din PANOU, nu de aici', 'lista COMPETENTE a centralizatorului'],
  [['B60', 'B61', 'B62', 'B63'], 'criterii-standard', 'Criteriile standard de evaluare ale facultății; apar doar la activitățile cu pondere', AJ_INFO],
  [['A65'], 'promovare', 'Condițiile de promovare, text standard al facultății', AJ_INFO],
  [['I71', 'I72'], 'semnaturi', 'Directorul de departament și decanul', AJ_INFO]
];
const AJUTOR_LINKURI = {   // rândul din FISA → ancora din site (semnul ⓘ din coloana M)
  6: 'date-program', 8: 'date-program', 9: 'date-program', 10: 'departament', 11: 'date-program', 12: 'date-program', 13: 'date-program',
  15: 'denumire', 16: 'denumire-en', 17: 'cod', 18: 'titulari', 19: 'titulari', 20: 'an-semestru', 22: 'ore-saptamana', 23: 'ore-semestru',
  25: 'studiu-individual', 26: 'studiu-individual', 27: 'studiu-individual', 28: 'examinari', 29: 'studiu-individual', 30: 'studiu-individual',
  31: 'total-ore', 32: 'credite', 34: 'preconditii', 35: 'preconditii', 37: 'conditii', 38: 'conditii', 40: 'obiectiv',
  41: 'rezultate', 42: 'ri-alegere', 43: 'ri-alegere', 44: 'ri-alegere', 45: 'metode', 47: 'continuturi', 48: 'continuturi', 50: 'bibliografie',
  51: 'continuturi', 53: 'continuturi', 55: 'continuturi', 57: 'bibliografie', 59: 'evaluare', 60: 'evaluare', 61: 'evaluare', 62: 'evaluare',
  63: 'evaluare', 65: 'promovare', 66: 'ri-minimale', 68: 'semnaturi', 71: 'semnaturi', 72: 'semnaturi'
};
const AJ_RAND_MAX = 72;                   // ultimul rând al fișei (zona tipărită A5:L72)

/* ===================== FUNCȚII PURE (testabile fără Google) ===================== */

function norm_(s) {                                   // fără diacritice, litere mici, doar litere/cifre
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[şș]/g, 's').replace(/[ţț]/g, 't').replace(/[^a-z0-9]/g, '');
}
function normKey_(cod, den) { return norm_(cod) + '|' + norm_(den); }
function keyFromFisa_(k) {                            // 'ARA 1102 | Reprezentări'  ->  cheie normalizată
  const p = String(k).split('|');
  return normKey_(p[0], p.slice(1).join('|'));
}
function cuvinte_(s) {                               // cuvintele de cel puțin 4 litere, fără diacritice
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[şș]/g, 's').replace(/[ţț]/g, 't').split(/[^a-z0-9]+/).filter(w => w.length >= 4);
}
/** Leagă o fișă (cheie „cod | den”, cod, den, sem din fișă) de un rând din listă. Ordine: cod+den; aceeași denumire (+sem);
 *  denumire inclusă una în alta + același semestru; aceleași cuvinte în altă ordine + același semestru;
 *  același cod, numai dacă denumirile au măcar un cuvânt comun (altfel fișa ajunge în NELEGATE, nu se leagă greșit).
 *  Nu atinge rânduri deja legate de ALT fișier (id diferit). */
function potrivesteFisa_(f, rows, idFisa) {
  const kk = keyFromFisa_(f.cheie || ''), pc = kk.split('|');
  const cod = norm_(f.cod) || pc[0];
  const denRaw = String(f.den || (f.cheie || '').split('|').slice(1).join('|'));
  // variante: denumirea întreagă, fără paranteze, partea dinaintea barei („Economia proiectării / Design Economy”)
  const dens = [denRaw, denRaw.replace(/\([^)]*\)/g, ''), denRaw.split('/')[0]].map(norm_).filter((d, i, a) => d && a.indexOf(d) === i);
  // anul și semestrul din codul vechi (ARA 1102 = anul 1, sem. 1; ARA 2201 = anul 2, sem. 4; ARA 41DL = anul 4, sem. 7); altfel semestrul din fișă
  let an = 0, sem = 0; const mc = cod.match(/^ara(\d)(\d)/);
  if (mc) { an = Number(mc[1]); sem = (an - 1) * 2 + Number(mc[2]); } else sem = Number(f.sem) || 0;
  const liber = r => !r.url || idFromUrl_(r.url) === idFisa;
  const semOk = r => (!sem || !Number(r.sem) || Number(r.sem) === sem) && (!an || !Number(r.an) || Number(r.an) === an);
  // la mai mulți candidați decide ce scrie în paranteza fișei (ex. „(Limba engleză)” alege rândul de engleză)
  const paran = cuvinte_((denRaw.match(/\([^)]*\)/g) || []).join(' ')).map(w => w.slice(0, 5));
  const uniq = a => {
    if (a.length === 1) return a[0];
    if (a.length < 2 || !paran.length) return null;
    const b = a.filter(r => { const rw = cuvinte_(r.den).map(w => w.slice(0, 5)); return paran.every(p => rw.indexOf(p) >= 0); });
    return b.length === 1 ? b[0] : null;
  };
  const cuv = cuvinte_(denRaw.replace(/\([^)]*\)/g, '').split('/')[0]), cheieCuv = cuv.slice().sort().join(' ');
  const radacini = cuv.map(w => w.slice(0, 5));
  let x = rows.find(r => normKey_(r.cod, r.den) === kk);
  if (x) return x;
  for (const den of dens) { x = uniq(rows.filter(r => liber(r) && norm_(r.den) === den && semOk(r))); if (x) return x; }
  if (!sem) for (const den of dens) { x = uniq(rows.filter(r => liber(r) && norm_(r.den) === den)); if (x) return x; }
  for (const den of dens) {
    if (den.length < 8 || !sem) continue;
    x = uniq(rows.filter(r => { const d = norm_(r.den); return liber(r) && semOk(r) && d.length >= 8 && (d.indexOf(den) >= 0 || den.indexOf(d) >= 0); }));
    if (x) return x;
  }
  if (cheieCuv && sem) { x = uniq(rows.filter(r => liber(r) && semOk(r) && cuvinte_(r.den).sort().join(' ') === cheieCuv)); if (x) return x; }
  if (cod) {
    x = uniq(rows.filter(r => liber(r) && norm_(r.cod) === cod && cuvinte_(r.den).some(w => radacini.indexOf(w.slice(0, 5)) >= 0)));
    if (x) return x;
  }
  return null;
}
function numOrEmpty_(x) {
  if (typeof x === 'number') return x === 0 ? '' : x;
  const m = String(x == null ? '' : x).match(/^\s*\[?\(?(-?\d+(?:[.,]\d+)?)\)?\]?\s*$/);
  return m ? Math.abs(parseFloat(m[1].replace(',', '.'))) || '' : '';
}
function creditOf_(x) {
  if (typeof x === 'number') return Math.abs(x);
  const m = String(x == null ? '' : x).match(/\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : 0;
}

/** Rândul „Limbi străine” / „Limba străină” din plan devine câte un rând pentru fiecare limbă, ca fiecare să aibă fișa ei:
 *  „Limbi străine (Limba engleză)”, „Limbi străine (Limba franceză)” – același cod, aceleași ore și credite. */
function desparteLimbi_(rec, limbi) {
  if (!limbi || !limbi.length || !/^limb[ai]\s+str[aă]in[eă]/i.test(rec.den) || /\(/.test(rec.den)) return [rec];
  return limbi.map(l => Object.assign({}, rec, { den: rec.den + ' (' + l + ')' }));
}

/** Citește foaia de plan (format unificat: A nr, B den, C cod, D opt, E form, F prec, G–J ore sem. impar,
 *  K SI, L FE, M credite, N–Q ore sem. par, R SI, S FE, T credite). Un rând poate da 0, 1 sau 2 discipline.
 *  limbi (opțional): limbile în care se desparte rândul de limbi străine (vezi desparteLimbi_). */
function parsePlan_(v, limbi) {
  const out = []; let an = 0;
  for (let r = 0; r < v.length; r++) {
    const a = String(v[r][0] == null ? '' : v[r][0]).trim();
    const m = a.match(/^Anul\s+([IVX]+)$/);
    if (m) { an = ROMAN[m[1]] || 0; continue; }
    if (!an || !/Sem\s*\d+/.test(String(v[r][9] || '')) ) continue;   // rândul de antet cu „Sem N - 14 sapt”
    // antetul ocupă 3 rânduri; etichetele „Sem N - 14 sapt” sunt în J (sem. impar) și Q (sem. par) pe primul rând
    const sem = [String(v[r][9] || ''), String(v[r][16] || '')].map(t => { const x = t.match(/Sem\s*(\d+)/); return x ? +x[1] : null; });
    let lastEmise = [];
    for (let q = r + 3; q < v.length; q++) {
      const den = String(v[q][1] == null ? '' : v[q][1]).trim();
      if (!den) break;                                 // rândul de totaluri nu are denumire
      const cod = String(v[q][2] == null ? '' : v[q][2]).trim();
      const opt = String(v[q][3] == null ? '' : v[q][3]).trim();       // DOB / DOP / DFA
      const form = String(v[q][4] == null ? '' : v[q][4]).trim();      // DS / DF / DC (poate fi gol sau DC1…)
      const prec = String(v[q][5] == null ? '' : v[q][5]).trim();
      const emise = [];
      for (let s = 0; s < 2; s++) {
        const c0 = 6 + 7 * s;
        const hrs = [0, 1, 2, 3].map(k => v[q][c0 + k]);
        const cred = creditOf_(v[q][c0 + 6]);
        const hasHours = hrs.some(h => typeof h === 'number' && h !== 0);
        if (!(cred > 0 || hasHours) || !sem[s]) continue;
        const fe = String(v[q][c0 + 5] == null ? '' : v[q][c0 + 5]).replace(/[()*\s]/g, '');
        const rec = {
          cod: cod, den: den, an: an, sem: sem[s], cred: cred,
          forma: fe, tip: opt + (form ? '-' + form : ''), formativ: form.replace(/\d/g, ''),
          h: hrs.map(numOrEmpty_), prec: prec
        };
        desparteLimbi_(rec, limbi).forEach(x => { out.push(x); emise.push(x); });
      }
      // a doua variantă a unei perechi de opționale: rând cu denumire, fără cod și fără ore -> aceleași ore/credite ca rândul de sus
      if (!emise.length && opt === 'DOP' && !cod && lastEmise.length) {
        lastEmise.forEach(l => out.push(Object.assign({}, l, { cod: '', den: den, tip: opt + (form ? '-' + form : ''), formativ: form.replace(/\d/g, '') })));
      }
      if (emise.length) lastEmise = emise;
    }
  }
  return out;
}

/** Combină disciplinele din plan cu rândurile existente din DISCIPLINE (păstrează titulari, URL, departament, stări). */
function mergeDisc_(planRecs, oldRows) {
  const byKey = {}, byCod = {}, used = new Set();
  oldRows.forEach((o, i) => {
    const k = normKey_(o.cod, o.den); if (byKey[k] === undefined) byKey[k] = i;
    const c = norm_(o.cod); if (c) (byCod[c] = byCod[c] || []).push(i);
  });
  const free = j => j !== undefined && !used.has(j);
  const match = new Array(planRecs.length).fill(undefined);
  // 1) cod + denumire identice (fără diacritice) ; 2) același cod ; 3) aceeași denumire + semestru ;
  // 4) denumire care o conține pe cealaltă + același semestru (ex. „Limbi straine” ↔ „Limbi străine (Limba engleză)”)
  const passes = [
    p => { const j = byKey[normKey_(p.cod, p.den)]; return free(j) ? j : undefined; },
    p => (byCod[norm_(p.cod)] || []).find(j => free(j) && (oldRows[j].sem == p.sem || !oldRows[j].sem)),
    p => oldRows.findIndex((o, j) => free(j) && norm_(o.den) === norm_(p.den) && o.sem == p.sem),
    p => oldRows.findIndex((o, j) => { const a = norm_(o.den), b = norm_(p.den);
      return free(j) && o.sem == p.sem && a.length >= 5 && b.length >= 5 && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0); })
  ];
  passes.forEach(f => planRecs.forEach((p, n) => {
    if (match[n] !== undefined) return;
    if (!p.cod && f === passes[1]) return;
    let j = f(p); if (j === -1) j = undefined;
    if (free(j)) { match[n] = j; used.add(j); }
  }));
  const rows = planRecs.map((p, n) => {
    const o = match[n] !== undefined ? oldRows[match[n]] : null;
    return {
      cod: p.cod, den: p.den, an: p.an, sem: p.sem, cred: p.cred, forma: p.forma.replace(/\*/g, ''), tip: p.tip,
      h: p.h, formativ: p.formativ, prec: p.prec,
      url: o ? o.url : '', tit: o ? o.tit : ['', '', '', '', ''], dept: o ? o.dept : '',
      edit: o ? o.edit : '', stare: o ? o.stare : '', aviz: o ? o.aviz : '', data: o ? o.data : '', verif: o ? o.verif : '', sync: o ? o.sync : '',
      matched: !!o
    };
  });
  const orphans = oldRows.filter((o, i) => !used.has(i) && (o.url || o.tit.some(t => t)));
  return { rows: rows, orphans: orphans };
}

/* ===================== ACCES LA FOI ===================== */

function info_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH_INFO), v = sh.getDataRange().getValues();
  const param = {}; const dept = []; const forme = [];
  for (let i = 0; i < v.length; i++) {
    const a = String(v[i][0]).trim();
    if (a === 'DEPARTAMENT') { for (let j = i + 1; j < v.length && String(v[j][0]).trim() !== ''; j++) dept.push([v[j][0], v[j][1], v[j][2]]); }
    else if (a.indexOf('FORMA (') === 0) { for (let j = i + 1; j < v.length && String(v[j][0]).trim() !== ''; j++) forme.push([v[j][0], v[j][1]]); }
    else if (a && i > 0 && !param.hasOwnProperty(a)) param[a] = v[i][1];
  }
  return { param: param, dept: dept, forme: forme };
}

function readDisc_(sh) {
  const n = Math.max(sh.getLastRow() - 1, 1);
  const v = sh.getRange(2, 1, n, C_SYNC).getValues(); const out = [];
  v.forEach((r, i) => {
    if (!String(r[C_DEN - 1]).trim() && !String(r[C_COD - 1]).trim()) return;
    out.push({
      row: i + 2, cod: String(r[C_COD - 1]).trim(), den: String(r[C_DEN - 1]).trim(), an: r[C_AN - 1], sem: r[C_SEM - 1],
      cred: r[C_CRED - 1], forma: r[C_FORMA - 1], tip: r[C_TIP - 1], url: r[C_URL - 1],
      tit: [0, 1, 2, 3, 4].map(k => String(r[C_T1 - 1 + k] || '').trim()), dept: r[C_DEPT - 1],
      edit: r[C_EDIT - 1], stare: r[C_STARE - 1], aviz: r[C_AVIZ - 1], data: r[C_DATA - 1], verif: r[C_VERIF - 1], sync: r[C_SYNC - 1],
      h: [r[C_H_C - 1], r[C_H_S - 1], r[C_H_L - 1], r[C_H_P - 1]], formativ: r[C_FORMATIV - 1], prec: r[C_PREC - 1]
    });
  });
  return out;
}

function profs_() {                                    // nume afișat (col. M) -> {email, nume}
  const sh = SpreadsheetApp.getActive().getSheetByName(SH_PROF), n = Math.max(sh.getLastRow() - 1, 1);
  const v = sh.getRange(2, 1, n, 13).getDisplayValues(); const m = {};
  v.forEach(r => { const nm = String(r[12]).trim(); if (nm) m[nm] = { email: String(r[1]).trim(), nume: nm }; });
  return m;
}

function openFisa_(url) {                              // -> {ss, sh} sau null
  try {
    const ss = SpreadsheetApp.openByUrl(url), sh = ss.getSheetByName(SH_FISA);
    // structura nouă: datele din centralizator stau în foaia ascunsă _DATE (aceleași adrese de celule); fișele vechi le au în FISA
    // structura nouă: FISA (doar fișa, se tipărește direct) + PANOU (stare, aviz, competențe, verificare) + _DATE (ascunsă, datele din centralizator)
    // structura veche: totul în FISA (stare O5, aviz O6, banner A1)
    if (!sh) return null;
    const pn = ss.getSheetByName(SH_PANOU);
    return { ss: ss, sh: sh, dt: ss.getSheetByName(SH_DATE) || sh, pn: pn || sh,
             adr: pn ? { stare: 'B5', aviz: 'B6', banner: 'A1' } : { stare: 'O5', aviz: 'O6', banner: 'A1' } };
  } catch (e) { return null; }
}
function idFromUrl_(u) { const m = String(u).match(/\/d\/([a-zA-Z0-9_-]+)/); return m ? m[1] : ''; }
function alertSafe_(msg) { try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); } }

/* ===================== 1. PRELUARE DIN PLAN ===================== */

/** Limbile pentru care „Limbi străine” are rânduri separate: INFO → LIMBI_STRAINE (ex. „Limba engleză; Limba franceză”).
 *  Rândul lipsă sau gol = engleză și franceză; „NU” = un singur rând, nedespărțit. */
function limbiStraine_() {
  const p = info_().param;
  const v = String(p.hasOwnProperty('LIMBI_STRAINE') ? p['LIMBI_STRAINE'] : '').trim();
  if (/^nu$/i.test(v)) return [];
  return v ? v.split(/[;,]/).map(x => x.trim()).filter(x => x) : ['Limba engleză', 'Limba franceză'];
}

/** Sursa planului: INFO → PLAN_FISIER_URL (fișier extern; gol = fișierul curent) + PLAN_FOAIE_CURENTA (numele foii). */
function planSursa_() {
  const p = info_().param, url = String(p['PLAN_FISIER_URL'] || '').trim(), nume = String(p['PLAN_FOAIE_CURENTA'] || '').trim();
  if (!nume) return { eroare: 'În INFO, la PLAN_FOAIE_CURENTA, trebuie scris numele foii cu planul.' };
  let ss, unde;
  if (url) {
    try { ss = SpreadsheetApp.openByUrl(url); }
    catch (e) { return { eroare: 'Nu pot deschide fișierul din PLAN_FISIER_URL (link greșit sau fără drept de acces pentru contul tău):\n' + e }; }
    unde = '„' + nume + '” din fișierul extern „' + ss.getName() + '”';
  } else { ss = SpreadsheetApp.getActive(); unde = '„' + nume + '” (fișierul curent)'; }
  const sheet = ss.getSheetByName(nume);
  if (!sheet) return { eroare: 'Foaia „' + nume + '” nu există în ' + (url ? 'fișierul extern „' + ss.getName() + '”.' : 'fișierul curent.') + '\nVerifică INFO → PLAN_FOAIE_CURENTA.' };
  return { sheet: sheet, eticheta: unde };
}

function preiaDinPlan() { preiaDinPlan_(false); }

/** reset = true: ignoră lista existentă (nu păstrează titulari / URL-uri), pornește curat din plan. */
function preiaDinPlan_(reset, confirmat) {
  const ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActive();
  const src = planSursa_();
  if (src.eroare) { ui.alert(src.eroare); return; }
  const sp = src.sheet, numePlan = src.eticheta;
  const plan = parsePlan_(sp.getDataRange().getValues(), limbiStraine_());
  if (!plan.length) { ui.alert('Nu am găsit discipline în foaia ' + numePlan + '.'); return; }
  if (plan.length > DISC_ROWS) { ui.alert('Planul are ' + plan.length + ' discipline; lista are loc pentru ' + DISC_ROWS + '.'); return; }
  const sh = ss.getSheetByName(SH_DISC);
  const res = mergeDisc_(plan, reset ? [] : readDisc_(sh));
  const nrN = res.rows.filter(r => !r.matched).length, nrM = res.rows.length - nrN;
  const ok = confirmat ? true : reset
    ? confirma_('Resetare completă a listei DISCIPLINE', [
        'Se șterg TOATE rândurile din DISCIPLINE: titulari, departamente, URL-uri ale fișelor, stări, date de completare.',
        'Lista se reface din foaia ' + numePlan + ': ' + plan.length + ' discipline, fără niciun titular.',
        'Legătura cu fișele existente se pierde până la următorul „Generează URL/stare fișe”.'],
        ['Fișele din folder (nu se modifică niciun fișier de disciplină).', 'Foile PROFESORI, INFO, PLAN.'])
    : confirma_('Preluare discipline din PLAN', [
        'Se rescrie lista DISCIPLINE din foaia ' + numePlan + ' (' + plan.length + ' discipline: cod, denumire, an, semestru, credite, ore, formă, tip).',
        nrM + ' discipline existente își păstrează titularii, departamentul și legătura cu fișa; ' + nrN + ' sunt noi (fără titulari).',
        res.orphans.length ? res.orphans.length + ' rânduri vechi nu mai apar în plan; vei fi întrebat ce faci cu ele.' : 'Nu există rânduri vechi care să dispară din plan.'],
        ['Fișele din folder.', 'Foile PROFESORI, INFO, PLAN.']);
  if (!ok) return;
  if (res.orphans.length) {
    const del = ui.alert('Rânduri care nu mai sunt în plan',
      res.orphans.length + ' rânduri vechi (cu titulari sau URL) nu mai apar în plan.\n\n' +
      'DA = le șterg (listă curată, fără reziduri)\nNU = le păstrez la sfârșit, marcate „NU MAI E ÎN PLAN”', ui.ButtonSet.YES_NO);
    if (del === ui.Button.YES) res.orphans = [];
  }

  scrieLista_(res);
  ui.alert('Gata: ' + res.rows.length + ' discipline preluate din ' + numePlan + '.');
}

/** Scrie lista DISCIPLINE (fără interfață – poate rula și din declanșator). */
function scrieLista_(res) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH_DISC);
  const n = res.rows.length + res.orphans.length;
  const base = [], extra = [], tit = [];
  const asRow = (r, orphan) => {
    base.push([r.cod, r.den, r.an, r.sem, r.cred, r.forma, r.tip, r.url]);
    tit.push(r.tit.concat([r.dept]));
    extra.push([r.h[0], r.h[1], r.h[2], r.h[3], r.formativ, r.prec, r.data, orphan ? 'NU MAI E ÎN PLAN' : r.verif, r.sync]);
  };
  res.rows.forEach(r => asRow(r, false));
  res.orphans.forEach(r => asRow(r, true));
  // șterge doar valorile din coloanele de intrare (formulele din O, S, T rămân)
  sh.getRange(2, C_COD, DISC_ROWS, C_URL).clearContent();
  sh.getRange(2, C_T1, DISC_ROWS, 6).clearContent();
  sh.getRange(2, C_H_C, DISC_ROWS, 9).clearContent();
  sh.getRange(2, C_COD, n, C_URL).setValues(base);
  sh.getRange(2, C_T1, n, 6).setValues(tit);
  sh.getRange(2, C_H_C, n, 9).setValues(extra);
  sh.getRange(1, C_H_C, 1, 9).setValues([DISC_HEADERS_NEW]);
  setValidari_();
}

/** Resetare completă din plan, fără interfață (apelată după ce backup-ul e complet și verificat). */
function resetCompletDinPlan_() {
  const src = planSursa_();
  if (src.eroare) throw new Error(src.eroare);
  const plan = parsePlan_(src.sheet.getDataRange().getValues(), limbiStraine_());
  if (!plan.length) throw new Error('Nu am găsit discipline în planul ' + src.eticheta);
  if (plan.length > DISC_ROWS) throw new Error('Planul are ' + plan.length + ' discipline; lista are loc pentru ' + DISC_ROWS + '.');
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).forEach(k => { if (k === 'done' || k === 'done_t' || k.indexOf('ts_') === 0) props.deleteProperty(k); });
  scrieLista_(mergeDisc_(plan, []));
  scrieNelegate_([], []);
  return plan.length;
}

/** AN NOU: BACKUP complet (fișe + centralizatorul) „BACKUP AN NOU [an]”, apoi – numai dacă backup-ul e complet – resetarea listei din plan. */
function anNou() {
  const ui = SpreadsheetApp.getUi(), src = planSursa_();
  if (src.eroare) { ui.alert(src.eroare); return; }
  const plan = parsePlan_(src.sheet.getDataRange().getValues(), limbiStraine_());
  if (!plan.length) { ui.alert('Nu am găsit discipline în planul ' + src.eticheta + '.'); return; }
  const an = String(info_().param['AN_UNIVERSITAR'] || '').trim() || String(new Date().getFullYear());
  const nume = 'BACKUP AN NOU ' + an;
  const ok = confirma_('AN NOU – backup complet, apoi resetare', [
    '1. Se face întâi BACKUP complet (toate fișele + centralizatorul) în folderul „' + nume + '”, în folderul fișelor.',
    '2. NUMAI după ce backup-ul e complet și verificat (număr copii = număr surse), lista DISCIPLINE se șterge COMPLET (titulari, departamente, URL-uri, stări, date) și se reface din planul ' + src.eticheta + ': ' + plan.length + ' discipline, fără titulari.',
    '3. Se șterge memoria scriptului (progres, marcaje de refresh) și foaia NELEGATE.',
    'Dacă backup-ul durează mai mult de ~5 minute, continuă singur în fundal; resetarea se face automat la final, iar tu primești un email cu raportul. Dacă backup-ul nu e complet, resetarea NU se face.',
    'Înainte: verifică în INFO planul (PLAN_FISIER_URL, PLAN_FOAIE_CURENTA) și FOLDER_FISE. Lasă AN_UNIVERSITAR neschimbat până după AN NOU (dă numele backup-ului); apoi schimbă-l și rulează „Actualizează FD”.'],
    ['Fișele originale din folder.', 'Foile PROFESORI, INFO, PLAN.']);
  if (!ok) return;
  backupPorneste_({ nume: nume, dupa: 'ANNOU', confirmat: true });
}

function setValidari_() {                              // dropdown cu autocompletare din PROFESORI!M
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(SH_DISC);
  const rng = ss.getSheetByName(SH_PROF).getRange('M2:M401');
  const rule = SpreadsheetApp.newDataValidation().requireValueInRange(rng, true).setAllowInvalid(true)
    .setHelpText('Alege din lista de profesori (scrie câteva litere ca să filtrezi). Poți scrie și alt nume.').build();
  sh.getRange(2, C_T1, DISC_ROWS, 5).setDataValidation(rule);
  const d = ss.getSheetByName(SH_INFO);
  const dd = SpreadsheetApp.newDataValidation().requireValueInRange(d.getRange('A33:A34'), true).setAllowInvalid(true).build();
  sh.getRange(2, C_DEPT, DISC_ROWS, 1).setDataValidation(dd);
}

/** Avertisment standard înainte de operațiile importante: ce se va întâmpla + ce NU se atinge. OK = continuă, Anulare = nu se face nimic. */
function confirma_(titlu, vaFace, nuAtinge) {
  const ui = SpreadsheetApp.getUi();
  const txt = 'CE SE VA ÎNTÂMPLA:\n' + vaFace.map(x => '  • ' + x).join('\n') +
    (nuAtinge && nuAtinge.length ? '\n\nCE NU SE MODIFICĂ:\n' + nuAtinge.map(x => '  • ' + x).join('\n') : '') +
    '\n\nApasă OK pentru a continua sau Anulare pentru a renunța (nu se modifică nimic).';
  return ui.alert('⚠ ' + titlu, txt, ui.ButtonSet.OK_CANCEL) === ui.Button.OK;
}

/* ===================== 2. REFRESH LISTĂ DIN FIȘE ===================== */

/** Folderul cu fișe: INFO → FOLDER_FISE (link sau ID); dacă e gol, folderul în care se află centralizatorul. */
function folderFise_() {
  const v = String(info_().param['FOLDER_FISE'] || '').trim();
  if (v) {
    const m = v.match(/folders\/([\w-]+)/) || v.match(/[?&]id=([\w-]+)/) || v.match(/^([\w-]{20,})$/);
    if (!m) throw new Error('FOLDER_FISE din INFO nu este un link sau ID valid de folder Drive.');
    return DriveApp.getFolderById(m[1]);
  }
  return DriveApp.getFileById(SpreadsheetApp.getActive().getId()).getParents().next();
}
/** Toate fișierele Google Sheets din folder și din subfoldere. */
function* sheetsInFolder_(folder) {
  const it = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (it.hasNext()) yield it.next();
  const sub = folder.getFolders();
  while (sub.hasNext()) { const f = sub.next(); if (/^BACKUP/i.test(f.getName())) continue; yield* sheetsInFolder_(f); }   // folderele BACKUP nu se citesc
}

function refreshManual() {
  if (ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'refreshContinua')) { alertSafe_('O rulare „Generează URL/stare fișe” este deja în curs (continuă în fundal). Vei primi email la final.'); return; }
  const nAleg = alegeriNelegate_();
  if (!confirma_('Generează URL/stare fișe', [
    'Se deschid toate fișele din folder (și subfoldere, fără folderele BACKUP) și se citesc: stare, aviz, data completării, verificare.',
    'În DISCIPLINE se (re)scriu coloanele URL, ultima editare, stare, aviz, data completării, verificare, ultimul refresh.',
    nAleg ? nAleg + ' fișe au disciplina aleasă în foaia NELEGATE: URL-ul lor se scrie în DISCIPLINE înainte de citire.'
          : 'Fișele care nu se pot lega automat sunt trecute în foaia NELEGATE (fond roz); alegi acolo disciplina, iar la următoarea rulare se leagă singure.',
    'Dacă durează mai mult de ~5 minute, continuă singur în fundal și primești email la final.'],
    ['Fișele (doar citire).', 'Titularii și celelalte coloane din DISCIPLINE.'])) return;
  if (nAleg) aplicaLegaturi_();
  PropertiesService.getScriptProperties().setProperty('rf_me', Session.getEffectiveUser().getEmail());
  refreshFise_(true, true);
}
function refreshContinua() { refreshFise_(false, false); }       // continuare în fundal (sare peste fișele deja citite)

function refreshFise_(fortat, interactiv) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { if (interactiv) alertSafe_('Un alt refresh rulează deja.'); return; }
  try {
    const t0 = Date.now(), ss = SpreadsheetApp.getActive(), centralizatorId = ss.getId();
    const sh = ss.getSheetByName(SH_DISC), rows = readDisc_(sh);
    const byKey = {}; rows.forEach(r => { byKey[normKey_(r.cod, r.den)] = r; });
    const byUrlId = {}; rows.forEach(r => { const id = idFromUrl_(r.url); if (id) byUrlId[id] = r; });
    const props = PropertiesService.getScriptProperties();
    const it = sheetsInFolder_(folderFise_());
    const byCod = {}, byDen = {};
    rows.forEach(r => {
      const c = norm_(r.cod), d = norm_(r.den);
      if (c) byCod[c] = byCod[c] ? 'dublu' : r;
      if (d) byDen[d] = byDen[d] ? 'dublu' : r;
    });
    const log = { citite: 0, sarite: 0, nelegate: [], erori: [], oprit: false };
    const nelegateRows = [];
    const now = new Date();
    for (const f of it) {
      const id = f.getId();
      if (id === centralizatorId) continue;
      if (Date.now() - t0 > T_LIMIT_MS) { log.oprit = true; break; }
      const upd = f.getLastUpdated().getTime();
      let rec = byUrlId[id];
      // sărim peste fișele neschimbate de la ultimul refresh (cu excepția refreshului forțat)
      if (rec && !fortat && Number(props.getProperty('ts_' + id)) === upd) { log.sarite++; continue; }
      try {
        const ff = openFisa_(f.getUrl());
        if (!ff) continue;                                           // alt fel de fișier (raport etc.)
        const sh2 = ff.sh;
        const dt = ff.dt, dd = dt.getRange('O3:O10').getValues().map(x => x[0]), pan = [[ff.pn.getRange(ff.adr.stare).getValue()], [ff.pn.getRange(ff.adr.aviz).getValue()]];
        const vals = [dd[0], dd[1], pan[0][0], pan[1][0], '', '', '', dd[7]];   // [centralizator, cod, stare, aviz, …, cheie]; cod/cheie din _DATE, stare/aviz din panoul fișei
        const cheie = String(vals[7]).trim();
        if (!rec) {
          // rândul propriu al fișei în tabelul tehnic (fișele vechi conțin tot planul; cel nou, un singur rând) – găsit după cheie
          const tab = dt.getRange('X4:AL500').getValues(), pr = tab.find(x => String(x[14]).trim() === cheie) || tab[0];
          rec = potrivesteFisa_({ cheie: cheie, cod: vals[1], den: '', sem: pr[3] }, rows, id);
        }
        if (!rec) { log.nelegate.push(f.getName() + (cheie ? ' [' + cheie + ']' : '')); nelegateRows.push([f.getName(), f.getUrl(), cheie, '']); continue; }
        const data = sh2.getRange('B68').getDisplayValue();
        const banner = String(ff.pn.getRange(ff.adr.banner).getDisplayValue() || '').trim();
        const r = rec.row;
        sh.getRange(r, C_URL).setValue(f.getUrl());
        sh.getRange(r, C_EDIT).setValue(f.getLastUpdated());
        sh.getRange(r, C_STARE).setValue(vals[2]);
        sh.getRange(r, C_AVIZ).setValue(vals[3]);
        sh.getRange(r, C_DATA, 1, 3).setValues([[data, banner, now]]);
        props.setProperty('ts_' + id, String(upd));
        rec.url = f.getUrl(); byUrlId[id] = rec;
        log.citite++;
      } catch (e) { log.erori.push(f.getName() + ': ' + e); }
    }
    if (!log.oprit) scrieNelegate_(nelegateRows, rows);
    stergeTriggere_('refreshContinua');
    if (log.oprit) programeazaContinuare_('refreshContinua');
    else PropertiesService.getScriptProperties().deleteProperty('rf_me_activ');
    if (interactiv) {
      let msg = 'Fișe citite: ' + log.citite + (log.sarite ? ' (neschimbate, sărite: ' + log.sarite + ')' : '') + '.';
      if (log.oprit) msg += '\nS-a atins limita de timp Google. Restul fișelor se citesc singure în fundal (nu e nevoie să apeși din nou); la final primești email cu raportul.';
      if (log.nelegate.length) msg += '\n\n' + log.nelegate.length + ' fișe nu s-au putut lega automat. Le găsești în foaia NELEGATE (fond roz): alege disciplina din listă; la următoarea rulare a „Generează URL/stare fișe” legătura se aplică automat.\n' + log.nelegate.slice(0, 15).join('\n');
      if (log.erori.length) msg += '\n\nErori:\n' + log.erori.join('\n');
      alertSafe_(msg);
    } else if (!log.oprit) {
      const me = PropertiesService.getScriptProperties().getProperty('rf_me');
      if (me) MailApp.sendEmail(me, 'Generează URL/stare fișe – terminat', 'Rulare terminată în fundal.\nFișe citite în această rundă: ' + log.citite + (log.sarite ? ' (sărite, deja citite: ' + log.sarite + ')' : '') + '.' +
        (log.nelegate.length ? '\n\nFișe nelegate (' + log.nelegate.length + '), vezi foaia NELEGATE din centralizator:\n' + log.nelegate.join('\n') : '') +
        (log.erori.length ? '\n\nErori:\n' + log.erori.join('\n') : ''));
      PropertiesService.getScriptProperties().deleteProperty('rf_me');
    }
  } finally { lock.releaseLock(); }
}

const SH_NELEG = 'NELEGATE';
/** Foaia NELEGATE: fișierele din folder care nu s-au putut lega automat; la F alegi disciplina din listă (rânduri fără URL). */
function scrieNelegate_(nel, rows) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SH_NELEG);
  if (!nel.length) { if (sh) { sh.clear(); sh.setConditionalFormatRules([]); sh.getRange(1, 1).setValue('Toate fișele sunt legate de listă.'); } return; }
  if (!sh) sh = ss.insertSheet(SH_NELEG);
  const vechi = {}; // păstrează alegerile făcute deja
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().forEach(r => { if (r[3]) vechi[r[1]] = r[3]; });
  sh.clear();
  sh.getRange(1, 1, 1, 4).setValues([['Fișier (nelegat)', 'URL', 'Cheie din fișă (cod | denumire)', 'ALEGE DISCIPLINA din listă (cod | denumire)']]).setFontWeight('bold').setBackground('#fff2cc');
  nel.forEach(r => { r[3] = vechi[r[1]] || ''; });
  sh.getRange(2, 1, nel.length, 4).setValues(nel);
  const opt = rows.filter(r => !r.url).map(r => r.cod + ' | ' + r.den);
  if (opt.length) sh.getRange(2, 4, nel.length, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(opt, true).setAllowInvalid(false).build());
  sh.setColumnWidths(1, 3, 280); sh.setColumnWidth(4, 420); sh.setFrozenRows(1);
  // fond roz cât timp fișa nu are disciplina aleasă
  sh.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($A2<>"",$D2="")').setBackground('#F8BBD0').setRanges([sh.getRange('A2:D1000')]).build()]);
}

/** Câte fișe nelegate au disciplina aleasă în NELEGATE (coloana D). */
function alegeriNelegate_() {
  const nel = SpreadsheetApp.getActive().getSheetByName(SH_NELEG);
  if (!nel || nel.getLastRow() < 2) return 0;
  return nel.getRange(2, 1, nel.getLastRow() - 1, 4).getValues().filter(r => r[1] && r[3]).length;
}
/** Scrie în DISCIPLINE URL-urile fișelor legate manual în NELEGATE (fără interfață). */
function aplicaLegaturi_() {
  const ss = SpreadsheetApp.getActive(), nel = ss.getSheetByName(SH_NELEG), disc = ss.getSheetByName(SH_DISC);
  if (!nel || nel.getLastRow() < 2) return 0;
  const v = nel.getRange(2, 1, nel.getLastRow() - 1, 4).getValues().filter(r => r[1] && r[3]);
  const rows = readDisc_(disc), erori = []; let n = 0;
  v.forEach(r => {
    const rec = rows.find(x => (x.cod + ' | ' + x.den) === r[3]);
    if (!rec) { erori.push(r[0] + ' → „' + r[3] + '” nu mai există în listă'); return; }
    disc.getRange(rec.row, C_URL).setValue(r[1]); rec.url = r[1]; n++;
  });
  SpreadsheetApp.flush();
  if (erori.length) alertSafe_('Legături nereușite:\n' + erori.join('\n'));
  return n;
}

/* ===================== 3. ACTUALIZEAZĂ FD (centralizator → fișe) ===================== */

/** Grupa din fișă a unui cod: CN/AP/RA (cunoștințe / aptitudini / responsabilitate). Coduri vechi CN01, AP12, RA05;
 *  coduri noi (ARACIS) C1–C8, A1–A8, R1–R8. Altceva = ''. */
function grupaCod_(cod) {
  const c = String(cod || '').trim();
  if (/^(CN|AP|RA)\d+$/.test(c)) return c.substring(0, 2);
  const m = c.match(/^([CAR])\d+$/);
  return m ? { C: 'CN', A: 'AP', R: 'RA' }[m[1]] : '';
}

/** Trecerea codurilor vechi din panoul unei fișe la lista nouă. slots = 3 rânduri × 5 coduri (C, A, R), manual = 3 texte
 *  (Specificări manuale), mapare = {COD_VECHI: {noi: ['C1', …], text, renunta}}. Codurile vechi devin codurile noi
 *  (în rândul categoriei lor); textele proprii ale disciplinei se adaugă la Specificări manuale, ca să nu se piardă.
 *  Rulat a doua oară nu mai schimbă nimic (codurile noi nu au forma celor vechi). */
function migreazaCompetente_(slots, manual, mapare) {
  const grupe = ['CN', 'AP', 'RA'], noi = [[], [], []], man = manual.map(t => String(t || '').trim());
  const log = { convertite: 0, mutate: 0, renuntate: 0, necunoscute: [], depasite: [] };
  const pune = (cod, k) => { if (noi[k].indexOf(cod) < 0) noi[k].push(cod); };
  slots.forEach((rand, k) => rand.forEach(c => {
    const cod = String(c || '').trim();
    if (!cod) return;
    const m = /^(CN|AP|RA)\d+$/.test(cod) ? mapare[cod] : null;
    if (!m) { if (/^(CN|AP|RA)\d+$/.test(cod)) log.necunoscute.push(cod); pune(cod, k); return; }
    log.convertite++;
    if (m.noi && m.noi.length) { m.noi.forEach(n => pune(n, grupe.indexOf(grupaCod_(n)))); return; }
    if (m.renunta) { log.renuntate++; return; }
    const t = String(m.text || '').trim();
    if (t && man[k].indexOf(t) < 0) { man[k] = man[k] ? man[k] + '\n' + t : t; log.mutate++; }
  }));
  noi.forEach((a, k) => { if (a.length > 5) log.depasite.push(grupe[k] + ': ' + a.slice(5).join(', ')); });
  return { slots: noi.map(a => a.slice(0, 5).concat(['', '', '', '', '']).slice(0, 5)), manual: man, log: log };
}

/** Foaia COMPETENTE_VECHI din centralizator (COD VECHI | COD NOU | CUM | TEXT VECHI) → mapare pentru migreazaCompetente_; null dacă lipsește. */
function competenteVechi_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('COMPETENTE_VECHI');
  if (!sh || sh.getLastRow() < 2) return null;
  const m = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().forEach(r => {
    const cod = String(r[0]).trim(); if (!cod) return;
    m[cod] = { noi: String(r[1]).match(/\b[CAR]\d+\b/g) || [], text: r[3], renunta: /renun/i.test(String(r[1])) };
  });
  return m;
}

function competente_() {
  const v = SpreadsheetApp.getActive().getSheetByName(SH_COMP).getDataRange().getValues();
  const g = { CN: [], AP: [], RA: [] };
  for (let i = 1; i < v.length; i++) {
    const cod = String(v[i][0]).trim(), p = grupaCod_(cod);
    if (p) g[p].push([cod, v[i][1], v[i][2]]);
  }
  ['CN', 'AP', 'RA'].forEach(p => { if (g[p].length > 60) throw new Error('Mai mult de 60 de coduri ' + p + ' (limita fișei).'); });
  return g;
}

function stergeTriggere_(handler) {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t); });
}
function programeazaContinuare_(handler) {            // o rulare unică peste ~1 minut (fără interfață)
  stergeTriggere_(handler);
  ScriptApp.newTrigger(handler).timeBased().after(60 * 1000).create();
}

function actualizeazaFisele() {
  const ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActive();
  const rows = readDisc_(ss.getSheetByName(SH_DISC)).filter(r => r.url);
  if (!rows.length) { ui.alert('Nicio disciplină nu are URL de fișă. Rulează întâi „Generează URL/stare fișe”.'); return; }
  if (ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'actualizeazaContinua')) {
    ui.alert('O rulare „Actualizează FD” este deja în curs (continuă în fundal). Vei primi email la final.'); return;
  }
  const props = PropertiesService.getScriptProperties();
  const done = JSON.parse(props.getProperty('done') || '{}'), nDone = Object.keys(done).length;
  if (nDone > 0) {
    const t = Number(props.getProperty('done_t')) ? Utilities.formatDate(new Date(Number(props.getProperty('done_t'))), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm') : '?';
    const q = ui.alert('⚠ Actualizează FD – rulare neterminată',
      'O actualizare începută la ' + t + ' nu a fost dusă până la capăt: ' + nDone + ' din ' + rows.length + ' fișe sunt deja făcute.\n\n' +
      'DA = continuă cu fișele rămase (cele făcute se sar)\n' +
      'NU = reia de la zero (rescrie TOATE fișele, cu datele actuale din centralizator)\n' +
      'Anulare = nu face nimic', ui.ButtonSet.YES_NO_CANCEL);
    if (q === ui.Button.YES) { /* continuă */ }
    else if (q === ui.Button.NO) { props.deleteProperty('done'); props.deleteProperty('done_t'); props.deleteProperty('au_mig'); }
    else return;
  }
  if (nDone === 0 || !props.getProperty('done')) {
    if (!confirma_('Actualizează FD', [
      'Se rescriu în ' + rows.length + ' fișe (cele cu URL în DISCIPLINE): link-ul centralizatorului, cod/cheie, blocul INFO (universitate, facultate, decan, ore/credit etc.), departament și director, tabelul de forme, rândul disciplinei din plan (ore, credite, formă, tip, titulari) – tabelul tehnic al planului se reduce la UN SINGUR RÂND, al acestei discipline (celelalte rânduri din plan, copiate în fișele vechi, se șterg) – și catalogul de competențe.',
      'Orice modificare făcută manual în aceste celule tehnice se pierde. Textele completate de profesori (obiective, conținut, bibliografie etc.) nu se ating.',
      'În foaia FISA: comentarii pe câmpurile completate automat și semnul ⓘ în coloana M, cu link la instrucțiuni (INFO → SITE_INSTRUCTIUNI). Nu apar în PDF.',
      'Dacă centralizatorul are foaia COMPETENTE_VECHI: codurile de competențe alese de profesori în PANOU (CN.., AP.., RA..) se schimbă în codurile noi ARACIS (C1–C8, A1–A8, R1–R8); textele proprii ale disciplinei se mută la „Specificări manuale”, nu se pierd.',
      'Dacă durează mai mult de ~5 minute, continuă singur în fundal și primești email la final.'],
      ['Textele completate de profesori.', 'Foile centralizatorului.'])) return;
  }
  props.setProperty('au_me', Session.getEffectiveUser().getEmail());
  actualizeazaRuleaza_(true);
}
function actualizeazaContinua() { actualizeazaRuleaza_(false); }

function actualizeazaRuleaza_(interactiv) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { if (interactiv) alertSafe_('Alta rulare „Actualizează FD” este în curs.'); return; }
  try {
    const t0 = Date.now(), ss = SpreadsheetApp.getActive(), props = PropertiesService.getScriptProperties();
    stergeTriggere_('actualizeazaContinua');
    const info = info_(), comp = competente_(), mapare = competenteVechi_();
    const rows = readDisc_(ss.getSheetByName(SH_DISC)).filter(r => r.url);
    const done = JSON.parse(props.getProperty('done') || '{}');
    if (!props.getProperty('done_t')) props.setProperty('done_t', String(Date.now()));
    const log = { ok: 0, erori: [], oprit: false };
    const mig = JSON.parse(props.getProperty('au_mig') || '{"fise":0,"mutate":0,"renuntate":0,"atentie":[]}');
    for (const r of rows) {
      const id = idFromUrl_(r.url);
      if (!id || done[id]) continue;
      if (Date.now() - t0 > T_LIMIT_MS) { log.oprit = true; break; }
      try {
        const ff = openFisa_(r.url);
        if (!ff) { log.erori.push(r.cod + ' ' + r.den + ': fișierul nu are foaia FISA'); done[id] = 1; continue; }
        const lg = scrieInFisa_(ff, r, ss.getUrl(), info, comp, mapare);
        if (lg && lg.convertite) {
          mig.fise++; mig.mutate += lg.mutate; mig.renuntate += lg.renuntate;
          if (lg.depasite.length || lg.necunoscute.length) mig.atentie.push(r.cod + ' ' + r.den + ': ' +
            (lg.depasite.length ? 'peste 5 coduri, nu au încăput ' + lg.depasite.join('; ') : '') +
            (lg.necunoscute.length ? ' coduri vechi necunoscute ' + lg.necunoscute.join(', ') : ''));
        }
        SpreadsheetApp.flush(); done[id] = 1; log.ok++;
        props.setProperty('done', JSON.stringify(done));
        props.setProperty('au_mig', JSON.stringify(mig));
      } catch (e) { log.erori.push(r.cod + ' ' + r.den + ': ' + e); }
    }
    props.setProperty('done', JSON.stringify(done));
    const total = Object.keys(done).length;
    let msg;
    if (log.oprit) {
      programeazaContinuare_('actualizeazaContinua');
      msg = 'Actualizate până acum: ' + total + ' din ' + rows.length + ' fișe. S-a atins limita de timp Google; restul se fac singure în fundal (nu e nevoie să apeși din nou), iar la final primești email cu raportul.';
    } else {
      msg = 'Gata – ' + total + ' fișe actualizate.';
      if (mig.fise) msg += '\n\nCompetențe: în ' + mig.fise + ' fișe codurile vechi au trecut la lista nouă (ARACIS). ' +
        mig.mutate + ' texte proprii ale disciplinelor au fost mutate la „Specificări manuale”; ' + mig.renuntate + ' coduri fără conținut de RÎ au fost scoase.' +
        (mig.atentie.length ? '\nDe verificat:\n' + mig.atentie.join('\n') : '');
      props.deleteProperty('done'); props.deleteProperty('done_t'); props.deleteProperty('au_mig');
    }
    if (log.erori.length) msg += '\n\nErori:\n' + log.erori.join('\n');
    if (interactiv) alertSafe_(msg);
    else if (!log.oprit) { const me = props.getProperty('au_me'); if (me) MailApp.sendEmail(me, 'Actualizează FD – terminat', msg); }
    if (!log.oprit) props.deleteProperty('au_me');
  } finally { lock.releaseLock(); }
}

function rcDinA1_(a) {                               // 'K31' → [31, 11]
  const m = String(a).match(/^([A-Z]+)(\d+)$/); let c = 0;
  for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64;
  return [Number(m[2]), c];
}
/** Comentariile și linkurile de ajutor ale fișei (fără Google): {note: {'E15': text, …}, linkuri: [[formulă], …] pe rândurile 1..AJ_RAND_MAX}. */
function ajutorFisa_(site) {
  const baza = String(site).replace(/#.*$/, ''), url = a => baza + '#' + a;
  const note = {};
  AJUTOR_NOTE.forEach(([cel, anc, ce, sursa]) => cel.forEach(c => {
    note[c] = 'Completat automat din ' + sursa + '.\n' + ce + '.\nNu se modifică aici; o greșeală se corectează în fișierul „Centralizator discipline și titulari ARH” (apare la următorul „Actualizează FD”).\nDetalii: ' + url(anc);
  }));
  const linkuri = [];
  for (let r = 1; r <= AJ_RAND_MAX; r++) linkuri.push([AJUTOR_LINKURI[r] ? '=HYPERLINK("' + url(AJUTOR_LINKURI[r]) + '","ⓘ")' : '']);
  return { note: note, linkuri: linkuri };
}
/** Pune în foaia FISA comentariile (păstrează alte comentarii existente) și coloana M cu „ⓘ”. Nu apar în PDF:
 *  exportul ia doar A:L și fără comentarii (vezi pdfUrl_). */
function puneAjutor_(sh, site) {
  const aj = ajutorFisa_(site);
  const rng = sh.getRange(1, 1, AJ_RAND_MAX, 12), note = rng.getNotes();
  Object.keys(aj.note).forEach(a => { const rc = rcDinA1_(a); note[rc[0] - 1][rc[1] - 1] = aj.note[a]; });
  rng.setNotes(note);
  const m = sh.getRange(1, 13, AJ_RAND_MAX, 1);
  m.setFormulas(aj.linkuri);
  m.setFontColor('#8a3b12').setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('top');
  sh.setColumnWidth(13, 28);
}

/** Scrie în fișă datele din centralizator. ff = {sh: foaia FISA, dt: foaia _DATE (la fișele vechi, aceeași cu FISA)}.
 *  Celulele tehnice (centralizator, cod, cheie, INFO, departamente, forme, rândul din plan, competențe) merg în dt; departamentul (B10) rămâne în FISA. */
function scrieInFisa_(ff, r, centralizatorUrl, info, comp, mapare) {
  const sh = ff.sh, dt = ff.dt, cheie = r.cod + ' | ' + r.den;
  if (dt === sh) sh.getRange('N1').setValue('ZONA TEHNICĂ – nu se tipărește și nu se modifică manual. Se completează automat din „Centralizator discipline și titulari ARH” (butonul „Actualizează FD”).');
  dt.getRange('O3').setValue(centralizatorUrl);
  dt.getRange('O4').setValue(r.cod);
  dt.getRange('O10').setValue(cheie);
  // INFO: potrivire pe etichetele din N12:N28
  const lab = dt.getRange('N12:N28').getValues(), rng = dt.getRange('O12:O28'), val = rng.getValues();
  for (let i = 0; i < lab.length; i++) {
    const k = String(lab[i][0]).trim();
    if (k && info.param.hasOwnProperty(k) && info.param[k] !== '') val[i][0] = info.param[k];
  }
  rng.setValues(val);
  if (info.dept.length) { const x = dt.getRange(12, 17, 2, 3), c = x.getValues(); for (let i = 0; i < 2; i++) if (info.dept[i]) c[i] = info.dept[i]; x.setValues(c); }
  if (info.forme.length) { const x = dt.getRange(12, 21, 4, 2), c = x.getValues(); for (let i = 0; i < 4; i++) if (info.forme[i]) c[i] = info.forme[i]; x.setValues(c); }
  // rândul disciplinei (X3:AL4) – tabelul planului se reduce la UN SINGUR RÂND
  const join = a => a.filter(t => t).join(', ');
  const planRow = [r.cod, r.den, r.an, r.sem, r.cred, r.h[0] || 0, r.h[1] || 0, r.h[2] || 0, r.h[3] || 0, 0,
    r.forma, r.tip, join(r.tit.slice(0, 2)), join(r.tit.slice(2)), cheie];
  dt.getRange('X4:AL500').clearContent();
  dt.getRange(4, 24, 1, 15).setValues([planRow]);
  if (r.dept) sh.getRange('B10').setValue(r.dept);
  // catalog competențe: CN 4–63, AP 64–123, RA 124–183
  dt.getRange('AM4:AO183').clearContent();
  [['CN', 4], ['AP', 64], ['RA', 124]].forEach(a => { if (comp[a[0]].length) dt.getRange(a[1], 39, comp[a[0]].length, 3).setValues(comp[a[0]]); });
  // comentarii pe câmpurile automate și „ⓘ” cu link la instrucțiuni (coloana M, nu se tipărește); doar la fișele cu PANOU
  if (ff.pn && ff.pn !== ff.sh) puneAjutor_(sh, String(info.param['SITE_INSTRUCTIUNI'] || '').trim() || SITE_IMPLICIT);
  // codurile alese de profesor (PANOU B32:F34) trec la lista nouă; doar la fișele cu PANOU
  if (!mapare || ff.pn === ff.sh) return null;
  const rng2 = ff.pn.getRange('B32:G34'), v = rng2.getValues();
  const res = migreazaCompetente_(v.map(x => x.slice(0, 5)), v.map(x => x[5]), mapare);
  if (!res.log.convertite) return res.log;
  rng2.setValues(res.slots.map((x, k) => x.concat([res.manual[k]])));
  return res.log;
}

/* ===================== 5. DREPTURI ȘI 6. EMAIL ===================== */

function titulariPeFisa_() {                           // rânduri cu URL + lista titularilor (cu email)
  const pr = profs_(), info = info_(), out = [];
  readDisc_(SpreadsheetApp.getActive().getSheetByName(SH_DISC)).forEach(r => {
    if (!r.url) return;
    const emails = [], lipsa = [];
    r.tit.forEach(t => { if (!t) return; const p = pr[t]; if (p && p.email) emails.push(p.email); else lipsa.push(t); });
    const dir = info.dept.filter(d => d[0] === r.dept).map(d => String(d[2] || '').trim()).filter(x => x);
    out.push({ r: r, emails: emails, lipsa: lipsa, dir: dir });
  });
  return out;
}

function acordaDrepturi() {
  const ui = SpreadsheetApp.getUi(), lst = titulariPeFisa_(); let n = 0; const erori = [], lipsa = {};
  if (!confirma_('Acordare drepturi de editare', [
    'În ' + lst.length + ' fișe (cele cu URL), titularii (din DISCIPLINE, cu email în PROFESORI) și directorul departamentului sunt adăugați ca EDITORI în Google Drive.',
    'Google poate trimite notificări prin email persoanelor adăugate.',
    'Drepturile acordate nu sunt retrase de acest script (se retrag manual din Drive).'],
    ['Drepturile existente.', 'Conținutul fișelor.'])) return;
  lst.forEach(x => {
    try {
      const f = DriveApp.getFileById(idFromUrl_(x.r.url));
      const existenti = f.getEditors().map(e => e.getEmail().toLowerCase());
      x.emails.concat(x.dir).forEach(em => { if (em && existenti.indexOf(em.toLowerCase()) < 0) { f.addEditor(em); n++; } });
      x.lipsa.forEach(t => { lipsa[t] = 1; });
    } catch (e) { erori.push(x.r.cod + ' ' + x.r.den + ': ' + e); }
  });
  ui.alert('Au fost adăugați ' + n + ' editori.' + (Object.keys(lipsa).length ? '\n\nTitulari fără email în PROFESORI:\n' + Object.keys(lipsa).join('\n') : '') +
    (erori.length ? '\n\nErori:\n' + erori.join('\n') : ''));
}

function trimiteTest() { trimiteFise_(true); }
function trimiteReal() { trimiteFise_(false); }

function trimiteFise_(test) {
  const ui = SpreadsheetApp.getUi(), lst = titulariPeFisa_(), pe = {}, fara = {}, pr = profs_();
  lst.forEach(x => {
    x.r.tit.forEach(t => {
      if (!t) return; const p = pr[t];
      if (!p || !p.email) { fara[t] = 1; return; }
      (pe[p.email] = pe[p.email] || { nume: t, fise: [] }).fise.push(x.r);
    });
  });
  const dest = Object.keys(pe);
  if (!dest.length) { ui.alert('Niciun destinatar (verifică emailurile din PROFESORI și URL-urile din DISCIPLINE).'); return; }
  const me = Session.getActiveUser().getEmail();
  const ok = test
    ? confirma_('TEST – trimitere către mine', ['Se trimit ' + Math.min(3, dest.length) + ' emailuri (din ' + dest.length + ') către ' + me + ', ca exemplu.'], ['Profesorii nu primesc nimic.'])
    : confirma_('TRIMITERE REALĂ către profesori', [
        'Se trimit ' + dest.length + ' emailuri (câte unul pe profesor, cu linkurile fișelor lui) de pe contul ' + me + '.',
        'Emailurile NU pot fi retrase după trimitere.',
        'Verifică înainte: AN_UNIVERSITAR din INFO, titularii din DISCIPLINE, drepturile acordate, rezultatul TEST-ului.'],
        ['Fișele și foile centralizatorului.']);
  if (!ok) return;
  const info = info_(), an = info.param['AN_UNIVERSITAR'] || '';
  let n = 0;
  dest.slice(0, test ? 3 : dest.length).forEach(em => {
    const p = pe[em];
    const fise = p.fise.sort((a, b) => (a.an - b.an) || (a.sem - b.sem));
    const lista = fise.map(f => '• ' + f.cod + ' – ' + f.den + ' (anul ' + f.an + ', sem. ' + f.sem + ')\n  ' + f.url).join('\n');
    const corp = 'Bună ziua,\n\nVă rog să completați / actualizați fișele disciplinelor pentru anul universitar ' + an + ' la care sunteți titular:\n\n' + lista +
      '\n\nFișele se completează direct în Google Sheets; câmpurile obligatorii necompletate sunt marcate cu portocaliu, iar avertismentele (roșu) nu blochează lucrul. ' +
      'La final, în celula „Stare fișă” alegeți „Gata de verificare”.\n\nMulțumesc,\n' + 'Conducerea departamentului';
    MailApp.sendEmail({ to: test ? me : em, subject: (test ? '[TEST pentru ' + em + '] ' : '') + 'Fișele disciplinelor – de completat (' + an + ')', body: corp, name: 'Fișe discipline' });
    n++;
  });
  ui.alert('Trimise: ' + n + ' emailuri.' + (Object.keys(fara).length ? '\n\nFără email în PROFESORI:\n' + Object.keys(fara).join('\n') : ''));
}

/* ===================== BACKUP FD ===================== */

const BK_CHUNK = 200;                                   // câte ID-uri într-o proprietate (limita Apps Script: ~9 KB / proprietate)
function bkSaveIds_(ids) {
  const p = PropertiesService.getScriptProperties(); let n = 0;
  for (let i = 0; i < ids.length; i += BK_CHUNK) p.setProperty('bk_ids_' + (n++), ids.slice(i, i + BK_CHUNK).join(','));
  return n;
}
function bkLoadIds_(st) {
  const p = PropertiesService.getScriptProperties(); let ids = [];
  for (let i = 0; i < st.chunks; i++) ids = ids.concat(String(p.getProperty('bk_ids_' + i) || '').split(',').filter(x => x));
  return ids;
}
function bkClear_() {
  const p = PropertiesService.getScriptProperties();
  Object.keys(p.getProperties()).forEach(k => { if (k === 'bk_state' || k.indexOf('bk_ids_') === 0) p.deleteProperty(k); });
  stergeTriggere_('backupContinua');
}

function backupFd() { backupPorneste_({ nume: '', dupa: '', confirmat: false }); }

/** Pornește un backup (o singură apăsare): creează folderul, copiază, continuă singur în fundal dacă nu încape în limita de timp. */
function backupPorneste_(opt) {
  const ui = SpreadsheetApp.getUi(), props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('bk_state');
  if (raw) {
    const st0 = JSON.parse(raw), blocat = Date.now() - Number(st0.lastT || st0.t0) > 20 * 60 * 1000;
    if (!blocat) { ui.alert('Un backup este deja în curs: „' + st0.folderName + '” (' + st0.copiate + ' din ' + st0.total + ' copiate). Continuă singur în fundal; vei primi email la final. Nu trebuie să apeși din nou.'); return; }
    if (ui.alert('⚠ Backup blocat', 'Backup-ul „' + st0.folderName + '” nu a mai progresat de peste 20 de minute (' + st0.copiate + ' din ' + st0.total + ').\n\nOK = îl abandonez și pornesc unul nou. Anulare = nu fac nimic.', ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
    bkClear_();
  }
  const tz = Session.getScriptTimeZone(), centralizatorId = SpreadsheetApp.getActive().getId(), folder = folderFise_();
  const ids = [centralizatorId];
  for (const f of sheetsInFolder_(folder)) if (ids.indexOf(f.getId()) < 0) ids.push(f.getId());
  let nume = opt.nume || ('BACKUP ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH.mm'));
  if (folder.getFoldersByName(nume).hasNext()) nume += ' (' + Utilities.formatDate(new Date(), tz, 'HH.mm.ss') + ')';
  if (!opt.confirmat && !confirma_('BACKUP FD', [
    'În folderul fișelor („' + folder.getName() + '”) se creează folderul „' + nume + '”.',
    'Se copiază acolo ' + (ids.length - 1) + ' fișe + centralizatorul (copii cu același nume; drepturile de acces NU se copiază).',
    'Se apasă O SINGURĂ DATĂ: dacă durează mai mult de ~5 minute, continuă singur în fundal. La final primești un email cu raportul și verificarea numărului de copii.'],
    ['Fișele originale și centralizatorul.', 'Backup-urile anterioare.'])) return;
  const dest = folder.createFolder(nume);
  const st = { folderId: dest.getId(), folderName: nume, total: ids.length, copiate: 0, chunks: bkSaveIds_(ids), erori: {}, dupa: opt.dupa || '',
               me: Session.getEffectiveUser().getEmail(), t0: Date.now(), lastT: Date.now() };
  props.setProperty('bk_state', JSON.stringify(st));
  const terminat = backupRuleaza_();
  if (!terminat) alertSafe_('Backup pornit: „' + nume + '”. Nu a încăput în limita de timp, deci continuă singur în fundal (nu trebuie să mai apeși). Vei primi email cu raportul la final.');
}

function backupContinua() { backupRuleaza_(); }          // continuare în fundal (declanșator)

/** Copiază fișierele rămase; returnează true dacă backup-ul s-a încheiat în această rulare. */
function backupRuleaza_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return false;
  try {
    const props = PropertiesService.getScriptProperties(), raw = props.getProperty('bk_state');
    if (!raw) return true;
    const st = JSON.parse(raw), ids = bkLoadIds_(st), t0 = Date.now();
    stergeTriggere_('backupContinua');
    const folder = DriveApp.getFolderById(st.folderId), gata = {};
    const it = folder.getFiles();
    while (it.hasNext()) { const m = String(it.next().getDescription() || '').match(/^src:(\S+)/); if (m) gata[m[1]] = 1; }   // ce e deja copiat
    for (const id of ids) {
      if (gata[id] || st.erori[id]) continue;
      if (Date.now() - t0 > T_LIMIT_MS) {
        st.copiate = Object.keys(gata).length; st.lastT = Date.now();
        props.setProperty('bk_state', JSON.stringify(st));
        programeazaContinuare_('backupContinua');
        return false;
      }
      try { const src = DriveApp.getFileById(id), c = src.makeCopy(src.getName(), folder); c.setDescription('src:' + id); gata[id] = 1; }
      catch (e) { st.erori[id] = String(e); }
      st.copiate = Object.keys(gata).length; st.lastT = Date.now();
      props.setProperty('bk_state', JSON.stringify(st));
    }
    // verificare: câte copii există față de câte surse
    const lipsa = ids.filter(id => !gata[id]), copii = Object.keys(gata).length;
    const complet = lipsa.length === 0;
    let msg = (complet ? 'BACKUP COMPLET' : 'BACKUP INCOMPLET') + ' – folderul „' + st.folderName + '”: ' + copii + ' din ' + ids.length + ' fișiere copiate (fișe + centralizatorul).';
    if (!complet) msg += '\nNeadăugate:\n' + lipsa.map(id => { try { return DriveApp.getFileById(id).getName(); } catch (e) { return id; } }).join('\n') + '\nErori:\n' + Object.keys(st.erori).map(k => k + ': ' + st.erori[k]).join('\n');
    if (st.dupa === 'ANNOU') {
      if (complet) {
        try { const n = resetCompletDinPlan_(); msg += '\n\nAN NOU: lista DISCIPLINE a fost resetată din plan (' + n + ' discipline, fără titulari). Pasul următor: schimbă AN_UNIVERSITAR în INFO, apoi „Generează URL/stare fișe” / fișe noi și „Actualizează FD”.'; }
        catch (e) { msg += '\n\nAN NOU: backup-ul e complet, DAR resetarea listei a eșuat: ' + e + '\nLista DISCIPLINE nu a fost modificată.'; }
      } else msg += '\n\nAN NOU: resetarea listei NU s-a făcut, pentru că backup-ul nu e complet. Rulează din nou AN NOU după ce rezolvi problema.';
    }
    try {
      const ss = SpreadsheetApp.getActive(), log = ss.getSheetByName('BACKUP_LOG') || ss.insertSheet('BACKUP_LOG');
      if (log.getLastRow() === 0) log.appendRow(['Data', 'Folder', 'Copiate', 'Total', 'Lipsă', 'Tip']);
      log.appendRow([new Date(), st.folderName, copii, ids.length, lipsa.length, st.dupa === 'ANNOU' ? 'AN NOU' : 'BACKUP FD']);
    } catch (e) { Logger.log(e); }
    try { MailApp.sendEmail(st.me, (complet ? '✔ ' : '⚠ ') + 'BACKUP FD – ' + st.folderName, msg); } catch (e) { Logger.log(e); }
    bkClear_();
    alertSafe_(msg);
    return true;
  } finally { lock.releaseLock(); }
}

/* ===================== PDF FD ===================== */

const PDF_CHUNK = 200;
function pdfIdsSave_(ids) {
  const p = PropertiesService.getScriptProperties(); let n = 0;
  for (let i = 0; i < ids.length; i += PDF_CHUNK) p.setProperty('pdf_ids_' + (n++), ids.slice(i, i + PDF_CHUNK).join(','));
  return n;
}
function pdfIdsLoad_(st) {
  const p = PropertiesService.getScriptProperties(); let ids = [];
  for (let i = 0; i < st.chunks; i++) ids = ids.concat(String(p.getProperty('pdf_ids_' + i) || '').split(',').filter(x => x));
  return ids;
}
function pdfClear_() {
  const p = PropertiesService.getScriptProperties();
  Object.keys(p.getProperties()).forEach(k => { if (k === 'pdf_state' || k.indexOf('pdf_ids_') === 0) p.deleteProperty(k); });
  stergeTriggere_('pdfContinua');
}

/** Adresa de export PDF a foii FISA: A4 portret, potrivit pe lățimea paginii, fără grilă / titluri / nume de foi, doar zona A5:L<ultimul rând>. */
function pdfUrl_(ssId, gid, ultimulRand) {
  const q = {
    format: 'pdf', gid: gid, size: 'A4', portrait: 'true', fitw: 'true',
    gridlines: 'false', printtitle: 'false', sheetnames: 'false', pagenumbers: 'false', pagenum: 'UNDEFINED', printnotes: 'false',
    horizontal_alignment: 'CENTER', top_margin: '0.5', bottom_margin: '0.5', left_margin: '0.5', right_margin: '0.5',
    r1: '4', c1: '0', r2: String(ultimulRand), c2: '12', attachment: 'false'
  };
  return 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?' + Object.keys(q).map(k => k + '=' + encodeURIComponent(q[k])).join('&');
}

function pdfFd() {
  const ui = SpreadsheetApp.getUi(), props = PropertiesService.getScriptProperties(), raw = props.getProperty('pdf_state');
  if (raw) {
    const st0 = JSON.parse(raw), blocat = Date.now() - Number(st0.lastT || st0.t0) > 20 * 60 * 1000;
    if (!blocat) { ui.alert('Generarea PDF este deja în curs: „' + st0.folderName + '” (' + st0.facute + ' din ' + st0.total + '). Continuă singură în fundal; vei primi email la final. Nu trebuie să apeși din nou.'); return; }
    if (ui.alert('⚠ Generare PDF blocată', '„' + st0.folderName + '” nu a mai progresat de peste 20 de minute (' + st0.facute + ' din ' + st0.total + ').\n\nOK = o abandonez și pornesc una nouă. Anulare = nu fac nimic.', ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
    pdfClear_();
  }
  const folder = folderFise_(), centralizatorId = SpreadsheetApp.getActive().getId(), ids = [];
  for (const f of sheetsInFolder_(folder)) if (f.getId() !== centralizatorId && ids.indexOf(f.getId()) < 0) ids.push(f.getId());
  if (!ids.length) { ui.alert('Nu am găsit fișe în folderul fișelor.'); return; }
  const nume = 'PDF ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH.mm');
  if (!confirma_('PDF FD – toate fișele', [
    'Se creează în folderul fișelor („' + folder.getName() + '”) folderul „' + nume + '”.',
    'Pentru fiecare dintre cele ' + ids.length + ' fișiere se salvează un PDF numai cu foaia FISA (fără PANOU și _DATE): A4 portret, potrivit pe lățimea paginii, margini 0,5", fără grilă. Fontul și diacriticele sunt randate de Google.',
    'La fișele cu „Mod evidențiere” = DA, modul se pune TEMPORAR pe NU (ca PDF-ul să iasă curat, fără celule galbene și avertismente) și se restabilește imediat după export.',
    'Se apasă O SINGURĂ DATĂ: dacă durează mai mult de ~5 minute, continuă singură în fundal; la final primești email cu raportul.'],
    ['Conținutul fișelor (în afară de comutarea temporară a modului).', 'Folderele BACKUP și PDF anterioare.'])) return;
  const dest = folder.createFolder(nume);
  const st = { folderId: dest.getId(), folderName: nume, total: ids.length, facute: 0, chunks: pdfIdsSave_(ids), erori: {}, sarite: [],
               me: Session.getEffectiveUser().getEmail(), t0: Date.now(), lastT: Date.now() };
  props.setProperty('pdf_state', JSON.stringify(st));
  if (!pdfRuleaza_()) alertSafe_('Generarea PDF a pornit: „' + nume + '”. Nu a încăput în limita de timp, deci continuă singură în fundal (nu trebuie să mai apeși). Vei primi email cu raportul la final.');
}

function pdfContinua() { pdfRuleaza_(); }                // continuare în fundal (declanșator)

/** Exportă PDF-urile rămase; returnează true dacă s-a încheiat în această rulare. */
function pdfRuleaza_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return false;
  try {
    const props = PropertiesService.getScriptProperties(), raw = props.getProperty('pdf_state');
    if (!raw) return true;
    const st = JSON.parse(raw), ids = pdfIdsLoad_(st), t0 = Date.now();
    stergeTriggere_('pdfContinua');
    const folder = DriveApp.getFolderById(st.folderId), gata = {};
    const it = folder.getFiles();
    while (it.hasNext()) { const m = String(it.next().getDescription() || '').match(/^src:(\S+)/); if (m) gata[m[1]] = 1; }
    const sarite = {}; st.sarite.forEach(x => { sarite[x.id] = 1; });
    const token = ScriptApp.getOAuthToken();
    for (const id of ids) {
      if (gata[id] || st.erori[id] || sarite[id]) continue;
      if (Date.now() - t0 > T_LIMIT_MS) {
        st.facute = Object.keys(gata).length; st.lastT = Date.now();
        props.setProperty('pdf_state', JSON.stringify(st));
        programeazaContinuare_('pdfContinua');
        return false;
      }
      let pn = null, resetat = false;
      try {
        const ss = SpreadsheetApp.openById(id), sh = ss.getSheetByName(SH_FISA);
        if (!sh) { st.sarite.push({ id: id, nume: ss.getName() }); continue; }       // alt fel de fișier (raport etc.)
        pn = ss.getSheetByName(SH_PANOU);
        if (pn && pn.getRange('B9').getValue() === 'DA') { pn.getRange('B9').setValue('NU'); SpreadsheetApp.flush(); resetat = true; }
        const ultim = pn ? Math.max(sh.getLastRow(), 6) : 72;                       // structura veche: panoul e în FISA, deci doar A5:L72
        let blob = null, err = '';
        for (let k = 0; k < 3 && !blob; k++) {
          const r = UrlFetchApp.fetch(pdfUrl_(id, sh.getSheetId(), ultim), { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
          if (r.getResponseCode() === 200 && /pdf/i.test(String(r.getHeaders()['Content-Type'] || r.getHeaders()['content-type'] || ''))) blob = r.getBlob();
          else { err = 'HTTP ' + r.getResponseCode(); Utilities.sleep(2000 * (k + 1)); }
        }
        if (!blob) throw new Error(err || 'răspuns necunoscut');
        blob.setName(ss.getName() + '.pdf');
        folder.createFile(blob).setDescription('src:' + id); gata[id] = 1;
      } catch (e) { st.erori[id] = String(e); }
      finally { if (resetat) { try { pn.getRange('B9').setValue('DA'); SpreadsheetApp.flush(); } catch (e2) { st.erori[id + '#mod'] = 'ATENȚIE: modul evidențiere a rămas NU: ' + e2; } } }
      st.facute = Object.keys(gata).length; st.lastT = Date.now();
      props.setProperty('pdf_state', JSON.stringify(st));
    }
    const lipsa = ids.filter(id => !gata[id] && !sarite[id] && !st.sarite.some(x => x.id === id)), nErr = Object.keys(st.erori).length;
    const complet = lipsa.length === 0 && nErr === 0;
    let msg = (complet ? 'PDF COMPLET' : 'PDF CU PROBLEME') + ' – folderul „' + st.folderName + '”: ' + Object.keys(gata).length + ' PDF-uri din ' + ids.length + ' fișiere.';
    if (st.sarite.length) msg += '\nSărite (fără foaia FISA): ' + st.sarite.map(x => x.nume).join(', ');
    if (nErr) msg += '\n\nErori:\n' + Object.keys(st.erori).map(k => k + ': ' + st.erori[k]).join('\n');
    try {
      const ss = SpreadsheetApp.getActive(), log = ss.getSheetByName('PDF_LOG') || ss.insertSheet('PDF_LOG');
      if (log.getLastRow() === 0) log.appendRow(['Data', 'Folder', 'PDF-uri', 'Fișiere', 'Sărite', 'Erori']);
      log.appendRow([new Date(), st.folderName, Object.keys(gata).length, ids.length, st.sarite.length, nErr]);
    } catch (e) { Logger.log(e); }
    try { MailApp.sendEmail(st.me, (complet ? '✔ ' : '⚠ ') + 'PDF FD – ' + st.folderName, msg); } catch (e) { Logger.log(e); }
    pdfClear_();
    alertSafe_(msg);
    return true;
  } finally { lock.releaseLock(); }
}

/* ===================== FONT ===================== */

function fontGeorgia() {
  if (!confirma_('Setare font Georgia în toate fișele', [
    'În TOATE fișierele Google Sheets din folderul fișelor (și subfoldere), în TOATE foile, tot intervalul primește fontul Georgia.',
    'Se pierde orice alt font setat manual (mărimea, culorile și bordurile rămân).',
    'Operația este reluabilă dacă se atinge limita de timp.'],
    ['Conținutul și formulele celulelor.', 'Foile centralizatorului.'])) return;
  const t0 = Date.now(), props = PropertiesService.getScriptProperties(), centralizatorId = SpreadsheetApp.getActive().getId();
  const done = JSON.parse(props.getProperty('done_font') || '{}'); let n = 0, oprit = false; const erori = [];
  for (const f of sheetsInFolder_(folderFise_())) {
    const id = f.getId();
    if (id === centralizatorId || done[id]) continue;
    if (Date.now() - t0 > T_LIMIT_MS) { oprit = true; break; }
    try {
      SpreadsheetApp.openById(id).getSheets().forEach(sh => sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setFontFamily('Georgia'));
      SpreadsheetApp.flush(); done[id] = 1; n++;
    } catch (e) { erori.push(f.getName() + ': ' + e); }
  }
  if (oprit) props.setProperty('done_font', JSON.stringify(done)); else props.deleteProperty('done_font');
  SpreadsheetApp.getUi().alert('Font Georgia setat în ' + n + ' fișiere.' + (oprit ? '\nLimită de timp – apasă din nou pentru restul.' : '\nGata.') + (erori.length ? '\n\nErori:\n' + erori.join('\n') : ''));
}

/* ===================== MENIU ===================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu(MENIU_NUME)
    .addItem('1. Preia disciplinele din PLAN', 'preiaDinPlan')
    .addItem('   AN NOU (backup complet + resetare din plan)', 'anNou')
    .addSeparator()
    .addItem('2. Generează URL/stare fișe', 'refreshManual')
    .addItem('3. Actualizează FD', 'actualizeazaFisele')
    .addItem('4. BACKUP FD', 'backupFd')
    .addItem('5. PDF FD (toate fișele, foaia FISA)', 'pdfFd')
    .addSeparator()
    .addItem('6. Acordă drepturi de editare titularilor', 'acordaDrepturi')
    .addItem('7. Trimite fișele – TEST (către mine)', 'trimiteTest')
    .addItem('8. Trimite fișele – REAL (către profesori)', 'trimiteReal')
    .addSeparator()
    .addItem('Setează fontul Georgia în toate fișele', 'fontGeorgia')
    .addToUi();
}
