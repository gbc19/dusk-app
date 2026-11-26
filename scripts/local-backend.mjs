import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const project = 'dusk-foundation-local';
const cli = resolve(root, 'node_modules/supabase/dist/supabase.js');
const stack = 'foundation';

export function dockerCommand() {
  const perUser = resolve(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/resources/bin/docker.exe');
  return process.platform === 'win32' && existsSync(perUser) ? perUser : 'docker';
}

export function run(command, args, { capture = false, input } = {}) {
  const result = spawnSync(command, args, {
    cwd: root, encoding: 'utf8', input, maxBuffer: 32 * 1024 * 1024,
    stdio: capture || input !== undefined ? ['pipe', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, SUPABASE_EXPERIMENTAL_STACK: '1', PATH: existsSync(dockerCommand()) ? `${dirname(dockerCommand())}${delimiter}${process.env.PATH}` : process.env.PATH },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    // Status captures may contain local credentials, so never echo captured output.
    const structured = (result.stdout || '').split('\n').flatMap(line => {
      try { const event = JSON.parse(line); return event._tag === 'Error' && typeof event.error?.message === 'string' ? [event.error.message] : []; } catch { return []; }
    });
    const diagnostic = [...structured, ...(result.stderr || '').split('\n').filter((line) => /ERROR:|DETAIL:|\[task\] failed:/.test(line))].join('\n').replace(/eyJ[A-Za-z0-9_.-]+|sb_(?:secret|publishable)_[A-Za-z0-9_-]+|postgres(?:ql)?:\/\/[^\s"']+/g, '[redacted]').slice(-1200);
    throw new Error(`${command.split(/[\\/]/).pop()} failed with exit code ${result.status}. ${diagnostic || 'Check Docker Desktop and the documented local setup.'}`);
  }
  return result.stdout || '';
}

function checkConfiguration() {
  const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
  if (!config.includes(`project_id = "${project}"`) || !config.includes('port = 55321') || !config.includes('schemas = ["api"]')) {
    throw new Error('Unexpected local backend configuration. Refusing to operate on a different project.');
  }
}

export function localStatus() {
  checkConfiguration();
  const result = JSON.parse(run(process.execPath, [cli, 'status', '--stack', stack, '--output-format', 'json'], { capture: true }));
  const credentials = result.env;
  const stackId = result.identity?.id;
  const container = run(dockerCommand(), ['ps', '--filter', `label=com.supabase.stack=${stackId}`, '--filter', 'label=com.supabase.service=database', '--format', '{{.ID}}'], { capture: true }).trim();
  if (!stackId || !container || credentials.API_URL !== 'http://127.0.0.1:55321') throw new Error('Unexpected local stack identity or endpoint.');
  return { ...credentials, stackId, databaseContainer: container };
}

export function sql(query) {
  checkConfiguration();
  return run(dockerCommand(), ['exec', '-i', localStatus().databaseContainer, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { capture: true, input: query });
}

function verifyLoopback() {
  const ids = run(dockerCommand(), ['ps', '--filter', `label=com.supabase.stack=${localStatus().stackId}`, '-q'], { capture: true }).trim().split(/\s+/).filter(Boolean);
  if (!ids.length) throw new Error('Local containers were not found.');
  for (const id of ids) {
    const container = JSON.parse(run(dockerCommand(), ['inspect', id], { capture: true }))[0];
    for (const bindings of Object.values(container.NetworkSettings.Ports || {})) {
      for (const binding of bindings || []) {
        if (!['127.0.0.1', '::1'].includes(binding.HostIp)) {
          throw new Error('A local service is not bound to loopback. Stop it with npm run backend:stop and review Docker network settings.');
        }
      }
    }
  }
}

function verifyHostNetwork() {
  if (process.platform === 'win32') {
    run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(root, 'scripts/check-local-backend-network.ps1')]);
  } else if (process.env.CI !== 'true') {
    throw new Error('Local host firewall validation is implemented for Windows. Linux CI uses an isolated runner.');
  }
}

function main() {
  checkConfiguration();
  if (process.argv.length !== 3) throw new Error('Use a documented backend npm script without additional flags.');
  const action = process.argv[2];
  if (action === 'start') {
    verifyHostNetwork();
    // Do not print CLI status because it includes local administrative keys.
    run(process.execPath, [cli, 'start', '--stack', stack, '--runtime', 'docker', '--eager'], { capture: true });
    try { verifyLoopback(); } catch (error) {
      run(process.execPath, [cli, 'stop', '--stack', stack], { capture: true });
      throw error;
    }
    console.log('Local backend started. Docker ports are loopback-only; host firewall verified. API 55321, Studio 55323, test mail 55324.');
  } else if (action === 'stop') {
    run(process.execPath, [cli, 'stop', '--stack', stack], { capture: true });
    console.log('Local backend stopped. Its data is retained.');
  } else if (action === 'status') {
    verifyHostNetwork();
    localStatus();
    verifyLoopback();
    console.log('Local backend is running. No credentials printed. API http://127.0.0.1:55321');
  } else if (action === 'reset') {
    localStatus();
    const environment = sql('select environment from private.release_controls where singleton;').trim();
    if (environment !== 'local') throw new Error('Reset is restricted to the disposable local foundation database.');
    console.log('Rebuilding the disposable dusk-foundation-local database from migrations and synthetic seeds.');
    run(process.execPath, [cli, 'db', 'reset', '--local', '--stack', stack, '--yes'], { capture: true });
    verifyLoopback();
    console.log('Local rebuild complete.');
  } else if (action === 'test') {
    localStatus();
    run(process.execPath, [cli, 'test', 'db', '--stack', stack]);
  } else {
    throw new Error('Unknown backend action.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
