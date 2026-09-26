import { TestBed } from '@angular/core/testing';
import { Card } from '@axe/domain/card/card';
import { HandDragService } from '@axe/features/card/hand-rail/hand-drag.service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('HandDragService', () => {
  let service: HandDragService;
  let card: Card;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HandDragService);
    card = Card.create('カード', 'front.png', 'back.png');
  });

  afterEach(() => {});

  it('starts with nothing being dragged', () => {
    expect(service.card()).toBeNull();
    expect(service.tableCard()).toBeNull();
  });

  it('starts a drag from the hand, follows it and lets go at the end', () => {
    service.begin(card, 10, 20);
    expect(service.card()).toBe(card);
    expect(service.x()).toBe(10);
    expect(service.y()).toBe(20);

    service.move(30, 40);
    expect(service.x()).toBe(30);
    expect(service.y()).toBe(40);

    service.end();
    expect(service.card()).toBeNull();
  });

  it('carries a card drawn from another hand apart from your own hand cards', () => {
    service.beginDraw(card, 'back.png', 5, 6);
    expect(service.drawCard()).toBe(card);
    expect(service.drawImageUrl()).toBe('back.png');
    expect(service.card()).toBeNull();
    expect(service.x()).toBe(5);
    expect(service.y()).toBe(6);

    service.endDraw();
    expect(service.drawCard()).toBeNull();
    expect(service.drawImageUrl()).toBe('');
  });

  it('opens the rail to a card only while one is dragged off the table', () => {
    service.armTableDrag(card);
    expect(service.tableCard()).toBe(card);

    service.disarmTableDrag();
    expect(service.tableCard()).toBeNull();
  });
});
