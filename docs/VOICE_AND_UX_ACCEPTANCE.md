# Voice input and interaction acceptance

## Product scope
Teddy Bud voice is **speech-to-text input only**. The user taps the microphone, speaks, reviews and edits the recognized text, then decides whether to send it as a normal message.

Out of scope: text-to-speech, generated audio, spoken assistant replies, voice playback, duplex voice conversations, and paid speech APIs. Do not add voice-output controls or a TTS provider.

## Requirements
- Recognition is explicitly user-initiated; never record or send automatically.
- Place recognized text into the editable composer and preserve existing draft content.
- Provide visible listening/stop states, accessible labels, permission/error guidance, and a retry path.
- Stop recognition when the screen unmounts or app lifecycle requires it.
- Do not save or upload microphone recordings. Explain that a platform speech service may process speech under its own policy.
- If recognition is unavailable or permission is denied, text chat remains fully usable.

## UX quality
- Use Teddy Bud's warm ivory/clay/cocoa palette, Material 3 foundations, and 8-point spacing rhythm.
- Keep microphone, composer, and send action aligned; use accessible hit targets.
- Respect safe areas, keyboard behavior, reduced motion, large text, contrast, and screen readers.
- Avoid layout jumps when listening status or errors appear.

## Acceptance checks
- Start/stop recognition; partial and final results appear in the composer.
- Existing draft is preserved; transcript can be edited, discarded, or deleted.
- No automatic send on recognition completion.
- Permission granted, denied, revoked, and unavailable paths.
- Unsupported browser/service, empty transcript, service error, repeated taps, and app background/unmount.
- Text and image chat remain functional when speech recognition is unavailable.

## Release gates
Run lint, type-check, unit tests, and supported platform builds. Test Android on a real device and supported desktop hosts. Do not claim platform support or completion without recorded evidence.
