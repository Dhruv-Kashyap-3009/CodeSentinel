import { describe, expect, it } from 'vitest';
import { detectLanguage } from '../../src/services/languageDetector.js';

describe('detectLanguage', () => {
  it.each([
    ['javascript', 'const x = 1;', 'app.jsx'], ['java', 'class Main {}', 'Main.java'], ['python', 'def run(): pass', 'run.py'],
    ['c', '#include <stdio.h>', 'main.c'], ['cpp', '#include <iostream>', 'main.cpp'], ['html', '<!doctype html>', 'index.htm'],
    ['css', '.card { color: red; }', 'app.css'], ['sql', 'SELECT id FROM users;', 'users.sql'],
  ])('detects %s from an extension', (language, code, filename) => expect(detectLanguage(code, filename).language).toBe(language));
  it('gives a valid explicit override precedence over the filename', () => expect(detectLanguage('<main/>', 'index.html', 'javascript')).toMatchObject({ language: 'javascript', method: 'explicit' }));
  it('uses content clues without claiming certainty', () => expect(detectLanguage('def fetch():\n    return 1').method).toBe('content-heuristic'));
  it('examines .h content to separate C and C++', () => {
    expect(detectLanguage('int main(void) { return 0; }', 'main.h').language).toBe('c');
    expect(detectLanguage('namespace core { class A {}; }', 'core.h').language).toBe('cpp');
  });
  it('rejects unsupported override names', () => expect(() => detectLanguage('x', undefined, 'rust')).toThrow(/Unsupported language/));
  it('handles empty source deterministically', () => expect(detectLanguage('')).toMatchObject({ language: 'javascript', confidence: 0 }));
});
