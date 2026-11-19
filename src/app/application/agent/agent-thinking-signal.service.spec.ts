import { TestBed } from '@angular/core/testing';
import { AgentThinkingSignal, THINKING_SIGNAL_MS } from '@axe/application/agent/agent-thinking-signal.service';
import { AgentToolRunner } from '@axe/application/agent/agent-tool-runner.service';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('AgentThinkingSignal', () => {
  let runner: AgentToolRunner;
  let signals: ReturnType<typeof vi.spyOn>;
  let thinking: AgentThinkingSignal;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS] });
    runner = TestBed.inject(AgentToolRunner);
    thinking = TestBed.inject(AgentThinkingSignal);
    signals = vi.spyOn(thinking, 'signal').mockImplementation(() => undefined);
    thinking.start();
  });

  afterEach(() => {
    thinking.stop();
    vi.useRealTimers();
  });

  it('shows the AI typing while it thinks or works, and stops once it waits', async () => {
    runner.provide({ wait_for_events: () => new Promise(() => undefined), read_chat: async () => ({}) });

    await runner.run('read_chat', {}, 'read', new AbortController().signal);
    expect(runner.activity()).toBe('thinking');
    TestBed.tick();
    vi.advanceTimersByTime(THINKING_SIGNAL_MS * 2);
    expect(signals.mock.calls.length).toBeGreaterThanOrEqual(2);

    void runner.run('wait_for_events', {}, 'read', new AbortController().signal);
    await Promise.resolve();
    expect(runner.activity()).toBe('waiting');
    TestBed.tick();
    const sent = signals.mock.calls.length;
    vi.advanceTimersByTime(THINKING_SIGNAL_MS * 3);
    expect(signals.mock.calls.length).toBe(sent);
  });
});
