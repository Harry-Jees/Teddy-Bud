import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import {
  Alert,
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
import type { StoredSession } from './src/services/deviceAuth';
import { localDataService, ownerFromToken } from './src/services/localData';
import teddyBudLogoAsset from './assets/teddy-bud-logo.png';

type Page = 'chat' | 'memories' | 'privacy';
type Memory = { id: number; text: string; date: string };
type Message = { id: number; text: string; author: 'you' | 'teddy'; time: string };

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
      ? callback.pathname === '/auth/callback'
      : callback.protocol === 'teddybud:' && callback.hostname === 'auth' && callback.pathname === '/callback';
  } catch {
    return false;
  }
}

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={C.canvas} />
      <AccessGate />
    </SafeAreaProvider>
  );
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
          ? typeof window !== 'undefined' && window.location.pathname === '/auth/callback' ? window.location.href : null
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
        void browserAuthService.consumeCallback(url).then(next => {
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
  if (!session) return <BrowserLoginScreen error={error} onLogin={next => { setError(null); setSession(next); }} />;
  return <TeddyBud sessionToken={session.accessToken} onLogout={() => {
    void browserAuthService.logout().then(() => setSession(null)).catch(logoutError => {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to end the server session.');
      setSession(null);
    });
  }} />;
}

function AuthLoading() {
  return <View style={styles.authScreen}><View style={styles.brandMark}><Image source={teddyBudLogo} style={styles.brandLogo} accessibilityLabel="Teddy Bud" /></View><Text style={styles.authTitle}>Opening your private space…</Text><Text style={styles.authBody}>Checking your secure session.</Text></View>;
}

function BrowserLoginScreen({ error, onLogin }: { error: string | null; onLogin: (session: StoredSession) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(() => browserAuthService.getRememberedEmail());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signupSent, setSignupSent] = useState(false);
  const [signupOtp, setSignupOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const validLogin = validEmail && password.length > 0;
  const validSignup = fullName.trim().length > 0 && fullName.trim().length <= 100
    && validEmail && password.length >= 8 && password.length <= 128 && password === confirmPassword;

  const submitSignup = async () => {
    if (!validSignup || submitting) return;
    setSubmitting(true); setFormError(null);
    try {
      await browserAuthService.beginSignup(fullName, email, password);
      setSignupSent(true);
    } catch (signupError) {
      setFormError(signupError instanceof Error ? signupError.message : 'Unable to create your account.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitLogin = async () => {
    if (!validLogin || submitting) return;
    setSubmitting(true); setFormError(null);
    try {
      onLogin(await browserAuthService.login(email, password));
    } catch (loginError) {
      setFormError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

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

  const submitSignupOtp = async () => {
    if (!/^\d{6,10}$/.test(signupOtp.trim()) || submitting) return;
    setSubmitting(true); setFormError(null);
    try {
      onLogin(await browserAuthService.verifySignupOtp(email, signupOtp));
    } catch (verificationError) {
      setFormError(verificationError instanceof Error ? verificationError.message : 'Unable to verify your email code.');
    } finally {
      setSubmitting(false);
    }
  };

  const resendSignupOtp = async () => {
    if (submitting) return;
    setSubmitting(true); setFormError(null);
    try {
      await browserAuthService.resendSignupOtp(email);
      setSignupOtp('');
    } catch (resendError) {
      setFormError(resendError instanceof Error ? resendError.message : 'Unable to resend your email code.');
    } finally {
      setSubmitting(false);
    }
  };

  return <View style={styles.authScreen}>
    <View style={styles.authCard}>
      <View style={styles.authMark}><Image source={teddyBudLogo} style={styles.authLogo} accessibilityLabel="Teddy Bud" /></View>
      <Text style={styles.authEyebrow}>TEDDY BUD</Text>
      <Text style={styles.authTitle}>{mode === 'signup' ? 'Create your private space.' : 'A little room to breathe.'}</Text>
      <Text style={styles.authBody}>{signupSent ? 'Enter the verification code sent to your email to finish creating your account.' : mode === 'signup' ? 'Create an account with your email and password. Enter the code we email you to verify your address.' : 'Sign in with your email and password.'}</Text>
      {(error || formError) && <View style={styles.authError}><Text style={styles.authErrorText}>{formError || error}</Text></View>}
      {!signupSent && <>
        <Pressable accessibilityRole="button" disabled={submitting} onPress={submitGoogleLogin} style={({ pressed }) => [styles.googleAuthButton, submitting && styles.buttonDisabled, pressed && styles.pressed]}><Text style={styles.googleAuthButtonText}>{submitting ? 'Opening Google…' : 'Continue with Google'}</Text></Pressable>
        <Text style={styles.authDivider}>OR CONTINUE WITH EMAIL</Text>
      </>}
      {signupSent ? <>
        <Text style={styles.authBody}>Check your inbox at {email.trim()} for a one-time verification code.</Text>
        <TextInput value={signupOtp} onChangeText={value => setSignupOtp(value.replace(/\D/g, '').slice(0, 10))} autoCapitalize="none" keyboardType="number-pad" placeholder="Email verification code" placeholderTextColor={C.muted} style={styles.authInput} accessibilityLabel="Email verification code" />
        <Pressable accessibilityRole="button" disabled={!/^\d{6,10}$/.test(signupOtp.trim()) || submitting} onPress={submitSignupOtp} style={({ pressed }) => [styles.authButton, (!/^\d{6,10}$/.test(signupOtp.trim()) || submitting) && styles.buttonDisabled, pressed && styles.pressed]}><Text style={styles.authButtonText}>{submitting ? 'Verifying…' : 'Verify email'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={submitting} onPress={resendSignupOtp} style={styles.authToggle}><Text style={styles.authToggleText}>{submitting ? 'Sending…' : 'Resend code'}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setMode('login'); setSignupSent(false); setSignupOtp(''); setPassword(''); setConfirmPassword(''); setFormError(null); }} style={styles.authToggle}><Text style={styles.authToggleText}>Back to sign in</Text></Pressable>
      </> : mode === 'signup' ? <>
        <TextInput value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" placeholder="Full name" placeholderTextColor={C.muted} style={styles.authInput} accessibilityLabel="Full name" />
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email address" placeholderTextColor={C.muted} style={styles.authInput} accessibilityLabel="Email address" />
        <TextInput value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="new-password" secureTextEntry placeholder="Password (at least 8 characters)" placeholderTextColor={C.muted} style={styles.authInput} accessibilityLabel="Password" />
        <TextInput value={confirmPassword} onChangeText={setConfirmPassword} autoCapitalize="none" autoComplete="new-password" secureTextEntry placeholder="Confirm password" placeholderTextColor={C.muted} style={styles.authInput} accessibilityLabel="Confirm password" />
        <Pressable accessibilityRole="button" disabled={!validSignup || submitting} onPress={submitSignup} style={({ pressed }) => [styles.authButton, (!validSignup || submitting) && styles.buttonDisabled, pressed && styles.pressed]}><Text style={styles.authButtonText}>{submitting ? 'Creating account…' : 'Create account'}</Text></Pressable>
        <Text style={styles.authFootnote}>Supabase securely handles your password and emails a one-time verification code.</Text>
        <Pressable accessibilityRole="button" onPress={() => { setMode('login'); setFormError(null); }} style={styles.authToggle}><Text style={styles.authToggleText}>Already have an account? Sign in</Text></Pressable>
      </> : <>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email address" placeholderTextColor={C.muted} style={styles.authInput} accessibilityLabel="Email address" />
        <TextInput value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="current-password" secureTextEntry placeholder="Password" placeholderTextColor={C.muted} style={styles.authInput} accessibilityLabel="Password" />
        <Pressable accessibilityRole="button" disabled={!validLogin || submitting} onPress={submitLogin} style={({ pressed }) => [styles.authButton, (!validLogin || submitting) && styles.buttonDisabled, pressed && styles.pressed]}><Text style={styles.authButtonText}>{submitting ? 'Signing in…' : 'Sign in'}</Text></Pressable>
        <Text style={styles.authFootnote}>New to Teddy Bud? Create an account and confirm your email once.</Text>
        <Pressable accessibilityRole="button" onPress={() => { setMode('signup'); setPassword(''); setFormError(null); }} style={styles.authToggle}><Text style={styles.authToggleText}>Create an account</Text></Pressable>
      </>}
    </View>
  </View>;
}

function TeddyBud({ sessionToken, onLogout }: { sessionToken: string; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 800;
  const [page, setPage] = useState<Page>('chat');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [memoryModal, setMemoryModal] = useState(false);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [rememberInSession, setRememberInSession] = useState(true);
  const [shareMemories, setShareMemories] = useState(false);
  const [localDataReady, setLocalDataReady] = useState(false);
  const [localDataError, setLocalDataError] = useState<string | null>(null);
  const [localDataRetry, setLocalDataRetry] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [enableWebBrowsing, setEnableWebBrowsing] = useState(false);
  const [codingMode, setCodingMode] = useState(false);

  const title = useMemo(() => navItems.find(item => item.id === page)?.label ?? 'Your space', [page]);
  const owner = useMemo(() => ownerFromToken(sessionToken), [sessionToken]);

  useEffect(() => {
    let active = true;
    setLocalDataReady(false);
    setLocalDataError(null);
    localDataService.load(owner).then(data => {
      if (!active) return;
      setMessages(data.messages);
      setMemories(data.memories);
      setRememberInSession(data.rememberInSession);
      setShareMemories(data.shareMemories);
      setLocalDataReady(true);
    }).catch(error => {
      if (active) setLocalDataError(error instanceof Error ? error.message : 'Could not load private data saved on this device.');
    });
    return () => { active = false; };
  }, [owner, localDataRetry]);

  useEffect(() => {
    if (!localDataReady) return;
    localDataService.save(owner, {
      messages,
      memories,
      rememberInSession,
      shareMemories,
    }).then(() => {
      setLocalDataError(null);
    }).catch(error => {
      setLocalDataError(error instanceof Error ? error.message : 'Could not save private data on this device.');
    });
  }, [localDataReady, owner, messages, memories, rememberInSession, shareMemories]);

  const changeMemoryPreference = (enabled: boolean) => {
    setRememberInSession(enabled);
    if (!enabled) setMemories([]);
  };

  const openMemory = (memory?: Memory) => {
    setEditing(memory ?? null);
    setMemoryDraft(memory?.text ?? '');
    setMemoryModal(true);
  };

  const saveMemory = () => {
    const value = memoryDraft.trim();
    if (!value) return;
    if (!editing && memories.length >= 50) {
      Alert.alert('Memory limit reached', 'You can keep up to 50 memories on this device.');
      return;
    }
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

  const startNewConversation = () => {
    if (messages.length === 0) {
      setDraft('');
      setChatError(null);
      setRetryMessage(null);
      setImageDataUrl(null);
      return;
    }
    confirmAction(
      'Start a new chat?',
      'This clears the current conversation from this device. Your saved memories and settings stay just as they are.',
      () => {
        setMessages([]);
        setDraft('');
        setChatError(null);
        setRetryMessage(null);
        setImageDataUrl(null);
      },
    );
  };

  const confirmClear = () => confirmAction(
    'Clear local data?',
    'This removes the messages and memories saved on this device.',
    () => {
      void localDataService.clear(owner).then(() => {
        setMessages([]);
        setMemories([]);
        setDraft('');
        setRetryMessage(null);
        setChatError(null);
        setLocalDataError(null);
        setLocalDataReady(true);
      }).catch(error => {
        setLocalDataError(error instanceof Error ? error.message : 'Could not clear local data.');
      });
    },
  );

  const clearUnavailableLocalData = () => confirmAction(
    'Clear local data and start over?',
    'This permanently removes the saved messages and memories for this account from this device.',
    () => {
      localDataService.clear(owner).then(() => {
        setMessages([]);
        setMemories([]);
        setRememberInSession(true);
        setShareMemories(false);
        setLocalDataError(null);
        setLocalDataReady(true);
      }).catch(error => {
        setLocalDataError(error instanceof Error ? error.message : 'Could not clear local data.');
      });
    },
  );

  const retryLocalData = async () => {
    setLocalDataError(null);
    if (!localDataReady) {
      setLocalDataRetry(current => current + 1);
      return;
    }
    try {
      await localDataService.save(owner, { messages, memories, rememberInSession, shareMemories });
    } catch (error) {
      setLocalDataError(error instanceof Error ? error.message : 'Could not save private data on this device.');
    }
  };

  const sendMessage = async (messageToRetry?: string) => {
    const text = messageToRetry ?? draft.trim();
    if (!text || isSending) return;

    const userMessage: Message = {
      id: Date.now(),
      text,
      author: 'you',
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };

    if (!messageToRetry) setMessages(current => [...current, userMessage].slice(-200));
    setDraft('');
    setIsSending(true);
    setChatError(null);

    try {
      const history = messageToRetry ? messages.slice(0, -1) : messages;
      const responseText = await gatewayService.sendChatMessage(text, history.map(message => ({
        role: message.author === 'you' ? 'user' : 'assistant',
        content: message.text,
      })), sessionToken, {
        imageDataUrl: imageDataUrl ?? undefined,
        enableWebBrowsing,
        task: codingMode ? 'coding' : imageDataUrl ? 'vision' : 'conversation',
        memories: rememberInSession && shareMemories ? memories.map(memory => memory.text) : [],
      });

      const assistantMessage: Message = {
        id: Date.now() + 1,
        text: responseText,
        author: 'teddy',
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      };

      setMessages(current => [...current, assistantMessage].slice(-200));
      setRetryMessage(null);
    } catch (error) {
      if ((error as { status?: number }).status === 401 && !(await browserAuthService.restore())) {
        onLogout();
        return;
      }
      const message = error instanceof Error ? error.message : 'The conversation service is unavailable right now.';
      setChatError(message);
      setRetryMessage(text);
    } finally {
      setImageDataUrl(null);
      setIsSending(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: wide ? insets.bottom : 0 }]}>
      {wide && <Sidebar page={page} onNavigate={setPage} onNewConversation={startNewConversation} />}
      <View style={styles.main}>
        <View style={[styles.topbar, !wide && styles.mobileTopbar]}>
          <View style={styles.brandMark}><Image source={teddyBudLogo} style={styles.brandLogo} accessibilityLabel="Teddy Bud" /></View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>teddy bud</Text>
            {!wide && <Text style={styles.brandSub}>{title}</Text>}
          </View>
          {wide && <Text style={styles.topbarContext}>{title}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel="Open privacy settings" onPress={() => setPage('privacy')} style={styles.profileButton}>
            <Text style={styles.profileInitial}>TB</Text>
          </Pressable>
        </View>

        <View style={styles.contentArea}>
          {localDataError ? <LocalDataError error={localDataError} onRetry={retryLocalData} onClear={clearUnavailableLocalData} /> : !localDataReady ? <LocalDataLoading /> : <>
          {page === 'chat' && <ChatPage wide={wide} messages={messages} draft={draft} setDraft={setDraft} onSend={sendMessage} onRetry={() => retryMessage && sendMessage(retryMessage)} retryPending={Boolean(retryMessage)} onClear={confirmClear} onNewConversation={startNewConversation} isSending={isSending} chatError={chatError} imageAttached={Boolean(imageDataUrl)} onAttachImage={(dataUrl) => setImageDataUrl(dataUrl)} onRemoveImage={() => setImageDataUrl(null)} enableWebBrowsing={enableWebBrowsing} setEnableWebBrowsing={setEnableWebBrowsing} codingMode={codingMode} setCodingMode={setCodingMode} />}
          {page === 'memories' && <MemoriesPage wide={wide} memories={memories} memoryEnabled={rememberInSession} onAdd={() => openMemory()} onEdit={openMemory} onDelete={removeMemory} />}
          {page === 'privacy' && <PrivacyPage wide={wide} rememberInSession={rememberInSession} setRememberInSession={changeMemoryPreference} shareMemories={shareMemories} setShareMemories={setShareMemories} onClear={confirmClear} onLogout={onLogout} />}
          </>}
        </View>
        {!wide && <BottomNav page={page} onNavigate={setPage} bottomInset={insets.bottom} />}
      </View>

      <Modal visible={memoryModal} animationType="fade" transparent onRequestClose={() => setMemoryModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTopline}>
              <View style={styles.modalIcon}><Text style={styles.modalIconText}>✳</Text></View>
              <Pressable onPress={() => setMemoryModal(false)} accessibilityRole="button" accessibilityLabel="Close" style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
            <Text style={styles.modalTitle}>{editing ? 'Edit a memory' : 'Keep a small thing in mind'}</Text>
            <Text style={styles.modalBody}>Add a detail to keep on this device. It is only sent with chat when you enable memory sharing in Privacy.</Text>
            <TextInput autoFocus value={memoryDraft} onChangeText={setMemoryDraft} placeholder="Write a gentle reminder…" placeholderTextColor={C.muted} multiline maxLength={180} style={styles.memoryInput} textAlignVertical="top" />
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

function LocalDataLoading() {
  return <View style={styles.authScreen}><Text style={styles.authTitle}>Opening your saved space…</Text><Text style={styles.authBody}>Loading data stored on this device.</Text></View>;
}

function LocalDataError({ error, onRetry, onClear }: { error: string; onRetry: () => void; onClear: () => void }) {
  return <View style={styles.authScreen}><View style={styles.authCard}><Text style={styles.authTitle}>Your saved space needs attention.</Text><Text style={styles.authBody}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.authButton, pressed && styles.pressed]}><Text style={styles.authButtonText}>Retry local storage</Text></Pressable><Pressable accessibilityRole="button" onPress={onClear} style={styles.authToggle}><Text style={styles.authToggleText}>Clear local data and start over</Text></Pressable><Text style={styles.authFootnote}>Your messages are paused until local storage is available.</Text></View></View>;
}

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: onConfirm },
  ]);
}

function Sidebar({ page, onNavigate, onNewConversation }: { page: Page; onNavigate: (page: Page) => void; onNewConversation: () => void }) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarBrand}>
        <View style={styles.brandMark}><Image source={teddyBudLogo} style={styles.brandLogo} accessibilityLabel="Teddy Bud" /></View>
        <View><Text style={styles.brandName}>teddy bud</Text><Text style={styles.sidebarCaption}>A little room to breathe</Text></View>
      </View>
      <Pressable accessibilityRole="button" onPress={onNewConversation} style={({ pressed }) => [styles.newChatButton, pressed && styles.pressed]}>
        <Text style={styles.newChatGlyph}>＋</Text><Text style={styles.newChatLabel}>New chat</Text>
      </Pressable>
      <Text style={styles.sidebarLabel}>YOUR SPACE</Text>
      {navItems.map(item => <NavButton key={item.id} item={item} selected={item.id === page} onPress={() => onNavigate(item.id)} />)}
      <View style={styles.sidebarBottom}>
        <View style={styles.sidebarRule} />
        <Pressable accessibilityRole="button" onPress={() => onNavigate('privacy')} style={({ pressed }) => [styles.accountCard, pressed && styles.pressed]}>
          <View style={styles.accountAvatar}><Text style={styles.accountAvatarText}>TB</Text></View>
          <View style={styles.accountCopy}><Text style={styles.accountTitle}>Your private space</Text><Text style={styles.accountSubtitle}>Privacy & settings</Text></View>
          <Text style={styles.accountArrow}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NavButton({ item, selected, onPress }: { item: (typeof navItems)[number]; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.navButton, selected && styles.navButtonSelected, pressed && styles.pressed]}>
    <Text style={[styles.navIcon, selected && styles.navIconSelected]}>{item.icon}</Text><Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{item.label}</Text>
    {selected && <View style={styles.navDot} />}
  </Pressable>;
}

function BottomNav({ page, onNavigate, bottomInset }: { page: Page; onNavigate: (page: Page) => void; bottomInset: number }) {
  return <View style={[styles.bottomNav, { paddingBottom: Math.max(bottomInset, 8) }]}>{navItems.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === page }} onPress={() => onNavigate(item.id)} style={styles.bottomNavItem}>
    <Text style={[styles.bottomIcon, item.id === page && styles.bottomIconActive]}>{item.icon}</Text><Text style={[styles.bottomLabel, item.id === page && styles.bottomLabelActive]}>{item.label}</Text>
  </Pressable>)}</View>;
}

function ChatPage({ wide, messages, draft, setDraft, onSend, onRetry, retryPending, onClear, onNewConversation, isSending, chatError, imageAttached, onAttachImage, onRemoveImage, enableWebBrowsing, setEnableWebBrowsing, codingMode, setCodingMode }: { wide: boolean; messages: Message[]; draft: string; setDraft: (value: string) => void; onSend: () => void; onRetry: () => void; retryPending: boolean; onClear: () => void; onNewConversation: () => void; isSending: boolean; chatError: string | null; imageAttached: boolean; onAttachImage: (dataUrl: string) => void; onRemoveImage: () => void; enableWebBrowsing: boolean; setEnableWebBrowsing: (value: boolean) => void; codingMode: boolean; setCodingMode: (value: boolean) => void }) {
  const canSend = !!draft.trim() && !isSending && !retryPending;
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [messages.length, isSending]);
  const chooseImage = () => {
    if (codingMode) { Alert.alert('Code mode is on', 'Turn off Code mode before attaching an image.'); return; }
    if (Platform.OS !== 'web') { Alert.alert('Image understanding', 'Image attachments are currently available in the web build.'); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => { const file = input.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { setTimeout(() => Alert.alert('Image too large', 'Please choose an image smaller than 10 MB.'), 0); return; } const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === 'string') onAttachImage(reader.result); }; reader.readAsDataURL(file); };
    input.click();
  };
  return <KeyboardAvoidingView style={styles.chatPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[styles.chatHeader, wide && styles.chatHeaderWide]}>
      <View style={styles.chatHeaderCopy}><Text style={styles.eyebrow}>YOUR SPACE</Text><Text style={styles.pageTitle}>A little room to breathe</Text></View>
      <View style={styles.headerActions}>{wide && <View style={styles.privatePill}><View style={styles.privateDot} /><Text style={styles.privateLabel}>Saved on this device</Text></View>}<Pressable accessibilityRole="button" accessibilityLabel="Clear local data" onPress={onClear} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}><Text style={styles.moreGlyph}>···</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Start a new chat" onPress={onNewConversation} style={({ pressed }) => [styles.headerNewChat, pressed && styles.pressed]}><Text style={styles.headerNewChatGlyph}>＋</Text>{wide && <Text style={styles.headerNewChatLabel}>New chat</Text>}</Pressable></View>
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
        {messages.map(message => <View key={message.id} style={[styles.messageRow, message.author === 'you' && styles.messageRowYou]}>
          {message.author === 'teddy' && <View style={styles.teddyAvatarSmall}><Text style={styles.teddyAvatarText}>tb</Text></View>}
          <View style={[styles.messageBubble, message.author === 'you' ? styles.userBubble : styles.teddyBubble]}><Text style={[styles.messageText, message.author === 'you' && styles.userMessageText]}>{message.text}</Text><Text style={[styles.messageTime, message.author === 'you' && styles.userMessageTime]}>{message.time}</Text></View>
        </View>)}
        {isSending && <View style={styles.sendingRow}><View style={styles.teddyAvatarSmall}><Text style={styles.teddyAvatarText}>tb</Text></View><View style={styles.typingBubble}><Text style={styles.typingText}>Thinking…</Text></View></View>}
        {chatError && <View style={styles.errorBanner}><Text style={styles.errorText}>{chatError}</Text>{retryPending && <Pressable accessibilityRole="button" onPress={onRetry} disabled={isSending} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></Pressable>}</View>}
      </View>}
    </ScrollView>
    <View style={[styles.composerWrap, wide && styles.composerWrapWide]}>
      <View style={styles.composerCard}>
        {!!imageAttached && <View style={styles.attachmentRow}><Text style={styles.attachmentText}>Image attached</Text><Pressable accessibilityRole="button" accessibilityLabel="Remove attached image" onPress={onRemoveImage} style={styles.attachmentRemove}><Text style={styles.attachmentRemoveText}>×</Text></Pressable></View>}
        <TextInput value={draft} onChangeText={setDraft} placeholder="Message Teddy Bud…" placeholderTextColor={C.muted} multiline maxLength={2000} style={styles.composerInput} accessibilityLabel="Write a message" />
        <View style={styles.composerBottomRow}>
          <View style={styles.chatTools}>
            <Pressable accessibilityRole="button" accessibilityLabel="Attach an image" onPress={chooseImage} disabled={isSending} style={({ pressed }) => [styles.toolIconButton, pressed && styles.pressed]}><Text style={styles.toolIconGlyph}>＋</Text></Pressable>
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: enableWebBrowsing }} onPress={() => setEnableWebBrowsing(!enableWebBrowsing)} disabled={isSending || codingMode} style={[styles.toolButton, enableWebBrowsing && styles.toolButtonActive]}><Text style={[styles.toolButtonText, enableWebBrowsing && styles.toolButtonTextActive]}>◎ Browse</Text></Pressable>
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: codingMode }} onPress={() => { setCodingMode(!codingMode); if (!codingMode) { setEnableWebBrowsing(false); onRemoveImage(); } }} disabled={isSending} style={[styles.toolButton, codingMode && styles.toolButtonActive]}><Text style={[styles.toolButtonText, codingMode && styles.toolButtonTextActive]}>⌘ Code</Text></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Send message" onPress={onSend} disabled={!canSend} style={({ pressed }) => [styles.sendButton, canSend && styles.sendButtonActive, pressed && styles.pressed]}><Text style={[styles.sendGlyph, canSend && styles.sendGlyphActive]}>{isSending ? '…' : '↑'}</Text></Pressable>
        </View>
      </View>
      {wide && <Text style={styles.composerFootnote}>{isSending ? 'Sending to the companion service…' : 'Your conversation is saved on this device.'}</Text>}
    </View>
  </KeyboardAvoidingView>;
}

function StarterCard({ icon, title, description, onPress, wide }: { icon: string; title: string; description: string; onPress: () => void; wide: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.starterCard, !wide && styles.starterCardMobile, pressed && styles.starterCardPressed]}>
    <View style={styles.starterIcon}><Text style={styles.starterIconText}>{icon}</Text></View>
    <View style={styles.starterCopy}><Text style={styles.starterTitle}>{title}</Text><Text style={styles.starterDescription}>{description}</Text></View>
    <Text style={styles.starterArrow}>↗</Text>
  </Pressable>;
}

function MemoriesPage({ wide, memories, memoryEnabled, onAdd, onEdit, onDelete }: { wide: boolean; memories: Memory[]; memoryEnabled: boolean; onAdd: () => void; onEdit: (memory: Memory) => void; onDelete: (memory: Memory) => void }) {
  return <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]}>
    <View style={styles.pageIntro}><Text style={styles.eyebrow}>THE THINGS THAT MATTER</Text><Text style={styles.pageTitle}>Your memories</Text><Text style={styles.pageDescription}>Little details you choose to keep close. You can change or forget any of them, whenever you like.</Text></View>
    <View style={styles.memoryNotice}><View style={styles.noticeIcon}><Text style={styles.noticeGlyph}>⌑</Text></View><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>{memoryEnabled ? 'Saved on this device' : 'Saved memories are off'}</Text><Text style={styles.noticeBody}>{memoryEnabled ? 'Memories stay in this app’s local database across restarts. They are not sent with chats unless memory sharing is enabled in Privacy.' : 'Turn on “Keep memories on this device” in Privacy settings to add memories.'}</Text></View></View>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>SAVED MEMORIES <Text style={styles.countText}>{memories.length}</Text></Text><Pressable accessibilityRole="button" disabled={!memoryEnabled} onPress={onAdd} style={styles.addLink}><Text style={[styles.addLinkText, !memoryEnabled && styles.disabledText]}>{memoryEnabled ? '＋ Add a memory' : 'Memory is off'}</Text></Pressable></View>
    {memories.length ? memories.map(memory => <View key={memory.id} style={styles.memoryCard}><View style={styles.memoryMark}><Text style={styles.memoryMarkText}>✳</Text></View><View style={styles.memoryCopy}><Text style={styles.memoryText}>{memory.text}</Text><Text style={styles.memoryDate}>{memory.date}</Text></View><View style={styles.memoryActions}><Pressable accessibilityRole="button" accessibilityLabel="Edit memory" onPress={() => onEdit(memory)} style={styles.memoryAction}><Text style={styles.memoryActionGlyph}>✎</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Forget memory" onPress={() => onDelete(memory)} style={styles.memoryAction}><Text style={styles.deleteGlyph}>×</Text></Pressable></View></View>) : <View style={styles.emptyCard}><View style={styles.emptyMark}><Text style={styles.emptyGlyph}>✳</Text></View><Text style={styles.emptyTitle}>{memoryEnabled ? 'A fresh page' : 'Memories are off'}</Text><Text style={styles.emptyBody}>{memoryEnabled ? 'Nothing saved right now. Add a small detail you’d like to hold onto.' : 'Turn on “Keep memories on this device” in Privacy settings when you are ready.'}</Text>{memoryEnabled && <Button label="Add your first memory" onPress={onAdd} />}</View>}
    {!!memories.length && <Text style={styles.memoriesFootnote}>Your memories are yours. Edit them, remove them, or clear local data from this device at any time.</Text>}
  </ScrollView>;
}

function PrivacyPage({ wide, rememberInSession, setRememberInSession, shareMemories, setShareMemories, onClear, onLogout }: { wide: boolean; rememberInSession: boolean; setRememberInSession: (value: boolean) => void; shareMemories: boolean; setShareMemories: (value: boolean) => void; onClear: () => void; onLogout: () => void }) {
  return <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]}>
    <View style={styles.pageIntro}><Text style={styles.eyebrow}>YOUR CHOICES, ALWAYS</Text><Text style={styles.pageTitle}>Privacy & settings</Text><Text style={styles.pageDescription}>A few clear controls for what happens in your space.</Text></View>
    <View style={styles.privacyBanner}><View style={styles.privacyShield}><Text style={styles.shieldGlyph}>⌑</Text></View><View style={styles.privacyCopy}><Text style={styles.privacyTitle}>You’re in control here</Text><Text style={styles.privacyBody}>{Platform.OS === 'web' ? 'Chat history and saved memories are stored in this browser’s local database, which is not encrypted by Teddy Bud. Messages you send are sent to the configured AI gateway.' : 'Chat history and saved memories are stored in an encrypted local database on this device. Its encryption key is held in platform secure storage. Messages you send are sent to the configured AI gateway.'} Saved memories are included only while “Share relevant memories” is on.</Text></View></View>
    <Text style={styles.settingsSectionLabel}>LOCAL STORAGE</Text>
    <View style={styles.settingsCard}>
      <SettingRow icon="✳" title="Keep memories on this device" description="Save memories locally across app restarts. Turning this off removes saved memories." value={rememberInSession} onChange={setRememberInSession} />
      <View style={styles.settingSeparator} />
      <SettingRow icon="↗" title="Share relevant memories" description="When on, your saved memory notes are sent with chat messages to the AI provider." value={shareMemories} onChange={setShareMemories} />
    </View>
    <Text style={styles.settingsSectionLabel}>DATA</Text>
    <View style={styles.settingsCard}>
      <View style={styles.clearRow}><View style={styles.clearIcon}><Text style={styles.clearGlyph}>⌫</Text></View><View style={styles.settingText}><Text style={styles.settingTitle}>Clear local data</Text><Text style={styles.settingDescription}>Remove saved chat history and memories from this device.</Text></View><Pressable accessibilityRole="button" onPress={onClear} style={styles.clearButton}><Text style={styles.clearButtonText}>Clear</Text></Pressable></View>
    </View>
    <View style={styles.settingsCard}><View style={styles.clearRow}><View style={styles.settingText}><Text style={styles.settingTitle}>Sign out</Text><Text style={styles.settingDescription}>Remove this device registration and secure session.</Text></View><Pressable accessibilityRole="button" onPress={onLogout} style={styles.clearButton}><Text style={styles.clearButtonText}>Sign out</Text></Pressable></View></View>
    <Text style={styles.versionText}>TEDDY BUD  ·  PRIVATE BY DESIGN</Text>
  </ScrollView>;
}

function SettingRow({ icon, title, description, value, onChange }: { icon: string; title: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.settingRow}><View style={styles.settingIcon}><Text style={styles.settingGlyph}>{icon}</Text></View><View style={styles.settingText}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDescription}>{description}</Text></View><Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={title} onPress={() => onChange(!value)} style={[styles.switchTrack, value && styles.switchOn]}><View style={[styles.switchThumb, value && styles.switchThumbOn]} /></Pressable></View>;
}

function Button({ label, onPress, tone = 'primary', disabled = false }: { label: string; onPress: () => void; tone?: 'primary' | 'quiet'; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, tone === 'quiet' && styles.buttonQuiet, disabled && styles.buttonDisabled, pressed && styles.pressed]}><Text style={[styles.buttonText, tone === 'quiet' && styles.buttonTextQuiet]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
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
  authScreen: { flex: 1, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center', padding: 24 }, authCard: { width: '100%', maxWidth: 440, backgroundColor: C.paper, borderRadius: 28, padding: 30, borderWidth: 1, borderColor: C.line }, authMark: { width: 56, height: 56, borderRadius: 20, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }, authLogo: { width: 56, height: 56, borderRadius: 20 }, authEyebrow: { color: C.cocoa, fontSize: 10, letterSpacing: 2, fontWeight: '800', marginBottom: 10 }, authTitle: { color: C.ink, fontSize: 30, lineHeight: 37, fontWeight: '600', letterSpacing: -0.9, textAlign: 'center' }, authBody: { color: C.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 12, marginBottom: 24 }, authButton: { minHeight: 52, borderRadius: 16, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, authButtonText: { color: C.white, fontSize: 13, fontWeight: '700' }, authFootnote: { color: '#9A8E82', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 14 }, authError: { backgroundColor: '#FCE9E3', borderRadius: 12, padding: 11, marginBottom: 14 }, authErrorText: { color: '#8D473F', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.canvas }, main: { flex: 1, minWidth: 0 },
  newChatButton: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#D8D7D1', backgroundColor: '#FFFFFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 30, shadowColor: '#302821', shadowOpacity: 0.035, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1 }, newChatGlyph: { color: C.cocoa, fontSize: 20, lineHeight: 23 }, newChatLabel: { color: C.ink, fontSize: 13, fontWeight: '600' },
  headerNewChat: { minHeight: 38, paddingHorizontal: 11, borderRadius: 13, backgroundColor: '#F1F1EE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, headerNewChatGlyph: { color: C.cocoa, fontSize: 18, lineHeight: 22 }, headerNewChatLabel: { color: C.ink, fontSize: 11, fontWeight: '600' },
  accountCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderRadius: 14 }, accountAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#E4DDD4', alignItems: 'center', justifyContent: 'center' }, accountAvatarText: { color: C.cocoaDark, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }, accountCopy: { flex: 1 }, accountTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, accountSubtitle: { color: C.muted, fontSize: 10, marginTop: 3 }, accountArrow: { color: '#938A80', fontSize: 22 },
  sidebar: { width: 258, backgroundColor: '#F3F2EF', borderRightWidth: 1, borderRightColor: '#E9E8E4', paddingHorizontal: 18, paddingTop: 24, paddingBottom: 16 },
  sidebarBrand: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 24 }, brandMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: C.cocoa, justifyContent: 'center', alignItems: 'center' }, brandLogo: { width: 42, height: 42, borderRadius: 15 }, brandMarkText: { color: '#FFF9F3', fontSize: 18, fontWeight: '700', letterSpacing: -1 }, brandCopy: { justifyContent: 'center' }, brandName: { color: C.ink, fontSize: 16, letterSpacing: -0.4, fontWeight: '700' }, sidebarCaption: { color: C.muted, fontSize: 11, marginTop: 2 }, sidebarLabel: { color: '#96948D', fontSize: 9, letterSpacing: 1.3, fontWeight: '700', marginBottom: 10, marginLeft: 12 },
  navButton: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 11 }, navButtonSelected: { backgroundColor: '#E7E5E0' }, navIcon: { width: 22, textAlign: 'center', fontSize: 19, color: '#887C71' }, navIconSelected: { color: C.cocoa }, navLabel: { color: '#756A60', fontSize: 13, fontWeight: '500', flex: 1 }, navLabelSelected: { color: C.cocoaDark, fontWeight: '700' }, navDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.cocoa },
  sidebarBottom: { marginTop: 'auto' }, sidebarRule: { height: 1, backgroundColor: '#E2D9CD', marginBottom: 20 }, localNoteIcon: { width: 32, height: 32, backgroundColor: '#E7E5E0', borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, localNoteGlyph: { color: C.cocoa, fontSize: 17 }, localNoteTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginBottom: 5 }, localNoteBody: { color: C.muted, fontSize: 11, lineHeight: 17 },
  topbar: { height: 66, borderBottomWidth: 1, borderBottomColor: '#ECEBE7', paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', backgroundColor: C.paper }, mobileTopbar: { height: 64, paddingHorizontal: 18 }, topbarContext: { marginLeft: 28, paddingLeft: 28, borderLeftWidth: 1, borderLeftColor: C.line, color: C.muted, fontSize: 13, flex: 1 }, profileButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }, profileInitial: { color: C.cocoaDark, fontSize: 13, fontWeight: '700' }, brandSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  contentArea: { flex: 1, minHeight: 0 }, chatPage: { flex: 1 }, chatHeader: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, chatHeaderWide: { paddingHorizontal: 48, paddingTop: 20, paddingBottom: 14 }, chatHeaderCopy: { flex: 1 }, chatSubtitle: { color: C.muted, fontSize: 12, marginTop: 6 }, privatePill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#E6E5E1', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: C.paper }, privateDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#7A9875' }, privateLabel: { color: C.green, fontSize: 10, fontWeight: '600' }, eyebrow: { color: C.cocoa, fontSize: 9, letterSpacing: 1.7, fontWeight: '700', marginBottom: 7 }, pageTitle: { color: C.ink, fontSize: 22, fontWeight: '600', letterSpacing: -0.55 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, servicePill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7 }, serviceDot: { width: 6, height: 6, backgroundColor: '#BC9E79', borderRadius: 4 }, serviceText: { color: C.muted, fontSize: 10, fontWeight: '600' }, moreButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }, moreGlyph: { color: C.muted, fontSize: 20, lineHeight: 23, marginTop: -10 },
  chatScroll: { flex: 1 }, chatContent: { paddingHorizontal: 20, paddingBottom: 26, flexGrow: 1 }, chatContentWide: { maxWidth: 900, width: '100%', alignSelf: 'center', paddingHorizontal: 64 }, emptyContent: { justifyContent: 'center' }, emptyState: { width: '100%', maxWidth: 720, alignSelf: 'center', alignItems: 'center', paddingTop: 14, paddingBottom: 20 }, emptyHeroMark: { width: 58, height: 58, borderRadius: 20, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: C.cocoa, shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 }, emptyHeroLogo: { width: 58, height: 58, borderRadius: 20 }, emptyGreeting: { color: C.ink, fontSize: 30, lineHeight: 38, fontWeight: '600', letterSpacing: -0.9, textAlign: 'center' }, emptyDescription: { maxWidth: 440, color: C.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 9, marginBottom: 28 }, starterGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }, starterCard: { width: '31.8%', minWidth: 175, minHeight: 92, borderRadius: 18, borderWidth: 1, borderColor: '#E7E4DE', backgroundColor: '#FFFFFF', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#302821', shadowOpacity: 0.025, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, starterCardMobile: { width: '48%', minWidth: 120, minHeight: 78, padding: 10, gap: 7 }, starterCardPressed: { backgroundColor: '#F8F6F2', borderColor: '#D4C8BA' }, starterIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F3F0EB', alignItems: 'center', justifyContent: 'center' }, starterIconText: { color: C.cocoa, fontSize: 17 }, starterCopy: { flex: 1 }, starterTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, starterDescription: { color: C.muted, fontSize: 10, lineHeight: 14, marginTop: 4 }, starterArrow: { color: '#A69A8E', fontSize: 13, alignSelf: 'flex-start' }, conversationColumn: { width: '100%', maxWidth: 760, alignSelf: 'center' }, dayDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10, marginBottom: 24 }, dividerLine: { height: 1, backgroundColor: C.line, flex: 1 }, dayText: { color: '#A2968A', fontSize: 9, letterSpacing: 1.5, fontWeight: '700' }, welcomeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, teddyAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center' }, teddyAvatarText: { color: '#FFF9F3', fontSize: 12, fontWeight: '700', letterSpacing: -0.4 }, welcomeBubble: { backgroundColor: C.paper, borderWidth: 1, borderColor: '#E9E0D5', borderRadius: 5, borderTopRightRadius: 22, borderBottomRightRadius: 22, borderBottomLeftRadius: 22, paddingHorizontal: 20, paddingVertical: 18, maxWidth: 640, flex: 1, shadowColor: '#60432F', shadowOpacity: 0.035, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, messageMeta: { color: '#A2968A', fontSize: 8, letterSpacing: 1.25, fontWeight: '700', marginBottom: 9 }, welcomeText: { color: C.ink, fontSize: 16, lineHeight: 25, letterSpacing: -0.1 }, welcomeHint: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 6 },
  connectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2ECE3', borderRadius: 16, padding: 14, marginTop: 22, marginLeft: 44, gap: 12, maxWidth: 555 }, connectIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }, connectIconText: { color: C.cocoa, fontSize: 17 }, connectCopy: { flex: 1 }, connectTitle: { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 4 }, connectBody: { fontSize: 11, color: C.muted, lineHeight: 16 }, connectArrow: { color: C.cocoa, fontSize: 24 }, promptWrap: { marginTop: 22, marginLeft: 44 }, promptHeading: { color: '#796D62', fontSize: 11, fontWeight: '600', marginBottom: 10, marginLeft: 2 }, promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, promptChip: { borderWidth: 1, borderColor: '#E3D9CD', backgroundColor: '#FBF8F3', borderRadius: 18, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center' }, promptChipText: { color: C.cocoaDark, fontSize: 11, fontWeight: '500' },
  messageRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 14 }, messageRowYou: { justifyContent: 'flex-end' }, teddyAvatarSmall: { width: 27, height: 27, borderRadius: 10, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center' }, messageBubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 }, teddyBubble: { backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderTopLeftRadius: 4 }, userBubble: { backgroundColor: C.cocoa, borderBottomRightRadius: 4 }, messageText: { color: C.ink, fontSize: 14, lineHeight: 21 }, userMessageText: { color: C.white }, messageTime: { color: C.muted, fontSize: 9, textAlign: 'right', marginTop: 5 }, userMessageTime: { color: '#E8D9CC' }, sendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 8 }, typingBubble: { backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderRadius: 16, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 }, typingText: { color: C.muted, fontSize: 12, fontWeight: '600' }, errorBanner: { backgroundColor: '#FCE9E3', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 }, errorText: { color: '#8D473F', fontSize: 11, lineHeight: 16 }, retryButton: { alignSelf: 'flex-start', marginTop: 8, minHeight: 30, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#FFFFFF' }, retryButtonText: { color: '#8D473F', fontSize: 11, fontWeight: '700' },
  composerWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: C.canvas }, composerWrapWide: { maxWidth: 900, width: '100%', alignSelf: 'center', paddingHorizontal: 64, paddingTop: 12, paddingBottom: 18 }, composerCard: { minHeight: 92, maxWidth: 760, alignSelf: 'center', width: '100%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDDCD6', borderRadius: 23, paddingHorizontal: 14, paddingTop: 7, paddingBottom: 8, shadowColor: '#302821', shadowOpacity: 0.065, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, composerBottomRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }, chatTools: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 }, toolIconButton: { width: 31, height: 31, borderRadius: 11, borderWidth: 1, borderColor: '#E7E5E0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }, toolIconGlyph: { color: C.cocoa, fontSize: 18, lineHeight: 22 }, attachmentRow: { minHeight: 28, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', borderRadius: 9, backgroundColor: '#F3F0EB', paddingLeft: 9, marginBottom: 6 }, attachmentRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }, attachmentRemoveText: { color: C.muted, fontSize: 18 }, toolButton: { minHeight: 30, borderRadius: 13, borderWidth: 1, borderColor: '#E7E5E0', backgroundColor: '#FFFFFF', paddingHorizontal: 10, justifyContent: 'center' }, toolButtonActive: { borderColor: '#CBA98F', backgroundColor: C.peachLight }, toolButtonText: { color: C.muted, fontSize: 10, fontWeight: '600' }, toolButtonTextActive: { color: C.cocoaDark }, attachmentPill: { minHeight: 30, borderRadius: 13, backgroundColor: C.greenLight, paddingHorizontal: 10, justifyContent: 'center' }, attachmentText: { color: C.green, fontSize: 10, fontWeight: '600' }, composer: { minHeight: 56, maxHeight: 140, borderRadius: 20, borderWidth: 1, borderColor: '#DED4C8', backgroundColor: C.paper, flexDirection: 'row', alignItems: 'flex-end', padding: 7, paddingLeft: 16, shadowColor: '#60432F', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, composerDisabled: { opacity: 0.76 }, composerInput: { width: '100%', color: C.ink, fontSize: 14, paddingTop: 10, paddingBottom: 6, maxHeight: 110, minHeight: 40 }, sendButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F0EFEC', justifyContent: 'center', alignItems: 'center' }, sendButtonActive: { backgroundColor: '#4E6556' }, sendGlyph: { color: '#9A8E82', fontSize: 22, lineHeight: 26, fontWeight: '500' }, sendGlyphActive: { color: C.white }, composerFootnote: { color: '#9A8E82', fontSize: 9, textAlign: 'center', marginTop: 8, lineHeight: 14 },
  bottomNav: { height: 62, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, bottomNavItem: { flex: 1, height: 54, alignItems: 'center', justifyContent: 'center', gap: 2 }, bottomIcon: { fontSize: 19, color: '#9B9085', lineHeight: 22 }, bottomIconActive: { color: C.cocoa }, bottomLabel: { fontSize: 9, color: '#93877C', fontWeight: '500' }, bottomLabelActive: { color: C.cocoaDark, fontWeight: '700' },
  pageScroll: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 32 }, pageScrollWide: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 48, paddingTop: 38 }, pageIntro: { marginBottom: 22 }, pageDescription: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 9, maxWidth: 580 }, memoryNotice: { flexDirection: 'row', gap: 12, padding: 15, borderRadius: 16, backgroundColor: '#F1E9DE', marginBottom: 27 }, noticeIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#E7DDD1', alignItems: 'center', justifyContent: 'center' }, noticeGlyph: { fontSize: 17, color: C.cocoa }, noticeCopy: { flex: 1 }, noticeTitle: { color: C.cocoaDark, fontSize: 12, fontWeight: '700', marginBottom: 4 }, noticeBody: { color: '#796D62', fontSize: 11, lineHeight: 17 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, sectionTitle: { color: '#8E8175', fontSize: 10, letterSpacing: 1.3, fontWeight: '700' }, countText: { color: C.cocoa }, addLink: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }, addLinkText: { color: C.cocoa, fontSize: 12, fontWeight: '700' }, memoryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 15, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 16, marginBottom: 10 }, memoryMark: { width: 32, height: 32, backgroundColor: C.peachLight, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, memoryMarkText: { color: C.cocoa, fontSize: 16 }, memoryCopy: { flex: 1, paddingTop: 2 }, memoryText: { color: C.ink, fontSize: 13, lineHeight: 20 }, memoryDate: { color: '#9B9085', fontSize: 10, marginTop: 7 }, memoryActions: { flexDirection: 'row', gap: 3 }, memoryAction: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, memoryActionGlyph: { color: '#8A7D70', fontSize: 17 }, deleteGlyph: { color: '#A17C70', fontSize: 22 }, memoriesFootnote: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 10 }, emptyCard: { alignItems: 'center', backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 28, marginTop: 4 }, emptyMark: { width: 46, height: 46, borderRadius: 16, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, emptyGlyph: { color: C.cocoa, fontSize: 21 }, emptyTitle: { color: C.ink, fontSize: 16, fontWeight: '700' }, emptyBody: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 280, marginTop: 7, marginBottom: 17 },
  privacyBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, backgroundColor: C.greenLight, borderRadius: 16, marginBottom: 27 }, privacyShield: { width: 35, height: 35, backgroundColor: '#D7E3D4', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, shieldGlyph: { color: C.green, fontSize: 19 }, privacyCopy: { flex: 1 }, privacyTitle: { color: '#435943', fontSize: 13, fontWeight: '700', marginBottom: 5 }, privacyBody: { color: '#65745F', fontSize: 11, lineHeight: 17 }, settingsSectionLabel: { color: '#8E8175', fontSize: 10, letterSpacing: 1.3, fontWeight: '700', marginBottom: 10, marginTop: 3 }, settingsCard: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 17, paddingHorizontal: 15, marginBottom: 23 }, settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 }, settingIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: C.paperAlt, alignItems: 'center', justifyContent: 'center' }, settingGlyph: { color: C.cocoa, fontSize: 15 }, settingText: { flex: 1 }, settingTitle: { color: C.ink, fontSize: 12, fontWeight: '700', lineHeight: 17 }, settingDescription: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }, switchTrack: { width: 42, height: 25, borderRadius: 14, backgroundColor: '#DED8D0', padding: 3, justifyContent: 'center' }, switchOn: { backgroundColor: C.cocoa }, switchThumb: { width: 19, height: 19, borderRadius: 10, backgroundColor: C.white }, switchThumbOn: { alignSelf: 'flex-end' }, settingSeparator: { height: 1, backgroundColor: C.line, marginLeft: 44 }, gatewaySection: { borderRadius: 18 }, gatewaySectionFocused: { borderWidth: 1, borderColor: '#D6BAA5', padding: 10, marginHorizontal: -10, marginBottom: 14, backgroundColor: '#F8F0E8' }, gatewayIntro: { flexDirection: 'row', gap: 11, paddingTop: 16, paddingBottom: 14 }, gatewayIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center' }, gatewayGlyph: { color: C.cocoa, fontSize: 16 }, inputLabel: { color: '#93877C', fontSize: 9, letterSpacing: 1.1, fontWeight: '700', marginBottom: 7 }, gatewayInput: { height: 45, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: '#FDFCFA', paddingHorizontal: 12, color: C.ink, fontSize: 12 }, gatewayActions: { paddingTop: 11, paddingBottom: 15, gap: 9 }, connectionStatus: { color: C.muted, fontSize: 10, lineHeight: 15 }, connectionReady: { color: C.green }, connectionError: { color: C.rose }, clearRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 }, clearIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#F8EAE5', alignItems: 'center', justifyContent: 'center' }, clearGlyph: { color: C.rose, fontSize: 16 }, clearButton: { minHeight: 36, minWidth: 54, borderRadius: 11, borderWidth: 1, borderColor: '#E7D8D2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, clearButtonText: { color: C.rose, fontSize: 11, fontWeight: '700' }, versionText: { textAlign: 'center', color: '#A79B8F', fontSize: 8, letterSpacing: 1.4, marginTop: 2, marginBottom: 16 },
  button: { minHeight: 42, backgroundColor: C.cocoa, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17 }, buttonQuiet: { backgroundColor: '#F2ECE4' }, buttonDisabled: { opacity: 0.45 }, buttonText: { color: C.white, fontSize: 11, fontWeight: '700' }, buttonTextQuiet: { color: C.cocoaDark }, pressed: { opacity: 0.75 }, disabledText: { color: '#A79B8F' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(45, 36, 29, 0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 }, modalCard: { width: '100%', maxWidth: 460, backgroundColor: C.paper, borderRadius: 22, padding: 22 }, modalTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, modalIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center' }, modalIconText: { color: C.cocoa, fontSize: 18 }, closeButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paperAlt }, closeText: { color: C.muted, fontSize: 22, lineHeight: 24 }, modalTitle: { color: C.ink, fontWeight: '700', fontSize: 20, letterSpacing: -0.4 }, modalBody: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 16 }, memoryInput: { minHeight: 100, maxHeight: 180, backgroundColor: '#F9F6F1', borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 13, color: C.ink, fontSize: 13, lineHeight: 19 }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 17 },
});

export default App;
