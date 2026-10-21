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
    await expect(gateway.sendChatMessage('I feel overwhelmed.', [], 'test-token', { assistantName: 'Pankaj', assistantCharacterId: 'sunny' })).resolves.toBe('That sounds like a lot to carry.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://gateway.test/v1/chat/completions');
    expect(fetchMock.mock.calls[0][1].headers).toEqual(expect.objectContaining({ Authorization: 'Bearer test-token' }));
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request.model).toBe('openai/gpt-oss-20b:free');
    expect(request.max_tokens).toBe(4096);
    expect(request.messages[0].content).toContain('You are Pankaj');
    expect(request.messages[0].content).toContain('Do not disclose or guess the underlying model');
    expect(request.messages[0].content).toContain('occasional fitting emoji');
    expect(request.messages[0].content).toContain('Be bright and lightly playful');
  });

  it('preserves the full recent conversation while it fits the context budget', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(response({ choices: [{ message: { content: 'I remember that.' } }] }));
    globalThis.fetch = fetchMock;
    const history = Array.from({ length: 30 }, (_, index) => ({ role: index % 2 === 0 ? 'user' as const : 'assistant' as const, content: `Earlier context ${index}` }));
    await new GatewayService('https://gateway.test', auth).sendChatMessage('And that is still true.', history, 'test-token');
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request.messages).toHaveLength(32);
    expect(request.messages[1].content).toBe('Earlier context 0');
    expect(request.messages[30].content).toBe('Earlier context 29');
  });

  it('drops older history when needed to stay within the context budget', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(response({ choices: [{ message: { content: 'I am following.' } }] }));
    globalThis.fetch = fetchMock;
    const history = Array.from({ length: 200 }, (_, index) => ({ role: index % 2 === 0 ? 'user' as const : 'assistant' as const, content: `Turn ${index} ${'x'.repeat(500)}` }));
    await new GatewayService('https://gateway.test', auth).sendChatMessage('Continue.', history, 'test-token');
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const sentHistory = request.messages.slice(1, -1);
    expect(sentHistory.length).toBeGreaterThan(100);
    expect(sentHistory.length).toBeLessThan(history.length);
    expect(sentHistory[0].content).not.toBe(history[0].content);
    expect(sentHistory[sentHistory.length - 1].content).toBe(history[history.length - 1].content);
  });

  it('includes relevant shared context and crisis guidance when requested', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(response({ choices: [{ message: { content: 'I am here with you.' } }] }));
    globalThis.fetch = fetchMock;
    await new GatewayService('https://gateway.test', auth).sendChatMessage('I want to die.', [], 'test-token', { task: 'conversation', crossChatContext: ['My long-term marathon goal. '.repeat(150)], crisisConcern: true });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const system = request.messages[0].content as string;
    expect(request.messages.at(-1).content).toBe('I want to die.');
    expect(system).toContain('A few locally selected excerpts from other chats are included in this request');
    expect(system).toContain('SAFETY SUPPORT');
    expect(system).toContain('local emergency services');
    expect(system).not.toContain('My long-term marathon goal. '.repeat(70));
  });

  it('uses the model structured tool result for memory suggestions', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({ choices: [{ message: { tool_calls: [{ function: { name: 'emit_memory_suggestion', arguments: '{"fact":"I am working toward becoming a teacher."}' } }] } }] }))
      .mockResolvedValueOnce(response({ choices: [{ message: { tool_calls: [{ function: { name: 'emit_memory_suggestion', arguments: '{"fact":null}' } }] } }] }));
    globalThis.fetch = fetchMock;
    const gateway = new GatewayService('https://gateway.test', auth);
    await expect(gateway.suggestMemory('My long-term goal is to become a teacher.', 'test-token')).resolves.toBe('I am working toward becoming a teacher.');
    await expect(gateway.suggestMemory('I had tea this morning.', 'test-token')).resolves.toBeNull();
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request.model).toBe('openai/gpt-oss-20b:free');
    expect(request.max_tokens).toBe(256);
    expect(request.tool_choice.function.name).toBe('emit_memory_suggestion');
  });

  it('refreshes authentication and retries a chat request after a 401', async () => {
    auth.restore.mockImplementation(async () => ({ accessToken: 'expired-token', expiresAt: Date.now() + 60_000 }));
    auth.refresh.mockResolvedValueOnce({ accessToken: 'refreshed-token', expiresAt: Date.now() + 60_000 });
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({ error: { message: 'Unauthorized.' } }, 401))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: 'I am here with you.' } }] }));
    globalThis.fetch = fetchMock;
    const gateway = new GatewayService('https://gateway.test', auth);
    await expect(gateway.sendChatMessage('I feel alone.', [], 'expired-token')).resolves.toBe('I am here with you.');
    expect(auth.refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers).toEqual(expect.objectContaining({ Authorization: 'Bearer expired-token' }));
    expect(fetchMock.mock.calls[1][1].headers).toEqual(expect.objectContaining({ Authorization: 'Bearer refreshed-token' }));
  });
  it('uses the streaming chat protocol whenever text chunks are requested', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(response({
      choices: [{ message: { content: 'A streamed reply.' } }],
    }));
    globalThis.fetch = fetchMock;
    const chunks: string[] = [];
    await expect(new GatewayService('https://gateway.test', auth).sendChatMessage(
      'Hello', [], 'test-token', { onTextChunk: chunk => chunks.push(chunk) },
    )).resolves.toBe('A streamed reply.');
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request.stream).toBe(true);
    expect(fetchMock.mock.calls[0][1].headers).toEqual(expect.objectContaining({ Accept: 'text/event-stream' }));
    expect(chunks.join('')).toBe('A streamed reply.');
  });

  it('parses a buffered SSE response when native fetch has no readable body stream', async () => {
    const bufferedSse = {
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      body: null,
      text: async () => [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        '',
        'data: {"choices":[{"delta":{"content":" there."}}]}',
        '',
        'data: [DONE]',
        '',
      ].join('\n'),
    };
    const fetchMock = jest.fn().mockResolvedValueOnce(bufferedSse);
    globalThis.fetch = fetchMock;
    const chunks: string[] = [];
    await expect(new GatewayService('https://gateway.test', auth).sendChatMessage(
      'Hello', [], 'test-token', { onTextChunk: chunk => chunks.push(chunk) },
    )).resolves.toBe('Hello there.');
    expect(chunks.join('')).toBe('Hello there.');
  });

  it('falls back to a non-streaming JSON request on Android when the stream ends without a reply', async () => {
    const emptyStream = {
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) },
      text: async () => '',
    };
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(emptyStream)
      .mockResolvedValueOnce(response({ choices: [{ message: { content: 'Android fallback reply.' } }] }));
    globalThis.fetch = fetchMock;
    const chunks: string[] = [];
    const { Platform } = require('react-native');
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    try {
      await expect(new GatewayService('https://gateway.test', auth).sendChatMessage(
        'Hello', [], 'test-token', { onTextChunk: chunk => chunks.push(chunk) },
      )).resolves.toBe('Android fallback reply.');
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).stream).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).stream).toBe(false);
    expect(chunks.join('')).toBe('Android fallback reply.');
  });

});