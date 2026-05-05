# Detekcia návrhových vzorov – Manuál

Tento manuál popisuje ako importovať vygenerovaný graf Java projektu do Neo4j a spustiť detekčné Cypher dotazy na identifikáciu návrhových vzorov.

---

## Predpoklady

- Vygenerovaný `graph.json` súbor (výstup z `client.js` extraktora)
- Účet na [Neo4j Sandbox](https://sandbox.neo4j.com) (bezplatný) alebo lokálna inštalácia Neo4j
- `graph.json` musí byť dostupný cez **verejný URL** – Neo4j Sandbox je cloudová služba a nedokáže čítať lokálne súbory

---

## 1. Nahratie graph.json na GitHub

Keďže Neo4j Sandbox beží v cloude, importovaný súbor musí byť dostupný cez URL. Najjednoduchší spôsob:

1. Nahrajte `graph.json` do GitHub repozitára
2. Otvorte súbor na GitHube a kliknite na tlačidlo **Raw**
3. Skopírujte URL z prehliadača – bude vyzerať približne takto:

```text
https://raw.githubusercontent.com/<user>/<repo>/main/graph_MojProjekt.json
```
Tento raw link budete používať v importných príkazoch nižšie.

> **Poznámka:** Už vygenerované grafy pre projekty z benchmarku P-MARt v1.2 sú dostupné v adresári `P-MARt-graphs/` v repozitári projektu.

---

## 2. Vytvorenie Neo4j inštancie

1. Prejdite na [sandbox.neo4j.com](https://sandbox.neo4j.com) a prihláste sa
2. Vytvorte nový **Blank Sandbox** projekt
3. Otvorte **Neo4j Browser** (tlačidlo "Open")

---

## 3. Import grafu do Neo4j

V Neo4j Browseri spúšťajte nasledujúce príkazy **v presnom poradí**. Všade kde vidíte `<RAW_URL>` nahraďte vaším raw linkom z kroku 1.

### 3.1 Vytvorenie uniqueness constraint

```cypher
CREATE CONSTRAINT unique_node_id IF NOT EXISTS
FOR (n:Node) REQUIRE n.id IS UNIQUE;
```

### 3.2 Import uzlov

```cypher
CALL apoc.load.json("<RAW_URL>") YIELD value
UNWIND value.nodes AS node
CALL apoc.create.node(node.labels, node.properties) YIELD node AS created
RETURN count(created);
```

### 3.3 Import hrán

```cypher
CALL apoc.periodic.iterate(
  'CALL apoc.load.json("<RAW_URL>") YIELD value UNWIND value.edges AS edge RETURN edge',
  'MATCH (a {id: edge.source}), (b {id: edge.target})
   CALL apoc.create.relationship(a, edge.type, edge.properties, b) YIELD rel
   RETURN count(rel)',
  {batchSize: 500, parallel: false}
);
```

> **Dôležité:** Parameter `parallel: false` je nevyhnutný – zabraňuje race condition pri MERGE operáciách na zdieľaných uzloch.

### 3.4 Extrakcia zdrojových referencií

```cypher
MATCH (n)
WHERE n.id IS NOT NULL AND n.id CONTAINS '@'
SET n.sourceUri = split(n.id, '@')[0],
    n.sourceLine = toInteger(split(n.id, '@')[1]),
    n.editorUri = 'vscode://file/' + replace(split(n.id, '@')[0], 'file://', '') + '#' + split(n.id, '@')[1]
RETURN count(n);
```

> **Poznámka:** Presné znenie importných príkazov nájdete v adresári `graph-import/` v repozitári. Vyššie uvedené príkazy sú ilustratívne – vždy použite verziu z repozitára.

---

## 4. Spustenie detekcie návrhových vzorov

Detekčné Cypher dotazy sa nachádzajú v repozitári v adresári:

```text
research-experiments/
```

Pre každý návrhový vzor existuje samostatný súbor s Cypher dotazom. Postup:

1. Otvorte adresár `research-experiments/` v repozitári na GitHube
2. Vyberte súbor pre požadovaný návrhový vzor (napr. Singleton, Decorator, Visitor, Iterator, ...)
3. Skopírujte Cypher dotaz zo súboru
4. Vložte ho do Neo4j Browsera a spustite

Dotaz po spustení:
- Nájde všetky triedy zodpovedajúce štrukturálnej definícii daného vzoru
- Označí ich novým štítkom (label) – napr. `:Singleton`, `:Decorator`
- Priradí im `patternRole` property
- Vytvorí `:Note` uzly s popisom roly každého prvku vo vzore

### Podporované vzory

| Vzor | Stav |
|---|---|
| Singleton | Detekcia funkčná |
| Decorator | Detekcia funkčná |
| Visitor | Detekcia funkčná |
| Iterator | Detekcia funkčná |
| Factory Method | Detekcia funkčná |
| Strategy | Detekcia funkčná |
| Composite | Detekcia funkčná |
| Observer | Detekcia funkčná |
| Template Method | Detekcia funkčná |

---

## 5. Overenie výsledkov

Po spustení detekčného dotazu môžete výsledky overiť priamo v Neo4j Browseri:

```cypher
// Priklad: zobrazenie vsetkych detekovanych Singleton tried
MATCH (n:Singleton) RETURN n.fqn AS trieda ORDER BY trieda;
```

Alebo pre ľubovoľný iný vzor – nahraďte `:Singleton` za príslušný label (`:Decorator`, `:Visitor`, atď.).

---

## Riešenie problémov

| Problém | Riešenie |
|---|---|
| `apoc.load.json` hlási chybu | Overte, že URL je raw GitHub link (nie bežná GitHub stránka) |
| Import hrán trvá dlho | Pri veľkých projektoch (napr. NetBeans) je to očakávané |
| Žiadne výsledky detekcie | Skontrolujte, či import prebehol správne: `MATCH (n) RETURN count(n)` |
| Sandbox expiroval | Neo4j Sandbox má 3-dňový limit – vytvorte nový a reimportujte |
| `graph.json` presahuje 100 MB | GitHub má limit na veľkosť súboru – použite Git LFS alebo lokálnu Neo4j inštaláciu |