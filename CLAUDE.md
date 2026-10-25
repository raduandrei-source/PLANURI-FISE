# Fișa disciplinei – Arhitectură, UT Iași (Google Sheets + Apps Script)

Fișierul central din Google Drive se numește „Centralizator discipline și titulari ARH” (în istoric: „mama”); în texte: „centralizatorul”.
Istoricul complet și deciziile: `INSTRUCTIUNI_CONTINUARE.md`. Răspunsurile către utilizator: în română, concise.

## Ce e aici
- `Centralizator.gs` – scriptul unic al centralizatorului (sursa de adevăr pentru logică). Se lipește în Extensii → Apps Script.
- `MAMA_FISE_DISCIPLINE_v*.xlsx` – centralizatorul; versiunea cea mai mare e cea curentă.
- `Fisele_FISA_PANOU_DATE.zip` – cele 123 de fișe (FISA / PANOU / _DATE).
- `tests/` – teste Node offline pentru funcțiile pure din Centralizator.gs: `node tests/run_all.js`.
- `tools/` – scripturi Python istorice (generator fișă, migrare). Conține `struct.py`, care umbrește stdlib: nu pune `tools/` pe `sys.path[0]`.
- `data/` – `nodein.json` (plan + DISCIPLINE vechi) pentru teste.

## Reguli
- Python cu `python -I`. Fișierele primite de la utilizator se citesc, nu se rulează; se lucrează pe copii.
- Xlsx livrate: font Georgia, antet bold negru pe gri deschis, rând de antet înghețat.
- Google nu e accesibil de aici: orice schimbare în Centralizator.gs se testează offline (Node + mock-uri), apoi o testează utilizatorul.
- Operațiile importante din meniu au dialog OK/Anulare cu „ce se va întâmpla / ce nu se modifică” – se păstrează.
- Limita Apps Script 6 min: operațiile lungi se continuă prin trigger one-time (T_LIMIT_MS = 5 min).
- Planul oficial = foaia din INFO → PLAN_FOAIE_CURENTA (acum „PLAN ACTUAL”, anul univ. 2026/2027).
- „Limbi străine” din plan devine câte un rând în DISCIPLINE pe limbă (implicit engleză și franceză; INFO → LIMBI_STRAINE schimbă lista, „NU” oprește despărțirea), fiecare cu fișa lui.

## Structura fișei
- **FISA** (vizibilă, A:L, se tipărește): orele pe săptămână (rândul 22) vin din _DATE prin `INDEX($X$4:$AK$500,$O$8,k)`.
- **PANOU** (vizibilă): B5 stare, B6 aviz, B8/B9 evidențiere, B32:F34 sloturi competențe.
- **_DATE** (ascunsă): O3 URL centralizator, O4 cod, O8 MATCH, O10 cheie „cod | den”, N11:O28 INFO, X3:AL500 tabelul de plan
  (X cod, Y den, Z an, AA sem, AB credite, AC C, AD S, AE L, AF P, AG PR, AH formă, AI tip, AJ/AK titulari, AL cheie),
  AM3:AO183 catalogul de competențe (CN 4–63, AP 64–123, RA 124–183).
- După „Actualizează FD”, tabelul de plan din _DATE are un singur rând (rândul 4), scris de `scrieInFisa_`.

## Competențe (lista COMPETENTE)
- Lista nouă: C1–C8 / A1–A8 / R1–R8 = cunoștințele / aptitudinile / responsabilitatea din rândul ARACIS n; textul se termină cu „(ARACIS-n, D46-x)”.
  Se generează cu `tools/competente_noi.py` din `data/ri_aracis_arhitectura.json` → `COMPETENTE_noi_pentru_centralizator.xlsx` (foile COMPETENTE și COMPETENTE_VECHI).
- Codurile vechi (CN01…, AP…, RA…) din PANOU se convertesc la „Actualizează FD” (`migreazaCompetente_`, tabelul din foaia COMPETENTE_VECHI);
  textele proprii ale disciplinei se mută la Specificări manuale (G32:G34). Conversia e idempotentă.

## Referințele rezultatelor învățării în fișe
După fiecare RÎ: „(ARACIS-n, D46-x)” la font 8. ARACIS-n = rândul n din Anexa 2, Arhitectură CPS 8 (1–8);
D46-x = Directiva 2005/36/CE art. 46 alin. (2), literele a–k. Tabelele: `../../livrabile/`.
