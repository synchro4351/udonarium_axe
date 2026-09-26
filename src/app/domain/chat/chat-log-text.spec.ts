import type { ImageFile } from '@axe/core/storage/image-file';
import { ChatLogLine, ChatLogTab } from '@axe/domain/chat/chat-log-exporter';
import { renderChatLogText } from '@axe/domain/chat/chat-log-text';
import type { ChatMessage } from '@axe/domain/chat/chat-message';
import type { ChatReactionCount } from '@axe/domain/chat/chat-reaction';

const BASE = new Date(2026, 8, 26, 20, 0).getTime();
const MINUTE = 60 * 1000;
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

/** A line standing where a quoted or replied-to message is expected, which the log reads only as a line. */
function asMessage(value: ChatLogLine): ChatMessage {
  return value as unknown as ChatMessage;
}

function tab(name: string, lines: ChatLogLine[], isSystemTab = false): ChatLogTab {
  return { name, chatMessages: lines, isSystemTab };
}

function image(name: string): ImageFile {
  return { identifier: `id-${name}`, name, url: 'data:image/png;base64,AAAA', blob: null } as unknown as ImageFile;
}

/** The lines after the heading, which carries the title and the export time. */
function bodyOf(text: string): string[] {
  return text.split('\n').slice(2);
}

describe('renderChatLogText', () => {
  it('writes a heading, a day marker, then the time, speaker and text of each line', () => {
    const text = renderChatLogText('tab', [tab('メイン', [line()])], {
      userId: 'reader',
      roomName: '古城',
      exportedAt: BASE,
    });

    expect(text).toBe(
      'メイン — 古城\nUdonarium Axe · 2026/09/26 20:00\n\n--- 2026/09/26 ---\n[20:00] アリア：こんばんは\n'
    );
  });

  it('holds no markup, whatever the line says', () => {
    const text = renderChatLogText('tab', [tab('メイン', [line({ text: '<b>太字</b> & "引用"' })])], {
      userId: 'reader',
    });

    expect(text).toContain('[20:00] アリア：<b>太字</b> & "引用"');
    expect(text).not.toContain('&amp;');
    expect(text).not.toContain('<div');
    expect(text).not.toContain('<br>');
  });

  it('indents the further lines of a line said over several', () => {
    const text = renderChatLogText('tab', [tab('メイン', [line({ text: '一行目\r\n二行目\n\n四行目\n' })])], {
      userId: 'reader',
    });

    expect(bodyOf(text)).toEqual([
      '',
      '--- 2026/09/26 ---',
      '[20:00] アリア：一行目',
      '    二行目',
      '    ',
      '    四行目',
      '',
    ]);
  });

  it('writes ruby notation as base and reading, without the bar', () => {
    const text = renderChatLogText('tab', [tab('メイン', [line({ text: '|漢字《かんじ》と｜熟語《じゅくご》' })])], {
      userId: 'reader',
    });

    expect(text).toContain('アリア：漢字《かんじ》と熟語《じゅくご》');
    expect(text).not.toContain('<ruby>');
  });

  it('drops control characters but keeps emoji and tabs', () => {
    const text = renderChatLogText('tab', [tab('メイン', [line({ text: 'a\u0007b\tc 🎲' })])], { userId: 'reader' });

    expect(text).toContain('アリア：ab\tc 🎲');
  });

  it('names attached pictures instead of holding them', () => {
    const attached = line({ text: '地図です', attachmentImages: [image('map.png'), image('')] });
    const text = renderChatLogText('tab', [tab('メイン', [attached])], { userId: 'reader' });

    expect(bodyOf(text)).toContain('    [画像添付: map.png] [画像添付]');
    expect(text).not.toContain('data:image');
    expect(text).not.toContain('<img');
  });

  it('puts the picture on the speaker line when nothing was written', () => {
    const attached = line({ text: '', attachmentImages: [image('map.png')] });
    const text = renderChatLogText('tab', [tab('メイン', [attached])], { userId: 'reader' });

    expect(text).toContain('[20:00] アリア：[画像添付: map.png]\n');
  });

  it('writes a roll with its result and outcome, and marks an edited line', () => {
    const roll = line({
      name: '<BCDice：アリア>',
      text: '(2D6>=7) ＞ 9[4,5] ＞ 9 ＞ 成功',
      isDicebot: true,
      rollDetail: { system: 'DiceBot', faces: [], outcome: 'success' },
    });
    const edited = line({ text: '訂正', fixd: true, timestamp: BASE + MINUTE });
    const text = renderChatLogText('tab', [tab('メイン', [roll, edited])], { userId: 'reader' });

    expect(text).toContain('[20:00] <BCDice：アリア>：(2D6>=7) ＞ 9[4,5] ＞ 9 ＞ 成功 【成功】\n');
    expect(text).toContain('[20:01] アリア：訂正 (編集済)\n');
  });

  it('follows a line with its reaction counts on one line, and not who left them', () => {
    const text = renderChatLogText('tab', [tab('メイン', [line({ reactions: CHEERED })])], { userId: 'reader' });

    expect(bodyOf(text)).toEqual([
      '',
      '--- 2026/09/26 ---',
      '[20:00] アリア：こんばんは',
      `    リアクション: ${SUMMARY}`,
      '',
    ]);
    expect(text).not.toContain('reader');
  });

  it('writes a line saved before reactions, or one nobody reacted to, without a reaction line', () => {
    const text = renderChatLogText('tab', [tab('メイン', [line(), line({ reactions: [] })])], { userId: 'reader' });

    expect(text).not.toContain('リアクション');
  });

  it('keeps the words and reactions of a secret roll from a reader who did not make it', () => {
    const secret = line({
      isSecret: true,
      from: 'someone-else',
      name: '<Secret-BCDice：GM>',
      text: '→ 6',
      isDicebot: true,
      rollDetail: { system: 'DiceBot', faces: [], outcome: 'critical' },
      attachmentImages: [image('hidden.png')],
      reactions: CHEERED,
    });
    const text = renderChatLogText('tab', [tab('メイン', [secret])], { userId: 'reader' });

    expect(text).toContain('<Secret-BCDice：GM>：（シークレットダイス）\n');
    expect(text).not.toContain('→ 6');
    expect(text).not.toContain('クリティカル');
    expect(text).not.toContain('hidden.png');
    expect(text).not.toContain(SUMMARY);
  });

  it('shows a secret roll in full to the one who made it', () => {
    const secret = line({ isSecret: true, from: 'reader', text: '→ 6', reactions: CHEERED });
    const text = renderChatLogText('tab', [tab('メイン', [secret])], { userId: 'reader' });

    expect(text).toContain('アリア：→ 6');
    expect(text).toContain(SUMMARY);
  });

  it('leaves out a whisper the reader was not part of, in one tab or all of them', () => {
    const whisper = line({ from: 'someone-else', to: 'third', name: '密談者', text: 'ないしょ', reactions: CHEERED });
    for (const scope of ['tab', 'all'] as const) {
      const text = renderChatLogText(scope, [tab('メイン', [whisper, line()])], { userId: 'reader' });

      expect(text).not.toContain('ないしょ');
      expect(text).not.toContain('密談者');
      expect(text).not.toContain(SUMMARY);
      expect(text).toContain('こんばんは');
    }
  });

  it('keeps a whisper sent to the reader', () => {
    const whisper = line({ from: 'someone-else', to: 'reader', text: 'きみにだけ' });
    const text = renderChatLogText('tab', [tab('メイン', [whisper])], { userId: 'reader' });

    expect(text).toContain('きみにだけ');
  });

  it('shows what a line quotes and answers, cut to one line', () => {
    const target = line({ name: 'GM', text: 'まずは\n村へ|向《む》かう' });
    const answer = line({
      text: '了解',
      quoteOf: 'q',
      quoteOfMessage: asMessage(target),
      replyTo: 'r',
      replyToMessage: asMessage(target),
      timestamp: BASE + MINUTE,
    });
    const text = renderChatLogText('tab', [tab('メイン', [answer])], { userId: 'reader' });

    expect(bodyOf(text)).toEqual([
      '',
      '--- 2026/09/26 ---',
      '[20:01] アリア：了解',
      '    ❝ 引用 GM：まずは 村へ向《む》かう',
      '    ↩ 返信先 GM：まずは 村へ向《む》かう',
      '',
    ]);
  });

  it('does not let a quote or reply carry out a secret roll or whisper kept from the reader', () => {
    const secret = line({ isSecret: true, from: 'someone-else', name: 'GM', text: '秘密の出目' });
    const whisper = line({ from: 'someone-else', to: 'third', name: '密談者', text: 'ないしょ' });
    const answer = line({
      quoteOf: 'q',
      quoteOfMessage: asMessage(secret),
      replyTo: 'r',
      replyToMessage: asMessage(whisper),
    });
    const text = renderChatLogText('tab', [tab('メイン', [answer])], { userId: 'reader' });

    expect(text).not.toContain('秘密の出目');
    expect(text).not.toContain('ないしょ');
    expect(text).not.toContain('密談者');
    expect(text).not.toContain('引用');
  });

  it('merges every spoken tab in the order lines were placed, marking each with its tab', () => {
    const main = tab('メイン', [
      line({ text: '一', timestamp: BASE }),
      line({ text: '三', timestamp: BASE + 2 * MINUTE }),
    ]);
    const side = tab('雑談', [line({ text: '二', timestamp: BASE + MINUTE })]);
    const system = tab('システム', [line({ text: '入室しました', timestamp: BASE })], true);
    const text = renderChatLogText('all', [main, side, system], { userId: 'reader' });

    expect(text.startsWith('全タブ\n')).toBe(true);
    expect(bodyOf(text)).toEqual([
      '',
      '--- 2026/09/26 ---',
      '[20:00] [メイン] アリア：一',
      '[20:01] [雑談] アリア：二',
      '[20:02] [メイン] アリア：三',
      '',
    ]);
  });

  it('takes the first tab alone for a single tab, without marking the tab', () => {
    const text = renderChatLogText(
      'tab',
      [tab('メイン', [line({ text: '一' })]), tab('雑談', [line({ text: '二' })])],
      {
        userId: 'reader',
      }
    );

    expect(text).toContain('[20:00] アリア：一');
    expect(text).not.toContain('二');
    expect(text).not.toContain('[メイン]');
  });

  it('starts a new day marker when the date changes', () => {
    const late = line({ text: '深夜', timestamp: new Date(2026, 8, 27, 0, 5).getTime() });
    const text = renderChatLogText('tab', [tab('メイン', [line(), late])], { userId: 'reader' });

    expect(text).toContain('--- 2026/09/26 ---');
    expect(text).toContain('--- 2026/09/27 ---\n[00:05] アリア：深夜');
  });

  it('writes a notice from the tool without a speaker', () => {
    const notice = line({ name: 'System', from: 'System', text: 'GMが入室しました', isSystemMessage: true });
    const text = renderChatLogText('tab', [tab('システム', [notice], true)], { userId: 'reader' });

    expect(text).toContain('[20:00] * GMが入室しました');
  });

  it('decodes names and text and uses the labels given', () => {
    const secret = line({ isSecret: true, from: 'someone-else', text: 'x' });
    const text = renderChatLogText('tab', [tab('Main', [line({ text: '@i18n:hello' }), secret])], {
      userId: 'reader',
      textDecoder: (value) => (value === '@i18n:hello' ? 'Hello' : value),
      labels: { secret: 'Secret dice', exportedWith: 'Exported' },
    });

    expect(text).toContain('Exported\n');
    expect(text).toContain('アリア：Hello');
    expect(text).toContain('アリア：（Secret dice）');
  });

  it('writes only a heading for an empty log', () => {
    expect(renderChatLogText('all', [], { exportedAt: BASE })).toBe('全タブ\nUdonarium Axe · 2026/09/26 20:00\n');
  });
});
