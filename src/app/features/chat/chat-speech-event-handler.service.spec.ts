import { TestBed } from '@angular/core/testing';
import { ChatSpeechService } from '@axe/application/chat/chat-speech.service';
import { emitMessageAdded, fileLoaded$ } from '@axe/core/event/domain-events';
import { networkMessage$ } from '@axe/core/network/network-messaging';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { ChatTabList } from '@axe/domain/chat/chat-tab-list';
import { ChatSpeechEventHandlerService } from '@axe/features/chat/chat-speech-event-handler.service';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('ChatSpeechEventHandlerService', () => {
  let tab: ChatTab;
  const speech = { readAutomatically: vi.fn(), disable: vi.fn(), checkPermissions: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [...TEST_PROVIDERS, { provide: ChatSpeechService, useValue: speech }],
    });
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
  it('does not replay existing messages or duplicate notifications', () => {
    const existing = tab.addMessage({ text: 'existing', timestamp: Date.now() });
    TestBed.inject(ChatSpeechEventHandlerService);
    emitMessageAdded({ tabIdentifier: tab.identifier, messageIdentifier: existing.identifier });
    expect(speech.readAutomatically).not.toHaveBeenCalled();
    const fresh = tab.addMessage({ text: 'new', timestamp: Date.now() });
    emitMessageAdded({ tabIdentifier: tab.identifier, messageIdentifier: fresh.identifier });
    expect(speech.readAutomatically).toHaveBeenCalledExactlyOnceWith(fresh);
  });
  it('ignores historical messages received after initialization', () => {
    TestBed.inject(ChatSpeechEventHandlerService);
    tab.addMessage({ text: 'history', timestamp: Date.now() - 60_000 });
    expect(speech.readAutomatically).not.toHaveBeenCalled();
  });
  it('disables speech on room close and room load', () => {
    TestBed.inject(ChatSpeechEventHandlerService);
    networkMessage$.emit({ eventName: 'CLOSE_NETWORK', data: {}, sendFrom: '', isSendFromSelf: true });
    fileLoaded$.emit();
    expect(speech.disable).toHaveBeenCalledTimes(2);
  });
});
