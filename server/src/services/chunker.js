import { config } from '../config/env.js';

const nodeTypes = {
  javascript: new Set(['function_declaration', 'method_definition', 'class_declaration', 'lexical_declaration', 'arrow_function']),
  python: new Set(['function_definition', 'class_definition']),
  java: new Set(['method_declaration', 'constructor_declaration', 'class_declaration', 'interface_declaration']),
  c: new Set(['function_definition', 'struct_specifier']),
  cpp: new Set(['function_definition', 'class_specifier', 'struct_specifier']),
};
const grammarNames = { javascript: 'javascript', python: 'python', java: 'java', c: 'c', cpp: 'cpp' };
let parserPromise;

async function getParser(language) {
  if (!nodeTypes[language]) return null;
  parserPromise ??= (async () => {
    try {
      const { Parser, Language } = await import('web-tree-sitter');
      await Parser.init();
      return { Parser, Language };
    } catch { return null; }
  })();
  const runtime = await parserPromise;
  if (!runtime) return null;
  try {
    const { fileURLToPath } = await import('node:url');
    const { existsSync } = await import('node:fs');
    const wasmPath = fileURLToPath(new URL(`../../../node_modules/tree-sitter-wasms/out/tree-sitter-${grammarNames[language]}.wasm`, import.meta.url));
    if (!existsSync(wasmPath)) return null;
    const parser = new runtime.Parser();
    const loaded = await runtime.Language.load(wasmPath);
    parser.setLanguage(loaded);
    return parser;
  } catch { return null; }
}

function lexicalUnits(code, language) {
  if (!['javascript', 'python', 'java', 'c', 'cpp'].includes(language)) return [];
  const lines = code.split('\n');
  const units = [];
  const startPattern = language === 'python'
    ? /^(\s*)(?:async\s+)?(?:def|class)\s+([\w]+)/
    : /^\s*(?:(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*([\w$]*)|(?:export\s+)?class\s+([\w$]+)|(?:public|private|protected|static|inline|constexpr|virtual|auto|void|int|char|bool|double|float|long|unsigned|\w+\s*[*&]?)\s+([\w~]+)\s*\([^;]*\)\s*(?:const\s*)?\{|(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/;
  let openStart = -1; let depth = 0; let quote = ''; let name = '';
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (openStart < 0) {
      const match = line.match(startPattern);
      if (!match) continue;
      openStart = index;
      name = match.slice(2).find(Boolean) ?? `unit-${index + 1}`;
      if (language === 'python') {
        const baseIndent = match[1].length;
        let end = index + 1;
        while (end < lines.length && (!lines[end].trim() || lines[end].match(/^\s*/)[0].length > baseIndent)) end += 1;
        units.push({ name, startLine: index + 1, endLine: Math.max(index + 1, end) });
        index = end - 1; openStart = -1; continue;
      }
      depth = 0;
    }
    for (const char of line) {
      if (quote) { if (char === quote) quote = ''; continue; }
      if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
    }
    if (openStart >= 0 && depth <= 0 && line.includes('{')) {
      units.push({ name, startLine: openStart + 1, endLine: index + 1 });
      openStart = -1;
    }
  }
  return units;
}
function extractImports(source, language) {
  const patterns = {
    javascript: /^\s*(?:import\s.+|export\s.+\sfrom\s.+|const\s+.+\s*=\s*require\(.+\)).*$/,
    python: /^\s*(?:from\s+\S+\s+import\s+.+|import\s+.+)$/,
    java: /^\s*import\s+.+;/,
    c: /^\s*#\s*include\s*[<"].+[>"]/, cpp: /^\s*#\s*include\s*[<"].+[>"]/, 
  };
  const pattern = patterns[language];
  return pattern ? source.split('\n').filter((line) => pattern.test(line)) : [];
}

function createWholeChunk(code, language, name = 'source') {
  const source = code;
  return [{ language, name, startLine: 1, endLine: Math.max(1, source.split('\n').length), source, imports: extractImports(source, language) }];
}

export async function chunkSource(code, language, options = {}) {
  if (!code) return [];
  const maxChars = options.maxChars ?? config.maxChunkChars;
  let structures = [];
  const parser = await getParser(language);
  if (parser) {
    try {
      const tree = parser.parse(code);
      if (tree.rootNode.hasError) return createWholeChunk(code, language);
      const candidates = [];
      const visit = (node) => {
        if (nodeTypes[language]?.has(node.type)) candidates.push(node);
        for (const child of node.children) visit(child);
      };
      visit(tree.rootNode);
      const selected = candidates.filter((node) => !candidates.some((other) => other !== node && other.startIndex <= node.startIndex && other.endIndex >= node.endIndex));
      structures = selected.map((node) => ({ name: node.type, startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1 }));
      tree.delete?.();
    } catch { structures = []; }
  }
  if (!structures.length) structures = lexicalUnits(code, language);
  if (!structures.length && ['html', 'css', 'sql'].includes(language)) {
    const lines = code.split('\n');
    const separators = language === 'html' ? /<\/(?:section|article|main|div|body|html)>/i : language === 'css' ? /}\s*$/ : /;\s*$/;
    let start = 0;
    lines.forEach((line, index) => {
      if (separators.test(line) && index > start) { structures.push({ name: `${language}-block-${structures.length + 1}`, startLine: start + 1, endLine: index + 1 }); start = index + 1; }
    });
    if (start < lines.length) structures.push({ name: `${language}-block-${structures.length + 1}`, startLine: start + 1, endLine: lines.length });
  }
  if (!structures.length || structures.length === 1 && code.length <= maxChars) return createWholeChunk(code, language);

  const lines = code.split('\n');
  const imports = extractImports(code, language);
  const chunks = [];
  let cursor = 1;
  for (const unit of structures) {
    if (unit.startLine > cursor) {
      const start = cursor; const end = unit.startLine - 1;
      const source = lines.slice(start - 1, end).join('\n');
      if (source.trim()) chunks.push({ language, name: 'context', startLine: start, endLine: end, source, imports });
    }
    const start = Math.max(cursor, unit.startLine); const end = Math.max(start, unit.endLine);
    const source = lines.slice(start - 1, end).join('\n');
    if (source.trim()) {
      if (source.length <= maxChars) chunks.push({ language, name: unit.name, startLine: start, endLine: end, source, imports });
      else {
        const block = Math.max(1, Math.floor(maxChars / 100));
        for (let offset = start; offset <= end; offset += block) {
          const partEnd = Math.min(end, offset + block - 1);
          chunks.push({ language, name: unit.name, startLine: offset, endLine: partEnd, source: lines.slice(offset - 1, partEnd).join('\n'), imports });
        }
      }
    }
    cursor = end + 1;
  }
  if (cursor <= lines.length) {
    const source = lines.slice(cursor - 1).join('\n');
    if (source.trim()) chunks.push({ language, name: 'context', startLine: cursor, endLine: lines.length, source, imports });
  }
  return chunks.length ? chunks : createWholeChunk(code, language);
}

export { extractImports, nodeTypes };
