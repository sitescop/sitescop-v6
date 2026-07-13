import type { GitHubSettings } from './settings.service.js';
import { GitHubCloudError, mapGitHubHttpError, wrapGitHubNetworkError } from './github-errors.js';

const GITHUB_API = 'https://api.github.com';

export interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `GitHub API error (${response.status})`;
  } catch {
    return `GitHub API error (${response.status})`;
  }
}

async function githubFetch(
  url: string,
  init: RequestInit,
  operation: 'upload' | 'download' | 'connect',
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw wrapGitHubNetworkError(error, operation);
  }
}

export interface GitHubTestConnectionResult {
  ok: true;
  defaultBranch: string;
  repository: string;
  pagesUrl: string;
  pagesReachable: boolean;
  writeAccessVerified: boolean;
}

export async function testGitHubConnection(
  settings: GitHubSettings,
): Promise<GitHubTestConnectionResult> {
  const token = settings.personalAccessToken.trim();
  if (!token) {
    throw new GitHubCloudError(
      'GitHub personal access token is required. Save your token in Settings first.',
      'INVALID_TOKEN',
    );
  }
  if (!settings.owner.trim() || !settings.repo.trim()) {
    throw new GitHubCloudError(
      'GitHub owner and repository name are required.',
      'MISSING_REPO',
    );
  }

  const branch = settings.branch.trim() || 'main';
  const pagesUrl = settings.pagesBaseUrl.trim().replace(/\/$/, '');
  if (!pagesUrl) {
    throw new GitHubCloudError(
      'GitHub Pages URL is required. Enter your signing portal URL in Settings.',
      'PAGES_UNAVAILABLE',
    );
  }

  const response = await githubFetch(
    `${GITHUB_API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}`,
    { headers: authHeaders(token) },
    'connect',
  );

  if (!response.ok) {
    throw mapGitHubHttpError(response.status, await readErrorMessage(response));
  }

  const repo = (await response.json()) as { default_branch?: string };
  const defaultBranch = repo.default_branch ?? 'main';

  const branchResponse = await githubFetch(
    `${GITHUB_API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/branches/${encodeURIComponent(branch)}`,
    { headers: authHeaders(token) },
    'connect',
  );
  if (!branchResponse.ok) {
    throw new GitHubCloudError(
      `Branch "${branch}" was not found on GitHub. Check the branch name in Settings.`,
      'MISSING_REPO',
    );
  }

  const testPath = `agreements/pending/.sitescop-connection-test-${Date.now()}.json`;
  const testPayload = JSON.stringify(
    {
      test: true,
      checkedAt: new Date().toISOString(),
      source: 'SiteScop V6 connection test',
    },
    null,
    2,
  );

  await putGitHubFileText(
    settings,
    testPath,
    testPayload,
    'SiteScop: connection test (write check)',
    token,
  );

  const downloaded = await getGitHubFileText(settings, testPath, token);
  if (!downloaded?.text.includes('"test": true')) {
    throw new GitHubCloudError(
      'Write test file could not be read back from GitHub. Check repository permissions.',
      'DOWNLOAD_FAILED',
    );
  }

  await deleteGitHubFile(
    settings,
    testPath,
    downloaded.sha,
    'SiteScop: connection test cleanup',
    token,
  );

  let pagesReachable = false;
  try {
    const pagesResponse = await fetch(pagesUrl, { method: 'GET', redirect: 'follow' });
    pagesReachable = pagesResponse.ok;
    if (!pagesReachable) {
      throw new GitHubCloudError(
        `GitHub Pages URL returned HTTP ${pagesResponse.status}. Enable Pages on your repository or check the URL in Settings.`,
        'PAGES_UNAVAILABLE',
      );
    }
  } catch (error) {
    if (error instanceof GitHubCloudError) throw error;
    throw wrapGitHubNetworkError(error, 'connect');
  }

  return {
    ok: true,
    defaultBranch,
    repository: `${settings.owner}/${settings.repo}`,
    pagesUrl,
    pagesReachable,
    writeAccessVerified: true,
  };
}

export async function getGitHubFileText(
  settings: GitHubSettings,
  path: string,
  token = settings.personalAccessToken,
): Promise<{ text: string; sha: string } | null> {
  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const response = await githubFetch(
    `${GITHUB_API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(settings.branch)}`,
    {
      headers: {
        ...authHeaders(token),
        Accept: 'application/vnd.github.raw',
      },
    },
    'download',
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw mapGitHubHttpError(response.status, await readErrorMessage(response));
  }

  const text = await response.text();

  const metaResponse = await githubFetch(
    `${GITHUB_API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(settings.branch)}`,
    { headers: authHeaders(token) },
    'download',
  );

  if (!metaResponse.ok) {
    throw mapGitHubHttpError(metaResponse.status, await readErrorMessage(metaResponse));
  }

  const meta = (await metaResponse.json()) as { sha: string };
  return { text, sha: meta.sha };
}

export async function putGitHubFileText(
  settings: GitHubSettings,
  path: string,
  content: string,
  message: string,
  token = settings.personalAccessToken,
  existingSha?: string,
  allowConflictRetry = true,
): Promise<void> {
  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: settings.branch,
    ...(existingSha ? { sha: existingSha } : {}),
  };

  const response = await githubFetch(
    `${GITHUB_API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${encodedPath}`,
    {
      method: 'PUT',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    'upload',
  );

  if (!response.ok) {
    const apiMessage = await readErrorMessage(response);
    const shaConflict =
      response.status === 409 || /does not match/i.test(apiMessage);
    if (allowConflictRetry && shaConflict) {
      const latest = await getGitHubFileText(settings, path, token);
      if (latest && latest.sha !== existingSha) {
        await putGitHubFileText(
          settings,
          path,
          content,
          message,
          token,
          latest.sha,
          false,
        );
        return;
      }
    }
    if (response.status === 401 || response.status === 403) {
      throw mapGitHubHttpError(response.status, apiMessage);
    }
    throw mapGitHubHttpError(response.status, apiMessage || 'Upload to GitHub failed.');
  }
}

export async function deleteGitHubFile(
  settings: GitHubSettings,
  path: string,
  sha: string,
  message: string,
  token = settings.personalAccessToken,
): Promise<void> {
  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const response = await githubFetch(
    `${GITHUB_API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${encodedPath}`,
    {
      method: 'DELETE',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        sha,
        branch: settings.branch.trim() || 'main',
      }),
    },
    'upload',
  );

  if (!response.ok) {
    const apiMessage = await readErrorMessage(response);
    if (response.status === 401 || response.status === 403) {
      throw mapGitHubHttpError(response.status, apiMessage);
    }
    throw new GitHubCloudError(
      apiMessage || 'Delete from GitHub failed.',
      'UPLOAD_FAILED',
    );
  }
}

export async function listGitHubDirectory(
  settings: GitHubSettings,
  dirPath: string,
  token = settings.personalAccessToken,
): Promise<GitHubContentItem[]> {
  const encodedPath = dirPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const response = await githubFetch(
    `${GITHUB_API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(settings.branch)}`,
    { headers: authHeaders(token) },
    'download',
  );

  if (response.status === 404) return [];
  if (!response.ok) {
    throw mapGitHubHttpError(response.status, await readErrorMessage(response));
  }

  const data = (await response.json()) as GitHubContentItem | GitHubContentItem[];
  return Array.isArray(data) ? data.filter((item) => item.type === 'file') : [];
}

/** Resolve where the live signing portal lives in the cloud repo. */
async function resolveSigningPortalRemotePrefix(settings: GitHubSettings): Promise<string> {
  const prefixes = ['sign', 'docs/sign'];
  for (const prefix of prefixes) {
    const existing = await getGitHubFileText(settings, `${prefix}/app.js`);
    if (existing) return prefix;
  }
  // Default for project Pages URLs ending in /sign/
  return 'sign';
}

/** Upload local signing portal files (app.js / index.html) to the GitHub Pages folder. */
export async function publishSigningPortalToGitHub(
  settings: GitHubSettings,
): Promise<{ uploaded: string[]; remotePrefix: string }> {
  const { readFileSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { app } = await import('electron');

  const candidates = [
    join(process.cwd(), 'docs', 'sign'),
    join(app.getAppPath(), 'docs', 'sign'),
    join(__dirname, '../../docs/sign'),
    join(__dirname, '../../../docs/sign'),
  ];
  const signDir = candidates.find((dir) => existsSync(join(dir, 'app.js')));
  if (!signDir) {
    throw new GitHubCloudError(
      'Could not find docs/sign portal files to publish. Run SiteScop from the sitescop-v6 folder.',
      'UPLOAD_FAILED',
    );
  }

  const remotePrefix = await resolveSigningPortalRemotePrefix(settings);
  const files = [
    { local: 'app.js', remote: `${remotePrefix}/app.js` },
    { local: 'index.html', remote: `${remotePrefix}/index.html` },
  ] as const;

  const uploaded: string[] = [];
  for (const file of files) {
    const full = join(signDir, file.local);
    if (!existsSync(full)) continue;
    const content = readFileSync(full, 'utf8');
    const existing = await getGitHubFileText(settings, file.remote);
    await putGitHubFileText(
      settings,
      file.remote,
      content,
      `SiteScop: publish signing portal ${file.local} (hosted offline submit v20)`,
      settings.personalAccessToken,
      existing?.sha,
    );
    uploaded.push(file.remote);
  }

  if (uploaded.length === 0) {
    throw new GitHubCloudError('No portal files were published.', 'UPLOAD_FAILED');
  }

  return { uploaded, remotePrefix };
}
