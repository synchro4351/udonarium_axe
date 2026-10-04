import { TestBed } from '@angular/core/testing';
import { EffectPlaybackService, MAX_ACTIVE_REACTIONS } from '@axe/application/effect/effect-playback.service';
import { MultipartGroupService } from '@axe/application/tabletop/multipart-group.service';
import { TabletopService } from '@axe/application/tabletop/tabletop.service';
import { ObjectStore } from '@axe/core/sync/object-store';
import { GameCharacter } from '@axe/domain/character/game-character';
import { EffectPreset } from '@axe/domain/effect/effect-preset';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('EffectPlaybackService', () => {
  let service: EffectPlaybackService;
  let preset: EffectPreset;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    service = TestBed.inject(EffectPlaybackService);

    preset = new EffectPreset();
    preset.durationMs = 600;
    ObjectStore.instance.add(preset, false);
  });

  afterEach(() => {
    ObjectStore.instance.remove(preset);
  });

  function cast(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      presetIdentifier: preset.identifier,
      targets: [{ identifier: 'char', x: 0, y: 0, z: 0 }],
      seed: 1,
      ...overrides,
    };
  }

  it('adds a cast that arrives to the list being played', () => {
    expect(service.play(cast())).not.toBeNull();
    expect(service.activeCasts()).toHaveLength(1);
    expect(service.activeCasts()[0].preset).toBe(preset);
  });

  it('ignores a broken cast', () => {
    expect(service.play(null)).toBeNull();
    expect(service.play({ targets: [] })).toBeNull();
    expect(service.activeCasts()).toHaveLength(0);
  });

  it('ignores a cast naming a preset it does not know', () => {
    expect(service.play(cast({ presetIdentifier: 'unknown' }))).toBeNull();
    expect(service.activeCasts()).toHaveLength(0);
  });

  it('plays no more than twelve at once', () => {
    for (let count = 0; count < 20; count++) service.play(cast());

    expect(service.activeCasts()).toHaveLength(12);
  });

  it('keeps only the latest few reactions up, leaving the other effects alone', () => {
    const reaction = new EffectPreset();
    reaction.kind = 'reactpop';
    reaction.reactionText = '👍';
    ObjectStore.instance.add(reaction, false);
    try {
      service.play(cast());
      for (let count = 0; count < 9; count++) {
        service.play(cast({ presetIdentifier: reaction.identifier, seed: count }));
      }

      const reactions = service.activeCasts().filter((active) => active.preset === reaction);
      expect(reactions).toHaveLength(MAX_ACTIVE_REACTIONS);
      expect(reactions.map((active) => active.cast.seed)).toEqual([5, 6, 7, 8]);
      expect(service.activeCasts().filter((active) => active.preset === preset)).toHaveLength(1);
    } finally {
      ObjectStore.instance.remove(reaction);
    }
  });

  it('never shakes the screen for a reaction', () => {
    preset.kind = 'reactthrow';
    preset.grade = 3;
    service.play(cast());

    expect(service.shake()).toBe('');
    expect(service.flash()).toBe('');
  });

  it('shakes the screen only for an effect that lands', () => {
    preset.kind = 'burst';
    preset.grade = 3;
    service.play(cast());

    expect(service.shake()).toBe('hard');
  });

  it('never shakes for healing', () => {
    preset.kind = 'heal';
    preset.grade = 3;
    service.play(cast());

    // Shaking for everything would leave the impact meaning nothing.
    expect(service.shake()).toBe('');
    expect(service.flash()).toBe('');
  });

  it('takes the stronger of two casts in quick succession', () => {
    preset.kind = 'burst';
    preset.grade = 2;
    service.play(cast());
    expect(service.shake()).toBe('soft');

    preset.grade = 3;
    service.play(cast());

    expect(service.shake()).toBe('hard');
  });

  it('tells the piece how to fall when the effect fells it', () => {
    preset.kind = 'bisect';
    service.play(cast());

    expect(service.tokenReactions().get('char')).toBe('bisect');
  });

  it('leaves the piece alone otherwise', () => {
    preset.kind = 'burst';
    service.play(cast());

    expect(service.tokenReactions().size).toBe(0);
  });
});

describe('EffectPlaybackService linked targets', () => {
  it('resolves each viewer locally without changing the broadcast', () => {
    const part = GameCharacter.create('Dragon(Head)', 2, '');
    part.partGroup = 'group';
    part.partRegion = '0 0 0.5 1 1';
    const preset = new EffectPreset();
    ObjectStore.instance.add(preset, false);
    let local = { x: 100, y: 200, z: 30 };
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    TestBed.overrideProvider(MultipartGroupService, { useValue: { anchorOf: () => local } });
    TestBed.overrideProvider(TabletopService, { useValue: { gridSize: () => 50 } });
    const service = TestBed.inject(EffectPlaybackService);
    const raw = {
      presetIdentifier: preset.identifier,
      seed: 1,
      targets: [{ identifier: part.identifier, x: 5, y: 6, z: 7 }],
    };
    try {
      expect(service.play(raw)?.cast.targets[0]).toEqual({ identifier: part.identifier, ...local });
      local = { x: 300, y: 400, z: 50 };
      expect(service.play(raw)?.cast.targets[0]).toEqual({ identifier: part.identifier, ...local });
      expect(raw.targets).toEqual([{ identifier: part.identifier, x: 5, y: 6, z: 7 }]);
    } finally {
      part.destroy();
      ObjectStore.instance.remove(preset);
      TestBed.resetTestingModule();
    }
  });
});
