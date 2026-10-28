import { fileURLToPath } from 'node:url';
import { config } from '../../config/env.js';
import { runTool, withTemporarySource } from '../../utils/processRunner.js';
import { makeFinding, validateFindings, warningFor } from './baseAnalyzer.js';

// Our own flat config, so pasted code never runs the reviewed project's rules.
const eslintConfig = fileURLToPath(new URL('./eslint.config.mjs', import.meta.url));

const definitions = {
  javascript: [{ name: 'ESLint', executable: config.eslintPath, extension: '.js', args: (file) => ['--format', 'json', '--config', eslintConfig, file], parse: (text) => JSON.parse(text).flatMap((file) => file.messages.filter((item) => !item.fatal && item.severity > 0).map((item) => makeFinding({ line: item.line, severity: item.severity === 2 ? 'high' : 'low', category: item.ruleId?.includes('security') ? 'security' : 'quality', message: `${item.message}${item.ruleId ? ` (${item.ruleId})` : ''}`, sourceTool: 'ESLint' }))) }],
  python: [
    { name: 'Pylint', executable: config.pylintPath, extension: '.py', args: (file) => ['--output-format=json', '--score=n', file], parse: (text) => JSON.parse(text).map((item) => makeFinding({ line: item.line, severity: item.type === 'error' ? 'high' : 'medium', category: item.messageId?.startsWith('E') ? 'bug' : 'quality', message: item.message, sourceTool: 'Pylint' })) },
    { name: 'Bandit', executable: config.banditPath, extension: '.py', args: (file) => ['-f', 'json', file], parse: (text) => JSON.parse(text).results.map((item) => makeFinding({ line: item.line_number, severity: item.issue_severity, category: 'security', message: item.issue_text, sourceTool: 'Bandit' })) },
  ],
  java: [{ name: 'PMD', executable: config.pmdPath, extension: '.java', args: (file) => ['check', '-f', 'json', '-R', 'rulesets/java/quickstart.xml', '-d', file], parse: (text) => JSON.parse(text).files.flatMap((item) => item.violations.map((violation) => makeFinding({ line: violation.beginline, severity: violation.priority <= 2 ? 'high' : 'medium', category: 'quality', message: violation.description, sourceTool: 'PMD' }))) }],
  c: [], cpp: [], html: [], css: [], sql: [],
};
for (const lang of ['c', 'cpp']) {
  const extension = lang === 'c' ? '.c' : '.cpp';
  definitions[lang] = [
    { name: 'Cppcheck', executable: config.cppcheckPath, extension, args: (file) => ['--enable=warning,style,performance,portability', '--template={"line":{line},"severity":"{severity}","message":"{message}","id":"{id}"}', file], parse: (text) => text.split(/\r?\n/).filter((line) => line.trim().startsWith('{')).map((line) => { const item = JSON.parse(line); return makeFinding({ line: item.line, severity: item.severity, category: item.id?.includes('buffer') ? 'security' : 'quality', message: item.message, sourceTool: 'Cppcheck' }); }) },
    { name: 'Flawfinder', executable: config.flawfinderPath, extension, args: (file) => ['--csv', file], parse: (text) => text.split(/\r?\n/).slice(1).filter(Boolean).map((line) => { const [fileName, lineNum, , , level, name, , message] = line.split(','); return makeFinding({ line: lineNum, severity: Number(level) >= 4 ? 'high' : 'medium', category: 'security', message: `${name}: ${message}`, sourceTool: 'Flawfinder' }); }) },
  ];
}
definitions.html = [{ name: 'HTMLHint', executable: config.htmlhintPath, extension: '.html', args: (file) => ['--format', 'json', file], parse: (text) => JSON.parse(text).flatMap((file) => file.messages.map((item) => makeFinding({ line: item.line, severity: item.type === 'error' ? 'high' : 'low', category: 'quality', message: item.message, sourceTool: 'HTMLHint' }))) }];
definitions.css = [{ name: 'Stylelint', executable: config.stylelintPath, extension: '.css', args: (file) => ['--formatter', 'json', file], parse: (text) => JSON.parse(text).flatMap((file) => file.warnings.map((item) => makeFinding({ line: item.line, severity: item.severity === 'error' ? 'medium' : 'low', category: 'quality', message: item.text, sourceTool: 'Stylelint' }))) }];
definitions.sql = [{ name: 'SQLFluff', executable: config.sqlfluffPath, extension: '.sql', args: (file) => ['lint', '--format', 'json', file], parse: (text) => JSON.parse(text).flatMap((file) => file.violations.map((item) => makeFinding({ line: item.start_line_no, severity: 'low', category: 'quality', message: `${item.code}: ${item.description}`, sourceTool: 'SQLFluff' }))) }];

export async function analyze(code, language) {
  const findings = []; const warnings = [];
  const results = await Promise.all((definitions[language] ?? []).map(async (tool) => {
    // Linting from inside the temp directory keeps tools from reading project config
    // and keeps ESLint's base path on the submitted file.
    const result = await withTemporarySource(code, tool.extension, (file, directory) => runTool(tool.executable, tool.args(file), { cwd: directory }));
    if (result.error) return { tool, result };
    try { return { tool, result, findings: validateFindings(tool.parse(result.stdout || result.stderr || '[]')) }; }
    catch (error) { return { tool, result, parseError: error }; }
  }));
  for (const { tool, result, findings: parsed, parseError } of results) {
    if (result.error === 'missing') { warnings.push(warningFor(tool.name, result)); continue; }
    if (result.error) { warnings.push(warningFor(tool.name, result)); continue; }
    if (parseError) { warnings.push(`${tool.name} returned output that could not be parsed; its findings were skipped.`); continue; }
    findings.push(...parsed);
  }
  return { findings, warnings };
}
export { definitions as analyzerDefinitions };
