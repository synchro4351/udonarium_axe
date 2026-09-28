import { TestBed } from '@angular/core/testing';
import { CutInService } from '@axe/application/media/cut-in.service';
import { IPeerContext } from '@axe/core/network/peer-context';
import { resetPeerContextProvider, setPeerContextProvider } from '@axe/core/network/peer-context-source';
import { AudioFile } from '@axe/core/storage/audio-file';
import { AudioStorage } from '@axe/core/storage/audio-storage';
import { GameCharacter } from '@axe/domain/character/game-character';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { ChatTabList } from '@axe/domain/chat/chat-tab-list';
import { CutIn } from '@axe/domain/media/cut-in';
import { CutInLauncher } from '@axe/domain/media/cut-in-launcher';
import { CutInLayer } from '@axe/domain/media/cut-in-layer';
import { type CutInPortraitFit, withPortraitFit } from '@axe/domain/media/cut-in-portrait';
import { CutInScene } from '@axe/domain/media/cut-in-scene';
import { Jukebox } from '@axe/domain/media/jukebox';
import { GameTable } from '@axe/domain/tabletop/game-table';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('CutInService.activateFromChatText()', () => {
  let service: CutInService;
  let launcher: CutInLauncher;
  let jukebox: Jukebox;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });

    // Clean store

    launcher = new CutInLauncher('CutInLauncher');
    launcher.initialize();
    jukebox = new Jukebox('Jukebox');
    jukebox.initialize();

    service = TestBed.inject(CutInService);
  });

  afterEach(() => {
    AudioStorage.instance.audios.forEach((a) => AudioStorage.instance.delete(a.identifier));
  });

  function makeCutIn(name: string, opts: Partial<{ audioIdentifier: string; tagName: string }> = {}): CutIn {
    const cutIn = new CutIn();
    cutIn.initialize();
    cutIn.name = name;
    cutIn.chatActivate = true;
    if (opts.audioIdentifier !== undefined) cutIn.audioIdentifier = opts.audioIdentifier;
    if (opts.tagName !== undefined) cutIn.tagName = opts.tagName;
    return cutIn;
  }

  it('starts a cut-in when the last word of the line matches its name', () => {
    const cutIn = makeCutIn('炎の剣');
    const spy = vi.spyOn(launcher, 'startCutIn');

    service.activateFromChatText('演出 炎の剣', '');

    // A cut-in without a portrait slot carries no portrait, exactly as before.
    expect(spy).toHaveBeenCalledWith(cutIn, '', null);
  });

  it('ignores a cut-in that chat is not allowed to start', () => {
    const cutIn = makeCutIn('攻撃');
    cutIn.chatActivate = false;
    const spy = vi.spyOn(launcher, 'startCutIn');

    service.activateFromChatText('攻撃', '');

    expect(spy).not.toHaveBeenCalled();
  });

  it('stops the jukebox for an untagged cut-in that carries sound', () => {
    const stopSpy = vi.spyOn(jukebox, 'stop').mockImplementation(() => {});
    AudioStorage.instance.add(AudioFile.createEmpty('cutin-audio-01'));
    makeCutIn('BGM停止', { audioIdentifier: 'cutin-audio-01', tagName: '' });
    vi.spyOn(launcher, 'startCutIn').mockImplementation(() => {});

    service.activateFromChatText('再生 BGM停止', '');

    expect(stopSpy).toHaveBeenCalledOnce();
  });

  it('starts a sound-only cut-in when the last word carries an at sign', () => {
    const cutIn = makeCutIn('爆発');
    const soundSpy = vi.spyOn(launcher, 'startSoundOnlyCutIn');
    const startSpy = vi.spyOn(launcher, 'startCutIn');

    service.activateFromChatText('演出 @爆発', '');

    expect(soundSpy).toHaveBeenCalledWith(cutIn, '');
    expect(startSpy).not.toHaveBeenCalled();
  });

  it('leaves the jukebox alone for the at-sign form', () => {
    const stopSpy = vi.spyOn(jukebox, 'stop').mockImplementation(() => {});
    AudioStorage.instance.add(AudioFile.createEmpty('cutin-audio-02'));
    makeCutIn('爆音', { audioIdentifier: 'cutin-audio-02', tagName: '' });
    vi.spyOn(launcher, 'startSoundOnlyCutIn').mockImplementation(() => {});

    service.activateFromChatText('@爆音', '');

    expect(stopSpy).not.toHaveBeenCalled();
  });

  it('matches nothing on an at sign alone', () => {
    const cutIn = makeCutIn('');
    const soundSpy = vi.spyOn(launcher, 'startSoundOnlyCutIn');
    const startSpy = vi.spyOn(launcher, 'startCutIn');
    void cutIn;

    service.activateFromChatText('テスト @', '');

    expect(soundSpy).not.toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
  });
});

describe('CutInService.launchForTable()', () => {
  let service: CutInService;
  let launcher: CutInLauncher;
  let table: GameTable;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });

    launcher = new CutInLauncher('CutInLauncher');
    launcher.initialize();
    new Jukebox('Jukebox').initialize();

    table = new GameTable();
    table.initialize();

    service = TestBed.inject(CutInService);
  });

  function makeCutIn(name: string): CutIn {
    const cutIn = new CutIn();
    cutIn.initialize();
    cutIn.name = name;
    return cutIn;
  }

  it('plays nothing for a table that asks for nothing', () => {
    const spy = vi.spyOn(launcher, 'startCutIn');

    expect(service.launchForTable(table)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('plays the only cut-in the table asks for', () => {
    const cutIn = makeCutIn('開幕');
    table.cutInIdentifiers = cutIn.identifier;
    const spy = vi.spyOn(launcher, 'startCutIn').mockImplementation(() => {});

    expect(service.launchForTable(table)).toBe(true);
    expect(spy).toHaveBeenCalledWith(cutIn, '', null);
  });

  it('draws the one the roll names when the table asks for several', () => {
    const first = makeCutIn('一番目');
    const second = makeCutIn('二番目');
    table.cutInIdentifiers = `${first.identifier},${second.identifier}`;
    const spy = vi.spyOn(launcher, 'startCutIn').mockImplementation(() => {});

    service.launchForTable(table, () => 1);

    expect(spy).toHaveBeenCalledWith(second, '', null);
  });

  it('plays nothing once the cut-in it names is gone', () => {
    const cutIn = makeCutIn('消えた');
    table.cutInIdentifiers = cutIn.identifier;
    cutIn.destroy();
    const spy = vi.spyOn(launcher, 'startCutIn');

    expect(service.launchForTable(table)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('what a line arriving sets off', () => {
  let launcher: CutInLauncher;
  let tab: ChatTab;

  function makeCutIn(name: string): CutIn {
    const cutIn = new CutIn();
    cutIn.initialize();
    cutIn.name = name;
    cutIn.chatActivate = true;
    return cutIn;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });

    setPeerContextProvider({
      peerContext: { userId: 'me', peerId: 'me/peer' } as IPeerContext,
      peerContexts: [],
      peerIds: [],
      peerId: 'me/peer',
    });

    launcher = new CutInLauncher('CutInLauncher');
    launcher.initialize();
    new Jukebox('Jukebox').initialize();
    ChatTabList.instance.initialize();
    tab = new ChatTab();
    tab.initialize();
    ChatTabList.instance.appendChild(tab);

    TestBed.inject(CutInService);
  });

  afterEach(() => {
    resetPeerContextProvider();
    for (const chatTab of [...ChatTabList.instance.chatTabs]) chatTab.destroy();
  });

  it('starts the cut-in a line this end just said asks for', () => {
    const cutIn = makeCutIn('炎の剣');
    const spy = vi.spyOn(launcher, 'startCutIn').mockImplementation(() => {});

    tab.addMessage({ from: 'me', name: '術者', text: '斬る 炎の剣', timestamp: Date.now() });

    expect(spy).toHaveBeenCalledWith(cutIn, '', null);
  });

  it('brings the portrait the character spoke with into a template with a portrait slot', () => {
    const cutIn = makeTemplate('名乗り');
    setPortraitFit(cutIn, 'hero-smile', { zoom: 2, x: 40, y: 10 });
    const hero = makeCharacter('hero');
    const spy = vi.spyOn(launcher, 'startCutIn').mockImplementation(() => {});

    tab.addMessage({
      from: 'me',
      name: '勇者',
      text: '参る 名乗り',
      sendFrom: hero.identifier,
      imageIdentifier: 'hero-smile',
      timestamp: Date.now(),
    });

    expect(spy).toHaveBeenCalledWith(cutIn, '', {
      characterIdentifier: hero.identifier,
      imageIdentifier: 'hero-smile',
      fit: { zoom: 2, x: 40, y: 10 },
      characterName: 'hero',
    });
  });

  it('carries the speaking character name for a scene that names them, even without a portrait slot', () => {
    const cutIn = makeNamingScene('名乗り');
    const hero = makeCharacter('勇者ロト');
    const spy = vi.spyOn(launcher, 'startCutIn').mockImplementation(() => {});

    tab.addMessage({
      from: 'me',
      name: '勇者ロト',
      text: '参る 名乗り',
      sendFrom: hero.identifier,
      timestamp: Date.now(),
    });
    hero.name = '改名後';

    expect(spy).toHaveBeenCalledWith(cutIn, '', expect.objectContaining({ characterName: '勇者ロト' }));
  });

  it('names the player who speaks as themself', () => {
    const cutIn = makeNamingScene('名乗り');
    const spy = vi.spyOn(launcher, 'startCutIn').mockImplementation(() => {});

    tab.addMessage({ from: 'me', name: 'PL太郎', text: '参る 名乗り', timestamp: Date.now() });

    expect(spy).toHaveBeenCalledWith(
      cutIn,
      '',
      expect.objectContaining({ characterIdentifier: '', characterName: 'PL太郎' })
    );
  });

  function makeNamingScene(name: string): CutIn {
    const cutIn = makeCutIn(name);
    const scene = new CutInScene();
    scene.cutInIdentifier = cutIn.identifier;
    scene.initialize();
    const words = new CutInLayer();
    words.kind = 'text';
    words.text = '{character}';
    words.initialize();
    scene.appendChild(words);
    return cutIn;
  }

  it('keeps a direct line direct when it brings a portrait', () => {
    const cutIn = makeTemplate('名乗り');
    const hero = makeCharacter('hero');
    const spy = vi.spyOn(launcher, 'startCutIn').mockImplementation(() => {});

    tab.addMessage({
      from: 'me',
      to: 'user-2',
      name: '勇者',
      text: '参る 名乗り',
      sendFrom: hero.identifier,
      imageIdentifier: 'hero-smile',
      timestamp: Date.now(),
    });

    expect(spy).toHaveBeenCalledWith(cutIn, 'user-2', expect.objectContaining({ imageIdentifier: 'hero-smile' }));
  });

  it('brings the silhouette when a player speaks as themself', () => {
    const cutIn = makeTemplate('名乗り');
    const spy = vi.spyOn(launcher, 'startCutIn').mockImplementation(() => {});

    tab.addMessage({
      from: 'me',
      name: 'PL',
      text: '参る 名乗り',
      imageIdentifier: 'player-icon',
      timestamp: Date.now(),
    });

    expect(spy).toHaveBeenCalledWith(
      cutIn,
      '',
      expect.objectContaining({ characterIdentifier: '', imageIdentifier: '' })
    );
  });

  function makeTemplate(name: string): CutIn {
    const cutIn = makeCutIn(name);
    const scene = new CutInScene();
    scene.cutInIdentifier = cutIn.identifier;
    scene.initialize();
    const slot = new CutInLayer();
    slot.kind = 'image';
    slot.portraitSlot = true;
    slot.initialize();
    scene.appendChild(slot);
    return cutIn;
  }

  function setPortraitFit(cutIn: CutIn, imageIdentifier: string, fit: CutInPortraitFit): void {
    const scene = cutIn.scene!;
    scene.portraitFits = withPortraitFit(scene.portraitFits, imageIdentifier, fit);
  }

  function makeCharacter(name: string): GameCharacter {
    // Built the way the app builds one, so it has somewhere to keep its name.
    return GameCharacter.create(name, 1, '');
  }

  it('leaves the backlog alone when somebody walks into the room', () => {
    // Joining hands every line ever said to the same event a new line arrives on. Replaying
    // them would set the whole room's cut-ins off again, one after another.
    makeCutIn('炎の剣');
    const spy = vi.spyOn(launcher, 'startCutIn').mockImplementation(() => {});

    tab.addMessage({ from: 'me', name: '術者', text: '斬る 炎の剣', timestamp: Date.now() - 600_000 });

    expect(spy).not.toHaveBeenCalled();
  });

  it('leaves the starting to the end that said the line', () => {
    // Every end hears the line; if every end started it, one line would start it as many times
    // as there are people in the room, and each start is spoken to everybody.
    makeCutIn('炎の剣');
    const spy = vi.spyOn(launcher, 'startCutIn').mockImplementation(() => {});

    tab.addMessage({ from: 'somebody-else', name: '仲間', text: '斬る 炎の剣', timestamp: Date.now() });

    expect(spy).not.toHaveBeenCalled();
  });

  it('says nothing of a secret line', () => {
    makeCutIn('炎の剣');
    const spy = vi.spyOn(launcher, 'startCutIn').mockImplementation(() => {});

    tab.addMessage({ from: 'me', name: '術者', text: '斬る 炎の剣', tag: 'secret', timestamp: Date.now() });

    expect(spy).not.toHaveBeenCalled();
  });
});
