import { GATEWAY_BASE_URL } from '../src/config/gateway';

test('uses the configured Teddy Bud Cloudflare Worker', () => {
  expect(GATEWAY_BASE_URL).toBe(
    'https://teddy-bud-gateway.harryjees.workers.dev',
  );
});
