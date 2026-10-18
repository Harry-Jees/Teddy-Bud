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
    session: { userId, kind: 'google-user', refreshUntil },
  });
  return signedInternalJwt({
    sub: userId,
    kind: 'google-user',
    sid: sessionId,
    iat: now,
    exp: refreshUntil,
    rfe: refreshUntil,
    iss: 'teddy-bud-gateway',
  });
}

test('only Google OAuth authentication endpoints are available', async () => {
  const env = makeEnv();
  const removedEndpoints = [
    ['GET', '/auth/login'],
    ['POST', '/auth/login'],
    ['POST', '/auth/signup'],
    ['POST', '/auth/verify-signup-otp'],
    ['POST', '/auth/resend-signup-otp'],
    ['POST', '/auth/verify-email'],
    ['POST', '/auth/register'],
    ['POST', '/auth/verify'],
  ];
  for (const [method, path] of removedEndpoints) {
    const response = await worker.fetch(request(path, method, method === 'GET' ? undefined : {}), env);
    assert.equal(response.status, 404, method + ' ' + path + ' should not be an authentication route.');
  }
});

test('Google OAuth uses PKCE, validates the Supabase identity, and consumes its state once', async () => {
  const env = makeEnv();
  const callback = 'http://localhost:5173/auth/callback';
  const started = await worker.fetch(request(`/auth/google/start?redirect_uri=${encodeURIComponent(callback)}`), env);
  assert.equal(started.status, 302);

  const authorization = new URL(started.headers.get('Location'));
  assert.equal(authorization.origin, env.SUPABASE_URL);
  assert.equal(authorization.pathname, '/auth/v1/authorize');
  assert.equal(authorization.searchParams.get('provider'), 'google');
  assert.equal(authorization.searchParams.get('code_challenge_method'), 's256');
  const redirectTo = new URL(authorization.searchParams.get('redirect_to'));
  assert.equal(redirectTo.origin, 'http://localhost:5173');
  assert.equal(redirectTo.pathname, '/auth/callback');
  const state = redirectTo.searchParams.get('oauth_state');
  assert.match(state, /^[A-Za-z0-9_-]{43}$/);
  const codeVerifierChallenge = authorization.searchParams.get('code_challenge');
  assert.match(codeVerifierChallenge, /^[A-Za-z0-9_-]{43}$/);

  const oldFetch = globalThis.fetch;
  let tokenExchangeCount = 0;
  globalThis.fetch = async (url, init) => {
    const requestUrl = new URL(String(url));
    const headers = new Headers(init.headers);
    assert.equal(headers.get('apikey'), env.SUPABASE_ANON_KEY);
    if (requestUrl.pathname.endsWith('/auth/v1/token')) {
      tokenExchangeCount += 1;
      assert.equal(requestUrl.searchParams.get('grant_type'), 'pkce');
      const body = JSON.parse(init.body);
      assert.equal(body.auth_code, 'google-one-time-code');
      const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.code_verifier))).toString('base64url');
      assert.equal(challenge, codeVerifierChallenge);
      return new Response(JSON.stringify({
        access_token: 'supabase-google-token',
        user: {
          id: '22222222-2222-4222-8222-222222222222',
          email: 'google-user@example.com',
          email_confirmed_at: '2026-10-17T12:00:00Z',
          app_metadata: { provider: 'google', providers: ['google'] },
        },
      }), { status: 200 });
    }
    if (requestUrl.pathname.endsWith('/rest/v1/user_profiles')) {
      assert.equal(headers.get('Authorization'), 'Bearer supabase-google-token');
      return new Response(JSON.stringify([{ user_id: '22222222-2222-4222-8222-222222222222' }]), { status: 200 });
    }
    throw new Error(`Unexpected Supabase request: ${requestUrl}`);
  };

  try {
    const completed = await jsonResponse(await worker.fetch(request('/auth/google/complete', 'POST', {
      code: 'google-one-time-code',
      state,
    }), env));
    assert.equal(completed.status, 200);
    assert.equal(completed.body.userId, '22222222-2222-4222-8222-222222222222');
    assert.match(completed.body.accessToken, /^[\w-]+\.[\w-]+\.[\w-]+$/);

    const replayed = await jsonResponse(await worker.fetch(request('/auth/google/complete', 'POST', {
      code: 'google-one-time-code',
      state,
    }), env));
    assert.equal(replayed.status, 401);
    assert.equal(tokenExchangeCount, 1);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('Google OAuth rejects unapproved callbacks and incomplete exchange data', async () => {
  const env = makeEnv();
  const nativeStart = await worker.fetch(
    request(`/auth/google/start?redirect_uri=${encodeURIComponent('teddybud://auth/callback')}`),
    env,
  );
  assert.equal(nativeStart.status, 302);

  const unsafeCallback = await jsonResponse(await worker.fetch(
    request(`/auth/google/start?redirect_uri=${encodeURIComponent('https://attacker.example/auth/callback')}`),
    env,
  ));
  assert.equal(unsafeCallback.status, 400);

  const missingState = await jsonResponse(await worker.fetch(request('/auth/google/complete', 'POST', {
    code: 'google-one-time-code',
  }), env));
  assert.equal(missingState.status, 400);
});

test('authenticated chat requests are forwarded to NVIDIA and return its completion', async () => {
  const env = makeEnv();
  env.NVIDIA_KEY_1 = 'test-nvidia-key';
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
      model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
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
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(upstreamRequest.url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    assert.equal(upstreamRequest.init.headers.Authorization, 'Bearer test-nvidia-key');
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
  env.NVIDIA_KEY_1 = 'test-nvidia-key';
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
      model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
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

test('chat requests reject missing auth and avoid exposing NVIDIA account details', async () => {
  const env = makeEnv();
  env.NVIDIA_KEY_1 = 'test-nvidia-key';
  const body = {
    model: 'nvidia/unavailable-model',
    messages: [{ role: 'user', content: 'Hello.' }],
  };
  const unauthorized = await jsonResponse(await worker.fetch(request('/v1/chat/completions', 'POST', body), env));
  assert.equal(unauthorized.status, 401);

  const accessToken = await createSession(env, 'chat-error-test');
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 404,
    title: 'Not Found',
    detail: "Function 'model-function-id': Not found for this account.",
  }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  try {
    const failed = await jsonResponse(await worker.fetch(request(
      '/v1/chat/completions',
      'POST',
      body,
      { Authorization: `Bearer ${accessToken}` },
    ), env));
    assert.equal(failed.status, 404);
    assert.match(failed.body.error.message, /not enabled for this account/i);
    assert.doesNotMatch(failed.body.error.message, /model-function-id|account\s+'[^']+'/i);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('refresh renews the one-hour idle session; logout revokes it immediately', async () => {
  const env = makeEnv();
  const token = await createSession(env, 'google-user-id');
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  const expiredAccessToken = await signedInternalJwt({ ...claims, exp: Math.floor(Date.now() / 1000) - 1 });

  const refreshed = await jsonResponse(await worker.fetch(request('/auth/refresh', 'POST', undefined, { Authorization: 'Bearer ' + expiredAccessToken }), env));
  assert.equal(refreshed.status, 200);
  const refreshedClaims = JSON.parse(Buffer.from(refreshed.body.accessToken.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(refreshedClaims.exp - refreshedClaims.iat, 3600);
  assert.equal(refreshedClaims.rfe - refreshedClaims.iat, 3600);

  const logout = await jsonResponse(await worker.fetch(request('/auth/logout', 'POST', undefined, { Authorization: 'Bearer ' + refreshed.body.accessToken }), env));
  assert.equal(logout.status, 200);
  const protectedModels = await jsonResponse(await worker.fetch(request('/v1/models', 'GET', undefined, { Authorization: 'Bearer ' + refreshed.body.accessToken }), env));
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

test('Google OAuth completion rate limits are enforced and expose CORS', async () => {
  const env = makeEnv();
  const body = { code: 'google-one-time-code', state: 'A'.repeat(43) };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await worker.fetch(request('/auth/google/complete', 'POST', body), env);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  }
  const limited = await jsonResponse(await worker.fetch(request('/auth/google/complete', 'POST', body), env));
  assert.equal(limited.status, 429);

  const preflight = await worker.fetch(request('/auth/google/complete', 'OPTIONS'), env);
  assert.equal(preflight.status, 204);
});
