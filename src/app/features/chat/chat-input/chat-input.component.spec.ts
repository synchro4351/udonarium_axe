import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { TabletopDisplayService } from '@axe/application/tabletop/tabletop-display.service';
import { VisionService } from '@axe/application/tabletop/vision.service';
import { PanelService } from '@axe/application/ui/panel.service';
import { UiSignalService } from '@axe/application/ui/ui-signal.service';
import { ViewModePreferenceService } from '@axe/application/ui/view-mode-preference.service';
import { Network } from '@axe/core/network/network';
import { localDispatch } from '@axe/core/network/network-messaging';
import { ObjectStore } from '@axe/core/sync/object-store';
import { GameCharacter } from '@axe/domain/character/game-character';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { OPEN_STAMP_RULES, withStampsAllowed, withStampUseOn } from '@axe/domain/chat/stamp-rules';
import { DataElement } from '@axe/domain/data/data-element';
import { DiceStage } from '@axe/domain/dice/dice-3d/dice-stage';
import { DiceBot } from '@axe/domain/dice/dice-bot';
import { StampItem, StampPack } from '@axe/domain/media/stamp-pack';
import { Config } from '@axe/domain/peer/config';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { ChatComposeService } from '@axe/features/chat/chat-compose.service';
import { ChatInputComponent } from '@axe/features/chat/chat-input/chat-input.component';
import { StampPickerService } from '@axe/features/chat/stamp/stamp-picker.service';
import { RoomPanelService } from '@axe/features/panels/room-panel.service';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

type Outgoing = Parameters<Parameters<ChatInputComponent['chat']['subscribe']>[0]>[0];

/** A panel of its own around one input, which is what a chat window is as far as this cares. */
@Component({
  selector: 'panel-host',
  imports: [ChatInputComponent],
  template: '<chat-input [canSpeak]="true"></chat-input>',
  providers: [ChatComposeService],
})
class PanelHostComponent {}

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

  it('moves a whisper onto the cursor its target came back on, once the one it left is taken away', () => {
    const before = new PeerCursor('bob-before');
    before.initialize();
    before.userId = 'user-bob';
    const after = new PeerCursor('bob-after');
    after.initialize();
    after.userId = 'user-bob';
    try {
      component.sendTo = 'bob-before';

      ObjectStore.instance.remove(before);
      localDispatch('DELETE_GAME_OBJECT', { aliasName: PeerCursor.aliasName, identifier: 'bob-before' }, 'peer-b');

      expect(component.sendTo).toBe('bob-after');
    } finally {
      ObjectStore.instance.remove(after);
    }
  });

  it('sends a guest’s lines in the guest’s own colours, which their colour panel sets, not the piece’s', () => {
    const character = speaker('ヒロ');
    const role = PeerCursor.myCursor.role;
    const colors = PeerCursor.myCursor.chatColorCode;
    PeerCursor.myCursor.chatColorCode = ['#abcdef', '#abcdef', '#abcdef'];
    try {
      component.sendFrom = character.identifier;
      expect(component.chatColor(0)).toBe('#111111');

      PeerCursor.myCursor.role = PeerRole.Guest;
      expect(component.chatColor(0)).toBe('#abcdef');
    } finally {
      PeerCursor.myCursor.role = role;
      PeerCursor.myCursor.chatColorCode = colors;
      character.destroy();
    }
  });

  it('sets a guest speaking as a piece the colours of their own lines, not the piece’s', () => {
    const character = speaker('ヒロ');
    const opened: { tabletopObject?: unknown }[] = [];
    vi.spyOn(TestBed.inject(PanelService), 'open').mockImplementation(() => {
      const panel = {};
      opened.push(panel);
      return panel as never;
    });
    const role = PeerCursor.myCursor.role;
    try {
      component.sendFrom = character.identifier;
      component.showColorSetting();
      expect(opened[0].tabletopObject).toBe(character);

      vi.spyOn(TestBed.inject(PanelService), 'closeSingle').mockReturnValue(false);
      PeerCursor.myCursor.role = PeerRole.Guest;
      component.showColorSetting();
      expect(opened[1].tabletopObject).toBeNull();
    } finally {
      PeerCursor.myCursor.role = role;
      character.destroy();
      vi.restoreAllMocks();
    }
  });

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

  describe('the seats to whisper to', () => {
    it('offers on a room server this seat and the seats logged in, and no seat whose id anybody may take', () => {
      vi.spyOn(Network, 'authorityPeerId', 'get').mockReturnValue('@authority');
      const guest = new PeerCursor();
      guest.initialize();
      guest.userId = 'guest-tab';
      guest.role = PeerRole.Guest;
      const player = new PeerCursor();
      player.initialize();
      player.userId = 'acct_player';
      player.role = PeerRole.Player;
      try {
        expect(component.otherPeers).toContain(PeerCursor.myCursor);
        expect(component.otherPeers).toContain(player);
        expect(component.otherPeers).not.toContain(guest);
      } finally {
        guest.destroy();
        player.destroy();
      }
    });

    it('keeps offering on a room server the seat already whispered to, so that it can be put back to everyone', () => {
      vi.spyOn(Network, 'authorityPeerId', 'get').mockReturnValue('@authority');
      const guest = new PeerCursor();
      guest.initialize();
      guest.userId = 'old-account';
      guest.role = PeerRole.Guest;
      try {
        component.sendTo = guest.identifier;
        expect(component.otherPeers).toContain(guest);
      } finally {
        guest.destroy();
      }
    });

    it('offers among peers every seat', () => {
      vi.spyOn(Network, 'authorityPeerId', 'get').mockReturnValue(null);
      const guest = new PeerCursor();
      guest.initialize();
      guest.userId = 'guest-tab';
      guest.role = PeerRole.Guest;
      try {
        expect(component.otherPeers).toContain(guest);
      } finally {
        guest.destroy();
      }
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

  describe('two inputs, each in a panel of its own', () => {
    /** An input standing in a panel that asks it things, as a chat window does. */
    function inPanel(): { input: ChatInputComponent; asked: ChatComposeService; box: HTMLTextAreaElement } {
      const panel = TestBed.createComponent(PanelHostComponent);
      panel.detectChanges();
      const input = panel.debugElement.query((node) => node.componentInstance instanceof ChatInputComponent);
      return {
        input: input.componentInstance as ChatInputComponent,
        asked: panel.debugElement.injector.get(ChatComposeService),
        box: panel.nativeElement.querySelector('textarea') as HTMLTextAreaElement,
      };
    }

    it('answers in the panel that was asked, and leaves the other one alone', () => {
      const message = new ChatMessage();
      message.initialize();
      const one = inPanel();
      const other = inPanel();

      one.asked.requestReply(message.identifier);
      TestBed.tick();

      expect(one.input.replyTarget()).toBe(message);
      expect(other.input.replyTarget()).toBeNull();
      message.destroy();
    });

    it('quotes in the panel that was asked, and leaves the other one alone', () => {
      const message = new ChatMessage();
      message.initialize();
      const one = inPanel();
      const other = inPanel();

      other.asked.requestQuote(message.identifier);
      TestBed.tick();

      expect(other.input.quoteTarget()).toBe(message);
      expect(one.input.quoteTarget()).toBeNull();
      message.destroy();
    });

    it('puts the caret in the box of the panel that was asked', () => {
      const message = new ChatMessage();
      message.initialize();
      const one = inPanel();
      const other = inPanel();
      const asked = vi.spyOn(one.box, 'focus');
      const alone = vi.spyOn(other.box, 'focus');

      one.asked.requestReply(message.identifier);
      TestBed.tick();

      expect(asked).toHaveBeenCalled();
      expect(alone).not.toHaveBeenCalled();
      message.destroy();
    });
  });

  describe('the button to choose how this seat’s dice look', () => {
    const button = () =>
      fixture.nativeElement.querySelector('[data-testid="chat-my-dice"]') as HTMLButtonElement | null;
    let stageBefore: DiceStage;

    beforeEach(() => {
      stageBefore = Config.instance.diceStage;
    });

    afterEach(() => {
      Config.instance.diceStage = stageBefore;
    });

    it('is offered only while the room shows its rolls’ dice', async () => {
      Config.instance.diceStage = 'off';
      fixture.detectChanges();
      await fixture.whenStable();
      expect(button()).toBeNull();

      Config.instance.diceStage = 'frame';
      fixture.detectChanges();
      await fixture.whenStable();
      expect(button()).not.toBeNull();
    });

    it('is not offered to a guest, who is not offered the panel', async () => {
      const role = PeerCursor.myCursor.role;
      PeerCursor.myCursor.role = PeerRole.Guest;
      try {
        Config.instance.diceStage = 'frame';
        fixture.detectChanges();
        await fixture.whenStable();
        expect(button()).toBeNull();
      } finally {
        PeerCursor.myCursor.role = role;
      }
    });

    it('opens the panel for it', async () => {
      const open = vi.spyOn(TestBed.inject(RoomPanelService), 'open').mockImplementation(() => undefined);
      Config.instance.diceStage = 'both';
      fixture.detectChanges();
      await fixture.whenStable();

      button()!.click();

      expect(open).toHaveBeenCalledWith('myDice');
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

    it('empties the box when Enter comes before the typing has been drawn', async () => {
      fixture.componentRef.setInput('canSpeak', true);
      await fixture.whenStable();
      const box = (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>('textarea.chat-input')!;
      const outgoing = sent();

      box.value = '雑談1';
      box.dispatchEvent(new Event('input'));
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await fixture.whenStable();

      expect((await outgoing).text).toBe('雑談1');
      expect(box.value).toBe('');
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

    it('offers a guest no ticker, the band being on everybody else’s screen', () => {
      TestBed.inject(TabletopDisplayService).set({ multiAngleTickerEnabled: true });
      TestBed.inject(ViewModePreferenceService).choose('flat');
      PeerCursor.myCursor.role = PeerRole.Guest;
      TestBed.inject(ObjectChangeService).notifyChanged(PeerCursor.myCursor.identifier);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="chat-send-to-ticker"]')).toBeNull();
      expect(component.showsTickerSwitch()).toBe(false);
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

    it('opens the stamps beside the send button, and sends the one picked on its own from an empty box', () => {
      fixture.componentRef.setInput('canSpeak', true);
      fixture.detectChanges();
      component.text = '';
      const toggle = vi.spyOn(TestBed.inject(StampPickerService), 'toggle').mockImplementation(() => undefined);
      const emitted: Outgoing[] = [];
      component.chat.subscribe((value) => emitted.push(value));

      const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        '[data-testid="chat-input-stamp"]'
      )!;
      button.click();
      expect(toggle).toHaveBeenCalledWith(button, 'line', expect.any(Function));
      toggle.mock.calls[0][2]('seal:ok');

      expect(emitted).toEqual([
        expect.objectContaining({
          text: '',
          stamp: { id: 'seal:ok', words: expect.any(String) },
          gameSystem: null,
          replyTo: '',
          toTicker: false,
        }),
      ]);
      expect(emitted[0].stamp!.words.length).toBeGreaterThan(0);
    });

    it('sends the one picked under the words in the box, as the send button sends them, and clears the box', async () => {
      fixture.componentRef.setInput('canSpeak', true);
      fixture.detectChanges();
      component.text = 'いくぞ！';
      const outgoing = sent();

      component.sendStamp('roll:critical');

      expect(component.text).toBe('');
      expect(await outgoing).toEqual(
        expect.objectContaining({
          text: 'いくぞ！',
          gameSystem,
          stamp: { id: 'roll:critical', words: expect.any(String) },
        })
      );
      expect(DiceBot.gameSystemForLineAsync).toHaveBeenCalledWith(component.gameType, 'いくぞ！');
    });

    it('keeps the picker button visible when room rules deny all stamps, and sends none it denies', () => {
      fixture.componentRef.setInput('canSpeak', true);
      const config = Config.instance;
      config.stampRules = withStampsAllowed(OPEN_STAMP_RULES, 'line', ['roll:critical'], false);
      try {
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-testid="chat-input-stamp"]')).not.toBeNull();
        const emitted = vi.fn();
        component.chat.subscribe(emitted);
        component.text = 'いくぞ！';

        component.sendStamp('roll:critical');
        expect(emitted).not.toHaveBeenCalled();
        expect(component.text).toBe('いくぞ！');

        config.stampRules = withStampUseOn(OPEN_STAMP_RULES, 'line', false);
        TestBed.inject(ObjectChangeService).notifyChanged('Config');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-testid="chat-input-stamp"]')).toBeNull();
      } finally {
        config.stampRules = OPEN_STAMP_RULES;
      }
    });

    it('sends no stamp from a seat that may not speak', () => {
      fixture.componentRef.setInput('canSpeak', false);
      fixture.detectChanges();
      component.text = 'いくぞ！';
      const emitted = vi.fn();
      component.chat.subscribe(emitted);

      component.sendStamp('roll:critical');

      expect(emitted).not.toHaveBeenCalled();
      expect(component.text).toBe('いくぞ！');
    });

    it('sends no stamp this version does not know', () => {
      fixture.componentRef.setInput('canSpeak', true);
      const emitted = vi.fn();
      component.chat.subscribe(emitted);

      component.sendStamp('sfx:from-a-newer-version');

      expect(emitted).not.toHaveBeenCalled();
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
    let lines: Outgoing[];

    function makePack(name: string, items: StampItem[]): StampPack {
      const pack = new StampPack();
      pack.name = name;
      pack.initialize();
      pack.setItems(items);
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

    const sentStamps = () => lines.filter((line) => line.stamp !== undefined);
    const suggestionNames = () =>
      findAll('[data-testid="chat-stamp-suggestion"]').map((row) => row.textContent!.replace(/\s+/g, ' ').trim());

    beforeEach(async () => {
      lines = [];
      component.chat.subscribe((line) => lines.push(line));
      makePack('Faces', [stampItem('smile', 'Smile', ['smile', 'happy']), stampItem('smirk', 'Smirk', ['smirk'])]);
      makePack('Animals', [stampItem('cat', 'Cat smile', ['smile'])]);
      fixture.componentRef.setInput('offersStamps', true);
      await settle();
    });

    afterEach(() => {
      for (const pack of packs.splice(0)) pack.destroy();
    });

    it('keeps the shared stamp picker separate from inline suggestions when a host has not asked for suggestions', async () => {
      fixture.componentRef.setInput('offersStamps', false);
      await settle();

      expect(find('[data-testid="chat-input-stamp"]')).not.toBeNull();
      await type(':smi');
      expect(find('[data-testid="chat-stamp-suggestions"]')).toBeNull();
    });

    it('offers no inline suggestions to a seat that may not speak', async () => {
      await type(':smi');
      fixture.componentRef.setInput('canSpeak', false);
      await settle();

      expect(find('[data-testid="chat-input-stamp"]')).toBeNull();
      expect(component.stampSuggestions()).toEqual([]);
    });

    describe('writing tools', () => {
      async function openTools(): Promise<void> {
        find<HTMLButtonElement>('[data-testid="chat-writing-tools"]')!.click();
        await settle();
      }

      it('offers the emoji and syntax tabs without a second stamp picker', async () => {
        await openTools();
        expect(findAll('[data-testid="chat-stamp-tab"]').map((tab) => tab.textContent!.trim())).toEqual([
          '絵文字',
          '特殊記法',
        ]);
        expect(findAll('[data-testid="chat-emoji-choice"]').length).toBeGreaterThan(20);
        expect(findAll('[data-testid="chat-stamp-choice"]')).toHaveLength(0);
      });

      it('puts an emoji into the line where the caret stood, and sends nothing', async () => {
        await type('ab', 1);
        await openTools();
        find<HTMLButtonElement>('[data-testid="chat-emoji-choice"][aria-label="🎲"]')!.click();
        await settle();

        expect(component.text).toBe('a🎲b');
        expect(lines).toEqual([]);
        expect(component.isStampPickerOpen()).toBe(false);
      });

      it('inserts syntax around the selected words without sending', async () => {
        await type('今日は晴天です', 5);
        textBox().setSelectionRange(3, 5);
        await openTools();
        findAll('[data-testid="chat-stamp-tab"]')[1].click();
        await settle();
        find<HTMLButtonElement>('[data-testid="chat-syntax-choice"][data-syntax="ruby"]')!.click();
        await settle();

        expect(component.text).toBe('今日は|晴天<かんじ>です');
        expect(lines).toEqual([]);
      });
    });
    describe('suggestions for a plain word', () => {
      it('offers a stamp saved under the whole word, with no colon', async () => {
        await type('smirk');
        expect(suggestionNames()).toEqual(['smirk smirk']);

        await type('smi');
        expect(find('[data-testid="chat-stamp-suggestions"]')).toBeNull();
      });

      it('offers the tool’s own stamps by any of their words', async () => {
        await type('ドンマイ');

        expect(suggestionNames()).toEqual(['ドンマイ ドンマイ']);
      });

      it('sends the line as written on Enter unless a stamp was picked out', async () => {
        await type('smirk');
        const line = sent();
        await press('Enter');

        expect((await line).text).toBe('smirk');
        expect(sentStamps()).toEqual([]);
      });

      it('sends the stamp picked out with the arrows, taking the word out of the line', async () => {
        await type('smirk');
        await press('ArrowDown');
        await press('Enter');
        await Promise.resolve();

        expect(sentStamps().map((line) => line.stamp?.id)).toEqual(['image:image-smirk']);
        expect(component.text).toBe('');
      });

      it('leaves the arrows to an IME that is composing', async () => {
        await type('smirk');
        const down = await press('ArrowDown', { isComposing: true });

        expect(down.defaultPrevented).toBe(false);
        expect(component.activeSuggestion()).toBe(-1);
      });
    });

    describe('suggestions from the speaker’s chat palette', () => {
      let hero: GameCharacter;

      beforeEach(async () => {
        hero = speaker('勇者');
        hero.chatPalette!.setPalette('◆戦闘\n//武器=2\n2d6+{武器} 攻撃\n2d6 回避\n1d100<=50 攻撃判定');
        fixture.componentRef.setInput('suggestsPalette', true);
        component.sendFrom = hero.identifier;
        await settle();
      });

      afterEach(() => hero.destroy());

      it('offers the palette lines holding what is written, leaving headings and variables out', async () => {
        await type('攻撃');

        expect(
          findAll('[data-testid="chat-palette-suggestion"] .truncate').map((row) => row.textContent!.trim())
        ).toEqual(['2d6+{武器} 攻撃', '1d100<=50 攻撃判定']);
      });

      it('takes the line picked out into the box on Enter, sending nothing until Enter again', async () => {
        await type('回避');
        await press('ArrowDown');
        await press('Enter');

        expect(component.text).toBe('2d6 回避');
        expect(lines).toEqual([]);
        expect(sentStamps()).toEqual([]);
        expect(find('[data-testid="chat-stamp-suggestions"]')).toBeNull();

        const line = sent();
        await press('Enter');
        expect((await line).text).toBe('2d6 回避');
      });

      it('takes a tapped line into the box', async () => {
        await type('回避');
        find<HTMLButtonElement>('[data-testid="chat-palette-suggestion"]')!.click();
        await settle();

        expect(component.text).toBe('2d6 回避');
        expect(lines).toEqual([]);
      });

      it('offers nothing from a palette while this seat speaks as itself', async () => {
        component.sendFrom = PeerCursor.myCursor.identifier;
        await type('攻撃');

        expect(component.paletteSuggestions()).toEqual([]);
      });

      it('offers nothing from a palette to a host that has not asked for it', async () => {
        fixture.componentRef.setInput('suggestsPalette', false);
        await type('攻撃');

        expect(component.paletteSuggestions()).toEqual([]);
      });
    });

    describe('suggestions for a :word', () => {
      it('offers the stamps saved under words that start with it, naming the pack where two collide', async () => {
        await type('いいね :smi');

        expect(suggestionNames()).toEqual(['smile :smile · Faces', 'smirk :smirk', 'smile :smile · Animals']);
      });

      it('offers the tool’s own stamps after the room’s, by their phrase', async () => {
        await type(':いいね');

        expect(suggestionNames()).toEqual(['いいね！ :いいね']);
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
        expect(sentStamps()).toEqual([]);
      });

      it('sends the stamp picked out with the arrows on Enter, once, in place of the :word', async () => {
        await type('hi :smirk');
        const down = await press('ArrowDown');
        await press('Enter');
        await Promise.resolve();

        expect(down.defaultPrevented).toBe(true);
        expect(sentStamps()).toHaveLength(1);
        expect(sentStamps()[0].stamp?.id).toBe('image:image-smirk');
        expect(sentStamps()[0].text).toBe('hi');
        expect(component.text).toBe('');
      });

      it('sends the stamp tapped in the list', async () => {
        await type(':happy');
        find<HTMLButtonElement>('[data-testid="chat-stamp-suggestion"]')!.click();
        await settle();

        expect(sentStamps().map((line) => line.stamp?.id)).toEqual(['image:image-smile']);
        expect(component.text).toBe('');
      });

      it('leaves an Enter composing text in an IME to the IME', async () => {
        await type(':smirk');
        await press('ArrowDown');
        await press('Enter', { isComposing: true });

        expect(sentStamps()).toEqual([]);
        expect(component.text).toBe(':smirk');
      });

      it('puts the list away on Escape until the word changes', async () => {
        await type(':smi');
        const escape = await press('Escape');

        expect(escape.defaultPrevented).toBe(true);
        expect(find('[data-testid="chat-stamp-suggestions"]')).toBeNull();

        await type(':smir');
        expect(suggestionNames()).toEqual(['smirk :smirk']);
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
