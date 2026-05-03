# Strategy — Súhrnná správa detekcie

## 1. Podmienky pre identifikáciu Strategy vzoru

Podľa GoF [1] a refactoring.guru [5] má Strategy vzor tieto štrukturálne prvky:

1. **Strategy** — rozhranie (interface) alebo abstraktná trieda, definujúca spoločný kontrakt pre algoritmy.
2. **ConcreteStrategy** — konkrétne implementácie Strategy interface, každá reprezentujúca iný algoritmus.
3. **Context** — trieda, ktorá drží referenciu (field) na Strategy objekt a deleguje naň volania.

### Čo je štrukturálne detekovateľné a čo nie

| Podmienka | Detekovateľná? | Poznámka |
|---|---|---|
| Strategy interface/abstract class | ✅ Áno | `:Interface` alebo `:Class {isAbstract: true}` s `IN_FILE` |
| ≥2 ConcreteStrategies | ✅ Áno | `IMPLEMENTS/EXTENDS` (direct) alebo `*1..3` (tranzitívne) |
| Context drží field typu Strategy | ✅ Áno | `HAS_FIELD → FIELD_TYPE → Type(strategy.fqn)` |
| Context deleguje na Strategy | ✅ Áno | `DECLARES → Method → CALLS → Method` kde `containerFqn = strategy.fqn` |
| Context NEimplementuje Strategy | ✅ Áno | `NOT EXISTS (IMPLEMENTS/EXTENDS*1..4)` — odlíšenie od Decorator |
| Constructor injection | ✅ Áno | `isInjected` flag alebo `:Constructor → HAS_PARAMETER → PARAMETER_TYPE` |
| Field je non-static | ✅ Áno | `field.isStatic = false` |
| Intent rozlíšenie (Strategy vs. State) | ❌ Nie | Identická štrukturálna signatúra |

### Štrukturálna podobnosť s inými vzormi

Strategy má identickú štrukturálnu signatúru so **State** (Context drží field typu State, deleguje, CS implementujú). Kľúčový diskriminátor voči **Decorator/Proxy/Adapter** je, že Context **neimplementuje** Strategy interface — ak áno, ide o wrapping vzor, nie o delegáciu na vymeniteľný algoritmus.

---

## 2. Ground truth — P-MARt v1.2

P-MARt v1.2 [2] definuje **7 Strategy inštancií** v 3 z 9 projektov:

| MA# | Projekt | Strategy | ConcreteStrategies | Contexts |
|---|---|---|---|---|
| 89 | jhotdraw | `Connector` (interface) | `ChopBoxConnector`, `ChopEllipseConnector`, `ChopPolygonConnector`, `PolyLineConnector`, `LocatorConnector`, `ShortestDistanceConnector` | `LineConnection`, `ConnectionTool`, `ChangeConnectionHandle`, ... |
| 90 | jhotdraw | `Painter` (interface) | `BufferedUpdateStrategy`, `PatternPainter`, `SimpleUpdateStrategy` | `StandardDrawingView` |
| 91 | jhotdraw | `Locator` (interface) | `ElbowTextLocator`, `OffsetLocator`, `PolyLineLocator`, `RelativeLocator` | `PolygonHandle`, `LocatorConnector`, `LocatorHandle`, `TextFigure` |
| 92 | jhotdraw | `PointConstrainer` (interface) | `GridConstrainer` | `StandardDrawingView` |
| — | mapper | `AbstractWriter` (abstract class) | `XMLWriter` | `DOM_1_20000929_DocumentAdapter` |
| — | nutch | `IWebDBWriter` (interface) | `DistributedWebDBWriter`, `WebDBWriter` | `WebDBInjector` |
| — | nutch | `IWebDBReader` (interface) | `DistributedWebDBReader`, `WebDBReader` | `FetchListTool` |

### Analýza detekovateľnosti GT

| GT Strategy | Direct CS | Tranzitívne CS | Detekovateľná? | Príčina |
|---|---|---|---|---|
| `Connector` | 1 (AbstractConnector) | 7 | ✅ s P3+ | Potrebuje tranzitívny count |
| `Painter` | 3 | 3 | ✅ | Funguje aj s direct |
| `Locator` | 2 | 6 | ✅ | Funguje s direct aj tranzitívne |
| `PointConstrainer` | 1 (GridConstrainer) | 1 | ❌ | Iba 1 CS — nikdy neprejde ≥2 |
| `AbstractWriter` | 1 (XMLWriter) | 1 | ❌ | Iba 1 CS — nikdy neprejde ≥2 |
| `IWebDBWriter` | 2 | 2 | ✅ | Funguje s direct |
| `IWebDBReader` | 2 | 2 | ✅ | Funguje s direct |

**Maximálna dosiahnuteľná Recall: 5/7 = 0.714** (PointConstrainer a AbstractWriter majú iba 1 CS).

---

## 3. Prehľad pokusov

### Pokus 1: Baseline

**Hypotéza:** Základná štrukturálna detekcia — Strategy (interface/abstract, IN_FILE) + ≥2 direct CS + Context s field typu Strategy + delegácia (≥1 CALLS) + Context ≠ Strategy.

**Podmienky:**
- Strategy = lokálny interface alebo abstraktná trieda
- ≥2 direct ConcreteStrategies (IMPLEMENTS/EXTENDS)
- Context Type má field → FIELD_TYPE → Strategy Type
- Context.fqn ≠ Strategy.fqn
- Context deleguje: ≥1 metóda v Context CALLS metódu na Strategy

**Výsledky:** TP=3, FP=52, FN=4 → **Precision=0.055, Recall=0.429, F1=0.097**

**Záver:** Detekuje Painter + IWebDBReader + IWebDBWriter. Nedetekuje Connector (1 direct CS) a Locator (2 direct, ale jeden je parsing artefakt "}"). Vysoký FP z netbeans (22) a nutch (7).

---

### Pokus 2: Anti-Decorator

**Hypotéza:** Context nesmie implementovať/extendovať Strategy. Toto odlíši Strategy od Decorator/Proxy/Adapter.

**Nová podmienka:**
- Context NESMIE konformovať so Strategy cez `IMPLEMENTS|EXTENDS*1..4`

**Výsledky:** TP=3, FP=43, FN=4 → **Precision=0.065, Recall=0.429, F1=0.113**

**Záver:** FP klesli z 52→43 (−9). Eliminovalo Decorator-like FP: `DebuggerInfoProducer`, `CompilerCookie`, `Scope` a ďalšie, kde Context bol zároveň implementátorom Strategy. TP zachované — žiaden GT Context neimplementuje svoj Strategy.

---

### Pokus 3: Tranzitívne ConcreteStrategies

**Hypotéza:** Rozšírenie na tranzitívne CS cez `IMPLEMENTS|EXTENDS*1..3` pridá Connector (AbstractConnector→Connector, ChopBoxConnector→AbstractConnector) a Locator.

**Nová podmienka:**
- ConcreteStrategies sa počítajú tranzitívne cez `IMPLEMENTS|EXTENDS*1..3`

**Výsledky:** TP=5, FP=57, FN=2 → **Precision=0.081, Recall=0.714, F1=0.145**

**Záver:** +2 TP oproti P2 — Connector (7 tranzitívnych CS) a Locator (6 tranzitívnych CS). Recall skočil z 0.429 na 0.714. FP stúpli z 43 na 57, pretože tranzitívny count pridáva aj FP interfacy s bohatou hierarchiou.

---

### Pokus 4: Constructor injection

**Hypotéza:** GoF odporúča injection Strategy cez konštruktor. Testujeme, či je to použiteľný filter — `field.isInjected = true` alebo konštruktor Context-u má parameter typu Strategy.

**Nová podmienka:**
- Field je injektovaný cez konštruktor

**Výsledky:** TP=3, FP=30, FN=4 → **Precision=0.091, Recall=0.429, F1=0.150**

**Záver:** Najlepšia precision (0.091), ale stratili sme 2 TP — Connector a Painter. Ich Context-y (LineConnection, StandardDrawingView) prijímajú Strategy cez setter alebo internú inicializáciu, nie cez konštruktor. Constructor injection je príliš reštriktívne pre staršie projekty (rovnaký záver ako private constructor pri Singleton Pokuse 2).

---

### Pokus 5: Non-static field

**Hypotéza:** Strategy je per-inštanciu — statický field indikuje Singleton alebo utility pattern. Filter na non-static field by mal odstrániť FP bez straty TP.

**Nová podmienka:**
- Field nesmie byť statický (`isStatic = false`)

**Výsledky:** TP=5, FP=54, FN=2 → **Precision=0.085, Recall=0.714, F1=0.152**

**Záver:** Rovnaké TP ako P3, ale −3 FP (62→59). Non-static filter eliminoval statické field FP bez dopadu na GT. Najlepší F1 zo všetkých pokusov.

---

## 4. Porovnanie všetkých pokusov

| Metrika | Pokus 1 | Pokus 2 | Pokus 3 | Pokus 4 | **Pokus 5** |
|---|---|---|---|---|---|
| Prístup | baseline | +anti-Decorator | +tranzitívne CS | +ctor injection | **P3 + non-static** |
| TP | 3 | 3 | 5 | 3 | **5** |
| FP | 52 | 43 | 57 | **30** | 54 |
| FN | 4 | 4 | **2** | 4 | **2** |
| Precision | 0.055 | 0.065 | 0.081 | **0.091** | 0.085 |
| Recall | 0.429 | 0.429 | **0.714** | 0.429 | **0.714** |
| F1 | 0.097 | 0.113 | 0.145 | 0.150 | **0.152** |

---

## 5. Najlepší výsledok

**Najlepší výsledok dosiahol Pokus 5** — F1 = 0.152 (Precision = 0.085, Recall = 0.714).

Kľúčom k tomuto výsledku sú tri faktory:
1. **Anti-Decorator filter (P2)** — eliminoval Decorator/Proxy FP bez straty TP
2. **Tranzitívne CS (P3)** — pridal Connector a Locator (oba majú intermediárnu abstraktnú triedu)
3. **Non-static field (P5)** — odstránil 3 FP bez dopadu na TP

---

## 6. Čo sme zistili

### Kľúčové poznatky

1. **Anti-Decorator filter je kľúčový diskriminátor.** Decorator, Proxy a Adapter zdieľajú identickú štrukturálnu signatúru so Strategy (field + delegácia). Podmienka „Context neimplementuje Strategy" je jediný štrukturálne detekovateľný rozdiel. Eliminovala 9 FP bez straty TP.

2. **Tranzitívny count CS je nutný.** Connector má iba 1 direct implementátor (AbstractConnector), ale 7 tranzitívnych (ChopBoxConnector→ChopBoxConnector→AbstractConnector→Connector). Bez tranzitívneho countu by sme stratili 2 z 5 TP (−40% recall).

3. **Constructor injection je príliš reštriktívne.** Pokus 4 ukázal, že GT Context-y často inicializujú Strategy cez setter alebo internú logiku, nie cez konštruktor. Táto podmienka stratí Connector aj Painter. Rovnaký záver ako pri Singleton (private constructor) a Decorator (constructor injection bol nutný, ale tam GT ho mal).

4. **Non-static field je bezpečný filter.** Strategy je per-inštanciu vzor — statický field indikuje Singleton alebo globálny stav. Všetky GT fieldy sú non-static, takže filter neovplyvní TP.

5. **Strategy vs. State je štrukturálne nerozlíšiteľné.** Oba vzory majú identickú štruktúru — Context, interface, ConcreteStrategies/States, field, delegácia. Rozlíšenie vyžaduje behaviorálnu analýzu (State mení sám seba, Strategy je vybraný zvonku).

### Pokrytie podmienok z literatúry

| Podmienka z GoF / refactoring.guru | Pokrytá? | Pokus |
|---|---|---|
| Strategy interface/abstract class | ✅ | P1–P5 |
| ≥2 ConcreteStrategies (direct) | ✅ | P1, P2 |
| ≥2 ConcreteStrategies (tranzitívne) | ✅ | P3, P4, P5 |
| Context drží field typu Strategy | ✅ | P1–P5 |
| Context deleguje na Strategy | ✅ | P1–P5 |
| Context ≠ Strategy (anti-Decorator) | ✅ | P2–P5 |
| Constructor injection | ✅ | P4 |
| Non-static field | ✅ | P5 |

**Všetky štrukturálne podmienky z GoF definície sú pokryté.**

---

## 7. Podmienky, ktoré neboli testované a prečo

| Podmienka | Dôvod netestovania |
|---|---|
| **Naming convention** (field/trieda obsahuje „Strategy"/„Policy") | Staršie projekty nepoužívajú konvenciu — GT používa `fUpdateStrategy`, `fLocator`, `fStart`. Naming by nezachytil GT. |
| **Setter method** (setStrategy()) | Komplementárne k constructor injection, ale ešte menej spoľahlivé — mnohé settery nemajú štandardné pomenovanie. |
| **≥2 distinct metódy na Strategy** | Niektoré GT Strategy majú 1 metódu (Painter.draw()). Prah ≥2 by stratil TP. |
| **Proportional delegation** (Context deleguje ≥50% metód Strategy) | Implicitne pokryté podmienkou ≥1 CALLS. Prísnejší prah by stratil GT kde Context deleguje len 1 z viacerých metód. |
| **Context nemá podtriedy** | Nie je súčasťou GoF definície. Mnohé GT Context-y majú podtriedy (StandardDrawingView). |

---

## 8. Možné vylepšenia a limitácie

### Fundamentálne limitácie statickej štrukturálnej analýzy

1. **Štrukturálna neodlíšiteľnosť Strategy/State.** Oba vzory zdieľajú identickú štruktúru. Čisto štrukturálna analýza ich nevie rozlíšiť bez behaviorálnej analýzy (State: objekt mení svoj vlastný stav; Strategy: klient vyberá algoritmus zvonku) [1]. P-MARt definuje 4 State inštancie v 2 projektoch — niektoré naše FP môžu byť State vzory.

2. **GT s 1 ConcreteStrategy.** PointConstrainer (1 CS: GridConstrainer) a AbstractWriter (1 CS: XMLWriter) majú iba jedného implementátora. S podmienkou ≥2 CS nie sú detekovateľné. Zníženie na ≥1 by dramaticky zvýšilo FP.

3. **Netbeans dominancia.** Netbeans generuje 20–23 FP vo všetkých pokusoch vďaka rozsiahlej frameworkovej architektúre s desiatkami interfacov, field referencií a delegácií.

4. **Vysoký base FP.** Strategy vzor je štrukturálne veľmi bežný — akýkoľvek interface s ≥2 implementátormi, field referencou a delegáciou matchuje. Toto je fundamentálna limitácia štrukturálnej detekcie pre behaviorálne vzory.

### Porovnanie s literatúrou

Nazar et al. [3] reportujú pre Strategy F1 = 0.10–0.35 na P-MARt v závislosti od prístupu. Tsantalis et al. [4] dosahujú F1 = 0.15–0.40. Naše P5 (F1 = 0.152) je v dolnej časti tohto rozsahu, čo je konzistentné s čisto štrukturálnym prístupom bez ML features.

---

## 9. Referencie

[1] Gamma, E., Helm, R., Johnson, R., Vlissides, J. (1995). *Design Patterns: Elements of Reusable Object-Oriented Software.* Addison-Wesley. — GoF Strategy: Context drží referenciu na Strategy interface, deleguje naň. ConcreteStrategies implementujú rôzne algoritmy. Štrukturálne identický so State.

[2] Guéhéneuc, Y.G. (2007). *P-MARt: Pattern-like Micro Architecture Repository.* https://www.ptidej.net/tools/designpatterns/ — Ground truth datasét (verzia 1.2). Obsahuje 7 Strategy inštancií v 3 z 9 projektov.

[3] Nazar, N., Aleti, A., Zheng, Y. (2022). *Feature-Based Software Design Pattern Detection.* Journal of Systems and Software. https://arxiv.org/abs/2012.01708 — DPD_F reportuje F1 = 0.10–0.35 pre Strategy na P-MARt.

[4] Tsantalis, N., Chatzigeorgiou, A., Stephanides, G., Halkidis, S.T. (2006). *Design Pattern Detection Using Similarity Scoring.* IEEE Transactions on Software Engineering. — Štrukturálna podobnosť Strategy/State. Anti-Decorator filter je inšpirovaný ich prístupom k odlíšeniu wrapping vzorrov.

[5] Refactoring.Guru. *Strategy Design Pattern.* https://refactoring.guru/design-patterns/strategy — Implementačné kroky: Strategy interface, ConcreteStrategies, Context s field a delegáciou. Context prijíma Strategy zvonku (injection).
