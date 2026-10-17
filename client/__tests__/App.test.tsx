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
  const noop = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ChatPage
        wide={false}
        messages={[]}
        draft="A new message"
        setDraft={noop}
        onSend={onSend}
        onRetry={noop}
        retryPending
        onClear={noop}
        onNewConversation={noop}
        isSending={false}
        chatError="The earlier message failed."
        imageAttached={false}
        onAttachImage={noop}
        onRemoveImage={noop}
        enableWebBrowsing={false}
        setEnableWebBrowsing={noop}
        codingMode={false}
        setCodingMode={noop}
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
});
