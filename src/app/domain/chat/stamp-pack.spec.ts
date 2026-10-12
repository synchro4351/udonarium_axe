import { ObjectSerializer } from '@axe/core/sync/object-serializer';
import { ObjectStore } from '@axe/core/sync/object-store';
import { StampPack } from '@axe/domain/chat/stamp-pack';

describe('StampPack', () => {
  const made: StampPack[] = [];

  function pack(): StampPack {
    const created = StampPack.create('ねこ');
    made.push(created);
    return created;
  }

  afterEach(() => {
    for (const each of made.splice(0)) each.destroy();
  });

  it('holds its stamps once each, in the order they were added, each known by its picture', () => {
    const set = pack();

    expect(set.addStamp('picture-a', 'にゃー')).not.toBeNull();
    expect(set.addStamp('picture-b', 'しゃー')).not.toBeNull();
    expect(set.addStamp('picture-a', 'もう一度')).toBeNull();
    expect(set.addStamp('  ', 'からっぽ')).toBeNull();

    expect(set.stamps.map(({ stampId, name }) => [stampId, name])).toEqual([
      ['image:picture-a', 'にゃー'],
      ['image:picture-b', 'しゃー'],
    ]);
  });

  it('writes each stamp as a picture element, which a saved room picks its pictures out of', () => {
    const set = pack();
    set.addStamp('picture-a', 'にゃー');

    const xml = ObjectSerializer.instance.toXml(set);

    expect(xml).toMatch(/<stamp-pack name="ねこ"/);
    expect(xml).toMatch(/<data [^>]*type="image"[^>]*>picture-a<\/data>/);
  });

  it('keeps its identifier in an export and restores it when the archived pack is reloaded', () => {
    const set = pack();
    const identifier = set.identifier;
    const xml = set.toXml();
    expect(xml).toContain(`identifier="${identifier}"`);
    set.destroy();
    ObjectStore.instance.clearDeleteHistory();
    const restored = ObjectSerializer.instance.parseXml(xml) as StampPack;
    made.push(restored);
    expect(restored.identifier).toBe(identifier);
  });

  it('migrates old JSON stamps and preserves metadata on re-export', () => {
    const items = [{ id: 'old', name: 'Nice', imageIdentifier: 'picture-a', words: ['nice'] }];
    const saved = JSON.stringify(items).replaceAll('"', '&quot;');
    const restored = ObjectSerializer.instance.parseXml(`<stamp-pack stamps="${saved}"/>`) as StampPack;
    made.push(restored);
    expect(restored.items).toEqual(items);
    expect(restored.stamps.map(({ stampId, name }) => [stampId, name])).toEqual([['image:picture-a', 'Nice']]);
    expect(restored.toXml()).not.toContain(' stamps=');
    const reloaded = ObjectSerializer.instance.parseXml(restored.toXml()) as StampPack;
    made.push(reloaded);
    expect(reloaded.items).toEqual(items);
  });

  it('loads a pack as a copy when its saved identifier is already in use', () => {
    const set = pack();
    const restored = ObjectSerializer.instance.parseXml(set.toXml()) as StampPack;
    made.push(restored);

    expect(restored.identifier).not.toBe(set.identifier);
  });
});
