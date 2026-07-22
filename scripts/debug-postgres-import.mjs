import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log('cwd', process.cwd());
console.log('script dir', __dirname);
try {
  const module = await import('../src/utils/postgres.js');
  console.log('module loaded', Object.keys(module));
  console.log('DB_HOST after import', process.env.DB_HOST);
} catch (error) {
  console.error('import failed', error);
  process.exit(1);
}
