import mongoose from 'mongoose';
import { config } from '../server/src/config/env.js';
import { runTool } from '../server/src/utils/processRunner.js';

const tools = [
  ['ESLint', config.eslintPath, '--version', 'npm install -g eslint'],
  ['Pylint', config.pylintPath, '--version', 'python -m pip install pylint'],
  ['Bandit', config.banditPath, '--version', 'python -m pip install bandit'],
  ['PMD', config.pmdPath, '--version', 'Download PMD from https://pmd.github.io/'],
  ['Cppcheck', config.cppcheckPath, '--version', 'Install with winget install Cppcheck.Cppcheck'],
  ['Flawfinder', config.flawfinderPath, '--version', 'python -m pip install flawfinder'],
  ['HTMLHint', config.htmlhintPath, '--version', 'npm install -g htmlhint'],
  ['Stylelint', config.stylelintPath, '--version', 'npm install -g stylelint'],
  ['SQLFluff', config.sqlfluffPath, '--version', 'python -m pip install sqlfluff'],
  ['Semgrep', config.semgrepPath, '--version', 'python -m pip install semgrep'],
];

const ok = (text) => console.log(`  [ok]   ${text}`);
const warn = (text) => console.log(`  [warn] ${text}`);
const bad = (text) => console.log(`  [fail] ${text}`);

/** Static analyzers are optional: a missing binary only disables that tool. */
async function checkAnalyzers() {
  console.log('\nStatic analyzers (optional — missing tools are skipped with a warning)');
  let found = 0;
  for (const [name, executable, flag, hint] of tools) {
    const result = await runTool(executable, [flag], { timeout: 5000 });
    const version = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split(/\r?\n/, 1)[0];
    if (result.error || (result.exitCode !== 0 && !version)) {
      console.log(`  [warn] ${name}: missing — ${hint}`);
    } else {
      console.log(`  [ok]   ${name}: ${version || 'available'}`);
      found += 1;
    }
  }
  console.log(`  ${found}/${tools.length} analyzers available; reviews still work with the missing ones skipped.`);
}

/** Ollama is required unless MOCK_LLM=true. */
async function checkOllama() {
  console.log('\nOllama');
  if (config.mockLlm) {
    warn('MOCK_LLM=true — LLM reviews use deterministic mock output; Ollama is not called.');
    return;
  }
  let models;
  try {
    const response = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    ({ models = [] } = await response.json());
  } catch (error) {
    bad(`Cannot reach ${config.ollamaBaseUrl} (${error.message}). Start Ollama and rerun: ollama serve`);
    return;
  }
  ok(`Server reachable at ${config.ollamaBaseUrl}`);
  const names = models.flatMap((model) => [model.name, model.model]).filter(Boolean);
  if (names.includes(config.ollamaModel)) ok(`Model "${config.ollamaModel}" is installed`);
  else bad(`Model "${config.ollamaModel}" is not installed. Run: ollama pull ${config.ollamaModel}`);
  if (names.length) console.log(`  Models: ${[...new Set(names)].join(', ')}`);
}

/** Persistence is optional for single reviews but required for history and stats. */
async function checkMongo() {
  console.log('\nMongoDB');
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 4000, maxPoolSize: 1 });
    ok(`Connected to ${config.mongoUri.replace(/\/\/[^@/]*@/, '//***@')}`);
  } catch (error) {
    bad(`Cannot connect to ${config.mongoUri} (${error.message})`);
    console.log('  Reviews still run, but history and dashboard statistics need MongoDB.');
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

console.log(`CodeSentinel doctor — model ${config.ollamaModel}, verification ${config.verify ? 'on' : 'off'}`);
await checkOllama();
await checkMongo();
await checkAnalyzers();
console.log('\nNext: copy server/.env.example to server/.env, then run `npm run dev`.');
