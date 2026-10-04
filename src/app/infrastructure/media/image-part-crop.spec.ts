import { cropImagePart, cropImagePartFrame } from '@axe/infrastructure/media/image-part-crop';

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
  it('keeps the whole frame and draws only the part in place for linked parts', async () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement);
    const image = { naturalWidth: 300, naturalHeight: 200 } as HTMLImageElement;
    await cropImagePartFrame(image, { name: 'Tail', x: 150, y: 40, width: 100, height: 60 });
    expect([canvas.width, canvas.height]).toEqual([300, 200]);
    expect(drawImage).toHaveBeenCalledWith(image, 150, 40, 100, 60, 150, 40, 100, 60);
  });
  it('scales an oversized linked frame to 4096px on its longer side', async () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (callback: BlobCallback) => callback(new Blob(['png'])),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement);
    const image = { naturalWidth: 8192, naturalHeight: 2048 } as HTMLImageElement;
    await cropImagePartFrame(image, { name: 'Wing', x: 4096, y: 0, width: 2048, height: 1024 });
    expect([canvas.width, canvas.height]).toEqual([4096, 1024]);
    expect(drawImage).toHaveBeenCalledWith(image, 4096, 0, 2048, 1024, 2048, 0, 1024, 512);
  });
  it('rejects an encoder failure', async () => {
    const canvas = { getContext: () => ({ drawImage: vi.fn() }), toBlob: (callback: BlobCallback) => callback(null) };
    vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement);
    await expect(
      cropImagePart({} as HTMLImageElement, { name: 'Head', x: 0, y: 0, width: 20, height: 20 })
    ).rejects.toThrow('Image encoding failed');
  });
});
