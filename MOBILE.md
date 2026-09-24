# Mobile App

This repo now uses Capacitor to package the existing Vite/React app for Android
and iOS.

## Does this affect the web app?

No. The web app remains a normal Vite build and can still be served from `dist/`
or deployed to Vercel/Lovable as before. Capacitor copies that same `dist/`
bundle into the native projects under `android/` and `ios/`.

## Native identity

- App name: `LEXORA`
- App ID / bundle ID: `com.jascasekeeper.app`
- Web directory: `dist`

Change these in `capacitor.config.ts` before publishing if the final store
identity should be different.

## Commands

```sh
npm run build
npm run mobile:sync
```

Use these to open native IDE projects:

```sh
npm run android:open
npm run ios:open
```

Use these to run on a connected device or simulator:

```sh
npm run android
npm run ios
```

## Release notes

- Android builds require Android Studio and a configured Android SDK.
- iOS builds require macOS, Xcode, and an Apple Developer account.
- Store publishing requires final icons, privacy details, screenshots, signing
  certificates, and app store metadata.
- Supabase email redirects, password reset links, and any future OAuth/deep-link
  flows should be configured for the final app links before store submission.

Capacitor workflow reference: https://capacitorjs.com/docs/basics/workflow
