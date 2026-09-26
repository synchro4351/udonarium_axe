import { HAND_CARDS_ICON } from '@axe/domain/ui/custom-icon';
import {
  gameMasterMobileMenuItems,
  MOBILE_MENU_ITEMS,
  sharedMobileMenuItems,
} from '@axe/features/mobile/mobile-shell/mobile-menu-items';
import { MobileShellComponent } from '@axe/features/mobile/mobile-shell/mobile-shell.component';

describe('mobileMenuItems', () => {
  it('offers nothing twice', () => {
    const actions = MOBILE_MENU_ITEMS.map((item) => item.action);
    expect(new Set(actions).size).toBe(actions.length);
  });

  it('keeps what belongs to the game master out of the shared items', () => {
    expect(sharedMobileMenuItems().every((item) => !item.gameMasterOnly)).toBe(true);
  });

  it('keeps the game masters items to their own', () => {
    expect(gameMasterMobileMenuItems().every((item) => item.gameMasterOnly === true)).toBe(true);
  });

  it('counts loading a room among the shared items', () => {
    expect(sharedMobileMenuItems().map((item) => item.action)).toContain('zipLoad');
  });

  it('puts the room settings straight after the table they belong with', () => {
    const actions = MOBILE_MENU_ITEMS.map((item) => item.action);
    expect(actions.indexOf('roomSettings')).toBe(actions.indexOf('tableSetting') + 1);
  });

  it('offers the stamp packs to everyone, next to the cut-ins as on the desktop', () => {
    const actions = sharedMobileMenuItems().map((item) => item.action);
    expect(actions.indexOf('stamp')).toBe(actions.indexOf('cutIn') + 1);
    expect(MOBILE_MENU_ITEMS.find((item) => item.action === 'stamp')?.labelKey).toBe('app.fab.stamp');
    const resolvePanel = (MobileShellComponent.prototype as unknown as { resolvePanel: (action: string) => string })
      .resolvePanel;
    expect(resolvePanel.call(null, 'stamp')).toBe('stampPacks');
  });

  it('shows the hand with the same drawn icon as the desktop menu', () => {
    expect(MOBILE_MENU_ITEMS.find((item) => item.action === 'hand')?.icon).toBe(HAND_CARDS_ICON);
  });
});
