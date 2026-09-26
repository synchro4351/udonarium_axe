import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { DEFAULT_REACTION_EMOJIS } from '@axe/domain/chat/chat-reaction';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { ChatMessageReactionsComponent } from '@axe/features/chat/chat-message-reactions/chat-message-reactions.component';
import { beMyself } from '@axe/testing/peer-context-stub';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('ChatMessageReactionsComponent', () => {
  let fixture: ComponentFixture<ChatMessageReactionsComponent>;
  let tab: ChatTab;
  let permission: RolePermissionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ChatMessageReactionsComponent],
      providers: [...TEST_PROVIDERS],
    });
    beMyself('alice');
    permission = TestBed.inject(RolePermissionService);
    vi.spyOn(permission, 'myRole', 'get').mockReturnValue(PeerRole.Player);
    vi.spyOn(permission, 'canSeeHidden', 'get').mockReturnValue(false);
    tab = new ChatTab();
    tab.initialize();
    fixture = TestBed.createComponent(ChatMessageReactionsComponent);
  });

  afterEach(() => {
    fixture.destroy();
    tab.destroy();
    vi.restoreAllMocks();
  });

  function show(extra: Partial<Record<'to' | 'tag', string>> = {}, readOnly = false): ChatMessage {
    const message = tab.addMessage({ from: 'bob', name: 'ボブ', text: 'やあ', timestamp: 1000, ...extra });
    fixture.componentRef.setInput('message', message);
    fixture.componentRef.setInput('readOnly', readOnly);
    fixture.detectChanges();
    return message;
  }

  function settle(): Promise<void> {
    // change notices go out on a microtask
    return Promise.resolve().then(() => fixture.detectChanges());
  }

  const chips = () =>
    [...fixture.nativeElement.querySelectorAll('[data-testid="chat-reaction-chip"]')] as HTMLElement[];
  const query = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  it('draws nothing under a line nobody reacted to', () => {
    show();
    expect(query('chat-reactions')).toBeNull();
  });

  it('opens a small picker, and a chosen emoji becomes a chip marked as the reader’s', async () => {
    const message = show();

    fixture.componentInstance.openPicker();
    fixture.detectChanges();
    const choices = [
      ...fixture.nativeElement.querySelectorAll('[data-testid="chat-reaction-choice"]'),
    ] as HTMLElement[];
    expect(choices.map((choice) => choice.textContent?.trim())).toEqual([...DEFAULT_REACTION_EMOJIS]);

    choices[0].click();
    await settle();

    expect(query('chat-reaction-picker')).toBeNull();
    expect(message.hasReactionBy('alice', '👍')).toBe(true);
    expect(chips()).toHaveLength(1);
    expect(chips()[0].textContent).toContain('👍');
    expect(chips()[0].textContent).toContain('1');
    expect(chips()[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('counts others and takes the reader’s own back when their chip is pressed again', async () => {
    const message = show();
    message.toggleReaction('bob', '👍');
    message.toggleReaction('alice', '👍');
    await settle();
    expect(chips()[0].textContent).toContain('2');

    chips()[0].click();
    await settle();

    expect(message.hasReactionBy('alice', '👍')).toBe(false);
    expect(chips()[0].textContent).toContain('1');
    expect(chips()[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('joins in on another reader’s emoji with one press', async () => {
    const message = show();
    message.toggleReaction('bob', '🎉');
    await settle();

    chips()[0].click();
    await settle();

    expect(message.hasReactionBy('alice', '🎉')).toBe(true);
    expect(chips()[0].textContent).toContain('2');
  });

  it('shows nothing of a whisper between others', async () => {
    const whisper = show({ to: 'carol' });
    whisper.toggleReaction('carol', '❤️');
    await settle();

    expect(query('chat-reactions')).toBeNull();
    fixture.componentInstance.openPicker();
    fixture.detectChanges();
    expect(query('chat-reaction-picker')).toBeNull();
  });

  it('shows nothing of a secret roll kept from the reader', async () => {
    const secret = show({ tag: 'secret' });
    secret.toggleReaction('bob', '😮');
    await settle();

    expect(query('chat-reactions')).toBeNull();
  });

  it('only shows the counts in a window that just follows the log', async () => {
    const message = show({}, true);
    message.toggleReaction('bob', '👍');
    await settle();

    expect(chips()).toHaveLength(1);
    expect(chips()[0].tagName).toBe('SPAN');
    expect(query('chat-reaction-add')).toBeNull();
  });

  it('closes the picker on Escape', () => {
    show();
    fixture.componentInstance.openPicker();
    fixture.detectChanges();

    query('chat-reaction-picker')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(query('chat-reaction-picker')).toBeNull();
  });

  describe('search', () => {
    const choiceTexts = () =>
      ([...fixture.nativeElement.querySelectorAll('[data-testid="chat-reaction-choice"]')] as HTMLElement[]).map(
        (choice) => choice.textContent?.trim()
      );
    const search = () => query('chat-reaction-search') as HTMLInputElement;

    function openAndType(text: string): void {
      fixture.componentInstance.openPicker();
      fixture.detectChanges();
      search().value = text;
      search().dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
    }

    function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
      (document.activeElement ?? search()).dispatchEvent(event);
      fixture.detectChanges();
      return event;
    }

    it('offers a labelled search field beside the quick choices', () => {
      show();
      fixture.componentInstance.openPicker();
      fixture.detectChanges();

      expect(search()).not.toBeNull();
      expect(search().getAttribute('aria-label')).toBeTruthy();
      expect(choiceTexts()).toEqual([...DEFAULT_REACTION_EMOJIS]);
    });

    it('finds emoji by name in English and Japanese, beyond the quick choices', () => {
      show();
      openAndType('Dice');
      expect(choiceTexts()).toEqual(['🎲']);

      search().value = 'ドラゴン';
      search().dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      expect(choiceTexts()).toEqual(['🐉']);
    });

    it('leaves a found emoji when it is tapped', async () => {
      const message = show();
      openAndType('fire');

      (query('chat-reaction-choice') as HTMLElement).click();
      await settle();

      expect(message.hasReactionBy('alice', '🔥')).toBe(true);
      expect(query('chat-reaction-picker')).toBeNull();
    });

    it('offers a pasted emoji that is not in the list and leaves it on Enter', async () => {
      const message = show();
      openAndType(' 🦄 ');
      expect(choiceTexts()).toEqual(['🦄']);

      search().focus();
      const enter = press('Enter');
      await settle();

      expect(enter.defaultPrevented).toBe(true);
      expect(message.hasReactionBy('alice', '🦄')).toBe(true);
      expect(query('chat-reaction-picker')).toBeNull();
    });

    it('takes emoji built from several code points as one', () => {
      show();
      for (const emoji of ['👍🏽', '🇯🇵', '👨‍👩‍👧', '1️⃣']) {
        openAndType(emoji);
        expect(choiceTexts()).toEqual([emoji]);
        fixture.componentInstance.togglePicker();
        fixture.detectChanges();
      }
    });

    it('never offers text or a run of several emoji, and says nothing was found', async () => {
      const message = show();
      for (const text of ['hello there', 'x👍', '👍👍']) {
        openAndType(text);
        expect(choiceTexts()).toEqual([]);
        expect(query('chat-reaction-search-status')!.textContent!.trim()).not.toBe('');

        search().focus();
        press('Enter');
        await settle();
        expect(query('chat-reaction-picker')).not.toBeNull();
        fixture.componentInstance.togglePicker();
        fixture.detectChanges();
      }
      expect(message.reactionsFor('alice')).toEqual([]);
    });

    it('leaves Enter that ends an IME composition alone', async () => {
      const message = show();
      openAndType('ほし');

      search().focus();
      press('Enter', { isComposing: true });
      await settle();

      expect(query('chat-reaction-picker')).not.toBeNull();
      expect(message.reactionsFor('alice')).toEqual([]);
    });

    it('steps from the field into the choices with the down arrow', () => {
      show();
      openAndType('heart');

      search().focus();
      const down = press('ArrowDown');

      expect(down.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(query('chat-reaction-choice'));
    });

    it('starts empty each time the picker opens', () => {
      show();
      openAndType('fire');
      fixture.componentInstance.togglePicker();
      fixture.detectChanges();
      fixture.componentInstance.openPicker();
      fixture.detectChanges();

      expect(search().value).toBe('');
      expect(choiceTexts()).toEqual([...DEFAULT_REACTION_EMOJIS]);
    });

    it('puts focus on the first quick choice when it opens, not on the field', async () => {
      show();
      fixture.componentInstance.openPicker();
      await fixture.whenStable();

      expect(document.activeElement).toBe(query('chat-reaction-choice'));
      expect(document.activeElement).not.toBe(search());
    });

    it('hands focus back to the add button on Escape', async () => {
      const message = show();
      message.toggleReaction('bob', '👍');
      await settle();
      openAndType('fire');

      search().focus();
      press('Escape');
      await fixture.whenStable();

      expect(query('chat-reaction-picker')).toBeNull();
      expect(document.activeElement).toBe(query('chat-reaction-add'));
    });
  });
});
