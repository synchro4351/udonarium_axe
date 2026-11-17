import { PeerContext } from '@axe/core/network/peer-context';
import { IRoomInfo } from '@axe/core/network/room-info';

/** One row of a list of rooms: the room as the transport reports it, and the peers found in it. */
export interface ListedRoom {
  /** The room's id and name run together, which the list is ordered by. */
  readonly alias: string;
  readonly roomName: string;
  readonly info: IRoomInfo;
  readonly peerContexts: PeerContext[];
  /** Whether this is the room on a room server this tab was last in, which a reload leaves it outside of (tyoitashi). */
  readonly isLast?: boolean;
}

/**
 * The rooms the transport reports as rows of a list, in the order of their id and name, but for the
 * room on a room server this tab was last in, which comes first to go back to after a reload.
 */
export function listedRooms(roomInfos: readonly IRoomInfo[], lastRoomKey?: string): ListedRoom[] {
  return roomInfos
    .map((room) => ({
      alias: room.id + room.name,
      roomName: room.name,
      info: room,
      peerContexts: room.peers,
      isLast: !!lastRoomKey && !!room.roomKey && room.roomKey === lastRoomKey,
    }))
    .sort((a, b) => (a.isLast !== b.isLast ? (a.isLast ? -1 : 1) : a.alias < b.alias ? -1 : a.alias > b.alias ? 1 : 0));
}
