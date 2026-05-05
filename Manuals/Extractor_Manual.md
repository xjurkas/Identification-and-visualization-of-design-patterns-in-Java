# client.js – Manuál na použitie extraktora

Extraktor `client.js` je Node.js nástroj, ktorý analyzuje Java projekt a vygeneruje jeho grafovú reprezentáciu (`graph.json`). Tento súbor sa následne importuje do Neo4j na detekciu a vizualizáciu návrhových vzorov.

---

## Predpoklady

- **Node.js** (testované s verziou 16.20.2)
- **Eclipse JDT Language Server (JDTLS)** – dostupný ako súčasť rozšírenia [Red Hat Java pre VS Code](https://marketplace.visualstudio.com/items?itemName=redhat.java) (testované s verziou 1.54.0)
- **Java projekt**, ktorý chcete analyzovať

---

## 1. Inštalácia

```bash
git clone https://github.com/xjurkas/Identification-and-visualization-of-design-patterns-in-Java.git
cd Identification-and-visualization-of-design-patterns-in-Java/extractor-client.js
npm install
```

Príkaz `npm install` nainštaluje knižnicu `vscode-jsonrpc`, ktorú extraktor používa na komunikáciu s JDTLS.

---

## 2. Konfigurácia

Skopírujte ukážkový konfiguračný súbor a upravte ho:

```bash
cp example.config.json myproject.config.json
```

### Povinné parametre

| Parameter | Popis |
|---|---|
| `JDTLS_SERVER_DIR` | Absolútna cesta k adresáru `server` v inštalácii JDTLS |
| `PROJECT_DIR` | Absolútna cesta ku koreňovému adresáru analyzovaného Java projektu |
| `WORKSPACE_DIR` | Pracovný adresár pre JDTLS (ľubovoľná prázdna zložka) |
| `OUTPUT_FILE` | Názov výstupného JSON súboru (napr. `graph_MojProjekt.json`) |

### Voliteľné parametre

| Parameter | Popis |
|---|---|
| `XMX` | Maximálna veľkosť pamäte pre JDTLS (napr. `2G`) |
| `SKIP_DIRS` | Zoznam adresárov, ktoré sa majú pri analýze vynechať |
| `CONCURRENCY` | Počet paralelných LSP požiadaviek |
| `TIMEOUT` | Časový limit pre LSP požiadavky (v ms) |

### Príklad konfigurácie (Windows)

```json
{
  "JDTLS_SERVER_DIR": "C:/Users/user/.vscode/extensions/redhat.java-1.54.0-win32-x64/server",
  "PROJECT_DIR": "C:/Projects/MojJavaProjekt",
  "WORKSPACE_DIR": "C:/tmp/jdtls-workspace",
  "OUTPUT_FILE": "graph_MojProjekt.json",
  "XMX": "2G",
  "SKIP_DIRS": ["test", "node_modules"],
  "CONCURRENCY": 4,
  "TIMEOUT": 30000
}
```

> **Poznámka (Unix/macOS):** Cesty upravte na unixový formát, napr. `/home/user/.vscode/extensions/...`

---

## 3. Spustenie extrakcie

```bash
node client.js myproject.config.json
```

Extraktor postupne:

1. Spustí JDTLS a inicializuje LSP spojenie
2. Pre každý `.java` súbor pošle tri LSP requesty (`documentSymbol`, `typeHierarchy/supertypes`, `callHierarchy/outgoingCalls`)
3. Doplní chýbajúce informácie regex skenom zdrojového textu (modifikátory, typy polí, návratové typy)
4. Vykoná post-processing (OVERRIDES hrany, source-level CALLS fallback, CREATES hrany)
5. Uloží výsledný graf do súboru definovaného v `OUTPUT_FILE`

### Orientačné časy spracovania

| Veľkosť projektu | Približný čas |
|---|---|
| ~23 tried (Lexi) | 3–6 minút |
| ~2 238 tried (NetBeans) | ~5 hodín |

---

## 4. Výstup

Výstupom je súbor `graph.json` obsahujúci:

- **Uzly** – triedy, metódy, polia, konštruktory, rozhrania, typy, parametre
- **Hrany** – EXTENDS, IMPLEMENTS, DECLARES, CALLS, OVERRIDES, FIELD_TYPE, RETURN_TYPE, CREATES a ďalšie
- **Metadáta** – URI zdrojového súboru a číslo riadku zakódované v identifikátore každého uzla

---

## 5. Ďalšie kroky (Neo4j import a detekcia)

Po vygenerovaní `graph.json`:

1. Nahrajte súbor na miesto dostupné cez URL (napr. GitHub raw link) – Neo4j Sandbox vyžaduje URL pre import
2. V Neo4j Browseri spustite importné Cypher príkazy z adresára `graph-import/` v repozitári (v poradí: constraint → uzly → hrany → zdrojové referencie)
3. Spustite detekčné Cypher dotazy z adresára `research-experiments/` pre vybraný návrhový vzor
4. Vizualizujte výsledky v Neo4j Bloom pomocou pripravených vyhľadávacích fráz

> **Tip:** Ak nechcete spúšťať extrakciu, v adresári `P-MARt-graphs/` sú už vygenerované grafy pre projekty z benchmarku P-MARt v1.2.

---

## Riešenie problémov

| Problém | Riešenie |
|---|---|
| JDTLS sa nespustí | Overte cestu v `JDTLS_SERVER_DIR` – musí smerovať na adresár `server` |
| Chýbajúce hrany volaní | JDTLS občas vynechá CALLS pri pretypovaní – source-level fallback by to mal pokryť |
| `editorUri` nefunguje | Formát `vscode://file/C:/...` je pre Windows; na Unixe upravte predponu v `client.js` |
| Veľký projekt padá v Neo4j Sandbox | Sandbox má pamäťové limity – použite lokálnu inštaláciu Neo4j cez Docker |