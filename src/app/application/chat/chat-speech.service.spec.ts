import { TestBed } from '@angular/core/testing';
import { ChatSpeechService } from '@axe/application/chat/chat-speech.service';
import { IPeerContext } from '@axe/core/network/peer-context';
import { resetPeerContextProvider, setPeerContextProvider } from '@axe/core/network/peer-context-source';
import { AudioPlayer } from '@axe/core/storage/audio-player';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { ChatTabList } from '@axe/domain/chat/chat-tab-list';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('ChatSpeechService', () => {
  const voice = { voiceURI: 'local-ja', lang: 'ja-JP', localService: true } as SpeechSynthesisVoice;
  let service: ChatSpeechService;
  let tab: ChatTab;
  let synth: {
    getVoices: () => SpeechSynthesisVoice[];
    speak: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    setPeerContextProvider({
      peerContext: { userId: 'me', peerId: 'me/peer' } as IPeerContext,
      peerContexts: [],
      peerIds: [],
      peerId: 'me/peer',
    });
    synth = {
      getVoices: () => [voice],
      speak: vi.fn(),
      cancel: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
    class UtteranceMock {
      text: string;
      voice?: SpeechSynthesisVoice;
      lang = '';
      rate = 1;
      volume = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal('SpeechSynthesisUtterance', UtteranceMock);
    vi.spyOn(AudioPlayer, 'setSpeechDucking').mockImplementation(() => {});
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    ChatTabList.instance.initialize();
    tab = new ChatTab();
    tab.name = 'Main';
    tab.initialize();
    ChatTabList.instance.appendChild(tab);
    service = TestBed.inject(ChatSpeechService);
    service.patchSettings({ voiceURI: voice.voiceURI });
  });

  afterEach(() => {
    resetPeerContextProvider();
    TestBed.resetTestingModule();
    tab.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });
  function message(text = 'hello', extra: Record<string, string> = {}) {
    return tab.addMessage({ text, timestamp: Date.now(), from: 'someone-else', ...extra });
  }
  function lastUtterance(): SpeechSynthesisUtterance {
    return synth.speak.mock.calls.at(-1)![0] as SpeechSynthesisUtterance;
  }
  function finish(utterance = lastUtterance()) {
    utterance.onend?.({} as SpeechSynthesisEvent);
  }

  it('persists clamped settings and tab preferences', () => {
    service.patchSettings({ rate: 99, volume: -1, duckLevel: 2, tabs: { 情報: true } });
    expect(service.settings().rate).toBe(2);
    expect(service.settings().volume).toBe(0);
    expect(service.settings().duckLevel).toBe(1);
    expect(service.tabEnabled('情報')).toBe(true);
    expect(JSON.parse(localStorage.getItem('chat-speech-preferences')!)).toMatchObject({
      rate: 2,
      volume: 0,
      duckLevel: 1,
    });
  });

  it('stops synthesis without disabling automatic reading preference', () => {
    service.start();
    service.setTabEnabled('情報', true);
    service.stop();
    expect(service.enabled()).toBe(true);
    expect(synth.cancel).toHaveBeenCalled();
    expect(AudioPlayer.setSpeechDucking).toHaveBeenCalledWith(1);
  });

  it('disable stops synthesis and turns automatic reading off', () => {
    service.start();
    service.disable();
    expect(service.enabled()).toBe(false);
    expect(synth.cancel).toHaveBeenCalled();
  });

  it('plays queued messages serially and invalidates callbacks on stop', () => {
    service.start();
    service.setTabEnabled('Main', true);
    const first = message('first');
    expect({
      enabled: service.enabled(),
      canRead: service.canRead(first),
      self: first.isSendFromSelf,
      tab: first.tabIdentifier,
      enabledTab: service.tabEnabled(tab.name),
      timestamp: first.timestamp >= Date.now() - 1000,
    }).toMatchObject({ enabled: true, canRead: true, self: false, enabledTab: true, timestamp: true });
    service.readAutomatically(first);
    const old = lastUtterance();
    service.readAutomatically(message('second'));
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(service.pendingCount()).toBe(1);
    finish();
    expect(synth.speak).toHaveBeenCalledTimes(2);
    service.stop();
    finish(old);
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(service.enabled()).toBe(true);
  });
  it('allows manual replay while disabled without enabling automatic reading', () => {
    service.speak(message());
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(service.enabled()).toBe(false);
    service.readAutomatically(message('next'));
    expect(service.pendingCount()).toBe(0);
  });
  it('retains every code point of a long message', () => {
    const text = '日本語😀'.repeat(100);
    service.speak(message(text));
    let count = 0;
    while (count < synth.speak.mock.calls.length) finish(synth.speak.mock.calls[count++][0]);
    expect(synth.speak.mock.calls.map(([u]) => u.text).join('')).toBe(text);
  });
  it('marks queue overflow and allows the skipped message to be replayed', () => {
    service.start();
    service.setTabEnabled('Main', true);
    service.readAutomatically(message('active'));
    for (let i = 0; i < 5; i++) service.readAutomatically(message('pending'));
    const skipped = message('skipped');
    service.readAutomatically(skipped);
    expect(service.pendingCount()).toBe(5);
    expect(service.skippedIds().has(skipped.identifier)).toBe(true);
    service.speak(skipped);
    expect(lastUtterance().text).toBe('skipped');
    expect(service.skippedIds().has(skipped.identifier)).toBe(false);
  });
  it('does not automatically read private or system messages', () => {
    service.start();
    service.setTabEnabled('Main', true);
    service.readAutomatically(message('private', { to: 'somebody' }));
    service.readAutomatically(message('hidden roll', { tag: 'secret' }));
    service.readAutomatically(message('system', { tag: 'system' }));
    expect(synth.speak).not.toHaveBeenCalled();
  });
  it('does not read a tab the current player cannot view', () => {
    vi.spyOn(PeerCursor, 'myRole', 'get').mockReturnValue(PeerRole.Player);
    tab.plCanView = false;
    tab.plCanSpeak = false;
    service.speak(message());
    expect(synth.speak).not.toHaveBeenCalled();
  });
  it('cancels speech when its message is deleted', () => {
    const first = message();
    service.speak(first);
    first.destroy();
    service.checkPermissions();
    expect(service.speakingId()).toBeNull();
    const count = synth.speak.mock.calls.length;
    finish();
    expect(synth.speak).toHaveBeenCalledTimes(count);
  });
  it('requires explicit permission for remote voices and cancels on revocation', () => {
    const remote = { ...voice, voiceURI: 'remote', localService: false } as SpeechSynthesisVoice;
    service.voices.set([remote]);
    service.patchSettings({ voiceURI: 'remote' });
    service.speak(message());
    expect(synth.speak).not.toHaveBeenCalled();
    service.patchSettings({ remoteVoices: true });
    service.speak(message());
    expect(lastUtterance().voice).toBe(remote);
    service.patchSettings({ remoteVoices: false });
    const count = synth.speak.mock.calls.length;
    finish();
    expect(synth.speak).toHaveBeenCalledTimes(count);
  });
  it('ducks BGM when speech starts and restores it on failure', () => {
    service.patchSettings({ duckBgm: true, duckLevel: 0.2 });
    service.speak(message());
    lastUtterance().onstart?.({} as SpeechSynthesisEvent);
    expect(AudioPlayer.setSpeechDucking).toHaveBeenLastCalledWith(0.2);
    lastUtterance().onerror?.({} as SpeechSynthesisErrorEvent);
    expect(AudioPlayer.setSpeechDucking).toHaveBeenLastCalledWith(1);
    expect(service.enabled()).toBe(false);
  });
});
