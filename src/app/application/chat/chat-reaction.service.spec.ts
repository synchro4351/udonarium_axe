import { TestBed } from '@angular/core/testing';
import { ChatReactionService } from '@axe/application/chat/chat-reaction.service';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { beMyself } from '@axe/testing/peer-context-stub';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('ChatReactionService', () => {
  let service: ChatReactionService;
  let permission: RolePermissionService;
  let tab: ChatTab;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    beMyself('alice');
    service = TestBed.inject(ChatReactionService);
    permission = TestBed.inject(RolePermissionService);
    vi.spyOn(permission, 'myRole', 'get').mockReturnValue(PeerRole.Player);
    vi.spyOn(permission, 'canSeeHidden', 'get').mockReturnValue(false);
    tab = new ChatTab();
    tab.initialize();
  });

  afterEach(() => {
    tab.destroy();
    vi.restoreAllMocks();
  });

  function say(extra: Partial<Record<'to' | 'tag' | 'from', string>> = {}): ChatMessage {
    return tab.addMessage({ from: 'bob', name: 'ボブ', text: 'やあ', timestamp: 1000, ...extra });
  }

  it('leaves and takes back the reader’s own reaction on a line said to everyone', () => {
    const message = say();

    expect(service.toggle(message, '👍')).toBe(true);
    expect(service.reactionsOf(message)).toEqual([{ emoji: '👍', count: 1, mine: true }]);
    expect(message.reactionOf('alice')).not.toBeNull();

    expect(service.toggle(message, '👍')).toBe(false);
    expect(service.reactionsOf(message)).toEqual([]);
  });

  it('shows nothing of a whisper between others, and refuses a reaction to it', () => {
    const whisper = say({ to: 'carol' });
    whisper.toggleReaction('carol', '❤️');

    expect(service.canSee(whisper)).toBe(false);
    expect(service.reactionsOf(whisper)).toEqual([]);
    expect(service.toggle(whisper, '👍')).toBe(false);
    expect(whisper.reactionOf('alice')).toBeNull();
  });

  it('shows nothing of a secret roll kept from the reader, until they may see what is kept back', () => {
    const secret = say({ tag: 'secret' });
    secret.toggleReaction('bob', '😮');

    expect(service.reactionsOf(secret)).toEqual([]);
    expect(service.toggle(secret, '👍')).toBe(false);

    vi.spyOn(permission, 'canSeeHidden', 'get').mockReturnValue(true);
    expect(service.reactionsOf(secret)).toEqual([{ emoji: '😮', count: 1, mine: false }]);
  });

  it('asks again at the moment of reacting, so a line made secret after the picker opened is refused', () => {
    const message = say();
    expect(service.canReact(message)).toBe(true);

    message.tag = 'secret';

    expect(service.toggle(message, '👍')).toBe(false);
    expect(message.reactionOf('alice')).toBeNull();
  });

  it('refuses a reaction where the reader may not speak, while still showing the others', () => {
    const message = say();
    message.toggleReaction('bob', '🎉');
    tab.plCanSpeak = false;

    expect(service.canReact(message)).toBe(false);
    expect(service.toggle(message, '👍')).toBe(false);
    expect(service.reactionsOf(message)).toEqual([{ emoji: '🎉', count: 1, mine: false }]);
  });

  it('refuses a reaction to a line that has been deleted', () => {
    const message = say();
    message.destroy();

    expect(service.toggle(message, '👍')).toBe(false);
    expect(service.reactionsOf(message)).toEqual([]);
  });
});
