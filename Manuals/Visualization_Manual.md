# Vizualizácia GoF vzorov v Neo4j Sandbox + Bloom

Postup pre vizualizáciu Singleton, Decorator, Iterator a Visitor vzorov detekovaných v JHotDraw / P-MARt grafoch. Každý vzor má vlastný modul, ktorý používa zdieľanú infraštruktúru zo Sekcie A.

---

## Obsah

### Sekcia A — Spoločný setup (raz pre všetky vzory)
- A1. [Vytvorenie Sandboxu](#a1-vytvorenie-sandboxu)
- A2. [Nahratie graph.json na GitHub](#a2-nahratie-graphjson-na-github)
- A3. [Import grafu](#a3-import-grafu)
- A4. [Spoločné source code references](#a4-spoločné-source-code-references)
- A5. [Spustenie Bloomu a Perspective basics](#a5-spustenie-bloomu-a-perspective-basics)

### Sekcia B — Pattern moduly (vyber si podľa toho, ktorý vzor vizualizuješ)
- B1. [Singleton](#b1-singleton)
- B2. [Decorator](#b2-decorator)
- B3. [Iterator](#b3-iterator)
- B4. [Visitor](#b4-visitor)

### Sekcia C — Spoločné pre všetky moduly
- C1. [Štýlovanie a export v Bloome](#c1-štýlovanie-a-export-v-bloome)
- C2. [Argumenty pre obhajobu BP](#c2-argumenty-pre-obhajobu-bp)
- C3. [Riešenie problémov](#c3-riešenie-problémov)

---

# Sekcia A — Spoločný setup

## A1. Vytvorenie Sandboxu

### A1.1 Registrácia

1. https://sandbox.neo4j.com → **Sign up** (email / GitHub / Google)
2. Potvrď email

### A1.2 Vytvorenie projektu

1. **+ New Project** → **Blank Sandbox**
2. Počkaj 30–60 sekúnd
3. **Poznač si heslo** (vygenerované v dashboarde)

### A1.3 Over APOC

1. Pri projekte **Launch** → **Open with Neo4j Browser**
2. Spusti:
   ```cypher
   CALL apoc.help("load.json") YIELD name RETURN name
   ```
3. Musí vrátiť `apoc.load.json` a ďalšie procedúry

Ak chýba APOC → zmaž sandbox, vytvor nový so šablónou **Graph Data Science**.

---

## A2. Nahratie graph.json na GitHub

Sandbox nemá lokálny filesystem → potrebujeme verejnú URL.

### A2.1 GitHub repo

1. https://github.com → **New repository**
2. Name: `bp-graphs` (alebo čokoľvek)
3. **Public** ← nutné
4. **Create repository**

### A2.2 Upload

1. **Add file → Upload files**
2. Drag-and-drop tvoj graf JSON (napr. `jhotdraw.json`)
3. **Commit changes**

### A2.3 Raw URL

1. Klikni na JSON súbor v repo
2. **Raw** tlačidlo
3. Skopíruj URL:
   ```
   https://raw.githubusercontent.com/<tvoje-meno>/bp-graphs/main/<súbor>.json
   ```
4. **Ulož si ju** — budeš ju používať opakovane

---

## A3. Import grafu

**Vo všetkých queries nahraď `<URL>`** tvojou raw URL z A2.3.

### A3.1 Reset

```cypher
MATCH (n) DETACH DELETE n;
```

### A3.2 Constraint

```cypher
CREATE CONSTRAINT entity_id_unique IF NOT EXISTS 
FOR (e:Entity) REQUIRE e.id IS UNIQUE;
```

### A3.3 Test URL

```cypher
CALL apoc.load.json("<URL>") YIELD value
RETURN value.projectRoot AS project,
       size(value.nodes) AS nodeCount, 
       size(value.edges) AS edgeCount;
```

### A3.4 Import uzlov

```cypher
CALL apoc.load.json("<URL>") YIELD value
UNWIND coalesce(value.nodes, []) AS nd
WITH nd, 
     CASE 
       WHEN nd.labels IS NOT NULL THEN nd.labels 
       WHEN nd.label IS NOT NULL THEN [nd.label] 
       ELSE [] 
     END AS lbs
MERGE (e:Entity {id: nd.id})
SET e.propsJson = apoc.convert.toJson(nd),
    e.name = coalesce(toString(nd.name), e.name),
    e.fqn = coalesce(toString(nd.fqn), e.fqn),
    e.containerFqn = coalesce(toString(nd.containerFqn), e.containerFqn),
    e.uri = coalesce(toString(nd.uri), e.uri),
    e.sig = coalesce(toString(nd.sig), e.sig),
    e.isStatic = nd.isStatic,
    e.isAbstract = nd.isAbstract,
    e.isPrivate = nd.isPrivate,
    e.isFinal = nd.isFinal,
    e.returnType = coalesce(toString(nd.returnType), e.returnType)
WITH e, lbs
CALL apoc.create.addLabels(e, [l IN lbs WHERE l IS NOT NULL | toString(l)]) 
YIELD node
RETURN count(*) AS nodesImported;
```

### A3.5 Import hrán (batch — KRITICKÉ!)

```cypher
CALL apoc.periodic.iterate(
  'CALL apoc.load.json("<URL>") YIELD value 
   UNWIND value.edges AS ed 
   RETURN ed',
  'MATCH (s:Entity {id: ed.from})
   MATCH (t:Entity {id: ed.to})
   CALL apoc.create.relationship(s, ed.type, {propsJson: apoc.convert.toJson(ed)}, t) 
   YIELD rel
   RETURN rel',
  {batchSize: 500, parallel: false}
) YIELD batches, total, errorMessages
RETURN batches, total, errorMessages;
```

Trvá 1–3 minúty. Očakávané: `errorMessages: {}`.

### A3.6 Overenie

```cypher
MATCH (n) RETURN count(n) AS nodes;
MATCH ()-[r]->() RETURN count(r) AS edges;
```

---

## A4. Spoločné source code references

**Toto urob raz, ešte pred prvou pattern detekciou.** Nastaví univerzálne `sourceUri` a `sourceLine` properties na **všetky** uzly v grafe, ktoré majú range info v `propsJson`. Pattern moduly potom túto property len využívajú.

### A4.1 Reset polo-nastavených properties (idempotentnosť)

```cypher
MATCH (n) WHERE n.sourceLine IS NOT NULL 
            OR n.sourceUri IS NOT NULL 
            OR n.sourceRef IS NOT NULL
            OR n.editorUri IS NOT NULL
REMOVE n.sourceLine, n.sourceUri, n.sourceRef, n.editorUri;
```

### A4.2 Globálna extrakcia URI a riadku

URI je zabudovaná v `id` property za znakom `@` (napr. `METHOD:CH.ifa.draw.util.Clipboard::Clipboard()@file:///C:/...`). Riadok je v `propsJson.range.start.line` (0-based).

```cypher
CALL apoc.periodic.iterate(
  'MATCH (n) 
   WHERE n.propsJson IS NOT NULL AND n.id CONTAINS "@"
   RETURN n',
  'WITH n, apoc.convert.fromJsonMap(n.propsJson) AS props
   WHERE props.range IS NOT NULL
   WITH n, props, split(n.id, "@")[-1] AS extractedUri
   SET n.sourceLine = props.range.start.line + 1,
       n.sourceUri = extractedUri,
       n.sourceRef = split(extractedUri, "/")[-1] + ":" + toString(props.range.start.line + 1),
       n.editorUri = "vscode://file/" + 
                     replace(extractedUri, "file:///", "") + 
                     ":" + toString(props.range.start.line + 1)',
  {batchSize: 1000, parallel: false}
) YIELD batches, total, errorMessages
RETURN batches, total, errorMessages;
```

> **Pozn:** Robíme to cez `apoc.periodic.iterate` lebo na veľkých grafoch (napr. PMD má desiatky tisíc uzlov) jedna transakcia padne na memory limit.

### A4.3 Overenie

```cypher
MATCH (n) WHERE n.sourceRef IS NOT NULL
RETURN count(n) AS nodes_with_ref;
```

Mal by si dostať veľké číslo (tisíce). Skontroluj sample:

```cypher
MATCH (n) WHERE n.sourceRef IS NOT NULL
RETURN n.name, n.sourceRef, n.sourceUri
LIMIT 5;
```

---

## A5. Spustenie Bloomu a Perspective basics

### A5.1 Otvorenie Bloomu

**A) Sandbox dashboard:** Launch → Open with Bloom / Explore

**B) Priamo cez URL:** V Browser tabe URL typu `https://xxx.neo4jsandbox.com/browser/` zmeň `/browser/` na `/bloom/`.

Použi rovnaké heslo ako v Browseri.

### A5.2 Spoločná Perspective

**Vytvor jednu Perspective pre všetky vzory.** Klikni v pravo hore na **Create**→ Blank Perspective

Vstúp do vytvorenej perspective ľavým klikom.

Klik **Add category**, vyber label z dropdown:

| Kategória | Z čoho pochádza |
|---|---|
| `Entity` | default base label |
| `Note` | vizuálne anotácie (vytvárané v moduloch) |
| `Class` | trieda |
| `Interface` | rozhranie |
| `Type` | sémantický typ z LSP |
| `Field` | pole triedy |
| `Method` | metóda |
| `Constructor` | konštruktor |
| `Singleton` | (pridáš až po B1 detekcii) |
| `Decorator` | (pridáš až po B2 detekcii) |
| `Iterator` | (pridáš až po B3 detekcii) |
| `Visitor` | (pridáš až po B4 detekcii) |
| `Element` | (pridáš až po B4 detekcii) |

**Note Exclude properties** — odznač Exclude pri:
- `text` (caption)
- `role` (klasifikácia)
- `sourceUri` (klikateľný link na súbor)
- `sourceLine` (číslo riadku)
- `editorUri` (vscode:// link)
- `sourceRef` (skrátená referencia ako `Clipboard.java:28`)

V tabe **Relationships** pridaj `HAS_NOTE` (pre prepojenie pattern uzlov s anotáciami).

### A5.3 Refresh konvencia

Ak po vytvorení perspective robíš detekciu pattern v Browseri, klikni **🔄 Refresh** ikonu pri názve perspective v Bloome — schema cache sa znovu načíta.

Následne vľavo hore stačí vyhladať dané vzory, ktoré sa importujú v sekcii B

Navigácia

---

# Sekcia B — Pattern moduly

Každý modul je nezávislý. Predpokladá, že si už urobil A1–A5. Postup je rovnaký pre všetky vzory:

1. **Detekcia** — pridanie pattern label na pattern uzly
2. **Metadata** — pridanie `patternRole` na role-relevantné uzly
3. **Notes** — vytvorenie vizuálnych anotácií s popismi rolí + automatické pridanie source referencií
4. **Bloom** — pridanie pattern kategórie + Search Phrase

---

## B1. Singleton

### B1.1 Definícia rolí (refactoring.guru)

**Singleton** je vzor, ktorý zabezpečuje, že trieda má **iba jednu inštanciu**, a poskytuje k nej globálny prístupový bod. Štrukturálne ho tvoria 3 prvky:

| Rola | Popis (refactoring.guru) |
|---|---|
| **Singleton class** | Trieda, ktorá deklaruje statickú metódu `getInstance()` vracajúcu vlastnú inštanciu. Kontroluje vytvorenie jedinej inštancie. |
| **Static self-typed field** | Privátny statický field vlastného typu, ktorý drží jedinú inštanciu. Môže byť inicializovaný eagerly (pri load triedy) alebo lazily (v getInstance). |
| **Static accessor (getInstance)** | Verejná statická metóda bez parametrov, ktorá vracia jedinú inštanciu. Pri prvom volaní inštanciu vytvorí, pri ďalších len vracia. |
| **Konštruktor (Private/Public)** | Mal by byť privátny — zabraňuje vonkajšiemu vytváraniu inštancií cez `new`. Public konštruktor znamená, že vzor nie je striktne enforce-ovaný. |

### B1.2 Detekcia

```cypher
MATCH (classNode:Class)
MATCH (classType:Type {fqn: classNode.fqn})
MATCH (classType)-[:HAS_FIELD]->(instanceField:Field)-[:FIELD_TYPE]->(classType)
WHERE instanceField.isStatic = true
   OR EXISTS {
        MATCH (instanceField)-[:HAS_MODIFIER]->(:Modifier {name:"static"})
      }
MATCH (classType)-[:DECLARES]->(accessorMethod:Method)
WHERE (accessorMethod.isStatic = true
   OR EXISTS {
        MATCH (accessorMethod)-[:HAS_MODIFIER]->(:Modifier {name:"static"})
      })
  AND NOT EXISTS {
        MATCH (accessorMethod)-[:HAS_PARAMETER]->()
      }
WITH classNode, classType, instanceField, accessorMethod
WHERE EXISTS { MATCH (accessorMethod)-[:RETURN_TYPE]->(classType) }
   OR accessorMethod.returnType = classNode.name
   OR accessorMethod.returnType STARTS WITH (classNode.name + "<")
SET classType:Singleton
SET classNode:Singleton
RETURN classNode.fqn AS detekovany_singleton
ORDER BY detekovany_singleton;
```

**Pre JHotDraw očakávané:** `CH.ifa.draw.standard.Clipboard`, `CH.ifa.draw.util.Iconkit`.

### B1.3 Metadata (patternRole)

```cypher
// 1. Singleton trieda
MATCH (s:Singleton) WHERE s:Class OR s:Type
SET s.patternRole = "Singleton";

// 2. Static self-typed field
MATCH (s:Singleton) WHERE s:Class
MATCH (t:Type {fqn: s.fqn})-[:HAS_FIELD]->(f:Field)-[:FIELD_TYPE]->(t)
WHERE f.isStatic = true 
   OR EXISTS { MATCH (f)-[:HAS_MODIFIER]->(:Modifier {name:"static"}) }
SET f.patternRole = "Static Self-Typed Field";

// 3. Static accessor
MATCH (s:Singleton) WHERE s:Class
MATCH (t:Type {fqn: s.fqn})-[:DECLARES]->(m:Method)-[:RETURN_TYPE]->(t)
WHERE (m.isStatic = true 
       OR EXISTS { MATCH (m)-[:HAS_MODIFIER]->(:Modifier {name:"static"}) })
  AND NOT EXISTS { MATCH (m)-[:HAS_PARAMETER]->() }
SET m.patternRole = "Static Accessor";

// 4. Constructor (Private/Public)
MATCH (s:Singleton) WHERE s:Class
MATCH (t:Type {fqn: s.fqn})-[:DECLARES]->(ctor:Constructor)
SET ctor.patternRole = CASE
  WHEN ctor.isPrivate = true
       OR EXISTS { MATCH (ctor)-[:HAS_MODIFIER]->(:Modifier {name:"private"}) }
  THEN "Private Constructor"
  ELSE "Public Constructor"
END;
```

### B1.4 Notes

```cypher
// Reset Singleton notes
MATCH (n:Note {patternKind: "Singleton"}) DETACH DELETE n;

// 1. Singleton trieda — pripojené na Class aj Type
MATCH (c:Class:Singleton)
MATCH (t:Type:Singleton {fqn: c.fqn})
CREATE (note:Note {
  text: "Singleton trieda — jediná inštancia s globálnym prístupovým bodom (" + coalesce(c.sourceRef, "?") + ")",
  role: "Singleton",
  patternKind: "Singleton",
  sourceUri: c.sourceUri,
  sourceLine: c.sourceLine,
  editorUri: c.editorUri
})
CREATE (c)-[:HAS_NOTE]->(note)
CREATE (t)-[:HAS_NOTE]->(note);

// 2. Static field
MATCH (s:Singleton) WHERE s:Class
MATCH (t:Type {fqn: s.fqn})-[:HAS_FIELD]->(f:Field)-[:FIELD_TYPE]->(t)
WHERE f.isStatic = true 
   OR EXISTS { MATCH (f)-[:HAS_MODIFIER]->(:Modifier {name:"static"}) }
CREATE (note:Note {
  text: "Statický field vlastného typu — drží jedinú inštanciu (" + coalesce(f.sourceRef, "?") + ")",
  role: "Static Self-Typed Field",
  patternKind: "Singleton",
  sourceUri: f.sourceUri,
  sourceLine: f.sourceLine,
  editorUri: f.editorUri
})
CREATE (f)-[:HAS_NOTE]->(note);

// 3. Static accessor
MATCH (s:Singleton) WHERE s:Class
MATCH (t:Type {fqn: s.fqn})-[:DECLARES]->(m:Method)-[:RETURN_TYPE]->(t)
WHERE (m.isStatic = true 
       OR EXISTS { MATCH (m)-[:HAS_MODIFIER]->(:Modifier {name:"static"}) })
  AND NOT EXISTS { MATCH (m)-[:HAS_PARAMETER]->() }
CREATE (note:Note {
  text: "Statický accessor bez parametrov — sprístupňuje jedinú inštanciu (" + coalesce(m.sourceRef, "?") + ")",
  role: "Static Accessor",
  patternKind: "Singleton",
  sourceUri: m.sourceUri,
  sourceLine: m.sourceLine,
  editorUri: m.editorUri
})
CREATE (m)-[:HAS_NOTE]->(note);

// 4. Constructor (podmienené Private/Public)
MATCH (s:Singleton) WHERE s:Class
MATCH (t:Type {fqn: s.fqn})-[:DECLARES]->(ctor:Constructor)
WITH ctor,
     CASE
       WHEN ctor.isPrivate = true
            OR EXISTS { MATCH (ctor)-[:HAS_MODIFIER]->(:Modifier {name:"private"}) }
       THEN {
         text: "Privátny konštruktor — zabraňuje vonkajšiemu vytváraniu inštancií (" + coalesce(ctor.sourceRef, "?") + ")",
         role: "Private Constructor"
       }
       ELSE {
         text: "Verejný konštruktor — Singleton nie je striktne enforce-ovaný (" + coalesce(ctor.sourceRef, "?") + ")",
         role: "Public Constructor"
       }
     END AS note_data
CREATE (note:Note {
  text: note_data.text,
  role: note_data.role,
  patternKind: "Singleton",
  sourceUri: ctor.sourceUri,
  sourceLine: ctor.sourceLine,
  editorUri: ctor.editorUri
})
CREATE (ctor)-[:HAS_NOTE]->(note);
```

### B1.5 Overenie

```cypher
MATCH (source)-[:HAS_NOTE]->(note:Note {patternKind: "Singleton"})
RETURN coalesce(source.name, source.fqn) AS source,
       note.text AS note_text
ORDER BY source;
```

Pre JHotDraw musí vrátiť **10 riadkov** (8 unique Notes — 2 Singleton notes sa prepájajú na Class aj Type).

### B1.6 Bloom Search Phrase

V Bloome klik vľavo hore na knižku: Perspective designer→ **Saved Cypher** tab → **+ Add**:

- **Phrase:** `Singleton Pattern`
- **Cypher:**

```cypher
MATCH (s:Singleton) WHERE s:Class
MATCH (t:Type {fqn: s.fqn})
MATCH pathHF = (t)-[:HAS_FIELD]->(f:Field)-[:FIELD_TYPE]->(t)
WHERE f.isStatic = true 
   OR EXISTS { MATCH (f)-[:HAS_MODIFIER]->(:Modifier {name:"static"}) }
MATCH pathD = (t)-[:DECLARES]->(m:Method)-[:RETURN_TYPE]->(t)
WHERE (m.isStatic = true 
       OR EXISTS { MATCH (m)-[:HAS_MODIFIER]->(:Modifier {name:"static"}) })
  AND NOT EXISTS { MATCH (m)-[:HAS_PARAMETER]->() }
OPTIONAL MATCH pathC = (t)-[:DECLARES]->(ctor:Constructor)
OPTIONAL MATCH pathNS = (s)-[:HAS_NOTE]->(ns:Note)
OPTIONAL MATCH pathNF = (f)-[:HAS_NOTE]->(nf:Note)
OPTIONAL MATCH pathNM = (m)-[:HAS_NOTE]->(nm:Note)
OPTIONAL MATCH pathNC = (ctor)-[:HAS_NOTE]->(nc:Note)
RETURN s, t, f, m, ctor, ns, nf, nm, nc, 
       pathHF, pathD, pathC, pathNS, pathNF, pathNM, pathNC;
```

### B1.7 Bloom konfigurácia

| Label | Farba | Caption | Size |
|---|---|---|---|
| `Singleton` | 🟣 fialová (#9C27B0) | `name` | 70 |
| `Field` | 🟢 zelená (#4CAF50) | `name` | 45 |
| `Method` | 🔵 modrá (#2196F3) | `name` | 45 |
| `Constructor` | 🔴 ružová (#E91E63) | `name` | 45 |


---

## B2. Decorator

### B2.1 Definícia rolí (refactoring.guru)

**Decorator** je vzor, ktorý umožňuje pridávať správanie objektom dynamicky obalením do "wrapper" objektu. Štruktúra:

| Rola | Popis (refactoring.guru) |
|---|---|
| **Component** | Spoločné rozhranie pre konkrétne komponenty aj dekorátory. Definuje operácie, ktoré môžu byť dynamicky rozšírené. |
| **Concrete Component** | Základná implementácia Component interface — objekt, ktorý je dekorovaný. |
| **Base Decorator** | Trieda, ktorá implementuje Component a zároveň drží referenciu (field) na obalený Component. Deleguje volania na wrappovaný objekt. |
| **Constructor injection** | Base Decorator prijíma Component cez konštruktor — `Decorator(Component c)`. |
| **Method delegation** | Base Decorator preposiela volania metód Component interface na obalený objekt. |
| **Concrete Decorator** | Podtrieda Base Dekoratora, ktorá pridáva alebo modifikuje správanie pred/po delegácii. |

### B2.2 Detekcia

Pre JHotDraw a JUnit (P-MARt v1.2 GT). Najlepší pokus z Decorator správy (P2 — F1 = 1.000):

```cypher
CALL {
  // 1. Nájdi lokálny interface (component)
  MATCH (componentInterface:Interface)
  WHERE EXISTS { MATCH (componentInterface)-[:IN_FILE]->() }

  // 2. Nájdi všetky triedy implementujúce interface (priamo aj cez dedičnosť)
  OPTIONAL MATCH (directImpl:Class)-[:IMPLEMENTS]->(componentInterface)
  OPTIONAL MATCH (indirectImpl:Class)-[:EXTENDS*1..5]->(ancestor:Class)
                -[:IMPLEMENTS]->(componentInterface)
  WITH componentInterface,
       collect(DISTINCT directImpl) + collect(DISTINCT indirectImpl) AS allConformers

  // 3. Pre každého kandidáta na base decorator: musí mať field typu component interface
  UNWIND allConformers AS baseDecoratorClass
  WITH componentInterface, baseDecoratorClass
  WHERE baseDecoratorClass IS NOT NULL
  MATCH (baseDecoratorType:Type {fqn: baseDecoratorClass.fqn})
        -[:HAS_FIELD]->(componentField:Field)
        -[:FIELD_TYPE]->(componentType:Type)
  WHERE componentType.fqn = componentInterface.fqn

  // 4. Constructor injection — base decorator musí mať konštruktor
  //    s parametrom typu component interface
  WITH componentInterface, baseDecoratorClass, baseDecoratorType
  WHERE EXISTS {
    MATCH (baseDecoratorType)-[:DECLARES]->(ctor)
    WHERE ctor:Constructor
       OR (ctor:Method AND ctor.name STARTS WITH baseDecoratorClass.name + "(")
    MATCH (ctor)-[:HAS_PARAMETER]->(param)-[:PARAMETER_TYPE]->(paramType:Type)
    WHERE paramType.fqn = componentInterface.fqn
  }

  // 5. Spočítaj metódy na component interface
  WITH componentInterface, baseDecoratorClass, baseDecoratorType
  OPTIONAL MATCH (:Type {fqn: componentInterface.fqn})-[:DECLARES]->(ifaceMethod:Method)
  WITH componentInterface, baseDecoratorClass, baseDecoratorType,
       count(DISTINCT ifaceMethod) AS interfaceMethodCount
  WHERE interfaceMethodCount > 0

  // 6. Spočítaj delegujúce metódy
  MATCH (baseDecoratorType)-[:DECLARES]->(decoratorMethod:Method)
        -[:CALLS]->(calledMethod:Method)
  WHERE calledMethod.containerFqn = componentInterface.fqn
    AND coalesce(calledMethod.isSynthetic, false) = false
  WITH componentInterface, baseDecoratorClass, baseDecoratorType,
       count(DISTINCT decoratorMethod) AS delegatingMethods,
       interfaceMethodCount

  // 7. Proporcionálny prah
  WHERE delegatingMethods >= 2
    AND (toFloat(delegatingMethods) / toFloat(interfaceMethodCount)) >= 0.5

  // 8. Musí existovať aspoň jeden concrete decorator (podtrieda)
  MATCH (concreteDecoratorClass:Class)-[:EXTENDS]->(baseDecoratorClass)

  // 9. Musí existovať aspoň jeden concrete component (nie je dekorátor)
  WHERE EXISTS {
    MATCH (cc:Class)-[:IMPLEMENTS]->(componentInterface)
    WHERE cc.fqn <> baseDecoratorClass.fqn
      AND NOT EXISTS { MATCH (cc)-[:EXTENDS*]->(baseDecoratorClass) }
  }

  // 10. Označ všetky tri uzly správnymi labelmi
  WITH DISTINCT baseDecoratorClass, baseDecoratorType, componentInterface
  SET baseDecoratorClass:Decorator
  SET baseDecoratorType:Decorator
  SET componentInterface:Component

  RETURN DISTINCT baseDecoratorClass, componentInterface
}

RETURN DISTINCT
  baseDecoratorClass.fqn AS decorator,
  componentInterface.fqn AS component
ORDER BY decorator;
```

**Pre JHotDraw + JUnit P-MARt:** `DecoratorFigure` (Component=`Figure`), `TestDecorator` (Component=`Test`).

### B2.3 Metadata (patternRole)

```cypher
// 1. Component interface
MATCH (c:Component)
SET c.patternRole = "Component";

// 2. Base Decorator
MATCH (d:Decorator) WHERE d:Class OR d:Type
SET d.patternRole = "Base Decorator";

// 3. Wrapped Component field
MATCH (d:Decorator) WHERE d:Type
MATCH (c:Component)
MATCH (d)-[:HAS_FIELD]->(f:Field)-[:FIELD_TYPE]->(:Type {fqn: c.fqn})
SET f.patternRole = "Wrapped Component Reference";

// 4. Constructor injection — zosúladené s detekčným dotazom
MATCH (d:Decorator) WHERE d:Type
MATCH (c:Component)
MATCH (d)-[:DECLARES]->(ctor)
WHERE (ctor:Constructor OR (ctor:Method AND ctor.name STARTS WITH split(d.fqn, '.')[-1] + "("))
MATCH (ctor)-[:HAS_PARAMETER]->()-[:PARAMETER_TYPE]->(:Type {fqn: c.fqn})
SET ctor.patternRole = "Component Injection Constructor";

// 5. Concrete Decorators
MATCH (cd:Class)-[:EXTENDS]->(d:Class:Decorator)
SET cd.patternRole = "Concrete Decorator";

// 6. Concrete Components
MATCH (cc:Class)-[:IMPLEMENTS]->(c:Component)
WHERE NOT cc:Decorator
  AND NOT EXISTS { MATCH (cc)-[:EXTENDS*]->(:Decorator) }
SET cc.patternRole = "Concrete Component";
```

### B2.4 Notes

```cypher
// Reset Decorator notes
MATCH (n:Note {patternKind: "Decorator"}) DETACH DELETE n;

// 1. Component interface
MATCH (c:Component)
CREATE (note:Note {
  text: "Component — spoločné rozhranie pre obalovaný objekt aj dekorátory (" + coalesce(c.sourceRef, "?") + ")",
  role: "Component",
  patternKind: "Decorator",
  sourceUri: c.sourceUri,
  sourceLine: c.sourceLine,
  editorUri: c.editorUri
})
CREATE (c)-[:HAS_NOTE]->(note);

// 2. Base Decorator
MATCH (d:Class:Decorator)
MATCH (t:Type:Decorator {fqn: d.fqn})
CREATE (note:Note {
  text: "Base Decorator — obaľuje Component a deleguje volania (" + coalesce(d.sourceRef, "?") + ")",
  role: "Base Decorator",
  patternKind: "Decorator",
  sourceUri: d.sourceUri,
  sourceLine: d.sourceLine,
  editorUri: d.editorUri
})
CREATE (d)-[:HAS_NOTE]->(note)
CREATE (t)-[:HAS_NOTE]->(note);

// 3. Wrapped field
MATCH (f:Field {patternRole: "Wrapped Component Reference"})
CREATE (note:Note {
  text: "Wrapped reference — drží obalený Component objekt (" + coalesce(f.sourceRef, "?") + ")",
  role: "Wrapped Component Reference",
  patternKind: "Decorator",
  sourceUri: f.sourceUri,
  sourceLine: f.sourceLine,
  editorUri: f.editorUri
})
CREATE (f)-[:HAS_NOTE]->(note);

// 4. Injection constructor
MATCH (ctor:Constructor {patternRole: "Component Injection Constructor"})
CREATE (note:Note {
  text: "Component Injection — prijíma obaľovaný objekt cez konštruktor (" + coalesce(ctor.sourceRef, "?") + ")",
  role: "Component Injection Constructor",
  patternKind: "Decorator",
  sourceUri: ctor.sourceUri,
  sourceLine: ctor.sourceLine,
  editorUri: ctor.editorUri
})
CREATE (ctor)-[:HAS_NOTE]->(note);

// 5. Concrete Decorators
MATCH (cd:Class {patternRole: "Concrete Decorator"})
CREATE (note:Note {
  text: "Concrete Decorator — pridáva alebo modifikuje správanie pred/po delegácii (" + coalesce(cd.sourceRef, "?") + ")",
  role: "Concrete Decorator",
  patternKind: "Decorator",
  sourceUri: cd.sourceUri,
  sourceLine: cd.sourceLine,
  editorUri: cd.editorUri
})
CREATE (cd)-[:HAS_NOTE]->(note);

// 6. Concrete Components
MATCH (cc:Class {patternRole: "Concrete Component"})
CREATE (note:Note {
  text: "Concrete Component — základná implementácia, ktorá môže byť dekorovaná (" + coalesce(cc.sourceRef, "?") + ")",
  role: "Concrete Component",
  patternKind: "Decorator",
  sourceUri: cc.sourceUri,
  sourceLine: cc.sourceLine,
  editorUri: cc.editorUri
})
CREATE (cc)-[:HAS_NOTE]->(note);
```

### B2.5 Overenie

```cypher
MATCH (source)-[:HAS_NOTE]->(note:Note {patternKind: "Decorator"})
RETURN labels(source) AS labels,
       coalesce(source.name, source.fqn) AS source,
       note.role AS role,
       note.sourceRef AS ref
ORDER BY note.role, source;
```

### B2.6 Bloom Search Phrase

- **Phrase:** `Decorator Pattern`
- **Cypher:**

```cypher
MATCH (d:Decorator) WHERE d:Class
MATCH (dt:Type:Decorator {fqn: d.fqn})
MATCH (c:Component)
MATCH pathImpl = (d)-[:IMPLEMENTS]->(c)
MATCH pathField = (dt)-[:HAS_FIELD]->(f:Field)-[:FIELD_TYPE]->(:Type {fqn: c.fqn})
OPTIONAL MATCH pathCtor = (dt)-[:DECLARES]->(ctor:Constructor)
                                -[:HAS_PARAMETER]->()-[:PARAMETER_TYPE]->(:Type {fqn: c.fqn})
OPTIONAL MATCH pathCD = (cd:Class)-[:EXTENDS]->(d)
OPTIONAL MATCH pathCC = (cc:Class)-[:IMPLEMENTS]->(c)
  WHERE cc.fqn <> d.fqn AND NOT cc:Decorator
OPTIONAL MATCH pathND = (d)-[:HAS_NOTE]->(nd:Note)
OPTIONAL MATCH pathNC = (c)-[:HAS_NOTE]->(nc:Note)
OPTIONAL MATCH pathNF = (f)-[:HAS_NOTE]->(nf:Note)
OPTIONAL MATCH pathNCtor = (ctor)-[:HAS_NOTE]->(nctor:Note)
OPTIONAL MATCH pathNCd = (cd)-[:HAS_NOTE]->(ncd:Note)
OPTIONAL MATCH pathNCc = (cc)-[:HAS_NOTE]->(ncc:Note)
RETURN d, dt, c, f, ctor, cd, cc, nd, nc, nf, nctor, ncd, ncc,
       pathImpl, pathField, pathCtor, pathCD, pathCC,
       pathND, pathNC, pathNF, pathNCtor, pathNCd, pathNCc;
```

### B2.7 Bloom konfigurácia

| Label | Farba | Caption | Size |
|---|---|---|---|
| `Decorator` | 🟣 fialová (#9C27B0) | `name` | 70 |
| `Component` | 🟠 oranžová (#FF9800) | `name` | 60 |
| `Field` | 🟢 zelená (#4CAF50) | `name` | 45 |
| `Constructor` | 🔴 ružová (#E91E63) | `name` | 45 |
| `Class` (Concrete Decorator/Component) | 🔵 modrá (#2196F3) | `name` | 50 |

### B2.8 Obrázky pre BP

**Obrázok #1 — Čistá štruktúra Decorator:**
- Decorator (Base) ←IMPLEMENTS— Component
- Decorator —HAS_FIELD→ Wrapped field —FIELD_TYPE→ Component
- Decorator —DECLARES→ Constructor —HAS_PARAMETER→ ... —PARAMETER_TYPE→ Component
- Concrete Decorator —EXTENDS→ Decorator
- Concrete Component —IMPLEMENTS→ Component

**Obrázok #2 — Hierarchia Decorator:**
- Pravý klik Concrete Decorator → Expand → All — pridá ďalšie podtriedy ak existujú

---

## B3. Iterator

### B3.1 Definícia rolí (refactoring.guru)

**Iterator** je vzor, ktorý umožňuje prejsť cez prvky kolekcie bez odhalenia jej internej reprezentácie. Operácie iterácie sú extrahované do samostatného objektu (Iterator), ktorý si pamätá pozíciu a vie sa pohybovať ďalej. Štruktúra:

| Rola | Popis (refactoring.guru) |
|---|---|
| **Iterator** | Rozhranie deklarujúce metódy pre prechod kolekciou: `hasNext()` + `next()` (moderné API), alebo `hasMoreElements()` + `nextElement()` (Enumeration-style API z Java 1.0). |
| **Concrete Iterator** | Konkrétna implementácia Iterator-u, drží referenciu na Aggregate a stav iterácie (pozíciu). |
| **Aggregate** | Rozhranie alebo trieda, ktorá poskytuje factory metódu vracajúcu Iterator (`iterator()`, `createIterator()`, `elements()`). |
| **Concrete Aggregate** | Implementácia Aggregate-u, vytvára konkrétny ConcreteIterator pre svoju štruktúru. |

### B3.2 Detekcia

Najlepší pokus z Iterator správy (P2 — F1 = 0.615). Disjunkcia troch naming variantov pre rôzne éry Java API:

```cypher
MATCH (iteratorNode)
WHERE (iteratorNode:Interface
   OR (iteratorNode:Class AND iteratorNode.isAbstract = true))
  AND EXISTS { MATCH (iteratorNode)-[:IN_FILE]->() }
MATCH (iteratorType:Type {fqn: iteratorNode.fqn})
WITH iteratorNode, iteratorType
WHERE
  // Variant A: moderné Iterator API (Java 1.2+)
  (EXISTS {
      MATCH (iteratorType)-[:DECLARES]->(m1:Method)
      WHERE toLower(m1.name) STARTS WITH "hasnext"
   }
   AND EXISTS {
      MATCH (iteratorType)-[:DECLARES]->(m2:Method)
      WHERE toLower(m2.name) STARTS WITH "next"
   })
  OR
  // Variant B: Enumeration-style API (Java 1.0)
  (EXISTS {
      MATCH (iteratorType)-[:DECLARES]->(m1:Method)
      WHERE toLower(m1.name) STARTS WITH "hasmoreelements"
   }
   AND EXISTS {
      MATCH (iteratorType)-[:DECLARES]->(m2:Method)
      WHERE toLower(m2.name) STARTS WITH "nextelement"
   })
  OR
  // Variant C: skrátený hybrid
  (EXISTS {
      MATCH (iteratorType)-[:DECLARES]->(m1:Method)
      WHERE toLower(m1.name) STARTS WITH "hasmore"
        AND NOT toLower(m1.name) STARTS WITH "hasmoreelements"
   }
   AND EXISTS {
      MATCH (iteratorType)-[:DECLARES]->(m2:Method)
      WHERE toLower(m2.name) STARTS WITH "next"
   })
SET iteratorNode:Iterator
SET iteratorType:Iterator
RETURN iteratorNode.fqn AS iterator_fqn
ORDER BY iterator_fqn;
```

**Pre P-MARt v1.2:**
- `netbeans: org.openide.Iterator` (modern API)
- `netbeans: org.openide.util.enum.AlterEnumeration` (Enumeration-style)
- `netbeans: org.openide.util.enum.FilterEnumeration` (Enumeration-style)
- `PMD: net.sourceforge.pmd.jaxen.NodeIterator` (modern API)

**Prečo disjunkcia:** Staršie projekty (Netbeans v1.0.x) sú z éry pred Java Collections Framework a používajú `java.util.Enumeration` konvencie (`hasMoreElements`/`nextElement`). Bez disjunkcie by sme stratili 2 z 4 detekovateľných GT inštancií. Reštriktívnejšie pokusy s Aggregate factory (P3) alebo ConcreteIterator existence (P4) na P-MARt projektoch zlyhávajú, lebo iterátory sa bežne vytvárajú priamo cez konštruktor v klientskom kóde, a niektoré Iterator interfacy sú implementované iba anonymnými triedami (ktoré JDT nereprezentuje ako EXTENDS hrany).

### B3.3 Metadata (patternRole)

```cypher
// 1. Iterator interface
MATCH (i:Iterator)
SET i.patternRole = "Iterator";

// 2. hasNext/hasMoreElements metódy (kontrola pozície)
MATCH (i:Iterator) WHERE i:Type
MATCH (i)-[:DECLARES]->(m:Method)
WHERE toLower(m.name) STARTS WITH "hasnext"
   OR toLower(m.name) STARTS WITH "hasmoreelements"
   OR toLower(m.name) STARTS WITH "hasmore"
SET m.patternRole = "Position Check Method";

// 3. next/nextElement metódy (advance)
MATCH (i:Iterator) WHERE i:Type
MATCH (i)-[:DECLARES]->(m:Method)
WHERE toLower(m.name) STARTS WITH "next"
   OR toLower(m.name) STARTS WITH "nextelement"
SET m.patternRole = "Advance Method";

// 4. Concrete Iterators (cez EXTENDS/IMPLEMENTS)
MATCH (ci:Class)-[:IMPLEMENTS|EXTENDS*1..3]->(i:Iterator)
WHERE NOT ci:Iterator
SET ci:ConcreteIterator
SET ci.patternRole = "Concrete Iterator";

// 5. Aggregate factory metódy (vracajú Iterator)
MATCH (aggregateType:Type)-[:DECLARES]->(factoryMethod:Method)
      -[:RETURN_TYPE]->(:Type:Iterator)
WHERE toLower(factoryMethod.name) IN ["iterator", "createiterator", "elements", 
                                       "getiterator", "enum", "enumeration"]
   OR toLower(factoryMethod.name) STARTS WITH "iterator"
   OR toLower(factoryMethod.name) STARTS WITH "elements"
SET factoryMethod.patternRole = "Aggregate Factory Method"
WITH aggregateType
MATCH (aggregateClass:Class {fqn: aggregateType.fqn})
SET aggregateClass:Aggregate
SET aggregateClass.patternRole = "Aggregate";
```

### B3.4 Notes

```cypher
// Reset Iterator notes
MATCH (n:Note {patternKind: "Iterator"}) DETACH DELETE n;

// 1. Iterator interface (Class aj Type)
MATCH (ic) WHERE ic:Iterator AND (ic:Class OR ic:Interface)
OPTIONAL MATCH (it:Type:Iterator {fqn: ic.fqn})
WITH ic, it
CREATE (note:Note {
  text: "Iterator — deklaruje metódy pre prechod kolekciou bez odhalenia jej internej reprezentácie (" + coalesce(ic.sourceRef, "?") + ")",
  role: "Iterator",
  patternKind: "Iterator",
  sourceUri: ic.sourceUri,
  sourceLine: ic.sourceLine,
  editorUri: ic.editorUri
})
CREATE (ic)-[:HAS_NOTE]->(note)
WITH note, it WHERE it IS NOT NULL
CREATE (it)-[:HAS_NOTE]->(note);

// 2. Position Check method (hasNext / hasMoreElements)
MATCH (m:Method {patternRole: "Position Check Method"})
CREATE (note:Note {
  text: "Kontrola pozície — vráti true ak existuje ďalší prvok na iteráciu (" + coalesce(m.sourceRef, "?") + ")",
  role: "Position Check Method",
  patternKind: "Iterator",
  sourceUri: m.sourceUri,
  sourceLine: m.sourceLine,
  editorUri: m.editorUri
})
CREATE (m)-[:HAS_NOTE]->(note);

// 3. Advance method (next / nextElement)
MATCH (m:Method {patternRole: "Advance Method"})
CREATE (note:Note {
  text: "Posun na ďalší prvok — vráti aktuálny prvok a posunie pozíciu (" + coalesce(m.sourceRef, "?") + ")",
  role: "Advance Method",
  patternKind: "Iterator",
  sourceUri: m.sourceUri,
  sourceLine: m.sourceLine,
  editorUri: m.editorUri
})
CREATE (m)-[:HAS_NOTE]->(note);

// 4. Concrete Iterators (LIMIT 5 — môže ich byť veľa)
MATCH (ci:ConcreteIterator)
WITH ci LIMIT 5
CREATE (note:Note {
  text: "Concrete Iterator — drží referenciu na Aggregate a stav iterácie (pozíciu) (" + coalesce(ci.sourceRef, "?") + ")",
  role: "Concrete Iterator",
  patternKind: "Iterator",
  sourceUri: ci.sourceUri,
  sourceLine: ci.sourceLine,
  editorUri: ci.editorUri
})
CREATE (ci)-[:HAS_NOTE]->(note);

// 5. Aggregate (ak existuje factory metóda — voliteľné, často chýba v P-MARt)
MATCH (a:Aggregate)
CREATE (note:Note {
  text: "Aggregate — poskytuje factory metódu vracajúcu Iterator (" + coalesce(a.sourceRef, "?") + ")",
  role: "Aggregate",
  patternKind: "Iterator",
  sourceUri: a.sourceUri,
  sourceLine: a.sourceLine,
  editorUri: a.editorUri
})
CREATE (a)-[:HAS_NOTE]->(note);

// 6. Aggregate factory metódy
MATCH (m:Method {patternRole: "Aggregate Factory Method"})
CREATE (note:Note {
  text: "Aggregate Factory — vracia nový Iterator pre svoju kolekciu (" + coalesce(m.sourceRef, "?") + ")",
  role: "Aggregate Factory Method",
  patternKind: "Iterator",
  sourceUri: m.sourceUri,
  sourceLine: m.sourceLine,
  editorUri: m.editorUri
})
CREATE (m)-[:HAS_NOTE]->(note);
```

> **Pozn:** Aggregate role (notes 5 a 6) sa pre P-MARt projekty pridáva opportunisticky — len ak sa v grafe nájde factory metóda. V starých projektoch (Netbeans, PMD) sa iterátory bežne vytvárajú priamo cez konštruktor (`new NodeIterator(...)`), takže pre väčšinu detekovaných Iterator-ov tieto Notes nevzniknú. To je očakávané a v BP to dokumentuje limitáciu staticky-detekovateľnej Aggregate-Iterator reciprocity v starších projektoch.

### B3.5 Overenie

```cypher
MATCH (source)-[:HAS_NOTE]->(note:Note {patternKind: "Iterator"})
RETURN labels(source) AS labels,
       coalesce(source.name, source.fqn) AS source,
       note.role AS role
ORDER BY note.role, source
LIMIT 30;
```

### B3.6 Bloom Search Phrase

- **Phrase:** `Iterator Pattern`
- **Cypher:**

```cypher
MATCH (i:Iterator) WHERE i:Class OR i:Interface
MATCH (it:Type:Iterator {fqn: i.fqn})
OPTIONAL MATCH pathPC = (it)-[:DECLARES]->(pcm:Method)
  WHERE pcm.patternRole = "Position Check Method"
OPTIONAL MATCH pathAdv = (it)-[:DECLARES]->(am:Method)
  WHERE am.patternRole = "Advance Method"
OPTIONAL MATCH pathCI = (ci:ConcreteIterator)-[:IMPLEMENTS|EXTENDS*1..3]->(i)
OPTIONAL MATCH pathAgg = (aggregateType:Type)-[:DECLARES]->(fm:Method)-[:RETURN_TYPE]->(it)
  WHERE fm.patternRole = "Aggregate Factory Method"
OPTIONAL MATCH pathAggClass = (aggClass:Class:Aggregate {fqn: aggregateType.fqn})
OPTIONAL MATCH pathNI = (i)-[:HAS_NOTE]->(ni:Note)
OPTIONAL MATCH pathNPC = (pcm)-[:HAS_NOTE]->(npc:Note)
OPTIONAL MATCH pathNAdv = (am)-[:HAS_NOTE]->(nadv:Note)
OPTIONAL MATCH pathNCI = (ci)-[:HAS_NOTE]->(nci:Note)
OPTIONAL MATCH pathNFm = (fm)-[:HAS_NOTE]->(nfm:Note)
OPTIONAL MATCH pathNAgg = (aggClass)-[:HAS_NOTE]->(nagg:Note)
RETURN i, it, pcm, am, ci, fm, aggregateType, aggClass,
       ni, npc, nadv, nci, nfm, nagg,
       pathPC, pathAdv, pathCI, pathAgg, pathAggClass,
       pathNI, pathNPC, pathNAdv, pathNCI, pathNFm, pathNAgg
LIMIT 100;
```

> **Pozn:** Pre netbeans môže visualization vykresliť 30+ uzlov, lebo `org.openide.Iterator` má veľa anonymných implementácií. LIMIT 100 obmedzí scénu. Pre čistejší obrázok filtruj cez `WHERE i.name = "NodeIterator"` (PMD) alebo `WHERE i.name = "AlterEnumeration"` (netbeans Enumeration helper).

### B3.7 Bloom konfigurácia

| Label | Farba | Caption | Size |
|---|---|---|---|
| `Iterator` | 🟣 fialová (#9C27B0) | `name` | 70 |
| `ConcreteIterator` | 🟦 modrá (#3F51B5) | `name` | 50 |
| `Aggregate` | 🟠 oranžová (#FF9800) | `name` | 60 |
| `Method` (Position Check / Advance / Aggregate Factory) | 🟢 zelená (#4CAF50) | `name` | 35 |

### B3.8 Obrázky pre BP

**Obrázok #1 — Iterator interface s metódami (kostra):**
- Filtruj na 1 Iterator (`NodeIterator` z PMD je čistý príklad — modern API, malá hierarchia):
  ```cypher
  MATCH (i:Iterator {name: "NodeIterator"})
  ... (zvyšok ako v B3.6)
  ```
- Ukáže Iterator interface + `hasNext()` + `next()` metódy s ich Notes
- Toto je kanonický Modern Iterator obrázok — ideálny prvý obrázok do BP

**Obrázok #2 — Enumeration-style variant:**
- Filtruj na Netbeans `AlterEnumeration` alebo `FilterEnumeration`
- Ukazuje ten istý vzor v staršej API konvencii (`hasMoreElements()` + `nextElement()`)
- Pekne demonštruje, prečo detektor potreboval disjunkciu pre rôzne éry Java API

**Obrázok #3 — Multi-Iterator perspektíva (voliteľné):**
- Spusti unfiltrovanú phrase, ukáže všetky 4 detekované Iterator-y naraz
- Vhodné keď chceš ukázať šírku detekcie a heterogenitu naming konvencií

## B4. Visitor

### B4.1 Definícia rolí (refactoring.guru)

**Visitor** je vzor, ktorý umožňuje pridávať nové operácie do existujúcich tried bez ich modifikácie. Operácia je extrahovaná do samostatnej triedy (Visitor) a aplikovaná cez double dispatch. Štruktúra:

| Rola | Popis (refactoring.guru) |
|---|---|
| **Visitor** | Rozhranie deklarujúce visit metódu pre **každý** typ konkrétneho Element-u (`visitDot`, `visitCircle`, ...). |
| **Concrete Visitor** | Implementuje viacero verzií tej istej operácie pre každý typ Element-u. |
| **Element** | Rozhranie deklarujúce metódu `accept(Visitor)` na "prijatie" visitora. |
| **Concrete Element** | Implementuje accept tak, že volá konkrétnu visit metódu — `visitor.visitThis(this)`. **Double dispatch.** |
| **Reciprocita Visitor↔Element** | Visit metódy majú parameter Element typu, accept metóda má parameter Visitor typu. Vzájomný odkaz. |

### B4.2 Detekcia

Najlepší pokus z Visitor správy (P3 — F1 = 1.000):

```cypher
// Visitor = interface alebo abstract class s ≥2 visit metódami
MATCH (visitorNode)
WHERE visitorNode:Interface
   OR (visitorNode:Class AND visitorNode.isAbstract = true)
MATCH (visitorType:Type {fqn: visitorNode.fqn})
WITH visitorNode, visitorType, [
    (visitorType)-[:DECLARES]->(m:Method)
    WHERE toLower(m.name) STARTS WITH "visit" | m
] AS visitMethods
WHERE size(visitMethods) >= 2

// Reciprocita: existuje Element s accept(Visitor) parametrom
WITH visitorNode, visitorType
WHERE EXISTS {
    MATCH (elementType:Type)-[:DECLARES]->(acceptMethod:Method)
    MATCH (acceptMethod)-[:HAS_PARAMETER]->(param)-[:PARAMETER_TYPE]->(visitorType)
    WHERE toLower(acceptMethod.name) STARTS WITH "accept"
       OR toLower(acceptMethod.name) STARTS WITH "apply"
       OR toLower(acceptMethod.name) STARTS WITH "jjtaccept"
}
SET visitorNode:Visitor
SET visitorType:Visitor

// Označenie Element tried
WITH visitorType
MATCH (elementType:Type)-[:DECLARES]->(acceptMethod:Method)
      -[:HAS_PARAMETER]->()-[:PARAMETER_TYPE]->(visitorType)
WHERE toLower(acceptMethod.name) STARTS WITH "accept"
   OR toLower(acceptMethod.name) STARTS WITH "apply"
   OR toLower(acceptMethod.name) STARTS WITH "jjtaccept"
SET elementType:Element
WITH elementType
MATCH (elementClass {fqn: elementType.fqn}) WHERE elementClass:Class OR elementClass:Interface
SET elementClass:Element
RETURN DISTINCT elementType.fqn AS element_fqn
LIMIT 50;
```

**Pre P-MARt v1.2:** `JavaParserVisitor` (jrefac aj PMD), `SummaryVisitor` (jrefac).

### B4.3 Metadata (patternRole)

```cypher
// 1. Visitor interface
MATCH (v:Visitor)
SET v.patternRole = "Visitor";

// 2. Concrete Visitors
MATCH (cv:Class)-[:IMPLEMENTS|EXTENDS*1..3]->(v:Visitor)
SET cv:ConcreteVisitor
SET cv.patternRole = "Concrete Visitor";

// 3. Visit methods
MATCH (v:Visitor) WHERE v:Type
MATCH (v)-[:DECLARES]->(m:Method)
WHERE toLower(m.name) STARTS WITH "visit"
SET m.patternRole = "Visit Method";

// 4. Element interface/class
MATCH (e:Element)
SET e.patternRole = "Element";

// 5. Accept methods
MATCH (e:Element) WHERE e:Type
MATCH (e)-[:DECLARES]->(m:Method)
WHERE toLower(m.name) STARTS WITH "accept"
   OR toLower(m.name) STARTS WITH "apply"
   OR toLower(m.name) STARTS WITH "jjtaccept"
SET m.patternRole = "Accept Method";

// 6. Concrete Elements
MATCH (ce:Class)-[:IMPLEMENTS|EXTENDS*1..3]->(e:Element)
WHERE NOT ce:Element
SET ce:ConcreteElement
SET ce.patternRole = "Concrete Element";
```

### B4.4 Notes

```cypher
// Reset Visitor notes
MATCH (n:Note {patternKind: "Visitor"}) DETACH DELETE n;

// 1. Visitor interface (Class aj Type)
MATCH (vc) WHERE vc:Visitor AND (vc:Class OR vc:Interface)
OPTIONAL MATCH (vt:Type:Visitor {fqn: vc.fqn})
WITH vc, vt
CREATE (note:Note {
  text: "Visitor — deklaruje visit metódy pre každý typ Element-u (" + coalesce(vc.sourceRef, "?") + ")",
  role: "Visitor",
  patternKind: "Visitor",
  sourceUri: vc.sourceUri,
  sourceLine: vc.sourceLine,
  editorUri: vc.editorUri
})
CREATE (vc)-[:HAS_NOTE]->(note)
WITH note, vt WHERE vt IS NOT NULL
CREATE (vt)-[:HAS_NOTE]->(note);

// 2. Element interface (Class aj Type)
MATCH (ec) WHERE ec:Element AND (ec:Class OR ec:Interface)
OPTIONAL MATCH (et:Type:Element {fqn: ec.fqn})
WITH ec, et
CREATE (note:Note {
  text: "Element — deklaruje accept(Visitor) metódu pre double dispatch (" + coalesce(ec.sourceRef, "?") + ")",
  role: "Element",
  patternKind: "Visitor",
  sourceUri: ec.sourceUri,
  sourceLine: ec.sourceLine,
  editorUri: ec.editorUri
})
CREATE (ec)-[:HAS_NOTE]->(note)
WITH note, et WHERE et IS NOT NULL
CREATE (et)-[:HAS_NOTE]->(note);

// 3. Concrete Visitor (LIMIT — môže ich byť veľa)
MATCH (cv:ConcreteVisitor)
WITH cv LIMIT 5
CREATE (note:Note {
  text: "Concrete Visitor — implementuje operáciu pre každý typ Element-u (" + coalesce(cv.sourceRef, "?") + ")",
  role: "Concrete Visitor",
  patternKind: "Visitor",
  sourceUri: cv.sourceUri,
  sourceLine: cv.sourceLine,
  editorUri: cv.editorUri
})
CREATE (cv)-[:HAS_NOTE]->(note);

// 4. Accept method (jeden representative na Element interface)
MATCH (e:Element) WHERE e:Type
MATCH (e)-[:DECLARES]->(m:Method {patternRole: "Accept Method"})
WITH e, m LIMIT 5
CREATE (note:Note {
  text: "Accept method — volá visitor.visitThis(this), realizuje double dispatch (" + coalesce(m.sourceRef, "?") + ")",
  role: "Accept Method",
  patternKind: "Visitor",
  sourceUri: m.sourceUri,
  sourceLine: m.sourceLine,
  editorUri: m.editorUri
})
CREATE (m)-[:HAS_NOTE]->(note);
```

> **Pozn:** Pre Visitor pridávame Notes selektívne (`LIMIT 5` pre Concrete Visitors a Accept methods), lebo na PMD/jrefac môže byť 80+ Element tried a 30+ Concrete Visitorov — všetko anotovať by zaplnilo obrázok.

### B4.5 Overenie

```cypher
MATCH (source)-[:HAS_NOTE]->(note:Note {patternKind: "Visitor"})
RETURN labels(source) AS labels,
       coalesce(source.name, source.fqn) AS source,
       note.role AS role
ORDER BY note.role, source;
```

### B4.6 Bloom Search Phrase

- **Phrase:** `Visitor Pattern`
- **Cypher:**

```cypher
MATCH (v:Visitor) WHERE v:Class OR v:Interface
MATCH (vt:Type:Visitor {fqn: v.fqn})
OPTIONAL MATCH pathVisit = (vt)-[:DECLARES]->(vm:Method)
  WHERE vm.patternRole = "Visit Method"
OPTIONAL MATCH pathElement = (et:Type:Element)-[:DECLARES]->(am:Method)
                                   -[:HAS_PARAMETER]->()-[:PARAMETER_TYPE]->(vt)
  WHERE am.patternRole = "Accept Method"
OPTIONAL MATCH pathCV = (cv:ConcreteVisitor)-[:IMPLEMENTS|EXTENDS*1..3]->(v)
OPTIONAL MATCH pathNV = (v)-[:HAS_NOTE]->(nv:Note)
OPTIONAL MATCH pathNE = (et)-[:HAS_NOTE]->(ne:Note)
OPTIONAL MATCH pathNAm = (am)-[:HAS_NOTE]->(nam:Note)
OPTIONAL MATCH pathNCV = (cv)-[:HAS_NOTE]->(ncv:Note)
RETURN v, vt, vm, et, am, cv, nv, ne, nam, ncv,
       pathVisit, pathElement, pathCV, pathNV, pathNE, pathNAm, pathNCV
LIMIT 100;
```

> **Pozn:** Pre PMD/jrefac môže visualization vykresliť 100+ uzlov (Element hierarchia má 89 tried). LIMIT 100 obmedzí scénu na zvládnuteľnú veľkosť. Pre čistejší obrázok filtruj cez `WHERE v.name = "JavaParserVisitor"` (alebo `SummaryVisitor`).

### B4.7 Bloom konfigurácia

| Label | Farba | Caption | Size |
|---|---|---|---|
| `Visitor` | 🟣 fialová (#9C27B0) | `name` | 70 |
| `ConcreteVisitor` | 🟦 modrá (#3F51B5) | `name` | 50 |
| `Element` | 🟠 oranžová (#FF9800) | `name` | 60 |
| `ConcreteElement` | 🟡 svetložltá (#FFC107) | `name` | 40 |
| `Method` (Visit/Accept) | 🟢 zelená (#4CAF50) | `name` | 35 |

### B4.8 Obrázky pre BP

**Obrázok #1 — Reciprocita Visitor↔Element (kostra):**
- Filtruj na 1 Visitor (`SummaryVisitor` má len 13 visit metód, ideálne pre obrázok):
  ```cypher
  MATCH (v:Visitor {name: "SummaryVisitor"})
  ... (zvyšok ako v B4.6)
  ```
- Ukáže Visitor + 1–2 representative Element-y + reciprocitu accept↔visit

**Obrázok #2 — Element hierarchia:**
- Pravý klik na `Element` interface → **Expand → IMPLEMENTS** — pridá všetky Concrete Elementy
- Ukazuje rozsah AST hierarchie (peknú "hviezdu")

**Obrázok #3 — Double dispatch (technický detail):**
- Filtruj na jednu Accept metódu, expand jej CALLS hrany — uvidíš accept.calls(visit) z konkrétnej Element triedy

---

# Sekcia C — Spoločné pre všetky moduly

## C1. Štýlovanie a export v Bloome

### C1.1 Apply styling to Perspective

Po nastavení farieb v Bloom Categories tab klikni **Apply styling to Perspective** (dole) — uloží štýly natrvalo.

### C1.2 Manuálne usporiadanie

Drag uzly do prehľadných pozícií.

### C1.3 Export SVG

1. Vpravo hore **Export**
2. **Scene as SVG** (preferované pre BP — vektor, škáluje bez straty kvality)
3. Ulož → vlož do BP

### C1.4 Caption Notes — len `text`

V Categories → **Note** → caption mal by byť **iba `text`** (NIE kombinácia s `role`). Inak by Bloom vykresľoval "Singleton, Singleton trieda — jediná inštancia..." s duplicitou.


---

## C2. Riešenie problémov

### APOC chyba "Unknown procedure apoc.load.json"
→ Zmaž sandbox, vytvor nový so šablónou **Graph Data Science**.

### "Memory pool out of memory" pri importe alebo source extraction
→ Použi `apoc.periodic.iterate` batch (sekcia A3.5 a A4.2). Nikdy jednu transakciu na celý graf.

### Bloom nepozná pattern label (Singleton/Decorator/Iterator/Visitor/Element)
→ Perspective bola vytvorená pred detekciou.
**Fix:** Perspective → Categories → **Add category** → vyber chýbajúci label. Alebo klik **🔄 Refresh** pri názve perspective.

### `sourceRef` je null po sekcii A4
→ Buď `propsJson` neobsahuje `range`, alebo `id` neobsahuje `@` separator.
**Fix:** Diagnostika:
```cypher
MATCH (n) WHERE n.id IS NOT NULL
RETURN n.id, n.id CONTAINS '@' AS has_uri,
       n.propsJson IS NOT NULL AS has_json
LIMIT 5;
```
Ak nemá `@`, tvoj extraktor ukladá URI inak — uprav `split(n.id, '@')[-1]` v A4.2.

### Note text obsahuje referenciu dvakrát
→ Spustil si Note query 2× bez resetu.
**Fix:** Vždy spusti najprv `MATCH (n:Note {patternKind: "<PATTERN>"}) DETACH DELETE n;` pred opakovaným spustením Notes queries.

### Visitor scéna v Bloome je preplnená (PMD/jrefac)
→ Element hierarchia má 89 tried.
**Fix:** Filtruj search phrase na konkrétny Visitor:
```cypher
MATCH (v:Visitor {name: "SummaryVisitor"})
... 
```
Pre prvý nastrelovací obrázok použi menší Visitor (SummaryVisitor s 13 metódami namiesto JavaParserVisitor s 86).

### Iterator detekcia má nízky recall (50%)
→ To je očakávaný stav (F1 = 0.615 v správe). Polovica Iterator GT v P-MARt je principiálne nedetekovateľná: konkrétne triedy implementujúce `java.util.Iterator` z JDK (nemajú `IN_FILE`), anonymné triedy (JDT ich nereprezentuje ako EXTENDS hrany), alebo `java.util.Enumeration` použitia ktoré sú externé k projektu.
**Fix:** Pre vizualizáciu filtruj search phrase na konkrétny Iterator z ground truth (napr. `NodeIterator`, `AlterEnumeration`).

### Iterator scéna v Bloome neukazuje ConcreteIterator
→ Iterator interface je implementovaný iba anonymnými triedami (`new Iterator() { ... }`), ktoré JDT nereprezentuje ako separátne EXTENDS/IMPLEMENTS hrany.
**Fix:** Toto je dokumentovaná limitácia, nie chyba. Vzor sa dá vizualizovať aj bez ConcreteIterator uzlov — kostra Iterator + Position Check + Advance metódy sú dostatočné pre BP obrázok.

### Bloom search phrase vráti uzly bez hrán
→ Verzia Bloomu nekreslí hrany z RETURN premenných.
**Fix A:** Query vracia `path*` (cesty) namiesto hrán — všetky moduly v tomto postupe to robia.
**Fix B:** Manuálne **pravý klik → Expand → All** na každý uzol.

### Caption Notes je orezaný
→ Caption obsahuje viacero properties.
**Fix:** Bloom Categories → **Note** → caption nechaj **iba `text`** (nie `text + role + sourceRef`).

### V Bloome vidím veľa osamotených Class uzlov
→ Class/Type dualita — Class uzol často nemá vlastné štrukturálne hrany.
**Fix:** Dismiss osamotené Class uzly pravým klikom. Alebo v search phrase RETURN-uj len `t` (Type) namiesto `s` (Class).

### Constructor uzol sa nezobrazuje
→ Konštruktor v grafe je samostatný label `:Constructor`, nie `:Method`.
**Fix:** Skontroluj že v Perspective máš `Constructor` ako kategóriu (sekcia A5.2). Ak ti detekcia vráti `0` Constructor Notes, over diagnostiku:
```cypher
MATCH (n:Constructor) RETURN n.name, labels(n) LIMIT 5;
```

---

## Cheat-sheet — celkový workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  GoF VZORY V NEO4J + BLOOM — SPOLOČNÝ WORKFLOW                  │
├─────────────────────────────────────────────────────────────────┤
│  SETUP (raz):                                                    │
│  A1. Sandbox Blank → Browser                                     │
│  A2. GitHub upload → raw URL                                     │
│  A3. Import nodes + edges (apoc.periodic.iterate)                │
│  A4. Globálne sourceRef/sourceUri/editorUri (cez @ split)        │
│  A5. Bloom Perspective "GoF Patterns" + Categories + HAS_NOTE    │
│                                                                   │
│  PATTERN MODUL (opakuj per vzor):                                │
│  Bx.2  Detekcia → SET <Pattern>:label                            │
│  Bx.3  Metadata → SET .patternRole                               │
│  Bx.4  Notes → CREATE :Note s text + sourceRef + editorUri       │
│  Bx.5  Overenie počtu                                            │
│  Bx.6  Bloom Saved Cypher: <Pattern> Pattern phrase              │
│  Bx.7  Bloom farby + Apply styling                               │
│  Bx.8  Export SVG (obrázok #1 čistá kostra, #2 v kontexte)       │
│                                                                   │
│  PROVENANCE LINK V BLOOME:                                       │
│  Klik na Note → pravý panel → property `editorUri` →             │
│    skopíruj `vscode://file/.../File.java:LL` →                   │
│    paste do prehliadača → otvorí VS Code na presnom riadku       │
└─────────────────────────────────────────────────────────────────┘
```
