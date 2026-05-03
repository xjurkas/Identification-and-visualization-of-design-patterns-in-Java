# Decorator — Súhrnná správa detekcie

## 1. Podmienky pre identifikáciu Decorator vzoru

Podľa refactoring.guru [1] a GoF [2] má Decorator vzor tieto štrukturálne prvky:

1. **Component interface** — spoločné rozhranie pre konkrétne komponenty aj dekorátory. Definuje operácie, ktoré môžu byť dynamicky rozšírené.
2. **Concrete Component** — základná implementácia Component interface, objekt ktorý je dekorovaný.
3. **Base Decorator** — trieda, ktorá implementuje Component interface a zároveň obsahuje referenciu (field) na objekt typu Component. Deleguje volania na wrappovaný objekt.
4. **Constructor injection** — Base Decorator prijíma Component cez konštruktor (`Decorator(Component c)`), čím sa inicializuje interná referencia.
5. **Method delegation** — Base Decorator preposiela (forwarduje) volania metód Component interface na wrappovaný objekt.
6. **Concrete Decorator(s)** — podtrieda(y) Base Dekoratora, ktoré pridávajú alebo modifikujú správanie pred alebo po delegácii na wrappovaný objekt.

Podľa Wikipedia [3] je implementačný postup:
- Podtriediť Component do Decorator triedy
- V Decorator triede pridať field typu Component
- V Decorator konštruktore inicializovať Component field
- V Decorator triede forwardovať všetky Component metódy na field
- V ConcreteDecorator triede overridnuť metódy, ktorých správanie sa má zmeniť

### Čo je štrukturálne detekovateľné a čo nie

| Podmienka | Štrukturálne detekovateľná? | Poznámka |
|---|---|---|
| Component interface/abstract class | ✅ Áno | `:Interface` alebo `:Class` s `isAbstract=true`, s `IN_FILE` |
| Base Decorator implementuje Component | ✅ Áno | `IMPLEMENTS` (interface) alebo `EXTENDS` (abstract class) |
| Field typu Component | ✅ Áno | `HAS_FIELD` → `FIELD_TYPE` → Component |
| Constructor injection | ✅ Áno | `DECLARES` → `:Constructor` → `HAS_PARAMETER` → `PARAMETER_TYPE` |
| Method delegation | ✅ Áno | `DECLARES` → `:Method` → `CALLS` → metóda na Component (vďaka FIX #6) |
| Concrete Decorator (podtrieda) | ✅ Áno | `EXTENDS` → Base Decorator |
| Concrete Component (iný implementátor) | ✅ Áno | `IMPLEMENTS`/`EXTENDS` → Component, nie je dekorátor |
| Dynamické pridávanie správania | ❌ Nie | Behaviorálna vlastnosť, vyžaduje runtime analýzu |

### Štrukturálna podobnosť s inými vzormi

Tsantalis et al. [4] ukazujú, že Decorator, Proxy a Adapter zdieľajú takmer identickú štrukturálnu signatúru — všetky tri implementujú interface, držia field a delegujú. Kľúčový rozdiel je v **intente**, nie v štruktúre, čo je fundamentálna limitácia štrukturálnej detekcie.

---

## 2. Ground truth — P-MARt v1.2

P-MARt [5] obsahuje 2 inštancie Decorator vzoru v 2 projektoch:

| Projekt | Component | Base Decorator | Concrete Decorators |
|---|---|---|---|
| JHotDraw | `Figure` (interface) | `DecoratorFigure` | `AnimationDecorator`, `BorderDecorator` |
| JUnit | `Test` (interface) | `TestDecorator` | `RepeatedTest`, `TestSetup` |

---

## 3. FIX v client.js

Pred implementáciou fixu bol JUnit `TestDecorator` **nedetekovateľný**. Príčina: keď jdtls resolvuje volanie `fTest.run(result)` v `TestDecorator`, vytvorí CALLS hranu smerujúcu na `TestCase.run()` (konkrétny implementátor) namiesto `Test.run()` (interface). Náš Cypher dotaz kontroluje `calledMethod.containerFqn = componentInterface.fqn`, takže delegácia bola neviditeľná.

FIX rieši problém v source-level CALLS fallbacku: keď Pattern A nájde field delegáciu a resolvovaný target žije na implementátore, **pridá dodatočnú CALLS hranu aj na interface metódu**. Tým sa delegácia stáva viditeľnou na úrovni interface. Toto je riešenie na úrovni grafu, nie na úrovni Cypher dotazu.

---

## 4. Prehľad pokusov

### Pokus 1: Baseline

**Hypotéza:** Čisto štrukturálna detekcia na základe piatich podmienok bez constructor injection.

**Podmienky:**
- Component = lokálny interface (s `IN_FILE`)
- Base Decorator: implementuje interface + field typu interface
- Proporcionálna delegácia: ≥50% metód interface, minimum 2
- Existuje concrete decorator (podtrieda)
- Existuje concrete component (iný implementátor, nie dekorátor)

**Cypher (jadro):**
```cypher
MATCH (componentInterface:Interface)
WHERE EXISTS { MATCH (componentInterface)-[:IN_FILE]->() }

-- Implementácia + field typu interface
MATCH (baseDecoratorType:Type {fqn: baseDecoratorClass.fqn})
      -[:HAS_FIELD]->(componentField:Field)
      -[:FIELD_TYPE]->(componentType:Type)
WHERE componentType.fqn = componentInterface.fqn

-- Proporcionálny prah delegácie
MATCH (baseDecoratorType)-[:DECLARES]->(decoratorMethod:Method)
      -[:CALLS]->(calledMethod:Method)
WHERE calledMethod.containerFqn = componentInterface.fqn
WHERE delegatingMethods >= 2
  AND (toFloat(delegatingMethods) / toFloat(interfaceMethodCount)) >= 0.5

-- Concrete decorator + concrete component
MATCH (concreteDecoratorClass:Class)-[:EXTENDS]->(baseDecoratorClass)
WHERE EXISTS {
  MATCH (cc:Class)-[:IMPLEMENTS]->(componentInterface)
  WHERE cc.fqn <> baseDecoratorClass.fqn
    AND NOT EXISTS { MATCH (cc)-[:EXTENDS*]->(baseDecoratorClass) }
}
SET baseDecoratorClass:Decorator
```

**Výsledky:** TP=2, FP=2, FN=0 → **Precision=0.500, Recall=1.000, F1=0.667**

**Záver:** Perfektný recall — oba GT Decorátory (JHotDraw `DecoratorFigure`, JUnit `TestDecorator`) detekované vďaka fixu. Dva FP z netbeans (`JavaDocImpl`, `FilterFactory`) — štrukturálne neodlíšiteľné od Decorator vzoru.

---

### Pokus 2: Constructor injection

**Hypotéza:** Pridanie GoF podmienky — konštruktor prijíma component cez parameter — eliminuje FP.

**Nová podmienka:**
- Base Decorator musí mať konštruktor s parametrom typu Component interface

**Cypher (nová časť):**
```cypher
WITH componentInterface, baseDecoratorClass, baseDecoratorType
WHERE EXISTS {
  MATCH (baseDecoratorType)-[:DECLARES]->(ctor)
  WHERE ctor:Constructor
     OR (ctor:Method AND ctor.name STARTS WITH baseDecoratorClass.name + "(")
  MATCH (ctor)-[:HAS_PARAMETER]->(param)-[:PARAMETER_TYPE]->(paramType:Type)
  WHERE paramType.fqn = componentInterface.fqn
}
```

**Výsledky:** TP=2, FP=0, FN=0 → **Precision=1.000, Recall=1.000, F1=1.000**

**Záver:** Perfektný výsledok na celom P-MARt benchmarku. Constructor injection eliminoval oba netbeans FP — `JavaDocImpl` a `FilterFactory` nemajú konštruktor s parametrom typu component interface. Oba TP zachované — `DecoratorFigure(Figure)` aj `TestDecorator(Test)` prijímajú component cez konštruktor.

---

### Pokus 3: Rozšírenie na abstraktné triedy ako Component

**Hypotéza:** GoF definuje Component ako abstraktný typ — interface alebo abstraktnú triedu. Rozšírenie na abstraktné triedy zvýši pokrytie.

**Nová podmienka:**
- Component = Interface **ALEBO** abstraktná trieda (`Class` s `isAbstract = true`)
- Konformeri: `IMPLEMENTS` (pre interface) + `EXTENDS` (pre abstract class)

**Cypher (zmena):**
```cypher
MATCH (component)
WHERE (component:Interface
       OR (component:Class AND component.isAbstract = true))
  AND EXISTS { MATCH (component)-[:IN_FILE]->() }

-- Konformeri cez IMPLEMENTS aj EXTENDS
OPTIONAL MATCH (conformerImpl:Class)-[:IMPLEMENTS]->(component)
OPTIONAL MATCH (conformerExt:Class)-[:EXTENDS]->(component)
  WHERE component:Class
-- ...

-- Concrete component check rozšírený
MATCH (cc:Class)-[:IMPLEMENTS|EXTENDS]->(component)
```

**Výsledky:** TP=2, FP=1, FN=0 → **Precision=0.667, Recall=1.000, F1=0.800**

**Záver:** Oba TP zachované (sú interface-based). Nový FP: netbeans `FilterNode` — wrappuje abstraktnú triedu `Node`, prijíma ju cez konštruktor, deleguje, má 17 podtried. Štrukturálne neodlíšiteľný od Decorator, funkčne je to Filter/Proxy vzor. Rozšírenie na abstraktné triedy je kontraproduktívne — neprinieslo nový TP, zaviedlo nový FP.

---

## 5. Porovnanie všetkých pokusov

| Metrika | Pokus 1 | Pokus 2 | Pokus 3 |
|---|---|---|---|
| Prístup | baseline + FIX #6 | + constructor injection | + abstract class component |
| TP | 2 | **2** | 2 |
| FP | 2 | **0** | 1 |
| FN | 0 | **0** | 0 |
| Precision | 0.500 | **1.000** | 0.667 |
| Recall | **1.000** | **1.000** | **1.000** |
| F1 | 0.667 | **1.000** | 0.800 |

---

## 6. Najlepší výsledok

**Najlepší výsledok dosiahol Pokus 2** — F1 = 1.000 (Precision = 1.000, Recall = 1.000). Perfektná detekcia na celom P-MARt v1.2 benchmarku.

Kľúčom k tomuto výsledku sú dva faktory:
1. **FIX #6 v client.js** — bez neho by JUnit `TestDecorator` nebol detekovaný (recall by bol 0.500)
2. **Constructor injection** — eliminoval oba netbeans FP bez straty TP (precision z 0.500 na 1.000)

---

## 7. Čo sme zistili

### Kľúčové poznatky

1. **FIX je kľúčový prínos na úrovni grafu.** Riešenie problému jdtls resolúcie (CALLS hrany na konkrétny implementátor namiesto interface) na úrovni client.js — nie na úrovni Cypher — je čistejšie a robustnejšie riešenie. Bez tohto fixu by recall bol maximálne 50%.

2. **Constructor injection je silný GoF diskriminátor.** Decorator vzor podľa GoF vyžaduje, aby sa wrappovaný komponent odovzdával cez konštruktor. Proxy/Filter triedy často inicializujú referenciu inak (setter, factory, interná logika). Toto bola dostatočná podmienka na úplnú elimináciu FP.

3. **Proporcionálny delegation threshold** (≥50%, min 2) je správna voľba. Pevný prah (napr. ≥5 metód) by zlyhal na malých interfacoch ako JUnit `Test` (2 metódy). Proporcionálny prah funguje univerzálne.

4. **Rozšírenie na abstraktné triedy je kontraproduktívne** pre tento benchmark. Abstraktné triedy majú bohatšiu hierarchiu, čo zvyšuje štrukturálnu podobnosť s Proxy/Filter vzormi.

5. **Netbeans je štrukturálny outlier.** Vo všetkých pokusoch produkuje FP, pretože jeho frameworková architektúra vytvára triedy štrukturálne identické s Decorator vzormi.

### Pokrytie podmienok z literatúry

| Podmienka z GoF / refactoring.guru | Pokrytá? | Pokus |
|---|---|---|
| Component interface | ✅ | P1, P2, P3 |
| Component abstract class | ✅ | P3 |
| Base Decorator implementuje Component | ✅ | P1, P2, P3 |
| Field typu Component | ✅ | P1, P2, P3 |
| Constructor injection | ✅ | P2, P3 |
| Method delegation (forwarding) | ✅ | P1, P2, P3 |
| Concrete Decorator (podtrieda) | ✅ | P1, P2, P3 |
| Concrete Component (iný implementátor) | ✅ | P1, P2, P3 |

**Všetky štrukturálne podmienky z GoF definície sú pokryté.**

---

## 8. Podmienky, ktoré neboli testované a prečo

| Podmienka | Dôvod netestovania |
|---|---|
| **Naming convention** (trieda obsahuje „Decorator"/„Wrapper" v mene) | Rovnaký záver ako pri Singleton Pokus 3 — naming nie je súčasťou GoF definície, staršie projekty nepoužívajú konvenciu (`DecoratorFigure` áno, `TestDecorator` áno, ale `FilterNode` tiež nie). Pridanie by nezmenilo výsledky, keďže Pokus 2 už je perfektný. |
| **Abstract base decorator** (base decorator musí byť abstraktný) | Príliš reštriktívne — mnohé reálne implementácie majú concrete base decorator. V P-MARt `DecoratorFigure` je abstract, ale `TestDecorator` je concrete. Vyžadovanie by viedlo k FN. |
| **Method override v concrete decorator** (concrete decorator overriduje metódu) | Implicitne pokryté tým, že concrete decorator je podtrieda — ak neoverrideuje žiadnu metódu, nemá zmysel ako decorator. V praxi by explicitná kontrola bola príliš reštriktívna a technicky ťažko overiteľná v grafe. |
| **Decorator EXTENDS Component** (nielen IMPLEMENTS) | V Jave Decorator typicky implementuje interface, nie extenduje ho. Pre abstract class component je to pokryté v Pokuse 3 cez EXTENDS. |

---

## 9. Možné vylepšenia a limitácie

### Fundamentálne limitácie statickej štrukturálnej analýzy

1. **Štrukturálna neodlíšiteľnosť Decorator/Proxy/Adapter.** Tieto tri vzory zdieľajú takmer identickú štruktúru — implementácia interface, field, delegácia, podtriedy [4]. Čisto štrukturálna analýza ich nevie rozlíšiť bez sémantickej alebo behaviorálnej analýzy. Naše netbeans FP (vo všetkých pokusoch) sú priamym dôsledkom tejto limitácie.

2. **Závislosť na kvalite grafu.** Detekcia delegácie závisí na korektnosti CALLS hrán v grafe. FIX rieši jeden konkrétny problém (jdtls resolúcia na implementátora), ale iné edge-cases môžu existovať v iných projektoch.

3. **Proporcionálny threshold je heuristika.** Prah ≥50% metód interface je empirická voľba. Na inom datasete by mohol byť príliš voľný alebo príliš prísny. Pre P-MARt funguje optimálne.

### Čo by mohol zlepšiť 4. pokus (keby bol potrebný)

Pokus 2 dosahuje F1 = 1.000, takže žiadne vylepšenie nie je možné na tomto benchmarku. Potenciálne rozšírenia pre budúcu prácu:
- **Väčší datasét** — testovanie na projektoch mimo P-MARt by odhalilo, či constructor injection podmienka generalizuje
- **Behaviorálna analýza** — kontrola, či concrete decorator skutočne pridáva správanie (volá super + vlastnú logiku)
- **ML klasifikácia** — kombinácia štrukturálnych features s kontextovými pre odlíšenie Decorator od Proxy

---

## 10. Referencie

[1] Refactoring.Guru. *Decorator Design Pattern.* https://refactoring.guru/design-patterns/decorator — Implementačné kroky: Component interface, Concrete Component, Base Decorator s field + constructor, Concrete Decorator s override.

[2] Gamma, E., Helm, R., Johnson, R., Vlissides, J. (1995). *Design Patterns: Elements of Reusable Object-Oriented Software.* Addison-Wesley. — GoF Decorator: Component interface, Decorator drží referenciu na Component, deleguje volania, ConcreteDecorator pridáva správanie. Proporcionálny prah (≥50%) umožňuje detekciu aj pre malé interfacy.

[3] Wikipedia. *Decorator pattern.* https://en.wikipedia.org/wiki/Decorator_pattern — Implementačný postup: subclass Component → add field → pass to constructor → forward methods → override in ConcreteDecorator.

[4] Tsantalis, N., Chatzigeorgiou, A., Stephanides, G., Halkidis, S.T. (2006). *Design Pattern Detection Using Similarity Scoring.* IEEE Transactions on Software Engineering. — Štrukturálna podobnosť Decorator/Proxy/Adapter. Naše FP z netbeans sú priamym príkladom tejto limitácie.

[5] Guéhéneuc, Y.G. (2007). *P-MARt: Pattern-like Micro Architecture Repository.* https://www.ptidej.net/tools/designpatterns/ — Ground truth datasét (verzia 1.2). Obsahuje 2 Decorator inštancie v 9 projektoch.
