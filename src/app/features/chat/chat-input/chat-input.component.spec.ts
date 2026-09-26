import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabletopDisplayService } from '@axe/application/tabletop/tabletop-display.service';
import { VisionService } from '@axe/application/tabletop/vision.service';
import { UiSignalService } from '@axe/application/ui/ui-signal.service';
import { ViewModePreferenceService } from '@axe/application/ui/view-mode-preference.service';
import { GameCharacter } from '@axe/domain/character/game-character';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { ChatStampOutgoing } from '@axe/domain/chat/chat-outgoing';
import { DataElement } from '@axe/domain/data/data-element';
import { DiceBot } from '@axe/domain/dice/dice-bot';
import { StampItem, StampPack } from '@axe/domain/media/stamp-pack';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { ChatInputComponent } from '@axe/features/chat/chat-input/chat-input.component';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

type Outgoing = Parameters<Parameters<ChatInputComponent['chat']['subscribe']>[0]>[0];

describe('ChatInputComponent', () => {
  let component: ChatInputComponent;
  let fixture: ComponentFixture<ChatInputComponent>;
  const gameSystem = { ID: 'DiceBot' } as unknown as Awaited<ReturnType<typeof DiceBot.loadGameSystemAsync>>;

  beforeEach(async () => {
    PeerCursor.createMyCursor();
    TestBed.configureTestingModule({
      imports: [ChatInputComponent],
      providers: [...TEST_PROVIDERS],
    }).compileComponents();
  });

  beforeEach(() => {
    vi.spyOn(DiceBot, 'gameSystemForLineAsync').mockResolvedValue(gameSystem);
    fixture = TestBed.createComponent(ChatInputComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function sent(): Promise<Outgoing> {
    return new Promise((resolve) => component.chat.subscribe(resolve));
  }

  function speaker(name: string): GameCharacter {
    const character = GameCharacter.create(name, 1, '');
    character.chatColorCode = ['#111111', '#222222', '#333333'];
    character.chatBubbleLight = ['#aaaaaa', '#bbbbbb', '#cccccc'];
    character.chatBubbleDark = ['#444444', '#555555', '#666666'];
    return character;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('the portrait slider', () => {
    function withPortraits(count: number): GameCharacter {
      const character = speaker('役者');
      for (let index = character.imageDataElement!.children.length; index < count; index++) {
        character.imageDataElement!.appendChild(
          DataElement.create('imageIdentifier', `face-${index}`, { type: 'image' })
        );
      }
      return character;
    }

    const slider = () =>
      fixture.nativeElement.querySelector(
        '[data-testid="chat-input-portraits"] input[type="range"]'
      ) as HTMLInputElement | null;

    async function speakAs(character: GameCharacter): Promise<void> {
      component.sendFrom = character.identifier;
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('runs through the portraits of a speaker with several, beside the colours', async () => {
      await speakAs(withPortraits(3));

      expect(slider()?.max).toBe('2');
      expect(slider()?.closest('[data-testid="chat-input-colors"]')).not.toBeNull();
    });

    it('speaks with the portrait the knob is moved to', async () => {
      const character = withPortraits(3);
      await speakAs(character);

      slider()!.value = '2';
      slider()!.dispatchEvent(new Event('input'));

      expect(component.portraitIndex).toBe(2);
      expect(character.selectedPortraitIndex).toBe(2);
    });

    it('is left out for a speaker with only one portrait to show', async () => {
      await speakAs(withPortraits(1));

      expect(slider()).toBeNull();
    });
  });

  describe('the characters on offer', () => {
    it('leaves out a piece on the table this seat cannot see, but keeps the one it speaks as', () => {
      const seen = speaker('勇者');
      seen.setLocation('table');
      const unseen = speaker('闇の魔物');
      unseen.setLocation('table');
      vi.spyOn(TestBed.inject(VisionService), 'mayBeListed').mockImplementation((character) => character !== unseen);

      expect(component.gameCharacters()).toContain(seen);
      expect(component.gameCharacters()).not.toContain(unseen);

      component.sendFrom = unseen.identifier;
      expect(component.gameCharacters()).toContain(unseen);
      seen.destroy();
      unseen.destroy();
    });
  });

  describe('packed down for a panel', () => {
    function find(selector: string): Element | null {
      return (fixture.nativeElement as HTMLElement).querySelector(selector);
    }

    function textBox(): HTMLTextAreaElement {
      return find('textarea[name="chat-input-text"]') as HTMLTextAreaElement;
    }

    it('shows the colours with the dice bot, and no button to fold them, by default', () => {
      fixture.detectChanges();

      expect(find('ng-select[name="game-type"]')).not.toBeNull();
      expect(find('[data-testid="chat-input-colors"]')).not.toBeNull();
      expect(find('[data-testid="chat-input-tools"]')).toBeNull();
    });

    it('folds the colours behind a button, keeping the dice bot in view', () => {
      fixture.componentRef.setInput('dense', true);
      fixture.detectChanges();

      expect(find('ng-select[name="game-type"]')).not.toBeNull();
      expect(find('[data-testid="chat-input-colors"]')).toBeNull();

      (find('[data-testid="chat-input-tools"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(find('[data-testid="chat-input-colors"]')).not.toBeNull();
    });

    it('starts the box a line high, leaving it to grow with what is typed', () => {
      fixture.detectChanges();
      expect(textBox().getAttribute('rows')).toBeNull();

      fixture.componentRef.setInput('dense', true);
      fixture.detectChanges();

      expect(textBox().getAttribute('rows')).toBe('1');
    });

    it('says what the panel asks for in the empty box, in place of its keys', () => {
      fixture.componentRef.setInput('placeholder', '行をクリックで入力');
      fixture.detectChanges();

      expect(textBox().placeholder).toBe('行をクリックで入力');
    });
  });

  describe('an input with no box to write in', () => {
    it('takes a reply asked of every input without reaching for its missing box', () => {
      fixture.componentRef.setInput('canSpeak', false);
      fixture.detectChanges();
      const message = new ChatMessage();
      message.initialize();

      expect(() => {
        TestBed.inject(UiSignalService).requestChatReply(message.identifier);
        fixture.detectChanges();
      }).not.toThrow();

      message.destroy();
    });
  });

  describe('showing who is typing', () => {
    it('keeps no fixed strip for it under the box', () => {
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.writing-info')).toBeNull();
    });
  });

  describe('sending', () => {
    it('sends as the player with the chosen colour and bubbles when nobody else is speaking', async () => {
      fixture.detectChanges();
      const me = PeerCursor.myCursor;
      me.chatColorCode = ['#101010', '#202020', '#303030'];
      me.chatBubbleLight = ['#a1a1a1', '#b1b1b1', '#c1c1c1'];
      me.chatBubbleDark = ['#414141', '#515151', '#616161'];
      component.text = 'hello';
      component.setColorNum(2);
      const outgoing = sent();

      component.sendChat(null);

      expect(await outgoing).toEqual({
        text: 'hello',
        gameSystem,
        sendFrom: me.identifier,
        sendTo: '',
        portraitIndex: 0,
        messColor: '#303030',
        messBubbleLight: '#c1c1c1',
        messBubbleDark: '#616161',
        replyTo: '',
        quoteOf: '',
        toTicker: false,
      });
      expect(component.text).toBe('');
    });

    it('hands the line to the dice bot, which decides whether it must wait for the system', async () => {
      fixture.detectChanges();
      component.text = 'こんにちは';
      const outgoing = sent();

      component.sendChat(null);
      await outgoing;

      expect(DiceBot.gameSystemForLineAsync).toHaveBeenCalledWith(component.gameType, 'こんにちは');
    });

    it('offers the ticker only where this screen runs one, and marks the line when it is asked to', async () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="chat-send-to-ticker"]')).toBeNull();

      TestBed.inject(TabletopDisplayService).set({ multiAngleTickerEnabled: true });
      fixture.detectChanges();
      // The room runs one, but this seat is in perspective and has no band of its own.
      expect(fixture.nativeElement.querySelector('[data-testid="chat-send-to-ticker"]')).toBeNull();

      TestBed.inject(ViewModePreferenceService).choose('flat');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="chat-send-to-ticker"]')).toBeTruthy();

      component.toggleTickerSend();
      component.text = 'ラウンド開始';
      const outgoing = sent();

      component.sendChat(null);

      expect((await outgoing).toTicker).toBe(true);
    });

    it('sends as the character that was picked with its own colours', async () => {
      fixture.detectChanges();
      const character = speaker('アリス');
      component.sendFrom = character.identifier;
      component.setColorNum(1);
      component.text = 'やあ';
      const outgoing = sent();

      component.sendChat(null);

      expect(await outgoing).toMatchObject({
        sendFrom: character.identifier,
        messColor: '#222222',
        messBubbleLight: '#bbbbbb',
        messBubbleDark: '#555555',
      });
    });

    it('resolves the colour from whoever is speaking', () => {
      const character = speaker('アリス');
      PeerCursor.myCursor.chatColorCode = ['#101010', '#202020', '#303030'];

      component.sendFrom = PeerCursor.myCursor.identifier;
      expect(component.chatColor(0)).toBe('#101010');
      expect(component.characterChatColor(0)).toBe('#000000');

      component.sendFrom = character.identifier;
      expect(component.chatColor(0)).toBe('#111111');
      expect(component.characterChatColor(2)).toBe('#333333');
    });

    it('keeps the colour choice within the three slots', () => {
      component.setColorNum(7);
      expect(component.colorSelectNo()).toBe(2);

      component.setColorNum(-3);
      expect(component.colorSelectNo()).toBe(0);
    });

    it('sends on enter alone and never on another key or mid-composition', async () => {
      fixture.detectChanges();
      component.text = 'hello';
      const emitted = vi.fn();
      component.chat.subscribe(emitted);

      component.sendChat(new KeyboardEvent('keydown', { key: 'a' }));
      component.sendChat(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }));
      await Promise.resolve();
      expect(emitted).not.toHaveBeenCalled();
      expect(component.text).toBe('hello');

      component.sendChat(new KeyboardEvent('keydown', { key: 'Enter' }));
      await vi.waitFor(() => expect(emitted).toHaveBeenCalledTimes(1));
    });

    it('sends nothing while empty or while the speaker may not speak', async () => {
      fixture.componentRef.setInput('canSpeak', false);
      fixture.detectChanges();
      component.text = 'hello';
      const emitted = vi.fn();
      component.chat.subscribe(emitted);

      component.sendChat(null);
      fixture.componentRef.setInput('canSpeak', true);
      component.text = '';
      component.sendChat(null);
      await Promise.resolve();

      expect(emitted).not.toHaveBeenCalled();
    });

    it('hands enter to the completion list while one of its rows is chosen', async () => {
      fixture.componentRef.setInput('autoCompleteIndex', 3);
      fixture.detectChanges();
      component.text = 'hel';
      const emitted = vi.fn();
      const completed = vi.fn();
      component.chat.subscribe(emitted);
      component.autoCompleteDo.subscribe(completed);

      component.sendChat(null);
      await Promise.resolve();

      expect(completed).toHaveBeenCalledWith(3);
      expect(emitted).not.toHaveBeenCalled();
      expect(component.text).toBe('hel');
    });
  });

  describe('stamps and emoji', () => {
    const packs: StampPack[] = [];
    let stamps: ChatStampOutgoing[];
    let lines: Outgoing[];

    function makePack(name: string, items: StampItem[]): StampPack {
      const pack = new StampPack();
      pack.name = name;
      pack.setItems(items);
      pack.initialize();
      packs.push(pack);
      return pack;
    }

    function stampItem(id: string, name: string, words: string[]): StampItem {
      return { id, name, imageIdentifier: `image-${id}`, words };
    }

    function find<T extends Element = HTMLElement>(selector: string): T | null {
      return (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
    }

    function findAll(selector: string): HTMLElement[] {
      return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(selector));
    }

    function textBox(): HTMLTextAreaElement {
      return find<HTMLTextAreaElement>('textarea[name="chat-input-text"]')!;
    }

    async function settle(): Promise<void> {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    async function type(text: string, caret = text.length): Promise<void> {
      const box = textBox();
      box.value = text;
      box.setSelectionRange(caret, caret);
      box.dispatchEvent(new Event('input'));
      await settle();
    }

    async function press(key: string, options: KeyboardEventInit = {}): Promise<KeyboardEvent> {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
      textBox().dispatchEvent(event);
      await settle();
      return event;
    }

    const suggestionNames = () =>
      findAll('[data-testid="chat-stamp-suggestion"]').map((row) => row.textContent!.replace(/\s+/g, ' ').trim());

    beforeEach(async () => {
      stamps = [];
      lines = [];
      component.stamp.subscribe((stamp) => stamps.push(stamp));
      component.chat.subscribe((line) => lines.push(line));
      makePack('Faces', [stampItem('smile', 'Smile', ['smile', 'happy']), stampItem('smirk', 'Smirk', ['smirk'])]);
      makePack('Animals', [stampItem('cat', 'Cat smile', ['smile'])]);
      fixture.componentRef.setInput('offersStamps', true);
      await settle();
    });

    afterEach(() => {
      for (const pack of packs.splice(0)) pack.destroy();
    });

    it('offers no stamp button to a host that has not asked for stamps, such as the palette', async () => {
      fixture.componentRef.setInput('offersStamps', false);
      await settle();

      expect(find('[data-testid="chat-stamp-button"]')).toBeNull();
      await type(':smi');
      expect(find('[data-testid="chat-stamp-suggestions"]')).toBeNull();
    });

    it('offers neither the button nor suggestions to a seat that may not speak', async () => {
      await type(':smi');
      fixture.componentRef.setInput('canSpeak', false);
      await settle();

      expect(find('[data-testid="chat-stamp-button"]')).toBeNull();
      expect(component.stampSuggestions()).toEqual([]);
    });

    describe('the picker', () => {
      async function openPicker(): Promise<void> {
        find<HTMLButtonElement>('[data-testid="chat-stamp-button"]')!.click();
        await settle();
      }

      it('opens on the emoji, with a tab after it for each of the room’s packs', async () => {
        await openPicker();

        const tabs = findAll('[data-testid="chat-stamp-tab"]');
        expect(tabs.map((tab) => tab.textContent!.trim())).toEqual(['絵文字', 'Faces', 'Animals']);
        expect(tabs[0].getAttribute('aria-selected')).toBe('true');
        expect(findAll('[data-testid="chat-emoji-choice"]').length).toBeGreaterThan(20);
        expect(find('[data-testid="chat-stamp-button"]')!.getAttribute('aria-expanded')).toBe('true');
      });

      it('shows a pack’s stamps when its tab is chosen, and moves between tabs with the arrows', async () => {
        await openPicker();
        findAll('[data-testid="chat-stamp-tab"]')[1].click();
        await settle();

        expect(findAll('[data-testid="chat-stamp-choice"]').map((one) => one.getAttribute('title'))).toEqual([
          'Smile',
          'Smirk',
        ]);

        find('[role="tablist"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await settle();
        expect(findAll('[data-testid="chat-stamp-choice"]').map((one) => one.getAttribute('title'))).toEqual([
          'Cat smile',
        ]);
      });

      it('puts an emoji into the line where the caret stood, and sends nothing', async () => {
        await type('ab', 1);
        await openPicker();
        find<HTMLButtonElement>('[data-testid="chat-emoji-choice"][aria-label="🎲"]')!.click();
        await settle();

        expect(component.text).toBe('a🎲b');
        expect(stamps).toEqual([]);
        expect(lines).toEqual([]);
        expect(component.isStampPickerOpen()).toBe(false);
      });

      it('sends a picture stamp at once, once, and leaves the words being written alone', async () => {
        const target = speaker('勇者');
        component.sendFrom = target.identifier;
        component.sendTo = PeerCursor.myCursor.identifier;
        await type('まだ途中');
        await openPicker();
        findAll('[data-testid="chat-stamp-tab"]')[1].click();
        await settle();
        findAll('[data-testid="chat-stamp-choice"]')[0].click();
        await settle();

        expect(stamps).toEqual([
          expect.objectContaining({
            stampName: 'Smile',
            imageIdentifier: 'image-smile',
            sendFrom: target.identifier,
            sendTo: PeerCursor.myCursor.identifier,
            messColor: '#111111',
            messBubbleLight: '#aaaaaa',
          }),
        ]);
        expect(lines).toEqual([]);
        expect(component.text).toBe('まだ途中');
        expect(component.isStampPickerOpen()).toBe(false);
        target.destroy();
      });

      it('answers the reply being written, and lets it go once sent', async () => {
        const replied = new ChatMessage();
        replied.initialize();
        component.replyTarget.set(replied);
        await openPicker();
        findAll('[data-testid="chat-stamp-tab"]')[2].click();
        await settle();
        findAll('[data-testid="chat-stamp-choice"]')[0].click();
        await settle();

        expect(stamps[0].replyTo).toBe(replied.identifier);
        expect(component.replyTarget()).toBeNull();
        replied.destroy();
      });

      it('closes on Escape without sending, handing focus back to its button', async () => {
        await openPicker();
        find('chat-stamp-picker')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await settle();

        expect(component.isStampPickerOpen()).toBe(false);
        expect(document.activeElement).toBe(find('[data-testid="chat-stamp-button"]'));
        expect(stamps).toEqual([]);
      });
    });

    describe('suggestions for a :word', () => {
      it('offers the stamps saved under words that start with it, naming the pack where two collide', async () => {
        await type('いいね :smi');

        expect(suggestionNames()).toEqual(['Smile :smile · Faces', 'Smirk :smirk', 'Cat smile :smile · Animals']);
      });

      it('offers nothing where the colon does not stand at a clear boundary', async () => {
        await type('note:smi');
        expect(find('[data-testid="chat-stamp-suggestions"]')).toBeNull();

        await type(':smi more', 2);
        expect(find('[data-testid="chat-stamp-suggestions"]')).toBeNull();
      });

      it('sends the line as written on Enter when no stamp was picked out', async () => {
        await type('hi :smile');
        const line = sent();
        await press('Enter');

        expect((await line).text).toBe('hi :smile');
        expect(stamps).toEqual([]);
      });

      it('sends the stamp picked out with the arrows on Enter, once, in place of the :word', async () => {
        await type('hi :smirk');
        const down = await press('ArrowDown');
        await press('Enter');
        await Promise.resolve();

        expect(down.defaultPrevented).toBe(true);
        expect(stamps).toHaveLength(1);
        expect(stamps[0].stampName).toBe('Smirk');
        expect(lines).toEqual([]);
        expect(component.text).toBe('hi');
      });

      it('sends the stamp tapped in the list', async () => {
        await type(':happy');
        find<HTMLButtonElement>('[data-testid="chat-stamp-suggestion"]')!.click();
        await settle();

        expect(stamps.map((stamp) => stamp.stampName)).toEqual(['Smile']);
        expect(component.text).toBe('');
      });

      it('leaves an Enter composing text in an IME to the IME', async () => {
        await type(':smirk');
        await press('ArrowDown');
        await press('Enter', { isComposing: true });

        expect(stamps).toEqual([]);
        expect(component.text).toBe(':smirk');
      });

      it('puts the list away on Escape until the word changes', async () => {
        await type(':smi');
        const escape = await press('Escape');

        expect(escape.defaultPrevented).toBe(true);
        expect(find('[data-testid="chat-stamp-suggestions"]')).toBeNull();

        await type(':smir');
        expect(suggestionNames()).toEqual(['Smirk :smirk']);
      });

      it('lets the arrows reach the palette’s own completion when no stamp is offered', async () => {
        const switched = vi.fn();
        component.autoCompleteSwitch.subscribe(switched);
        await type('plain words');
        await press('ArrowDown');

        expect(switched).toHaveBeenCalledWith(1);
      });
    });
  });
});
