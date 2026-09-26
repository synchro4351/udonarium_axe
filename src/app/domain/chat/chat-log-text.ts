import {
  ChatLogEntry,
  ChatLogExporter,
  ChatLogLine,
  ChatLogTab,
  ChatLogTextDecoder,
} from '@axe/domain/chat/chat-log-exporter';
import { ChatLogLabels, ChatLogScope, DEFAULT_CHAT_LOG_LABELS } from '@axe/domain/chat/chat-log-rich';
import { formatReactionSummary } from '@axe/domain/chat/chat-reaction';
import { vnBodyOf } from '@axe/domain/visual-novel/vn-emote';

export interface ChatLogTextLabels extends Pick<
  ChatLogLabels,
  'secret' | 'edited' | 'quote' | 'reply' | 'critical' | 'fumble' | 'success' | 'failure' | 'allTabs' | 'exportedWith'
> {
  /** Stands in for a picture attached to a line, which a text file cannot hold. */
  attachment: string;
  /** Stands in for a stamp, written with its name. */
  stamp: string;
  /** Heads the counts of the reactions on a line. */
  reactions: string;
}

export const DEFAULT_CHAT_LOG_TEXT_LABELS: ChatLogTextLabels = {
  ...DEFAULT_CHAT_LOG_LABELS,
  attachment: '画像添付',
  stamp: 'スタンプ',
  reactions: 'リアクション',
};

export interface ChatLogTextOptions {
  userId?: string;
  textDecoder?: ChatLogTextDecoder;
  roomName?: string;
  labels?: Partial<ChatLogTextLabels>;
  exportedAt?: number;
}

const INDENT = '    ';
const RUBY_NOTATION = /[|｜]([^|｜\s]+?)《(.+?)》/g;
// Control characters other than the tab and line feed have no place in a text file.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

/**
 * Renders a chat log as plain text, one line said per entry in the order lines were placed.
 *
 * `scope` is the first of `tabs` alone, or every spoken tab merged, as in the html logs. Only the
 * lines the reader may see are written, and a secret roll kept from them shows as the secret label
 * without its words, what it quotes or its reactions. Each entry opens with its time, its tab when
 * several are merged, and the speaker; further lines of the text, a quoted or replied-to line,
 * attached pictures and reaction counts follow indented. Pictures are named, never embedded, and
 * ruby notation is written `base《reading》`.
 */
export function renderChatLogText(
  scope: ChatLogScope,
  tabs: readonly ChatLogTab[],
  options: ChatLogTextOptions = {}
): string {
  const labels: ChatLogTextLabels = { ...DEFAULT_CHAT_LOG_TEXT_LABELS, ...options.labels };
  const logTabs = scope === 'all' ? ChatLogExporter.spokenTabs(tabs) : tabs.slice(0, 1);
  const entries =
    scope === 'all' ? ChatLogExporter.mergeEntries(logTabs, options.userId) : singleTabEntries(logTabs[0], options);
  const showTab = scope === 'all' && logTabs.length > 1;

  const title = scope === 'all' ? labels.allTabs : (logTabs[0]?.name ?? '');
  const head = [singleLine(options.roomName ? `${title} — ${options.roomName}` : title)];
  head.push(
    singleLine(labels.exportedWith) + (options.exportedAt != null ? ` · ${formatDateTime(options.exportedAt)}` : '')
  );

  const body: string[] = [];
  let day = '';
  for (const entry of entries) {
    const entryDay = formatDate(entry.message.placedAt);
    if (entryDay !== day) {
      day = entryDay;
      body.push('', `--- ${entryDay} ---`);
    }
    body.push(...entryLines(entry, showTab, options, labels));
  }
  return [...head, ...body].join('\n') + '\n';
}

function singleTabEntries(tab: ChatLogTab | undefined, options: ChatLogTextOptions): ChatLogEntry[] {
  if (!tab) return [];
  return tab.chatMessages
    .filter((message) => ChatLogExporter.isVisibleMessage(message, options.userId))
    .map((message) => ({ tab, tabIndex: 0, message }));
}

function entryLines(
  entry: ChatLogEntry,
  showTab: boolean,
  options: ChatLogTextOptions,
  labels: ChatLogTextLabels
): string[] {
  const { message } = entry;
  const readable = !message.isSecret || ChatLogExporter.canSee(message, options.userId);

  let prefix = `[${formatTime(message.timestamp)}] `;
  if (showTab) prefix += `[${singleLine(entry.tab.name)}] `;
  if (message.isSystemMessage && !message.isDicebot) {
    prefix += '* ';
  } else {
    prefix += `${singleLine(decode(message.name, options))}：`;
  }

  if (!readable) {
    const sealed = `（${labels.secret}）` + (message.fixd ? ` (${labels.edited})` : '');
    return [prefix + sealed];
  }

  const contents = textLines(vnBodyOf(message.vnEmote, decode(message.text, options)));
  // A stamp is written by its name, which says more than the name of its picture's file.
  const attachments = message.stampName
    ? `[${labels.stamp}: ${singleLine(message.stampName)}]`
    : (message.attachmentImages ?? [])
        .map((image) => `[${labels.attachment}${image.name ? `: ${singleLine(image.name)}` : ''}]`)
        .join(' ');
  if (attachments) contents.push(attachments);
  if (contents.length < 1) contents.push('');

  const outcome = message.isDicebot ? (message.rollDetail?.outcome ?? '') : '';
  if (outcome) contents[contents.length - 1] += ` 【${labels[outcome]}】`;
  if (message.fixd) contents[contents.length - 1] += ` (${labels.edited})`;

  const lines = [prefix + contents[0], ...contents.slice(1).map((line) => INDENT + line)];
  lines.push(...referenceLines(message, options, labels));

  const summary = formatReactionSummary(message.reactions);
  if (summary) lines.push(`${INDENT}${labels.reactions}: ${singleLine(summary)}`);
  return lines;
}

// A quoted or replied-to line the reader may not see is left out altogether, name and all,
// so a whisper or a secret roll cannot come out through a line that answers it.
function referenceLines(message: ChatLogLine, options: ChatLogTextOptions, labels: ChatLogTextLabels): string[] {
  const lines: string[] = [];
  const quote = message.quoteOf ? message.quoteOfMessage : null;
  const reply = message.replyTo ? message.replyToMessage : null;
  if (quote && ChatLogExporter.isReadable(quote, options.userId))
    lines.push(referenceLine('❝', labels.quote, quote, 280, options));
  if (reply && ChatLogExporter.isReadable(reply, options.userId))
    lines.push(referenceLine('↩', labels.reply, reply, 120, options));
  return lines;
}

function referenceLine(
  icon: string,
  label: string,
  target: ChatLogLine,
  maxTextLength: number,
  options: ChatLogTextOptions
): string {
  const name = singleLine(decode(target.name, options)) || label;
  const excerpt = plainText(ChatLogExporter.referenceExcerpt(target, maxTextLength, options.textDecoder));
  return `${INDENT}${icon} ${label} ${name}：${excerpt}`;
}

function textLines(text: string): string[] {
  const lines = plainText(text).split('\n');
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  return lines;
}

/** Text with ruby notation written `base《reading》`, line breaks as `\n` and no control characters. */
function plainText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(CONTROL, '').replace(RUBY_NOTATION, '$1《$2》');
}

function singleLine(text: string): string {
  return plainText(text).replace(/\s+/g, ' ').trim();
}

function decode(text: string | null | undefined, options: ChatLogTextOptions): string {
  return ChatLogExporter.decode(text, options.textDecoder);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDate(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function formatTime(time: number): string {
  const date = new Date(time);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(time: number): string {
  return `${formatDate(time)} ${formatTime(time)}`;
}
