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
        if (pathname.startsWith('/credits/') && (method === 'POST' || method === 'GET')) {
          const day = new Date().toISOString().slice(0, 10);
          state.credits = state.credits?.day === day ? state.credits : { day, used: 0, backgroundUsed: 0, reservations: {} };
          state.credits.backgroundUsed ??= 0;
          const reset = new Date(`${day}T00:00:00.000Z`);
          reset.setUTCDate(reset.getUTCDate() + 1);
          const resetAt = reset.toISOString();
          if (pathname === '/credits/read' && method === 'GET') {
            this.values.set(id, state);
            return new Response(JSON.stringify({ day, used: state.credits.used, remaining: 40 - state.credits.used, limit: 40, resetAt }), { status: 200 });
          }
          const body = JSON.parse(init.body ?? (input instanceof Request ? await input.text() : '{}'));
          if (pathname === '/credits/reserve') {
            const background = body.background === true;
            if (background && state.credits.backgroundUsed >= Math.min(body.backgroundDailyLimit ?? 10, 10)) {
              return new Response(JSON.stringify({ allowed: false, backgroundLimit: true, used: state.credits.used, remaining: 40 - state.credits.used, resetAt }), { status: 200 });
            }
            if (!background && state.credits.used + body.cost > 40) return new Response(JSON.stringify({ allowed: false, used: state.credits.used, remaining: 40 - state.credits.used, resetAt }), { status: 200 });
            if (background) state.credits.backgroundUsed += 1;
            state.credits.used += body.cost;
            state.credits.reservations[body.reservationId] = { cost: body.cost, background, status: 'reserved' };
            this.values.set(id, state);
            return new Response(JSON.stringify({ allowed: true, used: state.credits.used, remaining: 40 - state.credits.used, resetAt }), { status: 200 });
          }
          const reservation = state.credits.reservations[body.reservationId];
          if (reservation?.status === 'reserved') {
            if (pathname === '/credits/refund') {
              state.credits.used -= reservation.cost;
              if (reservation.background) state.credits.backgroundUsed = Math.max(0, state.credits.backgroundUsed - 1);
            }
            reservation.status = pathname === '/credits/refund' ? 'refunded' : 'committed';
          }
          this.values.set(id, state);
          return new Response(JSON.stringify({ success: true, used: state.credits.used, remaining: 40 - state.credits.used }), { status: 200 });
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
    AI: {
      run: async (model, options) => {
        if (options.stream) return new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode('data: ' + JSON.stringify({ response: 'Test reply.' }) + '\n\n'));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
        return { response: 'Test reply.', usage: { prompt_tokens: 10, completion_tokens: 5 } };
      },
    },
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
test('authenticated text chat uses Cloudflare GLM and charges one unified credit', async () => {
  const env = makeEnv();
  const calls = [];
  env.AI.run = async (model, options) => {
    calls.push({ model, options });
    return { response: 'A calm test reply.', usage: { prompt_tokens: 10, completion_tokens: 5 } };
  };
  const accessToken = await createSession(env, 'text-credit-user');
  const response = await worker.fetch(request('/v1/chat/completions', 'POST', {
    model: '@cf/zai-org/glm-4.7-flash',
    messages: [{ role: 'user', content: 'Hello Teddy.' }],
    stream: false,
  }, { Authorization: `Bearer ${accessToken}` }), env);
  const result = await jsonResponse(response);
  assert.equal(result.status, 200);
  assert.equal(calls[0].model, '@cf/zai-org/glm-4.7-flash');
  assert.equal(result.body.choices[0].message.content, 'A calm test reply.');
  assert.equal(result.body.teddyBudCredits.charged, 1);
  assert.equal(result.body.teddyBudCredits.used, 1);
});

test('streaming chat commits one credit after a successful stream', async () => {
  const env = makeEnv();
  const accessToken = await createSession(env, 'streaming-credit-user');
  const response = await worker.fetch(request('/v1/chat/completions', 'POST', {
    model: '@cf/zai-org/glm-4.7-flash',
    messages: [{ role: 'user', content: 'Hello.' }],
    stream: true,
  }, { Authorization: `Bearer ${accessToken}` }), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/i);
  const body = await response.text();
  assert.match(body, /Test reply\./);
  assert.match(body, /\[DONE\]/);
  const balance = await jsonResponse(await worker.fetch(request('/v1/credits', 'GET', undefined, { Authorization: `Bearer ${accessToken}` }), env));
  assert.equal(balance.body.used, 1);
});

test('streaming inference failure before any text refunds the reserved credit', async () => {
  const env = makeEnv();
  env.AI.run = async () => new ReadableStream({
    start(controller) { controller.error(new Error('simulated stream failure')); },
  });
  const accessToken = await createSession(env, 'streaming-refund-user');
  const response = await worker.fetch(request('/v1/chat/completions', 'POST', {
    model: '@cf/zai-org/glm-4.7-flash',
    messages: [{ role: 'user', content: 'Hello.' }],
    stream: true,
  }, { Authorization: `Bearer ${accessToken}` }), env);
  assert.equal(response.status, 200);
  await assert.rejects(response.text());
  const balance = await jsonResponse(await worker.fetch(request('/v1/credits', 'GET', undefined, { Authorization: `Bearer ${accessToken}` }), env));
  assert.equal(balance.body.used, 0);
});

test('image requests are routed to Cloudflare Qwen and charge one credit', async () => {
  const env = makeEnv();
  let selectedModel;
  env.AI.run = async model => {
    selectedModel = model;
    return { response: 'I can see the image.' };
  };
  const accessToken = await createSession(env, 'image-credit-user');
  const response = await worker.fetch(request('/v1/chat/completions', 'POST', {
    model: '@cf/zai-org/glm-4.7-flash',
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'What is in this picture?' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } },
    ] }],
    stream: false,
  }, { Authorization: `Bearer ${accessToken}` }), env);
  const result = await jsonResponse(response);
  assert.equal(result.status, 200);
  assert.equal(selectedModel, '@cf/qwen/qwen3.8-27b');
  assert.equal(result.body.teddyBudCredits.charged, 1);
  assert.equal(result.body.teddyBudCredits.used, 1);
});

test('background title tasks do not consume chat credits and have their own daily cap', async () => {
  const env = makeEnv();
  env.AI.run = async () => ({ response: 'Short title.' });
  const accessToken = await createSession(env, 'background-task-user');
  let firstResult;
  for (let i = 0; i < 10; i += 1) {
    const response = await worker.fetch(request('/v1/chat/completions', 'POST', {
      model: '@cf/zai-org/glm-4.7-flash',
      metadata: { teddyBudTask: 'title' },
      messages: [{ role: 'user', content: 'Create a title.' }],
      max_tokens: 16,
      stream: false,
    }, { Authorization: `Bearer ${accessToken}` }), env);
    const result = await jsonResponse(response);
    assert.equal(result.status, 200);
    if (i === 0) firstResult = result.body;
  }
  assert.equal(firstResult.teddyBudCredits.charged, 0);
  const balance = await jsonResponse(await worker.fetch(request('/v1/credits', 'GET', undefined, { Authorization: `Bearer ${accessToken}` }), env));
  assert.equal(balance.body.used, 0);

  const blocked = await jsonResponse(await worker.fetch(request('/v1/chat/completions', 'POST', {
    model: '@cf/zai-org/glm-4.7-flash',
    metadata: { teddyBudTask: 'title' },
    messages: [{ role: 'user', content: 'One more title.' }],
    stream: false,
  }, { Authorization: `Bearer ${accessToken}` }), env));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, 'DAILY_BACKGROUND_TASKS_EXHAUSTED');

  const chat = await jsonResponse(await worker.fetch(request('/v1/chat/completions', 'POST', {
    model: '@cf/zai-org/glm-4.7-flash',
    messages: [{ role: 'user', content: 'A normal chat message.' }],
    stream: false,
  }, { Authorization: `Bearer ${accessToken}` }), env));
  assert.equal(chat.status, 200);
  assert.equal(chat.body.teddyBudCredits.charged, 1);
});

test('daily unified credit limit rejects a request that would exceed 40 credits', async () => {
  const env = makeEnv();
  env.AI.run = async () => ({ response: 'Test reply.' });
  const accessToken = await createSession(env, 'daily-credit-user');
  for (let i = 0; i < 40; i += 1) {
    const response = await worker.fetch(request('/v1/chat/completions', 'POST', {
      model: '@cf/qwen/qwen3.8-27b',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Describe this.' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } }] }],
      stream: false,
    }, { Authorization: `Bearer ${accessToken}` }), env);
    assert.equal(response.status, 200);
  }
  const blocked = await jsonResponse(await worker.fetch(request('/v1/chat/completions', 'POST', {
    model: '@cf/zai-org/glm-4.7-flash',
    messages: [{ role: 'user', content: 'One more text request.' }],
    stream: false,
  }, { Authorization: `Bearer ${accessToken}` }), env));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, 'DAILY_CREDITS_EXHAUSTED');
  const balance = await jsonResponse(await worker.fetch(request('/v1/credits', 'GET', undefined, { Authorization: `Bearer ${accessToken}` }), env));
  assert.equal(balance.status, 200);
  assert.equal(balance.body.used, 40);
  assert.equal(balance.body.remaining, 0);
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

test('model catalog advertises only configured Cloudflare Workers AI models', async () => {
  const env = makeEnv();
  const accessToken = await createSession(env, 'model-catalog-test-user');
  const result = await jsonResponse(await worker.fetch(request('/v1/models', 'GET', undefined, {
    Authorization: 'Bearer ' + accessToken,
  }), env));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.map(model => model.id), [
    '@cf/qwen/qwen3.8-27b',
    '@cf/zai-org/glm-4.7-flash',
  ]);
  assert.ok(result.body.data[0].capabilities.includes('vision'));
  assert.ok(!result.body.data[1].capabilities.includes('vision'));
});

test('public health reports Cloudflare Workers AI binding status without inference', async () => {
  const env = makeEnv();
  const ready = await jsonResponse(await worker.fetch(request('/health'), env));
  assert.equal(ready.status, 200);
  assert.deepEqual(ready.body, { status: 'ready', provider_configured: true, provider: 'cloudflare-workers-ai' });
  delete env.AI;
  const degraded = await jsonResponse(await worker.fetch(request('/health'), env));
  assert.equal(degraded.status, 503);
  assert.deepEqual(degraded.body, { status: 'degraded', provider_configured: false, provider: 'cloudflare-workers-ai' });
});

test('chat proxy caps output tokens and rejects oversized text context', async () => {
  const env = makeEnv();
  const accessToken = await createSession(env, 'budget-test-user');
  let forwardedOptions;
  env.AI.run = async (_model, options) => {
    forwardedOptions = options;
    return { response: 'ok' };
  };
  const response = await jsonResponse(await worker.fetch(request('/v1/chat/completions', 'POST', {
    model: '@cf/zai-org/glm-4.7-flash',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 50_000,
  }, { Authorization: 'Bearer ' + accessToken }), env));
  assert.equal(response.status, 200);
  assert.equal(forwardedOptions.max_tokens, 1536);

  const oversized = await jsonResponse(await worker.fetch(request('/v1/chat/completions', 'POST', {
    model: '@cf/zai-org/glm-4.7-flash',
    messages: [{ role: 'user', content: 'x'.repeat(80_001) }],
    max_tokens: 1024,
  }, { Authorization: 'Bearer ' + accessToken }), env));
  assert.equal(oversized.status, 413);
});

test('credit exhaustion remains enforced even when clients request a different model', async () => {
  const env = makeEnv();
  const accessToken = await createSession(env, 'credit-limit-test-user');
  const body = { model: '@cf/zai-org/glm-4.7-flash', messages: [{ role: 'user', content: 'hello' }], max_tokens: 10 };
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await worker.fetch(request('/v1/chat/completions', 'POST', body, {
      Authorization: 'Bearer ' + accessToken,
    }), env);
    assert.equal(response.status, 200);
  }
  const limited = await jsonResponse(await worker.fetch(request('/v1/chat/completions', 'POST', body, {
    Authorization: 'Bearer ' + accessToken,
  }), env));
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, 'DAILY_CREDITS_EXHAUSTED');
});

