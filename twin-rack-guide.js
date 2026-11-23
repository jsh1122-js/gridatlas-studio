/* In-scene rack guide. All equipment identifiers and electrical paths come from GridRackCircuit. */
((root) => {
  'use strict';

  function makeSteps(rack, trace) {
    const {rowdist, pdu, module, bus, servers} = trace;
    const pcie = rack.profile === 'pcie';
    const multiple = servers.length > 1;
    const destination = multiple ? servers.length + ' 个计算托盘' : servers[0].label;
    const destinationId = multiple ? servers[0].id + ' … ' + servers[servers.length - 1].id : servers[0].id;
    return [
      {key:'rowdist', tab:'列头柜', name:rowdist.label, id:rowdist.id,
        text:'列头柜把一列机柜需要的电分成多条支路。沿 ' + module.feed + ' 路，可以从这里追到当前柜的' + (rack.isDC ? '直流分配装置。' : '电源分配单元。')},
      {key:'pdu', tab:'机架配电', name:pdu.label, id:pdu.id,
        text:(rack.isDC ? '机架直流分配装置把直流电送到各模块的输入接口。' : 'PDU 是机柜里的电源分配单元，把上游交流电分到各个电源接口。') + '这里的 ' + module.feed + ' 路接到 ' + module.label + '。'},
      {key:'psu', tab:rack.isDC ? 'DC/DC' : 'PSU', name:module.label, id:module.id,
        text:(rack.isDC ? 'DC/DC 模块把上游直流电转换为设备所需的低压直流电。' : 'PSU 是电源模块，把送入机柜的交流电转换为设备所需的直流电。') + '本模块由 ' + pdu.label + ' 供电，输出接到' + bus.label + '。'},
      {key:'bus', tab:pcie ? '电源背板' : '共用母排', name:bus.label, id:bus.id,
        text:pcie ? '这一台服务器的两个电源模块都接到本机背板，由背板给主板供电。' : '母排是一组导电金属排。多只电源模块的输出在这里汇合，再一起给各计算托盘供电。'},
      {key:'servers', tab:pcie ? '服务器' : '计算托盘', name:destination, id:destinationId,
        text:pcie ? '这条支路通过本机背板给' + destination + '供电，服务器用这些电驱动 CPU、GPU 和其他板上器件。' : '这 ' + servers.length + ' 个计算托盘都从同一组母排取电。一个电源模块的输出可以由多个托盘共享，托盘上的 CPU 和 GPU 用这些电完成计算。'}
    ];
  }

  function mount(host, options = {}) {
    if (!host) throw new Error('缺少机柜讲解挂载点。');
    host.classList.add('trg');
    host.hidden = true;
    host.innerHTML = `
      <div class="trg-head"><div class="trg-location"><strong data-g="id"></strong><span data-g="place"></span></div>
        <div class="trg-actions"><button type="button" data-g="view"></button><button type="button" data-g="back">退出机柜</button></div></div>
      <div class="trg-tools"><label>电源模块<select data-g="slot"><option value="">选择槽位</option></select></label>
        <button type="button" data-g="door"></button><button type="button" data-g="extract"></button>
        <span data-g="mode"></span></div>
      <p class="trg-extraction" data-g="extractionNote" hidden>抽出用于观察，亮线显示模块装回时的供电路径。</p>
      <p class="trg-empty" data-g="empty"></p>
      <section class="trg-learn" data-g="learn" aria-label="机柜供电逐步讲解">
        <nav class="trg-path" data-g="path" aria-label="沿电流方向选择设备"></nav>
        <div class="trg-card"><div class="trg-focus" aria-live="polite" aria-atomic="true"><div class="trg-identity"><strong data-g="name"></strong><code data-g="code"></code></div><p data-g="text"></p></div>
          <div class="trg-play"><div class="trg-pager"><button type="button" data-g="prev" aria-label="上一步">‹</button><span data-g="count"></span><button type="button" data-g="next" aria-label="下一步">›</button></div>
          <button type="button" data-g="voice" aria-pressed="false"></button></div>
        </div>
      </section>
      <details class="trg-more"><summary data-g="summary">接线说明</summary>
        <p data-g="scope"></p><div data-g="traceNotes"><p data-g="redundancy"></p><p data-g="alternates"></p><p data-g="destinations"></p></div>
        <div class="trg-sources" data-g="sources"></div></details>`;

    const el = Object.fromEntries(Array.from(host.querySelectorAll('[data-g]'), n => [n.dataset.g,n]));
    const details = host.querySelector('details');
    let state = null, trace = null, steps = [], current = 0, rackSignature = '', lastStepSignature = '';
    let voice = null, speaking = false, voiceToken = 0, utterance = null, destroyed = false;
    let speech;
    try { speech = root.speechSynthesis; } catch { /* Voice support is optional. */ }
    const node = (tag, text) => {
      const n = document.createElement(tag);
      n.textContent = text;
      return n;
    };
    const binding = (button, handler) => { button.onclick = handler; };
    binding(el.back, () => { stop(); options.onBack?.(); });
    binding(el.view, () => { stop(); options.onToggleView?.(); });
    binding(el.door, () => { stop(); options.onToggleDoor?.(); });
    binding(el.extract, () => { stop(); options.onToggleExtract?.(trace?.module.slot); });
    el.slot.onchange = () => {
      const slot = Number(el.slot.value);
      if (!slot) return;
      stop();
      options.onSlot?.(slot);
    };
    binding(el.prev, () => selectStep(current - 1));
    binding(el.next, () => selectStep(current + 1));
    binding(el.voice, () => {
      if (speaking) { stop(); return; }
      if (!voice || !steps.length) return;
      speaking = true;
      showVoice();
      selectStep(0);
    });

    function showVoice() {
      el.voice.disabled = !voice;
      el.voice.setAttribute('aria-pressed', String(speaking));
      el.voice.textContent = speaking ? '停止朗读' : voice ? '朗读讲解' : '无中文语音';
      el.voice.title = voice ? '从列头柜开始朗读，跟随高亮逐步查看' : '当前浏览器未提供中文朗读声音，可逐步阅读文字。';
    }
    function findVoice() {
      let voices = [];
      try { voices = speech?.getVoices() || []; } catch { /* Some browsers block voice access. */ }
      const candidates = typeof root.SpeechSynthesisUtterance === 'function' ?
        voices.filter(v => /^(zh|cmn|yue)(-|_|$)/i.test(v.lang)) : [];
      voice = candidates.find(v => /^(zh[-_](CN|Hans)|cmn)/i.test(v.lang)) || candidates[0] || null;
      if (speaking && !voice) stop();
      showVoice();
    }
    function stop() {
      const ours = speaking || Boolean(utterance);
      voiceToken += 1;
      speaking = false;
      utterance = null;
      if (ours) { try { speech?.cancel(); } catch { /* Keep text controls available. */ } }
      showVoice();
    }
    function readStep() {
      if (!speaking || !voice || !steps[current]) return;
      const token = ++voiceToken;
      if (utterance) {
        utterance = null;
        try { speech.cancel(); } catch { /* Read from the selected step. */ }
      }
      const step = steps[current];
      try {
        const speechItem = new root.SpeechSynthesisUtterance('第' + (current + 1) + '步，' + step.name + '。' + step.text);
        speechItem.lang = voice.lang;
        speechItem.voice = voice;
        speechItem.onend = () => {
          if (token !== voiceToken || !speaking) return;
          utterance = null;
          if (current < steps.length - 1) selectStep(current + 1);
          else stop();
        };
        speechItem.onerror = () => { if (token === voiceToken) stop(); };
        utterance = speechItem;
        speech.speak(speechItem);
      } catch { stop(); }
    }
    function selectStep(index) {
      if (!steps[index] || !state) return;
      current = index;
      drawStep();
      options.onStep?.(steps[current].key);
      if (speaking) readStep();
    }
    function drawStep() {
      const step = steps[current];
      if (!step) return;
      const signature = steps.map(s => s.key + s.tab).join('/');
      if (signature !== lastStepSignature) {
        el.path.replaceChildren(...steps.map((s, i) => {
          const b = node('button', s.tab);
          b.type = 'button';
          b.dataset.step = s.key;
          b.onclick = () => selectStep(i);
          return b;
        }));
        lastStepSignature = signature;
      }
      for (const [i, b] of Array.from(el.path.children).entries()) {
        if (i === current) b.setAttribute('aria-current','step');
        else b.removeAttribute('aria-current');
      }
      el.name.textContent = step.name;
      el.code.textContent = step.id;
      el.text.textContent = step.text;
      el.count.textContent = (current + 1) + ' / ' + steps.length;
      el.prev.disabled = current === 0;
      el.next.disabled = current === steps.length - 1;
    }
    function showSources(rack) {
      const anchors = [];
      for (const [title, href] of [['设备参考资料',rack.source], ['直流架构资料',rack.architectureSource]]) {
        if (!href || !/^https:\/\//.test(href)) continue;
        const link = node('a',title + ' ↗');
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        anchors.push(link);
      }
      el.sources.replaceChildren(...anchors);
    }
    function pause() {
      stop();
      state = null;
      trace = null;
      steps = [];
      rackSignature = '';
      host.hidden = true;
      details.open = false;
    }
    function update(next) {
      if (destroyed) return;
      if (!next?.rack) { pause(); return; }
      const rack = next.rack;
      const signature = [rack.id,rack.profile,rack.architecture,rack.serverCount,rack.modules.length].join('/');
      const rackChanged = signature !== rackSignature;
      const newTrace = root.GridRackCircuit?.trace(rack, Number(next.slotId));
      const slotChanged = rackChanged || trace?.module.id !== newTrace?.module.id;
      const extracted = Boolean(next.extracted);
      const newlyExtracted = extracted && !state?.extracted;
      const stepChanged = next.step !== state?.step;
      if (slotChanged || (!next.doorOpen && state?.doorOpen)) stop();
      state = {...next, extracted};
      trace = newTrace;
      rackSignature = signature;
      host.hidden = false;
      if (rackChanged) {
        details.open = false;
        el.id.textContent = rack.id;
        el.place.textContent = rack.label + ' · ' + rack.profileLabel;
        el.mode.textContent = rack.architecture;
        el.scope.textContent = rack.scope;
        const placeholder = node('option','选择槽位');
        placeholder.value = '';
        placeholder.disabled = true;
        el.slot.replaceChildren(placeholder,...rack.modules.map(m => {
          const o = node('option',m.label + ' · ' + m.feed + ' 路');
          o.value = m.slot;
          return o;
        }));
        showSources(rack);
      }
      el.slot.value = trace ? String(trace.module.slot) : '';
      el.view.hidden = !options.onToggleView;
      el.view.textContent = next.view === 'circuit' ? '返回机柜视角' : '查看整列回路';
      el.back.hidden = !options.onBack;
      el.door.hidden = !options.onToggleDoor;
      el.door.textContent = next.doorOpen ? '合上柜门' : '打开柜门';
      el.extract.hidden = !options.onToggleExtract || !trace;
      el.extract.textContent = extracted ? '推回模块' : '抽出模块';
      el.extractionNote.hidden = !trace || !extracted;
      el.learn.hidden = !trace;
      el.empty.hidden = Boolean(trace);
      el.traceNotes.hidden = !trace;
      if (!trace) {
        steps = [];
        const equipment = rack.profile === 'pcie' ? '服务器' : '计算托盘';
        el.empty.textContent = '机柜装着' + equipment + '，带拉手的电源模块为它们供电。点模型上的模块或选择槽位，即可沿供电路径逐步查看讲解。';
        el.summary.textContent = '机柜示意范围';
        return;
      }
      steps = makeSteps(rack,trace);
      const sceneIndex = steps.findIndex(s => s.key === next.step);
      if (sceneIndex >= 0 && (stepChanged || slotChanged)) {
        if (speaking && sceneIndex !== current) stop();
        current = sceneIndex;
      } else if (slotChanged || newlyExtracted) {
        current = steps.findIndex(s => s.key === 'psu');
      }
      drawStep();
      el.summary.textContent = '冗余支路与受供设备（' + trace.servers.length + '）';
      el.redundancy.textContent = trace.redundancy;
      el.alternates.textContent = '同接' + trace.bus.label + '的其他模块：' + trace.alternateModules.map(m => m.label + '（' + m.feed + ' 路）').join('、') + '。';
      el.destinations.textContent = '受供' + (rack.profile === 'pcie' ? '服务器' : '计算托盘') + '编号：' + trace.servers.map(s => s.id).join('、') + '。';
    }
    function leavePage() { stop(); }
    function visibility() { if (document.hidden) stop(); }
    speech?.addEventListener?.('voiceschanged', findVoice);
    document.addEventListener('visibilitychange', visibility);
    root.addEventListener('pagehide', leavePage);
    root.addEventListener('hashchange', leavePage);
    findVoice();
    return {update,pause,destroy() {
      pause();
      destroyed = true;
      speech?.removeEventListener?.('voiceschanged', findVoice);
      document.removeEventListener('visibilitychange', visibility);
      root.removeEventListener('pagehide', leavePage);
      root.removeEventListener('hashchange', leavePage);
      host.replaceChildren();
      host.classList.remove('trg');
    }};
  }
  root.GridRackGuide = Object.freeze({mount});
})(window);
