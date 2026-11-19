import { TestBed } from '@angular/core/testing';
import { AgentEventLog } from '@axe/application/agent/agent-event-log.service';
import type { IPeerContext } from '@axe/core/network/peer-context';
import { resetPeerContextProvider, setPeerContextProvider } from '@axe/core/network/peer-context-source';
import { ObjectStore } from '@axe/core/sync/object-store';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { PeerRole } from '@axe/domain/peer/peer-role';
import { GameTable } from '@axe/domain/tabletop/game-table';
import { TableSelecter } from '@axe/domain/tabletop/table-selecter';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('AgentEventLog', () => {
  let log: AgentEventLog;

  beforeEach(() => {
    setPeerContextProvider({
      peerContext: { userId: 'ai-user' } as IPeerContext,
      peerContexts: [],
      peerIds: [],
      peerId: 'ai-peer',
    });
    PeerCursor.createMyCursor();
    PeerCursor.myCursor.role = PeerRole.Player;
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    const table = new GameTable();
    table.initialize();
    TableSelecter.instance.viewTableIdentifier = table.identifier;
    log = TestBed.inject(AgentEventLog);
    log.start();
  });

  afterEach(() => {
    log.stop();
    PeerCursor.myCursor = null!;
    resetPeerContextProvider();
    for (const object of ObjectStore.instance.getObjects()) ObjectStore.instance.remove(object);
  });

  it("tells the AI when its own seat's role changes, and nothing while it stays the same", async () => {
    const cursor = log.cursorNow();

    PeerCursor.myCursor.role = PeerRole.GameMaster;
    PeerCursor.myCursor.update();
    PeerCursor.myCursor.name = 'AI';
    PeerCursor.myCursor.update();

    const { events } = await log.waitFor(cursor, 0);
    expect(events.filter((event) => event.kind === 'seat_role_changed')).toEqual([
      expect.objectContaining({ kind: 'seat_role_changed', role: PeerRole.GameMaster }),
    ]);
  });
});
