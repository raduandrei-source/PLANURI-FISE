# Generează site-ul de instrucțiuni (GitHub Pages, folderul docs/):
#   docs/index.html        – cum se completează fișa disciplinei și rezultatele învățării (fiecare câmp are o ancoră #id)
#   docs/pasi-anuali.html  – pașii anuali ai directorului pentru generarea fișelor
#   python -I tools/site.py      (din folderul proiectului)
# Ancorele folosite în Centralizator.gs (AJUTOR_FISA) trebuie să existe aici; testul tests/run_all.js le verifică.
import json, os, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RI = json.load(open(os.path.join(ROOT, 'data', 'ri_aracis_arhitectura.json'), encoding='utf-8'))
D46 = json.load(open(os.path.join(ROOT, 'data', 'd46_art46.json'), encoding='utf-8'))
DOCS = os.path.join(ROOT, 'docs')
os.makedirs(DOCS, exist_ok=True)
e = html.escape

CSS = """
:root{--bg:#ececea;--fg:#1f1f1f;--muted:#555452;--line:#d2d0cb;--accent:#8a3b12;--card:#f7f7f5;--mark:#fbf0cf;--code:#e2e1dd;--tu-bg:#dfeed8;--tu-fg:#2f5d23}
:root[data-theme="dark"]{--bg:#171614;--fg:#ece9e3;--muted:#a9a49b;--line:#34312c;--accent:#e39a6c;--card:#1f1d1a;--mark:#3a3120;--code:#2a2723;--tu-bg:#24341f;--tu-fg:#a9d29a}
.tema{flex:none;font:14px Georgia,serif;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:18px;padding:6px 14px;cursor:pointer}
.tema:hover{border-color:var(--accent);color:var(--accent)}
.cap{max-width:1180px;margin:0 auto;display:flex;gap:16px;align-items:flex-start;justify-content:space-between}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.6 Georgia,'Times New Roman',serif}
a{color:var(--accent)}
header{padding:28px 16px 18px;border-bottom:1px solid var(--line)}
header h1{margin:0 0 6px;font-size:28px;line-height:1.2}
header p{margin:0;color:var(--muted)}
.wrap{display:grid;grid-template-columns:270px minmax(0,1fr);gap:40px;max-width:1180px;margin:0 auto;padding:0 16px}
nav{position:sticky;top:0;align-self:start;max-height:100vh;overflow:auto;padding:20px 0;font-size:14px;line-height:1.45}
nav a{display:block;padding:3px 0;text-decoration:none;color:var(--muted)}
nav a:hover{color:var(--accent)}
nav .g{margin:14px 0 4px;font-weight:bold;color:var(--fg);text-transform:uppercase;font-size:12px;letter-spacing:.05em}
main{padding:12px 0 80px;min-width:0}
section{scroll-margin-top:12px;padding:18px 20px;margin:0 -20px 6px;border-radius:8px;border:1px solid transparent}
section:target{background:var(--mark);border-color:var(--line)}
h2{font-size:22px;margin:34px 0 4px;padding-bottom:4px;border-bottom:2px solid var(--line)}
h3{font-size:18px;margin:0 0 6px}
.unde{font-size:13px;color:var(--muted);margin:-2px 0 8px}
.auto{display:inline-block;font-size:12px;padding:1px 8px;border-radius:10px;background:var(--code);color:var(--muted);margin-left:6px;vertical-align:2px}
.tu{background:var(--tu-bg);color:var(--tu-fg)}
code,.ex{background:var(--code);padding:1px 5px;border-radius:4px;font-size:.92em}
.ex{display:block;padding:10px 12px;margin:8px 0;border-left:3px solid var(--accent);border-radius:0 6px 6px 0}
.ex small{color:var(--muted);font-size:11px}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:15px}
th,td{border:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:left}
th{background:var(--code)}
ol li,ul li{margin:4px 0}
.pas{counter-increment:pas;position:relative;padding:14px 16px 14px 58px;margin:10px 0;background:var(--card);border:1px solid var(--line);border-radius:8px}
.pas:before{content:counter(pas);position:absolute;left:16px;top:13px;width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;text-align:center;font:bold 15px/28px Georgia,serif}
.pasi{counter-reset:pas}
.cand{font-size:13px;color:var(--muted)}
.atentie{border-left:3px solid #c0392b;padding:6px 12px;margin:10px 0;background:var(--card)}
@media (max-width:860px){.wrap{display:block}nav{position:static;max-height:none;border-bottom:1px solid var(--line);columns:2;column-gap:20px}nav .g{break-after:avoid}section{margin:0 0 6px;padding:14px 4px}}
@media print{nav,header p,.tema{display:none}.wrap{display:block}section:target{background:none}}
"""

# tema: implicit luminoasă (gri deschis); butonul o comută și alegerea se ține minte în browser
JS_TEMA_CAP = "try{var t=localStorage.getItem('tema');if(t==='dark')document.documentElement.dataset.theme='dark';}catch(e){}"
JS_TEMA = """(function(){var b=document.getElementById('tema'),r=document.documentElement;
function arata(){var d=r.dataset.theme==='dark';b.textContent=d?'☀ Luminos':'☾ Întunecat';b.title=d?'Treci la tema luminoasă':'Treci la tema întunecată';}
b.addEventListener('click',function(){if(r.dataset.theme==='dark')delete r.dataset.theme;else r.dataset.theme='dark';
try{localStorage.setItem('tema',r.dataset.theme==='dark'?'dark':'light');}catch(e){}arata();});arata();})();"""

def pagina(titlu, subtitlu, nav, corp, alta):
    return f"""<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titlu)}</title><script>{JS_TEMA_CAP}</script><style>{CSS}</style></head>
<body><header><div class="cap"><div><h1>{e(titlu)}</h1><p>{subtitlu} · {alta}</p></div><button class="tema" id="tema" type="button">☾ Întunecat</button></div></header>
<div class="wrap"><nav>{nav}</nav><main>{corp}</main></div><script>{JS_TEMA}</script></body></html>"""

def sec(id_, titlu, corp, unde='', auto=None):
    eticheta = '' if auto is None else (' <span class="auto">automat, din centralizator</span>' if auto else ' <span class="auto tu">completezi tu</span>')
    u = f'<div class="unde">{unde}</div>' if unde else ''
    return f'<section id="{id_}"><h3>{titlu}{eticheta}</h3>{u}{corp}</section>'

NU_MODIFICI = '<p>Nu se scrie în fișă: valoarea vine din centralizator (planul de învățământ sau foaia INFO). Dacă e greșită, spune-i directorului de departament; se corectează în centralizator și apare în fișă la următorul „Actualizează FD”.</p>'

# ---------------- index.html ----------------
SECT = []
def add(grupa, id_, scurt, html_):
    SECT.append((grupa, id_, scurt, html_))

add('Început', 'cum-functioneaza', 'Cum funcționează fișa', sec('cum-functioneaza', 'Cum funcționează fișa', """
<p>Fișa are două foi vizibile:</p>
<ul><li><b>FISA</b> – fișa propriu-zisă, exact cum se tipărește. Aici scrii textele disciplinei.</li>
<li><b>PANOU</b> – starea fișei, avizul directorului, alegerea rezultatelor învățării și verificările automate.</li></ul>
<p>Câmpurile marcate <span class="auto">automat, din centralizator</span> sunt completate din fișierul „Centralizator discipline și titulari ARH” al facultății (planul de învățământ, foaia INFO, lista de titulari). Nu le modifica: la următoarea actualizare ar fi rescrise.
Câmpurile marcate <span class="auto tu">completezi tu</span> sunt ale tale.</p>
<p>Câmpurile obligatorii necompletate apar cu <b>portocaliu</b>, iar valorile care nu se potrivesc cu planul cu <b>roșu</b>, cât timp starea fișei este „În lucru”. Banda de sus din PANOU spune ce mai e de corectat. Avertismentele nu blochează lucrul.</p>
<p>În dreapta fișei (coloana M, în afara zonei tipărite), semnul <b>ⓘ</b> de pe fiecare rând duce direct la explicația câmpului de pe această pagină. Câmpurile automate au și un comentariu: treci cu mouse-ul peste celulă. Comentariile și semnele ⓘ nu apar în PDF.</p>"""))
add('Început', 'stare', 'Stare, aviz, verificare', sec('stare', 'Stare, aviz, verificare', """
<ul><li><b>Stare fișă</b> (PANOU, B5): „În lucru” cât timp completezi; „Gata de verificare” când ai terminat.</li>
<li><b>Aviz director</b> (B6) și <b>Observații</b> (B7) le completează directorul de departament: „Avizat” sau „Returnat”, cu observații.</li>
<li><b>Mod evidențiere</b> (B9): DA colorează în fișă problemele găsite, cât timp fișa e „În lucru”.</li>
<li>Banda de sus a PANOU-ului arată ✔ dacă fișa e completă și corectă; altfel, lista problemelor.</li></ul>""", unde='PANOU, rândurile 1–9', auto=False))

add('1–2. Date generale', 'date-program', '1.1–1.6 Date despre program', sec('date-program', '1.1–1.6 Date despre program; anul universitar', """
<p>Universitatea, facultatea, domeniul, ciclul și programul de studii, precum și anul universitar din titlu, vin din foaia INFO a centralizatorului. Sunt aceleași pentru toate fișele.</p>""" + NU_MODIFICI, unde='FISA: A6, B8, B9, B11, B12, B13', auto=True))
add('1–2. Date generale', 'departament', '1.3 Departamentul', sec('departament', '1.3 Departamentul', """
<p>Departamentul căruia îi aparține disciplina, din lista DISCIPLINE a centralizatorului (Arhitectură sau Urbanism). De el depinde directorul care avizează fișa (rândul 71).</p>""" + NU_MODIFICI, unde='FISA: B10', auto=True))
add('1–2. Date generale', 'denumire', '2.1.1 Denumirea (RO)', sec('denumire', '2.1.1 Denumirea disciplinei, în limba română', """
<p>Exact denumirea din planul de învățământ aprobat. La limbile străine, limba apare în paranteză, de exemplu „Limbi străine (Limba engleză)”.</p>""" + NU_MODIFICI, unde='FISA: E15', auto=True))
add('1–2. Date generale', 'denumire-en', '2.1.1 Denumirea (EN)', sec('denumire-en', '2.1.1 Denumirea disciplinei, în limba engleză', """
<p>Traducerea folosită în Suplimentul la diplomă. Dacă disciplina există deja în supliment, păstrează aceeași traducere; altfel, o traducere scurtă și uzuală (ex. „Urban Composition”). Câmp obligatoriu.</p>""", unde='FISA: E16', auto=False))
add('1–2. Date generale', 'cod', '2.1.2 Codul', sec('cod', '2.1.2 Codul disciplinei', """
<p>Codul din planul de învățământ. Prin el se leagă fișa de rândul ei din plan: orele, creditele și forma de evaluare se iau după cod.</p>""" + NU_MODIFICI, unde='FISA: E17', auto=True))
add('1–2. Date generale', 'titulari', '2.2–2.3 Titularii', sec('titulari', '2.2–2.3 Titularii de curs și de aplicații', """
<p>Titularii stabiliți de departament în lista DISCIPLINE a centralizatorului (statul de funcții). Apar și la semnături, la sfârșitul fișei.</p>""" + NU_MODIFICI, unde='FISA: E18, E19, B69, B70', auto=True))
add('1–2. Date generale', 'an-semestru', '2.4–2.5 Anul, semestrul', sec('an-semestru', '2.4–2.5 Anul de studii și semestrul', """
<p>Din planul de învățământ. Semestrul este numerotat pe tot programul (1–12): anul 3, semestrul al doilea = semestrul 6.</p>""" + NU_MODIFICI, unde='FISA: B20, E20', auto=True))
add('1–2. Date generale', 'evaluare-tip', '2.6 Tipul de evaluare', sec('evaluare-tip', '2.6 Tipul de evaluare', """
<p>Forma de evaluare din plan: E = examen, V = verificare (C = colocviu, P = proiect, la planurile mai vechi). De ea depinde rândul 10.4 din evaluare.</p>""" + NU_MODIFICI, unde='FISA: I20', auto=True))
add('1–2. Date generale', 'tip-disciplina', '2.7 Tipul disciplinei', sec('tip-disciplina', '2.7 Tipul disciplinei', """
<p>Din plan: regimul (DOB = obligatorie, DOP = opțională, DFA = facultativă) și categoria formativă (DF = fundamentală, DD = de domeniu, DS = de specialitate, DC = complementară), de exemplu „DOB-DS”.</p>""" + NU_MODIFICI, unde='FISA: L20', auto=True))

add('3. Timp și credite', 'ore-saptamana', '3.1–3.3 Ore pe săptămână', sec('ore-saptamana', '3.1–3.3 Numărul de ore pe săptămână', """
<p>Orele de curs, seminar, laborator, proiect și practică pe săptămână, din planul de învățământ; 3.1 este suma lor.</p>""" + NU_MODIFICI, unde='FISA: rândul 22', auto=True))
add('3. Timp și credite', 'ore-semestru', '3.4–3.6 Ore pe semestru', sec('ore-semestru', '3.4–3.6 Total ore din planul de învățământ', """
<p>Orele pe săptămână × numărul de săptămâni din semestru (INFO → SAPT_SEMESTRU, de regulă 14). Sunt orele „fizice”, cu studenții.</p>
<p>Orele din capitolul 9 (Conținuturi) trebuie să însumeze exact aceste valori pe fiecare activitate; altfel PANOU-ul semnalează diferența.</p>""" + NU_MODIFICI, unde='FISA: rândul 23', auto=True))
add('3. Timp și credite', 'studiu-individual', '3.7 Studiu individual', sec('studiu-individual', 'Distribuția fondului de timp și 3.7 Studiul individual', """
<p>Împarte orele de studiu individual al studentului pe cele cinci rânduri (manual și bibliografie, documentare, pregătire seminarii/proiecte, examinări, alte activități). 3.7 se calculează singur, fără examinări.</p>
<p>Regula de verificare: <b>3.4 (ore cu studenții) + 3.7 (studiu individual) = 3.8 (credite × ore pe credit)</b>. Dacă suma nu se potrivește, celulele se colorează și banda din PANOU spune cu cât.</p>""", unde='FISA: K25–K30', auto=False))
add('3. Timp și credite', 'examinari', 'Examinări', sec('examinari', 'Examinări (în plus față de studiul individual)', """
<p>Orele de examinare propriu-zisă. Trebuie să fie între limitele stabilite de facultate (INFO → EXAM_ORE_MIN și EXAM_ORE_MAX, acum 2–6 ore).</p>""", unde='FISA: K28', auto=False))
add('3. Timp și credite', 'total-ore', '3.8 Total ore pe semestru', sec('total-ore', '3.8 Total ore pe semestru', """
<p>Creditele × orele pe credit (INFO → ORE_CREDIT). Este totalul de muncă al studentului pentru disciplină, cu și fără profesor.</p>""" + NU_MODIFICI, unde='FISA: K31', auto=True))
add('3. Timp și credite', 'credite', '3.9 Credite', sec('credite', '3.9 Numărul de credite', '<p>Creditele ECTS din planul de învățământ.</p>' + NU_MODIFICI, unde='FISA: K32', auto=True))

add('4–6. Condiții, obiectiv', 'preconditii', '4. Precondiții', sec('preconditii', '4. Precondiții', """
<p><b>4.1 de curriculum</b>: disciplinele care trebuie parcurse înainte (cu denumirea din plan). <b>4.2 de rezultate ale învățării</b>: ce trebuie să știe sau să poată face studentul la început. Dacă nu există, scrie „Nu este cazul”. Câmpuri obligatorii.</p>""", unde='FISA: B34, B35', auto=False))
add('4–6. Condiții, obiectiv', 'conditii', '5. Condiții', sec('conditii', '5. Condiții de desfășurare', '<p>Spațiul și dotările necesare pentru curs (5.1) și pentru aplicații (5.2): sală, videoproiector, atelier, laborator, software, deplasări pe teren.</p>', unde='FISA: B37, B38', auto=False))
add('4–6. Condiții, obiectiv', 'obiectiv', '6. Obiectiv general', sec('obiectiv', '6. Obiectivul general al disciplinei', '<p>Una sau două fraze despre scopul disciplinei în formarea arhitectului. Detaliile merg la rezultatele învățării (7) și la conținuturi (9).</p>', unde='FISA: A40', auto=False))

# 7. Rezultatele învățării
ri_ref = ''.join(f'<li><a href="#aracis-{r[0]}">ARACIS-{r[0]}</a> – {e(r[5])}</li>' for r in RI)
add('7. Rezultatele învățării', 'rezultate', '7. Cum apar în fișă', sec('rezultate', '7. Rezultatele învățării – cum apar în fișă', f"""
<p>Rezultatele învățării (RÎ) spun ce știe, ce poate face și ce responsabilitate își asumă studentul la sfârșitul disciplinei. În fișă sunt pe trei rânduri: <b>Cunoștințe</b>, <b>Aptitudini</b>, <b>Responsabilitate și autonomie</b>.</p>
<p>Nu le scrii direct în fișă. Le alegi în PANOU (<a href="#ri-alegere">cum</a>), iar textul apare singur în capitolul 7, urmat de referința la standarde, de exemplu:</p>
<div class="ex">Studentul/absolventul identifică conexiunile culturale și artistice relevante într-o situație dată de proiectare. … <small>(ARACIS-3, D46-b, D46-c)</small></div>
<p>Lista din care alegi are 24 de rezultate: cunoștințele, aptitudinile și responsabilitățile celor 8 rezultate ARACIS pentru Arhitectură:</p><ul>{ri_ref}</ul>""", unde='FISA: B42–B44 (calculate din PANOU)', auto=True))
add('7. Rezultatele învățării', 'ri-alegere', 'Cum alegi codurile', sec('ri-alegere', 'Cum alegi rezultatele învățării', """
<ol><li>Deschide foaia <b>PANOU</b>, zona „SELECȚIE REZULTATE ALE ÎNVĂȚĂRII” (rândurile 31–34).</li>
<li>Pe rândul <b>Cunoștințe</b> alegi din listă coduri <code>C1</code>–<code>C8</code>, pe <b>Aptitudini</b> coduri <code>A1</code>–<code>A8</code>, pe <b>Responsabilitate și autonomie</b> coduri <code>R1</code>–<code>R8</code>. Cifra este numărul rezultatului ARACIS (<a href="#aracis">lista</a>).</li>
<li>Cel mult 5 coduri pe rând; de obicei 1–3 sunt suficiente. Alege rezultatele la care disciplina contribuie <b>cu adevărat</b> și pe care le și <b>evaluezi</b> (capitolul 10).</li>
<li>Textele apar imediat în fișă, la capitolul 7.</li></ol>
<p>Cum alegi: pornește de la ce fac studenții la disciplina ta (proiectează, analizează, documentează, reprezintă, calculează, cooperează) și caută în <a href="#aracis">lista ARACIS</a> rândul cu cuvintele-cheie potrivite. Pentru o disciplină de proiectare sunt firești ARACIS-1, 2, 5; pentru istorie și teorie ARACIS-2, 3, 7; pentru structuri și tehnologie ARACIS-6, 7; pentru profesie și legislație ARACIS-4, 8.</p>""", unde='PANOU: B32:F34', auto=False))
add('7. Rezultatele învățării', 'ri-specificari', 'Specificări pentru disciplină', sec('ri-specificari', 'Specificări manuale pentru disciplină', """
<p>Textele ARACIS sunt generale. Ce e specific disciplinei tale scrii în coloana „Specificări manuale” (PANOU, G32–G34), pe rândul categoriei. Textul se adaugă în fișă după rezultatele alese.</p>
<p>Scrie 1–3 rezultate concrete, după <a href="#ri-scriere">regulile de scriere</a>, și încheie fiecare cu referința în paranteză, ca să fie limpede de unde vine:</p>
<div class="ex">Studentul/absolventul realizează reprezentarea urbanistică a unei zone, la scările 1:5000 – 1:500, cu legenda și simbolurile reglementate. <small>(ARACIS-2, D46-d)</small></div>
<p>La disciplinele care nu țin de arhitectură (limbi străine, educație fizică, matematică) rezultatele proprii stau tot aici; referința ARACIS e cea mai apropiată, iar dacă nu există una potrivită, se omite.</p>""", unde='PANOU: G32–G34', auto=False))
add('7. Rezultatele învățării', 'ri-referinte', 'Referința (ARACIS-n, D46-x)', sec('ri-referinte', 'Ce înseamnă referința (ARACIS-n, D46-x)', """
<ul><li><b>ARACIS-n</b> – rezultatul n (1–8) din standardele ARACIS pentru domeniul Arhitectură (<a href="#aracis">lista</a>). Arată că disciplina contribuie la rezultatele cerute la acreditare.</li>
<li><b>D46-x</b> – litera x (a–k) din Directiva 2005/36/CE, articolul 46 alineatul (2): cunoștințele și abilitățile pe care trebuie să le asigure orice formare de arhitect recunoscută automat în Uniunea Europeană (<a href="#d46">lista</a>).</li></ul>
<p>Referința rămâne valabilă chiar dacă formularea rezultatului e adaptată disciplinei, cât timp sensul se păstrează.</p>""", auto=None))
add('7. Rezultatele învățării', 'ri-scriere', 'Cum se scrie un RÎ', sec('ri-scriere', 'Cum se scrie un rezultat al învățării', """
<p>Un rezultat al învățării este o propoziție despre ce poate face studentul la sfârșit, nu despre ce predă profesorul. Are trei părți:</p>
<ol><li><b>un verb de acțiune</b>, observabil și evaluabil: identifică, explică, compară, analizează, aplică, elaborează, proiectează, reprezintă, evaluează, argumentează, cooperează;</li>
<li><b>obiectul</b>: ce anume (conceptul, metoda, tipul de proiect);</li>
<li><b>contextul sau nivelul</b>: în ce situație, la ce scară, cu ce instrumente.</li></ol>
<table><tr><th>Evită</th><th>Scrie</th></tr>
<tr><td>Studentul cunoaște istoria arhitecturii moderne.</td><td>Studentul/absolventul explică principalele curente ale arhitecturii moderne și le recunoaște în clădiri din Iași.</td></tr>
<tr><td>Însușirea noțiunilor de structuri.</td><td>Studentul/absolventul alege și predimensionează un sistem structural adecvat unei clădiri de locuințe colective.</td></tr>
<tr><td>Dezvoltarea creativității.</td><td>Studentul/absolventul propune și argumentează cel puțin două variante de organizare funcțională pentru tema dată.</td></tr></table>
<ul><li>Începe cu „Studentul/absolventul …”, ca în standardele ARACIS.</li>
<li>Scurt: o frază, cel mult cca 500 de caractere.</li>
<li>Verbe care cer gândire mai înaltă (analizează, evaluează, concepe) pentru anii mari; în anii mici sunt firești identifică, descrie, aplică.</li>
<li>Fiecare rezultat trebuie să poată fi verificat prin evaluarea din capitolul 10.</li>
<li>Responsabilitate și autonomie: comportamente profesionale (lucrează în echipă, își asumă etica, respectă reglementările, se documentează singur), nu cunoștințe.</li></ul>""", auto=None))
add('7. Rezultatele învățării', 'aracis', 'Lista ARACIS 1–8', sec('aracis', 'Rezultatele ARACIS pentru Arhitectură (1–8)', '<p>Din standardele ARACIS, Anexa 2, Domeniul fundamental Științe umaniste și arte, 8. Arhitectură – CPS 8. Textul este preluat întocmai. Codurile din PANOU: C<i>n</i> = cunoștințe, A<i>n</i> = aptitudini, R<i>n</i> = responsabilitate și autonomie.</p>' + ''.join(
    f"""<div id="aracis-{n}" style="scroll-margin-top:12px;margin:16px 0;padding:12px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card)">
<b>ARACIS-{n}</b> · {e(scurt)} <span class="cand">· D46: {e(d46)}</span>
<table><tr><th style="width:150px">C{n} · Cunoștințe</th><td>{'<br>'.join(e(x) for x in cn)}</td></tr>
<tr><th>A{n} · Aptitudini</th><td>{'<br>'.join(e(x) for x in ap)}</td></tr>
<tr><th>R{n} · Responsabilitate și autonomie</th><td>{'<br>'.join(e(x) for x in ra)}</td></tr>
<tr><th>Discipline (exemple ARACIS)</th><td class="cand">{e(disc)}</td></tr></table></div>""" for n, cn, ap, ra, disc, scurt, d46 in RI), auto=None))
add('7. Rezultatele învățării', 'd46', 'Directiva 2005/36/CE, a–k', sec('d46', 'Directiva 2005/36/CE, art. 46 alin. (2), literele a–k', '<p>Formarea de arhitect asigură cel puțin următoarele cunoștințe, abilități și competențe (text oficial, versiunea consolidată în limba română):</p><table><tr><th style="width:70px">Ref.</th><th>Text</th></tr>' + ''.join(
    f'<tr id="d46-{d["litera"]}"><td><b>D46-{d["litera"]}</b></td><td>{e(d["text"])}<br><span class="cand">Pe scurt: {e(d["scurt"])}</span></td></tr>' for d in D46) +
    '</table><p class="cand">Litera d (urbanism) nu are pereche în rezultatele ARACIS pentru Arhitectură; disciplinele de urbanism o acoperă prin specificări proprii.</p>', auto=None))

add('8–10. Predare, evaluare', 'metode', '8. Metode de predare', sec('metode', '8. Metode de predare', '<p>Cum se predă: prelegere, prezentare cu exemple, studii de caz, atelier de proiectare, corectură individuală, vizite pe teren, lucru în echipă, platforme online.</p>', auto=False))
add('8–10. Predare, evaluare', 'continuturi', '9. Conținuturi', sec('continuturi', '9. Conținuturi (curs, seminar, laborator, proiect)', """
<p>Lista temelor, cu metodele de predare și numărul de ore pentru fiecare. Totalul orelor pe fiecare activitate trebuie să fie egal cu orele din plan de la rândul 23 (<a href="#ore-semestru">3.4–3.6</a>); altfel PANOU-ul semnalează diferența.</p>
<p>Completezi doar activitățile care au ore în plan; la celelalte lași gol sau „-”.</p>""", unde='FISA: rândurile 46–56', auto=False))
add('8–10. Predare, evaluare', 'bibliografie', 'Bibliografie', sec('bibliografie', 'Bibliografie', '<p>Bibliografia de curs și de aplicații: autor, titlu, editură, an. Include și lucrări recente (din ultimii 10 ani) și ce e disponibil în biblioteca universității.</p>', unde='FISA: B50, B57', auto=False))
add('8–10. Predare, evaluare', 'evaluare', '10. Evaluare și ponderi', sec('evaluare', '10. Evaluare: metode și ponderi', """
<p>Pentru fiecare activitate cu ore în plan: metoda de evaluare (10.2) și ponderea din nota finală (10.3). Ponderile însumează 100%. O activitate cu ore trebuie să aibă pondere, iar una fără ore nu.</p>
<p>Evaluarea trebuie să verifice rezultatele învățării alese la capitolul 7.</p>""", unde='FISA: H60–H63, K60–K63', auto=False))
add('8–10. Predare, evaluare', 'criterii-standard', '10.1 Criterii (standard)', sec('criterii-standard', '10.1 Criteriile de evaluare', """
<p>Textele standard ale facultății (INFO → CRITERII_E, CRITERII_S, CRITERII_L, CRITERII_P). Apar numai la activitățile care au pondere.</p>""" + NU_MODIFICI, unde='FISA: B60–B63', auto=True))
add('8–10. Predare, evaluare', 'promovare', '10.6 Condiții de promovare', sec('promovare', '10.6 Condiții de promovare', '<p>Textul standard al facultății (INFO → TEXT_PROMOVARE).</p>' + NU_MODIFICI, unde='FISA: A65', auto=True))
add('8–10. Predare, evaluare', 'ri-minimale', 'Rezultate minimale', sec('ri-minimale', 'Rezultatele învățării minimale', '<p>Ce trebuie să demonstreze studentul ca să promoveze (nota 5): pragul minim, formulat concret, legat de rezultatele din capitolul 7.</p>', unde='FISA: B66', auto=False))
add('8–10. Predare, evaluare', 'semnaturi', 'Date și semnături', sec('semnaturi', 'Date și semnături', """
<p>Data completării o scrii tu. Titularii, directorul de departament și decanul vin din centralizator; datele avizării și aprobării se completează după ședințe.</p>""", unde='FISA: rândurile 68–72', auto=None))

add('PDF', 'pdf', 'Tipărire și PDF', sec('pdf', 'Tipărire și PDF', """
<p>PDF-urile se generează din centralizator, pentru toate fișele. Se exportă doar foaia FISA, A4, fără comentarii și fără coloana M cu semnele ⓘ. Colorările de verificare sunt oprite automat pe durata exportului.</p>""", auto=None))

def nav_din(sectiuni):
    out, g0 = [], None
    for g, id_, scurt, _ in sectiuni:
        if g != g0: out.append(f'<div class="g">{e(g)}</div>'); g0 = g
        out.append(f'<a href="#{id_}">{e(scurt)}</a>')
    return ''.join(out)

def corp_din(sectiuni):
    out, g0 = [], None
    for g, id_, scurt, h in sectiuni:
        if g != g0: out.append(f'<h2>{e(g)}</h2>'); g0 = g
        out.append(h)
    return ''.join(out)

open(os.path.join(DOCS, 'index.html'), 'w', encoding='utf-8').write(pagina(
    'Fișa disciplinei – cum se completează', 'Facultatea de Arhitectură „G.M. Cantacuzino”, Iași',
    nav_din(SECT), corp_din(SECT), '<a href="pasi-anuali.html">Pașii anuali pentru director</a>'))

# ---------------- pasi-anuali.html ----------------
P = []
def pas(cand, titlu, corp):
    P.append(f'<div class="pas"><div class="cand">{cand}</div><b>{titlu}</b>{corp}</div>')

pas('iulie–septembrie', 'Fă un backup', '<p>În centralizator: meniul <b>Fișe disciplină → 4. BACKUP FD</b>. Copiază toate fișele și centralizatorul într-un folder „BACKUP an-lună-zi”. Primești email la final.</p>')
pas('după aprobarea planului', 'Pune planul nou în centralizator', '<p>Copiază în centralizator foaia cu planul de învățământ aprobat pentru noul an universitar (același format ca „PLAN ACTUAL”: un tabel pe an, semestrul impar și cel par alăturate). În INFO, la <code>PLAN_FOAIE_CURENTA</code>, scrie numele foii. Dacă planul stă în alt fișier Google, pune linkul la <code>PLAN_FISIER_URL</code>.</p>')
pas('înainte de preluare', 'Actualizează foaia INFO', '<ul><li><code>AN_UNIVERSITAR</code> (ex. 2027-2028) și <code>AN_CALENDARISTIC</code>;</li><li><code>DECAN</code>, directorii de departament (tabelul DEPARTAMENT) și emailurile lor;</li><li>dacă s-au schimbat: <code>ORE_CREDIT</code>, <code>SAPT_SEMESTRU</code>, limitele de examinare, criteriile de evaluare, textul de promovare;</li><li>opțional <code>LIMBI_STRAINE</code> (implicit engleză și franceză).</li></ul>')
pas('înainte de preluare', 'Actualizează foaia PROFESORI', '<p>Cadrele didactice noi, cu email și gradul didactic; corectează numele schimbate. Numele din coloana M sunt cele care apar în lista de titulari.</p>')
pas('', 'Preia disciplinele din plan', '<p><b>Fișe disciplină → 1. Preia disciplinele din PLAN.</b> Lista DISCIPLINE se reface din plan; disciplinele care existau își păstrează titularii și fișa. Dacă unele rânduri vechi nu mai sunt în plan, scriptul întreabă dacă le ștergi sau le păstrezi marcate.</p><p class="cand">Varianta „AN NOU” (backup complet + listă refăcută de la zero, fără titulari) se folosește doar când vrei să pornești curat, de exemplu la un plan cu totul nou.</p>')
pas('', 'Completează titularii și departamentul', '<p>În DISCIPLINE, la rândurile noi (fără titulari): titularii de curs și de aplicații (din listă) și departamentul. Verifică și rândurile de limbi străine: fiecare limbă are rândul ei.</p>')
pas('', 'Fă fișe pentru disciplinele noi', '<p>Pentru fiecare disciplină nouă fără fișă: în folderul fișelor, pe o fișă existentă, <b>Fișier → Creează o copie</b>, cu numele <code>COD_Denumire</code>. Golește în copie textele profesorului (capitolele 4–10, specificările, codurile din PANOU). Restul se completează automat la pașii următori.</p>')
pas('', 'Leagă fișele de listă', '<p><b>Fișe disciplină → 2. Generează URL/stare fișe.</b> Fișele care nu se pot lega automat apar în foaia <b>NELEGATE</b> (roz): alege disciplina din listă și rulează din nou pasul. Fișele disciplinelor scoase din plan mută-le din folderul fișelor (de exemplu într-un folder de arhivă din afara lui), ca să nu mai apară la NELEGATE.</p>')
pas('', 'Scrie datele din centralizator în fișe', '<p><b>Fișe disciplină → 3. Actualizează FD.</b> Fiecare fișă primește anul universitar, codul, orele, creditele, titularii, lista de rezultate ale învățării, comentariile și semnele ⓘ. Textele profesorilor nu se ating. Dacă durează, continuă singur și trimite email.</p>')
pas('', 'Dă drepturi și trimite fișele', '<p><b>6. Acordă drepturi de editare</b> (titularii și directorul devin editori), apoi <b>7. Trimite – TEST</b> (primești tu 3 emailuri de probă) și, după ce le verifici, <b>8. Trimite – REAL</b>. Emailurile nu se pot retrage.</p>')
pas('în timpul completării', 'Urmărește progresul și avizează', '<p>Rulează din când în când <b>2. Generează URL/stare fișe</b>: în DISCIPLINE vezi starea fiecărei fișe, data completării și verificarea. Fișele „Gata de verificare” le avizezi în PANOU-ul fișei (Aviz director, Observații).</p>')
pas('după avizare', 'PDF și backup final', '<p><b>5. PDF FD</b> (un PDF pentru fiecare fișă, doar foaia FISA, fără comentarii) și încă un <b>4. BACKUP FD</b>.</p>')

P2 = """<h2>Când schimbi scriptul</h2><p>Codul scriptului este în depozitul GitHub <a href="https://github.com/raduandrei-source/PLANURI-FISE">PLANURI-FISE</a>, fișierul <code>Centralizator.gs</code>. În centralizator: <b>Extensii → Apps Script</b>, înlocuiești tot textul cu cel nou, salvezi, apoi redeschizi centralizatorul și accepți permisiunile cerute.</p>
<h2>Când schimbi lista de rezultate ale învățării</h2><p>Lista e în foaia COMPETENTE a centralizatorului. Dacă schimbi codurile, foaia COMPETENTE_VECHI spune în ce cod nou trece fiecare cod vechi; la „Actualizează FD” codurile alese în fișe se convertesc singure.</p>
<div class="atentie">Nu modifica direct în fișe câmpurile automate (anul, codul, orele, creditele, titularii): corectează-le în centralizator și rulează „Actualizează FD”.</div>"""

open(os.path.join(DOCS, 'pasi-anuali.html'), 'w', encoding='utf-8').write(pagina(
    'Fișele disciplinelor – pașii anuali', 'Pentru directorul de departament, în fișierul „Centralizator discipline și titulari ARH”',
    '<div class="g">Pași</div><a href="#pasi">Pașii, în ordine</a><a href="#script">Când schimbi scriptul</a><div class="g">Altele</div><a href="index.html">Cum se completează fișa</a>',
    '<section id="pasi"><h2>Pașii, în ordine</h2><div class="pasi">' + ''.join(P) + '</div></section><section id="script">' + P2 + '</section>',
    '<a href="index.html">Cum se completează fișa</a>'))
open(os.path.join(DOCS, '.nojekyll'), 'w').close()
print('docs/index.html:', len(SECT), 'secțiuni; docs/pasi-anuali.html:', len(P), 'pași')
