import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const initialEnvKeys = new Set(Object.keys(process.env));
const envKeysFromDotenv = new Set();

function loadEnvFile(fileName, allowOverride = false) {
  const envPath = path.join(projectRoot, fileName);
  if (!existsSync(envPath)) {
    return;
  }

  const parsed = dotenv.parse(readFileSync(envPath, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    const existing = process.env[key];
    const valueString = value == null ? '' : String(value);
    const valueIsNonEmpty = valueString.trim().length > 0;
    const shouldSet = valueIsNonEmpty && (existing === undefined || existing === '' || (allowOverride && envKeysFromDotenv.has(key)));
    if (shouldSet) {
      process.env[key] = valueString;
      envKeysFromDotenv.add(key);
    }
  }
}

loadEnvFile('.env', false);
loadEnvFile('.env.local', true);
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

try {
  const module = await import('./index.js');
  if (typeof module.default === 'function') {
    await module.default();
  }
} catch (error) {
  console.error('Failed to start application:', error);
  process.exit(1);
}
