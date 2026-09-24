import type { TranslateFn } from '@axe/application/i18n/translate.token';
import { handTransferActions } from '@axe/features/card/hand-rail/hand-transfer-context-menu';

describe('hand transfer menu', () => {
  it('keeps participant names and passes the selected user id to the transfer', () => {
    const onGive = vi.fn();
    const t = ((key: string, params: { name: string }) => `${key}: ${params.name}`) as TranslateFn;

    const actions = handTransferActions([{ userId: 'peer-1', name: 'Player One' }], onGive, t);

    expect(actions[0].name).toBe('feature.card.hand.giveTo: Player One');
    actions[0].action?.();
    expect(onGive).toHaveBeenCalledWith('peer-1');
  });
});
