/**
 * One-time bootstrap: migrate GitHub Cloud Signing settings from dev userData
 * into production userData (SiteScop V6), then verify Test Connection.
 *
 * Usage: node scripts/bootstrap-production-github.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const electronBin = join(root, 'node_modules', 'electron', 'cli.js');

const DEV_SETTINGS = join(process.env.APPDATA ?? '', 'sitescop-v6', 'settings.json');
const PROD_USERDATA = join(process.env.APPDATA ?? '', 'SiteScop V6');
const PROD_SETTINGS = join(PROD_USERDATA, 'settings.json');
const PROD_EXE = join(
  process.env.LOCALAPPDATA ?? '',
  'Programs',
  'SiteScop V6',
  'SiteScop V6.exe',
);

const GITHUB = {
  enabled: true,
  owner: 'sitescop',
  repo: 'sitescop-cloud-signing',
  branch: 'main',
  pagesBaseUrl: 'https://sitescop.github.io/sitescop-cloud-signing/sign',
  publicRelayUrl: '',
};

function runDevElectronExport() {
  return spawnSync(process.execPath, [electronBin, '.'], {
    cwd: root,
    env: { ...process.env, SITESCOP_BOOTSTRAP_EXPORT_TOKEN: '1' },
    encoding: 'utf8',
    timeout: 120_000,
  });
}

function fail(msg, detail) {
  console.error(`\nBootstrap failed: ${msg}`);
  if (detail?.trim()) console.error(detail.trim());
  process.exit(1);
}

async function testGitHubConnection(token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const repoUrl = `${GITHUB.owner}/${GITHUB.repo}`;
  const repoRes = await fetch(`https://api.github.com/repos/${repoUrl}`, { headers });
  if (!repoRes.ok) {
    const body = await repoRes.text();
    throw new Error(`Repo check failed (${repoRes.status}): ${body.slice(0, 200)}`);
  }
  const repo = await repoRes.json();
  const branch = GITHUB.branch || repo.default_branch || 'main';

  const testPath = `agreements/pending/.sitescop-connection-test-${Date.now()}.txt`;
  const uploadRes = await fetch(
    `https://api.github.com/repos/${repoUrl}/contents/${testPath}`,
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'SiteScop connection test',
        content: Buffer.from('ok').toString('base64'),
        branch,
      }),
    },
  );
  if (!uploadRes.ok) {
    throw new Error(`Write test failed (${uploadRes.status})`);
  }
  const uploaded = await uploadRes.json();
  const sha = uploaded.content?.sha;
  if (sha) {
    await fetch(`https://api.github.com/repos/${repoUrl}/contents/${testPath}`, {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Remove connection test file', sha, branch }),
    });
  }

  let pagesReachable = false;
  try {
    const pagesRes = await fetch(`${GITHUB.pagesBaseUrl}/`, { method: 'GET' });
    pagesReachable = pagesRes.ok;
  } catch {
    pagesReachable = false;
  }

  return {
    repository: repo.full_name,
    defaultBranch: branch,
    pagesReachable,
    writeAccessVerified: true,
  };
}

console.log('\n=== SiteScop V6 — Production GitHub bootstrap ===\n');

if (!existsSync(PROD_EXE)) {
  fail('Production app not installed.', `Expected: ${PROD_EXE}`);
}

if (!existsSync(DEV_SETTINGS)) {
  fail(
    'Dev GitHub settings not found.',
    `Configure GitHub in dev first (npm run dev → Settings), then re-run.\nExpected: ${DEV_SETTINGS}`,
  );
}

console.log('Step 1/3 — Export PAT from dev settings (not printed)...');
const exportResult = runDevElectronExport();
if (exportResult.status !== 0) {
  fail('Could not read dev GitHub token.', exportResult.stderr || exportResult.stdout);
}
const token = (exportResult.stdout ?? '').trim();
if (!token) {
  fail(
    'No GitHub PAT in dev settings.',
    'Open SiteScop dev → Settings → GitHub Cloud Signing → save your PAT, then re-run.',
  );
}
console.log('  OK  Dev token loaded');

console.log('Step 2/3 — Write production settings (encrypted on first app launch)...');
mkdirSync(PROD_USERDATA, { recursive: true });
writeFileSync(
  PROD_SETTINGS,
  JSON.stringify(
    {
      github: {
        ...GITHUB,
        personalAccessToken: token,
      },
    },
    null,
    2,
  ),
  'utf8',
);
console.log(`  OK  Saved ${PROD_SETTINGS}`);

console.log('Step 3/3 — Test Connection (repo, write, Pages)...');
try {
  const result = await testGitHubConnection(token);
  console.log(`  OK  Repository: ${result.repository}`);
  console.log(`  OK  Branch: ${result.defaultBranch}`);
  console.log(`  OK  Pages reachable: ${result.pagesReachable}`);
  console.log(`  OK  Write access verified: ${result.writeAccessVerified}`);
} catch (error) {
  fail('GitHub Test Connection failed.', error instanceof Error ? error.message : String(error));
}

console.log('\n=== Bootstrap complete ===');
console.log(`Production app: ${PROD_EXE}`);
console.log('Open SiteScop V6 from Desktop or Start Menu — GitHub Cloud Signing is ready.\n');
