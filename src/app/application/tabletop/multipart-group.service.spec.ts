import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DisclosureService } from '@axe/application/permission/disclosure.service';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { MultipartGroupService } from '@axe/application/tabletop/multipart-group.service';
import { TabletopService } from '@axe/application/tabletop/tabletop.service';
import { MovableLike, MultiMovableService } from '@axe/application/ui/multi-movable.service';
import { SelectionSignalService } from '@axe/application/ui/selection-signal.service';
import { UiSignalService } from '@axe/application/ui/ui-signal.service';
import { markForChanged, objectChanged$ } from '@axe/core/sync/object-event-extension';
import { GameCharacter } from '@axe/domain/character/game-character';
import { DataElement } from '@axe/domain/data/data-element';
import { allowDottedXmlAttributes } from '@axe/testing/dotted-xml-attributes';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

describe('MultipartGroupService', () => {
  const roles = { canEditTabletop: true };
  const mode2d = signal(true);
  const made: GameCharacter[] = [];
  let service: MultipartGroupService;
  let restoreXml: () => void;

  function character(group = '', region = '0 0 0.5 1 1'): GameCharacter {
    const piece = GameCharacter.create('Piece', 2, '');
    piece.location.x = 300;
    piece.location.y = 200;
    if (group) {
      piece.partGroup = group;
      piece.partRegion = region;
    }
    made.push(piece);
    return piece;
  }

  beforeEach(async () => {
    roles.canEditTabletop = true;
    restoreXml = allowDottedXmlAttributes();
    mode2d.set(true);
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    TestBed.overrideProvider(RolePermissionService, { useValue: roles });
    TestBed.overrideProvider(TabletopService, { useValue: { mode2d } });
    await settle();
  });
  afterEach(() => {
    restoreXml();
    for (const piece of made.splice(0)) piece.destroy();
    TestBed.resetTestingModule();
  });

  function start(): MultipartGroupService {
    service = TestBed.inject(MultipartGroupService);
    return service;
  }

  it('moves the other parts on the table with a part moved here, and nothing else', async () => {
    const head = character('g');
    const tail = character('g', '0.5 0 0.5 1 1');
    const dead = character('g', '0.5 0 0.25 1 1');
    dead.location.name = 'graveyard';
    const stranger = character('other');
    const plain = character();
    start();
    await settle();

    head.location.x = 500;
    head.location.y = 260;
    head.rotate = 90;
    await settle();

    expect([tail.location.x, tail.location.y, tail.rotate]).toEqual([500, 260, 90]);
    expect([dead.location.x, stranger.location.x, plain.location.x]).toEqual([300, 300, 300]);
  });

  it('passes size and altitude on through their data elements', async () => {
    const head = character('g');
    const tail = character('g');
    start();
    head.size = 3;
    head.altitude = 1.5;
    await settle();
    expect([tail.size, tail.altitude]).toEqual([3, 1.5]);
  });

  it('leaves a change from another seat to that seat', async () => {
    const head = character('g');
    const tail = character('g');
    start();
    await settle();
    head.location.x = 700;
    markForChanged(head, 'another-peer');
    await settle();
    expect(tail.location.x).toBe(300);
  });

  it('settles after passing a move on, without answering its own writes', async () => {
    const head = character('g');
    const tail = character('g');
    const third = character('g');
    start();
    await settle();
    const followerVersion = tail.version;
    let events = 0;
    const off = objectChanged$.subscribe(() => events++);
    head.location.x = 450;
    head.update();
    await settle();
    expect([tail.location.x, third.location.x]).toEqual([450, 450]);
    expect(tail.version).toBeGreaterThan(followerVersion);
    events = 0;
    await settle();
    off();
    expect(events).toBe(0);
  });

  it('puts a part back from the graveyard into the group place without moving the group', async () => {
    const head = character('g');
    const tail = character('g');
    const back = character('g');
    back.location.name = 'graveyard';
    back.location.x = 20;
    back.location.y = 30;
    start();
    await settle();

    back.setLocation('table');
    await settle();

    expect([back.location.x, back.location.y]).toEqual([300, 200]);
    expect([head.location.x, tail.location.x]).toEqual([300, 300]);
  });

  it('lets a part go to the graveyard alone', async () => {
    const head = character('g');
    const tail = character('g');
    start();
    await settle();
    head.location.x = 999;
    head.setLocation('graveyard');
    await settle();
    expect(tail.location.x).toBe(300);
    expect(tail.location.name).toBe('table');
  });

  it('leaves the parts in a drag to the drag, and passes the drop on afterwards', async () => {
    const head = character('g');
    const tail = character('g');
    start();
    const movable = TestBed.inject(MultiMovableService);
    const ref = (piece: GameCharacter): MovableLike => ({
      identifier: piece.identifier,
      tabletopObject: piece,
      posX: piece.location.x,
      posY: piece.location.y,
    });
    const headRef = ref(head);
    movable.register(headRef);
    movable.register(ref(tail));
    TestBed.inject(SelectionSignalService).replaceSelection([head.identifier]);
    movable.beginDrag(headRef);
    await settle();

    head.location.x = 400;
    head.posZ = 4;
    await settle();
    expect([tail.location.x, tail.posZ]).toEqual([300, 0]);

    movable.endDrag(headRef);
    head.location.x = 410;
    head.update();
    await settle();
    expect(tail.location.x).toBe(410);
  });

  it('passes nothing on for a reader who may not edit the table', async () => {
    const head = character('g');
    const tail = character('g');
    start();
    roles.canEditTabletop = false;
    head.location.x = 10;
    head.update();
    await settle();
    expect(tail.location.x).toBe(300);
    expect(service.unlink(head)).toBe(false);
  });

  it('unlinks one part and stops moving it with the rest', async () => {
    const head = character('g');
    const tail = character('g');
    start();
    expect(service.unlink(tail)).toBe(true);
    expect(tail.partGroup).toBe('');
    expect(tail.partRegion).toBe('0 0 0.5 1 1');
    head.location.x = 50;
    head.update();
    await settle();
    expect(tail.location.x).toBe(300);
    expect(service.membersOf('g')).toEqual([head]);
  });

  it('links selected characters under one transform without requiring a crop', () => {
    const first = character();
    const second = character();
    second.location.x = 900;
    second.size = 4;
    start();
    expect(service.link([first, second])).toBe(true);
    expect(first.partGroup).toBe(second.partGroup);
    expect([first.location.x, second.location.x, first.size, second.size]).toEqual([300, 300, 2, 2]);
    expect([first.partRegion, second.partRegion]).toEqual(['', '']);
  });

  it('moves ordinary linked characters together without inventing crop metadata', async () => {
    const first = character();
    const second = character();
    start();
    expect(service.link([first, second])).toBe(true);
    first.location.x = 800;
    first.location.y = 600;
    first.rotate = 90;
    await settle();
    expect([second.location.x, second.location.y, second.rotate]).toEqual([800, 600, 90]);
    expect([first.partRegion, second.partRegion]).toEqual(['', '']);
  });

  it('includes the existing group without bringing its graveyard member onto the table', () => {
    const head = character('g');
    const dead = character('g');
    dead.location.name = 'graveyard';
    dead.location.x = 900;
    const newcomer = character();
    start();
    expect(service.link([head, newcomer])).toBe(true);
    expect(dead.partGroup).toBe(head.partGroup);
    expect(newcomer.partGroup).toBe(head.partGroup);
    expect([dead.location.name, dead.location.x]).toEqual(['graveyard', 900]);
  });

  it('rejects linking and copying for a reader who cannot edit the table', () => {
    const head = character('g');
    const tail = character('g');
    start();
    roles.canEditTabletop = false;
    expect(service.link([head, tail])).toBe(false);
    expect(service.copyGroup(head)).toEqual([]);
    expect(head.partGroup).toBe('g');
  });

  it('copies every group member once with an independent group key and keeps graveyard places', () => {
    const head = character('g', '0 0 0.5 1 1');
    const field = DataElement.create('HP', 3);
    head.detailDataElement?.appendChild(field);
    const tail = character('g', '0.5 0 0.5 1 1');
    const dead = character('g', '0.5 0 0.25 1 1');
    dead.location.name = 'graveyard';
    start();
    const copies = service.copyGroup(head);
    expect(copies).toHaveLength(3);
    expect(new Set(copies.map((copy) => copy.partGroup)).size).toBe(1);
    expect(copies[0].partGroup).not.toBe('g');
    expect(copies.map((copy) => copy.location.name)).toEqual(['table', 'table', 'graveyard']);
    expect(copies.map((copy) => copy.location.x)).toEqual([350, 350, 300]);
    expect(copies.map((copy) => copy.partRegion)).toEqual([head.partRegion, tail.partRegion, dead.partRegion]);
    expect(new Set(copies.map((copy) => copy.partGroupName)).size).toBe(1);
    expect(copies[0].partGroupName).toBe('Piece_2');
    const repeated = service.copyGroup(head);
    expect(repeated[0].partGroupName).toBe('Piece_3');
    made.push(...repeated);
    const copiedField = copies[0].detailDataElement?.getFirstElementByName('HP');
    expect(copiedField).toBeDefined();
    copiedField!.value = 1;
    expect(field.value).toBe(3);
    made.push(...copies);
  });

  it('copies no group a reader cannot see', () => {
    const head = character('g');
    const hidden = character('g');
    start();
    TestBed.inject(DisclosureService).canView = (candidate: GameCharacter) => candidate !== hidden;
    expect(service.copyGroup(head)).toEqual([]);
  });

  it('aims at the middle of a part region, and at the middle of an ordinary piece', () => {
    const right = character('g', '0.5 0 0.5 1 1');
    const plain = character();
    start();
    TestBed.inject(UiSignalService).tableViewRotation.set({ x: 0, y: 0, z: 0 });
    expect(service.anchorOf(plain, 50)).toEqual({ x: 350, y: 250, z: 0 });
    const anchor = service.anchorOf(right, 50);
    expect(anchor.x).toBeCloseTo(375);
    expect(anchor.y).toBeCloseTo(200);
    mode2d.set(false);
    TestBed.inject(UiSignalService).tableViewRotation.set({ x: 90, y: 0, z: 0 });
    expect(service.anchorOf(right, 50).z).toBeCloseTo(50);
    right.altitude = 2;
    expect(service.anchorOf(right, 50).z).toBeCloseTo(150);
  });

  it('projects linked image frames through a supplied first-person billboard view', () => {
    const upperRight = character('g', '0.5 0 0.5 0.5 1');
    start();
    mode2d.set(false);
    upperRight.posZ = 10;
    upperRight.altitude = 1.5;
    TestBed.inject(UiSignalService).tableViewRotation.set({ x: 0, y: 0, z: 90 });

    const tableAnchor = service.anchorOf(upperRight, 50);
    const eyeAnchor = service.anchorOf(upperRight, 50, {
      mode2d: false,
      yawDeg: -90,
      pitchDeg: 90,
      tiltDeg: 0,
      contain: false,
      specifiedHeightPx: 120,
    });

    // The first-person billboard is upright and follows the camera yaw, while its full-frame
    // image height and world elevation still determine the position of the selected region.
    expect(tableAnchor).not.toEqual(eyeAnchor);
    expect(eyeAnchor.x).toBeCloseTo(350);
    expect(eyeAnchor.y).toBeCloseTo(280);
    expect(eyeAnchor.z).toBeCloseTo(175);
  });
});
