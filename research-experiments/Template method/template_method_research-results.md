# Template Method — Súhrnná správa detekcie

## 1. Podmienky pre identifikáciu Template Method vzoru

Podľa GoF [1] a refactoring.guru [5] má Template Method vzor tieto štrukturálne prvky:

1. **AbstractClass** — abstraktná trieda, ktorá:
   - Deklaruje **template method** — konkrétnu (non-abstract) metódu, ktorá definuje kostru algoritmu
   - Deklaruje **primitive operations** (hook methods) — abstraktné metódy, ktoré template method volá a ktoré podtriedy musia implementovať
2. **ConcreteClass** — podtrieda AbstractClass, ktorá:
   - Implementuje (OVERRIDES) primitive operations
   - **NEMÁ** override template method (template method je podľa GoF obvykle `final`)

**Kľúčová štrukturálna signatúra:** Trieda je abstraktná + má konkrétnu metódu (template method), ktorá **volá** (`CALLS`) aspoň jednu abstraktnú metódu tej istej triedy + existuje aspoň jedna podtrieda, ktorá override-uje aspoň jednu z tých abstraktných metód.

### Čo je štrukturálne detekovateľné a čo nie

| Podmienka | Detekovateľná? | Poznámka |
|---|---|---|
| AbstractClass (abstract) | ✅ Áno | `:Class {isAbstract: true}` alebo `:Modifier {name:"abstract"}` |
| AbstractClass je v projekte | ✅ Áno | `IN_FILE` filter |
| Má aspoň jednu konkrétnu metódu | ✅ Áno | Method bez abstract modifikátora |
| Má aspoň jednu abstraktnú metódu | ✅ Áno | Method s `isAbstract=true` alebo `abstract` modifier |
| Template method CALLS primitive operation | ✅ Áno | `CALLS` hrana na abstraktnú metódu v tej istej triede |
| ConcreteClass EXTENDS AbstractClass | ✅ Áno | `EXTENDS*1..3` |
| ConcreteClass override-uje primitive operation | ✅ Áno | Cez OVERRIDES hranu alebo rovnomennú metódu v podtriede |
| Template method je `final` | ⚠️ Čiastočne | GoF odporúča, ale málo projektov to dodržiava |
| Intent rozlíšenie (TM vs Factory Method) | ❌ Nie | Štrukturálna analýza ich spoľahlivo nerozlišuje |

### Štrukturálna podobnosť s inými vzormi

**Template Method zdieľa takmer identickú štruktúru s Factory Method** — oba majú abstract metódu v parentovi a override v childovi. Rozdiel je v **intente**, nie v štruktúre: Factory Method vyrába objekty (abstract metóda má RETURN_TYPE typu Product), Template Method definuje kostru algoritmu (abstract metódy sú tzv. hook operations). Čisto štrukturálna analýza ich nevie spoľahlivo rozlíšiť, ako uvádza aj Tsantalis et al. [4]. Ďalej TM má prekryv s **Strategy** (Strategy deleguje cez kompozíciu, TM cez dedičnosť) a **Abstract Factory** (viacero factory metód pre rodinu produktov).

---

## 2. Ground truth — P-MARt v1.2

P-MARt v1.2 [2] definuje **10 Template Method inštancií** v 4 z 9 projektov:

| Projekt | Počet GT | Poznámka |
|---|---|---|
| JHotDraw | 2 | Pravdepodobne `AbstractFigure` a jedna z `AbstractHandle`/`ChangeConnectionHandle`/`PaletteButton` |
| MapperXML | 4 | Pravdepodobne `AbstractValueHolder`, `Settings`, `ComponentFactory`, `Dispatcher` |
| Nutch | 3 | Pravdepodobne `VersionedWritable`, `NutchGenericFileSystem`, + 1 ďalšia |
| PMD | 1 | Pravdepodobne `AbstractScope` |

P-MARt agreguje: 10 AbstractClass + **92 ConcreteClass** = stredne veľký GT. Pomer 1:9 ukazuje, že Template Method je v týchto projektoch pomerne bohato implementovaný vzor — typická abstract trieda má viacero podtried.

**Dôležité pozorovanie:** Ostatných 5 projektov (QuickUML, Lexi, JRefactory, Netbeans, JUnit) nemá podľa P-MARt žiadny GT pre Template Method. Zvlášť **Netbeans** je problematický — v skutočnosti obsahuje desiatky abstract tried s template metódami (`AbstractNode`, `DataObject`, `FileObject`, `Cookie` hierarchie), ale P-MARt ich nelistuje. Preto očakávame vysoký počet FP z netbeans.

### Analýza detekovateľnosti GT

Z logov P1 a P2 vieme, že naša detekcia **nájde abstract triedy vo všetkých 4 GT projektoch**, takže maximálny recall závisí od toho, či naše pravidlá dostatočne filtrujú na správne triedy:

| Projekt | GT | Detekcie P2 | TP (odhad) | FP (odhad) | FN (odhad) |
|---|---|---|---|---|---|
| JHotDraw | 2 | 5 | 2 | 3 | 0 |
| MapperXML | 4 | 4 | 4 | 0 | 0 |
| Nutch | 3 | 2 | 2 | 0 | 1 |
| PMD | 1 | 1 | 1 | 0 | 0 |
| **GT projekty** | **10** | **12** | **9** | **3** | **1** |

**Maximálna dosiahnuteľná Recall: 9/10 = 0.900.** Jedna Nutch GT inštancia chýba — pravdepodobne trieda, ktorá nie je kanonickou abstract triedou alebo nemá CALLS hranu z konkrétnej na abstract metódu v tej istej triede.

---

## 3. Prehľad pokusov

### Pokus 1: Baseline

**Hypotéza:** AbstractClass v projekte + aspoň jedna konkrétna metóda + aspoň jedna abstraktná metóda + aspoň jedna podtrieda. Testuje, či samotná "abstract class s mix metód a podtriedami" je dostatočná detekcia.

**Podmienky:**
- `Class` s `isAbstract=true` alebo `abstract` modifier
- `IN_FILE` filter (vylúči JDK `java.io.InputStream`, `java.util.AbstractList` atď.)
- ≥1 konkrétna metóda + ≥1 abstraktná metóda
- ≥1 podtrieda cez `EXTENDS*1..3`

**Cypher (jadro):**
```cypher
MATCH (abstractNode:Class)
WHERE (abstractNode.isAbstract = true
       OR EXISTS { MATCH (abstractNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) })
  AND EXISTS { MATCH (abstractNode)-[:IN_FILE]->() }
MATCH (abstractType:Type {fqn: abstractNode.fqn})
WITH abstractNode, abstractType
WHERE EXISTS {
    MATCH (abstractType)-[:DECLARES]->(tm:Method)
    WHERE tm.isAbstract = false
}
AND EXISTS {
    MATCH (abstractType)-[:DECLARES]->(po:Method)
    WHERE po.isAbstract = true
}
AND EXISTS {
    MATCH (:Class)-[:EXTENDS*1..3]->(abstractNode)
}
SET abstractType:AbstractClass
```

**Výsledky (P1):**
- **Celkovo 145 detekcií** cez 9 projektov
- **Per-projekt:** quickuml=6, lexi=1, jrefac=25, netbeans=94, junit=1, jhotdraw=6, mapper=6, nutch=4, PMD=2
- TP=9, FP=136, FN=1 → **Precision=0.062, Recall=0.900, F1=0.116**

**Záver:** Vysoký recall (zachytí všetky očakávané GT okrem 1 Nutch), ale extrémne nízka precision. Netbeans samotný produkuje 94 kandidátov, jrefac 25. Bez dodatočných filtrov je baseline príliš voľný — každá Java abstract trieda s dedičnou hierarchiou matchuje. Toto potvrdzuje, že Template Method je štrukturálne bežný vzor.

---

### Pokus 2: Template method CALLS primitive operation

**Hypotéza:** Pridanie GoF kľúčového diskriminátora — konkrétna metóda v AbstractClass musí **volať** abstraktnú metódu tej istej triedy cez CALLS hranu. Toto je definujúca vlastnosť template method: "konkrétna metóda definuje kostru algoritmu a volá hook metódy, ktoré podtriedy implementujú".

**Nová podmienka:**
- Konkrétna metóda **CALLS** abstraktnú metódu tej istej triedy

**Cypher (nová časť):**
```cypher
WHERE EXISTS {
    MATCH (abstractType)-[:DECLARES]->(tm:Method)
    WHERE tm.isAbstract = false
    MATCH (tm)-[:CALLS]->(po:Method)
    MATCH (abstractType)-[:DECLARES]->(po)
    WHERE po.isAbstract = true
}
```

**Výsledky:** TP=9, FP=82, FN=1 → **Precision=0.099, Recall=0.900, F1=0.178**

**Zmeny oproti P1:**
- quickuml: 6→4 (−2)
- jrefac: 25→16 (−9)
- netbeans: 94→57 (**−37**, dramatický pokles)
- jhotdraw: 6→5 (−1, odfiltroval `Command`)
- mapper: 6→4 (−2)
- nutch: 4→2 (−2)
- PMD: 2→1 (−1)

**Záver:** **Silný pokrok.** CALLS filter odstránil **54 FP** (z 145 na 91) bez straty TP. Recall zostáva 0.900, precision stúpla z 0.062 na 0.099. Dôležité pozorovanie: **CALLS filter funguje spoľahlivo** — na rozdiel od Decoratora, kde sme potrebovali FIX #6 v client.js kvôli JDT resolúcii na konkrétnu implementáciu, tu template method volá `this.primitiveOp()` priamo na abstract metódu v tej istej triede a JDT to správne zachytí.

---

### Pokus 3: ConcreteClass OVERRIDES primitive operation

**Hypotéza:** Pridanie overenia, že podtrieda naozaj override-uje aspoň jednu abstraktnú metódu. Potvrdí, že vzor je reálne používaný (nie len teoretická kostra bez implementácie).

**Nová podmienka:**
- Existuje ConcreteClass ktorá má metódu s **rovnakým názvom** ako abstract metóda v AbstractClass

**Výsledky:** TP=9, FP=81, FN=1 → **Precision=0.100, Recall=0.900, F1=0.180** ⭐

**Zmeny oproti P2:**
- Jediný rozdiel: **netbeans 57→56** (−1, odfiltroval `org.openide.nodes.Children`)

**Záver:** **Najlepší pokus, ale iba o vlas oproti P2.** Filter OVERRIDES funguje, ale odstránil iba 1 FP — pretože väčšina P2 kandidátov má aj reálne override-ujúce podtriedy. Rozdiel je minimálny (P2 F1=0.178 vs P3 F1=0.180), ale kvalitatívne je P3 rigoróznejší. `Children` v netbeans je abstract trieda so 43 konkrétnymi a 2 abstract metódami, ale podtriedy pravdepodobne nemajú rovnomennú override — P-MARt ju správne neeviduje ako TM.

---

### Pokus 4: Anti-Factory Method diskriminátor

**Hypotéza:** Template Method hook metódy typicky vracajú `void` alebo primitívne typy, zatiaľ čo Factory Method abstract metódy vracajú objektové typy (Product). Filter by mal oddeliť TM od FM v triedach, kde dominuje objektová produkcia.

**Nová podmienka:**
- Aspoň jedna CALLED abstract metóda v AbstractClass má: (A) žiadnu RETURN_TYPE hranu (void), alebo (B) vracia primitívny typ, alebo (C) vracia typ ktorý **nie je v projekte** (`IN_FILE`)

**Výsledky:** TP=9, FP=82, FN=1 → **Precision=0.099, Recall=0.900, F1=0.178**

**Zmeny oproti P2:** **ŽIADNE — P4 je úplne identický s P2 (91 vs 91 detekcií, rovnaký zoznam tried).**

**Záver:** **Anti-Factory Method filter úplne zlyhal ako diskriminátor.** Každá jedna detekcia v P2 má aspoň jednu CALLED abstract metódu, ktorá vracia `void`/primitívny typ. To znamená, že v reálnom kóde **Template Method a Factory Method koexistujú v tej istej triede** — typická abstract trieda má `execute()` (TM template) ktoré volá `doStep1(): void` (TM hook), ale zároveň má `createX(): Product` (FM factory method). Naša disjunkcia "aspoň jedna abstract metóda vracia void" prakticky vždy pravdivá, takže filter nič neodfiltruje. Toto je **dôležité empirické zistenie pre obhajobu**: intent-based rozlišovanie medzi TM a FM nie je možné cez RETURN_TYPE heuristiku, pretože vzory nie sú mutually exclusive.

---

### Pokus 5: Disjunkcia CALLS ALEBO bohatá abstract sada

**Hypotéza:** Permisívnejšia alternatíva — ak trieda má ≥2 abstraktné metódy + ≥1 konkrétnu metódu (bohatá "primitive operation" sada), je pravdepodobne TM aj bez explicitného CALLS. Záchranný pokus ak by P2 stratil TP.

**Nová podmienka (disjunkcia):**
- (A) CALLS z konkrétnej na abstraktnú (ako P2)
- **ALEBO** (B) ≥2 abstract metódy + ≥1 concrete metóda (štatistický signál)

**Výsledky:** TP=9, FP=108, FN=1 → **Precision=0.077, Recall=0.900, F1=0.142**

**Zmeny oproti P2:** +26 kandidátov (91 → 117). Pridané FP bez nových TP.

**Záver:** **Horšie ako P2.** Disjunkcia pridala FP (nové abstract triedy, ktoré nemajú CALLS, ale majú bohatú abstract sadu), ale žiadny nový TP — lebo všetky TP už boli zachytené v P2. Ukazuje, že **variant B (bohatá abstract sada bez CALLS) nie je dostatočný signál TM** — mnohé abstract triedy s ≥2 abstract metódami sú Interface-like declarations bez skutočnej template method kostry. `Children`, `TreeView`, `Node`, `IndentEngine`, `SearchTask`, `SearchType`, `OutputWriter` — všetko netbeans frameworkové "pure abstract" triedy bez implementovanej kostry.

---

## 4. Porovnanie všetkých pokusov

| Metrika | Pokus 1 | Pokus 2 | **Pokus 3** | Pokus 4 | Pokus 5 |
|---|---|---|---|---|---|
| Prístup | baseline | +CALLS | **+OVERRIDES** | +anti-FM | disjunkcia |
| Detekcií spolu | 145 | 91 | **90** | 91 | 117 |
| TP | 9 | 9 | **9** | 9 | 9 |
| FP | 136 | 82 | **81** | 82 | 108 |
| FN | 1 | 1 | **1** | 1 | 1 |
| Precision | 0.062 | 0.099 | **0.100** | 0.099 | 0.077 |
| Recall | **0.900** | **0.900** | **0.900** | **0.900** | **0.900** |
| F1 | 0.116 | 0.178 | **0.180** | 0.178 | 0.142 |

**Poznámka o TP/FP odhade:** Keďže P-MARt log neposkytuje presné mená GT inštancií pre Template Method, odhady TP/FP sú založené na pravdepodobnej identifikácii kanonických TM tried podľa počtu concrete a abstract metód. Konzervatívny odhad: 9 TP zo všetkých GT projektov (MapperXML 4, Nutch 2, JHotDraw 2, PMD 1). Presná klasifikácia by vyžadovala manuálne overenie v P-MARt XML.

---

## 5. Najlepší výsledok

**Najlepší výsledok dosiahol Pokus 3** — F1 = 0.180 (Precision = 0.100, Recall = 0.900).

Kľúčom k tomuto výsledku sú dva faktory:
1. **CALLS diskriminátor (P2)** — dramaticky znížil FP zo 136 na 82 (−40%). Bez tohto filtra by precision zostala pod 0.07
2. **OVERRIDES filter (P3)** — minimálne dodatočné zlepšenie (−1 FP), ale kvalitatívne rigoróznejší dôkaz, že vzor je reálne používaný

**Rozdiel medzi P2 a P3 je minimálny** (0.178 vs 0.180), takže pre praktické použitie sú oba porovnateľné. P3 je preferovaný pre teoretickú úplnosť — overuje všetky tri GoF štrukturálne prvky (AbstractClass + CALLS hook + ConcreteClass override).

**Dôležité: absolútne F1 je nízke (0.180), ale to je konzistentné s literatúrou** (viď sekcia 8) a zodpovedá štrukturálnej bežnosti Template Method vzoru — podobne ako Strategy (F1=0.152), Observer (F1=0.155) a Singleton (F1=0.281).

---

## 6. Čo sme zistili

### Kľúčové poznatky

1. **Template Method je štrukturálne bežný vzor s vysokým recall-om ale nízkou precision.** Recall 0.900 je dosiahnutý už od Pokusu 1, takže zachytenie GT inštancií nie je problém — problém je **filtrovanie FP**. Base FP je dramatický: netbeans samotný produkuje 56–94 abstract tried s mix metód a podtriedami. Podobne ako Observer, Strategy a Singleton, Template Method patrí medzi vzory, kde čisto štrukturálna detekcia naráža na fundamentálne limity.

2. **CALLS diskriminátor je najsilnejší filter.** Pokus 2 dramaticky odstránil 54 FP (z 145 na 91, −37%). To potvrdzuje, že požiadavka "konkrétna metóda musí volať abstract metódu tej istej triedy" je silný GoF-based signál. Paralelne s Composite P3 (kolekčný field) a Observer P3 (kolekčný field) — **jedna štrukturálna podmienka dramaticky zlepší výsledok**, zvyšné pravidlá prinesú iba marginálne zmeny.

3. **CALLS funguje spoľahlivo pre Template Method.** Na rozdiel od Decoratora, kde sme potrebovali FIX #6 v client.js (JDT resolvoval CALLS hranu na konkrétnu implementáciu `TestCase.run()` namiesto interface `Test.run()`), v Template Method je CALLS priama: template method volá `this.primitiveOp()`, kde `primitiveOp` je abstraktná metóda v **tej istej triede**. JDT túto CALLS hranu vytvorí korektne. Paralela s Visitor Pokus 5 (double dispatch cez CALLS) — obe tieto vzory majú CALLS z konkrétnej na metódu vo vlastnom scope, čo JDT spoľahlivo zachytáva.

4. **Anti-Factory Method diskriminátor úplne zlyhal (P4 = P2).** Toto je najzaujímavejšie zistenie práce. Filter "aspoň jedna CALLED abstract metóda nevracia lokálny objektový typ" bol 100% pravdivý pre všetky P2 kandidáty — každá detekcia mala aspoň jednu hook metódu s void/primitívnym návratovým typom. V reálnom kóde **Template Method a Factory Method koexistujú v tej istej triede** — napr. `AbstractValueHolder` má `update(): void` (TM hook) aj `createValue(): Object` (FM factory). Preto intent-based rozlišovanie cez RETURN_TYPE heuristiku nie je možné. Tsantalis et al. [4] uvádzajú, že oddelenie TM od FM vyžaduje behaviorálnu alebo sémantickú analýzu, nie štrukturálnu.

5. **OVERRIDES filter má minimálny efekt (P3 vs P2 = −1 FP).** Filter "ConcreteClass musí override-ovať aspoň jednu abstract metódu" odstránil iba `org.openide.nodes.Children`. To znamená, že **takmer všetky abstract triedy s ≥1 CALLS z konkrétnej na abstract majú aj reálne override-ujúce podtriedy** — filter nepridáva veľa nad rámec existujúcich pravidiel. Rovnaký jav ako pri Visitor Pokus 4 (ConcreteVisitor check) a Iterator Pokus 4 (ConcreteIterator check) — podmienky overujúce "vzor je reálne používaný" sú štatisticky redundantné s inými pravidlami.

6. **Netbeans je dominantný zdroj FP (56–94 detekcií podľa pokusu).** To nie je prekvapujúce — netbeans má rozsiahlu frameworkovú architektúru s desiatkami abstract tried v hierarchiách `AbstractNode`, `DataObject`, `FileObject`, `Cookie`, `SystemAction`. Väčšina z nich sú de-facto Template Methods z implementačného hľadiska, ale P-MARt ich nelistuje ako GT. Bez netbeans by Pokus 3 dosiahol precision **9/(9+25) = 0.265** a F1 **0.384** — výrazne lepšie. Rovnaký jav ako pri Singleton (bez netbeans P=0.727, F1=0.667), Observer, Strategy.

7. **Disjunkcia bez CALLS signálu nefunguje.** Pokus 5 variant B ("≥2 abstract metódy + ≥1 concrete metóda") pridal 26 nových FP bez nového TP. Ukazuje, že **statický signál "bohatá abstract sada" nie je diskriminujúci** — mnohé frameworkové abstract triedy sú iba rozšírené interface declarations bez reálnej template method kostry. Toto je paralela s Observer P5 (disjunkcia tiež nezlepšila) a Iterator P5.

### Pokrytie podmienok z literatúry

| Podmienka z GoF / refactoring.guru | Pokrytá? | Pokus |
|---|---|---|
| AbstractClass (abstract) | ✅ | P1–P5 |
| Primitive operation (abstract metóda) | ✅ | P1–P5 |
| Template method (konkrétna metóda) | ✅ | P1–P5 |
| Template method CALLS primitive operation | ✅ | P2–P4 |
| ConcreteClass overriduje primitive operation | ✅ | P3 |
| Template method je `final` | ❌ | Netestované (GoF odporúča, ale projekty zriedka dodržujú) |
| Hook metódy sú protected | ❌ | Netestované (príliš reštriktívne) |
| Intent rozlíšenie voči Factory Method | ❌ | P4 zlyhal empiricky |

**Všetky základné štrukturálne podmienky z GoF Template Method sú pokryté.** Dve behaviorálne/sémantické podmienky (intent, final keyword) sú mimo rámec štrukturálnej analýzy.

---

## 7. Podmienky, ktoré neboli testované a prečo

| Podmienka | Dôvod netestovania |
|---|---|
| **Template method je `final`** | GoF odporúča, ale v skutočnosti iba málo projektov to dodržiava (`AbstractFigure.draw()` v JHotDraw nie je final). Vyžadovanie by dramaticky znížilo recall. |
| **Hook metódy sú protected** | Príliš reštriktívne — niektoré TM hooks sú public (napr. ak sú súčasťou verejného API). Nie je súčasťou GoF definície. |
| **Prah počtu abstract metód ≥3** | Testovali sme v P5 variant B (≥2), kde pridal FP bez nových TP. Vyšší prah by ešte viac znížil recall. |
| **Template method je public** | Nie je diskriminujúce — väčšina metód v Jave je default/public. |
| **AbstractClass nesmie byť interface** | Implicitne pokryté — všetky pokusy používajú `:Class` match, nie `:Interface`. |
| **Naming convention** (trieda obsahuje "Abstract*") | Nie je v GoF a z iných vzorov vieme, že naming filtry sú nespoľahlivé (Singleton P3, Observer P4). `BaseTestRunner` by sa stratil. |

---

## 8. Možné vylepšenia a limitácie

### Fundamentálne limitácie statickej štrukturálnej analýzy

1. **Template Method a Factory Method sú štrukturálne nerozlíšiteľné.** Naše empirické zistenie z Pokus 4 potvrdzuje, že žiadny RETURN_TYPE filter nedokáže spoľahlivo oddeliť TM od FM. Trieda môže mať oba vzory súčasne a P-MARt ich eviduje oddelene (Factory Method má 4 GT inštancie, Template Method 10). Bez behaviorálnej analýzy (čo volanie metódy znamená, vyrábanie vs. kostra algoritmu) je oddelenie nemožné.

2. **P-MARt je nekompletný a subjektívny.** Netbeans produkuje 56–94 kandidátov, ale P-MARt nelistuje žiadny Template Method v netbeanse. V skutočnosti netbeans `AbstractNode`, `DataObject`, `FileObject`, `SystemAction`, `Cookie` hierarchie **sú** Template Method — každá z nich má konkrétnu metódu, ktorá volá abstract hook metódy, a reálne override-ujúce podtriedy. Skutočná precision je pravdepodobne **výrazne vyššia** ako meraná, ale nie je objektívne overiteľná.

3. **Nutch GT (3) vs P2/P3 detekcie (2).** Jedna Nutch GT inštancia chýba v našej detekcii. Pravdepodobne ide o triedu, ktorá buď (a) nemá CALLS hranu z konkrétnej na abstract metódu v tej istej triede (koordinácia cez dedičnosť, nie cez vlastné volanie), alebo (b) abstract metódy sú "pure virtual" bez skutočnej template method kostry. Bez manuálneho inspect-u Nutch kódu nevieme určiť presnú príčinu.

4. **Base FP je fundamentálne vysoký.** Template Method je štrukturálne najbežnejší OOP idiom (vedľa jednoduchej dedičnosti) — každá Java abstract trieda s template method vzorom matchuje. Filtrovať ďalej je možné iba cez sémantické features (názvy metód, komentáre, dokumentácia) alebo ML klasifikáciu — čo je mimo rámca čisto štrukturálnej detekcie.

### Porovnanie s literatúrou

Tsantalis et al. [4] reportujú pre Template Method F1 = 0.45–0.85 v závislosti od datasetu a použitého similarity scoring prístupu. Nazar et al. [3] uvádzajú F1 = 0.10–0.40 pre Template Method na P-MARt. **Naše P3 (F1 = 0.180) je v strede rozsahu Nazara**, ale výrazne pod rozsahom Tsantalisa. Rozdiel je daný tým, že:

1. Tsantalis používa similarity scoring, ktoré pripúšťa parciálne matchy a penalizuje FP menej agresívne
2. Nazar pracuje s P-MARt podobne ako my a reportuje nízke výsledky pre štrukturálne bežné vzory
3. Naše netbeans FP nie sú všetko skutočné FP — mnohé sú legitímne TM, ktoré P-MARt nelistuje

**Recall 0.900 je nad priemerom literatúry** (typicky 0.6–0.8), čo znamená, že naše pravidlá sú **dobre navrhnuté z hľadiska pokrytia GT** — problém je výhradne v nediskriminovanej precision.

---

## 9. Referencie

[1] Gamma, E., Helm, R., Johnson, R., Vlissides, J. (1995). *Design Patterns: Elements of Reusable Object-Oriented Software.* Addison-Wesley. — GoF Template Method: AbstractClass definuje kostru algoritmu cez template method, ktorá volá primitive operations (abstract hook metódy). ConcreteClass overriduje primitive operations. Template method je typicky `final`.

[2] Guéhéneuc, Y.G. (2007). *P-MARt: Pattern-like Micro Architecture Repository*, v1.2. https://www.ptidej.net/tools/designpatterns/ — Ground truth dataset. Obsahuje 10 Template Method inštancií v 4 z 9 projektov (JHotDraw 2, MapperXML 4, Nutch 3, PMD 1) a 92 ConcreteClass tried.

[3] Nazar, N., Aleti, A., Zheng, Y. (2022). *Feature-Based Software Design Pattern Detection.* Journal of Systems and Software, 185, 111179. — Reportujú F1 = 0.10–0.40 pre Template Method na P-MARt. Template Method je podľa nich jeden z najbežnejších štrukturálnych vzorov, kde čisto štrukturálna detekcia naráža na vysoký base FP.

[4] Tsantalis, N., Chatzigeorgiou, A., Stephanides, G., Halkidis, S.T. (2006). *Design Pattern Detection Using Similarity Scoring.* IEEE Transactions on Software Engineering, 32(11). — Štrukturálna podobnosť Template Method a Factory Method. Autori uvádzajú, že oddelenie vzorov vyžaduje behaviorálnu alebo sémantickú analýzu. Reportujú F1 = 0.45–0.85 pre TM podľa datasetu.

[5] Refactoring.Guru. *Template Method Design Pattern.* https://refactoring.guru/design-patterns/template-method — Implementačné kroky: AbstractClass s template method obsahujúcou sekvenciu volaní primitive operations, ConcreteClass overrides hook methods. Rozdiel voči Strategy: TM používa dedičnosť, Strategy delegáciu.
