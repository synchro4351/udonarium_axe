import { readSpeechSettings, speechChunks, speechText } from '@axe/application/chat/chat-speech-settings';

describe('chat speech settings', () => {
  it('uses safe defaults and clamps numeric preferences', () => {
    expect(readSpeechSettings({ rate: 99, volume: -1, duckLevel: 2 })).toEqual({
      voiceURI: '',
      rate: 2,
      volume: 0,
      readSelf: true,
      duckBgm: false,
      duckLevel: 1,
      remoteVoices: false,
      tabs: {},
    });
  });

  it("retains the option to skip the reader's own messages", () => {
    expect(readSpeechSettings({ readSelf: false }).readSelf).toBe(false);
  });

  it('keeps only boolean tab preferences and the newest 64 entries', () => {
    const tabs: Record<string, unknown> = {};
    for (let i = 0; i < 66; i++) tabs[`tab-${i}`] = true;
    tabs.invalid = 'yes';
    const result = readSpeechSettings({ tabs });
    expect(Object.keys(result.tabs)).toHaveLength(64);
    expect(result.tabs['tab-0']).toBeUndefined();
    expect(result.tabs['tab-2']).toBe(true);
    expect(result.tabs.invalid).toBeUndefined();
  });

  it('removes markup, links and ruby syntax from spoken text', () => {
    expect(speechText('｜名前《なまえ》 <b>hello</b> https://example.test/x')).toBe('なまえ hello');
  });

  it('chunks long text without dropping Unicode characters', () => {
    const chunks = speechChunks('あ'.repeat(321));
    expect(chunks.map((chunk) => chunk.length)).toEqual([160, 160, 1]);
    expect(chunks.join('')).toBe('あ'.repeat(321));
  });
});
