import { TestBed } from '@angular/core/testing';
import { AgentToolError } from '@axe/core/agent/agent-error';
import type { IPeerContext } from '@axe/core/network/peer-context';
import { resetPeerContextProvider, setPeerContextProvider } from '@axe/core/network/peer-context-source';
import { ObjectStore } from '@axe/core/sync/object-store';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { GameTable } from '@axe/domain/tabletop/game-table';
import { TableSelecter } from '@axe/domain/tabletop/table-selecter';
import { TextNote } from '@axe/domain/tabletop/text-note';
import { AgentBuildTools } from '@axe/features/agent-tools/agent-build-tools.service';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

const GRID = 50;
const signal = new AbortController().signal;

describe('AgentBuildTools', () => {
  let tools: AgentBuildTools;
  let table: GameTable;

  async function call(tool: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return (await tools.handlers[tool](args, { signal })) as Record<string, unknown>;
  }

  beforeEach(() => {
    setPeerContextProvider({
      peerContext: { userId: 'gm-user' } as IPeerContext,
      peerContexts: [],
      peerIds: [],
      peerId: 'gm-peer',
    });
    PeerCursor.createMyCursor();
    PeerCursor.myCursor.role = PeerRole.GameMaster;
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    table = new GameTable();
    table.width = 20;
    table.height = 20;
    table.gridSize = GRID;
    table.initialize();
    TableSelecter.instance.viewTableIdentifier = table.identifier;
    tools = TestBed.inject(AgentBuildTools);
  });

  afterEach(() => {
    PeerCursor.myCursor = null!;
    resetPeerContextProvider();
    for (const object of ObjectStore.instance.getObjects()) ObjectStore.instance.remove(object);
  });

  it('lays an area out as a grid of masks, each the size asked, the last cut to the area', async () => {
    const result = await call('place_masks', { col: 2, row: 3, width: 5, height: 4, size: 2, name: '霧' });

    expect(result).toMatchObject({ masks: 6, across: 3, down: 2 });
    const masks = table.masks;
    expect(masks).toHaveLength(6);
    const corner = masks.find((mask) => mask.name === '霧 2-3')!;
    expect([corner.location.x, corner.location.y, corner.width, corner.height]).toEqual([GRID, 2 * GRID, 2, 2]);
    const edge = masks.find((mask) => mask.name === '霧 6-3')!;
    expect(edge.width).toBe(1);
  });

  it('refuses to lay more masks than it may at once', async () => {
    await expect(call('place_masks', { col: 1, row: 1, width: 30, height: 30 })).rejects.toBeInstanceOf(AgentToolError);
    expect(table.masks).toHaveLength(0);
  });

  it('takes off the masks within an area, leaving the rest', async () => {
    await call('place_masks', { col: 1, row: 1, width: 4, height: 1, name: '霧' });

    const result = await call('remove_masks', { col: 1, row: 1, width: 2, height: 1 });

    expect(result['removed']).toBe(2);
    expect(table.masks.map((mask) => mask.name).sort()).toEqual(['霧 3-1', '霧 4-1']);
  });

  it('puts a note on the table, formatted, and adds lines to it', async () => {
    await call('place_note', { title: '手がかり', text: '# 分かったこと', col: 2, row: 2, formatted: true });
    const note = ObjectStore.instance.getObjects<TextNote>(TextNote)[0];
    expect(note.title).toBe('手がかり');
    expect(note.isFormatted).toBe(true);
    expect(note.disclosureMode).toBe('all');

    await call('edit_note', { note: '手がかり', append: '- 鍵は井戸の底' });

    expect(note.text).toBe('# 分かったこと\n- 鍵は井戸の底');
    const listed = (await call('list_notes'))['notes'] as { title: string }[];
    expect(listed.map((one) => one.title)).toEqual(['手がかり']);
  });

  it('keeps a note back to the game master only when asked to', async () => {
    await call('place_note', { title: '秘密', text: '黒幕は村長', hidden: true });

    expect(ObjectStore.instance.getObjects<TextNote>(TextNote)[0].disclosureMode).toBe('gm');
  });

  it('makes a table of the size asked, not switched to', async () => {
    const result = await call('create_table', { name: '洞窟', width: 30, height: 12 });

    const made = ObjectStore.instance.get<GameTable>((result['table'] as { id: string }).id)!;
    expect([made.name, made.width, made.height]).toEqual(['洞窟', 30, 12]);
    expect(TableSelecter.instance.viewTableIdentifier).toBe(table.identifier);
  });
});
