import { TestBed } from '@angular/core/testing';
import { HotbarOfferService } from '@axe/application/hotbar/hotbar-offer.service';
import { HotbarStoreService } from '@axe/application/hotbar/hotbar-store.service';
import { AgentToolError } from '@axe/core/agent/agent-error';
import { HOTBAR_AGENT_TOOLS } from '@axe/core/agent/agent-tools-hotbar';
import type { IPeerContext } from '@axe/core/network/peer-context';
import { resetPeerContextProvider, setPeerContextProvider } from '@axe/core/network/peer-context-source';
import { ObjectStore } from '@axe/core/sync/object-store';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { ChatTabList } from '@axe/domain/chat/chat-tab-list';
import { HOTBAR_ICONS } from '@axe/domain/hotbar/hotbar-icons';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { AgentHotbarTools } from '@axe/features/agent-tools/agent-hotbar-tools.service';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

const signal = new AbortController().signal;

describe('AgentHotbarTools', () => {
  let tools: AgentHotbarTools;

  async function call(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await tools.handlers['offer_hotbar'](args, { signal })) as Record<string, unknown>;
  }

  function lastLine(): ChatMessage {
    const lines = ObjectStore.instance.getObjects<ChatMessage>(ChatMessage);
    return lines[lines.length - 1];
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
    tools = TestBed.inject(AgentHotbarTools);
  });

  afterEach(() => {
    PeerCursor.myCursor = null!;
    resetPeerContextProvider();
    for (const object of ObjectStore.instance.getObjects()) ObjectStore.instance.remove(object);
  });

  it('hands a page round the chat that a player takes onto their own bar, the group running the slots beside it', async () => {
    const result = await call({
      title: '炎の魔法',
      slots: [
        { slot: 1, kind: 'chat', text: '炎よ、来たれ', label: '詠唱' },
        { slot: 2, kind: 'chat', text: '2d6+{魔力} 魔法攻撃', icon: 'local_fire_department' },
        { slot: 3, kind: 'group', steps: [1, 2], wait_ms: 800, label: '火球' },
      ],
    });

    expect(result).toEqual({ offered: '炎の魔法', slots: 3, tab: 'メイン' });
    const line = lastLine();
    expect(line.text).toContain('炎の魔法');
    expect(line.isByAi).toBe(true);

    const taken = TestBed.inject(HotbarOfferService).take(line.hotbarOffer);
    expect(taken).toEqual({ page: 0, slots: 3 });
    const bar = TestBed.inject(HotbarStoreService).own()!;
    expect(bar.slotAt(0, 0)?.label).toBe('詠唱');
    const group = bar.slotAt(0, 2)!.options;
    expect(group.kind === 'group' && group.steps.map((step) => [step.slotIndex, step.delayMs])).toEqual([
      [0, 0],
      [1, 800],
    ]);
  });

  it('refuses a group that runs a slot the page does not have, or another group', async () => {
    await expect(call({ title: 'x', slots: [{ slot: 1, kind: 'group', steps: [2] }] })).rejects.toBeInstanceOf(
      AgentToolError
    );
    await expect(
      call({
        title: 'x',
        slots: [
          { slot: 1, kind: 'group', steps: [2] },
          { slot: 2, kind: 'group', steps: [1] },
        ],
      })
    ).rejects.toBeInstanceOf(AgentToolError);
    expect(ObjectStore.instance.getObjects<ChatMessage>(ChatMessage)).toHaveLength(0);
  });

  it('refuses an effect the room does not have, and a slot given twice', async () => {
    await expect(call({ title: 'x', slots: [{ slot: 1, kind: 'effect', name: 'ない演出' }] })).rejects.toBeInstanceOf(
      AgentToolError
    );
    await expect(
      call({
        title: 'x',
        slots: [
          { slot: 1, kind: 'chat', text: 'a' },
          { slot: 1, kind: 'chat', text: 'b' },
        ],
      })
    ).rejects.toBeInstanceOf(AgentToolError);
  });

  it('offers the icons the slot editor offers', () => {
    const slots = HOTBAR_AGENT_TOOLS[0].input.properties['slots'];
    const slot = slots.type === 'array' && slots.items.type === 'object' ? slots.items : null;
    const icon = slot?.properties['icon'];
    expect(icon?.type === 'string' && icon.enum).toEqual(HOTBAR_ICONS);
  });
});
