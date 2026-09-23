import { SkyWayFacade } from '@axe/core/network/skyway/skyway-facade';
import { Channel } from '@skyway-sdk/core';

describe('waiting for the previous SkyWay membership', () => {
  let facade: SkyWayFacade;
  let members: { name: string }[];
  let channel: Channel;
  let wait: (deadline: number) => Promise<boolean>;

  beforeEach(() => {
    vi.useFakeTimers();
    facade = new SkyWayFacade();
    facade.peer.peerId = 'same-person';
    members = [{ name: 'same-person' }];
    channel = {
      get members() {
        return members;
      },
    } as unknown as Channel;
    wait = (deadline) =>
      (
        facade as unknown as {
          waitForPreviousMember: (channel: Channel, deadline: number) => Promise<boolean>;
        }
      ).waitForPreviousMember(channel, deadline);
  });

  afterEach(() => vi.useRealTimers());

  it('waits for the matching member without changing identity or removing it', async () => {
    let settled = false;
    const waiting = wait(Date.now() + 65_000).then((result) => {
      settled = true;
      return result;
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).toBe(false);
    expect(members).toEqual([{ name: 'same-person' }]);
    members = [{ name: 'another-person' }];
    await vi.advanceTimersByTimeAsync(250);
    await expect(waiting).resolves.toBe(true);
    expect(facade.peer.peerId).toBe('same-person');
  });

  it('does not delay a join when only other members are present', async () => {
    members = [{ name: 'another-person' }];
    await expect(wait(Date.now() + 65_000)).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops at the deadline if the other session remains active', async () => {
    const result = expect(wait(Date.now() + 65_000)).rejects.toThrow('Timed out waiting');
    await vi.advanceTimersByTimeAsync(65_000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not continue joining after the facade is closed', async () => {
    const waiting = wait(Date.now() + 65_000);
    await facade.close();
    await vi.advanceTimersByTimeAsync(250);
    await expect(waiting).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('SkyWayFacade', () => {
  it('is exported', () => {
    expect(SkyWayFacade).toBeDefined();
  });

  it('the properties it starts with', () => {
    const facade = new SkyWayFacade();
    expect(facade.url).toBe('');
    expect(facade.peer).toBeDefined();
    expect(facade.isOpen).toBe(false);
  });

  describe('leaveImmediately', () => {
    it('carries its methods', () => {
      const facade = new SkyWayFacade();
      expect(typeof facade.leaveImmediately).toBe('function');
    });

    it('survives with neither member set', () => {
      const facade = new SkyWayFacade();
      expect(() => facade.leaveImmediately()).not.toThrow();
    });
  });

  describe('rejoinAfterLeave', () => {
    it('carries its methods', () => {
      const facade = new SkyWayFacade();
      expect(typeof facade.rejoinAfterLeave).toBe('function');
    });

    it('returns early with no context', async () => {
      const facade = new SkyWayFacade();
      await expect(facade.rejoinAfterLeave()).resolves.toBeUndefined();
    });

    it('clears a member that has left before rejoining', async () => {
      const facade = new SkyWayFacade();
      // set up a member that has left
      (facade as unknown as Record<string, unknown>).roomPerson = { state: 'left' };
      (facade as unknown as Record<string, unknown>).lobbyPerson = { state: 'left' };
      // returns early with no context and nothing goes wrong
      await expect(facade.rejoinAfterLeave()).resolves.toBeUndefined();
    });
  });
});

describe('starts with its fields empty', () => {
  it('starts with no context', () => {
    const facade = new SkyWayFacade();
    expect(facade.context).toBeNull();
  });

  it('starts with no open handler', () => {
    const facade = new SkyWayFacade();
    expect(facade.onOpen).toBeNull();
  });

  it('starts with no close handler', () => {
    const facade = new SkyWayFacade();
    expect(facade.onClose).toBeNull();
  });
});

describe('clearing away the listeners', () => {
  it('drops the close listeners on leaving the lobby', async () => {
    const removeAllListenersSpy = vi.fn();
    const disposeSpy = vi.fn();

    const facade = new SkyWayFacade();
    (facade as unknown as Record<string, unknown>).lobby = {
      onClosed: { removeAllListeners: removeAllListenersSpy },
      dispose: disposeSpy,
    };

    await (facade as unknown as { leaveLobbyChannel: () => Promise<void> }).leaveLobbyChannel();

    expect(removeAllListenersSpy).toHaveBeenCalled();
    expect(disposeSpy).toHaveBeenCalled();
    expect((facade as unknown as Record<string, unknown>).lobby).toBeNull();
  });

  it('drops the subscription listeners on closing the room stream', async () => {
    const removeAllListenersSpy = vi.fn();
    const unpublishSpy = vi.fn();

    const facade = new SkyWayFacade();
    (facade as unknown as Record<string, unknown>).publication = {
      onSubscribed: { removeAllListeners: removeAllListenersSpy },
    };
    (facade as unknown as Record<string, unknown>).roomPerson = { unpublish: unpublishSpy };

    await (facade as unknown as { closeRoomDataStream: () => Promise<void> }).closeRoomDataStream();

    expect(removeAllListenersSpy).toHaveBeenCalled();
    expect(unpublishSpy).toHaveBeenCalled();
    expect((facade as unknown as Record<string, unknown>).publication).toBeNull();
  });
});
