/**
 * The name this build shows in the browser tab and on an installed app.
 *
 * It is a private fork of Udonarium Axe, so the name keeps the upstream name in front and adds the
 * fork's own after it, and the version is read as the Axe release it is built on.
 */
export const APP_DISPLAY_NAME = 'Udonarium Axe tyoitashi';

/** The page title for this build, naming the Axe release it is based on. */
export function appTitle(version: string): string {
  return `${APP_DISPLAY_NAME} (Axe v${version})`;
}
