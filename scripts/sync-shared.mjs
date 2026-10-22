// Keeps src/shared identical to Fiducial_backend/src/shared, the source of truth for the API
// contracts (Zod schemas, enums, types and formatters).
//
//   npm run shared:sync    copy the backend's files here (adds, updates and removes files)
//   npm run shared:check   list the differences and exit 1 if there are any; changes nothing
//
// The backend is expected next to this repo (../Fiducial_backend). Set FIDUCIAL_BACKEND_DIR to
// use another checkout.
import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const backendDir = path.resolve(
  repoRoot,
  process.env.FIDUCIAL_BACKEND_DIR ?? '../Fiducial_backend',
);
const sourceDir = path.join(backendDir, 'src', 'shared');
const targetDir = path.join(repoRoot, 'src', 'shared');
const checkOnly = process.argv.slice(2).includes('--check');

/** Relative paths of the files under dir, sorted. Returns [] when dir does not exist. */
async function listFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { recursive: true, withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name !== '.DS_Store')
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
    .sort();
}

/** The shorter of the relative and absolute forms of dir, for messages. */
function shown(dir) {
  const relative = path.relative(process.cwd(), dir);
  return relative && relative.length < dir.length ? relative : dir;
}

const sourceFiles = await listFiles(sourceDir);
if (sourceFiles.length === 0) {
  console.error(
    `No shared contracts found at ${shown(sourceDir)}.\n` +
      'Clone Fiducial_backend next to this repo, or set FIDUCIAL_BACKEND_DIR to its path.',
  );
  process.exit(2);
}
const targetFiles = new Set(await listFiles(targetDir));

/** @type {{ file: string, kind: 'added' | 'changed' | 'removed' }[]} */
const differences = [];
for (const file of sourceFiles) {
  if (!targetFiles.has(file)) {
    differences.push({ file, kind: 'added' });
    continue;
  }
  const [backendCopy, frontendCopy] = await Promise.all([
    readFile(path.join(sourceDir, file)),
    readFile(path.join(targetDir, file)),
  ]);
  if (!backendCopy.equals(frontendCopy)) differences.push({ file, kind: 'changed' });
}
const sourceSet = new Set(sourceFiles);
for (const file of targetFiles) {
  if (!sourceSet.has(file)) differences.push({ file, kind: 'removed' });
}

if (differences.length === 0) {
  console.log(`src/shared matches ${shown(sourceDir)} (${sourceFiles.length} files).`);
  process.exit(0);
}

if (checkOnly) {
  const labels = {
    added: 'missing here',
    changed: 'differs',
    removed: 'not in the backend',
  };
  console.error(`src/shared is out of sync with ${shown(sourceDir)}:`);
  for (const { file, kind } of differences) console.error(`  ${labels[kind].padEnd(18)} ${file}`);
  console.error('Run `npm run shared:sync` to copy the backend version, then commit the result.');
  process.exit(1);
}

for (const { file, kind } of differences) {
  const target = path.join(targetDir, file);
  if (kind === 'removed') {
    await rm(target);
  } else {
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(sourceDir, file), target);
  }
  console.log(`  ${kind.padEnd(8)} src/shared/${file}`);
}
console.log(`Synced ${differences.length} file(s) from ${shown(sourceDir)}.`);
