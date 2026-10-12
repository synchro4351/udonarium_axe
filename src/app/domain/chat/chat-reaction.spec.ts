import { ObjectSerializer } from '@axe/core/sync/object-serializer';
import { ObjectStore } from '@axe/core/sync/object-store';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { ChatReaction } from '@axe/domain/chat/chat-reaction';
import { emojiStampId } from '@axe/domain/chat/stamp-catalog';

describe('ChatReaction', () => {
  const made: ChatReaction[] = [];
  const messages: ChatMessage[] = [];

  function record(stamps = ''): ChatReaction {
    const reaction = ChatReaction.create('line', 'user', 'なまえ');
    reaction.stamps = stamps;
    made.push(reaction);
    return reaction;
  }

  afterEach(() => {
    for (const reaction of made.splice(0)) reaction.destroy();
    for (const message of messages.splice(0)) message.destroy();
  });

  it('reads the stamps put on, once each, and none from an empty record', () => {
    expect(record('').stampIds).toEqual([]);
    expect(record('  sfx:laugh  seal:ok sfx:laugh ').stampIds).toEqual(['sfx:laugh', 'seal:ok']);
  });

  it('puts a stamp on, and takes it off again, keeping the others in the order they went on', () => {
    const reaction = record('sfx:laugh');

    expect(reaction.toggle('seal:ok')).toBe(true);
    expect(reaction.stampIds).toEqual(['sfx:laugh', 'seal:ok']);

    expect(reaction.toggle('sfx:laugh')).toBe(false);
    expect(reaction.stampIds).toEqual(['seal:ok']);
    expect(reaction.has('seal:ok')).toBe(true);
  });

  it('converts old nested emoji reactions into separate records without losing line text', () => {
    const xml =
      '<chat identifier="old-line" from="alice">before<chat-reaction owner="alice" name="Alice" emojiList="👍 👍 invalid"/> after</chat>';
    const message = ObjectSerializer.instance.parseXml(xml) as ChatMessage;
    messages.push(message);

    expect(message.text).toBe('before after');
    expect(message.children).toEqual([]);
    const imported = ObjectStore.instance
      .getObjects(ChatReaction)
      .find((each) => each.messageIdentifier === 'old-line' && each.userId === 'alice');
    expect(imported?.userName).toBe('Alice');
    expect(imported?.stampIds).toEqual([emojiStampId('👍')]);
    if (imported) made.push(imported);

    ObjectSerializer.instance.parseXml(xml);
    expect(
      ObjectStore.instance
        .getObjects(ChatReaction)
        .filter((each) => each.messageIdentifier === 'old-line' && each.userId === 'alice')
    ).toHaveLength(1);

    const saved = imported!.toXml();
    imported!.destroy();
    const reloaded = ObjectSerializer.instance.parseXml(saved) as ChatReaction;
    made.push(reloaded);
    expect(reloaded.messageIdentifier).toBe('old-line');
    expect(reloaded.userId).toBe('alice');
    expect(reloaded.stampIds).toEqual([emojiStampId('👍')]);
  });
});
