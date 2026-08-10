import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as fbAuth from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    'Firebase config missing. Copy .env.example to .env and fill in the ' +
      'EXPO_PUBLIC_FIREBASE_* values, then restart with `npx expo start --clear`.',
  );
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Auth persistence.
 *
 * `firebase/auth` is `export * from '@firebase/auth'`, and @firebase/auth
 * declares a `react-native` export condition — so under Metro this module
 * resolves to the RN build, which is the only one exporting
 * `getReactNativePersistence`. On web that symbol is absent (and unnecessary),
 * hence the platform split. Without this, the session is lost on every relaunch.
 */
function createAuth(): fbAuth.Auth {
  const persistence =
    Platform.OS === 'web'
      ? fbAuth.browserLocalPersistence
      : (
          fbAuth as unknown as {
            getReactNativePersistence: (s: unknown) => fbAuth.Persistence;
          }
        ).getReactNativePersistence(AsyncStorage);

  try {
    return fbAuth.initializeAuth(app, { persistence });
  } catch {
    // Already initialised (Fast Refresh re-runs this module).
    return fbAuth.getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * Storage retries a failing upload for two minutes by default, with backoff.
 * When the bucket doesn't exist — the Spark plan case — every attempt fails
 * identically, so that default just buries the real error behind a two-minute
 * wait and the Tambah screen reports a timeout instead of what went wrong.
 * Shortened so `uploadErrorMessage` sees the actual Storage error code. This
 * clock only runs once an attempt has already failed, so it doesn't cut short a
 * healthy-but-slow upload — it bounds how long a broken one keeps retrying.
 */
storage.maxUploadRetryTime = 30_000;

/**
 * Local development against the Firebase emulator suite.
 *
 * Set EXPO_PUBLIC_USE_FIREBASE_EMULATOR=1 and run `npm run emulators` to work
 * against local Auth/Firestore/Storage instead of the live project — useful for
 * trying destructive changes, and it needs no billing plan. Off by default, so
 * a normal `npx expo start` always talks to production.
 *
 * EXPO_PUBLIC_EMULATOR_HOST defaults to localhost; point it at your machine's
 * LAN IP when testing on a physical device through Expo Go.
 */
if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === '1') {
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST || 'localhost';
  fbAuth.connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectStorageEmulator(storage, host, 9199);
  console.log(`[firebase] using emulators at ${host}`);
}
