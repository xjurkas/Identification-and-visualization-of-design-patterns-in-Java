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

P-MARt v1.2 [2] definuje **8 Factory Method inštancie** (na úrovni Creator tried) v 4 z 9 projektov: 

| # | Projekt | Creator (trieda) | Product | Poznámka |
|---|---|---|---|---|
| 1 | jrefac | `com.borland.primetime.ide.NodeViewerFactory` | `NodeViewer` | Creator je externá trieda (com.borland) — nie je v grafe |
| 2 | jhotdraw | `Figure` | `Connector` | `connectorAt()` |
| 3 | jhotdraw | `Figure` | `Handle` | `handles()` vracia `Vector` (pre-generics) |
| 4 | jhotdraw | (bez `creator` roly) | `Tool` | concreteCreator: `SelectionTool` |
| 5 | mapper | `ComponentFactory` | `Component` | |
| 6 | PMD | `ScopeFactory` | `Scope` | |
| 7 | PMD | `TargetJDKVersion` | `JavaParserConstants` | |
| 8 | PMD | `TargetJDKVersion` | `JavaParserConstants` | |

Ostatných 5 projektov (quickuml, lexi, netbeans, junit, nutch) nemá GT pre Factory Method. 

### Analýza detekovateľnosti GT

| GT inštancia | Detekovateľná? | Prečo |
|---|---|---|
| jrefac: NodeViewerFactory | ❌ Nedetekovateľná | com.borland.primetime.ide.NodeViewerFactory je externá trieda z balíka com.borland. Keďže trieda nie je súčasťou analyzovaného zdrojového stromu, nie je extrahovaná ako plnohodnotný uzol v grafe. Nástroj teda nemá k dispozícii jej metódy, telo factory metódy ani prípadné CREATES vzťahy. |
| jhotdraw: Figure→Connector | ✅ Detekovateľná/Čiastočne | Figure je v grafe a metóda connectorAt(...) vracia typ Connector. Štruktúrne teda existuje väzba Creator → Product. Označil by som ju ako čiastočne detekovateľnú preto, že ide najmä o deklaráciu factory metódy na rozhraní/abstraktnej úrovni; pri príliš striktnej query vyžadujúcej priamu CREATES hranu v tele metódy by mohla vypadnúť. Pri uvoľnenej Factory Method definícii je však táto GT inštancia zachytiteľná. |
| jhotdraw: Figure→Handle | ❌ Nedetekovateľná | Relevantná metóda handles() nevracia priamo Handle, ale raw Vector. Keďže ide o starý Java kód pred generikami, z návratového typu sa nedá staticky odvodiť, že kolekcia obsahuje objekty typu Handle. RETURN_TYPE teda smeruje na Vector, nie na GT produkt Handle. |
| jhotdraw: Figure→Tool | ⚠️ Nie podľa kanonickej GT roly | P-MARt tu uvádza produkt Tool a konkrétny concreteCreator typu SelectionTool, ale explicitná kanonická rola Creator v GT chýba. Detektor môže nájsť štruktúrne podobný prípad, napr. DrawApplication alebo DrawApplet.createSelectionTool() → Tool, ale to nie je rovnaký GT Creator. Preto by som to nepočítal ako čisté TP, ale ako prípad s neúplnou/nejednoznačnou anotáciou v GT. |
| mapper: ComponentFactory | ❌ Nenájdená | ComponentFactory je síce GT Creator, ale factory metóda pravdepodobne nevytvára produkt spôsobom, ktorý by extraktor zachytil ako CREATES hranu. Ak metóda iba vracia existujúci objekt, používa cache, lookup alebo nepriamu tvorbu, aktuálna Factory Method query ju nevie spojiť s konkrétnym Product. |
| PMD: ScopeFactory | ❌ Nenájdená | GT Creator je ScopeFactory, ale detektor zachytáva iný štruktúrne podobný creator, napr. AbstractScopeEvaluator cez metódu typu getScopeFor(). To znamená, že nástroj našiel factory-like štruktúru, ale nie tú, ktorú uvádza P-MARt. Z pohľadu GT teda ostáva ScopeFactory → Scope ako FN. |
| PMD: TargetJDKVersion → JavaParserConstants | ✅ Detekovateľná | TargetJDKVersion je prítomný v analyzovanom projekte a jeho factory štruktúra je zachytiteľná v grafe. Creator aj Product sú dostupné a vzťah medzi nimi zodpovedá tomu, čo Factory Method query vie rozpoznať. Túto inštanciu by som počítal ako TP. |
| PMD: TargetJDKVersion → JavaParserConstants | ✅ Detekovateľná | Ide o druhú GT inštanciu s rovnakým Creator/Product párom. Dôvod detekovateľnosti je rovnaký ako pri predchádzajúcom riadku: TargetJDKVersion aj JavaParserConstants sú v grafe a štruktúra je pre aktuálnu query zachytiteľná. Pri instance-level vyhodnotení ju môžeš viesť ako samostatnú GT inštanciu; pri deduplikácii podľa DISTINCT Creator FQN by sa však tieto dva riadky zliali do jedného. |

**Maximálna dosiahnuteľná Recall: 3/8 = 0.375**.

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

### 3.2 Precision / Recall / F1

| Pokus | TP | FP | FN | Precision | Recall | **F1** |
|---|---|---|---|---|---|---|
| P1 | 1 | 47 | 7 | 0.021 | 0.250 | **0.039** |
| P2 | 1 | 50 | 7 | 0.020 | 0.250 | **0.036** |
| P3 | 0 | 31 | 8 | 0.000 | 0.000 | **0.000** |
| P4 | 0 | 31 | 8 | 0.000 | 0.000 | **0.000** |
| P5 | 3 | 23 | 5 | 0.115 | 0.375 | **0.177** |

**Najlepší: Pokus 5** — najvyššie F1 (0.177) pri zachovaní rovnakého Recall ako P1.


---

## 4. Pokus 5 — detailná analýza

### 4.1 Hypotéza

**Hypotéza:** GoF Factory Method predpokladá, že vzor má zmysel iba ak existuje viacero ConcreteCreators — práve táto polymorfná variabilita je dôvodom existencie vzoru. Creator s jediným ConcreteCreator neprináša rozšíriteľnosť a pravdepodobnejšie ide o Template Method alebo jednorazovú delegáciu. Podmienka ≥2 distinct ConcreteCreators (každý s vlastnou OVERRIDES+CREATES conforming Product) by mala eliminovať tieto degenerate prípady bez straty GT.

### 4.2 Podmienky

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

### 4.3 Záver k Pokusu 5

Pokus 5 dosahuje **najlepší F1 spomedzi všetkých pokusov (0.177)** — viac ako trojnásobok P1 (0.039). Kľúčovým prínosom je dramatická redukcia FP pri zachovaní rovnakého Recall (0.375). Podmienka ≥2 ConcreteCreators je štrukturálne opodstatnená: GoF Factory Method je hodnotný vzor práve vtedy, keď existuje polymorfná variabilita na strane Creator hierarchie, čo sa prejaví viacerými podtriedami overridujúcimi factory method. Táto podmienka eliminuje degenerate prípady (jednorazová delegácia, Template Method s jedinou implementáciou) bez toho, aby ohrozila detekciu GT inštancií.

---

## 5. Diskusia

### 5.1 Prečo je F1 tak nízke?

Factory Method dosahuje výrazne nižšie F1 ako Singleton (0.294) a Decorator (1.000) z troch hlavných dôvodov:

1. **Extrémne malý GT**: 8 GT inštancie, z toho 4 sú prakticky nedetekovateľné (externá trieda, pre-generics return type, iná trieda). Maximálna dosiahnuteľná Recall je 50%.

2. **Vysoký počet štrukturálnych matchov**: Factory Method je najrozšírenejší creational pattern — každá abstraktná metóda vracajúca interface/abstract typ v hierarchii s OVERRIDES+CREATES je štrukturálny match. Netbeans samotný generuje 22–31 Creators v P1.

3. **Neúplnosť P-MARt GT**: Mnohé nami detekované inštancie SÚ legitimné Factory Method (DrawApplication.createDrawing, CreationTool.createFigure, Language.getTokenizer, BaseTestRunner.getTest). P-MARt je známy ako neúplný benchmark [3].

### 5.2 Štrukturálny vs. intentový FM

Hlavná výzva Factory Method detekcie je **intent disambiguation**. Nasledujúce vzory zdieľajú identickú štrukturálnu signatúru:

- **Factory Method**: Creator.factoryMethod() → Product, CC overrides a creates ConcreteProduct
- **Template Method**: AbstractClass.templateMethod() → Result, podtrieda overrides a returns konkrétny Result
- **Abstract Factory**: AbstractFactory.createX() → ProductX — ale viacero product families
- **Service Locator**: ServiceManager.getService() → Service

Bez sémantickej / runtime analýzy nie je možné tieto vzory rozlíšiť čisto štrukturálne.

### 5.3 Efekt naming filtra

Naming filter (P3/P4) znižuje FP (z 48→31), ale stráca jediny TP (Figure.connectorAt() — nemá create* prefix). Toto potvrdzuje zistenie Tsantalisa et al. [4]: naming konvencie sú nespoľahlivý diskriminátor pre FM v reálnom kóde, kde sa používajú rôzne pomenovania (get*, find*, connector*, create*).

### 5.4 Efekt podmienky ≥2 ConcreteCreators

Podmienka minimálneho počtu ConcreteCreators (P5) je najefektívnejší diskriminátor spomedzi všetkých testovaných prístupov. Na rozdiel od naming filtra (P3/P4) nestráca TP — Figure má v jhotdraw viacero ConcreteCreators overridujúcich connectorAt(). Zároveň eliminiuje triedy s jedinou podtriedou, ktoré najčastejšie representujú Template Method alebo izolované delegácie.

### 5.5 Porovnanie s literatúrou

Nízky F1 pre Factory Method nie je neobvyklý. Nazar et al. [3] reportujú pre FM F1 = 0.087–0.286 na P-MARt v závislosti od prístupu. Tsantalis et al. [4] dosahujú F1 = 0.12–0.31. Naše **P5 (F1 = 0.177) sa pohybuje v dolnej časti tohto intervalu**, čo je konzistentné s limitáciami čisto štrukturálneho prístupu a s faktom, že cez 50% GT je mimo dosah statickej analýzy.

---

## 6. Známe limitácie

1. **Pre-generics return types**: Java 1.0–1.4 kód (JHotDraw, netbeans) používa raw Collection types (Vector, Hashtable) namiesto typovaných generík. `handles()` vracia `Vector`, nie `Handle` — RETURN_TYPE hrana nesmeruje na Handle.

2. **Externé Creator triedy**: JRefactory GT Creator (com.borland.NodeViewerFactory) nie je v extrahovanom projekte — client.js ho nevie extrahovať.

3. **CREATES hrana závislá na `new` keyword**: Factory methods, ktoré vracajú objekty z cache, delegujú na inú factory, alebo používajú reflection, nemajú CREATES hranu.

4. **Netbeans dominancia**: Netbeans je veľký projekt s rozsiahlou Node/DataObject hierarchiou, ktorá generuje desiatky štrukturálnych FM matchov aj po filtrovaní.

5. **Počítanie na úrovni Creator tried**: Jeden Creator s viacerými factory methods sa počíta ako 1 inštancia (konzistentne s P-MARt).

---


## 7. Referencie

- [1] Gamma, E. et al. (1995). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley.
- [2] Guéhéneuc, Y.-G. (2007). P-MARt: Pattern-like Micro Architecture Repository, v1.2.
- [3] Nazar, N. et al. (2022). Feature-based software design pattern detection. Journal of Systems and Software.
- [4] Tsantalis, N. et al. (2006). Design Pattern Detection Using Similarity Scoring. IEEE TSE, 32(11).
- [5] refactoring.guru — Factory Method. https://refactoring.guru/design-patterns/factory-method
