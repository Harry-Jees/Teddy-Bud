# Voice input and interaction quality acceptance

## Product scope

Teddy Bud voice is **speech-to-text input only**. It behaves like a microphone button in a chat composer: the user explicitly starts recognition, speaks, reviews and edits the resulting text, then chooses whether to send it as an ordinary message.

Out of scope: text-to-speech, generated audio, spoken assistant replies, voice playback, duplex voice conversations, and paid speech APIs. Do not add voice-output controls or a TTS provider.

## Implementation requirements

- Use the platform/browser speech-recognition capability; do not route audio through Teddy Bud's Cloudflare gateway or add a paid inference provider.
- Android uses the native speech-recognition service through the React Native voice bridge and requests microphone permission at runtime.
- Web/Electron uses the browser SpeechRecognition API only when the host provides it and microphone access is allowed. Explain unsupported browsers and retain normal text entry.
- Recognition is always user-initiated. Never record automatically or send a message automatically.
- Partial/final recognition populates the existing editable message draft. Preserve any text already in the draft.
- Provide a clear listening state, stop action, accessible labels, permission/error guidance and retry path.
- Stop recognition when the screen unmounts. Do not save or upload microphone recordings; the platform speech service may process speech according to its own privacy policy.
- No generated audio, TTS, voice model, Cloudflare AI voice route, or voice response settings.

## Acceptance tests

- Start/stop recognition; partial and final results appear in the composer.
- Existing draft text is preserved before the dictated text.
- User can edit, delete or discard the transcript before sending.
- No automatic send on recognition completion.
- Permission granted, denied, revoked and unavailable.
- Unsupported browser, no recognition service, empty transcript, network/service error and repeated taps.
- App background/unmount ends recognition cleanly.
- Screen-reader labels and visible state for microphone controls.
- Text chat remains fully usable if voice input is unavailable.

## Visual and interaction audit

- Follow Teddy Bud's 8-point spacing rhythm and warm ivory/clay/cocoa visual language.
- Keep the microphone control aligned with the text field and send action, with a 44 dp minimum hit target.
- Ensure responsive layout, safe areas, keyboard behavior, reduced motion, large text, contrast and screen-reader support.
- Avoid layout jumps when listening status or errors appear.

## Release gates

- Run lint, type-check, unit tests and Android/web/desktop builds from the same commit.
- Install and test Android on a real device with permission granted and denied.
- Test supported browser/Electron environments; explicitly document unsupported hosts.
- Confirm text/image chat regression tests pass.
- Do not claim platform support or completion without recorded evidence.
