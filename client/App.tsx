import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import {
  Animated,
  BackHandler,
  AccessibilityInfo,
  AppState,
  Alert,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeEventEmitter,
  PanResponder,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  Vibration,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GATEWAY_BASE_URL } from './src/config/gateway';
import { teddyTheme } from './src/theme';
import { styles } from './src/theme/appStyles';
import { ASSISTANT_CHARACTERS, DEFAULT_ASSISTANT_CHARACTER_ID } from './src/characters';
import type { AssistantCharacterId, AssistantCharacterNames } from './src/characters';
import { GatewayService } from './src/services/gateway';
import { cancelCareReminder, requestCareReminderPermission, scheduleCareReminder } from './src/services/careReminders';
import { browserAuthService } from './src/services/browserAuth';
import type { StoredSession } from './src/services/session';
import { findRelevantChatHistory, localDataService, ownerFromToken } from './src/services/localData';
import type { EmotionCheckIn, JournalEntry, LocalAppData, LocalConversation, LocalMemory, LocalMessage } from './src/services/localData';
import { EMOTION_AXES } from './src/services/localData';
import { RoundedText as Text, RoundedTextInput as TextInput } from './src/components/RoundedText';

import { AnimatedNavIcon } from './src/components/AnimatedNavIcon';
import { AppIcon } from './src/components/AppIcon';
import type { AppIconName } from './src/components/AppIcon';
import { createEncryptedBackup, MAX_BACKUP_BYTES, mergeLocalAppData, readEncryptedBackup } from './src/services/backup';
import { pickBackupFile, saveBackupFile, savePlainTextFile } from './src/services/backupFiles';
import { pickChatImage } from './src/services/imagePicker';
import { crisisHelplineOptionForLocale, emergencyCallOptionForLocale, hasCrisisSignal } from './src/services/conversationSafety';
import { extractTeddyStickerResponse, getTeddySticker, inferTeddySticker, stripTeddyStickerMarker } from './src/services/stickers';
import { authErrorMessage, AuthServiceError, AuthValidationError } from './src/services/authErrors';
import type { AuthField } from './src/services/authErrors';
import { backupErrorMessage, chatErrorMessage, imagePickerErrorMessage, localDataErrorMessage } from './src/services/userFacingErrors';
import type { CrisisHelplineOption, EmergencyCallOption } from './src/services/conversationSafety';
import teddyBudLogoAsset from './assets/teddy-bud-logo.png';
import assistantIconAsset from './assets/icon.png';

const LazyOnboardingSurvey = React.lazy(() => import('./src/components/OnboardingSurvey').then(({ OnboardingSurvey }) => ({ default: OnboardingSurvey })));
const LazyWellbeingStudio = React.lazy(() => import('./src/components/WellbeingStudio').then(({ WellbeingStudio }) => ({ default: WellbeingStudio })));

type Page = 'chat' | 'history' | 'memories' | 'privacy' | 'settings' | 'emotions' | 'journal' | 'studio' | 'discover';
type Memory = LocalMemory;
type MemorySuggestion = { conversationId: string; messageId: number; fact: string };
type Message = LocalMessage;
type Conversation = LocalConversation;
type CreditBalance = { day: string; used: number; remaining: number; limit: number; resetAt: string };
type SpeechResultEvent = { value?: string[] };
type SpeechErrorEvent = { message?: string };
type NativeSpeechModule = { start: (locale: string) => Promise<boolean>; stop: () => Promise<boolean>; cancel: () => Promise<boolean> };
type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const C = {
  canvas: teddyTheme.colors.canvas, paper: teddyTheme.colors.surface, paperAlt: teddyTheme.colors.surfaceAlt, ink: teddyTheme.colors.text,
  muted: teddyTheme.colors.textSecondary, line: teddyTheme.colors.border, cocoa: teddyTheme.colors.primary, cocoaDark: teddyTheme.colors.onPrimaryContainer,
  peach: teddyTheme.colors.clay, peachLight: teddyTheme.colors.claySoft, green: teddyTheme.colors.success, greenLight: teddyTheme.colors.successContainer,
  rose: teddyTheme.colors.accentText, white: teddyTheme.colors.white,
};

type PrimaryNavPage = 'chat' | 'discover' | 'memories' | 'settings';

const UISettingsContext = React.createContext({ reduceMotion: false, hapticsEnabled: true });

const navItems: { id: PrimaryNavPage; label: string }[] = [
  { id: 'chat', label: 'Chats' },
  { id: 'discover', label: 'Discover' },
  { id: 'memories', label: 'Memories' },
  { id: 'settings', label: 'Settings' },
];
const mobileNavItems: { id: PrimaryNavPage; label: string }[] = [
  { id: 'chat', label: 'Chats' },
  { id: 'discover', label: 'Discover' },
  { id: 'memories', label: 'Memories' },
  { id: 'settings', label: 'Settings' },
];
const discoverPages: Page[] = ['discover', 'journal', 'emotions', 'studio'];

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

function runInBackground(task: Promise<unknown>): void {
  task.then(undefined, error => {
    console.error('A background Teddy Bud task failed.', error);
  });
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
  const loadingOpacity = useRef(new Animated.Value(1)).current;
  const __teddyBudExtractedStyles0 = StyleSheet.create({
    style0: ({ flex: 1, opacity: loadingOpacity }) as const,
  });
  const [error, setError] = useState<string | null>(null);
  const [initialMode, setInitialMode] = useState<'login' | 'create'>('login');
  const [canMigrateLegacy, setCanMigrateLegacy] = useState(false);
  const [canCreateAccount, setCanCreateAccount] = useState(false);

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      const loadingStartedAt = Date.now();
      try {
        // If biometric sign-in was enrolled, require the device owner to unlock on every cold app launch.
        // A cancelled/failed prompt deliberately falls back to the username + password screen.
        const biometricReady = Platform.OS === 'android' && await browserAuthService.hasBiometricSignIn();
        if (biometricReady) {
          try {
            const unlockedSession = await browserAuthService.signInWithBiometrics();
            if (mounted) {
              setSession(unlockedSession);
              await browserAuthService.markSetupComplete(unlockedSession.username);
            }
          } catch {
            if (mounted) {
              setInitialMode('login');
              setCanCreateAccount(await browserAuthService.shouldCreateAccount());
              setCanMigrateLegacy(await browserAuthService.canMigrateLegacyAccount());
            }
          }
        } else {
          const current = await browserAuthService.restore();
          if (mounted) {
            setSession(current);
            if (current) await browserAuthService.markSetupComplete(current.username);
            else {
              setInitialMode('login');
              setCanCreateAccount(await browserAuthService.shouldCreateAccount());
              setCanMigrateLegacy(await browserAuthService.canMigrateLegacyAccount());
            }
          }
        }
      } catch (restoreError) {
        if (mounted) {
          setError(authErrorMessage(restoreError, 'session-restore'));
          // A failed restore on an already configured device must return to
          // sign-in, never expose account creation as the default recovery path.
          setInitialMode('login');
          setCanCreateAccount(false);
          try {
            setCanMigrateLegacy(await browserAuthService.canMigrateLegacyAccount());
          } catch {
            setCanMigrateLegacy(false);
          }
        }
      } finally {
        const remaining = Math.max(0, 2000 - (Date.now() - loadingStartedAt));
        setTimeout(() => {
          if (!mounted) return;
          Animated.timing(loadingOpacity, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
            if (mounted) setBusy(false);
          });
        }, remaining);
      }
    };
    restore();
    return () => {
      mounted = false;
    };
  }, [loadingOpacity]);

  useEffect(() => {
    if (!session) return undefined;
    const expireSession = () => {
      browserAuthService.clear().then(() => {
        setError('Your one-hour session has expired. Please sign in again.');
      }).catch(clearError => {
        setError(authErrorMessage(clearError, 'session-restore'));
      }).finally(() => {
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

  // Do not re-prompt for biometrics on every foreground/resume.
  // A valid in-memory session remains unlocked until its normal expiry.

  if (busy) return <Animated.View style={__teddyBudExtractedStyles0.style0}><AuthLoading /></Animated.View>;
  if (!session) return <BrowserLoginScreen error={error} initialMode={initialMode} canMigrateLegacy={canMigrateLegacy} allowAccountCreation={canCreateAccount} onAuthenticated={next => { setError(null); setInitialMode('login'); setCanCreateAccount(false); setSession(next); }} />;
  return <TeddyBud sessionToken={session.accessToken} username={session.username ?? ''} onLogout={() => {
    browserAuthService.logout().then(() => setSession(null)).catch(logoutError => {
      const message = authErrorMessage(logoutError, 'sign-out');
      setError(message);
      if (logoutError instanceof AuthServiceError && logoutError.kind === 'storage') {
        if (Platform.OS === 'web' && typeof window !== 'undefined') Alert.alert('Sign out could not finish', message);
        else Alert.alert('Sign out could not finish', message);
        return;
      }
      setSession(null);
    });
  }} />;
}

function AuthLoading() {
  const rotation = useRef(new Animated.Value(0)).current;
  const opening = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const entrance = Animated.spring(opening, { toValue: 1, speed: 13, bounciness: 5, useNativeDriver: true });
    const turn = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    entrance.start();
    turn.start();
    return () => { entrance.stop(); turn.stop(); };
  }, [rotation, opening]);
  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const reverseSpin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const logoScale = opening.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const logoLift = opening.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const logoOpacity = opening.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  return <View style={styles.authLoadingScreen} accessibilityLabel="Opening Teddy Bud">
    <Animated.View style={[styles.authLoadingMark, { opacity: logoOpacity, transform: [{ translateY: logoLift }, { scale: logoScale }] }]}>
      <Image source={teddyBudLogo} style={styles.authLoadingLogo} accessibilityLabel="Teddy Bud" />
    </Animated.View>
    <Text style={styles.authLoadingTitle}>Opening your private space</Text>
    <Text style={styles.authLoadingBody}>Getting your cozy corner ready</Text>
    <View style={styles.authLoadingSpinner} accessibilityLabel="Loading">
      <Animated.View style={[styles.authLoadingOrbit, styles.authLoadingOrbitFirst, { transform: [{ perspective: 700 }, { rotateX: '70deg' }, { rotateZ: spin }] }]} />
      <Animated.View style={[styles.authLoadingOrbit, styles.authLoadingOrbitSecond, { transform: [{ perspective: 700 }, { rotateY: '70deg' }, { rotateZ: reverseSpin }] }]} />
    </View>
  </View>;
}
export function BrowserLoginScreen({ error, initialMode, canMigrateLegacy, allowAccountCreation = true, onAuthenticated }: { error: string | null; initialMode: 'login' | 'create'; canMigrateLegacy: boolean; allowAccountCreation?: boolean; onAuthenticated: (session: StoredSession) => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 600;
  const shortScreen = height < 760;
  const [mode, setMode] = useState<'login' | 'create' | 'recover' | 'migrate'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryPassphrase, setRecoveryPassphrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [recoveryPassphraseVisible, setRecoveryPassphraseVisible] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AuthField, string>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [biometricReady, setBiometricReady] = useState(false);
  const authScrollRef = useRef<ScrollView>(null);
  const keepFocusedFieldVisible = (target: number) => {
    const responder = authScrollRef.current?.getScrollResponder() as unknown as {
      scrollResponderScrollNativeHandleToKeyboard?: (nodeHandle: number, additionalOffset?: number, preventNegativeScrollOffset?: boolean) => void;
    } | undefined;
    responder?.scrollResponderScrollNativeHandleToKeyboard?.(target, 24, true);
  };
  useEffect(() => {
    let mounted = true;
    if (Platform.OS !== 'android' || mode !== 'login') {
      setBiometricReady(false);
      return () => { mounted = false; };
    }
    browserAuthService.hasBiometricSignIn().then(ready => {
      if (mounted) setBiometricReady(ready);
    }).catch(() => { if (mounted) setBiometricReady(false); });
    return () => { mounted = false; };
  }, [mode]);

  const signInWithBiometrics = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    setNotice(null);
    try {
      onAuthenticated(await browserAuthService.signInWithBiometrics());
    } catch {
      setNotice('Biometric sign-in was cancelled or unavailable. You can use your password instead.');
    } finally {
      setSubmitting(false);
    }
  };

  const clearFieldError = (field: AuthField) => {
    setFieldErrors(current => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true); setFormError(null); setFieldErrors({}); setNotice(null);
    try {
      if (mode !== 'migrate' && !/^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase())) {
        throw new AuthValidationError('Use 3–24 characters: lowercase letters, numbers, or underscores.', 'username');
      }
      if (mode === 'login' && !password) throw new AuthValidationError('Enter your password.', 'password');

      if (mode === 'login') {
        onAuthenticated(await browserAuthService.signIn(username.trim().toLowerCase(), password));
      } else if (mode === 'create') {
        if (password.length < 15 || password.length > 128) throw new AuthValidationError('Choose a password with 15 to 128 characters.', 'password');
        if (password !== confirmPassword) throw new AuthValidationError('The passwords do not match.', 'confirmPassword');
        const phrase = recoveryPassphrase.trim();
        if (phrase.length < 10 || phrase.length > 128) throw new AuthValidationError('Choose a recovery passphrase with 10 to 128 characters.', 'recoveryPassphrase');
        onAuthenticated(await browserAuthService.createAccount(username.trim().toLowerCase(), password, phrase));
      } else if (mode === 'migrate') {
        if (password.length < 15 || password.length > 128) throw new AuthValidationError('Choose a password with 15 to 128 characters.');
        if (password !== confirmPassword) throw new AuthValidationError('The passwords do not match.');
        const phrase = recoveryPassphrase.trim();
        if (phrase.length < 10 || phrase.length > 128) throw new AuthValidationError('Choose a recovery passphrase with 10 to 128 characters.');
        onAuthenticated(await browserAuthService.migrateLegacyAccount(password, phrase));
      } else {
        if (password.length < 15 || password.length > 128) throw new AuthValidationError('Choose a new password with 15 to 128 characters.', 'password');
        if (recoveryPassphrase.trim().length < 10) throw new AuthValidationError('Enter the recovery passphrase you chose when you created your account.', 'recoveryPassphrase');
        await browserAuthService.recoverPassword(username.trim().toLowerCase(), recoveryPassphrase.trim(), password);
        setMode('login'); setPassword(''); setRecoveryPassphrase('');
        setNotice('Password changed. Sign in with your new password.');
      }
    } catch (authError) {
      const context = mode === 'login' ? 'sign-in'
        : mode === 'create' ? 'create-account'
          : mode === 'recover' ? 'password-recovery'
            : 'account-migration';
      if (authError instanceof AuthValidationError && authError.field) {
        setFieldErrors({ [authError.field]: authError.message });
        setFormError(null);
      } else {
        setFormError(authErrorMessage(authError, context));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const changeMode = (next: 'login' | 'create' | 'recover' | 'migrate') => {
    setMode(next); setFormError(null); setFieldErrors({}); setNotice(null); setPassword(''); setPasswordVisible(false); setConfirmPassword(''); setConfirmPasswordVisible(false); setRecoveryPassphrase(''); setRecoveryPassphraseVisible(true);
  };

  const title = mode === 'create' ? 'Create account' : mode === 'recover' ? 'Reset password' : mode === 'migrate' ? 'Restore account' : 'Sign in';
  const actionLabel = mode === 'create' ? 'Continue setup' : mode === 'recover' ? 'Change password' : mode === 'migrate' ? 'Move existing account' : 'Sign in';

  return <KeyboardAvoidingView style={[styles.authScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView ref={authScrollRef} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.authScrollContent, compact && styles.authScrollContentCompact, shortScreen && styles.authScrollContentShort]}>
    <View style={[styles.authCard, compact && styles.authCardCompact, shortScreen && styles.authCardShort]}>
      <View style={styles.authMark}><Image source={teddyBudLogo} style={styles.authLogo} accessibilityLabel="Teddy Bud" /></View>
      <Text style={styles.authTitle}>{title}</Text>
      {(error || formError) && <View style={styles.authError}><Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.authErrorText}>{formError || error}</Text></View>}
      {!!notice && <View style={styles.authNotice}><Text accessibilityLiveRegion="polite" style={styles.authNoticeText}>{notice}</Text></View>}
      {mode !== 'migrate' && <>
        <TextInput onFocus={event => keepFocusedFieldVisible(event.nativeEvent.target)} accessibilityLabel="Username" accessibilityHint={fieldErrors.username} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" value={username} onChangeText={value => { setUsername(value); clearFieldError('username'); }} placeholder="Username" placeholderTextColor="#938A80" style={[styles.authInput, fieldErrors.username && styles.authInputInvalid]} editable={!submitting} />
        {fieldErrors.username && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.authFieldError}>{fieldErrors.username}</Text>}
      </>}
      {mode === 'recover' && <>
        <View style={[styles.authPasswordRow, fieldErrors.recoveryPassphrase && styles.authInputInvalid]}>
          <TextInput onFocus={event => keepFocusedFieldVisible(event.nativeEvent.target)} accessibilityLabel="Recovery passphrase" accessibilityHint={fieldErrors.recoveryPassphrase} autoCapitalize="none" autoCorrect={false} autoComplete="off" secureTextEntry={!recoveryPassphraseVisible} value={recoveryPassphrase} onChangeText={value => { setRecoveryPassphrase(value); clearFieldError('recoveryPassphrase'); }} placeholder="Recovery passphrase" placeholderTextColor="#938A80" style={styles.authPasswordInput} editable={!submitting} />
          <Pressable accessibilityRole="button" accessibilityLabel={recoveryPassphraseVisible ? 'Hide recovery passphrase' : 'Show recovery passphrase'} onPress={() => setRecoveryPassphraseVisible(current => !current)} style={({ pressed }) => [styles.showPasswordButton, pressed && styles.pressed]}><AppIcon name={recoveryPassphraseVisible ? 'eyeOff' : 'eye'} color={C.cocoa} size={19} /></Pressable>
        </View>
        {fieldErrors.recoveryPassphrase && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.authFieldError}>{fieldErrors.recoveryPassphrase}</Text>}
      </>}
      <View style={[styles.authPasswordRow, fieldErrors.password && styles.authInputInvalid]}>
        <TextInput onFocus={event => keepFocusedFieldVisible(event.nativeEvent.target)} accessibilityLabel={mode === 'recover' ? 'New password' : 'Password'} accessibilityHint={fieldErrors.password} autoCapitalize="none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} textContentType={mode === 'login' ? 'password' : 'newPassword'} secureTextEntry={!passwordVisible} value={password} onChangeText={value => { setPassword(value); clearFieldError('password'); }} placeholder={mode === 'recover' ? 'New password' : 'Password'} placeholderTextColor="#938A80" style={styles.authPasswordInput} editable={!submitting} />
        <Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'} accessibilityHint="Changes whether the password text is visible on this screen" disabled={submitting} onPress={() => setPasswordVisible(current => !current)} style={({ pressed }) => [styles.showPasswordButton, pressed && styles.pressed]}>
          <AppIcon name={passwordVisible ? 'eyeOff' : 'eye'} color={C.cocoa} size={19} />
        </Pressable>
      </View>
      {fieldErrors.password && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.authFieldError}>{fieldErrors.password}</Text>}
      {(mode === 'create' || mode === 'migrate') && <>
        <View style={[styles.authPasswordRow, fieldErrors.confirmPassword && styles.authInputInvalid]}>
          <TextInput onFocus={event => keepFocusedFieldVisible(event.nativeEvent.target)} accessibilityLabel="Confirm password" accessibilityHint={fieldErrors.confirmPassword} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" secureTextEntry={!confirmPasswordVisible} value={confirmPassword} onChangeText={value => { setConfirmPassword(value); clearFieldError('confirmPassword'); }} placeholder="Confirm password" placeholderTextColor="#938A80" style={styles.authPasswordInput} editable={!submitting} />
          <Pressable accessibilityRole="button" accessibilityLabel={confirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'} onPress={() => setConfirmPasswordVisible(current => !current)} style={({ pressed }) => [styles.showPasswordButton, pressed && styles.pressed]}><AppIcon name={confirmPasswordVisible ? 'eyeOff' : 'eye'} color={C.cocoa} size={19} /></Pressable>
        </View>
        {fieldErrors.confirmPassword && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.authFieldError}>{fieldErrors.confirmPassword}</Text>}
        <View style={[styles.authPasswordRow, fieldErrors.recoveryPassphrase && styles.authInputInvalid]}>
          <TextInput onFocus={event => keepFocusedFieldVisible(event.nativeEvent.target)} accessibilityLabel="Choose recovery passphrase" accessibilityHint={fieldErrors.recoveryPassphrase} autoCapitalize="none" autoCorrect={false} autoComplete="off" secureTextEntry={!recoveryPassphraseVisible} value={recoveryPassphrase} onChangeText={value => { setRecoveryPassphrase(value); clearFieldError('recoveryPassphrase'); }} placeholder="10–128 characters" placeholderTextColor="#938A80" maxLength={128} style={styles.authPasswordInput} editable={!submitting} />
          <Pressable accessibilityRole="button" accessibilityLabel={recoveryPassphraseVisible ? 'Hide recovery passphrase' : 'Show recovery passphrase'} onPress={() => setRecoveryPassphraseVisible(current => !current)} style={({ pressed }) => [styles.showPasswordButton, pressed && styles.pressed]}><AppIcon name={recoveryPassphraseVisible ? 'eyeOff' : 'eye'} color={C.cocoa} size={19} /></Pressable>
        </View>
        {fieldErrors.recoveryPassphrase && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.authFieldError}>{fieldErrors.recoveryPassphrase}</Text>}
      </>}
      <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} disabled={submitting} onPress={submit} style={({ pressed }) => [styles.authButton, submitting && styles.buttonDisabled, pressed && styles.pressed]}>
        <Text style={styles.authButtonText}>{submitting ? 'Please wait…' : actionLabel}</Text>
      </Pressable>
      {mode === 'login' && biometricReady && <Pressable accessibilityRole="button" accessibilityLabel="Sign in with fingerprint" disabled={submitting} onPress={() => { runInBackground(signInWithBiometrics()); }} style={({ pressed }) => [styles.authBiometricButton, pressed && styles.pressed, submitting && styles.buttonDisabled]}><AppIcon name="fingerprint" color={C.cocoaDark} size={21} /><Text style={styles.authBiometricText}>Use fingerprint</Text></Pressable>}
      {mode === 'login' && <Pressable accessibilityRole="button" onPress={() => changeMode('recover')} style={styles.authLink}><Text style={styles.authLinkText}>Forgot password?</Text></Pressable>}
      {mode === 'login' && allowAccountCreation && <Pressable accessibilityRole="button" accessibilityLabel="Create a new account" onPress={() => changeMode('create')} style={styles.authLink}><Text style={styles.authLinkText}>Create a new account</Text></Pressable>}
      {canMigrateLegacy && mode !== 'recover' && mode !== 'migrate' && <Pressable accessibilityRole="button" onPress={() => changeMode('migrate')} style={styles.authLink}><Text style={styles.authLinkText}>Restore existing chats</Text></Pressable>}
      {(mode === 'recover' || mode === 'create') && <Pressable accessibilityRole="button" onPress={() => changeMode('login')} style={styles.authLink}><Text style={styles.authLinkText}>{mode === 'recover' ? 'Back to sign in' : 'Already set up? Sign in'}</Text></Pressable>}
    </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function TeddyBud({ sessionToken, username, onLogout }: { sessionToken: string; username: string; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 800;
  const [page, setPage] = useState<Page>('chat');
  const [lastDiscoverPage, setLastDiscoverPage] = useState<Page>('discover');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    if (discoverPages.includes(page)) setLastDiscoverPage(page);
  }, [page]);

  // Android system back and the native edge-back gesture should unwind nested
  // sections before allowing the operating system to leave the app.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (discoverPages.includes(page) && page !== 'discover') {
        setPage('discover');
        return true;
      }
      if (page === 'privacy') {
        setPage('settings');
        return true;
      }
      if (page === 'history') {
        setPage('chat');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [page]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [emotionCheckIns, setEmotionCheckIns] = useState<EmotionCheckIn[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [memoryModal, setMemoryModal] = useState(false);
  const [renameConversationId, setRenameConversationId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [memorySuggestion, setMemorySuggestion] = useState<MemorySuggestion | null>(null);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [memorySaving, setMemorySaving] = useState(false);
  const [memoryActionError, setMemoryActionError] = useState<string | null>(null);
  const [memoryDeleteRetry, setMemoryDeleteRetry] = useState<Memory | null>(null);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [rememberInSession, setRememberInSession] = useState(true);
  const rememberPreferenceRef = useRef(true);
  const memorySuggestionRequestId = useRef(0);
  const nextMessageId = useRef(0);
  const [shareMemories, setShareMemories] = useState(false);
  const [shareChatHistory, setShareChatHistory] = useState(false);
  const [shareAboutMe, setShareAboutMe] = useState(false);
  const [shareOnboardingSurvey, setShareOnboardingSurvey] = useState(false);
  const [aboutMe, setAboutMe] = useState('');
  const [assistantName, setAssistantName] = useState('Teddy');
  const [assistantCharacterId, setAssistantCharacterId] = useState<AssistantCharacterId>(DEFAULT_ASSISTANT_CHARACTER_ID);
  const [assistantCharacterNames, setAssistantCharacterNames] = useState<AssistantCharacterNames>({ 'teddy-bud': 'Teddy' });
  const [onboardingSurveyAnswers, setOnboardingSurveyAnswers] = useState<{ question: string; answer: string }[] | undefined>(undefined);
  const [reduceMotionPreference, setReduceMotionPreference] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [careRemindersEnabled, setCareRemindersEnabled] = useState(false);
  const [localDataReady, setLocalDataReady] = useState(false);
  const [localDataOwner, setLocalDataOwner] = useState<string | null>(null);
  const [localDataError, setLocalDataError] = useState<string | null>(null);
  const [localDataSaveError, setLocalDataSaveError] = useState<string | null>(null);  const [pendingLocalAction, setPendingLocalAction] = useState<(() => Promise<void>) | null>(null);
  const [localDataRetry, setLocalDataRetry] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatErrorConversationId, setChatErrorConversationId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [retryImageDataUrl, setRetryImageDataUrl] = useState<string | null>(null);
  const [retryConversationId, setRetryConversationId] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState('');
  const [streamingConversationId, setStreamingConversationId] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const streamBufferRef = useRef('');
  const streamUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receivedReplyRef = useRef('');
  const responseAbortControllerRef = useRef<AbortController | null>(null);

  const title = useMemo(() => page === 'history' ? 'Your chats' : page === 'settings' ? 'Settings' : page === 'emotions' ? 'Emotional landscape' : page === 'journal' ? 'Private journal' : page === 'studio' ? 'Wellbeing studio' : page === 'discover' ? 'Discover' : navItems.find(item => item.id === page)?.label ?? 'Your space', [page]);
  const owner = useMemo(() => ownerFromToken(sessionToken), [sessionToken]);

  const persistLocalSnapshot = useCallback(async (overrides: Partial<LocalAppData>) => {
    const currentSnapshot: LocalAppData = {
      conversations,
      activeConversationId,
      memories,
      emotionCheckIns,
      journalEntries,
      rememberInSession,
      shareMemories,
      shareChatHistory,
      shareAboutMe,
      shareOnboardingSurvey,
      aboutMe,
      assistantName,
      assistantCharacterId,
      assistantCharacterNames,
      onboardingSurveyAnswers,
      reduceMotion: reduceMotionPreference,
      hapticsEnabled,
      careRemindersEnabled,
    };
    const nextSnapshot: LocalAppData = { ...currentSnapshot, ...overrides };
    await localDataService.save(owner, nextSnapshot);
    if ('conversations' in overrides) setConversations(nextSnapshot.conversations);
    if ('activeConversationId' in overrides) setActiveConversationId(nextSnapshot.activeConversationId);
    if ('memories' in overrides) setMemories(nextSnapshot.memories);
    if ('emotionCheckIns' in overrides) setEmotionCheckIns(nextSnapshot.emotionCheckIns ?? []);
    if ('journalEntries' in overrides) setJournalEntries(nextSnapshot.journalEntries ?? []);
    if ('rememberInSession' in overrides) {
      setRememberInSession(nextSnapshot.rememberInSession);
      rememberPreferenceRef.current = nextSnapshot.rememberInSession;
    }
    if ('shareMemories' in overrides) setShareMemories(nextSnapshot.shareMemories);
    if ('shareChatHistory' in overrides) setShareChatHistory(nextSnapshot.shareChatHistory);
    if ('shareAboutMe' in overrides) setShareAboutMe(nextSnapshot.shareAboutMe);
    if ('shareOnboardingSurvey' in overrides) setShareOnboardingSurvey(nextSnapshot.shareOnboardingSurvey ?? false);
    if ('aboutMe' in overrides) setAboutMe(nextSnapshot.aboutMe);
    if ('assistantName' in overrides) setAssistantName(nextSnapshot.assistantName);
    if ('assistantCharacterId' in overrides) setAssistantCharacterId(nextSnapshot.assistantCharacterId ?? DEFAULT_ASSISTANT_CHARACTER_ID);
    if ('assistantCharacterNames' in overrides) setAssistantCharacterNames(nextSnapshot.assistantCharacterNames ?? {});
    if ('onboardingSurveyAnswers' in overrides) setOnboardingSurveyAnswers(nextSnapshot.onboardingSurveyAnswers);
    if ('careRemindersEnabled' in overrides) setCareRemindersEnabled(nextSnapshot.careRemindersEnabled === true);
    if (!pendingLocalAction) setLocalDataSaveError(null);
  }, [owner, conversations, activeConversationId, memories, emotionCheckIns, journalEntries, rememberInSession, shareMemories, shareChatHistory, shareAboutMe, shareOnboardingSurvey, aboutMe, assistantName, assistantCharacterId, assistantCharacterNames, onboardingSurveyAnswers, reduceMotionPreference, hapticsEnabled, careRemindersEnabled, pendingLocalAction]);
  useEffect(() => {
    if (!localDataReady || localDataOwner !== owner) return undefined;
    if (!careRemindersEnabled) {
      cancelCareReminder().catch(() => undefined);
      return undefined;
    }
    const schedule = () => { scheduleCareReminder().catch(() => undefined); };
    schedule();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' || state === 'background') schedule();
    });
    return () => subscription.remove();
  }, [careRemindersEnabled, localDataReady, localDataOwner, owner]);

  const refreshCreditBalance = useCallback(async () => {
    try {
      setCreditBalance(await gatewayService.getCreditBalance(sessionToken));
    } catch {
      setCreditBalance(null);
    }
  }, [sessionToken]);
  useEffect(() => { runInBackground(refreshCreditBalance()); }, [refreshCreditBalance]);
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
      setEmotionCheckIns(data.emotionCheckIns ?? []);
      setJournalEntries(data.journalEntries ?? []);
      setRememberInSession(data.rememberInSession);
      rememberPreferenceRef.current = data.rememberInSession;
      setShareMemories(data.shareMemories);
      setShareChatHistory(data.shareChatHistory);
      setShareAboutMe(data.shareAboutMe);
      setShareOnboardingSurvey(data.shareOnboardingSurvey ?? false);
      setAboutMe(data.aboutMe);
      setAssistantName(data.assistantName);
      setAssistantCharacterId(data.assistantCharacterId ?? DEFAULT_ASSISTANT_CHARACTER_ID);
      setAssistantCharacterNames(data.assistantCharacterNames ?? {});
      setOnboardingSurveyAnswers(data.onboardingSurveyAnswers);
      setReduceMotionPreference(data.reduceMotion === true);
      setHapticsEnabled(data.hapticsEnabled !== false);
      setCareRemindersEnabled(data.careRemindersEnabled === true);
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
      shareOnboardingSurvey,
      aboutMe,
      assistantName,
      assistantCharacterId,
      assistantCharacterNames,
      onboardingSurveyAnswers,
      reduceMotion: reduceMotionPreference,
      hapticsEnabled,
      careRemindersEnabled,
    }).then(() => {
      if (!pendingLocalAction) setLocalDataSaveError(null);
    }).catch(error => {
      setLocalDataSaveError(error instanceof Error ? error.message : 'Could not save private data on this device.');
    });
  }, [localDataReady, localDataOwner, owner, conversations, activeConversationId, memories, rememberInSession, shareMemories, shareChatHistory, shareAboutMe, shareOnboardingSurvey, aboutMe, assistantName, assistantCharacterId, assistantCharacterNames, emotionCheckIns, journalEntries, onboardingSurveyAnswers, reduceMotionPreference, hapticsEnabled, careRemindersEnabled, pendingLocalAction]);

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

  const appendStickerMessage = (conversationId: string, stickerId: NonNullable<Message['stickerId']>) => {
    const id = nextMessageId.current = Math.max(Date.now(), nextMessageId.current + 1);
    appendConversationMessage(conversationId, {
      id,
      text: '',
      author: 'teddy',
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      stickerId,
    });
  };

  const openMemory = (memory?: Memory) => {
    setEditing(memory ?? null);
    setMemoryDraft(memory?.text ?? '');
    setMemoryActionError(null);
    setMemoryDeleteRetry(null);
    setMemoryModal(true);
  };

  const closeMemoryEditor = () => {
    if (memorySaving) return;
    const originalText = editing?.text ?? '';
    if (memoryDraft.trim() !== originalText) {
      confirmAction('Discard memory changes?', 'Your unsaved memory text will be discarded.', () => {
        setMemoryModal(false);
        setEditing(null);
        setMemoryDraft('');
        setMemoryActionError(null);
      });
      return;
    }
    setMemoryModal(false);
    setEditing(null);
    setMemoryDraft('');
    setMemoryActionError(null);
  };

  const saveMemory = async () => {
    if (memorySaving) return;
    const value = memoryDraft.trim();
    if (!value) {
      setMemoryActionError('Write a memory before saving.');
      return;
    }
    const nextMemories = editing
      ? memories.map(item => item.id === editing.id ? { ...item, text: value } : item)
      : [{ id: Date.now(), text: value, date: 'Added just now' }, ...memories];
    setMemorySaving(true);
    setMemoryActionError(null);
    try {
      await persistLocalSnapshot({ memories: nextMemories });
      setMemoryModal(false);
      setEditing(null);
      setMemoryDraft('');
      setMemoryDeleteRetry(null);
      setMemoryActionError(null);
    } catch {
      setMemoryActionError('This memory could not be saved. Your text is still in the editor; retry saving before leaving this screen.');
    } finally {
      setMemorySaving(false);
    }
  };

  const persistForgetMemory = async (memory: Memory) => {
    setMemoryActionError(null);
    const nextMemories = memories.filter(item => item.id !== memory.id);
    try {
      await persistLocalSnapshot({ memories: nextMemories });
      setMemoryDeleteRetry(null);
      setMemoryActionError(null);
    } catch {
      setMemoryDeleteRetry(memory);
      setMemoryActionError('This memory could not be forgotten from saved data. It is still stored on this device; retry the removal.');
    }
  };

  const removeMemory = (memory: Memory) => confirmAction(
    'Forget this memory?',
    'It will be removed from saved memories on this device.',
    () => { runInBackground(persistForgetMemory(memory)); },
  );

  const retryMemoryDelete = () => {
    if (memoryDeleteRetry) runInBackground(persistForgetMemory(memoryDeleteRetry));
  };

  const setConversationPinned = useCallback((conversationId: string, pinned: boolean) => {
    const nextConversations = conversations.map(conversation => conversation.id === conversationId
      ? { ...conversation, pinned }
      : conversation);
    const persistPin = async () => {
      await persistLocalSnapshot({ conversations: nextConversations });
    };
    runInBackground(persistPin().catch(() => {
      setPendingLocalAction(() => persistPin);
      setLocalDataSaveError('This chat change could not be saved. The saved version remains unchanged; retry to apply the change.');
    }));
  }, [conversations, persistLocalSnapshot]);

  const beginRenameConversation = useCallback((conversation: Conversation) => {
    setRenameConversationId(conversation.id);
    setRenameDraft(conversation.title);
    setRenameError(null);
  }, []);

  const saveConversationRename = async () => {
    const newTitle = renameDraft.trim().slice(0, 80);
    if (!renameConversationId || !newTitle || renameSaving) return;
    const nextConversations = conversations.map(conversation => conversation.id === renameConversationId
      ? { ...conversation, title: newTitle, updatedAt: new Date().toISOString() }
      : conversation);
    setRenameSaving(true);
    setRenameError(null);
    try {
      await persistLocalSnapshot({ conversations: nextConversations });
      setRenameConversationId(null);
      setRenameDraft('');
      setRenameError(null);
    } catch {
      setRenameError('This chat name could not be saved. Your new name is still in the field; try saving again.');
    } finally {
      setRenameSaving(false);
    }
  };

  const closeRenameDialog = () => {
    if (renameSaving) return;
    const original = conversations.find(conversation => conversation.id === renameConversationId)?.title ?? '';
    const close = () => {
      setRenameConversationId(null);
      setRenameDraft('');
      setRenameError(null);
    };
    if (renameDraft !== original) {
      confirmAction('Discard chat rename?', 'Your unsaved chat name will be discarded.', close);
    } else {
      close();
    }
  };

  const deleteConversation = useCallback((conversation: Conversation) => {
    if (streamingConversationId === conversation.id) return;
    confirmAction(
      'Delete this chat?',
      `"${conversation.title}" and its messages will be removed from this device for this account.`,
      () => {
        const remaining = conversations.filter(item => item.id !== conversation.id);
        const nextActiveId = activeConversationId === conversation.id
          ? remaining[0]?.id ?? null
          : activeConversationId;
        const persistDelete = async () => {
          await persistLocalSnapshot({ conversations: remaining, activeConversationId: nextActiveId });
          if (activeConversationId === conversation.id) {
            setDraft('');
            setChatError(null);
            setRetryMessage(null);
          }
        };
        runInBackground(persistDelete().catch(() => {
          setPendingLocalAction(() => persistDelete);
          setLocalDataSaveError('This chat could not be deleted from saved data. The chat remains available; retry to confirm the removal.');
        }));
      },
    );
  }, [activeConversationId, conversations, streamingConversationId, persistLocalSnapshot]); 

  const startNewConversation = useCallback(() => {
    const activeEmpty = conversations.find(conversation => conversation.id === activeConversationId && conversation.messages.length === 0);
    const reusableEmpty = activeEmpty ?? [...conversations]
      .filter(conversation => conversation.messages.length === 0)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

    if (reusableEmpty) {
      if (reusableEmpty.id !== activeConversationId) setDraft('');
      setActiveConversationId(reusableEmpty.id);
      setPage('chat');
      return;
    }

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
  }, [activeConversationId, conversations]);

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setPage('chat');
    setDraft('');
  }, []);  const toggleSidebarCollapsed = useCallback(() => {
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
        setShareOnboardingSurvey(false);
        setAboutMe('');
        setOnboardingSurveyAnswers(undefined);
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
        setShareOnboardingSurvey(false);
        setAboutMe('');
        setOnboardingSurveyAnswers(undefined);
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
    if (!localDataReady) {
      setLocalDataRetry(current => current + 1);
      return;
    }
    if (pendingLocalAction) {
      const actionToRetry = pendingLocalAction;
      try {
        await actionToRetry();
        setPendingLocalAction(null);
        setLocalDataSaveError(null);
      } catch (error) {
        setPendingLocalAction(() => actionToRetry);
        setLocalDataSaveError(localDataErrorMessage(error, 'save'));
      }
      return;
    }
    setLocalDataSaveError(null);
    try {
      await localDataService.save(owner, { conversations, activeConversationId, memories, emotionCheckIns, journalEntries, rememberInSession, shareMemories, shareChatHistory, shareAboutMe, shareOnboardingSurvey, aboutMe, assistantName, assistantCharacterId, assistantCharacterNames, onboardingSurveyAnswers, reduceMotion: reduceMotionPreference, hapticsEnabled });
    } catch (error) {
      setLocalDataSaveError(localDataErrorMessage(error, 'save'));
    }
  };

  const saveEmotionCheckIn = useCallback(async (entry: EmotionCheckIn) => {
    const nextEntries = [entry, ...emotionCheckIns.filter(existing => existing.id !== entry.id)].slice(0, 500);
    await localDataService.save(owner, {
      conversations, activeConversationId, memories, emotionCheckIns: nextEntries, journalEntries,
      rememberInSession, shareMemories, shareChatHistory, shareAboutMe, shareOnboardingSurvey, aboutMe,
      assistantName, assistantCharacterId, assistantCharacterNames,
      onboardingSurveyAnswers,
      reduceMotion: reduceMotionPreference,
      hapticsEnabled,
      careRemindersEnabled,
    });
    setEmotionCheckIns(nextEntries);
    setLocalDataSaveError(null);
  }, [owner, conversations, activeConversationId, memories, emotionCheckIns, journalEntries, rememberInSession, shareMemories, shareChatHistory, shareAboutMe, shareOnboardingSurvey, aboutMe, assistantName, assistantCharacterId, assistantCharacterNames, onboardingSurveyAnswers, reduceMotionPreference, hapticsEnabled, careRemindersEnabled]);

  const deleteEmotionCheckIn = useCallback(async (id: string) => {
    const nextEntries = emotionCheckIns.filter(entry => entry.id !== id);
    await localDataService.save(owner, {
      conversations, activeConversationId, memories, emotionCheckIns: nextEntries, journalEntries,
      rememberInSession, shareMemories, shareChatHistory, shareAboutMe, shareOnboardingSurvey, aboutMe,
      assistantName, assistantCharacterId, assistantCharacterNames,
      onboardingSurveyAnswers,
      reduceMotion: reduceMotionPreference,
      hapticsEnabled,
      careRemindersEnabled,
    });
    setEmotionCheckIns(nextEntries);
    setLocalDataSaveError(null);
  }, [owner, conversations, activeConversationId, memories, emotionCheckIns, journalEntries, rememberInSession, shareMemories, shareChatHistory, shareAboutMe, shareOnboardingSurvey, aboutMe, assistantName, assistantCharacterId, assistantCharacterNames, onboardingSurveyAnswers, reduceMotionPreference, hapticsEnabled, careRemindersEnabled]);

  const saveJournalEntry = useCallback(async (entry: JournalEntry) => {
    const nextEntries = [entry, ...journalEntries.filter(existing => existing.id !== entry.id)].slice(0, 1000);
    await localDataService.save(owner, {
      conversations, activeConversationId, memories, emotionCheckIns, journalEntries: nextEntries,
      rememberInSession, shareMemories, shareChatHistory, shareAboutMe, shareOnboardingSurvey, aboutMe,
      assistantName, assistantCharacterId, assistantCharacterNames,
      onboardingSurveyAnswers,
      reduceMotion: reduceMotionPreference,
      hapticsEnabled,
      careRemindersEnabled,
    });
    setJournalEntries(nextEntries);
    setLocalDataSaveError(null);
  }, [owner, conversations, activeConversationId, memories, emotionCheckIns, journalEntries, rememberInSession, shareMemories, shareChatHistory, shareAboutMe, shareOnboardingSurvey, aboutMe, assistantName, assistantCharacterId, assistantCharacterNames, onboardingSurveyAnswers, reduceMotionPreference, hapticsEnabled, careRemindersEnabled]);

  const deleteJournalEntry = useCallback(async (id: string) => {
    const nextEntries = journalEntries.filter(entry => entry.id !== id);
    await localDataService.save(owner, {
      conversations, activeConversationId, memories, emotionCheckIns, journalEntries: nextEntries,
      rememberInSession, shareMemories, shareChatHistory, shareAboutMe, shareOnboardingSurvey, aboutMe,
      assistantName, assistantCharacterId, assistantCharacterNames,
      onboardingSurveyAnswers,
      reduceMotion: reduceMotionPreference,
      hapticsEnabled,
      careRemindersEnabled,
    });
    setJournalEntries(nextEntries);
    setLocalDataSaveError(null);
  }, [owner, conversations, activeConversationId, memories, emotionCheckIns, journalEntries, rememberInSession, shareMemories, shareChatHistory, shareAboutMe, shareOnboardingSurvey, aboutMe, assistantName, assistantCharacterId, assistantCharacterNames, onboardingSurveyAnswers, reduceMotionPreference, hapticsEnabled, careRemindersEnabled]);

  const exportBackup = (passphrase: string) => createEncryptedBackup({
    conversations, activeConversationId, memories, rememberInSession, shareMemories, shareChatHistory, shareAboutMe, shareOnboardingSurvey, aboutMe, assistantName, assistantCharacterId, assistantCharacterNames, onboardingSurveyAnswers, careRemindersEnabled,
  }, owner, passphrase);

  const importBackup = async (fileContents: string, passphrase: string) => {
    const imported = await readEncryptedBackup(fileContents, owner, passphrase);
    const backupPreview = [
      `${imported.conversations.length} conversation${imported.conversations.length === 1 ? '' : 's'}`,
      `${imported.memories.length} saved memor${imported.memories.length === 1 ? 'y' : 'ies'}`,
      `${(imported.emotionCheckIns ?? []).length} emotion check-in${(imported.emotionCheckIns ?? []).length === 1 ? '' : 's'}`,
      `${(imported.journalEntries ?? []).length} journal entr${(imported.journalEntries ?? []).length === 1 ? 'y' : 'ies'}`,
    ].join(' • ');
    const previewMessage = `Backup contents: ${backupPreview}.\n\nChoose how to restore this backup. MERGE keeps your current preferences and combines records; REPLACE overwrites saved data on this device. Nothing changes until you confirm.`;
    let mode: 'merge' | 'replace' | null = null;
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert -- a local-only choice is required before changing private saved data.
      const choice = typeof window !== 'undefined' ? window.prompt(`${previewMessage}\n\nType MERGE or REPLACE. Cancel leaves your data unchanged.`, 'MERGE') : null;
      if (choice?.trim().toLocaleLowerCase() === 'merge') mode = 'merge';      else if (choice?.trim().toLocaleLowerCase() === 'replace') mode = 'replace';
    } else {
      mode = await new Promise<'merge' | 'replace' | null>(resolve => Alert.alert('Review backup before restoring', previewMessage, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Merge records', onPress: () => resolve('merge') },
        { text: 'Replace data', style: 'destructive', onPress: () => resolve('replace') },
      ]));
    }
    if (!mode) return false;
    const currentData = {
      conversations, activeConversationId, memories, emotionCheckIns, journalEntries,
      rememberInSession, shareMemories, shareChatHistory, shareAboutMe, shareOnboardingSurvey, aboutMe,
      assistantName, assistantCharacterId, assistantCharacterNames,
      onboardingSurveyAnswers,
      careRemindersEnabled,
    };
    const restored = mode === 'merge' ? mergeLocalAppData(currentData, imported) : imported;
    // Persist the complete replacement in one storage operation before updating React state.
    await localDataService.save(owner, restored);
    setConversations(restored.conversations);
    setActiveConversationId(restored.activeConversationId);
    setMemories(restored.memories);
    setEmotionCheckIns(restored.emotionCheckIns ?? []);
    setJournalEntries(restored.journalEntries ?? []);
    setRememberInSession(restored.rememberInSession);
    rememberPreferenceRef.current = restored.rememberInSession;
    setShareMemories(restored.shareMemories);
    setShareChatHistory(restored.shareChatHistory);
    setShareAboutMe(restored.shareAboutMe);
    setShareOnboardingSurvey(restored.shareOnboardingSurvey ?? false);
    setOnboardingSurveyAnswers(restored.onboardingSurveyAnswers);
    setCareRemindersEnabled(restored.careRemindersEnabled === true);
    setAboutMe(restored.aboutMe);
    setAssistantName(restored.assistantName);
    setAssistantCharacterId(restored.assistantCharacterId ?? DEFAULT_ASSISTANT_CHARACTER_ID);
    setAssistantCharacterNames(restored.assistantCharacterNames ?? {});
    setLocalDataReady(true);
    setLocalDataOwner(owner);
    return true;
  };

  const sendMessage = async (messageToRetry?: string, imageDataUrl?: string, regenerate = false, replaceFromMessageId?: number) => {
    const text = messageToRetry ?? (draft.trim() || (imageDataUrl ? 'Please describe this image.' : ''));
    if ((!text && !imageDataUrl) || isSending || !localDataReady) return;
    const conversationId = activeConversationId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const editIndex = replaceFromMessageId === undefined ? -1 : messages.findIndex(message => message.id === replaceFromMessageId);
    if (replaceFromMessageId !== undefined && editIndex < 0) { setEditingMessageId(null); return; }
    if (!activeConversationId) setActiveConversationId(conversationId);

    const userMessage: Message = {
      id: nextMessageId.current = Math.max(Date.now(), nextMessageId.current + 1),
      text,
      author: 'you',
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      ...(imageDataUrl ? { imageDataUrl } : {}),
    };

    if (replaceFromMessageId !== undefined) {
      setConversations(current => current.map(conversation => conversation.id === conversationId
        ? { ...conversation, updatedAt: new Date().toISOString(), messages: conversation.messages.slice(0, Math.max(0, conversation.messages.findIndex(message => message.id === replaceFromMessageId))) }
        : conversation));
    }
    if (!messageToRetry) appendConversationMessage(conversationId, userMessage);
    if (!messageToRetry) setRetryMessage(null);
    setEditingMessageId(null);
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
      const history = regenerate ? messages.slice(0, -2) : replaceFromMessageId !== undefined ? messages.slice(0, editIndex) : messageToRetry ? messages.slice(0, -1) : messages;
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
        aboutMe: [shareAboutMe ? aboutMe : '', shareOnboardingSurvey && onboardingSurveyAnswers?.length ? onboardingSurveyAnswers.map(answer => answer.question + ': ' + answer.answer).join('\n') : ''].filter(Boolean).join('\n\n').slice(0, 1800),
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
            setStreamingReply(current => stripTeddyStickerMarker(current + buffered));
          }, 16);
        },
      });

      const parsedReply = extractTeddyStickerResponse(responseText);
      const crisisContext = hasCrisisSignal(text)
        || history.slice(-4).some(message => message.author === 'you' && hasCrisisSignal(message.text));
      const recentSticker = messages.slice(-4).some(message => message.author === 'teddy' && message.stickerId);
      const stickerId = !crisisContext && !recentSticker
        ? parsedReply.stickerId ?? inferTeddySticker(text)
        : undefined;
      const assistantMessage: Message = {
        id: nextMessageId.current = Math.max(Date.now(), nextMessageId.current + 1),
        text: parsedReply.text,
        author: 'teddy',
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      };

      appendConversationMessage(conversationId, assistantMessage);
      if (stickerId) appendStickerMessage(conversationId, stickerId);
      runInBackground(refreshCreditBalance());
      if (shouldGenerateTitle) {
        gatewayService.generateChatTitle(text, parsedReply.text, sessionToken).then(generatedTitle => {
          if (!generatedTitle) return;
          setConversations(current => current.map(conversation => conversation.id === conversationId && conversation.title === fallbackTitle
            ? { ...conversation, title: generatedTitle, updatedAt: new Date().toISOString() }
            : conversation));
        }).catch(() => {
          // Title generation is optional; keep the first-message fallback if it fails.
        }).finally(() => { runInBackground(refreshCreditBalance()); });
      }
      streamBufferRef.current = '';
      if (streamUpdateTimerRef.current) clearTimeout(streamUpdateTimerRef.current);
      streamUpdateTimerRef.current = null;
      setStreamingReply('');
      setStreamingConversationId(null);
      setRetryMessage(null);
      setRetryImageDataUrl(null);
      setRetryConversationId(null);
      if (rememberInSession && mayContainDurableMemory(text)) {
        const suggestionRequestId = ++memorySuggestionRequestId.current;
        gatewayService.suggestMemory(text, sessionToken).then(suggestion => {
          if (!suggestion || suggestionRequestId !== memorySuggestionRequestId.current || !rememberPreferenceRef.current) return;
          const duplicate = memories.some(memory => memory.text.toLowerCase() === suggestion.toLowerCase());
          if (!duplicate) setMemorySuggestion({ conversationId, messageId: assistantMessage.id, fact: suggestion });
        }).catch(() => {
          // Memory suggestions are optional background work; provider errors must not interrupt chat.
        }).finally(() => { runInBackground(refreshCreditBalance()); });
      }
    } catch (error) {
      runInBackground(refreshCreditBalance());
      if (abortController.signal.aborted) {
        const partialReply = extractTeddyStickerResponse(receivedReplyRef.current.trim());
        const safePartialSticker = partialReply.stickerId && !hasCrisisSignal(text) && !messages.slice(-4).some(message => message.author === 'you' && hasCrisisSignal(message.text)) ? partialReply.stickerId : undefined;
        if (partialReply.text) {
          appendConversationMessage(conversationId, {
            id: nextMessageId.current = Math.max(Date.now(), nextMessageId.current + 1),
            text: partialReply.text,
            author: 'teddy',
            time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          });
        }
        if (safePartialSticker) appendStickerMessage(conversationId, safePartialSticker);
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
          if ((restoreError as { status?: number }).status === 401) {
            onLogout();
            return;
          }
          const detail = authErrorMessage(restoreError, 'session-restore');
          setChatError(`Your sign-in could not be refreshed. ${detail}`);
          setChatErrorConversationId(conversationId);
          setRetryMessage(text);
          setRetryImageDataUrl(imageDataUrl ?? null);
          setRetryConversationId(conversationId);
          return;
        }
      }
      const message = chatErrorMessage(error);
      setChatError(message);
      setChatErrorConversationId(conversationId);
      setRetryMessage(text);
      setRetryImageDataUrl(imageDataUrl ?? null);
      setRetryConversationId(conversationId);
    } finally {
      if (responseAbortControllerRef.current === abortController) responseAbortControllerRef.current = null;
      setIsSending(false);
    }
  };

  const stopResponse = () => responseAbortControllerRef.current?.abort();

  const openCrisisResources = () => {
    openExternalUrl('https://findahelpline.com/').catch(() => {
      setChatError('Could not open the helpline directory. Visit https://findahelpline.com/ directly or try again.');
    });
  };

  const openPhoneAction = (scheme: 'tel' | 'sms', number: string, failureMessage: string) => {
    openExternalUrl(`${scheme}:${number}`).catch(() => {
      setChatError(failureMessage);
    });
  };
  const callEmergencyServices = (number: string) => openPhoneAction('tel', number, `Could not start a call. Dial ${number} from your phone, or use the local emergency number.`);
  const callCrisisHelpline = (number: string) => openPhoneAction('tel', number, `Could not call ${number}. Use the local helpline directory instead.`);
  const textCrisisHelpline = (number: string) => openPhoneAction('sms', number, `Could not open a text message to ${number}. Use the local helpline directory instead.`);
  const openHelplineWebsite = (url: string) => {
    openExternalUrl(url).catch(() => {
      setChatError(`Could not open the official helpline website. Visit ${url} directly or try again.`);
    });
  };

  const rootInsetsStyle = { paddingTop: insets.top, paddingBottom: wide ? insets.bottom : 0 };
  if (localDataReady && localDataOwner === owner && onboardingSurveyAnswers === undefined) {
    return <React.Suspense fallback={<View style={styles.wellbeingStudioLoading}><Text style={styles.wellbeingStudioLoadingText}>Preparing your welcome…</Text></View>}><LazyOnboardingSurvey onComplete={async (answers, createInitialMap) => {
      await persistLocalSnapshot({ onboardingSurveyAnswers: answers });
      if (createInitialMap && answers.length) {
        try {
          const snapshot = await gatewayService.evaluateOnboardingEmotions(answers, sessionToken);
          await saveEmotionCheckIn({
            id: 'survey-' + Date.now().toString(36),
            createdAt: new Date().toISOString(),
            emotions: snapshot.emotions,
            energy: snapshot.energy,
            support: 'unsure',
            origin: 'survey-ai',
            note: 'AI-estimated starting snapshot based on the optional onboarding survey. This is a reflection aid, not a diagnosis.',
          });
        } catch {
          Alert.alert('Starting emotion web not ready', 'Your survey is saved. Teddy Bud could not create the starting estimate right now; you can add a check-in later.');
        }
      }
      if (Platform.OS === 'android' && await browserAuthService.supportsBiometrics()) {
        Alert.alert(
          'Set up secure sign-in',
          'Use the fingerprint unlock registered on this Android device. Android will show its own secure confirmation. Next time you open Teddy Bud, this check appears automatically; you can cancel and use your password instead.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Enable', onPress: async () => {
              try {
                await browserAuthService.enableBiometricSignIn();
                Alert.alert('Biometric sign-in enabled', 'Teddy Bud will ask for your device biometric as soon as it opens.');
              } catch {
                Alert.alert('Could not enable biometric sign-in', 'Check that a fingerprint is registered in Android Settings. You can still use your username and password.');
              }
            } },
          ],
        );
      }
    }} /></React.Suspense>;
  }

  const discoverFramePage = discoverPages.includes(page) ? page : lastDiscoverPage;
  const renderPageFrame = (tab: PrimaryNavPage) => (
    localDataError ? <LocalDataError error={localDataError} onRetry={retryLocalData} onClear={clearUnavailableLocalData} /> : !localDataReady || localDataOwner !== owner ? <LocalDataLoading /> : <>
              {localDataSaveError && <LocalDataSaveWarning error={localDataSaveError} onRetry={retryLocalData} />}
              {tab === 'chat' && page !== 'history' && <ChatPage key={activeConversationId ?? 'new-chat'} wide={wide} bottomInset={insets.bottom} conversationId={activeConversationId} assistantName={assistantName} messages={messages} streamingReply={activeConversationId === streamingConversationId ? streamingReply : ''} isThinking={isSending && activeConversationId === streamingConversationId} conversationTitle={activeConversation?.title ?? 'A quiet place to be'} onOpenHistory={() => setPage('history')} onRenameChat={() => { if (activeConversation) beginRenameConversation(activeConversation); }} isPinned={activeConversation?.pinned === true} canManageChat={activeConversation !== null} onTogglePin={() => { if (activeConversation) setConversationPinned(activeConversation.id, !activeConversation.pinned); }} onOpenCrisisResources={openCrisisResources} emergencyCallOption={emergencyCallOption} crisisHelplineOption={crisisHelplineOption} onCallEmergency={callEmergencyServices} onCallHelpline={callCrisisHelpline} onTextHelpline={textCrisisHelpline} onOpenHelplineWebsite={openHelplineWebsite} onSaveOccasion={fact => {
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
              }} onDismissMemorySuggestion={() => setMemorySuggestion(null)} draft={draft} setDraft={setDraft} onSend={imageDataUrl => editingMessageId !== null ? sendMessage(undefined, imageDataUrl, false, editingMessageId) : sendMessage(undefined, imageDataUrl)} editingMessageId={editingMessageId} onEditMessage={message => { setEditingMessageId(message.id); setDraft(message.text); }} onCancelEdit={() => { setEditingMessageId(null); setDraft(''); }} onStop={stopResponse} onRetry={() => retryMessage && sendMessage(retryMessage, retryImageDataUrl ?? undefined)} onRegenerate={() => { const currentMessages = activeConversation?.messages ?? []; const lastMessage = currentMessages[currentMessages.length - 1]; const lastUser = [...currentMessages].reverse().find(message => message.author === 'you'); if (!lastMessage || lastMessage.author !== 'teddy' || !lastUser || isSending) return; setConversations(current => current.map(conversation => conversation.id === activeConversationId ? { ...conversation, updatedAt: new Date().toISOString(), messages: conversation.messages.filter(message => message.id !== lastMessage.id) } : conversation)); runInBackground(sendMessage(lastUser.text, undefined, true)); }} retryPending={retryConversationId === activeConversationId && Boolean(retryMessage)} isSending={isSending} chatError={chatErrorConversationId === activeConversationId ? chatError : null} />}
              {tab === 'chat' && page === 'history' && <ChatHistoryPage
                conversations={conversations}
                activeConversationId={activeConversationId}
                busyConversationId={streamingConversationId}
                onBack={() => setPage('chat')}
                onSelect={selectConversation}
                onNewConversation={startNewConversation}
                onPin={setConversationPinned}
                onDelete={deleteConversation}
                onRename={beginRenameConversation}
              />}
              {tab === 'discover' && discoverFramePage === 'journal' && <DiscoverSectionTransition transitionKey={discoverFramePage}><JournalPage wide={wide} entries={journalEntries} onSave={saveJournalEntry} onDelete={deleteJournalEntry} onShare={entry => {
                const preparedMessage = `I'd like to talk about this journal entry with you.\\n\\n${entry.title}\\n\\n${entry.body}\\n\\nPlease help me reflect on it.`;
                if (draft.trim()) {
                  confirmAction('Keep your existing draft?', 'Your current chat draft is not empty. Continuing will append the journal entry so your draft is preserved.', () => {
                    setDraft(current => current.trim() ? `${current}\\n\\n${preparedMessage}` : preparedMessage);
                    setPage('chat');
                  });
                } else {
                  setDraft(preparedMessage);
                  setPage('chat');
                }
              }} /></DiscoverSectionTransition>}
              {tab === 'discover' && discoverFramePage === 'studio' && <DiscoverSectionTransition transitionKey={discoverFramePage}><React.Suspense fallback={<View style={styles.wellbeingStudioLoading}><Text style={styles.wellbeingStudioLoadingText}>Preparing your wellbeing studio…</Text></View>}><LazyWellbeingStudio wide={wide} reduceMotion={reduceMotionPreference} hapticsEnabled={hapticsEnabled} /></React.Suspense></DiscoverSectionTransition>}
              {tab === 'discover' && discoverFramePage === 'emotions' && <DiscoverSectionTransition transitionKey={discoverFramePage}><EmotionsPage wide={wide} entries={emotionCheckIns} onSave={saveEmotionCheckIn} onDelete={deleteEmotionCheckIn} /></DiscoverSectionTransition>}
              {tab === 'memories' && <MemoriesPage wide={wide} memories={memories} memoryEnabled={rememberInSession} onAdd={() => openMemory()} onEdit={openMemory} onDelete={removeMemory} actionError={memoryActionError} onDismissActionError={() => { setMemoryActionError(null); setMemoryDeleteRetry(null); }} canRetryDelete={memoryDeleteRetry !== null} onRetryDelete={retryMemoryDelete} />}
              {tab === 'settings' && page === 'privacy' && <DiscoverSectionTransition transitionKey="privacy"><PrivacyPage wide={wide} onBack={() => setPage('settings')} rememberInSession={rememberInSession} shareMemories={shareMemories} shareChatHistory={shareChatHistory} shareAboutMe={shareAboutMe} shareOnboardingSurvey={shareOnboardingSurvey} onShareOnboardingSurveyChange={setShareOnboardingSurvey} onRememberChange={value => { rememberPreferenceRef.current = value; setRememberInSession(value); }} onShareMemoriesChange={setShareMemories} onShareChatHistoryChange={setShareChatHistory} onShareAboutMeChange={setShareAboutMe} onClear={confirmClear} /></DiscoverSectionTransition>}
              {tab === 'settings' && page !== 'privacy' && <SettingsPage wide={wide} username={username} reduceMotion={reduceMotionPreference} hapticsEnabled={hapticsEnabled} careRemindersEnabled={careRemindersEnabled} onCareRemindersChange={value => { if (value) { runInBackground((async () => { const allowed = await requestCareReminderPermission(); if (!allowed) { Alert.alert('Notifications are disabled', 'Allow Teddy Bud notifications in Android Settings to receive gentle check-ins.'); return; } setCareRemindersEnabled(true); await persistLocalSnapshot({ careRemindersEnabled: true }); })()); } else { setCareRemindersEnabled(false); runInBackground(persistLocalSnapshot({ careRemindersEnabled: false })); runInBackground(cancelCareReminder()); } }} onReduceMotionChange={value => { setReduceMotionPreference(value); runInBackground(persistLocalSnapshot({ reduceMotion: value })); }} onHapticsChange={value => { setHapticsEnabled(value); runInBackground(persistLocalSnapshot({ hapticsEnabled: value })); }} onOpenPrivacy={() => setPage('privacy')} creditBalance={creditBalance} aboutMe={aboutMe} assistantName={assistantName} assistantCharacterId={assistantCharacterId} assistantCharacterNames={assistantCharacterNames} onAboutMeChange={setAboutMe} onSaveAssistantCharacter={(id, name) => {
                const savedName = name.trim().slice(0, 32);
                if (!savedName) return;
                setAssistantCharacterId(id);
                setAssistantName(savedName);
                setAssistantCharacterNames(current => ({ ...current, [id]: savedName }));
              }} onExport={exportBackup} onImport={importBackup} onLogout={onLogout} />}
              {tab === 'discover' && discoverFramePage === 'discover' && <DiscoverSectionTransition transitionKey={discoverFramePage}><DiscoverPage wide={wide} onNavigate={setPage} /></DiscoverSectionTransition>}
              </>
  );

  return (
    <UISettingsContext.Provider value={{ reduceMotion: reduceMotionPreference, hapticsEnabled }}>
    <View style={[styles.root, rootInsetsStyle]}>
      {wide && <AppErrorBoundary><Sidebar
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
      /></AppErrorBoundary>}
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
          {!!username && <Text style={styles.accountHandle}>@{username}</Text>}
        </View>

        <View style={styles.contentArea}>
          <SoftPageTransition transitionKey={page} onSwipe={direction => {
            const currentIndex = primaryTabIndex(page);
            const nextIndex = Math.max(0, Math.min(mobileNavItems.length - 1, currentIndex + direction));
            if (nextIndex !== currentIndex) setPage(mobileNavItems[nextIndex].id);
          }} enabled={!wide}>
            <AppErrorBoundary><View style={styles.pagerFrame}>{renderPageFrame('chat')}</View></AppErrorBoundary>
            <AppErrorBoundary><View style={styles.pagerFrame}>{renderPageFrame('discover')}</View></AppErrorBoundary>
            <AppErrorBoundary><View style={styles.pagerFrame}>{renderPageFrame('memories')}</View></AppErrorBoundary>
            <AppErrorBoundary><View style={styles.pagerFrame}>{renderPageFrame('settings')}</View></AppErrorBoundary>
          </SoftPageTransition>
        </View>
        {!wide && !keyboardVisible && <AppErrorBoundary><BottomNav page={page} onNavigate={setPage} onNewConversation={startNewConversation} bottomInset={insets.bottom} /></AppErrorBoundary>}
      </View>

      <Modal visible={memoryModal} animationType="fade" transparent onRequestClose={closeMemoryEditor}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTopline}>
              <View style={styles.modalIcon}><AppIcon name="sparkle" size={19} /></View>
              <Pressable onPress={closeMemoryEditor} disabled={memorySaving} accessibilityRole="button" accessibilityLabel="Close memory editor" style={[styles.closeButton, memorySaving && styles.buttonDisabled]}><AppIcon name="close" color={C.muted} size={17} /></Pressable>
            </View>
            <Text style={styles.modalTitle}>{editing ? 'Edit a memory' : 'Keep a small thing in mind'}</Text>
            <Text style={styles.modalBody}>Add a detail to keep on this device. Saved memories are included with future chats sent to Teddy’s online reply service.</Text>
            {memoryActionError && <View accessibilityRole="alert" style={styles.authError}><Text accessibilityLiveRegion="polite" style={styles.authErrorText}>{memoryActionError}</Text></View>}
            <TextInput accessibilityLabel="Memory text" autoFocus value={memoryDraft} onChangeText={value => { setMemoryDraft(value); setMemoryActionError(null); }} placeholder="Write a gentle reminder…" placeholderTextColor={C.muted} multiline maxLength={500} editable={!memorySaving} style={styles.memoryInput} textAlignVertical="top" />
            <View style={styles.modalActions}>
              <Button label="Cancel" tone="quiet" onPress={closeMemoryEditor} disabled={memorySaving} />
              <Button label={memorySaving ? 'Saving…' : editing ? 'Save changes' : 'Add memory'} onPress={saveMemory} disabled={memorySaving || !memoryDraft.trim()} />
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={renameConversationId !== null} animationType="fade" transparent onRequestClose={closeRenameDialog}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTopline}>
              <View style={styles.modalIcon}><AppIcon name="edit" size={19} /></View>
              <Pressable onPress={closeRenameDialog} disabled={renameSaving} accessibilityRole="button" accessibilityLabel="Close rename chat dialog" style={[styles.closeButton, renameSaving && styles.buttonDisabled]}><AppIcon name="close" color={C.muted} size={17} /></Pressable>
            </View>
            <Text style={styles.modalTitle}>Rename chat</Text>
            <Text style={styles.modalBody}>Choose a short name that helps you find this conversation.</Text>
            {renameError && <View accessibilityRole="alert" style={styles.authError}><Text accessibilityLiveRegion="polite" style={styles.authErrorText}>{renameError}</Text></View>}
            <TextInput accessibilityLabel="Chat name" autoFocus value={renameDraft} onChangeText={value => { setRenameDraft(value.slice(0, 80)); setRenameError(null); }} editable={!renameSaving} placeholder="Chat name" placeholderTextColor={C.muted} maxLength={80} returnKeyType="done" onSubmitEditing={saveConversationRename} style={styles.settingsTextInput} />
            <View style={styles.modalActions}>
              <Button label="Cancel" tone="quiet" onPress={closeRenameDialog} disabled={renameSaving} />
              <Button label={renameSaving ? 'Saving…' : 'Save name'} onPress={saveConversationRename} disabled={renameSaving || !renameDraft.trim()} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </UISettingsContext.Provider>
  );
}

function primaryTabIndex(page: Page): number {
  const primaryPage = page === 'history' ? 'chat' : page === 'privacy' ? 'settings' : discoverPages.includes(page) ? 'discover' : page;
  const index = mobileNavItems.findIndex(item => item.id === primaryPage);
  return index < 0 ? 0 : index;
}

function SoftPageTransition({ transitionKey, children, onSwipe, enabled = true }: {
  transitionKey: string;
  children: React.ReactNode;
  onSwipe: (direction: -1 | 1) => void;
  enabled?: boolean;
}) {
  const reduceMotion = useReducedMotionPreference();
  const { width } = useWindowDimensions();
  const currentIndex = primaryTabIndex(transitionKey as Page);
  const translateX = useRef(new Animated.Value(-currentIndex * width)).current;
  const previousIndex = useRef(currentIndex);
  const onSwipeRef = useRef(onSwipe);
  const enabledRef = useRef(enabled);
  const reduceMotionRef = useRef(reduceMotion);
  onSwipeRef.current = onSwipe;
  enabledRef.current = enabled;
  reduceMotionRef.current = reduceMotion;

  const frames = React.Children.toArray(children);

  const __teddyBudExtractedStyles2 = StyleSheet.create({
    style0: ({ flex: 1, minWidth: 0, overflow: 'hidden' }) as const,
    style1: ({
        width: width * frames.length,
        height: '100%',
        flexDirection: 'row',
        transform: [{ translateX }],
      }) as const,
  });
  useEffect(() => {
    const nextIndex = primaryTabIndex(transitionKey as Page);
    const previousPageIndex = previousIndex.current;
    previousIndex.current = nextIndex;
    translateX.stopAnimation();
    const targetOffset = -nextIndex * width;
    if (previousPageIndex === nextIndex || reduceMotion) {
      translateX.setValue(targetOffset);
      return;
    }
    Animated.spring(translateX, {
      toValue: targetOffset,
      speed: 18,
      bounciness: 1,
      useNativeDriver: true,
    }).start();
  }, [transitionKey, width, reduceMotion, translateX]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) =>
      enabledRef.current && !reduceMotionRef.current
      && Math.abs(gesture.dx) > 12
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
    onPanResponderMove: (_event, gesture) => {
      const baseOffset = -previousIndex.current * width;
      translateX.setValue(baseOffset + Math.max(-width, Math.min(width, gesture.dx)));
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, {
        toValue: -previousIndex.current * width,
        speed: 22,
        bounciness: 2,
        useNativeDriver: true,
      }).start();
    },
    onPanResponderRelease: (_event, gesture) => {
      const activeIndex = previousIndex.current;
      const targetDirection: -1 | 1 = gesture.dx < 0 ? 1 : -1;
      const targetIndex = Math.max(0, Math.min(frames.length - 1, activeIndex + targetDirection));
      const validSwipe = Math.abs(gesture.dx) >= Math.max(56, width * 0.16)
        && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2
        && targetIndex !== activeIndex;

      if (!validSwipe) {
        Animated.spring(translateX, {
          toValue: -activeIndex * width,
          speed: 22,
          bounciness: 2,
          useNativeDriver: true,
        }).start();
        return;
      }

      Animated.timing(translateX, {
        toValue: -targetIndex * width,
        duration: 230,        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        previousIndex.current = targetIndex;
        onSwipeRef.current(targetDirection);
      });
    },
  })).current;

  if (!enabled) {
    const __teddyBudExtractedStyles1 = StyleSheet.create({
      style0: ({ flex: 1 }) as const,
    });
    return <View style={__teddyBudExtractedStyles1.style0}>{frames[currentIndex] ?? frames[0]}</View>;
  }

  return <View
    {...panResponder.panHandlers}
    style={__teddyBudExtractedStyles2.style0}
  >
    <Animated.View
      style={__teddyBudExtractedStyles2.style1}
    >
      {frames.map((frame, index) => {
        const __teddyBudExtractedStyles3 = StyleSheet.create({
          style0: ({ width, height: '100%', flexShrink: 0 }) as const,
        });
        return <View
        key={`teddy-tab-frame-${index}`}
        style={__teddyBudExtractedStyles3.style0}
      >
        {frame}
      </View>;
      })}
    </Animated.View>
  </View>;
}
function DiscoverSectionTransition({ transitionKey, children }: { transitionKey: string; children: React.ReactNode }) {
  const reduceMotion = useReducedMotionPreference();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    opacity.stopAnimation();
    translateX.stopAnimation();
    if (reduceMotion) {
      opacity.setValue(1);
      translateX.setValue(0);
      return undefined;
    }
    opacity.setValue(0);
    translateX.setValue(18);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 210, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, speed: 20, bounciness: 1, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [transitionKey, reduceMotion, opacity, translateX]);
  return <Animated.View style={[styles.pageTransition, { opacity, transform: [{ translateX }] }]}>{children}</Animated.View>;
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
    {onPin && onDelete && <Pressable accessibilityRole="button" accessibilityLabel={`Chat options for ${conversation.title}`} accessibilityState={{ expanded: openMenuId === conversation.id }} onPress={() => setOpenMenuId(value => value === conversation.id ? null : conversation.id)} style={({ pressed }) => [styles.chatMenuTrigger, pressed && styles.pressed]}><AppIcon name="menu" color={C.muted} size={18} /></Pressable>}
    </View>
    {openMenuId === conversation.id && onPin && onDelete && <View style={styles.chatActionMenu} accessibilityRole="menu">
      {onRename && <Pressable accessibilityRole="menuitem" accessibilityLabel={`Rename chat ${conversation.title}`} onPress={() => { setOpenMenuId(null); onRename(conversation); }} style={({ pressed }) => [styles.chatActionItem, pressed && styles.pressed]}><Text style={styles.chatActionText}>Rename chat</Text></Pressable>}
      <Pressable accessibilityRole="menuitem" accessibilityLabel={conversation.pinned ? `Unpin chat ${conversation.title}` : `Pin chat ${conversation.title}`} onPress={() => { onPin(conversation.id, !conversation.pinned); setOpenMenuId(null); }} style={({ pressed }) => [styles.chatActionItem, pressed && styles.pressed]}><Text style={styles.chatActionText}>{conversation.pinned ? 'Unpin chat' : 'Pin chat'}</Text></Pressable>
      <Pressable accessibilityRole="menuitem" accessibilityLabel={`Delete chat ${conversation.title}`} accessibilityState={{ disabled: busyConversationId === conversation.id }} disabled={busyConversationId === conversation.id} onPress={() => { setOpenMenuId(null); onDelete(conversation); }} style={({ pressed }) => [styles.chatActionItem, styles.chatActionDelete, busyConversationId === conversation.id && styles.buttonDisabled, pressed && styles.pressed]}><Text style={[styles.chatActionText, styles.chatActionDeleteText]}>Delete chat</Text></Pressable>
    </View>}
    </View>;
  }) : <Text style={styles.historyEmpty}>Your chats will appear here as you talk with Teddy Bud.</Text>;
}

export function ChatHistoryPage({ conversations, activeConversationId, busyConversationId, onBack, onSelect, onNewConversation, onPin, onDelete, onRename }: {
  conversations: Conversation[];
  activeConversationId: string | null;
  busyConversationId?: string | null;
  onBack: () => void;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (conversation: Conversation) => void;
  onRename: (conversation: Conversation) => void;
}) {
  const triggerHaptic = useHapticFeedback();
  const [search, setSearch] = useState('');
  const visibleConversations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return conversations;
    return conversations.filter(conversation => {
      const latestMessage = conversation.messages[conversation.messages.length - 1]?.text ?? '';
      return `${conversation.title} ${latestMessage}`.toLocaleLowerCase().includes(query);
    });
  }, [conversations, search]);

  return <View style={styles.mobileHistoryPage}>
    <View style={styles.historyPageHeader}>
      <View style={styles.historyPageHeaderCopy}>
        <Text style={styles.eyebrow}>YOUR SPACE</Text>
        <Text style={styles.pageTitle}>Your chats</Text>
        <Text style={styles.pageDescription}>{conversations.length} saved {conversations.length === 1 ? 'conversation' : 'conversations'}</Text>
      </View>
      <Button label="Back to chat" onPress={onBack} tone="quiet" />
    </View>
    <Button label="New chat" onPress={() => { triggerHaptic(); onNewConversation(); }} />
    <TextInput
      accessibilityLabel="Search chats"
      value={search}
      onChangeText={setSearch}
      placeholder="Search chats and recent messages"
      placeholderTextColor={C.muted}
      returnKeyType="search"
      style={styles.mobileHistorySearch}
    />
    <ScrollView style={styles.mobileHistoryList} contentContainerStyle={styles.mobileHistoryListContent} keyboardShouldPersistTaps="handled">
      {visibleConversations.length > 0
        ? <ConversationHistoryList
          conversations={visibleConversations}
          activeConversationId={activeConversationId}
          busyConversationId={busyConversationId}
          onSelect={onSelect}
          onPin={onPin}
          onDelete={onDelete}
          onRename={onRename}
        />
        : <Text style={styles.historyEmpty}>{search.trim() ? 'No chats match your search. Try a different word.' : 'Your chats will appear here as you talk with Teddy Bud.'}</Text>}
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
    <Text style={styles.saveWarningText}>{localDataErrorMessage(error, 'save')}</Text>
    <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.saveWarningButton, pressed && styles.pressed]}>
      <Text style={styles.saveWarningButtonText}>Try again</Text>
    </Pressable>
  </View>;
}

function LocalDataError({ error, onRetry, onClear }: { error: string; onRetry: () => void; onClear: () => void }) {
  return <View style={styles.authScreen}><View style={styles.authCard}><Text style={styles.authTitle}>Your saved space needs attention.</Text><Text style={styles.authBody}>{localDataErrorMessage(error, 'load')}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.authButton, pressed && styles.pressed]}><Text style={styles.authButtonText}>Retry local storage</Text></Pressable><Pressable accessibilityRole="button" onPress={onClear} style={styles.authToggle}><Text style={styles.authToggleText}>Clear local data and start over</Text></Pressable><Text style={styles.authFootnote}>Your messages are paused until local storage is available.</Text></View></View>;
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
  const isNavItemSelected = (item: (typeof navItems)[number]) => {
    if (item.id === 'chat') return page === 'chat' || page === 'history';
    if (item.id === 'discover') return discoverPages.includes(page);
    if (item.id === 'settings') return page === 'settings' || page === 'privacy';
    return item.id === page;
  };
  const sidebarWidth = useRef(new Animated.Value(collapsed ? 78 : 258)).current;
  const sidebarPadding = sidebarWidth.interpolate({ inputRange: [78, 258], outputRange: [10, 18] });
  const chevronProgress = useRef(new Animated.Value(collapsed ? 1 : 0)).current;
  const [labelsCollapsed, setLabelsCollapsed] = useState(collapsed);
  const labelOpacity = useRef(new Animated.Value(collapsed ? 0 : 1)).current;
  const chevronRotation = chevronProgress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const __teddyBudExtractedStyles4 = StyleSheet.create({
    style0: ({ opacity: labelOpacity }) as const,
    style1: ({ transform: [{ rotate: chevronRotation }] }) as const,
  });
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
    chevronProgress.stopAnimation();    labelOpacity.stopAnimation();
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
          {!labelsCollapsed && <Animated.View style={__teddyBudExtractedStyles4.style0}><Text style={styles.brandName}>Teddy Bud</Text><Text style={styles.sidebarCaption}>A quiet place to be</Text></Animated.View>}
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Start a new chat" accessibilityHint={labelsCollapsed ? 'Start a new conversation' : undefined} onPress={onNewConversation} style={({ pressed }) => [styles.newChatButton, labelsCollapsed && styles.newChatButtonCollapsed, pressed && styles.pressed]}>
        <Text style={styles.newChatGlyph}>+</Text>{!labelsCollapsed && <Animated.Text style={[styles.newChatLabel, { opacity: labelOpacity }]}>New chat</Animated.Text>}
      </Pressable>
      {!labelsCollapsed && <Animated.Text style={[styles.sidebarLabel, { opacity: labelOpacity }]}>YOUR SPACE</Animated.Text>}
      {navItems.map(item => <NavButton key={item.id} item={item} selected={isNavItemSelected(item)} collapsed={labelsCollapsed} labelOpacity={labelOpacity} onPress={() => onNavigate(item.id)} />)}
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
        <Pressable accessibilityRole="button" accessibilityLabel={visualCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} accessibilityHint={visualCollapsed ? 'Show chat names and navigation labels' : 'Hide labels and keep the icon rail visible'} onPress={onToggleCollapsed} style={({ pressed }) => [styles.sidebarCollapseButton, styles.sidebarCollapseButtonBottom, visualCollapsed && styles.sidebarCollapseButtonCollapsed, pressed && styles.pressed]}><Animated.View style={__teddyBudExtractedStyles4.style1}><AppIcon name="chevron" color={C.cocoa} size={18} /></Animated.View></Pressable>
      </View>
    </Animated.View>
  );
});

function NavButton({ item, selected, onPress, collapsed = false, labelOpacity }: { item: (typeof navItems)[number]; selected: boolean; onPress: () => void; collapsed?: boolean; labelOpacity?: Animated.Value }) {
  const reduceMotion = useReducedMotionPreference();
  const triggerHaptic = useHapticFeedback();
  const [pulseKey, setPulseKey] = useState(0);
  return <Pressable accessibilityRole="button" accessibilityLabel={item.label} accessibilityHint={collapsed ? `Open ${item.label}` : undefined} accessibilityState={{ selected }} onPress={() => { triggerHaptic(); setPulseKey(value => value + 1); onPress(); }} style={({ pressed }) => [styles.navButton, collapsed && styles.navButtonCollapsed, selected && styles.navButtonSelected, pressed && styles.pressed]}>
    <AnimatedNavIcon name={item.id} active={selected} pulseKey={pulseKey} reduceMotion={reduceMotion} />
    <Animated.Text numberOfLines={1} style={[styles.navLabel, selected && styles.navLabelSelected, collapsed && styles.navLabelCollapsed, { opacity: labelOpacity ?? (collapsed ? 0 : 1) }]}>{item.label}</Animated.Text>
    {selected && !collapsed && <View style={styles.navDot} />}
  </Pressable>;
}

function useHapticFeedback() {
  const { hapticsEnabled } = useContext(UISettingsContext);
  return useCallback(() => {
    if (hapticsEnabled) { try { Vibration.vibrate(8); } catch { /* Haptics must never interrupt navigation. */ } }
  }, [hapticsEnabled]);
}

function useReducedMotionPreference() {
  const appSettings = useContext(UISettingsContext);
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        setReduceMotion(false);
        return undefined;
      }
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReduceMotion(preference.matches);
      const update = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
      preference.addEventListener('change', update);
      return () => preference.removeEventListener('change', update);
    }

    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(setEnabled => {
      if (mounted) setReduceMotion(setEnabled);
    }).catch(() => {
      if (mounted) setReduceMotion(false);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion || appSettings.reduceMotion;
}

export function DiscoverPage({ wide, onNavigate }: { wide: boolean; onNavigate: (page: Page) => void }) {
  const reduceMotion = useReducedMotionPreference();
  const [infoItem, setInfoItem] = useState<{ label: string; description: string } | null>(null);
  const items: { id: Page; icon: AppIconName; label: string; description: string }[] = [
    { id: 'history', icon: 'history', label: 'Chat history', description: 'Find and reopen a conversation whenever you want to continue where you left off.' },
    { id: 'journal', icon: 'edit', label: 'Private journal', description: 'Write, edit, search, and export personal reflections stored on this device.' },
    { id: 'emotions', icon: 'heart', label: 'Emotional check-in', description: 'Log how you feel and look back at your check-in patterns over time.' },
    { id: 'studio', icon: 'sun', label: 'Wellbeing studio', description: 'Explore simple breathing, grounding, focus, and bedtime exercises that work offline.' },
      ];

  return <>
    <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]}>
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>A LITTLE ROOM TO BREATHE</Text>
        <Text style={styles.pageTitle}>Discover</Text>
      </View>
      <View style={styles.moreList}>
        {items.map(item => <View key={item.id} style={styles.moreItem}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => onNavigate(item.id)}
            style={({ pressed }) => [styles.discoverItemMain, pressed && styles.pressed, pressed && !reduceMotion && styles.squeezePressed]}
          >
            <View style={styles.moreItemIconWrap}><AppIcon name={item.icon} color={C.cocoaDark} size={21} /></View>
            <View style={styles.moreItemCopy}>
              <Text style={styles.moreItemTitle}>{item.label}</Text>
            </View>
            <View accessibilityElementsHidden><AppIcon name="chevron" color={C.muted} size={17} /></View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`About ${item.label}`}
            accessibilityHint="Shows a short explanation"
            onPress={() => setInfoItem({ label: item.label, description: item.description })}
            hitSlop={8}
            style={({ pressed }) => [styles.discoverInfoButton, pressed && styles.pressed]}
          >
            <AppIcon name="info" color="#806D5C" size={17} />
          </Pressable>
        </View>)}
      </View>
    </ScrollView>
    <Modal visible={!!infoItem} transparent animationType="fade" onRequestClose={() => setInfoItem(null)}>
      <Pressable style={styles.discoverInfoBackdrop} onPress={() => setInfoItem(null)}>
        <Pressable style={styles.discoverInfoCard} onPress={() => undefined}>
          <View style={styles.discoverInfoTop}>
            <View style={styles.discoverInfoBadge}><Text style={styles.discoverInfoGlyph}>i</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setInfoItem(null)} style={styles.discoverInfoClose}>
              <AppIcon name="close" color={C.muted} size={17} />
            </Pressable>
          </View>
          <Text style={styles.discoverInfoTitle}>{infoItem?.label}</Text>
          <Text style={styles.discoverInfoDescription}>{infoItem?.description}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}

export function BottomNav({ page, onNavigate, onNewConversation, bottomInset }: { page: Page; onNavigate: (page: Page) => void; onNewConversation: () => void; bottomInset: number }) {
  const reduceMotion = useReducedMotionPreference();
  const triggerHaptic = useHapticFeedback();
  const [pulseKeys, setPulseKeys] = useState<Record<PrimaryNavPage, number>>({ chat: 0, discover: 0, memories: 0, settings: 0 });
  const isSelected = (item: (typeof mobileNavItems)[number]) => {
    if (item.id === 'chat') return page === 'chat' || page === 'history';
    if (item.id === 'discover') return discoverPages.includes(page);
    if (item.id === 'settings') return page === 'settings' || page === 'privacy';
    return item.id === page;
  };
  const renderItem = (item: (typeof mobileNavItems)[number]) => {
    const selected = isSelected(item);
    return <Pressable
      key={item.id}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityHint={item.id === 'discover' ? 'Open your journal, emotional check-ins, and wellbeing exercises' : undefined}
      accessibilityState={{ selected }}
      onPress={() => { triggerHaptic(); setPulseKeys(current => ({ ...current, [item.id]: current[item.id] + 1 })); onNavigate(item.id); }}
      style={({ pressed }) => [
        styles.bottomNavItem,
        selected && styles.bottomNavItemActive,
        pressed && styles.pressed,
        pressed && !reduceMotion && styles.squeezePressed,
      ]}
    >
      <AnimatedNavIcon name={item.id} active={selected} pulseKey={pulseKeys[item.id]} reduceMotion={reduceMotion} />
      <Text numberOfLines={1} style={[styles.bottomLabel, selected && styles.bottomLabelActive]}>{item.label}</Text>
    </Pressable>;
  };

  return <View style={[styles.bottomNav, { paddingBottom: Math.max(bottomInset, 8) }]}>
    {renderItem(mobileNavItems[0])}
    {renderItem(mobileNavItems[1])}
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start a new chat"
      accessibilityHint="Creates a new conversation and opens the message composer"
      onPress={() => { triggerHaptic(); onNewConversation(); }}
      style={({ pressed }) => [
        styles.bottomNavPlusAction,
        pressed && styles.pressed,
        pressed && !reduceMotion && styles.squeezePressed,
      ]}
    >
      <View style={styles.bottomNavPlusBox}><Text style={styles.bottomNavPlusGlyph}>+</Text></View>
    </Pressable>
    {renderItem(mobileNavItems[2])}
    {renderItem(mobileNavItems[3])}
  </View>;
}

export function ChatPage({ wide, bottomInset = 0, conversationId, assistantName = 'Teddy', messages, streamingReply = '', isThinking = false, conversationTitle, onOpenHistory, onRenameChat, isPinned, onTogglePin, canManageChat = true, onOpenCrisisResources, emergencyCallOption, crisisHelplineOption, onCallEmergency, onCallHelpline, onTextHelpline, onOpenHelplineWebsite, onSaveOccasion, memorySuggestion, onSaveMemorySuggestion, onDismissMemorySuggestion, draft, setDraft, onSend, editingMessageId, onEditMessage, onCancelEdit, onStop, onRetry, onRegenerate, retryPending, isSending, chatError }: { wide: boolean; bottomInset?: number; conversationId?: string | null; assistantName?: string; messages: Message[]; streamingReply?: string; isThinking?: boolean; conversationTitle: string; onOpenHistory: () => void; onRenameChat: () => void; isPinned: boolean; onTogglePin: () => void; canManageChat?: boolean; onOpenCrisisResources: () => void; emergencyCallOption: EmergencyCallOption | null; crisisHelplineOption: CrisisHelplineOption | null; onCallEmergency: (number: string) => void; onCallHelpline: (number: string) => void; onTextHelpline: (number: string) => void; onOpenHelplineWebsite: (url: string) => void; onSaveOccasion?: (fact: string) => void; memorySuggestion: MemorySuggestion | null; onSaveMemorySuggestion: () => void; onDismissMemorySuggestion: () => void; draft: string; setDraft: (value: string) => void; onSend: (imageDataUrl?: string) => void; editingMessageId?: number | null; onEditMessage?: (message: Message) => void; onCancelEdit?: () => void; onStop: () => void; onRetry: () => void; onRegenerate?: () => void; retryPending: boolean; isSending: boolean; chatError: string | null }) {
  const __teddyBudExtractedStyles6 = StyleSheet.create({
    style0: ({ flexDirection: "row", alignItems: "center", gap: 7 }) as const,
    style1: ({ width: 42, height: 42, borderRadius: 9, marginRight: 8 }) as const,
    style2: ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 }) as const,
    style3: ({ color: C.cocoaDark, fontSize: 12, fontWeight: '600' }) as const,
    style4: ({ padding: 6 }) as const,
    style5: ({ color: C.cocoa, fontWeight: '700' }) as const,
  });
  const [selectedImage, setSelectedImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [chatActionsOpen, setChatActionsOpen] = useState(false);
  const reduceMotion = useReducedMotionPreference();
  const mascotBreath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    mascotBreath.stopAnimation();
    if (reduceMotion) {
      mascotBreath.setValue(0);
      return undefined;
    }
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(mascotBreath, {
        toValue: 1,
        duration: 2200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(mascotBreath, {
        toValue: 0,
        duration: 2200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]));
    breathing.start();
    return () => breathing.stop();
  }, [mascotBreath, reduceMotion]);
  const mascotScale = mascotBreath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const canSend = (!!draft.trim() || !!selectedImage) && !isSending;
  const [composerFocused, setComposerFocused] = useState(false);
  const [manualCrisisSupport, setManualCrisisSupport] = useState(false);
  const [occasionOpen, setOccasionOpen] = useState(false);  const [occasionDraft, setOccasionDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const shouldAutoScrollRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [speechListening, setSpeechListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const speechBaseDraftRef = useRef(draft);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const hasSafetyConcern = messages.some(message => message.author === 'you' && hasCrisisSignal(message.text));

  const jumpToLatest = () => {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const handleChatScroll = (event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const atBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 96;
    shouldAutoScrollRef.current = atBottom;
    setShowJumpToLatest(current => current === !atBottom ? current : !atBottom);
  };

  const handleChatContentSizeChange = () => {
    if (shouldAutoScrollRef.current) {
      scrollRef.current?.scrollToEnd({ animated: false });
      setShowJumpToLatest(false);
    }
  };

  useEffect(() => {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [conversationId]);
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const keyboardShown = Keyboard.addListener('keyboardDidShow', () => {
      shouldAutoScrollRef.current = true;
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => keyboardShown.remove();
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'android' || !NativeModules.TeddyBudSpeechRecognition) return undefined;
    const module = NativeModules.TeddyBudSpeechRecognition as NativeSpeechModule;
    const emitter = new NativeEventEmitter(NativeModules.TeddyBudSpeechRecognition);
    const mergeTranscript = (transcript: string) => {
      const clean = transcript.trim();
      if (!clean) return;
      const base = speechBaseDraftRef.current;
      setDraft(base ? base + (/\s$/.test(base) ? '' : ' ') + clean : clean);
    };
    const partial = emitter.addListener('speechPartialResults', (event: SpeechResultEvent) => mergeTranscript(event.value?.[0] ?? ''));
    const final = emitter.addListener('speechResults', (event: SpeechResultEvent) => mergeTranscript(event.value?.[0] ?? ''));
    const error = emitter.addListener('speechError', (event: SpeechErrorEvent) => {
      setSpeechError(event.message || 'Speech recognition could not finish. Please try again.');
      setSpeechListening(false);
    });
    const ended = emitter.addListener('speechEnd', () => setSpeechListening(false));
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        module.cancel().catch(() => undefined);
        setSpeechListening(false);
      }
    });
    return () => {
      partial.remove(); final.remove(); error.remove(); ended.remove(); appState.remove();
      module.cancel().catch(() => undefined);
    };
  }, [setDraft]);

  useEffect(() => () => {
    speechRecognitionRef.current?.abort();
    speechRecognitionRef.current = null;
  }, []);

  useEffect(() => {
    if (shouldAutoScrollRef.current && (messages.length > 0 || streamingReply)) {
      scrollRef.current?.scrollToEnd({ animated: !isSending });
    }
  }, [messages.length, isSending, streamingReply]);

  const startSpeechInput = async () => {
    if (speechListening) return;
    setSpeechError(null);
    speechBaseDraftRef.current = draft;
    if (Platform.OS === 'android') {
      const module = NativeModules.TeddyBudSpeechRecognition as NativeSpeechModule | undefined;
      if (!module) {
        setSpeechError('Voice input is unavailable in this build. You can still type your message.');
        return;
      }
      try {
        const permissionModule = NativeModules.PermissionsAndroid as { requestPermission: (permission: string) => Promise<string> } | undefined;
        if (!permissionModule) throw new Error('Microphone permissions are unavailable in this build.');
        const permission = await permissionModule.requestPermission('android.permission.RECORD_AUDIO');
        if (permission !== 'granted') {
          setSpeechError('Microphone permission was not granted. You can continue typing your message.');
          return;
        }
        await module.start(Intl.DateTimeFormat().resolvedOptions().locale || 'en-US');
        setSpeechListening(true);
      } catch (error) {
        setSpeechError(error instanceof Error ? error.message : 'Speech recognition could not start. Please try again.');
      }
      return;
    }
    if (Platform.OS === 'web') {
      const speechWindow = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
      const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (!Recognition) {
        setSpeechError('Voice input is not supported by this browser. You can continue typing your message.');
        return;
      }
      try {
        const recognition = new Recognition();
        recognition.lang = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.onresult = event => {
          const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index]?.[0]?.transcript ?? '').join(' ').trim();
          if (!transcript) return;
          const base = speechBaseDraftRef.current;
          setDraft(base ? base + (/\s$/.test(base) ? '' : ' ') + transcript : transcript);
        };
        recognition.onerror = event => {
          setSpeechError(event.error === 'not-allowed' ? 'Microphone access was blocked. Allow microphone access in your browser settings and try again.' : event.message || 'Speech recognition could not finish. Please try again.');
          setSpeechListening(false);
        };
        recognition.onend = () => setSpeechListening(false);
        speechRecognitionRef.current = recognition;
        recognition.start();
        setSpeechListening(true);
      } catch (error) {
        setSpeechError(error instanceof Error ? error.message : 'Speech recognition could not start. Please try again.');
      }
      return;
    }
    setSpeechError('Voice input is not available on this platform yet. You can continue typing your message.');
  };

  const stopSpeechInput = () => {
    if (Platform.OS === 'android') {
      const module = NativeModules.TeddyBudSpeechRecognition as NativeSpeechModule | undefined;
      module?.stop().catch(() => setSpeechError('Could not stop voice input cleanly.'));
    } else {
      speechRecognitionRef.current?.stop();
    }
  };

  const submitMessage = () => {
    if (!canSend) return;
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    onSend(selectedImage?.dataUrl);
    setSelectedImage(null);
  };
  return <KeyboardAvoidingView style={styles.chatPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[styles.chatHeader, wide && styles.chatHeaderWide]}>
      <View style={styles.chatHeaderCopy}><Text style={styles.pageTitle} numberOfLines={1}>{conversationTitle}</Text></View>
      <View style={styles.headerActions}>
        {!wide && <Pressable accessibilityRole="button" accessibilityLabel="View chats" onPress={onOpenHistory} style={({ pressed }) => [styles.headerTextButton, pressed && styles.pressed, pressed && !reduceMotion && styles.squeezePressed]}><Text style={styles.headerActionLabel}>Chats</Text></Pressable>}
        {wide ? <>
          <Pressable accessibilityRole="button" accessibilityLabel="Rename chat" disabled={isSending || !canManageChat} onPress={onRenameChat} style={({ pressed }) => [styles.headerTextButton, (isSending || !canManageChat) && styles.buttonDisabled, pressed && styles.pressed, pressed && !reduceMotion && styles.squeezePressed]}><Text style={styles.headerActionLabel}>Rename chat</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={isPinned ? 'Unpin chat' : 'Pin chat'} accessibilityState={{ checked: isPinned }} disabled={isSending || !canManageChat} onPress={onTogglePin} style={({ pressed }) => [styles.headerTextButton, isPinned && styles.headerPinnedButton, (isSending || !canManageChat) && styles.buttonDisabled, pressed && styles.pressed, pressed && !reduceMotion && styles.squeezePressed]}><Text style={[styles.headerActionLabel, isPinned && styles.headerPinnedButtonLabel]}>{isPinned ? 'Unpin chat' : 'Pin chat'}</Text></Pressable>
        </> : <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open chat actions"
          accessibilityHint="Rename or pin this conversation"
          accessibilityState={{ expanded: chatActionsOpen }}
          disabled={isSending || !canManageChat}
          onPress={() => setChatActionsOpen(true)}
          style={({ pressed }) => [styles.chatActionsMenuButton, (isSending || !canManageChat) && styles.buttonDisabled, pressed && styles.pressed, pressed && !reduceMotion && styles.squeezePressed]}
        ><Text style={styles.chatActionsMenuGlyph}>···</Text></Pressable>}
      </View>
    </View>
    {!wide && <Modal transparent visible={chatActionsOpen} animationType="fade" onRequestClose={() => setChatActionsOpen(false)}>
      <View style={styles.chatActionsModalRoot}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close chat actions" onPress={() => setChatActionsOpen(false)} style={styles.chatActionsScrim} />
        <View accessibilityViewIsModal style={[styles.chatActionsSheet, { paddingBottom: Math.max(bottomInset, 18) }]}>
          <View style={styles.chatActionsSheetHeader}>
            <Text style={styles.chatActionsSheetTitle}>Chat options</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss chat options" onPress={() => setChatActionsOpen(false)} style={({ pressed }) => [styles.chatActionsDismiss, pressed && styles.pressed]}><Text style={styles.chatActionsDismissText}>Done</Text></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Rename chat" disabled={isSending || !canManageChat} onPress={() => { setChatActionsOpen(false); onRenameChat(); }} style={({ pressed }) => [styles.chatActionsSheetItem, (isSending || !canManageChat) && styles.buttonDisabled, pressed && styles.pressed, pressed && !reduceMotion && styles.squeezePressed]}><Text style={styles.chatActionsSheetItemText}>Rename chat</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={isPinned ? 'Unpin chat' : 'Pin chat'} accessibilityState={{ checked: isPinned }} disabled={isSending || !canManageChat} onPress={() => { setChatActionsOpen(false); onTogglePin(); }} style={({ pressed }) => [styles.chatActionsSheetItem, (isSending || !canManageChat) && styles.buttonDisabled, pressed && styles.pressed, pressed && !reduceMotion && styles.squeezePressed]}><Text style={styles.chatActionsSheetItemText}>{isPinned ? 'Unpin chat' : 'Pin chat'}</Text></Pressable>
        </View>
      </View>
    </Modal>}
    <View style={styles.chatScrollWrap}>
    <ScrollView
      ref={scrollRef}
      style={styles.chatScroll}
      contentContainerStyle={[styles.chatContent, wide && styles.chatContentWide, messages.length === 0 && styles.emptyContent]}
      keyboardShouldPersistTaps="handled"
      onScroll={handleChatScroll}
      scrollEventThrottle={16}
      onContentSizeChange={handleChatContentSizeChange}
    >
      {messages.length === 0 ? <View style={styles.emptyState}>
        <Animated.View style={[styles.emptyHeroMark, { transform: [{ scale: mascotScale }] }]}>
          <Image source={assistantIcon} style={styles.emptyHeroLogo} accessibilityLabel={assistantName} />
        </Animated.View>
        <Text style={styles.emptyGreeting}>What's on your mind?</Text>
        <Text style={styles.emptyDescription}>A calm space to talk things through, find a little perspective, or simply be heard.</Text>
        <View style={styles.starterGrid}>
          <StarterCard wide={wide} icon="arrow" title="Talk it out" description="Something's been on your mind" onPress={() => setDraft("There's something on my mind I'd like to talk through.")} />
          <StarterCard wide={wide} icon="sun" title="Find a little calm" description="Take a moment to slow down" onPress={() => setDraft('I could use a moment to slow down and unwind.')} />
          <StarterCard wide={wide} icon="sparkle" title="Celebrate a win" description="Make space for something good" onPress={() => setDraft('I want to share a small win from today.')} />
        </View>
      </View> : <View style={styles.conversationColumn}>
        <View style={styles.dayDivider}><View style={styles.dividerLine} /><Text style={styles.dayText}>TODAY</Text><View style={styles.dividerLine} /></View>
        {messages.map(message => {
          const __teddyBudExtractedStyles5 = StyleSheet.create({
            style0: ({ alignSelf: 'flex-end', marginRight: 4, marginTop: 4, marginBottom: 4, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F2ECE4', opacity: isSending ? 0.5 : 1 }) as const,
            style1: ({ color: C.cocoaDark, fontSize: 12, fontWeight: '600' }) as const,
            style2: ({ alignSelf: 'flex-start', marginLeft: 48, marginTop: 4, marginBottom: 4, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F2ECE4', opacity: isSending ? 0.5 : 1 }) as const,
            style3: ({ color: C.cocoaDark, fontSize: 12, fontWeight: '600' }) as const,
            style4: ({ alignSelf: 'flex-start', marginLeft: 48, marginTop: 4, marginBottom: 8, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F2ECE4' }) as const,
            style5: ({ color: C.cocoaDark, fontSize: 12, fontWeight: '600' }) as const,
          });
          if (message.author === 'teddy' && message.stickerId && !message.text.trim() && !message.imageDataUrl) {
            return <View key={message.id} style={styles.stickerMessageRow}>
              <Image source={getTeddySticker(message.stickerId).source} style={styles.chatStickerStandalone} resizeMode="contain" accessibilityLabel={getTeddySticker(message.stickerId).label} />
              <Text style={styles.stickerMessageTime}>{message.time}</Text>
            </View>;
          }
          return <View key={message.id}>
          <View style={[styles.messageRow, message.author === 'you' && styles.messageRowYou]}>
            {message.author === 'teddy' && <View style={styles.teddyAvatarTile}><Image source={assistantIcon} style={styles.teddyAvatarMessageLogo} accessibilityLabel={assistantName} /></View>}
            <View style={[styles.messageBubble, message.author === 'you' ? styles.userBubble : styles.teddyBubble]}>{message.imageDataUrl && <Image source={{ uri: message.imageDataUrl }} style={styles.chatMessageImage} resizeMode="contain" accessibilityLabel="Image you uploaded" />} {message.author === 'teddy' ? <MarkdownReply content={message.text} /> : Boolean(message.text.trim()) && <Text style={[styles.messageText, styles.userMessageText]}>{message.text}</Text>}<Text style={[styles.messageTime, message.author === 'you' && styles.userMessageTime]}>{message.time}</Text></View>
          </View>
          {message.author === 'teddy' && message.stickerId && <View style={styles.stickerMessageRow}><Image source={getTeddySticker(message.stickerId).source} style={styles.chatStickerStandalone} resizeMode="contain" accessibilityLabel={getTeddySticker(message.stickerId).label} /><Text style={styles.stickerMessageTime}>{message.time}</Text></View>}
          {message.author === 'you' && messages.filter(item => item.author === 'you').slice(-1)[0]?.id === message.id && onEditMessage && <Pressable accessibilityRole="button" accessibilityLabel="Edit and resend your last message" disabled={isSending} onPress={() => onEditMessage(message)} style={__teddyBudExtractedStyles5.style0}><Text style={__teddyBudExtractedStyles5.style1}>Edit & resend</Text></Pressable>}
          {message.author === 'teddy' && messages[messages.length - 1]?.id === message.id && onRegenerate && <Pressable accessibilityRole="button" accessibilityLabel="Generate another reply" disabled={isSending} onPress={onRegenerate} style={__teddyBudExtractedStyles5.style2}><Text style={__teddyBudExtractedStyles5.style3}>Try another reply</Text></Pressable>}
          
          {message.author === 'teddy' && memorySuggestion?.messageId === message.id && <MemorySuggestionCard fact={memorySuggestion.fact} onSave={onSaveMemorySuggestion} onDismiss={onDismissMemorySuggestion} />}
        </View>;
        })}
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
    {showJumpToLatest && <Pressable
      accessibilityRole="button"
      accessibilityLabel="Jump to latest message"
      onPress={jumpToLatest}
      style={({ pressed }) => [styles.jumpToLatestButton, pressed && styles.pressed]}
    >
      <View style={__teddyBudExtractedStyles6.style0}><AppIcon name="arrow" color={C.cocoaDark} size={14} /><Text style={styles.jumpToLatestText}>Latest</Text></View>
    </Pressable>}
    </View>
    <View style={[styles.composerWrap, wide && styles.composerWrapWide]}>
      {!keyboardVisible && <View style={styles.chatTools}>
        <Pressable accessibilityRole="button" accessibilityLabel="Attach an image" onPress={async () => { try { setSelectedImage(await pickChatImage()); } catch (error) { Alert.alert('Could not add image', imagePickerErrorMessage(error)); } }} style={({ pressed }) => [styles.chatToolButton, pressed && styles.pressed]}>
          <AppIcon name="image" color={C.cocoa} size={14} /><Text numberOfLines={1} style={styles.chatToolLabel}>Image · 5</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open crisis support" onPress={() => setManualCrisisSupport(true)} style={({ pressed }) => [styles.chatToolButton, pressed && styles.pressed]}>
          <AppIcon name="heart" color={C.cocoa} size={14} /><Text numberOfLines={1} style={styles.chatToolLabel}>Support</Text>
        </Pressable>
        {onSaveOccasion && <Pressable accessibilityRole="button" accessibilityLabel="Save an occasion" onPress={() => { setOccasionDraft(''); setOccasionOpen(true); }} style={({ pressed }) => [styles.chatToolButton, pressed && styles.pressed]}>
          <AppIcon name="sparkle" color={C.cocoa} size={14} /><Text numberOfLines={1} style={styles.chatToolLabel}>Save occasion</Text>
        </Pressable>}
      </View>}
      {selectedImage && <View style={styles.attachmentRow}><Image source={{ uri: selectedImage.dataUrl }} style={__teddyBudExtractedStyles6.style1} /><Text style={styles.attachmentText} numberOfLines={1}>{selectedImage.name}</Text><Pressable accessibilityRole="button" accessibilityLabel="Remove attached image" onPress={() => setSelectedImage(null)} style={styles.attachmentRemove}><Text style={styles.attachmentRemoveText}>×</Text></Pressable></View>}
      {editingMessageId !== null && editingMessageId !== undefined && <View style={__teddyBudExtractedStyles6.style2}><Text style={__teddyBudExtractedStyles6.style3}>Editing your last message — the reply after it will be replaced when you send.</Text><Pressable accessibilityRole="button" accessibilityLabel="Cancel message edit" onPress={onCancelEdit} style={__teddyBudExtractedStyles6.style4}><Text style={__teddyBudExtractedStyles6.style5}>Cancel</Text></Pressable></View>}
      <View style={[styles.composerCard, composerFocused && styles.composerCardFocused]}>
        <TextInput value={draft} onChangeText={setDraft} onFocus={() => { setComposerFocused(true); shouldAutoScrollRef.current = true; scrollRef.current?.scrollToEnd({ animated: true }); }} onBlur={() => setComposerFocused(false)} onSubmitEditing={submitMessage} enterKeyHint="send" blurOnSubmit={Platform.OS === 'web'} placeholder={`Message ${assistantName}…`} placeholderTextColor={C.muted} multiline style={styles.composerInput} accessibilityLabel={`Write a message to ${assistantName}`} {...(Platform.OS === 'web' ? { dataSet: { gramm: 'false' } } as Record<string, unknown> : {})} />
        <Pressable accessibilityRole="button" accessibilityLabel={speechListening ? 'Stop voice input' : 'Start voice input'} accessibilityHint="Speech is transcribed into your editable message. Nothing is sent until you press Send." onPress={speechListening ? stopSpeechInput : () => { runInBackground(startSpeechInput()); }} disabled={isSending} style={({ pressed }) => [styles.voiceButton, speechListening && styles.voiceButtonActive, isSending && styles.buttonDisabled, pressed && styles.pressed]}>
          {speechListening ? <AppIcon name="square" color={C.cocoa} size={17} /> : <AppIcon name="mic" color={C.cocoa} size={20} />}
        </Pressable>
        {isSending
          ? <Pressable accessibilityRole="button" accessibilityLabel="Stop response" onPress={onStop} style={({ pressed }) => [styles.sendButton, styles.stopButton, pressed && styles.pressed]}><View style={styles.stopIcon} /></Pressable>
          : <Pressable accessibilityRole="button" accessibilityLabel="Send message" onPress={submitMessage} disabled={!canSend} style={({ pressed }) => [styles.sendButton, canSend && styles.sendButtonActive, !canSend && styles.sendButtonDisabled, pressed && styles.pressed]}><AppIcon name="send" color={C.white} size={19} /></Pressable>}
      </View>
      {speechListening && <Text accessibilityLiveRegion="polite" style={styles.speechStatus}>Listening… Tap the microphone to stop. Review the transcript before sending.</Text>}
      {!!speechError && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.speechError}>{speechError}</Text>}
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
      result.push(<Text key={`link-${current.index}`} accessibilityRole="link" style={styles.markdownLink} onPress={() => openExternalUrl(url).catch(() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') Alert.alert('Could not open this link', 'Copy it and try again in your browser.');
        else Alert.alert('Could not open link', 'Copy the link and try again in your browser.');
      })}>{current[1]}</Text>);
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
    <Text style={styles.memorySuggestionBody}>Nothing is saved unless you approve. Saved memories stay on this device and are included with future chats sent to Teddy’s online reply service.</Text>
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
    <Text style={styles.occasionPrivacy}>Saved on this device and included with future chats sent to Teddy’s online reply service.</Text>
    <View style={styles.memorySuggestionActions}>
      <Button label="Cancel" tone="quiet" onPress={onDismiss} />
      <Button label="Save memory" onPress={onSave} disabled={!value.trim()} />
    </View>
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
      Animated.timing(dot, { toValue: 1, duration: 240, useNativeDriver: false, isInteraction: false }),
      Animated.timing(dot, { toValue: 0, duration: 240, useNativeDriver: false, isInteraction: false }),
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

function StarterCard({ icon, title, description, onPress, wide }: { icon: AppIconName; title: string; description: string; onPress: () => void; wide: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${description}`} onPress={onPress} style={({ pressed }) => [styles.starterCard, !wide && styles.starterCardMobile, pressed && styles.starterCardPressed]}>
    <View style={styles.starterIcon}><AppIcon name={icon} color={C.cocoa} size={17} /></View>
    <View style={styles.starterCopy}><Text style={styles.starterTitle}>{title}</Text><Text style={styles.starterDescription}>{description}</Text></View>
    <AppIcon name="arrow" color="#6F6256" size={15} />
  </Pressable>;
}

function MemoriesPage({ wide, memories, memoryEnabled, onAdd, onEdit, onDelete, actionError, onDismissActionError, canRetryDelete, onRetryDelete }: { wide: boolean; memories: Memory[]; memoryEnabled: boolean; onAdd: () => void; onEdit: (memory: Memory) => void; onDelete: (memory: Memory) => void; actionError: string | null; onDismissActionError: () => void; canRetryDelete: boolean; onRetryDelete: () => void }) {
  return <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]}>
    <View style={styles.pageIntro}><Text style={styles.eyebrow}>THE THINGS THAT MATTER</Text><Text style={styles.pageTitle}>Your memories</Text><Text style={styles.pageDescription}>Little details you choose to keep close. You can change or forget any of them, whenever you like.</Text></View>
    {actionError && <View accessibilityRole="alert" style={styles.authError}>
      <Text accessibilityLiveRegion="polite" style={styles.authErrorText}>{actionError}</Text>
      <View style={styles.memoryErrorActions}>        {canRetryDelete && <Pressable accessibilityRole="button" onPress={onRetryDelete} style={({ pressed }) => [styles.journalDismiss, pressed && styles.pressed]}><Text style={styles.journalDismissText}>Retry removal</Text></Pressable>}
        <Pressable accessibilityRole="button" onPress={onDismissActionError} style={({ pressed }) => [styles.journalDismiss, pressed && styles.pressed]}><Text style={styles.journalDismissText}>Dismiss</Text></Pressable>
      </View>
    </View>}
    <View style={styles.memoryNotice}><View style={styles.noticeIcon}><AppIcon name="shield" size={17} /></View><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>{memoryEnabled ? 'Saved on this device' : 'Saved memories are off'}</Text><Text style={styles.noticeBody}>{memoryEnabled ? "Memories stay in this app's local database across restarts and are included with future chats sent to Teddy’s online reply service." : 'Turn on "Keep memories on this device" in Privacy settings to add memories.'}</Text></View></View>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>SAVED MEMORIES <Text style={styles.countText}>{memories.length}</Text></Text><Pressable accessibilityRole="button" accessibilityLabel="Add a memory" disabled={!memoryEnabled} onPress={onAdd} style={styles.addLink}><Text style={[styles.addLinkText, !memoryEnabled && styles.disabledText]}>{memoryEnabled ? 'Add a memory' : 'Memory is off'}</Text></Pressable></View>
    {memories.length ? memories.map(memory => <View key={memory.id} style={styles.memoryCard}><View style={styles.memoryMark}><AppIcon name="sparkle" size={16} /></View><View style={styles.memoryCopy}><Text style={styles.memoryText}>{memory.text}</Text><Text style={styles.memoryDate}>{memory.date}</Text></View><View style={styles.memoryActions}><Pressable accessibilityRole="button" accessibilityLabel="Edit memory" onPress={() => onEdit(memory)} style={styles.memoryActionTextButton}><Text style={styles.memoryActionText}>Edit</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Forget memory" onPress={() => onDelete(memory)} style={styles.memoryActionTextButton}><Text style={styles.memoryActionText}>Forget</Text></Pressable></View></View>) : <View style={styles.emptyCard}><View style={styles.emptyMark}><AppIcon name="sparkle" size={21} /></View><Text style={styles.emptyTitle}>{memoryEnabled ? 'A fresh page' : 'Memories are off'}</Text><Text style={styles.emptyBody}>{memoryEnabled ? "Nothing saved right now. Add a small detail you'd like to hold onto." : 'Turn on "Keep memories on this device" in Privacy settings when you are ready.'}</Text>{memoryEnabled && <Button label="Add your first memory" onPress={onAdd} />}</View>}
    {!!memories.length && <Text style={styles.memoriesFootnote}>Your memories are yours. Edit them, remove them, or clear local data from this device at any time.</Text>}
  </ScrollView>;
}



export function JournalPage({ wide, entries, onSave, onDelete, onShare }: {
  wide: boolean;
  entries: JournalEntry[];
  onSave: (entry: JournalEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onShare: (entry: JournalEntry) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [prompt, setPrompt] = useState('Free reflection');
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const prompts = ['Free reflection', 'What felt heavy today?', 'What is one small thing I appreciate?', 'What do I need more of right now?', 'What would I tell a friend in this situation?'];

  const save = async () => {
    const normalizedBody = body.trim();
    if (!normalizedBody || saving) {
      if (!normalizedBody) setActionError('Write a little in your entry before saving.');
      return;
    }
    const entry: JournalEntry = {
      id: editing ?? (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)),
      createdAt: editing ? (entries.find(item => item.id === editing)?.createdAt ?? new Date().toISOString()) : new Date().toISOString(),
      title: title.trim().slice(0, 160) || prompt,
      body: normalizedBody.slice(0, 30000),
      prompt,
    };
    setSaving(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await onSave(entry);
      setTitle('');
      setBody('');
      setEditing(null);
      setPrompt('Free reflection');
      setActionNotice('Saved privately on this device.');
    } catch {
      setActionError('This entry could not be saved to this device. Your text is still in the editor; retry saving before leaving this page.');
    } finally {
      setSaving(false);
    }
  };

  const beginDelete = (entry: JournalEntry) => {
    confirmAction(
      'Delete journal entry?',
      `“${entry.title}” will be removed from this device. This cannot be undone.`,
      () => {
        setDeletingId(entry.id);
        setActionError(null);
        setActionNotice(null);
        onDelete(entry.id).then(() => {
          if (editing === entry.id) {
            setEditing(null);
            setTitle('');
            setBody('');
            setPrompt('Free reflection');
          }
        }).catch(() => {
          setActionError('This entry could not be deleted from saved data. The entry remains available; try again.');
        }).finally(() => setDeletingId(null));
      },
    );
  };

  const exportJournal = async () => {
    if (!entries.length || exporting) {
      if (!entries.length) setActionError('Write a journal entry before exporting.');
      return;
    }
    setExporting(true);
    setActionError(null);
    setActionNotice(null);
    const content = entries.map(entry => `# ${entry.title}\n${new Date(entry.createdAt).toLocaleString()} · ${entry.prompt}\n\n${entry.body}`).join('\n\n---\n\n');
    try {
      if (Platform.OS === 'web') {
        await savePlainTextFile(content, `teddy-bud-journal-${new Date().toISOString().slice(0, 10)}.txt`);
        setActionNotice('Your journal text download has started.');
      } else {
        const result = await Share.share({ title: 'Teddy Bud private journal export', message: content });
        setActionNotice(result.action === Share.dismissedAction
          ? 'Export canceled. Your journal entries remain saved on this device.'
          : 'The share sheet opened. Choose where you would like to keep your journal text.');
      }
    } catch {
      setActionError('Teddy Bud could not export the journal text. Try again, or select and copy the entries you want to keep.');
    } finally {
      setExporting(false);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setTitle('');
    setBody('');
    setPrompt('Free reflection');
    setActionError(null);
    setActionNotice(null);  };
  const visible = entries.filter(entry => (entry.title + ' ' + entry.body + ' ' + entry.prompt).toLowerCase().includes(search.toLowerCase()));

  return <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]} keyboardShouldPersistTaps="handled">
    <View style={styles.pageIntro}>
      <Text style={styles.eyebrow}>PRIVATE REFLECTION</Text>
      <Text style={styles.pageTitle}>A page just for you</Text>
      <Text style={styles.pageDescription}>Your journal stays in this device's local app storage. It is never added to Teddy's context unless you choose “Discuss with Teddy” and then send the prepared message yourself.</Text>
    </View>
    {(actionError || actionNotice) && <View accessibilityRole={actionError ? 'alert' : 'summary'} style={actionError ? styles.authError : styles.journalNotice}>
      <Text accessibilityLiveRegion="polite" style={actionError ? styles.authErrorText : styles.journalNoticeText}>{actionError || actionNotice}</Text>
      {actionError && <Pressable accessibilityRole="button" accessibilityLabel="Dismiss journal notice" onPress={() => setActionError(null)} style={styles.journalDismiss}><Text style={styles.journalDismissText}>Dismiss</Text></Pressable>}
    </View>}
    <View style={styles.journalEditorCard}>
      <Text style={styles.sectionTitle}>{editing ? 'Edit your entry' : 'Write a little'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.journalPrompts}>{prompts.map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: prompt === value }} onPress={() => { setPrompt(value); setActionError(null); setActionNotice(null); }} style={({ pressed }) => [styles.journalPromptChip, prompt === value && styles.journalPromptChipSelected, pressed && styles.pressed]}><Text style={styles.journalPromptText}>{value}</Text></Pressable>)}</ScrollView>
      <TextInput accessibilityLabel="Journal title (optional)" value={title} onChangeText={setTitle} maxLength={160} placeholder="Title (optional)" placeholderTextColor={C.muted} style={styles.journalTextInput} editable={!saving} />
      <TextInput accessibilityLabel="Journal entry" accessibilityHint="Your entry is stored locally and is not sent to the AI unless you choose to discuss it and then send the prepared chat message." value={body} onChangeText={value => { setBody(value); setActionError(null); setActionNotice(null); }} maxLength={30000} multiline placeholder="Start wherever you are…" placeholderTextColor={C.muted} style={[styles.journalTextInput, styles.journalBodyInput]} editable={!saving} textAlignVertical="top" />
      <View style={styles.journalEditorActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Save journal changes' : 'Save privately'} disabled={saving} onPress={save} style={({ pressed }) => [styles.journalSaveButton, saving && styles.buttonDisabled, pressed && styles.pressed]}>
          <Text style={styles.journalSaveButtonText}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save privately'}</Text>
        </Pressable>
        {editing && <Pressable accessibilityRole="button" disabled={saving} onPress={cancelEdit} style={({ pressed }) => [styles.journalCancelButton, pressed && styles.pressed]}><Text style={styles.journalCancelButtonText}>Cancel edit</Text></Pressable>}
      </View>
    </View>
    <Pressable accessibilityRole="button" disabled={exporting} onPress={exportJournal} style={({ pressed }) => [styles.journalExportButton, exporting && styles.buttonDisabled, pressed && styles.pressed]}>
      <Text style={styles.journalExportButtonText}>{exporting ? 'Preparing export…' : 'Export journal text'}</Text>
    </Pressable>
    <TextInput accessibilityLabel="Search journal entries" value={search} onChangeText={setSearch} placeholder="Search journal entries" placeholderTextColor={C.muted} style={styles.journalSearchInput} />
    {visible.map(entry => <View key={entry.id} style={styles.journalEntryCard}>
      <Text style={styles.journalEntryTitle}>{entry.title}</Text>
      <Text style={styles.journalEntryMeta}>{new Date(entry.createdAt).toLocaleString()} · {entry.prompt}</Text>
      <View style={styles.journalEntryActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit journal entry ${entry.title}`} disabled={saving || deletingId !== null} onPress={() => { setTitle(entry.title); setBody(entry.body); setPrompt(entry.prompt); setEditing(entry.id); setActionError(null); setActionNotice(null); }} style={({ pressed }) => [styles.journalInlineButton, pressed && styles.pressed]}>
          <Text style={styles.journalInlineButtonText}>Edit entry</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Discuss journal entry ${entry.title} with Teddy`} onPress={() => {
          confirmAction('Share this entry with Teddy?', 'The entry will be copied into your chat draft. It will not be sent until you review it and tap Send.', () => onShare(entry));
        }} style={({ pressed }) => [styles.journalInlineButton, pressed && styles.pressed]}>
          <Text style={styles.journalInlineButtonText}>Discuss with Teddy</Text>
        </Pressable>
      </View>
      <Text selectable style={styles.journalEntryBody}>{entry.body}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete journal entry ${entry.title}`} disabled={deletingId !== null} onPress={() => beginDelete(entry)} style={({ pressed }) => [styles.journalDeleteButton, deletingId === entry.id && styles.buttonDisabled, pressed && styles.pressed]}>
        <Text style={styles.journalDeleteButtonText}>{deletingId === entry.id ? 'Deleting…' : 'Delete'}</Text>
      </Pressable>
    </View>)}
    {visible.length === 0 && <Text style={styles.journalEmptyText}>{search ? 'No entries match your search.' : 'Your journal is empty. Write a little whenever you are ready.'}</Text>}
  </ScrollView>;
}
export function EmotionsPage({ wide, entries, onSave, onDelete }: { wide: boolean; entries: EmotionCheckIn[]; onSave: (entry: EmotionCheckIn) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const __teddyBudExtractedStyles14 = StyleSheet.create({
    style0: ({maxWidth:760,width:'100%',alignSelf:'center'}) as const,
    style1: ({fontSize:wide?30:25,fontWeight:'700',color:C.cocoaDark}) as const,
    style2: ({fontSize:14,lineHeight:21,color:C.muted,marginTop:8}) as const,
    style3: ({backgroundColor:C.paper,borderColor:C.line,borderWidth:1,borderRadius:24,padding:16,marginTop:20}) as const,
    style4: ({fontSize:17,fontWeight:'700',color:C.cocoaDark}) as const,
    style5: ({textAlign:'center',fontSize:13,lineHeight:19,color:C.muted,marginTop:2}) as const,
    style6: ({fontSize:11,lineHeight:16,color:C.muted,textAlign:'center',marginTop:5}) as const,
    style7: ({fontSize:13,lineHeight:20,color:C.cocoaDark,marginTop:8}) as const,
    style8: ({color:'#FFFFFF',fontWeight:'700'}) as const,
    style9: ({backgroundColor:C.paper,borderColor:C.line,borderWidth:1,borderRadius:22,padding:16,marginTop:14}) as const,
    style10: ({fontSize:19,fontWeight:'700',color:C.cocoaDark,marginBottom:6}) as const,
    style11: ({fontSize:13,color:C.muted,marginBottom:12}) as const,
    style12: ({color:C.cocoaDark,fontWeight:'600',marginTop:14}) as const,
    style13: ({flexDirection:'row',gap:8,marginTop:8}) as const,
    style14: ({color:C.cocoaDark,fontWeight:'600',marginTop:14,marginBottom:8}) as const,
    style15: ({flexDirection:'row',flexWrap:'wrap',gap:8}) as const,
    style16: ({fontSize:12,color:C.muted,marginTop:12}) as const,
    style17: ({minHeight:76,borderWidth:1,borderColor:C.line,borderRadius:14,padding:12,color:C.cocoaDark,marginTop:7,textAlignVertical:'top'}) as const,
    style18: ({color:'#FFFFFF',fontWeight:'700'}) as const,
    style19: ({backgroundColor:C.paper,borderColor:C.line,borderWidth:1,borderRadius:18,padding:15,marginTop:18}) as const,
    style20: ({fontSize:16,fontWeight:'700',color:C.cocoaDark}) as const,
    style21: ({fontSize:13,color:C.muted,lineHeight:20,marginTop:6}) as const,
    style22: ({fontSize:14,color:C.cocoaDark,marginTop:10}) as const,
    style23: ({fontSize:14,color:C.cocoaDark,marginTop:6}) as const,
    style24: ({fontSize:13,color:C.muted,marginTop:6}) as const,
    style25: ({fontSize:13,color:C.muted,lineHeight:20,marginTop:6}) as const,
    style26: ({backgroundColor:'#F4ECE6',borderRadius:18,padding:15,marginTop:18}) as const,
    style27: ({fontSize:16,fontWeight:'700',color:C.cocoaDark}) as const,
    style28: ({fontSize:13,color:C.muted,lineHeight:20,marginTop:6}) as const,
    style29: ({fontSize:19,fontWeight:'700',color:C.cocoaDark,marginTop:24,marginBottom:10}) as const,
    style30: ({color:C.muted,paddingVertical:14}) as const,
    style31: ({fontSize:12,color:C.muted,lineHeight:18,marginTop:10}) as const,
  });
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [energy, setEnergy] = useState(3);
  const [support, setSupport] = useState<EmotionCheckIn['support']>('listen');
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const latest = entries[0];

  const resetForm = () => {
    setRatings({});
    setEnergy(3);
    setSupport('listen');
    setNote('');
    setShowForm(false);
  };

  const hasUnsavedCheckIn = Object.keys(ratings).length > 0 || Boolean(note.trim()) || energy !== 3 || support !== 'listen';

  const toggleForm = () => {
    if (!showForm) {
      setShowForm(true);
      setActionError(null);
      setActionNotice(null);
      return;
    }
    if (hasUnsavedCheckIn) {
      confirmAction('Discard this check-in?', 'Your unfinished ratings and note will be discarded.', resetForm);
    } else {
      setShowForm(false);
    }
  };

  const saveCheckIn = async () => {
    if (saving) return;
    const entry: EmotionCheckIn = {
      id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
      createdAt: new Date().toISOString(),
      emotions: ratings,
      energy,
      support,
      origin: 'self',
      ...(note.trim() ? { note: note.trim().slice(0, 2000) } : {}),
    };
    setSaving(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await onSave(entry);
      resetForm();
      setActionNotice('Check-in saved privately on this device.');
    } catch {
      setActionError('This check-in could not be saved. Your ratings and note are still here; retry saving before leaving this screen.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCheckIn = (entry: EmotionCheckIn) => {
    confirmAction('Delete check-in?', 'This removes this entry from this device.', () => {
      setDeletingId(entry.id);
      setActionError(null);
      setActionNotice(null);
      onDelete(entry.id).then(() => {
        setActionNotice('Check-in deleted from this device.');
      }).catch(() => {
        setActionError('This check-in could not be deleted from saved data. The entry is still available; try again.');
      }).finally(() => setDeletingId(null));
    });
  };
  const weekEntries = entries.filter(entry => { const age = Date.now() - new Date(entry.createdAt).getTime(); return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000; });
  const weekEnergy = weekEntries.length ? weekEntries.reduce((sum, entry) => sum + entry.energy, 0) / weekEntries.length : 0;
  const weekEmotionAverages = EMOTION_AXES.map(axis => {
    const rated = weekEntries.filter(entry => typeof entry.emotions[axis.id] === 'number');
    return { label: axis.label, average: rated.length ? rated.reduce((sum, entry) => sum + (entry.emotions[axis.id] ?? 0), 0) / rated.length : null, count: rated.length };
  }).sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
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
    const __teddyBudExtractedStyles10 = StyleSheet.create({
      style0: ({ position: 'absolute', left: (a.x+b.x)/2-Math.sqrt(dx*dx+dy*dy)/2, top: (a.y+b.y)/2-width/2, width: Math.sqrt(dx*dx+dy*dy), height: width, backgroundColor: color, transform: [{ rotate: Math.atan2(dy,dx)+'rad' }] }) as const,
    });
    return <View key={color + a.x + a.y + b.x + b.y} pointerEvents="none" style={__teddyBudExtractedStyles10.style0} />;
  };
  const webBounce = useRef(new Animated.Value(1)).current;
  const curvedRing = (level: number, color: string, strokeWidth: number) => {
    const ringPoints = EMOTION_AXES.map((_, i) => point(i, level));
    return ringPoints.map((a, i) => {
      const b = ringPoints[(i + 1) % axisCount]!;
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const control = { x: midpoint.x + (center - midpoint.x) * 0.34, y: midpoint.y + (center - midpoint.y) * 0.34 };
      const samples = [0.25, 0.5, 0.75, 1].map(t => ({
        x: (1-t)*(1-t)*a.x + 2*(1-t)*t*control.x + t*t*b.x,
        y: (1-t)*(1-t)*a.y + 2*(1-t)*t*control.y + t*t*b.y,
      }));
      const chain = [a, ...samples];
      return chain.slice(0, -1).map((from, segment) => line(from, chain[segment + 1]!, color, strokeWidth));
    });
  };
  const renderWeb = (data?: Record<string, number>) => {
    const __teddyBudExtractedStyles11 = StyleSheet.create({
      style0: ({ width: size, height: size, alignSelf: 'center' }) as const,
      style1: ({ width: size, height: size, position: 'relative', transform: [{ scale: webBounce }] }) as const,
      style2: ({ position: 'absolute', left: center-radius*0.86, top: center-radius*0.86, width: radius*1.72, height: radius*1.72, borderRadius: radius, backgroundColor: 'rgba(150, 108, 78, 0.10)', borderWidth: 1, borderColor: 'rgba(150, 108, 78, 0.10)' }) as const,
      style3: ({position:'absolute',left:center-4,top:center-4,width:8,height:8,borderRadius:4,backgroundColor:'#9A765D'}) as const,
    });
    const values = EMOTION_AXES.map(axis => data?.[axis.id] ?? 0);
    return <Pressable
      accessibilityRole="button"
      accessibilityLabel="Emotion web. Touch to feel the web gently bounce."
      accessibilityHint="The connected emotion web responds with a soft elastic movement."
      onPressIn={() => Animated.spring(webBounce, { toValue: 0.965, useNativeDriver: true, speed: 1.1, bounciness: 8 }).start()}
      onPressOut={() => Animated.sequence([
        Animated.spring(webBounce, { toValue: 1.035, useNativeDriver: true, speed: 0.45, bounciness: 10 }),
        Animated.spring(webBounce, { toValue: 1, useNativeDriver: true, speed: 0.65, bounciness: 5 }),
      ]).start()}
      style={__teddyBudExtractedStyles11.style0}
    >
      <Animated.View style={__teddyBudExtractedStyles11.style1}>
        <View pointerEvents="none" style={__teddyBudExtractedStyles11.style2} />
        {[1,2,3,4,5].map(level => <React.Fragment key={'ring-'+level}>{curvedRing(level, level===5?'#D5C1B2':'#E5D8CE', level===5?1.4:1)}</React.Fragment>)}
        {EMOTION_AXES.map((_, i) => line({x:center,y:center}, point(i,5), '#D5C5B8', 1))}
        {EMOTION_AXES.map((axis,i) => {
          const label = point(i,5.75);
          const dot = point(i,5);
          const __teddyBudExtractedStyles12 = StyleSheet.create({
            style0: ({position:'absolute',left:label.x-37,top:label.y-9,width:74,textAlign:'center',fontSize:10,fontWeight:'600',color:C.cocoaDark}) as const,
            style1: ({position:'absolute',left:dot.x-4,top:dot.y-4,width:8,height:8,borderRadius:4,backgroundColor:'#9A765D',borderWidth:1.5,borderColor:'#FFF9F4'}) as const,
          });
          return <React.Fragment key={axis.id}>
            <Text style={__teddyBudExtractedStyles12.style0}>{axis.label}</Text>
            <View pointerEvents="none" style={__teddyBudExtractedStyles12.style1} />
          </React.Fragment>;
        })}
        {data ? values.map((value,i) => {
          const a = point(i,value);
          const b = point((i+1)%axisCount,values[(i+1)%axisCount]!);
          const midpoint = {x:(a.x+b.x)/2,y:(a.y+b.y)/2};
          const control = {x:midpoint.x+(center-midpoint.x)*0.28,y:midpoint.y+(center-midpoint.y)*0.28};
          const samples = [0.2,0.4,0.6,0.8,1].map(t=>({x:(1-t)*(1-t)*a.x+2*(1-t)*t*control.x+t*t*b.x,y:(1-t)*(1-t)*a.y+2*(1-t)*t*control.y+t*t*b.y}));          return <React.Fragment key={'data-'+i}>{[a,...samples].slice(0,-1).map((from,j)=>line(from,samples[j]!, '#A86F52', 2.6))}</React.Fragment>;
        }) : null}
        {data ? values.map((value,i) => {
          const __teddyBudExtractedStyles13 = StyleSheet.create({
            style0: ({position:'absolute',left:point(i,value).x-5,top:point(i,value).y-5,width:10,height:10,borderRadius:5,backgroundColor:'#A86F52',borderWidth:2,borderColor:'#FFF9F4'}) as const,
          });
          return value>0 ? <View key={'value-'+i} pointerEvents="none" style={__teddyBudExtractedStyles13.style0} /> : null;
        }) : null}
        <View pointerEvents="none" style={__teddyBudExtractedStyles11.style3} />
      </Animated.View>
    </Pressable>;
  };
  return <ScrollView contentContainerStyle={[styles.emotionsPageScroll, wide && styles.emotionsPageScrollWide]}>
    <View style={__teddyBudExtractedStyles14.style0}>
      <Text style={__teddyBudExtractedStyles14.style1}>Your emotional landscape</Text>
      <Text style={__teddyBudExtractedStyles14.style2}>A private snapshot of how you feel. Rate only what feels relevant; there is no good or bad shape.</Text>
      {(actionError || actionNotice) && <View accessibilityRole={actionError ? 'alert' : 'summary'} style={actionError ? styles.authError : styles.journalNotice}>
        <Text accessibilityLiveRegion="polite" style={actionError ? styles.authErrorText : styles.journalNoticeText}>{actionError || actionNotice}</Text>
        {actionError && <Pressable accessibilityRole="button" accessibilityLabel="Dismiss check-in notice" onPress={() => setActionError(null)} style={styles.journalDismiss}><Text style={styles.journalDismissText}>Dismiss</Text></Pressable>}
      </View>}
      <View style={__teddyBudExtractedStyles14.style3}>
        <Text style={__teddyBudExtractedStyles14.style4}>{latest?.origin === 'survey-ai' ? 'Your starting emotion web' : latest ? 'Latest check-in' : 'Your emotion web'}</Text>
        {renderWeb(latest?.emotions)}
        <Text accessibilityRole="text" style={__teddyBudExtractedStyles14.style5}>{latest ? (latest.origin === 'survey-ai' ? 'AI-estimated from your onboarding answers · '+new Date(latest.createdAt).toLocaleString() : 'Self-rated snapshot · '+new Date(latest.createdAt).toLocaleString()) : 'Your web appears after your first check-in.'}</Text>
        {latest?.origin === 'survey-ai' ? <Text style={__teddyBudExtractedStyles14.style6}>A gentle estimate from your answers, not a clinical assessment. You can replace it with your own check-in at any time.</Text> : null}
        {latest ? <Text style={__teddyBudExtractedStyles14.style7}>Highest ratings: {EMOTION_AXES.filter(a=>(latest.emotions[a.id]??0)>0).sort((a,b)=>(latest.emotions[b.id]??0)-(latest.emotions[a.id]??0)).slice(0,3).map(a=>a.label+' '+latest.emotions[a.id]+'/5').join(' · ') || 'No emotions rated'} · Energy {latest.energy}/5</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={showForm ? 'Close check-in form' : 'Add a check-in'} onPress={toggleForm} style={({ pressed }) => [{ minHeight:48, backgroundColor:C.cocoaDark, borderRadius:15, padding:14, alignItems:'center', justifyContent:'center', marginTop:16 }, pressed && styles.pressed]}><Text style={__teddyBudExtractedStyles14.style8}>{showForm?'Close check-in':'Add a check-in'}</Text></Pressable>
      </View>
      {showForm ? <View style={__teddyBudExtractedStyles14.style9}>
        <Text style={__teddyBudExtractedStyles14.style10}>How are you feeling?</Text>
        <Text style={__teddyBudExtractedStyles14.style11}>Tap a number from 0 (not present) to 5 (very strong). You can leave any emotion unrated.</Text>
        {EMOTION_AXES.map(axis=>{
          const __teddyBudExtractedStyles15 = StyleSheet.create({
            style0: ({paddingVertical:9,borderBottomWidth:1,borderBottomColor:C.line}) as const,
            style1: ({color:C.cocoaDark,fontWeight:'600',marginBottom:8}) as const,
            style2: ({flexDirection:'row',gap:8}) as const,
          });
          return <View key={axis.id} style={__teddyBudExtractedStyles15.style0}>
          <Text style={__teddyBudExtractedStyles15.style1}>{axis.label}</Text>
          <View style={__teddyBudExtractedStyles15.style2}>{[0,1,2,3,4,5].map(n=>{
            const __teddyBudExtractedStyles16 = StyleSheet.create({
              style0: ({flex:1,minWidth:30,height:48,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:ratings[axis.id]===n?'#B87862':'#F5ECE5',borderWidth:ratings[axis.id]===n?2:0,borderColor:C.cocoaDark}) as const,
              style1: ({color:C.cocoaDark,fontWeight:'600'}) as const,
            });
            return <Pressable key={n} accessibilityRole="button" accessibilityLabel={axis.label+' '+n+' out of 5'} accessibilityState={{ selected: ratings[axis.id] === n }} onPress={()=>{ setRatings(current=>({...current,[axis.id]:n})); setActionError(null); setActionNotice(null); }} style={__teddyBudExtractedStyles16.style0}><Text style={__teddyBudExtractedStyles16.style1}>{n}</Text></Pressable>;
          })}</View>
        </View>;
        })}
        <Text style={__teddyBudExtractedStyles14.style12}>Energy: {energy}/5</Text>
        <View style={__teddyBudExtractedStyles14.style13}>{[0,1,2,3,4,5].map(n=>{
          const __teddyBudExtractedStyles17 = StyleSheet.create({
            style0: ({flex:1,minWidth:30,height:48,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:energy===n?'#B87862':'#F5ECE5'}) as const,
            style1: ({color:C.cocoaDark}) as const,
          });
          return <Pressable key={n} accessibilityRole="button" accessibilityLabel={`Energy ${n} out of 5`} accessibilityState={{ selected: energy === n }} onPress={()=>{ setEnergy(n); setActionError(null); setActionNotice(null); }} style={__teddyBudExtractedStyles17.style0}><Text style={__teddyBudExtractedStyles17.style1}>{n}</Text></Pressable>;
        })}</View>
        <Text style={__teddyBudExtractedStyles14.style14}>What would help right now?</Text>
        <View style={__teddyBudExtractedStyles14.style15}>{([{id:'listen',label:'Just listen'},{id:'advice',label:'Practical advice'},{id:'encouragement',label:'Encouragement'},{id:'unsure',label:'Not sure'}] as const).map(option=>{
          const __teddyBudExtractedStyles18 = StyleSheet.create({
            style0: ({color:C.cocoaDark}) as const,
          });
          return <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: support === option.id }} onPress={()=>{ setSupport(option.id); setActionError(null); setActionNotice(null); }} style={({ pressed }) => [{ minHeight:48, paddingVertical:9, paddingHorizontal:12, borderRadius:14, backgroundColor:support===option.id?'#E7D0C2':'#F5ECE5', borderWidth:support===option.id?1:0, borderColor:'#B87862' }, pressed && styles.pressed, pressed && styles.squeezePressed]}><Text style={__teddyBudExtractedStyles18.style0}>{option.label}</Text></Pressable>;
        })}</View>
        <Text style={__teddyBudExtractedStyles14.style16}>Optional note (saved only on this device)</Text>
        <TextInput accessibilityLabel="Emotion check-in note (optional)" value={note} onChangeText={value => { setNote(value.slice(0, 2000)); setActionError(null); setActionNotice(null); }} multiline maxLength={2000} placeholder="Anything you want to remember about this moment…" placeholderTextColor={C.muted} style={__teddyBudExtractedStyles14.style17} />
        <Pressable accessibilityRole="button" accessibilityLabel="Save emotion check-in" disabled={saving} onPress={saveCheckIn} style={({ pressed }) => [{ minHeight:48, backgroundColor:C.cocoaDark, borderRadius:15, padding:14, alignItems:'center', justifyContent:'center', marginTop:14 }, saving && styles.buttonDisabled, pressed && styles.pressed]}><Text style={__teddyBudExtractedStyles14.style18}>{saving ? 'Saving check-in…' : 'Save privately on this device'}</Text></Pressable>
      </View> : null}
      <View style={__teddyBudExtractedStyles14.style19}>
        <Text style={__teddyBudExtractedStyles14.style20}>Your week in reflection</Text>
        {weekEntries.length >= 2 ? <>
          <Text style={__teddyBudExtractedStyles14.style21}>A local summary of {weekEntries.length} check-ins from the last seven days. This uses only ratings you entered and is not a diagnosis or prediction.</Text>
          <Text style={__teddyBudExtractedStyles14.style22}>Average energy: {weekEnergy.toFixed(1)}/5</Text>
          {typeof weekEmotionAverages[0]?.average === 'number' ? <Text style={__teddyBudExtractedStyles14.style23}>Most frequently highest-rated emotion: {weekEmotionAverages[0].label} ({weekEmotionAverages[0].average?.toFixed(1)}/5 across {weekEmotionAverages[0].count} rated check-ins).</Text> : <Text style={__teddyBudExtractedStyles14.style24}>No emotion ratings were recorded in these check-ins.</Text>}
        </> : <Text style={__teddyBudExtractedStyles14.style25}>Add at least two check-ins within seven days to see a summary. It stays on this device and never labels or scores your mental health.</Text>}
      </View>
      <View style={__teddyBudExtractedStyles14.style26}>
        <Text style={__teddyBudExtractedStyles14.style27}>Your recent pattern</Text>
        <Text style={__teddyBudExtractedStyles14.style28}>Based on your latest {Math.min(entries.length,7)} check-ins. Unrated emotions remain visible as “Not rated”; these averages are not a diagnosis or prediction.</Text>
        {EMOTION_AXES.map(axis=>{const sample=entries.slice(0,7).filter(entry=>typeof entry.emotions[axis.id]==='number');const avg=sample.length ? sample.reduce((sum,entry)=>sum+(entry.emotions[axis.id]??0),0)/sample.length : 0;const __teddyBudExtractedStyles19 = StyleSheet.create({
          style0: ({marginTop:9}) as const,
          style1: ({flexDirection:'row',justifyContent:'space-between'}) as const,
          style2: ({fontSize:12,color:C.cocoaDark}) as const,
          style3: ({fontSize:12,color:C.cocoaDark}) as const,
          style4: ({height:6,backgroundColor:'#E1D5CC',borderRadius:4,marginTop:4,overflow:'hidden'}) as const,
          style5: ({height:6,width:`${(avg/5*100)}%` as `${number}%`,backgroundColor:'#B87862',borderRadius:4}) as const,
        });
        return <View key={axis.id} style={__teddyBudExtractedStyles19.style0}><View style={__teddyBudExtractedStyles19.style1}><Text style={__teddyBudExtractedStyles19.style2}>{axis.label}</Text><Text style={__teddyBudExtractedStyles19.style3}>{sample.length ? `${avg.toFixed(1)}/5` : 'Not rated'}</Text></View><View style={__teddyBudExtractedStyles19.style4}><View style={__teddyBudExtractedStyles19.style5} /></View></View>;})}
      </View>
      <Text style={__teddyBudExtractedStyles14.style29}>Past check-ins</Text>
      {entries.length===0 ? <Text style={__teddyBudExtractedStyles14.style30}>Nothing recorded yet. Your check-ins are optional and stay in local app storage.</Text> : entries.map(entry=>{
        const __teddyBudExtractedStyles20 = StyleSheet.create({
          style0: ({backgroundColor:C.paper,borderWidth:1,borderColor:C.line,borderRadius:16,padding:14,marginBottom:9}) as const,
          style1: ({color:C.cocoaDark,fontWeight:'700'}) as const,
          style2: ({color:C.muted,fontSize:13,marginTop:5}) as const,
          style3: ({color:C.cocoaDark,marginTop:6}) as const,
          style4: ({color:C.rose,fontWeight:'600'}) as const,
        });
        return <View key={entry.id} style={__teddyBudExtractedStyles20.style0}>
        <Text style={__teddyBudExtractedStyles20.style1}>{new Date(entry.createdAt).toLocaleString()}</Text>
        <Text style={__teddyBudExtractedStyles20.style2}>{EMOTION_AXES.filter(a=>entry.emotions[a.id]!==undefined).sort((a,b)=>(entry.emotions[b.id]??0)-(entry.emotions[a.id]??0)).slice(0,4).map(a=>a.label+' '+entry.emotions[a.id]+'/5').join(' · ') || 'No emotion ratings'} · Energy {entry.energy}/5</Text>
        {entry.note ? <Text style={__teddyBudExtractedStyles20.style3}>{entry.note}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete check-in from ${new Date(entry.createdAt).toLocaleString()}`} disabled={deletingId !== null} onPress={()=>deleteCheckIn(entry)} style={({ pressed }) => [{ minHeight:48, alignSelf:'flex-end', justifyContent:'center', paddingHorizontal:12 }, deletingId === entry.id && styles.buttonDisabled, pressed && styles.pressed]}><Text style={__teddyBudExtractedStyles20.style4}>{deletingId === entry.id ? 'Deleting…' : 'Delete'}</Text></Pressable>
      </View>;
      })}
      <Text style={__teddyBudExtractedStyles14.style31}>These ratings are self-reported reflections, not a clinical assessment. No emotions are inferred from your chats.</Text>
    </View>
  </ScrollView>;
}

function PrivacyPage({ wide, onBack, rememberInSession, shareMemories, shareChatHistory, shareAboutMe, onRememberChange, onShareMemoriesChange, onShareChatHistoryChange, onShareAboutMeChange, shareOnboardingSurvey, onShareOnboardingSurveyChange, onClear }: { wide: boolean; onBack: () => void; rememberInSession: boolean; shareMemories: boolean; shareChatHistory: boolean; shareAboutMe: boolean; shareOnboardingSurvey: boolean; onRememberChange: (value: boolean) => void; onShareMemoriesChange: (value: boolean) => void; onShareChatHistoryChange: (value: boolean) => void; onShareAboutMeChange: (value: boolean) => void; onShareOnboardingSurveyChange: (value: boolean) => void; onClear: () => void }) {
  const [policyLinkError, setPolicyLinkError] = useState('');
  const isDesktopApp = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.teddyBudDesktop?.isDesktop;
  const storagePrivacyDescription = isDesktopApp
    ? "Chats, profile notes, and memories are stored in this desktop app and encrypted with a key protected by your operating system. The open app can access its saved data. Messages and any context you choose below are sent through Teddy Bud’s online reply service when you chat."
    : Platform.OS === 'web'
      ? "Chats, profile notes, and memories are stored in this browser's local database and encrypted with a separate key for each account. This protects saved data at rest, but code running in this browser while Teddy Bud is open could access it. Messages and any context you choose below are sent through Teddy Bud’s online reply service when you chat."
      : "Chats, profile notes, and memories are stored in this device's encrypted local database. Messages and any context you enable below are sent through Teddy Bud’s online reply service when you chat.";
  const openPolicy = (url: string) => {
    setPolicyLinkError('');
    openExternalUrl(url).catch(() => setPolicyLinkError('Could not open this page. Check your connection and try again.'));
  };
  return <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Settings" onPress={onBack} style={styles.privacyBackButton}><AppIcon name="chevron" color={C.cocoa} size={16} /><Text style={styles.privacyBackText}>Back to Settings</Text></Pressable>
    <View style={styles.pageIntro}><Text style={styles.eyebrow}>YOUR DATA, YOUR CHOICES</Text><Text style={styles.pageTitle}>Privacy</Text><Text style={styles.pageDescription}>Choose what stays on this device and what accompanies your chats.</Text></View>
    <View style={styles.privacyBanner}><View style={styles.privacyShield}><AppIcon name="shield" color={C.green} size={19} /></View><View style={styles.privacyCopy}><Text style={styles.privacyTitle}>Your chats stay on this device</Text><Text style={styles.privacyBody}>{storagePrivacyDescription}</Text></View></View>
    <Text style={styles.settingsSectionLabel}>MEMORY & CONTEXT</Text>
    <View style={styles.settingsCard}>
      <SettingRow icon="sparkle" title="Suggest memory notes" description="Let Teddy gently suggest meaningful details from your messages. Turning this off keeps existing notes but stops new suggestions." value={rememberInSession} onChange={onRememberChange} />
      <View style={styles.settingSeparator} />
      <SettingRow icon="share" title="Share saved memories" description="Include your saved memory notes as context with new messages." value={shareMemories} onChange={onShareMemoriesChange} />
      <View style={styles.settingSeparator} />
      <SettingRow icon="search" title="Use other chats for context" description="Select a few relevant excerpts on this device and include them with your message." value={shareChatHistory} onChange={onShareChatHistoryChange} />
      <View style={styles.settingSeparator} />
      <SettingRow icon="book" title="Share About me notes" description="Include the profile notes you wrote in Settings with your conversations." value={shareAboutMe} onChange={onShareAboutMeChange} />
      <View style={styles.settingSeparator} />
      <SettingRow icon="heart" title="Use my setup answers with Teddy" description="When enabled, your answers about routines, mood, and support may accompany messages to Teddy. This stays off until you choose to turn it on." value={shareOnboardingSurvey} onChange={onShareOnboardingSurveyChange} />
    </View>
    <Text style={styles.settingsSectionLabel}>DATA</Text>
    <View style={styles.settingsCard}>
      <View style={styles.clearRow}><View style={styles.clearIcon}><AppIcon name="trash" color={C.rose} size={16} /></View><View style={styles.settingText}><Text style={styles.settingTitle}>Clear local data</Text><Text style={styles.settingDescription}>Remove saved chat history and memories from this device.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Clear local data" accessibilityHint="Permanently removes saved chats, memories, emotion check-ins, and journal entries from this device after confirmation." onPress={onClear} style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}><Text style={styles.clearButtonText}>Clear</Text></Pressable></View>
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

function SettingsPage({ wide, username, reduceMotion, hapticsEnabled, careRemindersEnabled, onReduceMotionChange, onHapticsChange, onCareRemindersChange, onOpenPrivacy, creditBalance, aboutMe, assistantName, assistantCharacterId, assistantCharacterNames, onAboutMeChange, onSaveAssistantCharacter, onExport, onImport, onLogout }: {
  wide: boolean;
  username: string;
  reduceMotion: boolean;
  hapticsEnabled: boolean;
  careRemindersEnabled: boolean;
  onReduceMotionChange: (value: boolean) => void;
  onHapticsChange: (value: boolean) => void;
  onCareRemindersChange: (value: boolean) => void;
  onOpenPrivacy: () => void;
  creditBalance: CreditBalance | null;
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
  const __teddyBudExtractedStyles21 = StyleSheet.create({
    style0: ({ color: C.cocoaDark, fontSize: 14, fontWeight: '700', marginTop: 5 }) as const,
    style1: ({ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }) as const,
    style2: ({ flex: 1 }) as const,
    style3: ({ color: C.cocoaDark, fontSize: 22, fontWeight: '700' }) as const,
    style4: ({ color: C.muted, fontSize: 12, fontWeight: '500' }) as const,
    style5: ({ height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: C.paperAlt }) as const,
    style6: ({ height: '100%', width: `${Math.min(100, Math.max(0, (creditBalance?.remaining ?? 0) / 40 * 100))}%`, backgroundColor: C.cocoa, borderRadius: 4 }) as const,
  });
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
      setBackupStatus(backupErrorMessage(error, 'export'));
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
      setBackupStatus(backupErrorMessage(error, 'import'));
    }).finally(() => setBackupBusy(false));
  };

  return <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]} keyboardShouldPersistTaps="handled">
    <View style={styles.pageIntro}><Text style={styles.eyebrow}>YOUR ACCOUNT</Text><Text style={styles.pageTitle}>Settings</Text>{!!username && <Text style={__teddyBudExtractedStyles21.style0}>@{username}</Text>}<Text style={styles.pageDescription}>Personalize your space and move your data between devices.</Text></View>
    <Text style={styles.settingsSectionLabel}>MOTION & FEEDBACK</Text>
    <View style={styles.settingsCardForm}>
      <SettingRow icon="sparkle" title="Reduce motion" description="Use calmer transitions and reduce non-essential movement." value={reduceMotion} onChange={onReduceMotionChange} />
      <View style={styles.settingDivider} />
      <SettingRow icon="heart" title="Haptic feedback" description="Use gentle vibration feedback for supported interactions." value={hapticsEnabled} onChange={onHapticsChange} />
    </View>
    {Platform.OS === 'android' && <>
      <Text style={styles.settingsSectionLabel}>GENTLE CHECK-INS</Text>
      <View style={styles.settingsCardForm}>
        <SettingRow icon="heart" title="Friendly check-ins" description="A warm Android notification after three days away. You can turn it off whenever you like." value={careRemindersEnabled} onChange={onCareRemindersChange} />
      </View>
    </>}
    <Text style={styles.settingsSectionLabel}>PRIVACY</Text>
    <View style={styles.settingsCardForm}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open privacy controls" onPress={onOpenPrivacy} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>
        <View style={styles.settingIcon}><AppIcon name="shield" color={C.cocoa} size={17} /></View>
        <View style={styles.settingText}><Text style={styles.settingTitle}>Privacy controls</Text><Text style={styles.settingDescription}>Choose what stays private and what context Teddy Bud may use in chats.</Text></View>
        <AppIcon name="chevron" color={C.muted} size={18} />
      </Pressable>
    </View>
    <Text style={styles.settingsSectionLabel}>DAILY USAGE</Text>
    <View style={styles.settingsCardForm}>
      <View style={__teddyBudExtractedStyles21.style1}>
        <View style={__teddyBudExtractedStyles21.style2}>
          <Text style={styles.settingTitle}>Daily AI credits</Text>
          <Text style={styles.settingDescription}>40 credits each day. Text prompts use 1 credit; image uploads use 5 credits.</Text>
        </View>
        <Text style={__teddyBudExtractedStyles21.style3}>{creditBalance ? creditBalance.remaining : '—'}<Text style={__teddyBudExtractedStyles21.style4}> / 40</Text></Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel="Daily AI credits remaining" accessibilityValue={{ min: 0, max: 40, now: creditBalance?.remaining ?? 0 }} style={__teddyBudExtractedStyles21.style5}>
        <View style={__teddyBudExtractedStyles21.style6} />
      </View>
      <Text style={styles.settingDescription}>Text: 1 credit · Image upload: 5 credits · Resets daily at 00:00 UTC.</Text>
      <Text style={styles.settingDescription}>{creditBalance ? `${40 - creditBalance.remaining} used · ${creditBalance.remaining} remaining` : 'Balance is temporarily unavailable. It will update automatically when the service reconnects.'}</Text>
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
          return <Pressable key={character.id} accessibilityRole="radio" accessibilityLabel={`${shownName}, ${character.tagline}`} accessibilityState={{ selected }} onPress={() => { setSelectedCharacterId(character.id); setCharacterNameDraft(savedName); }} style={[styles.characterChoice, selected && styles.characterChoiceSelected]}>
            <View style={styles.characterChoiceIcon}><AppIcon name={character.icon} color={C.cocoa} size={19} /></View>
            <View style={styles.characterChoiceCopy}><Text style={styles.characterChoiceName}>{shownName}</Text><Text style={styles.characterChoiceTagline}>{character.tagline}</Text></View>
            {selected && <AppIcon name="check" color={C.cocoa} size={17} />}
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
      <Text style={styles.settingTitle}>Account data backup</Text>
      <Text style={styles.settingDescription}>Export chats, memories, and preferences as an encrypted .teddybud file. After reinstalling, sign in with the same username and import this file to restore your account data.</Text>
      <TextInput value={backupPassphrase} onChangeText={setBackupPassphrase} placeholder="Backup passphrase (12+ characters)" placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false} secureTextEntry style={[styles.settingsTextInput, styles.backupPassphraseInput]} accessibilityLabel="Backup passphrase" />
      <View style={styles.backupActions}>
        <Button label={backupBusy ? 'Working…' : 'Export .teddybud'} onPress={exportBackupFile} disabled={backupBusy || backupPassphrase.trim().length < 12} />
        <Button label="Import account data" tone="quiet" onPress={chooseBackupFile} disabled={backupBusy || backupPassphrase.trim().length < 12} />
      </View>
      {!!backupStatus && <Text accessibilityLiveRegion="polite" style={styles.backupStatus}>{backupStatus}</Text>}
      <Text style={styles.backupFootnote}>Your username and password restore account access; this encrypted file restores local chats, memories, and preferences. Keep the backup passphrase safe.</Text>
    </View>
    <Text style={styles.settingsSectionLabel}>ACCOUNT</Text>
    <View style={styles.settingsCardForm}>
      <View style={styles.clearRow}><View style={styles.settingText}><Text style={styles.settingTitle}>Sign out</Text><Text style={styles.settingDescription}>End this device's current sign-in session.</Text></View><Pressable accessibilityRole="button" onPress={onLogout} style={styles.clearButton}><Text style={styles.clearButtonText}>Sign out</Text></Pressable></View>
    </View>
  </ScrollView>;
}

function SettingRow({ icon, title, description, value, onChange }: { icon: AppIconName; title: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  const triggerHaptic = useHapticFeedback();
  const reduceMotion = useReducedMotionPreference();
  useEffect(() => {
    progress.stopAnimation();
    if (reduceMotion) {
      progress.setValue(value ? 1 : 0);
      return undefined;
    }
    const animation = Animated.timing(progress, { toValue: value ? 1 : 0, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [progress, value, reduceMotion]);
  const thumbPosition = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 17] });
  const trackColor = progress.interpolate({ inputRange: [0, 1], outputRange: ['#DED8D0', C.cocoa] });
  return <View style={styles.settingRow}><View style={styles.settingIcon}><AppIcon name={icon} color={C.cocoa} size={17} /></View><View style={styles.settingText}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDescription}>{description}</Text></View><Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={title} accessibilityHint={description} onPress={() => { triggerHaptic(); onChange(!value); }} style={({ pressed }) => [styles.switchHitArea, pressed && styles.pressed, pressed && !reduceMotion && styles.squeezePressed]}><Animated.View style={[styles.switchTrack, { backgroundColor: trackColor }]}><Animated.View style={[styles.switchThumb, { transform: [{ translateX: thumbPosition }] }]} /></Animated.View></Pressable></View>;
}

function Button({ label, onPress, tone = 'primary', disabled = false }: { label: string; onPress: () => void; tone?: 'primary' | 'quiet'; disabled?: boolean }) {
  const reduceMotion = useReducedMotionPreference();
  const triggerHaptic = useHapticFeedback();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { triggerHaptic(); onPress(); }} disabled={disabled} style={({ pressed }) => [
    styles.button,
    tone === 'quiet' && styles.buttonQuiet,
    disabled && styles.buttonDisabled,
    pressed && styles.pressed,
    pressed && !reduceMotion && styles.squeezePressed,
  ]}><Text style={[styles.buttonText, tone === 'quiet' && styles.buttonTextQuiet]}>{label}</Text></Pressable>;
}





export default App;