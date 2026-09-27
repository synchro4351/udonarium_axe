import { TestBed } from '@angular/core/testing';
import { OverheadSpeechService } from '@axe/application/chat/overhead-speech.service';
import { IPeerContext } from '@axe/core/network/peer-context';
import { resetPeerContextProvider, setPeerContextProvider } from '@axe/core/network/peer-context-source';
import { GameCharacter } from '@axe/domain/character/game-character';
import { ChatMessageContext } from '@axe/domain/chat/chat-message';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { ChatTabList } from '@axe/domain/chat/chat-tab-list';
import { Config } from '@axe/domain/peer/config';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('OverheadSpeechService', () => {
  let service: OverheadSpeechService;
  let tab: ChatTab;
  let speaker: GameCharacter;

  beforeEach(() => {
    vi.useFakeTimers();
    setPeerContextProvider({
      peerContext: { userId: 'me', peerId: 'me/peer' } as IPeerContext,
      peerContexts: [],
      peerIds: [],
      peerId: 'me/peer',
    });
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    Config.instance.showsOverheadSpeech = true;
    ChatTabList.instance.initialize();
    tab = new ChatTab();
    tab.name = 'Main';
    tab.initialize();
    ChatTabList.instance.appendChild(tab);
    speaker = GameCharacter.create('ヒロ', 1, '');
    service = TestBed.inject(OverheadSpeechService);
  });

  afterEach(() => {
    service.clear();
    Config.instance.showsOverheadSpeech = false;
    speaker.destroy();
    tab.destroy();
    resetPeerContextProvider();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function say(text: string, extra: ChatMessageContext = {}) {
    return tab.addMessage({
      text,
      timestamp: Date.now(),
      from: 'someone-else',
      sendFrom: speaker.identifier,
      ...extra,
    });
  }

  it('puts only the quoted part of a line over its speaker', () => {
    expect(service.show(say('剣を抜く。「来い！」'))).toBe(true);
    expect(service.bubbleOf(speaker.identifier)?.speech).toEqual({ kind: 'text', text: '来い！' });
  });

  it('puts nothing up for unquoted words', () => {
    expect(service.show(say('剣を抜く。'))).toBe(false);
    expect(service.bubbleOf(speaker.identifier)).toBeNull();
  });

  it('shows a stamp by its picture and an emoji-only line as it is', () => {
    service.show(say('', { stampName: 'いいね', attachmentImageIdentifiers: JSON.stringify(['stamp-image']) }));
    expect(service.bubbleOf(speaker.identifier)?.speech).toEqual({
      kind: 'stamp',
      imageIdentifier: 'stamp-image',
      name: 'いいね',
    });
    service.show(say('🎉'));
    expect(service.bubbleOf(speaker.identifier)?.speech).toEqual({ kind: 'emoji', text: '🎉' });
  });

  it('stays off until the room turns it on', () => {
    Config.instance.showsOverheadSpeech = false;
    expect(service.show(say('「hi」'))).toBe(false);
  });

  it('never shows direct, secret, or system lines, even to their own sender', () => {
    expect(service.show(say('「psst」', { to: 'me' }))).toBe(false);
    expect(service.show(say('「psst」', { from: 'me', to: 'someone' }))).toBe(false);
    expect(service.show(say('「roll」', { tag: 'secret' }))).toBe(false);
    expect(service.show(say('「6」', { tag: 'system' }))).toBe(false);
    expect(service.show(say('「notice」', { tag: 'system-message' }))).toBe(false);
    expect(service.show(say('「notice」', { tag: 'to-pl-system-message' }))).toBe(false);
    expect(service.bubbleOf(speaker.identifier)).toBeNull();
  });

  it('does not show a line from a tab the reader cannot view', () => {
    vi.spyOn(PeerCursor, 'myRole', 'get').mockReturnValue(PeerRole.Player);
    tab.plCanView = false;
    expect(service.show(say('「GM only」'))).toBe(false);
  });

  it('does not show a line said as a participant rather than a piece', () => {
    expect(service.show(say('「hi」', { sendFrom: 'some-peer-cursor' }))).toBe(false);
  });

  it('replaces the prior bubble on the same piece and restarts its lifetime', () => {
    service.show(say('「first」'));
    const first = service.bubbleOf(speaker.identifier)!;
    vi.advanceTimersByTime(2500);
    service.show(say('「second」'));
    const second = service.bubbleOf(speaker.identifier)!;
    expect(second.speech).toEqual({ kind: 'text', text: 'second' });
    expect(second.key).not.toBe(first.key);
    vi.advanceTimersByTime(2500);
    expect(service.bubbleOf(speaker.identifier)).not.toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(service.bubbleOf(speaker.identifier)).toBeNull();
  });

  it('takes a bubble down once its line may no longer be seen', () => {
    const line = say('「hi」');
    service.show(line);
    line.tag = 'secret';
    service.recheck();
    expect(service.bubbleOf(speaker.identifier)).toBeNull();

    service.show(say('「again」'));
    Config.instance.showsOverheadSpeech = false;
    service.recheck();
    expect(service.bubbleOf(speaker.identifier)).toBeNull();
  });

  it('writes nothing into the chat log', () => {
    const line = say('「hi」');
    const before = line.toAttributes();
    service.show(line);
    expect(line.toAttributes()).toEqual(before);
    expect(tab.chatMessages).toHaveLength(1);
  });
});
