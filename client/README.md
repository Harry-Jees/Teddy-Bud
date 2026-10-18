This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

## Preview in a browser

The web target uses Vite and React Native Web to render the same app UI in a desktop or mobile browser.

1. Install Node.js 22 LTS or newer.
2. From the `client` directory, install the project dependencies with `npm install`.
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

The desktop commands create a Windows NSIS installer, macOS DMGs for Intel and
Apple Silicon, and an x64 Debian `.deb` package under `../dist/desktop/`.
`npm run build:web` writes the browser bundle to `../dist/web/`; `npm run build:dist`
creates that bundle and packages the desktop app for the current
operating system in `../dist/desktop/`. The GitHub Actions workflow collects
web, Android, iOS Simulator, macOS, Windows, and Linux packages into a single
`teddy-bud-dist` artifact with the same `dist/` layout. Push and manual workflow
runs also commit the generated files into the triggering branch's root `dist/`
folder. Pull-request runs build and upload the artifact without committing
files. Large Windows package payloads use Git LFS; unpacked Electron staging
files are excluded. To run the desktop wrapper locally, build the relative-path web bundle first with
`npm run build:web -- --base=./`, then use `npm run desktop:run`.

The GitHub Actions workflow at `../.github/workflows/ci.yml` runs tests,
TypeScript checks, web builds, Android debug builds, iOS Simulator/macOS native
builds, Windows and macOS desktop packaging, Linux `.deb` packaging, and gateway
Worker tests. Build outputs are attached to the workflow run and, for push and
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
scoped to the Supabase account. Native mobile database files use SQLCipher with a
key stored in Keychain/Keystore. Browser and Electron chat data use IndexedDB and
are not encrypted by Teddy Bud; protect the device account and clear local data
when needed. Privacy toggles control whether saved memories, selected chat
excerpts, and About me notes are included with messages sent to the configured AI
provider.

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

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
