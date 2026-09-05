(() => {
  'use strict';
  const synth = window.speechSynthesis;
  const $ = (id) => document.getElementById(id);
  const state = { enabled: false, generation: 0, queue: [], current: null, utterance: null, voices: [] };
  const channels = [...document.querySelectorAll('.channel')];
  const status = (text) => {
    $('status').textContent = text;
  };
  const label = (item, text) => {
    item.badge.textContent = text;
  };
  function selectedVoice() {
    return state.voices.find((v) => v.voiceURI === $('voice').value && (v.localService || $('remote').checked));
  }
  function updateControls() {
    $('start').disabled = !selectedVoice() || state.enabled;
    $('stop').disabled = !state.enabled && !state.current && !state.queue.length;
  }
  function cancelAll() {
    state.generation++;
    if (state.current) label(state.current, '停止・聞き直せます');
    state.queue.forEach((item) => label(item, '待機解除・聞き直せます'));
    state.current = null;
    state.queue = [];
    state.utterance = null;
    synth?.cancel();
    updateControls();
  }
  function split(text) {
    const points = Array.from(text),
      result = [];
    while (points.length) result.push(points.splice(0, 160).join(''));
    return result;
  }
  function pump() {
    if (state.current || !state.queue.length) {
      updateControls();
      return;
    }
    const voice = selectedVoice();
    if (!voice) {
      cancelAll();
      status('利用できる声を選んでください。');
      return;
    }
    const item = state.queue.shift();
    state.current = item;
    const parts = split(item.text),
      generation = state.generation;
    let index = 0;
    function nextPart() {
      if (generation !== state.generation) return;
      if (index === parts.length) {
        label(item, '再生済み');
        state.current = null;
        state.utterance = null;
        status('再生が終わりました。');
        pump();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(parts[index++]);
      state.utterance = utterance;
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = Number($('rate').value);
      utterance.volume = Number($('volume').value);
      label(item, '再生中 ' + index + '/' + parts.length);
      status('再生中。待機 ' + state.queue.length + ' 件');
      utterance.onend = nextPart;
      utterance.onerror = (event) => {
        if (generation !== state.generation) return;
        state.enabled = false;
        cancelAll();
        label(item, '再生エラー・聞き直せます');
        status('読み上げエラー: ' + event.error + '。声を確認して再生し直してください。');
      };
      updateControls();
      try {
        synth.speak(utterance);
      } catch {
        utterance.onerror({ error: '再生を開始できませんでした' });
      }
    }
    nextPart();
  }
  function enqueue(item, manual = false) {
    if (!synth || !selectedVoice()) {
      status('利用できる声がありません。ChromeやEdgeでもお試しください。');
      return;
    }
    if (manual) cancelAll();
    if (state.queue.length >= 5) {
      label(item, '自動再生を省略・聞き直せます');
      status('待機が5件あるため、この発言の自動再生を省略しました。「読む」で再生できます。');
      return;
    }
    label(item, '待機中');
    state.queue.push(item);
    pump();
  }
  function add(channel, text) {
    const message = document.createElement('div');
    message.className = 'message';
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = channel.dataset.channel === 'main' ? '参加者A' : '参加者B';
    const badge = document.createElement('span');
    badge.textContent = '未再生';
    meta.append(badge);
    const body = document.createElement('div');
    body.className = 'message-text';
    body.textContent = text;
    const item = { text, badge, channel };
    const play = document.createElement('button');
    play.type = 'button';
    play.textContent = 'この発言を読む';
    play.addEventListener('click', () => enqueue(item, true));
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.textContent = 'この発言を停止';
    stop.addEventListener('click', () => {
      state.queue = state.queue.filter((pending) => pending !== item);
      if (state.current === item) {
        state.generation++;
        state.current = null;
        state.utterance = null;
        synth?.cancel();
      }
      label(item, '停止・聞き直せます');
      pump();
    });
    message.append(meta, body, play, stop);
    channel.querySelector('.messages').append(message);
    if (state.enabled && channel.querySelector('.auto').checked) enqueue(item);
  }
  function loadVoices() {
    const previous = $('voice').value;
    state.voices = synth?.getVoices() || [];
    const available = state.voices
      .filter((v) => v.localService || $('remote').checked)
      .sort((a, b) => Number(b.lang.startsWith('ja')) - Number(a.lang.startsWith('ja')));
    $('voice').replaceChildren();
    for (const v of available) {
      const option = document.createElement('option');
      option.value = v.voiceURI;
      option.textContent = v.name + ' / ' + v.lang + (v.localService ? '（端末内）' : '（リモート）');
      $('voice').append(option);
    }
    if (available.some((v) => v.voiceURI === previous)) $('voice').value = previous;
    if (!available.length) {
      state.enabled = false;
      cancelAll();
      status('利用できる端末内音声がありません。ChromeやEdge、OSの日本語音声設定を確認してください。');
    } else if (!available.some((v) => v.lang.startsWith('ja'))) {
      status('日本語の声が見つかりません。OSの日本語音声設定を確認してください。');
    } else {
      status('声を選んで、発言の「読む」で試せます。');
    }
    updateControls();
  }
  $('remote').addEventListener('change', () => {
    cancelAll();
    loadVoices();
  });
  $('voice').addEventListener('change', () => {
    cancelAll();
    status('声を変更しました。発言の「読む」で試せます。');
  });
  $('rate').addEventListener('input', () => {
    $('rate-value').textContent = Number($('rate').value).toFixed(1);
  });
  $('volume').addEventListener('input', () => {
    $('volume-value').textContent = Math.round(Number($('volume').value) * 100) + '%';
  });
  $('start').addEventListener('click', () => {
    state.enabled = true;
    status('自動読み上げ待機中。選んだタブの新しい発言だけを読みます。');
    updateControls();
  });
  $('stop').addEventListener('click', () => {
    state.enabled = false;
    cancelAll();
    status('自動読み上げも停止しました。個別の「読む」は引き続き使えます。');
  });
  channels.forEach((channel) => {
    channel.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = channel.querySelector('form input');
      if (input.value.trim()) add(channel, input.value.trim());
      input.value = '';
    });
    channel.querySelector('.auto').addEventListener('change', (event) => {
      if (event.target.checked) return;
      state.queue.filter((item) => item.channel === channel).forEach((item) => label(item, '待機解除・聞き直せます'));
      state.queue = state.queue.filter((item) => item.channel !== channel);
      if (state.current?.channel === channel) {
        label(state.current, '停止・聞き直せます');
        state.generation++;
        state.current = null;
        state.utterance = null;
        synth?.cancel();
      }
      pump();
    });
  });
  add(channels[0], '古い石の扉が、ゆっくりと開きます。奥から聞こえる水の音に、あなたたちは耳を澄ませました。');
  add(channels[1], '少し休憩しましょう。準備ができたら教えてください。');
  if (synth) {
    synth.addEventListener('voiceschanged', loadVoices);
    loadVoices();
  } else {
    status('このブラウザは読み上げに対応していません。ChromeやEdgeでお試しください。');
    updateControls();
  }
  window.addEventListener('pagehide', () => {
    state.enabled = false;
    cancelAll();
  });
})();
