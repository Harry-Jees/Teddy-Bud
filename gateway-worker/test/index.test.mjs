import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.mjs';

class MemoryKV {
  values = new Map();

  async get(key) {
    return this.values.get(key) ?? null;
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async delete(key) {
    this.values.delete(key);
  }
}

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
        if (pathname === '/account/read' && method === 'POST') {
          const body = init.body ?? (input instanceof Request ? await input.text() : '');
          const { userId } = JSON.parse(body);
          const account = state.accounts?.get(userId);
          return account
            ? new Response(JSON.stringify(account), { status: 200 })
            : new Response(null, { status: 404 });
        }
        if (pathname === '/account/read-email' && method === 'POST') {
          const body = init.body ?? (input instanceof Request ? await input.text() : '');
          const { email } = JSON.parse(body);
          const userId = state.emails?.get(email);
          const account = userId ? state.accounts?.get(userId) : null;
          return account
            ? new Response(JSON.stringify(account), { status: 200 })
            : new Response(null, { status: 404 });
        }
        if (pathname === '/account/create' && method === 'POST') {
          const body = init.body ?? (input instanceof Request ? await input.text() : '');
          const account = JSON.parse(body);
          state.accounts = state.accounts ?? new Map();
          state.emails = state.emails ?? new Map();
          if (state.accounts.has(account.userId) || state.emails.has(account.email)) {
            this.values.set(id, state);
            return new Response(JSON.stringify({ error: 'Account already exists.' }), { status: 409 });
          }
          state.accounts.set(account.userId, account);
          state.emails.set(account.email, account.userId);
          this.values.set(id, state);
          return new Response(null, { status: 201 });
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
    DEVICE_KEYS: new MemoryKV(),
    SESSIONS: new MemorySessions(),
    JWT_SIGNING_SECRET: signingSecret,
    SUPABASE_URL: 'https://teddy-bud-test.supabase.co',
    SUPABASE_ANON_KEY: 'test-supabase-anon-key',
    ACCESS_ISSUER: 'https://test-team.cloudflareaccess.com',
    ACCESS_AUD: 'test-access-audience',
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

async function signedJwt(claims, privateKey, kid = 'test-key') {
  const header = encodeJson({ alg: 'RS256', typ: 'JWT', kid });
  const payload = encodeJson(claims);
  const input = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(input));
  return `${input}.${Buffer.from(signature).toString('base64url')}`;
}

async function signedInternalJwt(claims) {
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson(claims);
  const input = `${header}.${payload}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return `${input}.${Buffer.from(signature).toString('base64url')}`;
}

function loginRequest(assertion, redirectOrigin = 'http://localhost:5173') {
  const query = new URLSearchParams({
    redirect_uri: `${redirectOrigin}/auth/callback`,
    state: '0123456789abcdef0123456789abcdef0123456789abcdef',
    login_hint: 'person@example.com',
  });
  return request(`/auth/login?${query}`, 'GET', undefined, assertion ? { 'Cf-Access-Jwt-Assertion': assertion } : {});
}

test('Access login validates the signed identity then issues a one-hour server session', async () => {
  const env = makeEnv();
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  jwk.kid = 'test-key';
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(String(url), `${env.ACCESS_ISSUER}/cdn-cgi/access/certs`);
    return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
  };

  try {
    const now = Math.floor(Date.now() / 1000);
    const assertion = await signedJwt({
      iss: env.ACCESS_ISSUER,
      aud: [env.ACCESS_AUD],
      sub: 'access-user-id',
      iat: now,
      exp: now + 3600,
    }, keyPair.privateKey);
    const response = await worker.fetch(loginRequest(assertion), env);
    assert.equal(response.status, 302);

    const location = new URL(response.headers.get('Location'));
    assert.equal(location.origin, 'http://localhost:5173');
    assert.equal(location.pathname, '/auth/callback');
    const fragment = new URLSearchParams(location.hash.slice(1));
    assert.equal(fragment.get('state'), '0123456789abcdef0123456789abcdef0123456789abcdef');

    const token = fragment.get('access_token');
    assert.ok(token);
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    assert.equal(claims.sub, 'access-user-id');
    assert.equal(claims.exp - claims.iat, 3600);
    assert.equal(env.SESSIONS.values.get(claims.sid).session.userId, 'access-user-id');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('Access callback blocks missing identity, wrong audience, and unapproved origins', async () => {
  const env = makeEnv();
  env.ACCESS_ISSUER = 'https://second-test-team.cloudflareaccess.com';
  const missing = await jsonResponse(await worker.fetch(loginRequest(null), env));
  assert.equal(missing.status, 401);

  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  jwk.kid = 'test-key';
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });

  try {
    const now = Math.floor(Date.now() / 1000);
    const wrongAudience = await signedJwt({
      iss: env.ACCESS_ISSUER,
      aud: ['not-the-configured-audience'],
      sub: 'access-user-id',
      iat: now,
      exp: now + 3600,
    }, keyPair.privateKey);
    const denied = await jsonResponse(await worker.fetch(loginRequest(wrongAudience), env));
    assert.equal(denied.status, 401);

    const validAssertion = await signedJwt({
      iss: env.ACCESS_ISSUER,
      aud: env.ACCESS_AUD,
      sub: 'access-user-id',
      iat: now,
      exp: now + 3600,
    }, keyPair.privateKey);
    const unsafeOrigin = await jsonResponse(await worker.fetch(loginRequest(validAssertion, 'https://attacker.example'), env));
    assert.equal(unsafeOrigin.status, 400);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('Access login reports missing deployment configuration', async () => {
  const env = makeEnv();
  delete env.ACCESS_AUD;
  const response = await jsonResponse(await worker.fetch(loginRequest(null), env));
  assert.equal(response.status, 503);
  assert.match(response.body.error, /not configured/);
});

test('Supabase manages email signup OTP verification, resend, and email-password sign-in', async () => {
  const env = makeEnv();
  const requests = [];
  const supabaseUserId = '11111111-1111-4111-8111-111111111111';
  let profileMissing = false;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const requestUrl = new URL(String(url));
    requests.push({ url: requestUrl, init });
    const headers = new Headers(init.headers);
    assert.equal(headers.get('apikey'), env.SUPABASE_ANON_KEY);
    if (requestUrl.pathname.endsWith('/auth/v1/signup')) {
      assert.equal(requestUrl.searchParams.has('redirect_to'), false);
      const body = JSON.parse(init.body);
      assert.equal(body.email, 'person@example.com');
      assert.equal(body.password, 'a-long-test-password');
      assert.deepEqual(body.data, { full_name: 'Person Example' });
      return new Response(JSON.stringify({ user: { id: supabaseUserId, email: body.email } }), { status: 200 });
    }
    if (requestUrl.pathname.endsWith('/auth/v1/verify')) {
      const body = JSON.parse(init.body);
      assert.equal(body.type, 'signup');
      assert.equal(body.email, 'person@example.com');
      if (body.token !== '123456') {
        return new Response(JSON.stringify({ msg: 'Token has expired or is invalid' }), { status: 403 });
      }
      return new Response(JSON.stringify({
        access_token: 'confirmed-email-token',
        user: {
          id: supabaseUserId,
          email: body.email,
          email_confirmed_at: '2026-10-14T10:00:00Z',
        },
      }), { status: 200 });
    }
    if (requestUrl.pathname.endsWith('/auth/v1/resend')) {
      const body = JSON.parse(init.body);
      assert.deepEqual(body, { type: 'signup', email: 'person@example.com' });
      return new Response(JSON.stringify({ message_id: 'test-message' }), { status: 200 });
    }
    if (requestUrl.pathname.endsWith('/rest/v1/user_profiles')) {
      assert.equal(requestUrl.searchParams.get('select'), 'user_id');
      assert.equal(requestUrl.searchParams.get('user_id'), `eq.${supabaseUserId}`);
      assert.equal(headers.get('apikey'), env.SUPABASE_ANON_KEY);
      assert.match(headers.get('Authorization'), /^Bearer (confirmed-email-token|supabase-login-token)$/);
      return new Response(JSON.stringify(profileMissing ? [] : [{ user_id: supabaseUserId }]), { status: 200 });
    }
    if (requestUrl.pathname.endsWith('/auth/v1/user')) {
      const token = headers.get('Authorization');
      assert.ok(token === 'Bearer confirmed-email-token' || token === 'Bearer pending-email-token');
      return new Response(JSON.stringify({
        id: supabaseUserId,
        email: 'person@example.com',
        email_confirmed_at: token.endsWith('confirmed-email-token') ? '2026-10-14T10:00:00Z' : null,
      }), { status: 200 });
    }
    if (requestUrl.pathname.endsWith('/auth/v1/token')) {
      assert.equal(requestUrl.searchParams.get('grant_type'), 'password');
      const body = JSON.parse(init.body);
      if (body.password !== 'a-long-test-password') {
        return new Response(JSON.stringify({ message: 'Invalid login credentials' }), { status: 400 });
      }
      return new Response(JSON.stringify({
        access_token: 'supabase-login-token',
        user: {
          id: supabaseUserId,
          email: body.email,
          email_confirmed_at: '2026-10-14T10:00:00Z',
        },
      }), { status: 200 });
    }
    throw new Error(`Unexpected Supabase request: ${requestUrl}`);
  };

  try {
    const sent = await jsonResponse(await worker.fetch(request('/auth/signup', 'POST', {
      fullName: 'Person Example',
      email: 'Person@example.com',
      password: 'a-long-test-password',
    }), env));
    assert.equal(sent.status, 200);
    assert.equal(sent.body.verificationRequired, true);

    const invalidOtp = await jsonResponse(await worker.fetch(request('/auth/verify-signup-otp', 'POST', {
      email: 'person@example.com',
      token: '000000',
    }), env));
    assert.equal(invalidOtp.status, 401);

    profileMissing = true;
    const unregisteredProfile = await jsonResponse(await worker.fetch(request('/auth/verify-signup-otp', 'POST', {
      email: 'person@example.com',
      token: '123456',
    }), env));
    assert.equal(unregisteredProfile.status, 403);

    profileMissing = false;
    const verified = await jsonResponse(await worker.fetch(request('/auth/verify-signup-otp', 'POST', {
      email: 'Person@example.com',
      token: '123456',
    }), env));
    assert.equal(verified.status, 200);
    assert.equal(verified.body.userId, supabaseUserId);
    assert.equal(verified.body.expiresIn, 3600);
    assert.match(verified.body.accessToken, /^[\w-]+\.[\w-]+\.[\w-]+$/);
    const claims = JSON.parse(Buffer.from(verified.body.accessToken.split('.')[1], 'base64url').toString('utf8'));
    assert.equal(claims.sub, supabaseUserId);

    const resent = await jsonResponse(await worker.fetch(request('/auth/resend-signup-otp', 'POST', {
      email: 'Person@example.com',
    }), env));
    assert.equal(resent.status, 200);
    assert.equal(resent.body.verificationRequired, true);

    const loggedIn = await jsonResponse(await worker.fetch(request('/auth/login', 'POST', {
      email: 'PERSON@example.com',
      password: 'a-long-test-password',
    }), env));
    assert.equal(loggedIn.status, 200);
    assert.equal(loggedIn.body.userId, supabaseUserId);

    const wrongPassword = await jsonResponse(await worker.fetch(request('/auth/login', 'POST', {
      email: 'person@example.com',
      password: 'incorrect-password',
    }), env));
    assert.equal(wrongPassword.status, 401);

    profileMissing = true;
    const missingLoginProfile = await jsonResponse(await worker.fetch(request('/auth/login', 'POST', {
      email: 'person@example.com',
      password: 'a-long-test-password',
    }), env));
    assert.equal(missingLoginProfile.status, 403);

    assert.equal(requests.length, 12);
    assert.equal(env.SESSIONS.values.has('account-directory'), false);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('Google OAuth uses PKCE, validates the Supabase identity, and consumes its state once', async () => {
  const env = makeEnv();
  const callback = 'http://localhost:3040/auth/callback';
  const started = await worker.fetch(request(`/auth/google/start?redirect_uri=${encodeURIComponent(callback)}`), env);
  assert.equal(started.status, 302);

  const authorization = new URL(started.headers.get('Location'));
  assert.equal(authorization.origin, env.SUPABASE_URL);
  assert.equal(authorization.pathname, '/auth/v1/authorize');
  assert.equal(authorization.searchParams.get('provider'), 'google');
  assert.equal(authorization.searchParams.get('code_challenge_method'), 's256');
  const redirectTo = new URL(authorization.searchParams.get('redirect_to'));
  assert.equal(redirectTo.origin, 'http://localhost:3040');
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
    const registered = await jsonResponse(await worker.fetch(request('/auth/register', 'POST', {
      deviceId: 'chat-integration-test',
      publicKey: Buffer.alloc(32, 7).toString('base64'),
    }), env));
    assert.equal(registered.status, 200);

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
      { Authorization: `Bearer ${registered.body.accessToken}` },
    ), env);
    const result = await jsonResponse(response);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(upstreamRequest.url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    assert.equal(upstreamRequest.init.headers.Authorization, 'Bearer test-nvidia-key');
    assert.deepEqual(JSON.parse(upstreamRequest.init.body), chatBody);
    assert.equal(result.body.choices[0].message.content, 'I hear you. What feels most important right now?');
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('chat requests reject missing auth and preserve useful NVIDIA model errors', async () => {
  const env = makeEnv();
  env.NVIDIA_KEY_1 = 'test-nvidia-key';
  const body = {
    model: 'nvidia/unavailable-model',
    messages: [{ role: 'user', content: 'Hello.' }],
  };
  const unauthorized = await jsonResponse(await worker.fetch(request('/v1/chat/completions', 'POST', body), env));
  assert.equal(unauthorized.status, 401);

  const registered = await jsonResponse(await worker.fetch(request('/auth/register', 'POST', {
    deviceId: 'chat-error-test',
    publicKey: Buffer.alloc(32, 8).toString('base64'),
  }), env));
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
      { Authorization: `Bearer ${registered.body.accessToken}` },
    ), env));
    assert.equal(failed.status, 404);
    assert.match(failed.body.error.message, /Not found for this account/);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('refresh renews the one-hour idle session; logout revokes it immediately', async () => {
  const env = makeEnv();
  env.ACCESS_ISSUER = 'https://third-test-team.cloudflareaccess.com';
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  jwk.kid = 'test-key';
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });

  try {
    const now = Math.floor(Date.now() / 1000);
    const assertion = await signedJwt({
      iss: env.ACCESS_ISSUER,
      aud: env.ACCESS_AUD,
      sub: 'access-user-id',
      iat: now,
      exp: now + 3600,
    }, keyPair.privateKey);
    const login = await worker.fetch(loginRequest(assertion), env);
    const callback = new URL(login.headers.get('Location'));
    const token = new URLSearchParams(callback.hash.slice(1)).get('access_token');
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    const expiredAccessToken = await signedInternalJwt({ ...claims, exp: now - 1 });

    const refreshed = await jsonResponse(await worker.fetch(request('/auth/refresh', 'POST', undefined, { Authorization: `Bearer ${expiredAccessToken}` }), env));
    assert.equal(refreshed.status, 200);
    const refreshedClaims = JSON.parse(Buffer.from(refreshed.body.accessToken.split('.')[1], 'base64url').toString('utf8'));
    assert.equal(refreshedClaims.exp - refreshedClaims.iat, 3600);
    assert.equal(refreshedClaims.rfe - refreshedClaims.iat, 3600);

    const logout = await jsonResponse(await worker.fetch(request('/auth/logout', 'POST', undefined, { Authorization: `Bearer ${refreshed.body.accessToken}` }), env));
    assert.equal(logout.status, 200);
    const protectedModels = await jsonResponse(await worker.fetch(request('/v1/models', 'GET', undefined, { Authorization: `Bearer ${refreshed.body.accessToken}` }), env));
    assert.equal(protectedModels.status, 401);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('auth callback rate limits are enforced and responses expose CORS', async () => {
  const env = makeEnv();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await worker.fetch(loginRequest(null), env);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  }
  const limited = await jsonResponse(await worker.fetch(loginRequest(null), env));
  assert.equal(limited.status, 429);

  const preflight = await worker.fetch(request('/auth/login', 'OPTIONS'), env);
  assert.equal(preflight.status, 204);
});
