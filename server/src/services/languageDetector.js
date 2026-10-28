import { languages } from '../schemas/review.js';

const extensions = new Map([
  ['.js', 'javascript'], ['.jsx', 'javascript'], ['.mjs', 'javascript'], ['.cjs', 'javascript'],
  ['.java', 'java'], ['.py', 'python'], ['.c', 'c'], ['.cpp', 'cpp'], ['.cc', 'cpp'], ['.cxx', 'cpp'],
  ['.hpp', 'cpp'], ['.hh', 'cpp'], ['.hxx', 'cpp'], ['.html', 'html'], ['.htm', 'html'],
  ['.css', 'css'], ['.sql', 'sql'],
]);
const checks = [
  ['sql', /\b(SELECT\s+.+\s+FROM|CREATE\s+TABLE|INSERT\s+INTO|UPDATE\s+\w+\s+SET)\b/i],
  ['html', /<!doctype\s+html|<html\b|<(?:div|main|section|body|script)\b/i],
  ['css', /(?:^|})\s*[^\n{}]+\s*\{[^{}]*(?:\b(?:color|display|margin|padding|font)\s*:)/i],
  ['python', /^\s*(?:def\s+\w+\s*\(|class\s+\w+|from\s+\w+\s+import|import\s+\w+)|\bprint\s*\(/m],
  ['java', /\b(?:public|private|protected)\s+(?:static\s+)?(?:class|interface|enum)\b|\bSystem\.out\.println\b/],
  ['cpp', /#include\s*<[^>]+>|\bstd::|\bnamespace\s+\w+/],
  ['c', /#include\s*<(?:stdio|stdlib|string|unistd)\.h>|\b(?:printf|scanf|malloc|free)\s*\(/],
  ['javascript', /\b(?:const|let|var)\s+\w+\s*=|\b(?:function\s*\w*|=>)\b|\bconsole\.log\s*\(/],
];

export function detectLanguage(code = '', filename, explicitLanguage) {
  if (explicitLanguage !== undefined && explicitLanguage !== null && explicitLanguage !== '' && !languages.includes(explicitLanguage.toLowerCase())) {
    const error = new Error(`Unsupported language "${explicitLanguage}". Supported languages: ${languages.join(', ')}.`);
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  if (explicitLanguage) return { language: explicitLanguage.toLowerCase(), method: 'explicit', confidence: 1 };
  const extension = filename?.match(/\.[^./\\]+$/)?.[0]?.toLowerCase();
  if (extension === '.h') {
    const header = /\b(?:std::|namespace\s+\w+|template\s*<|class\s+\w+)/.test(code) ? 'cpp' : 'c';
    return { language: header, method: 'filename-and-content', confidence: 0.65 };
  }
  if (extension && extensions.has(extension)) return { language: extensions.get(extension), method: 'filename', confidence: 0.9 };
  const matches = checks.filter(([, pattern]) => pattern.test(code)).map(([language]) => language);
  if (matches.length === 1) return { language: matches[0], method: code.trim() ? 'content-heuristic' : 'default', confidence: code.trim() ? 0.62 : 0 };
  if (matches.includes('cpp') && matches.includes('c')) return { language: 'cpp', method: 'content-heuristic', confidence: 0.55 };
  if (matches.includes('html') && matches.includes('javascript') && /<script\b/i.test(code)) return { language: 'html', method: 'content-heuristic', confidence: 0.55 };
  return { language: 'javascript', method: code.trim() ? 'default-heuristic' : 'default', confidence: 0 };
}

export { extensions as languageExtensions };
