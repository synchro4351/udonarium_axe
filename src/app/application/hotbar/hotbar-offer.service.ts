import { inject, Injectable } from '@angular/core';
import { CharacterMacroService } from '@axe/application/chat/character-macro.service';
import { ChatMessageService } from '@axe/application/chat/chat-message.service';
import { HotbarStoreService } from '@axe/application/hotbar/hotbar-store.service';
import { TRANSLATE_FN } from '@axe/application/i18n/translate.token';
import { HotbarPreferenceService } from '@axe/application/ui/hotbar-preference.service';
import { WidgetVisibilityService } from '@axe/application/ui/widget-visibility.service';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import {
  emptyHotbarPage,
  encodeHotbarOffer,
  HotbarOffer,
  offerOfPage,
  parseHotbarOffer,
  placeHotbarOffer,
} from '@axe/domain/hotbar/hotbar-offer';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';

/** How taking a template went: the page it landed on, or why it could not. */
export type HotbarTakeResult = { page: number; slots: number } | { failed: 'invalid' | 'full' | 'noBar' };

/**
 * Handing pages of hotbars round the room. A bar is each reader's own, so a page is put in
 * the chat as a template, by a player or by the AI, and whoever wants it takes it onto a page of their
 * own bar that has nothing on it, so nothing they set up is written over.
 */
@Injectable({ providedIn: 'root' })
export class HotbarOfferService {
  private readonly chat = inject(ChatMessageService);
  private readonly macro = inject(CharacterMacroService);
  private readonly hotbarStore = inject(HotbarStoreService);
  private readonly preference = inject(HotbarPreferenceService);
  private readonly widgets = inject(WidgetVisibilityService);
  private readonly t = inject(TRANSLATE_FN);

  /** Puts a template in a tab; null where the reader may not speak there. */
  send(tab: ChatTab, offer: HotbarOffer): ChatMessage | null {
    const words = this.t('feature.hotbar.offer.words', {
      title: offer.title || this.t('feature.hotbar.offer.untitled'),
      count: offer.slots.length,
    });
    return this.chat.sendHotbarOffer(tab, words, encodeHotbarOffer(offer));
  }

  /** Hands a page of the reader's own bar round a tab; null where the page is empty or the tab refuses. */
  share(tab: ChatTab, page: number, title: string): ChatMessage | null {
    const hotbar = this.hotbarStore.own();
    const offer = hotbar ? offerOfPage(hotbar, page, title) : null;
    return offer ? this.send(tab, offer) : null;
  }

  /** Hands the page of the reader's own bar in view round the tab in use; null where nothing went. */
  shareShownPage(): ChatMessage | null {
    const tab = this.macro.currentTab();
    if (!tab) return null;
    const page = this.preference.page();
    const title = this.t('feature.hotbar.offer.sharedTitle', {
      name: PeerCursor.myCursor?.name ?? '',
      page: page + 1,
    });
    return this.share(tab, page, title);
  }

  /** Takes the template a line carries onto the first empty page of the reader's own bar, and shows it. */
  take(raw: string): HotbarTakeResult {
    const offer = parseHotbarOffer(raw);
    if (!offer) return { failed: 'invalid' };
    const page = emptyHotbarPage(this.hotbarStore.own());
    if (page === null) return { failed: 'full' };
    const hotbar = this.hotbarStore.ensureOwn();
    if (!hotbar) return { failed: 'noBar' };
    const slots = placeHotbarOffer(hotbar, page, offer);
    this.widgets.hotbar.set(true);
    this.preference.gotoPage(page);
    return { page, slots };
  }
}
