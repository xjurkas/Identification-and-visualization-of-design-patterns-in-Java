/**
 * JDTLS -> Code Property Graph extractor for Neo4j (cleaned).
 *
 * Pipeline:
 *   1. Spawn Eclipse JDT Language Server as a child process.
 *   2. Talk to it over stdio using vscode-jsonrpc (JSON-RPC framing).
 *      Three LSP requests are issued:
 *        - textDocument/documentSymbol  (per-file outline)
 *        - textDocument/prepareTypeHierarchy + typeHierarchy/supertypes
 *        - textDocument/prepareCallHierarchy + callHierarchy/outgoingCalls
 *      Other facts that LSP/JDTLS does NOT expose for Java
 *      (modifiers, parameter names, parameter types, return types,
 *      field types, full method bodies, "new X()" sites,
 *      "this.field = param" injection) are recovered from the raw
 *      source text with regex / brace tracking.
 *   3. Apply post-processing passes that compute facts the graph
 *      itself implies but that LSP never returns directly:
 *        - OVERRIDES (transitive supertype walk)
 *        - constructor relabel (JDTLS sometimes reports kind=6 instead of 9)
 *        - modifier exclusivity sanitisation
 *   4. Write the output JSON and print a single summary block.
 *
 * Sources / inspiration:
 *   - vscode-jsonrpc node usage:
 *       https://github.com/microsoft/vscode-languageserver-node/blob/main/jsonrpc/README.md
 *   - JDT LS launch (java args, -configuration, -data, equinox launcher):
 *       https://github.com/eclipse-jdtls/eclipse.jdt.ls/wiki/Running-the-JAVA-LS-server-from-the-command-line
 *   - LSP method shapes (documentSymbol, callHierarchy, typeHierarchy):
 *       https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/
 *
 * Run:    node client.js [path/to/config.json]
 * Output: <CONFIG.OUTPUT_FILE>  (default graph.json)
 */

const cp = require("child_process");
const fs = require("fs");
const path = require("path");
const rpc = require("vscode-jsonrpc/node");

// =========================================================================
// SECTION 1 - CONFIG LOADING
// =========================================================================

const DEFAULT_CONFIG = {
  JDTLS_SERVER_DIR: "",
  PROJECT_DIR: "",
  WORKSPACE_DIR: "",
  OUTPUT_FILE: "graph.json",
  XMX: "2G",
  SKIP_DIRS: [".git", "target", "node_modules", ".idea", ".gradle", ".metadata"],
  CONCURRENCY: { callHierarchy: 2, typeHierarchy: 2 },
  TIMEOUT: {
    initialize: 30000,
    documentSymbol: 20000,
    prepareCallHierarchy: 15000,
    outgoingCalls: 25000,
    prepareTypeHierarchy: 15000,
    supertypes: 20000
  }
};

const loadConfig = () => {
  const configPath = process.argv[2] || path.join(__dirname, "client.config.json");
  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    console.error(`Pass a path:  node client.js C:/path/to/your-config.json`);
    process.exit(1);
  }
  let raw;
  try { raw = JSON.parse(fs.readFileSync(configPath, "utf8")); }
  catch (e) { console.error(`Failed to parse ${configPath}: ${e.message}`); process.exit(1); }

  const merged = {
    ...DEFAULT_CONFIG, ...raw,
    CONCURRENCY: { ...DEFAULT_CONFIG.CONCURRENCY, ...(raw.CONCURRENCY || {}) },
    TIMEOUT:     { ...DEFAULT_CONFIG.TIMEOUT,     ...(raw.TIMEOUT     || {}) }
  };
  merged.SKIP_DIRS = new Set(Array.isArray(merged.SKIP_DIRS) ? merged.SKIP_DIRS : DEFAULT_CONFIG.SKIP_DIRS);

  const normPath = (p) => (p || "").replace(/\\/g, "/").replace(/\/+$/, "");
  merged.JDTLS_SERVER_DIR = normPath(merged.JDTLS_SERVER_DIR);
  merged.PROJECT_DIR      = normPath(merged.PROJECT_DIR);
  merged.WORKSPACE_DIR    = normPath(merged.WORKSPACE_DIR);

  const required = ["JDTLS_SERVER_DIR", "PROJECT_DIR", "WORKSPACE_DIR"];
  const missing = required.filter(k => !merged[k]);
  if (missing.length) {
    console.error(`Missing required config fields: ${missing.join(", ")}`);
    process.exit(1);
  }
  return merged;
};

const CONFIG = loadConfig();

// =========================================================================
// SECTION 2 - SMALL UTILITIES
// =========================================================================

const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const toUri = (p) => "file:///" + p.replace(/\\/g, "/");
const fromUri = (u) => u.startsWith("file:///") ? u.slice("file:///".length) : u;
const normEol = (s) => s.replace(/\r\n/g, "\n");
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// LSP SymbolKind enum int -> string label.
// Spec: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#symbolKind
const kindLabel = (kind) => {
  const map = { 5: "Class", 11: "Interface", 10: "Enum", 6: "Method", 9: "Constructor", 8: "Field" };
  return map[kind] || "Node";
};

// JDTLS occasionally appends a return-type fragment after the closing
// paren of a method name (e.g. "draw(Graphics) : void"). Strip it.
const normalizeMethodSig = (name) => {
  const close = name?.indexOf(")");
  return close !== -1 ? name.slice(0, close + 1).trim() : (name || "").trim();
};

// JDTLS sometimes reports containerName as "Foo.java" instead of "Foo".
const normalizeContainerName = (name) => (name || "").replace(/\.java$/i, "");

// =========================================================================
// SECTION 3 - FILE DISCOVERY & SOURCE PRE-PARSING
// =========================================================================

function findJavaFiles(root) {
  const out = [];
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (CONFIG.SKIP_DIRS.has(e.name)) continue;
        walk(full);
      } else if (e.isFile() && e.name.endsWith(".java")) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out;
}

// SOURCE-LEVEL: read "package <fqn>;" out of the source.
// JDTLS does not expose package on document symbols.
const parsePackageFromSource = (text) => {
  const m = text.match(/^\s*package\s+([a-zA-Z_][\w.]*?)\s*;/m);
  return m ? m[1] : "";
};

// SOURCE-LEVEL: explicit imports + wildcard packages, used by
// mapTypeNameToFqn to resolve simple names the way javac would.
// Mirrors JLS 6.3 import resolution.
const parseImports = (text) => {
  const explicit = new Map();
  const wildcards = [];
  const lines = normEol(text).split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(public\s+|abstract\s+|final\s+)*(class|interface|enum)\s/.test(trimmed)) break;
    const m = trimmed.match(/^\s*import\s+(static\s+)?([a-zA-Z_][\w.]*)\s*;/);
    if (!m) continue;
    const fqn = m[2];
    if (fqn.endsWith(".*")) wildcards.push(fqn.slice(0, -2));
    else explicit.set(fqn.split(".").pop(), fqn);
  }
  return { explicit, wildcards };
};

const sliceTextByRange = (text, range) => {
  if (!range || !range.start || !range.end) return "";
  const lines = normEol(text).split("\n");
  const s = range.start.line, e = range.end.line;
  if (s < 0 || e >= lines.length || s > e) return "";
  return lines.slice(s, e + 1).join("\n");
};

// CUSTOM: JDTLS document symbols often report method ranges that cover
// only the signature line. The source-level CALLS fallback below
// regex-scans method bodies, so widen each method's range to the
// matching closing brace.
//
// Algorithm: scan forward from start line, find first "{", track
// brace depth (skipping string/char literals + // comments) until
// matching "}". For interface methods that end with ";" before any
// "{", keep the original range.
//
// Standard balanced-bracket matching:
// https://leetcode.com/problems/valid-parentheses/
const expandMethodBodyRange = (text, range) => {
  if (!range || !range.start) return range;
  const lines = normEol(text).split("\n");
  const startLine = range.start.line;
  if (startLine < 0 || startLine >= lines.length) return range;

  let braceDepth = 0;
  let foundOpen = false;
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    let inString = false, inChar = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      const prev = j > 0 ? line[j - 1] : '';
      if (inString) { if (ch === '"' && prev !== '\\') inString = false; continue; }
      if (inChar)   { if (ch === "'" && prev !== '\\') inChar   = false; continue; }
      if (ch === '"') { inString = true; continue; }
      if (ch === "'") { inChar = true; continue; }
      if (ch === '/' && j + 1 < line.length && line[j + 1] === '/') break;
      if (ch === ';' && !foundOpen) return range;
      if (ch === '{') { braceDepth++; foundOpen = true; }
      else if (ch === '}') {
        braceDepth--;
        if (foundOpen && braceDepth === 0) {
          return { start: range.start, end: { line: i, character: j + 1 } };
        }
      }
    }
  }
  return range;
};

const getLine = (text, lineIdx) => {
  const lines = normEol(text).split("\n");
  return lineIdx >= 0 && lineIdx < lines.length ? lines[lineIdx] : "";
};

// SOURCE-LEVEL: LSP/JDTLS does not expose Java modifiers as a property.
// Recover them by scanning the declaration line for keywords.
const extractModifiers = (text, line) => {
  const lines = normEol(text).split("\n");
  if (line < 0 || line >= lines.length) return [];
  const modLine = lines[line] || "";
  const mods = [];
  for (const m of ["public", "private", "protected", "static", "final", "abstract", "synchronized"]) {
    if (new RegExp(`\\b${m}\\b`).test(modLine)) mods.push(m);
  }
  return mods;
};

// CUSTOM: collapse raw modifier list into the booleans Cypher queries
// expect. Pick the most restrictive access modifier if more than one
// slipped through; section 8.14 removes the dropped HAS_MODIFIER edges.
const normalizeModifiers = (modifiers) => {
  if (!modifiers || modifiers.length === 0) {
    return { list: [], isPublic: false, isProtected: false, isPrivate: false, isStatic: false, isFinal: false, isAbstract: false };
  }
  const modSet = new Set(modifiers);
  let access = null;
  if (modSet.has("private"))        access = "private";
  else if (modSet.has("protected")) access = "protected";
  else if (modSet.has("public"))    access = "public";

  const norm = new Set();
  if (access) norm.add(access);
  for (const m of ["static", "final", "abstract", "synchronized"]) {
    if (modSet.has(m)) norm.add(m);
  }
  return {
    list: [...norm],
    isPublic: access === "public",
    isProtected: access === "protected",
    isPrivate: access === "private",
    isPackagePrivate: !access,
    isStatic: modSet.has("static"),
    isFinal: modSet.has("final"),
    isAbstract: modSet.has("abstract")
  };
};

// SOURCE-LEVEL: JDTLS does not include a field's declared type.
const extractFieldType = (line, fieldName) => {
  const re = new RegExp(`\\b([A-Za-z_][A-Za-z0-9_$.<>\\[\\]]*)\\s+${escapeRegExp(fieldName)}\\b`);
  const m = line.match(re);
  return m ? m[1] : null;
};

// SOURCE-LEVEL: JDTLS does not expose method return types either.
// Scan declaration line + a few lines of context above (modifiers /
// annotations may push the return type upward) for "<RT> <name>(".
const extractMethodReturnType = (text, startLine, methodName) => {
  const lines = normEol(text).split("\n");
  if (startLine < 0 || startLine >= lines.length) return null;
  const re = new RegExp(`\\b([A-Za-z_][A-Za-z0-9_$.<>\\[\\]]*)\\s+${escapeRegExp(methodName)}\\s*\\(`);
  const m = lines[startLine].match(re);
  if (m) return m[1];
  let combined = "";
  for (let i = Math.max(0, startLine - 4); i <= startLine; i++) combined += " " + lines[i];
  const m2 = combined.match(re);
  return m2 ? m2[1] : null;
};

// CUSTOM: JDTLS TypeHierarchyItem.detail is the package name for both
// in-workspace and external types, which is ambiguous. Resolve in
// order: workspace file -> packageByUri, detail already is FQN, detail
// is a package, fallback to simple name.
const resolveSupertypeFqn = (item, fileTextByUri, packageByUri) => {
  const superName = item.name;
  const superUri  = item.uri || "";
  const detail    = (item.detail || "").trim();
  if (superUri && fileTextByUri.has(superUri)) {
    const pkg = packageByUri.get(superUri) || "";
    return pkg ? `${pkg}.${superName}` : superName;
  }
  if (detail && detail.endsWith(`.${superName}`)) return detail;
  if (detail && detail.includes(".")) return `${detail}.${superName}`;
  return detail ? `${detail}.${superName}` : superName;
};

// =========================================================================
// SECTION 4 - IN-MEMORY GRAPH MODEL
// =========================================================================

const graph = { projectRoot: CONFIG.PROJECT_DIR, nodes: [], edges: [] };
const nodeSeen = new Set();
const edgeSeen = new Set();

const addNode = (node) => {
  if (!node || !node.id) return;
  if (nodeSeen.has(node.id)) return;
  nodeSeen.add(node.id);
  graph.nodes.push(node);
};

const addEdge = (from, to, type, props = {}) => {
  if (!from || !to || !type) return;
  const key = `${from}::${type}::${to}`;
  if (edgeSeen.has(key)) return;
  edgeSeen.add(key);
  graph.edges.push({ from, to, type, ...props });
};

// IDs encode URI + range so re-visiting the same source position
// produces the same node id (addNode dedupes naturally).
const idFile     = (uri) => `FILE:${uri}`;
const idMod      = (m) => `MOD:${m}`;
const idType     = (fqn) => `TYPE:${fqn}`;
const idDeclType = (kind, fqn) => `${kind.toUpperCase()}:${fqn}`;
const idMethod   = (containerFqn, sig, uri, range) => {
  const line = range?.start?.line ?? -1, ch = range?.start?.character ?? -1;
  return `METHOD:${containerFqn}::${sig}@${uri}#${line}:${ch}`;
};
const idField    = (containerFqn, name, uri, range) => {
  const line = range?.start?.line ?? -1, ch = range?.start?.character ?? -1;
  return `FIELD:${containerFqn}::${name}@${uri}#${line}:${ch}`;
};
const idParam    = (methodId, paramName, order) => `PARAM:${methodId}::${paramName}#${order}`;

// CUSTOM: secondary index (uri -> list of {range, nodeId}) so we can
// resolve an LSP Location (returned by callHierarchy) to a node we
// already created during the symbol pass.
const symbolIndexByUri = new Map();
const registerSymbol = (uri, range, nodeId, label, name) => {
  if (!uri || !range || !nodeId) return;
  if (!symbolIndexByUri.has(uri)) symbolIndexByUri.set(uri, []);
  symbolIndexByUri.get(uri).push({ range, nodeId, label, name });
};

const positionInRange = (pos, range) => {
  const { line, character } = pos;
  const s = range.start, e = range.end;
  if (line < s.line || line > e.line) return false;
  if (line === s.line && character < s.character) return false;
  if (line === e.line && character > e.character) return false;
  return true;
};

const findNodeForLocation = (loc) => {
  if (!loc || !loc.uri || !loc.range) return null;
  const list = symbolIndexByUri.get(loc.uri);
  if (!list) return null;
  const pos = loc.range.start;
  let best = null, bestSpan = Infinity;
  for (const it of list) {
    if (positionInRange(pos, it.range)) {
      const span = (it.range.end.line - it.range.start.line) * 1000
                 + (it.range.end.character - it.range.start.character);
      if (span < bestSpan) { best = it; bestSpan = span; }
    }
  }
  return best ? best.nodeId : null;
};

// =========================================================================
// SECTION 5 - CONCURRENCY HELPERS
// JDTLS will OOM if hammered with hundreds of parallel typeHierarchy /
// callHierarchy requests on a large project.
// =========================================================================

class Semaphore {
  constructor(max) { this.max = max; this.cur = 0; this.q = []; }
  async acquire() {
    if (this.cur < this.max) { this.cur++; return; }
    await new Promise(r => this.q.push(r));
    this.cur++;
  }
  release() {
    this.cur--;
    if (this.cur < 0) this.cur = 0;
    const n = this.q.shift();
    if (n) n();
  }
}

const semCall  = new Semaphore(CONFIG.CONCURRENCY.callHierarchy);
const semTypeH = new Semaphore(CONFIG.CONCURRENCY.typeHierarchy);

const withTimeout = (promise, ms, label) => {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout ${label}`)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); },
                 e => { clearTimeout(t); reject(e); });
  });
};

// CUSTOM: wraps conn.sendRequest in a timeout and converts any
// rejection into null. JDTLS occasionally throws NPEs on cast-expression
// call sites (ITypeBinding.isAnonymous) and we don't want one bad
// position to kill the whole extraction. The source-level fallback in
// section 8.9 recovers what gets lost here.
const safeRequest = async (conn, method, params, timeoutMs) => {
  try { return await withTimeout(conn.sendRequest(method, params), timeoutMs, method); }
  catch { return null; }
};

// =========================================================================
// SECTION 6 - JDTLS PROCESS LAUNCH
// JVM args copied verbatim from the official wiki:
// https://github.com/eclipse-jdtls/eclipse.jdt.ls/wiki/Running-the-JAVA-LS-server-from-the-command-line
// =========================================================================

const findLauncherJar = (pluginsDir) => {
  const jars = fs.readdirSync(pluginsDir)
    .filter(f => f.startsWith("org.eclipse.equinox.launcher_") && f.endsWith(".jar"))
    .sort().reverse();
  return jars.length ? path.join(pluginsDir, jars[0]) : null;
};

function startJdtls() {
  const serverDir = CONFIG.JDTLS_SERVER_DIR;
  const plugins   = path.join(serverDir, "plugins");
  const configWin = path.join(serverDir, "config_win");
  if (!exists(serverDir)) throw new Error(`JDTLS server directory does not exist: ${serverDir}`);
  if (!exists(plugins))   throw new Error(`JDTLS plugins directory missing: ${plugins}`);
  if (!exists(configWin)) throw new Error(`JDTLS config_win directory missing: ${configWin}`);

  const launcher = findLauncherJar(plugins);
  if (!launcher) throw new Error("Cannot find equinox launcher jar in plugins/");

  const args = [
    "-Declipse.application=org.eclipse.jdt.ls.core.id1",
    "-Dosgi.bundles.defaultStartLevel=4",
    "-Declipse.product=org.eclipse.jdt.ls.core.product",
    "-Dlog.level=ERROR",
    `-Xmx${CONFIG.XMX}`,
    "-jar", launcher,
    "-configuration", configWin,
    "-data", CONFIG.WORKSPACE_DIR
  ];

  const child = cp.spawn("java", args, { stdio: ["pipe", "pipe", "pipe"] });
  child.stderr.on("data", () => {}); // discard JDTLS startup chatter
  return child;
}

// =========================================================================
// SECTION 7 - GRAPH-BUILDING HELPERS
// =========================================================================

const ensureModifier = (m) => {
  const mid = idMod(m);
  addNode({ id: mid, label: "Modifier", name: m });
  return mid;
};

const ensureFile = (uri) => {
  addNode({ id: idFile(uri), label: "File", name: path.basename(fromUri(uri)), uri });
  return idFile(uri);
};

const ensureType = (fqn, kind = "Type", uri = "") => {
  const tid = (kind === "Type") ? idType(fqn) : idDeclType(kind, fqn);
  addNode({ id: tid, label: kind, name: fqn.split(".").slice(-1)[0], fqn, uri });
  return tid;
};

let allDeclaredFqns = null;

// CUSTOM: Java-style simple-name -> FQN resolution (mirrors JLS 6.3).
const mapTypeNameToFqn = (typeName, packageName, typeNameToFqn, imports) => {
  if (!typeName) return null;
  if (typeName.includes(".")) return typeName;
  if (imports) {
    const fromImport = imports.explicit.get(typeName);
    if (fromImport) return fromImport;
  }
  if (packageName && allDeclaredFqns) {
    const samePackageFqn = `${packageName}.${typeName}`;
    if (allDeclaredFqns.has(samePackageFqn)) return samePackageFqn;
  }
  if (imports && allDeclaredFqns) {
    for (const wPkg of imports.wildcards) {
      const candidate = `${wPkg}.${typeName}`;
      if (allDeclaredFqns.has(candidate)) return candidate;
    }
  }
  const hit = typeNameToFqn.get(typeName);
  if (hit) return hit;
  return packageName ? `${packageName}.${typeName}` : typeName;
};

// SOURCE-LEVEL: split parameter string into [{name, type, order}]
// handling nested generics that a naive split-on-comma would mangle.
const extractParams = (paramString) => {
  if (!paramString || !paramString.trim()) return [];
  const paramParts = [];
  let current = "", depth = 0;
  for (const c of paramString) {
    if (c === "<") depth++;
    else if (c === ">") depth--;
    else if (c === "," && depth === 0) {
      paramParts.push(current.trim());
      current = "";
      continue;
    }
    current += c;
  }
  if (current.trim()) paramParts.push(current.trim());

  const params = [];
  let order = 0;
  for (const part of paramParts) {
    const trimmed = part.trim();
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace > 0) {
      const type = trimmed.slice(0, lastSpace).trim();
      const name = trimmed.slice(lastSpace + 1).trim();
      if (name && !name.match(/^\d/)) {
        params.push({ name, type, order });
        order++;
      }
    }
  }
  return params;
};

// SOURCE-LEVEL: pull literal "(...)" param list out of a method signature.
const extractParamString = (sourceText, methodLine, methodName) => {
  const lines = normEol(sourceText).split("\n");
  let sig = "";
  let collected = false;
  for (let i = methodLine; i < Math.min(methodLine + 10, lines.length); i++) {
    const line = lines[i];
    sig += line + " ";
    if (line.includes("(")) collected = true;
    if (collected && line.includes(")")) break;
  }
  const m = sig.match(new RegExp(`${escapeRegExp(methodName)}\\s*\\(([^)]*)\\)`));
  return m ? m[1] : "";
};

// =========================================================================
// SECTION 8 - MAIN PIPELINE
// =========================================================================

(async () => {
  const t0 = Date.now();

  // ----- 8.1 Spawn JDTLS and open a JSON-RPC channel over its stdio.
  // Connection setup pattern is from the official vscode-jsonrpc README.
  const child = startJdtls();
  const conn = rpc.createMessageConnection(
    new rpc.StreamMessageReader(child.stdout),
    new rpc.StreamMessageWriter(child.stdin)
  );
  conn.onNotification(() => {});
  conn.listen();

  // ----- 8.2 LSP REQUEST: initialize
  const rootUri = toUri(CONFIG.PROJECT_DIR);
  const init = await safeRequest(conn, "initialize", {
    processId: process.pid,
    rootUri,
    workspaceFolders: [{ uri: rootUri, name: path.basename(CONFIG.PROJECT_DIR) }],
    capabilities: {
      textDocument: {
        documentSymbol: {},
        callHierarchy:  {},
        typeHierarchy:  {},
        references:     {}
      }
    }
  }, CONFIG.TIMEOUT.initialize);
  if (!init) { console.error("Failed to initialize JDTLS."); process.exit(1); }
  conn.sendNotification("initialized");

  // ----- 8.3 Read all .java sources into memory once.
  const files = findJavaFiles(CONFIG.PROJECT_DIR);

  const fileTextByUri = new Map();
  const packageByUri  = new Map();
  const typeNameToFqn = new Map();
  const importsByUri  = new Map();

  for (const f of files) {
    const uri = toUri(f);
    const text = fs.readFileSync(f, "utf8");
    fileTextByUri.set(uri, text);
    packageByUri.set(uri, parsePackageFromSource(text));
    importsByUri.set(uri, parseImports(text));
    ensureFile(uri);
  }

  const declaredTypes   = [];
  const declaredMethods = [];
  const declaredFields  = [];

  // ----- 8.4 PASS 1 - LSP REQUEST: textDocument/documentSymbol
  // Pre-scan every file to learn all declared types BEFORE we resolve
  // any simple type names.
  const preScannedSymbols = new Map();
  allDeclaredFqns = new Set();

  for (const [uri, text] of fileTextByUri.entries()) {
    // LSP NOTIFICATION: textDocument/didOpen - required before
    // documentSymbol so JDTLS owns the document state.
    conn.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId: "java", version: 1, text }
    });
    const symTree = await safeRequest(conn, "textDocument/documentSymbol",
      { textDocument: { uri } }, CONFIG.TIMEOUT.documentSymbol);
    if (!symTree) continue;

    const flat = [];
    (function walk(arr) {
      if (!Array.isArray(arr)) return;
      for (const s of arr) { flat.push(s); if (Array.isArray(s.children)) walk(s.children); }
    })(symTree);
    preScannedSymbols.set(uri, flat);

    const pkg = packageByUri.get(uri) || "";
    for (const s of flat) {
      const lbl = kindLabel(s.kind);
      if (lbl === "Class" || lbl === "Interface" || lbl === "Enum") {
        const fqn = pkg ? `${pkg}.${s.name}` : s.name;
        typeNameToFqn.set(s.name, fqn);
        allDeclaredFqns.add(fqn);
      }
    }
  }

  // ----- 8.5 PASS 2 - Build nodes & edges from the symbol tree.
  for (const [uri, text] of fileTextByUri.entries()) {
    const flat = preScannedSymbols.get(uri);
    if (!flat) continue;

    const pkg     = packageByUri.get(uri) || "";
    const imports = importsByUri.get(uri) || { explicit: new Map(), wildcards: [] };

    // ---- (a) Type declarations: Class / Interface / Enum
    for (const s of flat) {
      const lbl = kindLabel(s.kind);
      if (lbl !== "Class" && lbl !== "Interface" && lbl !== "Enum") continue;

      const simple = s.name;
      const fqn = pkg ? `${pkg}.${simple}` : simple;
      typeNameToFqn.set(simple, fqn);

      const typeNode = { id: idDeclType(lbl, fqn), label: lbl, name: simple, fqn, uri };
      if (pkg) typeNode.packageName = pkg;
      addNode(typeNode);
      addEdge(idDeclType(lbl, fqn), idFile(uri), "IN_FILE");
      registerSymbol(uri, s.location?.range || s.range, idDeclType(lbl, fqn), lbl, simple);
      declaredTypes.push({ kind: lbl, fqn, uri, range: s.location?.range || s.range });

      const line = (s.location?.range || s.range)?.start?.line ?? null;
      if (line == null) continue;

      const mods = normalizeModifiers(extractModifiers(text, line));
      for (const m of mods.list) addEdge(idDeclType(lbl, fqn), ensureModifier(m), "HAS_MODIFIER");

      const typeNodeRef = graph.nodes.find(n => n.id === idDeclType(lbl, fqn));
      if (typeNodeRef) {
        Object.assign(typeNodeRef, {
          isPublic:         mods.isPublic,
          isProtected:      mods.isProtected,
          isPrivate:        mods.isPrivate,
          isPackagePrivate: mods.isPackagePrivate,
          isStatic:         mods.isStatic,
          isFinal:          mods.isFinal,
          isAbstract:       mods.isAbstract
        });
      }
    }

    // ---- (b) Methods, constructors, fields
    for (const s of flat) {
      const lbl = kindLabel(s.kind);
      const rng = s.location?.range || s.range;
      if (!rng || !rng.start) continue;

      const containerSimple = normalizeContainerName(s.containerName);
      if (!containerSimple) continue;
      const containerFqn = mapTypeNameToFqn(containerSimple, pkg, typeNameToFqn, imports) || containerSimple;

      if (lbl === "Method" || lbl === "Constructor") {
        const sig = normalizeMethodSig(s.name);
        const mid = idMethod(containerFqn, sig, uri, rng);
        const startLine = rng.start.line;

        const mods        = normalizeModifiers(extractModifiers(text, startLine));
        const paramString = extractParamString(text, startLine, sig.split("(")[0]);
        const params      = extractParams(paramString);

        let returnType = "void", returnTypeRaw = null;
        if (lbl !== "Constructor") {
          const methodNameOnly = sig.split("(")[0];
          returnTypeRaw = extractMethodReturnType(text, startLine, methodNameOnly);
          if (returnTypeRaw && returnTypeRaw !== methodNameOnly) returnType = returnTypeRaw;
        }

        const methodNode = {
          id: mid,
          label: lbl === "Constructor" ? "Constructor" : "Method",
          name: sig,
          containerFqn,
          range: rng,
          returnType,
          isPublic: mods.isPublic,
          isProtected: mods.isProtected,
          isPrivate: mods.isPrivate,
          isPackagePrivate: mods.isPackagePrivate,
          isStatic: mods.isStatic,
          isFinal: mods.isFinal,
          isAbstract: mods.isAbstract
        };

        addNode(methodNode);
        addEdge(mid, idFile(uri), "IN_FILE");
        addEdge(ensureType(containerFqn, "Type", ""), mid, "DECLARES");
        registerSymbol(uri, rng, mid, "Method", sig);

        for (const m of mods.list) addEdge(mid, ensureModifier(m), "HAS_MODIFIER");

        if (lbl !== "Constructor" && returnTypeRaw && returnTypeRaw !== sig.split("(")[0]) {
          const baseType = returnTypeRaw.replace(/<[^>]*>/g, "");
          const rtFqn = mapTypeNameToFqn(baseType, pkg, typeNameToFqn, imports) || baseType;
          addEdge(mid, ensureType(rtFqn, "Type", ""), "RETURN_TYPE");
        }

        for (const param of params) {
          const pid = idParam(mid, param.name, param.order);
          const paramBaseType = param.type.replace(/<[^>]*>/g, "");
          const paramFqn = mapTypeNameToFqn(paramBaseType, pkg, typeNameToFqn, imports) || paramBaseType;

          addNode({ id: pid, label: "Parameter", name: param.name, type: param.type, order: param.order, methodId: mid });
          addEdge(mid, pid, "HAS_PARAMETER");
          addEdge(pid, ensureType(paramFqn, "Type", ""), "PARAMETER_TYPE");
        }

        declaredMethods.push({ mid, containerFqn, sig, uri, range: rng, kind: lbl, params, mods });
      }

      if (lbl === "Field") {
        const fieldName = s.name;
        const fid = idField(containerFqn, fieldName, uri, rng);
        const startLine = rng.start.line;
        const ftRaw = extractFieldType(getLine(text, startLine), fieldName);
        const fieldType = ftRaw || "Object";

        const mods = normalizeModifiers(extractModifiers(text, startLine));

        addNode({
          id: fid,
          label: "Field",
          name: fieldName,
          type: fieldType,
          containerFqn,
          range: rng,
          isPublic: mods.isPublic,
          isProtected: mods.isProtected,
          isPrivate: mods.isPrivate,
          isPackagePrivate: mods.isPackagePrivate,
          isStatic: mods.isStatic,
          isFinal: mods.isFinal
        });
        addEdge(fid, idFile(uri), "IN_FILE");
        const tnode = ensureType(containerFqn, "Type", "");
        addEdge(tnode, fid, "DECLARES");
        addEdge(tnode, fid, "HAS_FIELD");
        registerSymbol(uri, rng, fid, "Field", fieldName);

        for (const m of mods.list) addEdge(fid, ensureModifier(m), "HAS_MODIFIER");

        if (ftRaw) {
          const baseType = ftRaw.replace(/<[^>]*>/g, "");
          const ftFqn    = mapTypeNameToFqn(baseType, pkg, typeNameToFqn, imports) || baseType;
          addEdge(fid, ensureType(ftFqn, "Type", ""), "FIELD_TYPE");
        }

        declaredFields.push({ fid, containerFqn, name: fieldName, uri, range: rng, type: fieldType, mods });
      }
    }
  }

  // ----- 8.6 LSP REQUEST: textDocument/prepareTypeHierarchy + supertypes
  for (const t of declaredTypes) {
    await semTypeH.acquire();
    try {
      if (!t.range) continue;
      const prep = await safeRequest(conn, "textDocument/prepareTypeHierarchy",
        { textDocument: { uri: t.uri }, position: t.range.start },
        CONFIG.TIMEOUT.prepareTypeHierarchy);
      if (!prep || !prep[0]) continue;

      const sups = await safeRequest(conn, "typeHierarchy/supertypes",
        { item: prep[0] }, CONFIG.TIMEOUT.supertypes);
      if (!Array.isArray(sups)) continue;

      for (const s of sups) {
        const superKind = kindLabel(s.kind);
        const superFqn  = resolveSupertypeFqn(s, fileTextByUri, packageByUri);
        const superId   = ensureType(superFqn, (superKind === "Interface" ? "Interface" : "Class"), s.uri || "");
        const meId      = ensureType(t.fqn, t.kind, t.uri);

        if (superKind === "Interface") addEdge(meId, superId, "IMPLEMENTS");
        else                           addEdge(meId, superId, "EXTENDS");
      }
    } finally {
      semTypeH.release();
    }
  }

  // ----- 8.7 CUSTOM: Expand method body ranges (prerequisite for 8.9).
  for (const m of declaredMethods) {
    const text = fileTextByUri.get(m.uri);
    if (!text) continue;
    const expanded = expandMethodBodyRange(text, m.range);
    if (expanded !== m.range) m.range = expanded;
  }

  // ----- 8.8 LSP REQUEST: textDocument/prepareCallHierarchy + outgoingCalls
  for (const m of declaredMethods) {
    if (m.kind !== "Method" && m.kind !== "Constructor") continue;

    await semCall.acquire();
    try {
      const prep = await safeRequest(conn, "textDocument/prepareCallHierarchy",
        { textDocument: { uri: m.uri }, position: m.range.start },
        CONFIG.TIMEOUT.prepareCallHierarchy);
      if (!prep || !prep[0]) continue;

      const outgoing = await safeRequest(conn, "callHierarchy/outgoingCalls",
        { item: prep[0] }, CONFIG.TIMEOUT.outgoingCalls);
      if (!Array.isArray(outgoing)) continue;

      for (const oc of outgoing) {
        const toItem = oc.to;
        if (!toItem) continue;

        const loc = { uri: toItem.uri, range: toItem.selectionRange || toItem.range };
        let target = findNodeForLocation(loc);

        if (!target) {
          // Stub for a method we never declared ourselves.
          const tgtSig       = normalizeMethodSig(toItem.name || "<?>");
          const tgtContainer = normalizeContainerName(toItem.detail || "") || "<?>";
          let tgtPkg     = "";
          let tgtImports = null;
          if (toItem.uri && fileTextByUri.has(toItem.uri)) {
            tgtPkg     = packageByUri.get(toItem.uri) || "";
            tgtImports = importsByUri.get(toItem.uri);
          }
          const tgtContainerFqn = mapTypeNameToFqn(tgtContainer, tgtPkg, typeNameToFqn, tgtImports) || tgtContainer;
          target = idMethod(tgtContainerFqn, tgtSig, toItem.uri || "", toItem.selectionRange || toItem.range);
          addNode({ id: target, label: "Method", name: tgtSig, containerFqn: tgtContainerFqn, range: toItem.selectionRange || toItem.range });
          if (toItem.uri) addEdge(target, idFile(toItem.uri), "IN_FILE");
          addEdge(ensureType(tgtContainerFqn, "Type", ""), target, "DECLARES");
          if (toItem.uri && (toItem.selectionRange || toItem.range)) {
            registerSymbol(toItem.uri, toItem.selectionRange || toItem.range, target, "Method", tgtSig);
          }
        }
        addEdge(m.mid, target, "CALLS");
      }
    } finally {
      semCall.release();
    }
  }

  // ----- 8.9 SOURCE-LEVEL CALLS FALLBACK
  // JDTLS occasionally throws ITypeBinding.isAnonymous NPEs on cast
  // expressions and silently drops outgoing calls for the affected
  // method. To recover delegation that pattern detection depends on
  // (Strategy / Decorator / Observer / Composite), regex-scan each
  // method body for three shapes:
  //   A) field.method(   - field delegation
  //   B) this.method(    - explicit same-class call
  //   C) method(         - bare same-class call
  //
  // For (A) we additionally upgrade the resolved target: if the
  // field's declared type is an interface and the regex resolved to
  // an implementor's method, also add a CALLS edge to the matching
  // method on the interface itself. Without this, queries that match
  // on "calledMethod.containerFqn = interface.fqn" miss the
  // delegation -- this is what unblocks JUnit TestDecorator detection.
  const fieldsByContainerSrc = new Map();
  for (const f of declaredFields) {
    if (!fieldsByContainerSrc.has(f.containerFqn)) fieldsByContainerSrc.set(f.containerFqn, []);
    fieldsByContainerSrc.get(f.containerFqn).push(f);
  }
  const methodsByContainerSrc = new Map();
  for (const m of declaredMethods) {
    if (!methodsByContainerSrc.has(m.containerFqn)) methodsByContainerSrc.set(m.containerFqn, []);
    methodsByContainerSrc.get(m.containerFqn).push(m);
  }

  const implementorsByInterface = new Map();
  for (const e of graph.edges) {
    if (e.type !== "IMPLEMENTS") continue;
    const targetNode = graph.nodes.find(n => n.id === e.to);
    if (!targetNode || targetNode.label !== "Interface") continue;
    const sourceNode = graph.nodes.find(n => n.id === e.from);
    if (!sourceNode || !sourceNode.fqn) continue;
    if (!implementorsByInterface.has(targetNode.fqn)) implementorsByInterface.set(targetNode.fqn, new Set());
    implementorsByInterface.get(targetNode.fqn).add(sourceNode.fqn);
  }

  const findDelegationTarget = (fieldFqn, calledName) => {
    const directMs = methodsByContainerSrc.get(fieldFqn) || [];
    const directHit = directMs.find(tm => tm.sig.split("(")[0] === calledName);
    if (directHit) return directHit;
    const impls = implementorsByInterface.get(fieldFqn);
    if (impls) {
      for (const implFqn of impls) {
        const implMs = methodsByContainerSrc.get(implFqn) || [];
        const implHit = implMs.find(tm => tm.sig.split("(")[0] === calledName);
        if (implHit) return implHit;
      }
    }
    return null;
  };

  // Java reserved words to filter from pattern (C). Source: JLS 3.9
  // https://docs.oracle.com/javase/specs/jls/se17/html/jls-3.html#jls-3.9
  const JAVA_KEYWORDS = new Set([
    "if","while","for","switch","catch","try","return","new","super","this","throw",
    "instanceof","synchronized","assert","do","else","case","break","continue",
    "default","final","class","interface","extends","implements","import","package",
    "static","public","private","protected","abstract","native","volatile",
    "transient","strictfp","enum","void","boolean","int","long","short","byte",
    "char","float","double","null","true","false","String","Object","System","Math"
  ]);

  for (const m of declaredMethods) {
    if (m.kind !== "Method" && m.kind !== "Constructor") continue;
    const text = fileTextByUri.get(m.uri);
    if (!text) continue;
    const pkg     = packageByUri.get(m.uri) || "";
    const imports = importsByUri.get(m.uri) || { explicit: new Map(), wildcards: [] };
    const body = sliceTextByRange(text, m.range);
    if (!body || body.length < 5) continue;

    const myFields  = fieldsByContainerSrc.get(m.containerFqn) || [];
    const myMethods = methodsByContainerSrc.get(m.containerFqn) || [];

    // Patterns A + B
    const delegateRe = /\b(this|[a-z_$][a-zA-Z0-9_$]*)\s*\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    let dm;
    while ((dm = delegateRe.exec(body)) !== null) {
      const receiver   = dm[1];
      const calledName = dm[2];

      if (receiver === "this") {
        const target = myMethods.find(tm => tm.sig.split("(")[0] === calledName && tm.mid !== m.mid);
        if (target) addEdge(m.mid, target.mid, "CALLS");
      } else {
        const field = myFields.find(f => f.name === receiver);
        if (!field) continue;
        const baseType = field.type.replace(/<[^>]*>/g, "");
        const fieldFqn = mapTypeNameToFqn(baseType, pkg, typeNameToFqn, imports) || baseType;

        const target = findDelegationTarget(fieldFqn, calledName);
        if (target) {
          addEdge(m.mid, target.mid, "CALLS");

          // Interface uplift: also link to the interface's own method.
          if (target.containerFqn && target.containerFqn !== fieldFqn
              && implementorsByInterface.has(fieldFqn)) {
            const ifaceMs = methodsByContainerSrc.get(fieldFqn) || [];
            const ifaceHit = ifaceMs.find(tm => tm.sig.split("(")[0] === calledName);
            if (ifaceHit) {
              addEdge(m.mid, ifaceHit.mid, "CALLS");
            } else {
              const synSig = `${calledName}(?)`;
              const synId  = `METHOD:${fieldFqn}::${synSig}@interface-delegation`;
              if (!nodeSeen.has(synId)) {
                addNode({ id: synId, label: "Method", name: synSig, containerFqn: fieldFqn, isSynthetic: true });
                addEdge(ensureType(fieldFqn, "Type", ""), synId, "DECLARES");
              }
              addEdge(m.mid, synId, "CALLS");
            }
          }
        } else {
          // External type -> synthesise stub.
          const synSig = `${calledName}(?)`;
          const synId  = `METHOD:${fieldFqn}::${synSig}@synthetic`;
          if (!nodeSeen.has(synId)) {
            addNode({ id: synId, label: "Method", name: synSig, containerFqn: fieldFqn, isSynthetic: true });
            addEdge(ensureType(fieldFqn, "Type", ""), synId, "DECLARES");
          }
          addEdge(m.mid, synId, "CALLS");
        }
      }
    }

    // Pattern C
    const bareCallRe = /(?<![.\w])([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    let bc;
    while ((bc = bareCallRe.exec(body)) !== null) {
      const calledName = bc[1];
      if (JAVA_KEYWORDS.has(calledName)) continue;
      const target = myMethods.find(tm => tm.sig.split("(")[0] === calledName && tm.mid !== m.mid);
      if (target) addEdge(m.mid, target.mid, "CALLS");
    }
  }

  // ----- 8.10 SOURCE-LEVEL: Field injection (isInjected flag)
  // Mark a field as isInjected when same-class constructor body
  // contains "this.<field> = <param>" and <param> is a constructor
  // parameter. Used by Strategy pattern query (P4).
  const fieldNodeLookup = new Map();
  for (const n of graph.nodes) if (n.label === "Field") fieldNodeLookup.set(n.id, n);
  const fieldsByContainerInj = new Map();
  for (const f of declaredFields) {
    if (!fieldsByContainerInj.has(f.containerFqn)) fieldsByContainerInj.set(f.containerFqn, []);
    fieldsByContainerInj.get(f.containerFqn).push(f);
  }

  for (const m of declaredMethods) {
    const containerSimple   = m.containerFqn.split(".").pop();
    const methodSimpleName  = m.sig.split("(")[0];
    const isConstructorLike = m.kind === "Constructor" || methodSimpleName === containerSimple;
    if (!isConstructorLike) continue;
    const text = fileTextByUri.get(m.uri);
    if (!text) continue;
    const body = sliceTextByRange(text, m.range);
    if (!body) continue;
    const paramNames = new Set(m.params.map(p => p.name));
    if (paramNames.size === 0) continue;

    const assignRe = /\bthis\s*\.\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    let am;
    while ((am = assignRe.exec(body)) !== null) {
      const fieldName    = am[1];
      const assignedFrom = am[2];
      if (!paramNames.has(assignedFrom)) continue;
      const matched = (fieldsByContainerInj.get(m.containerFqn) || []).find(f => f.name === fieldName);
      if (!matched) continue;
      const fNode = fieldNodeLookup.get(matched.fid);
      if (fNode) fNode.isInjected = true;
    }
  }

  // ----- 8.11 SOURCE-LEVEL: CREATES from "new X("
  // Used by Factory Method query: ConcreteCreator.factoryMethod
  // CREATES ConcreteProduct.
  const parseCreates = (bodyText) => {
    const out = new Set();
    const re = /\bnew\s+([A-Z][A-Za-z0-9_]*)\s*\(/g;
    let m;
    while ((m = re.exec(bodyText)) !== null) out.add(m[1]);
    return [...out];
  };

  for (const m of declaredMethods) {
    if (m.kind !== "Method" && m.kind !== "Constructor") continue;
    const text = fileTextByUri.get(m.uri);
    if (!text) continue;
    const pkg     = packageByUri.get(m.uri) || "";
    const imports = importsByUri.get(m.uri) || { explicit: new Map(), wildcards: [] };
    for (const cn of parseCreates(sliceTextByRange(text, m.range))) {
      const cfqn = mapTypeNameToFqn(cn, pkg, typeNameToFqn, imports) || cn;
      addEdge(m.mid, ensureType(cfqn, "Type", ""), "CREATES");
    }
  }

  // ----- 8.12 CUSTOM: OVERRIDES inference (transitive)
  // LSP has no override relation. Compute by walking EXTENDS/IMPLEMENTS
  // chains and matching method signatures. Transitive walk: if
  // A extends B extends C, A's methods can override matches on BOTH
  // B and C (e.g. DecoratorFigure -> AbstractFigure -> Figure).
  const methodsByType = new Map();
  for (const m of declaredMethods) {
    if (!methodsByType.has(m.containerFqn)) methodsByType.set(m.containerFqn, new Map());
    methodsByType.get(m.containerFqn).set(m.sig, m.mid);
  }

  const supersByType = new Map();
  for (const e of graph.edges) {
    if (e.type !== "EXTENDS" && e.type !== "IMPLEMENTS") continue;
    if (!supersByType.has(e.from)) supersByType.set(e.from, []);
    supersByType.get(e.from).push(e.to);
  }

  const fqnByNode = new Map();
  for (const n of graph.nodes) {
    if (n.label === "Type" || n.label === "Class" || n.label === "Interface" || n.label === "Enum") {
      if (n.fqn) fqnByNode.set(n.id, n.fqn);
      else if (n.name) fqnByNode.set(n.id, n.name);
    }
  }

  const getAllSupertypeFqns = (startNodeId, visited = new Set()) => {
    const result = [];
    for (const superNode of supersByType.get(startNodeId) || []) {
      if (visited.has(superNode)) continue;
      visited.add(superNode);
      const superFqn = fqnByNode.get(superNode);
      if (superFqn) result.push(superFqn);
      result.push(...getAllSupertypeFqns(superNode, visited));
    }
    return result;
  };

  for (const [fromNode, _] of supersByType.entries()) {
    const subFqn = fqnByNode.get(fromNode);
    if (!subFqn) continue;
    const subMethods = methodsByType.get(subFqn);
    if (!subMethods) continue;

    for (const superFqn of getAllSupertypeFqns(fromNode)) {
      const superMethods = methodsByType.get(superFqn);
      if (!superMethods) continue;
      for (const [sig, subMid] of subMethods.entries()) {
        const superMid = superMethods.get(sig);
        if (superMid) addEdge(subMid, superMid, "OVERRIDES");
      }
    }
  }

  // ----- 8.13 CUSTOM: Constructor relabel pass
  // JDTLS sometimes reports a constructor as kind=6 (Method) instead
  // of kind=9 (Constructor). Catch the slip-through by name match.
  for (const m of declaredMethods) {
    if (m.kind === "Constructor") continue;
    const containerSimple = m.containerFqn.split(".").pop();
    const methodName = m.sig.split("(")[0];
    if (methodName === containerSimple) {
      m.kind = "Constructor";
      const node = graph.nodes.find(n => n.id === m.mid);
      if (node) node.label = "Constructor";
    }
  }

  // ----- 8.14 CUSTOM: Modifier exclusivity
  // If the modifier-extraction regex leaks more than one access
  // modifier onto the same member, keep only the most restrictive.
  const memberAccessMods = new Map();
  const hasModEdges = graph.edges.map((e, idx) => ({ ...e, _idx: idx })).filter(e => e.type === "HAS_MODIFIER");
  for (const edge of hasModEdges) {
    const modNode = graph.nodes.find(n => n.id === edge.to);
    const modName = modNode?.name;
    if (!modName) continue;
    if (!memberAccessMods.has(edge.from)) memberAccessMods.set(edge.from, []);
    if (["public", "protected", "private"].includes(modName)) {
      const priority = { "private": 3, "protected": 2, "public": 1 };
      memberAccessMods.get(edge.from).push({ modName, idx: edge._idx, priority: priority[modName] });
    }
  }
  const removeIdxs = new Set();
  for (const [, mods] of memberAccessMods.entries()) {
    if (mods.length > 1) {
      mods.sort((a, b) => b.priority - a.priority);
      for (let i = 1; i < mods.length; i++) removeIdxs.add(mods[i].idx);
    }
  }
  if (removeIdxs.size > 0) graph.edges = graph.edges.filter((e, idx) => !removeIdxs.has(idx));

  // ----- 8.15 Write output JSON
  fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(graph, null, 2));

  // =========================================================================
  // SECTION 9 - FINAL SUMMARY
  // =========================================================================

  const nodesByLabel = {};
  for (const n of graph.nodes) nodesByLabel[n.label] = (nodesByLabel[n.label] || 0) + 1;
  const edgesByType = {};
  for (const e of graph.edges) edgesByType[e.type] = (edgesByType[e.type] || 0) + 1;

  const sortedNodes = Object.entries(nodesByLabel).sort((a, b) => b[1] - a[1]);
  const sortedEdges = Object.entries(edgesByType).sort((a, b) => b[1] - a[1]);

  const fileSizeMb = (fs.statSync(CONFIG.OUTPUT_FILE).size / 1024 / 1024).toFixed(2);
  const durationS  = ((Date.now() - t0) / 1000).toFixed(1);
  const fmt = (n) => String(n).padStart(8, " ");
  const pad = (s, w) => s.padEnd(w, " ");

  const line = "=".repeat(56);
  console.log("");
  console.log(line);
  console.log("  EXTRACTION COMPLETE");
  console.log(line);
  console.log(`  Project:      ${CONFIG.PROJECT_DIR}`);
  console.log(`  Java files:   ${files.length}`);
  console.log(`  Duration:     ${durationS}s`);
  console.log(`  Output file:  ${CONFIG.OUTPUT_FILE}  (${fileSizeMb} MB)`);
  console.log("");
  console.log("  NODES BY LABEL");
  console.log("  " + "-".repeat(40));
  for (const [label, count] of sortedNodes) {
    console.log(`    ${pad(label, 20)}  ${fmt(count)}`);
  }
  console.log("  " + "-".repeat(40));
  console.log(`    ${pad("TOTAL", 20)}  ${fmt(graph.nodes.length)}`);
  console.log("");
  console.log("  EDGES BY TYPE");
  console.log("  " + "-".repeat(40));
  for (const [type, count] of sortedEdges) {
    console.log(`    ${pad(type, 20)}  ${fmt(count)}`);
  }
  console.log("  " + "-".repeat(40));
  console.log(`    ${pad("TOTAL", 20)}  ${fmt(graph.edges.length)}`);
  console.log(line);
  console.log("");

  // ----- 8.16 Shut down JDTLS
  try { await safeRequest(conn, "shutdown", {}, 5000); } catch {}
  conn.sendNotification("exit");
  try { child.kill(); } catch {}
  process.exit(0);
})().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
