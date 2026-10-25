# PLANURI-FISE

Fișele disciplinelor pentru programul de licență Arhitectură, Facultatea de Arhitectură „G.M. Cantacuzino”, Universitatea Tehnică „Gheorghe Asachi” din Iași. Sistemul folosește Google Sheets și Apps Script: fișierul central este „Centralizator discipline și titulari ARH” (cu scriptul `Centralizator.gs`), iar fiecare disciplină are fișa ei.

**Instrucțiuni:**
- [Cum se completează fișa și rezultatele învățării](https://raduandrei-source.github.io/PLANURI-FISE/)
- [Pașii anuali pentru generarea fișelor](https://raduandrei-source.github.io/PLANURI-FISE/pasi-anuali.html)

## Ce conține

| Fișier / folder | Rol |
|---|---|
| `Centralizator.gs` | Scriptul centralizatorului: se lipește în Extensii → Apps Script și adaugă meniul „Fișe disciplină”. |
| `COMPETENTE_noi_pentru_centralizator.xlsx` | Lista rezultatelor învățării (ARACIS 1–8 × cunoștințe / aptitudini / responsabilitate) și tabelul de trecere de la codurile vechi. Se copiază în centralizator foile COMPETENTE și COMPETENTE_VECHI. |
| `docs/` | Site-ul de instrucțiuni (GitHub Pages), generat cu `tools/site.py`. |
| `data/` | Rezultatele ARACIS pentru Arhitectură, Directiva 2005/36/CE art. 46 (a–k), tabelul de trecere a codurilor. |
| `tools/` | Scripturile de lucru: lista de competențe, site-ul, comparația fișelor cu planul. |
| `tests/run_all.js` | Teste offline pentru funcțiile din `Centralizator.gs`: `node tests/run_all.js`. |

## Referințele rezultatelor învățării

După fiecare rezultat al învățării, fișa arată referința „(ARACIS-n, D46-x)”:
- **ARACIS-n**: rezultatul n din standardele ARACIS, Anexa 2, Arhitectură (CPS 8).
- **D46-x**: litera x din Directiva 2005/36/CE, art. 46 alin. (2).

## Date care nu sunt în depozit

Centralizatorul, fișele și listele cu titulari sau cu emailuri nu sunt publicate aici, pentru că conțin date personale. Ele rămân în Google Drive. Testele care au nevoie de ele sunt sărite când lipsesc.
