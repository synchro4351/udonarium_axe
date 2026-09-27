import { TestBed } from '@angular/core/testing';
import { ChatMessageService } from '@axe/application/chat/chat-message.service';
import { OverheadSpeechService } from '@axe/application/chat/overhead-speech.service';
import { emitMessageAdded, fileLoaded$ } from '@axe/core/event/domain-events';
import { networkMessage$ } from '@axe/core/network/network-messaging';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { ChatTabList } from '@axe/domain/chat/chat-tab-list';
import { OverheadSpeechEventHandlerService } from '@axe/features/chat/overhead-speech-event-handler.service';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('OverheadSpeechEventHandlerService', () => {
  let tab: ChatTab;
  let now: number;
  const overhead = { show: vi.fn(), recheck: vi.fn(), clear: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    now = 1_000_000;
    TestBed.configureTestingModule({
      providers: [...TEST_PROVIDERS, { provide: OverheadSpeechService, useValue: overhead }],
    });
    TestBed.overrideProvider(ChatMessageService, { useValue: { getTime: () => now } });
    ChatTabList.instance.initialize();
    tab = new ChatTab();
    tab.name = 'Main';
    tab.initialize();
    ChatTabList.instance.appendChild(tab);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    tab.destroy();
  });

  it('shows a line said after it started, once', () => {
    TestBed.inject(OverheadSpeechEventHandlerService);
    now += 1000;
    const fresh = tab.addMessage({ text: '「hi」', timestamp: now });
    expect(overhead.show).toHaveBeenCalledExactlyOnceWith(fresh);
    emitMessageAdded({ tabIdentifier: tab.identifier, messageIdentifier: fresh.identifier });
    expect(overhead.show).toHaveBeenCalledTimes(1);
  });

  it('does not replay lines already in the room', () => {
    const existing = tab.addMessage({ text: '「old」', timestamp: now });
    TestBed.inject(OverheadSpeechEventHandlerService);
    emitMessageAdded({ tabIdentifier: tab.identifier, messageIdentifier: existing.identifier });
    expect(overhead.show).not.toHaveBeenCalled();
  });

  it('does not replay lines that arrive by sync after joining, loading, or reconnecting', () => {
    TestBed.inject(OverheadSpeechEventHandlerService);
    now += 60_000;
    networkMessage$.emit({ eventName: 'OPEN_NETWORK', data: {}, sendFrom: '', isSendFromSelf: true });
    tab.addMessage({ text: '「said before joining」', timestamp: now - 10_000 });
    tab.addMessage({ text: '「said long ago」', timestamp: now - 3_600_000 });
    expect(overhead.show).not.toHaveBeenCalled();

    now += 60_000;
    fileLoaded$.emit();
    tab.addMessage({ text: '「loaded」', timestamp: now - 5_000 });
    networkMessage$.emit({ eventName: 'PEER_RECONNECT', data: {}, sendFrom: '', isSendFromSelf: true });
    tab.addMessage({ text: '「missed while away」', timestamp: now - 5_000 });
    expect(overhead.show).not.toHaveBeenCalled();

    const live = tab.addMessage({ text: '「live」', timestamp: now + 100 });
    expect(overhead.show).toHaveBeenCalledExactlyOnceWith(live);
  });

  it('ignores a line dated long before now', () => {
    TestBed.inject(OverheadSpeechEventHandlerService);
    now += 120_000;
    tab.addMessage({ text: '「stale」', timestamp: now - 60_000 });
    expect(overhead.show).not.toHaveBeenCalled();
  });

  it('takes every bubble down on room close and room load', () => {
    TestBed.inject(OverheadSpeechEventHandlerService);
    overhead.clear.mockClear();
    networkMessage$.emit({ eventName: 'CLOSE_NETWORK', data: {}, sendFrom: '', isSendFromSelf: true });
    fileLoaded$.emit();
    expect(overhead.clear).toHaveBeenCalledTimes(2);
  });

  it('rechecks bubbles when a line is removed', () => {
    TestBed.inject(OverheadSpeechEventHandlerService);
    const line = tab.addMessage({ text: '「hi」', timestamp: now });
    overhead.recheck.mockClear();
    line.destroy();
    expect(overhead.recheck).toHaveBeenCalled();
  });
});
