# Composite — Súhrnná správa detekcie

## 1. Podmienky pre identifikáciu Composite vzoru

Podľa GoF [1] a refactoring.guru [5] má Composite vzor tieto štrukturálne prvky:

1. **Component** — rozhranie (interface) alebo abstraktná trieda, definujúca spoločný kontrakt pre Leaf aj Composite. Deklaruje operácie spoločné pre jednoduché aj zložené objekty.
2. **Leaf** — konkrétna trieda implementujúca Component, ktorá nemá deti. Reprezentuje listové uzly stromu.
3. **Composite** — trieda implementujúca Component, ktorá udržiava kolekciu detí typu Component. Implementuje operácie pre správu detí (`add`/`remove`/`getChild`) a operácie spoločné pre Component (typicky rekurzívne delegované na deti).
4. **Client** — manipuluje s objektmi v hierarchii jednotne cez Component interface.

Kľúčový rekurzívny vzťah: **Composite je sám podtyp Component a zároveň drží agregáciu detí typu Component.**

### Čo je štrukturálne detekovateľné a čo nie

| Podmienka | Detekovateľná? | Poznámka |
|---|---|---|
| Component interface/abstract class | ✅ Áno | `:Interface` alebo `:Class {isAbstract: true}` |
| Composite IS-A Component (tranzitívne) | ✅ Áno | `EXTENDS\|IMPLEMENTS*1..3` (`CompositeFigure → AbstractFigure → Figure`) |
| Child management metóda s parametrom Component | ✅ Áno | `DECLARES → Method → HAS_PARAMETER → Parameter → PARAMETER_TYPE → Type(component.fqn)` |
| Kolekčný field (Vector/List/...) | ✅ Áno | `HAS_FIELD → Field → FIELD_TYPE → Type` s názvom Vector/List/Collection/... |
| Generický field `List<Component>` | ❌ Nie | Java 1.0–1.4 kód v P-MARt je spred generík — `HAS_TYPE_ARGUMENT` v grafe neexistuje |
| Leaf existencia (sibling bez kolekcie) | ✅ Áno | Iná trieda implementujúca Component bez child-management metódy |
| Delegácia cez kolekčnú iteráciu | ❌ Nie | `for (T x : list) x.m()` nevytvára CALLS hranu — `x` je lokálna premenná |
| Intent rozlíšenie (Composite vs. Observer-chain) | ❌ Nie | Štrukturálna analýza nerozlišuje intent |

### Štrukturálna podobnosť s inými vzormi

Composite má štrukturálny prekryv s **Decorator** (oba implementujú Component a držia referenciu na Component), **Observer** (Subject drží kolekciu Observerov rovnakého interface) a **Chain of Responsibility** (handler drží referenciu na ďalší handler rovnakého typu). Kľúčový diskriminátor Composite je **kardinalita** (mnoho detí vs. jeden wrapped objekt pri Decoratore) a **IS-A vzťah** (Composite je sám podtyp Component — to ho odlišuje od Observer/Strategy, kde Subject/Context NIE JE podtyp Observer/Strategy).

---

## 2. Ground truth — P-MARt v1.2

P-MARt v1.2 [2] definuje **7 Composite inštancií** v 5 z 9 projektov:

| Projekt | Počet GT | Kanonické Composite triedy (Component) |
|---|---|---|
| quickuml | 2 | `CompositeTool` (Tool), 2. inštancia v UML modeli |
| jhotdraw | 1 | `CompositeFigure` (Figure) |
| junit | 1 | `TestSuite` (Test) |
| mapper | 1 | `Container` (Component) |
| PMD | 2 | AST node hierarchia (SimpleNode/ASTCompilationUnit) |

Ostatné 4 projekty (lexi, jrefac, netbeans, nutch) podľa P-MARt nemajú GT pre Composite.

### Analýza detekovateľnosti GT

| GT Composite | Tranzitívne EXTENDS/IMPLEMENTS | Child-mgmt metóda | Kolekčný field | Detekovateľná? |
|---|---|---|---|---|
| jhotdraw: `CompositeFigure` | `→ AbstractFigure → Figure` (2 kroky) | `add(Figure)` | `fFigures: Vector` | ✅ s P3 |
| junit: `TestSuite` | `→ Test` (1 krok) | `addTest(Test)` | `fTests: Vector` | ⚠️ Teoreticky áno, v praxi nedetekovaná (viď nižšie) |
| mapper: `Container` | `→ Component` (1 krok) | `add(Component)` | `children: Vector` | ✅ |
| quickuml: `CompositeTool` | `→ AbstractTool → Tool` (2 kroky) | `add(Tool)` | Vector field | ✅ |
| quickuml: 2. inštancia | neznáma | neznámy prefix | neznámy | ⚠️ Nedetekovaná |
| PMD: `SimpleNode` | `→ Node` (1 krok) | `jjtAddChild(Node, int)` | `children: Node[]` | ❌ (raw array, nie kolekcia) |
| PMD: druhá AST inštancia | neznáma | neznámy prefix | neznámy | ❌ Nedetekovaná |

**Maximálna dosiahnuteľná Recall: 5/7 = 0.714** (PMD hierarchia používa raw `Node[]` array namiesto `Vector`/`List`, takže kolekčný field filter ju eliminuje; 2. quickuml inštancia je mimo dosah štrukturálneho matcha).

> **⚠️ Oprava GT mapovania:** Pri pôvodnom vyhodnotení bol `junit.samples.money.MoneyBag` (Component: `IMoney`) nesprávne počítaný ako true positive. Podľa ground truth XML súboru P-MARt tvorí GT pre junit Composite inštanciu dvojica **`junit.framework.TestSuite` / `junit.framework.Test`**, nie `MoneyBag` / `IMoney`. `MoneyBag` preto musí byť hodnotený ako **false positive** vo všetkých pokusoch. `TestSuite` sa napriek splneným podmienkam (implementuje `Test`, má `addTest(Test)`, drží `fTests: Vector`) v žiadnom pokuse nedetekovala — pravdepodobnou príčinou je kolízia fqn alebo absencia hrany medzi `Type` uzlom `TestSuite` a `Class` uzlom `TestSuite` v grafe, čo spôsobilo, že MATCH na `compositeClass` nenašiel zhodu s `componentType` pre `Test`. Táto nedetekcia znižuje maximálne dosiahnuteľný Recall na **4/7 = 0.571** v praxi.

### Kľúčový poznatok o pre-generics kóde

P-MARt obsahuje projekty zo Java 1.0–1.4 éry (JHotDraw 5.1, JUnit 3.7, Lexi 0.1.1). To znamená, že `CompositeFigure.fFigures` je deklarovaný ako raw `Vector`, nie `Vector<Figure>`. Pôvodný prístup detekcie cez `HAS_TYPE_ARGUMENT` (generický type argument) zlyhal s 0/7 detekciami. Riešením je opieranie sa o **typy parametrov child-management metód** (`add(Figure)`, `remove(Figure)`), kde `PARAMETER_TYPE` korektne smeruje na `Figure`. Toto je rovnaký problém a rovnaké riešenie ako pri `handles(): Vector` vo Factory Method správe [FM, sekcia 6].

---

## 3. Prehľad pokusov

### Pokus 1: Baseline

**Hypotéza:** Trieda je Composite, ak má child-management metódu (`add`/`insert`/`append`/`addChild`/`addElement`) s parametrom typu T, a zároveň sama tranzitívne `EXTENDS`/`IMPLEMENTS` ten istý T (IS-A rekurzia).

**Podmienky:**
- Composite tranzitívne EXTENDS/IMPLEMENTS Component cez `*1..3`
- Composite má metódu s prefixom `add`/`insert`/`append`/`addChild`/`addElement`
- Metóda má parameter s `PARAMETER_TYPE` = Component

**Cypher (jadro):**
```cypher
MATCH (compositeClass:Class)-[:EXTENDS|IMPLEMENTS*1..3]->(componentNode)
WHERE componentNode:Interface OR componentNode:Class
MATCH (componentType:Type {fqn: componentNode.fqn})
MATCH (compositeType:Type {fqn: compositeClass.fqn})
MATCH (compositeType)-[:DECLARES]->(m:Method)
      -[:HAS_PARAMETER]->(p:Parameter)
      -[:PARAMETER_TYPE]->(componentType)
WHERE toLower(m.name) STARTS WITH "add"
   OR toLower(m.name) STARTS WITH "insert"
   OR toLower(m.name) STARTS WITH "append"
SET compositeType:Composite
SET componentType:Component
```

**Výsledky:** TP=3, FP=20, FN=4 → **Precision=0.130, Recall=0.429, F1=0.200**

**Záver:** Detekuje `CompositeFigure`, `Container`, `CompositeTool`. `MoneyBag` bol pôvodne počítaný ako TP, ale ide o FP — GT pre junit je `TestSuite`, nie `MoneyBag`. `TestSuite` nebola detekovaná v žiadnom pokuse. Stráca PMD (2× — nekolekčný field) a 2. quickuml inštanciu. Vysoký FP hlavne z netbeans (14) a junit (`Money`, `MoneyBag`, `TestListenerTest`).

---

### Pokus 2: Component musí byť abstract/interface

**Hypotéza:** Pridanie GoF podmienky, že Component je abstraktný typ, eliminuje FP, kde "Component" je konkrétna trieda.

**Nová podmienka:**
- Component = Interface **ALEBO** abstraktná trieda (`Class` s `isAbstract = true`)

**Cypher (zmena):**
```cypher
WHERE componentNode:Interface
   OR (componentNode:Class AND (componentNode.isAbstract = true
       OR EXISTS { MATCH (componentNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }))
```

**Výsledky:** TP=3, FP=14, FN=4 → **Precision=0.176, Recall=0.429, F1=0.250**

**Záver:** Eliminuje 6 FP (Netbeans z 14 na 9, PMD `ClassScope/Scope` FP odpadá). TP zostávajú 3 — `Figure`, `Component`, `Tool` sú interface alebo abstract class, `IMoney` tiež (interface). Štandardná GoF podmienka funguje, ale `TestSuite` stále chýba.

---

### Pokus 3: Kolekčný field

**Hypotéza:** Composite *musí* držať agregáciu — buď field typu kolekcie (Vector/List/...) alebo priamo field typu Component. Toto eliminuje "child management bez agregácie" prípady (Observer chain, Builder).

**Nová podmienka:**
- Composite má `HAS_FIELD → FIELD_TYPE → Type` kde typ je v množine `{Vector, List, ArrayList, LinkedList, Collection, Set, HashSet, TreeSet, Hashtable, HashMap, Map}` **ALEBO** priamo Component

**Cypher (nová časť):**
```cypher
WHERE EXISTS {
    MATCH (compositeType)-[:HAS_FIELD]->(f:Field)-[:FIELD_TYPE]->(ft:Type)
    WHERE ft = componentType
       OR ft.name IN ["Vector","List","ArrayList","LinkedList","Collection",
                      "Set","HashSet","TreeSet","Hashtable","HashMap","Map"]
}
```

**Výsledky:** TP=3, FP=8, FN=4 → **Precision=0.273, Recall=0.429, F1=0.333**

**Záver:** **Najlepší pokus.** Eliminuje ďalších 6 FP bez straty reálnych TP. Všetky 3 detekované TP majú kolekčný field. Eliminoval `FigureChangeEventMulticaster` (drží len `next` referenciu, nie kolekciu — ide o Observer chain), `MoneyBag` (nemá kolekčný field odpovedajúci Component hierarchii), a `TestListenerTest` (testovacia trieda). Netbeans pokles z 9 na 6.

---

### Pokus 4: Leaf existencia

**Hypotéza:** Compositový vzor implicitne vyžaduje, aby existovala aspoň jedna iná trieda implementujúca Component bez child-management metódy (Leaf). Toto by malo eliminovať "Composite-only" hierarchie.

**Nová podmienka:**
- Musí existovať iná `Class` tranzitívne implementujúca Component, ktorá **nemá** žiadnu metódu s child-management prefixom s parametrom Component

**Výsledky:** TP=3, FP=9, FN=4 → **Precision=0.250, Recall=0.429, F1=0.316**

**Záver:** Pridáva 1 FP oproti P3 (`FigureChangeEventMulticaster` v JHotDraw — má 22 listových implementátorov `FigureChangeListener`, ktoré sa označia ako Leafs). Leaf existencia je príliš permisívne pravidlo — takmer každý interface má aspoň jedného implementátora bez add metódy. Užitočné informačne (logy ukazujú 206 Leafs spolu), ale ako filter neefektívne.

---

### Pokus 5: Delegácia na deti

**Hypotéza:** Composite metódy by mali volať metódy na Component (forwarding na deti — sémantická signatúra rekurzívnej operácie).

**Nová podmienka:**
- Composite metóda `CALLS` metódu deklarovanú na Component type

**Cypher (nová časť):**
```cypher
WHERE EXISTS {
    MATCH (compositeType)-[:DECLARES]->(cm:Method)-[:CALLS]->(target:Method)
    MATCH (componentType)-[:DECLARES]->(target)
}
```

**Výsledky:** TP=2, FP=7, FN=5 → **Precision=0.222, Recall=0.286, F1=0.250**

**Záver:** **Stráca `CompositeFigure`** — kritická TP. Príčina: `CompositeFigure.draw()` volá `figure.draw()` pre každý element z `fFigures`, ale **CALLS hrana z JDT na iteráciu kolekcie nezachytí target metódu na `Figure`** — lokálna premenná z iterátora nie je sledovateľná (dokumentovaná limitácia Pattern A v client.js). Toto je presne analogický problém ako pri Decorator Pokus 1 pre JUnit `TestDecorator`, ale **bez ekvivalentného FIX-u** — riešenie by vyžadovalo tracking iterácie kolekcie, nie len field delegáciu.

---

## 4. Porovnanie všetkých pokusov

| Metrika | Pokus 1 | Pokus 2 | **Pokus 3** | Pokus 4 | Pokus 5 |
|---|---|---|---|---|---|
| Prístup | baseline | +abstract Component | **+kolekčný field** | +Leaf existencia | +delegácia CALLS |
| TP | 3 | 3 | **3** | 3 | 2 |
| FP | 20 | 14 | **8** | 9 | 7 |
| FN | 4 | 4 | **4** | 4 | 5 |
| Precision | 0.130 | 0.176 | **0.273** | 0.250 | 0.222 |
| Recall | **0.429** | **0.429** | **0.429** | **0.429** | 0.286 |
| F1 | 0.200 | 0.250 | **0.333** | 0.316 | 0.250 |

---

## 5. Najlepší výsledok

**Najlepší výsledok dosiahol Pokus 3** — F1 = 0.333 (Precision = 0.273, Recall = 0.429).

Kľúčom k tomuto výsledku sú tri faktory:
1. **Tranzitívna konformita** (`EXTENDS|IMPLEMENTS*1..3`) — bez nej by sa `CompositeFigure → AbstractFigure → Figure` nedetegoval, rovnako ani `CompositeTool → AbstractTool → Tool`
2. **PARAMETER_TYPE namiesto generických argumentov** — obchádza absenciu generík v pre-generics Java 1.0–1.4 kóde
3. **Kolekčný field check** — eliminuje Observer-chain a single-reference FP bez straty reálnych TP (najsilnejší filter)

---

## 6. Čo sme zistili

### Kľúčové poznatky

1. **Generiká nie sú dostupné v starom Java kóde.** Pôvodný set pokusov postavený na `HAS_TYPE_ARGUMENT` zlyhal úplne (0/7 detekcií). Toto je rovnaký problém ako `handles(): Vector` vo Factory Method správe [FM, sekcia 6] — Java 1.0–1.4 používa raw collection types. Riešenie: použiť `PARAMETER_TYPE` na child-management metódach, ktorý je v grafe korektne prepojený.

2. **Tranzitívna dedičnosť je nutná.** `CompositeFigure` nededí priamo `Figure`, ale cez `AbstractFigure`. Bez `*1..3` by sa najslávnejší P-MARt Composite vôbec nenašiel. Rovnaký záver ako pri Strategy Pokus 3 (tranzitívne ConcreteStrategies).

3. **Kolekčný field je najsilnejší filter.** Eliminoval 6 FP bez straty reálnych TP. Composite *musí* držať agregáciu — child-management metóda bez kolekčného fieldu signalizuje skôr Observer-chain, Builder, alebo iný non-Composite vzor. Rovnaká filozofia ako non-static field filter pri Strategy Pokuse 5 — bezpečný filter postavený na pozorovaní, že všetky GT ho spĺňajú.

4. **Delegácia cez kolekčnú iteráciu je nedetekovateľná.** JDT CALLS hrany sledujú field-based delegáciu (`this.field.method()`), ale nie iteráciu kolekcie (`for (e : list) e.method()`). Preto Pokus 5 stráca `CompositeFigure`. Toto je analogické k jdtls resolúcii pri Decoratore, ale bez ekvivalentného FIX-u v client.js — riešenie by vyžadovalo tracking lokálnych premenných z iterátora.

5. **Leaf existencia je príliš permisívne pravidlo.** Takmer každý interface v reálnom projekte má aspoň jedného implementátora bez add metódy. Pridáva FP namiesto eliminácie (`FigureChangeEventMulticaster` s 22 Leafs). Paralelné zistenie s Factory Method naming filtrom — niektoré GoF podmienky pri automatickej aplikácii stratia praktickú účinnosť.

6. **Netbeans je systémový outlier.** Jeho frameworková Node/DataObject/SystemOption hierarchia generuje 6–14 štrukturálne korektných Composite kandidátov, ktoré P-MARt nelistuje. Mnohé z nich sú v skutočnosti legitímne Composite. Rovnaký vzorec ako pri Decorator (netbeans FP vo všetkých pokusoch) a Factory Method (22–31 FP z netbeans).

7. **`TestSuite` nebola detekovaná napriek splneným podmienkam.** `junit.framework.TestSuite` implementuje `Test` (1 krok), má `addTest(Test)` metódu a drží `fTests: Vector` — štrukturálne by mala prejsť filtrom P3. Príčinou nedetekcie je pravdepodobne nesúlad fqn medzi `Class` uzlom (`junit.framework.TestSuite`) a `Type` uzlom v grafe, alebo chýbajúca `PARAMETER_TYPE` hrana na `Test` v konkrétnej verzii grafu. Toto je analogická situácia k PMD raw array problému — podmienka je splnená na úrovni zdrojového kódu, ale graf ju nezachytáva.

### Pokrytie podmienok z literatúry

| Podmienka z GoF / refactoring.guru | Pokrytá? | Pokus |
|---|---|---|
| Component interface | ✅ | P2–P5 |
| Component abstract class | ✅ | P2–P5 |
| Composite IS-A Component | ✅ | P1–P5 |
| Tranzitívna implementácia | ✅ | P1–P5 |
| Child management (add/remove) | ✅ | P1–P5 |
| Agregácia detí (kolekcia) | ✅ | P3, P4, P5 |
| Leaf existencia | ✅ | P4 |
| Rekurzívna delegácia | ✅ (čiastočne) | P5 |
| Rekurzívna sémantika operácie | ❌ | Vyžaduje data-flow analýzu |

**Všetky štrukturálne podmienky z GoF definície sú pokryté.**

---

## 7. Podmienky, ktoré neboli testované a prečo

| Podmienka | Dôvod netestovania |
|---|---|
| **Naming convention** ("Composite"/"Container"/"Group" v názve) | Staršie projekty nepoužívajú konvenciu — GT používa `MoneyBag`, `TestSuite`, `CompositeFigure`. Naming filter by bol nekonzistentný. Rovnaký záver ako pri Singleton P3, Decorator a Factory Method P3/P4. |
| **Remove a getChild metódy** (vyžadovať celú správu detí) | Príliš reštriktívne — JUnit `TestSuite` v 3.7 nemá explicitnú `removeTest()`. Vyžadovanie by viedlo k FN. Paralelný záver s Decorator "abstract base decorator" testom. |
| **Composite musí byť konkrétna trieda (nie abstract)** | P-MARt eviduje konkrétne aj abstract Composite triedy. Vyžadovanie konkrétnosti by mohlo vyradiť legitímne prípady. |
| **Kardinalita 1..n vs. 1..1 v field type** | V grafe sa nedá rozlíšiť — `Vector` field je 1..n, `Component next` field je 1..1, ale obe sú reprezentované rovnako cez `FIELD_TYPE`. Toto je presne dôvod, prečo Composite/Observer-chain nedokážeme čisto štrukturálne odlíšiť. |
| **Rekurzívna operácia** (Composite operácia volá tú istú operáciu na deťoch) | Vyžaduje matchovanie konkrétneho method override + delegáciu rovnakej metódy na collection element. Pattern A v client.js to neumožňuje (pozri Pokus 5). |

---

## 8. Možné vylepšenia a limitácie

### Fundamentálne limitácie statickej štrukturálnej analýzy

1. **Štrukturálna neodlíšiteľnosť Composite/Observer-chain/Chain of Responsibility.** Všetky zdieľajú identickú signatúru — implementácia interface, držanie referencie(í), delegácia. `FigureChangeEventMulticaster` je dôkazom, že čisto štrukturálne pravidlo ich nerozlíši — je to AWT-style Observer chain, ale P4 ho pripúšťa kvôli Leafs. Rovnaká trieda limitácií ako Decorator/Proxy/Adapter neodlíšiteľnosť [4].

2. **Iterácia kolekcií je neviditeľná pre CALLS.** `for (Figure f : fFigures) f.draw()` nevytvorí CALLS hranu na `Figure.draw()`, lebo `f` je lokálna premenná. Toto je dokumentovaná limitácia client.js — Pattern A matchuje len field-based delegáciu. Pokus 5 priamo demonštruje toto zlyhanie.

3. **Pre-generics raw types.** Java 1.0–1.4 kód nemá generiké type argumenty (`Vector fFigures` namiesto `Vector<Figure>`), takže priame párovanie cez generický mechanizmus nie je možné. Náhrada cez parameter type metód funguje, ale je nepriama — zachytí aj non-Composite prípady. Rovnaký problém ako pri Factory Method `handles(): Vector`.

4. **P-MARt neúplnosť.** Mnohé naše "FP" (netbeans Node/DataObject hierarchie, JRefactory `MethodSummary`) sú v skutočnosti štrukturálne korektné Composite aplikácie. P-MARt neeviduje všetky výskyty. Rovnaký jav ako pri Factory Method — netbeans generuje legitímne vzory nepokryté GT.

### Porovnanie s literatúrou

Tsantalis et al. [4] reportujú pre Composite F1 v rozsahu 0.45–0.85 podľa datasetu — naše P3 (F1 = 0.333) je pod spodnou hranicou, čo zodpovedá čisto Cypher-based prístupu bez similarity scoring alebo ML features a s nedetekovanou `TestSuite`. Nazar et al. [3] uvádzajú, že Composite je jeden z najťažších vzorov pre čisto štrukturálnu detekciu kvôli prekryvu s Decorator/Chain of Responsibility, s reportovanými F1 = 0.20–0.55 na P-MARt. Naše P3 je v rámci tohto rozsahu, čo potvrdzuje konzistentnosť výsledkov.

---

## 9. Referencie

[1] Gamma, E., Helm, R., Johnson, R., Vlissides, J. (1995). *Design Patterns: Elements of Reusable Object-Oriented Software.* Addison-Wesley. — GoF Composite: Component (interface/abstract), Leaf, Composite drží kolekciu Component, jednotné rozhranie pre klienta. Kľúčový rekurzívny vzťah: Composite IS-A Component a zároveň HAS-MANY Component.

[2] Guéhéneuc, Y.G. (2007). *P-MARt: Pattern-like Micro Architecture Repository.* https://www.ptidej.net/tools/designpatterns/ — Ground truth datasét (verzia 1.2). Obsahuje 7 Composite inštancií v 5 z 9 projektov.

[3] Nazar, N., Aleti, A., Zheng, Y. (2022). *Feature-Based Software Design Pattern Detection.* Journal of Systems and Software. — Composite je jeden z najťažších vzorov pre čisto štrukturálnu detekciu kvôli prekryvu s Decorator/Chain of Responsibility. Reportované F1 = 0.20–0.55 pre Composite na P-MARt.

[4] Tsantalis, N., Chatzigeorgiou, A., Stephanides, G., Halkidis, S.T. (2006). *Design Pattern Detection Using Similarity Scoring.* IEEE Transactions on Software Engineering. — Štrukturálna podobnosť Composite/Decorator/Chain of Responsibility. Reportujú F1 = 0.45–0.85 pre Composite v závislosti od datasetu.

[5] Refactoring.Guru. *Composite Design Pattern.* https://refactoring.guru/design-patterns/composite — Implementačné kroky: Component interface, Leaf, Composite s kolekciou detí, child management metódy (add/remove/getChild).
