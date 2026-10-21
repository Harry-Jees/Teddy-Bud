import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.mjs';

class MemorySessions {
  values = new Map();

  idFromName(name) {
    return name;
  }

  get(id) {
    return {
      fetch: async (input, init = {}) => {
        const { pathname } = new URL(input instanceof Request ? input.url : input);
        const method = init.method ?? (input instanceof Request ? input.method : 'GET');
        const state = this.values.get(id) ?? {};
        if (pathname === '/user-sessions/add' && method === 'POST') {
          const body = init.body ?? (input instanceof Request ? await input.text() : '');
          const { sessionId } = JSON.parse(body);
          state.userSessions ??= [];
          if (!state.userSessions.includes(sessionId)) state.userSessions.push(sessionId);
          this.values.set(id, state);
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        if (pathname === '/user-sessions/remove' && method === 'POST') {
          const body = init.body ?? (input instanceof Request ? await input.text() : '');
          const { sessionId } = JSON.parse(body);
          state.userSessions = (state.userSessions ?? []).filter(value => value !== sessionId);
          this.values.set(id, state);
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        if (pathname === '/user-sessions/list' && method === 'GET') {
          return new Response(JSON.stringify({ sessionIds: state.userSessions ?? [] }), { status: 200 });
        }
        if (pathname === '/rate' && method === 'POST') {
          const body = init.body ?? (input instanceof Request ? await input.text() : '');
          const { limit } = JSON.parse(body);
          state.rate = state.rate ?? { count: 0 };
          if (state.rate.count >= limit) return new Response(JSON.stringify({ allowed: false }), { status: 200 });
          state.rate.count += 1;
          this.values.set(id, state);
          return new Response(JSON.stringify({ allowed: true }), { status: 200 });
        }
        if (pathname === '/session/consume' && method === 'POST') {
          if (!state.session) return new Response(null, { status: 404 });
          const session = state.session;
          delete state.session;
          this.values.set(id, state);
          return new Response(JSON.stringify(session), { status: 200 });
        }
        if (pathname !== '/session') return new Response(null, { status: 404 });
        if (method === 'GET') {
          return state.session ? new Response(JSON.stringify(state.session), { status: 200 }) : new Response(null, { status: 404 });
        }
        if (method === 'PUT') {
          const body = init.body ?? (input instanceof Request ? await input.text() : '');
          state.session = JSON.parse(body);
          this.values.set(id, state);
          return new Response(null, { status: 204 });
        }
        if (method === 'DELETE') {
          delete state.session;
          this.values.set(id, state);
          return new Response(null, { status: 204 });
        }
        return new Response(null, { status: 405 });
      },
    };
  }
}

const signingSecret = 'unit-test-signing-secret-with-32-characters';

function makeEnv() {
  return {
    SESSIONS: new MemorySessions(),
    JWT_SIGNING_SECRET: signingSecret,
    SUPABASE_URL: 'https://teddy-bud-test.supabase.co',
    SUPABASE_ANON_KEY: 'test-supabase-anon-key',
    AUTH_REDIRECT_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
  };
}

function request(path, method = 'GET', body, headers = {}) {
  const requestHeaders = new Headers(headers);
  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json');
  return new Request(`https://gateway.test${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function jsonResponse(response) {
  return { status: response.status, body: await response.json() };
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function signedInternalJwt(claims) {
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson(claims);
  const input = `${header}.${payload}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return `${input}.${Buffer.from(signature).toString('base64url')}`;
}

async function createSession(env, userId) {
  const now = Math.floor(Date.now() / 1000);
  const sessionId = `test-session-${crypto.randomUUID()}`;
  const refreshUntil = now + 3600;
  env.SESSIONS.values.set(sessionId, {
    session: { userId, kind: 'password-user', sessionId, refreshUntil },
  });
  return signedInternalJwt({
    sub: userId,
    kind: 'password-user',
    sid: sessionId,
    iat: now,
    exp: refreshUntil,
    rfe: refreshUntil,
    iss: 'teddy-bud-gateway',
  });
}

test('password auth routes replace Google OAuth and validate input', async () => {
  const env = makeEnv();
  const invalid = [
    ['POST', '/auth/signup'],
    ['POST', '/auth/login'],
    ['POST', '/auth/recover'],
  ];
  for (const [method, path] of invalid) {
    const response = await worker.fetch(request(path, method, {}), env);
    assert.equal(response.status, 400, method + ' ' + path + ' should validate required fields.');
  }
  for (const [method, path] of [
    ['GET', '/auth/login'],
    ['GET', '/auth/signup'],
    ['GET', '/auth/recover'],
    ['GET', '/auth/google/start'],
    ['POST', '/auth/google/complete'],
    ['POST', '/auth/verify-email'],
    ['POST', '/auth/resend-signup-confirmation'],
  ]) {
    const response = await worker.fetch(request(path, method, method === 'POST' ? {} : undefined), env);
    assert.equal(response.status, 404, method + ' ' + path + ' should not be available.');
  }
  const unauthenticated = await worker.fetch(request('/auth/session'), env);
  assert.equal(unauthenticated.status, 401);
});

test('signup creates a password account and session without email verification', async () => {
  const env = makeEnv();
  env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  env.RECOVERY_KEY_SECRET = 'test-recovery-secret-with-more-than-32-characters';
  const userId = 'password-user';
  const recoveryRows = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = init.method ?? (input instanceof Request ? input.method : 'GET');
    if (url.pathname === '/auth/v1/signup' && method === 'POST') {
      const body = JSON.parse(init.body);
      assert.equal(body.email, 'person@example.com');
      return new Response(JSON.stringify({ access_token: 'supabase-signup-token', user: { id: userId, email: body.email } }), { status: 200 });
    }
    if (url.pathname === '/rest/v1/account_recovery_verifiers' && method === 'POST') {
      recoveryRows.push(JSON.parse(init.body));
      return new Response(null, { status: 201 });
    }
    if (url.pathname === '/rest/v1/account_recovery_verifiers' && method === 'GET') {
      return new Response(JSON.stringify(recoveryRows), { status: 200 });
    }
    if (url.pathname === '/rest/v1/user_profiles' && method === 'GET') {
      return new Response(JSON.stringify([{ user_id: userId }]), { status: 200 });
    }
    throw new Error(`Unexpected upstream request: ${method} ${url}`);
  };

  try {
    const signup = await jsonResponse(await worker.fetch(request('/auth/signup', 'POST', {
      email: 'Person@example.com',
      password: 'a-secure-password-long-enough',
      recoveryKey: 'six-random-words-kept-safe-2026',
    }), env));
    assert.equal(signup.status, 200);
    assert.equal(typeof signup.body.accessToken, 'string');
    const claims = JSON.parse(Buffer.from(signup.body.accessToken.split('.')[1], 'base64url').toString('utf8'));
    assert.equal(claims.sub, userId);
    assert.deepEqual(Object.keys(recoveryRows[0]).sort(), ['email', 'user_id', 'verifier']);
    assert.equal(recoveryRows[0].verifier.length, 43);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('a valid legacy session migrates to password auth without changing chat owner ID', async () => {
  const env = makeEnv();
  env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  env.RECOVERY_KEY_SECRET = 'test-recovery-secret-with-more-than-32-characters';
  const userId = 'existing-google-user-id';
  const now = Math.floor(Date.now() / 1000);
  const sessionId = 'existing-google-session';
  const refreshUntil = now + 3600;
  env.SESSIONS.values.set(sessionId, {
    session: { userId, kind: 'google-user', sessionId, refreshUntil },
  });
  const legacyToken = await signedInternalJwt({
    sub: userId, kind: 'google-user', sid: sessionId, iat: now,
    exp: now + 60, rfe: refreshUntil, iss: 'teddy-bud-gateway',
  });
  const oldFetch = globalThis.fetch;
  const storedVerifiers = [];
  const adminUpdates = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = init.method ?? (input instanceof Request ? input.method : 'GET');
    if (url.pathname === `/auth/v1/admin/users/${userId}` && method === 'GET') {
      return new Response(JSON.stringify({ id: userId, email: 'legacy@example.com', app_metadata: { provider: 'google', providers: ['google'] } }), { status: 200 });
    }
    if (url.pathname === `/auth/v1/admin/users/${userId}` && method === 'PUT') {
      adminUpdates.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: userId }), { status: 200 });
    }
    if (url.pathname === '/rest/v1/account_recovery_verifiers' && method === 'GET') {
      return new Response(JSON.stringify(storedVerifiers), { status: 200 });
    }
    if (url.pathname === '/rest/v1/account_recovery_verifiers' && method === 'POST') {
      storedVerifiers.push(JSON.parse(init.body));
      return new Response(null, { status: 201 });
    }
    throw new Error(`Unexpected upstream request: ${method} ${url}`);
  };

  try {
    const response = await jsonResponse(await worker.fetch(request('/auth/migrate-legacy', 'POST', {
      password: 'a-secure-password-long-enough',
      recoveryKey: 'a-new-recovery-key-long-enough-to-test',
    }, { Authorization: `Bearer ${legacyToken}` }), env));
    assert.equal(response.status, 200);
    const newClaims = JSON.parse(Buffer.from(response.body.accessToken.split('.')[1], 'base64url').toString('utf8'));
    assert.equal(newClaims.sub, userId);
    assert.equal(newClaims.kind, 'password-user');
    assert.deepEqual(adminUpdates, [{ password: 'a-secure-password-long-enough' }]);
    assert.equal(storedVerifiers[0].user_id, userId);
    assert.equal(env.SESSIONS.values.get(sessionId).session, undefined);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
test('authenticated chat requests are forwarded to OpenRouter and return its completion', async () => {
  const env = makeEnv();
  env.OPENROUTER_API_KEY = 'test-openrouter-key';
  let upstreamRequest;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    upstreamRequest = { url: String(url), init };
    return new Response(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: 'I hear you. What feels most important right now?' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const accessToken = await createSession(env, 'chat-integration-test');

    const chatBody = {
      model: 'openai/gpt-oss-20b:free',
      messages: [
        { role: 'system', content: 'Be empathetic and concise.' },
        { role: 'user', content: 'I feel overwhelmed.' },
      ],
      stream: false,
      max_tokens: 220,
    };
    const response = await worker.fetch(request(
      '/v1/chat/completions',
      'POST',
      chatBody,
      { Authorization: `Bearer ${accessToken}` },
    ), env);
    const result = await jsonResponse(response);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(upstreamRequest.url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(upstreamRequest.init.headers.Authorization, 'Bearer test-openrouter-key');
    assert.ok(upstreamRequest.init.signal instanceof AbortSignal);
    const forwardedBody = JSON.parse(upstreamRequest.init.body);
    assert.equal(forwardedBody.model, chatBody.model);
    assert.equal(forwardedBody.messages[0].role, 'system');
    assert.match(forwardedBody.messages[0].content, /Be empathetic and concise/);
    assert.match(forwardedBody.messages[0].content, /Never reveal, quote, reproduce/);
    assert.deepEqual(forwardedBody.messages.slice(1), chatBody.messages.slice(1));
    assert.equal(result.body.choices[0].message.content, 'I hear you. What feels most important right now?');
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('the gateway adds crisis response guidance when the latest user message signals immediate risk', async () => {
  const env = makeEnv();
  env.OPENROUTER_API_KEY = 'test-openrouter-key';
  let forwardedBody;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    forwardedBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: 'Are you in immediate danger right now?' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const accessToken = await createSession(env, 'chat-crisis-test');
    const chatBody = {
      model: 'openai/gpt-oss-20b:free',
      messages: [
        { role: 'system', content: 'Be empathetic and concise.' },
        { role: 'user', content: 'I am writing an essay about suicide prevention.' },
        { role: 'assistant', content: 'What is the essay about?' },
        { role: 'user', content: [{ type: 'text', text: 'I want to die.' }] },
      ],
    };
    const originalBody = JSON.stringify(chatBody);
    const response = await worker.fetch(request(
      '/v1/chat/completions',
      'POST',
      chatBody,
      { Authorization: 'Bearer ' + accessToken },
    ), env);
    const result = await jsonResponse(response);

    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(originalBody), chatBody);
    assert.match(forwardedBody.messages[0].content, /^Be empathetic and concise\./);
    assert.match(forwardedBody.messages[0].content, /Never reveal, quote, reproduce/);
    assert.match(forwardedBody.messages[1].content, /SAFETY PRIORITY/);
    assert.match(forwardedBody.messages[1].content, /local emergency services/);
    assert.equal(forwardedBody.messages[2].content, 'I am writing an essay about suicide prevention.');
    assert.equal(result.body.choices[0].message.content, 'Are you in immediate danger right now?');

    const followUpBody = {
      model: chatBody.model,
      messages: [
        { role: 'system', content: 'Be empathetic and concise.' },
        { role: 'user', content: 'I want to die.' },
        { role: 'assistant', content: 'Are you in immediate danger?' },
        { role: 'user', content: 'I am not sure what to do.' },
      ],
    };
    await worker.fetch(request(
      '/v1/chat/completions',
      'POST',
      followUpBody,
      { Authorization: 'Bearer ' + accessToken },
    ), env);
    assert.match(forwardedBody.messages[1].content, /SAFETY PRIORITY/);
    assert.equal(forwardedBody.messages[4].content, 'I am not sure what to do.');
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('chat requests reject missing auth and surface OpenRouter model errors safely', async () => {
  const env = makeEnv();
  env.OPENROUTER_API_KEY = 'test-openrouter-key';
  const body = {
    model: 'openai/unavailable-model:free',
    messages: [{ role: 'user', content: 'Hello.' }],
  };
  const unauthorized = await jsonResponse(await worker.fetch(request('/v1/chat/completions', 'POST', body), env));
  assert.equal(unauthorized.status, 401);

  const accessToken = await createSession(env, 'chat-error-test');
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 404,
    title: 'Not Found',
    error: { message: 'No endpoints found for this model.' },
  }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  try {
    const failed = await jsonResponse(await worker.fetch(request(
      '/v1/chat/completions',
      'POST',
      body,
      { Authorization: `Bearer ${accessToken}` },
    ), env));
    assert.equal(failed.status, 404);
    assert.equal(failed.body.error.message, 'No endpoints found for this model.');
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('sessions expire after one hour and logout revokes them immediately', async () => {
  const env = makeEnv();
  const token = await createSession(env, 'google-user-id');
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  const expiredAccessToken = await signedInternalJwt({ ...claims, exp: Math.floor(Date.now() / 1000) - 1 });

  const expired = await jsonResponse(await worker.fetch(request('/auth/refresh', 'POST', undefined, { Authorization: 'Bearer ' + expiredAccessToken }), env));
  assert.equal(expired.status, 401);
  assert.match(expired.body.error, /one hour/i);

  const activeToken = await createSession(env, 'password-user-id');
  const logout = await jsonResponse(await worker.fetch(request('/auth/logout', 'POST', undefined, { Authorization: 'Bearer ' + activeToken }), env));
  assert.equal(logout.status, 200);
  const protectedModels = await jsonResponse(await worker.fetch(request('/v1/models', 'GET', undefined, { Authorization: 'Bearer ' + activeToken }), env));
  assert.equal(protectedModels.status, 401);
});

test('refresh does not continue sessions issued by retired non-Google auth methods', async () => {
  const env = makeEnv();
  const now = Math.floor(Date.now() / 1000);
  const sessionId = 'legacy-session';
  const refreshUntil = now + 3600;
  env.SESSIONS.values.set(sessionId, {
    session: { userId: 'legacy-user', kind: 'user', refreshUntil },
  });
  const token = await signedInternalJwt({
    sub: 'legacy-user',
    kind: 'user',
    sid: sessionId,
    iat: now,
    exp: now + 60,
    rfe: refreshUntil,
    iss: 'teddy-bud-gateway',
  });

  const response = await jsonResponse(await worker.fetch(
    request('/auth/refresh', 'POST', undefined, { Authorization: 'Bearer ' + token }),
    env,
  ));
  assert.equal(response.status, 401);
});

test('signup attempts are rate-limited and CORS is restricted to app origins', async () => {
  const env = makeEnv();
  const body = {};
  const approvedOrigin = { Origin: 'http://localhost:5173' };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await worker.fetch(request('/auth/signup', 'POST', body, approvedOrigin), env);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), approvedOrigin.Origin);
  }
  const limited = await jsonResponse(await worker.fetch(request('/auth/signup', 'POST', body, approvedOrigin), env));
  assert.equal(limited.status, 429);

  const preflight = await worker.fetch(request('/auth/signup', 'OPTIONS', undefined, approvedOrigin), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), approvedOrigin.Origin);
  const blockedOrigin = await worker.fetch(request('/auth/signup', 'OPTIONS', undefined, { Origin: 'https://attacker.example' }), env);
  assert.equal(blockedOrigin.headers.get('Access-Control-Allow-Origin'), null);
});

test('public health is cheap and never calls the upstream provider', async () => {
  const env = makeEnv();
  env.OPENROUTER_API_KEY = 'test-openrouter-key';
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('health must not call upstream'); };
  try {
    const ready = await jsonResponse(await worker.fetch(request('/health'), env));
    assert.equal(ready.status, 200);
    assert.deepEqual(ready.body, { status: 'ready', provider_configured: true });
    delete env.OPENROUTER_API_KEY;
    const degraded = await jsonResponse(await worker.fetch(request('/health'), env));
    assert.equal(degraded.status, 503);
    assert.deepEqual(degraded.body, { status: 'degraded', provider_configured: false });
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('chat proxy caps output tokens and rejects oversized text context', async () => {
  const env = makeEnv();
  env.OPENROUTER_API_KEY = 'test-openrouter-key';
  const accessToken = await createSession(env, 'budget-test-user');
  const oldFetch = globalThis.fetch;
  let forwardedBody;
  globalThis.fetch = async (_input, init) => {
    forwardedBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const response = await jsonResponse(await worker.fetch(request('/v1/chat/completions', 'POST', {
      model: 'openai/gpt-oss-20b:free',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 50_000,
    }, { Authorization: 'Bearer ' + accessToken }), env));
    assert.equal(response.status, 200);
    assert.equal(forwardedBody.max_tokens, 2048);

    const oversized = await jsonResponse(await worker.fetch(request('/v1/chat/completions', 'POST', {
      model: 'openai/gpt-oss-20b:free',
      messages: [{ role: 'user', content: 'x'.repeat(80_001) }],
      max_tokens: 1024,
    }, { Authorization: 'Bearer ' + accessToken }), env));
    assert.equal(oversized.status, 413);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('chat requests are rate-limited per authenticated account', async () => {
  const env = makeEnv();
  env.OPENROUTER_API_KEY = 'test-openrouter-key';
  const accessToken = await createSession(env, 'rate-limit-test-user');
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  try {
    const body = { model: 'openai/gpt-oss-20b:free', messages: [{ role: 'user', content: 'hello' }], max_tokens: 10 };
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await worker.fetch(request('/v1/chat/completions', 'POST', body, {
        Authorization: 'Bearer ' + accessToken,
      }), env);
      assert.equal(response.status, 200);
    }
    const limited = await jsonResponse(await worker.fetch(request('/v1/chat/completions', 'POST', body, {
      Authorization: 'Bearer ' + accessToken,
    }), env));
    assert.equal(limited.status, 429);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
