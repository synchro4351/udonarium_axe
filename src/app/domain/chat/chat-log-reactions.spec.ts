import { exportChatLog } from '@axe/domain/chat/chat-log-export';
import type { ChatLogReaction } from '@axe/domain/chat/chat-log-exporter';
import { ChatLogLine, ChatLogTab } from '@axe/domain/chat/chat-log-exporter';
import type { ChatLogStyle } from '@axe/domain/chat/chat-log-style';

const BASE = new Date(2026, 8, 26, 20, 0).getTime();
const CHEERED: readonly ChatLogReaction[] = [
  { label: '👍', count: 2 },
  { label: '❤️', count: 1 },
];
const reactionsOf = (id: string) => (id === 'reacted' ? CHEERED : []);

function line(overrides: Partial<ChatLogLine> = {}): ChatLogLine {
  const timestamp = overrides.timestamp ?? BASE;
  return {
    identifier: 'reacted',
    isPseudoDeleted: false,
    name: 'アリア',
    text: 'こんばんは',
    messColor: '#aa3333',
    timestamp,
    placedAt: overrides.placedAt ?? timestamp,
    from: 'reader',
    to: '',
    fixd: false,
    isSecret: false,
    isSendFromSelf: true,
    isDisplayable: true,
    isSentBy: (userId: string) => userId === (overrides.from ?? 'reader'),
    image: null,
    attachmentImages: [],
    quoteOf: '',
    quoteOfMessage: null,
    replyTo: '',
    replyToMessage: null,
    vnEmote: '',
    isSystemMessage: false,
    isDicebot: false,
    rollDetail: null,
    isOutOfStory: false,
    ...overrides,
  };
}

function tab(name: string, lines: ChatLogLine[]): ChatLogTab {
  return { name, chatMessages: lines };
}

const STYLES: readonly ChatLogStyle[] = ['standard', 'washi', 'text'];

describe('reactions in the html chat log', () => {
  describe.each(STYLES)('in the %s style', (style) => {
    it('follow the line with their counts, and not who left them', () => {
      const html = exportChatLog(style, 'tab', [tab('メイン', [line({ identifier: 'reacted' })])], {
        userId: 'reader',
        reactionsOf,
      });

      expect(html).toContain('👍');
      expect(html).toContain('❤️');
      expect(html.indexOf('👍')).toBeGreaterThan(html.indexOf('こんばんは'));
    });

    it('are left out for a line nobody reacted to, or one saved before reactions', () => {
      const html = exportChatLog(
        style,
        'tab',
        [tab('メイン', [line({ identifier: 'plain' }), line({ identifier: 'plain' })])],
        {
          userId: 'reader',
          reactionsOf,
        }
      );

      expect(html).not.toContain('class="rx"');
    });

    it('are kept from a reader a secret roll is kept from', () => {
      const secret = line({ isSecret: true, from: 'someone-else', text: '→ 6', identifier: 'reacted' });
      const html = exportChatLog(style, 'tab', [tab('メイン', [secret])], { userId: 'reader', reactionsOf });

      expect(html).not.toContain('→ 6');
      expect(html).not.toContain('👍');
    });

    it('show on a secret roll to the one who made it', () => {
      const secret = line({ isSecret: true, from: 'reader', text: '→ 6', identifier: 'reacted' });
      const html = exportChatLog(style, 'tab', [tab('メイン', [secret])], { userId: 'reader', reactionsOf });

      expect(html).toContain('👍');
      expect(html).toContain('❤️');
    });

    it('go nowhere with a whisper the reader was not part of, in one tab or all of them', () => {
      const whisper = line({ from: 'someone-else', to: 'third', text: 'ないしょ', identifier: 'reacted' });
      for (const scope of ['tab', 'all'] as const) {
        const html = exportChatLog(style, scope, [tab('メイン', [whisper, line({ identifier: 'plain' })])], {
          userId: 'reader',
          reactionsOf,
        });

        expect(html).not.toContain('ないしょ');
        expect(html).not.toContain('👍');
      }
    });
  });

  it('escapes reaction labels in HTML logs', () => {
    const html = exportChatLog('standard', 'tab', [tab('Main', [line()])], {
      userId: 'reader',
      reactionsOf: () => [{ label: '<i>', count: 1 }],
    });
    expect(html).toContain('&lt;i&gt;');
    expect(html).not.toContain('<i>');
  });
});
