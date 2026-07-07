export type GitHubCloudErrorCode =
  | 'INVALID_TOKEN'
  | 'NETWORK'
  | 'MISSING_REPO'
  | 'NO_WRITE_ACCESS'
  | 'PAGES_UNAVAILABLE'
  | 'UPLOAD_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'UNKNOWN';

export class GitHubCloudError extends Error {
  readonly code: GitHubCloudErrorCode;

  constructor(message: string, code: GitHubCloudErrorCode) {
    super(message);
    this.name = 'GitHubCloudError';
    this.code = code;
  }
}

export function mapGitHubHttpError(status: number, message: string): GitHubCloudError {
  const lower = message.toLowerCase();

  if (status === 401 || status === 403 || lower.includes('bad credentials')) {
    if (lower.includes('resource not accessible') || lower.includes('write')) {
      return new GitHubCloudError(
        'GitHub token does not have write permission for this repository. Grant Contents read and write access.',
        'NO_WRITE_ACCESS',
      );
    }
    return new GitHubCloudError(
      'Invalid or expired GitHub personal access token. Update it in Settings.',
      'INVALID_TOKEN',
    );
  }

  if (status === 404 || lower.includes('not found')) {
    return new GitHubCloudError(
      'GitHub repository or file not found. Check owner, repository name, and branch in Settings.',
      'MISSING_REPO',
    );
  }

  return new GitHubCloudError(message || `GitHub API error (${status})`, 'UNKNOWN');
}

export function wrapGitHubNetworkError(error: unknown, operation: 'upload' | 'download' | 'connect'): GitHubCloudError {
  if (error instanceof GitHubCloudError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('timeout')
  ) {
    return new GitHubCloudError(
      'Network failure while contacting GitHub. Check your internet connection and try again.',
      'NETWORK',
    );
  }

  if (operation === 'upload') {
    return new GitHubCloudError(message || 'Upload to GitHub failed.', 'UPLOAD_FAILED');
  }

  if (operation === 'download') {
    return new GitHubCloudError(message || 'Download from GitHub failed.', 'DOWNLOAD_FAILED');
  }

  return new GitHubCloudError(message || 'GitHub connection failed.', 'UNKNOWN');
}
