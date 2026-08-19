#!/usr/bin/env node
/**
 * Reapply .gitattributes to every tracked working-tree file, safely.
 *
 * `git checkout-index -a -f` writes the index contents to the working tree. It
 * does not change HEAD, the index, or untracked files. It does overwrite
 * modified tracked files, so this script refuses to start unless both staged
 * and unstaged tracked changes are absent.
 */

import { execFileSync } from 'node:child_process';

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...options });
}

function trackedChanges() {
  return git(['status', '--porcelain', '--untracked-files=no']).trim();
}

const before = trackedChanges();
if (before) {
  console.error(
    'Refusing to normalize: tracked files have staged or unstaged changes.\n' +
      'Commit or otherwise preserve them first. Nothing was rewritten.\n\n' +
      before
  );
  process.exit(1);
}

git(['checkout-index', '-a', '-f']);

const after = trackedChanges();
if (after) {
  console.error('Normalization changed Git state unexpectedly:\n\n' + after);
  process.exit(1);
}

const rows = git(['ls-files', '--eol']).split(/\r?\n/).filter(Boolean);
const mismatches = rows.filter((row) => {
  const working = row.match(/\bw\/(lf|crlf|mixed|none|-text)\b/)?.[1];
  if (/\battr\/.*\beol=lf\b/.test(row)) return working === 'crlf' || working === 'mixed';
  if (/\battr\/.*\beol=crlf\b/.test(row)) return working === 'lf' || working === 'mixed';
  return false;
});

if (mismatches.length) {
  console.error(
    'Checkout attributes were applied, but these working-tree endings still disagree:\n\n' +
      mismatches.map((row) => `  ${row}`).join('\n')
  );
  process.exit(1);
}

console.log(`Normalized ${rows.length} tracked files; Git state is clean.`);
