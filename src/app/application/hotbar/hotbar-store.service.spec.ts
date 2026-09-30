import { TestBed } from '@angular/core/testing';
import { HOTBAR_STARTER_KEY, HotbarStoreService } from '@axe/application/hotbar/hotbar-store.service';
import { Hotbar } from '@axe/domain/hotbar/hotbar';
import { emptyHotbarSlotDraft } from '@axe/domain/hotbar/hotbar-draft';
import { hotbarStarterSlots } from '@axe/domain/hotbar/hotbar-starter';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('HotbarStoreService', () => {
  let service: HotbarStoreService;

  beforeEach(() => {
    localStorage.removeItem('ui-hotbar-owner');
    localStorage.removeItem(HOTBAR_STARTER_KEY);
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    service = TestBed.inject(HotbarStoreService);
  });

  afterEach(() => {
    localStorage.removeItem('ui-hotbar-owner');
    localStorage.removeItem(HOTBAR_STARTER_KEY);
  });

  /** The page coming back: the same browser storage, a new service, and whatever the room still holds. */
  function reload(): HotbarStoreService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    return TestBed.inject(HotbarStoreService);
  }

  describe('the samples a first bar starts with', () => {
    it('puts them on the bar of a reader named for the first time', () => {
      const hotbar = service.offerStarter();

      expect(hotbar).toBe(service.own());
      expect(hotbar?.ownerUserId).toBe(service.ownerId);
      const expected = hotbarStarterSlots();
      expect(hotbar?.slots).toHaveLength(expected.length);
      for (const { cell, draft } of expected) {
        const slot = hotbar?.slotAt(cell.page, cell.slotIndex);
        expect(slot?.slotKind).toBe('prefill');
        expect(slot?.argument).toBe(draft.value);
      }
    });

    it('puts them there once, so a bar the reader emptied stays empty', () => {
      const hotbar = service.offerStarter()!;
      for (const slot of hotbar.slots) hotbar.clear(slot.pageNo, slot.slotNo);

      expect(service.offerStarter()).toBeNull();
      expect(reload().offerStarter()).toBeNull();
      expect(hotbar.slots).toHaveLength(0);
    });

    it('does not bring them back when the bar itself is gone after a reload', () => {
      service.offerStarter()!.destroy();

      const reloaded = reload();

      expect(reloaded.offerStarter()).toBeNull();
      expect(reloaded.own()).toBeNull();
    });

    it('leaves a bar that is already there exactly as it is, and owes nothing afterwards', () => {
      const draft = emptyHotbarSlotDraft('prefill');
      draft.value = '自分で入れた枠';
      const hotbar = service.ensureOwn()!;
      hotbar.put(0, 9, draft);

      expect(service.offerStarter()).toBeNull();
      expect(hotbar.slots.map((slot) => slot.argument)).toEqual(['自分で入れた枠']);

      hotbar.destroy();
      expect(service.offerStarter()).toBeNull();
      expect(service.own()).toBeNull();
    });

    it('leaves alone a bar saved under another identifier that names the reader', () => {
      const loaded = new Hotbar('from-an-older-save');
      loaded.ownerUserId = service.ownerId;
      loaded.initialize();

      expect(service.offerStarter()).toBeNull();
      expect(loaded.slots).toHaveLength(0);
    });

    it('owes nothing to a reader named on an earlier visit, whose bar may still be in a room', () => {
      localStorage.setItem('ui-hotbar-owner', 'returning-reader');
      localStorage.removeItem(HOTBAR_STARTER_KEY);

      const returning = reload();

      expect(returning.ownerId).toBe('returning-reader');
      expect(returning.offerStarter()).toBeNull();
      expect(returning.own()).toBeNull();
    });
  });

  it('holds none until one is asked for', () => {
    expect(service.own()).toBeNull();
  });

  it('makes one and hands the same one back after', () => {
    const hotbar = service.ensureOwn();

    expect(hotbar).toBeInstanceOf(Hotbar);
    expect(hotbar?.ownerUserId).toBe(service.ownerId);
    expect(service.ensureOwn()).toBe(hotbar);
    expect(service.own()).toBe(hotbar);
  });

  it('is the reader’s own bar, not one belonging to whoever else is in the room', () => {
    const mine = service.ensureOwn();
    const theirs = Hotbar.ensureForUser('someone-else');

    expect(mine).not.toBe(theirs);
    expect(service.own()).toBe(mine);
  });

  it('finds one saved under another identifier by who it belongs to', () => {
    const loaded = new Hotbar('from-an-older-save');
    loaded.ownerUserId = service.ownerId;
    loaded.initialize();

    expect(service.own()).toBe(loaded);
  });

  it('keeps the same name for the reader across a reload', () => {
    const first = service.ownerId;

    expect(localStorage.getItem('ui-hotbar-owner')).toBe(first);
    expect(first.length).toBeGreaterThan(0);
  });

  it('is the name the domain works from, so a bar read from a file lands here', () => {
    expect(Hotbar.ownerId).toBe(service.ownerId);
    expect(Hotbar.ensureMine()).toBe(service.ensureOwn());
  });
});
