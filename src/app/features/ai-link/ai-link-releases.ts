/** Where the bridge is downloaded from. */
export const AI_LINK_RELEASES_URL = 'https://github.com/Xelltis/udonarium_axe/releases/latest';

/**
 * Where tyoitashi's build of the bridge is put next to the page (tyoitashi). Its tools differ from the
 * official ones, so the official bridge refuses this Axe, and the bridge is taken from the site itself.
 */
export const TYOITASHI_BRIDGE_PATH = 'assets/axe-mcp/axe-mcp.mjs';

/** The steps for running the AI on a Claude Pro or Max plan through Claude Code (tyoitashi), as the fork shows them. */
export const SUBSCRIPTION_GUIDE_URL =
  'https://github.com/synchro4351/udonarium_axe/blob/codex/synwork-integration/docs/TYOITASHI_AI_GM_SUBSCRIPTION.md';

/** The address of tyoitashi's bridge on the site the page is served from. */
export function aiLinkBridgeUrl(): string {
  return new URL(TYOITASHI_BRIDGE_PATH, document.baseURI).href;
}
