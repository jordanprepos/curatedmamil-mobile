import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Downscaling and re-encoding for product photos, run just before upload.
 *
 * The picker already asks for `quality: 0.8`, but that only re-encodes — it
 * never resizes, so a modern phone still hands over a ~3000x4000 frame of a few
 * megabytes, and on web the picker's `quality` is ignored entirely. Capping the
 * long edge is what actually shrinks the payload, and it costs nothing visible:
 * neither this dashboard nor the customer-facing catalogue ever displays a
 * handbag larger than `MAX_EDGE`.
 *
 * It matters more here than in most apps because the bucket lives in `US-EAST1`
 * while the buyers are in Indonesia (see CLAUDE.md). A bucket's location is
 * permanent, so trimming the bytes is the cheapest lever on that round trip —
 * and it speeds up the owner's own upload on mobile data, which is the part that
 * currently races `UPLOAD_TIMEOUT_MS`.
 */

/**
 * Longest edge kept, in pixels. Comfortably above any display size in either
 * app, so the downscale is invisible while still cutting a 12MP photo by ~10x.
 */
const MAX_EDGE = 1600;

/**
 * JPEG quality. Below roughly 0.75 the artefacts start showing on exactly the
 * details a resale buyer zooms in on — leather grain, stitching, hardware.
 */
const COMPRESS = 0.82;

export type PreparedImage = {
  /** Local URI to upload — the compressed copy, or the original on fallback. */
  uri: string;
  /** Set only when we re-encoded and therefore know the type for certain. */
  contentType?: string;
};

/**
 * Returns a smaller copy of `localUri`, or the original if anything goes wrong.
 *
 * Never rejects, by design. Compression is an optimisation, not a precondition:
 * an unusual colour profile, a HEIC the encoder dislikes, or a `blob:` URI the
 * web canvas refuses should cost the owner a slower upload, not a failed save.
 * The caller keeps its existing content-type detection for that fallback path.
 */
export async function compressForUpload(localUri: string): Promise<PreparedImage> {
  try {
    // Rendering with no actions queued just decodes the image, which is what
    // exposes its dimensions — `resize` alone would happily upscale a photo
    // that is already small, producing a *bigger* file for no extra detail.
    const loaded = await ImageManipulator.manipulate(localUri).renderAsync();
    const longEdge = Math.max(loaded.width, loaded.height);

    /*
      Re-reads from `localUri` rather than passing `loaded` straight back in.
      `manipulate` does accept a SharedRef, which would save this second decode,
      but that overload is the less-travelled input path and this is the branch
      doing all of the actual resizing — if it ever breaks, the catch below turns
      the whole feature into a silent no-op. A decode costs a fraction of a
      second; the upload it shrinks costs far more.
    */
    const source =
      longEdge > MAX_EDGE
        ? await ImageManipulator.manipulate(localUri)
            // Only ever constrain the long edge; the other is derived, which is
            // what keeps the aspect ratio intact for portrait and landscape alike.
            .resize(
              loaded.width >= loaded.height ? { width: MAX_EDGE } : { height: MAX_EDGE },
            )
            .renderAsync()
        : loaded;

    const out = await source.saveAsync({ compress: COMPRESS, format: SaveFormat.JPEG });
    return { uri: out.uri, contentType: 'image/jpeg' };
  } catch (e) {
    /*
      Deliberately noisy, unlike `deleteProductImage`'s silent swallow. There,
      nothing is lost when it fails; here the entire optimisation is, and the
      upload still succeeds — so without this line a broken encoder, or a build
      missing the native module, is indistinguishable from a working compress.
    */
    console.warn('[compressForUpload] falling back to the original photo', e);
    return { uri: localUri };
  }
}
