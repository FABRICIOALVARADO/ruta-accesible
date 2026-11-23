import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseURL = 'http://127.0.0.1:4173';
const data = mkdtempSync(join(tmpdir(), 'ruta-accesible-e2e-'));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL, browserName: 'chromium', channel: process.env.RUTA_TEST_BROWSER || undefined,
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  metadata: { data },
  globalTeardown: './e2e/limpiar.mjs',
  webServer: {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    command: 'python -m uvicorn backend.ruta_accesible.main:app --host 127.0.0.1 --port 4173',
    url: baseURL + '/api/health',
    timeout: 30000,
    reuseExistingServer: false,
    env: {
      FASTAPI_DATABASE_PATH: join(data,'prueba.db'),
      LEGACY_DATABASE_PATH: '',
      ADMIN_EMAIL: 'administrador@example.test',
      ADMIN_PASSWORD: 'PruebaAdmin123!',
      GOOGLE_MAPS_API_KEY: '',
      APP_ORIGIN: baseURL,
      SECURE_COOKIE: '0',
      NODE_ENV: 'test',
    },
  },
});
