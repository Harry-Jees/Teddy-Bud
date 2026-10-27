import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
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

test('sign-in gives actionable email/password validation and clears stale errors while editing', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <BrowserLoginScreen error={null} initialMode="login" canMigrateLegacy={false} onAuthenticated={jest.fn()} />,
    );
  });

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Sign in' }).props.onPress();
  });
  expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).findAllByType(Text).map(node => node.props.children))
    .toContain('Enter a valid email address.');

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Email' }).props.onChangeText('person@example.com');
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
      <BrowserLoginScreen error={null} initialMode="create" canMigrateLegacy={false} onAuthenticated={jest.fn()} />,
    );
  });

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Email' }).props.onChangeText('person@example.com');
    renderer.root.findByProps({ accessibilityLabel: 'Password' }).props.onChangeText('first-password');
    renderer.root.findByProps({ accessibilityLabel: 'Confirm password' }).props.onChangeText('different-password');
    renderer.root.findByProps({ accessibilityLabel: 'Choose recovery passphrase' }).props.onChangeText('a safe recovery passphrase');
    renderer.root.findByProps({ accessibilityLabel: 'Confirm recovery passphrase' }).props.onChangeText('a safe recovery passphrase');
  });

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Create account' }).props.onPress();
  });
  expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).findAllByType(Text).map(node => node.props.children))
    .toContain('The passwords do not match.');

  await ReactTestRenderer.act(async () => renderer.unmount());
}, 15000);
