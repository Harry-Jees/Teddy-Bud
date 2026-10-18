import { GatewayService } from '../src/services/gateway';

const auth = {
  restore: jest.fn(async () => ({ accessToken: 'test-token', expiresAt: Date.now() + 60_000 })),
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

  it('uses the preferred available model and empathetic concise chat guidance', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({
        data: [
          { id: 'nvidia/nemotron-3-super-120b-a12b' },
          { id: 'nvidia/llama-3.1-nemotron-70b-instruct' },
          { id: 'nvidia/nemotron-3.5-lightning-30b-a3b' },
        ],
      }))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: 'That sounds like a lot to carry.' } }] }));
    globalThis.fetch = fetchMock;

    const gateway = new GatewayService('https://gateway.test', auth);
    const result = await gateway.sendChatMessage('I feel overwhelmed.', [], 'test-token');

    expect(result).toBe('That sounds like a lot to carry.');
    expect(fetchMock.mock.calls[1][0]).toBe('https://gateway.test/v1/chat/completions');
    expect(fetchMock.mock.calls[0][1].headers).toEqual(expect.objectContaining({ Authorization: 'Bearer test-token' }));
    expect(fetchMock.mock.calls[1][1].headers).toEqual(expect.objectContaining({ Authorization: 'Bearer test-token' }));
    const chatRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(chatRequest.model).toBe('nvidia/nemotron-3-super-120b-a12b');
    expect(chatRequest.messages[0]).toEqual(expect.objectContaining({
      role: 'system',
      content: expect.stringContaining('do not announce sentiment labels'),
    }));
    expect(chatRequest.messages[0].content).toContain('treating any interpretation as uncertain');
    expect(chatRequest.messages[0].content).toContain('mixed feelings');
    expect(chatRequest.messages[0].content).not.toContain('The user opted in to sharing a few locally selected excerpts');
    expect(chatRequest.max_tokens).toBe(1024);
  });

  it('passes the whole active conversation while it fits in the model context budget', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({
        data: [{ id: 'nvidia/nemotron-3-super-120b-a12b' }],
      }))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: 'I remember that.' } }] }));
    globalThis.fetch = fetchMock;
    const history = Array.from({ length: 30 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `Earlier context ${index}`,
    }));

    const gateway = new GatewayService('https://gateway.test', auth);
    await gateway.sendChatMessage('And that is still true.', history, 'test-token');

    const chatRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(chatRequest.messages).toHaveLength(32);
    expect(chatRequest.messages[1].content).toBe('Earlier context 0');
    expect(chatRequest.messages[30].content).toBe('Earlier context 29');
  });

  it('drops only older context when a conversation exceeds the provider input budget', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({
        data: [{ id: 'nvidia/nemotron-3-super-120b-a12b' }],
      }))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: 'I am following.' } }] }));
    globalThis.fetch = fetchMock;
    const history = Array.from({ length: 200 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `Turn ${index} ${'x'.repeat(500)}`,
    }));

    const gateway = new GatewayService('https://gateway.test', auth);
    await gateway.sendChatMessage('Continue.', history, 'test-token');

    const chatRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const sentHistory = chatRequest.messages.slice(1, -1);
    expect(sentHistory.length).toBeGreaterThan(100);
    expect(sentHistory.length).toBeLessThan(history.length);
    expect(sentHistory[0].content).not.toBe(history[0].content);
    expect(sentHistory[sentHistory.length - 1].content).toBe(history[history.length - 1].content);
  });

  it('shares only explicitly opted-in bounded chat excerpts and adds crisis guidance when signalled', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({
        data: [{ id: 'nvidia/nemotron-3-super-120b-a12b' }],
      }))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: 'I am here with you.' } }] }));
    globalThis.fetch = fetchMock;

    const gateway = new GatewayService('https://gateway.test', auth);
    await gateway.sendChatMessage('I want to die.', [], 'test-token', {
      task: 'conversation',
      crossChatContext: ['My long-term marathon goal. '.repeat(150)],
      crisisConcern: true,
    });

    const chatRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const systemContent = chatRequest.messages[0].content as string;
    expect(chatRequest.messages[chatRequest.messages.length - 1].content).toBe('I want to die.');
    expect(systemContent).toContain('The user opted in to sharing a few locally selected excerpts');
    expect(systemContent).toContain('SAFETY PRIORITY');
    expect(systemContent).toContain('local emergency services');
    expect(systemContent.length).toBeLessThan(5_000);
  });

  it('suggests only a model-returned important memory and returns null when none is suitable', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({
        data: [{ id: 'nvidia/nemotron-3-super-120b-a12b' }],
      }))
      .mockResolvedValueOnce(response({
        choices: [{ message: { content: '{"fact":"I am working toward becoming a teacher."}' } }],
      }))
      .mockResolvedValueOnce(response({
        data: [{ id: 'nvidia/nemotron-3-super-120b-a12b' }],
      }))
      .mockResolvedValueOnce(response({
        choices: [{ message: { content: '{"fact":null}' } }],
      }));
    globalThis.fetch = fetchMock;

    const gateway = new GatewayService('https://gateway.test', auth);
    await expect(gateway.suggestMemory('My long-term goal is to become a teacher.', 'test-token'))
      .resolves.toBe('I am working toward becoming a teacher.');
    await expect(gateway.suggestMemory('I had tea this morning.', 'test-token'))
      .resolves.toBeNull();

    const request = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(request.max_tokens).toBe(256);
    expect(request.messages[0].content).toContain('exceptionally important');
    expect(request.messages[0].content).toContain('ordinary preferences');
  });

  it('falls back when a model uses its output budget without returning a text reply', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({
        data: [
          { id: 'nvidia/nemotron-3-super-120b-a12b' },
          { id: 'ai21labs/jamba-1.5-large-instruct' },
        ],
      }))
      .mockResolvedValueOnce(response({
        choices: [{ finish_reason: 'length', message: { content: null } }],
      }))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: 'I hear you.' } }] }));
    globalThis.fetch = fetchMock;

    const gateway = new GatewayService('https://gateway.test', auth);
    const result = await gateway.sendChatMessage('I feel overwhelmed.', [
      { role: 'user', content: 'I have a lot on my mind.' },
      { role: 'assistant', content: 'That sounds difficult.' },
    ], 'test-token');

    expect(result).toBe('I hear you.');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).max_tokens).toBe(1024);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body as string).model).toBe('ai21labs/jamba-1.5-large-instruct');
  });

  it('falls back to the next preferred catalog model when NVIDIA returns 404', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({
        data: [
          { id: 'nvidia/nemotron-3-super-120b-a12b' },
          { id: 'nvidia/nemotron-3.5-lightning-30b-a3b' },
        ],
      }))
      .mockResolvedValueOnce(response({ detail: 'Function not found.' }, 404))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: 'I hear you.' } }] }));
    globalThis.fetch = fetchMock;

    const gateway = new GatewayService('https://gateway.test', auth);
    await gateway.sendChatMessage('I feel sad today.', [], 'test-token');

    const firstChatRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const secondChatRequest = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(firstChatRequest.model).toBe('nvidia/nemotron-3-super-120b-a12b');
    expect(secondChatRequest.model).toBe('nvidia/nemotron-3.5-lightning-30b-a3b');
  });

  it('falls back to another chat model after an upstream timeout', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({
        data: [
          { id: 'nvidia/nemotron-3-super-120b-a12b' },
          { id: 'ai21labs/jamba-1.5-large-instruct' },
        ],
      }))
      .mockResolvedValueOnce(response({ error: { message: 'Upstream timed out.' } }, 524))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: 'I am here.' } }] }));
    globalThis.fetch = fetchMock;

    const gateway = new GatewayService('https://gateway.test', auth);
    const result = await gateway.sendChatMessage('I feel overwhelmed.', [], 'test-token');

    expect(result).toBe('I am here.');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).model).toBe('nvidia/nemotron-3-super-120b-a12b');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body as string).model).toBe('ai21labs/jamba-1.5-large-instruct');
  });

  it('refreshes once after a chat request returns 401, then retries with the renewed bearer token', async () => {
    auth.restore.mockImplementation(async () => ({ accessToken: 'expired-token', expiresAt: Date.now() + 60_000 }));
    auth.refresh.mockResolvedValueOnce({ accessToken: 'refreshed-token', expiresAt: Date.now() + 60_000 });
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({ data: [{ id: 'nvidia/nemotron-3.5-lightning-30b-a3b' }] }))
      .mockResolvedValueOnce(response({ error: { message: 'Unauthorized.' } }, 401))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: 'I am here with you.' } }] }));
    globalThis.fetch = fetchMock;

    const gateway = new GatewayService('https://gateway.test', auth);
    const result = await gateway.sendChatMessage('I feel alone.', [], 'expired-token');

    expect(result).toBe('I am here with you.');
    expect(auth.refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][1].headers).toEqual(expect.objectContaining({ Authorization: 'Bearer expired-token' }));
    expect(fetchMock.mock.calls[2][1].headers).toEqual(expect.objectContaining({ Authorization: 'Bearer refreshed-token' }));
  });
});
