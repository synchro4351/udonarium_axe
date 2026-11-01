import type { TranslateFn } from '@axe/application/i18n/translate.token';
import { handTransferActions } from '@axe/features/card/hand-rail/hand-transfer-context-menu';

describe('hand transfer menu', () => {
  const t = ((key: string) => key) as TranslateFn;

  it('names each recipient as it is called and passes the chosen one to the transfer', () => {
    const onGive = vi.fn();

    const actions = handTransferActions(
      [
        { userId: 'peer-1', name: 'Player One' },
        { userId: 'chr:abc', name: 'ゴブリン', characterIdentifier: 'abc' },
      ],
      onGive,
      t
    );

    expect(actions.map((action) => action.name)).toEqual(['Player One', 'ゴブリン']);
    actions[1].action?.();
    expect(onGive).toHaveBeenCalledWith('chr:abc');
  });

  it('calls a recipient with no name unnamed rather than leaving the row blank', () => {
    const actions = handTransferActions([{ userId: 'peer-1', name: '' }], vi.fn(), t);

    expect(actions[0].name).toBe('feature.card.hand.unnamed');
  });
});
