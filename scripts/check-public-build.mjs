import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const directory = resolve(process.argv[2] || 'dist');
const native = process.argv.includes('--native');
let count = 0;
function scan(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const name = resolve(path, entry.name);
    if (entry.isDirectory()) scan(name);
    else if (/\.(?:js|html|json|css)$/.test(entry.name)) {
      count++;
      const value = readFileSync(name, 'utf8');
      if (/sb_secret_[A-Za-z0-9_-]+|postgres(?:ql)?:\/\/[^\s"']+/i.test(value)) throw new Error('Privileged credential pattern found in public build.');
      for (const jwt of value.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
        const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
        if (payload.role !== 'anon') throw new Error('Non-public JWT found in public build.');
      }
      if (native && /127\.0\.0\.1:55321|DUSK_LOCAL_BACKEND_BUILD/.test(value)) throw new Error('Development endpoint found in default native build.');
    }
  }
}
scan(directory);
console.log(`Public build credential scan passed (${count} text assets${native ? ', default native' : ''}). Pattern scan does not replace configuration review.`);
