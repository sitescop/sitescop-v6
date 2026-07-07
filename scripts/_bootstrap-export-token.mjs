import { app, safeStorage } from 'electron';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

app.whenReady().then(() => {
  try {
    const path = join(process.env.APPDATA ?? '', 'sitescop-v6', 'settings.json');
    if (!existsSync(path)) {
      process.exitCode = 1;
      return;
    }
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const github = raw.github ?? {};
    let token = '';
    if (github.encryptedPersonalAccessToken) {
      token = safeStorage.decryptString(
        Buffer.from(github.encryptedPersonalAccessToken, 'base64'),
      );
    } else if (github.personalAccessToken) {
      token = String(github.personalAccessToken).trim();
    }
    if (token) process.stdout.write(token);
    process.exitCode = token ? 0 : 1;
  } catch (error) {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
