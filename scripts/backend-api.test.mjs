import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { localStatus, sql } from './local-backend.mjs';

const venueA = '00000000-0000-4000-8000-000000000001';
const venueB = '00000000-0000-4000-8000-000000000002';

// Test-only TOTP generator. Secrets and tokens stay in memory and are never printed.
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const letter of secret.toUpperCase().replace(/=+$/, '')) {
    const index = alphabet.indexOf(letter);
    assert.notEqual(index, -1, 'valid base32 factor secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => Number.parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[19] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

test('isolated local Auth and API security integration', async (t) => {
  const status = localStatus();
  const base = status.API_URL;
  assert.equal(base, 'http://127.0.0.1:55321', 'test targets the fixed local API only');
  assert.equal(sql('select environment from private.release_controls;').trim(), 'local');
  assert.equal(sql('select live_venues_enabled or live_offers_enabled from private.release_controls;').trim(), 'f');
  const publicKey = status.ANON_KEY || status.PUBLISHABLE_KEY;
  const secretKey = status.SERVICE_ROLE_KEY || status.SECRET_KEY;
  assert.ok(publicKey && secretKey, 'local status provides test credentials');
  const users = [];

  async function request(path, { method = 'GET', token = publicKey, body, admin = false } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        apikey: admin ? secretKey : publicKey,
        Authorization: `Bearer ${admin ? secretKey : token}`,
        'Content-Type': 'application/json',
        'Accept-Profile': 'api', 'Content-Profile': 'api',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  }
  async function rpc(name, user, body, expected) {
    const result = await request('/rest/v1/rpc/' + name, { method: 'POST', token: user.token, body });
    const message = `${name}: ${result.data?.message || 'unexpected status'}`;
    if (expected === undefined) assert.ok([200, 204].includes(result.status), message);
    else assert.equal(result.status, expected, message);
    return result.data;
  }
  async function createUser(label) {
    const email = `dusk-${label}-${randomUUID()}@example.invalid`;
    const password = randomBytes(24).toString('base64url');
    const created = await request('/auth/v1/admin/users', { method: 'POST', admin: true, body: { email, password, email_confirm: true } });
    assert.equal(created.status, 200, 'create synthetic Auth fixture');
    const login = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    assert.equal(login.status, 200, 'ordinary password sign-in');
    const user = { id: created.data.id, token: login.data.access_token };
    users.push(user);
    user.account = await rpc('ensure_account', user, { display_name: 'SYNTHETIC API fixture' });
    assert.match(user.account, /^[0-9a-f-]{36}$/);
    return user;
  }
  async function enrollMfa(user) {
    const factor = await request('/auth/v1/factors', { method: 'POST', token: user.token, body: { factor_type: 'totp', friendly_name: 'SYNTHETIC local test' } });
    assert.equal(factor.status, 200, 'enroll real local TOTP');
    const challenge = await request(`/auth/v1/factors/${factor.data.id}/challenge`, { method: 'POST', token: user.token, body: {} });
    assert.equal(challenge.status, 200, 'create TOTP challenge');
    const verified = await request(`/auth/v1/factors/${factor.data.id}/verify`, { method: 'POST', token: user.token, body: { challenge_id: challenge.data.id, code: totp(factor.data.totp.secret) } });
    assert.equal(verified.status, 200, 'verify real local TOTP');
    user.token = verified.data.access_token;
  }

  try {
    const customerA = await createUser('customer-a');
    const customerB = await createUser('customer-b');
    const employee = await createUser('employee');
    const manager = await createUser('manager');
    const admin = await createUser('admin');
    // Privileged setup is limited to this fixed local instance. All assertions below use ordinary sessions.
    sql(`insert into private.dusk_admins values ('${admin.account}',true,'SYNTHETIC API test grant');
      insert into app.venue_memberships(venue_id,account_id,role,granted_by) values
      ('${venueA}','${manager.account}','manager','${admin.account}'),
      ('${venueA}','${employee.account}','employee','${admin.account}');`);

    await t.test('customers have isolated profiles and no internal venues', async () => {
      const own = await request('/rest/v1/my_account', { token: customerA.token });
      assert.equal(own.status, 200);
      assert.deepEqual(own.data.map((row) => row.id), [customerA.account]);
      const other = await request(`/rest/v1/my_account?id=eq.${customerB.account}`, { token: customerA.token });
      assert.deepEqual(other.data, []);
      const venues = await request('/rest/v1/my_venues', { token: customerA.token });
      assert.deepEqual(venues.data, []);
      await rpc('get_venue_verifications', customerA, { venue_id: venueA }, 403);
    });
    await t.test('employees see only their own venue and cannot create offers', async () => {
      const venues = await request('/rest/v1/my_venues', { token: employee.token });
      assert.deepEqual(venues.data.map((row) => row.id), [venueA]);
      await enrollMfa(employee);
      await rpc('create_offer', employee, { venue_id: venueA }, 403);
    });
    await t.test('managers require MFA and cannot acquire another venue', async () => {
      await rpc('create_offer', manager, { venue_id: venueA }, 403);
      await enrollMfa(manager);
      await rpc('create_offer', manager, { venue_id: venueB }, 403);
      await rpc('set_membership', manager, { venue_id: venueB, account_id: manager.account, member_role: 'manager', member_status: 'active' }, 403);
    });
    let offer;
    await t.test('revision retries and concurrent saves preserve immutable history', async () => {
      offer = await rpc('create_offer', manager, { venue_id: venueA });
      const content = { title: 'SYNTHETIC preview', description: 'SYNTHETIC API test', product: 'SYNTHETIC drink', terms: 'Non-redeemable test only', priceCents: 100,
        schedule: { timeZone: 'America/Los_Angeles', startsOn: '2026-01-01', endsBefore: '2029-01-01', weekly: [{ day: 'Fri', start: '22:00', end: '02:00' }] } };
      const args = { offer_id: offer, request_id: randomUUID(), content };
      assert.equal(await rpc('create_offer_revision', manager, args), 1);
      assert.equal(await rpc('create_offer_revision', manager, args), 1);
      await rpc('create_offer_revision', manager, { ...args, content: { ...content, title: 'Changed content' } }, 409);
      const versions = await Promise.all([1, 2].map(() => rpc('create_offer_revision', manager, { ...args, request_id: randomUUID() })));
      assert.deepEqual(versions.sort(), [2, 3]);
      await rpc('submit_offer_revision', manager, { offer_id: offer, revision_no: 1 });
      await rpc('review_offer_revision', manager, { offer_id: offer, revision_no: 1, decision: 'approved', reason: 'test', evidence_reference: 'test' }, 403);
      await rpc('publish_offer', manager, { offer_id: offer, revision_no: 1 }, 403);
    });
    await t.test('admin review requires real MFA and still cannot enable publication', async () => {
      const args = { offer_id: offer, revision_no: 1, decision: 'approved', reason: 'SYNTHETIC review', evidence_reference: 'SYNTHETIC evidence' };
      await rpc('review_offer_revision', admin, args, 403);
      await enrollMfa(admin);
      await rpc('review_offer_revision', admin, args);
      await rpc('publish_offer', admin, { offer_id: offer, revision_no: 1 }, 403);
      await rpc('publish_venue', admin, { venue_id: venueA }, 403);
      const publicVenues = await request('/rest/v1/public_venues');
      const publicOffers = await request('/rest/v1/public_offers');
      assert.deepEqual(publicVenues.data, []);
      assert.deepEqual(publicOffers.data, []);
    });
    await t.test('membership removal blocks the existing authenticated session immediately', async () => {
      await rpc('set_membership', admin, { venue_id: venueA, account_id: manager.account, member_role: 'manager', member_status: 'inactive' });
      await rpc('pause_offer', manager, { offer_id: offer }, 403);
      await rpc('set_account_status', admin, { account_id: customerB.account, account_status: 'inactive' });
      await rpc('update_my_profile', customerB, { display_name: 'Blocked' }, 403);
    });
    await t.test('private and application base schemas are unavailable through REST', async () => {
      const response = await fetch(base + '/rest/v1/venue_verifications', { headers: { apikey: publicKey, Authorization: `Bearer ${admin.token}`, 'Accept-Profile': 'private' } });
      assert.equal(response.status, 406);
    });
  } finally {
    for (const user of users) {
      sql(`update app.accounts set status='inactive',display_name=null where auth_user_id='${user.id}';`);
      const removed = await request('/auth/v1/admin/users/' + user.id, { method: 'DELETE', admin: true });
      assert.equal(removed.status, 200, 'remove synthetic Auth fixture');
    }
  }
});
