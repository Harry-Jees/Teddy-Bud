# Teddy Bud Client

The client package contains Teddy Bud's React Native application and its Electron desktop wrapper. The web-rendered bundle is an internal desktop UI implementation detail; Teddy Bud is not distributed as a standalone web app.

## Getting started

## Browser preview for development only

The Vite/React Native Web target exists for local development and to package the UI inside Electron desktop apps. It is not a supported standalone product, hosted web app, or download.

1. Install Node.js 22.12 or newer.
2. From the `client` directory, install the project dependencies with `npm ci`.
3. Start the hot-reloading preview with `npm run web`; it opens the browser automatically.
4. If it does not open automatically, visit [http://localhost:5173](http://localhost:5173).

## Platform builds

Teddy Bud currently provides an Android ARM64 APK and desktop packages for Windows x64, Apple Silicon macOS, and x64 Debian/Ubuntu Linux. Windows, macOS, and Linux desktop installers wrap the locally packaged Vite/React Native Web UI with Electron. The desktop apps load packaged local assets and open trusted support links in the system browser. **There is no standalone web app, hosted browser version, or installable iOS/iPhone app.**

Use Node.js 22.12 or newer, install dependencies from this directory with
`npm ci`, then run the relevant build:

```sh
npm run android
npm run build:web
npm run build:dist
npm run desktop:windows
npm run desktop:macos
npm run desktop:linux
```

The desktop commands create a Windows NSIS installer, an Apple Silicon macOS DMG,
and x64 Debian `.deb` and AppImage packages under `../dist/desktop/`.
`npm run build:web` creates an internal renderer bundle for Electron desktop packaging; it is not a standalone web distribution. `npm run build:dist` packages the desktop app for the current operating system in `../dist/desktop/`. The GitHub Actions workflow collects Android, Windows, Apple Silicon macOS, and Linux
packages into a single `teddy-bud-dist` artifact with the same `dist/` layout. Push and manual workflow
runs also commit the generated files into the triggering branch's root `dist/`
folder. Pull-request runs build and upload the artifact without committing
files. Large Windows package payloads use Git LFS; unpacked Electron staging
files are excluded. To run the desktop wrapper locally, build the relative-path web bundle first with
`npm run build:web -- --base=./`, then use `npm run desktop:run`.

The GitHub Actions workflow at `../.github/workflows/ci.yml` runs client tests,
TypeScript checks, Android release APK packaging, Windows and Apple Silicon macOS
desktop packaging, Linux DEB/AppImage packaging, and gateway Worker tests. Build outputs are attached to the workflow run and, for push and
manual runs, committed to `dist/` in the triggering branch. These are
unsigned development artifacts: Windows releases need a signing certificate,
macOS distribution needs Developer ID signing and notarization, and Android store
builds need a private release keystore. There is no supported iOS build or iPhone installer in this repository. The workflows do not publish to stores or deploy a web app or website.

The first launch opens account creation; later launches open sign-in. Accounts
use email and password through Supabase Auth. At signup, choose a recovery
password of at least 6 characters and a recovery passphrase of 10 to 128
characters, then confirm both. Choose a unique phrase. The phrase plus account email can reset
the password, so save it somewhere private. Supabase stores the password
verifier. The gateway stores a keyed HMAC verifier for the recovery passphrase
in a private table; the phrase itself is never stored. Email is an account
identifier and the app does not require email verification or send auth emails.
This avoids dependence on a publisher-owned domain or SMTP provider. Keep the
recovery HMAC secret and Supabase service-role key in
the Worker secret store only.

Native session tokens use platform secure storage. Electron desktop tokens are
encrypted through Windows DPAPI, macOS Keychain, or a Linux Secret Service
keyring. On Linux, configure GNOME Keyring, KWallet, or another Secret Service
provider before signing in. Passwords are not saved by the app. Chats, memories,
and preferences persist locally, scoped to the Supabase user ID. Native database
files use SQLCipher with a random key stored in Keychain/Keystore. Electron
encrypts local records through the operating-system secure storage used by
Electron `safeStorage`. The optional local browser preview (development only) stores records with AES-256-GCM and a non-exportable Web Crypto key in IndexedDB. It is not a supported hosted product. Same-origin script can access data while the preview is unlocked. Clearing the preview site's data removes the device key and local records.

Encryption keys are generated independently for each account and device. The development-only browser preview has a separate browser-profile key. Native builds use a separate SQLCipher database and keychain
key for each Supabase user ID. Electron generates one AES-256-GCM key per
account and wraps it with operating-system secure storage. The development-only browser preview stores a separate non-exportable CryptoKey per account in IndexedDB. Password and
recovery passphrase material are not used as local encryption keys. The
Supabase user ID scopes local records and encryption keys to the signed-in account;
Supabase Auth manages the email. Portable recovery uses the encrypted
`.teddybud` backup, protected by its own user-chosen passphrase and random salt.
A backup requires its passphrase and the same signed-in account that created it.
The same `.teddybud` file can move between Android and the Windows, macOS, and
Linux Electron releases. Mobile uses the system document picker; desktop uses
the packaged file dialog/download flow. There is no standalone web release. See
[`guide/SECURITY_AND_PRIVACY.md`](../guide/SECURITY_AND_PRIVACY.md) for the
storage model, migration behavior, and security references.

Privacy toggles control whether saved memories, selected chat excerpts, and
About me notes are included with messages sent to the configured AI provider.

The gateway URL is built into `src/config/gateway.ts`; users do not enter or
change it. The browser gateway is deployed separately from the original
gateway. The profile and recovery migrations are in `supabase/migrations`.
Follow [`../gateway-worker/README.md`](../gateway-worker/README.md) to enable the
Email provider, disable email confirmation, and configure the Worker secrets
and allowed browser origins. Sessions expire absolutely after one hour and require
the user to sign in again. Supabase currently includes 50,000 monthly active
users for Auth on its Free plan; other resource limits and AI model costs remain
separate.

After enabling SQLCipher in the native SQLite build configuration, reinstall native dependencies and rebuild the applicable native target. Existing plain-SQLite development data is not migrated automatically.

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Conversation model behavior

The client routes ordinary text to Cloudflare Workers AI `@cf/zai-org/glm-4.7-flash` and image-containing messages to `@cf/qwen/qwen3.8-27b`. The gateway enforces this routing server-side so an image cannot be sent to the text-only model. The chat composer supports attaching JPEG, PNG, WebP, and GIF images up to 8 MB. Each text or image message costs one credit from the unified 40-credit daily Free allowance. The gateway enforces the allowance and resets it at 00:00 UTC. The allowance is a product limit, not an exact measure of inference cost; monitor Cloudflare AI spend separately. Pro (7 personalities) and Premium (10 personalities) are coming soon; their checkout is not enabled. Enterprise local-model routing is a planned deployment mode, not a currently available feature.

The client prompt asks the assistant to be warm, compassionate, natural, and
multilingual, and to answer in the language the user uses. Prompt instructions
cannot guarantee perfect fluency or understanding. Model availability, rate limits, output quality, and Cloudflare Workers AI data practices may vary by model; review the applicable provider terms before sending sensitive content.

Chat history is organized into separate conversations and saved locally on
the device without an application-defined chat or message count limit. Device
storage quotas still apply. Recent conversation context is sent to the model
within a bounded input window, while the full local chat remains available in
chat history. The **Use other chats for context** setting selects up to three relevant
excerpts from other saved chats on-device (at most 1,800 characters) and sends
only those excerpts with the current chat request. This is lightweight keyword
matching, not semantic search. The setting stays enabled.

Teddy Bud may suggest saving only an exceptionally important, lasting fact;
ordinary details are not enough. Nothing is saved unless the user approves the
prompt. Users can also open **Save a good moment** from the chat composer to
write and save a memory themselves. Approved memories stay on the device and
are included in future chats sent to the AI provider.

## Emotional support and safety

The conversation model is instructed to notice emotional cues in context,
respond empathetically without presenting an emotion label or diagnosis, and
ask rather than assume when a feeling is unclear. This is not a separately
validated sentiment-analysis or clinical assessment system, and it can
misunderstand tone, idioms, or risk.

For selected direct phrases about suicide, self-harm, overdose, or immediate
danger, the chat displays an inline crisis-support widget with a tap-to-call
emergency action when the device locale identifies a supported region (India,
US, Canada, UK, Australia, New Zealand, or the EU). Locale is only a hint and
may not match the user's current location; the widget names the region and
always offers the [Find A Helpline](https://findahelpline.com/) directory as
an alternative. When the device locale identifies India, the widget offers call
actions for Tele-MANAS at **14416** and **1-800 891 4416**, plus its
[official website](https://telemanas.mohfw.gov.in/). For the US or Canada,
the widget offers call and text actions for **988**: the
[988 Lifeline](https://988lifeline.org/get-help/) in the US and the
[988 Suicide Crisis Helpline](https://988.ca/) in Canada. Device locale is
not proof of physical location; use the appropriate local service if you are
elsewhere.

Important-memory suggestions appear as an inline card attached to Teddy Bud's
reply, rather than a popup. The user must choose **Add to memories** before
anything is saved; **Not now** dismisses it. These cards are produced by a
separate, constrained memory-suggestion request, not arbitrary model-triggered
code or a tool call.

These safeguards follow a human-support-first, transparent approach informed
by the [WHO guidance on large multimodal models in health](https://www.who.int/publications/i/item/9789240084759);
they do not make the app a medical device or substitute for professional care.

## Native development

Run `npm run android` with an Android emulator or device attached. The repository does not currently offer an installable iOS release. The Android distribution is an ARM64 APK. No iOS Simulator archive or installable iPhone IPA is published; a physical-device release requires Apple signing credentials and provisioning. The available packages are development outputs and do not replace signed store builds.

For macOS desktop development, use `npm run desktop:run` after building the relative-path web bundle with `npm run build:web -- --base=./`. Desktop packaging commands and the current output locations are listed in the [repository README](../README.md) and the [distribution verification record](../guide/DISTRIBUTION_VERIFICATION.md).

For React Native platform setup, see the official [environment setup guide](https://reactnative.dev/docs/set-up-your-environment). For iOS dependency setup, install CocoaPods and run `bundle exec pod install` from `client/ios/` or `client/macos/` as appropriate.
