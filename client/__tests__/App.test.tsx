/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Animated, Modal, ScrollView, Share, Text } from 'react-native';
import { ChatPage, EmotionsPage, JournalPage } from '../App';

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
  FileSystem: {
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

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
        onStop={jest.fn()}
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
  expect(onSend).toHaveBeenLastCalledWith(undefined);

  const sendButton = renderer.root.findByProps({ accessibilityLabel: 'Send message' });
  expect(sendButton.props.disabled).toBe(false);
  await ReactTestRenderer.act(async () => {
    sendButton.props.onPress(nativeEvent);
  });
  expect(onSend).toHaveBeenCalledTimes(2);
  expect(onSend).toHaveBeenLastCalledWith(undefined);

  const historyButton = renderer.root.findByProps({ accessibilityLabel: 'View chats' });
  await ReactTestRenderer.act(async () => {
    historyButton.props.onPress();
  });
  expect(onOpenHistory).toHaveBeenCalledTimes(1);

  const mobileActions = renderer.root.findByProps({ accessibilityLabel: 'Open chat actions' });
  await ReactTestRenderer.act(async () => mobileActions.props.onPress());
  const renameButton = renderer.root.findByProps({ accessibilityLabel: 'Rename chat' });
  await ReactTestRenderer.act(async () => renameButton.props.onPress());
  expect(onRenameChat).toHaveBeenCalledTimes(1);

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Open chat actions' }).props.onPress();
  });
  const pinButton = renderer.root.findByProps({ accessibilityLabel: 'Pin chat' });
  await ReactTestRenderer.act(async () => pinButton.props.onPress());
  expect(onTogglePin).toHaveBeenCalledTimes(1);
  expect(renderer.root.findAllByProps({ accessibilityRole: 'switch' })).toHaveLength(0);
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Attach an image' }).length).toBeGreaterThan(0);
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
          onStop={jest.fn()}
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
        onStop={jest.fn()}
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
        onStop={jest.fn()}
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
        onStop={jest.fn()}
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


test('assistant replies can be shared through the platform share sheet', async () => {
  const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  const onRegenerate = jest.fn();
  const noop = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ChatPage
          wide={false}
          messages={[{ id: 2, author: 'teddy', text: 'Take a breath. You can go one step at a time.', time: 'Now' }]}
          conversationTitle="A little room to breathe"
          onOpenHistory={noop}
          onRenameChat={noop}
          isPinned={false}
          onTogglePin={noop}
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
          draft=""
          setDraft={noop}
          onSend={noop}
          onStop={noop}
          onRetry={noop}
          onRegenerate={onRegenerate}
          retryPending={false}
          isSending={false}
          chatError={null}
        />,
      );
    });
    const shareButton = renderer.root.findByProps({ accessibilityLabel: 'Share Teddy Bud reply' });
    await ReactTestRenderer.act(async () => shareButton.props.onPress());
    expect(shareSpy).toHaveBeenCalledWith({ title: 'Teddy Bud reply', message: 'Take a breath. You can go one step at a time.' });
    const regenerateButton = renderer.root.findByProps({ accessibilityLabel: 'Generate another reply' });
    await ReactTestRenderer.act(async () => regenerateButton.props.onPress());
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  } finally {
    await ReactTestRenderer.act(async () => renderer?.unmount());
    shareSpy.mockRestore();
  }
}, 15000);


test('the latest user message can be edited and resent', async () => {
  const onEditMessage = jest.fn();
  const noop = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ChatPage
        wide={false}
        messages={[
          { id: 11, author: 'you', text: 'I feel overwhelmed.', time: 'Now' },
          { id: 12, author: 'teddy', text: 'Let us take one small step.', time: 'Now' },
        ]}
        conversationTitle="A little room to breathe"
        onOpenHistory={noop}
        onRenameChat={noop}
        isPinned={false}
        onTogglePin={noop}
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
        draft=""
        setDraft={noop}
        onSend={noop}
        onStop={noop}
        onRetry={noop}
        onEditMessage={onEditMessage}
        onRegenerate={noop}
        retryPending={false}
        isSending={false}
        chatError={null}
      />,
    );
  });
  const editButton = renderer.root.findByProps({ accessibilityLabel: 'Edit and resend your last message' });
  await ReactTestRenderer.act(async () => editButton.props.onPress());
  expect(onEditMessage).toHaveBeenCalledWith({ id: 11, author: 'you', text: 'I feel overwhelmed.', time: 'Now' });
  await ReactTestRenderer.act(async () => renderer.unmount());
}, 15000);


test('chat preserves an older reading position during streaming and exposes jump-to-latest', async () => {
  const noop = jest.fn();
  const messages = [
    { id: 1, author: 'you' as const, text: 'Earlier question', time: '9:00 AM' },
    { id: 2, author: 'teddy' as const, text: 'Earlier answer', time: '9:01 AM' },
    { id: 3, author: 'you' as const, text: 'Another question', time: '9:02 AM' },
    { id: 4, author: 'teddy' as const, text: 'Another answer', time: '9:03 AM' },
  ];
  const renderChat = (streamingReply = '') => (
    <ChatPage
      wide={false}
      conversationId="scroll-test"
      messages={messages}
      streamingReply={streamingReply}
      conversationTitle="Scroll test"
      onOpenHistory={noop}
      onRenameChat={noop}
      isPinned={false}
      onTogglePin={noop}
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
      draft=""
      setDraft={noop}
      onSend={noop}
      onStop={noop}
      onRetry={noop}
      retryPending={false}
      isSending={Boolean(streamingReply)}
      chatError={null}
    />
  );
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(renderChat());
  });

  const chatScroll = renderer.root.findAllByType(ScrollView).find(node => node.props.scrollEventThrottle === 16);
  expect(chatScroll).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    chatScroll!.props.onScroll({
      nativeEvent: {
        contentOffset: { y: 0 },
        contentSize: { height: 2000, width: 360 },
        layoutMeasurement: { height: 500, width: 360 },
      },
    });
  });
  expect(renderer.root.findByProps({ accessibilityLabel: 'Jump to latest message' })).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer.update(renderChat('A streaming continuation'));
  });
  expect(renderer.root.findByProps({ accessibilityLabel: 'Jump to latest message' })).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Jump to latest message' }).props.onPress();
  });
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Jump to latest message' })).toHaveLength(0);
  await ReactTestRenderer.act(async () => renderer.unmount());
}, 15000);


test('journal preserves edited text and explains a failed local save', async () => {
  const onSave = jest.fn().mockRejectedValue(new Error('SQLite internal stack details'));
  const noop = jest.fn(async () => undefined);
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <JournalPage wide={false} entries={[]} onSave={onSave} onDelete={noop} onShare={jest.fn()} />,
    );
  });

  const entryField = renderer.root.findByProps({ accessibilityLabel: 'Journal entry' });
  await ReactTestRenderer.act(async () => {
    entryField.props.onChangeText('A private entry I do not want to lose.');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Save privately' }).props.onPress();
  });

  expect(onSave).toHaveBeenCalledTimes(1);
  expect(renderer.root.findByProps({ accessibilityLabel: 'Journal entry' }).props.value)
    .toBe('A private entry I do not want to lose.');
  const alert = renderer.root.findByProps({ accessibilityRole: 'alert' });
  expect(alert.findAllByType(Text).map(node => node.props.children).join(' '))
    .toMatch(/your text is still in the editor/i);
  expect(alert.findAllByType(Text).map(node => node.props.children).join(' '))
    .not.toMatch(/SQLite internal stack details/i);

  await ReactTestRenderer.act(async () => renderer.unmount());
}, 15000);

test('journal explains an empty save attempt instead of silently blocking it', async () => {
  const onSave = jest.fn(async () => undefined);
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <JournalPage wide={false} entries={[]} onSave={onSave} onDelete={jest.fn(async () => undefined)} onShare={jest.fn()} />,
    );
  });

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Save privately' }).props.onPress();
  });
  const alert = renderer.root.findByProps({ accessibilityRole: 'alert' });
  expect(alert.findAllByType(Text).map(node => node.props.children).join(' '))
    .toMatch(/write a little in your entry before saving/i);
  expect(onSave).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => renderer.unmount());
}, 15000);


test('emotion check-in keeps ratings and note visible when local persistence fails', async () => {
  const onSave = jest.fn().mockRejectedValue(new Error('SQLCipher native detail'));
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <EmotionsPage wide={false} entries={[]} onSave={onSave} onDelete={jest.fn(async () => undefined)} />,
    );
  });

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityRole: 'button', children: undefined });
  }).catch(() => undefined);

  await ReactTestRenderer.act(async () => {
    renderer.root.findAll(node => node.props.children === 'Add a check-in').at(0)?.props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Anxious 5 out of 5' }).props.onPress();
  });
  const noteField = renderer.root.findByProps({ accessibilityLabel: 'Emotion check-in note (optional)' });
  await ReactTestRenderer.act(async () => noteField.props.onChangeText('A note I need to keep.'));
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: 'Save emotion check-in' }).props.onPress();
  });

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    emotions: expect.objectContaining({ anxious: 5 }),
    note: 'A note I need to keep.',
  }));
  expect(renderer.root.findByProps({ accessibilityLabel: 'Anxious 5 out of 5' }).props.accessibilityState.selected).toBe(true);
  expect(renderer.root.findByProps({ accessibilityLabel: 'Emotion check-in note (optional)' }).props.value)
    .toBe('A note I need to keep.');
  const alert = renderer.root.findByProps({ accessibilityRole: 'alert' });
  const message = alert.findAllByType(Text).map(node => node.props.children).join(' ');
  expect(message).toMatch(/your ratings and note are still here/i);
  expect(message).not.toMatch(/SQLCipher native detail/i);

  await ReactTestRenderer.act(async () => renderer.unmount());
}, 15000);
