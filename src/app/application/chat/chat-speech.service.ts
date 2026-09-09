import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  readSpeechSettings,
  SPEECH_STORAGE_KEY,
  speechChunks,
  SpeechSettings,
  speechText,
} from '@axe/application/chat/chat-speech-settings';
import { AudioPlayer } from '@axe/core/storage/audio-player';
import { ObjectStore } from '@axe/core/sync/object-store';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { ChatTab } from '@axe/domain/chat/chat-tab';
import { canRoleViewTab } from '@axe/domain/chat/chat-tab-permission';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';

export type { SpeechSettings } from '@axe/application/chat/chat-speech-settings';

type SpeechItem = { id: string; automatic: boolean };

@Injectable({ providedIn: 'root' })
export class ChatSpeechService {
  private readonly store = inject(ObjectStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly synth = typeof window === 'undefined' ? undefined : window.speechSynthesis;
  readonly supported = !!this.synth && typeof SpeechSynthesisUtterance !== 'undefined';
  readonly settings = signal<SpeechSettings>(this.readSettings());
  readonly voices = signal<SpeechSynthesisVoice[]>([]);
  readonly enabled = signal(false);
  readonly speakingId = signal<string | null>(null);
  readonly pendingCount = signal(0);
  readonly skippedIds = signal<ReadonlySet<string>>(new Set());
  readonly status = signal('feature.chat.speech.ready');
  private queue: SpeechItem[] = [];
  private current: SpeechItem | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private generation = 0;
  private watchdog: ReturnType<typeof setTimeout> | undefined;
  private releaseTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly refreshVoices = () => {
    this.voices.set(this.synth?.getVoices() ?? []);
    const allowed = this.voices().filter((voice) => voice.localService || this.settings().remoteVoices);
    // Browsers may populate this list asynchronously; retain the saved voice until then.
    if (!allowed.length) return;
    if (!allowed.some((voice) => voice.voiceURI === this.settings().voiceURI)) {
      const voice = allowed.find((v) => v.lang.toLowerCase().startsWith('ja')) ?? allowed[0];
      this.patchSettings({ voiceURI: voice?.voiceURI ?? '' });
    }
  };
  private readonly leave = () => this.disable();

  constructor() {
    if (this.supported) {
      this.refreshVoices();
      this.synth?.addEventListener('voiceschanged', this.refreshVoices);
    } else this.status.set('feature.chat.speech.unsupported');
    window.addEventListener('pagehide', this.leave);
    this.destroyRef.onDestroy(() => {
      this.disable();
      this.synth?.removeEventListener('voiceschanged', this.refreshVoices);
      window.removeEventListener('pagehide', this.leave);
    });
  }

  patchSettings(patch: Partial<SpeechSettings>): void {
    const previous = this.settings();
    const next = readSpeechSettings({ ...previous, ...patch });
    if (previous.voiceURI !== next.voiceURI || previous.remoteVoices !== next.remoteVoices) this.stop();
    this.settings.set(next);
    try {
      localStorage.setItem(SPEECH_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* Storage can be unavailable. */
    }
    if (this.current) this.duck();
  }

  tabEnabled(name: string): boolean {
    return this.settings().tabs[name] === true;
  }

  setTabEnabled(name: string, enabled: boolean): void {
    this.patchSettings({ tabs: { ...this.settings().tabs, [name]: enabled } });
    if (!enabled) {
      this.queue = this.queue.filter((item) => !item.automatic || this.tabName(item.id) !== name);
      this.pendingCount.set(this.queue.length);
      if (this.current?.automatic && this.tabName(this.current.id) === name) this.stop();
    }
  }

  start(): void {
    if (!this.voice()) {
      this.status.set(this.supported ? 'feature.chat.speech.noVoice' : 'feature.chat.speech.unsupported');
      return;
    }
    this.enabled.set(true);
    this.status.set('feature.chat.speech.ready');
  }

  disable(): void {
    this.enabled.set(false);
    this.stop();
    this.status.set('feature.chat.speech.disabled');
  }

  /** A stop never changes the preference to read future messages automatically. */
  stop(): void {
    this.generation++;
    this.clearTimers();
    this.queue = [];
    this.current = null;
    this.utterance = null;
    this.speakingId.set(null);
    this.pendingCount.set(0);
    this.synth?.cancel();
    AudioPlayer.setSpeechDucking(1);
    this.status.set('feature.chat.speech.stopped');
  }

  canRead(message: ChatMessage): boolean {
    const tab = this.store.get<ChatTab>(message.tabIdentifier);
    return (
      !!tab &&
      this.store.get(message.identifier) === message &&
      message.isDisplayable &&
      !message.isSecret &&
      canRoleViewTab(tab, PeerCursor.myRole) &&
      speechText(message.text ?? '').length > 0
    );
  }

  speak(message: ChatMessage): void {
    if (!this.canRead(message)) return;
    this.stop();
    this.enqueue(message, false);
  }

  readAutomatically(message: ChatMessage): void {
    if (
      !this.enabled() ||
      !this.canRead(message) ||
      (message.isSendFromSelf && !this.settings().readSelf) ||
      message.isSystem ||
      message.isDirect
    )
      return;
    if (!this.tabEnabled(this.tabName(message.identifier))) return;
    this.enqueue(message, true);
  }

  /** Recheck permissions when a message, tab, or the reader's role changes. */
  checkPermissions(): void {
    const message = this.current && this.store.get<ChatMessage>(this.current.id);
    if (this.current && (!message || !this.canRead(message))) this.stop();
  }

  private enqueue(message: ChatMessage, automatic: boolean): void {
    if (!this.voice()) {
      this.status.set('feature.chat.speech.noVoice');
      return;
    }
    if (this.queue.length >= 5) {
      const skipped = new Set(this.skippedIds());
      skipped.add(message.identifier);
      if (skipped.size > 256) skipped.delete(skipped.values().next().value!);
      this.skippedIds.set(skipped);
      this.status.set('feature.chat.speech.overflow');
      return;
    }
    const skipped = new Set(this.skippedIds());
    skipped.delete(message.identifier);
    this.skippedIds.set(skipped);
    this.queue.push({ id: message.identifier, automatic });
    this.pendingCount.set(this.queue.length);
    this.pump();
  }

  private pump(): void {
    if (this.current) return;
    const item = this.queue.shift();
    this.pendingCount.set(this.queue.length);
    if (!item) {
      this.releaseTimer = setTimeout(() => AudioPlayer.setSpeechDucking(1), 250);
      this.status.set('feature.chat.speech.ready');
      return;
    }
    const message = this.store.get<ChatMessage>(item.id);
    if (
      !message ||
      !this.canRead(message) ||
      (item.automatic && (!this.enabled() || !this.tabEnabled(this.tabName(item.id))))
    ) {
      this.pump();
      return;
    }
    const voice = this.voice();
    if (!voice) {
      this.stop();
      this.status.set('feature.chat.speech.noVoice');
      return;
    }
    this.current = item;
    clearTimeout(this.releaseTimer);
    const generation = this.generation;
    const chunks = speechChunks(speechText(message.text));
    let index = 0;
    const next = () => {
      if (generation !== this.generation) return;
      clearTimeout(this.watchdog);
      if (!this.canRead(message)) {
        this.stop();
        return;
      }
      if (index === chunks.length) {
        this.current = null;
        this.utterance = null;
        this.speakingId.set(null);
        this.pump();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index++]);
      this.utterance = utterance;
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = this.settings().rate;
      utterance.volume = this.settings().volume;
      const fail = () => {
        if (generation !== this.generation) return;
        this.disable();
        this.status.set('feature.chat.speech.error');
      };
      utterance.onstart = () => {
        if (generation !== this.generation) return;
        this.speakingId.set(item.id);
        this.status.set('feature.chat.speech.speaking');
        this.duck();
      };
      utterance.onend = next;
      utterance.onerror = fail;
      this.watchdog = setTimeout(fail, 120_000);
      try {
        this.synth?.speak(utterance);
      } catch {
        fail();
      }
    };
    next();
  }

  private voice(): SpeechSynthesisVoice | undefined {
    return this.voices().find(
      (v) => v.voiceURI === this.settings().voiceURI && (v.localService || this.settings().remoteVoices)
    );
  }
  private tabName(id: string): string {
    const message = this.store.get<ChatMessage>(id);
    return message ? (this.store.get<ChatTab>(message.tabIdentifier)?.name ?? '') : '';
  }
  private duck(): void {
    AudioPlayer.setSpeechDucking(this.settings().duckBgm ? this.settings().duckLevel : 1);
  }
  private clearTimers(): void {
    clearTimeout(this.watchdog);
    clearTimeout(this.releaseTimer);
  }
  private readSettings(): SpeechSettings {
    try {
      return readSpeechSettings(JSON.parse(localStorage.getItem(SPEECH_STORAGE_KEY) ?? '{}'));
    } catch {
      return readSpeechSettings({});
    }
  }
}
