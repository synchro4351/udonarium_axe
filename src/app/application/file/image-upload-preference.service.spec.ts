import { TestBed } from '@angular/core/testing';
import { ImageUploadPreferenceService, UPLOAD_MAX_SIDE } from '@axe/application/file/image-upload-preference.service';
import { ImageFile } from '@axe/core/storage/image-file';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('ImageUploadPreferenceService', () => {
  const key = 'ui-image-edit-first';

  function fresh(): ImageUploadPreferenceService {
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    return TestBed.inject(ImageUploadPreferenceService);
  }

  afterEach(() => {
    localStorage.removeItem(key);
    localStorage.removeItem('ui-image-shrink-large');
    ImageFile.uploadMaxSide = 0;
    vi.restoreAllMocks();
  });

  it('adds pictures as they are unless asked otherwise', () => {
    expect(fresh().editFirst()).toBe(false);
  });

  it('remembers in this browser that pictures open in the editor first', () => {
    fresh().setEditFirst(true);

    expect(localStorage.getItem(key)).toBe('true');
    TestBed.resetTestingModule();
    expect(fresh().editFirst()).toBe(true);
  });

  it('reads anything but the word for yes as no', () => {
    localStorage.setItem(key, '1');

    expect(fresh().editFirst()).toBe(false);
  });

  it('still holds the choice for the session where the browser will not write it down', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const preference = fresh();

    preference.setEditFirst(true);

    expect(preference.editFirst()).toBe(true);
  });

  describe('shrinking large pictures', () => {
    it('is on unless turned off, and hands the limit to the image store at startup', () => {
      const preference = fresh();
      expect(preference.shrinkLarge()).toBe(true);
      expect(ImageFile.uploadMaxSide).toBe(0);

      preference.initialize();

      expect(ImageFile.uploadMaxSide).toBe(UPLOAD_MAX_SIDE);
    });

    it('keeps pictures at their size once turned off, here and after a reload', () => {
      const preference = fresh();
      preference.initialize();

      preference.setShrinkLarge(false);

      expect(ImageFile.uploadMaxSide).toBe(0);
      expect(localStorage.getItem('ui-image-shrink-large')).toBe('false');
      TestBed.resetTestingModule();
      const reloaded = fresh();
      reloaded.initialize();
      expect(reloaded.shrinkLarge()).toBe(false);
      expect(ImageFile.uploadMaxSide).toBe(0);
    });
  });
});
