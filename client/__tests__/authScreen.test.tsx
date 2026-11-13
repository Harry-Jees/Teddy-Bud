import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Platform, Text } from 'react-native';
import { BrowserLoginScreen } from '../src/components/BrowserLoginScreen';
import { browserAuthService } from '../src/services/browserAuth';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@react-native-documents/picker', () => ({
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: () => false,
  keepLocalCopy: jest.fn(),
  pick: jest.fn(),
  saveDocuments: jest.fn(),
  types: { json: 'application/json' },
}));

jest.mock('react-native-file-access', () => ({
  Dirs: { CacheDir: '/tmp' },
  FileSystem: { writeFile: jest.fn(), readFile: jest.fn(), unlink: jest.fn() },
}));

jest.mock('@op-engineering/op-sqlite', () => ({
  Storage: class {
    async getItem() { return undefined; }
    async setItem() {}
    async removeItem() {}
  },
  isSQLCipher: () => true,
}));

test('sign-in validates username and password and has no account-creation path', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <BrowserLoginScreen error={null} initialMode="login" canMigrateLegacy={false} onAuthenticated={jest.fn()} />,
    );
  });

  expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'Create a new account')).toBe(false);
  expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Create a new account')).toHaveLength(0);
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Sign in' }).props.onPress();
  });
  expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).findAllByType(Text).map(node => node.props.children))
    .toContain('Use 3–24 characters: lowercase letters, numbers, or underscores.');

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Username' }).props.onChangeText('harry_jees');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Sign in' }).props.onPress();
  });
  expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).findAllByType(Text).map(node => node.props.children))
    .toContain('Enter your password.');
  await ReactTestRenderer.act(async () => renderer.unmount());
}, 15000);

test('enrolled biometric sign-in is offered on the login screen', async () => {
  const platform = jest.spyOn(Platform, 'OS', 'get').mockReturnValue('android');
  const ready = jest.spyOn(browserAuthService, 'hasBiometricSignIn').mockResolvedValue(true);
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <BrowserLoginScreen error={null} initialMode="login" canMigrateLegacy={false} onAuthenticated={jest.fn()} />,
    );
  });
  await ReactTestRenderer.act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(renderer.root.findByProps({ accessibilityLabel: 'Sign in with biometrics' })).toBeTruthy();
  await ReactTestRenderer.act(async () => renderer.unmount());
  ready.mockRestore();
  platform.mockRestore();
}, 15000);
