import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { BottomNav, ChatHistoryPage, MorePage } from '../App';

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


test('mobile navigation exposes four destinations plus a central New Chat action', async () => {
  const onNavigate = jest.fn();
  const onNewConversation = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <BottomNav page="chat" onNavigate={onNavigate} onNewConversation={onNewConversation} bottomInset={0} />,
    );
  });

  const labels = [...new Set(renderer.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.accessibilityLabel === 'string').map(button => button.props.accessibilityLabel))];
  expect(labels).toEqual([
    'Chats',
    'Memories',
    'Start a new chat',
    'Discover',
    'Settings',
  ]);
  expect(labels.filter(label => label !== 'Start a new chat')).toHaveLength(4);

  const interactive = (label: string) => renderer.root
    .findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')
    .find(node => typeof node.props.onPress === 'function');
  await ReactTestRenderer.act(async () => {
    interactive('Start a new chat')!.props.onPress();
  });
  expect(onNewConversation).toHaveBeenCalledTimes(1);
  expect(onNavigate).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    interactive('Discover')!.props.onPress();
  });
  expect(onNavigate).toHaveBeenCalledWith('discover');
  await ReactTestRenderer.act(async () => {
    interactive('Settings')!.props.onPress();
  });
  expect(onNavigate).toHaveBeenCalledWith('settings');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('Discover keeps companion tools discoverable and navigable', async () => {
  const onNavigate = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<MorePage wide={false} onNavigate={onNavigate} />);
  });

  const labels = [...new Set(renderer.root
    .findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.accessibilityLabel === 'string')
    .map(button => button.props.accessibilityLabel))];
  expect(labels).toEqual(['Journal', 'Emotions', 'Wellbeing']);

  const journalControl = renderer.root
    .findAll(node => node.props.accessibilityLabel === 'Journal' && typeof node.props.onPress === 'function')
    .find(node => typeof node.props.onPress === 'function');
  await ReactTestRenderer.act(async () => {
    journalControl!.props.onPress();
  });
  expect(onNavigate).toHaveBeenCalledWith('journal');
  await ReactTestRenderer.act(async () => renderer.unmount());
});


test('mobile history searches recent messages and retains chat management actions', async () => {
  const onPin = jest.fn();
  const onSelect = jest.fn();
  const conversations = [
    {
      id: 'calm-chat',
      title: 'A calm morning',
      createdAt: '2026-10-20T08:00:00.000Z',
      updatedAt: '2026-10-20T08:01:00.000Z',
      messages: [{ id: 1, author: 'you' as const, text: 'I enjoyed a quiet walk.', time: '8:01 AM' }],
    },
    {
      id: 'study-chat',
      title: 'Study plans',
      createdAt: '2026-10-19T08:00:00.000Z',
      updatedAt: '2026-10-19T08:01:00.000Z',
      messages: [{ id: 2, author: 'you' as const, text: 'Prepare for the exam.', time: '8:01 AM' }],
    },
  ];
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ChatHistoryPage
        conversations={conversations}
        activeConversationId="calm-chat"
        onBack={jest.fn()}
        onSelect={onSelect}
        onNewConversation={jest.fn()}
        onPin={onPin}
        onDelete={jest.fn()}
        onRename={jest.fn()}
      />,
    );
  });

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Search chats' }).props.onChangeText('quiet walk');
  });
  expect(renderer.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Open chat:')).map(node => node.props.accessibilityLabel))
    .toContain('Open chat: A calm morning');
  expect(renderer.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Open chat:')).map(node => node.props.accessibilityLabel))
    .not.toContain('Open chat: Study plans');

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Search chats' }).props.onChangeText('');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Chat options for A calm morning' }).props.onPress();
  });
  const pinMenuItem = renderer.root.findAll(node =>
    node.props.accessibilityRole === 'menuitem'
    && node.props.accessibilityLabel === 'Pin chat A calm morning'
    && typeof node.props.onPress === 'function',
  ).find(node => typeof node.props.onPress === 'function');
  expect(pinMenuItem).toBeTruthy();
  await ReactTestRenderer.act(async () => pinMenuItem!.props.onPress());
  expect(onPin).toHaveBeenCalledWith('calm-chat', true);

  await ReactTestRenderer.act(async () => renderer.unmount());
});
