#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function run(command, label) {
  if (!command) fail(`${label} is not configured`);
  const result = spawnSync(command, { shell: true, stdio: 'inherit', env: process.env });
  if (result.status !== 0) fail(`${label} failed with exit ${result.status ?? 'unknown'}`);
}

function runAndCapture(command, label) {
  if (!command) fail(`${label} is not configured`);
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.status !== 0) fail(`${label} failed with exit ${result.status ?? 'unknown'}`);
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function gh(...args) {
  return execFileSync('gh', args, { encoding: 'utf8' }).trim();
}

const configPath = 'release.config.json';
if (!existsSync(configPath)) fail(`${configPath} is missing`);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (config.enabled !== true) fail('release.config.json is not enabled');
const requiredSecrets = config.requiredSecrets ?? ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];
const missingSecrets = requiredSecrets.filter((name) => !(process.env[name] ?? '').trim());
if (missingSecrets.length) {
  fail(`required repository secrets are missing: ${missingSecrets.join(', ')}`);
}

const version = (process.env.RELEASE_VERSION ?? '').trim().replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(version)) fail('RELEASE_VERSION must be MAJOR.MINOR.PATCH');
if (git('status', '--porcelain')) fail('checkout must be clean before a release');
if (git('branch', '--show-current') !== 'main') fail('production releases run from main');

const releaseCommit = git('rev-parse', 'HEAD');
const tag = `v${version}`;
const repository = process.env.GITHUB_REPOSITORY;
if (!repository) fail('GITHUB_REPOSITORY is required');

try {
  gh('api', `repos/${repository}/git/ref/tags/${tag}`);
  fail(`${tag} already exists; release tags are immutable`);
} catch (error) {
  if (error.status !== 1) throw error;
}

if (config.installCommand) run(config.installCommand, 'dependency installation');
const deployOutput = runAndCapture(config.deployCommand, 'production deploy');
if (!config.deploymentIdPattern) fail('deploymentIdPattern is not configured');
let deploymentPattern;
try {
  deploymentPattern = new RegExp(config.deploymentIdPattern, 'g');
} catch (error) {
  fail(`deploymentIdPattern is invalid: ${error.message}`);
}
const deploymentIds = [...deployOutput.matchAll(deploymentPattern)].map((match) => match[1]);
const uniqueDeploymentIds = [...new Set(deploymentIds.filter(Boolean))];
if (uniqueDeploymentIds.length !== 1) {
  fail(
    `production deploy output identified ${uniqueDeploymentIds.length} deployment IDs; expected exactly one`
  );
}
const [deploymentId] = uniqueDeploymentIds;
run(config.verifyCommand, 'production verification');

const tagObject = gh(
  'api',
  '--method',
  'POST',
  `repos/${repository}/git/tags`,
  '-f',
  `tag=${tag}`,
  '-f',
  `message=Release ${tag}`,
  '-f',
  `object=${releaseCommit}`,
  '-f',
  'type=commit',
  '--jq',
  '.sha'
);
gh(
  'api',
  '--method',
  'POST',
  `repos/${repository}/git/refs`,
  '-f',
  `ref=refs/tags/${tag}`,
  '-f',
  `sha=${tagObject}`
);

const resolved = gh('api', `repos/${repository}/git/tags/${tagObject}`, '--jq', '.object.sha');
if (resolved !== releaseCommit) fail(`${tag} resolved to ${resolved}, expected ${releaseCommit}`);

const recordPath = config.releaseRecord || 'release/current.json';
const previous = existsSync(recordPath) ? JSON.parse(readFileSync(recordPath, 'utf8')) : {};
const workItems = (process.env.RELEASE_WORK_ITEMS ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const record = {
  ...previous,
  version,
  releaseCommit,
  commit: releaseCommit,
  tag,
  productionDeploymentId: deploymentId,
  releaseDate: new Date().toISOString().slice(0, 10),
  productionStatus: 'Verified',
  workItems,
};
writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);

for (const command of config.regenerateCommands ?? []) run(command, 'generated-artifact refresh');

const paths = [recordPath, ...(config.generatedPaths ?? [])];
execFileSync('git', ['add', '--', ...paths], { stdio: 'inherit' });
const staged = spawnSync('git', ['diff', '--cached', '--quiet']);
if (staged.status === 0) fail('release produced no record changes');
if (staged.status !== 1) fail('could not inspect staged release changes');
execFileSync('git', ['config', 'user.name', 'github-actions[bot]']);
execFileSync('git', [
  'config',
  'user.email',
  '41898282+github-actions[bot]@users.noreply.github.com',
]);
execFileSync('git', ['commit', '-m', `Record verified production release ${tag}`], {
  stdio: 'inherit',
});

for (let attempt = 1; attempt <= 3; attempt += 1) {
  const push = spawnSync('git', ['push', 'origin', 'HEAD:main'], { stdio: 'inherit' });
  if (push.status === 0) {
    console.log(
      `release: ${tag} -> ${releaseCommit}; production ${deploymentId} verified and recorded`
    );
    process.exit(0);
  }
  if (attempt === 3) break;
  execFileSync('git', ['pull', '--rebase', 'origin', 'main'], { stdio: 'inherit' });
}
fail('could not push the release record after three attempts; the verified tag remains valid');
