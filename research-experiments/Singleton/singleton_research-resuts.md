# Singleton — Súhrnná správa detekcie

## 1. Podmienky pre identifikáciu Singleton vzoru

Podľa refactoring.guru [1] má implementácia Singleton vzoru tieto kroky:

1. **Privátny statický field** — trieda obsahuje privátny statický atribút vlastného typu, v ktorom je uložená jediná inštancia.
2. **Verejná statická metóda** — trieda poskytuje verejnú statickú metódu (`getInstance()`), ktorá slúži ako jediný prístupový bod k inštancii.
3. **Privátny konštruktor** — konštruktor triedy je privátny, čím sa zabraňuje externej inštanciácii cez operátor `new`.

GoF [2] definuje Singleton takto: *„Ensure a class has only one instance, and provide a global point of access to it."* Štrukturálne to znamená: statický field vlastného typu (single instance) + statický accessor (global access point) + privátny konštruktor (kontrola inštanciácie).

### Čo je štrukturálne detekovateľné a čo nie

| Podmienka | Štrukturálne detekovateľná? | Poznámka |
|---|---|---|
| Statický field vlastného typu | ✅ Áno | `HAS_FIELD` + `FIELD_TYPE` + `isStatic` |
| Statický accessor bez parametrov | ✅ Áno | `DECLARES` + `isStatic` + `HAS_PARAMETER` + `RETURN_TYPE` |
| Privátny konštruktor | ✅ Áno | `:Constructor` / `HAS_MODIFIER` → `private` |
| Naming convention (getInstance) | ✅ Áno | String matching na mene metódy |
| Kontrola inštanciácie v accessore | ⚠️ Čiastočne | `CREATES` hrana existuje, ale eager init ju má v statickom bloku, nie v accessore |

---

## 2. Ground truth — P-MARt v1.2

P-MARt [5] obsahuje 13 Singleton inštancií v 6 z 9 projektov:

| Projekt | Počet | Singletony |
|---|---|---|
| quickuml | 1 | `uml.ui.IconManager` |
| Lexi | 2 | `Registry`, `EditorActionManager` |
| jrefactory | 2 | `ReloaderSingleton`, `UMLNodeViewerFactory` |
| netbeans | 0 | — |
| JUnit | 2 | `Assert`, `Version` |
| JHotDraw | 2 | `Clipboard`, `Iconkit` |
| mapper | 3 | `Debug`, `HTMLComponentFactory`, `Mapper` |
| Nutch | 1 | `net.nutch.plugin.PluginRepository` |
| PMD | 0 | — |

---

## 3. Prehľad pokusov

### Pokus 1: Baseline

**Hypotéza:** Čisto štrukturálna detekcia bez akýchkoľvek dodatočných filtrov.

**Podmienky:**
- Statický field vlastného typu (`isStatic` alebo `HAS_MODIFIER → static`)
- Statický accessor bez parametrov vracajúci vlastný typ (`RETURN_TYPE` alebo `returnType`)

**Cypher (jadro):**
```cypher
MATCH (classType)-[:HAS_FIELD]->(instanceField:Field)-[:FIELD_TYPE]->(classType)
WHERE instanceField.isStatic = true
MATCH (classType)-[:DECLARES]->(accessorMethod:Method)
WHERE accessorMethod.isStatic = true
  AND NOT EXISTS { MATCH (accessorMethod)-[:HAS_PARAMETER]->() }
WHERE EXISTS { MATCH (accessorMethod)-[:RETURN_TYPE]->(classType) }
SET classType:Singleton
```

**Výsledky:** TP=8, FP=49, FN=5 → **Precision=0.140, Recall=0.615, F1=0.228**

**Záver:** Vysoký recall, ale katastrofálna precision kvôli 39 FP z netbeans a 9 FP z jrefactory. Bez akéhokoľvek filtra je čisto štrukturálna podmienka príliš voľná.

---

### Pokus 2: Private constructor

**Hypotéza:** Pridanie klasickej GoF podmienky — privátny konštruktor — zredukuje FP.

**Nová podmienka:**
- Trieda musí mať aspoň jeden privátny konštruktor

**Cypher (nová časť):**
```cypher
WHERE EXISTS {
  MATCH (classType)-[:DECLARES]->(ctor)
  WHERE (ctor:Constructor OR (ctor:Method AND ctor.name = classNode.name))
    AND (ctor.isPrivate = true
         OR EXISTS { MATCH (ctor)-[:HAS_MODIFIER]->(:Modifier {name:"private"}) })
}
```

**Výsledky:** TP=5, FP=16, FN=8 → **Precision=0.238, Recall=0.385, F1=0.294**

**Záver:** FP klesli z 49 na 16 (−33), ale stratili sme 3 TP (`Iconkit`, `Registry`, `HTMLComponentFactory`), pretože tieto triedy majú public constructor. Potvrdzuje tvrdenie Węgrzynowicza & Stencela [3], že private constructor je pre detekciu príliš reštriktívny.

---

### Pokus 3: Naming convention accessoru

**Hypotéza:** Namiesto private constructor použijeme sémantickú podmienku — accessor musí mať meno typické pre Singleton.

**Nová podmienka:**
- Meno accessoru: `getInstance`, `getDefault`, `getCurrent`, `getShared`, `get+ClassName`, `get`

**Cypher (nová časť):**
```cypher
AND (
     toLower(accessorMethod.name) STARTS WITH "getinstance"
  OR toLower(accessorMethod.name) STARTS WITH "getdefault"
  OR toLower(accessorMethod.name) STARTS WITH "getcurrent"
  OR toLower(accessorMethod.name) STARTS WITH "getshared"
  OR toLower(accessorMethod.name) = "get" + toLower(classNode.name)
  OR toLower(accessorMethod.name) = "get"
)
```

**Výsledky:** TP=4, FP=19, FN=9 → **Precision=0.174, Recall=0.308, F1=0.222**

**Záver:** Najhorší výsledok. Staršie projekty (JHotDraw 1996, Lexi) nepoužívajú `getInstance()` konvenciu, ale netbeans ju používa masovo. Navyše, Pokus 3 mal technický bug — presná zhoda `=` namiesto `STARTS WITH` zlyhávala kvôli `()` v menách metód v grafe (napr. `getClipboard()` ≠ `getclipboard`). Naming convention nie je súčasťou GoF definície [2] a pre staršie projekty je nespoľahlivá.

---

### Pokus 4: Filter utility tried

**Hypotéza:** Singletony majú typicky 1–2 statické metódy. Triedy s viac ako 5 statickými metódami sú utility/helper triedy, nie Singletony.

**Nová podmienka:**
- Po základnej detekcii (Pokus 1) odober Singleton label, ak trieda má >5 statických metód

**Cypher (post-filter):**
```cypher
MATCH (ct:Singleton)
WITH ct, size([
    (ct)-[:DECLARES]->(m:Method)
    WHERE m.isStatic = true | m
]) AS staticCount
WHERE staticCount > 5
REMOVE ct:Singleton
```

**Výsledky:** TP=5, FP=44, FN=8 → **Precision=0.102, Recall=0.385, F1=0.161**

**Záver:** Najhoršie F1 zo všetkých pokusov. Filter takmer nefungoval na netbeans (39→34), pretože väčšina FP nie sú utility triedy ale GUI manažéry s málo statickými metódami. Navyše, stratili sme platné Singletony (`Registry`, `Debug`), ktoré sú Singletony s utility API. Heuristika „veľa statických metód = utility trieda" [4] nefunguje ako samostatný filter.

---

### Pokus 5: Kombinovaná disjunkcia (private constructor OR naming)

**Hypotéza:** Kombinácia dvoch reinforcing indikátorov v disjunkcii — trieda musí spĺňať aspoň jedno z: private constructor ALEBO singleton naming convention. Oproti Pokusu 3 opravené technické bugy (STARTS WITH namiesto =, pridaný pattern `instance`).

**Nová podmienka:**
- (A) Private constructor **ALEBO** (B) Accessor meno: `getInstance`, `getDefault`, `getCurrent`, `getShared`, `get+ClassName`, `instance`, `singleton`

**Cypher (nová časť):**
```cypher
AND (
  // A: Private constructor
  EXISTS {
    MATCH (classType)-[:DECLARES]->(ctor)
    WHERE (ctor:Constructor OR (ctor:Method AND ctor.name STARTS WITH classNode.name + "("))
      AND (ctor.isPrivate = true
           OR EXISTS { MATCH (ctor)-[:HAS_MODIFIER]->(:Modifier {name:"private"}) })
  }
  OR
  // B: Singleton naming convention
     toLower(accessorMethod.name) STARTS WITH "getinstance"
  OR toLower(accessorMethod.name) STARTS WITH "getdefault"
  OR toLower(accessorMethod.name) STARTS WITH "getcurrent"
  OR toLower(accessorMethod.name) STARTS WITH "getshared"
  OR toLower(accessorMethod.name) STARTS WITH ("get" + toLower(classNode.name))
  OR toLower(accessorMethod.name) STARTS WITH "instance"
  OR toLower(accessorMethod.name) STARTS WITH "singleton"
)
```

**Výsledky:** TP=8, FP=36, FN=5 → **Precision=0.182, Recall=0.615, F1=0.281**

**Záver:** Najvyšší recall (0.615), rovný Pokusu 1, ale s nižším FP (36 vs 49). Obnovil všetky 3 TP stratené v Pokuse 2. Opravil bugy z Pokusu 3. Disjunkcia maximalizuje pokrytie — zachytí klasické Singletony s private constructor aj staršie implementácie s neštandardnými konštruktormi.

---

## 4. Porovnanie všetkých pokusov

| Metrika | Pokus 1 | Pokus 2 | Pokus 3 | Pokus 4 | Pokus 5 |
|---|---|---|---|---|---|
| Prístup | baseline | +private ctor | +naming | +utility filter | private ctor OR naming |
| TP | 8 | 5 | 4 | 5 | **8** |
| FP | 49 | **16** | 19 | 44 | 36 |
| FN | **5** | 8 | 9 | 8 | **5** |
| Precision | 0.140 | **0.238** | 0.174 | 0.102 | 0.182 |
| Recall | **0.615** | 0.385 | 0.308 | 0.385 | **0.615** |
| F1 | 0.228 | **0.294** | 0.222 | 0.161 | 0.281 |

---

## 5. Najlepší výsledok

**Najvyššie F1 dosiahol Pokus 2** (F1 = 0.294) vďaka najlepšej precision (0.238) pri akceptovateľnom recall.

**Najvyšší recall dosiahli Pokusy 1 a 5** (Recall = 0.615), pričom Pokus 5 má nižší FP (36 vs 49).

**Najlepšie je Pokus 5**, pretože:
- Má rovnaký recall ako baseline (0.615) — žiadna strata TP oproti najvoľnejšej detekcii
- Znižuje FP o 27% oproti baseline (49→36)
- Implementuje odporúčanie Węgrzynowicza & Stencela [3] o voľnejšej definícii
- Kombinuje štrukturálny aj sémantický indikátor

---

### Kľúčové poznatky

1. **Čisto štrukturálna detekcia** (static field + static accessor) zachytí väčšinu Singletonov, ale produkuje veľa FP v rozsiahlych frameworkoch (netbeans).

2. **Private constructor** je najefektívnejší jednotlivý filter na redukciu FP (−33), ale stráca platné Singletony zo starších projektov, kde private constructor nebol konvenciou.

3. **Naming convention** je nespoľahlivá ako samostatný filter — staršie projekty ju nedodržiavajú, novšie ju používajú aj pre ne-Singletony.

4. **Utility filter** (počet statických metód) nefunguje — Singletony a utility triedy nie sú vzájomne vylučujúce.

5. **Disjunkcia** (private ctor OR naming) je optimálny kompromis — maximalizuje pokrytie bez pridávania nových FP, pretože každá vetva zachytí iný typ implementácie.

### Trvalé FP — netbeans

Netbeans je dominantný zdroj false positives vo všetkých pokusoch (33–39 FP). Tieto triedy (`TopManager`, `WindowManagerImpl`, `ExecutionEngine`, `SearchEngine`...) sú **de facto Singletony** — majú private constructor, static field, `getDefault()` accessor. P-MARt ground truth ich ako Singletony neoznačuje, čo je nesúlad medzi štrukturálnou definíciou vzoru a subjektívnou klasifikáciou v datasete. Bez netbeans dosahuje Pokus 5 precision 0.727 a F1 = 0.667.

### Trvalé FN — štrukturálne nedetekovateľné Singletony

5 FN v Pokuse 5 nie je možné odstrániť štrukturálnou analýzou:
- **JUnit `Assert`, `Version`** (2 FN) — nemajú static self-typed field ani accessor pattern. `Assert` je statická utility trieda, `Version` má jednu statickú metódu.
- **jrefactory `ReloaderSingleton`, `UMLNodeViewerFactory`** (2 FN) — neštandardné implementácie, ktoré nezodpovedajú štrukturálnej definícii.
- **jrefactory `ReloaderSingleton`, `UMLNodeViewerFactory`** a **JUnit `Assert`, `Version`** (4 FN) — neštandardné implementácie bez static self-typed field + accessor štruktúry detekovanej v grafe. `Assert` je statická utility trieda, `Version` má jednu statickú metódu. Mapper 3. GT trieda (pravdepodobne `com.taursys.xml.Mapper`) taktiež nebola detekovaná.

---

## 6. Možné vylepšenia a limitácie

### Podmienky, ktoré neboli testované a prečo

| Podmienka | Dôvod netestovania |
|---|---|
| **Instantiation control** — accessor volá konštruktor (`CREATES` hrana) | Pri eager initialization sa `new` volá v statickom inicializátore, nie v accessore → false negatives. Netbeans FP triedy konštruktor v accessore volajú → neredukuje hlavný zdroj FP. |
| **Field naming** (`instance`, `_instance`) | Menej štandardizované ako accessor naming. V P-MARt projektoch: `fgClipboard`, `fgIconkit`, `fTest`. |
| **Abstract/interface filter** | Cypher dotaz implicitne filtruje na `Class` label. Žiadna abstraktná trieda nesplnila ostatné podmienky. |
| **Lazy initialization** (null-check v accessore) | Vyžaduje data-flow analýzu, ktorú grafový prístup nepodporuje. |
| **Single assignment** (field priradený iba raz) | Rovnaký dôvod — data-flow analýza. |

### Implementačné varianty mimo rozsah P-MARt

| Variant | Prečo nie je relevantný |
|---|---|
| **Enum Singleton** | Vyžaduje Java 5 (2004). P-MARt projekty pochádzajú z rokov 1996–2003. |
| **Bill Pugh / Holder idiom** | Publikovaný v 2004. Field je v inner class, nie v triede samotnej → vyžaduje rozšírenie grafového modelu. |
| **Double-checked locking** | Rovnaká štruktúra ako lazy init — štrukturálne neodlíšiteľný od eageru. |

### Fundamentálne limitácie statickej štrukturálnej analýzy

1. **Štrukturálna neodlíšiteľnosť.** Singleton, Utility class a Monostate pattern zdieľajú štrukturálne prvky (statický field, statický accessor). Čisto štrukturálna analýza ich nevie rozlíšiť bez data-flow alebo sémantickej analýzy [3].

2. **Nesúlad ground truth.** P-MARt ground truth obsahuje Singletony bez Singleton štruktúry (JUnit `Assert`) a neobsahuje triedy so Singleton štruktúrou (netbeans `TopManager`). Toto je známa limitácia manuálne anotovaných datasetov.

3. **Variabilita implementácií.** Projekty z rokov 1996–2003 nedodržiavajú moderné konvencie (private constructor, `getInstance()`). Toto robí akúkoľvek pevnú sadu pravidiel nevyhnutne nekompromisnú — buď FP alebo FN.

4. **Absencia data-flow analýzy.** Kontrola lazy inicializácie, single assignment a instantiation controlu vyžaduje data-flow analýzu, ktorú čisto grafový prístup nepodporuje. ML prístupy (Nacef et al. [6]) prekonávajú rule-based detekciu práve vďaka kombinácii 33 features vrátane behaviorálnych.

---

## 8. Referencie

[1] Refactoring.Guru. *Singleton Design Pattern.* https://refactoring.guru/design-patterns/singleton — Implementačné kroky: (1) private static field, (2) public static accessor, (3) lazy initialization, (4) private constructor.

[2] Gamma, E., Helm, R., Johnson, R., Vlissides, J. (1995). *Design Patterns: Elements of Reusable Object-Oriented Software.* Addison-Wesley. — Pôvodná GoF definícia Singletonu. Naše pokusy testujú štrukturálne podmienky odvodené z tejto definície.

[3] Węgrzynowicz, P., Stencel, K. (2008). *Implementation Variants of the Singleton Design Pattern.* Springer, LNCS 5333, pp. 396–406. — Relaxovaná detekcia, first-order logic formula. Autori ukázali, že striktná požiadavka private constructor produkuje false negatives (potvrdené naším Pokusom 2). Náš Pokus 5 implementuje ich odporúčanie voľnejšej definície.

[4] Gil, J., Maman, I. (2005). *Micro Patterns in Java Code.* OOPSLA. — Klasifikácia tried podľa statických metód. Náš Pokus 4 testoval, či sa tento princíp dá použiť ako negatívny filter. Výsledky ukazujú, že Singleton a utility trieda nie sú vzájomne vylučujúce.

[5] Guéhéneuc, Y.G. (2007). *P-MARt: Pattern-like Micro Architecture Repository.* https://www.ptidej.net/tools/designpatterns/ — Ground truth datasét (verzia 1.2). Obsahuje 13 Singleton inštancií v 9 projektoch z rokov 1996–2003.

[6] Nacef, A., Khalfallah, A., Bahroun, S., Ben Ahmed, S. (2022). *Defining and Extracting Singleton Design Pattern Information from Object-Oriented Software Program.* Springer, CCIS 1653, pp. 713–726. — Definuje 33 features pre Singleton detekciu vrátane behaviorálnych (lazy init, single assignment). ML klasifikátor dosahuje 99% precision/recall, čo ukazuje horný limit toho, čo je dosiahnuteľné s plnou sadou features.

[7] Nazar, N., Aleti, A., Zheng, Y. (2022). *Feature-Based Software Design Pattern Detection.* Journal of Systems and Software. https://arxiv.org/abs/2012.01708 — DPD_F kombinuje štrukturálne aj sémantické features pomocou ML. Naša disjunkcia (Pokus 5) je zjednodušená verzia tohto prístupu. 
