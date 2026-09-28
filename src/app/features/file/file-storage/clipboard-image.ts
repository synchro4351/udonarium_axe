/** Picture formats a pasted image may arrive in, each with the extension its file is named with. */
const PASTEABLE_IMAGE_TYPES: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
};

/** Whether a picture of this type can be held for a preview and stored as it is. */
export function isPasteableImage(type: string): boolean {
  return Object.hasOwn(PASTEABLE_IMAGE_TYPES, type);
}

/** What was found on the clipboard when looking for a picture to store. */
export type ClipboardImageResult =
  | { readonly kind: 'image'; readonly file: File }
  /** Nothing there that could be a picture, such as plain text. */
  | { readonly kind: 'none' }
  /** A file or picture in a form that cannot be stored as an image. */
  | { readonly kind: 'unsupported' }
  /** The browser would not let the clipboard be read, or has no way to. */
  | { readonly kind: 'unreadable' };

/**
 * Picks the picture out of what a paste event carries.
 *
 * Only the first storable picture is taken. Anything else that arrived as a file is reported as
 * unsupported, and a paste with no file at all as having no picture.
 */
export function imageFromPaste(data: DataTransfer | null, now = new Date()): ClipboardImageResult {
  const files = Array.from(data?.files ?? []);
  const image = files.find((file) => isPasteableImage(file.type));
  if (image) return { kind: 'image', file: nameClipboardImage(image, image.type, now) };
  return files.length ? { kind: 'unsupported' } : { kind: 'none' };
}

/**
 * Reads a picture from the clipboard through the asynchronous clipboard API.
 *
 * The browser may ask the user first; a refusal, or a browser without the API, comes back as
 * unreadable so the caller can suggest pasting with the keyboard instead.
 */
export async function readClipboardImage(
  clipboard: Clipboard | undefined,
  now = new Date()
): Promise<ClipboardImageResult> {
  if (typeof clipboard?.read !== 'function') return { kind: 'unreadable' };
  let items: ClipboardItems;
  try {
    items = await clipboard.read();
  } catch {
    return { kind: 'unreadable' };
  }
  let sawOtherImage = false;
  for (const item of items) {
    const type = item.types.find(isPasteableImage);
    if (!type) {
      sawOtherImage ||= item.types.some((candidate) => candidate.startsWith('image/'));
      continue;
    }
    try {
      const blob = await item.getType(type);
      return { kind: 'image', file: nameClipboardImage(blob, type, now) };
    } catch {
      return { kind: 'unreadable' };
    }
  }
  return sawOtherImage ? { kind: 'unsupported' } : { kind: 'none' };
}

/**
 * Gives a pasted picture a file name. A copied file keeps its own name, while a bare picture, which
 * browsers call just `image.png` or leave unnamed, is named after the moment it was pasted.
 */
function nameClipboardImage(blob: Blob, type: string, now: Date): File {
  const ownName = blob instanceof File ? blob.name : '';
  if (ownName && !/^image\.\w+$/i.test(ownName)) return blob as File;
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return new File([blob], `clipboard-${stamp}.${PASTEABLE_IMAGE_TYPES[type]}`, { type });
}
