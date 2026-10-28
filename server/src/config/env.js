import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const boolean = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false;
  return value;
}, z.boolean());
const positiveInt = (fallback, max = 2_000_000) => z.coerce.number().int().positive().max(max).default(fallback);
const schema = z.object({
  PORT: z.preprocess((value) => value === '0' || value === 0 ? 5000 : value, positiveInt(5000, 65535)),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/intelligent-code-review'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().min(1).default('qwen2.5-coder:7b'),
  OLLAMA_TIMEOUT_MS: positiveInt(120000, 600000),
  MOCK_LLM: boolean.default(false),
  VERIFY: boolean.default(true),
  MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.65),
  LLM_CONCURRENCY: positiveInt(3, 16),
  MAX_SOURCE_BYTES: positiveInt(204800, 2_000_000),
  MAX_CHUNK_CHARS: positiveInt(12000, 100_000),
  ESLINT_PATH: z.string().min(1).default('eslint'),
  PYLINT_PATH: z.string().min(1).default('pylint'),
  BANDIT_PATH: z.string().min(1).default('bandit'),
  PMD_PATH: z.string().min(1).default('pmd'),
  CPPCHECK_PATH: z.string().min(1).default('cppcheck'),
  FLAWFINDER_PATH: z.string().min(1).default('flawfinder'),
  HTMLHINT_PATH: z.string().min(1).default('htmlhint'),
  STYLELINT_PATH: z.string().min(1).default('stylelint'),
  SQLFLUFF_PATH: z.string().min(1).default('sqlfluff'),
  SEMGREP_PATH: z.string().min(1).default('semgrep'),
  PYTHON_PATH: z.string().min(1).default('python'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}
const env = parsed.data;
export const config = Object.freeze({
  port: env.PORT,
  mongoUri: env.MONGODB_URI,
  frontendOrigin: env.FRONTEND_ORIGIN,
  ollamaBaseUrl: env.OLLAMA_BASE_URL.replace(/\/$/, ''),
  ollamaModel: env.OLLAMA_MODEL,
  ollamaTimeoutMs: env.OLLAMA_TIMEOUT_MS,
  mockLlm: env.MOCK_LLM,
  verify: env.VERIFY,
  minConfidence: env.MIN_CONFIDENCE,
  llmConcurrency: env.LLM_CONCURRENCY,
  maxSourceBytes: env.MAX_SOURCE_BYTES,
  maxChunkChars: env.MAX_CHUNK_CHARS,
  eslintPath: env.ESLINT_PATH,
  pylintPath: env.PYLINT_PATH,
  banditPath: env.BANDIT_PATH,
  pmdPath: env.PMD_PATH,
  cppcheckPath: env.CPPCHECK_PATH,
  flawfinderPath: env.FLAWFINDER_PATH,
  htmlhintPath: env.HTMLHINT_PATH,
  stylelintPath: env.STYLELINT_PATH,
  sqlfluffPath: env.SQLFLUFF_PATH,
  semgrepPath: env.SEMGREP_PATH,
  pythonPath: env.PYTHON_PATH,
});
