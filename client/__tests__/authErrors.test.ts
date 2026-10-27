import {
  AuthServiceError,
  AuthValidationError,
  authContextForPath,
  authErrorMessage,
  authServiceErrorFromResponse,
} from '../src/services/authErrors';

describe('safe authentication error messages', () => {
  test('keeps sign-in credentials generic', () => {
    const error = authServiceErrorFromResponse(401, 'sign-in');
    expect(error.message).toMatch(/email or password is incorrect/i);
    expect(error.message).not.toMatch(/email does not exist|user not found/i);
    expect(error.kind).toBe('invalid-credentials');
  });

  test('does not disclose whether an account exists during account creation', () => {
    const error = authServiceErrorFromResponse(409, 'create-account');
    expect(error.message).toMatch(/could not create an account/i);
    expect(error.message).not.toMatch(/already exists/i);
  });

  test('uses a common recovery message for invalid recovery credentials', () => {
    const error = authServiceErrorFromResponse(401, 'password-recovery');
    expect(error.message).toMatch(/could not be verified/i);
    expect(error.message).not.toMatch(/email not found|account does not exist/i);
  });

  test('maps rate limits and server errors to actionable messages', () => {
    expect(authServiceErrorFromResponse(429, 'sign-in').message).toMatch(/too many attempts/i);
    expect(authServiceErrorFromResponse(503, 'sign-in').message).toMatch(/temporarily unavailable/i);
  });

  test('maps timeout and network errors without exposing raw error text', () => {
    expect(authErrorMessage(Object.assign(new Error('timeout'), { name: 'AbortError' }), 'sign-in'))
      .toMatch(/took too long/i);
    expect(authErrorMessage(new TypeError('fetch failed with internal host details'), 'sign-in'))
      .toMatch(/check your internet connection/i);
  });

  test('uses safe session recovery wording for unknown local errors', () => {
    expect(authErrorMessage(new Error('KeychainNativeInternalStackTrace'), 'session-restore'))
      .toMatch(/saved chats have not been deleted/i);
  });

  test('preserves authored validation errors and typed service errors', () => {
    expect(authErrorMessage(new AuthValidationError('The passwords do not match.'), 'create-account'))
      .toBe('The passwords do not match.');
    const typed = new AuthServiceError('Try again safely.', 'unavailable', 503);
    expect(authErrorMessage(typed, 'sign-in')).toBe('Try again safely.');
  });

  test('selects the correct context for each authentication endpoint', () => {
    expect(authContextForPath('/auth/login')).toBe('sign-in');
    expect(authContextForPath('/auth/signup')).toBe('create-account');
    expect(authContextForPath('/auth/recover')).toBe('password-recovery');
    expect(authContextForPath('/auth/migrate-legacy')).toBe('account-migration');
    expect(authContextForPath('/auth/logout')).toBe('sign-out');
    expect(authContextForPath('/auth/session')).toBe('session-restore');
  });
});
