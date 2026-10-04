import { ObjectSerializer } from '@axe/core/sync/object-serializer';
import { GameCharacter } from '@axe/domain/character/game-character';
import {
  applyPartTransform,
  clearPartGroup,
  decodePartRegion,
  encodePartRegion,
  isLinkedPart,
  linkedPartsOf,
  partAnchorOffset,
  partBoxRegion,
  partClipPath,
  partDisplayName,
  partRegionAt,
  partRegionStyle,
  partTransformOf,
  samePartTransform,
} from '@axe/domain/character/part-group';
import { allowDottedXmlAttributes } from '@axe/testing/dotted-xml-attributes';

describe('part group metadata', () => {
  const created: GameCharacter[] = [];
  function character(name = 'Dragon'): GameCharacter {
    const made = GameCharacter.create(name, 2, '');
    created.push(made);
    return made;
  }
  function part(group: string, region = '0 0 0.5 1 2'): GameCharacter {
    const made = character();
    made.partGroup = group;
    made.partRegion = region;
    return made;
  }
  let restoreXml: () => void;
  beforeEach(() => {
    restoreXml = allowDottedXmlAttributes();
  });
  afterEach(() => {
    restoreXml();
    for (const made of created.splice(0)) made.destroy();
  });

  it('round-trips a region as fractions with the aspect ratio', () => {
    const text = encodePartRegion({ x: 150, y: 40, width: 100, height: 60 }, 300, 200);
    expect(text).toBe('0.5 0.2 0.333333 0.3 1.5');
    expect(decodePartRegion(text)).toEqual({ x: 0.5, y: 0.2, width: 0.333333, height: 0.3, aspect: 1.5 });
  });

  it('rejects malformed or out-of-frame regions', () => {
    for (const text of [
      '',
      '0 0 1 1',
      '0 0 1 1 x',
      '-0.1 0 0.5 0.5 1',
      '0 0 0 0.5 1',
      '0.6 0 0.5 0.5 1',
      '0 0 1 1 0',
    ]) {
      expect(decodePartRegion(text)).toBeNull();
    }
  });

  it('counts only pieces with a key and a readable region as parts', () => {
    expect(isLinkedPart({ partGroup: '', partRegion: '0 0 1 1 1' })).toBe(false);
    expect(isLinkedPart({ partGroup: 'g', partRegion: 'broken' })).toBe(false);
    expect(isLinkedPart({ partGroup: 'g', partRegion: '0 0 1 1 1' })).toBe(true);
  });

  it('links only other parts of the same group that stand on the table', () => {
    const head = part('g1');
    const body = part('g1', '0.5 0 0.5 1 2');
    const dead = part('g1', '0.5 0 0.25 1 2');
    dead.location.name = 'graveyard';
    const stranger = part('g2');
    const plain = character();
    const all = [head, body, dead, stranger, plain];
    expect(linkedPartsOf(head, all)).toEqual([body]);
    expect(linkedPartsOf(plain, all)).toEqual([]);
  });

  it('names a part after its creature and keeps both names apart', () => {
    expect(partDisplayName(' Dragon ', 'Head')).toBe('Dragon(Head)');
    expect(partDisplayName('', 'Head')).toBe('Head');
    expect(partDisplayName('Dragon', ' ')).toBe('Dragon');
  });

  it('clears every group field', () => {
    const head = part('g1');
    head.partGroupName = 'Dragon';
    head.partName = 'Head';
    clearPartGroup(head);
    expect([head.partGroup, head.partGroupName, head.partName, head.partRegion]).toEqual(['', '', '', '']);
  });

  it('never lets a copy join the group of the part it was copied from', () => {
    const head = part('g1');
    head.partGroupName = 'Dragon';
    head.partName = 'Head';
    const copy = head.clone();
    created.push(copy);
    expect(copy.identifier).not.toBe(head.identifier);
    expect([copy.partGroup, copy.partGroupName, copy.partName, copy.partRegion]).toEqual(['', '', '', '']);
    expect(head.partGroup).toBe('g1');
  });

  it('keeps the group through a save and load, which gives the piece a new identifier', () => {
    const head = part('g1', '0.1 0.2 0.3 0.4 1.5');
    head.partGroupName = 'Dragon';
    head.partName = 'Head';
    const loaded = ObjectSerializer.instance.parseXml(head.toXml()) as GameCharacter;
    created.push(loaded);
    expect(loaded.identifier).not.toBe(head.identifier);
    expect([loaded.partGroup, loaded.partGroupName, loaded.partName, loaded.partRegion]).toEqual([
      'g1',
      'Dragon',
      'Head',
      '0.1 0.2 0.3 0.4 1.5',
    ]);
  });

  it('publishes a position-only change and writes nothing when already aligned', () => {
    const leader = character();
    const follower = character();
    leader.location = { ...leader.location, x: 120, y: 80 };
    const before = follower.version;
    expect(applyPartTransform(follower, partTransformOf(leader))).toBe(true);
    expect(follower.version).toBeGreaterThan(before);
    const aligned = follower.version;
    expect(applyPartTransform(follower, partTransformOf(leader))).toBe(false);
    expect(follower.version).toBe(aligned);
  });

  it('copies the shared transform and writes nothing to an aligned part', () => {
    const leader = character();
    const follower = character();
    leader.location.x = 120;
    leader.location.y = 80;
    leader.location.surface = 'north-wall';
    leader.posZ = 10;
    leader.rotate = 45;
    leader.roll = 5;
    leader.size = 3;
    leader.altitude = 1.5;
    leader.isLock = true;
    const before = partTransformOf(follower);
    expect(applyPartTransform(follower, partTransformOf(leader))).toBe(true);
    expect(samePartTransform(partTransformOf(follower), partTransformOf(leader))).toBe(true);
    expect(samePartTransform(before, partTransformOf(leader))).toBe(false);
    expect(applyPartTransform(follower, partTransformOf(leader))).toBe(false);
  });
});

describe('part geometry', () => {
  const wide = { x: 0.5, y: 0.25, width: 0.5, height: 0.5, aspect: 2 };
  const tall = { x: 0, y: 0.5, width: 1, height: 0.5, aspect: 0.5 };

  it('keeps the frame region when the box has the picture shape', () => {
    expect(partBoxRegion(wide, false)).toEqual({ x: 0.5, y: 0.25, width: 0.5, height: 0.5 });
  });

  it('letterboxes a wide or tall picture fitted into a square', () => {
    expect(partBoxRegion(wide, true)).toEqual({ x: 0.5, y: 0.375, width: 0.5, height: 0.25 });
    expect(partBoxRegion(tall, true)).toEqual({ x: 0.25, y: 0.5, width: 0.5, height: 0.5 });
  });

  it('clips to the region and positions labels in percentages', () => {
    expect(partClipPath({ x: 0.5, y: 0.25, width: 0.5, height: 0.5 })).toBe('inset(25% 0% 25% 50%)');
    expect(partRegionStyle({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 })).toEqual({
      left: '10%',
      top: '20%',
      width: '30%',
      height: '40%',
    });
  });

  it('resolves a pointer to the region under it, and outside every region to none', () => {
    const regions = [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
    ];
    expect(partRegionAt({ x: 0.25, y: 0.9 }, regions)).toBe(0);
    expect(partRegionAt({ x: 0.75, y: 0.25 }, regions)).toBe(1);
    expect(partRegionAt({ x: 0.75, y: 0.75 }, regions)).toBe(-1);
    expect(partRegionAt({ x: 0.5, y: 0.25 }, regions)).toBe(0);
  });

  it('anchors effects at the region middle on a flat table', () => {
    // The right half of a square picture, from straight above with the table unturned.
    const right = { x: 0.5, y: 0, width: 0.5, height: 1, aspect: 1 };
    const offset = partAnchorOffset(right, 100, { mode2d: true, yawDeg: 0 });
    expect(offset.dx).toBeCloseTo(25);
    expect(offset.dy).toBeCloseTo(0);
    expect(offset.dz).toBe(0);
    const turned = partAnchorOffset(right, 100, { mode2d: true, yawDeg: 90 });
    expect(turned.dx).toBeCloseTo(0);
    expect(turned.dy).toBeCloseTo(-25);
  });

  it('anchors effects sideways and up the standing picture in 3D', () => {
    const head = { x: 0.75, y: 0, width: 0.25, height: 0.5, aspect: 2 };
    const offset = partAnchorOffset(head, 100, { mode2d: false, yawDeg: 0 });
    expect(offset.dx).toBeCloseTo(37.5);
    expect(offset.dy).toBeCloseTo(0);
    // The picture is 50px tall; the region's middle is three quarters of the way up.
    expect(offset.dz).toBeCloseTo(37.5);
  });
  it('projects the billboard region for an oblique viewer and explicit image height', () => {
    const head = { x: 0.75, y: 0, width: 0.25, height: 0.5, aspect: 2 };
    const offset = partAnchorOffset(head, 100, {
      mode2d: false,
      yawDeg: 90,
      pitchDeg: 60,
      contain: false,
      specifiedHeightPx: 80,
    });
    expect(offset.dx).toBeCloseTo(-30);
    expect(offset.dy).toBeCloseTo(-60);
    expect(offset.dz).toBeCloseTo(60 * Math.sin(Math.PI / 3));
  });
});
