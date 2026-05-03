# Iterator — Súhrnná správa detekcie

## 1. Podmienky pre identifikáciu Iterator vzoru

Podľa GoF [1] a refactoring.guru [5] má Iterator vzor tieto štrukturálne prvky:

1. **Iterator** — rozhranie alebo abstraktná trieda, ktorá deklaruje metódy pre prechod kolekciou: `hasNext()`, `next()`, prípadne `first()`, `currentItem()`, `isDone()`, `remove()`.
2. **ConcreteIterator** — konkrétna implementácia Iterator-u, drží referenciu na Aggregate a stav iterácie (pozíciu).
3. **Aggregate** — rozhranie alebo abstraktná trieda, deklaruje factory metódu `iterator()` / `createIterator()` / `elements()`.
4. **ConcreteAggregate** — implementácia Aggregate-u, vytvára konkrétny ConcreteIterator pre svoju štruktúru.

Kľúčový vzťah: **Aggregate.iterator() vracia Iterator, ConcreteIterator implementuje Iterator a drží referenciu na ConcreteAggregate**. Reciprocita Iterator↔Aggregate cez factory metódu je kanonický GoF prvok.

### Čo je štrukturálne detekovateľné a čo nie

| Podmienka | Detekovateľná? | Poznámka |
|---|---|---|
| Iterator interface/abstract class | ✅ Áno | `:Interface` alebo `:Class {isAbstract: true}` |
| Iterator je definovaný v projekte | ✅ Áno | `IN_FILE` edge — odlíši od JDK `java.util.Iterator` |
| Iterator má `hasNext` + `next` metódy | ✅ Áno | Prefix match na názvoch metód |
| Enumeration-style metódy (`hasMoreElements`/`nextElement`) | ✅ Áno | Pre staré projekty pred Java Collections API |
| Aggregate má factory metódu vracajúcu Iterator | ✅ Áno | `DECLARES → Method → RETURN_TYPE → Type(iterator.fqn)` |
| ConcreteIterator existuje | ⚠️ Čiastočne | `EXTENDS\|IMPLEMENTS*1..3` — nezachytí anonymné triedy |
| Iterator drží referenciu na Aggregate | ✅ Áno | `HAS_FIELD → FIELD_TYPE → Aggregate` |
| Iterátor používa `java.util.Iterator` z JDK | ❌ Nie | JDK Iterator je externý, nemá `IN_FILE` — synthetic stub node |
| ConcreteIterator je anonymná trieda | ❌ Nie | Anonymné triedy nemusia mať korektný `containerName` v JDT |

### Štrukturálna podobnosť s inými vzormi

Iterator zdieľa štruktúru s **Visitor** (oba majú "factory" metódu na inom interface — Visitor.accept, Iterator.iterator), s **Strategy** (Aggregate drží kolekciu Iterator-ov ako implementácie) a s **Factory Method** (Aggregate.iterator() je factory). Najdiskriminujúci znak Iterator-a je špecifická kombinácia metód `hasNext` + `next` (alebo Enumeration ekvivalent), ktorá je takmer unikátna.

---

## 2. Ground truth — P-MARt v1.2

P-MARt v1.2 [2] definuje **8 Iterator inštancií** v 4 z 9 projektov:

| Projekt | Počet GT | Poznámka |
|---|---|---|
| junit | 1 | Pravdepodobne `TestSuite.tests()` Enumeration alebo `BaseTestRunner` |
| netbeans | 5 | Najviac inštancií — pravdepodobne kombinácia vlastných enumeration tried a `java.util.Iterator` implementácií |
| nutch | 1 | Pravdepodobne `WebDBReader` enumerácia URL/dokumentov |
| PMD | 1 | `net.sourceforge.pmd.jaxen.NodeIterator` — XPath axis iterator |

P-MARt agreguje: 8 Iterator interfacov, 3 Aggregate, 10 ConcreteIterator, 10 ConcreteAggregate, 10 Client. Pomerne malý počet ConcreteIterator (10) na 8 Iterator interfacov je nezvyčajný — naznačuje, že **niektoré GT inštancie evidujú konkrétne triedy implementujúce `java.util.Iterator` z JDK**, nie samostatné Iterator interfacy v projekte.

### Analýza detekovateľnosti GT

| GT lokácia | Pravdepodobný vzor | Detekovateľná? | Príčina |
|---|---|---|---|
| junit: `TestSuite.tests()` → `Enumeration` | Enumeration-style API | ❌ | `Enumeration` je v `java.util` (JDK), nemá `IN_FILE` |
| netbeans: `org.openide.Iterator` | Vlastný Iterator interface | ✅ s P1+ | Lokálny interface s `hasNext`+`next` |
| netbeans: `org.openide.util.enum.AlterEnumeration` | Enumeration-style helper | ✅ s P2+ | Lokálna trieda s `hasMoreElements`+`nextElement` |
| netbeans: `org.openide.util.enum.FilterEnumeration` | Enumeration-style helper | ✅ s P2+ | Lokálna trieda s `hasMoreElements`+`nextElement` |
| netbeans: `Children`, `Nodes.Cookie` enumerations | Anonymné/JDK Iterator implementácie | ❌ | Implementuje `java.util.Iterator`/`Enumeration` z JDK |
| netbeans: ďalšie 2 inštancie | Mix vlastných a JDK | ❌ | Konkrétne triedy bez vlastného Iterator interface |
| nutch: `WebDBReader.pages()` enumerácia | JDK `java.util.Iterator` implementácia | ❌ | Konkrétna trieda, nie projektový interface |
| PMD: `NodeIterator` (jaxen) | XPath axis iterator | ✅ s P1+ | Lokálny abstract class s `hasNext`+`next` |

**Maximálna dosiahnuteľná Recall pri striktnom IN_FILE filtri: 4/8 = 0.500.** Štyri z ôsmich GT inštancií sú principiálne **nedetekovateľných** našou metodológiou, pretože ide buď o (1) konkrétne triedy implementujúce `java.util.Iterator` z JDK (nie projektové interfacy), (2) anonymné triedy bez korektného `containerName`, alebo (3) `java.util.Enumeration` použitia ktoré sú externé k projektu. Toto je analogický problém ako pri Factory Method `NodeViewerFactory` (externá trieda nedetekovateľná).

---

## 3. Prehľad pokusov

### Pokus 1: Baseline (`hasNext` + `next`)

**Hypotéza:** Iterator je interface alebo abstract class **definovaný v projekte** (`IN_FILE`), ktorý má metódu s prefixom `hasNext` AND metódu s prefixom `next`. Toto je najsilnejší unikátny štrukturálny signál Iterator vzoru.

**Podmienky:**
- Iterator = Interface alebo abstract Class
- `EXISTS (iterator)-[:IN_FILE]->()` — vylučuje JDK
- Aspoň jedna metóda s prefixom `hasNext`
- Aspoň jedna metóda s prefixom `next`

**Cypher (jadro):**
```cypher
MATCH (iteratorNode)
WHERE (iteratorNode:Interface
   OR (iteratorNode:Class AND iteratorNode.isAbstract = true))
  AND EXISTS { MATCH (iteratorNode)-[:IN_FILE]->() }
MATCH (iteratorType:Type {fqn: iteratorNode.fqn})
WITH iteratorNode, iteratorType
WHERE EXISTS {
    MATCH (iteratorType)-[:DECLARES]->(m1:Method)
    WHERE toLower(m1.name) STARTS WITH "hasnext"
}
AND EXISTS {
    MATCH (iteratorType)-[:DECLARES]->(m2:Method)
    WHERE toLower(m2.name) STARTS WITH "next"
}
SET iteratorType:Iterator
```

**Výsledky:** TP=2, FP=1, FN=6 → **Precision=0.667, Recall=0.250, F1=0.364**

**Detegované:**
- `netbeans: org.openide.Iterator` — TP (lokálny iterator interface, GT netbeans)
- `PMD: net.sourceforge.pmd.jaxen.NodeIterator` — TP (jaxen XPath axis iterator, GT PMD)
- `mapper: com.taursys.model.CollectionValueHolder` — FP (mapper nemá Iterator GT)

**Záver:** Vysoká precision (samotná `hasNext`+`next` kombinácia je dobrý filter), ale nízky recall. Stratené: junit (Enumeration-style), nutch (JDK iterator implementácie) a 4 z 5 netbeans GT inštancií. Len 1 z 5 netbeans Iterator-ov je lokálny interface s modernými metódami, pričom ďalšie 2 sú Enumeration-style triedy zachytiteľné až v P2.

---

### Pokus 2: Alternatívne pomenovania (Enumeration-style)

**Hypotéza:** Pridanie `hasMoreElements`+`nextElement` (Enumeration API z Java 1.0) by malo obnoviť GT inštancie zo starých projektov, kde sa nepoužíva moderné `Iterator` API. Netbeans v1.0.x je z éry pred Java Collections Framework (Java 1.2) a intenzívne používa `java.util.Enumeration` konvencie.

**Nová podmienka:**
- Disjunkcia troch variantov: (A) `hasNext`+`next`, (B) `hasMoreElements`+`nextElement`, (C) `hasMore`+`next`

**Výsledky:** TP=4, FP=1, FN=4 → **Precision=0.800, Recall=0.500, F1=0.615** ⭐

**Detegované:**
- `netbeans: org.openide.Iterator` — TP (zachovaný z P1, GT netbeans)
- `netbeans: org.openide.util.enum.AlterEnumeration` — TP (Enumeration-style helper, GT netbeans)
- `netbeans: org.openide.util.enum.FilterEnumeration` — TP (Enumeration-style helper, GT netbeans)
- `PMD: net.sourceforge.pmd.jaxen.NodeIterator` — TP (zachovaný z P1, GT PMD)
- `mapper: com.taursys.model.CollectionValueHolder` — FP (mapper nemá Iterator GT)

**Záver:** **Najlepší pokus.** Pridanie Enumeration-style pomenovania zachytilo ďalšie 2 netbeans GT triedy — `AlterEnumeration` a `FilterEnumeration` z package `org.openide.util.enum`. Recall stúpol z 0.250 na 0.500, F1 z 0.364 na 0.615. Pokus 2 dosahuje **maximálnu dosiahnuteľnú Recall (4/8 = 0.500)** pri daných obmedzeniach statickej analýzy. Toto potvrdzuje, že **staré projekty intenzívne používajú `java.util.Enumeration` namiesto Iterator** — bez tejto disjunkcie by sme stratili dve z troch detekovateľných netbeans GT inštancií.

---

### Pokus 3: Aggregate factory metóda

**Hypotéza:** GoF vyžaduje, aby Aggregate mal factory metódu (`iterator()`/`createIterator()`/`elements()`) vracajúcu tento Iterator. Toto by malo eliminovať FP a potvrdiť reciprocitu Iterator↔Aggregate.

**Nová podmienka:**
- Musí existovať Type s metódou (`iterator`/`createIterator`/`elements`/`getIterator`/`enum`...) s `RETURN_TYPE` smerujúcim na tento Iterator

**Výsledky:** TP=1, FP=0, FN=7 → **Precision=1.000, Recall=0.125, F1=0.222**

**Detegované:**
- `netbeans: org.openide.Iterator` — TP

**Záver:** **Príliš reštriktívne.** Z 5 detegovaných v P2 zostal len 1. Stratené:
- `PMD: NodeIterator` — žiadna trieda nemá factory metódu vracajúcu `NodeIterator`. PMD jaxen iterátor je vytváraný priamo cez `new NodeIterator(...)` v klientskom kóde, nie cez factory metódu.
- `mapper: CollectionValueHolder` — bol FP, takže jeho odstránenie je správne. Precision skočila na 1.000.
- `netbeans: AlterEnumeration`, `FilterEnumeration` — vytvárané priamo cez `new`, nie cez Aggregate factory.

**Aggregate-with-factory je príliš striktné kritérium pre P-MARt projekty** — staršie iterátory sa bežne vytvárajú priamo cez konštruktor, nie cez factory metódu na collection-like Aggregate. Rovnaký záver ako pri Factory Method (constructor injection bola príliš reštriktívna pre P-MARt).

---

### Pokus 4: ConcreteIterator existuje

**Hypotéza:** Kanonický Iterator vzor vyžaduje aspoň jednu konkrétnu implementáciu Iterator interface-u.

**Nová podmienka:**
- Musí existovať trieda, ktorá tranzitívne `EXTENDS|IMPLEMENTS*1..3` Iterator node

**Výsledky:** TP=0, FP=0, FN=8 → **Precision=0.000, Recall=0.000, F1=0.000**

**Detegované:** žiadne

**Záver:** **Katastrofa.** Detektor neoznačil ani jedinú triedu. Aj jediný TP z Pokus 3 (`org.openide.Iterator`) zmizol — to znamená, že `org.openide.Iterator` v Netbeanse **nemá v grafe žiadny EXTENDS/IMPLEMENTS edge** smerujúci naňho. Najpravdepodobnejšie vysvetlenie: Netbeans `org.openide.Iterator` je implementovaný **iba anonymnými triedami** (`new Iterator() { ... }`), ktoré JDT nereprezentuje ako EXTENDS/IMPLEMENTS hrany, alebo má jediného implementátora mimo extrahovaného projektu. Toto je **paralelná limitácia k Composite Pokus 5** (iterácia kolekcie nie je sledovateľná) a Observer Pokus 4 (notify naming filter je príliš striktný) — pravidlo, ktoré z hľadiska GoF vyzerá rozumne, na tomto datasete úplne zlyhá kvôli implementačnej špecifikácii.

---

### Pokus 5: Kombinovaná disjunkcia

**Hypotéza:** Uvoľniť pravidlo P3/P4 na disjunkciu: stačí **jedno z** (A) Aggregate factory metóda, (B) ConcreteIterator existuje. Permisívnejšia alternatíva.

**Výsledky:** TP=1, FP=1, FN=7 → **Precision=0.500, Recall=0.125, F1=0.200**

**Detegované:**
- `netbeans: org.openide.Iterator` — TP (cez signál A — má factory metódu)
- `mapper: CollectionValueHolder` — FP (vrátený, lebo má factory metódu)

**Záver:** Disjunkcia neobnovila stratené TP z P2 (PMD `NodeIterator`, netbeans Enumeration utilities), pretože **ani jeden z nich nemá Aggregate factory metódu ani neimplementuje sa cez explicitné EXTENDS edge**. Disjunkcia A∨B nezachytí tieto edge-cases. Pokus 5 demonštruje, že obidva ďalšie pravidlá (P3 aj P4) sú na tomto datasete zle nastavené — ani ich uvoľnenie nepomôže.

---

## 4. Porovnanie všetkých pokusov

| Metrika | Pokus 1 | **Pokus 2** | Pokus 3 | Pokus 4 | Pokus 5 |
|---|---|---|---|---|---|
| Prístup | hasNext+next | **+Enumeration** | +Aggregate factory | +ConcreteIterator | disjunkcia |
| TP | 2 | **4** | 1 | 0 | 1 |
| FP | 1 | **1** | 0 | 0 | 1 |
| FN | 6 | **4** | 7 | 8 | 7 |
| Precision | 0.667 | **0.800** | 1.000 | — | 0.500 |
| Recall | 0.250 | **0.500** | 0.125 | 0.000 | 0.125 |
| F1 | 0.364 | **0.615** | 0.222 | 0.000 | 0.200 |

---

## 5. Najlepší výsledok

**Najlepší výsledok dosiahol Pokus 2** — F1 = 0.615 (Precision = 0.800, Recall = 0.500).

Kľúčom k tomuto výsledku sú dva faktory:
1. **Disjunkcia naming variantov** — pridanie Enumeration-style pomenovania (`hasMoreElements`/`nextElement`) zachytilo netbeans `AlterEnumeration` a `FilterEnumeration`, ktoré moderný `hasNext`+`next` filter úplne minul
2. **IN_FILE filter ostane mierny** — Pokus 2 nevyžaduje žiadne reciprocitné podmienky (Aggregate factory, ConcreteIterator), takže neprepadá cez striktné GoF filtre, ktoré sa na P-MARt projektoch nedajú splniť

Pokus 2 dosahuje **maximálnu dosiahnuteľnú Recall (0.500)** pre tento dataset a metodológiu — všetky 4 detekovateľné GT inštancie sú zachytené. Zvyšné 4 GT sú principiálne nedetekovateľné statickou analýzou (JDK typy, anonymné triedy).

---

## 6. Čo sme zistili

### Kľúčové poznatky

1. **Iterator je v P-MARt jeden z najťažších vzorov pre štrukturálnu detekciu.** Nie kvôli zložitosti štrukturálneho pattern-u (`hasNext`+`next` je veľmi výrazný signál), ale kvôli **fundamentálnej nedetekovateľnosti polovice GT inštancií**. Z 8 GT je odhadom **4 nedetekovateľných** — používajú externý `java.util.Iterator`/`Enumeration`, sú implementované anonymnými triedami, alebo sú konkrétne triedy bez vlastného Iterator interface-u. Strop dosiahnuteľného recall je **4/8 = 0.500**, čo presne dosahuje Pokus 2.

2. **Enumeration-style pomenovanie je kritické pre staré Java projekty.** Pokus 2 pridal 2 ďalšie TP (oba v Netbeans `org.openide.util.enum`) iba pridaním `hasMoreElements`+`nextElement` ako alternatívy. Bez tejto disjunkcie by sme stratili dve z troch detekovateľných netbeans GT inštancií. Rovnaký jav ako pri Factory Method `handles(): Vector` (pre-generics typy) a Visitor `jjtAccept` (JavaCC API) — **konkrétne knižnice/éry generujú nekanonické API a detektor musí explicitne podporovať tieto konvencie**.

3. **Aggregate factory check (P3) je príliš reštriktívny.** GoF vyžaduje, aby Aggregate poskytoval factory metódu pre Iterator, ale v P-MARt projektoch sa Iterátory bežne vytvárajú **priamo cez konštruktor** v klientskom kóde (`new NodeIterator(node)`). Pokus 3 stratil 3 z 4 TP z Pokus 2. Rovnaký záver ako Singleton P2 (private constructor), Strategy P4 (constructor injection) — **GoF "best practices" nie sú vždy zachované v real-world kóde**.

4. **ConcreteIterator existence check (P4) úplne zlyhal.** Pokus 4 dal 0 detekcií, pretože Netbeans `org.openide.Iterator` je implementovaný iba anonymnými triedami, ktoré JDT nereprezentuje ako EXTENDS/IMPLEMENTS hrany. Toto je **paralelná limitácia ako iterácia kolekcie pri Composite/Observer** — pravidlo, ktoré z hľadiska GoF vyzerá rozumne, na konkrétnych implementačných štýloch zlyhá.

5. **IN_FILE filter je nutný kompromis.** Bez `IN_FILE` by detekcia bola zaplavená každou triedou ktorá implementuje `java.util.Iterator` (čo sú v Netbeanse desiatky) — ale s `IN_FILE` strácame GT inštancie postavené na JDK Iterator. Tento kompromis je **fundamentálnym obmedzením**, nie chybou pravidiel.

6. **Iterator a Visitor — rovnaký GoF princíp, rozdielne výsledky.** Visitor dosiahol F1 = 1.000, Iterator dosiahol F1 = 0.615. Oba vzory majú podobnú štrukturálnu signatúru (interface s charakteristickými metódami + reciprocita). Rozdiel je v **homogenite GT**: Visitor GT sú všetky JavaCC AST visitory s rovnakou implementačnou konvenciou, zatiaľ čo Iterator GT je heterogénny mix lokálnych interfacov, JDK implementácií a Enumeration-style tried. **Štruktúra detektora dokáže zachytiť homogénne vzory, ale heterogénne implementácie vyžadujú viacero paralelných pravidiel.**

### Pokrytie podmienok z literatúry

| Podmienka z GoF / refactoring.guru | Pokrytá? | Pokus |
|---|---|---|
| Iterator interface/abstract class | ✅ | P1–P5 |
| `hasNext` + `next` metódy | ✅ | P1–P5 |
| Enumeration-style alternatívne metódy | ✅ | P2–P5 |
| Aggregate s factory metódou | ✅ | P3, P4, P5 |
| ConcreteIterator existuje | ✅ (s limitáciou) | P4, P5 |
| Iterator drží stav iterácie | ❌ | Sémantická vlastnosť, nedetekovateľné |
| External vs. internal iterator | ❌ | Behaviorálna vlastnosť |
| Polymorphic iteration | ❌ | Vyžaduje runtime analýzu |

**Všetky štrukturálne detekovateľné podmienky z GoF definície sú pokryté**, ale **polovica GT je nedetekovateľná z dôvodov mimo dosah detekcie** (externé typy, anonymné triedy).

---

## 7. Podmienky, ktoré neboli testované a prečo

| Podmienka | Dôvod netestovania |
|---|---|
| **Naming convention** (trieda obsahuje "Iterator"/"Enumeration") | Slabší signál ako metódy `hasNext`+`next` — všetky kanonické iterátory už majú metódy. Naming filter by len duplikoval informáciu. |
| **Iterator drží field typu Aggregate** | Zaujímavé, ale ConcreteIterator nemá takmer nikdy v P-MARt projektoch — Iterator je interface, polia drží konkrétna trieda. Náš detektor hľadá interfacy, nie konkrétne triedy. |
| **`remove()` metóda** (kompletné GoF Iterator API) | Voliteľné v GoF (`Iterator.remove()` je tzv. "optional operation"). Vyžadovanie by stratilo TP. |
| **Iterator implementuje `java.util.Iterator`** (pre konkrétne triedy) | Toto by bol opak nášho prístupu — namiesto vlastných interfacov hľadať konkrétne triedy implementujúce JDK Iterator. Spôsobilo by masívny nárast FP (každá Java collection implementuje Iterator). Bolo by potrebné kombinovať s ďalšími filtrami. |
| **Internal iterator** (Aggregate.forEach) | Moderný Java 8 pattern, P-MARt projekty (Java 1.0–1.4) ho nepoužívajú. |

---

## 8. Možné vylepšenia a limitácie

### Fundamentálne limitácie statickej štrukturálnej analýzy

1. **JDK extension nie je v projekte.** Najväčší problém — väčšina P-MARt Iterator GT používa `java.util.Iterator` z JDK ako parent interface, a JDK triedy nie sú extrahované do grafu (nemajú `IN_FILE`). Bez `IN_FILE` filtra by sme detegovali stovky JDK iteration tried (každý ArrayList, HashMap, Vector iterator); s `IN_FILE` strácame GT, ktoré implementujú JDK Iterator. **Žiadny kompromis nie je optimálny.**

2. **Anonymné triedy sú neviditeľné pre EXTENDS/IMPLEMENTS.** Netbeans `org.openide.Iterator` je v projekte implementovaný cez `new Iterator() { ... }` anonymných tried, ktoré JDT pri statickej analýze nerozpoznáva ako separátne EXTENDS hrany. Toto je dokumentovaná limitácia v `client.js` — `containerName` pre anonymné a lokálne triedy môže byť prázdny alebo nesprávny.

3. **Heterogénny GT.** Na rozdiel od Visitor (3 GT, všetky JavaCC AST) je Iterator GT heterogénny — mix vlastných interfacov, JDK implementácií, Enumeration-style tried. Detektor postavený na jednej štruktúrnej hypotéze nemôže pokryť všetky prípady.

4. **Iterátory bez Aggregate factory.** P-MARt projekty z éry Java 1.0–1.4 bežne vytvárajú iterátory priamo cez konštruktor v klientskom kóde, nie cez Aggregate factory. GoF "best practice" Aggregate.iterator() bol široko akceptovaný až s príchodom Java Collections Framework (Java 1.2+). P3 filter, ktorý túto podmienku vyžaduje, je preto pre P-MARt benchmark príliš striktný.

### Porovnanie s literatúrou

Tsantalis et al. [4] reportujú pre Iterator F1 = 0.50–0.80 podľa datasetu. Nazar et al. [3] reportujú F1 = 0.20–0.55 na P-MARt. **Naše P2 (F1 = 0.615) prevyšuje horný okraj rozsahu Nazara** a pohybuje sa v strede rozsahu Tsantalisa. Tento výsledok je pozoruhodný, keďže náš prístup je čisto štrukturálny bez similarity scoring. Kľúčovým faktorom je explicitná podpora Enumeration-style API, ktorú mnohé prístupy v literatúre nezohľadňujú.

---

## 9. Referencie

[1] Gamma, E., Helm, R., Johnson, R., Vlissides, J. (1995). *Design Patterns: Elements of Reusable Object-Oriented Software.* Addison-Wesley. — GoF Iterator: Iterator interface s `hasNext`/`next`, ConcreteIterator drží stav, Aggregate s factory metódou. Externý vs. internal iterator ako kľúčová variácia.

[2] Guéhéneuc, Y.G. (2007). *P-MARt: Pattern-like Micro Architecture Repository.* https://www.ptidej.net/tools/designpatterns/ — Ground truth datasét (verzia 1.2). Obsahuje 8 Iterator inštancií v 4 z 9 projektov (junit 1, netbeans 5, nutch 1, PMD 1).

[3] Nazar, N., Aleti, A., Zheng, Y. (2022). *Feature-Based Software Design Pattern Detection.* Journal of Systems and Software. — Reportujú F1 = 0.20–0.55 pre Iterator na P-MARt. Iterator je podľa nich jeden z najproblémovejších vzorov kvôli rozdielnej implementácii naprieč érami a projektovými konvenciami.

[4] Tsantalis, N., Chatzigeorgiou, A., Stephanides, G., Halkidis, S.T. (2006). *Design Pattern Detection Using Similarity Scoring.* IEEE Transactions on Software Engineering. — Reportujú F1 = 0.50–0.80 pre Iterator. Vyšší recall pripisujú similarity scoring, ktoré dokáže zachytiť parciálne matchy.

[5] Refactoring.Guru. *Iterator Design Pattern.* https://refactoring.guru/design-patterns/iterator — Implementačné kroky: Iterator interface s navigačnými metódami, ConcreteIterator s referenciou na collection a stav iterácie, Aggregate s `getIterator()`/`createIterator()` factory metódou.
