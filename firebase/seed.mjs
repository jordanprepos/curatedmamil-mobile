/**
 * Seeds the Mami L dashboard with the catalog from the original design mockup
 * (`Mami L Dashboard App.dc.html`) and provisions the owner account.
 *
 * Runs with Application Default Credentials — the account must be an owner of
 * the Firebase project. Set them up once with:
 *
 *   gcloud auth application-default login
 *
 * Usage:
 *   OWNER_EMAIL=you@example.com OWNER_PASSWORD='…' node firebase/seed.mjs
 *
 * Idempotent: products and orders are written with fixed document IDs, and the
 * owner account is reused if it already exists.
 */
import { cert, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'curated-mamil';
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;

/**
 * Set SKIP_OWNER=1 to seed catalog data only. Useful before Firebase
 * Authentication has been switched on for the project — creating the owner
 * account fails with CONFIGURATION_NOT_FOUND until a sign-in provider has been
 * enabled once in the console (Authentication -> Get started).
 */
const SKIP_OWNER = process.env.SKIP_OWNER === '1';

if (!SKIP_OWNER && (!OWNER_EMAIL || !OWNER_PASSWORD)) {
  console.error('Set OWNER_EMAIL and OWNER_PASSWORD, or pass SKIP_OWNER=1.');
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

// ── Catalog, lifted verbatim from the mockup's ITEMS array ──────────────────
// Prices become integers here; the mockup carried them as display strings.
const PRODUCTS = [
  { id: 'elara',   name: 'Elara Tote',           price: 2850000, sku: 'CBML-001', status: 'Aktif',   cat: 'Tote' },
  { id: 'selene',  name: 'Selene Crossbody',     price: 1950000, sku: 'CBML-002', status: 'Ditahan', cat: 'Selempang' },
  { id: 'aurelia', name: 'Aurelia Shoulder Bag', price: 2250000, sku: 'CBML-003', status: 'Terjual', cat: 'Bahu' },
  { id: 'luna',    name: 'Luna Tote',            price: 3150000, sku: 'CBML-004', status: 'Arsip',   cat: 'Tote' },
  { id: 'mira',    name: 'Mira Clutch',          price: 1650000, sku: 'CBML-005', status: 'Aktif',   cat: 'Clutch' },
];

// ── Orders, from the mockup's ORDERS array ──────────────────────────────────
const ORDERS = [
  { id: 'o1', buyer: 'Dina Prasetyo', itemName: 'Elara Tote',       price: 2850000, state: 'Baru' },
  { id: 'o2', buyer: 'Ayu Lestari',   itemName: 'Mira Clutch',      price: 1650000, state: 'Baru' },
  { id: 'o3', buyer: 'Rina Halim',    itemName: 'Selene Crossbody', price: 1950000, state: 'Dikirim' },
  { id: 'o4', buyer: 'Maya Utami',    itemName: 'Luna Tote',        price: 3150000, state: 'Selesai' },
];

/** Staggered so `orderBy('createdAt','desc')` reproduces the mockup's order. */
function stampedAt(indexFromTop) {
  return Timestamp.fromMillis(Date.now() - indexFromTop * 60_000);
}

async function ensureOwner() {
  let user;
  try {
    user = await auth.getUserByEmail(OWNER_EMAIL);
    await auth.updateUser(user.uid, { password: OWNER_PASSWORD });
    console.log(`• Reused existing account ${OWNER_EMAIL} (password reset)`);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    user = await auth.createUser({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      displayName: 'Mami L',
    });
    console.log(`• Created account ${OWNER_EMAIL}`);
  }

  // The marker document the security rules gate on.
  await db.doc(`owners/${user.uid}`).set(
    { email: OWNER_EMAIL, grantedAt: Timestamp.now() },
    { merge: true },
  );
  console.log(`• Granted owner access to uid ${user.uid}`);
  return user.uid;
}

async function seedFirestore() {
  const batch = db.batch();

  PRODUCTS.forEach((p, i) => {
    const { id, ...data } = p;
    batch.set(
      db.doc(`products/${id}`),
      {
        ...data,
        createdAt: stampedAt(i),
        updatedAt: stampedAt(i),
        // Scopes this sale into the current month for the Ringkasan revenue card.
        ...(data.status === 'Terjual' ? { soldAt: stampedAt(i) } : {}),
      },
      { merge: true },
    );
  });

  ORDERS.forEach((o, i) => {
    const { id, ...data } = o;
    batch.set(db.doc(`orders/${id}`), { ...data, createdAt: stampedAt(i) }, { merge: true });
  });

  batch.set(
    db.doc('shop/config'),
    { whatsappNumber: '6281234567890', shopName: 'Curated by Mami L' },
    { merge: true },
  );

  await batch.commit();
  console.log(`• Seeded ${PRODUCTS.length} products, ${ORDERS.length} orders, shop/config`);
}

if (SKIP_OWNER) {
  console.log('• Skipping owner account (SKIP_OWNER=1)');
} else {
  await ensureOwner();
}
await seedFirestore();
console.log('\nSeed complete.');
process.exit(0);
