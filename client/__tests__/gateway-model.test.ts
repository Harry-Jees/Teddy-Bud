import { GatewayService } from '../src/services/gateway';

const auth = {
  restore: jest.fn(async () => ({ accessToken: 'test-token', expiresAt: Date.now() + 60_000 })),
  refresh: jest.fn(async () => ({ accessToken: 'test-token', expiresAt: Date.now() + 60_000 })),
  clear: jest.fn(async () => undefined),
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('GatewayService', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; jest.restoreAllMocks(); });
  beforeEach(() => { auth.restore.mockClear(); auth.refresh.mockClear(); auth.clear.mockClear(); });

  it('sends chat directly to the configured model with the selected companion identity and guidance', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(response({ choices: [{ message: { content: 'That sounds like a lot to carry.' } }] }));
    globalThis.fetch = fetchMock;
    const gateway = new GatewayService('https://gateway.test', auth);
    await expect(gateway.sendChatMessage('I feel overwhelmed.', [], 'test-token', { assistantName: 'Pankaj', assistantCharacterId: 'sunny', task: 'conversation' })).resolves.toBe('That sounds like a lot to carry.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://gateway.test/v1/chat/completions');
    expect(fetchMock.mock.calls[0][1].headers).toEqua¶»§q«^