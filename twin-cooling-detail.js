(() => {
  'use strict';

  const parts = {
    fan: {
      name: '顶部风机', color: '#a9dafa',
      explanation: '机顶的两台风机让室外空气持续穿过换热面。空气带走热量后，从机顶排出。',
      connection: '室外空气 → 换热面 → 顶部风机 → 室外'
    },
    exchanger: {
      name: '换热面', color: '#e2c397',
      explanation: '机身侧面成排的金属翅片增大了和空气接触的面积。来自机房的热量经这里传给穿过翅片的室外空气。',
      connection: '机房传来的热量 → 换热面 → 室外空气'
    },
    supply: {
      name: '供水口', color: '#8ddbd0',
      explanation: '降温后的设施水从这个接口流出，汇入供水总管，送到机房里的换热设备。',
      connection: '本机供水口 → 设施供水总管 → 机房换热设备'
    },
    return: {
      name: '回水口', color: '#e9aebd',
      explanation: '设施水在机房吸热后，经回水总管流回这个接口。机组把热量排向室外，设施水继续循环。',
      connection: '机房换热设备 → 设施回水总管 → 本机回水口'
    }
  };
  const keys = Object.keys(parts);
  const svgNamespace = 'http://www.w3.org/2000/svg';

  function html(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function button(className, name) {
    const node = html('button', className, name);
    node.type = 'button';
    return node;
  }

  function mount({stage, panel, onSelect, onClose}) {
    const overlay = html('div', 'tcd-overlay');
    overlay.setAttribute('role', 'group');
    const wires = document.createElementNS(svgNamespace, 'svg');
    wires.setAttribute('aria-hidden', 'true');
    overlay.append(wires);
    stage.append(overlay);

    const box = html('section', 'tcd-panel');
    const heading = html('div', 'tcd-heading');
    const title = html('h4');
    const back = button('tcd-back', '收起部件');
    heading.append(title, back);
    const choices = html('div', 'tcd-choices');
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-label', '选择本机部件');
    const readout = html('div', 'tcd-readout');
    readout.setAttribute('aria-live', 'polite');
    readout.setAttribute('aria-atomic', 'true');
    const selectedName = html('strong', 'tcd-active-name');
    const explanation = html('p', 'tcd-explanation');
    const connection = html('p', 'tcd-connection');
    readout.append(selectedName, explanation, connection);
    box.append(heading, choices, readout);
    panel.append(box);

    const nodes = {};
    let unit = '', current = '', lastGeometry = '', portSide = null;
    for (const key of keys) {
      const {name, color} = parts[key];
      const choice = button('tcd-choice', name);
      const pin = button('tcd-pin', name);
      const group = document.createElementNS(svgNamespace, 'g');
      const line = document.createElementNS(svgNamespace, 'path');
      const dot = document.createElementNS(svgNamespace, 'circle');
      group.append(line, dot);
      for (const node of [choice, pin, group]) {
        node.dataset.part = key;
        node.style.setProperty('--tcd-color', color);
      }
      for (const control of [pin, choice]) {
        control.addEventListener('click', () => select(key));
      }
      pin.hidden = true;
      group.style.display = 'none';
      choices.append(choice);
      overlay.append(pin);
      wires.append(group);
      nodes[key] = {choice, pin, group, line, dot};
    }

    function select(key) {
      if (!unit || !keys.includes(key)) return;
      if (current !== key) {
        current = key;
        const part = parts[key];
        selectedName.textContent = part.name;
        explanation.textContent = part.explanation;
        connection.textContent = part.connection;
        readout.style.setProperty('--tcd-color', part.color);
        for (const id of keys) {
          const active = String(id === key);
          const {choice, pin, group, dot} = nodes[id];
          choice.setAttribute('aria-pressed', active);
          pin.setAttribute('aria-pressed', active);
          group.dataset.active = active;
          dot.setAttribute('r', id === key ? '4.5' : '3.2');
        }
      }
      onSelect?.(key);
    }

    function hidePins() {
      for (const {pin, group} of Object.values(nodes)) {
        pin.hidden = true;
        group.style.display = 'none';
      }
      lastGeometry = '';
      portSide = null;
    }

    function open(unitLabel, key = 'fan') {
      unit = String(unitLabel || '室外冷却机组');
      current = '';
      hidePins();
      title.textContent = unit + ' · 部件';
      box.setAttribute('aria-label', title.textContent);
      overlay.setAttribute('aria-label', unit + '部件定位');
      box.hidden = overlay.hidden = false;
      select(keys.includes(key) ? key : 'fan');
    }

    function close() {
      unit = current = '';
      box.hidden = overlay.hidden = true;
      hidePins();
    }

    // Place labels away from their anchors. In particular the two water ports share an end face.
    // Keeping each side in vertical order prevents nearby labels from covering one another.
    function updateProjection(points) {
      if (!unit) return;
      const width = stage.clientWidth, height = stage.clientHeight;
      const positions = keys.map(key => {
        const p = points?.[key];
        if (!p || p.visible === false || !Number.isFinite(p.x) || !Number.isFinite(p.y) ||
            p.x < 0 || p.x > width || p.y < 0 || p.y > height) return null;
        return {key, x: Math.round(p.x), y: Math.round(p.y)};
      });
      const geometry = [width, height, ...positions.map(p => p ? p.x + ',' + p.y : '')].join('|');
      if (geometry === lastGeometry) return;
      lastGeometry = geometry;
      const sides = [[], []];
      const visible = positions.filter(Boolean);
      const leftmost = Math.min(...visible.map(p => p.x));
      const rightmost = Math.max(...visible.map(p => p.x));
      const portX = positions[2]?.x ?? positions[3]?.x;
      const portOffset = portX - (leftmost + rightmost) / 2;
      // A small dead band keeps both water labels steady as the camera passes a head-on view.
      if (Number.isFinite(portOffset) && (portSide === null || Math.abs(portOffset) > 12))
        portSide = portOffset < 0 ? 0 : 1;
      const halfLabel = 31, inset = 5, gap = 34;
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
      for (let i = 0; i < keys.length; i++) {
        const p = positions[i], {pin, group} = nodes[keys[i]];
        pin.hidden = !p;
        group.style.display = p ? '' : 'none';
        if (!p) continue;
        const waterSide = portSide ?? 1;
        const side = i > 1 ? waterSide : 1 - waterSide;
        p.labelX = clamp(side ? rightmost + halfLabel + 18 : leftmost - halfLabel - 18,
          side ? width / 2 + halfLabel + inset : halfLabel + inset,
          side ? width - halfLabel - inset : width / 2 - halfLabel - inset);
        // Reserve the strip occupied by the camera controls near the lower right.
        if (side && p.y > height - 170 && width >= 240)
          p.labelX = Math.min(p.labelX, width - halfLabel - 48);
        sides[side].push(p);
      }
      for (const side of sides) {
        side.sort((a, b) => a.y - b.y);
        let nextY = 20;
        for (const p of side) {
          p.labelY = Math.max(nextY, clamp(p.y, 20, height - 20));
          nextY = p.labelY + gap;
        }
        let ceiling = height - 20;
        for (let i = side.length - 1; i >= 0; i--) {
          const p = side[i];
          p.labelY = Math.min(p.labelY, ceiling);
          ceiling = p.labelY - gap;
          const {pin, line, dot} = nodes[p.key];
          pin.style.left = p.labelX + 'px';
          pin.style.top = p.labelY + 'px';
          const edge = p.labelX + (p.labelX < p.x ? halfLabel : -halfLabel);
          line.setAttribute('d', 'M' + p.x + ',' + p.y + ' L' + edge + ',' + p.labelY);
          dot.setAttribute('cx', p.x);
          dot.setAttribute('cy', p.y);
        }
      }
    }

    back.addEventListener('click', () => onClose ? onClose() : close());
    close();
    return {open, select, close, updateProjection, isOpen: () => Boolean(unit),
      destroy() { close(); overlay.remove(); box.remove(); }};
  }

  window.GridCoolingDetail = Object.freeze({mount});
})();
