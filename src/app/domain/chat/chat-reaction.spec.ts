import { TestBed } from '@angular/core/testing';
import type { ObjectContext } from '@axe/core/sync/game-object';
import { ObjectFactory } from '@axe/core/sync/object-factory';
import { ObjectSerializer } from '@axe/core/sync/object-serializer';
import { ObjectStore } from '@axe/core/sync/object-store';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import {
  ChatReaction,
  formatReactionSummary,
  isReactionEmoji,
  MAX_REACTIONS_PER_READER,
  tallyReactions,
} from '@axe/domain/chat/chat-reaction';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { beMyself } from '@axe/testing/peer-context-stub';

describe('isReactionEmoji()', () => {
  it.each(['👍', '❤️', '🇯🇵', '1️⃣', '👨‍👩‍👧', '👍🏽', '✅'])('takes %s', (emoji) => {
    expect(isReactionEmoji(emoji)).toBe(true);
  });

  it.each(['', 'good', '👍 👍', '<b>', 'a👍', '1', ' ', '👍'.repeat(20)])('refuses %j', (value) => {
    expect(isReactionEmoji(value)).toBe(false);
  });

  it('refuses what is not a string', () => {
    expect(isReactionEmoji(null)).toBe(false);
    expect(isReactionEmoji(3)).toBe(false);
  });
});

describe('tallyReactions()', () => {
  it('counts each reader once for each emoji, in the order the emoji first appear', () => {
    const counts = tallyReactions(
      [
        { owner: 'alice', emojis: ['👍', '🎉'] },
        { owner: 'bob', emojis: ['❤️', '👍'] },
      ],
      'bob'
    );

    expect(counts).toEqual([
      { emoji: '👍', count: 2, mine: true },
      { emoji: '🎉', count: 1, mine: false },
      { emoji: '❤️', count: 1, mine: true },
    ]);
  });

  it('counts a reader found under two nodes once', () => {
    const counts = tallyReactions([
      { owner: 'alice', emojis: ['👍'] },
      { owner: 'alice', emojis: ['👍'] },
    ]);

    expect(counts).toEqual([{ emoji: '👍', count: 1, mine: false }]);
  });

  it('leaves out a node that names no reader', () => {
    expect(tallyReactions([{ owner: '', emojis: ['👍'] }])).toEqual([]);
  });
});

describe('formatReactionSummary()', () => {
  it('writes each emoji with its count', () => {
    expect(
      formatReactionSummary([
        { emoji: '👍', count: 2, mine: false },
        { emoji: '❤️', count: 1, mine: true },
      ])
    ).toBe('👍 2・❤️ 1');
  });

  it('is empty when nobody reacted, as on a line from before reactions', () => {
    expect(formatReactionSummary([])).toBe('');
    expect(formatReactionSummary(undefined)).toBe('');
  });
});

describe('reactions on a ChatMessage', () => {
  let tab: ChatTab;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    beMyself('alice');
    tab = new ChatTab();
    tab.initialize();
  });

  afterEach(() => {
    tab.destroy();
  });

  function say(text = 'こんにちは', extra: Partial<Record<'to' | 'tag' | 'from', string>> = {}): ChatMessage {
    return tab.addMessage({ from: 'alice', name: 'アリス', text, timestamp: 1000, ...extra });
  }

  it('starts with none', () => {
    const message = say();
    expect(message.reactions).toEqual([]);
    expect(message.reactionNodes).toEqual([]);
  });

  it('keeps one vote per reader per emoji, and takes it back when pressed again', () => {
    const message = say();

    expect(message.toggleReaction('alice', '👍')).toBe(true);
    expect(message.reactions).toEqual([{ emoji: '👍', count: 1, mine: true }]);

    expect(message.toggleReaction('alice', '👍')).toBe(false);
    expect(message.reactions).toEqual([]);
    expect(message.hasReactionBy('alice', '👍')).toBe(false);
  });

  it('lets a reader leave several different emoji on one line, in one node of their own', () => {
    const message = say();
    message.toggleReaction('alice', '👍');
    message.toggleReaction('alice', '🎉');

    expect(message.reactionNodes).toHaveLength(1);
    expect(message.reactionOf('alice')?.emojis).toEqual(['👍', '🎉']);
  });

  it('refuses what is not an emoji, and anything past the limit a reader may leave', () => {
    const message = say();
    expect(message.toggleReaction('alice', 'lol')).toBe(false);
    expect(message.toggleReaction('', '👍')).toBe(false);
    expect(message.reactionNodes).toHaveLength(0);

    const node = new ChatReaction();
    node.owner = 'alice';
    node.initialize();
    message.appendChild(node);
    node.emojiList = Array.from({ length: MAX_REACTIONS_PER_READER }, (_, i) => String.fromCodePoint(0x1f600 + i)).join(
      ' '
    );
    expect(message.toggleReaction('alice', '👍')).toBe(false);
    expect(node.emojis).toHaveLength(MAX_REACTIONS_PER_READER);
  });

  it('never writes to the line or to another reader when two readers react at once', () => {
    const message = say();
    message.toggleReaction('alice', '👍');
    const aliceNode = message.reactionOf('alice')!;
    const messageVersion = message.majorVersion;
    const aliceVersion = aliceNode.majorVersion;

    message.toggleReaction('bob', '👍');

    // Sync keeps the whole of whichever copy is newer; nothing Bob did made a newer copy of
    // the line or of Alice's node, so neither can be lost to his.
    expect(message.majorVersion).toBe(messageVersion);
    expect(aliceNode.majorVersion).toBe(aliceVersion);
    expect(message.reactionOf('bob')).not.toBe(aliceNode);
    expect(message.reactions).toEqual([{ emoji: '👍', count: 2, mine: true }]);
  });

  it('counts a reaction that arrives from another seat under the line it was left on', () => {
    const message = say();
    message.toggleReaction('alice', '👍');

    // Bob's seat makes his node; here it arrives as a context, as the synchroniser receives it.
    const bobs = new ChatReaction();
    bobs.owner = 'bob';
    bobs.initialize();
    message.appendChild(bobs);
    bobs.toggle('👍');
    bobs.toggle('❤️');
    const context: ObjectContext = bobs.toContext();
    ObjectStore.instance.remove(bobs);
    expect(message.reactions).toEqual([{ emoji: '👍', count: 1, mine: true }]);

    const arrived = ObjectFactory.instance.create(context.aliasName, context.identifier)!;
    ObjectStore.instance.add(arrived, false, () => arrived.apply(context));

    expect(message.reactions).toEqual([
      { emoji: '👍', count: 2, mine: true },
      { emoji: '❤️', count: 1, mine: false },
    ]);
  });

  it('takes the reaction back from every node of the reader, when two windows of theirs both made one', () => {
    const message = say();
    for (let i = 0; i < 2; i++) {
      const node = new ChatReaction();
      node.owner = 'alice';
      node.initialize();
      message.appendChild(node);
      node.toggle('👍');
    }
    expect(message.reactions).toEqual([{ emoji: '👍', count: 1, mine: true }]);

    message.toggleReaction('alice', '👍');

    expect(message.reactions).toEqual([]);
  });

  it('goes when the line is deleted', () => {
    const message = say();
    message.toggleReaction('alice', '👍');
    message.toggleReaction('bob', '🎉');
    const nodes = message.reactionNodes.map((node) => node.identifier);

    message.destroy();

    for (const identifier of nodes) expect(ObjectStore.instance.get(identifier)).toBeNull();
  });

  describe('who may see and leave them', () => {
    it('is anyone for a line said to everyone', () => {
      expect(say().canReactBy('carol', false)).toBe(true);
    });

    it('is only those a whisper concerns', () => {
      const whisper = say('ないしょ', { to: 'bob' });
      expect(whisper.canReactBy('bob', false)).toBe(true);
      expect(whisper.canReactBy('alice', false)).toBe(true);
      expect(whisper.canReactBy('carol', false)).toBe(false);
      expect(whisper.canReactBy('carol', true)).toBe(false);
    });

    it('is only the sender of a secret roll, or one who may see what is kept back', () => {
      const secret = say('→ 6', { tag: 'secret' });
      expect(secret.canReactBy('alice', false)).toBe(true);
      expect(secret.canReactBy('bob', false)).toBe(false);
      expect(secret.canReactBy('bob', true)).toBe(true);
    });

    it('is nobody without a user id', () => {
      expect(say().canReactBy('', true)).toBe(false);
    });
  });

  describe('in room data', () => {
    function reload(message: ChatMessage): ChatMessage {
      const xml = message.toXml();
      // A line keeps its identifier through a save, so the old one goes first, as a load does.
      message.destroy();
      ObjectStore.instance.forgetDeleted([message.identifier]);
      const loaded = ObjectSerializer.instance.parseXml(xml) as ChatMessage;
      tab.appendChild(loaded);
      return loaded;
    }

    it('come back with the line, text untouched', () => {
      const message = say('<b>&"こんにちは"</b>\n二行目');
      message.toggleReaction('alice', '👍');
      message.toggleReaction('bob', '👍');
      message.toggleReaction('bob', '❤️');

      const loaded = reload(message);

      expect(loaded.text).toBe('<b>&"こんにちは"</b>\n二行目');
      expect(loaded.reactions).toEqual([
        { emoji: '👍', count: 2, mine: true },
        { emoji: '❤️', count: 1, mine: false },
      ]);
    });

    it('leave out a reader who took back everything', () => {
      const message = say();
      message.toggleReaction('alice', '👍');
      message.toggleReaction('alice', '👍');

      expect(message.toXml()).not.toContain('chat-reaction');
      expect(reload(message).reactionNodes).toEqual([]);
    });

    it('are none on a line saved before reactions existed', () => {
      const legacy = ObjectSerializer.instance.parseXml(
        '<chat from="alice" name="アリス" timestamp="1000">昔の&amp;発言</chat>'
      ) as ChatMessage;
      tab.appendChild(legacy);

      expect(legacy.text).toBe('昔の&発言');
      expect(legacy.reactions).toEqual([]);
    });

    it('ignore anything else found beneath a saved line', () => {
      const loaded = ObjectSerializer.instance.parseXml(
        '<chat from="alice" timestamp="1000">本文<chat-reaction owner="bob" emojiList="👍"></chat-reaction><node>x</node></chat>'
      ) as ChatMessage;
      tab.appendChild(loaded);

      expect(loaded.text).toBe('本文');
      expect(loaded.children).toHaveLength(1);
      expect(loaded.reactions).toEqual([{ emoji: '👍', count: 1, mine: false }]);
    });
  });
});
