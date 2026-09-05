import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ChatSpeechService } from '@axe/application/chat/chat-speech.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'chat-speech-controls',
  templateUrl: './chat-speech-controls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
})
export class ChatSpeechControlsComponent {
  readonly message = input.required<ChatMessage>();
  protected readonly speech = inject(ChatSpeechService);
  private readonly changes = inject(ObjectChangeService);

  canRead(): boolean {
    const message = this.message();
    this.changes.versionOf(message.identifier)();
    this.changes.versionOf(message.tabIdentifier)();
    this.changes.trackMyCursor();
    return this.speech.canRead(message);
  }

  speak(): void {
    this.speech.speak(this.message());
  }

  stop(): void {
    this.speech.stop();
  }
}
