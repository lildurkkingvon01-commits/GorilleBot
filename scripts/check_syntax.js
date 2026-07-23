const { execSync } = require('child_process');
const files = [
  'src/commands/addplayer.js','src/commands/config.js','src/commands/dm.js','src/commands/f.js','src/commands/frequency.js','src/commands/fsave.js','src/commands/help.js','src/commands/listplayers.js','src/commands/myconfig.js','src/commands/orphan.js','src/commands/removeplayer.js','src/commands/save.js','src/commands/savelist.js','src/commands/seuil.js','src/cron/checkInactivity.js','src/index.js','src/middleware/globalMiddleware.js','src/utils/database.js'
];
for (const f of files) {
  try {
    execSync(`node --check "${f}"`, { stdio: 'inherit' });
    console.log('OK', f);
  } catch (e) {
    console.error('ERR', f);
    process.exit(1);
  }
}
console.log('All checked');
