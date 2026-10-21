import assert from 'node:assert/strict';
import test from 'node:test';

// the real server function, run against an in-memory KV
import { onRequestGet, onRequestPost } from '../../motordex/functions/api/friends.js';

function kv(rows: Record<string, { name: string }>) {
  const m = new Map<string, string>([['snap:lb', JSON.stringify({ rows })]]);
  return {
    async get(k: string, type?: string) {
      const v = m.get(k);
      if (v == null) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(k: string, v: string) { m.set(k, v); },
  };
}
const post = async (env: any, body: any) => (await onRequestPost({ request: new Request('https://x/api/friends', { method: 'POST', body: JSON.stringify(body) }), env })).json();
const get = async (env: any, token: string) => (await onRequestGet({ request: new Request('https://x/api/friends?token=' + token), env })).json();

const A = 'token-aaaaaaaa';
const B = 'token-bbbbbbbb';
const rows = { [A]: { name: '@amy' }, [B]: { name: '@ben' } };

test('only friends can be invited to a race, and the invite lands in their inbox', async () => {
  const env = { FEED: kv(rows) };
  assert.equal((await post(env, { action: 'invite', token: A, name: '@amy', friend: '@ben', code: 'ABCDE' })).ok, false);
  await post(env, { action: 'request', token: A, name: '@amy', target: '@ben' });
  await post(env, { action: 'accept', token: B, name: '@ben', from: '@amy' });
  const inv = await post(env, { action: 'invite', token: A, name: '@amy', friend: '@ben', code: 'abcde' });
  assert.equal(inv.ok, true);
  const mine = await get(env, B);
  assert.deepEqual(mine.invites.map((i: any) => [i.from, i.code]), [['@amy', 'ABCDE']]);
  assert.equal((await get(env, A)).invites.length, 0);
  // inviting twice doesn't stack
  await post(env, { action: 'invite', token: A, name: '@amy', friend: '@ben', code: 'ABCDE' });
  assert.equal((await get(env, B)).invites.length, 1);
  await post(env, { action: 'dismiss', token: B, code: 'ABCDE' });
  assert.equal((await get(env, B)).invites.length, 0);
});
