import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import {
  Animated,
  AccessibilityInfo,
  Alert,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GATEWAY_BASE_URL } from './src/config/gateway';
import { GatewayService } from './src/services/gateway';
import { browserAuthService } from './src/services/browserAuth';
import type { StoredSession } from './src/services/session';
import { findRelevantChatHistory, localDataService, ownerFromToken } from './src/services/localData';
import type { LocalConversation, LocalMemory, LocalMessage } from './src/services/localData';
import { crisisHelplineOptionForLocale, emergencyCallOptionForLocale, hasCrisisSignal } from './src/services/conversationSafety';
import type { CrisisHelplineOption, EmergencyCallOption } from './src/services/conversationSafety';
import teddyBudLogoAsset from './assets/teddy-bud-logo.png';

type Page = 'chat' | 'history' | 'memories' | 'privacy';
type Memory = LocalMemory;
type MemorySuggestion = { conversationId: string; messageId: number; fact: string };
type Message = LocalMessage;
type Conversation = LocalConversation;

const C = {
  canvas: '#F8F8F6', paper: '#FFFFFF', paperAlt: '#F2F2EF', ink: '#272724',
  muted: '#73736E', line: '#E6E5E1', cocoa: '#685443', cocoaDark: '#514234',
  peach: '#E7B49A', peachLight: '#F8E9DF', green: '#536C53', greenLight: '#E8EFE5',
  rose: '#A65F50', white: '#FFFFFF',
};

const navItems: { id: Page; icon: string; label: string }[] = [
  { id: 'chat', icon: '◌', label: 'Your space' },
  { id: 'memories', icon: '✳', label: 'Memories' },
  { id: 'privacy', icon: '⌑', label: 'Privacy' },
];

const gatewayService = new GatewayService(GATEWAY_BASE_URL);
const teddyBudLogo: ImageSourcePropType = typeof teddyBudLogoAsset === 'string'
  ? { uri: teddyBudLogoAsset }
  : teddyBudLogoAsset;

function isAuthCallbackUrl(value: string): boolean {
  try {
    const callback = new URL(value);
    return (callback.protocol === 'https:' || callback.protocol === 'http:')
      ? callback.pathname.endsWith('/auth/callback')
      : callback.protocol === 'teddybud:' && callback.hostname === 'auth' && callback.pathname === '/callback';
  } catch {
    return false;
  }
}

function App() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={C.canvas} />
        <AccessGate />
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Teddy Bud recovered from a screen rendering error.', error);
  }

  render() {
    if (this.state.hasError) {
      return <View style={styles.fatalFallback}>
        <Text style={styles.fatalTitle}>This screen ran into a problem.</Text>
        <Text style={styles.fatalBody}>Your saved conversations are kept on this device. Try opening the app again.</Text>
        <Pressable accessibilityRole="button" onPress={() => {
          if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
          else this.setState({ hasError: false });
        }} style={({ pressed }) => [styles.fatalButton, pressed && styles.pressed]}>
          <Text style={styles.fatalButtonText}>Try again</Text>
        </Pressable>
      </View>;
    }
    return this.props.children;
  }
}

function AccessGate() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const callbackUrl = Platform.OS === 'web'
          ? typeof window !== 'undefined' && window.location.pathname.endsWith('/auth/callback') ? window.location.href : null
          : await Linking.getInitialURL();
        const current = callbackUrl && isAuthCallbackUrl(callbackUrl)
          ? await browserAuthService.consumeCallback(callbackUrl)
          : await browserAuthService.restore();
        if (mounted) setSession(current);
      } catch (restoreError) {
        if (mounted) setError(restoreError instanceof Error ? restoreError.message : 'Unable to restore your sign-in.');
      } finally {
        if (mounted) setBusy(false);
      }
    };
    const subscription = Platform.OS === 'web'
      ? null
      : Linking.addEventListener('url', ({ url }) => {
        if (!isAuthCallbackUrl(url)) return;
        browserAuthService.consumeCallback(url).then(next => {
          if (!mounted) return;
          if (next) {
            setError(null);
            setSession(next);
          }
        }).catch(callbackError => {
          if (mounted) setError(callbackError instanceof Error ? callbackError.message : 'Sign-in could not be completed.');
        });
      });
    restore();
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  if (busy) return <AuthLoading />;
  if (!session) return <BrowserLoginScreen error={error} />;
  return <TeddyBud sessionToken={session.accessToken} profilePictureUrl={session.profilePictureUrl} onLogout={() => {
    browserAuthService.logout().then(() => setSession(null)).catch(logoutError => {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to end the server session.');
      setSession(null);
    });
  }} />;
}

function AuthLoading() {
  return <View style={styles.authScreen}><View style={styles.brandMark}><Image source={teddyBudLogo} style={styles.brandLogo} accessibilityLabel="Teddy Bud" /></View><Text style={styles.authTitle}>Opening your private space…</Text><Text style={styles.authBody}>Checking your secure session.</Text></View>;
}

function BrowserLoginScreen({ error }: { error: string | null }) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submitGoogleLogin = async () => {
    if (submitting) return;
    setSubmitting(true); setFormError(null);
    try {
      await browserAuthService.signInWithGoogle();
      if (Platform.OS !== 'web') setSubmitting(false);
    } catch (googleError) {
      setFormError(googleError instanceof Error ? googleError.message : 'Unable to start Google sign-in.');
      setSubmitting(false);
    }
  };

  return <View style={styles.authScreen}>
    <View style={styles.authCard}>
      <View style={styles.authMark}><Image source={teddyBudLogo} style={styles.authLogo} accessibilityLabel="Teddy Bud" /></View>
      <Text style={styles.authEyebrow}>Teddy Bud</Text>
      <Text style={styles.authTitle}>A little room to breathe.</Text>
      <Text style={styles.authBody}>Continue securely with your Google (Gmail) account. No password or email verification code needed.</Text>
      {(error || formError) && <View style={styles.authError}><Text style={styles.authErrorText}>{formError || error}</Text></View>}
      <Pressable accessibilityRole="button" accessibilityLabel="Continue with Google" disabled={submitting} onPress={submitGoogleLogin} style={({ pressed }) => [styles.googleAuthButton, submitting && styles.buttonDisabled, pressed && styles.pressed]}>
        <Text style={styles.googleAuthButtonText}>{submitting ? 'Opening Google…' : 'Continue with Google'}</Text>
      </Pressable>
      <Text style={styles.authFootnote}>Google securely verifies your account and email address. Teddy Bud never receives your Google password.</Text>
    </View>
  </View>;
}

function TeddyBud({ sessionToken, profilePictureUrl, onLogout }: { sessionToken: string; profilePictureUrl?: string; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 800;
  const [page, setPage] = useState<Page>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [draft, setDraft] = useState('');
  const [memoryModal, setMemoryModal] = useState(false);
  const [memorySuggestion, setMemorySuggestion] = useState<MemorySuggestion | null>(null);
  const [memorySuggestionError, setMemorySuggestionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [rememberInSession, setRememberInSession] = useState(true);
  const rememberPreferenceRef = useRef(true);
  const memorySuggestionRequestId = useRef(0);
  const nextMessageId = useRef(0);
  const [shareMemories, setShareMemories] = useState(false);
  const [shareChatHistory, setShareChatHistory] = useState(false);
  const [localDataReady, setLocalDataReady] = useState(false);
  const [localDataOwner, setLocalDataOwner] = useState<string | null>(null);
  const [localDataError, setLocalDataError] = useState<string | null>(null);
  const [localDataSaveError, setLocalDataSaveError] = useState<string | null>(null);
  const [localDataRetry, setLocalDataRetry] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const title = useMemo(() => page === 'history' ? 'Your chats' : navItems.find(item => item.id === page)?.label ?? 'Your space', [page]);
  const owner = useMemo(() => ownerFromToken(sessionToken), [sessionToken]);
  const activeConversation = conversations.find(conversation => conversation.id === activeConversationId) ?? null;
  const messages = activeConversation?.messages ?? [];
  const deviceLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  const emergencyCallOption = emergencyCallOptionForLocale(deviceLocale);
  const crisisHelplineOption = crisisHelplineOptionForLocale(deviceLocale);

  useEffect(() => {
    let active = true;
    setLocalDataReady(false);
    setLocalDataError(null);
    setLocalDataSaveError(null);
    localDataService.load(owner).then(data => {
      if (!active) return;
      setConversations(data.conversations);
      setActiveConversationId(data.activeConversationId);
      nextMessageId.current = data.conversations.reduce(
        (latest, conversation) => conversation.messages.reduce((messageId, message) => Math.max(messageId, message.id), latest),
        nextMessageId.current,
      );
      setMemories(data.memories);
      // These three memory/context features are intentionally kept enabled.
      // Reassert them after loading older locally saved preferences as well.
      setRememberInSession(true);
      rememberPreferenceRef.current = true;
      setShareMemories(true);
      setShareChatHistory(true);
      setLocalDataOwner(owner);
      setLocalDataReady(true);
    }).catch(error => {
      if (active) setLocalDataError(error instanceof Error ? error.message : 'Could not load private data saved on this device.');
    });
    return () => { active = false; };
  }, [owner, localDataRetry]);

  useEffect(() => {
    if (!localDataReady || localDataOwner !== owner) return;
    localDataService.save(owner, {
      conversations,
      activeConversationId,
      memories,
      rememberInSession,
      shareMemories,
      shareChatHistory,
    }).then(() => {
      setLocalDataSaveError(null);
    }).catch(error => {
      setLocalDataSaveError(error instanceof Error ? error.message : 'Could not save private data on this device.');
    });
  }, [localDataReady, localDataOwner, owner, conversations, activeConversationId, memories, rememberInSession, shareMemories, shareChatHistory]);

  const appendConversationMessage = (conversationId: string, message: Message) => {
    const updatedAt = new Date().toISOString();
    setConversations(current => {
      const existing = current.find(conversation => conversation.id === conversationId);
      if (!existing) {
        const conversationTitle = message.author === 'you' ? message.text.trim().slice(0, 48) : 'New chat';
        return [{
          id: conversationId,
          title: conversationTitle || 'New chat',
          createdAt: updatedAt,
          updatedAt,
          messages: [message],
        }, ...current];
      }
      const conversationTitle = existing.messages.some(item => item.author === 'you') || message.author !== 'you'
        ? existing.title
        : message.text.trim().slice(0, 48) || 'New chat';
      const updated = { ...existing, title: conversationTitle, updatedAt, messages: [...existing.messages, message] };
      return [updated, ...current.filter(conversation => conversation.id !== conversationId)];
    });
  };

  const openMemory = (memory?: Memory) => {
    setEditing(memory ?? null);
    setMemoryDraft(memory?.text ?? '');
    setMemoryModal(true);
  };

  const saveMemory = () => {
    const value = memoryDraft.trim();
    if (!value) return;
    if (editing) {
      setMemories(current => current.map(item => item.id === editing.id ? { ...item, text: value } : item));
    } else {
      setMemories(current => [{ id: Date.now(), text: value, date: 'Added just now' }, ...current]);
    }
    setMemoryModal(false);
  };

  const removeMemory = (memory: Memory) => confirmAction(
    'Forget this memory?',
    'It will be removed from saved memories on this device.',
    () => setMemories(current => current.filter(item => item.id !== memory.id)),
  );

  const setConversationPinned = (conversationId: string, pinned: boolean) => {
    setConversations(current => current.map(conversation => conversation.id === conversationId ? { ...conversation, pinned } : conversation));
  };

  const deleteConversation = (conversation: Conversation) => confirmAction(
    'Delete this chat?',
    `“${conversation.title}” and its messages will be removed from this device for this account.`,
    () => {
      const remaining = conversations.filter(item => item.id !== conversation.id);
      setConversations(remaining);
      if (activeConversationId === conversation.id) {
        setActiveConversationId(remaining[0]?.id ?? null);
        setDraft('');
        setChatError(null);
        setRetryMessage(null);
      }
    },
  );

  const startNewConversation = () => {
    if (isSending) return;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();
    setConversations(current => [{
      id,
      title: 'New chat',
      createdAt: now,
      updatedAt: now,
      messages: [],
    }, ...current]);
    setActiveConversationId(id);
    setDraft('');
    setChatError(null);
    setRetryMessage(null);
    setMemorySuggestionError(null);
  };

  const confirmClear = () => confirmAction(
    'Clear local data?',
    'This removes all chats and memories saved on this device.',
    () => {
      localDataService.clear(owner).then(() => {
        memorySuggestionRequestId.current += 1;
        setMemorySuggestion(null);
        setConversations([]);
        setActiveConversationId(null);
        setMemories([]);
        setRememberInSession(true);
        rememberPreferenceRef.current = true;
        setShareMemories(true);
        setShareChatHistory(true);
        setDraft('');
        setRetryMessage(null);
        setChatError(null);
        setLocalDataError(null);
        setLocalDataSaveError(null);
        setLocalDataReady(true);
      }).catch(error => {
        setLocalDataError(error instanceof Error ? error.message : 'Could not clear local data.');
      });
    },
  );

  const clearUnavailableLocalData = () => confirmAction(
    'Clear local data and start over?',
    'This permanently removes all saved chats and memories for this account from this device.',
    () => {
      localDataService.clear(owner).then(() => {
        memorySuggestionRequestId.current += 1;
        setMemorySuggestion(null);
        setConversations([]);
        setActiveConversationId(null);
        setMemories([]);
        setRememberInSession(true);
        setShareMemories(true);
        setShareChatHistory(true);
        setLocalDataError(null);
        setLocalDataSaveError(null);
        setLocalDataReady(true);
      }).catch(error => {
        setLocalDataError(error instanceof Error ? error.message : 'Could not clear local data.');
      });
    },
  );

  const retryLocalData = async () => {
    setLocalDataError(null);
    setLocalDataSaveError(null);
    if (!localDataReady) {
      setLocalDataRetry(current => current + 1);
      return;
    }
    try {
      await localDataService.save(owner, { conversations, activeConversationId, memories, rememberInSession, shareMemories, shareChatHistory });
    } catch (error) {
      setLocalDataSaveError(error instanceof Error ? error.message : 'Could not save private data on this device.');
    }
  };

  const sendMessage = async (messageToRetry?: string) => {
    const text = messageToRetry ?? draft.trim();
    if (!text || isSending || !localDataReady) return;
    const conversationId = activeConversationId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    if (!activeConversationId) setActiveConversationId(conversationId);

    const userMessage: Message = {
      id: nextMessageId.current = Math.max(Date.now(), nextMessageId.current + 1),
      text,
      author: 'you',
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };

    if (!messageToRetry) appendConversationMessage(conversationId, userMessage);
    if (!messageToRetry) setRetryMessage(null);
    setDraft('');
    setIsSending(true);
    setChatError(null);

    try {
      const history = messageToRetry ? messages.slice(0, -1) : messages;
      const responseText = await gatewayService.sendChatMessage(text, history.map(message => ({
        role: message.author === 'you' ? 'user' : 'assistant',
        content: message.text,
      })), sessionToken, {
        task: 'conversation',
        memories: rememberInSession && shareMemories ? memories.map(memory => memory.text) : [],
        crossChatContext: shareChatHistory
          ? findRelevantChatHistory(conversations, conversationId, text)
          : [],
        crisisConcern: hasCrisisSignal(text)
          || history.slice(-4).some(message => message.author === 'you' && hasCrisisSignal(message.text)),
      });

      const assistantMessage: Message = {
        id: nextMessageId.current = Math.max(Date.now(), nextMessageId.current + 1),
        text: responseText,
        author: 'teddy',
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      };

      appendConversationMessage(conversationId, assistantMessage);
      setRetryMessage(null);
      setMemorySuggestionError(null);
      if (rememberInSession) {
        const suggestionRequestId = ++memorySuggestionRequestId.current;
        gatewayService.suggestMemory(text, sessionToken).then(suggestion => {
          if (!suggestion || suggestionRequestId !== memorySuggestionRequestId.current || !rememberPreferenceRef.current) return;
          const duplicate = memories.some(memory => memory.text.toLowerCase() === suggestion.toLowerCase());
          if (!duplicate) setMemorySuggestion({ conversationId, messageId: assistantMessage.id, fact: suggestion });
        }).catch(error => {
          if (suggestionRequestId === memorySuggestionRequestId.current && rememberPreferenceRef.current) {
            setMemorySuggestionError(error instanceof Error ? error.message : 'Could not check for a memory suggestion.');
          }
        });
      }
    } catch (error) {
      if ((error as { status?: number }).status === 401) {
        try {
          if (!(await browserAuthService.restore())) {
            onLogout();
            return;
          }
        } catch (restoreError) {
          const detail = restoreError instanceof Error ? restoreError.message : 'Your session could not be restored.';
          setChatError(`Your sign-in could not be refreshed. ${detail}`);
          setRetryMessage(text);
          return;
        }
      }
      const message = chatErrorMessage(error);
      setChatError(message);
      setRetryMessage(text);
    } finally {
      setIsSending(false);
    }
  };

  const openCrisisResources = () => {
    Linking.openURL('https://findahelpline.com/').catch(error => {
      const detail = error instanceof Error ? error.message : 'The link could not be opened.';
      setChatError(`Could not open the helpline directory. Visit https://findahelpline.com/ directly. ${detail}`);
    });
  };

  const openPhoneAction = (scheme: 'tel' | 'sms', number: string, failureMessage: string) => {
    Linking.openURL(`${scheme}:${number}`).catch(error => {
      const detail = error instanceof Error ? error.message : 'The phone app could not be opened.';
      setChatError(`${failureMessage} ${detail}`);
    });
  };
  const callEmergencyServices = (number: string) => openPhoneAction('tel', number, `Could not start a call. Dial ${number} from your phone, or use the local emergency number.`);
  const callCrisisHelpline = (number: string) => openPhoneAction('tel', number, `Could not call ${number}. Use the local helpline directory instead.`);
  const textCrisisHelpline = (number: string) => openPhoneAction('sms', number, `Could not open a text message to ${number}. Use the local helpline directory instead.`);
  const openHelplineWebsite = (url: string) => {
    Linking.openURL(url).catch(error => {
      const detail = error instanceof Error ? error.message : 'The website could not be opened.';
      setChatError(`Could not open the official helpline website. Visit ${url} directly. ${detail}`);
    });
  };

  const rootInsetsStyle = { paddingTop: insets.top, paddingBottom: wide ? insets.bottom : 0 };
  return (
    <View style={[styles.root, rootInsetsStyle]}>
      {wide && <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(value => !value)}
        page={page}
        profilePictureUrl={profilePictureUrl}
        onNavigate={setPage}
        onNewConversation={startNewConversation}
        newConversationDisabled={isSending}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onPinConversation={setConversationPinned}
        onDeleteConversation={deleteConversation}
        onSelectConversation={id => {
          if (isSending) return;
          setActiveConversationId(id);
          setPage('chat');
          setDraft('');
          setChatError(null);
          setRetryMessage(null);
        }}
      />}
      <View style={styles.main}>
        <View style={[styles.topbar, !wide && styles.mobileTopbar]}>
          {!wide && <>
            <View style={styles.brandMark}><Image source={teddyBudLogo} style={styles.brandLogo} accessibilityLabel="Teddy Bud" /></View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>Teddy Bud</Text>
              <Text style={styles.brandSub}>{title}</Text>
            </View>
          </>}
          {wide && <Text style={styles.topbarContext}>{title}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel="Open privacy settings" onPress={() => setPage('privacy')} style={[styles.profileButton, profilePictureUrl ? styles.profilePhotoButton : styles.profileTextButton]}>
            {profilePictureUrl ? <ProfileAvatar uri={profilePictureUrl} /> : <Text style={styles.profileInitial}>Privacy</Text>}
          </Pressable>
        </View>

        <View style={styles.contentArea}>
          {localDataError ? <LocalDataError error={localDataError} onRetry={retryLocalData} onClear={clearUnavailableLocalData} /> : !localDataReady || localDataOwner !== owner ? <LocalDataLoading /> : <>
          {localDataSaveError && <LocalDataSaveWarning error={localDataSaveError} onRetry={retryLocalData} />}
          {page === 'chat' && <ChatPage wide={wide} messages={messages} conversationTitle={activeConversation?.title ?? 'A little room to breathe'} onOpenHistory={() => setPage('history')} onOpenCrisisResources={openCrisisResources} emergencyCallOption={emergencyCallOption} crisisHelplineOption={crisisHelplineOption} onCallEmergency={callEmergencyServices} onCallHelpline={callCrisisHelpline} onTextHelpline={textCrisisHelpline} onOpenHelplineWebsite={openHelplineWebsite} onSaveOccasion={fact => {
            const normalized = fact.trim().slice(0, 500);
            if (normalized && !memories.some(memory => memory.text.toLowerCase() === normalized.toLowerCase())) {
              setMemories(current => [{ id: Date.now(), text: normalized, date: 'Added just now' }, ...current]);
            }
          }} memorySuggestion={memorySuggestion?.conversationId === activeConversationId ? memorySuggestion : null} onSaveMemorySuggestion={() => {
            const fact = memorySuggestion?.fact;
            if (fact && rememberPreferenceRef.current) {
              setMemories(current => current.some(memory => memory.text.toLowerCase() === fact.toLowerCase())
                ? current
                : [{ id: Date.now(), text: fact, date: 'Added just now' }, ...current]);
            }
            setMemorySuggestion(null);
          }} onDismissMemorySuggestion={() => setMemorySuggestion(null)} memorySuggestionError={memorySuggestionError} draft={draft} setDraft={setDraft} onSend={sendMessage} onRetry={() => retryMessage && sendMessage(retryMessage)} retryPending={Boolean(retryMessage)} onClear={confirmClear} onNewConversation={startNewConversation} isSending={isSending} chatError={chatError} />}
          {page === 'history' && <ChatHistoryPage
            conversations={conversations}
            activeConversationId={activeConversationId}
            isSending={isSending}
            onBack={() => setPage('chat')}
            onSelect={id => {
              if (isSending) return;
              setActiveConversationId(id);
              setPage('chat');
              setDraft('');
              setChatError(null);
              setRetryMessage(null);
            }}
            onNewConversation={startNewConversation}
          />}
          {page === 'memories' && <MemoriesPage wide={wide} memories={memories} memoryEnabled={rememberInSession} onAdd={() => openMemory()} onEdit={openMemory} onDelete={removeMemory} />}
          {page === 'privacy' && <PrivacyPage wide={wide} rememberInSession={rememberInSession} shareMemories={shareMemories} shareChatHistory={shareChatHistory} onClear={confirmClear} onLogout={onLogout} />}
          </>}
        </View>
        {!wide && <BottomNav page={page} onNavigate={setPage} bottomInset={insets.bottom} />}
      </View>

      <Modal visible={memoryModal} animationType="fade" transparent onRequestClose={() => setMemoryModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTopline}>
              <View style={styles.modalIcon}><Text style={styles.modalIconText}>✳</Text></View>
              <Pressable onPress={() => setMemoryModal(false)} accessibilityRole="button" accessibilityLabel="Close memory editor" style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
            <Text style={styles.modalTitle}>{editing ? 'Edit a memory' : 'Keep a small thing in mind'}</Text>
            <Text style={styles.modalBody}>Add a detail to keep on this device. Saved memories are included with future chats sent to the AI provider.</Text>
            <TextInput autoFocus value={memoryDraft} onChangeText={setMemoryDraft} placeholder="Write a gentle reminder…" placeholderTextColor={C.muted} multiline maxLength={500} style={styles.memoryInput} textAlignVertical="top" />
            <View style={styles.modalActions}>
              <Button label="Cancel" tone="quiet" onPress={() => setMemoryModal(false)} />
              <Button label={editing ? 'Save changes' : 'Add memory'} onPress={saveMemory} disabled={!memoryDraft.trim()} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function chatErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : '';
  if (/Function\s+['"][^'"]+['"]\s*:\s*Not found for account\s+['"][^'"]+['"]/i.test(detail)) {
    return 'The NVIDIA account configured for Teddy Bud cannot access this model yet. Enable Public API Endpoints for that NVIDIA account or configure a key with access, then retry.';
  }
  return detail || 'The conversation service is unavailable right now.';
}

function ConversationHistoryList({ conversations, activeConversationId, disabled, onSelect, onPin, onDelete, collapsed = false }: {
  conversations: Conversation[];
  activeConversationId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onPin?: (id: string, pinned: boolean) => void;
  onDelete?: (conversation: Conversation) => void;
  collapsed?: boolean;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const ordered = [...conversations].sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true) || b.updatedAt.localeCompare(a.updatedAt));
  return conversations.length ? ordered.map(conversation => {
    const latestMessage = conversation.messages[conversation.messages.length - 1];
    return <View key={conversation.id} style={[styles.historyItemWrap, collapsed && styles.historyItemWrapCollapsed]}>
    <View style={[styles.historyItem, conversation.id === activeConversationId && styles.historyItemSelected]}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open chat: ${conversation.title}`}
      accessibilityState={{ selected: conversation.id === activeConversationId }}
      disabled={disabled}
      onPress={() => onSelect(conversation.id)}
      style={({ pressed }) => [
        styles.historyItemOpen,
        collapsed && styles.historyItemOpenCollapsed,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.historyItemCopy, collapsed && styles.historyItemCopyCollapsed]}>
        <Text numberOfLines={1} style={[styles.historyItemTitle, collapsed && styles.historyItemTitleCollapsed]}>{collapsed ? conversation.title.slice(0, 1).toUpperCase() : `${conversation.pinned ? 'Pinned: ' : ''}${conversation.title}`}</Text>
        {!collapsed && <Text numberOfLines={1} style={styles.historyItemPreview}>{latestMessage?.text ?? 'No messages yet'}</Text>}
      </View>
    </Pressable>
    {onPin && onDelete && !collapsed && <Pressable accessibilityRole="button" accessibilityLabel={`Chat options for ${conversation.title}`} accessibilityState={{ expanded: openMenuId === conversation.id }} onPress={() => setOpenMenuId(value => value === conversation.id ? null : conversation.id)} style={({ pressed }) => [styles.chatMenuTrigger, pressed && styles.pressed]}><Text style={styles.chatMenuDots}>•••</Text></Pressable>}
    </View>
    {openMenuId === conversation.id && onPin && onDelete && <View style={styles.chatActionMenu} accessibilityRole="menu">
      <Pressable accessibilityRole="menuitem" onPress={() => { onPin(conversation.id, !conversation.pinned); setOpenMenuId(null); }} style={({ pressed }) => [styles.chatActionItem, pressed && styles.pressed]}><Text style={styles.chatActionText}>{conversation.pinned ? 'Unpin chat' : 'Pin chat'}</Text></Pressable>
      <Pressable accessibilityRole="menuitem" onPress={() => { setOpenMenuId(null); onDelete(conversation); }} style={({ pressed }) => [styles.chatActionItem, styles.chatActionDelete, pressed && styles.pressed]}><Text style={[styles.chatActionText, styles.chatActionDeleteText]}>Delete chat</Text></Pressable>
    </View>}
    </View>;
  }) : <Text style={styles.historyEmpty}>Your chats will appear here as you talk with Teddy Bud.</Text>;
}

function ChatHistoryPage({ conversations, activeConversationId, isSending, onBack, onSelect, onNewConversation }: {
  conversations: Conversation[];
  activeConversationId: string | null;
  isSending: boolean;
  onBack: () => void;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}) {
  return <View style={styles.mobileHistoryPage}>
    <View style={styles.historyPageHeader}>
      <View>
        <Text style={styles.eyebrow}>YOUR SPACE</Text>
        <Text style={styles.pageTitle}>Your chats</Text>
      </View>
      <Button label="Back to chat" onPress={onBack} disabled={isSending} tone="quiet" />
    </View>
    <Button label="New chat" onPress={onNewConversation} disabled={isSending} />
    <ScrollView style={styles.mobileHistoryList} keyboardShouldPersistTaps="handled">
      <ConversationHistoryList conversations={conversations} activeConversationId={activeConversationId} disabled={isSending} onSelect={onSelect} />
    </ScrollView>
  </View>;
}

function LocalDataLoading() {
  return <View style={styles.localLoadingScreen} accessibilityRole="progressbar" accessibilityLabel="Loading your saved chats">
    <Text style={styles.localLoadingTitle}>Opening your saved space…</Text>
    <Text style={styles.localLoadingBody}>Loading data stored on this device.</Text>
    <View style={styles.localLoadingColumn}>
      <View style={styles.skeletonHeading} />
      <View style={[styles.skeletonBubble, styles.skeletonBubbleWide]} />
      <View style={[styles.skeletonBubble, styles.skeletonBubbleShort]} />
      <View style={[styles.skeletonBubble, styles.skeletonBubbleRight]} />
      <View style={styles.skeletonComposer} />
    </View>
  </View>;
}

function LocalDataSaveWarning({ error, onRetry }: { error: string; onRetry: () => void }) {
  return <View accessibilityRole="alert" style={styles.saveWarning}>
    <Text style={styles.saveWarningText}>Your chat is still available, but this change could not be saved. {error}</Text>
    <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.saveWarningButton, pressed && styles.pressed]}>
      <Text style={styles.saveWarningButtonText}>Try again</Text>
    </Pressable>
  </View>;
}

function LocalDataError({ error, onRetry, onClear }: { error: string; onRetry: () => void; onClear: () => void }) {
  return <View style={styles.authScreen}><View style={styles.authCard}><Text style={styles.authTitle}>Your saved space needs attention.</Text><Text style={styles.authBody}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.authButton, pressed && styles.pressed]}><Text style={styles.authButtonText}>Retry local storage</Text></Pressable><Pressable accessibilityRole="button" onPress={onClear} style={styles.authToggle}><Text style={styles.authToggleText}>Clear local data and start over</Text></Pressable><Text style={styles.authFootnote}>Your messages are paused until local storage is available.</Text></View></View>;
}

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert -- native browser confirmation protects destructive local-data deletion.
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: onConfirm },
  ]);
}

function Sidebar({ collapsed, onToggleCollapsed, page, profilePictureUrl, onNavigate, onNewConversation, newConversationDisabled, conversations, activeConversationId, onSelectConversation, onPinConversation, onDeleteConversation }: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  page: Page;
  profilePictureUrl?: string;
  onNavigate: (page: Page) => void;
  onNewConversation: () => void;
  newConversationDisabled: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onPinConversation: (id: string, pinned: boolean) => void;
  onDeleteConversation: (conversation: Conversation) => void;
}) {
  const sidebarWidth = useRef(new Animated.Value(collapsed ? 78 : 258)).current;
  const sidebarPadding = sidebarWidth.interpolate({ inputRange: [78, 258], outputRange: [10, 18] });
  const chevronProgress = useRef(new Animated.Value(collapsed ? 1 : 0)).current;
  const chevronRotation = chevronProgress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const reduceMotion = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      reduceMotion.current = preference.matches;
      const updatePreference = (event: MediaQueryListEvent) => { reduceMotion.current = event.matches; };
      preference.addEventListener('change', updatePreference);
      return () => preference.removeEventListener('change', updatePreference);
    }

    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted) reduceMotion.current = enabled;
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      reduceMotion.current = enabled;
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const width = collapsed ? 78 : 258;
    if (reduceMotion.current) {
      sidebarWidth.setValue(width);
      chevronProgress.setValue(collapsed ? 1 : 0);
      return;
    }
    Animated.timing(sidebarWidth, {
      toValue: width,
      duration: 360,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.timing(chevronProgress, {
      toValue: collapsed ? 1 : 0,
      duration: 180,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [collapsed, sidebarWidth, chevronProgress]);

  return (
    <Animated.View style={[styles.sidebar, { width: sidebarWidth, paddingHorizontal: sidebarPadding }]}>
      <View style={[styles.sidebarBrand, collapsed && styles.sidebarBrandCollapsed]}>
        <View style={[styles.sidebarIdentity, collapsed && styles.sidebarIdentityCollapsed]}>
          <View style={styles.brandMark}><Image source={teddyBudLogo} style={styles.brandLogo} accessibilityLabel="Teddy Bud" /></View>
          {!collapsed && <View><Text style={styles.brandName}>Teddy Bud</Text><Text style={styles.sidebarCaption}>A little room to breathe</Text></View>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} accessibilityHint={collapsed ? 'Show chat names and navigation labels' : 'Hide labels and keep the icon rail visible'} onPress={onToggleCollapsed} style={({ pressed }) => [styles.sidebarCollapseButton, collapsed && styles.sidebarCollapseButtonCollapsed, pressed && styles.pressed]}><Animated.Text style={[styles.sidebarCollapseGlyph, { transform: [{ rotate: chevronRotation }] }]}>‹</Animated.Text></Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Start a new chat" accessibilityHint={collapsed ? 'Start a new conversation' : undefined} disabled={newConversationDisabled} onPress={onNewConversation} style={({ pressed }) => [styles.newChatButton, collapsed && styles.newChatButtonCollapsed, newConversationDisabled && styles.buttonDisabled, pressed && styles.pressed]}>
        <Text style={styles.newChatGlyph}>＋</Text>{!collapsed && <Text style={styles.newChatLabel}>New chat</Text>}
      </Pressable>
      {!collapsed && <Text style={styles.sidebarLabel}>YOUR SPACE</Text>}
      {navItems.map(item => <NavButton key={item.id} item={item} selected={item.id === page} collapsed={collapsed} onPress={() => onNavigate(item.id)} />)}
      {!collapsed && <Text style={styles.sidebarLabel}>CHATS</Text>}
      <ScrollView style={[styles.sidebarChatList, collapsed && styles.sidebarChatListCollapsed]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={!collapsed} showsHorizontalScrollIndicator={false}>
        <ConversationHistoryList
          conversations={conversations}
          activeConversationId={activeConversationId}
          disabled={newConversationDisabled}
          onSelect={onSelectConversation}
          onPin={onPinConversation}
          onDelete={onDeleteConversation}
          collapsed={collapsed}
        />
      </ScrollView>
      <View style={styles.sidebarBottom}>
        <View style={styles.sidebarRule} />
        <Pressable accessibilityRole="button" accessibilityLabel="Open privacy and settings" accessibilityHint={collapsed ? 'Open privacy and settings' : undefined} onPress={() => onNavigate('privacy')} style={({ pressed }) => [styles.accountCard, collapsed && styles.accountCardCollapsed, pressed && styles.pressed]}>
          <ProfileAvatar uri={profilePictureUrl} />
          {!collapsed && <View style={styles.accountCopy}><Text style={styles.accountTitle}>Your private space</Text><Text style={styles.accountSubtitle}>Privacy & settings</Text></View>}
          {!collapsed && <Text style={styles.accountArrow}>›</Text>}
        </Pressable>
      </View>
    </Animated.View>
  );
}

function ProfileAvatar({ uri }: { uri?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return <View style={styles.accountAvatar}>
    {uri && !failed
      ? <Image source={{ uri }} style={styles.accountAvatarImage} accessibilityLabel="Google profile photo" onError={() => setFailed(true)} />
      : <Text style={styles.accountAvatarText}>TB</Text>}
  </View>;
}

function NavButton({ item, selected, onPress, collapsed = false }: { item: (typeof navItems)[number]; selected: boolean; onPress: () => void; collapsed?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={item.label} accessibilityHint={collapsed ? `Open ${item.label}` : undefined} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.navButton, collapsed && styles.navButtonCollapsed, selected && styles.navButtonSelected, pressed && styles.pressed]}>
    <Text style={[styles.navIcon, selected && styles.navIconSelected]}>{item.icon}</Text>{!collapsed && <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{item.label}</Text>}
    {selected && !collapsed && <View style={styles.navDot} />}
  </Pressable>;
}

function BottomNav({ page, onNavigate, bottomInset }: { page: Page; onNavigate: (page: Page) => void; bottomInset: number }) {
  return <View style={[styles.bottomNav, { paddingBottom: Math.max(bottomInset, 8) }]}>{navItems.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: item.id === page }} onPress={() => onNavigate(item.id)} style={styles.bottomNavItem}>
    <Text style={[styles.bottomIcon, item.id === page && styles.bottomIconActive]}>{item.icon}</Text><Text style={[styles.bottomLabel, item.id === page && styles.bottomLabelActive]}>{item.label}</Text>
  </Pressable>)}</View>;
}

export function ChatPage({ wide, messages, conversationTitle, onOpenHistory, onOpenCrisisResources, emergencyCallOption, crisisHelplineOption, onCallEmergency, onCallHelpline, onTextHelpline, onOpenHelplineWebsite, onSaveOccasion, memorySuggestion, onSaveMemorySuggestion, onDismissMemorySuggestion, memorySuggestionError, draft, setDraft, onSend, onRetry, retryPending, onClear, onNewConversation, isSending, chatError }: { wide: boolean; messages: Message[]; conversationTitle: string; onOpenHistory: () => void; onOpenCrisisResources: () => void; emergencyCallOption: EmergencyCallOption | null; crisisHelplineOption: CrisisHelplineOption | null; onCallEmergency: (number: string) => void; onCallHelpline: (number: string) => void; onTextHelpline: (number: string) => void; onOpenHelplineWebsite: (url: string) => void; onSaveOccasion?: (fact: string) => void; memorySuggestion: MemorySuggestion | null; onSaveMemorySuggestion: () => void; onDismissMemorySuggestion: () => void; memorySuggestionError: string | null; draft: string; setDraft: (value: string) => void; onSend: () => void; onRetry: () => void; retryPending: boolean; onClear: () => void; onNewConversation: () => void; isSending: boolean; chatError: string | null }) {
  const canSend = !!draft.trim() && !isSending;
  const [composerFocused, setComposerFocused] = useState(false);
  const [manualCrisisSupport, setManualCrisisSupport] = useState(false);
  const [occasionOpen, setOccasionOpen] = useState(false);
  const [occasionDraft, setOccasionDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const hasSafetyConcern = messages.some(message => message.author === 'you' && hasCrisisSignal(message.text));
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [messages.length, isSending]);
  return <KeyboardAvoidingView style={styles.chatPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[styles.chatHeader, wide && styles.chatHeaderWide]}>
      <View style={styles.chatHeaderCopy}><Text style={styles.eyebrow}>YOUR SPACE</Text><Text style={styles.pageTitle} numberOfLines={1}>{conversationTitle}</Text></View>
      <View style={styles.headerActions}>
        {!wide && <Pressable accessibilityRole="button" accessibilityLabel="View chats" onPress={onOpenHistory} style={({ pressed }) => [styles.headerTextButton, pressed && styles.pressed]}><Text style={styles.headerActionLabel}>Chats</Text></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel="Clear local data" onPress={onClear} style={({ pressed }) => [styles.headerTextButton, pressed && styles.pressed]}><Text style={styles.headerActionLabel}>Clear data</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Start a new chat" disabled={isSending} onPress={onNewConversation} style={({ pressed }) => [styles.headerNewChat, isSending && styles.buttonDisabled, pressed && styles.pressed]}><Text style={styles.headerNewChatLabel}>New chat</Text></Pressable>
      </View>
    </View>
    <ScrollView ref={scrollRef} style={styles.chatScroll} contentContainerStyle={[styles.chatContent, wide && styles.chatContentWide, messages.length === 0 && styles.emptyContent]} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
      {messages.length === 0 ? <View style={styles.emptyState}>
        <View style={styles.emptyHeroMark}><Image source={teddyBudLogo} style={styles.emptyHeroLogo} accessibilityLabel="Teddy Bud" /></View>
        <Text style={styles.emptyGreeting}>What’s on your mind?</Text>
        <Text style={styles.emptyDescription}>A calm space to talk things through, find a little perspective, or simply be heard.</Text>
        <View style={styles.starterGrid}>
          <StarterCard wide={wide} icon="↗" title="Talk it out" description="Something’s been on your mind" onPress={() => setDraft('There’s something on my mind I’d like to talk through.')} />
          <StarterCard wide={wide} icon="☼" title="Find a little calm" description="Take a moment to slow down" onPress={() => setDraft('I could use a moment to slow down and unwind.')} />
          <StarterCard wide={wide} icon="✳" title="Celebrate a win" description="Make space for something good" onPress={() => setDraft('I want to share a small win from today.')} />
        </View>
      </View> : <View style={styles.conversationColumn}>
        <View style={styles.dayDivider}><View style={styles.dividerLine} /><Text style={styles.dayText}>TODAY</Text><View style={styles.dividerLine} /></View>
        {messages.map(message => <View key={message.id}>
          <View style={[styles.messageRow, message.author === 'you' && styles.messageRowYou]}>
            {message.author === 'teddy' && <Image source={teddyBudLogo} style={[styles.teddyAvatarSmall, styles.teddyAvatarImage]} accessibilityLabel="Teddy Bud" />}
            <View style={[styles.messageBubble, message.author === 'you' ? styles.userBubble : styles.teddyBubble]}><Text style={[styles.messageText, message.author === 'you' && styles.userMessageText]}>{message.text}</Text><Text style={[styles.messageTime, message.author === 'you' && styles.userMessageTime]}>{message.time}</Text></View>
          </View>
          {message.author === 'teddy' && memorySuggestion?.messageId === message.id && <MemorySuggestionCard fact={memorySuggestion.fact} onSave={onSaveMemorySuggestion} onDismiss={onDismissMemorySuggestion} />}
        </View>)}
        {isSending && <View style={styles.sendingRow}><Image source={teddyBudLogo} style={[styles.teddyAvatarSmall, styles.teddyAvatarImage]} accessibilityLabel="Teddy Bud" /><TypingIndicator /></View>}
        {chatError && <View style={styles.errorBanner}><Text style={styles.errorText}>{chatError}</Text>{retryPending && <Pressable accessibilityRole="button" onPress={onRetry} disabled={isSending} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></Pressable>}</View>}
        {memorySuggestionError && <Text accessibilityRole="alert" style={styles.memorySuggestionError}>{memorySuggestionError}</Text>}
      </View>}
      {(hasSafetyConcern || manualCrisisSupport) && <CrisisSupport emergencyCallOption={emergencyCallOption} crisisHelplineOption={crisisHelplineOption} onCallEmergency={onCallEmergency} onCallHelpline={onCallHelpline} onTextHelpline={onTextHelpline} onOpenHelplineWebsite={onOpenHelplineWebsite} onOpenResources={onOpenCrisisResources} onDismiss={hasSafetyConcern ? undefined : () => setManualCrisisSupport(false)} />}
      {occasionOpen && <OccasionWidget value={occasionDraft} onChange={setOccasionDraft} onSave={() => {
        const value = occasionDraft.trim();
        if (!value) return;
        onSaveOccasion?.(value);
        setOccasionOpen(false);
        setOccasionDraft('');
      }} onDismiss={() => { setOccasionOpen(false); setOccasionDraft(''); }} />}
    </ScrollView>
    <View style={[styles.composerWrap, wide && styles.composerWrapWide]}>
      <View style={styles.chatTools}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open crisis support" onPress={() => setManualCrisisSupport(true)} style={({ pressed }) => [styles.chatToolButton, pressed && styles.pressed]}>
          <Text style={styles.chatToolIcon}>♡</Text><Text style={styles.chatToolLabel}>Crisis support</Text>
        </Pressable>
        {onSaveOccasion && <Pressable accessibilityRole="button" accessibilityLabel="Save an occasion" onPress={() => { setOccasionDraft(''); setOccasionOpen(true); }} style={({ pressed }) => [styles.chatToolButton, pressed && styles.pressed]}>
          <Text style={styles.chatToolIcon}>✳</Text><Text style={styles.chatToolLabel}>Save an occasion</Text>
        </Pressable>}
      </View>
      <View style={[styles.composerCard, composerFocused && styles.composerCardFocused]}>
        <TextInput value={draft} onChangeText={setDraft} onFocus={() => setComposerFocused(true)} onBlur={() => setComposerFocused(false)} onSubmitEditing={() => onSend()} enterKeyHint="send" blurOnSubmit={Platform.OS === 'web'} placeholder="Message Teddy Bud…" placeholderTextColor={C.muted} multiline style={styles.composerInput} accessibilityLabel="Write a message" {...(Platform.OS === 'web' ? { dataSet: { gramm: 'false' } } as Record<string, unknown> : {})} />
        <Pressable accessibilityRole="button" accessibilityLabel="Send message" onPress={() => onSend()} disabled={!canSend} style={({ pressed }) => [styles.sendButton, canSend && styles.sendButtonActive, !canSend && styles.sendButtonDisabled, pressed && styles.pressed]}><PaperPlaneIcon /></Pressable>
      </View>
      {wide && <Text style={styles.composerFootnote}>{isSending ? 'Sending to the companion service…' : 'Your conversation is saved on this device.'}</Text>}
    </View>
  </KeyboardAvoidingView>;
}

function CrisisSupport({ emergencyCallOption, crisisHelplineOption, onCallEmergency, onCallHelpline, onTextHelpline, onOpenHelplineWebsite, onOpenResources, onDismiss }: { emergencyCallOption: EmergencyCallOption | null; crisisHelplineOption: CrisisHelplineOption | null; onCallEmergency: (number: string) => void; onCallHelpline: (number: string) => void; onTextHelpline: (number: string) => void; onOpenHelplineWebsite: (url: string) => void; onOpenResources: () => void; onDismiss?: () => void }) {
  return <View accessibilityRole="alert" style={styles.crisisSupport}>
    {onDismiss && <Pressable accessibilityRole="button" accessibilityLabel="Close crisis support" onPress={onDismiss} style={styles.widgetDismiss}><Text style={styles.widgetDismissText}>Close</Text></Pressable>}
    <Text style={styles.crisisSupportTitle}>Immediate support is available</Text>
    <Text style={styles.crisisSupportBody}>If you or someone else may be in immediate danger, or has already been hurt or taken something, contact local emergency services or go to the nearest emergency department now. If it is safe, stay with someone you trust and move away from anything that could cause harm.</Text>
    {emergencyCallOption && <Pressable accessibilityRole="link" accessibilityLabel={`Call emergency services at ${emergencyCallOption.number} for ${emergencyCallOption.region}`} onPress={() => onCallEmergency(emergencyCallOption.number)} style={({ pressed }) => [styles.crisisCallLink, pressed && styles.pressed]}>
      <Text style={styles.crisisCallLinkText}>Call {emergencyCallOption.number} · {emergencyCallOption.region}</Text>
    </Pressable>}
    {crisisHelplineOption && <>
      <Text style={styles.crisisHelplineTitle}>{crisisHelplineOption.name} · {crisisHelplineOption.region}</Text>
      <View style={styles.crisisHelplineActions}>
        <Pressable accessibilityRole="link" accessibilityLabel={`Call ${crisisHelplineOption.number} ${crisisHelplineOption.name}`} onPress={() => onCallHelpline(crisisHelplineOption.number)} style={({ pressed }) => [styles.crisisCallLink, pressed && styles.pressed]}>
          <Text style={styles.crisisCallLinkText}>Call {crisisHelplineOption.number}</Text>
        </Pressable>
        {crisisHelplineOption.alternateCall && <Pressable accessibilityRole="link" accessibilityLabel={`Call ${crisisHelplineOption.alternateCall.label} ${crisisHelplineOption.name}`} onPress={() => {
          const alternateCall = crisisHelplineOption.alternateCall;
          if (alternateCall) onCallHelpline(alternateCall.number);
        }} style={({ pressed }) => [styles.crisisCallLink, pressed && styles.pressed]}>
          <Text style={styles.crisisCallLinkText}>Call {crisisHelplineOption.alternateCall.label}</Text>
        </Pressable>}
        {crisisHelplineOption.textNumber && <Pressable accessibilityRole="link" accessibilityLabel={`Text ${crisisHelplineOption.textNumber} ${crisisHelplineOption.name}`} onPress={() => {
          const textNumber = crisisHelplineOption.textNumber;
          if (textNumber) onTextHelpline(textNumber);
        }} style={({ pressed }) => [styles.crisisCallLink, pressed && styles.pressed]}>
          <Text style={styles.crisisCallLinkText}>Text {crisisHelplineOption.textNumber}</Text>
        </Pressable>}
      </View>
      <Pressable accessibilityRole="link" accessibilityLabel={`Visit official ${crisisHelplineOption.name} website`} onPress={() => onOpenHelplineWebsite(crisisHelplineOption.website)} style={({ pressed }) => [styles.crisisSupportLink, pressed && styles.pressed]}>
        <Text style={styles.crisisSupportLinkText}>Official {crisisHelplineOption.name} information</Text>
      </Pressable>
    </>}
    <Pressable accessibilityRole="link" accessibilityLabel="Find a crisis helpline in your country" onPress={onOpenResources} style={({ pressed }) => [styles.crisisSupportLink, pressed && styles.pressed]}>
      <Text style={styles.crisisSupportLinkText}>Find a crisis helpline in your country</Text>
    </Pressable>
    <Text style={styles.crisisSupportFootnote}>{emergencyCallOption || crisisHelplineOption ? `These options use your device region (${crisisHelplineOption?.region ?? emergencyCallOption?.region}); if you are elsewhere, use the local emergency number and support services.` : 'No call number is configured for this device region. Use your local emergency number or the helpline directory.'} Teddy Bud is not emergency care.</Text>
  </View>;
}

function MemorySuggestionCard({ fact, onSave, onDismiss }: { fact: string; onSave: () => void; onDismiss: () => void }) {
  return <View accessibilityRole="summary" style={styles.memorySuggestionCard}>
    <Text style={styles.memorySuggestionTitle}>Would you like Teddy Bud to remember this?</Text>
    <Text style={styles.memorySuggestionFact}>{fact}</Text>
    <Text style={styles.memorySuggestionBody}>Nothing is saved unless you approve. Saved memories stay on this device and are included with future chats sent to the AI provider.</Text>
    <View style={styles.memorySuggestionActions}>
      <Button label="Not now" tone="quiet" onPress={onDismiss} />
      <Button label="Add to memories" onPress={onSave} />
    </View>
  </View>;
}

function OccasionWidget({ value, onChange, onSave, onDismiss }: { value: string; onChange: (value: string) => void; onSave: () => void; onDismiss: () => void }) {
  return <View accessibilityRole="summary" style={styles.occasionWidget}>
    <Text style={styles.occasionTitle}>Save a good moment</Text>
    <Text style={styles.occasionDescription}>Write a happy memory or occasion you’d like Teddy Bud to remember. Review it before saving.</Text>
    <TextInput value={value} onChangeText={onChange} placeholder="What would you like to remember?" placeholderTextColor={C.muted} multiline maxLength={500} style={styles.occasionInput} accessibilityLabel="Memory to save" textAlignVertical="top" />
    <Text style={styles.occasionPrivacy}>Saved on this device and included with future chats sent to the AI provider.</Text>
    <View style={styles.memorySuggestionActions}>
      <Button label="Cancel" tone="quiet" onPress={onDismiss} />
      <Button label="Save memory" onPress={onSave} disabled={!value.trim()} />
    </View>
  </View>;
}

function PaperPlaneIcon() {
  return <Text accessibilityElementsHidden style={[styles.sendArrow, { transform: [{ scaleX: -1 }] }]}>➤</Text>;
}

function TypingIndicator() {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => {
      if (mounted) setReduceMotion(false);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web' || reduceMotion) return;
    const animations = dots.map((dot, index) => Animated.loop(Animated.sequence([
      Animated.delay(index * 150),
      Animated.timing(dot, { toValue: 1, duration: 240, useNativeDriver: false }),
      Animated.timing(dot, { toValue: 0, duration: 240, useNativeDriver: false }),
      Animated.delay((dots.length - index - 1) * 150),
    ])));
    animations.forEach(animation => animation.start());
    return () => animations.forEach(animation => animation.stop());
  }, [dots, reduceMotion]);

  return <View accessibilityRole="progressbar" accessibilityLabel="Teddy Bud is responding" accessibilityLiveRegion="polite" style={styles.typingIndicator}>
    {dots.map((dot, index) => Platform.OS === 'web'
      ? <View key={index} {...({ dataSet: { typingDot: 'true' } } as Record<string, unknown>)} style={styles.typingDot} />
      : reduceMotion ? <View key={index} style={styles.typingDot} /> : <Animated.View
        key={index}
        style={[styles.typingDot, { transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }]}
      />)}
  </View>;
}

function StarterCard({ icon, title, description, onPress, wide }: { icon: string; title: string; description: string; onPress: () => void; wide: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${description}`} onPress={onPress} style={({ pressed }) => [styles.starterCard, !wide && styles.starterCardMobile, pressed && styles.starterCardPressed]}>
    <View style={styles.starterIcon}><Text style={styles.starterIconText}>{icon}</Text></View>
    <View style={styles.starterCopy}><Text style={styles.starterTitle}>{title}</Text><Text style={styles.starterDescription}>{description}</Text></View>
    <Text style={styles.starterArrow}>↗</Text>
  </Pressable>;
}

function MemoriesPage({ wide, memories, memoryEnabled, onAdd, onEdit, onDelete }: { wide: boolean; memories: Memory[]; memoryEnabled: boolean; onAdd: () => void; onEdit: (memory: Memory) => void; onDelete: (memory: Memory) => void }) {
  return <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]}>
    <View style={styles.pageIntro}><Text style={styles.eyebrow}>THE THINGS THAT MATTER</Text><Text style={styles.pageTitle}>Your memories</Text><Text style={styles.pageDescription}>Little details you choose to keep close. You can change or forget any of them, whenever you like.</Text></View>
    <View style={styles.memoryNotice}><View style={styles.noticeIcon}><Text style={styles.noticeGlyph}>⌑</Text></View><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>{memoryEnabled ? 'Saved on this device' : 'Saved memories are off'}</Text><Text style={styles.noticeBody}>{memoryEnabled ? 'Memories stay in this app’s local database across restarts and are included with future chats sent to the AI provider.' : 'Turn on “Keep memories on this device” in Privacy settings to add memories.'}</Text></View></View>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>SAVED MEMORIES <Text style={styles.countText}>{memories.length}</Text></Text><Pressable accessibilityRole="button" accessibilityLabel="Add a memory" disabled={!memoryEnabled} onPress={onAdd} style={styles.addLink}><Text style={[styles.addLinkText, !memoryEnabled && styles.disabledText]}>{memoryEnabled ? 'Add a memory' : 'Memory is off'}</Text></Pressable></View>
    {memories.length ? memories.map(memory => <View key={memory.id} style={styles.memoryCard}><View style={styles.memoryMark}><Text style={styles.memoryMarkText}>✳</Text></View><View style={styles.memoryCopy}><Text style={styles.memoryText}>{memory.text}</Text><Text style={styles.memoryDate}>{memory.date}</Text></View><View style={styles.memoryActions}><Pressable accessibilityRole="button" accessibilityLabel="Edit memory" onPress={() => onEdit(memory)} style={styles.memoryActionTextButton}><Text style={styles.memoryActionText}>Edit</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Forget memory" onPress={() => onDelete(memory)} style={styles.memoryActionTextButton}><Text style={styles.memoryActionText}>Forget</Text></Pressable></View></View>) : <View style={styles.emptyCard}><View style={styles.emptyMark}><Text style={styles.emptyGlyph}>✳</Text></View><Text style={styles.emptyTitle}>{memoryEnabled ? 'A fresh page' : 'Memories are off'}</Text><Text style={styles.emptyBody}>{memoryEnabled ? 'Nothing saved right now. Add a small detail you’d like to hold onto.' : 'Turn on “Keep memories on this device” in Privacy settings when you are ready.'}</Text>{memoryEnabled && <Button label="Add your first memory" onPress={onAdd} />}</View>}
    {!!memories.length && <Text style={styles.memoriesFootnote}>Your memories are yours. Edit them, remove them, or clear local data from this device at any time.</Text>}
  </ScrollView>;
}

function PrivacyPage({ wide, rememberInSession, shareMemories, shareChatHistory, onClear, onLogout }: { wide: boolean; rememberInSession: boolean; shareMemories: boolean; shareChatHistory: boolean; onClear: () => void; onLogout: () => void }) {
  return <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]}>
    <View style={styles.pageIntro}><Text style={styles.eyebrow}>YOUR CHOICES, ALWAYS</Text><Text style={styles.pageTitle}>Privacy & settings</Text><Text style={styles.pageDescription}>A few clear controls for what happens in your space.</Text></View>
    <View style={styles.privacyBanner}><View style={styles.privacyShield}><Text style={styles.shieldGlyph}>⌑</Text></View><View style={styles.privacyCopy}><Text style={styles.privacyTitle}>Memory & context are always on</Text><Text style={styles.privacyBody}>{Platform.OS === 'web' ? 'Chat history and saved memories are stored in this browser’s local database, which is not encrypted by Teddy Bud. Messages you send are sent to the configured AI gateway.' : 'Chat history and saved memories are stored in an encrypted local database on this device. Its encryption key is held in platform secure storage. Messages you send are sent to the configured AI gateway.'} Each chat may include your saved memories and a few relevant excerpts from other chats, which are sent to the configured AI provider.</Text></View></View>
    <Text style={styles.settingsSectionLabel}>MEMORY & CONTEXT</Text>
    <View style={styles.settingsCard}>
      <SettingRow icon="✳" title="Keep memories on this device" description="Save memories locally across app restarts. This setting stays on." value={rememberInSession} lockedOn />
      <View style={styles.settingSeparator} />
      <SettingRow icon="↗" title="Share relevant memories" description="Your saved memory notes are sent with chat messages to the AI provider. This setting stays on." value={shareMemories} lockedOn />
      <View style={styles.settingSeparator} />
      <SettingRow icon="⌕" title="Use other chats for context" description="A few relevant excerpts are selected on this device and sent with your message to help Teddy Bud remember earlier chats. This setting stays on." value={shareChatHistory} lockedOn />
    </View>
    <Text style={styles.settingsSectionLabel}>DATA</Text>
    <View style={styles.settingsCard}>
      <View style={styles.clearRow}><View style={styles.clearIcon}><Text style={styles.clearGlyph}>⌫</Text></View><View style={styles.settingText}><Text style={styles.settingTitle}>Clear local data</Text><Text style={styles.settingDescription}>Remove saved chat history and memories from this device.</Text></View><Pressable accessibilityRole="button" onPress={onClear} style={styles.clearButton}><Text style={styles.clearButtonText}>Clear</Text></Pressable></View>
    </View>
    <View style={styles.settingsCard}><View style={styles.clearRow}><View style={styles.settingText}><Text style={styles.settingTitle}>Sign out</Text><Text style={styles.settingDescription}>Remove this device registration and secure session.</Text></View><Pressable accessibilityRole="button" onPress={onLogout} style={styles.clearButton}><Text style={styles.clearButtonText}>Sign out</Text></Pressable></View></View>
    <Text style={styles.versionText}>Teddy Bud  ·  Private by design</Text>
  </ScrollView>;
}

function SettingRow({ icon, title, description, value, lockedOn = false }: { icon: string; title: string; description: string; value: boolean; lockedOn?: boolean }) {
  return <View style={styles.settingRow}><View style={styles.settingIcon}><Text style={styles.settingGlyph}>{icon}</Text></View><View style={styles.settingText}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDescription}>{description}</Text></View><Pressable accessibilityRole="switch" accessibilityState={{ checked: value, disabled: lockedOn }} accessibilityLabel={title} disabled={lockedOn} style={[styles.switchTrack, value && styles.switchOn]}><View style={[styles.switchThumb, value && styles.switchThumbOn]} /></Pressable></View>;
}

function Button({ label, onPress, tone = 'primary', disabled = false }: { label: string; onPress: () => void; tone?: 'primary' | 'quiet'; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, tone === 'quiet' && styles.buttonQuiet, disabled && styles.buttonDisabled, pressed && styles.pressed]}><Text style={[styles.buttonText, tone === 'quiet' && styles.buttonTextQuiet]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  teddyAvatarImage: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#FAF6ED', borderWidth: 1, borderColor: '#E8E0D5' },
  fatalFallback: { flex: 1, minHeight: '100%', alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.canvas },
  fatalTitle: { color: C.ink, fontSize: 22, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  fatalBody: { maxWidth: 360, color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  fatalButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 12, backgroundColor: C.cocoa, marginTop: 20 },
  fatalButtonText: { color: C.white, fontSize: 12, fontWeight: '700' },
  saveWarning: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 16, padding: 12, backgroundColor: '#FFF3E8', borderWidth: 1, borderColor: '#E9D2BB', borderRadius: 12 },
  saveWarningText: { flex: 1, color: '#704F39', fontSize: 11, lineHeight: 16 },
  saveWarningButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 9, backgroundColor: C.paper },
  saveWarningButtonText: { color: C.cocoa, fontSize: 11, fontWeight: '700' },
  authInput: { height: 50, borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: '#FDFCFA', paddingHorizontal: 14, color: C.ink, fontSize: 13, marginBottom: 10 },
  authPasswordRow: { height: 50, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: '#FDFCFA', marginBottom: 14 },
  authPasswordInput: { flex: 1, height: '100%', paddingHorizontal: 14, color: C.ink, fontSize: 13 },
  showPasswordButton: { minWidth: 55, height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  showPasswordText: { color: C.cocoa, fontSize: 11, fontWeight: '700' },
  googleAuthButton: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  googleAuthButtonText: { color: C.ink, fontSize: 13, fontWeight: '700' },
  authDivider: { color: C.muted, fontSize: 9, letterSpacing: 1.2, textAlign: 'center', marginVertical: 16 },
  authToggle: { alignSelf: 'center', minHeight: 38, justifyContent: 'center', marginTop: 8 },
  authToggleText: { color: C.cocoa, fontSize: 11, fontWeight: '700' },
  authScreen: { flex: 1, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center', padding: 24 }, authCard: { width: '100%', maxWidth: 440, backgroundColor: C.paper, borderRadius: 28, padding: 30, borderWidth: 1, borderColor: C.line }, authMark: { width: 56, height: 56, borderRadius: 20, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }, authLogo: { width: 56, height: 56, borderRadius: 20 }, authEyebrow: { color: C.cocoa, fontSize: 10, letterSpacing: 2, fontWeight: '800', marginBottom: 10 }, authTitle: { color: C.ink, fontSize: 30, lineHeight: 37, fontWeight: '600', letterSpacing: -0.9, textAlign: 'center' }, authBody: { color: C.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 12, marginBottom: 24 }, authButton: { minHeight: 52, borderRadius: 16, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, authButtonText: { color: C.white, fontSize: 13, fontWeight: '700' }, authFootnote: { color: '#9A8E82', fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 14 }, authError: { backgroundColor: '#FCE9E3', borderRadius: 12, padding: 11, marginBottom: 14 }, authErrorText: { color: '#8D473F', fontSize: 12, lineHeight: 16, textAlign: 'center' },
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.canvas }, main: { flex: 1, minWidth: 0 },
  newChatButton: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#D8D7D1', backgroundColor: '#FFFFFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 30, shadowColor: '#302821', shadowOpacity: 0.035, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1 }, newChatButtonCollapsed: { paddingHorizontal: 0, justifyContent: 'center' }, newChatGlyph: { color: C.cocoa, fontSize: 20, lineHeight: 23 }, newChatLabel: { color: C.ink, fontSize: 13, fontWeight: '600' },
  headerNewChat: { minHeight: 38, paddingHorizontal: 11, borderRadius: 13, backgroundColor: '#F1F1EE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, headerNewChatGlyph: { color: C.cocoa, fontSize: 18, lineHeight: 22 }, headerNewChatLabel: { color: C.ink, fontSize: 11, fontWeight: '600' },
  accountCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderRadius: 14 }, accountCardCollapsed: { justifyContent: 'center', paddingHorizontal: 0 }, accountAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E4DDD4', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, accountAvatarImage: { width: 34, height: 34 }, accountAvatarText: { color: C.cocoaDark, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }, accountCopy: { flex: 1 }, accountTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, accountSubtitle: { color: C.muted, fontSize: 11, marginTop: 3 }, accountArrow: { color: '#938A80', fontSize: 22 },
  sidebar: { width: 258, minWidth: 0, flexShrink: 0, overflow: 'hidden', backgroundColor: '#F3F2EF', borderRightWidth: 1, borderRightColor: '#E9E8E4', paddingHorizontal: 18, paddingTop: 24, paddingBottom: 16 }, sidebarCollapseButton: { width: 34, height: 34, borderRadius: 11, marginLeft: 'auto', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAE8E3' }, sidebarCollapseButtonCollapsed: { marginLeft: 0 }, sidebarCollapseGlyph: { color: C.cocoa, fontSize: 23, lineHeight: 25, fontWeight: '500' },
  sidebarBrand: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 24, minWidth: 0 }, sidebarBrandCollapsed: { flexDirection: 'column', gap: 10, marginBottom: 20, width: '100%' }, sidebarIdentity: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }, sidebarIdentityCollapsed: { flex: 0 }, brandMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: C.cocoa, justifyContent: 'center', alignItems: 'center' }, brandLogo: { width: 42, height: 42, borderRadius: 15 }, brandMarkText: { color: '#FFF9F3', fontSize: 18, fontWeight: '700', letterSpacing: -1 }, brandCopy: { justifyContent: 'center' }, brandName: { color: C.ink, fontSize: 16, letterSpacing: -0.4, fontWeight: '700' }, sidebarCaption: { color: C.muted, fontSize: 12, marginTop: 2 }, sidebarLabel: { color: '#96948D', fontSize: 10, letterSpacing: 1.3, fontWeight: '700', marginBottom: 10, marginLeft: 12 },
  navButton: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 11, minWidth: 0 }, navButtonCollapsed: { justifyContent: 'center', paddingHorizontal: 0 }, navButtonSelected: { backgroundColor: '#E7E5E0' }, navIcon: { width: 22, textAlign: 'center', fontSize: 19, color: '#887C71' }, navIconSelected: { color: C.cocoa }, navLabel: { color: '#756A60', fontSize: 13, fontWeight: '500', flex: 1 }, navLabelSelected: { color: C.cocoaDark, fontWeight: '700' }, navDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.cocoa },
  sidebarBottom: { marginTop: 'auto' }, sidebarRule: { height: 1, backgroundColor: '#E2D9CD', marginBottom: 20 }, localNoteIcon: { width: 32, height: 32, backgroundColor: '#E7E5E0', borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, localNoteGlyph: { color: C.cocoa, fontSize: 17 }, localNoteTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginBottom: 5 }, localNoteBody: { color: C.muted, fontSize: 11, lineHeight: 17 },
  topbar: { height: 66, borderBottomWidth: 1, borderBottomColor: '#ECEBE7', paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', backgroundColor: C.paper }, mobileTopbar: { height: 64, paddingHorizontal: 18 }, topbarContext: { marginLeft: 28, paddingLeft: 28, borderLeftWidth: 1, borderLeftColor: C.line, color: C.muted, fontSize: 13, flex: 1 }, profileButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }, profileInitial: { color: C.cocoaDark, fontSize: 13, fontWeight: '700' }, brandSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  contentArea: { flex: 1, minHeight: 0 }, chatPage: { flex: 1 }, chatHeader: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, chatHeaderWide: { paddingHorizontal: 48, paddingTop: 20, paddingBottom: 14 }, chatHeaderCopy: { flex: 1 }, chatSubtitle: { color: C.muted, fontSize: 12, marginTop: 6 }, privatePill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#E6E5E1', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: C.paper }, privateDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#7A9875' }, privateLabel: { color: C.green, fontSize: 10, fontWeight: '600' }, eyebrow: { color: C.cocoa, fontSize: 9, letterSpacing: 1.7, fontWeight: '700', marginBottom: 7 }, pageTitle: { color: C.ink, fontSize: 22, fontWeight: '600', letterSpacing: -0.55 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },   servicePill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7 }, serviceDot: { width: 6, height: 6, backgroundColor: '#BC9E79', borderRadius: 4 }, serviceText: { color: C.muted, fontSize: 10, fontWeight: '600' }, moreButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }, moreGlyph: { color: C.muted, fontSize: 20, lineHeight: 23, marginTop: -10 }, historyGlyph: { color: C.cocoa, fontSize: 18, lineHeight: 22 },
  chatScroll: { flex: 1 }, chatContent: { paddingHorizontal: 20, paddingBottom: 26, flexGrow: 1 }, chatContentWide: { maxWidth: 900, width: '100%', alignSelf: 'center', paddingHorizontal: 64 }, emptyContent: { justifyContent: 'center' }, emptyState: { width: '100%', maxWidth: 720, alignSelf: 'center', alignItems: 'center', paddingTop: 14, paddingBottom: 20 }, emptyHeroMark: { width: 58, height: 58, borderRadius: 20, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: C.cocoa, shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 }, emptyHeroLogo: { width: 58, height: 58, borderRadius: 20 }, emptyGreeting: { color: C.ink, fontSize: 30, lineHeight: 38, fontWeight: '600', letterSpacing: -0.9, textAlign: 'center' }, emptyDescription: { maxWidth: 440, color: C.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 9, marginBottom: 28 }, starterGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }, starterCard: { width: '31.8%', minWidth: 175, minHeight: 92, borderRadius: 18, borderWidth: 1, borderColor: '#E7E4DE', backgroundColor: '#FFFFFF', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#302821', shadowOpacity: 0.025, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, starterCardMobile: { width: '48%', minWidth: 120, minHeight: 78, padding: 10, gap: 7 }, starterCardPressed: { backgroundColor: '#F8F6F2', borderColor: '#D4C8BA' }, starterIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F3F0EB', alignItems: 'center', justifyContent: 'center' }, starterIconText: { color: C.cocoa, fontSize: 17 }, starterCopy: { flex: 1 }, starterTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, starterDescription: { color: C.muted, fontSize: 10, lineHeight: 14, marginTop: 4 }, starterArrow: { color: '#A69A8E', fontSize: 13, alignSelf: 'flex-start' }, conversationColumn: { width: '100%', maxWidth: 760, alignSelf: 'center' }, dayDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10, marginBottom: 24 }, dividerLine: { height: 1, backgroundColor: C.line, flex: 1 }, dayText: { color: '#A2968A', fontSize: 9, letterSpacing: 1.5, fontWeight: '700' }, welcomeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, teddyAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center' }, teddyAvatarText: { color: '#FFF9F3', fontSize: 12, fontWeight: '700', letterSpacing: -0.4 }, welcomeBubble: { backgroundColor: C.paper, borderWidth: 1, borderColor: '#E9E0D5', borderRadius: 5, borderTopRightRadius: 22, borderBottomRightRadius: 22, borderBottomLeftRadius: 22, paddingHorizontal: 20, paddingVertical: 18, maxWidth: 640, flex: 1, shadowColor: '#60432F', shadowOpacity: 0.035, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, messageMeta: { color: '#A2968A', fontSize: 8, letterSpacing: 1.25, fontWeight: '700', marginBottom: 9 }, welcomeText: { color: C.ink, fontSize: 16, lineHeight: 25, letterSpacing: -0.1 }, welcomeHint: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 6 },
  connectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2ECE3', borderRadius: 16, padding: 14, marginTop: 22, marginLeft: 44, gap: 12, maxWidth: 555 }, connectIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }, connectIconText: { color: C.cocoa, fontSize: 17 }, connectCopy: { flex: 1 }, connectTitle: { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 4 }, connectBody: { fontSize: 11, color: C.muted, lineHeight: 16 }, connectArrow: { color: C.cocoa, fontSize: 24 }, promptWrap: { marginTop: 22, marginLeft: 44 }, promptHeading: { color: '#796D62', fontSize: 11, fontWeight: '600', marginBottom: 10, marginLeft: 2 }, promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, promptChip: { borderWidth: 1, borderColor: '#E3D9CD', backgroundColor: '#FBF8F3', borderRadius: 18, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center' }, promptChipText: { color: C.cocoaDark, fontSize: 11, fontWeight: '500' },
  messageRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 14 }, messageRowYou: { justifyContent: 'flex-end' }, teddyAvatarSmall: { width: 27, height: 27, borderRadius: 10, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center' }, messageBubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 }, teddyBubble: { backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderTopLeftRadius: 4 }, userBubble: { backgroundColor: C.cocoa, borderBottomRightRadius: 4 }, messageText: { color: C.ink, fontSize: 14, lineHeight: 21 }, userMessageText: { color: C.white }, messageTime: { color: C.muted, fontSize: 9, textAlign: 'right', marginTop: 5 }, userMessageTime: { color: '#E8D9CC' }, sendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 8 }, typingBubble: { backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderRadius: 16, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 }, typingText: { color: C.muted, fontSize: 12, fontWeight: '600' }, errorBanner: { backgroundColor: '#FCE9E3', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 }, errorText: { color: '#8D473F', fontSize: 11, lineHeight: 16 }, retryButton: { alignSelf: 'flex-start', marginTop: 8, minHeight: 30, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#FFFFFF' }, retryButtonText: { color: '#8D473F', fontSize: 11, fontWeight: '700' },
  composerWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: C.canvas }, composerWrapWide: { maxWidth: 900, width: '100%', alignSelf: 'center', paddingHorizontal: 64, paddingTop: 12, paddingBottom: 18 }, composerCard: { minHeight: 68, maxWidth: 760, alignSelf: 'center', width: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDDCD6', borderRadius: 24, paddingHorizontal: 11, paddingVertical: 8, shadowColor: '#302821', shadowOpacity: 0.065, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, composerCardFocused: { borderColor: '#B49A83', shadowColor: C.cocoa, shadowOpacity: 0.14, shadowRadius: 17, shadowOffset: { width: 0, height: 0 }, elevation: 3 }, chatTools: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, maxWidth: 760, alignSelf: 'center', width: '100%', marginBottom: 7 }, chatToolButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, borderWidth: 1, borderColor: '#E7DED3', backgroundColor: '#FDFBF8', paddingHorizontal: 10 }, chatToolIcon: { color: C.cocoa, fontSize: 13 }, chatToolLabel: { color: C.cocoaDark, fontSize: 10, fontWeight: '600' }, toolIconButton: { width: 31, height: 31, borderRadius: 13, borderWidth: 1, borderColor: '#E7E5E0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }, toolIconGlyph: { color: C.cocoa, fontSize: 18, lineHeight: 22 }, attachmentRow: { minHeight: 28, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', borderRadius: 13, backgroundColor: '#F3F0EB', paddingLeft: 9, marginBottom: 6 }, attachmentRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }, attachmentRemoveText: { color: C.muted, fontSize: 18 }, attachmentText: { color: C.green, fontSize: 10, fontWeight: '600' }, composer: { minHeight: 56, maxHeight: 140, borderRadius: 20, borderWidth: 1, borderColor: '#DED4C8', backgroundColor: C.paper, flexDirection: 'row', alignItems: 'flex-end', padding: 7, paddingLeft: 16, shadowColor: '#60432F', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, composerDisabled: { opacity: 0.76 }, composerInput: { flex: 1, minWidth: 0, color: C.ink, fontSize: 14, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 7, maxHeight: 110, minHeight: 46 }, sendButton: { flexShrink: 0, width: 46, height: 46, borderRadius: 17, backgroundColor: '#B9A797', justifyContent: 'center', alignItems: 'center' }, sendButtonActive: { backgroundColor: C.cocoa }, sendButtonDisabled: { opacity: 0.72 }, sendArrow: { color: C.white, fontSize: 24, lineHeight: 28, fontWeight: '700', includeFontPadding: false }, composerFootnote: { color: '#9A8E82', fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 14 },
  bottomNav: { height: 62, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, bottomNavItem: { flex: 1, height: 54, alignItems: 'center', justifyContent: 'center', gap: 2 }, bottomIcon: { fontSize: 19, color: '#9B9085', lineHeight: 22 }, bottomIconActive: { color: C.cocoa }, bottomLabel: { fontSize: 11, color: '#93877C', fontWeight: '500' }, bottomLabelActive: { color: C.cocoaDark, fontWeight: '700' },
  pageScroll: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 32 }, pageScrollWide: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 48, paddingTop: 38 }, pageIntro: { marginBottom: 22 }, pageDescription: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 9, maxWidth: 580 }, memoryNotice: { flexDirection: 'row', gap: 12, padding: 15, borderRadius: 16, backgroundColor: '#F1E9DE', marginBottom: 27 }, noticeIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#E7DDD1', alignItems: 'center', justifyContent: 'center' }, noticeGlyph: { fontSize: 17, color: C.cocoa }, noticeCopy: { flex: 1 }, noticeTitle: { color: C.cocoaDark, fontSize: 12, fontWeight: '700', marginBottom: 4 }, noticeBody: { color: '#796D62', fontSize: 11, lineHeight: 17 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, sectionTitle: { color: '#8E8175', fontSize: 10, letterSpacing: 1.3, fontWeight: '700' }, countText: { color: C.cocoa }, addLink: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }, addLinkText: { color: C.cocoa, fontSize: 12, fontWeight: '700' }, memoryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 15, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 16, marginBottom: 10 }, memoryMark: { width: 32, height: 32, backgroundColor: C.peachLight, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, memoryMarkText: { color: C.cocoa, fontSize: 16 }, memoryCopy: { flex: 1, paddingTop: 2 }, memoryText: { color: C.ink, fontSize: 13, lineHeight: 20 }, memoryDate: { color: '#9B9085', fontSize: 10, marginTop: 7 }, memoryActions: { flexDirection: 'row', gap: 3 }, memoryAction: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, memoryActionGlyph: { color: '#8A7D70', fontSize: 17 }, deleteGlyph: { color: '#A17C70', fontSize: 22 }, memoriesFootnote: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 10 }, emptyCard: { alignItems: 'center', backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 28, marginTop: 4 }, emptyMark: { width: 46, height: 46, borderRadius: 16, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, emptyGlyph: { color: C.cocoa, fontSize: 21 }, emptyTitle: { color: C.ink, fontSize: 16, fontWeight: '700' }, emptyBody: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 280, marginTop: 7, marginBottom: 17 },
  privacyBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, backgroundColor: C.greenLight, borderRadius: 16, marginBottom: 27 }, privacyShield: { width: 35, height: 35, backgroundColor: '#D7E3D4', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, shieldGlyph: { color: C.green, fontSize: 19 }, privacyCopy: { flex: 1 }, privacyTitle: { color: '#435943', fontSize: 13, fontWeight: '700', marginBottom: 5 }, privacyBody: { color: '#65745F', fontSize: 12, lineHeight: 17 }, settingsSectionLabel: { color: '#8E8175', fontSize: 11, letterSpacing: 1.3, fontWeight: '700', marginBottom: 10, marginTop: 3 }, settingsCard: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 17, paddingHorizontal: 15, marginBottom: 23 }, settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 }, settingIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: C.paperAlt, alignItems: 'center', justifyContent: 'center' }, settingGlyph: { color: C.cocoa, fontSize: 15 }, settingText: { flex: 1 }, settingTitle: { color: C.ink, fontSize: 12, fontWeight: '700', lineHeight: 17 }, settingDescription: { color: C.muted, fontSize: 12, lineHeight: 15, marginTop: 3 }, switchTrack: { width: 42, height: 25, borderRadius: 14, backgroundColor: '#DED8D0', padding: 3, justifyContent: 'center' }, switchOn: { backgroundColor: C.cocoa }, switchThumb: { width: 19, height: 19, borderRadius: 10, backgroundColor: C.white }, switchThumbOn: { alignSelf: 'flex-end' }, settingSeparator: { height: 1, backgroundColor: C.line, marginLeft: 44 }, gatewaySection: { borderRadius: 18 }, gatewaySectionFocused: { borderWidth: 1, borderColor: '#D6BAA5', padding: 10, marginHorizontal: -10, marginBottom: 14, backgroundColor: '#F8F0E8' }, gatewayIntro: { flexDirection: 'row', gap: 11, paddingTop: 16, paddingBottom: 14 }, gatewayIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center' }, gatewayGlyph: { color: C.cocoa, fontSize: 16 }, inputLabel: { color: '#93877C', fontSize: 11, letterSpacing: 1.1, fontWeight: '700', marginBottom: 7 }, gatewayInput: { height: 45, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: '#FDFCFA', paddingHorizontal: 12, color: C.ink, fontSize: 12 }, gatewayActions: { paddingTop: 11, paddingBottom: 15, gap: 9 }, connectionStatus: { color: C.muted, fontSize: 11, lineHeight: 15 }, connectionReady: { color: C.green }, connectionError: { color: C.rose }, clearRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 }, clearIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#F8EAE5', alignItems: 'center', justifyContent: 'center' }, clearGlyph: { color: C.rose, fontSize: 16 }, clearButton: { minHeight: 36, minWidth: 54, borderRadius: 11, borderWidth: 1, borderColor: '#E7D8D2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, clearButtonText: { color: C.rose, fontSize: 11, fontWeight: '700' }, versionText: { textAlign: 'center', color: '#A79B8F', fontSize: 10, letterSpacing: 1.4, marginTop: 2, marginBottom: 16 },
  button: { minHeight: 42, backgroundColor: C.cocoa, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17 }, buttonQuiet: { backgroundColor: '#F2ECE4' }, buttonDisabled: { opacity: 0.45 }, buttonText: { color: C.white, fontSize: 11, fontWeight: '700' }, buttonTextQuiet: { color: C.cocoaDark }, pressed: { opacity: 0.75 }, disabledText: { color: '#A79B8F' },
  localLoadingScreen: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.canvas },
  localLoadingTitle: { color: C.ink, fontSize: 21, lineHeight: 28, fontWeight: '600', textAlign: 'center' },
  localLoadingBody: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  localLoadingColumn: { width: '100%', maxWidth: 560, marginTop: 28, gap: 12 },
  skeletonHeading: { width: 110, height: 11, borderRadius: 6, backgroundColor: '#EAE8E3', marginBottom: 4 },
  skeletonBubble: { height: 42, borderRadius: 15, backgroundColor: '#EEECE7' },
  skeletonBubbleWide: { width: '72%' },
  skeletonBubbleShort: { width: '54%' },
  skeletonBubbleRight: { width: '60%', alignSelf: 'flex-end', backgroundColor: '#E9E3DC' },
  skeletonComposer: { height: 54, borderRadius: 18, borderWidth: 1, borderColor: '#E8E5DF', backgroundColor: C.paper, marginTop: 16 },
  profilePhotoButton: { backgroundColor: 'transparent', borderRadius: 20, overflow: 'hidden' },
  sidebarChatList: { flex: 1, flexShrink: 1, minWidth: 0, width: '100%', minHeight: 80, marginHorizontal: -5 }, sidebarChatListCollapsed: { marginHorizontal: 0 },
  crisisSupport: { backgroundColor: '#F8EAE5', borderColor: '#E6C6B9', borderWidth: 1, borderRadius: 15, padding: 15, marginTop: 14 }, widgetDismiss: { alignSelf: 'flex-end', minHeight: 30, justifyContent: 'center', paddingHorizontal: 8 }, widgetDismissText: { color: '#70483F', fontSize: 10, fontWeight: '700' },
  crisisSupportTitle: { color: '#70483F', fontSize: 13, fontWeight: '700', marginBottom: 7 },
  crisisSupportBody: { color: '#704F46', fontSize: 12, lineHeight: 17 },
  crisisCallLink: { alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center', marginTop: 7, paddingHorizontal: 13, borderRadius: 12, backgroundColor: '#70483F' },
  crisisCallLinkText: { color: C.white, fontSize: 12, fontWeight: '700' },
  crisisHelplineTitle: { color: '#70483F', fontSize: 11, fontWeight: '700', marginTop: 11 },
  crisisHelplineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  crisisSupportLink: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center', marginTop: 6, paddingVertical: 4 },
  crisisSupportLinkText: { color: '#70483F', fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' },
  crisisSupportFootnote: { color: '#846D65', fontSize: 10, lineHeight: 14, marginTop: 2 },
  memorySuggestionCard: { alignSelf: 'flex-start', maxWidth: '82%', backgroundColor: '#F1E9DE', borderColor: '#E5D8C6', borderWidth: 1, borderRadius: 15, padding: 13, marginTop: 9, marginLeft: 35 }, occasionWidget: { alignSelf: 'center', width: '100%', maxWidth: 650, backgroundColor: '#F1E9DE', borderColor: '#E5D8C6', borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12 }, occasionTitle: { color: C.cocoaDark, fontSize: 13, fontWeight: '700' }, occasionDescription: { color: C.muted, fontSize: 11, lineHeight: 15, marginTop: 5 }, occasionInput: { minHeight: 76, maxHeight: 140, borderWidth: 1, borderColor: '#E4D8C9', borderRadius: 12, backgroundColor: C.paper, color: C.ink, fontSize: 12, lineHeight: 17, padding: 10, marginTop: 10 }, occasionPrivacy: { color: C.muted, fontSize: 11, lineHeight: 14, marginTop: 6 },
  memorySuggestionTitle: { color: C.cocoaDark, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  memorySuggestionFact: { color: C.ink, fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 7 },
  memorySuggestionBody: { color: C.muted, fontSize: 11, lineHeight: 15, marginTop: 7 },
  memorySuggestionActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 11 },
  mobileHistoryPage: { flex: 1, paddingHorizontal: 20, paddingTop: 26, paddingBottom: 20 },
  historyPageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  mobileHistoryList: { flex: 1, marginTop: 12 },
  profileTextButton: { width: 'auto', minWidth: 66, paddingHorizontal: 10 },
  headerTextButton: { minHeight: 38, borderRadius: 13, backgroundColor: '#F1F1EE', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  headerActionLabel: { color: C.ink, fontSize: 11, fontWeight: '600' },
  memoryActionTextButton: { minHeight: 32, minWidth: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  memoryActionText: { color: '#76695E', fontSize: 10, fontWeight: '600' },
  typingIndicator: { minWidth: 48, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderRadius: 16, borderTopLeftRadius: 4, paddingHorizontal: 12 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(45, 36, 29, 0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 }, modalCard: { width: '100%', maxWidth: 460, backgroundColor: C.paper, borderRadius: 22, padding: 22 }, modalTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, modalIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center' }, modalIconText: { color: C.cocoa, fontSize: 18 }, closeButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paperAlt }, closeText: { color: C.muted, fontSize: 22, lineHeight: 24 }, modalTitle: { color: C.ink, fontWeight: '700', fontSize: 20, letterSpacing: -0.4 }, modalBody: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 16 }, memoryInput: { minHeight: 100, maxHeight: 180, backgroundColor: '#F9F6F1', borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 13, color: C.ink, fontSize: 13, lineHeight: 19 }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 17 }, suggestedFact: { color: C.ink, fontSize: 15, lineHeight: 22, fontWeight: '600', backgroundColor: '#F9F6F1', borderRadius: 14, padding: 13, marginTop: 12 }, historyCard: { width: '100%', maxWidth: 560, maxHeight: '85%', backgroundColor: C.paper, borderRadius: 22, padding: 22 }, historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 }, historyList: { maxHeight: 430, marginTop: 14 }, historyItemWrap: { position: 'relative', width: '100%', minWidth: 0, marginBottom: 6 }, historyItemWrapCollapsed: { alignItems: 'center' }, historyItem: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3, paddingHorizontal: 4, paddingVertical: 4, borderRadius: 13, borderWidth: 1, borderColor: 'transparent' }, historyItemOpen: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, borderRadius: 10 }, historyItemOpenCollapsed: { flex: 0, width: 42, justifyContent: 'center', paddingHorizontal: 0 }, historyItemSelected: { backgroundColor: C.peachLight, borderColor: C.peach }, chatMenuTrigger: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, chatMenuTriggerOpen: { backgroundColor: '#E9E3DC' }, chatMenuDots: { color: C.muted, fontSize: 16, fontWeight: '700', letterSpacing: 1 }, chatActionMenu: { backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 5, marginHorizontal: 5, marginTop: -1, shadowColor: '#302821', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, chatActionItem: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 8 }, chatActionText: { color: C.ink, fontSize: 12, fontWeight: '500' }, chatActionDelete: { backgroundColor: '#FCF5F2' }, chatActionDeleteText: { color: C.rose }, historyItemCopy: { flex: 1, minWidth: 0 }, historyItemCopyCollapsed: { flex: 0, alignItems: 'center' }, historyItemTitleCollapsed: { minWidth: 22, textAlign: 'center', fontSize: 12 }, historyItemTitle: { color: C.ink, fontSize: 13, fontWeight: '700' }, historyItemPreview: { color: C.muted, fontSize: 11, marginTop: 5 }, historyItemDate: { color: C.muted, fontSize: 11 }, historyEmpty: { textAlign: 'center', color: C.muted, fontSize: 12, lineHeight: 19, padding: 20 }, memorySuggestionError: { color: C.rose, fontSize: 11, lineHeight: 16, paddingHorizontal: 8, paddingVertical: 8 },
});

export default App;
