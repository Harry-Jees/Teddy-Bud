const ACCESS_TOKEN_SECONDS = 60 * 60;
const RATE_WINDOW_SECONDS = 15 * 60;
const NVIDIA_API = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_CHAT_TIMEOUT_MS = 30_000;
const encoder = new TextEncoder();
let cachedAccessKeys;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, { status: response.status, headers });
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function encodeJson(value) {
  return base64UrlEncode(encoder.encode(JSON.stringify(value)));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(value)));
}

async function hmacKey(secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('JWT_SIGNING_SECRET must be configured with at least 32 characters.');
  }
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signToken(claims, secret) {
  const key = await hmacKey(secret);
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson(claims);
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function verifyToken(token, secret) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify('HMAC', key, base64UrlDecode(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
    if (!valid || typeof claims.sub !== 'string' || typeof claims.exp !== 'number' || typeof claims.iat !== 'number') return null;
    return claims;
  } catch {
    return null;
  }
}

function supabaseConfig(env) {
  const url = typeof env.SUPABASE_URL === 'string' ? env.SUPABASE_URL.replace(/\/+$/, '') : '';
  const anonKey = typeof env.SUPABASE_ANON_KEY === 'string' ? env.SUPABASE_ANON_KEY.trim() : '';
  if (!url.startsWith('https://') || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be configured.');
  }
  return { url, anonKey };
}

async function supabaseRequest(env, path, { accessToken, ...init } = {}) {
  const { url, anonKey } = supabaseConfig(env);
  const headers = new Headers(init.headers);
  headers.set('apikey', anonKey);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${url}/auth/v1/${path}`, { ...init, headers });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('Supabase returned an invalid response.');
  }
  return { response, payload };
}

async function hasSupabaseProfile(env, userId, accessToken) {
  const { url, anonKey } = supabaseConfig(env);
  const endpoint = new URL(`${url}/rest/v1/user_profiles`);
  endpoint.searchParams.set('select', 'user_id');
  endpoint.searchParams.set('user_id', `eq.${userId}`);
  const response = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error('Supabase profile cross-check failed.');
  const profiles = await response.json();
  if (!Array.isArray(profiles)) throw new Error('Supabase returned an invalid profile response.');
  return profiles.some(profile => profile?.user_id === userId);
}

function allowedEmailRedirect(value, env) {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const redirect = new URL(value);
    const allowedOrigins = typeof env.AUTH_REDIRECT_ORIGINS === 'string'
      ? env.AUTH_REDIRECT_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
      : [];
    if (
      redirect.pathname !== '/auth/callback'
      || redirect.search
      || redirect.hash
      || !allowedOrigins.includes(redirect.origin === 'null' ? `${redirect.protocol}//${redirect.host}` : redirect.origin)
      || (redirect.protocol !== 'https:' && redirect.protocol !== 'teddybud:' && redirect.hostname !== 'localhost' && redirect.hostname !== '127.0.0.1')
    ) return null;
    return redirect.toString();
  } catch {
    return null;
  }
}

async function getConfirmedSupabaseUser(env, accessToken) {
  const { response, payload } = await supabaseRequest(env, 'user', { accessToken });
  if (!response.ok || typeof payload?.id !== 'string' || typeof payload.email !== 'string') return null;
  if (!payload.email_confirmed_at) return null;
  return payload;
}

async function hash(value) {
  return base64UrlEncode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > 1_048_576) return { error: json(413, { error: 'Request body is too large.' }) };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: json(400, { error: 'Request body must be valid JSON.' }) };
  }
}

async function rateLimit(request, env, action, limit) {
  const address = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const id = env.SESSIONS.idFromName(`rate:${action}:${await hash(address)}`);
  const response = await env.SESSIONS.get(id).fetch('https://state/rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit, windowSeconds: RATE_WINDOW_SECONDS }),
  });
  if (!response.ok) throw new Error('Rate limit storage request failed.');
  return (await response.json()).allowed === true;
}

function stateStub(env, name) {
  return env.SESSIONS.get(env.SESSIONS.idFromName(name));
}

function tokenClaims(userId, kind, sessionId, now, refreshUntil) {
  return {
    sub: userId,
    kind,
    sid: sessionId,
    iat: now,
    exp: now + ACCESS_TOKEN_SECONDS,
    rfe: refreshUntil,
    iss: 'teddy-bud-gateway',
  };
}

async function issueSession(userId, kind, env) {
  const now = Math.floor(Date.now() / 1000);
  const sessionId = crypto.randomUUID();
  const refreshUntil = now + ACCESS_TOKEN_SECONDS;
  await writeSession(env, sessionId, { userId, kind, refreshUntil });
  return {
    accessToken: await signToken(tokenClaims(userId, kind, sessionId, now, refreshUntil), env.JWT_SIGNING_SECRET),
    expiresIn: ACCESS_TOKEN_SECONDS,
    userId,
  };
}

async function authResponse(userId, kind, env) {
  return json(200, await issueSession(userId, kind, env));
}

async function accessKeys(issuer) {
  if (cachedAccessKeys?.issuer === issuer && cachedAccessKeys.expiresAt > Date.now()) {
    return cachedAccessKeys.keys;
  }
  const response = await fetch(`${issuer}/cdn-cgi/access/certs`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Cloudflare Access signing keys could not be loaded.');
  const payload = await response.json();
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new Error('Cloudflare Access did not return signing keys.');
  }
  cachedAccessKeys = { issuer, keys: payload.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return payload.keys;
}

async function verifyAccessAssertion(token, env) {
  const issuer = typeof env.ACCESS_ISSUER === 'string' ? env.ACCESS_ISSUER.replace(/\/+$/, '') : '';
  const audience = typeof env.ACCESS_AUD === 'string' ? env.ACCESS_AUD.trim() : '';
  if (!issuer.startsWith('https://') || !audience) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header;
  let claims;
  try {
    header = decodeJson(parts[0]);
    claims = decodeJson(parts[1]);
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;

  const keys = await accessKeys(issuer);
  const jwk = keys.find(key => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) return null;
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const validSignature = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlDecode(parts[2]),
    encoder.encode(`${parts[0]}.${parts[1]}`),
  );
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (
    !validSignature
    || claims.iss !== issuer
    || !audiences.includes(audience)
    || typeof claims.sub !== 'string'
    || typeof claims.exp !== 'number'
    || claims.exp <= now
    || typeof claims.iat !== 'number'
    || claims.iat > now + 60
    || (typeof claims.nbf === 'number' && claims.nbf > now)
  ) return null;
  return claims;
}

async function accessLogin(request, env) {
  if (!env.ACCESS_ISSUER || !env.ACCESS_AUD || !env.AUTH_REDIRECT_ORIGINS) {
    return json(503, { error: 'Cloudflare Access sign-in is not configured for this gateway.' });
  }
  if (!await rateLimit(request, env, 'access-login', 20)) {
    return json(429, { error: 'Too many sign-in attempts. Try again later.' });
  }
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get('redirect_uri') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const allowedOrigins = typeof env.AUTH_REDIRECT_ORIGINS === 'string'
    ? env.AUTH_REDIRECT_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
    : [];
  let callback;
  try {
    callback = new URL(redirectUri);
  } catch {
    return json(400, { error: 'The sign-in callback is invalid.' });
  }
  if (
    !allowedOrigins.includes(callback.origin)
    || callback.pathname !== '/auth/callback'
    || callback.search
    || callback.hash
    || !/^[A-Za-z0-9_-]{22,128}$/.test(state)
  ) return json(400, { error: 'The sign-in callback could not be verified.' });

  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!assertion) return json(401, { error: 'Complete Cloudflare Access email verification to continue.' });
  const identity = await verifyAccessAssertion(assertion, env);
  if (!identity) return json(401, { error: 'Cloudflare Access identity is invalid or expired.' });

  const session = await issueSession(identity.sub, 'user', env);
  const callbackState = new URL(redirectUri);
  const fragment = new URLSearchParams({
    access_token: session.accessToken,
    expires_in: String(session.expiresIn),
    state,
  });
  callbackState.hash = fragment.toString();
  return new Response(null, {
    status: 302,
    headers: {
      Location: callbackState.toString(),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

/*
async function sendSignupCode(request, env) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const { email: rawEmail, userId: rawUserId, password } = parsed.value ?? {};
  if (
    typeof rawEmail !== 'string'
    || !/^\S+@\S+\.\S+$/.test(rawEmail.trim())
    || rawEmail.trim().length > 320
    || typeof rawUserId !== 'string'
    || !/^[A-Za-z0-9._-]{3,32}$/.test(rawUserId)
    || typeof password !== 'string'
    || password.length < 12
    || password.length > 128
  ) {
    return json(400, { error: 'Enter a valid email, a user ID of 3–32 letters, numbers, dots, underscores, or hyphens, and a password of 12–128 characters.' });
  }
  if (!env.RESEND_API_KEY) return json(503, { error: 'Email provider is not configured.' });
  if (!await rateLimit(request, env, 'send-signup-code', 10)) return json(429, { error: 'Too many sign-in attempts. Try again later.' });

  const email = rawEmail.trim().toLowerCase();
  const userId = rawUserId.toLowerCase();
  const [existingUserId, existingEmail] = await Promise.all([
    readAccount(env, userId),
    readAccountByEmail(env, email),
  ]);
  if (existingUserId) return json(409, { error: 'That user ID is already in use.' });
  if (existingEmail) return json(409, { error: 'That email address is already registered.' });

  const code = createOtp();
  const otpId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 5 * 60; // 5 minutes
  const refreshUntil = now + expiresIn;
  const codeHash = await hash(`${code}:${otpId}`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(password, salt);
  const attempts = 5;

  try {
    await writeSession(env, otpId, {
      userId,
      kind: 'signup-otp',
      refreshUntil,
      codeHash,
      attempts,
      pendingAccount: { userId, email, salt: base64UrlEncode(salt), passwordHash: base64UrlEncode(passwordHash) },
    });
  } catch {
    return json(500, { error: 'Could not create OTP session.' });
  }

  const from = typeof env.RESEND_FROM === 'string' && env.RESEND_FROM ? env.RESEND_FROM : 'Teddy Bud <onboarding@resend.dev>';
  const body = {
    from,
    to: [email],
    subject: 'Verify your email for Teddy Bud',
    html: `<p>Your email verification code is <strong>${code}</strong>. It expires in ${Math.floor(expiresIn / 60)} minutes.</p>`,
  };

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    // cleanup stored OTP to avoid orphaned sessions
    try { await deleteSession(env, otpId); } catch {}
    return json(502, { error: 'Failed to send email.' });
  }

  return json(200, { otpId, expiresIn });
}

async function verifySignupCode(request, env) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const { otpId, code } = parsed.value ?? {};
  if (typeof otpId !== 'string' || typeof code !== 'string') return json(400, { error: 'Invalid verification request.' });
  const session = await readSession(env, otpId);
  const now = Math.floor(Date.now() / 1000);
  if (!session) return json(400, { error: 'This sign-in session does not exist or has expired.' });
  if (session.refreshUntil <= now) {
    try { await deleteSession(env, otpId); } catch {}
    return json(401, { error: 'The code has expired. Please request a new one.' });
  }
  if (typeof session.attempts !== 'number' || session.attempts <= 0) {
    try { await deleteSession(env, otpId); } catch {}
    return json(401, { error: 'Too many invalid attempts.' });
  }
  const expectedHash = session.codeHash;
  const providedHash = await hash(`${code}:${otpId}`);
  if (expectedHash === providedHash && session.kind === 'signup-otp' && session.pendingAccount) {
    const account = {
      ...session.pendingAccount,
      createdAt: now,
      emailVerified: true,
    };
    const created = await createAccount(env, account);
    try { await deleteSession(env, otpId); } catch {}
    if (!created) return json(409, { error: 'That user ID or email is already registered.' });
    return authResponse(account.userId, 'user', env);
  }
  // decrement attempts
  session.attempts = (session.attempts || 1) - 1;
  try { await writeSession(env, otpId, session); } catch {}
  return json(401, { error: 'Invalid code.' , attemptsLeft: session.attempts});
}

async function loginWithPassword(request, env) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const { userId: rawUserId, password } = parsed.value ?? {};
  if (
    typeof rawUserId !== 'string'
    || !/^[A-Za-z0-9._-]{3,32}$/.test(rawUserId)
    || typeof password !== 'string'
    || password.length > 128
  ) return json(400, { error: 'Enter a valid user ID and password.' });
  const userId = rawUserId.toLowerCase();
  if (!await rateLimit(request, env, `password-login:${await hash(userId)}`, 10)) {
    return json(429, { error: 'Too many sign-in attempts. Try again later.' });
  }
  const account = await readAccount(env, userId);
  const salt = account ? base64UrlDecode(account.salt) : new Uint8Array(16);
  const expectedHash = account ? base64UrlDecode(account.passwordHash) : new Uint8Array(32);
  const actualHash = await hashPassword(password, salt);
  if (!account || !secureEqual(actualHash, expectedHash)) {
    return json(401, { error: 'The user ID or password is incorrect.' });
  }
  return authResponse(account.userId, 'user', env);
}
*/

async function signupWithSupabase(request, env) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const { fullName: rawFullName, email, password } = parsed.value ?? {};
  const fullName = typeof rawFullName === 'string' ? rawFullName.trim() : '';
  if (
    fullName.length < 1
    || fullName.length > 100
    || typeof email !== 'string'
    || !/^\S+@\S+\.\S+$/.test(email.trim())
    || email.trim().length > 320
    || typeof password !== 'string'
    || password.length < 8
    || password.length > 128
  ) return json(400, { error: 'Enter your name, a valid email address, and a password of 8–128 characters.' });
  if (!await rateLimit(request, env, 'signup', 10)) return json(429, { error: 'Too many sign-up attempts. Try again later.' });

  const { response, payload } = await supabaseRequest(env, 'signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      data: { full_name: fullName },
    }),
  });
  if (!response.ok) {
    const message = typeof payload?.msg === 'string' ? payload.msg : payload?.message;
    if (typeof message === 'string' && /already registered|already exists/i.test(message)) {
      return json(409, { error: 'An account with this email may already exist.' });
    }
    return json(response.status >= 400 && response.status < 500 ? response.status : 502, {
      error: typeof message === 'string' ? message : 'Could not create your account.',
    });
  }
  if (payload?.session || payload?.user?.email_confirmed_at) {
    return json(503, { error: 'Email confirmation must be enabled in the Supabase project settings.' });
  }
  if (typeof payload?.user?.id !== 'string') {
    return json(502, { error: 'Supabase did not return a valid account after sign-up.' });
  }
  return json(200, { verificationRequired: true, message: 'Check your email for a verification code.' });
}

async function verifySignupOtp(request, env) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const { email, token } = parsed.value ?? {};
  if (
    typeof email !== 'string'
    || !/^\S+@\S+\.\S+$/.test(email.trim())
    || email.trim().length > 320
    || typeof token !== 'string'
    || !/^\d{6,10}$/.test(token.trim())
  ) return json(400, { error: 'Enter a valid email address and the verification code from your email.' });
  if (!await rateLimit(request, env, 'signup-otp-verify', 10)) {
    return json(429, { error: 'Too many verification attempts. Request a new code and try again.' });
  }

  const { response, payload } = await supabaseRequest(env, 'verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'signup', email: email.trim().toLowerCase(), token: token.trim() }),
  });
  if (!response.ok || typeof payload?.access_token !== 'string' || typeof payload?.user?.id !== 'string') {
    return json(401, { error: 'That verification code is invalid or expired. Check the code or request another.' });
  }
  if (!payload.user.email_confirmed_at) {
    return json(401, { error: 'Supabase did not confirm this email. Check the email template configuration.' });
  }
  if (!await hasSupabaseProfile(env, payload.user.id, payload.access_token)) {
    return json(403, { error: 'This account is not registered in the Teddy Bud profile table.' });
  }
  return authResponse(payload.user.id, 'user', env);
}

async function resendSignupOtp(request, env) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const { email } = parsed.value ?? {};
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim()) || email.trim().length > 320) {
    return json(400, { error: 'Enter a valid email address to request a new verification code.' });
  }
  if (!await rateLimit(request, env, 'signup-otp-resend', 3)) {
    return json(429, { error: 'Too many code requests. Please wait before requesting another.' });
  }
  const { response, payload } = await supabaseRequest(env, 'resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'signup', email: email.trim().toLowerCase() }),
  });
  if (!response.ok) {
    const message = typeof payload?.msg === 'string' ? payload.msg : payload?.message;
    return json(response.status >= 400 && response.status < 500 ? response.status : 502, {
      error: typeof message === 'string' ? message : 'Could not resend your verification code.',
    });
  }
  return json(200, { verificationRequired: true, message: 'A new verification code was sent.' });
}

async function verifySupabaseEmail(request, env) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const { accessToken } = parsed.value ?? {};
  if (typeof accessToken !== 'string' || accessToken.length > 8192) {
    return json(400, { error: 'The email confirmation link is invalid or incomplete.' });
  }
  const user = await getConfirmedSupabaseUser(env, accessToken);
  if (!user) return json(401, { error: 'Email confirmation could not be verified. Please try signing in after confirming your email.' });
  if (!await hasSupabaseProfile(env, user.id, accessToken)) {
    return json(403, { error: 'This account is not registered in the Teddy Bud profile table.' });
  }
  return authResponse(user.id, 'user', env);
}

function allowedOAuthRedirect(value, env) {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const callback = new URL(value);
    if (callback.search || callback.hash || callback.username || callback.password) return null;
    if (
      callback.protocol === 'teddybud:'
      && callback.host === 'auth'
      && callback.pathname === '/callback'
    ) return callback;
    if (callback.pathname !== '/auth/callback' || (callback.protocol !== 'https:' && callback.protocol !== 'http:')) return null;

    const allowedOrigins = typeof env.AUTH_REDIRECT_ORIGINS === 'string'
      ? env.AUTH_REDIRECT_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
      : [];
    const isLocalhost = callback.protocol === 'http:'
      && (callback.hostname === 'localhost' || callback.hostname === '127.0.0.1');
    if (!isLocalhost && !allowedOrigins.includes(callback.origin)) return null;
    return callback;
  } catch {
    return null;
  }
}

async function startGoogleOAuth(request, env) {
  const callback = allowedOAuthRedirect(new URL(request.url).searchParams.get('redirect_uri'), env);
  if (!callback) return json(400, { error: 'The Google sign-in callback is not allowed.' });
  if (!await rateLimit(request, env, 'google-oauth-start', 20)) {
    return json(429, { error: 'Too many sign-in attempts. Try again later.' });
  }

  const state = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64UrlEncode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
  const now = Math.floor(Date.now() / 1000);
  const pending = {
    userId: 'oauth-pending',
    kind: 'oauth-pending',
    refreshUntil: now + 10 * 60,
    codeVerifier: verifier,
  };
  await writeSession(env, `oauth:${state}`, pending);

  callback.searchParams.set('oauth_state', state);
  const { url } = supabaseConfig(env);
  const authorize = new URL(`${url}/auth/v1/authorize`);
  authorize.searchParams.set('provider', 'google');
  authorize.searchParams.set('redirect_to', callback.toString());
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 's256');
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

async function completeGoogleOAuth(request, env) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const { code, state } = parsed.value ?? {};
  if (
    typeof code !== 'string'
    || code.length < 1
    || code.length > 2048
    || typeof state !== 'string'
    || !/^[A-Za-z0-9_-]{43}$/.test(state)
  ) return json(400, { error: 'The Google sign-in response is invalid or incomplete.' });
  if (!await rateLimit(request, env, 'google-oauth-complete', 20)) {
    return json(429, { error: 'Too many sign-in attempts. Try again later.' });
  }

  const pending = await consumeSession(env, `oauth:${state}`);
  if (
    !pending
    || pending.kind !== 'oauth-pending'
    || typeof pending.codeVerifier !== 'string'
    || pending.refreshUntil <= Math.floor(Date.now() / 1000)
  ) return json(401, { error: 'The Google sign-in request expired. Please try again.' });

  const { response, payload } = await supabaseRequest(env, 'token?grant_type=pkce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_code: code, code_verifier: pending.codeVerifier }),
  });
  if (
    !response.ok
    || typeof payload?.access_token !== 'string'
    || typeof payload?.user?.id !== 'string'
    || !payload.user.email_confirmed_at
  ) return json(401, { error: 'Google sign-in could not be verified by Supabase. Please try again.' });
  if (!await hasSupabaseProfile(env, payload.user.id, payload.access_token)) {
    return json(403, { error: 'This account is not registered in the Teddy Bud profile table.' });
  }
  return authResponse(payload.user.id, 'user', env);
}

async function loginWithSupabase(request, env) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const { email, password } = parsed.value ?? {};
  if (
    typeof email !== 'string'
    || !/^\S+@\S+\.\S+$/.test(email.trim())
    || email.trim().length > 320
    || typeof password !== 'string'
    || password.length < 1
    || password.length > 128
  ) return json(400, { error: 'Enter a valid email address and password.' });
  if (!await rateLimit(request, env, 'password-login', 10)) {
    return json(429, { error: 'Too many sign-in attempts. Try again later.' });
  }

  const { response, payload } = await supabaseRequest(env, 'token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  if (!response.ok || typeof payload?.access_token !== 'string' || typeof payload?.user?.id !== 'string') {
    const message = typeof payload?.msg === 'string' ? payload.msg : payload?.message;
    if (typeof message === 'string' && /email not confirmed/i.test(message)) {
      return json(401, { error: 'Please confirm your email before signing in.' });
    }
    return json(401, { error: 'The email or password is incorrect.' });
  }
  if (!payload.user.email_confirmed_at) return json(401, { error: 'Please confirm your email before signing in.' });
  if (!await hasSupabaseProfile(env, payload.user.id, payload.access_token)) {
    return json(403, { error: 'This account is not registered in the Teddy Bud profile table.' });
  }
  return authResponse(payload.user.id, 'user', env);
}

async function refresh(request, env) {
  const claims = await bearerClaims(request, env, true);
  const now = Math.floor(Date.now() / 1000);
  if (!claims || claims.rfe <= now) {
    return json(401, { error: 'Token is invalid or refresh window has expired. Please log in again.' });
  }
  const refreshUntil = now + ACCESS_TOKEN_SECONDS;
  await writeSession(env, claims.sid, { userId: claims.sub, kind: claims.kind, refreshUntil });
  const refreshed = tokenClaims(claims.sub, claims.kind, claims.sid, now, refreshUntil);
  return json(200, {
    accessToken: await signToken(refreshed, env.JWT_SIGNING_SECRET),
    expiresIn: ACCESS_TOKEN_SECONDS,
  });
}

function sessionKey(sessionId) {
  return sessionId;
}

function sessionStub(env, sessionId) {
  return stateStub(env, sessionKey(sessionId));
}

async function readSession(env, sessionId) {
  const response = await sessionStub(env, sessionId).fetch('https://session/session');
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Session storage request failed.');
  return response.json();
}

async function writeSession(env, sessionId, session) {
  const response = await sessionStub(env, sessionId).fetch('https://session/session', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });
  if (!response.ok) throw new Error('Session storage request failed.');
}

async function consumeSession(env, sessionId) {
  const response = await sessionStub(env, sessionId).fetch('https://session/session/consume', { method: 'POST' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Session storage request failed.');
  return response.json();
}

async function deleteSession(env, sessionId) {
  const response = await sessionStub(env, sessionId).fetch('https://session/session', { method: 'DELETE' });
  if (!response.ok) throw new Error('Session storage request failed.');
}

async function bearerClaims(request, env, permitExpired = false) {
  const authorization = request.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) return null;
  const claims = await verifyToken(match[1], env.JWT_SIGNING_SECRET);
  const now = Math.floor(Date.now() / 1000);
  if (
    !claims
    || claims.iss !== 'teddy-bud-gateway'
    || typeof claims.sid !== 'string'
    || typeof claims.rfe !== 'number'
    || claims.rfe <= now
  ) return null;
  if (!permitExpired && claims.exp <= now) return null;
  const session = await readSession(env, claims.sid);
  if (!session) return null;
  if (session.userId !== claims.sub || session.kind !== claims.kind || session.refreshUntil !== claims.rfe) return null;
  return claims;
}

async function logout(request, env) {
  const claims = await bearerClaims(request, env, true);
  if (!claims) return json(401, { error: 'Your session is invalid. Please log in again.' });
  await deleteSession(env, claims.sid);
  return json(200, { success: true });
}

function decodeBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function register(request, env) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const { deviceId, publicKey } = parsed.value ?? {};
  if (typeof deviceId !== 'string' || deviceId.length > 100 || typeof publicKey !== 'string') {
    return json(400, { error: 'Invalid device registration.' });
  }
  let bytes;
  try {
    bytes = decodeBase64(publicKey);
    if (bytes.length !== 32) throw new Error('Invalid Ed25519 key length.');
  } catch {
    return json(400, { error: 'Invalid device registration.' });
  }
  const key = `device:${deviceId}`;
  const existing = await env.DEVICE_KEYS.get(key);
  if (existing && existing !== publicKey) return json(409, { error: 'Device is already registered.' });
  await env.DEVICE_KEYS.put(key, publicKey);
  return authResponse(deviceId, 'device', env);
}

async function verifyDevice(request, env) {
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  const { deviceId, timestamp, signature } = parsed.value ?? {};
  if (typeof deviceId !== 'string' || !Number.isInteger(timestamp) || typeof signature !== 'string') {
    return json(400, { error: 'Invalid device verification request.' });
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) return json(401, { error: 'Device verification timestamp is invalid.' });
  const publicKey = await env.DEVICE_KEYS.get(`device:${deviceId}`);
  if (!publicKey) return json(401, { error: 'This device is not registered.' });
  try {
    const key = await crypto.subtle.importKey('raw', decodeBase64(publicKey), { name: 'Ed25519' }, false, ['verify']);
    const valid = await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      decodeBase64(signature),
      encoder.encode(`${deviceId}:${timestamp}`),
    );
    if (!valid) return json(401, { error: 'Device verification failed.' });
  } catch {
    return json(401, { error: 'Device verification failed.' });
  }
  return authResponse(deviceId, 'device', env);
}

function apiKey(env) {
  for (let index = 1; index <= 10; index += 1) {
    const key = env[`NVIDIA_KEY_${index}`];
    if (typeof key === 'string' && key.length > 0) return key;
  }
  return null;
}

async function upstreamModels(env) {
  const key = apiKey(env);
  if (!key) return json(503, { error: { message: 'The AI provider is not configured.' } });
  const response = await fetch(`${NVIDIA_API}/models`, { headers: { Authorization: `Bearer ${key}` } });
  return response;
}

async function models(request, env) {
  const claims = await bearerClaims(request, env);
  if (!claims) return json(401, { error: { message: 'Unauthorized.' } });
  const response = await upstreamModels(env);
  return new Response(response.body, { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' } });
}

async function completions(request, env) {
  const claims = await bearerClaims(request, env);
  if (!claims) return json(401, { error: { message: 'Unauthorized.' } });
  const key = apiKey(env);
  if (!key) return json(503, { error: { message: 'The AI provider is not configured.' } });
  const parsed = await readJson(request);
  if (parsed.error) return parsed.error;
  if (!parsed.value || typeof parsed.value.model !== 'string' || !Array.isArray(parsed.value.messages)) {
    return json(400, { error: { message: 'A model and messages array are required.' } });
  }
  let response;
  try {
    response = await fetch(`${NVIDIA_API}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.value),
      signal: AbortSignal.timeout(NVIDIA_CHAT_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return json(504, { error: { message: 'The AI provider timed out. Please retry or use another model.' } });
    }
    throw error;
  }
  if (!response.ok) {
    const responseText = await response.text();
    let payload;
    try { payload = responseText ? JSON.parse(responseText) : null; } catch { payload = null; }
    const upstreamMessage = payload?.error?.message
      ?? payload?.error
      ?? payload?.detail
      ?? payload?.message
      ?? responseText.slice(0, 500);
    const message = typeof upstreamMessage === 'string' && upstreamMessage.trim()
      ? upstreamMessage
      : `The NVIDIA AI service rejected model "${parsed.value.model}" (HTTP ${response.status}).`;
    return json(response.status, { error: { message: String(message) } });
  }
  const headers = new Headers();
  const contentType = response.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  return new Response(response.body, { status: response.status, headers });
}

async function health(env) {
  try {
    const response = await upstreamModels(env);
    if (!response.ok) return json(503, { status: 'degraded', models_available: 0 });
    const payload = await response.json();
    return json(200, { status: 'ok', models_available: Array.isArray(payload.data) ? payload.data.length : 0 });
  } catch {
    return json(503, { status: 'degraded', models_available: 0 });
  }
}

async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (url.pathname === '/health' && request.method === 'GET') return health(env);
  if (url.pathname === '/auth/login' && request.method === 'GET') return accessLogin(request, env);
  if (url.pathname === '/auth/signup' && request.method === 'POST') return signupWithSupabase(request, env);
  if (url.pathname === '/auth/google/start' && request.method === 'GET') return startGoogleOAuth(request, env);
  if (url.pathname === '/auth/google/complete' && request.method === 'POST') return completeGoogleOAuth(request, env);
  if (url.pathname === '/auth/verify-signup-otp' && request.method === 'POST') return verifySignupOtp(request, env);
  if (url.pathname === '/auth/resend-signup-otp' && request.method === 'POST') return resendSignupOtp(request, env);
  if (url.pathname === '/auth/verify-email' && request.method === 'POST') return verifySupabaseEmail(request, env);
  if (url.pathname === '/auth/login' && request.method === 'POST') return loginWithSupabase(request, env);
  if (url.pathname === '/auth/refresh' && request.method === 'POST') return refresh(request, env);
  if (url.pathname === '/auth/logout' && request.method === 'POST') return logout(request, env);
  if (url.pathname === '/auth/register' && request.method === 'POST') return register(request, env);
  if (url.pathname === '/auth/verify' && request.method === 'POST') return verifyDevice(request, env);
  if (url.pathname === '/v1/models' && request.method === 'GET') return models(request, env);
  if (url.pathname === '/v1/chat/completions' && request.method === 'POST') return completions(request, env);
  return json(404, { error: { message: 'Unknown endpoint.', type: 'Not Found', code: 404 } });
}

export default {
  async fetch(request, env) {
    try {
      return withCors(await route(request, env));
    } catch (error) {
      console.error('Gateway request failed:', error instanceof Error ? error.message : 'Unknown error');
      return withCors(json(500, { error: { message: 'The gateway could not complete the request.' } }));
    }
  },
};

export class GatewayStateStore {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async fetch(request) {
    const pathname = new URL(request.url).pathname;

    if (pathname === '/account/read' && request.method === 'POST') {
      const { userId } = await request.json();
      if (typeof userId !== 'string') return json(400, { error: 'Invalid account lookup.' });
      const account = await this.ctx.storage.get(`account-user:${userId}`);
      return account ? json(200, account) : new Response(null, { status: 404 });
    }

    if (pathname === '/account/read-email' && request.method === 'POST') {
      const { email } = await request.json();
      if (typeof email !== 'string') return json(400, { error: 'Invalid account lookup.' });
      const userId = await this.ctx.storage.get(`account-email:${email}`);
      if (typeof userId !== 'string') return new Response(null, { status: 404 });
      const account = await this.ctx.storage.get(`account-user:${userId}`);
      return account ? json(200, account) : new Response(null, { status: 404 });
    }

    if (pathname === '/account/create' && request.method === 'POST') {
      const account = await request.json();
      if (
        !account
        || typeof account.userId !== 'string'
        || typeof account.email !== 'string'
        || typeof account.salt !== 'string'
        || typeof account.passwordHash !== 'string'
        || account.emailVerified !== true
        || typeof account.createdAt !== 'number'
      ) return json(400, { error: 'Invalid account.' });
      const created = await this.ctx.storage.transaction(async transaction => {
        const existingUser = await transaction.get(`account-user:${account.userId}`);
        const existingEmail = await transaction.get(`account-email:${account.email}`);
        if (existingUser || existingEmail) return false;
        await transaction.put(`account-user:${account.userId}`, account);
        await transaction.put(`account-email:${account.email}`, account.userId);
        return true;
      });
      return created ? new Response(null, { status: 201 }) : json(409, { error: 'Account already exists.' });
    }

    if (pathname === '/rate' && request.method === 'POST') {
      const { limit, windowSeconds } = await request.json();
      if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) {
        return json(400, { error: 'Invalid rate limit.' });
      }
      const now = Date.now();
      let rate = await this.ctx.storage.get('rate');
      if (!rate || rate.windowEndsAt <= now) rate = { count: 0, windowEndsAt: now + windowSeconds * 1000 };
      if (rate.count >= limit) return json(200, { allowed: false });
      rate.count += 1;
      await this.ctx.storage.put('rate', rate);
      await this.ctx.storage.setAlarm(rate.windowEndsAt);
      return json(200, { allowed: true });
    }

    if (pathname === '/session/consume' && request.method === 'POST') {
      const session = await this.ctx.storage.get('session');
      if (!session) return new Response(null, { status: 404 });
      await this.ctx.storage.delete('session');
      await this.ctx.storage.deleteAlarm();
      return json(200, session);
    }

    if (pathname !== '/session') return json(404, { error: 'Not found.' });

    if (request.method === 'GET') {
      const session = await this.ctx.storage.get('session');
      return session ? json(200, session) : new Response(null, { status: 404 });
    }

    if (request.method === 'PUT') {
      const session = await request.json();
      if (!session || typeof session.userId !== 'string' || typeof session.kind !== 'string' || typeof session.refreshUntil !== 'number') {
        return json(400, { error: 'Invalid session.' });
      }
      await this.ctx.storage.put('session', session);
      await this.ctx.storage.setAlarm(session.refreshUntil * 1000);
      return new Response(null, { status: 204 });
    }

    if (request.method === 'DELETE') {
      await this.ctx.storage.delete('session');
      await this.ctx.storage.deleteAlarm();
      return new Response(null, { status: 204 });
    }

    return new Response(null, { status: 405 });
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
