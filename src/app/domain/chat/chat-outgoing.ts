import GameSystemClass from 'bcdice/lib/game_system';

export interface ChatOutgoing {
  text: string;
  gameSystem: GameSystemClass;
  sendFrom: string;
  sendTo: string;
  portraitIndex: number;
  messColor: string;
  messBubbleLight?: string;
  messBubbleDark?: string;
  replyTo: string;
  quoteOf: string;
  /** Whether the line is also sent round the edge of everyone's screen. */
  toTicker: boolean;
}

/**
 * A stamp as it goes out: its picture and name, spoken by and to whoever the input has chosen.
 *
 * It carries no words and no dice system, so nothing in it is read as a command.
 */
export interface ChatStampOutgoing {
  stampName: string;
  imageIdentifier: string;
  sendFrom: string;
  sendTo: string;
  portraitIndex: number;
  messColor: string;
  messBubbleLight?: string;
  messBubbleDark?: string;
  replyTo: string;
  quoteOf: string;
}

export interface ChatOutgoingDraft {
  text: string;
  gameSystem: GameSystemClass;
  sendFrom: string;
  sendTo: string;
  portraitIndex: number;
  color: string;
  bubbles: { light: string; dark: string };
  replyTo: string;
  quoteOf: string;
  toTicker: boolean;
}

/**
 * The line as it goes out, from what the box was holding when it was sent.
 *
 * The dice system is looked up while the line waits, so what is sent is put together from
 * what was read before the wait rather than from the box as it stands afterwards: a reader
 * who starts the next line during that moment does not have it swept into this one.
 */
export function composeChatOutgoing(draft: ChatOutgoingDraft): ChatOutgoing {
  return {
    text: draft.text,
    gameSystem: draft.gameSystem,
    sendFrom: draft.sendFrom,
    sendTo: draft.sendTo,
    portraitIndex: draft.portraitIndex,
    messColor: draft.color,
    messBubbleLight: draft.bubbles.light,
    messBubbleDark: draft.bubbles.dark,
    replyTo: draft.replyTo,
    quoteOf: draft.quoteOf,
    toTicker: draft.toTicker,
  };
}
