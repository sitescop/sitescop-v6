import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import { promisify } from 'node:util';
import { clipboard } from 'electron';

const execFileAsync = promisify(execFile);

function normalizePaths(filePaths: string[]): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const raw of filePaths) {
    const trimmed = raw?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if (!existsSync(trimmed)) continue;
    seen.add(trimmed);
    paths.push(trimmed);
  }
  return paths;
}

async function copyOnWindows(paths: string[]): Promise<void> {
  const escaped = paths.map((p) => `'${p.replace(/'/g, "''")}'`);
  const command =
    paths.length === 1
      ? `Set-Clipboard -Path ${escaped[0]}`
      : `Set-Clipboard -Path @(${escaped.join(', ')})`;
  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
}

async function copyOnMac(paths: string[]): Promise<void> {
  const files = paths
    .map((p) => `POSIX file ${JSON.stringify(p)}`)
    .join(', ');
  await execFileAsync('osascript', ['-e', `set the clipboard to {${files}}`]);
}

export async function copyFilesToClipboard(filePaths: string[]): Promise<number> {
  const paths = normalizePaths(filePaths);
  if (!paths.length) {
    throw new Error('No PDF files found to copy. Generate the PDF first.');
  }

  const os = platform();

  try {
    if (os === 'win32') {
      await copyOnWindows(paths);
    } else if (os === 'darwin') {
      await copyOnMac(paths);
    } else {
      clipboard.writeText(paths.join('\n'));
      throw new Error(
        'Your system copies file paths as text. Paste the path when attaching in your email client.',
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('file paths as text')) {
      throw error;
    }
    clipboard.writeText(paths.join('\n'));
    throw new Error(
      `Could not copy files for paste. PDF path${paths.length > 1 ? 's' : ''} copied as text instead — use Attach and paste the path.`,
    );
  }

  return paths.length;
}

export function copyPdfClipboardMessage(count: number): string {
  if (count === 1) {
    return 'PDF copied — switch to your email and press Ctrl+V to attach.';
  }
  return `${count} PDFs copied — switch to your email and press Ctrl+V to attach all.`;
}

export function copyTextToClipboard(text: string): void {
  const value = text.trim();
  if (!value) {
    throw new Error('Nothing to copy.');
  }
  clipboard.writeText(value);
}
