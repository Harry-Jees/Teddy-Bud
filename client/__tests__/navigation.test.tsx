import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { BottomNav, MorePage } from '../App';

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


test('mobile navigation exposes four destinations and an immediate central New Chat action', async () => {
  const onNavigate = jest.fn();
  const onNewConversation = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <BottomNav page="chat" onNavigate={onNavigate} onNewConversation={onNewConversation} bottomInset={0} />,
    );
  });

  const buttons = renderer.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.accessibilityLabel === 'string' && typeof node.props.onPress === 'function');
  expect(buttons.map(button => button.props.accessibilityLabel)).toEqual([
    'Chats',
    'Memories',
    'Start a new chat',
    'Journal',
    'More',
  ]);
  expect(buttons.filter(button => button.props.accessibilityLabel !== 'Start a new chat')).toHaveLength(4);

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Start a new chat' }).props.onPress();
  });
  expect(onNewConversation).toHaveBeenCalledTimes(1);
  expect(onNavigate).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'More' }).props.onPress();
  });
  expect(onNavigate).toHaveBeenCalledWith('more');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('More screen keeps secondary tools discoverable and navigable', async () => {
  const onNavigate = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<MorePage wide={false} onNavigate={onNavigate} />);
  });

  const labels = renderer.root
    .findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.accessibilityLabel === 'string' && typeof node.props.onPress === 'function')
    .map(button => button.props.accessibilityLabel);
  expect(labels).toEqual(['Chat history', 'Emotions', 'Wellbeing', 'Privacy', 'Settings']);

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Privacy' }).props.onPress();
  });
  expect(onNavigate).toHaveBeenCalledWith('privacy');
  await ReactTestRenderer.act(async () => renderer.unmount());
});
