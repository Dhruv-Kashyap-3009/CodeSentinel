import { describe, expect, it } from 'vitest';
import { chunkSource } from '../../src/services/chunker.js';

const cases = [
  ['javascript', 'import x from "x";\nfunction one(){ return 1; }\nfunction two(){ return 2; }', 'import x from'],
  ['python', 'import os\ndef one():\n    return 1\ndef two():\n    return 2', 'import os'],
  ['java', 'import java.util.List;\nclass A { int one() { return 1; } int two() { return 2; } }', 'import java.util.List'],
  ['c', '#include <stdio.h>\nint one(){ return 1; }\nint two(){ return 2; }', '#include'],
  ['cpp', '#include <iostream>\nclass A { int one(){ return 1; } };\nint two(){ return 2; }', '#include'],
  ['html', '<main>one</main>\n<section>two</section>', '<main>'],
  ['css', '.a { color: red; }\n.b { color: blue; }', '.a {'],
  ['sql', 'SELECT id FROM a;\nSELECT id FROM b;', 'SELECT id FROM a;'],
];
describe('chunkSource', () => {
  it.each(cases)('returns source chunks for %s without losing content', async (language, code, importOrContent) => {
    const chunks = await chunkSource(code, language, { maxChars: 200 });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.map((chunk) => chunk.source).join('\n')).toContain(importOrContent);
    expect(chunks.every((chunk) => chunk.language === language && chunk.startLine > 0 && chunk.endLine >= chunk.startLine)).toBe(true);
  });
  it('returns no chunks for empty input', async () => expect(await chunkSource('', 'javascript')).toEqual([]));
  it('keeps imports attached and preserves source line offsets', async () => {
    const source = 'import lib from "lib";\n\nfunction first() {\n return 1;\n}\nfunction second() {\n return 2;\n}';
    const chunks = await chunkSource(source, 'javascript');
    expect(chunks.every((chunk) => chunk.imports.includes('import lib from "lib";'))).toBe(true);
    expect(chunks.some((chunk) => chunk.startLine >= 6)).toBe(true);
  });
  it('falls back to whole source on syntax errors when parser is available or lexical fallback fails safely', async () => {
    const code = 'function broken( {\n  const value = 1;';
    const chunks = await chunkSource(code, 'javascript');
    expect(chunks.map((chunk) => chunk.source).join('\n')).toContain('const value');
  });
  it('does not silently drop large top-level content', async () => {
    const code = `${'// preserved\n'.repeat(120)}function large(){\n${'return 1;\n'.repeat(200)}}`;
    const chunks = await chunkSource(code, 'javascript', { maxChars: 200 });
    expect(chunks.map((chunk) => chunk.source).join('\n')).toContain('// preserved');
    expect(chunks.at(-1).endLine).toBe(code.split('\n').length);
  });
});
