import { readFileSync } from 'node:fs';

import { APP_DISPLAY_NAME, appTitle } from '@axe/app-title';

describe('the name the fork shows', () => {
  it('keeps Udonarium Axe in front and names the fork after it', () => {
    expect(APP_DISPLAY_NAME).toBe('Udonarium Axe tyoitashi');
  });

  it('reads the version as the Axe release it is based on', () => {
    expect(appTitle('1.57.1')).toBe('Udonarium Axe tyoitashi (Axe v1.57.1)');
  });

  it('names the fork in the page before the app starts', () => {
    const html = readFileSync('src/index.html', 'utf8');
    expect(html).toContain(`<title>${APP_DISPLAY_NAME}</title>`);
    expect(html).toContain(`<meta name="application-name" content="${APP_DISPLAY_NAME}" />`);
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Axe tyoitashi" />');
    expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]*Udonarium Axe[^"]*"/);
  });

  it('names the fork on an installed app while crediting the upstream', () => {
    const manifest = JSON.parse(readFileSync('src/manifest.webmanifest', 'utf8')) as Record<string, string>;
    expect(manifest['name']).toBe(APP_DISPLAY_NAME);
    expect(manifest['short_name']).toBe('Axe tyoitashi');
    expect(manifest['description']).toContain('Udonarium Axe');
  });
});
