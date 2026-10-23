import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ASSISTANT_CHARACTERS, DEFAULT_ASSISTANT_CHARACTER_ID } from './src/characters';
import type { AssistantCharacterId, AssistantCharacterNames } from './src/characters';
import { GatewayService } from './src/services/gateway';
import { browserAuthService } from './src/services/browserAuth';
import type { StoredSession } from './src/services/session';
import { findRelevantChatHistory, localDataService, ownerFromToken } from './src/services/localData';
import type { EmotionCheckIn, JournalEntry, LocalConversation, LocalMemory, LocalMessage } from './src/services/localData';
import { EMOTION_AXES } from './src/services/localData';
import { createEncryptedBackup, MAX_BACKUP_BYTES, readEncryptedBackup } from './src/services/backup';
import { pickBackupFile, saveBackupFile } from './src/services/backupFiles';
import { pickChatImage } from './src/services/imagePicker';
import { crisisHelplineOptionForLocale, emergencyCallOptionForLocale, hasCrisisSignal } from './src/services/conversationSafety';
import type { CrisisHelplineOption, EmergencyCallOption } from './src/services/conversationSafety';
import teddyBudLogoAsset from './assets/teddy-bud-logo.png';
import assistantIconAsset from './assets/icon.png';

type Page = 'chat' | 'history' | 'memories' | 'privacy' | 'settings' | 'emotions' | 'journal' | 'studio';
type Memory = LocalMemory;
type MemorySuggestion = { conversationId: string; messageId: number; fact: string };
type Message = LocalMessage;
type Conversation = LocalConversation;
type CreditBalance = { day: string; used: number; remaining: number; limit: number; resetAt: string };

const C = {
  canvas: '#F8F8F6', paper: '#FFFFFF', paperAlt: '#F2F2EF', ink: '#272724',
  muted: '#73736E', line: '#E6E5E1', cocoa: '#685443', cocoaDark: '#514234',
  peach: '#E7B49A', peachLight: '#F8E9DF', green: '#536C53', greenLight: '#E8EFE5',
  rose: '#8D473F', white: '#FFFFFF',
};

const navItems: { id: Page; icon: string; label: string }[] = [
  { id: 'chat', icon: '◌', label: 'Your space' },
  { id: 'memories', icon: '✳', label: 'Memories' },
  { id: 'emotions', icon: '◉', label: 'Emotions' },
  { id: 'journal', icon: '▤', label: 'Journal' },
  { id: 'studio', icon: '☼', label: 'Wellbeing' },
  { id: 'privacy', icon: '⌑', label: 'Privacy' },
];
const mobileNavItems: { id: Page; icon: string; label: string }[] = [
  ...navItems,
  { id: 'settings', icon: '⚙', label: 'Settings' },
];

const gatewayService = new GatewayService(GATEWAY_BASE_URL);
const teddyBudLogo: ImageSourcePropType = typeof teddyBudLogoAsset === 'string'
  ? { uri: teddyBudLogoAsset }
  : teddyBudLogoAsset;
const assistantIcon: ImageSourcePropType = typeof assistantIconAsset === 'string'
  ? { uri: assistantIconAsset }
  : assistantIconAsset;

function openExternalUrl(url: string): Promise<void> {
  const desktop = typeof window !== 'undefined' ? window.teddyBudDesktop : undefined;
  return desktop ? desktop.openExternal(url) : Linking.openURL(url);
}

function mayContainDurableMemory(text: string): boolean {
  return /\b(?:my (?:long[- ]term )?(?:goal|dream|plan)|long[- ]term goal|i (?:plan|hope|want) to|i(?:'m| am) (?:a|an) [a-z-]+|i work as|i live in|i care for|i(?:'ve| have) been (?:working toward|studying))\b/i.test(text);
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
  const [initialMode, setInitialMode] = useState<'login' | 'create'>('create');
  const [canMigrateLegacy, setCanMigrateLegacy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const current = await browserAuthService.restore();
        if (mounted) {
          setSession(current);
          if (current) await browserAuthService.markSetupComplete();
          else {
            setInitialMode(await browserAuthService.shouldCreateAccount() ? 'create' : 'login');
            setCanMigrateLegacy(await browserAuthService.canMigrateLegacyAccount());
          }
        }
      } catch (restoreError) {
        if (mounted) setError(restoreError instanceof Error ? restoreError.message : 'Unable to restore your sign-in.');
      } finally {
        if (mounted) setBusy(false);
      }
    };
    restore();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    const expireSession = () => {
      browserAuthService.clear().catch(() => undefined).then(() => {
        setError('Your one-hour session has expired. Please sign in again.');
        setInitialMode('login');
        setSession(null);
      });
    };
    const delay = session.expiresAt - Date.now();
    if (delay <= 0) {
      expireSession();
      return undefined;
    }
    const timer = setTimeout(expireSession, delay);
    return () => clearTimeout(timer);
  }, [session]);

  if (busy) return <AuthLoading />;
  if (!session) return <BrowserLoginScreen error={error} initialMode={initialMode} canMigrateLegacy={canMigrateLegacy} onAuthenticated={next => { setError(null); setInitialMode('login'); setSession(next); }} />;
  return <TeddyBud sessionToken={session.accessToken} onLogout={() => {
    browserAuthService.logout().then(() => setSession(null)).catch(logoutError => {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to end the server session.');
      setSession(null);
    });
  }} />;
}

function AuthLoading() {
  return <View style={styles.authScreen}><View style={styles.brandMark}><Image source={teddyBudLogo} style={styles.brandLogo} accessibilityLabel="Teddy Bud" /></View><Text style={styles.authTitle}>Opening your private space…</Text><Text style={styles.authBody}>Checking your secure session.</Text></View>;
}

function BrowserLoginScreen({ error, initialMode, canMigrateLegacy, onAuthenticated }: { error: string | null; initialMode: 'login' | 'create'; canMigrateLegacy: boolean; onAuthenticated: (session: StoredSession) => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 600;
  const [mode, setMode] = useState<'login' | 'create' | 'recover' | 'migrate'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryPassphrase, setRecoveryPassphrase] = useState('');
  const [recoveryPassphraseConfirmation, setRecoveryPassphraseConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true); setFormError(null); setNotice(null);
    try {
      if (mode === 'login') {
        onAuthenticated(await browserAuthService.signIn(email.trim(), password));
      } else if (mode === 'create') {
        if (password.length < 6) throw new Error('Choose a password with at least 6 characters.');
        if (password !== confirmPassword) throw new Error('The passwords do not match.');
        const phrase = recoveryPassphrase.trim();
        if (phrase.length < 10 || phrase.length > 128) throw new Error('Choose a recovery passphrase with 10 to 128 characters.');
        if (recoveryPassphraseConfirmation.trim() !== phrase) throw new Error('The recovery passphrases do not match.');
        onAuthenticated(await browserAuthService.createAccount(email.trim(), password, phrase));
      } else if (mode === 'migrate') {
        if (password.length < 6) throw new Error('Choose a password with at least 6 characters.');
        if (password !== confirmPassword) throw new Error('The passwords do not match.');
        const phrase = recoveryPassphrase.trim();
        if (phrase.length < 10 || phrase.length > 128) throw new Error('Choose a recovery passphrase with 10 to 128 characters.');
        if (recoveryPassphraseConfirmation.trim() !== phrase) throw new Error('The recovery passphrases do not match.');
        onAuthenticated(await browserAuthService.migrateLegacyAccount(password, phrase));
      } else {
        if (password.length < 6) throw new Error('Choose a new password with at least 6 characters.');
        if (recoveryPassphrase.trim().length < 10) throw new Error('Enter the recovery passphrase you chose when you created your account.');
        await browserAuthService.recoverPassword(email.trim(), recoveryPassphrase.trim(), password);
        setMode('login'); setPassword(''); setRecoveryPassphrase('');
        setNotice('Password changed. Sign in with your new password.');
      }
    } catch (authError) {
      setFormError(authError instanceof Error ? authError.message : 'Unable to complete sign-in.');
    } finally {
      setSubmitting(false);
    }
  };

  const changeMode = (next: 'login' | 'create' | 'recover' | 'migrate') => {
    setMode(next); setFormError(null); setNotice(null); setPassword(''); setConfirmPassword(''); setRecoveryPassphrase(''); setRecoveryPassphraseConfirmation('');
  };

  const title = mode === 'create' ? 'Create your private space.' : mode === 'recover' ? 'Reset your password.' : mode === 'migrate' ? 'Keep your existing space.' : 'Welcome back.';
  const actionLabel = mode === 'create' ? 'Create account' : mode === 'recover' ? 'Change password' : mode === 'migrate' ? 'Move existing account' : 'Sign in';

  return <KeyboardAvoidingView style={styles.authScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.authScrollContent, compact && styles.authScrollContentCompact]}>
    <View style={[styles.authCard, compact && styles.authCardCompact]}>
      <View style={styles.authMark}><Image source={teddyBudLogo} style={styles.authLogo} accessibilityLabel="Teddy Bud" /></View>
      <Text style={styles.authEyebrow}>Teddy Bud</Text>
      <Text style={styles.authTitle}>{title}</Text>
      <Text style={styles.authBody}>{mode === 'create' ? 'Create a strong password and a recovery passphrase you can keep safe. Your account opens your private space on this device.' : mode === 'recover' ? 'Enter the recovery passphrase you chose when you created your account, then choose a new password.' : mode === 'migrate' ? 'Set a password and recovery passphrase for the account already signed in on this device. Your existing chats stay with that account.' : 'Sign in to open your private space on this device.'}</Text>
      {(error || formError) && <View style={styles.authError}><Text accessibilityRole="alert" style={styles.authErrorText}>{formError || error}</Text></View>}
      {!!notice && <View style={styles.authNotice}><Text style={styles.authNoticeText}>{notice}</Text></View>}
      {mode !== 'migrate' && <TextInput accessibilityLabel="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor="#938A80" style={styles.authInput} editable={!submitting} />}
      {mode === 'recover' && <TextInput accessibilityLabel="Recovery passphrase" autoCapitalize="none" autoCorrect={false} autoComplete="off" secureTextEntry value={recoveryPassphrase} onChangeText={setRecoveryPassphrase} placeholder="Recovery passphrase" placeholderTextColor="#938A80" style={styles.authInput} editable={!submitting} />}
      <TextInput accessibilityLabel={mode === 'recover' ? 'New password' : 'Password'} autoCapitalize="none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} textContentType={mode === 'login' ? 'password' : 'newPassword'} secureTextEntry value={password} onChangeText={setPassword} placeholder={mode === 'recover' ? 'New password (6+ characters)' : 'Password (6+ characters)'} placeholderTextColor="#938A80" style={styles.authInput} editable={!submitting} />
      {(mode === 'create' || mode === 'migrate') && <>
        <TextInput accessibilityLabel="Confirm password" autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" placeholderTextColor="#938A80" style={styles.authInput} editable={!submitting} />
        <Text style={styles.authKeyLabel}>RECOVERY PASSPHRASE</Text>
        <TextInput accessibilityLabel="Choose recovery passphrase" autoCapitalize="none" autoCorrect={false} autoComplete="off" secureTextEntry value={recoveryPassphrase} onChangeText={setRecoveryPassphrase} placeholder="At least 10 characters" placeholderTextColor="#938A80" maxLength={128} style={styles.authInput} editable={!submitting} />
        <Text style={styles.authFootnote}>Choose a unique recovery passphrase of at least 10 characters and keep it somewhere safe. You will need it with your email to reset your password. Teddy Bud stores only a keyed verifier, not the phrase.</Text>
        <TextInput accessibilityLabel="Confirm recovery passphrase" autoCapitalize="none" autoCorrect={false} autoComplete="off" secureTextEntry value={recoveryPassphraseConfirmation} onChangeText={setRecoveryPassphraseConfirmation} placeholder="Confirm recovery passphrase" placeholderTextColor="#938A80" maxLength={128} style={styles.authInput} editable={!submitting} />
      </>}
      <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} disabled={submitting || ((mode === 'create' || mode === 'migrate') && recoveryPassphrase.trim().length < 10) || ((mode === 'create' || mode === 'migrate') && recoveryPassphraseConfirmation.trim() !== recoveryPassphrase.trim())} onPress={submit} style={({ pressed }) => [styles.authButton, (submitting || ((mode === 'create' || mode === 'migrate') && recoveryPassphrase.trim().length < 10) || ((mode === 'create' || mode === 'migrate') && recoveryPassphraseConfirmation.trim() !== recoveryPassphrase.trim())) && styles.buttonDisabled, pressed && styles.pressed]}>
        <Text style={styles.authButtonText}>{submitting ? 'Please wait…' : actionLabel}</Text>
      </Pressable>
      {mode === 'login' && <Pressable accessibilityRole="button" onPress={() => changeMode('recover')} style={styles.authLink}><Text style={styles.authLinkText}>Forgot password?</Text></Pressable>}
      {canMigrateLegacy && mode !== 'recover' && mode !== 'migrate' && <Pressable accessibilityRole="button" onPress={() => changeMode('migrate')} style={styles.authLink}><Text style={styles.authLinkText}>Keep chats from the existing account on this device</Text></Pressable>}
      {mode === 'recover' ? <Pressable accessibilityRole="button" onPress={() => changeMode('login')} style={styles.authLink}><Text style={styles.authLinkText}>Back to sign in</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => changeMode(mode === 'login' ? 'create' : 'login')} style={styles.authLink}><Text style={styles.authLinkText}>{mode === 'login' ? 'Create an account' : 'Already have an account? Sign in'}</Text></Pressable>}
      <Text style={styles.authFootnote}>Your chats stay encrypted on this device. Your password and recovery passphrase are never stored in plaintext.</Text>
    </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function TeddyBud({ sessionToken, onLogout }: { sessionToken: string; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 800;
  const [page, setPage] = useState<Page>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);\n  const [emotionCheckIns, setEmotionCheckIns] = useState<EmotionCheckIn[]>([]);\n  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [memoryModal, setMemoryModal] = useState(false);
  const [renameConversationId, setRenameConversationId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [memorySuggestion, setMemorySuggestion] = useState<MemorySuggestion | null>(null);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [rememberInSession, setRememberInSession] = useState(true);
  const rememberPreferenceRef = useRef(true);
  const memorySuggestionRequestId = useRef(0);
  const nextMessageId = useRef(0);
  const [shareMemories, setShareMemories] = useState(false);
  const [shareChatHistory, setShareChatHistory] = useState(false);
  const [shareAboutMe, setShareAboutMe] = useState(false);
  const [aboutMe, setAboutMe] = useState('');
  const [assistantName, setAssistantName] = useState('Teddy');
  const [assistantCharacterId, setAssistantCharacterId] = useState<AssistantCharacterId>(DEFAULT_ASSISTANT_CHARACTER_ID);
  const [assistantCharacterNames, setAssistantCharacterNames] = useState<AssistantCharacterNames>({ 'teddy-bud': 'Teddy' });
  const [localDataReady, setLocalDataReady] = useState(false);
  const [localDataOwner, setLocalDataOwner] = useState<string | null>(null);
  const [localDataError, setLocalDataError] = useState<string | null>(null);
  const [localDataSaveError, setLocalDataSaveError] = useState<string | null>(null);
  const [localDataRetry, setLocalDataRetry] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatErrorConversationId, setChatErrorConversationId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [retryConversationId, setRetryConversationId] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState('');
  const [streamingConversationId, setStreamingConversationId] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const streamBufferRef = useRef('');
  const streamUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receivedReplyRef = useRef('');
  const responseAbortControllerRef = useRef<AbortController | null>(null);

  const title = useMemo(() => page === 'history' ? 'Your chats' : page === 'settings' ? 'Settings' : page === 'emotions' ? 'Emotional landscape' : page === 'journal' ? 'Private journal' : page === 'studio' ? 'Wellbeing studio' : navItems.find(item => item.id === page)?.label ?? 'Your space', [page]);
  const owner = useMemo(() => ownerFromToken(sessionToken), [sessionToken]);
  const refreshCreditBalance = useCallback(async () => {
    try {
      setCreditBalance(await gatewayService.getCreditBalance(sessionToken));
    } catch {
      setCreditBalance(null);
    }
  }, [sessionToken]);
  useEffect(() => { void refreshCreditBalance(); }, [refreshCreditBalance]);
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
      setMemories(data.memories);\n      setEmotionCheckIns(data.emotionCheckIns ?? []);\n      setJournalEntries(data.journalEntries ?? []);
      setRememberInSession(data.rememberInSession);
      rememberPreferenceRef.current = data.rememberInSession;
      setShareMemories(data.shareMemories);
      setShareChatHistory(data.shareChatHistory);
      setShareAboutMe(data.shareAboutMe);
      setAboutMe(data.aboutMe);
      setAssistantName(data.assistantName);
      setAssistantCharacterId(data.assistantCharacterId ?? DEFAULT_ASSISTANT_CHARACTER_ID);
      setAssistantCharacterNames(data.assistantCharacterNames ?? {});
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
      emotionCheckIns,
      journalEntries,
      rememberInSession,
      shareMemories,
      shareChatHistory,
      shareAboutMe,
      aboutMe,
      assistantName,
      assistantCharacterId,
      assistantCharacterNames,
    }).then(() => {
      setLocalDataSaveError(null);
    }).catch(error => {
      setLocalDataSaveError(error instanceof Error ? error.message : 'Could not save private data on this device.');
    });
  }, [localDataReady, localDataOwner, owner, conversations, activeConversationId, memories, rememberInSession, shareMemories, shareChatHistory, shareAboutMe, aboutMe, assistantName, assistantCharacterId, assistantCharacterNames, emotionCheckIns, journalEntries]);

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
        : existing.title === 'New chat' ? message.text.trim().slice(0, 48) || 'New chat' : existing.title;
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

  const setConversationPinned = useCallback((conversationId: string, pinned: boolean) => {
    setConversations(current => current.map(conversation => conversation.id === conversationId ? { ...conversation, pinned } : conversation));
  }, []);

  const beginRenameConversation = useCallback((conversation: Conversation) => {
    setRenameConversationId(conversation.id);
    setRenameDraft(conversation.title);
  }, []);

  const saveConversationRename = () => {
    const newTitle = renameDraft.trim().slice(0, 80);
    if (!renameConversationId || !newTitle) return;
    setConversations(current => current.map(conversation => conversation.id === renameConversationId ? { ...conversation, title: newTitle, updatedAt: new Date().toISOString() } : conversation));
    setRenameConversationId(null);
    setRenameDraft('');
  };

  const deleteConversation = useCallback((conversation: Conversation) => {
    if (streamingConversationId === conversation.id) return;
    confirmAction(
      'Delete this chat?',
      `"${conversation.title}" and its messages will be removed from this device for this account.`,
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
  }, [activeConversationId, conversations, streamingConversationId]);

  const startNewConversation = useCallback(() => {
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
    setPage('chat');
    setDraft('');
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setPage('chat');
    setDraft('');
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed(value => !value);
  }, []);

  const confirmClear = () => confirmAction(
    'Clear local data?',
    'This removes all chats, memories, emotion check-ins, and journal entries saved on this device.',
    () => {
      localDataService.clear(owner).then(() => {
        memorySuggestionRequestId.current += 1;
        setMemorySuggestion(null);
        setConversations([]);
        setActiveConversationId(null);
        setMemories([]);
        setEmotionCheckIns([]);
        setJournalEntries([]);
        setRememberInSession(true);
        rememberPreferenceRef.current = true;
        setShareMemories(false);
        setShareChatHistory(false);
        setShareAboutMe(false);
        setAboutMe('');
        setAssistantName('Teddy');
        setAssistantCharacterId(DEFAULT_ASSISTANT_CHARACTER_ID);
        setAssistantCharacterNames({ 'teddy-bud': 'Teddy' });
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
    'This permanently removes all chats, memories, emotion check-ins, and journal entries saved for this account on this device.',
    () => {
      localDataService.clear(owner).then(() => {
        memorySuggestionRequestId.current += 1;
        setMemorySuggestion(null);
        setConversations([]);
        setActiveConversationId(null);
        setMemories([]);
        setRememberInSession(true);
        rememberPreferenceRef.current = true;
        setShareMemories(false);
        setShareChatHistory(false);
        setShareAboutMe(false);
        setAboutMe('');
        setAssistantName('Teddy');
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
      await localDataService.save(owner, { conversations, activeConversationId, memories, rememberInSession, shareMemories, shareChatHistory, shareAboutMe, aboutMe, assistantName, assistantCharacterId, assistantCharacterNames });
    } catch (error) {
      setLocalDataSaveError(error instanceof Error ? error.message : 'Could not save private data on this device.');
    }
  };

  const exportBackup = (passphrase: string) => createEncryptedBackup({
    conversations, activeConversationId, memories, rememberInSession, shareMemories, shareChatHistory, shareAboutMe, aboutMe, assistantName, assistantCharacterId, assistantCharacterNames,
  }, owner, passphrase);

  const importBackup = async (fileContents: string, passphrase: string) => {
    const imported = await readEncryptedBackup(fileContents, owner, passphrase);
    const confirmed = Platform.OS === 'web'
      // eslint-disable-next-line no-alert -- confirm before replacing the current account's local data.
      ? typeof window !== 'undefined' && window.confirm("Replace this account's saved chats, memories, emotion check-ins, journal entries, and settings with the backup?")
      : await new Promise<boolean>(resolve => Alert.alert('Replace saved data?', 'This replaces chats, memories, emotion check-ins, journal entries, and settings for the currently signed-in account on this device.', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Replace', style: 'destructive', onPress: () => resolve(true) },
      ]));
    if (!confirmed) return false;
    await localDataService.save(owner, imported);
    setConversations(imported.conversations);
    setActiveConversationId(imported.activeConversationId);
    setMemories(imported.memories);
    setEmotionCheckIns(imported.emotionCheckIns ?? []);
    setJournalEntries(imported.journalEntries ?? []);
    setRememberInSession(imported.rememberInSession);
    rememberPreferenceRef.current = imported.rememberInSession;
    setShareMemories(imported.shareMemories);
    setShareChatHistory(imported.shareChatHistory);
    setShareAboutMe(imported.shareAboutMe);
    setAboutMe(imported.aboutMe);
    setAssistantName(imported.assistantName);
    setAssistantCharacterId(imported.assistantCharacterId ?? DEFAULT_ASSISTANT_CHARACTER_ID);
    setAssistantCharacterNames(imported.assistantCharacterNames ?? {});
    setLocalDataReady(true);
    setLocalDataOwner(owner);
    return true;
  };

  const sendMessage = async (messageToRetry?: string, imageDataUrl?: string) => {
    const text = messageToRetry ?? (draft.trim() || (imageDataUrl ? 'Please describe this image.' : ''));
    if ((!text && !imageDataUrl) || isSending || !localDataReady) return;
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
    const abortController = new AbortController();
    responseAbortControllerRef.current = abortController;
    setChatError(null);
    setChatErrorConversationId(null);
    streamBufferRef.current = '';
    receivedReplyRef.current = '';
    if (streamUpdateTimerRef.current) clearTimeout(streamUpdateTimerRef.current);
    streamUpdateTimerRef.current = null;
    setStreamingReply('');
    setStreamingConversationId(conversationId);

    try {
      const history = messageToRetry ? messages.slice(0, -1) : messages;
      const isFirstExchange = !history.some(message => message.author === 'you');
      const conversationBeforeReply = conversations.find(conversation => conversation.id === conversationId);
      const fallbackTitle = text.trim().slice(0, 48) || 'New chat';
      const shouldGenerateTitle = isFirstExchange && (!conversationBeforeReply || conversationBeforeReply.title === 'New chat' || conversationBeforeReply.title === fallbackTitle);
      const responseText = await gatewayService.sendChatMessage(text, history.map(message => ({
        role: message.author === 'you' ? 'user' : 'assistant',
        content: message.text,
      })), sessionToken, {
        task: 'conversation',
        imageDataUrl,
        memories: shareMemories ? memories.map(memory => memory.text) : [],
        aboutMe: shareAboutMe ? aboutMe : '',
        assistantName,
        assistantCharacterId,
        crossChatContext: shareChatHistory
          ? findRelevantChatHistory(conversations, conversationId, text)
          : [],
        crisisConcern: hasCrisisSignal(text)
          || history.slice(-4).some(message => message.author === 'you' && hasCrisisSignal(message.text)),
        signal: abortController.signal,
        onTextChunk: chunk => {
          receivedReplyRef.current += chunk;
          streamBufferRef.current += chunk;
          if (streamUpdateTimerRef.current) return;
          streamUpdateTimerRef.current = setTimeout(() => {
            const buffered = streamBufferRef.current;
            streamBufferRef.current = '';
            streamUpdateTimerRef.current = null;
            setStreamingReply(current => current + buffered);
          }, 16);
        },
      });

      const assistantMessage: Message = {
        id: nextMessageId.current = Math.max(Date.now(), nextMessageId.current + 1),
        text: responseText,
        author: 'teddy',
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      };

      appendConversationMessage(conversationId, assistantMessage);
      void refreshCreditBalance();
      if (shouldGenerateTitle) {
        gatewayService.generateChatTitle(text, responseText, sessionToken).then(generatedTitle => {
          if (!generatedTitle) return;
          setConversations(current => current.map(conversation => conversation.id === conversationId && conversation.title === fallbackTitle
            ? { ...conversation, title: generatedTitle, updatedAt: new Date().toISOString() }
            : conversation));
        }).catch(() => {
          // Title generation is optional; keep the first-message fallback if it fails.
        }).finally(() => { void refreshCreditBalance(); });
      }
      streamBufferRef.current = '';
      if (streamUpdateTimerRef.current) clearTimeout(streamUpdateTimerRef.current);
      streamUpdateTimerRef.current = null;
      setStreamingReply('');
      setStreamingConversationId(null);
      setRetryMessage(null);
      setRetryConversationId(null);
      if (rememberInSession && mayContainDurableMemory(text)) {
        const suggestionRequestId = ++memorySuggestionRequestId.current;
        gatewayService.suggestMemory(text, sessionToken).then(suggestion => {
          if (!suggestion || suggestionRequestId !== memorySuggestionRequestId.current || !rememberPreferenceRef.current) return;
          const duplicate = memories.some(memory => memory.text.toLowerCase() === suggestion.toLowerCase());
          if (!duplicate) setMemorySuggestion({ conversationId, messageId: assistantMessage.id, fact: suggestion });
        }).catch(() => {
          // Memory suggestions are optional background work; provider errors must not interrupt chat.
        }).finally(() => { void refreshCreditBalance(); });
      }
    } catch (error) {
      void refreshCreditBalance();
      if (abortController.signal.aborted) {
        const partialReply = receivedReplyRef.current.trim();
        if (partialReply) {
          appendConversationMessage(conversationId, {
            id: nextMessageId.current = Math.max(Date.now(), nextMessageId.current + 1),
            text: partialReply,
            author: 'teddy',
            time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          });
        }
        setRetryMessage(null);
        setRetryConversationId(null);
        streamBufferRef.current = '';
        if (streamUpdateTimerRef.current) clearTimeout(streamUpdateTimerRef.current);
        streamUpdateTimerRef.current = null;
        setStreamingReply('');
        setStreamingConversationId(null);
        return;
      }
      streamBufferRef.current = '';
      if (streamUpdateTimerRef.current) clearTimeout(streamUpdateTimerRef.current);
      streamUpdateTimerRef.current = null;
      setStreamingReply('');
      setStreamingConversationId(null);
      if ((error as { status?: number }).status === 401) {
        try {
          if (!(await browserAuthService.restore())) {
            onLogout();
            return;
          }
        } catch (restoreError) {
          const detail = restoreError instanceof Error ? restoreError.message : 'Your session could not be restored.';
          setChatError(`Your sign-in could not be refreshed. ${detail}`);
          setChatErrorConversationId(conversationId);
          setRetryMessage(text);
          setRetryConversationId(conversationId);
          return;
        }
      }
      const message = chatErrorMessage(error);
      setChatError(message);
      setChatErrorConversationId(conversationId);
      setRetryMessage(text);
      setRetryConversationId(conversationId);
    } finally {
      if (responseAbortControllerRef.current === abortController) responseAbortControllerRef.current = null;
      setIsSending(false);
    }
  };

  const stopResponse = () => responseAbortControllerRef.current?.abort();

  const openCrisisResources = () => {
    openExternalUrl('https://findahelpline.com/').catch(error => {
      const detail = error instanceof Error ? error.message : 'The link could not be opened.';
      setChatError(`Could not open the helpline directory. Visit https://findahelpline.com/ directly. ${detail}`);
    });
  };

  const openPhoneAction = (scheme: 'tel' | 'sms', number: string, failureMessage: string) => {
    openExternalUrl(`${scheme}:${number}`).catch(error => {
      const detail = error instanceof Error ? error.message : 'The phone app could not be opened.';
      setChatError(`${failureMessage} ${detail}`);
    });
  };
  const callEmergencyServices = (number: string) => openPhoneAction('tel', number, `Could not start a call. Dial ${number} from your phone, or use the local emergency number.`);
  const callCrisisHelpline = (number: string) => openPhoneAction('tel', number, `Could not call ${number}. Use the local helpline directory instead.`);
  const textCrisisHelpline = (number: string) => openPhoneAction('sms', number, `Could not open a text message to ${number}. Use the local helpline directory instead.`);
  const openHelplineWebsite = (url: string) => {
    openExternalUrl(url).catch(error => {
      const detail = error instanceof Error ? error.message : 'The website could not be opened.';
      setChatError(`Could not open the official helpline website. Visit ${url} directly. ${detail}`);
    });
  };

  const rootInsetsStyle = { paddingTop: insets.top, paddingBottom: wide ? insets.bottom : 0 };
  return (
    <View style={[styles.root, rootInsetsStyle]}>
      {wide && <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        page={page}
        onNavigate={setPage}
        onNewConversation={startNewConversation}
        conversations={conversations}
        activeConversationId={activeConversationId}
        busyConversationId={streamingConversationId}
        onPinConversation={setConversationPinned}
        onDeleteConversation={deleteConversation}
        onRenameConversation={beginRenameConversation}
        onSelectConversation={selectConversation}
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
          <Pressable accessibilityRole="button" accessibilityLabel="Account Settings" accessibilityHint="Open your account settings" onPress={() => setPage('settings')} style={({ pressed }) => [styles.accountSettingsButton, pressed && styles.pressed]}>
            <Text style={styles.accountSettingsIcon}>⚙</Text><Text style={styles.accountSettingsLabel}>Account Settings</Text>
          </Pressable>
        </View>

        <View style={styles.contentArea}>
          {localDataError ? <LocalDataError error={localDataError} onRetry={retryLocalData} onClear={clearUnavailableLocalData} /> : !localDataReady || localDataOwner !== owner ? <LocalDataLoading /> : <>
          {localDataSaveError && <LocalDataSaveWarning error={localDataSaveError} onRetry={retryLocalData} />}
          {page === 'chat' && <ChatPage wide={wide} assistantName={assistantName} messages={messages} streamingReply={activeConversationId === streamingConversationId ? streamingReply : ''} isThinking={isSending && activeConversationId === streamingConversationId} conversationTitle={activeConversation?.title ?? 'A quiet place to be'} onOpenHistory={() => setPage('history')} onRenameChat={() => { if (activeConversation) beginRenameConversation(activeConversation); }} isPinned={activeConversation?.pinned === true} canManageChat={activeConversation !== null} onTogglePin={() => { if (activeConversation) setConversationPinned(activeConversation.id, !activeConversation.pinned); }} onOpenCrisisResources={openCrisisResources} emergencyCallOption={emergencyCallOption} crisisHelplineOption={crisisHelplineOption} onCallEmergency={callEmergencyServices} onCallHelpline={callCrisisHelpline} onTextHelpline={textCrisisHelpline} onOpenHelplineWebsite={openHelplineWebsite} onSaveOccasion={fact => {
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
          }} onDismissMemorySuggestion={() => setMemorySuggestion(null)} draft={draft} setDraft={setDraft} onSend={imageDataUrl => sendMessage(undefined, imageDataUrl)} onStop={stopResponse} onRetry={() => retryMessage && sendMessage(retryMessage)} retryPending={retryConversationId === activeConversationId && Boolean(retryMessage)} isSending={isSending} chatError={chatErrorConversationId === activeConversationId ? chatError : null} />}
          {page === 'history' && <ChatHistoryPage
            conversations={conversations}
            activeConversationId={activeConversationId}
            busyConversationId={streamingConversationId}
            onBack={() => setPage('chat')}
            onSelect={selectConversation}
            onNewConversation={startNewConversation}
          />}
          {page === 'journal' && <JournalPage wide={wide} entries={journalEntries} onSave={entry => setJournalEntries(current => [entry, ...current.filter(existing => existing.id !== entry.id)].slice(0, 1000))} onDelete={id => setJournalEntries(current => current.filter(entry => entry.id !== id))} />}
          {page === 'studio' && <WellbeingStudio wide={wide} />}
          {page === 'emotions' && <EmotionsPage wide={wide} entries={emotionCheckIns} onSave={entry => setEmotionCheckIns(current => [entry, ...current].slice(0, 500))} onDelete={id => setEmotionCheckIns(current => current.filter(entry => entry.id !== id))} />}
          {page === 'memories' && <MemoriesPage wide={wide} memories={memories} memoryEnabled={rememberInSession} onAdd={() => openMemory()} onEdit={openMemory} onDelete={removeMemory} />}
          {page === 'privacy' && <PrivacyPage wide={wide} rememberInSession={rememberInSession} shareMemories={shareMemories} shareChatHistory={shareChatHistory} shareAboutMe={shareAboutMe} onRememberChange={value => { rememberPreferenceRef.current = value; setRememberInSession(value); }} onShareMemoriesChange={setShareMemories} onShareChatHistoryChange={setShareChatHistory} onShareAboutMeChange={setShareAboutMe} onClear={confirmClear} />}
          {page === 'settings' && <SettingsPage wide={wide} creditBalance={creditBalance} onRefreshCredits={refreshCreditBalance} aboutMe={aboutMe} assistantName={assistantName} assistantCharacterId={assistantCharacterId} assistantCharacterNames={assistantCharacterNames} onAboutMeChange={setAboutMe} onSaveAssistantCharacter={(id, name) => {
            const savedName = name.trim().slice(0, 32);
            if (!savedName) return;
            setAssistantCharacterId(id);
            setAssistantName(savedName);
            setAssistantCharacterNames(current => ({ ...current, [id]: savedName }));
          }} onExport={exportBackup} onImport={importBackup} onLogout={onLogout} />}
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
      <Modal visible={renameConversationId !== null} animationType="fade" transparent onRequestClose={() => setRenameConversationId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTopline}>
              <View style={styles.modalIcon}><Text style={styles.modalIconText}>✎</Text></View>
              <Pressable onPress={() => setRenameConversationId(null)} accessibilityRole="button" accessibilityLabel="Close rename chat dialog" style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
            <Text style={styles.modalTitle}>Rename chat</Text>
            <Text style={styles.modalBody}>Choose a short name that helps you find this conversation.</Text>
            <TextInput autoFocus value={renameDraft} onChangeText={value => setRenameDraft(value.slice(0, 80))} placeholder="Chat name" placeholderTextColor={C.muted} maxLength={80} returnKeyType="done" onSubmitEditing={saveConversationRename} style={styles.settingsTextInput} accessibilityLabel="Chat name" />
            <View style={styles.modalActions}>
              <Button label="Cancel" tone="quiet" onPress={() => setRenameConversationId(null)} />
              <Button label="Save name" onPress={saveConversationRename} disabled={!renameDraft.trim()} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function chatErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : '';
  const status = (error as { status?: unknown } | null)?.status;
  if (error instanceof DOMException && error.name === 'AbortError') return 'The conversation service took too long to respond. Check your connection and try again.';
  if (/failed to fetch|network request failed|fetch failed|load failed/i.test(detail)) return "Teddy Bud couldn't reach the conversation service. Check your internet connection and try again.";
  if (status === 429) return 'The conversation service is busy right now. Please wait a moment and try again.';
  if (typeof status === 'number' && status >= 500) return 'The conversation service is temporarily unavailable. Your message is saved; try again shortly.';
  return detail || 'The conversation service is unavailable right now.';
}

function ConversationHistoryList({ conversations, activeConversationId, busyConversationId, onSelect, onPin, onDelete, onRename }: {
  conversations: Conversation[];
  activeConversationId: string | null;
  busyConversationId?: string | null;
  onSelect: (id: string) => void;
  onPin?: (id: string, pinned: boolean) => void;
  onDelete?: (conversation: Conversation) => void;
  onRename?: (conversation: Conversation) => void;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const ordered = useMemo(() => [...conversations].sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true) || b.updatedAt.localeCompare(a.updatedAt)), [conversations]);
  return conversations.length ? ordered.map(conversation => {
    const latestMessage = conversation.messages[conversation.messages.length - 1];
    return <View key={conversation.id} style={styles.historyItemWrap}>
    <View style={[styles.historyItem, conversation.id === activeConversationId && styles.historyItemSelected]}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open chat: ${conversation.title}`}
      accessibilityState={{ selected: conversation.id === activeConversationId }}
      onPress={() => onSelect(conversation.id)}
      style={({ pressed }) => [
        styles.historyItemOpen,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.historyItemCopy}>
        <Text numberOfLines={1} style={[styles.historyItemTitle, conversation.id === activeConversationId && styles.historyItemTitleSelected]}>{conversation.pinned && <Text style={styles.chatPinnedIcon}>{'\u{1F4CC} '}</Text>}{conversation.title}</Text>
        <Text numberOfLines={1} style={styles.historyItemPreview}>{latestMessage?.text ?? 'No messages yet'}</Text>
      </View>
    </Pressable>
    {onPin && onDelete && <Pressable accessibilityRole="button" accessibilityLabel={`Chat options for ${conversation.title}`} accessibilityState={{ expanded: openMenuId === conversation.id }} onPress={() => setOpenMenuId(value => value === conversation.id ? null : conversation.id)} style={({ pressed }) => [styles.chatMenuTrigger, pressed && styles.pressed]}><Text style={styles.chatMenuDots}>•••</Text></Pressable>}
    </View>
    {openMenuId === conversation.id && onPin && onDelete && <View style={styles.chatActionMenu} accessibilityRole="menu">
      {onRename && <Pressable accessibilityRole="menuitem" onPress={() => { setOpenMenuId(null); onRename(conversation); }} style={({ pressed }) => [styles.chatActionItem, pressed && styles.pressed]}><Text style={styles.chatActionText}>Rename chat</Text></Pressable>}
      <Pressable accessibilityRole="menuitem" onPress={() => { onPin(conversation.id, !conversation.pinned); setOpenMenuId(null); }} style={({ pressed }) => [styles.chatActionItem, pressed && styles.pressed]}><Text style={styles.chatActionText}>{conversation.pinned ? 'Unpin chat' : 'Pin chat'}</Text></Pressable>
      <Pressable accessibilityRole="menuitem" accessibilityState={{ disabled: busyConversationId === conversation.id }} disabled={busyConversationId === conversation.id} onPress={() => { setOpenMenuId(null); onDelete(conversation); }} style={({ pressed }) => [styles.chatActionItem, styles.chatActionDelete, busyConversationId === conversation.id && styles.buttonDisabled, pressed && styles.pressed]}><Text style={[styles.chatActionText, styles.chatActionDeleteText]}>Delete chat</Text></Pressable>
    </View>}
    </View>;
  }) : <Text style={styles.historyEmpty}>Your chats will appear here as you talk with Teddy Bud.</Text>;
}

function ChatHistoryPage({ conversations, activeConversationId, busyConversationId, onBack, onSelect, onNewConversation }: {
  conversations: Conversation[];
  activeConversationId: string | null;
  busyConversationId?: string | null;
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
      <Button label="Back to chat" onPress={onBack} tone="quiet" />
    </View>
    <Button label="New chat" onPress={onNewConversation} />
    <ScrollView style={styles.mobileHistoryList} keyboardShouldPersistTaps="handled">
      <ConversationHistoryList conversations={conversations} activeConversationId={activeConversationId} busyConversationId={busyConversationId} onSelect={onSelect} />
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

const Sidebar = React.memo(function SidebarView({ collapsed, onToggleCollapsed, page, onNavigate, onNewConversation, conversations, activeConversationId, busyConversationId, onSelectConversation, onPinConversation, onDeleteConversation, onRenameConversation }: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  page: Page;
  onNavigate: (page: Page) => void;
  onNewConversation: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  busyConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onPinConversation: (id: string, pinned: boolean) => void;
  onDeleteConversation: (conversation: Conversation) => void;
  onRenameConversation: (conversation: Conversation) => void;
}) {
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const visualCollapsed = collapsed && !hoverExpanded;
  const sidebarWidth = useRef(new Animated.Value(collapsed ? 78 : 258)).current;
  const sidebarPadding = sidebarWidth.interpolate({ inputRange: [78, 258], outputRange: [10, 18] });
  const chevronProgress = useRef(new Animated.Value(collapsed ? 1 : 0)).current;
  const [labelsCollapsed, setLabelsCollapsed] = useState(collapsed);
  const labelOpacity = useRef(new Animated.Value(collapsed ? 0 : 1)).current;
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
    const width = visualCollapsed ? 78 : 258;
    sidebarWidth.stopAnimation();
    chevronProgress.stopAnimation();
    labelOpacity.stopAnimation();
    if (reduceMotion.current) {
      sidebarWidth.setValue(width);
      chevronProgress.setValue(visualCollapsed ? 1 : 0);
      labelOpacity.setValue(visualCollapsed ? 0 : 1);
      setLabelsCollapsed(visualCollapsed);
      return;
    }
    let labelAnimation: Animated.CompositeAnimation;
    if (visualCollapsed) {
      labelAnimation = Animated.timing(labelOpacity, { toValue: 0, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true });
      labelAnimation.start(({ finished }) => { if (finished) setLabelsCollapsed(true); });
    } else {
      setLabelsCollapsed(false);
      labelOpacity.setValue(0);
      labelAnimation = Animated.sequence([
        Animated.delay(130),
        Animated.timing(labelOpacity, { toValue: 1, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]);
      labelAnimation.start();
    }
    Animated.timing(sidebarWidth, {
      toValue: width,
      duration: 300,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.timing(chevronProgress, {
      toValue: visualCollapsed ? 1 : 0,
      duration: 240,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [visualCollapsed, sidebarWidth, chevronProgress, labelOpacity]);

  return (
    <Animated.View
      onPointerEnter={Platform.OS === 'web' && collapsed ? () => setHoverExpanded(true) : undefined}
      onPointerLeave={Platform.OS === 'web' && collapsed ? () => setHoverExpanded(false) : undefined}
      style={[styles.sidebar, { width: sidebarWidth, paddingHorizontal: sidebarPadding }]}
    >
      <View style={[styles.sidebarBrand, labelsCollapsed && styles.sidebarBrandCollapsed]}>
        <View style={[styles.sidebarIdentity, labelsCollapsed && styles.sidebarIdentityCollapsed]}>
          <View style={styles.brandMark}><Image source={teddyBudLogo} style={styles.brandLogo} accessibilityLabel="Teddy Bud" /></View>
          {!labelsCollapsed && <Animated.View style={{ opacity: labelOpacity }}><Text style={styles.brandName}>Teddy Bud</Text><Text style={styles.sidebarCaption}>A quiet place to be</Text></Animated.View>}
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Start a new chat" accessibilityHint={labelsCollapsed ? 'Start a new conversation' : undefined} onPress={onNewConversation} style={({ pressed }) => [styles.newChatButton, labelsCollapsed && styles.newChatButtonCollapsed, pressed && styles.pressed]}>
        <Text style={styles.newChatGlyph}>+</Text>{!labelsCollapsed && <Animated.Text style={[styles.newChatLabel, { opacity: labelOpacity }]}>New chat</Animated.Text>}
      </Pressable>
      {!labelsCollapsed && <Animated.Text style={[styles.sidebarLabel, { opacity: labelOpacity }]}>YOUR SPACE</Animated.Text>}
      {navItems.map(item => <NavButton key={item.id} item={item} selected={item.id === page} collapsed={labelsCollapsed} labelOpacity={labelOpacity} onPress={() => onNavigate(item.id)} />)}
      {!labelsCollapsed && <Animated.Text style={[styles.sidebarLabel, { opacity: labelOpacity }]}>CHATS</Animated.Text>}
      <ScrollView style={[styles.sidebarChatList, labelsCollapsed && styles.sidebarChatListCollapsed, { opacity: labelOpacity }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={!labelsCollapsed} showsHorizontalScrollIndicator={false}>
        {!labelsCollapsed && <ConversationHistoryList
          conversations={conversations}
          activeConversationId={activeConversationId}
          busyConversationId={busyConversationId}
          onSelect={onSelectConversation}
          onPin={onPinConversation}
          onDelete={onDeleteConversation}
          onRename={onRenameConversation}
        />}
      </ScrollView>
      <View style={styles.sidebarBottom}>
        <View style={styles.sidebarRule} />
        <Pressable accessibilityRole="button" accessibilityLabel={visualCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} accessibilityHint={visualCollapsed ? 'Show chat names and navigation labels' : 'Hide labels and keep the icon rail visible'} onPress={onToggleCollapsed} style={({ pressed }) => [styles.sidebarCollapseButton, styles.sidebarCollapseButtonBottom, visualCollapsed && styles.sidebarCollapseButtonCollapsed, pressed && styles.pressed]}><Animated.Text style={[styles.sidebarCollapseGlyph, { transform: [{ rotate: chevronRotation }] }]}>‹</Animated.Text></Pressable>
      </View>
    </Animated.View>
  );
});

function NavButton({ item, selected, onPress, collapsed = false, labelOpacity }: { item: (typeof navItems)[number]; selected: boolean; onPress: () => void; collapsed?: boolean; labelOpacity?: Animated.Value }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={item.label} accessibilityHint={collapsed ? `Open ${item.label}` : undefined} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.navButton, collapsed && styles.navButtonCollapsed, selected && styles.navButtonSelected, pressed && styles.pressed]}>
    <Text style={[styles.navIcon, selected && styles.navIconSelected]}>{item.icon}</Text><Animated.Text numberOfLines={1} style={[styles.navLabel, selected && styles.navLabelSelected, collapsed && styles.navLabelCollapsed, { opacity: labelOpacity ?? (collapsed ? 0 : 1) }]}>{item.label}</Animated.Text>
    {selected && !collapsed && <View style={styles.navDot} />}
  </Pressable>;
}

function BottomNav({ page, onNavigate, bottomInset }: { page: Page; onNavigate: (page: Page) => void; bottomInset: number }) {
  return <View style={[styles.bottomNav, { paddingBottom: Math.max(bottomInset, 8) }]}>{mobileNavItems.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: item.id === page }} onPress={() => onNavigate(item.id)} style={styles.bottomNavItem}>
    <Text style={[styles.bottomIcon, item.id === page && styles.bottomIconActive]}>{item.icon}</Text><Text style={[styles.bottomLabel, item.id === page && styles.bottomLabelActive]}>{item.label}</Text>
  </Pressable>)}</View>;
}

export function ChatPage({ wide, assistantName = 'Teddy', messages, streamingReply = '', isThinking = false, conversationTitle, onOpenHistory, onRenameChat, isPinned, onTogglePin, canManageChat = true, onOpenCrisisResources, emergencyCallOption, crisisHelplineOption, onCallEmergency, onCallHelpline, onTextHelpline, onOpenHelplineWebsite, onSaveOccasion, memorySuggestion, onSaveMemorySuggestion, onDismissMemorySuggestion, draft, setDraft, onSend, onStop, onRetry, retryPending, isSending, chatError }: { wide: boolean; assistantName?: string; messages: Message[]; streamingReply?: string; isThinking?: boolean; conversationTitle: string; onOpenHistory: () => void; onRenameChat: () => void; isPinned: boolean; onTogglePin: () => void; canManageChat?: boolean; onOpenCrisisResources: () => void; emergencyCallOption: EmergencyCallOption | null; crisisHelplineOption: CrisisHelplineOption | null; onCallEmergency: (number: string) => void; onCallHelpline: (number: string) => void; onTextHelpline: (number: string) => void; onOpenHelplineWebsite: (url: string) => void; onSaveOccasion?: (fact: string) => void; memorySuggestion: MemorySuggestion | null; onSaveMemorySuggestion: () => void; onDismissMemorySuggestion: () => void; draft: string; setDraft: (value: string) => void; onSend: (imageDataUrl?: string) => void; onStop: () => void; onRetry: () => void; retryPending: boolean; isSending: boolean; chatError: string | null }) {
  const [selectedImage, setSelectedImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const canSend = (!!draft.trim() || !!selectedImage) && !isSending;
  const [composerFocused, setComposerFocused] = useState(false);
  const [manualCrisisSupport, setManualCrisisSupport] = useState(false);
  const [occasionOpen, setOccasionOpen] = useState(false);
  const [occasionDraft, setOccasionDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const hasSafetyConcern = messages.some(message => message.author === 'you' && hasCrisisSignal(message.text));
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: !streamingReply }); }, [messages.length, streamingReply, isSending]);
  const submitMessage = () => { if (!canSend) return; onSend(selectedImage?.dataUrl); setSelectedImage(null); };
  return <KeyboardAvoidingView style={styles.chatPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[styles.chatHeader, wide && styles.chatHeaderWide]}>
      <View style={styles.chatHeaderCopy}><Text style={styles.pageTitle} numberOfLines={1}>{conversationTitle}</Text></View>
      <View style={styles.headerActions}>
        {!wide && <Pressable accessibilityRole="button" accessibilityLabel="View chats" onPress={onOpenHistory} style={({ pressed }) => [styles.headerTextButton, pressed && styles.pressed]}><Text style={styles.headerActionLabel}>Chats</Text></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel="Rename chat" disabled={isSending || !canManageChat} onPress={onRenameChat} style={({ pressed }) => [styles.headerTextButton, (isSending || !canManageChat) && styles.buttonDisabled, pressed && styles.pressed]}><Text style={styles.headerActionLabel}>{wide ? 'Rename chat' : 'Rename'}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={isPinned ? 'Unpin chat' : 'Pin chat'} accessibilityState={{ checked: isPinned }} disabled={isSending || !canManageChat} onPress={onTogglePin} style={({ pressed }) => [styles.headerTextButton, isPinned && styles.headerPinnedButton, (isSending || !canManageChat) && styles.buttonDisabled, pressed && styles.pressed]}><Text style={[styles.headerActionLabel, isPinned && styles.headerPinnedButtonLabel]}>{wide ? (isPinned ? 'Unpin chat' : 'Pin chat') : (isPinned ? 'Unpin' : 'Pin')}</Text></Pressable>
      </View>
    </View>
    <ScrollView ref={scrollRef} style={styles.chatScroll} contentContainerStyle={[styles.chatContent, wide && styles.chatContentWide, messages.length === 0 && styles.emptyContent]} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
      {messages.length === 0 ? <View style={styles.emptyState}>
        <View style={styles.emptyHeroMark}><Image source={assistantIcon} style={styles.emptyHeroLogo} accessibilityLabel={assistantName} /></View>
        <Text style={styles.emptyGreeting}>What's on your mind?</Text>
        <Text style={styles.emptyDescription}>A calm space to talk things through, find a little perspective, or simply be heard.</Text>
        <View style={styles.starterGrid}>
          <StarterCard wide={wide} icon="↗" title="Talk it out" description="Something's been on your mind" onPress={() => setDraft("There's something on my mind I'd like to talk through.")} />
          <StarterCard wide={wide} icon="☼" title="Find a little calm" description="Take a moment to slow down" onPress={() => setDraft('I could use a moment to slow down and unwind.')} />
          <StarterCard wide={wide} icon="✳" title="Celebrate a win" description="Make space for something good" onPress={() => setDraft('I want to share a small win from today.')} />
        </View>
      </View> : <View style={styles.conversationColumn}>
        <View style={styles.dayDivider}><View style={styles.dividerLine} /><Text style={styles.dayText}>TODAY</Text><View style={styles.dividerLine} /></View>
        {messages.map(message => <View key={message.id}>
          <View style={[styles.messageRow, message.author === 'you' && styles.messageRowYou]}>
            {message.author === 'teddy' && <View style={styles.teddyAvatarTile}><Image source={assistantIcon} style={styles.teddyAvatarMessageLogo} accessibilityLabel={assistantName} /></View>}
            <View style={[styles.messageBubble, message.author === 'you' ? styles.userBubble : styles.teddyBubble]}>{message.author === 'teddy' ? <MarkdownReply content={message.text} /> : <Text style={[styles.messageText, styles.userMessageText]}>{message.text}</Text>}<Text style={[styles.messageTime, message.author === 'you' && styles.userMessageTime]}>{message.time}</Text></View>
          </View>
          {message.author === 'teddy' && memorySuggestion?.messageId === message.id && <MemorySuggestionCard fact={memorySuggestion.fact} onSave={onSaveMemorySuggestion} onDismiss={onDismissMemorySuggestion} />}
        </View>)}
        {isThinking && (streamingReply
          ? <View style={styles.messageRow}><View style={styles.teddyAvatarTile}><Image source={assistantIcon} style={styles.teddyAvatarMessageLogo} accessibilityLabel={assistantName} /></View><View style={[styles.messageBubble, styles.teddyBubble]}><MarkdownReply content={streamingReply} /></View></View>
          : <View style={styles.sendingRow}><View style={styles.teddyAvatarTile}><Image source={assistantIcon} style={styles.teddyAvatarMessageLogo} accessibilityLabel={assistantName} /></View><TypingIndicator /></View>)}
        {chatError && <View style={styles.errorBanner}><Text style={styles.errorText}>{chatError}</Text>{retryPending && <Pressable accessibilityRole="button" onPress={onRetry} disabled={isSending} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></Pressable>}</View>}
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
        <Pressable accessibilityRole="button" accessibilityLabel="Attach an image" onPress={async () => { try { setSelectedImage(await pickChatImage()); } catch (error) { Alert.alert('Could not add image', error instanceof Error ? error.message : 'Please try again.'); } }} style={({ pressed }) => [styles.chatToolButton, pressed && styles.pressed]}>
          <Text style={styles.chatToolIcon}>＋</Text><Text style={styles.chatToolLabel}>Add image · 1 credit</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open crisis support" onPress={() => setManualCrisisSupport(true)} style={({ pressed }) => [styles.chatToolButton, pressed && styles.pressed]}>
          <Text style={styles.chatToolIcon}>♡</Text><Text style={styles.chatToolLabel}>Crisis support</Text>
        </Pressable>
        {onSaveOccasion && <Pressable accessibilityRole="button" accessibilityLabel="Save an occasion" onPress={() => { setOccasionDraft(''); setOccasionOpen(true); }} style={({ pressed }) => [styles.chatToolButton, pressed && styles.pressed]}>
          <Text style={styles.chatToolIcon}>✳</Text><Text style={styles.chatToolLabel}>Save an occasion</Text>
        </Pressable>}
      </View>
      {selectedImage && <View style={styles.attachmentRow}><Image source={{ uri: selectedImage.dataUrl }} style={{ width: 42, height: 42, borderRadius: 9, marginRight: 8 }} /><Text style={styles.attachmentText} numberOfLines={1}>{selectedImage.name}</Text><Pressable accessibilityRole="button" accessibilityLabel="Remove attached image" onPress={() => setSelectedImage(null)} style={styles.attachmentRemove}><Text style={styles.attachmentRemoveText}>×</Text></Pressable></View>}
      <View style={[styles.composerCard, composerFocused && styles.composerCardFocused]}>
        <TextInput value={draft} onChangeText={setDraft} onFocus={() => setComposerFocused(true)} onBlur={() => setComposerFocused(false)} onSubmitEditing={submitMessage} enterKeyHint="send" blurOnSubmit={Platform.OS === 'web'} placeholder={`Message ${assistantName}…`} placeholderTextColor={C.muted} multiline style={styles.composerInput} accessibilityLabel={`Write a message to ${assistantName}`} {...(Platform.OS === 'web' ? { dataSet: { gramm: 'false' } } as Record<string, unknown> : {})} />
        {isSending
          ? <Pressable accessibilityRole="button" accessibilityLabel="Stop response" onPress={onStop} style={({ pressed }) => [styles.sendButton, styles.stopButton, pressed && styles.pressed]}><View style={styles.stopIcon} /></Pressable>
          : <Pressable accessibilityRole="button" accessibilityLabel="Send message" onPress={submitMessage} disabled={!canSend} style={({ pressed }) => [styles.sendButton, canSend && styles.sendButtonActive, !canSend && styles.sendButtonDisabled, pressed && styles.pressed]}><PaperPlaneIcon /></Pressable>}
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
      <Text style={styles.crisisSupportLinkText}>Find verified support in India or your country</Text>
    </Pressable>
    <Text style={styles.crisisSupportFootnote}>{emergencyCallOption || crisisHelplineOption ? `These options use your device region (${crisisHelplineOption?.region ?? emergencyCallOption?.region}); if you are elsewhere, use the local emergency number and support services.` : 'No call number is configured for this device region. Use your local emergency number or the helpline directory.'} Teddy Bud is not emergency care.</Text>
  </View>;
}

function MarkdownReply({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (/^\s*(```|~~~)/.test(line)) {
      const fence = line.trim().slice(0, 3);
      index += 1;
      const code: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith(fence)) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(<Text key={`code-${index}`} style={styles.markdownFence}>{code.join('\n')}</Text>);
      continue;
    }
    const heading = line.match(/^\s*(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push(<Text key={`heading-${index}`} style={[styles.messageText, styles.markdownHeading, heading[1].length === 1 && styles.markdownHeadingLarge]}>{renderInlineMarkdown(heading[2])}</Text>);
      index += 1;
      continue;
    }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push(<View key={`rule-${index}`} style={styles.markdownRule} />);
      index += 1;
      continue;
    }
    const list = line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
    if (list) {
      const ordered = Boolean(list[2]);
      let number = Number(list[2] ?? 1);
      while (index < lines.length) {
        const item = lines[index].match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
        if (!item || Boolean(item[2]) !== ordered) break;
        blocks.push(<View key={`list-${index}`} style={styles.markdownListRow}><Text style={styles.messageText}>{ordered ? `${number++}.` : '\u2022'}</Text><Text style={[styles.messageText, styles.markdownListText]}>{renderInlineMarkdown(item[3])}</Text></View>);
        index += 1;
      }
      continue;
    }
    if (/^\s*&gt;|^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ''));
      blocks.push(<View key={`quote-${index}`} style={styles.markdownQuote}><Text style={styles.messageText}>{renderInlineMarkdown(quote.join(' '))}</Text></View>);
      continue;
    }
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^\s*(?:#{1,3}\s|```|~~~|>|([-*+]|\d+[.)])\s|---+\s*$)/.test(lines[index])) paragraph.push(lines[index++].trim());
    blocks.push(<Text key={`paragraph-${index}`} style={styles.messageText}>{renderInlineMarkdown(paragraph.join(' '))}</Text>);
  }
  return <View style={styles.markdownReply}>{blocks}</View>;
}

function renderInlineMarkdown(value: string): React.ReactNode[] {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(\*\*|__)(.+?)\3|~~(.+?)~~|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g;
  const result: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    const current = match;
    if (current.index > cursor) result.push(value.slice(cursor, current.index));
    if (current[1] && current[2]) {
      const url = current[2];
      result.push(<Text key={`link-${current.index}`} accessibilityRole="link" style={styles.markdownLink} onPress={() => openExternalUrl(url).catch(() => undefined)}>{current[1]}</Text>);
    } else if (current[4] !== undefined) result.push(<Text key={`strong-${current.index}`} style={styles.markdownStrong}>{current[4]}</Text>);
    else if (current[5] !== undefined) result.push(<Text key={`strike-${current.index}`} style={styles.markdownStrike}>{current[5]}</Text>);
    else if (current[6] !== undefined) result.push(<Text key={`italic-${current.index}`} style={styles.markdownItalic}>{current[6]}</Text>);
    else if (current[7] !== undefined) result.push(<Text key={`italic-${current.index}`} style={styles.markdownItalic}>{current[7]}</Text>);
    else if (current[8] !== undefined) result.push(<Text key={`inline-code-${current.index}`} style={styles.markdownInlineCode}>{current[8]}</Text>);
    cursor = pattern.lastIndex;
  }
  if (cursor < value.length) result.push(value.slice(cursor));
  return result;
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
    <Text style={styles.occasionDescription}>Write a happy memory or occasion you'd like Teddy Bud to remember. Review it before saving.</Text>
    <TextInput value={value} onChangeText={onChange} placeholder="What would you like to remember?" placeholderTextColor={C.muted} multiline maxLength={500} style={styles.occasionInput} accessibilityLabel="Memory to save" textAlignVertical="top" />
    <Text style={styles.occasionPrivacy}>Saved on this device and included with future chats sent to the AI provider.</Text>
    <View style={styles.memorySuggestionActions}>
      <Button label="Cancel" tone="quiet" onPress={onDismiss} />
      <Button label="Save memory" onPress={onSave} disabled={!value.trim()} />
    </View>
  </View>;
}

function PaperPlaneIcon() {
  if (Platform.OS === 'web') {
    return React.createElement('svg' as any, {
      viewBox: '0 0 24 24',
      width: 24,
      height: 24,
      focusable: false,
      'aria-hidden': true,
    }, React.createElement('path' as any, {
      d: 'm3.4 20.4 17.45-7.48c.81-.35.81-1.49 0-1.84L3.4 3.6c-.66-.29-1.39.2-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91',
      fill: '#FFFFFF',
    }));
  }
  return <View accessibilityElementsHidden style={styles.sendArrowIcon}>
    <View style={styles.sendArrowShaft} />
    <View style={styles.sendArrowTop} />
    <View style={styles.sendArrowRight} />
  </View>;
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
    <View style={styles.memoryNotice}><View style={styles.noticeIcon}><Text style={styles.noticeGlyph}>⌑</Text></View><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>{memoryEnabled ? 'Saved on this device' : 'Saved memories are off'}</Text><Text style={styles.noticeBody}>{memoryEnabled ? "Memories stay in this app's local database across restarts and are included with future chats sent to the AI provider." : 'Turn on "Keep memories on this device" in Privacy settings to add memories.'}</Text></View></View>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>SAVED MEMORIES <Text style={styles.countText}>{memories.length}</Text></Text><Pressable accessibilityRole="button" accessibilityLabel="Add a memory" disabled={!memoryEnabled} onPress={onAdd} style={styles.addLink}><Text style={[styles.addLinkText, !memoryEnabled && styles.disabledText]}>{memoryEnabled ? 'Add a memory' : 'Memory is off'}</Text></Pressable></View>
    {memories.length ? memories.map(memory => <View key={memory.id} style={styles.memoryCard}><View style={styles.memoryMark}><Text style={styles.memoryMarkText}>✳</Text></View><View style={styles.memoryCopy}><Text style={styles.memoryText}>{memory.text}</Text><Text style={styles.memoryDate}>{memory.date}</Text></View><View style={styles.memoryActions}><Pressable accessibilityRole="button" accessibilityLabel="Edit memory" onPress={() => onEdit(memory)} style={styles.memoryActionTextButton}><Text style={styles.memoryActionText}>Edit</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Forget memory" onPress={() => onDelete(memory)} style={styles.memoryActionTextButton}><Text style={styles.memoryActionText}>Forget</Text></Pressable></View></View>) : <View style={styles.emptyCard}><View style={styles.emptyMark}><Text style={styles.emptyGlyph}>✳</Text></View><Text style={styles.emptyTitle}>{memoryEnabled ? 'A fresh page' : 'Memories are off'}</Text><Text style={styles.emptyBody}>{memoryEnabled ? "Nothing saved right now. Add a small detail you'd like to hold onto." : 'Turn on "Keep memories on this device" in Privacy settings when you are ready.'}</Text>{memoryEnabled && <Button label="Add your first memory" onPress={onAdd} />}</View>}
    {!!memories.length && <Text style={styles.memoriesFootnote}>Your memories are yours. Edit them, remove them, or clear local data from this device at any time.</Text>}
  </ScrollView>;
}



function JournalPage({wide,entries,onSave,onDelete}:{wide:boolean;entries:JournalEntry[];onSave:(entry:JournalEntry)=>void;onDelete:(id:string)=>void}) {
  const [title,setTitle]=useState(''); const [body,setBody]=useState(''); const [prompt,setPrompt]=useState('Free reflection'); const [editing,setEditing]=useState<string|null>(null); const [search,setSearch]=useState('');
  const prompts=['Free reflection','What felt heavy today?','What is one small thing I appreciate?','What do I need more of right now?','What would I tell a friend in this situation?'];
  const save=()=>{if(!body.trim())return;onSave({id:editing??(Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),createdAt:editing?(entries.find(e=>e.id===editing)?.createdAt??new Date().toISOString()):new Date().toISOString(),title:title.trim().slice(0,160)||prompt,body:body.trim().slice(0,30000),prompt});setTitle('');setBody('');setEditing(null);};
  const visible=entries.filter(e=>(e.title+' '+e.body+' '+e.prompt).toLowerCase().includes(search.toLowerCase()));
  return <ScrollView contentContainerStyle={{padding:wide?28:18,paddingBottom:36}}>
    <Text style={{fontSize:28,fontWeight:'700',color:C.cocoaDark}}>A page just for you</Text><Text style={{color:C.muted,lineHeight:21,marginTop:8}}>Your journal stays in this device's local app storage. It is never added to Teddy's context unless you deliberately copy and share text yourself.</Text>
    <View style={{backgroundColor:C.paper,borderColor:C.line,borderWidth:1,borderRadius:22,padding:16,marginTop:18}}>
      <Text style={{fontSize:18,fontWeight:'700',color:C.cocoaDark}}>{editing?'Edit your entry':'Write a little'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:10}}>{prompts.map(p=><Pressable key={p} onPress={()=>setPrompt(p)} style={{backgroundColor:prompt===p?'#E7D0C2':'#F5ECE5',padding:10,borderRadius:12,marginRight:7}}><Text style={{fontSize:12,color:C.cocoaDark}}>{p}</Text></Pressable>)}</ScrollView>
      <TextInput value={title} onChangeText={setTitle} placeholder="Title (optional)" placeholderTextColor={C.muted} style={{borderWidth:1,borderColor:C.line,borderRadius:12,padding:12,color:C.cocoaDark,marginBottom:9}} />
      <TextInput value={body} onChangeText={setBody} multiline placeholder="Start wherever you are…" placeholderTextColor={C.muted} style={{minHeight:140,borderWidth:1,borderColor:C.line,borderRadius:14,padding:12,color:C.cocoaDark,textAlignVertical:'top'}} />
      <Pressable onPress={save} style={{backgroundColor:C.cocoaDark,borderRadius:14,padding:13,alignItems:'center',marginTop:12}}><Text style={{color:'#FFF',fontWeight:'700'}}>Save privately</Text></Pressable>
    </View>
    <TextInput value={search} onChangeText={setSearch} placeholder="Search journal entries" placeholderTextColor={C.muted} style={{borderWidth:1,borderColor:C.line,borderRadius:14,padding:12,color:C.cocoaDark,marginTop:18}} />
    {visible.map(entry=><View key={entry.id} style={{padding:15,borderWidth:1,borderColor:C.line,borderRadius:17,marginTop:10,backgroundColor:C.paper}}><Text style={{fontWeight:'700',color:C.cocoaDark,fontSize:16}}>{entry.title}</Text><Text style={{fontSize:12,color:C.muted,marginTop:4}}>{new Date(entry.createdAt).toLocaleString()} · {entry.prompt}</Text><Pressable onPress={()=>{setTitle(entry.title);setBody(entry.body);setPrompt(entry.prompt);setEditing(entry.id);}} style={{alignSelf:'flex-start',paddingVertical:8}}><Text style={{color:'#895B43',fontWeight:'700'}}>Edit entry</Text></Pressable><Text selectable style={{color:C.cocoaDark,lineHeight:21,marginTop:9}}>{entry.body}</Text><Pressable onPress={()=>Alert.alert('Delete journal entry?','This cannot be undone.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>onDelete(entry.id)}])} style={{alignSelf:'flex-end',padding:8}}><Text style={{color:'#98594B',fontWeight:'600'}}>Delete</Text></Pressable></View>)}
    {visible.length===0?<Text style={{color:C.muted,marginTop:18}}>No matching entries yet.</Text>:null}
  </ScrollView>;
}
function WellbeingStudio({wide}:{wide:boolean}) {
 const [mode,setMode]=useState<'breathe'|'ground'|'focus'|'rest'>('breathe'); const [step,setStep]=useState(0);
 const content={breathe:{title:'Gentle breathing',description:'Try a comfortable pace. Stop whenever you want.',steps:['Breathe in gently','Breathe out slowly','Relax your shoulders']},ground:{title:'Grounding pause',description:'Notice what is around you, without needing to change anything.',steps:['Name 5 things you can see','Notice 4 things you can feel','Listen for 3 sounds','Notice 2 scents','Name 1 kind thing you can tell yourself']},focus:{title:'Small focus break',description:'A short reset, not another task to complete.',steps:['Put both feet somewhere comfortable','Choose one small next step','Give yourself permission to pause']},rest:{title:'Bedtime wind-down',description:'A quiet offline routine. No streaks, pressure, or score.',steps:['Lower the brightness if comfortable','Let your jaw and shoulders soften','Put tomorrow’s first thought on paper']}} as const;
 return <ScrollView contentContainerStyle={{padding:wide?28:18,paddingBottom:36}}><Text style={{fontSize:28,fontWeight:'700',color:C.cocoaDark}}>A softer moment</Text><Text style={{color:C.muted,lineHeight:21,marginTop:8}}>These gentle exercises work offline. They are optional wellbeing tools, not medical treatment.</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:18}}>{([{id:'breathe',label:'Breathe'},{id:'ground',label:'Grounding'},{id:'focus',label:'Focus break'},{id:'rest',label:'Wind down'}] as const).map(item=><Pressable key={item.id} onPress={()=>{setMode(item.id);setStep(0)}} style={{padding:12,borderRadius:14,backgroundColor:mode===item.id?'#E7D0C2':C.paper,borderWidth:1,borderColor:C.line}}><Text style={{color:C.cocoaDark,fontWeight:'600'}}>{item.label}</Text></Pressable>)}</View><View style={{backgroundColor:C.paper,borderRadius:24,borderWidth:1,borderColor:C.line,padding:22,marginTop:14,alignItems:'center'}}><View style={{width:120,height:120,borderRadius:60,backgroundColor:'#E7D0C2',alignItems:'center',justifyContent:'center',marginBottom:18}}><Text style={{fontSize:34,color:C.cocoaDark}}>{mode==='breathe'?'◌':mode==='ground'?'⌂':mode==='focus'?'✳':'☾'}</Text></View><Text style={{fontSize:21,fontWeight:'700',color:C.cocoaDark}}>{content[mode].title}</Text><Text style={{textAlign:'center',color:C.muted,lineHeight:21,marginTop:8}}>{content[mode].description}</Text><Text style={{fontSize:18,fontWeight:'600',color:C.cocoaDark,textAlign:'center',marginTop:24,minHeight:54}}>{content[mode].steps[step]}</Text><View style={{flexDirection:'row',gap:10,marginTop:18}}><Pressable onPress={()=>setStep(s=>Math.max(0,s-1))} style={{padding:13,borderRadius:13,backgroundColor:'#F5ECE5'}}><Text style={{color:C.cocoaDark}}>Previous</Text></Pressable><Pressable onPress={()=>setStep(s=>(s+1)%content[mode].steps.length)} style={{padding:13,borderRadius:13,backgroundColor:C.cocoaDark}}><Text style={{color:'#FFF',fontWeight:'700'}}>{step===content[mode].steps.length-1?'Start again':'Next step'}</Text></Pressable></View></View></ScrollView>;
}
function EmotionsPage({ wide, entries, onSave, onDelete }: { wide: boolean; entries: EmotionCheckIn[]; onSave: (entry: EmotionCheckIn) => void; onDelete: (id: string) => void }) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [energy, setEnergy] = useState(3);
  const [support, setSupport] = useState<EmotionCheckIn['support']>('listen');
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const latest = entries[0];
  const axisCount = EMOTION_AXES.length;
  const size = wide ? 340 : 290;
  const center = size / 2;
  const radius = size * 0.34;
  const point = (axis: number, value: number) => {
    const angle = -Math.PI / 2 + axis * Math.PI * 2 / axisCount;
    return { x: center + Math.cos(angle) * radius * value / 5, y: center + Math.sin(angle) * radius * value / 5 };
  };
  const line = (a: {x:number;y:number}, b: {x:number;y:number}, color: string, width = 1) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    return <View key={color + a.x + a.y + b.x + b.y} pointerEvents="none" style={{ position: 'absolute', left: (a.x+b.x)/2-Math.sqrt(dx*dx+dy*dy)/2, top: (a.y+b.y)/2-width/2, width: Math.sqrt(dx*dx+dy*dy), height: width, backgroundColor: color, transform: [{ rotate: Math.atan2(dy,dx)+'rad' }] }} />;
  };
  const renderWeb = (data?: Record<string, number>) => {
    const values = EMOTION_AXES.map(axis => data?.[axis.id] ?? 0);
    return <View accessibilityLabel="Spider web chart showing self-rated emotions from zero to five" style={{ width: size, height: size, alignSelf: 'center', position: 'relative' }}>
      {[1,2,3,4,5].map(level => EMOTION_AXES.map((_, i) => line(point(i, level), point((i+1)%axisCount, level), '#E8DDD5', 1)))}
      {EMOTION_AXES.map((_, i) => line({x:center,y:center}, point(i,5), '#D8CBC2', 1))}
      {EMOTION_AXES.map((axis,i) => {
        const p = point(i,5), label = point(i,5.75);
        return <React.Fragment key={axis.id}>
          <Text style={{position:'absolute',left:label.x-37,top:label.y-9,width:74,textAlign:'center',fontSize:10,fontWeight:'600',color:C.cocoaDark}}>{axis.label}</Text>
          {data && values[i] > 0 ? <View style={{position:'absolute',left:point(i,values[i]).x-5,top:point(i,values[i]).y-5,width:10,height:10,borderRadius:5,backgroundColor:'#B87862',borderWidth:2,borderColor:'#FFF9F4'}} /> : null}
        </React.Fragment>;
      })}
      {data ? values.map((value,i) => line(point(i,value), point((i+1)%axisCount,values[(i+1)%axisCount]), '#B87862', 2.5)) : null}
      <View style={{position:'absolute',left:center-4,top:center-4,width:8,height:8,borderRadius:4,backgroundColor:'#B87862'}} />
    </View>;
  };
  return <ScrollView contentContainerStyle={{padding:wide?28:18,paddingBottom:36,alignItems:'stretch'}}>
    <View style={{maxWidth:760,width:'100%',alignSelf:'center'}}>
      <Text style={{fontSize:wide?30:25,fontWeight:'700',color:C.cocoaDark}}>Your emotional landscape</Text>
      <Text style={{fontSize:14,lineHeight:21,color:C.muted,marginTop:8}}>A private snapshot of how you feel. Rate only what feels relevant; there is no good or bad shape.</Text>
      <View style={{backgroundColor:C.paper,borderColor:C.line,borderWidth:1,borderRadius:24,padding:16,marginTop:20}}>
        <Text style={{fontSize:17,fontWeight:'700',color:C.cocoaDark}}>{latest ? 'Latest check-in' : 'Your emotion web'}</Text>
        {renderWeb(latest?.emotions)}
        <Text accessibilityRole="text" style={{textAlign:'center',fontSize:13,lineHeight:19,color:C.muted,marginTop:2}}>{latest ? 'Self-rated snapshot · '+new Date(latest.createdAt).toLocaleString() : 'Your web appears after your first check-in.'}</Text>
        {latest ? <Text style={{fontSize:13,lineHeight:20,color:C.cocoaDark,marginTop:8}}>Highest ratings: {EMOTION_AXES.filter(a=>(latest.emotions[a.id]??0)>0).sort((a,b)=>(latest.emotions[b.id]??0)-(latest.emotions[a.id]??0)).slice(0,3).map(a=>a.label+' '+latest.emotions[a.id]+'/5').join(' · ') || 'No emotions rated'} · Energy {latest.energy}/5</Text> : null}
        <Pressable accessibilityRole="button" onPress={()=>setShowForm(v=>!v)} style={{backgroundColor:C.cocoaDark,borderRadius:15,padding:14,alignItems:'center',marginTop:16}}><Text style={{color:'#FFFFFF',fontWeight:'700'}}>{showForm?'Close check-in':'Add a check-in'}</Text></Pressable>
      </View>
      {showForm ? <View style={{backgroundColor:C.paper,borderColor:C.line,borderWidth:1,borderRadius:22,padding:16,marginTop:14}}>
        <Text style={{fontSize:19,fontWeight:'700',color:C.cocoaDark,marginBottom:6}}>How are you feeling?</Text>
        <Text style={{fontSize:13,color:C.muted,marginBottom:12}}>Tap a number from 0 (not present) to 5 (very strong). You can leave any emotion unrated.</Text>
        {EMOTION_AXES.map(axis=><View key={axis.id} style={{paddingVertical:9,borderBottomWidth:1,borderBottomColor:C.line}}>
          <Text style={{color:C.cocoaDark,fontWeight:'600',marginBottom:8}}>{axis.label}</Text>
          <View style={{flexDirection:'row',gap:8}}>{[0,1,2,3,4,5].map(n=><Pressable key={n} accessibilityRole="button" accessibilityLabel={axis.label+' '+n+' out of 5'} onPress={()=>setRatings(current=>({...current,[axis.id]:n}))} style={{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:ratings[axis.id]===n?'#B87862':'#F5ECE5',borderWidth:ratings[axis.id]===n?2:0,borderColor:C.cocoaDark}}><Text style={{color:C.cocoaDark,fontWeight:'600'}}>{n}</Text></Pressable>)}</View>
        </View>)}
        <Text style={{color:C.cocoaDark,fontWeight:'600',marginTop:14}}>Energy: {energy}/5</Text>
        <View style={{flexDirection:'row',gap:8,marginTop:8}}>{[0,1,2,3,4,5].map(n=><Pressable key={n} onPress={()=>setEnergy(n)} style={{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:energy===n?'#B87862':'#F5ECE5'}}><Text style={{color:C.cocoaDark}}>{n}</Text></Pressable>)}</View>
        <Text style={{color:C.cocoaDark,fontWeight:'600',marginTop:14,marginBottom:8}}>What would help right now?</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{([{id:'listen',label:'Just listen'},{id:'advice',label:'Practical advice'},{id:'encouragement',label:'Encouragement'},{id:'unsure',label:'Not sure'}] as const).map(option=><Pressable key={option.id} onPress={()=>setSupport(option.id)} style={{paddingVertical:9,paddingHorizontal:12,borderRadius:14,backgroundColor:support===option.id?'#E7D0C2':'#F5ECE5',borderWidth:support===option.id?1:0,borderColor:'#B87862'}}><Text style={{color:C.cocoaDark}}>{option.label}</Text></Pressable>)}</View>
        <Text style={{fontSize:12,color:C.muted,marginTop:12}}>Optional note (saved only on this device)</Text>
        <TextInput value={note} onChangeText={setNote} multiline placeholder="Anything you want to remember about this moment…" placeholderTextColor={C.muted} style={{minHeight:76,borderWidth:1,borderColor:C.line,borderRadius:14,padding:12,color:C.cocoaDark,marginTop:7,textAlignVertical:'top'}} />
        <Pressable onPress={()=>{onSave({id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),createdAt:new Date().toISOString(),emotions:ratings,energy,support,note:note.trim()||undefined});setRatings({});setEnergy(3);setSupport('listen');setNote('');setShowForm(false);}} style={{backgroundColor:C.cocoaDark,borderRadius:15,padding:14,alignItems:'center',marginTop:14}}><Text style={{color:'#FFFFFF',fontWeight:'700'}}>Save privately on this device</Text></Pressable>
      </View> : null}
      {entries.length >= 2 ? <View style={{backgroundColor:'#F4ECE6',borderRadius:18,padding:15,marginTop:18}}>
        <Text style={{fontSize:16,fontWeight:'700',color:C.cocoaDark}}>Your recent pattern</Text>
        <Text style={{fontSize:13,color:C.muted,lineHeight:20,marginTop:6}}>Based on your {Math.min(entries.length,7)} latest check-ins only. These are simple averages, not a diagnosis or prediction.</Text>
        {EMOTION_AXES.map(axis=>{const sample=entries.slice(0,7).filter(entry=>typeof entry.emotions[axis.id]==='number');if(!sample.length)return null;const avg=sample.reduce((sum,entry)=>sum+(entry.emotions[axis.id]??0),0)/sample.length;return <View key={axis.id} style={{marginTop:9}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={{fontSize:12,color:C.cocoaDark}}>{axis.label}</Text><Text style={{fontSize:12,color:C.cocoaDark}}>{avg.toFixed(1)}/5</Text></View><View style={{height:6,backgroundColor:'#E1D5CC',borderRadius:4,marginTop:4,overflow:'hidden'}}><View style={{height:6,width:(avg/5*100)+'%',backgroundColor:'#B87862',borderRadius:4}} /></View></View>;})}
      </View> : null}
      <Text style={{fontSize:19,fontWeight:'700',color:C.cocoaDark,marginTop:24,marginBottom:10}}>Past check-ins</Text>
      {entries.length===0 ? <Text style={{color:C.muted,paddingVertical:14}}>Nothing recorded yet. Your check-ins are optional and stay in local app storage.</Text> : entries.map(entry=><View key={entry.id} style={{backgroundColor:C.paper,borderWidth:1,borderColor:C.line,borderRadius:16,padding:14,marginBottom:9}}>
        <Text style={{color:C.cocoaDark,fontWeight:'700'}}>{new Date(entry.createdAt).toLocaleString()}</Text>
        <Text style={{color:C.muted,fontSize:13,marginTop:5}}>{EMOTION_AXES.filter(a=>entry.emotions[a.id]!==undefined).sort((a,b)=>(entry.emotions[b.id]??0)-(entry.emotions[a.id]??0)).slice(0,4).map(a=>a.label+' '+entry.emotions[a.id]+'/5').join(' · ') || 'No emotion ratings'} · Energy {entry.energy}/5</Text>
        {entry.note ? <Text style={{color:C.cocoaDark,marginTop:6}}>{entry.note}</Text> : null}
        <Pressable accessibilityRole="button" onPress={()=>Alert.alert('Delete check-in?','This removes this entry from this device.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>onDelete(entry.id)}])} style={{alignSelf:'flex-end',padding:8}}><Text style={{color:'#98594B',fontWeight:'600'}}>Delete</Text></Pressable>
      </View>)}
      <Text style={{fontSize:12,color:C.muted,lineHeight:18,marginTop:10}}>These ratings are self-reported reflections, not a clinical assessment. No emotions are inferred from your chats.</Text>
    </View>
  </ScrollView>;
}

function PrivacyPage({ wide, rememberInSession, shareMemories, shareChatHistory, shareAboutMe, onRememberChange, onShareMemoriesChange, onShareChatHistoryChange, onShareAboutMeChange, onClear }: { wide: boolean; rememberInSession: boolean; shareMemories: boolean; shareChatHistory: boolean; shareAboutMe: boolean; onRememberChange: (value: boolean) => void; onShareMemoriesChange: (value: boolean) => void; onShareChatHistoryChange: (value: boolean) => void; onShareAboutMeChange: (value: boolean) => void; onClear: () => void }) {
  const [policyLinkError, setPolicyLinkError] = useState('');
  const isDesktopApp = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.teddyBudDesktop?.isDesktop;
  const storagePrivacyDescription = isDesktopApp
    ? "Chats, profile notes, and memories are stored in this desktop app and encrypted with a key protected by your operating system. The open app can access its saved data. Messages and any context you enable below are sent to the configured AI gateway and provider when you chat."
    : Platform.OS === 'web'
      ? "Chats, profile notes, and memories are stored in this browser's local database and encrypted with a separate key for each account. This protects saved data at rest, but code running in this browser while Teddy Bud is open could access it. Messages and any context you enable below are sent to the configured AI gateway and provider when you chat."
      : "Chats, profile notes, and memories are stored in this device's encrypted local database. Messages and any context you enable below are sent to the configured AI gateway and provider when you chat.";
  const openPolicy = (url: string) => {
    setPolicyLinkError('');
    openExternalUrl(url).catch(() => setPolicyLinkError('Could not open this page. Check your connection and try again.'));
  };
  return <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]}>
    <View style={styles.pageIntro}><Text style={styles.eyebrow}>YOUR DATA, YOUR CHOICES</Text><Text style={styles.pageTitle}>Privacy</Text><Text style={styles.pageDescription}>Choose what stays on this device and what accompanies your chats.</Text></View>
    <View style={styles.privacyBanner}><View style={styles.privacyShield}><Text style={styles.shieldGlyph}>⌑</Text></View><View style={styles.privacyCopy}><Text style={styles.privacyTitle}>Your chats stay on this device</Text><Text style={styles.privacyBody}>{storagePrivacyDescription}</Text></View></View>
    <Text style={styles.settingsSectionLabel}>MEMORY & CONTEXT</Text>
    <View style={styles.settingsCard}>
      <SettingRow icon="✳" title="Suggest memory notes" description="Let the assistant suggest durable details from your messages. Turning this off keeps existing notes but stops new suggestions." value={rememberInSession} onChange={onRememberChange} />
      <View style={styles.settingSeparator} />
      <SettingRow icon="↗" title="Share saved memories" description="Include your saved memory notes as context with new messages." value={shareMemories} onChange={onShareMemoriesChange} />
      <View style={styles.settingSeparator} />
      <SettingRow icon="⌕" title="Use other chats for context" description="Select a few relevant excerpts on this device and include them with your message." value={shareChatHistory} onChange={onShareChatHistoryChange} />
      <View style={styles.settingSeparator} />
      <SettingRow icon="▤" title="Share About me notes" description="Include the profile notes you wrote in Settings in the assistant's system context." value={shareAboutMe} onChange={onShareAboutMeChange} />
    </View>
    <Text style={styles.settingsSectionLabel}>DATA</Text>
    <View style={styles.settingsCard}>
      <View style={styles.clearRow}><View style={styles.clearIcon}><Text style={styles.clearGlyph}>⌫</Text></View><View style={styles.settingText}><Text style={styles.settingTitle}>Clear local data</Text><Text style={styles.settingDescription}>Remove saved chat history and memories from this device.</Text></View><Pressable accessibilityRole="button" onPress={onClear} style={styles.clearButton}><Text style={styles.clearButtonText}>Clear</Text></Pressable></View>
    </View>
    <Text style={styles.settingsSectionLabel}>POLICIES</Text>
    <View style={styles.settingsCardForm}>
      <Text style={styles.settingDescription}>Review the terms for using Teddy Bud and how your information is handled.</Text>
      <View style={styles.policyLinks}>
        <Pressable accessibilityRole="link" onPress={() => openPolicy('https://teddybud.vercel.app/application-privacy')} style={({ pressed }) => [styles.policyLink, pressed && styles.pressed]}><Text style={styles.policyLinkText}>Privacy policy ↗</Text></Pressable>
        <Pressable accessibilityRole="link" onPress={() => openPolicy('https://teddybud.vercel.app/application-terms')} style={({ pressed }) => [styles.policyLink, pressed && styles.pressed]}><Text style={styles.policyLinkText}>Terms of use ↗</Text></Pressable>
      </View>
      {!!policyLinkError && <Text accessibilityRole="alert" style={styles.connectionError}>{policyLinkError}</Text>}
    </View>
  </ScrollView>;
}

function SettingsPage({ wide, creditBalance, onRefreshCredits, aboutMe, assistantName, assistantCharacterId, assistantCharacterNames, onAboutMeChange, onSaveAssistantCharacter, onExport, onImport, onLogout }: {
  wide: boolean;
  creditBalance: CreditBalance | null;
  onRefreshCredits: () => Promise<void>;
  aboutMe: string;
  assistantName: string;
  assistantCharacterId: AssistantCharacterId;
  assistantCharacterNames?: AssistantCharacterNames;
  onAboutMeChange: (value: string) => void;
  onSaveAssistantCharacter: (id: AssistantCharacterId, name: string) => void;
  onExport: (passphrase: string) => Promise<string>;
  onImport: (fileContents: string, passphrase: string) => Promise<boolean>;
  onLogout: () => void;
}) {
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [backupStatus, setBackupStatus] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState(assistantCharacterId);
  const [characterNameDraft, setCharacterNameDraft] = useState(assistantCharacterNames?.[assistantCharacterId] ?? assistantName);

  useEffect(() => {
    setSelectedCharacterId(assistantCharacterId);
    setCharacterNameDraft(assistantCharacterNames?.[assistantCharacterId] ?? assistantName);
  }, [assistantCharacterId, assistantCharacterNames, assistantName]);

  const exportBackupFile = async () => {
    setBackupBusy(true);
    setBackupStatus('Encrypting your backup…');
    try {
      const fileContents = await onExport(backupPassphrase);
      const saved = await saveBackupFile(fileContents);
      setBackupStatus(saved ? 'Encrypted backup saved. Keep the passphrase somewhere safe; it cannot be recovered.' : 'Backup export cancelled.');
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : 'The backup could not be created.');
    } finally {
      setBackupBusy(false);
    }
  };

  const chooseBackupFile = () => {
    setBackupBusy(true);
    setBackupStatus('Select an encrypted backup…');
    pickBackupFile(MAX_BACKUP_BYTES).then(contents => {
      if (contents === null) {
        setBackupStatus('Import cancelled. Your saved data was not changed.');
        return false;
      }
      setBackupStatus('Checking the encrypted backup…');
      return onImport(contents, backupPassphrase);
    }).then(imported => {
      if (typeof imported === 'boolean') setBackupStatus(imported ? 'Backup restored for this account on this device.' : 'Import cancelled. Your saved data was not changed.');
    }).catch(error => {
      setBackupStatus(error instanceof Error ? error.message : 'The backup could not be loaded.');
    }).finally(() => setBackupBusy(false));
  };

  return <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]} keyboardShouldPersistTaps="handled">
    <View style={styles.pageIntro}><Text style={styles.eyebrow}>YOUR ACCOUNT</Text><Text style={styles.pageTitle}>Settings</Text><Text style={styles.pageDescription}>Personalize your space and move your data between devices.</Text></View>
    <Text style={styles.settingsSectionLabel}>FREE PLAN</Text>
    <View style={styles.settingsCardForm}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingTitle}>Daily AI credits</Text>
          <Text style={styles.settingDescription}>40 credits each day. Text and image messages each use 1 credit.</Text>
        </View>
        <Text style={{ color: C.cocoaDark, fontSize: 22, fontWeight: '700' }}>{creditBalance ? creditBalance.remaining : '—'}<Text style={{ color: C.muted, fontSize: 12, fontWeight: '500' }}> / 40</Text></Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel="Daily AI credits remaining" accessibilityValue={{ min: 0, max: 40, now: creditBalance?.remaining ?? 0 }} style={{ height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: C.paperAlt }}>
        <View style={{ height: '100%', width: `${Math.min(100, Math.max(0, (creditBalance?.remaining ?? 0) / 40 * 100))}%`, backgroundColor: C.cocoa, borderRadius: 4 }} />
      </View>
      <Text style={styles.settingDescription}>Text: 1 credit · Image analysis: 1 credit · Resets daily at 00:00 UTC.</Text>
      <Pressable accessibilityRole="button" onPress={() => { void onRefreshCredits(); }} style={styles.clearButton}><Text style={styles.clearButtonText}>Refresh balance</Text></Pressable>
      {!creditBalance && <Text style={styles.settingDescription}>Balance unavailable right now. Connect to the gateway and refresh.</Text>}
    </View>
    <View style={styles.settingsCardForm}>
      <Text style={styles.settingTitle}>More ways to connect are coming</Text>
      <Text style={styles.settingDescription}>Pro will include 7 companion personalities, and Premium will include 10, with access to more capable models and larger credit allowances. Paid plans are coming soon; no payment is required for Free.</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <View style={{ flex: 1, borderRadius: 13, borderWidth: 1, borderColor: C.line, padding: 12, backgroundColor: '#FDFBF8' }}>
          <Text style={styles.settingTitle}>Pro · Coming soon</Text>
          <Text style={styles.settingDescription}>7 personalities · Better models</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 13, borderWidth: 1, borderColor: C.line, padding: 12, backgroundColor: '#FDFBF8' }}>
          <Text style={styles.settingTitle}>Premium · Coming soon</Text>
          <Text style={styles.settingDescription}>10 personalities · Best models</Text>
        </View>
      </View>
      <Text style={styles.settingDescription}>Industrial / Enterprise deployments with locally hosted models are planned separately.</Text>
    </View>
    <Text style={styles.settingsSectionLabel}>ABOUT YOU</Text>
    <View style={styles.settingsCardForm}>
      <Text style={styles.formLabel}>What should your assistant know about you?</Text>
      <TextInput value={aboutMe} onChangeText={value => onAboutMeChange(value.slice(0, 2_000))} placeholder="Share your name, goals, preferences, or helpful context…" placeholderTextColor={C.muted} multiline maxLength={2_000} textAlignVertical="top" style={styles.aboutMeInput} accessibilityLabel="About me profile notes" />
      <Text style={styles.settingDescription}>{aboutMe.length}/2000 characters. Saved on this device. It is only sent with chats when you turn on "Share About me notes" in Privacy.</Text>
    </View>
    <Text style={styles.settingsSectionLabel}>ASSISTANT</Text>
    <View style={styles.settingsCardForm}>
      <Text style={styles.formLabel}>Choose your companion</Text>
      <Text style={styles.settingDescription}>Each companion has a different character and conversation style.</Text>
      <View style={styles.characterChoices}>
        {ASSISTANT_CHARACTERS.map(character => {
          const selected = selectedCharacterId === character.id;
          const savedName = assistantCharacterNames?.[character.id] ?? character.name;
          const shownName = selected && characterNameDraft.trim() ? characterNameDraft.trim() : savedName;
          return <Pressable key={character.id} accessibilityRole="radio" accessibilityLabel={`${shownName}, ${character.tagline}${character.tier === 'free' ? '' : ', coming soon'}`} accessibilityState={{ selected, disabled: character.tier !== 'free' }} disabled={character.tier !== 'free'} onPress={() => { setSelectedCharacterId(character.id); setCharacterNameDraft(savedName); }} style={[styles.characterChoice, selected && styles.characterChoiceSelected, character.tier !== 'free' && { opacity: 0.62 }]}>
            <Text style={styles.characterChoiceIcon}>{character.symbol}</Text>
            <View style={styles.characterChoiceCopy}><Text style={styles.characterChoiceName}>{shownName}</Text><Text style={styles.characterChoiceTagline}>{character.tagline}</Text>{character.tier !== 'free' && <Text style={styles.characterChoiceTagline}>{character.tier === 'pro' ? 'PRO' : 'PREMIUM'} · COMING SOON</Text>}</View>
            {selected && <Text style={styles.characterChoiceCheck}>✓</Text>}
          </Pressable>;
        })}
      </View>
      <Text style={styles.formLabel}>Name this persona</Text>
      <TextInput value={characterNameDraft} onChangeText={value => setCharacterNameDraft(value.slice(0, 32))} placeholder="Companion name" placeholderTextColor={C.muted} maxLength={32} style={styles.settingsTextInput} accessibilityLabel="Persona name" />
      <Text style={styles.settingDescription}>Choose a persona, give it a name, then save. Each persona keeps its own name.</Text>
      <Button label="Save companion" onPress={() => onSaveAssistantCharacter(selectedCharacterId, characterNameDraft)} disabled={!characterNameDraft.trim()} />
    </View>
    <Text style={styles.settingsSectionLabel}>BACKUP & RESTORE</Text>
    <View style={styles.settingsCardForm}>
      <Text style={styles.settingTitle}>Encrypted device backup</Text>
      <Text style={styles.settingDescription}>Export chats, memories, and preferences as a portable .teddybud file. The backup is encrypted and can only be restored to the same signed-in account.</Text>
      <TextInput value={backupPassphrase} onChangeText={setBackupPassphrase} placeholder="Backup passphrase (12+ characters)" placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false} secureTextEntry style={[styles.settingsTextInput, styles.backupPassphraseInput]} accessibilityLabel="Backup passphrase" />
      <View style={styles.backupActions}>
        <Button label={backupBusy ? 'Working…' : 'Export .teddybud'} onPress={exportBackupFile} disabled={backupBusy || backupPassphrase.trim().length < 12} />
        <Button label="Import backup" tone="quiet" onPress={chooseBackupFile} disabled={backupBusy || backupPassphrase.trim().length < 12} />
      </View>
      {!!backupStatus && <Text accessibilityLiveRegion="polite" style={styles.backupStatus}>{backupStatus}</Text>}
      <Text style={styles.backupFootnote}>Use the same account and backup passphrase on the new device. Teddy Bud cannot reset the backup passphrase.</Text>
    </View>
    <Text style={styles.settingsSectionLabel}>ACCOUNT</Text>
    <View style={styles.settingsCardForm}>
      <View style={styles.clearRow}><View style={styles.settingText}><Text style={styles.settingTitle}>Sign out</Text><Text style={styles.settingDescription}>End this device's current sign-in session.</Text></View><Pressable accessibilityRole="button" onPress={onLogout} style={styles.clearButton}><Text style={styles.clearButtonText}>Sign out</Text></Pressable></View>
    </View>
  </ScrollView>;
}

function SettingRow({ icon, title, description, value, onChange }: { icon: string; title: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: value ? 1 : 0, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, value]);
  const thumbPosition = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 17] });
  const trackColor = progress.interpolate({ inputRange: [0, 1], outputRange: ['#DED8D0', C.cocoa] });
  return <View style={styles.settingRow}><View style={styles.settingIcon}><Text style={styles.settingGlyph}>{icon}</Text></View><View style={styles.settingText}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDescription}>{description}</Text></View><Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={title} onPress={() => onChange(!value)} style={styles.switchHitArea}><Animated.View style={[styles.switchTrack, { backgroundColor: trackColor }]}><Animated.View style={[styles.switchThumb, { transform: [{ translateX: thumbPosition }] }]} /></Animated.View></Pressable></View>;
}

function Button({ label, onPress, tone = 'primary', disabled = false }: { label: string; onPress: () => void; tone?: 'primary' | 'quiet'; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, tone === 'quiet' && styles.buttonQuiet, disabled && styles.buttonDisabled, pressed && styles.pressed]}><Text style={[styles.buttonText, tone === 'quiet' && styles.buttonTextQuiet]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  sidebarCollapseButtonBottom: { alignSelf: 'flex-end' },
  policyLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 },
  policyLink: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  policyLinkText: { color: C.cocoaDark, fontSize: 12, fontWeight: '600' },
  teddyAvatarTile: { width: 52, height: 52, flexShrink: 0, borderRadius: 26, overflow: 'hidden', backgroundColor: '#FAF6ED', borderWidth: 1, borderColor: '#E8E0D5', alignItems: 'center', justifyContent: 'center' },
  teddyAvatarMessageLogo: { width: 54, height: 54 },
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
  authKeyLabel: { color: '#6F6256', fontSize: 10, letterSpacing: 1.2, fontWeight: '700', marginTop: 5, marginBottom: 7 },
  authRecoveryKey: { color: C.ink, backgroundColor: '#F5F2ED', borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 19, letterSpacing: 0.5, overflow: 'hidden' },
  authLink: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  authLinkText: { color: C.cocoa, fontSize: 12, fontWeight: '700' },
  authNotice: { backgroundColor: '#E8EFE5', borderRadius: 12, padding: 11, marginBottom: 14 },
  authNoticeText: { color: '#435943', fontSize: 12, lineHeight: 16, textAlign: 'center' },
  authPasswordRow: { height: 50, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: '#FDFCFA', marginBottom: 14 },
  authPasswordInput: { flex: 1, height: '100%', paddingHorizontal: 14, color: C.ink, fontSize: 13 },
  showPasswordButton: { minWidth: 55, height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  showPasswordText: { color: C.cocoa, fontSize: 11, fontWeight: '700' },
  googleAuthButton: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  googleAuthButtonText: { color: C.ink, fontSize: 13, fontWeight: '700' },
  authDivider: { color: C.muted, fontSize: 9, letterSpacing: 1.2, textAlign: 'center', marginVertical: 16 },
  authToggle: { alignSelf: 'center', minHeight: 38, justifyContent: 'center', marginTop: 8 },
  authToggleText: { color: C.cocoa, fontSize: 11, fontWeight: '700' },
  authScreen: { flex: 1, backgroundColor: C.canvas }, authScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, authScrollContentCompact: { paddingHorizontal: 16, paddingVertical: 24, justifyContent: 'flex-start' }, authCard: { width: '100%', maxWidth: 440, backgroundColor: C.paper, borderRadius: 28, padding: 30, borderWidth: 1, borderColor: C.line }, authCardCompact: { borderRadius: 22, padding: 22 }, authMark: { width: 56, height: 56, borderRadius: 20, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }, authLogo: { width: 56, height: 56, borderRadius: 20 }, authEyebrow: { color: C.cocoa, fontSize: 10, letterSpacing: 2, fontWeight: '800', marginBottom: 10 }, authTitle: { color: C.ink, fontSize: 30, lineHeight: 37, fontWeight: '600', letterSpacing: -0.9, textAlign: 'center' }, authBody: { color: C.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 12, marginBottom: 24 }, authButton: { minHeight: 52, borderRadius: 16, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, authButtonText: { color: C.white, fontSize: 13, fontWeight: '700' }, authFootnote: { color: '#706458', fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 14 }, authError: { backgroundColor: '#FCE9E3', borderRadius: 12, padding: 11, marginBottom: 14 }, authErrorText: { color: '#8D473F', fontSize: 12, lineHeight: 16, textAlign: 'center' },
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.canvas }, main: { flex: 1, minWidth: 0 },
  newChatButton: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#D8D7D1', backgroundColor: '#FFFFFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 30, shadowColor: '#302821', shadowOpacity: 0.035, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1 }, newChatButtonCollapsed: { paddingHorizontal: 0, justifyContent: 'center' }, newChatGlyph: { color: C.cocoa, fontSize: 20, lineHeight: 23 }, newChatLabel: { color: C.ink, fontSize: 13, fontWeight: '600' },
  headerPinnedButton: { backgroundColor: '#EEE5DB' }, headerPinnedButtonLabel: { color: C.cocoaDark },
  accountCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderRadius: 14 }, accountCardCollapsed: { justifyContent: 'center', paddingHorizontal: 0 }, accountAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E4DDD4', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, accountAvatarImage: { width: 34, height: 34 }, accountAvatarText: { color: C.cocoaDark, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }, accountCopy: { flex: 1 }, accountTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, accountSubtitle: { color: C.muted, fontSize: 11, marginTop: 3 }, accountArrow: { color: '#938A80', fontSize: 22 },
  sidebar: { width: 258, minWidth: 0, flexShrink: 0, overflow: 'hidden', backgroundColor: '#F3F2EF', borderRightWidth: 1, borderRightColor: '#E9E8E4', paddingHorizontal: 18, paddingTop: 24, paddingBottom: 16 }, sidebarCollapseButton: { width: 34, height: 34, borderRadius: 11, marginLeft: 'auto', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAE8E3' }, sidebarCollapseButtonCollapsed: { marginLeft: 0 }, sidebarCollapseGlyph: { color: C.cocoa, fontSize: 23, lineHeight: 25, fontWeight: '500' },
  sidebarBrand: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 24, minWidth: 0 }, sidebarBrandCollapsed: { flexDirection: 'column', gap: 10, marginBottom: 20, width: '100%' }, sidebarIdentity: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }, sidebarIdentityCollapsed: { flex: 0 }, brandMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: C.cocoa, justifyContent: 'center', alignItems: 'center' }, brandLogo: { width: 42, height: 42, borderRadius: 15 }, brandCopy: { justifyContent: 'center' }, brandName: { color: C.ink, fontSize: 16, letterSpacing: -0.4, fontWeight: '700' }, sidebarCaption: { color: C.muted, fontSize: 12, marginTop: 2 }, sidebarLabel: { color: '#69675F', fontSize: 10, letterSpacing: 1.3, fontWeight: '700', marginBottom: 10, marginLeft: 12 },
  navButton: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 11, minWidth: 0 }, navButtonCollapsed: { justifyContent: 'center', paddingHorizontal: 0 }, navButtonSelected: { backgroundColor: '#E7E5E0' }, navIcon: { width: 22, textAlign: 'center', fontSize: 19, color: '#887C71' }, navIconSelected: { color: C.cocoa }, navLabel: { color: '#756A60', fontSize: 13, fontWeight: '500', flex: 1 }, navLabelCollapsed: { position: 'absolute' }, navLabelSelected: { color: C.cocoaDark, fontWeight: '700' }, navDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.cocoa },
  sidebarBottom: { marginTop: 'auto' }, sidebarRule: { height: 1, backgroundColor: '#E2D9CD', marginBottom: 20 }, localNoteIcon: { width: 32, height: 32, backgroundColor: '#E7E5E0', borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, localNoteGlyph: { color: C.cocoa, fontSize: 17 }, localNoteTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginBottom: 5 }, localNoteBody: { color: C.muted, fontSize: 11, lineHeight: 17 },
  topbar: { height: 66, borderBottomWidth: 1, borderBottomColor: '#ECEBE7', paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', backgroundColor: C.paper }, mobileTopbar: { height: 64, paddingHorizontal: 18 }, topbarContext: { marginLeft: 28, paddingLeft: 28, borderLeftWidth: 1, borderLeftColor: C.line, color: C.muted, fontSize: 13, flex: 1 }, accountSettingsButton: { minHeight: 40, borderRadius: 20, backgroundColor: C.peachLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, marginLeft: 'auto' }, accountSettingsIcon: { color: C.cocoaDark, fontSize: 17, lineHeight: 20 }, accountSettingsLabel: { color: C.cocoaDark, fontSize: 13, fontWeight: '600' }, brandSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  contentArea: { flex: 1, minHeight: 0 }, chatPage: { flex: 1 }, chatHeader: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, chatHeaderWide: { paddingHorizontal: 48, paddingTop: 20, paddingBottom: 14 }, chatHeaderCopy: { flex: 1 }, chatSubtitle: { color: C.muted, fontSize: 12, marginTop: 6 }, privatePill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#E6E5E1', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: C.paper }, privateDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#7A9875' }, privateLabel: { color: C.green, fontSize: 10, fontWeight: '600' }, eyebrow: { color: C.cocoa, fontSize: 9, letterSpacing: 1.7, fontWeight: '700', marginBottom: 7 }, pageTitle: { color: C.ink, fontSize: 22, fontWeight: '600', letterSpacing: -0.55 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },   servicePill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7 }, serviceDot: { width: 6, height: 6, backgroundColor: '#BC9E79', borderRadius: 4 }, serviceText: { color: C.muted, fontSize: 10, fontWeight: '600' }, moreButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }, moreGlyph: { color: C.muted, fontSize: 20, lineHeight: 23, marginTop: -10 }, historyGlyph: { color: C.cocoa, fontSize: 18, lineHeight: 22 },
  chatScroll: { flex: 1 }, chatContent: { paddingHorizontal: 20, paddingBottom: 26, flexGrow: 1 }, chatContentWide: { maxWidth: 900, width: '100%', alignSelf: 'center', paddingHorizontal: 64 }, emptyContent: { justifyContent: 'center' }, emptyState: { width: '100%', maxWidth: 720, alignSelf: 'center', alignItems: 'center', paddingTop: 14, paddingBottom: 20 }, emptyHeroMark: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: '#FAF6ED', alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: C.cocoa, shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 }, emptyHeroLogo: { width: 90, height: 90 }, emptyGreeting: { color: C.ink, fontSize: 30, lineHeight: 38, fontWeight: '600', letterSpacing: -0.9, textAlign: 'center' }, emptyDescription: { maxWidth: 440, color: C.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 9, marginBottom: 28 }, starterGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }, starterCard: { width: '31.8%', minWidth: 175, minHeight: 92, borderRadius: 18, borderWidth: 1, borderColor: '#E7E4DE', backgroundColor: '#FFFFFF', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#302821', shadowOpacity: 0.025, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, starterCardMobile: { width: '48%', minWidth: 120, minHeight: 78, padding: 10, gap: 7 }, starterCardPressed: { backgroundColor: '#F8F6F2', borderColor: '#D4C8BA' }, starterIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F3F0EB', alignItems: 'center', justifyContent: 'center' }, starterIconText: { color: C.cocoa, fontSize: 17 }, starterCopy: { flex: 1 }, starterTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, starterDescription: { color: C.muted, fontSize: 10, lineHeight: 14, marginTop: 4 }, starterArrow: { color: '#6F6256', fontSize: 13, alignSelf: 'flex-start' }, conversationColumn: { width: '100%', maxWidth: 760, alignSelf: 'center' }, dayDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10, marginBottom: 24 }, dividerLine: { height: 1, backgroundColor: C.line, flex: 1 }, dayText: { color: '#75665A', fontSize: 9, letterSpacing: 1.5, fontWeight: '700' },
  connectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2ECE3', borderRadius: 16, padding: 14, marginTop: 22, marginLeft: 44, gap: 12, maxWidth: 555 }, connectIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }, connectIconText: { color: C.cocoa, fontSize: 17 }, connectCopy: { flex: 1 }, connectTitle: { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 4 }, connectBody: { fontSize: 11, color: C.muted, lineHeight: 16 }, connectArrow: { color: C.cocoa, fontSize: 24 }, promptWrap: { marginTop: 22, marginLeft: 44 }, promptHeading: { color: '#796D62', fontSize: 11, fontWeight: '600', marginBottom: 10, marginLeft: 2 }, promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, promptChip: { borderWidth: 1, borderColor: '#E3D9CD', backgroundColor: '#FBF8F3', borderRadius: 18, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center' }, promptChipText: { color: C.cocoaDark, fontSize: 11, fontWeight: '500' },
  messageRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 14 }, messageRowYou: { justifyContent: 'flex-end' }, messageBubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 }, teddyBubble: { backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderTopLeftRadius: 4 }, userBubble: { backgroundColor: C.cocoa, borderBottomRightRadius: 4 }, messageText: { color: C.ink, fontSize: 14, lineHeight: 21 }, markdownReply: { gap: 2 }, markdownStrong: { color: C.ink, fontWeight: '700' }, markdownItalic: { fontStyle: 'italic' }, markdownStrike: { textDecorationLine: 'line-through' }, markdownInlineCode: { color: '#61492F', backgroundColor: '#F2EDE4', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }, markdownLink: { color: '#76552F', textDecorationLine: 'underline' }, markdownHeading: { fontWeight: '700', marginTop: 5, marginBottom: 5 }, markdownHeadingLarge: { fontSize: 19 }, markdownListRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 }, markdownListText: { flex: 1 }, markdownFence: { color: C.ink, backgroundColor: '#F5F2ED', borderRadius: 8, padding: 10, marginVertical: 5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 18 }, markdownQuote: { borderLeftColor: '#D9B879', borderLeftWidth: 3, paddingLeft: 10, marginLeft: 0, marginVertical: 4 }, markdownRule: { height: 1, backgroundColor: C.line, marginVertical: 7 }, userMessageText: { color: C.white }, messageTime: { color: C.muted, fontSize: 9, textAlign: 'right', marginTop: 5 }, userMessageTime: { color: '#E8D9CC' }, sendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 8 }, typingBubble: { backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderRadius: 16, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 }, typingText: { color: C.muted, fontSize: 12, fontWeight: '600' }, errorBanner: { backgroundColor: '#FCE9E3', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 }, errorText: { color: '#8D473F', fontSize: 11, lineHeight: 16 }, retryButton: { alignSelf: 'flex-start', marginTop: 8, minHeight: 30, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#FFFFFF' }, retryButtonText: { color: '#8D473F', fontSize: 11, fontWeight: '700' },
  composerWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: C.canvas }, composerWrapWide: { maxWidth: 900, width: '100%', alignSelf: 'center', paddingHorizontal: 64, paddingTop: 12, paddingBottom: 18 }, composerCard: { minHeight: 68, maxWidth: 760, alignSelf: 'center', width: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDDCD6', borderRadius: 24, paddingHorizontal: 11, paddingVertical: 8, shadowColor: '#302821', shadowOpacity: 0.065, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, composerCardFocused: { borderColor: '#B49A83', shadowColor: C.cocoa, shadowOpacity: 0.14, shadowRadius: 17, shadowOffset: { width: 0, height: 0 }, elevation: 3 }, chatTools: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, maxWidth: 760, alignSelf: 'center', width: '100%', marginBottom: 7 }, chatToolButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, borderWidth: 1, borderColor: '#E7DED3', backgroundColor: '#FDFBF8', paddingHorizontal: 10 }, chatToolIcon: { color: C.cocoa, fontSize: 13 }, chatToolLabel: { color: C.cocoaDark, fontSize: 10, fontWeight: '600' }, toolIconButton: { width: 31, height: 31, borderRadius: 13, borderWidth: 1, borderColor: '#E7E5E0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }, toolIconGlyph: { color: C.cocoa, fontSize: 18, lineHeight: 22 }, attachmentRow: { minHeight: 28, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', borderRadius: 13, backgroundColor: '#F3F0EB', paddingLeft: 9, marginBottom: 6 }, attachmentRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }, attachmentRemoveText: { color: C.muted, fontSize: 18 }, attachmentText: { color: C.green, fontSize: 10, fontWeight: '600' }, composer: { minHeight: 56, maxHeight: 140, borderRadius: 20, borderWidth: 1, borderColor: '#DED4C8', backgroundColor: C.paper, flexDirection: 'row', alignItems: 'flex-end', padding: 7, paddingLeft: 16, shadowColor: '#60432F', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, composerDisabled: { opacity: 0.76 }, composerInput: { flex: 1, minWidth: 0, color: C.ink, fontSize: 14, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 7, maxHeight: 110, minHeight: 46 }, sendButton: { flexShrink: 0, width: 46, height: 46, borderRadius: 17, backgroundColor: '#B9A797', justifyContent: 'center', alignItems: 'center' }, sendButtonActive: { backgroundColor: C.cocoa }, sendButtonDisabled: { opacity: 0.72 }, sendArrowIcon: { width: 20, height: 20, position: 'relative' }, sendArrowShaft: { position: 'absolute', left: 2, top: 9, width: 15, height: 1.7, borderRadius: 1, backgroundColor: C.white, transform: [{ rotate: '-45deg' }] }, sendArrowTop: { position: 'absolute', left: 9, top: 3, width: 8, height: 1.7, borderRadius: 1, backgroundColor: C.white }, sendArrowRight: { position: 'absolute', right: 3, top: 3, width: 1.7, height: 8, borderRadius: 1, backgroundColor: C.white }, composerFootnote: { color: '#706458', fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 14 },
  bottomNav: { height: 62, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, bottomNavItem: { flex: 1, minWidth: 0, height: 54, alignItems: 'center', justifyContent: 'center', gap: 2 }, bottomIcon: { fontSize: 19, color: '#75685C', lineHeight: 22 }, bottomIconActive: { color: C.cocoa }, bottomLabel: { fontSize: 10, color: '#6F6256', fontWeight: '500' }, bottomLabelActive: { color: C.cocoaDark, fontWeight: '700' },
  pageScroll: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 32 }, pageScrollWide: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 48, paddingTop: 38 }, pageIntro: { marginBottom: 22 }, pageDescription: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 9, maxWidth: 580 }, memoryNotice: { flexDirection: 'row', gap: 12, padding: 15, borderRadius: 16, backgroundColor: '#F1E9DE', marginBottom: 27 }, noticeIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#E7DDD1', alignItems: 'center', justifyContent: 'center' }, noticeGlyph: { fontSize: 17, color: C.cocoa }, noticeCopy: { flex: 1 }, noticeTitle: { color: C.cocoaDark, fontSize: 12, fontWeight: '700', marginBottom: 4 }, noticeBody: { color: '#796D62', fontSize: 11, lineHeight: 17 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, sectionTitle: { color: '#6F6256', fontSize: 10, letterSpacing: 1.3, fontWeight: '700' }, countText: { color: C.cocoa }, addLink: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }, addLinkText: { color: C.cocoa, fontSize: 12, fontWeight: '700' }, memoryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 15, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 16, marginBottom: 10 }, memoryMark: { width: 32, height: 32, backgroundColor: C.peachLight, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, memoryMarkText: { color: C.cocoa, fontSize: 16 }, memoryCopy: { flex: 1, paddingTop: 2 }, memoryText: { color: C.ink, fontSize: 13, lineHeight: 20 }, memoryDate: { color: '#75685C', fontSize: 10, marginTop: 7 }, memoryActions: { flexDirection: 'row', gap: 3 }, memoryAction: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, memoryActionGlyph: { color: '#6E6054', fontSize: 17 }, deleteGlyph: { color: '#855748', fontSize: 22 }, memoriesFootnote: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 10 }, emptyCard: { alignItems: 'center', backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 28, marginTop: 4 }, emptyMark: { width: 46, height: 46, borderRadius: 16, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, emptyGlyph: { color: C.cocoa, fontSize: 21 }, emptyTitle: { color: C.ink, fontSize: 16, fontWeight: '700' }, emptyBody: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 280, marginTop: 7, marginBottom: 17 },
  privacyBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, backgroundColor: C.greenLight, borderRadius: 16, marginBottom: 27 }, privacyShield: { width: 35, height: 35, backgroundColor: '#D7E3D4', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, shieldGlyph: { color: C.green, fontSize: 19 }, privacyCopy: { flex: 1 }, privacyTitle: { color: '#435943', fontSize: 13, fontWeight: '700', marginBottom: 5 }, privacyBody: { color: '#65745F', fontSize: 12, lineHeight: 17 }, settingsSectionLabel: { color: '#6F6256', fontSize: 11, letterSpacing: 1.3, fontWeight: '700', marginBottom: 10, marginTop: 3 }, settingsCard: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 17, paddingHorizontal: 15, marginBottom: 23 }, settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 }, settingIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: C.paperAlt, alignItems: 'center', justifyContent: 'center' }, settingGlyph: { color: C.cocoa, fontSize: 15 }, settingText: { flex: 1 }, settingTitle: { color: C.ink, fontSize: 12, fontWeight: '700', lineHeight: 17 }, settingDescription: { color: C.muted, fontSize: 12, lineHeight: 15, marginTop: 3 }, switchHitArea: { padding: 2 }, switchTrack: { width: 42, height: 25, borderRadius: 14, padding: 3, justifyContent: 'center' }, switchThumb: { width: 19, height: 19, borderRadius: 10, backgroundColor: C.white }, settingSeparator: { height: 1, backgroundColor: C.line, marginLeft: 44 }, gatewaySection: { borderRadius: 18 }, gatewaySectionFocused: { borderWidth: 1, borderColor: '#D6BAA5', padding: 10, marginHorizontal: -10, marginBottom: 14, backgroundColor: '#F8F0E8' }, gatewayIntro: { flexDirection: 'row', gap: 11, paddingTop: 16, paddingBottom: 14 }, gatewayIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center' }, gatewayGlyph: { color: C.cocoa, fontSize: 16 }, inputLabel: { color: '#6F6256', fontSize: 11, letterSpacing: 1.1, fontWeight: '700', marginBottom: 7 }, gatewayInput: { height: 45, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: '#FDFCFA', paddingHorizontal: 12, color: C.ink, fontSize: 12 }, gatewayActions: { paddingTop: 11, paddingBottom: 15, gap: 9 }, connectionStatus: { color: C.muted, fontSize: 11, lineHeight: 15 }, connectionReady: { color: C.green }, connectionError: { color: C.rose }, clearRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 }, clearIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#F8EAE5', alignItems: 'center', justifyContent: 'center' }, clearGlyph: { color: C.rose, fontSize: 16 }, clearButton: { minHeight: 36, minWidth: 54, borderRadius: 11, borderWidth: 1, borderColor: '#E7D8D2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, clearButtonText: { color: C.rose, fontSize: 11, fontWeight: '700' }, versionText: { textAlign: 'center', color: '#6E6258', fontSize: 10, letterSpacing: 1.4, marginTop: 2, marginBottom: 16 },
  button: { minHeight: 42, backgroundColor: C.cocoa, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17 }, buttonQuiet: { backgroundColor: '#F2ECE4' }, buttonDisabled: { opacity: 0.45 }, buttonText: { color: C.white, fontSize: 11, fontWeight: '700' }, buttonTextQuiet: { color: C.cocoaDark }, pressed: { opacity: 0.75 }, disabledText: { color: '#6E6258' },
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
  crisisSupportBody: { color: '#5D3F38', fontSize: 12, lineHeight: 17 },
  crisisCallLink: { alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center', marginTop: 7, paddingHorizontal: 13, borderRadius: 12, backgroundColor: '#70483F' },
  crisisCallLinkText: { color: C.white, fontSize: 12, fontWeight: '700' },
  crisisHelplineTitle: { color: '#70483F', fontSize: 11, fontWeight: '700', marginTop: 11 },
  crisisHelplineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  crisisSupportLink: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center', marginTop: 6, paddingVertical: 4 },
  crisisSupportLinkText: { color: '#70483F', fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' },
  crisisSupportFootnote: { color: '#655149', fontSize: 10, lineHeight: 14, marginTop: 2 },
  memorySuggestionCard: { alignSelf: 'flex-start', maxWidth: '82%', backgroundColor: '#F1E9DE', borderColor: '#E5D8C6', borderWidth: 1, borderRadius: 15, padding: 13, marginTop: 9, marginLeft: 35 }, occasionWidget: { alignSelf: 'center', width: '100%', maxWidth: 650, backgroundColor: '#F1E9DE', borderColor: '#E5D8C6', borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12 }, occasionTitle: { color: C.cocoaDark, fontSize: 13, fontWeight: '700' }, occasionDescription: { color: C.muted, fontSize: 11, lineHeight: 15, marginTop: 5 }, occasionInput: { minHeight: 76, maxHeight: 140, borderWidth: 1, borderColor: '#E4D8C9', borderRadius: 12, backgroundColor: C.paper, color: C.ink, fontSize: 12, lineHeight: 17, padding: 10, marginTop: 10 }, occasionPrivacy: { color: C.muted, fontSize: 11, lineHeight: 14, marginTop: 6 },
  memorySuggestionTitle: { color: C.cocoaDark, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  memorySuggestionFact: { color: C.ink, fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 7 },
  memorySuggestionBody: { color: C.muted, fontSize: 11, lineHeight: 15, marginTop: 7 },
  memorySuggestionActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 11 },
  mobileHistoryPage: { flex: 1, paddingHorizontal: 20, paddingTop: 26, paddingBottom: 20 },
  historyPageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  mobileHistoryList: { flex: 1, marginTop: 12 },
  profileTextButton: { width: 'auto', minWidth: 66, paddingHorizontal: 10 },
  settingsCardForm: { width: '100%', backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 16, marginBottom: 20, gap: 10 },
  characterChoices: { gap: 8, marginVertical: 4 },
  characterChoice: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line, backgroundColor: '#FDFCFA', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  characterChoiceSelected: { borderColor: '#B89668', backgroundColor: '#F8F0E5' },
  characterChoiceIcon: { width: 38, height: 38, lineHeight: 38, textAlign: 'center', borderRadius: 12, backgroundColor: '#F2E9DC', fontSize: 23, overflow: 'hidden' },
  characterChoiceCopy: { flex: 1, gap: 3 },
  characterChoiceName: { color: C.ink, fontSize: 13, fontWeight: '700' },
  characterChoiceTagline: { color: C.muted, fontSize: 11 },
  characterChoiceCheck: { color: C.cocoa, fontSize: 17, fontWeight: '700', paddingHorizontal: 4 },
  formLabel: { color: C.ink, fontSize: 12, fontWeight: '700' },
  aboutMeInput: { width: '100%', minHeight: 128, maxHeight: 240, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: '#FDFCFA', padding: 12, color: C.ink, fontSize: 13, lineHeight: 19 },
  settingsTextInput: { width: '100%', minHeight: 44, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: '#FDFCFA', paddingHorizontal: 12, color: C.ink, fontSize: 13 },
  backupPassphraseInput: { marginTop: 6 },
  backupActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  backupStatus: { color: C.green, fontSize: 11, lineHeight: 16 },
  backupFootnote: { color: C.muted, fontSize: 10, lineHeight: 15 },
  chatPinnedIcon: { fontSize: 11 },
  headerTextButton: { minHeight: 38, borderRadius: 13, backgroundColor: '#F1F1EE', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  headerActionLabel: { color: C.ink, fontSize: 11, fontWeight: '600' },
  memoryActionTextButton: { minHeight: 32, minWidth: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  memoryActionText: { color: '#76695E', fontSize: 10, fontWeight: '600' },
  typingIndicator: { minWidth: 48, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderRadius: 16, borderTopLeftRadius: 4, paddingHorizontal: 12 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(45, 36, 29, 0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 }, modalCard: { width: '100%', maxWidth: 460, backgroundColor: C.paper, borderRadius: 22, padding: 22 }, modalTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, modalIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center' }, modalIconText: { color: C.cocoa, fontSize: 18 }, closeButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paperAlt }, closeText: { color: C.muted, fontSize: 22, lineHeight: 24 }, modalTitle: { color: C.ink, fontWeight: '700', fontSize: 20, letterSpacing: -0.4 }, modalBody: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 16 }, memoryInput: { minHeight: 100, maxHeight: 180, backgroundColor: '#F9F6F1', borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 13, color: C.ink, fontSize: 13, lineHeight: 19 }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 17 }, suggestedFact: { color: C.ink, fontSize: 15, lineHeight: 22, fontWeight: '600', backgroundColor: '#F9F6F1', borderRadius: 14, padding: 13, marginTop: 12 }, historyCard: { width: '100%', maxWidth: 560, maxHeight: '85%', backgroundColor: C.paper, borderRadius: 22, padding: 22 }, historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 }, historyList: { maxHeight: 430, marginTop: 14 }, historyItemWrap: { position: 'relative', width: '100%', minWidth: 0, marginBottom: 6 }, historyItem: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3, paddingHorizontal: 4, paddingVertical: 4, borderRadius: 13, borderWidth: 1, borderColor: 'transparent' }, historyItemOpen: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, borderRadius: 10 }, historyItemSelected: { backgroundColor: '#F2E5C9', borderColor: '#D9B879' }, chatMenuTrigger: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, chatMenuDots: { color: C.muted, fontSize: 16, fontWeight: '700', letterSpacing: 1 }, chatActionMenu: { backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 5, marginHorizontal: 5, marginTop: -1, shadowColor: '#302821', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, chatActionItem: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 8 }, chatActionText: { color: C.ink, fontSize: 12, fontWeight: '500' }, chatActionDelete: { backgroundColor: '#FCF5F2' }, chatActionDeleteText: { color: C.rose }, historyItemCopy: { flex: 1, minWidth: 0 }, historyItemTitle: { color: C.ink, fontSize: 13, fontWeight: '700' }, historyItemTitleSelected: { color: '#5A422C' }, historyItemPreview: { color: C.muted, fontSize: 11, marginTop: 5 }, historyEmpty: { textAlign: 'center', color: C.muted, fontSize: 12, lineHeight: 19, padding: 20 }, memorySuggestionError: { color: C.rose, fontSize: 11, lineHeight: 16, paddingHorizontal: 8, paddingVertical: 8 },
  stopButton: { backgroundColor: '#7B453E' },
  stopIcon: { width: 15, height: 15, borderRadius: 3, backgroundColor: C.white },
});

export default App;
