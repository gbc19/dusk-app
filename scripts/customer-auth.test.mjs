import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStatus, sql } from './local-backend.mjs';

test('local customer registration and recovery through ordinary public credentials', async t => {
  const status = localStatus();
  assert.equal(status.API_URL, 'http://127.0.0.1:55321');
  assert.equal(sql('select environment from private.release_controls;').trim(), 'local');
  const key = status.ANON_KEY || status.PUBLISHABLE_KEY;
  const secret = status.SERVICE_ROLE_KEY || status.SECRET_KEY;
  const email = `customer-${randomUUID()}@example.invalid`;
  const mailbox = email.split('@')[0];
  let password = randomBytes(24).toString('base64url');
  let userId;
  const sessions = new Map();
  const storage = { getItem: key => sessions.get(key) ?? null, setItem: (key, value) => sessions.set(key, value), removeItem: key => sessions.delete(key) };
  const client = () => createClient(status.API_URL, key, { db: { schema: 'api' }, auth: { storage, storageKey: 'dusk-customer-test', autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }) } });
  const auth = client();
  async function mailCode() {
    for (let attempt = 0; attempt < 30; attempt++) {
      // CLI runtimes have used both Mailpit and Inbucket. Read only this unique synthetic mailbox.
      const list = await fetch('http://127.0.0.1:55324/api/v1/messages').then(r => r.ok ? r.json() : null).catch(() => null);
      let body = '';
      if (list?.messages) {
        const message = list.messages.find(m => m.To?.some(to => to.Address === email));
        if (message) body = JSON.stringify(await fetch(`http://127.0.0.1:55324/api/v1/message/${message.ID}`).then(r => r.json()));
      } else {
        const inbox = await fetch(`http://127.0.0.1:55324/api/v1/mailbox/${mailbox}`).then(r => r.ok ? r.json() : []).catch(() => []);
        const message = Array.isArray(inbox) ? inbox.at(-1) : null;
        if (message) body = JSON.stringify(await fetch(`http://127.0.0.1:55324/api/v1/mailbox/${mailbox}/${message.id}`).then(r => r.json()));
      }
      const code = body.match(/(?:<strong>|code[^\d]{0,30})(\d{6,10})(?:<|\b)/i)?.[1];
      if (code) return code;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    assert.fail('Synthetic test mail did not arrive with an email code');
  }
  try {
    await t.test('registration has no session until email verification', async () => {
      const result = await auth.auth.signUp({ email, password });
      assert.equal(result.error, null); assert.equal(result.data.session, null);
      userId = result.data.user?.id; assert.ok(userId);
      const login = await auth.auth.signInWithPassword({ email, password }); assert.ok(login.error);
    });
    await t.test('email code verifies and creates only an ordinary account', async () => {
      const result = await auth.auth.verifyOtp({ email, token: await mailCode(), type: 'signup' });
      assert.equal(result.error, null); assert.ok(result.data.session);
      const ensured = await auth.rpc('ensure_account', {}); assert.equal(ensured.error, null);
      const account = await auth.from('my_account').select('id,status'); assert.equal(account.error, null); assert.equal(account.data.length, 1);
      const elevated = await auth.schema('api').rpc('set_membership', { venue_id: '00000000-0000-4000-8000-000000000001', account_id: ensured.data, member_role: 'manager', member_status: 'active' });
      assert.ok(elevated.error);
    });
    await t.test('session restoration and refresh use ordinary Auth tokens', async () => {
      const restored = client(); const session = await restored.auth.getSession(); assert.ok(session.data.session);
      const refreshed = await restored.auth.refreshSession(); assert.equal(refreshed.error, null); assert.ok(refreshed.data.session);
      const rejected = await fetch(status.API_URL + '/rest/v1/my_account', { headers: { apikey: key, Authorization: 'Bearer invalid-expired-token', 'Accept-Profile': 'api' } });
      assert.equal(rejected.status, 401);
    });
    await t.test('logout clears local storage and permits password login again', async () => {
      assert.equal((await auth.auth.signOut({ scope: 'local' })).error, null);
      assert.equal(sessions.has('dusk-customer-test'), false);
      assert.equal((await auth.auth.signInWithPassword({ email, password })).error, null);
      await auth.auth.signOut({ scope: 'local' });
    });
    await t.test('recovery code changes password without redirect or role metadata', async () => {
      // Remove this test mailbox's old verification email before polling recovery.
      const inbox = await fetch(`http://127.0.0.1:55324/api/v1/mailbox/${mailbox}`, { method: 'DELETE' });
      if (!inbox.ok) {
        const list = await fetch('http://127.0.0.1:55324/api/v1/messages').then(r => r.json());
        for (const message of list.messages || []) if (message.To?.some(to => to.Address === email)) await fetch(`http://127.0.0.1:55324/api/v1/messages/${message.ID}`, { method: 'DELETE' });
      }
      assert.equal((await auth.auth.resetPasswordForEmail(email)).error, null);
      assert.equal((await auth.auth.verifyOtp({ email, token: await mailCode(), type: 'recovery' })).error, null);
      const old = password; password = randomBytes(24).toString('base64url');
      assert.equal((await auth.auth.updateUser({ password })).error, null);
      await auth.auth.signOut({ scope: 'local' });
      assert.ok((await auth.auth.signInWithPassword({ email, password: old })).error);
      assert.equal((await auth.auth.signInWithPassword({ email, password })).error, null);
    });
    await t.test('publication remains disabled and private feeds stay inaccessible', async () => {
      assert.equal((await auth.from('public_venues').select('*')).data.length, 0);
      assert.equal((await auth.from('public_offers').select('*')).data.length, 0);
      const response = await fetch(status.API_URL + '/rest/v1/venue_verifications', { headers: { apikey: key, 'Accept-Profile': 'private' } }); assert.equal(response.status, 406);
      assert.equal(sql('select live_venues_enabled or live_offers_enabled from private.release_controls;').trim(), 'f');
    });
  } finally {
    await auth.auth.signOut({ scope: 'local' });
    if (userId) {
      assert.match(userId, /^[0-9a-f-]{36}$/);
      sql(`update app.accounts set display_name = null, status = 'inactive' where auth_user_id = '${userId}';`);
      const response = await fetch(status.API_URL + '/auth/v1/admin/users/' + userId, { method: 'DELETE', headers: { apikey: secret, Authorization: `Bearer ${secret}` } });
      assert.equal(response.status, 200, 'delete only the synthetic Auth test identity');
    }
  }
});
