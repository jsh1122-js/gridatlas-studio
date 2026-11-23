(() => {
  'use strict';

  const defaults = Object.freeze({
    it: 100, pue: 1.25, load: 80, density: 50, tariff: 0.4, green: 30,
    architecture: '交流 UPS', cooling: '混合冷却'
  });

  const fields = [
    { key: 'it', label: '设计 IT 功率', unit: 'MW', valid: n => n > 0, error: '请输入大于 0 的 IT 功率' },
    { key: 'density', label: '单柜设计功率', unit: 'kW/柜', valid: n => n > 0, error: '请输入大于 0 的单柜功率' },
    { key: 'pue', label: '设计 PUE', unit: '', valid: n => n >= 1, error: 'PUE 须大于或等于 1' },
    { key: 'load', label: 'IT 年平均负载率', unit: '%', valid: n => n >= 0 && n <= 100, error: '请输入 0 至 100 之间的负载率' },
    { key: 'tariff', label: '到户平均电价', unit: '元/kWh', valid: n => n >= 0, error: '电价须大于或等于 0' },
    { key: 'green', label: '年度绿电目标', unit: '%', valid: n => n >= 0 && n <= 100, error: '请输入 0 至 100 之间的目标占比' }
  ];

  function format(value, digits = 2) {
    if (!Number.isFinite(value)) return '—';
    if (value !== 0 && Math.abs(value) < Math.pow(10, -digits)) {
      return value.toLocaleString('zh-CN', { maximumSignificantDigits: 2 });
    }
    return value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
  }

  function asNumber(value) {
    if (value == null || typeof value === 'boolean' || String(value).trim() === '') return NaN;
    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
  }

  function calculate(config = {}) {
    const values = { ...defaults, ...config };
    for (const { key, valid } of fields) {
      const n = asNumber(values[key]);
      values[key] = valid(n) ? n : NaN;
    }
    const { it, pue, load, density, tariff, green } = values;
    const facility = it * pue;
    const average = facility * load / 100;
    const energy = average * 8.76;
    return {
      facility,
      racks: Math.ceil(it * 1000 / density),
      energy,
      cost: energy * tariff / 100,
      average,
      overhead: facility - it,
      greenEnergy: energy * green / 100,
      itEnergy: it * load / 100 * 8.76
    };
  }

  const powerPaths = {
    '交流 UPS': [['grid', '电网接入'], ['transformer', '配电变压器'], ['ups', '交流 UPS'], ['rack', 'IT 机柜']],
    '800V 直流': [['grid', '电网接入'], ['converter', '变压整流'], ['bus', '800V 直流母线'], ['rack', '机柜 DC/DC']]
  };
  const coolingPaths = {
    '混合冷却': [['fan', '室外冷源'], ['pump', '冷却水环路'], ['transfer', 'CDU / 空调'], ['rack', '液冷与风冷机柜']],
    '风冷': [['fan', '室外冷源'], ['pump', '冷冻水环路'], ['air', '机房空调'], ['rack', '风冷机柜']],
    '冷板液冷': [['fan', '室外冷源'], ['pump', '一次侧环路'], ['transfer', 'CDU 换热'], ['rack', '机柜冷板']]
  };

  // Draw the engineering symbols locally so the design stays available offline.
  function symbol(ctx, type, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 52, size / 52);
    ctx.lineWidth = 1.65;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const path = (...points) => {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([px, py]) => ctx.lineTo(px, py));
      ctx.stroke();
    };
    const rect = (xx, yy, w, h) => ctx.strokeRect(xx, yy, w, h);
    const circle = (xx, yy, r) => {
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.stroke();
    };
    if (type === 'grid') {
      path([12, 49], [25, 2], [29, 2], [41, 49]);
      path([7, 16], [26, 7], [46, 16], [7, 16]);
      path([3, 28], [26, 18], [49, 28], [3, 28]);
      path([16, 40], [34, 31], [20, 22], [31, 17]);
      path([36, 40], [18, 31], [32, 22], [21, 17]);
      path([13, 48], [35, 39], [41, 48]);
    } else if (type === 'transformer') {
      rect(8, 20, 36, 22);
      for (const a of [15, 26, 37]) {
        path([a, 20], [a, 7]);
        for (const b of [10, 13, 16]) path([a - 3, b], [a + 3, b]);
      }
      for (let a = 14; a < 42; a += 5) path([a, 25], [a, 37]);
      path([6, 45], [46, 45]);
    } else if (type === 'rack' || type === 'ups') {
      rect(10, 4, 32, 44);
      if (type === 'rack') {
        for (const a of [9, 20, 31]) {
          rect(14, a, 24, 8);
          path([18, a + 4], [24, a + 4]);
          ctx.fillRect(33, a + 3, 2, 2);
        }
      } else {
        rect(16, 10, 20, 7);
        path([27, 20], [20, 31], [26, 31], [23, 39], [33, 27], [27, 27]);
        path([16, 43], [36, 43]);
      }
    } else if (type === 'bus') {
      rect(4, 18, 44, 16);
      for (const a of [11, 21, 31, 41]) {
        path([a, 11], [a, 18]);
        path([a, 34], [a, 41]);
      }
      path([11, 25], [20, 25]);
      path([15.5, 21], [15.5, 29]);
      path([31, 25], [41, 25]);
    } else if (type === 'converter' || type === 'transfer') {
      rect(5, 8, 42, 36);
      path([6, 43], [46, 9]);
      if (type === 'converter') {
        ctx.beginPath();
        ctx.moveTo(10, 22);
        ctx.bezierCurveTo(15, 10, 17, 29, 23, 17);
        ctx.stroke();
        path([28, 31], [41, 31]);
        path([28, 35], [34, 35]);
        path([37, 35], [41, 35]);
      } else {
        for (const a of [14, 19, 24]) path([a - 4, 24], [a + 3, 16]);
        for (const a of [30, 35, 40]) path([a - 4, 36], [a + 3, 28]);
      }
    } else if (type === 'fan') {
      rect(4, 4, 44, 44);
      circle(26, 26, 18);
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(26, 26);
        ctx.rotate(i * Math.PI * 2 / 3);
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.bezierCurveTo(0, -19, 13, -15, 10, -9);
        ctx.quadraticCurveTo(7, -4, 4, -1);
        ctx.stroke();
        ctx.restore();
      }
      circle(26, 26, 4);
    } else if (type === 'pump') {
      circle(26, 26, 14);
      path([4, 26], [12, 26]);
      path([39, 26], [48, 26]);
      path([21, 19], [33, 26], [21, 33], [21, 19]);
      path([18, 44], [22, 40]);
      path([34, 44], [30, 40]);
      path([14, 45], [38, 45]);
    } else if (type === 'air') {
      rect(4, 13, 44, 25);
      for (const a of [21, 26, 31]) path([10, a], [40, a]);
      for (const a of [17, 26, 35]) path([a, 39], [a - 2, 45]);
    }
    ctx.restore();
  }

  function drawTopology(canvas, nodes, cooling) {
    const width = Math.round(canvas.getBoundingClientRect().width);
    if (width < 40) return;
    const narrow = width < 430;
    const height = narrow ? 216 : 156;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.height = height + 'px';
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const accent = cooling ? '#74d8ce' : '#94bdff';
    const positions = narrow ? [
      [width * .25, 54], [width * .75, 54], [width * .75, 160], [width * .25, 160]
    ] : nodes.map((_, i) => [width * (i + .5) / 4, 75]);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    const arrow = (x1, y1, x2, y2) => {
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.moveTo(x2 - 5 * Math.cos(a - .52), y2 - 5 * Math.sin(a - .52));
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - 5 * Math.cos(a + .52), y2 - 5 * Math.sin(a + .52));
      ctx.stroke();
    };
    positions.slice(1).forEach(([x, y], index) => {
      const [px, py] = positions[index];
      if (x === px) {
        arrow(x, py + 43, x, y - 31);
      } else {
        const dir = Math.sign(x - px);
        arrow(px + dir * 32, py, x - dir * 32, y);
      }
    });
    positions.forEach(([x, y], i) => {
      ctx.strokeStyle = '#d4e8ff';
      ctx.fillStyle = accent;
      symbol(ctx, nodes[i][0], x - 21, y - 21, 42);
      ctx.fillStyle = '#e7f0fc';
      ctx.textAlign = 'center';
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.fillText(nodes[i][1], x, y + 36);
    });
  }

  function fieldMarkup({key, label, unit}) {
    return '<label class="gd-field"><span>' + label + '</span><span class="gd-input"><input type="number" step="any" inputmode="decimal" data-field="' +
      key + '" aria-label="' + label + (unit ? '（' + unit + '）' : '') + '"><span>' + unit + '</span></span></label>';
  }

  function mount(container, {getConfig, onChange, getLocation}) {
    const metrics = [
      ['facility', '设施设计功率', 'MW'],
      ['racks', '所需机柜', '柜'],
      ['energy', '年用电量', 'GWh'],
      ['cost', '年电费', '亿元']
    ];
    const metricMarkup = metrics.map(([k, label, unit]) => '<div class="gd-metric"><span>' +
      label + '</span><strong><b data-out="' + k + '"></b><small>' + unit + '</small></strong></div>').join('');
    container.innerHTML = '<section class="gd-workbench">' +
      '<header class="gd-heading"><div><h1>AIDC 方案设计</h1><p>配置项目的 IT 负荷、供配电与用能假设。</p></div><div class="gd-location"><i aria-hidden="true"></i><span data-site></span></div></header>' +
      '<div class="gd-metrics">' + metricMarkup + '</div>' +
      '<div class="gd-columns"><section class="gd-card gd-config"><div class="gd-cardhead"><h2>设计参数</h2><span class="gd-note">随输入更新</span></div>' +
      '<div class="gd-fields">' + fields.map(fieldMarkup).join('') + '</div><div class="gd-error" aria-live="polite" hidden></div>' +
      '<div class="gd-selectors">' + [['architecture','供电架构',Object.keys(powerPaths)],['cooling','制冷方式',Object.keys(coolingPaths)]].map(([key,label,options]) =>
        '<label class="gd-field"><span>' + label + '</span><select data-select="' + key + '">' + options.map(v => '<option>' + v + '</option>').join('') + '</select></label>').join('') +
      '</div></section><section class="gd-card gd-system"><div class="gd-cardhead"><h2>系统拓扑</h2><div class="gd-tabs" aria-label="拓扑视图"><button type="button" data-view="power" aria-pressed="true">供配电</button><button type="button" data-view="cooling" aria-pressed="false">制冷</button></div></div>' +
      '<div class="gd-blueprint"><div class="gd-diagram-heading"><span data-schematic></span><span>方案示意</span></div><canvas role="img"></canvas></div>' +
      '<dl class="gd-details"><div><dt>设计 IT 功率</dt><dd><span data-out="it"></span> MW</dd></div><div><dt>附属设施设计功率</dt><dd><span data-out="overhead"></span> MW</dd></div><div><dt>年平均设施功率</dt><dd><span data-out="average"></span> MW</dd></div></dl></section></div>' +
      '<div class="gd-columns gd-lower"><section class="gd-card gd-energy"><div class="gd-cardhead"><h2>年度绿电目标</h2><span class="gd-note">按全年电量折算</span></div><div class="gd-energy-total"><span data-out="greenEnergy"></span><small>GWh</small></div>' +
      '<div class="gd-meter" aria-hidden="true"><i></i></div><div class="gd-legend"><span><i></i>绿电目标 <b data-out="green"></b>%</span><span><i></i>其余电量 <b data-out="rest"></b>%</span></div></section>' +
      '<section class="gd-card gd-method"><div class="gd-cardhead"><h2>测算口径</h2></div><p>设施设计功率 = 设计 IT 功率 × PUE。年用电量按设施设计功率、IT 年平均负载率及 8,760 小时折算，按输入的到户平均电价计费。</p>' +
      '<p>机柜数按单柜功率向上取整。年度绿电目标供采购规划使用，实际供电及消纳量需另行核验。供电和制冷选项用于绘制拓扑，能耗测算采用输入的 PUE。</p></section></div></section>';
    const root = container.querySelector('.gd-workbench');
    const canvas = root.querySelector('canvas');
    const selectEls = [...root.querySelectorAll('[data-select]')];
    const fieldEls = [...root.querySelectorAll('[data-field]')];
    const outputs = [...root.querySelectorAll('[data-out]')];
    const error = root.querySelector('.gd-error');
    let view = 'power';
    let lastConfig = {...defaults};
    let currentPaths = powerPaths[defaults.architecture];

    function refreshDiagram() {
      const cooling = view === 'cooling';
      const paths = cooling ? coolingPaths : powerPaths;
      const kind = cooling ? lastConfig.cooling : lastConfig.architecture;
      currentPaths = paths[kind] || Object.values(paths)[0];
      root.querySelector('[data-schematic]').textContent = kind;
      canvas.setAttribute('aria-label', kind + '路径：' + currentPaths.map(n => n[1]).join(' → '));
      drawTopology(canvas, currentPaths, cooling);
      for (const button of root.querySelectorAll('[data-view]')) {
        button.setAttribute('aria-pressed', String(button.dataset.view === view));
      }
    }
    function output(config, invalid) {
      const results = { ...calculate(config), it: config.it, green: config.green, rest: 100 - config.green };
      for (const el of outputs) {
        const k = el.dataset.out;
        el.textContent = invalid ? '—' : format(results[k], k === 'cost' ? 4 : 2);
      }
      root.querySelector('.gd-meter i').style.width = (invalid ? 0 : config.green) + '%';
    }
    function readForm() {
      const config = { ...lastConfig };
      let issue = '';
      fields.forEach((field, i) => {
        const input = fieldEls[i];
        const n = asNumber(input.value);
        const valid = Number.isFinite(n) && field.valid(n);
        input.setAttribute('aria-invalid', String(!valid));
        if (!valid && !issue) issue = field.error + '。';
        config[field.key] = n;
      });
      for (const select of selectEls) config[select.dataset.select] = select.value;
      if (!issue && !Object.values(calculate(config)).every(Number.isFinite)) issue = '输入数值过大，请核对参数。';
      error.textContent = issue;
      error.hidden = !issue;
      output(config, !!issue);
      if (!issue) {
        lastConfig = config;
        refreshDiagram();
        onChange?.({...config});
      }
    }
    function locationText() {
      const loc = getLocation?.();
      if (typeof loc === 'string') return loc;
      if (!loc) return '尚未选择场址';
      const lat = asNumber(loc.lat);
      const lon = asNumber(loc.lng ?? loc.lon);
      const name = loc.name || loc.label || loc.title || '';
      const coords = Number.isFinite(lat) && Number.isFinite(lon) ? format(lat, 4) + '°, ' + format(lon, 4) + '°' : '';
      return [name, coords].filter(Boolean).join(' · ') || '尚未选择场址';
    }
    function render() {
      lastConfig = { ...defaults, ...(getConfig?.() || {}) };
      for (const el of fieldEls) {
        el.value = lastConfig[el.dataset.field];
        el.removeAttribute('aria-invalid');
      }
      for (const el of selectEls) {
        const key = el.dataset.select;
        if (![...el.options].some(o => o.value === lastConfig[key])) lastConfig[key] = defaults[key];
        el.value = lastConfig[key];
      }
      error.hidden = true;
      error.textContent = '';
      root.querySelector('[data-site]').textContent = locationText();
      output(lastConfig, false);
      refreshDiagram();
    }
    root.addEventListener('input', event => {
      if (event.target.matches('input[data-field]')) readForm();
    });
    root.addEventListener('change', event => {
      if (event.target.matches('select[data-select]')) {
        view = event.target.dataset.select === 'architecture' ? 'power' : 'cooling';
        readForm();
      }
    });
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-view]');
      if (!button) return;
      view = button.dataset.view;
      refreshDiagram();
    });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      drawTopology(canvas, currentPaths, view === 'cooling');
    }) : null;
    observer?.observe(root.querySelector('.gd-blueprint'));
    render();
    return {render, destroy() { observer?.disconnect(); }};
  }

  function validateConfig(config) {
    if (!config || !Object.hasOwn(powerPaths, config.architecture) || !Object.hasOwn(coolingPaths, config.cooling)) return false;
    return fields.every(({key,valid}) => Number.isFinite(config[key]) && valid(config[key])) &&
      Object.values(calculate(config)).every(Number.isFinite);
  }
  window.GridDesign = Object.freeze({defaults, calculate, validateConfig, mount});
})();
