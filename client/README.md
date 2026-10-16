This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

## Preview in a browser

The web target uses Vite and React Native Web to render the same app UI in a desktop or mobile browser.

1. Install Node.js 22 LTS or newer.
2. From the `client` directory, install the project dependencies with `npm install`.
3. Start the hot-reloading preview with `npm run web`; it opens the browser automatically.
4. If it does not open automatically, visit [http://localhost:5173](http://localhost:5173).

Users create accounts with a full name, email address, and password, then sign
in with email and password. Supabase Auth stores the email and password
(passwords are handled by Supabase Auth, never stored by Teddy Bud) and enforces
email confirmation; its custom SMTP settings use Resend to deliver confirmation
emails. A database trigger stores the account name and mirrors each Supabase
Auth UUID into the RLS-protected `user_profiles` table. The
Cloudflare gateway checks that profile with the user's Supabase token before
issuing a Teddy Bud session. Teddy Bud never stores passwords or Supabase
access tokens. Browser tokens are kept in
`sessionStorage`; native tokens use platform secure storage. Chat history,
saved memories, and preferences persist locally, scoped to the Supabase account.
Native database files use SQLCipher with a key stored in Keychain/Keystore.
Browser data uses IndexedDB and is not encrypted by Teddy Bud;
use a trusted, device-protected browser profile and clear local data when needed.
Saved memories are sent to the AI provider only when memory sharing is enabled.

The gateway URL is built into `src/config/gateway.ts`; users do not enter or
change it. The browser gateway is deployed separately from the original
gateway. Configure Supabase Auth to use Resend SMTP and apply the profile-table
migration in `supabase/migrations`. Configure the Worker with `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `AUTH_REDIRECT_ORIGINS`, and `JWT_SIGNING_SECRET`; model
and chat endpoints also require `NVIDIA_KEY_1`. The Resend API key belongs in
Supabase SMTP settings, not the app or Worker. Keep credentials out of the app.
The Worker’s
separate Cloudflare Access redirect endpoint is optional.

After enabling SQLCipher in the native SQLite build configuration, reinstall
native dependencies and rebuild the app (`bundle exec pod install` for iOS).
Existing plain-SQLite development data is not migrated automatically.

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Conversation model behavior

The gateway prefers NVIDIA's `nvidia/nemotron-3.5-lightning-30b-a3b` for
low-latency chat, then tries the hosted Mistral Nemo Minitron 8B and Nemotron
70B models if NVIDIA reports that a model function is unavailable. The client
limits replies to 220 tokens and supplies instructions to respond briefly and
empathetically, noticing emotional tone without diagnosing or labeling the
person. Hosted model availability may vary by NVIDIA account.

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
