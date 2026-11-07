import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import {
  Animated,
  AccessibilityInfo,
  AppState,
  Alert,
  Easing,
  Image,
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
import type { EmotionCheckIn, JournalEntry, LocalAppData, LocalConversation, LocalMemory, LocalMessage } from './src/services/localData';
import { EMOTION_AXES } from './src/services/localData';
import { OnboardingSurvey } from './src/components/OnboardingSurvey';
import { AnimatedNavIcon } from './src/components/AnimatedNavIcon';
import { AppIcon } from './src/components/AppIcon';
import type { AppIconName } from './src/c¶»§q«^