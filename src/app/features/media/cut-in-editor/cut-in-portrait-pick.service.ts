import { Injectable, signal } from '@angular/core';

/** The character and picture chosen to try a template with, on this screen. */
export interface CutInPortraitChoice {
  characterIdentifier: string;
  imageIdentifier: string;
}

const NONE: CutInPortraitChoice = Object.freeze({ characterIdentifier: '', imageIdentifier: '' });

/**
 * Who a template is being tried with, kept per cut-in for as long as the app is open.
 *
 * The basic tab launches with the choice and the scene tab fits the picture to the slot, so
 * both read the one choice rather than each keeping its own. It is this screen's alone and is
 * never shared: a launch carries what it needs in its own snapshot.
 */
@Injectable({ providedIn: 'root' })
export class CutInPortraitPickService {
  private readonly choices = signal<ReadonlyMap<string, CutInPortraitChoice>>(new Map());

  choiceFor(cutInIdentifier: string): CutInPortraitChoice {
    return this.choices().get(cutInIdentifier) ?? NONE;
  }

  choose(cutInIdentifier: string, choice: CutInPortraitChoice): void {
    if (!cutInIdentifier) return;
    this.choices.update((choices) => new Map(choices).set(cutInIdentifier, { ...choice }));
  }
}
