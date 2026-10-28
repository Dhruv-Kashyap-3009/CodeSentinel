import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/services/analyzers/index.js';
import { isAvailable } from '../../src/utils/processRunner.js';

const eslintReady = await isAvailable('eslint');

describe('javascript analyzer', () => {
  it.skipIf(!eslintReady)('returns real ESLint findings for submitted code', async () => {
    const { findings, warnings } = await analyze('var unused = 1;\nfunction f(a){ return a == null; }\n', 'javascript');
    expect(warnings).toEqual([]);
    const messages = findings.map((finding) => finding.message);
    expect(messages.some((message) => message.includes('no-unused-vars'))).toBe(true);
    expect(messages.some((message) => message.includes('eqeqeq'))).toBe(true);
    expect(findings.every((finding) => finding.sourceTool === 'ESLint' && finding.line >= 1)).toBe(true);
  });

  it('reports missing tools as warnings instead of failures', async () => {
    const { findings, warnings } = await analyze('SELECT * FROM users;\n', 'sql');
    expect(Array.isArray(findings)).toBe(true);
    if (!(await isAvailable('sqlfluff'))) expect(warnings.some((warning) => warning.includes('SQLFluff'))).toBe(true);
  });
});
