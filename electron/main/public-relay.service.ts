/**
 * Public signing relay — exposes the local signing server (port 38765) on the internet
 * so clients can Sign & submit from anywhere (not only the same Wi‑Fi).
 *
 * Uses Cloudflare Quick Tunnel (cloudflared). SiteScop must stay open while clients sign.
 */
import { app } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { get as httpsGet } from 'node:https';
import { getGitHubSettings } from './settings.service.js';

const CLOUDFLARED_VERSION = '2025.2.1';
const WIN_URL = `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-windows-amd64.exe`;

let tunnelProcess: ChildProcessWithoutNullStreams | null = null;
let sessionPublicUrl = '';
let starting: Promise<string | null> | null = null;

export function getSessionPublicRelayUrl(): string {
  return sessionPublicUrl.replace(/\/$/, '');
}

/** Manual Settings URL wins; otherwise the live Cloudflare tunnel URL. */
export function getEffectivePublicRelayUrl(): string {
  const manual = getGitHubSettings().publicRelayUrl.trim().replace(/\/$/, '');
  if (manual) return manual;
  return getSessionPublicRelayUrl();
}

function cloudflaredBinaryPath(): string {
  const binDir = join(app.getPath('userData'), 'bin');
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
  return process.platform === 'win32'
    ? join(binDir, 'cloudflared.exe')
    : join(binDir, 'cloudflared');
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirSync(dirname(dest), { recursive: true });
    const tmp = `${dest}.download`;
    const file = createWriteStream(tmp);

    const request = (target: string, redirectsLeft: number) => {
      httpsGet(target, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          res.resume();
          request(res.headers.location, redirectsLeft - 1);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          try {
            unlinkSync(tmp);
          } catch {
            // ignore
          }
          reject(new Error(`Could not download cloudflared (${res.statusCode ?? 'network'}).`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            try {
              renameSync(tmp, dest);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        });
      }).on('error', (error) => {
        try {
          unlinkSync(tmp);
        } catch {
          // ignore
        }
        reject(error);
      });
    };

    request(url, 8);
  });
}

async function ensureCloudflaredBinary(): Promise<string> {
  const dest = cloudflaredBinaryPath();
  if (existsSync(dest)) return dest;
  if (process.platform !== 'win32') {
    throw new Error(
      'Auto internet relay currently supports Windows. Install cloudflared and set Public Relay URL in Settings.',
    );
  }
  await downloadFile(WIN_URL, dest);
  return dest;
}

function extractTunnelUrl(chunk: string): string | null {
  const match =
    chunk.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i) ??
    chunk.match(/https:\/\/[a-z0-9.-]+\.cfargotunnel\.com/i);
  return match?.[0]?.replace(/\/$/, '') ?? null;
}

/**
 * Opens an HTTPS tunnel to the local signing server so remote clients can submit signatures.
 * Returns the public base URL (no trailing slash), or null if tunnel could not start.
 */
export async function startPublicRelayTunnel(localPort: number): Promise<string | null> {
  const manual = getGitHubSettings().publicRelayUrl.trim().replace(/\/$/, '');
  if (manual) {
    sessionPublicUrl = manual;
    return manual;
  }

  if (sessionPublicUrl && tunnelProcess && !tunnelProcess.killed) {
    return sessionPublicUrl;
  }

  if (starting) return starting;

  starting = (async () => {
    try {
      const binary = await ensureCloudflaredBinary();
      stopPublicRelayTunnel({ clearSession: true });

      const child = spawn(
        binary,
        ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${localPort}`],
        { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
      );
      tunnelProcess = child;

      const url = await new Promise<string | null>((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve(null);
          }
        }, 60_000);

        const onData = (buf: Buffer) => {
          const text = buf.toString('utf8');
          const found = extractTunnelUrl(text);
          if (found && !settled) {
            settled = true;
            clearTimeout(timer);
            resolve(found);
          }
        };

        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        child.on('error', () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(null);
          }
        });
        child.on('exit', () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(null);
          }
          if (tunnelProcess === child) {
            tunnelProcess = null;
            if (
              sessionPublicUrl.includes('trycloudflare.com') ||
              sessionPublicUrl.includes('cfargotunnel.com')
            ) {
              sessionPublicUrl = '';
            }
          }
        });
      });

      if (!url) {
        stopPublicRelayTunnel({ clearSession: true });
        return null;
      }

      sessionPublicUrl = url;
      return url;
    } catch (error) {
      console.error('[public-relay]', error);
      stopPublicRelayTunnel({ clearSession: true });
      return null;
    } finally {
      starting = null;
    }
  })();

  return starting;
}

export function stopPublicRelayTunnel(options?: { clearSession?: boolean }): void {
  if (tunnelProcess && !tunnelProcess.killed) {
    try {
      tunnelProcess.kill();
    } catch {
      // ignore
    }
  }
  tunnelProcess = null;
  if (options?.clearSession) {
    sessionPublicUrl = '';
    return;
  }
  if (sessionPublicUrl.includes('trycloudflare.com') || sessionPublicUrl.includes('cfargotunnel.com')) {
    sessionPublicUrl = '';
  }
}

export function getPublicRelayStatus(): {
  activeUrl: string;
  mode: 'manual' | 'auto' | 'none';
  tunnelRunning: boolean;
} {
  const manual = getGitHubSettings().publicRelayUrl.trim().replace(/\/$/, '');
  const active = getEffectivePublicRelayUrl();
  return {
    activeUrl: active,
    mode: manual ? 'manual' : active ? 'auto' : 'none',
    tunnelRunning: Boolean(tunnelProcess && !tunnelProcess.killed),
  };
}
