import assert from 'node:assert/strict';
import test from 'node:test';

// the real server function, run against an in-memory KV
import { onRequestGet, onRequestPost } from '../../motordex/functions/api/account.js';

function kv() {
  const m = new Map<string, string>();
  return {
    m,
    async get(k: string, type?: string) {
      const v = m.get(k);
      if (v == null) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(k: string, v: string) { m.set(k, v); },
  };
}
const call = async (env: any, body: any, ip = '1.1.1.1') => {
  const r = await onRequestPost({ request: new Request('https://x/api/account', { method: 'POST', body: JSON.stringify(body), headers: { 'CF-Connecting-IP': ip } }), env });
  return { status: r.status, j: await r.json() };
};

test('register then log in returns the same save token; password is never stored', async () => {
  const env = { FEED: kv() };
  const reg = await call(env, { action: 'register', username: '@Sam_01', password: 'correct horse', token: 'tok-12345678' });
  assert.equal(reg.status, 200);
  assert.equal(reg.j.token, 'tok-12345678');
  const stored = env.FEED.m.get('acct:sam_01')!;
  assert.ok(!stored.includes('correct horse'));
  assert.ok(JSON.parse(stored).hash.length > 20);
  const ok = await call(env, { action: 'login', username: 'sam_01', password: 'correct horse' });
  assert.equal(ok.j.token, 'tok-12345678');
  const bad = await call(env, { action: 'login', username: 'sam_01', password: 'wrong password' });
  assert.equal(bad.status, 401);
  const ghost = await call(env, { action: 'login', username: 'nobody_here', password: 'whatever pass' });
  assert.equal(ghost.status, 401);
  assert.equal(ghost.j.error, bad.j.error);
});

test('usernames and passwords are validated, and a name can only be taken once', async () => {
  const env = { FEED: kv() };
  assert.equal((await call(env, { action: 'register', username: 'ab', password: 'longenough1', token: 'tok-12345678' })).status, 400);
  assert.equal((await call(env, { action: 'register', username: 'okname', password: 'short', token: 'tok-12345678' })).status, 400);
  assert.equal((await call(env, { action: 'register', username: 'okname', password: 'longenough1', token: 'tok-12345678' })).status, 200);
  assert.equal((await call(env, { action: 'register', username: 'okname', password: 'longenough1', token: 'tok-87654321' })).status, 409);
  const g = await onRequestGet({ request: new Request('https://x/api/account?name=okname'), env });
  assert.equal((await g.json()).available, false);
});

test('repeated wrong passwords get locked out, and one IP is rate limited', async () => {
  const env = { FEED: kv() };
  await call(env, { action: 'register', username: 'locked1', password: 'longenough1', token: 'tok-12345678' });
  let last = 0;
  for (let i = 0; i < 10; i++) last = (await call(env, { action: 'login', username: 'locked1', password: 'nope nope nope' }, '9.9.9.' + i)).status;
  assert.equal(last, 429);
  const env2 = { FEED: kv() };
  let s = 0;
  for (let i = 0; i < 14; i++) s = (await call(env2, { action: 'login', username: 'whoever', password: 'x'.repeat(10) }, '8.8.8.8')).status;
  assert.equal(s, 429);
});
