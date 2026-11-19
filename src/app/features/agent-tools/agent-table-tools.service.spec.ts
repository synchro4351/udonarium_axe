import { TestBed } from '@angular/core/testing';
import { ChatMessageService } from '@axe/application/chat/chat-message.service';
import { GameObjectInventoryService } from '@axe/application/inventory/game-object-inventory.service';
import { AgentToolError } from '@axe/core/agent/agent-error';
import type { IPeerContext } from '@axe/core/network/peer-context';
import { resetPeerContextProvider, setPeerContextProvider } from '@axe/core/network/peer-context-source';
import { ObjectStore } from '@axe/core/sync/object-store';
import { Alarm } from '@axe/domain/alarm/alarm';
import { GameCharacter } from '@axe/domain/character/game-character';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { ChatTabList } from '@axe/domain/chat/chat-tab-list';
import { BUILTIN_STAMPS } from '@axe/domain/chat/stamp-catalog';
import { DataElement } from '@axe/domain/data/data-element';
import { SortOrder } from '@axe/domain/data/data-summary-setting';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { Vote } from '@axe/domain/vote/vote';
import { AgentTableTools } from '@axe/features/agent-tools/agent-table-tools.service';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

const signal = new AbortController().signal;

describe('AgentTableTools', () => {
  let tools: AgentTableTools;
  let inventory: GameObjectInventoryService;

  async function call(tool: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return (await tools.handlers[tool](args, { signal })) as Record<string, unknown>;
  }

  function piece(name: string): GameCharacter {
    const made = GameCharacter.create(name, 1, '');
    made.location = { name: 'table', x: 0, y: 0 };
    made.update();
    return made;
  }

  function valueOf(one: GameCharacter, key: string): unknown {
    return DataElement.findElementByReference(one.detailDataElement!, key)?.value;
  }

  beforeEach(() => {
    setPeerContextProvider({
      peerContext: { userId: 'gm-user' } as IPeerContext,
      peerContexts: [],
      peerIds: [],
      peerId: 'gm-peer',
    });
    PeerCursor.createMyCursor();
    PeerCursor.myCursor.name = 'AI GM';
    PeerCursor.myCursor.role = PeerRole.GameMaster;
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    const main = new ChatTab();
    main.name = 'メイン';
    main.initialize();
    ChatTabList.instance.addChatTab(main);
    tools = TestBed.inject(AgentTableTools);
    inventory = TestBed.inject(GameObjectInventoryService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    PeerCursor.myCursor = null!;
    resetPeerContextProvider();
    for (const object of ObjectStore.instance.getObjects()) ObjectStore.instance.remove(object);
  });

  it('writes the turn order into the item the inventory sorts by, highest first, and sorts by it', async () => {
    const a = piece('戦士');
    const b = piece('魔法使い');
    const c = piece('盗賊');
    inventory.sortTag = 'イニシアティブ';

    const result = await call('set_turn_order', { pieces: ['盗賊', '戦士', '魔法使い'] });

    expect(result['key']).toBe('イニシアティブ');
    expect([valueOf(c, 'イニシアティブ'), valueOf(a, 'イニシアティブ'), valueOf(b, 'イニシアティブ')]).toEqual([
      3, 2, 1,
    ]);
    expect(inventory.sortOrder).toBe(SortOrder.DESC);
  });

  it('sorts by its own item where the inventory sorts by none', async () => {
    const a = piece('戦士');
    inventory.sortTag = '';

    await call('set_turn_order', { pieces: ['戦士'] });

    expect(valueOf(a, '行動順')).toBe(1);
    expect(inventory.sortTag).toBe('行動順');
  });

  it('refuses a piece named twice in the order', async () => {
    piece('戦士');

    await expect(call('set_turn_order', { pieces: ['戦士', '戦士'] })).rejects.toBeInstanceOf(AgentToolError);
  });

  it('sorts the inventory the other way round', async () => {
    await call('set_inventory_order', { by: 'イニシアティブ', order: 'ascending' });

    expect(inventory.sortTag).toBe('イニシアティブ');
    expect(inventory.sortOrder).toBe(SortOrder.ASC);
  });

  it('sets an alarm for everyone and says so in chat', async () => {
    const alarm = new Alarm('Alarm');
    alarm.initialize();
    const made = vi.spyOn(alarm, 'makeAlarm');
    vi.spyOn(alarm, 'startAlarm').mockImplementation(() => {});
    const said = vi
      .spyOn(TestBed.inject(ChatMessageService), 'sendSystemMessageAsLastSpeaker')
      .mockImplementation(() => {});

    await call('set_alarm', { seconds: 300, title: '休憩' });

    expect(made).toHaveBeenCalledWith(300, '休憩', ['gm-peer'], 'gm-peer', expect.any(String), true, true);
    expect(said).toHaveBeenCalledOnce();
  });

  it('starts a vote with the choices given, or a roll call with none', async () => {
    const vote = new Vote('Vote');
    vote.initialize();
    const made = vi.spyOn(vote, 'makeVote');
    vi.spyOn(vote, 'startVote').mockImplementation(() => {});
    vi.spyOn(TestBed.inject(ChatMessageService), 'sendSystemMessageAsLastSpeaker').mockImplementation(() => {});

    const result = await call('start_vote', { title: '次の目的地', choices: ['森', '洞窟'] });

    expect(result['rollCall']).toBe(false);
    expect(made.mock.calls[0][1]).toBe('次の目的地');
    expect(made.mock.calls[0][3]).toEqual(['森', '洞窟']);
  });

  it('lists the built-in stamps and sends one by its id', async () => {
    const listed = (await call('list_stamps'))['stamps'] as { id: string; name: string }[];
    expect(listed.length).toBeGreaterThan(0);
    const sent = vi
      .spyOn(TestBed.inject(ChatMessageService), 'sendStamp')
      .mockReturnValue({} as unknown as ChatMessage);

    await call('send_stamp', { stamp: BUILTIN_STAMPS[0].id });

    expect(sent.mock.calls[0][1]).toBe(BUILTIN_STAMPS[0].id);
  });

  it("marks the stamp it sends as the AI's, as the lines it says are", async () => {
    await call('send_stamp', { stamp: BUILTIN_STAMPS[0].id });

    const line = ObjectStore.instance.getObjects<ChatMessage>(ChatMessage).find((one) => one.sentStamp)!;
    expect(line.isByAi).toBe(true);
  });
});
