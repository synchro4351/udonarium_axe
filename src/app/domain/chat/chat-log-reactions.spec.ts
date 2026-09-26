import { exportChatLog } from '@axe/domain/chat/chat-log-export';
import { ChatLogExporter, ChatLogLine, ChatLogTab } from '@axe/domain/chat/chat-log-exporter';
import type { ChatLogStyle } from '@axe/domain/chat/chat-log-style';
import type { ChatReactionCount } from '@axe/domain/chat/chat-reaction';

const BASE = new Date(2026, 8, 26, 20, 0).getTime();
const CHEERED: readonly ChatReactionCount[] = [
  { emoji: '👍', count: 2, mine: true },
  { emoji: '❤️', count: 1, mine: false },
];
const SUMMARY = '👍 2・❤️ 1';

function line(overrides: Partial<ChatLogLine> = {}): ChatLogLine {
  const timestamp = overrides.timestamp ?? BASE;
  return {
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

const STYLES: readonly ChatLogStyle[] = ['standard', 'coc', 'washi'];

describe('reactions in the html chat log', () => {
  describe.each(STYLES)('in the %s style', (style) => {
    it('follow the line with their counts, and not who left them', () => {
      const html = exportChatLog(style, 'tab', [tab('メイン', [line({ reactions: CHEERED })])], { userId: 'reader' });

      expect(html).toContain(SUMMARY);
      expect(html.indexOf(SUMMARY)).toBeGreaterThan(html.indexOf('こんばんは'));
    });

    it('are left out for a line nobody reacted to, or one saved before reactions', () => {
      const html = exportChatLog(style, 'tab', [tab('メイン', [line({ reactions: [] }), line()])], {
        userId: 'reader',
      });

      expect(html).not.toContain('class="rx"');
    });

    it('are kept from a reader a secret roll is kept from', () => {
      const secret = line({ isSecret: true, from: 'someone-else', text: '→ 6', reactions: CHEERED });
      const html = exportChatLog(style, 'tab', [tab('メイン', [secret])], { userId: 'reader' });

      expect(html).not.toContain('→ 6');
      expect(html).not.toContain(SUMMARY);
    });

    it('show on a secret roll to the one who made it', () => {
      const secret = line({ isSecret: true, from: 'reader', text: '→ 6', reactions: CHEERED });
      const html = exportChatLog(style, 'tab', [tab('メイン', [secret])], { userId: 'reader' });

      expect(html).toContain(SUMMARY);
    });

    it('go nowhere with a whisper the reader was not part of, in one tab or all of them', () => {
      const whisper = line({ from: 'someone-else', to: 'third', text: 'ないしょ', reactions: CHEERED });
      for (const scope of ['tab', 'all'] as const) {
        const html = exportChatLog(style, scope, [tab('メイン', [whisper, line()])], { userId: 'reader' });

        expect(html).not.toContain('ないしょ');
        expect(html).not.toContain(SUMMARY);
      }
    });
  });

  it('escape whatever a reaction holds', () => {
    const odd = line({ reactions: [{ emoji: '<i>', count: 1, mine: false }] });
    const html = ChatLogExporter.formatMessageStandard(false, '', odd, 'reader');

    expect(html).toContain('&lt;i&gt; 1');
    expect(html).not.toContain('<i>');
  });

  it('carry a style for their block in the standard layout', () => {
    expect(ChatLogExporter.STYLE_BLOCK).toContain('.rx{');
  });
});
