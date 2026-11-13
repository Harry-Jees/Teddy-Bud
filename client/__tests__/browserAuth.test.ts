import { browserAuthService } from '../src/services/browserAuth';
import * as Keychain from 'react-native-keychain';

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => ({ service: 'test' })),
  resetGenericPassword: jest.fn(async () => true),
}));

const mockedFetch = jest.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockedFetch.mockReset();
  globalThis.fetch = mockedFetch as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('BrowserAuthService public error behavior', () => {
  test('keeps a device bound to its original username', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({
      username: 'first_person',
      password: 'true',
      service: 'com.teddybud.auth-setup',
    });

    await expect(browserAuthService.signIn('another_person', 'password'))
      .rejects.toMatchObject({
        kind: 'device-account',
        message: 'This device is already set up for @first_person. Sign in with that username to keep your private space here.',
      });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  test('maps incorrect sign-in credentials to a safe, generic message', async () => {
    mockedFetch.mockResolvedValue(response(401, { error: 'user does not exist; internal account lookup' }));

    await expect(browserAuthService.signIn('person_example', 'not-correct'))
      .rejects.toMatchObject({
        status: 401,
        message: 'Username or password is incorrect. Check your details and try again.',
      });
  });

  test('does not expose arbitrary backend text for rate limits or server failures', async () => {
    mockedFetch.mockResolvedValueOnce(response(429, { error: 'internal throttling policy details' }));
    await expect(browserAuthService.signIn('person_example', 'password'))
      .rejects.toMatchObject({ status: 429, message: expect.stringMatching(/too many attempts/i) });

    mockedFetch.mockResolvedValueOnce(response(503, { error: 'secret upstream hostname and stack' }));
    await expect(browserAuthService.signIn('person_example', 'password'))
      .rejects.toMatchObject({ status: 503, message: expect.stringMatching(/temporarily unavailable/i) });
  });

  test('maps offline failures to an actionable message', async () => {
    mockedFetch.mockRejectedValue(new TypeError('fetch failed with internal host details'));

    await expect(browserAuthService.signIn('person_example', 'password'))
      .rejects.toMatchObject({ message: expect.stringMatching(/check your internet connection/i) });
  });

  test('does not reveal whether an account exists after create-account conflict', async () => {
    mockedFetch.mockResolvedValue(response(409, { error: 'account exists at private service' }));

    await expect(browserAuthService.createAccount('person_example', 'a-long-password', 'a long recovery phrase'))
      .rejects.toMatchObject({
        status: 409,
        message: expect.stringMatching(/could not create an account with those details/i),
      });
  });
});
test('logout keeps the enrolled biometric credential available for the next sign-in', async () => {
  const disable = jest.spyOn(browserAuthService, 'disableBiometricSignIn');
  mockedFetch.mockResolvedValue(response(200, { success: true }));
  await browserAuthService.logout();
  expect(disable).not.toHaveBeenCalled();
  disable.mockRestore();
});
