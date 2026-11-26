import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const args of [['node_modules/typescript/bin/tsc', '-b'], ['node_modules/vite/bin/vite.js', 'build', '--mode', 'native-local'], ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android']]) {
  const result = spawnSync(process.execPath, args.map((arg, i) => i === 0 ? resolve(root, arg) : arg), { cwd: root, stdio: 'inherit', env: { ...process.env, DUSK_LOCAL_BACKEND: '1' } });
  if (result.status !== 0) process.exit(result.status || 1);
}
