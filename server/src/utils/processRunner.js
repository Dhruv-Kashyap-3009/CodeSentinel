import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const availability = new Map();
const isWindows = process.platform === 'win32';
const shimExtensions = /\.(cmd|bat)$/i;

/**
 * Analyzer executables are configured as bare command names by default. On
 * Windows those are usually `.cmd` shims (npm/pip) or `.exe` binaries, and the
 * project's own `node_modules/.bin` is searched too so a workspace-local
 * install works without touching the global PATH.
 */
export function candidateDirectories() {
  return [
    ...(process.env.PATH ?? '').split(path.delimiter).filter(Boolean),
    path.resolve(fileURLToPath(new URL('../../../node_modules/.bin', import.meta.url))),
    path.resolve(fileURLToPath(new URL('../../node_modules/.bin', import.meta.url))),
  ];
}

async function resolveExecutable(executable) {
  if (executable.includes('/') || executable.includes('\\') || path.isAbsolute(executable)) return executable;
  // On Windows only PATHEXT extensions are runnable; the extension-less file
  // next to them is a POSIX shell script and must be skipped.
  const suffixes = isWindows ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean).map((ext) => ext.toLowerCase()) : [''];
  for (const directory of candidateDirectories()) {
    for (const suffix of suffixes) {
      const candidate = path.join(directory, `${executable}${suffix}`);
      try {
        await access(candidate, constants.F_OK);
        return candidate;
      } catch {
        // keep looking
      }
    }
  }
  return executable;
}

/** `cmd.exe` cannot inherit argv from Node, so quote exactly like a shell would. */
export function quoteForCmd(value) {
  const text = String(value);
  return /[\s"&|<>^()%!]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function spawnTool(executable, args, options) {
  const settings = {
    timeout: options.timeout ?? 20_000,
    maxBuffer: options.maxBuffer ?? 1024 * 1024,
    windowsHide: true,
    encoding: 'utf8',
    cwd: options.cwd,
    env: { ...process.env, ...(options.env ?? {}) },
  };
  const resolved = await resolveExecutable(executable);
  if (isWindows && shimExtensions.test(resolved)) {
    // Arguments are already quoted for cmd.exe, so Node must not quote them again.
    const command = [quoteForCmd(resolved), ...args.map(quoteForCmd)].join(' ');
    return execFileAsync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `"${command}"`], { ...settings, windowsVerbatimArguments: true });
  }
  return execFileAsync(resolved, args, settings);
}

export async function isAvailable(executable) {
  if (!availability.has(executable)) {
    availability.set(executable, spawnTool(executable, ['--version'], { timeout: 5000, maxBuffer: 64 * 1024 })
      .then(() => true).catch((error) => error.code !== 'ENOENT' && error.code !== 'EACCES'));
  }
  return availability.get(executable);
}

export async function runTool(executable, args, options = {}) {
  try {
    const result = await spawnTool(executable, args, options);
    return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', exitCode: 0 };
  } catch (error) {
    if (error.code === 'ENOENT') return { error: 'missing', message: 'Analyzer executable was not found.' };
    if (error.killed || error.code === 'ETIMEDOUT') return { error: 'timeout', message: `Analyzer exceeded its ${Math.round((options.timeout ?? 20_000) / 1000)} second time limit.` };
    if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return { error: 'output_limit', message: 'Analyzer output exceeded the configured limit.' };
    return { stdout: error.stdout ?? '', stderr: error.stderr ?? '', exitCode: error.code ?? error.status ?? 1 };
  }
}

export async function withTemporarySource(code, extension, callback) {
  const directory = await mkdtemp(path.join(tmpdir(), 'codesentinel-'));
  const filePath = path.join(directory, `submitted${extension}`);
  try {
    await writeFile(filePath, code, { encoding: 'utf8', flag: 'wx' });
    return await callback(filePath, directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function clearAvailabilityCache() { availability.clear(); }
