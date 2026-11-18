import { TestBed } from '@angular/core/testing';
import { AgentEventLog } from '@axe/application/agent/agent-event-log.service';
import {
  AgentSeatLinkWatch,
  DOWN_AFTER_MS,
  LINK_LOOK_MS,
  UNSTABLE_DROPS,
} from '@axe/application/agent/agent-seat-link-watch.service';
import type { IPeerContext } from '@axe/core/network/peer-context';
import { resetPeerContextProvider, setPeerContextProvider } from '@axe/core/network/peer-context-source';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('AgentSeatLinkWatch', () => {
  let watch: AgentSeatLinkWatch;
  let told: ReturnType<typeof vi.fn>;
  let linked: IPeerContext[];
  const player = { peerId: 'pl-peer', userId: 'pl-user' } as IPeerContext;

  function provide(): void {
    setPeerContextProvider({
      peerContext: { userId: 'gm-user' } as IPeerContext,
      peerContexts: linked,
      peerIds: linked.map((context) => context.peerId),
      peerId: 'gm-peer',
    });
  }

  beforeEach(() => {
    linked = [player];
    provide();
    PeerCursor.createMyCursor();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    told = vi.spyOn(TestBed.inject(AgentEventLog), 'tell').mockImplementation(() => {}) as never;
    watch = TestBed.inject(AgentSeatLinkWatch);
    watch.start();
  });

  afterEach(() => {
    watch.stop();
    PeerCursor.myCursor = null!;
    resetPeerContextProvider();
  });

  function drop(): void {
    linked = [];
    provide();
  }

  function back(): void {
    linked = [player];
    provide();
  }

  it('tells nothing of a drop the link gets over by itself in seconds', () => {
    drop();
    watch.look(1_000);
    back();
    watch.look(1_000 + 3 * LINK_LOOK_MS);

    expect(told).not.toHaveBeenCalled();
  });

  it('tells a seat down once it has been gone a minute, and back when it comes back', () => {
    drop();
    watch.look(0);
    watch.look(DOWN_AFTER_MS);
    expect(told).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'seat_link_trouble', trouble: 'down', seat: 'pl-user', downForSeconds: 60 })
    );

    back();
    watch.look(DOWN_AFTER_MS + 30_000);
    expect(told).toHaveBeenLastCalledWith({ kind: 'seat_link_back', seat: 'pl-user', downForSeconds: 90 });
  });

  it('tells a link that keeps dropping, once a stretch', () => {
    let now = 0;
    for (let i = 0; i < UNSTABLE_DROPS; i++) {
      drop();
      watch.look((now += 1_000));
      back();
      watch.look((now += 2_000));
    }
    watch.look(now + 1_000);

    const unstable = told.mock.calls.filter(([event]) => event.trouble === 'unstable');
    expect(unstable).toHaveLength(1);
    expect(unstable[0][0]).toMatchObject({ seat: 'pl-user', dropsLast10Minutes: UNSTABLE_DROPS });
  });
});
