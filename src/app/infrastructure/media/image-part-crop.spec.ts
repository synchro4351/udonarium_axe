import { cropImagePart } from '@axe/infrastructure/media/image-part-crop';

describe('cropImagePart', () => {
  afterEach(() => vi.restoreAllMocks());
  it('pads a narrow crop centrally without stretching its pixels', async () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement);
    const image = {} as HTMLImageElement;
    const blob = await cropImagePart(image, { name: 'Arm', x: 10, y: 20, width: 20, height: 80 });
    expect(canvas.width).toBe(80);
    expect(canvas.height).toBe(80);
    expect(drawImage).toHaveBeenCalledWith(image, 10, 20, 20, 80, 30, 0, 20, 80);
    expect(blob.type).toBe('image/png');
  });
  it('limits a large canvas while keeping the crop aspect ratio', async () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (callback: BlobCallback) => callback(new Blob(['png'])),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement);
    const image = {} as HTMLImageElement;
    await cropImagePart(image, { name: 'Arm', x: 0, y: 0, width: 8192, height: 4096 });
    expect(canvas.width).toBe(4096);
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 8192, 4096, 0, 1024, 4096, 2048);
  });
  it('rejects an encoder failure', async () => {
    const canvas = { getContext: () => ({ drawImage: vi.fn() }), toBlob: (callback: BlobCallback) => callback(null) };
    vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement);
    await expect(
      cropImagePart({} as HTMLImageElement, { name: 'Head', x: 0, y: 0, width: 20, height: 20 })
    ).rejects.toThrow('Image encoding failed');
  });
});
