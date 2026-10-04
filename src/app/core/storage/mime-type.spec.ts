import * as MimeType from '@axe/core/storage/mime-type';

describe('MimeType', () => {
  describe('type()', () => {
    it('types a png', () => {
      expect(MimeType.type('image.png')).toBe('image/png');
    });

    it('types a jpg', () => {
      expect(MimeType.type('photo.jpg')).toBe('image/jpeg');
    });

    it('types a jpeg', () => {
      expect(MimeType.type('photo.jpeg')).toBe('image/jpeg');
    });

    it('types a gif', () => {
      expect(MimeType.type('anim.gif')).toBe('image/gif');
    });

    it('types a webp', () => {
      expect(MimeType.type('image.webp')).toBe('image/webp');
    });

    it('types an svg', () => {
      expect(MimeType.type('icon.svg')).toBe('image/svg+xml');
    });

    it('types an mp3', () => {
      expect(MimeType.type('sound.mp3')).toBe('audio/mp3');
    });

    it('types a wav', () => {
      expect(MimeType.type('sound.wav')).toBe('audio/wav');
    });

    it('types an ogg', () => {
      expect(MimeType.type('sound.ogg')).toBe('audio/ogg');
    });

    it('types an mp4', () => {
      expect(MimeType.type('video.mp4')).toBe('video/mp4');
    });

    it('types an html file', () => {
      expect(MimeType.type('page.html')).toBe('text/html');
    });

    it('types a json file', () => {
      expect(MimeType.type('data.json')).toBe('application/json');
    });

    it('types a zip', () => {
      expect(MimeType.type('archive.zip')).toBe('application/zip');
    });

    it('recognises an extension in capitals', () => {
      expect(MimeType.type('IMAGE.PNG')).toBe('image/png');
    });

    it('takes the last extension from a path with several dots', () => {
      expect(MimeType.type('some.file.name.jpg')).toBe('image/jpeg');
    });

    it('returns nothing for an extension it does not know', () => {
      expect(MimeType.type('file.unknown')).toBe('');
    });

    it('types a yaml file', () => {
      expect(MimeType.type('config.yaml')).toBe('text/yaml');
    });

    it('types an avif', () => {
      expect(MimeType.type('image.avif')).toBe('image/avif');
    });
  });

  describe('extension()', () => {
    it('names a png', () => {
      expect(MimeType.extension('image/png')).toBe('png');
    });

    it('names a jpeg', () => {
      expect(MimeType.extension('image/jpeg')).toBe('jpg');
    });

    it('names an mp3', () => {
      expect(MimeType.extension('audio/mp3')).toBe('mp3');
    });

    it('falls back to the subtype for a type it does not know', () => {
      expect(MimeType.extension('application/octet-stream')).toBe('octet-stream');
    });

    it('names a gif', () => {
      expect(MimeType.extension('image/gif')).toBe('gif');
    });
  });
});

describe('rasterType', () => {
  it.each([
    [[137, 80, 78, 71, 13, 10, 26, 10], 'image/png'],
    [[255, 216, 255], 'image/jpeg'],
    [[71, 73, 70, 56, 55, 97], 'image/gif'],
    [[71, 73, 70, 56, 57, 97], 'image/gif'],
    [[82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80], 'image/webp'],
  ])('recognizes a raster signature %s', (signature, mime) => {
    expect(MimeType.rasterType(new Uint8Array(signature as number[]))).toBe(mime);
  });
  it('leaves empty, truncated, text and non-image RIFF files untyped', () => {
    for (const bytes of [[], [137, 80, 78], [60, 115, 118, 103], [82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]])
      expect(MimeType.rasterType(new Uint8Array(bytes))).toBe('');
  });
});
