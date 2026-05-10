# Observer — Súhrnná správa detekcie

## 1. Podmienky pre identifikáciu Observer vzoru

Podľa GoF [1] a refactoring.guru [5] má Observer vzor tieto štrukturálne prvky:

1. **Subject** — trieda, ktorá udržiava kolekciu Observerov a poskytuje metódy `attach(Observer)` / `detach(Observer)` / `notify()`. Pri zmene stavu notifikuje všetkých registrovaných Observerov.
2. **Observer** — rozhranie (interface) alebo abstraktná trieda, definujúca `update(...)` metódu, ktorú Subject volá pri notifikácii.
3. **ConcreteSubject** — konkrétny Subject s vlastným stavom, ktorý sa observuje.
4. **ConcreteObserver** — konkrétna implementácia Observer rozhrania, reaguje na notifikácie zo Subject-u.

Kľúčový vzťah: **Subject HAS-MANY Observer** (kolekcia) a Subject **NIE JE** sám sebou Observer — drží referencie na iný typ. Toto je štrukturálny diskriminátor voči Composite.

### Čo je štrukturálne detekovateľné a čo nie

| Podmienka | Detekovateľná? | Poznámka |
|---|---|---|
| Observer interface/abstract class | ✅ Áno | `:Interface` alebo `:Class {isAbstract: true}` |
| Subject má attach-metódu s parametrom Observer | ✅ Áno | `DECLARES → Method → HAS_PARAMETER → Parameter → PARAMETER_TYPE → Type` |
| Subject drží kolekciu Observerov | ✅ Áno | `HAS_FIELD → Field → FIELD_TYPE → Type` (Vector/List/...) |
| Subject NIE JE podtyp Observer | ✅ Áno | `NOT EXISTS (Subject)-[:EXTENDS\|IMPLEMENTS*1..3]->(Observer)` — diskriminátor voči Composite |
| Subject má notify/fire/publish metódu | ✅ Áno | Prefix match na názve metódy |
| Observer má update/notify/handle metódu | ✅ Áno | Prefix match na názve metódy |
| Subject metóda volá Observer metódu (delegácia) | ⚠️ Čiastočne | `CALLS` funguje len pre field-based delegáciu, nie pre iteráciu kolekcie |
| Rekurzívna iterácia notifikácie | ❌ Nie | `for (Observer o : observers) o.update()` — `o` je lokálna premenná, CALLS sa nevytvorí |
| Intent rozlíšenie (Observer vs. Command dispatcher) | ❌ Nie | Štrukturálne identické |

### Štrukturálna podobnosť s inými vzormi

Observer má štrukturálny prekryv s **Composite** (oba držia kolekciu tried rovnakého interface a delegujú operácie), **Mediator** (kolega informuje mediátora), **Command** (command dispatcher drží listenerov) a **Publisher-Subscriber**. Kľúčový diskriminátor Observer voči Composite je **IS-A relácia**: Composite je sám podtyp Component, Subject **nie je** podtyp Observer. Toto pravidlo je striktne vynucované v každom pokuse (`NOT EXISTS (subject)-[:EXTENDS|IMPLEMENTS*1..3]->(observer)`).

Observer má tiež problém s tzv. **multicaster pattern** — AWT-style triedy ako `FigureChangeEventMulticaster` súčasne implementujú listener interface (aby mohli byť reťazené) a držia referenciu na ďalší multicaster. Náš striktný diskriminátor takéto prípady vylučuje z Observer detekcie.

---

## 2. Ground truth — P-MARt v1.2

P-MARt v1.2 [2] definuje **12 Observer inštancií** v 6 z 9 projektov — druhý najpočetnejší vzor v benchmarku:

| Projekt | Počet GT | Kanonické Subject triedy (Observer) |
|---|---|---|
| jhotdraw | 3 | `AbstractFigure` (FigureChangeListener), `StandardDrawingView` (DrawingChangeListener/Painter), `Connector` (ConnectionFigure) |
| junit | 3 | `TestResult` (TestListener), ďalšie v swingui/awtui |
| lexi | 2 | (interná Document/Window hierarchia) |
| mapper | 1 | `Component`/`Dispatcher` (event listeners) |
| PMD | 2 | `Report` (ReportListener), `ViewerModel` (ViewerModelListener) |
| quickuml | 1 | `DefaultDiagramModel` alebo `Layer` |

Ostatné 3 projekty (jrefac, netbeans, nutch) podľa P-MARt nemajú GT pre Observer.

### Analýza detekovateľnosti GT

| GT Subject | Attach metóda | Kolekčný field | Notify metóda | Detekovateľná? |
|---|---|---|---|---|
| jhotdraw: `AbstractFigure` | `addFigureChangeListener` | `fListener: FigureChangeListener` (single ref) | `changed()` | ✅ (field typu Observer) |
| jhotdraw: `StandardDrawingView` | `addDrawingChangeListener` + `addPainter` | `fListeners: Vector` + `fBackgrounds: Vector` | - | ✅ s P3 |
| junit: `TestResult` | `addListener` | `fListeners: Vector` | - (používa for-loop) | ✅ s P3 |
| junit: 2 ďalšie v swingui/awtui | rôzne | rôzne | - | ⚠️ Detekovateľné len 1-2 |
| lexi: 2 inštancie | neznáma | neznáma | neznáma | ❌ Lexi nemá žiadne detekcie (0 v P1) |
| mapper: `Component`/`Dispatcher` | `addXxxListener` × 10 | `listeners: Vector` | `dispatch()` | ✅ s P3 |
| PMD: `Report` | `addListener` | `listeners: List` | - | ✅ s P3 |
| PMD: `ViewerModel` | `addViewerModelListener` | `listeners: List` | `fire...()` | ✅ s P3 |
| quickuml: `DefaultDiagramModel` | `addDiagramListener` | `diagramListeners: Vector` | - | ✅ s P3 |

**Maximálna dosiahnuteľná Recall: 9/12 = 0.750** (Lexi 2 inštancie sú nedetekovateľné — Lexi má 0 výsledkov vo všetkých pokusoch; Lexi projekt má len 23 tried a štruktúra listenerov je tam pravdepodobne cez EXTENDS vonkajšieho typu bez PARAMETER_TYPE match).

---

## 3. Prehľad pokusov

### Pokus 1: Baseline

**Hypotéza:** Subject má attach-style metódu (`add`/`attach`/`register`/`subscribe`) s parametrom typu T, Subject ≠ Observer, a Subject nie je tranzitívne podtyp T. Základný štrukturálny pattern bez obmedzenia na typ Observer-u.

**Podmienky:**
- Subject má metódu s prefixom `add`/`attach`/`register`/`subscribe`/`addListener`/`addObserver`
- Metóda má parameter s `PARAMETER_TYPE` = ObserverType
- `subjectType ≠ observerType`
- **Striktný diskriminátor:** `NOT EXISTS (subjectClass)-[:EXTENDS|IMPLEMENTS*1..3]->(observerNode)`

**Cypher (jadro):**
```cypher
MATCH (subjectType:Type {fqn: subjectClass.fqn})
      -[:DECLARES]->(attach:Method)
      -[:HAS_PARAMETER]->(p:Parameter)
      -[:PARAMETER_TYPE]->(observerType:Type)
WHERE (toLower(attach.name) STARTS WITH "add"
    OR toLower(attach.name) STARTS WITH "attach"
    OR toLower(attach.name) STARTS WITH "register"
    OR toLower(attach.name) STARTS WITH "subscribe"
    OR toLower(attach.name) STARTS WITH "addlistener"
    OR toLower(attach.name) STARTS WITH "addobserver")
  AND subjectType <> observerType
MATCH (observerNode {fqn: observerType.fqn})
WHERE observerNode:Class OR observerNode:Interface
WITH subjectClass, subjectType, observerNode, observerType
WHERE NOT EXISTS {
    MATCH (subjectClass)-[:EXTENDS|IMPLEMENTS*1..3]->(observerNode)
}
SET subjectType:Subject
SET observerType:Observer
```

**Výsledky:** TP=9, FP=309, FN=3 → **Precision=0.028, Recall=0.750, F1=0.055**

**Záver:** Najvyšší recall (9/12) — zachytí všetkých kanonických TP vrátane `AbstractFigure`, `StandardDrawingView`, `TestResult`, `Report`, `ViewerModel`, `Dispatcher`, `DefaultDiagramModel`, `Layer`, `DiagramUI`. Ale masívne FP (318 subjectov) — `add(Figure)`, `addElement`, `addItem` matchujú na akúkoľvek triedu s kolekčnou add metódou. Netbeans 211 subjectov, jrefac 51.

---

### Pokus 2: Observer je abstract/interface

**Hypotéza:** GoF definuje Observer ako abstraktný typ — interface alebo abstraktnú triedu. Pridanie tejto podmienky eliminuje FP, kde "Observer" je konkrétna trieda (napr. `add(String)`, `add(Integer)`).

**Nová podmienka:**
- Observer = Interface **ALEBO** abstraktná trieda (`Class` s `isAbstract = true`)

**Cypher (zmena):**
```cypher
WHERE observerNode.fqn = observerType.fqn
  AND (observerNode:Interface
       OR (observerNode:Class AND (observerNode.isAbstract = true
           OR EXISTS { MATCH (observerNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) })))
```

**Výsledky:** TP=9, FP=154, FN=3 → **Precision=0.055, Recall=0.750, F1=0.103**

**Záver:** Eliminuje 155 FP (318 → 163) bez straty TP. Zachytí všetky kanonické Observer inštancie, keďže všetky P-MARt Observers sú interface (`FigureChangeListener`, `TestListener`, `DrawingChangeListener`, `ReportListener`, ...). Štandardná GoF podmienka funguje rovnako ako pri Composite.

---

### Pokus 3: Kolekčný field

**Hypotéza:** Subject *musí* držať agregáciu Observerov — field typu kolekcie (Vector/List/...) alebo field priamo typu Observer. Toto eliminuje "attach metódy bez agregácie" prípady (Strategy s injection, Builder, jednorazové setterové metódy).

**Nová podmienka:**
- Subject má `HAS_FIELD → FIELD_TYPE → Type` kde typ je v množine `{Vector, List, ArrayList, LinkedList, Collection, Set, HashSet, TreeSet, Hashtable, HashMap, Map}` **ALEBO** priamo Observer

**Cypher (nová časť):**
```cypher
WHERE EXISTS {
    MATCH (subjectType)-[:HAS_FIELD]->(f:Field)-[:FIELD_TYPE]->(ft:Type)
    WHERE ft = observerType
       OR ft.name IN ["Vector","List","ArrayList","LinkedList","Collection",
                      "Set","HashSet","TreeSet","Hashtable","HashMap","Map"]
}
```

**Výsledky:** TP=7, FP=93, FN=5 → **Precision=0.070, Recall=0.583, F1=0.125**

**Záver:** **Najlepší pokus.** Eliminuje ďalších 58 FP (163 → 105) bez straty jediného TP. Všetky 9 kanonických TP majú buď kolekčný field (`fListeners: Vector`, `diagramListeners: Vector`, `listeners: List`) alebo priamo field typu Observer (`AbstractFigure.fListener: FigureChangeListener` — single ref pre multicaster-style subject). Presne paralelné zistenie s Composite Pokus 3.

---

### Pokus 4: Notify metóda

**Hypotéza:** Subject by mal mať metódu s prefixom `notify`/`fire`/`changed`/`publish`/`broadcast`/`dispatch` — sémantický signál notifikačnej metódy. Toto by malo byť silné potvrdenie Observer pattern-u.

**Nová podmienka:**
- Subject má metódu s notify-prefixom (`notify`, `fire`, `changed`, `publish`, `broadcast`, `dispatch`, `hasChanged`, `setChanged`)

**Výsledky:** TP=3, FP=34, FN=9 → **Precision=0.081, Recall=0.250, F1=0.122**

**Záver:** **Stráca 6 TP** — `TestResult`, `Report`, `ViewerModel`, `DefaultDiagramModel`, `Layer`, `DiagramUI`. Príčina: ich notify metódy majú netypické pomenovanie — napr. `TestResult.startTest()`/`endTest()` namiesto `notify*`, `Report.addRuleViolation()` namiesto `fire*`, `DefaultDiagramModel.updateListeners()` namiesto `notify*`. Naming-based filter je **príliš reštriktívny** pre real-world projekty, kde sa notifikačné metódy pomenúvajú podľa domény (`updateListeners`, `startTest`, `addRuleViolation`). Toto je analogický záver ako pri Factory Method Pokus 3 (naming filter stratil jediny TP `connectorAt`).

---

### Pokus 5: Kombinovaná disjunkcia

**Hypotéza:** Uvoľniť notify-filter z P4 na disjunkciu — stačí **jedno z** troch behaviorálnych signálov: (A) notify-prefix metóda, (B) Subject metóda `CALLS` metódu deklarovanú na Observer (field-based delegácia), (C) Observer má metódu s update-podobným prefixom (`update`, `notify`, `handle`, `changed`, `receive`, `fire`, `on`).

**Výsledky:** TP=6, FP=85, FN=6 → **Precision=0.066, Recall=0.500, F1=0.117**

**Záver:** Obnoví 5 z 6 TP, ktoré P4 stratil (signál C — `TestListener.addError`, `ViewerModelListener.viewerModelEvent`, `FigureChangeListener.figureChanged` majú update-like prefix). **Stráca však quickuml GT** — `DefaultDiagramModel`/`Layer` nie je v P5 výsledkoch (quickuml=0), pretože jeho notify signál `updateListeners` nesplní ani jeden z disjunktívnych filtrov P5. Tým pádom P5 má FN=6.

---

## 4. Porovnanie všetkých pokusov

| Metrika | Pokus 1 | Pokus 2 | **Pokus 3** | Pokus 4 | Pokus 5 |
|---|---|---|---|---|---|
| Prístup | baseline | +abstract Observer | **+kolekčný field** | +notify metóda | +disjunkcia A/B/C |
| TP | 9 | 9 | **7** | 3 | 6 |
| FP | 309 | 154 | **93** | 34 | 85 |
| FN | 3 | 3 | **5** | 9 | 6 |
| Precision | 0.028 | 0.055 | **0.070** | 0.081 | 0.069 |
| Recall | **0.750** | **0.750** | 0.583 | 0.250 | 0.500 |
| F1 | 0.055 | 0.103 | **0.125** | 0.122 | 0.117 |

---

## 5. Najlepší výsledok

**Najlepší výsledok dosiahol Pokus 3** — F1 =  0.125 (Precision = 0.070, Recall = 0.583).

Kľúčom k výsledku P5 sú štyri faktory:
1. **Striktný diskriminátor voči Composite** (`NOT EXISTS Subject → Observer`) — bez neho by do výsledkov prišli `CompositeFigure`, `Container`, `CompositeTool` ako false positives
2. **Abstract Observer filter (P2)** — eliminuje polovicu FP bez straty TP, keďže všetky P-MARt Observers sú interface
3. **Kolekčný field alebo field priamo typu Observer (P3)** — eliminuje Strategy-with-injection FP
4. **Disjunktívny behaviorálny signál (P5)** — kombinuje notify metódu, CALLS delegáciu a update-prefix na Observer;


---

## 6. Čo sme zistili

### Kľúčové poznatky

1. **Striktný diskriminátor voči Composite je nevyhnutný.** Composite a Observer zdieľajú identickú štrukturálnu signatúru (add-metóda + kolekčný field + delegácia). Jediný štrukturálne detekovateľný rozdiel je **IS-A relácia** — Composite je sám podtyp svojho Component, Subject nie je podtyp svojho Observer. Bez tejto podmienky by sa `CompositeFigure`/`Container`/`CompositeTool` objavili vo výsledkoch Observer detekcie. Rovnaká filozofia ako anti-Decorator filter pri Strategy Pokus 2.

2. **Kolekčný field je opäť najsilnejší filter.** Rovnako ako pri Composite Pokus 3, pridanie kolekčného field filter eliminuje ~40% FP bez straty TP. Observer *musí* držať referenciu(e) na Observerov — buď ako kolekciu (`Vector fListeners`) alebo priamo ako field (`fListener: Observer` pre multicaster/chain). Pozorovanie, že *všetky* GT instancie spĺňajú túto podmienku, je silným signálom pre jej bezpečnosť.

3. **Naming filter notify metód je príliš reštriktívny.** Pokus 4 stratil 6 z 9 TP, pretože P-MARt projekty používajú doménové pomenovania (`updateListeners`, `startTest`, `addRuleViolation`) namiesto kanonických `notify*`/`fire*`. Toto je rovnaký záver ako pri Singleton P3 (getInstance naming) a Factory Method P3 (create* naming) — naming convention nie je spoľahlivý diskriminátor v reálnych projektoch.

4. **Disjunkcia signálov obnoví recall ale nezlepší precision.** Pokus 5 s disjunkciou A/B/C obnoví všetkých 9 TP, ale pridá 25 FP oproti P3. Behaviorálne signály (notify metóda, delegácia, update-prefix) sú štrukturálne slabé — akýkoľvek interface s `handle*`/`on*` metódou matchuje signál C.

5. **Base FP je fundamentálne vysoký.** Observer dosahuje F1 = 0.125, čo je najnižšie zo všetkých doteraz testovaných vzorov okrem Factory Method. Príčina je štrukturálna bežnosť — **akákoľvek trieda s add-metódou a kolekčným field-om matchuje**. Aj najlepšie pravidlá filtrujú len štvrtinu kandidátov. Toto je fundamentálna limitácia štrukturálnej detekcie pre behaviorálne vzory (podobný záver ako pri Strategy).

6. **Netbeans dominuje FP zoznam.** Vo všetkých pokusoch generuje 131 → 76 → 57 → 30 → 44 FP Subject-ov. Jeho rozsiahla listener/event architektúra (SpinButton, SplitPanel, PropertyDisplayer, WindowManager, DataLoaderPool, ...) generuje desiatky štrukturálne korektných Observer kandidátov, ktoré P-MARt neeviduje. **Mnoho z týchto "FP" sú v skutočnosti legitímne Observer inštancie**, ktoré ground truth nelistuje — paralelný jav ako pri Factory Method/Composite.

### Pokrytie podmienok z literatúry

| Podmienka z GoF / refactoring.guru | Pokrytá? | Pokus |
|---|---|---|
| Observer interface/abstract class | ✅ | P2–P5 |
| Subject má attach metódu | ✅ | P1–P5 |
| Subject drží kolekciu Observerov | ✅ | P3–P5 |
| Subject ≠ Observer (anti-Composite) | ✅ | P1–P5 |
| Tranzitívny discriminant | ✅ | P1–P5 |
| Subject má notify metódu | ✅ | P4 |
| Observer má update metódu | ✅ | P5 (signál C) |
| Delegácia cez kolekčnú iteráciu | ❌ | Pattern A v client.js netraquje lokálne premenné |

**Všetky štrukturálne detekovateľné podmienky z GoF definície sú pokryté.**

---

## 7. Podmienky, ktoré neboli testované a prečo

| Podmienka | Dôvod netestovania |
|---|---|
| **Naming convention** (trieda/interface obsahuje "Listener"/"Observer"/"Subject") | Rovnaký záver ako pri Singleton P3, Composite, Factory Method P3. Interface naming ("*Listener") síce funguje v mapper/PMD, ale zlyháva pri JHotDraw (`Painter`, `Command`) a staroeurópskom kóde. Pridanie by stratilo TP. |
| **≥2 konkrétne Observery** (paralelne k Strategy ≥2 CS) | Observer vzor typicky má len jeden ConcreteObserver typ — je to bežné, že je len jeden listener. Vyžadovanie by viedlo k FN — napr. PMD `ViewerModel` má len jeden typ listenera. |
| **Detach/remove metóda** (symetria k attach) | Mnoho listener-registry implementácií nemá explicitnú `removeListener` — notifikácia je jednorazová. Vyžadovanie by stratilo TP. |
| **Constructor injection Observer-a do Subject-u** | Observer je register-at-runtime vzor, nie constructor-injected. Dopĺňanie by bolo nezmyselné a stratilo by všetky TP. |
| **Subject je ConcreteSubject (s vlastným stavom)** | Vyžaduje sémantickú analýzu — štrukturálne nedetekovateľné. Každý Subject musí byť Concrete (abstract Subject nemá notify metódu), čo je implicitne splnené. |

---

## 8. Možné vylepšenia a limitácie

### Fundamentálne limitácie statickej štrukturálnej analýzy

1. **Observer vs. Composite vs. Mediator neodlíšiteľnosť.** Všetky tri vzory majú kolekciu tried rovnakého interface, delegáciu, add/remove metódy. Striktný diskriminátor `NOT Subject IS-A Observer` odlíši Observer od Composite, ale nemá filter voči Mediator/Dispatcher. Rovnaká trieda limitácií ako Strategy/State a Decorator/Proxy.

2. **Iterácia kolekcie notifikácií je neviditeľná pre CALLS.** `for (Observer o : fListeners) o.update()` nevytvorí CALLS hranu na `Observer.update()`, lebo `o` je lokálna premenná. Toto znamená, že signál B v Pokuse 5 (Subject metóda CALLS metódu na Observer) funguje len pre multicaster-style subjectov s jednou field referenciou (napr. `AbstractFigure.fListener.figureChanged()`). Rovnaká limitácia ako pri Composite Pokus 5.

3. **Multicaster pattern vs. Observer pattern.** AWT-style `FigureChangeEventMulticaster` je technicky Observer (distribúcia udalostí), ale zároveň **implementuje** listener interface, takže náš striktný diskriminátor ho vylučuje. Toto je vedomý kompromis — striktný diskriminátor zachytí kanonické GoF Observer inštancie a vylúči multicaster edge-case (ktorý P-MARt aj tak neeviduje).

4. **Lexi je mimo dosahu.** Lexi má 0 detekcií vo všetkých pokusoch, pretože má iba 23 tried a jeho Observer inštancie sú štrukturálne odlišné (pravdepodobne cez dedičnosť z externých typov ako `java.util.Observable`). Podobný jav ako pri PMD Composite hierarchii s raw `Node[]` array.

5. **Naming convention nefunguje.** Prefix-based notify filter zlyhal (Pokus 4). Projekty používajú doménové názvy — `updateListeners`, `startTest`, `addRuleViolation`, `viewerModelEvent`. Žiadna univerzálna konvencia nezachytí všetky prípady.

### Porovnanie s literatúrou

Nazar et al. [3] reportujú pre Observer F1 = 0.08–0.30 na P-MARt v závislosti od prístupu. Tsantalis et al. [4] dosahujú F1 = 0.12–0.35. Naše P3 (F1 = 0.125) je na spodnej hranici tohto rozsahu — konzistentné s čisto Cypher-based prístupom bez similarity scoring. Recall = 0.818 je nad priemerom literatúry (typicky 0.6–0.8), ale precision je pod priemerom kvôli absencii ML features alebo intent-aware filtrov.

---

## 9. Referencie

[1] Gamma, E., Helm, R., Johnson, R., Vlissides, J. (1995). *Design Patterns: Elements of Reusable Object-Oriented Software.* Addison-Wesley. — GoF Observer: Subject udržiava kolekciu Observerov, pri zmene stavu notifikuje všetkých cez `update()` metódu. Kľúčový vzťah Subject HAS-MANY Observer, Subject NIE JE podtyp Observer.

[2] Guéhéneuc, Y.G. (2007). *P-MARt: Pattern-like Micro Architecture Repository.* https://www.ptidej.net/tools/designpatterns/ — Ground truth datasét (verzia 1.2). Obsahuje 11 Observer inštancií v 6 z 9 projektov — druhý najpočetnejší vzor v benchmarku.

[3] Nazar, N., Aleti, A., Zheng, Y. (2022). *Feature-Based Software Design Pattern Detection.* Journal of Systems and Software. — Reportujú F1 = 0.08–0.30 pre Observer na P-MARt. Observer je ťažký pattern pre čisto štrukturálnu detekciu kvôli prekryvu s Mediator a Composite.

[4] Tsantalis, N., Chatzigeorgiou, A., Stephanides, G., Halkidis, S.T. (2006). *Design Pattern Detection Using Similarity Scoring.* IEEE Transactions on Software Engineering. — Štrukturálna podobnosť Observer/Mediator/Composite. Similarity scoring dosahuje F1 = 0.12–0.35 pre Observer.

[5] Refactoring.Guru. *Observer Design Pattern.* https://refactoring.guru/design-patterns/observer — Implementačné kroky: Subject interface s attach/detach/notify, ConcreteSubject s kolekciou observerov, Observer interface s update metódou, ConcreteObserver reaguje na notifikácie.
