import { imageFromPaste, readClipboardImage } from '@axe/features/file/file-storage/clipboard-image';

const PASTED_AT = new Date(2026, 8, 28, 9, 5, 7);

function pasted(...files: File[]): DataTransfer {
  return { files } as unknown as DataTransfer;
}

function clipboardWith(...items: Record<string, Blob>[]): Clipboard {
  return {
    read: () =>
      Promise.resolve(
        items.map((blobs) => ({
          types: Object.keys(blobs),
          getType: (type: string) => Promise.resolve(blobs[type]),
        }))
      ),
  } as unknown as Clipboard;
}

describe('clipboard images', () => {
  describe('imageFromPaste', () => {
    it('names a bare pasted picture after the moment it was pasted', () => {
      const result = imageFromPaste(
        pasted(new File([new Uint8Array(3)], 'image.png', { type: 'image/png' })),
        PASTED_AT
      );

      expect(result.kind).toBe('image');
      const file = result.kind === 'image' ? result.file : null;
      expect(file?.name).toBe('clipboard-20260928-090507.png');
      expect(file?.type).toBe('image/png');
      expect(file?.size).toBe(3);
    });

    it('keeps the name of a copied file', () => {
      const map = new File([new Uint8Array(3)], 'dungeon-map.jpg', { type: 'image/jpeg' });

      const result = imageFromPaste(pasted(map), PASTED_AT);

      expect(result).toEqual({ kind: 'image', file: map });
    });

    it('takes the first storable picture among several files', () => {
      const result = imageFromPaste(
        pasted(
          new File(['%PDF'], 'rules.pdf', { type: 'application/pdf' }),
          new File(['x'], 'a.webp', { type: 'image/webp' })
        ),
        PASTED_AT
      );

      expect(result.kind === 'image' && result.file.name).toBe('a.webp');
    });

    it('reports text alone as having no picture', () => {
      expect(imageFromPaste(pasted(), PASTED_AT)).toEqual({ kind: 'none' });
      expect(imageFromPaste(null, PASTED_AT)).toEqual({ kind: 'none' });
    });

    it('refuses a file that cannot be stored as a picture', () => {
      const svg = new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' });
      const pdf = new File(['%PDF'], 'rules.pdf', { type: 'application/pdf' });

      expect(imageFromPaste(pasted(svg), PASTED_AT)).toEqual({ kind: 'unsupported' });
      expect(imageFromPaste(pasted(pdf), PASTED_AT)).toEqual({ kind: 'unsupported' });
    });
  });

  describe('readClipboardImage', () => {
    it('reads a picture copied from another app into a named file', async () => {
      const bytes = new Blob([new Uint8Array(5)], { type: 'image/png' });

      const result = await readClipboardImage(
        clipboardWith({ 'text/html': new Blob(['<img>']), 'image/png': bytes }),
        PASTED_AT
      );

      expect(result.kind).toBe('image');
      const file = result.kind === 'image' ? result.file : null;
      expect(file?.name).toBe('clipboard-20260928-090507.png');
      expect(file?.size).toBe(5);
    });

    it('reports a clipboard holding only text as having no picture', async () => {
      const result = await readClipboardImage(clipboardWith({ 'text/plain': new Blob(['hello']) }), PASTED_AT);

      expect(result).toEqual({ kind: 'none' });
    });

    it('refuses a picture in a form that cannot be stored', async () => {
      const result = await readClipboardImage(clipboardWith({ 'image/svg+xml': new Blob(['<svg/>']) }), PASTED_AT);

      expect(result).toEqual({ kind: 'unsupported' });
    });

    it('reports a refused or missing clipboard as unreadable', async () => {
      const refusing = { read: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) };

      expect(await readClipboardImage(refusing as unknown as Clipboard, PASTED_AT)).toEqual({ kind: 'unreadable' });
      expect(await readClipboardImage(undefined, PASTED_AT)).toEqual({ kind: 'unreadable' });
      expect(await readClipboardImage({} as Clipboard, PASTED_AT)).toEqual({ kind: 'unreadable' });
    });
  });
});
