import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BrowserLoginScreen } from '../App';

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

test('sign-in gives actionable username/password validation and clears stale errors while editing', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider><BrowserLoginScreen error={null} initialMode="login" canMigrateLegacy={false} onAuthenticated={jest.fn()} /></SafeAreaProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Sign in' }).props.onPress();
  });
  expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).findAllByType(Text).map(node => node.props.children))
    .toContain('Use 3–24 characters: lowercase letters, numbers, or underscores.');

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Username' }).props.onChangeText('harry_jees');
  });
  expect(renderer.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(0);

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Sign in' }).props.onPress();
  });
  expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).findAllByType(Text).map(node => node.props.children))
    .toContain('Enter your password.');

  await ReactTestRenderer.act(async () => renderer.unmount());
}, 15000);

test('create account explains mismatched passwords instead of silently blocking submission', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider><BrowserLoginScreen error={null} initialMode="create" canMigrateLegacy={false} onAuthenticated={jest.fn()} /></SafeAreaProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Username' }).props.onChangeText('harry_jees');
    renderer.root.findByProps({ accessibilityLabel: 'Password' }).props.onChangeText('first-password-2026');
    renderer.root.findByProps({ accessibilityLabel: 'Confirm password' }).props.onChangeText('different-password-2026');
    renderer.root.findByProps({ accessibilityLabel: 'Choose recovery passphrase' }).props.onChangeText('a safe recovery passphrase');
  });

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Continue setup' }).props.onPress();
  });
  expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).findAllByType(Text).map(node => node.props.children))
    .toContain('The passwords do not match.');

  await ReactTestRenderer.act(async () => renderer.unmount());
}, 15000);


test('password visibility has an accessible toggle and preserves the entered value', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider><BrowserLoginScreen error={null} initialMode="create" canMigrateLegacy={false} onAuthenticated={jest.fn()} /></SafeAreaProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Password' }).props.onChangeText('private-password');
  });
  expect(renderer.root.findByProps({ accessibilityLabel: 'Password' }).props.secureTextEntry).toBe(true);
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Show password' }).props.onPress();
  });
  const revealed = renderer.root.findByProps({ accessibilityLabel: 'Password' });
  expect(revealed.props.secureTextEntry).toBe(false);
  expect(revealed.props.value).toBe('private-password');
  expect(renderer.root.findByProps({ accessibilityLabel: 'Hide password' })).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Confirm password' }).props.onChangeText('confirm-password-value');
    renderer.root.findByProps({ accessibilityLabel: 'Show confirm password' }).props.onPress();
  });
  expect(renderer.root.findByProps({ accessibilityLabel: 'Confirm password' }).props.secureTextEntry).toBe(false);

  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('recovery passphrase is entered once, visible by default, and has an eye toggle', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider><BrowserLoginScreen error={null} initialMode="create" canMigrateLegacy={false} onAuthenticated={jest.fn()} /></SafeAreaProvider>,
    );
  });
  const phrase = renderer.root.findByProps({ accessibilityLabel: 'Choose recovery passphrase' });
  expect(phrase.props.secureTextEntry).toBe(false);
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Confirm recovery passphrase' })).toHaveLength(0);
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Hide recovery passphrase' }).props.onPress();
  });
  expect(renderer.root.findByProps({ accessibilityLabel: 'Choose recovery passphrase' }).props.secureTextEntry).toBe(true);
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Show recovery passphrase' }).props.onPress();
  });
  expect(renderer.root.findByProps({ accessibilityLabel: 'Choose recovery passphrase' }).props.secureTextEntry).toBe(false);
  await ReactTestRenderer.act(async () => renderer.unmount());
});
test('returning sign-in does not offer a second account setup path', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider><BrowserLoginScreen error={null} initialMode="login" canMigrateLegacy={false} onAuthenticated={jest.fn()} /></SafeAreaProvider>,
    );
  });
  expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Create a private space')).toHaveLength(0);
  expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'Forgot password?')).toBe(true);
  await ReactTestRenderer.act(async () => renderer.unmount());
});
