const { Window } = await import(process.env.HAPPY_DOM_MODULE || 'happy-dom');
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = new URL('./', import.meta.url);
const window = new Window({ settings: { enableJavaScriptEvaluation: true } });
const calls = [];
const local = { name: 'Japanese local', voiceURI: 'local', lang: 'ja-JP', localService: true };
const remote = { name: 'Japanese remote', voiceURI: 'remote', lang: 'ja-JP', localService: false };
const synth = {
  getVoices: () => [local, remote],
  addEventListener() {},
  cancel() {},
  speak(u) {
    calls.push(u);
  },
};
Object.defineProperty(window, 'speechSynthesis', { value: synth });
window.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text;
  }
};
window.document.write(readFileSync(new URL('index.html', base), 'utf8').replace(/<script[\s\S]*?<\/script>/g, ''));
window.eval(readFileSync(new URL('speech.js', base), 'utf8'));
const doc = window.document;
const click = (id) => doc.getElementById(id).click();
const channel = doc.querySelector('.channel');
const send = (text) => {
  channel.querySelector('.composer input').value = text;
  channel.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
};
assert.equal(calls.length, 0, 'Never speak on load');
assert.equal(doc.querySelectorAll('#voice option').length, 1, 'Remote voices are opt-in');
click('start');
channel.querySelector('.auto').checked = true;
send('最初の発言');
assert.equal(calls.length, 1, 'New enabled message starts');
const old = calls[0];
send('次の発言');
assert.equal(calls.length, 1, 'Serial queue does not speak over active message');
old.onend();
assert.equal(calls.length, 2, 'Completion advances queue');
click('stop');
const before = calls.length;
calls.at(-1).onend();
assert.equal(calls.length, before, 'Late callback cannot restart after stop');
send('停止後の発言');
assert.equal(calls.length, before, 'Stop disables automatic reading');
channel.querySelector('.message button').click();
assert.equal(calls.length, before + 1, 'Manual replay works after stop');
send('手動再生中の発言');
assert.equal(calls.length, before + 1, 'Manual replay does not enable auto');
click('stop');
click('start');
const longText = '長い文章です。'.repeat(70);
send(longText);
const longStart = calls.length - 1;
let cursor = longStart;
while (cursor < calls.length) calls[cursor++].onend();
assert.equal(
  calls
    .slice(longStart)
    .map((u) => u.text)
    .join(''),
  longText,
  'Long message is not truncated'
);
send('再生中');
for (let i = 0; i < 6; i++) send('連続発言 ' + i);
assert.match(
  channel.querySelector('.message:last-child').textContent,
  /省略/,
  'Queue overflow marks the actual message'
);
click('stop');
doc.getElementById('remote').checked = true;
doc.getElementById('remote').dispatchEvent(new window.Event('change'));
doc.getElementById('voice').value = 'remote';
doc.getElementById('voice').dispatchEvent(new window.Event('change'));
channel.querySelector('.message button').click();
assert.equal(calls.at(-1).voice, remote);
const remoteCall = calls.at(-1);
doc.getElementById('remote').checked = false;
doc.getElementById('remote').dispatchEvent(new window.Event('change'));
const count = calls.length;
remoteCall.onend();
assert.equal(calls.length, count, 'Disabling remote invalidates its callbacks');
synth.getVoices = () => [remote];
doc.getElementById('remote').dispatchEvent(new window.Event('change'));
channel.querySelector('.message button').click();
assert.equal(calls.length, count, 'No unapproved default voice fallback');
console.log(
  'PASS: load, voice consent, serial queue, stop, stale callback, manual replay, full long text, overflow, remote cancellation, no-voice fallback'
);
await window.happyDOM.close();
