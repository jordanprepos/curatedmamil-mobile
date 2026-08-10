# Mami L — Seller Dashboard

This is a website for my mom's small personal business. She resells handbags and takes
every order herself over WhatsApp, so the site isn't a store — there's no cart, no
checkout, no payment processing. Its whole job is to show what's in stock and make it
effortless for a customer to start a chat about a specific bag, with the name and price
already written into the message.

This repository is the **owner-facing half** of that: the dashboard Mami L uses to keep
the catalog current and handle the orders those chats turn into. She adds and prices
bags, flips them between Aktif / Terjual / Arsip as they move, and replies to each buyer
from her phone. Everything a customer sees is driven by what she does here.

Built with Expo / React Native and backed by Firebase. Ported from the Claude Design
mockup `Mami L Dashboard App.dc.html`, whose layout, palette and copy it follows closely.

**The entire interface is in Indonesian.** This is deliberate — it matches the source
design and the shop's actual customers. There is no i18n layer and no English fallback.

---

## Contents

- [Quick start](#quick-start)
- [Screens](#screens)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Design system](#design-system)
- [Firebase](#firebase)
- [Pointing the app at a different Firebase project](#pointing-the-app-at-a-different-firebase-project)
- [Scripts](#scripts)
- [Known limits](#known-limits)
- [Divergences from the mockup](#divergences-from-the-mockup)
- [Troubleshooting](#troubleshooting)

---

## Quick start

```bash
npm install
npx expo start
```

Then scan the QR code with **Expo Go** on your phone, or press `w` to open it in a browser.

You will need a `.env` file — copy `.env.example` and fill in the Firebase values (see
[Firebase](#firebase) below). Without it the app throws on startup with a clear message.

> **The iOS Simulator is not available on this machine.** It needs a full Xcode install;
> only the Command Line Tools are present, so `npx expo start --ios` will fail. Expo Go on
> a real device and `--web` both work.

### Stack

| | |
|---|---|
| Runtime | Expo SDK 57, React Native 0.86, React 19.2 |
| Routing | `expo-router` (file-based) |
| Backend | Firebase JS SDK v12 — Firestore, Auth, Storage |
| Fonts | Jost (UI) + Playfair Display (display), via `@expo-google-fonts` |
| Language | TypeScript, `strict: true` |

---

## Screens

| Route | Screen | What it does |
|---|---|---|
| `app/masuk.tsx` | **Masuk** | Owner sign-in. Email + password, session persisted across restarts. |
| `app/(tabs)/index.tsx` | **Dasbor** | Live search, status filter tabs with live counts, product cards, new-order badge. |
| `app/(tabs)/produk.tsx` | **Semua Produk** | Flat list of the whole catalog. |
| `app/(tabs)/produk/[id].tsx` | **Detail Produk** | Tandai Terjual / Arsipkan Produk. |
| `app/(tabs)/tambah.tsx` | **Produk Baru** | Create a product; pick a photo or paste a URL. |
| `app/(tabs)/pesanan.tsx` | **Pesanan** | Reply on WhatsApp, mark orders Selesai. |
| `app/(tabs)/lainnya.tsx` | **Ringkasan** | Month stats, revenue, shop settings, Keluar. |

### Interactions worth knowing

- **Search** filters by product name, case-insensitive and trimmed.
- **Status tabs** filter by status; `Semua` matches everything. Counts are live.
- **"Atur"** resets *both* the search query and the tab — this mirrors the mockup's
  `onClear`, and is easy to mistake for a settings button.
- **Empty state** shows `Tidak ada produk yang cocok.` when nothing matches.
- **"Balas di WhatsApp"** opens `wa.me` prefilled with
  `Halo {buyer}, terima kasih atas pesanan {item}.`
- **"Keluar"** on Ringkasan signs out and returns to Masuk.

---

## Project structure

```
app/                          expo-router routes — the file tree IS the navigation
  _layout.tsx                 fonts + SafeAreaProvider + AuthProvider + splash gate
  masuk.tsx                   login (outside the tab group)
  (tabs)/
    _layout.tsx               Tabs navigator + ShopDataProvider
    index.tsx                 Dasbor
    produk.tsx                Semua Produk
    produk/[id].tsx           Detail Produk — href: null, hidden from the bar
    tambah.tsx                Produk Baru
    pesanan.tsx               Pesanan
    lainnya.tsx               Ringkasan

src/
  theme/
    tokens.ts                 colours, radii, shadow, status palettes, enums
    text.tsx                  <Txt> / <Display> / <Label> font wrappers + fontMap
  lib/
    firebase.ts               app init, auth persistence, db, storage, emulator hookup
    auth.tsx                  AuthProvider, useAuth, Indonesian error messages
    format.ts                 rupiah formatting, month helpers, initials
    storage.ts                product photo upload
  data/
    store.tsx                 ShopDataProvider — one set of Firestore listeners
    products.ts               subscribe / add / setStatus / search / filter
    orders.ts                 subscribe / setOrderState / countNewOrders
    shop.ts                   shop/config document
  components/                 StatusPill, PillButton, Chip, Card, Field,
                              ProductImage, TabBar

firebase/
  firestore.rules             owner-only access rules
  storage.rules               same gate, for product photos
  firestore.indexes.json
  seed.mjs                    provisions the owner account + seeds the catalog

app.config.ts                 Expo config (replaces app.json)
.env / .env.example           Firebase web config
```

---

## Architecture

### Navigation

`expo-router` maps the `app/` directory onto routes. Two details are non-obvious:

**Detail Produk lives inside the tab group.** In the mockup the tab bar renders outside
every screen conditional, so it stays visible on the detail view. Registering
`produk/[id]` as a `Tabs.Screen` with `href: null` keeps the bar on screen while still
giving Detail a real push/pop — it's hidden from the bar, not from the navigator.

**The tab bar is fully custom** ([TabBar.tsx](src/components/TabBar.tsx)). The default bar
can't render the raised centre `+`. The implementation deserves a note: the circle
overhangs the bar by 22px, and Android clips children that escape their parent's bounds.
So instead of `overflow: visible`, the bar renders a transparent 22px strip on top with
`pointerEvents="box-none"`, and paints its white surface as an absolutely-positioned
child below that strip. Nothing is ever clipped, and touches in the transparent strip
still reach the screen behind it.

### Auth

`AuthProvider` wraps the app and exposes `{ user, ready, masuk, keluar }`. `AuthGate` in
the root layout redirects to `/masuk` when signed out and to `/` when signed in.

The splash screen is held until **both** fonts and auth state have resolved, so an
already-signed-in owner never sees the login screen flash on launch.

Persistence is platform-split in [firebase.ts](src/lib/firebase.ts). `firebase/auth` is
`export * from '@firebase/auth'`, and that package declares a `react-native` export
condition — so under Metro it resolves to the RN build, the only one exporting
`getReactNativePersistence`. On web that symbol doesn't exist, hence:

```ts
Platform.OS === 'web' ? browserLocalPersistence : getReactNativePersistence(AsyncStorage)
```

Without this the session is silently lost on every app restart.

### Data flow

All three Firestore listeners live in one place — `ShopDataProvider`
([store.tsx](src/data/store.tsx)) — mounted in the tab layout. Screens call `useShopData()`
rather than subscribing individually, so switching tabs doesn't tear down and re-establish
snapshots.

Because everything is a live `onSnapshot`, a status change on Detail is reflected on
Dasbor instantly, and edits made in the Firebase console appear without a reload.

**Search, filtering and sorting are all client-side.** The catalog is small, it mirrors
the mockup's behaviour exactly, and it avoids composite indexes. Sorting is client-side
for a second, subtler reason: `addProduct` writes `serverTimestamp()`, so the optimistic
local echo carries `createdAt: null` until the server round-trips. A Firestore
`orderBy('createdAt')` would drop that document from the snapshot, and the owner would
watch a product they just saved fail to appear — reading as "save failed". Sorting in
`subscribeProducts` puts pending writes at the top instead.

---

## Design system

Tokens are defined once in [tokens.ts](src/theme/tokens.ts) and taken verbatim from the
mockup. Don't invent new colours.

```
primary #A07D77   primaryPressed #8E6B65   ink     #2B2320
bgApp   #FBF7F4   bgPage         #F3EBE6   surface #FFFFFF   chip #F1E9E4
muted   #8C7D75   faint          #A9998F   subtle  #6B5C55
border  #E5D9D3   divider        #F0E6E0   placeholder #B6A79F
```

| Status | Background | Text |
|---|---|---|
| Aktif | `#E8F1E9` | `#4F7D5E` |
| Ditahan | `#E7EEF6` | `#5A7CA0` |
| Terjual | `#FBF0DC` | `#A87A2C` |
| Arsip | `#F0EDEB` | `#8C7D75` |
| Draf | `#F0EDEB` | `#8C7D75` |

| Order state | Background | Text |
|---|---|---|
| Baru | `#F1E4E2` | `#A07D77` |
| Dikirim | `#E7EEF6` | `#5A7CA0` |
| Selesai | `#E8F1E9` | `#4F7D5E` |

Radii: cards `18`, inputs and thumbnails `14`, row thumbnails `12`, pills `999`.
Shadow: `0 1px 3px rgba(43,35,32,0.06)`, split across iOS `shadow*`, Android `elevation`
and web `boxShadow`.

### Typography

React Native's `Text` does not inherit `fontFamily`, so every piece of copy has to name
its face. Rather than repeat that everywhere, use the wrappers from
[text.tsx](src/theme/text.tsx):

```tsx
<Txt size={13} weight={500}>Elara Tote</Txt>     // Jost — UI
<Display size={22}>Mami L</Display>              // Playfair — wordmark, product names
<Label>NAMA PRODUK</Label>                       // small all-caps field label
```

Jost ships at weights 300/400/500/600; Playfair at 500/600. `tracking` is expressed in
em, matching the mockup's CSS.

### Safe areas

The mockup hardcodes `padding-top: 62px` on every screen — that exists purely to clear a
*drawn* iOS status bar in the prototype's device frame. The real app uses
`useSafeAreaInsets()`. **Never hardcode 62.**

---

## Firebase

The app points at **`mamiel-project`** — `.env` for the client, `.firebaserc` for the CLI.
Keep those two in sync; if they drift, the app reads from one project while
`firebase deploy` pushes rules to another, which fails in confusing ways.

The Firestore database lives in `asia-southeast2` (Jakarta), closest to the shop.

### Data model

```
products/{id}   name: string
                price: number        integer rupiah — NOT a display string
                sku: string
                status: 'Aktif' | 'Ditahan' | 'Terjual' | 'Arsip' | 'Draf'
                cat: 'Tote' | 'Selempang' | 'Clutch' | 'Bahu'
                imageUrl?: string
                createdAt, updatedAt, soldAt?: Timestamp

orders/{id}     buyer: string
                itemName: string
                price: number
                state: 'Baru' | 'Dikirim' | 'Selesai'
                phone?: string       international format, no '+'
                createdAt: Timestamp

shop/config     whatsappNumber: string
                shopName: string

owners/{uid}    email, grantedAt    — marker document, see below
```

Prices are stored as integers and formatted by [format.ts](src/lib/format.ts). The mockup
carried them as display strings (`"Rp 2.850.000"`); integers are needed for sorting and
revenue maths. Grouping is done by hand rather than via `Intl`, because Hermes ships a
trimmed ICU and locale support varies by platform.

### Access control

Every read and write is gated on the presence of an `owners/{uid}` document:

```
function isOwner() {
  return request.auth != null
    && exists(/databases/$(database)/documents/owners/$(request.auth.uid));
}
```

The marker approach — rather than a hardcoded UID — means access can be granted or revoked
from the Firebase console without a rules deploy. The `owners` collection itself is never
client-writable.

`storage.rules` mirrors this cross-service via `firestore.exists()`, and additionally caps
uploads at 8 MB and requires an `image/*` content type.

```bash
npx firebase-tools deploy --only firestore
```

That cross-service call needs its own IAM grant: the Cloud Storage for Firebase service
agent (`service-{PROJECT_NUMBER}@gcp-sa-firebasestorage.iam.gserviceaccount.com`) must hold
`roles/firebaserules.firestoreServiceAgent`, whose sole permission is
`datastore.entities.get`. Deploying the storage rules prompts to grant it:

```bash
npx firebase-tools deploy --only storage
```

Skip that prompt and every upload fails — see [Troubleshooting](#troubleshooting).

### Seeding

[`firebase/seed.mjs`](firebase/seed.mjs) provisions the owner account and loads the
mockup's five products and four orders. It uses Application Default Credentials, so the
signed-in account must be an owner of the project:

```bash
gcloud auth application-default login
```

```bash
GOOGLE_CLOUD_QUOTA_PROJECT=mamiel-project FIREBASE_PROJECT_ID=mamiel-project \
OWNER_EMAIL=you@example.com OWNER_PASSWORD='…' npm run seed
```

The script is idempotent — products and orders use fixed document IDs, and an existing
owner account is reused (with its password reset). Pass `SKIP_OWNER=1` to seed catalog
data only, which is what you want before Email/Password auth has been enabled.

`GOOGLE_CLOUD_QUOTA_PROJECT` matters: without it, ADC bills Identity Toolkit calls to
whatever project your gcloud default is, and the seed fails with a confusing
"API has not been used in project …" error naming a project you've never heard of.

---

## Pointing the app at a different Firebase project

1. **Get the config.** `npx firebase-tools apps:sdkconfig web --project YOUR_PROJECT_ID`
   (if no web app exists yet: `npx firebase-tools apps:create web "Mami L Dashboard" --project YOUR_PROJECT_ID`)
2. **Paste the six values into `.env`.** They map 1:1 — `apiKey` → `EXPO_PUBLIC_FIREBASE_API_KEY`, etc.
3. **Point the CLI at it too:** `npx firebase-tools use YOUR_PROJECT_ID`
4. **Restart with a cleared cache:** `npx expo start --clear`

Step 4 is not optional. Expo inlines `EXPO_PUBLIC_*` variables at build time, so a plain
restart keeps serving the old project's config.

The target project also needs **Firestore enabled**, **Email/Password sign-in enabled**
(Console → Authentication → Sign-in method), the rules deployed, and an owner account
seeded — without the `owners/{uid}` document every read returns `permission-denied`.

If the project already holds live data, check that your collections match the schema
above. If they differ, [products.ts](src/data/products.ts) and
[orders.ts](src/data/orders.ts) are where to adapt the mapping.

---

## Scripts

| Command | What it does |
|---|---|
| `npx expo start` | Dev server — Expo Go, or `w` for web |
| `npx expo start --clear` | Same, clearing the Metro cache (needed after `.env` changes) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | Seed the live project (see above for required env vars) |
| `npm run emulators` | Local Auth + Firestore — **requires JDK 21+** |
| `npm run seed:emulator` | Seed the emulators instead of production |

### Environment variables

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_FIREBASE_*` | Six values from the Firebase web config. Required. |
| `EXPO_PUBLIC_USE_FIREBASE_EMULATOR` | Set to `1` to use local emulators. Off by default. |
| `EXPO_PUBLIC_EMULATOR_HOST` | Defaults to `localhost`; set to your LAN IP for Expo Go. |

The Firebase web config is **not secret** — it ships in every client, and the security
rules are the real boundary. `.env` is still gitignored so each environment can point at
its own project.

---

## Known limits

- **Product photo upload requires the Blaze plan.** Cloud Storage buckets are not
  provisioned on the free Spark tier, so `uploadProductImage` fails until billing is
  enabled. This project is on Blaze and upload works; the Tambah screen's **URL FOTO**
  field is not in the original mockup and was added to cover the Spark-plan gap. It is
  kept as a fallback for when the owner already has a hosted image.
- **The Firestore emulator needs JDK 21+**; this machine has JDK 8, so `npm run emulators`
  will fail until a newer JDK is installed (`brew install openjdk@21`). Everything else
  runs against the live project and is unaffected.
- **No iOS Simulator** without a full Xcode install.
- **`Draf` status** appears only on the Tambah screen in the mockup and has no colour pair
  of its own — it reuses the `Arsip` palette.
- **Firestore over React Native** occasionally needs `experimentalForceLongPolling` when
  streaming won't connect. Apply it only if snapshots hang; it is not set by default.

---

## Divergences from the mockup

These are deliberate. The mockup was an interactive prototype, not a spec for a networked
app — but each of these is worth knowing before you "fix" one.

1. **The login screen is new.** The prototype had no auth at all.
2. **`goBack` is a real stack pop.** The mockup always returned to Dasbor because it had
   no navigation stack.
3. **All counts are live.** The mockup hardcoded 42 / 28 / 10 / 4 products, a `3` order
   badge, and `Rp 24.850.000` revenue — figures that didn't even match its own five items.
   They now derive from Firestore.
4. **Prices are integers.** See [Data model](#data-model).
5. **Safe areas replace `padding-top: 62px`.**
6. **`Ubah` on the Dasbor card is not a separate control.** The whole card is tappable and
   opens Detail; the label is retained from the mockup's visual design.
7. **The Tambah screen has a URL FOTO field** the mockup didn't have — see
   [Known limits](#known-limits).
8. **`Tandai Terjual` keeps you on Detail** so the status pill visibly changes.
   `Arsipkan Produk` pops back to Dasbor, matching the mockup's `archive`.

The mockup's own scaffolding — `ios-frame.jsx` (device bezel, dynamic island, drawn status
bar) and `image-slot.js` (a drag-and-drop placeholder backed by a JSON sidecar in the
Claude Design runtime) — is **not** ported. The OS provides the first;
[ProductImage.tsx](src/components/ProductImage.tsx) replaces the second with a real image
plus a monogram fallback.

---

## Troubleshooting

**Blank screen on launch, no error.** The splash gate is waiting on fonts or auth state.
Check the console for a font-loading failure.

**`permission-denied` on every read.** The signed-in account has no `owners/{uid}`
document. Run the seed, or add the document by hand in the console.

**Photo upload fails with `403 Permission denied` while everything else works.** The
cross-service IAM grant behind `storage.rules`' `isOwner()` is missing, so
`firestore.exists()` can't resolve and the rule evaluates false — for the `uploadBytes`
write and the `getDownloadURL` that follows it. Already-minted `imageUrl` links keep
working, since download tokens bypass rules, and Firestore itself is unaffected, since its
own `exists()` is in-service and needs no grant. Confirm with
`gcloud projects get-iam-policy <project>`: the Storage service agent should hold
`roles/firebaserules.firestoreServiceAgent`. Fix by re-running
`npx firebase-tools deploy --only storage` and accepting the permission prompt — see
[Access control](#access-control). Note the rules text alone looks correct either way, so
diffing deployed rules against the repo proves nothing here.

**`CONFIGURATION_NOT_FOUND` on sign-in.** Email/Password sign-in has never been enabled on
the project. Console → Authentication → Get started → Email/Password → Enable. There is no
free API path for this; the console toggle is required.

**`.env` changes have no effect.** Restart with `npx expo start --clear`.

**Login doesn't persist across restarts.** `initializeAuth` didn't get the right
persistence — see [Auth](#auth). Check that `getReactNativePersistence` resolved.

**A newly added product doesn't appear on Dasbor.** Should not happen; see the sorting
note in [Data flow](#data-flow). If it recurs, check that `subscribeProducts` still sorts
client-side rather than via `orderBy`.
