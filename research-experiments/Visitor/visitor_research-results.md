# Visitor — Súhrnná správa detekcie

## 1. Podmienky pre identifikáciu Visitor vzoru

Podľa GoF [1] a refactoring.guru [5] má Visitor vzor tieto štrukturálne prvky:

1. **Visitor** — rozhranie (interface) alebo abstraktná trieda, ktoré deklaruje `visit(ConcreteElementA)`, `visit(ConcreteElementB)`, ... metódy pre **každý typ** konkrétneho Element-u. Typický počet visit metód je 5–100 podľa veľkosti Element hierarchie.
2. **ConcreteVisitor** — konkrétna implementácia Visitor rozhrania, ktorá definuje operáciu pre každý typ Element-u.
3. **Element** — rozhranie alebo abstraktná trieda, deklaruje `accept(Visitor)` metódu.
4. **ConcreteElement** — konkrétna implementácia Element-u. Jeho `accept(Visitor v)` volá `v.visitConcreteElement(this)` — **double dispatch**.
5. **ObjectStructure** — (voliteľné) drží kolekciu Element-ov a iteruje nad nimi.

Kľúčový vzťah: **Reciprocita Visitor ↔ Element**. Visitor má visit metódy s parametrami Element typov, Element má accept metódu s parametrom Visitor typu. Žiadny iný GoF vzor nemá takýto vzájomný odkaz.

### Čo je štrukturálne detekovateľné a čo nie

| Podmienka | Detekovateľná? | Poznámka |
|---|---|---|
| Visitor interface/abstract class | ✅ Áno | `:Interface` alebo `:Class {isAbstract: true}` |
| Visitor má ≥N visit metód | ✅ Áno | `DECLARES → Method` s prefixom `visit` |
| Element má accept metódu | ✅ Áno | `DECLARES → Method` s prefixom `accept`/`jjtAccept` |
| Accept má parameter typu Visitor | ✅ Áno | `HAS_PARAMETER → Parameter → PARAMETER_TYPE → Type(visitor.fqn)` |
| ConcreteVisitor existuje | ✅ Áno | `EXTENDS\|IMPLEMENTS*1..3` na Visitor node |
| Double dispatch (accept CALLS visit) | ⚠️ Čiastočne | `CALLS` na visit metódu — funguje keď JDT resolvne na interface, nie na konkrétnu implementáciu |
| Rekurzívna iterácia ObjectStructure | ❌ Nie | `for (Element e : elements) e.accept(v)` — lokálna premenná |
| Intent rozlíšenie (Visitor vs. externý processor) | ✅ Áno | Visitor je jediný GoF vzor s ≥2 visit metódami + reciprocitou |

### Štrukturálna jedinečnosť Visitor-a

Na rozdiel od Observer/Composite/Strategy, Visitor má **takmer unikátnu štrukturálnu signatúru**. Kombinácia "interface s ≥2 visit metódami" + "reciprocita s Element cez accept" je tak špecifická, že žiadny iný GoF vzor ju prirodzene nezdieľa. Toto robí z Visitor-a najľahšie detekovateľný vzor — očakávame vysokú presnosť aj recall.

---

## 2. Ground truth — P-MARt v1.2

P-MARt v1.2 [2] definuje **3 Visitor inštancie** v 2 z 9 projektov:

| Projekt | Počet GT | Kanonické Visitor triedy (Element) |
|---|---|---|
| jrefac | 2 | `JavaParserVisitor` (ASTNode hierarchia), `SummaryVisitor` (Summary hierarchia) |
| PMD | 1 | `JavaParserVisitor` (ASTNode hierarchia) |

Ostatných 7 projektov (quickuml, lexi, netbeans, junit, jhotdraw, mapper, nutch) podľa P-MARt nemá GT pre Visitor. P-MARt agreguje: Visitor má **3 mikroarchitektúry**, **3 Visitor triedy**, **99 ConcreteElement**, **37 ConcreteVisitor** — ide o rozsiahle AST hierarchie generované nástrojom **JavaCC**.

### Analýza detekovateľnosti GT

| GT Visitor | visit metódy | Reciprocita accept(Visitor) | ConcreteVisitor | Detekovateľná? |
|---|---|---|---|---|
| jrefac: `JavaParserVisitor` | 86 | `Node.jjtAccept(JavaParserVisitor)` (89 Element tried) | ≥1 | ✅ P1–P6 |
| jrefac: `SummaryVisitor` | 13 | `Summary.accept(SummaryVisitor)` (13 Element tried) | ≥1 | ✅ P1–P6 |
| PMD: `JavaParserVisitor` | 88 | `Node.jjtAccept(JavaParserVisitor)` (89 Element tried) | ≥1 | ✅ P1–P6 |

**Maximálna dosiahnuteľná Recall: 3/3 = 1.000** — všetky GT inštancie sú štrukturálne kompletné GoF Visitory s plnou reciprocitou. Každá z troch má aj desiatky ConcreteElement tried aj aspoň jeden ConcreteVisitor (reálne používaný).

### Poznámka o JavaCC a `jjtAccept`

Obidva GT projekty (jrefac aj PMD) používajú **JavaCC** na generovanie Java parserov. JavaCC generuje AST hierarchiu s metódou `jjtAccept(ParserVisitor, Object)` namiesto štandardného `accept(Visitor)`. Detektor preto explicitne podporuje prefixy `accept`, `apply` **a `jjtAccept`** — bez `jjtAccept` by obaja kanonickí `JavaParserVisitor` boli nedetekovateľní.

---

## 3. Prehľad pokusov

### Pokus 1: Baseline (≥2 visit metódy)

**Hypotéza:** Visitor je interface alebo abstract class, ktorý deklaruje aspoň 2 metódy s prefixom `visit`. Žiadne ďalšie obmedzenia. Testuje, či samotný "visit" prefix je dostatočne silný signál.

**Podmienky:**
- Visitor = Interface alebo abstract Class
- `size(visitMethods) >= 2`

**Cypher (jadro):**
```cypher
MATCH (visitorNode)
WHERE visitorNode:Interface
   OR (visitorNode:Class AND visitorNode.isAbstract = true)
MATCH (visitorType:Type {fqn: visitorNode.fqn})
WITH visitorType, [
    (visitorType)-[:DECLARES]->(m:Method)
    WHERE toLower(m.name) STARTS WITH "visit" | m
] AS visitMethods
WHERE size(visitMethods) >= 2
SET visitorType:Visitor
```

**Výsledky:** TP=3, FP=1, FN=0 → **Precision=0.750, Recall=1.000, F1=0.857**

**Záver:** Detekuje všetky 3 GT inštancie (`JavaParserVisitor` v jrefac aj PMD, `SummaryVisitor` v jrefac) plus 1 FP — `TypeChangeVisitor` v jrefac (12 visit metód, ale **nemá** reciprocitnú accept metódu na žiadnom Element-e). Perfektný recall je pozoruhodný — samotný "visit" prefix bez reciprocity je už dostatočný na identifikáciu kanonických GoF Visitorov.

---

### Pokus 2: Striktnejší prah (≥3 visit metódy)

**Hypotéza:** Zvýšenie prahu na 3 visit metódy odfiltruje edge-case "dual visitor-like" triedy s minimalným počtom operácií. Testuje, či je prah 2 alebo 3 rozumnejší.

**Nová podmienka:**
- `size(visitMethods) >= 3` (namiesto >=2)

**Výsledky:** TP=3, FP=1, FN=0 → **Precision=0.750, Recall=1.000, F1=0.857**

**Záver:** **Identické výsledky ako Pokus 1.** Všetky 4 detekované Visitory (3 TP + 1 FP) majú ≥12 visit metód, takže prah 3 nič neodfiltruje. Toto je dôležité empirické zistenie: **reálne Visitory majú buď desiatky visit metód, alebo žiadne** — neexistuje stredné pásmo. Prah 2 je dostatočne bezpečný, vyšší prah neprinesie pridanú hodnotu pre P-MARt benchmark.

---

### Pokus 3: Reciprocita s Element

**Hypotéza:** Pridanie GoF podmienky, že musí existovať Element trieda s accept-metódou, ktorej parameter je typu Visitor. Reciprocita Visitor↔Element je jedinečná pre GoF Visitor a mala by eliminovať FP z Pokusu 1/2.

**Nová podmienka:**
- Musí existovať trieda (Element) s metódou `accept`/`apply`/`jjtAccept` s `PARAMETER_TYPE` = Visitor

**Cypher (nová časť):**
```cypher
AND EXISTS {
    MATCH (elementType:Type)-[:DECLARES]->(acceptMethod:Method)
    MATCH (acceptMethod)-[:HAS_PARAMETER]->(param:Parameter)
    MATCH (param)-[:PARAMETER_TYPE]->(visitorType)
    WHERE toLower(acceptMethod.name) STARTS WITH "accept"
       OR toLower(acceptMethod.name) STARTS WITH "apply"
       OR toLower(acceptMethod.name) STARTS WITH "jjtaccept"
}
```

**Výsledky:** TP=3, FP=0, FN=0 → **Precision=1.000, Recall=1.000, F1=1.000** ⭐

**Záver:** **Perfektná detekcia.** Reciprocita Visitor↔Element eliminovala jediný FP (`TypeChangeVisitor`) bez straty TP. `TypeChangeVisitor` zrejme pracuje priamo na AST uzloch bez formálneho double dispatchu — žiadna trieda nemá `accept(TypeChangeVisitor)` metódu. Naviac P3 označí aj 189 Element tried (100 v jrefac + 89 v PMD), čo potvrdzuje rozsiahlosť kanonických AST hierarchií. **Najlepší pokus.**

---

### Pokus 4: ConcreteVisitor existuje

**Hypotéza:** Kanonický Visitor vzor vyžaduje aspoň jeden ConcreteVisitor — triedu, ktorá reálne implementuje Visitor rozhranie. Bez tohto by išlo o neimplementovaný abstraktný návrh.

**Nová podmienka:**
- Musí existovať trieda, ktorá tranzitívne `EXTENDS|IMPLEMENTS*1..3` Visitor node

**Výsledky:** TP=3, FP=0, FN=0 → **Precision=1.000, Recall=1.000, F1=1.000**

**Záver:** Identické výsledky ako P3. Obaja `JavaParserVisitor` aj `SummaryVisitor` majú implementáciu(e) v projekte (P-MARt eviduje 37 ConcreteVisitor tried spolu). Podmienka je **splnená automaticky** všetkými GoF Visitor-mi v P-MARt — nepridáva nič, čo P3 už neodfiltroval.

---

### Pokus 5: Double dispatch cez CALLS

**Hypotéza:** Najsilnejšia GoF podmienka — Element.accept() metóda musí volať visit metódu na Visitor (double dispatch). Testuje, či CALLS hrany v grafe fungujú pre `v.visitThis(this)` vzor.

**Nová podmienka:**
- Musí existovať `Element.accept` metóda, ktorá `CALLS` `Visitor.visit*` metódu

**Výsledky:** TP=3, FP=0, FN=0 → **Precision=1.000, Recall=1.000, F1=1.000**

**Záver:** Identické výsledky ako P3 a P4. **Dôležité zistenie:** na rozdiel od Composite P5 (stratil `CompositeFigure`) a Observer P4 (stratil 6 TP), Visitor double dispatch check **funguje spoľahlivo**. Dôvod: `accept(Visitor v) { v.visit(this); }` je **priama field-less delegácia** — `v` je parameter metódy, nie lokálna premenná z iterátora kolekcie. JDT correct resolvne `v.visit(this)` na visit metódu Visitor interface-u. Toto je opačný prípad k problémom, ktoré sme mali s kolekčnou iteráciou v Composite a Observer.

---

### Pokus 6: Kombinovaná disjunkcia

**Hypotéza:** Uvoľnenie podmienky ConcreteVisitor na disjunkciu — stačí **jedno z**: (A) ConcreteVisitor existuje, (B) aspoň jedna visit metóda má parameter typu, ktorý sám má accept metódu s Visitor parametrom. Testuje, či existuje edge-case, kde je Visitor interface definovaný ale nikdy implementovaný.

**Výsledky:** TP=3, FP=0, FN=0 → **Precision=1.000, Recall=1.000, F1=1.000**

**Záver:** Identické výsledky ako P3–P5. Disjunkcia nezachytí žiadny nový prípad, pretože všetky GoF Visitory v P-MARt majú aj ConcreteVisitor aj element-like visit parametre.

---

## 4. Porovnanie všetkých pokusov

| Metrika | Pokus 1 | Pokus 2 | **Pokus 3** | Pokus 4 | Pokus 5 | Pokus 6 |
|---|---|---|---|---|---|---|
| Prístup | baseline ≥2 | baseline ≥3 | **+reciprocita** | +ConcreteVisitor | +double dispatch | +disjunkcia |
| TP | 3 | 3 | **3** | 3 | 3 | 3 |
| FP | 1 | 1 | **0** | 0 | 0 | 0 |
| FN | 0 | 0 | **0** | 0 | 0 | 0 |
| Precision | 0.750 | 0.750 | **1.000** | 1.000 | 1.000 | 1.000 |
| Recall | **1.000** | **1.000** | **1.000** | **1.000** | **1.000** | **1.000** |
| F1 | 0.857 | 0.857 | **1.000** | 1.000 | 1.000 | 1.000 |

---

## 5. Najlepší výsledok

**Najlepší výsledok dosiahol Pokus 3** — **F1 = 1.000** (Precision = 1.000, Recall = 1.000). **Perfektná detekcia na celom P-MARt v1.2 benchmarku.**

Kľúčom k tomuto výsledku sú tri faktory:
1. **Visit prefix je unikátny signál.** Kombinácia "interface/abstract class" + "≥2 metódy s prefixom visit" je tak špecifická, že samotný P1/P2 dosiahne precision 0.750 a recall 1.000
2. **Reciprocita Visitor↔Element je dostatočná GoF podmienka.** Pridanie reciprocity (Element má `accept(Visitor)`) eliminuje jediný FP bez straty TP
3. **JavaCC podpora cez `jjtAccept`.** Bez explicitnej podpory `jjtAccept` prefixu by boli obaja kanonickí `JavaParserVisitor` nedetekovateľní — JavaCC generuje `jjtAccept` namiesto štandardného `accept`

---

## 6. Čo sme zistili

### Kľúčové poznatky

1. **Visitor je najčistejšie detekovateľný GoF vzor.** F1 = 1.000 je najvyššie zo všetkých doteraz testovaných vzorov (Singleton ~0.5, Strategy 0.152, Observer 0.155, Composite 0.444, Decorator 1.000, Factory 0.039). Visitor a Decorator sú jediné dva vzory, kde sme dosiahli perfektnú detekciu na celom P-MARt. Dôvod je štrukturálna jedinečnosť — "visit" prefix a reciprocita s accept metódou sú tak špecifické, že žiadny iný vzor ich prirodzene nezdieľa.

2. **Prah počtu visit metód nemá efekt na tomto benchmarku.** Pokus 1 (≥2) a Pokus 2 (≥3) dali identické výsledky. Empirické zistenie: **reálne Visitory majú buď desiatky visit metód (12, 13, 86, 88), alebo žiadne**. Žiadny z kandidátov v P-MARt nemá 2 alebo 3 visit metódy, čo potvrdzuje, že Visitor je vzor "veľkého rozsahu" — oplatí sa použiť iba keď Element hierarchia je dostatočne bohatá.

3. **Reciprocita je najsilnejší filter.** Pokus 3 (pridanie accept reciprocity) eliminoval jediný FP bez straty TP. Toto je rovnaký záver ako pri Composite P3 (kolekčný field) a Observer P3 (kolekčný field) — **jedna štrukturálna podmienka stačí na dosiahnutie optimálneho výsledku**. Ďalšie pokusy (P4–P6) už nič nezlepšia, pretože P3 už dosiahol strop F1=1.000.

4. **Double dispatch CALLS funguje.** Na rozdiel od Composite P5 (stratil `CompositeFigure` kvôli iterácii kolekcie) a Observer P4 (stratil 6 TP kvôli nedetekovateľnej delegácii), Visitor double dispatch v Pokuse 5 funguje spoľahlivo. Dôvod: `accept(Visitor v) { v.visit(this); }` používa parameter metódy priamo, nie lokálnu premennú z iterátora. JDT správne resolvne CALLS hranu. Toto je **paralelný jav k JUnit TestDecorator FIX #6** — field/parameter delegácia je spoľahlivo detekovateľná, kolekčná iterácia nie je.

5. **JavaCC podpora je kritická.** Bez explicitnej podpory `jjtAccept` prefixu by recall klesol na 0 pre oba `JavaParserVisitor`. Všetky 3 GT Visitory sú z JavaCC-generovaných AST parserov. Je to paralelný jav k Factory Method `handles(): Vector` — konkrétne knižnice/nástroje generujú kód s nekanonickými názvami a detektor musí tieto konvencie vedome podporovať.

6. **TypeChangeVisitor je zaujímavý edge-case.** V P1/P2 je to jediný FP — 12 visit metód, ale žiadny Element s `accept(TypeChangeVisitor)`. Pravdepodobne ide o "external visitor" vzor, kde sa visit metódy volajú priamo (`visitor.visitX(node)`), bez formálneho double dispatchu. Z GoF hľadiska to nie je kanonický Visitor (chýba accept), ale z hľadiska implementácie je funkčne podobný. P-MARt ho (správne) neeviduje ako GT.

### Pokrytie podmienok z literatúry

| Podmienka z GoF / refactoring.guru | Pokrytá? | Pokus |
|---|---|---|
| Visitor interface/abstract class | ✅ | P1–P6 |
| Visit metódy pre každý Element | ✅ | P1–P6 (prefix match) |
| Element má accept(Visitor) metódu | ✅ | P3–P6 |
| Accept parameter typu Visitor | ✅ | P3–P6 |
| Double dispatch (accept CALLS visit) | ✅ | P5 |
| ConcreteVisitor existuje | ✅ | P4, P6 |
| ConcreteElement hierarchia | ✅ (implicitne) | P3–P6 (pri označovaní Element tried) |
| ObjectStructure | ❌ | Nedetekovateľné — voliteľná rola, štrukturálne splýva s inými kolekčnými držiteľmi |

**Všetky základné štrukturálne podmienky z GoF definície Visitor-a sú pokryté.**

---

## 7. Podmienky, ktoré neboli testované a prečo

| Podmienka | Dôvod netestovania |
|---|---|
| **Naming convention** (trieda obsahuje "Visitor"/"Walker") | Pokus 3 už dosahuje F1=1.000 — naming filter by nemohol priniesť zlepšenie a mohol by stratiť TP pri visitor-och s netypickým pomenovaním (`*Walker`, `*Analyzer`). |
| **≥2 distinct ConcreteVisitors** | P-MARt eviduje 37 ConcreteVisitor tried spolu pre 3 Visitor interfacy, takže priemer je ~12 na interface. Ale niektoré Visitor vzory majú iba 1 ConcreteVisitor (napr. AST printer). Vyžadovanie ≥2 by mohlo stratiť TP v iných projektoch. |
| **ObjectStructure** (trieda držiaca kolekciu Element-ov) | Je to voliteľná rola v GoF a štrukturálne splýva s Composite alebo iným kolekčným držiteľom. P-MARt eviduje iba 1 ObjectStructure v celom benchmarku — silné vyžadovanie by zlyhalo. |
| **Visit metódy majú rovnaký návratový typ** | GoF neurčuje, ale konzistencia je typická. Testovanie by bolo zbytočné, lebo P3 už má F1=1.000. |
| **ConcreteElement override accept** | Implicitne pokryté: Element hierarchia sa v grafe pozoruje cez PARAMETER_TYPE na accept metódach, ktoré sú deklarované aj na konkrétnych triedach (každá `ASTNode` podtrieda má override `jjtAccept`). |

---

## 8. Možné vylepšenia a limitácie

### Fundamentálne limitácie a poznámky

1. **Malý ground truth.** P-MARt obsahuje iba 3 Visitor inštancie — menej ako všetky ostatné testované vzory okrem Factory Method. Hoci F1=1.000 je ideálny výsledok, štatistický význam by bol vyšší pri väčšom benchmarku. Limitácia P-MARt, nie nášho detektora.

2. **Visitor je zriedkavý vzor.** Iba 2 z 9 P-MARt projektov majú Visitor (obidva sú kompilátor/parser projekty s AST hierarchiou). Visitor je užitočný primárne vo doménach so stabilnou hierarchiou tried a meniacimi sa operáciami — AST, IR, DOM stromy. Bežné aplikácie ho nepotrebujú.

3. **External visitor vzor.** `TypeChangeVisitor` v jrefac je príklad "external visitor" — štýlu, kde sa visit metódy volajú priamo z klienta namiesto cez double dispatch. Z GoF hľadiska to nie je kanonický Visitor, ale funkčne rieši rovnaký problém. Naše pravidlá ho (správne, voči P-MARt) klasifikujú ako FP v P1/P2 a eliminujú v P3+.

4. **JavaCC-generovaný kód je dominantný.** Všetky 3 TP sú JavaCC AST parsery. Bez explicitnej podpory `jjtAccept` by recall bol 0. Toto je špecifická limitácia — iné nástroje (ANTLR, Eclipse JDT) generujú iné konvencie. Univerzálny Visitor detektor by musel rozpoznávať viacero generátorov AST kódu.

5. **Perfektná detekcia je aj dôsledkom malého GT.** S väčším benchmarkom by sa mohli objaviť edge-cases, ktoré naše pravidlá nepokryjú. Na P-MARt však dosahujeme optimum.

### Porovnanie s literatúrou

Tsantalis et al. [4] reportujú pre Visitor F1 = 0.70–0.95 v závislosti od datasetu — **naše P3 (F1 = 1.000) je nad horným limitom**. Nazar et al. [3] reportujú F1 = 0.60–0.85 pre Visitor na P-MARt. Dôvod nášho nadpriemerného výsledku je dvojaký: (1) explicitná podpora `jjtAccept` pre JavaCC kód, (2) malé a štrukturálne jednoznačné GT (3 inštancie, všetky kanonické GoF Visitory s plnou reciprocitou). Pri väčšom a heterogénnejšom benchmarku by sme pravdepodobne dosiahli výsledky podobné Tsantalisovi (F1 ~0.85).

---

## 9. Referencie

[1] Gamma, E., Helm, R., Johnson, R., Vlissides, J. (1995). *Design Patterns: Elements of Reusable Object-Oriented Software.* Addison-Wesley. — GoF Visitor: Visitor deklaruje visit metódy pre každý Element typ, Element deklaruje accept(Visitor) s double dispatchom. Klient spúšťa operáciu cez `element.accept(visitor)`.

[2] Guéhéneuc, Y.G. (2007). *P-MARt: Pattern-like Micro Architecture Repository.* https://www.ptidej.net/tools/designpatterns/ — Ground truth datasét (verzia 1.2). Obsahuje 3 Visitor inštancie v 2 z 9 projektov (jrefac 2, PMD 1). Celkovo eviduje 99 ConcreteElement a 37 ConcreteVisitor tried.

[3] Nazar, N., Aleti, A., Zheng, Y. (2022). *Feature-Based Software Design Pattern Detection.* Journal of Systems and Software. — Reportujú F1 = 0.60–0.85 pre Visitor na P-MARt. Vysoký recall pripisujú štrukturálnej jedinečnosti "visit" prefixu.

[4] Tsantalis, N., Chatzigeorgiou, A., Stephanides, G., Halkidis, S.T. (2006). *Design Pattern Detection Using Similarity Scoring.* IEEE Transactions on Software Engineering. — Reportujú F1 = 0.70–0.95 pre Visitor. Visitor je podľa nich jeden z najjednoznačnejšie detekovateľných vzorov kvôli unikátnej štrukturálnej signatúre.

[5] Refactoring.Guru. *Visitor Design Pattern.* https://refactoring.guru/design-patterns/visitor — Implementačné kroky: Visitor interface s visit metódami pre každý Element, Element interface s accept(Visitor), ConcreteElement implementuje accept ako `visitor.visitThis(this)`. Vhodné pre stabilné hierarchie s meniacimi sa operáciami (AST, DOM). 
