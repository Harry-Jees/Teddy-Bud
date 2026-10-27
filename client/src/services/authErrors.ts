export type AuthErrorContext =
  | 'sign-in'
  | 'create-account'
  | 'password-recovery'
  | 'account-migration'
  | 'session-restore'
  | 'sign-out';

export type AuthErrorKind =
  | 'validation'
  | 'invalid-credentials'
  | 'rate-limited'
  | 'network'
  | 'timeout'
  | 'unavailable'
  | 'session-expired'
  | 'storage'
  | 'unexpected';

export class AuthServiceError extends Error {
  readonly name = 'AuthServiceError';

  constructor(
    message: string,
    readonly kind: AuthErrorKind,
    readonly status?: number,
  ) {
    super(message);
  }
}

export type AuthField = 'email' | 'password' | 'confirmPassword' | 'recoveryPassphrase' | 'recoveryPassphraseConfirmation';

export class AuthValidationError extends Error {
  readonly name = 'AuthValidationError';

  constructor(message: string, readonly field?: AuthField) {
    super(message);
  }
}

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && Number.isFinite(status) ? status : undefined;
}

function messageForStatus(status: number, context: AuthErrorContext): AuthServiceError {
  if (status === 401) {
    if (context === 'sign-in') {
      return new AuthServiceError('Email or password is incorrect. Check your details and try again.', 'invalid-credentials', status);
    }
    if (context === 'password-recovery') {
      return new AuthServiceError('The account details or recovery passphrase could not be verified. Check them and try again.', 'invalid-credentials', status);
    }
    if (context === 'account-migration') {
      return new AuthServiceError('The existing sign-in on this device has expired. Sign in or recover access before moving this account.', 'session-expired', status);
    }
    return new AuthServiceError('Your session has expired or is no longer valid. Please sign in again.', 'session-expired', status);
  }

  if (status === 400) {
    if (context === 'password-recovery') {
      return new AuthServiceError('Check the email, recovery passphrase, and new password requirements, then try again.', 'validation', status);
    }
    if (context === 'create-account') {
      return new AuthServiceError('Check your email, password, and recovery passphrase requirements, then try again.', 'validation', status);
    }
    if (context === 'sign-in') {
      return new AuthServiceError('Enter a valid email address and password, then try again.', 'validation', status);
    }
    return new AuthServiceError('Some details are missing or invalid. Review them and try again.', 'validation', status);
  }

  if (status === 403) {
    return new AuthServiceError('We could not finish setting up this account. Please try again shortly or contact support if it continues.', 'unavailable', status);
  }

  if (status === 404) {
    return new AuthServiceError('The account service is not available right now. Please try again later.', 'unavailable', status);
  }

  if (status === 409 && context === 'create-account') {
    return new AuthServiceError('We could not create an account with those details. Check them, or try signing in if you already have an account.', 'validation', status);
  }

  if (status === 429) {
    return new AuthServiceError('Too many attempts. Please wait a little before trying again.', 'rate-limited', status);
  }

  if (status === 408 || status === 425) {
    return new AuthServiceError('The request took too long. Check your connection and try again.', 'timeout', status);
  }

  if (status >= 500) {
    return new AuthServiceError('The account service is temporarily unavailable. Please try again shortly.', 'unavailable', status);
  }

  return new AuthServiceError('We could not complete that account request. Please try again.', 'unexpected', status);
}

export function authErrorMessage(error: unknown, context: AuthErrorContext): string {
  if (error instanceof AuthValidationError || error instanceof AuthServiceError) return error.message;

  const status = statusOf(error);
  if (status !== undefined) return messageForStatus(status, context).message;

  const name = error && typeof error === 'object' && 'name' in error
    ? String((error as { name?: unknown }).name)
    : '';
  const message = error instanceof Error ? error.message : '';

  if (name === 'AbortError' || /timed out|timeout/i.test(message)) {
    return 'The request took too long. Check your connection and try again.';
  }

  if (error instanceof TypeError || /network request failed|failed to fetch|networkerror|offline/i.test(message)) {
    return 'We could not connect to the account service. Check your internet connection and try again.';
  }

  if (context === 'session-restore') {
    return 'We could not restore your sign-in on this device. Check your connection and retry. Your saved chats have not been deleted.';
  }

  if (context === 'sign-out') {
    return 'We could not confirm sign-out with the account service. Your local sign-in has been cleared; please sign in again if needed.';
  }

  return 'We could not complete that account request. Please try again.';
}

export function authServiceErrorFromResponse(status: number, context: AuthErrorContext): AuthServiceError {
  return messageForStatus(status, context);
}

export function authContextForPath(path: string): AuthErrorContext {
  if (path.startsWith('/auth/login')) return 'sign-in';
  if (path.startsWith('/auth/signup')) return 'create-account';
  if (path.startsWith('/auth/recover')) return 'password-recovery';
  if (path.startsWith('/auth/migrate-legacy')) return 'account-migration';
  if (path.startsWith('/auth/logout')) return 'sign-out';
  return 'session-restore';
}
