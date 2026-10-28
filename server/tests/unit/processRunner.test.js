import { describe, expect, it } from 'vitest';
import { candidateDirectories, quoteForCmd } from '../../src/utils/processRunner.js';

describe('quoteForCmd', () => {
  it('leaves simple tokens untouched', () => {
    expect(quoteForCmd('eslint')).toBe('eslint');
    expect(quoteForCmd('--format')).toBe('--format');
  });

  it('quotes paths that contain spaces', () => {
    expect(quoteForCmd('C:\\Users\\Ada Lovelace\\submitted.js')).toBe('"C:\\Users\\Ada Lovelace\\submitted.js"');
  });

  it('doubles embedded quotes and protects shell metacharacters', () => {
    expect(quoteForCmd('say "hi"')).toBe('"say ""hi"""');
    expect(quoteForCmd('a&b|c')).toBe('"a&b|c"');
  });
});

describe('candidateDirectories', () => {
  it('searches the workspace node_modules/.bin fallback', () => {
    const directories = candidateDirectories().map((directory) => directory.replace(/\\/g, '/'));
    expect(directories.some((directory) => directory.endsWith('/node_modules/.bin'))).toBe(true);
  });
});
