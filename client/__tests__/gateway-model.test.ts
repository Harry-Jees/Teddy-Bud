import { GatewayService } from '../src/services/gateway';

const auth = {
  restore: jest.fn(async () => null),
  refresh: jest.fn(async () => ({ accessToken: 'test-token', expiresAt: Date.now() + 60_000 })),
  clear: jest.fn(async () => undefined),
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GatewayService chat model selection', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    auth.restore.mockClear();
    auth.refresh.mockClear();
    auth.clear.mockClear();
  });

  it('uses the fast preferred available model and empathetic concise chat guidance', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({
        data: [
          { id: 'nvidia/llama-3.1-nemotron-70b-instruct' },
          { id: 'nvidia/nemotron-3.5-lightning-30b-a3b' },
        ],
      }))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: 'That sounds like a lot to carry.' } }] }));
    globalThis.fetch = fetchMock;

    const gateway = new GatewayService('https://gateway.test', auth, auth);
    const result = await gateway.sendChatMessage('I feel overwhelmed.', [], 'test-token');

    expect(result).toBe('That sounds like a lot to carry.');
    expect(fetchMock.mock.calls[1][0]).toBe('https://gateway.test/v1/chat/completions');
    expect(fetchMock.mock.calls[0][1].headers).toEqual(expect.objectContaining({ Authorization: 'Bearer test-token' }));
    expect(fetchMock.mock.calls[1][1].headers).toEqual(expect.objectContaining({ Authorization: 'Bearer test-token' }));
    const chatRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(chatRequest.model).toBe('nvidia/nemotron-3.5-lightning-30b-a3b');
    expect(chatRequest.messages[0]).toEqual(expect.objectContaining({
      role: 'system',
      content: expect.stringContaining('without labeling, diagnosing'),
    }));
    expect(chatRequest.max_tokens).toBe(220);
  });

  it('falls back to the next preferred catalog model when NVIDIA returns 404', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({
        data: [
          { id: 'nvidia/nemotron-3.5-lightning-30b-a3b' },
          { id: 'nvidia/mistral-nemo-minitron-8b-8k-instruct' },
        ],
      }))
      .mockResolvedValueOnce(response({ detail: 'Function not found.' }, 404))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: 'I hear you.' } }] }));
    globalThis.fetch = fetchMock;

    const gateway = new GatewayService('https://gateway.test', auth, auth);
    await gateway.sendChatMessage('I feel sad today.', [], 'test-token');

    const firstChatRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const secondChatRequest = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(firstChatRequest.model).toBe('nvidia/nemotron-3.5-lightning-30b-a3b');
    expect(secondChatRequest.model).toBe('nvidia/mistral-nemo-minitron-8b-8k-instruct');
  });

  it('refreshes once after a chat request returns 401, then retries with the renewed bearer token', async () => {
    auth.refresh.mockResolvedValueOnce({ accessToken: 'refreshed-token', expiresAt: Date.now() + 60_000 });
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({ data: [{ id: 'nvidia/nemotron-3.5-lightning-30b-a3b' }] }))
      .mockResolvedValueOnce(response({ error: { message: 'Unauthorized.' } }, 401))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: 'I am here with you.' } }] }));
    globalThis.fetch = fetchMock;

    const gateway = new GatewayService('https://gateway.test', auth, auth);
    const result = await gateway.sendChatMessage('I feel alone.', [], 'expired-token');

    expect(result).toBe('I am here with you.');
    expect(auth.refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][1].headers).toEqual(expect.objectContaining({ Authorization: 'Bearer expired-token' }));
    expect(fetchMock.mock.calls[2][1].headers).toEqual(expect.objectContaining({ Authorization: 'Bearer refreshed-token' }));
  });
});
