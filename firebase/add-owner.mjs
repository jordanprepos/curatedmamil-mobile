/**
 * Grants a person access to the Mami L dashboard: creates their Firebase Auth
 * account if it doesn't exist, then writes the `owners/{uid}` marker document
 * the security rules actually gate on.
 *
 * Both halves matter. An Auth account alone signs in fine and then hits
 * `permission-denied` on every read, because firestore.rules and storage.rules
 * check `exists(/databases/(default)/documents/owners/$(request.auth.uid))`.
 *
 * This is deliberately NOT `seed.mjs`: that script also rewrites the five demo
 * products, four demo orders and shop/config every run, and resets the password
 * of an account that already exists. This one touches nothing but the account
 * and its marker document.
 *
 * Runs with Application Default Credentials — the account must be an owner of
 * the Firebase project. Set them up once with:
 *
 *   gcloud auth application-default login
 *
 * Usage:
 *   OWNER_EMAIL=new@example.com OWNER_PASSWORD='…' node firebase/add-owner.mjs
 *
 * There are no roles in this app. Anyone added here gets exactly the access the
 * existing owner has, including deleting products.
 *
 * Env:
 *   OWNER_EMAIL        required
 *   OWNER_PASSWORD     required unless the account already exists
 *   FIREBASE_PROJECT_ID  defaults to mamiel-project (matches .firebaserc)
 *   DRY_RUN=1          report what would change, write nothing
 *   RESET_PASSWORD=1   also reset the password of an existing account
 *
 * To revoke access later, delete the `owners/{uid}` document. The Auth account
 * can stay; without the marker it can sign in but read nothing.
 */
import { cert, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Defaults to the live project rather than seed.mjs' stale 'curated-mamil', so
// a run without FIREBASE_PROJECT_ID set can't quietly target a project that
// doesn't exist.
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'mamiel-project';
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;
const DRY_RUN = process.env.DRY_RUN === '1';
const RESET_PASSWORD = process.env.RESET_PASSWORD === '1';

if (!OWNER_EMAIL) {
  console.error(
    'Set OWNER_EMAIL (and OWNER_PASSWORD for a new account).\n\n' +
      "  OWNER_EMAIL=new@example.com OWNER_PASSWORD='…' node firebase/add-owner.mjs\n",
  );
  process.exit(1);
}

// Firebase's own minimum. Checked here so a typo fails immediately with a clear
// message instead of an auth/invalid-password error after the round-trip.
if (OWNER_PASSWORD && OWNER_PASSWORD.length < 6) {
  console.error('OWNER_PASSWORD must be at least 6 characters.');
  process.exit(1);
}

initializeApp({
  credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : applicationDefault(),
  projectId: PROJECT_ID,
});

const db = getFirestore();
const auth = getAuth();

// Named so an accidental run against the wrong project is visible before
// anything is written, not after.
console.log(`Project: ${PROJECT_ID}`);
console.log(`Email:   ${OWNER_EMAIL}`);
if (DRY_RUN) console.log('Mode:    DRY RUN — nothing will be written\n');
else console.log('');

let user = null;
try {
  user = await auth.getUserByEmail(OWNER_EMAIL);
} catch (e) {
  if (e.code !== 'auth/user-not-found') throw e;
}

if (!user && !OWNER_PASSWORD) {
  console.error(
    `No account exists for ${OWNER_EMAIL}. Set OWNER_PASSWORD to create one.`,
  );
  process.exit(1);
}

if (user) {
  console.log(`• Account exists — uid ${user.uid}`);
  // Unlike seed.mjs, an existing account keeps its password unless asked. A
  // rerun to re-grant access shouldn't silently lock someone out of the old one.
  if (RESET_PASSWORD && OWNER_PASSWORD) {
    if (DRY_RUN) console.log('• Would reset the password (RESET_PASSWORD=1)');
    else {
      await auth.updateUser(user.uid, { password: OWNER_PASSWORD });
      console.log('• Password reset (RESET_PASSWORD=1)');
    }
  } else if (OWNER_PASSWORD) {
    console.log('• Password left unchanged — pass RESET_PASSWORD=1 to change it');
  }
} else if (DRY_RUN) {
  console.log('• Would create the account');
} else {
  user = await auth.createUser({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    displayName: 'Mami L',
  });
  console.log(`• Created account — uid ${user.uid}`);
}

const uid = user?.uid;
const alreadyOwner = uid ? (await db.doc(`owners/${uid}`).get()).exists : false;

if (DRY_RUN) {
  if (!uid) console.log('• Would grant owner access to the new uid');
  else if (alreadyOwner) console.log(`• owners/${uid} already exists — would refresh it`);
  else console.log(`• Would create owners/${uid}`);
  console.log('\nDry run complete. Nothing was written.');
  process.exit(0);
}

// The marker document the security rules gate on. `merge` so a re-grant doesn't
// clobber anything added to the doc by hand.
await db.doc(`owners/${uid}`).set(
  { email: OWNER_EMAIL, grantedAt: Timestamp.now() },
  { merge: true },
);
console.log(`• ${alreadyOwner ? 'Refreshed' : 'Granted'} owner access — owners/${uid}`);

console.log('\nDone. They can sign in at the Masuk screen with that email and password.');
process.exit(0);
