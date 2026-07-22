import dotenv from 'dotenv';
import path from 'path';
import { existsSync, readFileSync } from 'fs';

const root = process.cwd();
const envPath = path.join(root, '.env');
const localPath = path.join(root, '.env.local');
console.log('cwd=', root);
console.log('.env path=', envPath, 'exists=', existsSync(envPath));
console.log('.env.local path=', localPath, 'exists=', existsSync(localPath));
if (existsSync(envPath)) {
  const contents = readFileSync(envPath, 'utf8');
  console.log('.env first lines:', contents.split(/\r?\n/).slice(0, 20));
}
const cfg = dotenv.config({ path: envPath });
console.log('dotenv.config returns:', cfg);
console.log('env values:', {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_SSL: process.env.DB_SSL,
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});
if (existsSync(localPath)) {
  const localEnv = dotenv.parse(readFileSync(localPath, 'utf8'));
  console.log('.env.local parsed:', localEnv);
}
