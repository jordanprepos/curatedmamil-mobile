# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Expo has changed

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any Expo code — this project pins Expo SDK 57, and generic/older Expo knowledge is frequently wrong for this version.

## What this is

Owner-facing dashboard for a small handbag resale business run entirely over WhatsApp (no cart, no checkout, no payments). The owner uses this app to manage the catalog and orders; a separate customer-facing site (not in this repo) is what buyers see. **The entire UI is in Indonesian** — deliberate, no i18n layer, no English fallback. Ported from a Claude Design HTML mockup (`Mami L Dashboard App.dc.html`), whose layout/palette/copy it follows closely — see [Divergences from the mockup](README.md#divergences-from-the-mockup) in the README for the intentional deltas.

Stack: Expo SDK 57, React Native 0.86, React 19.2, `expo-router` (file-based routing), Firebase JS SDK v12 (Firestore, Auth, Storage), TypeScript strict mode.

## Commands

```bash
npm install
npx expo start              # dev server — Expo Go, or `w` for web
npx expo start --clear      # same, clearing Metro cache (required after .env changes)
npm run typecheck           # tsc --noEmit — no separate lint script exists
npm run emulators           # local Auth + Firestore emulators — requires JDK 21+
npm run seed                # seed the live project (see README "Seeding" for required env vars)
npm run seed:emulator       # seed the emulators instead
npm run add-owner           # grant one person access (Auth account + owners/{uid} doc) — see README "Adding an owner"
                             # don't use `seed` for this: it unconditionally overwrites the demo catalog/orders
```

There is no test suite and no lint script in this repo — `npm run typecheck` is the only automated check. No iOS Simulator is available on this machine (needs full Xcode); use Expo Go on a real device or `npx expo start --web`.

Expo Go on the device must be an **SDK 57** build. The Play Store one often isn't — store releases lag SDK releases — and an older Expo Go rejects the project outright with "Project is incompatible with this version of Expo Go". Install it via `npx expo start --android` (USB debugging on), Orbit, or `expo.dev/go`; the store build can later overwrite it, since both share the package id `host.exp.exponent`. See the README's [Troubleshooting](README.md#troubleshooting) entry — don't treat this as a bug in the app.

## Architecture

### Navigation
`expo-router` maps `app/` onto routes. `app/(tabs)/produk/[id].tsx` (Detail Produk) is registered as a `Tabs.Screen` with `href: null` — this keeps the custom tab bar visible on the detail screen (matching the mockup) while still giving it a real push/pop, without appearing as its own tab. The tab bar itself is fully custom ([src/components/TabBar.tsx](src/components/TabBar.tsx)) to render a raised centre `+` button that overhangs the bar by 22px; see the README's Navigation section for why it's built with a transparent hit-testing strip rather than `overflow: visible`.

### Auth
`AuthProvider` ([src/lib/auth.tsx](src/lib/auth.tsx)) wraps the app and exposes `{ user, ready, masuk, keluar }`; `AuthGate` in `app/_layout.tsx` redirects between `/masuk` and `/` based on sign-in state. The splash screen holds until both fonts and auth state resolve. Auth persistence is platform-split in [src/lib/firebase.ts](src/lib/firebase.ts): `getReactNativePersistence(AsyncStorage)` on native, `browserLocalPersistence` on web — this split exists because `firebase/auth`'s `react-native` export condition only exposes `getReactNativePersistence` under Metro, and the symbol doesn't exist on web. Don't "simplify" this to one branch.

### Data flow
All Firestore listeners live in one place, `ShopDataProvider` ([src/data/store.tsx](src/data/store.tsx)), mounted once in the tab layout. Screens read via `useShopData()` instead of subscribing individually, so tab switches don't tear down/re-establish snapshots. Search, filtering, and sorting are all **client-side** (small catalog, avoids composite indexes, matches mockup behaviour exactly). Sorting in particular must stay client-side in `subscribeProducts`: `addProduct` writes `serverTimestamp()`, so a just-created product has `createdAt: null` in its optimistic local echo until the server round-trips — an `orderBy('createdAt')` would drop it from the snapshot and make a successful save look like it failed.

### Writes
Firestore's `addDoc`/`setDoc`/`updateDoc` promises apply to the local cache immediately but only *settle* once the server acknowledges — if the SDK can't reach the backend, that promise never resolves or rejects, so an `await` on it leaves a screen's `busy` flag stuck with no error. `withWriteTimeout` in [src/lib/write.ts](src/lib/write.ts) races each write against a 12s timer and `writeErrorMessage` turns the result into Indonesian copy; every screen that writes (Detail Produk, Tambah, Pesanan, Ringkasan) goes through both rather than awaiting the SDK call directly.

### Data model (Firestore)
```
products/{id}   name, price (integer rupiah, NOT a display string),
                sku (generated by `nextSku`, never typed — read-only on Tambah),
                status: Aktif | Ditahan | Terjual | Arsip | Draf
                cat: Tote | Selempang | Clutch | Bahu
                imageUrl? (the cover, = imageUrls[0]), imageUrls? (all photos,
                cover first — read both through `productImages`, old docs have
                only imageUrl), createdAt, updatedAt, soldAt?
orders/{id}     buyer, itemName, price,
                state: Baru | Dikirim | Selesai | Dibatalkan,
                stateBeforeCancel? (set only while Dibatalkan),
                phone? (international format, no '+'), createdAt
shop/config     whatsappNumber, shopName
owners/{uid}    email, grantedAt  — presence of this doc IS the authorization
```
Rupiah grouping in [src/lib/format.ts](src/lib/format.ts) is done by hand rather than `Intl.NumberFormat` — Hermes ships a trimmed ICU and locale support varies by platform. Don't "simplify" it to `Intl`.
Every Firestore/Storage rule gates on `exists(/databases/$(database)/documents/owners/$(request.auth.uid))` — access is granted/revoked by adding/removing that marker doc (e.g. via console), not by editing rules. The `owners` collection is never client-writable. `storage.rules` mirrors this and additionally caps uploads at 8 MB / requires `image/*`.

### Orders
Pesanan groups orders into four fixed status groups (`Baru`/`Dikirim`/`Selesai`/`Dibatalkan`), hiding empty ones. **Cancellation is a state on the document, not component state** — `cancelOrder` writes `state: 'Dibatalkan'` plus `stateBeforeCancel`, and `restoreOrder` puts the old value back and clears the field. Don't "simplify" this to a local `cancelledOrders` map: `countNewOrders` (and the Dasbor bag badge through it) reads `state`, so a client-side flag would leave a cancelled order still counted as new, and the cancellation would not survive a restart or reach another device. Only `confirmCancelId` is local, and the confirm panel is dismissed *after* the write settles so a failed cancel doesn't look successful. Cards move between groups on the optimistic local echo — no overlay state needed. `orders` is owner-only with no field validation, so widening `OrderState` needed no rules change. See the README's [Orders: grouping and cancellation](README.md#orders-grouping-and-cancellation).

### SKU generation
The owner never types a SKU: Tambah renders it read-only and `nextSku(products)` ([src/data/products.ts](src/data/products.ts)) returns the highest `CBML-<n>` in the catalog plus one, padded to 3 and widening past `CBML-999`. Numbering is flat across categories (the seed runs `CBML-001`…`005` over all four, and a product's category can change while its SKU must not); non-matching SKUs are skipped, and the prefix match is case-insensitive so a hand-entered `cbml-006` isn't reused.

Tambah gates the SKU on `productsReady`, **not** `loading` — `loading` also waits on the orders listener this screen never reads, and a Firestore listener that errors never recovers, so a dead orders listener would block Simpan forever. `productsReady` exists on `ShopData` for this. Don't drop the gate either: `nextSku([])` restarts at `CBML-001` and collides with the live catalog. The value is captured once per `save()` because it also names the uploaded photo objects, and that batch can run for minutes. Uniqueness is not enforced anywhere and deliberately so — see the README's [SKU generation](README.md#sku-generation).

### Design system
Colors, radii, shadows, and status/order-state palettes are defined once in [src/theme/tokens.ts](src/theme/tokens.ts), taken verbatim from the mockup — don't invent new colors. React Native `Text` doesn't inherit `fontFamily`, so all copy must go through the wrappers in [src/theme/text.tsx](src/theme/text.tsx) (`<Txt>` Jost/UI, `<Display>` Playfair/wordmark & product names, `<Label>` small all-caps). Use `useSafeAreaInsets()` for top spacing — never hardcode the mockup's `padding-top: 62px`, which only existed to clear a *drawn* status bar in the HTML prototype's device frame.

## Firebase project

An **EAS build has no `.env`** — it's gitignored, so it never reaches the builder, and both `eas.json` profiles resolve `EXPO_PUBLIC_FIREBASE_*` from EAS-hosted environment variables that must be created first (`eas env:create`). Nothing warns you: the build succeeds and the app throws `Firebase config missing` on launch. See the README's [Building with EAS](README.md#building-with-eas).

Points at `mamiel-project` (`asia-southeast2`/Jakarta) via `.env` (client) and `.firebaserc` (CLI) — **keep these two in sync**; drift means the app reads from one project while `firebase deploy` pushes rules to another. To point at a different project or diagnose `permission-denied` / `CONFIGURATION_NOT_FOUND` / persistence issues, see the README's [Pointing the app at a different Firebase project](README.md#pointing-the-app-at-a-different-firebase-project) and [Troubleshooting](README.md#troubleshooting) sections — both are detailed and current, don't re-derive from scratch.

### Cloud Storage

The project is on the Blaze plan and Cloud Storage is provisioned: bucket `mamiel-project.firebasestorage.app`, deployed via the `"storage"` block in `firebase.json`. Product photo upload works — verified end-to-end on 2026-08-10.

`storage.rules`' `isOwner()` calls `firestore.exists()` **cross-service**, which needs an IAM grant separate from the rules themselves: the Storage service agent (`service-481440432212@gcp-sa-firebasestorage.iam.gserviceaccount.com`) must hold `roles/firebaserules.firestoreServiceAgent`. Without it every upload returns a bare `403 Permission denied` while Firestore keeps working, because Firestore's own `exists()` is in-service. The grant is in place now; `npx firebase-tools deploy --only storage` prompts for it if a fresh project ever needs it. Don't debug this by diffing deployed rules against the repo — the rules read as correct in both states. The Tambah screen's URL FOTO field predates this — it was the Spark-plan workaround — and is kept as a fallback for when the owner already has a hosted image.

The bucket is in **`US-EAST1`, not `asia-southeast2`** where Firestore lives. This is deliberate, chosen for development and testing; a bucket's location is permanent, so correcting it means creating a second bucket and targeting it explicitly (`"storage": [{ "bucket": ..., "rules": ... }]`). Don't report the mismatch as a bug — but it is worth revisiting before real buyers in Indonesia depend on image load times.

The size/contentType conditions sit on `allow create, update`, **not** `allow write` — a delete carries no `request.resource`, so a single `write` rule denies every delete. `Hapus Produk` (Detail Produk) depends on the separate `allow delete`. When touching `storage.rules`, re-verify *upload* as well as delete: `create` now governs the upload path.

Deleting a product's photos never uses `ref(storage, imageUrl)` — that helper also resolves `storage.googleapis.com/<any-bucket>/<path>`, so a URL pasted into the URL FOTO field could address someone else's bucket. `deleteProductImage` ([src/lib/storage.ts](src/lib/storage.ts)) parses the URL against the configured bucket instead, and the caller skips any URL another product still displays — compared against the union of `productImages(p)` over every other product, not their covers alone, since one product's cover can be another's third gallery photo.

Products carry a gallery (`imageUrls`, cap 8 on Tambah) with `imageUrl` kept alongside it as the cover, because the separate customer-facing site reads `imageUrl` and knows nothing about galleries. Never drop or rename `imageUrl`. Old documents have only `imageUrl` (the seeded demo catalog has no photo field at all and falls through to the monogram); `productImages()` in [src/data/products.ts](src/data/products.ts) is the entire migration — there is no backfill, so read photos through it. Uploads are sequential with a per-photo timeout, object names carry a counter as well as `Date.now()` (a batch collides within one millisecond otherwise), and a failed upload aborts the save after best-effort deleting whatever already landed.

Every upload is downscaled first by `compressForUpload` ([src/lib/image.ts](src/lib/image.ts)), called from inside `uploadProductImage` so no call site can skip it: the long edge is capped at 1600px and the result re-encoded as JPEG at `compress: 0.82`. The picker's own `quality: 0.8` is **not** a substitute — it only re-encodes, never resizes, and web ignores it entirely. This is also the cheapest mitigation available for the US-EAST1-bucket/Indonesian-buyers round trip described above, since a bucket's location is permanent. Compression is best-effort and falls back to the original URI, so a photo the encoder rejects still uploads — but the fallback `console.warn`s on purpose (unlike `deleteProductImage`'s silent swallow), because a silent fallback is indistinguishable from a working compress and would quietly restore full-size uploads. Note it forces JPEG, which flattens alpha: a PNG with transparency gets a black background. `allowsEditing` is gone from the picker: `expo-image-picker` ignores it once `allowsMultipleSelection` is on. See the README's [Product photos](README.md#product-photos). `Ubah` on Detail Produk is still a stub that pushes `/tambah` without loading the product, so photos can only be set at creation.

`storage.rules` gates reads on `isOwner()`, which looks like it would break the customer-facing site. It doesn't: `getDownloadURL()` returns a tokenized URL, and download tokens bypass rules — so `imageUrl` stays publicly viewable while direct bucket access stays owner-only.
