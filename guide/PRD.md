# Product Requirements Document (PRD): Teddy Bud

## 1. Product Overview
Teddy Bud is an emotional companion chat application designed to provide a calm, personal space for natural conversation. It prioritizes warmth, trust, privacy, and technical reliability over generic AI features. It is built as a cross-platform application using React Native.

## 2. Current Platform Scope
- **Web**: browser app built with Vite and React Native Web.
- **Android**: ARM64 APK development build.
- **Desktop**: Windows x64 installer, Apple Silicon macOS package, and x64 Debian/Ubuntu Linux packages through Electron.
- **Not currently available**: an installable iOS/iPhone/iPad app.
- **Framework**: React Native, React Native Web, and Electron desktop packaging.

Platform support in this section describes the current repository and collected artifacts, not a promise of store approval or signed production distribution.

## 3. Core Features
- **Companion Chat**: Primary surface for conversational AI with support for text, multiline composition, streaming responses, and message history. Includes bounded retries for failed sends.
- **Memory System**: The app maintains user memories contextually. Users can view, add, edit, forget, and clear specific active memories.
- **Privacy Controls**: Granular user controls to define what is kept locally, what is sent to the AI, and absolute control to wipe data entirely.
- **Adaptive UI**: Responsive design adapting from mobile layouts to wide desktop windows safely.

## 4. Non-Goals
- NOT a generic ChatGPT clone or corporate dashboard.
- NOT a local AI runtime (No local LLMs, Ollama, or multi-GB model downloads).
- NO childish cartoon UI, neon, or excessive glassmorphism.

## 5. Security & Privacy Policies
- All conversation history and approved memories are stored locally in an encrypted database (SQLCipher or equivalent).
- Database keys and device credentials must be kept in the platform's secure credential store (Keychain/Keystore). There is no plaintext fallback.
- Only explicitly required context and keyword-relevant memories are sent over the network to the gateway.
