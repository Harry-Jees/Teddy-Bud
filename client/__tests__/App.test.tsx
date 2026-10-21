/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Animated, Modal, Text } from 'react-native';
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
  const onOpenCrisisResources = jest.fn();
  const onCallEmergency = jest.fn();
  const onRenameChat = jest.fn();
  const onTogglePin = jest.fn();
  const noop = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ChatPage
        wide={false}
        messages={[]}
        conversationTitle="A little room to breathe"
        onOpenHistory={onOpenHistory}
        onRenameChat={onRenameChat}
        isPinned={false}
        onTogglePin={onTogglePin}
        onOpenCrisisResources={onOpenCrisisResources}
        emergencyCallOption={null}
        crisisHelplineOption={null}
        onCallEmergency={onCallEmergency}
        onCallHelpline={noop}
        onTextHelpline={noop}
        onOpenHelplineWebsite={noop}
        memorySuggestion={null}
        onSaveMemorySuggestion={noop}
        onDismissMemorySuggestion={noop}
        draft="A new message"
        setDraft={noop}
        onSend={onSend}
        onRetry={noop}
        retryPending
        isSending={false}
        chatError="The earlier message failed."
      />,
    );
  });

  const composer = renderer.root.findByProps({ accessibilityLabel: 'Write a message to Teddy' });
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

  const renameButton = renderer.root.findByProps({ accessibilityLabel: 'Rename chat' });
  await ReactTestRenderer.act(async () => {
    renameButton.props.onPress();
  });
  expect(onRenameChat).toHaveBeenCalledTimes(1);
  const pinButton = renderer.root.findByProps({ accessibilityLabel: 'Pin chat' });
  await ReactTestRenderer.act(async () => pinButton.props.onPress());
  expect(onTogglePin).toHaveBeenCalledTimes(1);
  expect(renderer.root.findAllByProps({ accessibilityRole: 'switch' })).toHaveLength(0);
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Attach an image' })).toHaveLength(0);
  await ReactTestRenderer.act(async () => renderer.unmount());
}, 15000);

test('chat shows three dots and announces when Teddy Bud is responding', async () => {
  const noop = jest.fn();
  const saveOccasion = jest.fn();
  const animationLoop = jest.spyOn(Animated, 'loop').mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
  }));
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ChatPage
          wide={false}
          messages={[{ id: 1, author: 'you', text: 'Hello', time: 'Now' }]}
          conversationTitle="A little room to breathe"
          onOpenHistory={noop}
          onRenameChat={jest.fn()}
          isPinned={false}
          onTogglePin={jest.fn()}
          onOpenCrisisResources={noop}
          emergencyCallOption={null}
          crisisHelplineOption={null}
          onCallEmergency={noop}
          onCallHelpline={noop}
          onTextHelpline={noop}
          onOpenHelplineWebsite={noop}
          memorySuggestion={null}
          onSaveMemorySuggestion={noop}
          onDismissMemorySuggestion={noop}
            onSaveOccasion={saveOccasion}
          draft=""
          setDraft={noop}
          onSend={noop}
          onRetry={noop}
          retryPending={false}
          isSending
          isThinking
          chatError={null}
        />,
      );
    });

    const typingIndicator = renderer.root.findByProps({ accessibilityLabel: 'Teddy Bud is responding' });
    expect(typingIndicator.props.accessibilityRole).toBe('progressbar');
    expect(typingIndicator.findAllByType(Animated.View)).toHaveLength(3);

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'Open crisis support' }).props.onPress();
    });
    expect(renderer.root.findByProps({ accessibilityLabel: 'Find a crisis helpline in your country' })).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'Save an occasion' }).props.onPress();
    });
    const occasionInput = renderer.root.findByProps({ accessibilityLabel: 'Memory to save' });
    await ReactTestRenderer.act(async () => occasionInput.props.onChangeText('We had a lovely family picnic.'));
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'Save memory' }).props.onPress();
    });
    expect(saveOccasion).toHaveBeenCalledWith('We had a lovely family picnic.');
  } finally {
    if (renderer) await ReactTestRenderer.act(async () => renderer.unmount());
    animationLoop.mockRestore();
  }
});

test('chat presents crisis resources for a direct self-harm signal', async () => {
  const onOpenCrisisResources = jest.fn();
  const onCallEmergency = jest.fn();
  const onCallHelpline = jest.fn();
  const onTextHelpline = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ChatPage
        wide={false}
        messages={[{ id: 1, author: 'you', text: 'I want to die.', time: 'Now' }]}
        conversationTitle="A little room to breathe"
        onOpenHistory={jest.fn()}
          onRenameChat={jest.fn()}
          isPinned={false}
          onTogglePin={jest.fn()}
        onOpenCrisisResources={onOpenCrisisResources}
        emergencyCallOption={{ number: '911', region: 'United States' }}
        crisisHelplineOption={{ number: '988', name: '988 Lifeline', region: 'United States', textNumber: '988', website: 'https://988lifeline.org/' }}
        onCallEmergency={onCallEmergency}
        onCallHelpline={onCallHelpline}
        onTextHelpline={onTextHelpline}
        onOpenHelplineWebsite={jest.fn()}
        memorySuggestion={null}
        onSaveMemorySuggestion={jest.fn()}
        onDismissMemorySuggestion={jest.fn()}
        draft=""
        setDraft={jest.fn()}
        onSend={jest.fn()}
        onRetry={jest.fn()}
        retryPending={false}
        isSending={false}
        chatError={null}
      />,
    );
  });

  expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).findAllByType(Text)[0].props.children)
    .toBe('Immediate support is available');
  const resourcesLink = renderer.root.findByProps({ accessibilityLabel: 'Find a crisis helpline in your country' });
  await ReactTestRenderer.act(async () => resourcesLink.props.onPress());
  expect(onOpenCrisisResources).toHaveBeenCalledTimes(1);
  const callLink = renderer.root.findByProps({ accessibilityLabel: 'Call emergency services at 911 for United States' });
  await ReactTestRenderer.act(async () => callLink.props.onPress());
  expect(onCallEmergency).toHaveBeenCalledWith('911');
  const helplineCallLink = renderer.root.findByProps({ accessibilityLabel: 'Call 988 988 Lifeline' });
  await ReactTestRenderer.act(async () => helplineCallLink.props.onPress());
  expect(onCallHelpline).toHaveBeenCalledWith('988');
  const helplineTextLink = renderer.root.findByProps({ accessibilityLabel: 'Text 988 988 Lifeline' });
  await ReactTestRenderer.act(async () => helplineTextLink.props.onPress());
  expect(onTextHelpline).toHaveBeenCalledWith('988');
  const officialWebsiteLink = renderer.root.findByProps({ accessibilityLabel: 'Visit official 988 Lifeline website' });
  await ReactTestRenderer.act(async () => officialWebsiteLink.props.onPress());
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('India crisis support presents both Tele-MANAS call numbers and its official site, without offering SMS', async () => {
  const onCallHelpline = jest.fn();
  const onOpenHelplineWebsite = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ChatPage
        wide={false}
        messages={[{ id: 1, author: 'you', text: 'I want to die.', time: 'Now' }]}
        conversationTitle="A little room to breathe"
        onOpenHistory={jest.fn()}
          onRenameChat={jest.fn()}
          isPinned={false}
          onTogglePin={jest.fn()}
        onOpenCrisisResources={jest.fn()}
        emergencyCallOption={{ number: '112', region: 'India' }}
        crisisHelplineOption={{
          number: '14416',
          name: 'Tele-MANAS',
          region: 'India',
          alternateCall: { number: '18008914416', label: '1-800 891 4416' },
          website: 'https://telemanas.mohfw.gov.in/',
        }}
        onCallEmergency={jest.fn()}
        onCallHelpline={onCallHelpline}
        onTextHelpline={jest.fn()}
        onOpenHelplineWebsite={onOpenHelplineWebsite}
        memorySuggestion={null}
        onSaveMemorySuggestion={jest.fn()}
        onDismissMemorySuggestion={jest.fn()}
        draft=""
        setDraft={jest.fn()}
        onSend={jest.fn()}
        onRetry={jest.fn()}
        retryPending={false}
        isSending={false}
        chatError={null}
      />,
    );
  });

  const primaryCall = renderer.root.findByProps({ accessibilityLabel: 'Call 14416 Tele-MANAS' });
  await ReactTestRenderer.act(async () => primaryCall.props.onPress());
  expect(onCallHelpline).toHaveBeenLastCalledWith('14416');
  const alternateCall = renderer.root.findByProps({ accessibilityLabel: 'Call 1-800 891 4416 Tele-MANAS' });
  await ReactTestRenderer.act(async () => alternateCall.props.onPress());
  expect(onCallHelpline).toHaveBeenLastCalledWith('18008914416');
  expect(renderer.root.findAll(node => node.props.accessibilityLabel?.startsWith('Text '))).toHaveLength(0);
  const officialSite = renderer.root.findByProps({ accessibilityLabel: 'Visit official Tele-MANAS website' });
  await ReactTestRenderer.act(async () => officialSite.props.onPress());
  expect(onOpenHelplineWebsite).toHaveBeenCalledWith('https://telemanas.mohfw.gov.in/');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('memory suggestion appears beside its reply and requires explicit approval', async () => {
  const onSave = jest.fn();
  const onDismiss = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ChatPage
        wide={false}
        messages={[
          { id: 1, author: 'you', text: 'I hope to become a teacher.', time: 'Now' },
          { id: 2, author: 'teddy', text: 'That sounds like a meaningful goal.', time: 'Now' },
        ]}
        conversationTitle="A little room to breathe"
        onOpenHistory={jest.fn()}
          onRenameChat={jest.fn()}
          isPinned={false}
          onTogglePin={jest.fn()}
        onOpenCrisisResources={jest.fn()}
        emergencyCallOption={null}
        crisisHelplineOption={null}
        onCallEmergency={jest.fn()}
        onCallHelpline={jest.fn()}
        onTextHelpline={jest.fn()}
        onOpenHelplineWebsite={jest.fn()}
        memorySuggestion={{ conversationId: 'chat-one', messageId: 2, fact: 'I hope to become a teacher.' }}
        onSaveMemorySuggestion={onSave}
        onDismissMemorySuggestion={onDismiss}
        draft=""
        setDraft={jest.fn()}
        onSend={jest.fn()}
        onRetry={jest.fn()}
        retryPending={false}
        isSending={false}
        chatError={null}
      />,
    );
  });

  expect(renderer.root.findByProps({ accessibilityRole: 'summary' }).findAllByType(Text).map(node => node.props.children))
    .toContain('Would you like Teddy Bud to remember this?');
  expect(renderer.root.findByProps({ accessibilityLabel: 'Add to memories' })).toBeDefined();
  expect(renderer.root.findAllByType(Modal)).toHaveLength(0);

  const saveButton = renderer.root.findByProps({ accessibilityLabel: 'Add to memories' });
  await ReactTestRenderer.act(async () => saveButton.props.onPress());
  expect(onSave).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(async () => renderer.unmount());
  expect(onDismiss).not.toHaveBeenCalled();
});
