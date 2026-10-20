# Teddy Bud Client

The client package contains Teddy Bud's React Native app, browser build, and Electron desktop wrapper.

## Getting started

## Preview in a browser

The web target uses Vite and React Native Web to render the same app UI in a desktop or mobile browser.

1. Install Node.js 22.12 or newer.
2. From the `client` directory, install the project dependencies with `npm ci`.
3. Start the hot-reloading preview with `npm run web`; it opens the browser automatically.
4. If it does not open automatically, visit [http://localhost:5173](http://localhost:5173).

## Platform builds

Teddy Bud uses React Native for Android, iOS, and macOS. Windows, macOS, and
Debian/Ubuntu desktop installers wrap the same Vite/React Native Web UI with
Electron. The desktop apps load packaged local assets, open Google sign-in and
trusted support links in the system browser, and receive OAuth through the
`teddybud://auth/callback` app link.

Use Node.js 22.12 or newer, install dependencies from this directory with
`npm ci`, then run the relevant build:

```sh
npm run android
npm run ios
npm run build:web
npm run build:dist
npm run desktop:windows
npm run desktop:macos
npm run desktop:linux
```

The desktop commands create a Windows NSIS installer, an Apple Silicon macOS DMG,
and x64 Debian `.deb` and AppImage packages under `../dist/desktop/`.
`npm run build:web` writes the browser bundle to `../dist/web/`; `npm run build:dist`
creates that bundle and packages the desktop app for the current
operating system in `../dist/desktop/`. The GitHub Actions workflow collects Android, Windows, Apple Silicon macOS, and Linux
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
macOS distribution needs Developer ID signing and notarization, Android store
builds need a private release keystore, and iOS device archives need an Apple
Developer Team and provisioning profile. The workflows do not publish to stores
or deploy the website.

Google is the only sign-in and account-verification method. There are no
email/password forms, email verification codes, or alternate sign-in routes.
Enable Google in Supabase Auth, configure its OAuth client, and disable the
Email provider so Supabase cannot create email/password accounts. Google
confirms the account email during OAuth. A database trigger mirrors each
Supabase Auth UUID into the RLS-protected `user_profiles` table. The Cloudflare
gateway verifies that the Supabase identity came from Google and checks the
profile before issuing a Teddy Bud session. Teddy Bud never stores Google
passwords or Supabase access tokens. Browser tokens are kept in `sessionStorage`;
native tokens use platform secure storage. Electron desktop tokens are encrypted
through Windows DPAPI, macOS Keychain, or a Linux Secret Service keyring. On
Linux, configure GNOME Keyring, KWallet, or another Secret Service provider
before signing in. Chat history, saved memories, and preferences persist locally,
scoped to the Supabase account. Native database files use SQLCipher with a
random key stored in Keychain/Keystore. Electron encrypts local records through
the operating-system secure storage used by Electron `safeStorage`. Web records
use AES-256-GCM with a non-exportable Web Crypto key stored in IndexedDB. Older
web and Electron records are encrypted when first read after the upgrade. Browser encryption
protects stored files and database contents; code running in the same browser
origin can still access data while the app is unlocked. Clearing the browser
site's data also removes the device key and local records.

Encryption keys are generated independently for each device or browser profile.
Google email and Supabase salts are not used as encryption key material. The
Supabase user ID scopes local records to the signed-in account; the email is
managed by Supabase Auth. Portable recovery uses the encrypted `.teddybud`
backup, protected by its own user-chosen passphrase and random salt. A backup
requires both that passphrase and the account that created it. See
[`guide/SECURITY_AND_PRIVACY.md`](../guide/SECURITY_AND_PRIVACY.md) for the
storage model, migration behavior, and security references.

Privacy toggles control whether saved memories, selected chat excerpts, and
About me notes are included with messages sent to the configured AI provider.

Configure the Google provider in Supabase with its Web OAuth client ID and
secret. In Google Cloud, use
`https://lvfvlrazovppkorkpwqz.supabase.co/auth/v1/callback` as the authorized
redirect URI. In Supabase Auth URL configuration, allow the app callback
`teddybud://auth/callback`, the local web callbacks
`http://localhost:5173/auth/callback` and
`http://127.0.0.1:5173/auth/callback`, and the deployed web callback URL.
The mobile callback uses the `teddybud` app URL scheme. OAuth authorization
codes use PKCE and are exchanged by the gateway; Google client secrets remain
in Supabase and are never shipped with the app.

The gateway URL is built into `src/config/gateway.ts`; users do not enter or
change it. The browser gateway is deployed separately from the original
gateway. The profile-table migrations are in `supabase/migrations`. Configure
The Worker with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AUTH_REDIRECT_ORIGINS`, and
`JWT_SIGNING_SECRET`; model and chat endpoints also require `NVIDIA_KEY_1`.
OAuth provider secrets belong in Supabase, not the app. Keep credentials out
of source control.

After enabling SQLCipher in the native SQLite build configuration, reinstall
native dependencies and rebuild the app (`bundle exec pod install` for iOS).
Existing plain-SQLite development data is not migrated automatically.

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Conversation model behavior

The gateway prefers NVIDIA's `nvidia/nemotron-3-super-120b-a12b` for
conversation and allows up to 1024 output tokens so model reasoning does not
consume the entire reply budget. Image-understanding requests remain limited
to 220 output tokens. The client supplies instructions to respond briefly and
empathetically, noticing emotional tone without diagnosing or labeling the
person. If the preferred model returns no text or is unavailable, the client
tries other chat-capable models from NVIDIA's catalog; model availability may
vary by account.

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

Run `npm run android` with an Android emulator or device attached. Run `npm run ios` on macOS with Xcode and CocoaPods configured. The Android distribution is an ARM64 APK. No iOS Simulator archive or installable iPhone IPA is published; a physical-device release requires Apple signing credentials and provisioning. The available packages are development outputs and do not replace signed store builds.

For macOS desktop development, use `npm run desktop:run` after building the relative-path web bundle with `npm run build:web -- --base=./`. Desktop packaging commands and the current output locations are listed in the [repository README](../README.md) and the [distribution verification record](../guide/DISTRIBUTION_VERIFICATION.md).

For React Native platform setup, see the official [environment setup guide](https://reactnative.dev/docs/set-up-your-environment). For iOS dependency setup, install CocoaPods and run `bundle exec pod install` from `client/ios/` or `client/macos/` as appropriate.
