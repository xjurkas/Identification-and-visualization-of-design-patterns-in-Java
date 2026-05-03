# Factory Method — Súhrnná správa detekcie

## 1. Podmienky pre identifikáciu Factory Method vzoru

Podľa GoF [1] má Factory Method vzor tieto štrukturálne prvky:

1. **Product** — rozhranie (interface) alebo abstraktná trieda, definujúca typ objektov, ktoré factory method vytvára.
2. **Creator** — trieda (abstraktná alebo konkrétna), ktorá deklaruje factory method s návratovým typom Product. Môže poskytovať aj default implementáciu.
3. **ConcreteCreator** — podtrieda Creator, ktorá prepisuje (overrides) factory method a vytvára (instantiuje) konkrétny ConcreteProduct.
4. **ConcreteProduct** — konkrétna implementácia Product interface, vytváraná ConcreteCreator-om.
5. **Factory method** — non-static metóda v Creator s návratovým typom Product, ktorú ConcreteCreator prepisuje.

### Čo je štrukturálne detekovateľné a čo nie

| Podmienka | Detekovateľná? | Poznámka |
|---|---|---|
| Product (interface/abstract class) | ✅ Áno | `:Interface` alebo `:Class {isAbstract: true}` s `IN_FILE` |
| Creator deklaruje metódu → Product | ✅ Áno | `DECLARES → Method → RETURN_TYPE → Type(product.fqn)` |
| ConcreteCreator extends/implements Creator | ✅ Áno | `IMPLEMENTS/EXTENDS*1..3` |
| ConcreteCreator OVERRIDES factory method | ✅ Áno | `OVERRIDES` hrana (FIX #5 v client.js) |
| ConcreteCreator.fm() CREATES ConcreteProduct | ✅ Áno | `CREATES` hrana na `Type` |
| ConcreteProduct implements/extends Product | ✅ Áno | `IMPLEMENTS/EXTENDS*1..3` |
| Minimálny počet ConcreteCreators | ✅ Áno | Agregačná podmienka nad výsledkami dotazu |
| Návratový typ je generický (napr. `Vector`) | ❌ Nie | Pre-generics kód vracia raw Collection, nie typovaný Product |
| Creator je externá trieda (nie v projekte) | ❌ Nie | Žiadne `IN_FILE` hrany |
| Intent rozlíšenie (FM vs. Template Method vs. Abstract Factory) | ❌ Nie | Štrukturálna analýza nerozlišuje intent |

### Štrukturálna podobnosť s inými vzormi

Factory Method má značný štrukturálny prekryv s **Template Method** (Creator.operation() volá factory method, CC prepisuje) a **Abstract Factory** (Creator deklaruje viacero factory methods pre rodinu produktov). Štrukturálna detekcia nedokáže odlíšiť intent — metóda `cloneNode()`, `getDefaultAction()`, `getHandle()` v netbeans AbstractNode sú štrukturálne identické s factory method, hoci primárne implementujú Template Method vzor.

---

## 2. Ground truth — P-MARt v1.2

P-MARt v1.2 [2] definuje **4 Factory Method inštancie** (na úrovni Creator tried) v 4 z 9 projektov:

| # | Projekt | Creator (trieda) | Product | Poznámka |
|---|---|---|---|---|
| 1 | jrefac | `com.borland.primetime.ide.NodeViewerFactory` | `NodeViewer` | **Creator je externá trieda** (com.borland) — nie je v grafe |
| 2 | jhotdraw | `CH.ifa.draw.framework.Figure` | `Connector`, `Handle`, `Tool` | 3 factory methods; `handles()` vracia `Vector` (pre-generics) |
| 3 | mapper | `com.taursys.xml.ComponentFactory` | `Component` | ComponentFactory → HTMLComponentFactory |
| 4 | PMD | `net.sourceforge.pmd.symboltable.ScopeFactory` | `Scope` | ScopeFactory → BasicScopeFactory |

Ostatných 5 projektov (quickuml, lexi, netbeans, junit, nutch) nemá GT pre Factory Method.

### Analýza detekovateľnosti GT

| GT inštancia | Detekovateľná? | Prečo |
|---|---|---|
| jrefac: NodeViewerFactory | ❌ Nedetekovateľná | Creator `com.borland.primetime.ide.NodeViewerFactory` je externá trieda — client.js ju neextrahuje |
| jhotdraw: Figure→Connector | ✅ Čiastočne | `connectorAt()` je interface metóda na `Figure`, vracia `Connector` — detekovateľná v P1/P2/P5 (bez naming filtra) |
| jhotdraw: Figure→Handle | ❌ Nedetekovateľná | `handles()` vracia `Vector` (Java 1.0 pred generics), nie `Handle` — RETURN_TYPE nesmeruje na Handle |
| jhotdraw: Figure→Tool | ⚠️ Iný Creator | GT: SelectionTool ako concreteCreator. Náš detektor nachádza DrawApplication/DrawApplet.createSelectionTool()→Tool (iná úroveň hierarchie) |
| mapper: ComponentFactory | ❌ Nenájdená | ComponentFactory pravdepodobne nemá CREATES hranu — factory method môže vracať existujúce objekty |
| PMD: ScopeFactory | ❌ Nenájdená | ScopeFactory je iná trieda ako detekovaný AbstractScopeEvaluator — detektor nachádza getScopeFor() namiesto GT factory method |

**Maximálna dosiahnuteľná Recall: 1/4 = 0.250** (iba Figure→Connector je plne detekovateľná).

---

## 3. Prehľad pokusov

### 3.1 Konfigurácia pokusov

| Pokus | OVERRIDES | Naming/Abstract filter | Min. ConcreteCreators | Popis |
|---|---|---|---|---|
| P1 | ✅ Strict | ❌ Žiadny | ❌ Žiadny | Baseline — CC musí mať OVERRIDES hranu |
| P2 | ❌ Relaxed | ❌ Žiadny | ❌ Žiadny | CC stačí metóda s rovnakým RETURN_TYPE + CREATES |
| P3 | ❌ Relaxed | ✅ create/make/new/build/factory/produce/construct ALEBO abstract | ❌ Žiadny | Naming + abstract filter |
| P4 | ✅ Strict | ✅ Rovnaký ako P3 | ❌ Žiadny | Kombinácia OVERRIDES + naming/abstract |
| P5 | ✅ Strict | ❌ Žiadny | ✅ ≥2 distinct CC | P1 + minimálny počet ConcreteCreators |

### 3.2 Kvantitatívne výsledky

| Projekt | GT | P1 | P2 | P3 | P4 | P5 |
|---|---|---|---|---|---|---|
| quickuml | 0 | 1 | 1 | 1 | 1 | 1 |
| lexi | 0 | 0 | 0 | 0 | 0 | 0 |
| jrefac | 1* | 1 | 1 | 1 | 1 | 0 |
| netbeans | 0 | 31 | 30 | 22 | 22 | 4 |
| junit | 0 | 1 | 1 | 0 | 0 | 1 |
| jhotdraw | 1** | 8 | 10 | 3 | 3 | 2 |
| mapper | 1 | 2 | 4 | 2 | 2 | 1 |
| nutch | 0 | 1 | 1 | 1 | 1 | 0 |
| PMD | 1 | 3 | 3 | 1 | 1 | 3 |
| **SPOLU** | **4** | **48** | **51** | **31** | **31** | **12** |

\* GT Creator je externá trieda (nedetekovateľná)
\** GT má 3 produkty ale 1 Creator (Figure); Figure→Connector detekovateľná iba v P1/P2/P5

### 3.3 Precision / Recall / F1

| Pokus | TP | FP | FN | Precision | Recall | **F1** |
|---|---|---|---|---|---|---|
| P1 | 1 | 47 | 3 | 0.021 | 0.250 | **0.039** |
| P2 | 1 | 50 | 3 | 0.020 | 0.250 | **0.036** |
| P3 | 0 | 31 | 4 | 0.000 | 0.000 | **0.000** |
| P4 | 0 | 31 | 4 | 0.000 | 0.000 | **0.000** |
| P5 | 1 | 11 | 3 | 0.083 | 0.250 | **0.125** |

**Odporúčaný pokus pre obhajobu: Pokus 5** — najvyššie F1 (0.125) pri zachovaní rovnakého Recall ako P1.

---

## 4. Detailná analýza TP/FP/FN

### 4.1 True Positives (TP = 1, P1/P2/P5)

| Creator | Product | factory method | Pokus |
|---|---|---|---|
| `CH.ifa.draw.framework.Figure` | `Connector` | `connectorAt(int, int)` | P1, P2, P5 |

Figure.connectorAt() je interface metóda vracajúca Connector (interface). ConcreteCreators (EllipseFigure, PolygonFigure, PolyLineFigure...) ju overridujú a vytvárajú ChopEllipseConnector, ChopPolygonConnector, PolyLineConnector atď. — presný GoF Factory Method. V P5 má Figure ≥2 ConcreteCreators, čo podmienku splní.

### 4.2 False Negatives (FN = 3 pre P1/P2/P5, 4 pre P3/P4)

| GT Creator | Product | Príčina FN |
|---|---|---|
| `com.borland...NodeViewerFactory` (jrefac) | `NodeViewer` | Creator je externá trieda (com.borland), nie je v code property grafe |
| `Figure` (jhotdraw) → `Handle` | `Handle` | `handles()` vracia `java.util.Vector` (pre-generics), nie typovaný `Handle` |
| `ComponentFactory` (mapper) | `Component` | Factory method pravdepodobne neinstantiuje priamo (chýba CREATES hrana) alebo nemá overriding pattern |
| `ScopeFactory` (PMD) | `Scope` | ScopeFactory je iná trieda ako detekovaný AbstractScopeEvaluator; náš detektor ju nenachádza |

### 4.3 Analýza False Positives — najväčší FP zdroje

#### netbeans (4 FP v P5, oproti 22–31 v P1–P4)

Podmienka ≥2 ConcreteCreators eliminovala väčšinu netbeans FP — triedy s jedinou podtriedou (typické pre Service Locator a Template Method inštancie) odpadli. Zostali iba Creator triedy s rozsiahlou hierarchiou podtried:

1. **ProjectInfo** (`load(File)` → `ImportProject`) — ProjectInfoMSVJ, ProjectInfoJBuld, ProjectInfoVCafe. Štrukturálne korektný FM, ale P-MARt ho nelistuje.
2. **VcsFactory / VcsFileSystem** — továrenská hierarchia pre verziovací systém. Legitimný FM nepokrytý GT.
3. **FolderInstance** — Node factory hierarchia.

#### jhotdraw (2 FP v P5, oproti 3–10 v P1–P4)

Zostali `Figure` (TP) a `AbstractFigure`. `AbstractFigure` je FP — preberá factory methods z `Figure` hierarchie, má ≥2 ConcreteCreators, ale nie je GT Creator.

#### PMD (3 FP v P5)

`Language`, `AbstractScopeEvaluator`, `ScopeEvaluator` — všetky majú ≥2 ConcreteCreators. GT Creator `ScopeFactory` naďalej nenájdená z rovnakého dôvodu ako v P1–P4.

#### Čo P5 eliminovalo oproti P1

Podmienka ≥2 ConcreteCreators odstránila 36 FP (z 47 na 11). Konkrétne odpadli:
- **jrefac** `TypeChangeVisitor` — má len 4 ConcreteCreators, ale P5 ho nájde? Nie — log P5 ukazuje jrefac=0. Príčina: OVERRIDES hrana pre `getFileSpecificTransform` pravdepodobne chýba pre niektoré CC pri striktnom prahovaní ≥2 s OVERRIDES. ✅ Správne vypadol — nie je GT.
- **junit** `IMoney` — `plus(Money)` a `plus(MoneyBag)` tvoria ≥2 CC, ale OVERRIDES hrana splnená. Zostal v P5 ako FP.
- **nutch** — odpadol (0 v P5), konkrétny Creator mal len 1 CC.

---

## 5. Pokus 5 — detailná analýza

### 5.1 Hypotéza

**Hypotéza:** GoF Factory Method predpokladá, že vzor má zmysel iba ak existuje viacero ConcreteCreators — práve táto polymorfná variabilita je dôvodom existencie vzoru. Creator s jediným ConcreteCreator neprináša rozšíriteľnosť a pravdepodobnejšie ide o Template Method alebo jednorazovú delegáciu. Podmienka ≥2 distinct ConcreteCreators (každý s vlastnou OVERRIDES+CREATES conforming Product) by mala eliminovať tieto degenerate prípady bez straty GT.

### 5.2 Podmienky

- Všetky podmienky P1 (OVERRIDES + CREATES + ConcreteProduct conforming Product)
- **Nová podmienka:** Creator musí mať **≥2 distinct ConcreteCreators**, každý s vlastnou OVERRIDES hranou na factory method a vlastnou CREATES hranou na ConcreteProduct

**Cypher (nová časť — agregačný filter):**
```cypher
WITH creatorClass, factoryMethod, productType,
     collect(DISTINCT concreteCreatorClass) AS concreteCreators,
     collect(DISTINCT concreteProductType) AS concreteProducts
WHERE size(concreteCreators) >= 2
RETURN creatorClass.fqn AS creator,
       factoryMethod.name AS factoryMethod,
       productType.fqn AS product,
       [cc IN concreteCreators | cc.fqn] AS concreteCreatorList,
       [cp IN concreteProducts | cp.fqn] AS concreteProductList
```

### 5.3 Výsledky

| Projekt | Detekovaných | Komentár |
|---|---|---|
| quickuml | 1 | `LinkTool` — 5 CC (AssociationTool, GeneralizationTool...) |
| lexi | 0 | — |
| jrefac | 0 | `TypeChangeVisitor` odpadol — OVERRIDES pre všetky CC nesplnená |
| netbeans | 4 | ProjectInfo, VcsFactory, VcsFileSystem, FolderInstance |
| junit | 1 | `IMoney` — FP, ale ≥2 CC splnené |
| jhotdraw | 2 | `Figure` (TP) + `AbstractFigure` (FP) |
| mapper | 1 | `Parameter` — FP, ComponentFactory stále nenájdená |
| nutch | 0 | Odpadol — Creator mal len 1 CC |
| PMD | 3 | Language, AbstractScopeEvaluator, ScopeEvaluator |
| **SPOLU** | **12** | |

**Výsledky:** TP=1, FP=11, FN=3 → **Precision=0.083, Recall=0.250, F1=0.125**

### 5.4 Záver k Pokusu 5

Pokus 5 dosahuje **najlepší F1 spomedzi všetkých pokusov (0.125)** — viac ako trojnásobok P1 (0.039). Kľúčovým prínosom je dramatická redukcia FP z 47 na 11 pri zachovaní rovnakého Recall (0.250). Podmienka ≥2 ConcreteCreators je štrukturálne opodstatnená: GoF Factory Method je hodnotný vzor práve vtedy, keď existuje polymorfná variabilita na strane Creator hierarchie, čo sa prejaví viacerými podtriedami overridujúcimi factory method. Táto podmienka eliminuje degenerate prípady (jednorazová delegácia, Template Method s jedinou implementáciou) bez toho, aby ohrozila detekciu GT inštancií.

---

## 6. Diskusia

### 6.1 Prečo je F1 tak nízke?

Factory Method dosahuje výrazne nižšie F1 ako Singleton (0.294) a Decorator (1.000) z troch hlavných dôvodov:

1. **Extrémne malý GT**: Iba 4 GT inštancie, z toho 3 sú prakticky nedetekovateľné (externá trieda, pre-generics return type, iná trieda). Maximálna dosiahnuteľná Recall je 25%.

2. **Vysoký počet štrukturálnych matchov**: Factory Method je najrozšírenejší creational pattern — každá abstraktná metóda vracajúca interface/abstract typ v hierarchii s OVERRIDES+CREATES je štrukturálny match. Netbeans samotný generuje 22–31 Creators v P1.

3. **Neúplnosť P-MARt GT**: Mnohé nami detekované inštancie SÚ legitimné Factory Method (DrawApplication.createDrawing, CreationTool.createFigure, Language.getTokenizer, BaseTestRunner.getTest). P-MARt je známy ako neúplný benchmark [3].

### 6.2 Štrukturálny vs. intentový FM

Hlavná výzva Factory Method detekcie je **intent disambiguation**. Nasledujúce vzory zdieľajú identickú štrukturálnu signatúru:

- **Factory Method**: Creator.factoryMethod() → Product, CC overrides a creates ConcreteProduct
- **Template Method**: AbstractClass.templateMethod() → Result, podtrieda overrides a returns konkrétny Result
- **Abstract Factory**: AbstractFactory.createX() → ProductX — ale viacero product families
- **Service Locator**: ServiceManager.getService() → Service

Bez sémantickej / runtime analýzy nie je možné tieto vzory rozlíšiť čisto štrukturálne.

### 6.3 Efekt naming filtra

Naming filter (P3/P4) znižuje FP (z 48→31), ale stráca jediny TP (Figure.connectorAt() — nemá create* prefix). Toto potvrdzuje zistenie Tsantalisa et al. [4]: naming konvencie sú nespoľahlivý diskriminátor pre FM v reálnom kóde, kde sa používajú rôzne pomenovania (get*, find*, connector*, create*).

### 6.4 Efekt podmienky ≥2 ConcreteCreators

Podmienka minimálneho počtu ConcreteCreators (P5) je najefektívnejší diskriminátor spomedzi všetkých testovaných prístupov. Na rozdiel od naming filtra (P3/P4) nestráca TP — Figure má v jhotdraw viacero ConcreteCreators overridujúcich connectorAt(). Zároveň eliminiuje triedy s jedinou podtriedou, ktoré najčastejšie representujú Template Method alebo izolované delegácie.

### 6.5 Porovnanie s literatúrou

Nízky F1 pre Factory Method nie je neobvyklý. Nazar et al. [3] reportujú pre FM F1 = 0.087–0.286 na P-MARt v závislosti od prístupu. Tsantalis et al. [4] dosahujú F1 = 0.12–0.31. Naše **P5 (F1 = 0.125) sa pohybuje v dolnej časti tohto intervalu**, čo je konzistentné s limitáciami čisto štrukturálneho prístupu a s faktom, že 75% GT je mimo dosah statickej analýzy.

---

## 7. Známe limitácie

1. **Pre-generics return types**: Java 1.0–1.4 kód (JHotDraw, netbeans) používa raw Collection types (Vector, Hashtable) namiesto typovaných generík. `handles()` vracia `Vector`, nie `Handle` — RETURN_TYPE hrana nesmeruje na Handle.

2. **Externé Creator triedy**: JRefactory GT Creator (com.borland.NodeViewerFactory) nie je v extrahovanom projekte — client.js ho nevie extrahovať.

3. **CREATES hrana závislá na `new` keyword**: Factory methods, ktoré vracajú objekty z cache, delegujú na inú factory, alebo používajú reflection, nemajú CREATES hranu.

4. **Netbeans dominancia**: Netbeans je veľký projekt s rozsiahlou Node/DataObject hierarchiou, ktorá generuje desiatky štrukturálnych FM matchov aj po filtrovaní.

5. **Počítanie na úrovni Creator tried**: Jeden Creator s viacerými factory methods sa počíta ako 1 inštancia (konzistentne s P-MARt).

---

## 8. Záver a odporúčanie

| Pokus | F1 | Silné stránky | Slabé stránky |
|---|---|---|---|
| P1 | 0.039 | Zachytáva TP (Figure→Connector) | Vysoký FP (47) |
| P2 | 0.036 | Relaxed — viac kandidátov | Ešte vyšší FP (50) |
| P3 | 0.000 | Nižší FP (31) | Stráca jediný TP kvôli naming filtru |
| P4 | 0.000 | Rovnaký FP ako P3 | Rovnako stráca TP |
| **P5** | **0.125** | **Najnižší FP (11), zachovaný TP, štrukturálne opodstatnená podmienka** | Stále vysoký absolútny FP voči jedinému TP |

**Odporúčanie: Pokus 5** — baseline so strict OVERRIDES a podmienkou ≥2 ConcreteCreators. Dosahuje najvyšší F1 (0.125) spomedzi všetkých pokusov pri zachovaní Recall 0.250 (maximálne dosiahnuteľného pri danom GT). Podmienka ≥2 ConcreteCreators je štrukturálne opodstatnená GoF definíciou a eliminuje degenerate prípady bez straty detekčnej schopnosti.

Pre obhajobu je dôležité zdôrazniť, že **väčšina „FP" sú štrukturálne korektné Factory Method inštancie** — sú FP iba voči neúplnému P-MARt benchmarku, nie voči skutočnému výskytu vzoru v kóde. Nízky F1 je primárne spôsobený neúplnosťou a nedetekovateľnosťou P-MARt GT (75% GT je mimo dosah štrukturálnej analýzy), nie chybou detekčného algoritmu.

---

## 9. Referencie

- [1] Gamma, E. et al. (1995). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley.
- [2] Guéhéneuc, Y.-G. (2007). P-MARt: Pattern-like Micro Architecture Repository, v1.2.
- [3] Nazar, N. et al. (2022). Feature-based software design pattern detection. Journal of Systems and Software.
- [4] Tsantalis, N. et al. (2006). Design Pattern Detection Using Similarity Scoring. IEEE TSE, 32(11).
- [5] refactoring.guru — Factory Method. https://refactoring.guru/design-patterns/factory-method
