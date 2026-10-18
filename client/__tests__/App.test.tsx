/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ChatPage } from '../App';

jest.mock('@op-engineering/op-sqlite', () => ({
  Storage: class {
    async getItem() {
      return undefined;
    }

    async setItem() {}

    async removeItem() {}
  },
  isSQLCipher: () => true,
}));

test('chat composer sends on Enter and keeps the send button available after a failed message', async () => {
  const onSend = jest.fn();
  const onOpenHistory = jest.fn();
  const onNewConversation = jest.fn();
  const noop = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ChatPage
        wide={false}
        messages={[]}
        conversationTitle="A little room to breathe"
        onOpenHistory={onOpenHistory}
        memorySuggestionError={null}
        draft="A new message"
        setDraft={noop}
        onSend={onSend}
        onNewConversation={onNewConversation}
        onRetry={noop}
        retryPending
        onClear={noop}
        isSending={false}
        chatError="The earlier message failed."
        imageAttached={false}
        onAttachImage={noop}
        onRemoveImage={noop}
      />,
    );
  });

  const composer = renderer.root.findByProps({ accessibilityLabel: 'Write a message' });
  const nativeEvent = { nativeEvent: { text: 'A new message' } };
  expect(composer.props.onSubmitEditing).not.toBe(onSend);
  await ReactTestRenderer.act(async () => {
    composer.props.onSubmitEditing(nativeEvent);
  });
  expect(onSend).toHaveBeenCalledTimes(1);
  expect(onSend).toHaveBeenLastCalledWith();

  const sendButton = renderer.root.findByProps({ accessibilityLabel: 'Send message' });
  expect(sendButton.props.disabled).toBe(false);
  await ReactTestRenderer.act(async () => {
    sendButton.props.onPress(nativeEvent);
  });
  expect(onSend).toHaveBeenCalledTimes(2);
  expect(onSend).toHaveBeenLastCalledWith();

  const historyButton = renderer.root.findByProps({ accessibilityLabel: 'View chats' });
  await ReactTestRenderer.act(async () => {
    historyButton.props.onPress();
  });
  expect(onOpenHistory).toHaveBeenCalledTimes(1);

  const newChatButton = renderer.root.findByProps({ accessibilityLabel: 'Start a new chat' });
  await ReactTestRenderer.act(async () => {
    newChatButton.props.onPress();
  });
  expect(onNewConversation).toHaveBeenCalledTimes(1);
  expect(renderer.root.findAllByProps({ accessibilityRole: 'switch' })).toHaveLength(0);
  expect(renderer.root.findByProps({ accessibilityLabel: 'Attach an image' })).toBeDefined();
});
