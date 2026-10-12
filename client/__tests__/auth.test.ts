import { AccessAuthService } from '../src/services/auth';

function jwtWithExpiry(exp: number) {
  const payload = btoa(JSON.stringify({ exp })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `header.${payload}.signature`;
}

test('accepts a non-expired Access callback token', async () => {
  const service = new AccessAuthService();
  const session = await service.consumeCallback(`teddybud://auth/callback?token=${jwtWithExpiry(Math.floor(Date.now() / 1000) + 300)}`);
  expect(session?.accessToken).toContain('header.');
});

test('rejects an expired Access callback token', async () => {
  const service = new AccessAuthService();
  await expect(service.consumeCallback(`teddybud://auth/callback?token=${jwtWithExpiry(Math.floor(Date.now() / 1000) - 1)}`)).rejects.toThrow('expired');
});
