(() => {
  'use strict';

  const FORMAT = 'gridatlas.project';
  const VERSION = 1;
  const MAX_FILE_SIZE = 2 * 1024 * 1024;
  const number = (value, digits = 2) =>
    value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
  const date = value => new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));

  function cleanText(value, label, limit, allowEmpty = false) {
    if (typeof value !== 'string' || value.length > limit || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error(`请检查方案文件中的${label}。`);
    }
    const result = value.trim();
    if (!allowEmpty && !result) throw new Error(`方案文件缺少${label}。`);
    return result;
  }

  function coordinate(value, limit, label) {
    if (!Number.isFinite(value) || Math.abs(value) > limit) {
      throw new Error(`方案文件中的${label}超出有效范围。`);
    }
    return value;
  }

  function cleanConfig(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('方案文件缺少有效的设计参数。');
    }
    const config = {};
    for (const key of Object.keys(window.GridDesign.defaults)) {
      if (!Object.hasOwn(raw, key)) throw new Error('方案文件缺少设计参数，请检查后再导入。');
      config[key] = raw[key];
    }
    if (!window.GridDesign.validateConfig(config)) {
      throw new Error('设计参数超出有效范围，或供电、冷却选项无效。');
    }
    return config;
  }

  function cleanAidc(raw) {
    if (!raw || raw.version !== 1 || typeof raw.sceneId !== 'string' || !Array.isArray(raw.items) || raw.items.length > 2000 ||
        !window.GridAidcFinance.validate(raw.finance)) throw new Error('AIDC 清单或财务配置无效。');
    const a = raw.assumptions;
    const bounds = {pue:[1,10],load:[0,100],tariff:[0,100]};
    if (!a || !Object.entries(bounds).every(([k,[min,max]]) => Number.isFinite(a[k]) && a[k]>=min && a[k]<=max)) {
      throw new Error('AIDC 运行参数超出有效范围。');
    }
    const items = raw.items.map(i=>{
      if (!i || !Number.isSafeInteger(i.count) || i.count<0 || i.count>999999) throw new Error('AIDC 清单数量无效。');
      return {dev:cleanText(i.dev,'设备编号',150),count:i.count,zone:cleanText(i.zone,'设备分区',110,true)};
    });
    return {version:1,sceneId:cleanText(raw.sceneId,'场景编号',150),items,
      assumptions:{pue:a.pue,load:a.load,tariff:a.tariff},finance:{...raw.finance}};
  }

  function cleanProject(raw) {
    if (!raw || typeof raw !== 'object' || !raw.location || !raw.config) {
      throw new Error('方案文件缺少场址或设计参数。');
    }
    const updatedAt = new Date(raw.updatedAt);
    if (!['string', 'number'].includes(typeof raw.updatedAt) || !Number.isFinite(updatedAt.getTime())) {
      throw new Error('方案文件的保存时间无效。');
    }
    const config = cleanConfig(raw.config);
    const rackMix=raw.rackMix==null?[]:window.GridRackMix.clean(raw.rackMix);
    if(rackMix.length){
      const summary=window.GridRackMix.summarize(rackMix);
      const agrees=(a,b)=>Math.abs(a-b)<=4*Number.EPSILON*Math.max(Math.abs(a),Math.abs(b));
      if(!agrees(summary.itMW,config.it)||!agrees(summary.density,config.density))throw new Error('机柜组合与文件中的设计功率或单柜功率不一致。');
      config.it=summary.itMW;config.density=summary.density;
    }
    return {
      id: cleanText(raw.id, '方案编号', 180),
      name: cleanText(raw.name, '方案名称', 160),
      location: {
        lat: coordinate(raw.location.lat, 90, '纬度'),
        lon: coordinate(raw.location.lon, 180, '经度'),
        label: cleanText(raw.location.label ?? '', '场址名称', 200, true)
      },
      config,
      ...(rackMix.length ? {rackMix} : {}),
      ...(raw.spacePlan == null ? {} : {spacePlan:window.GridSpacePlan.clean(raw.spacePlan)}),
      ...(raw.rackStudy == null ? {} : {rackStudy:window.GridRackStudy.clean(raw.rackStudy)}),
      ...(raw.aidc == null ? {} : {aidc:cleanAidc(raw.aidc)}),
      updatedAt: updatedAt.toISOString()
    };
  }

  function downloadJSON(project) {
    const data = cleanProject(project);
    const content = JSON.stringify({format: FORMAT, version: VERSION, project: data}, null, 2);
    const blob = new Blob([content], {type: 'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (data.name.replace(/[\\/:*?"<>|]/g, '_') || '算电方案') + '.gridatlas.json';
    link.hidden = true;
    document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
  }

  async function readProject(file) {
    if (!file || typeof file.text !== 'function') throw new Error('请选择一个 JSON 方案文件。');
    if (file.size > MAX_FILE_SIZE) throw new Error('方案文件超过 2 MB，请选择本站导出的 JSON 文件。');
    const content = (await file.text()).replace(/^\uFEFF/, '');
    let payload;
    try {
      payload = JSON.parse(content);
    } catch {
      throw new Error('文件无法解析，请选择本站导出的 JSON 方案。');
    }
    if (payload?.format !== FORMAT) throw new Error('文件格式不匹配，请选择本站导出的 JSON 方案。');
    if (payload.version !== VERSION) throw new Error('此方案文件的版本尚未受支持。');
    const project = cleanProject(payload.project);
    if (project.aidc) {
      const response = await fetch('aidc/records.json');
      if (!response.ok) throw new Error('暂时无法校验 AIDC 型号，请重试。');
      const catalog = await response.json();
      const ids = new Set(catalog.devices.flatMap(group=>group.devices.map(d=>d.id)));
      if (!catalog.scenes.some(s=>s.id===project.aidc.sceneId) ||
          !project.aidc.items.every(i=>ids.has(i.dev) && (!i.zone || Object.hasOwn(catalog.layout.zones,i.zone)))) {
        throw new Error('此方案引用了当前目录中找不到的场景、设备或分区。');
      }
    }
    return project;
  }

  // All user-controlled fields are escaped before they become printable markup.
  function escape(value) {
    const entities = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
    return String(value).replace(/[&<>"']/g, symbol => entities[symbol]);
  }

  function reportHTML(data) {
    const c = data.config;
    const m = window.GridDesign.calculate(c);
    const l = data.location;
    const coord = (v, pos, neg) => `${Math.abs(v).toFixed(5)}°${v < 0 ? neg : pos}`;
    const metrics = [
      ['设施峰值功率', number(m.facility), 'MW'],
      ['规划机柜数', number(m.racks, 0), '柜'],
      ['年设施用电量', number(m.energy), 'GWh'],
      ['年电费', number(m.cost, 4), '亿元']
    ];
    const parameters = [
      ['设计 IT 功率', `${number(c.it, 3)} MW`, '单柜设计功率', `${number(c.density, 3)} kW`],
      ['IT 平均负载率', `${number(c.load, 3)}%`, '设计 PUE', number(c.pue, 3)],
      ['综合到户电价', `${number(c.tariff, 4)} 元/kWh`, '绿电目标占比', `${number(c.green, 3)}%`],
      ['供电架构', c.architecture, '制冷方式', c.cooling]
    ];
    try {
      const layout=window.GridSpacePlan.calculate(c,data.rackStudy,data.spacePlan);
      parameters.push(['机房配置',number(layout.halls,0)+' 间','机房净面积合计',number(layout.whiteSpaceM2,1)+' m²'],
        ['建筑面积估算',number(layout.grossM2,1)+' m²','代表机房长 × 宽',number(layout.hallLengthM,1)+' × '+number(layout.hallWidthM,1)+' m']);
      if(data.rackMix){
        const summary=data.rackMix.map(row=>(row.profile==='pcie'?'PCIe':row.profile.toUpperCase())+' × '+number(row.count,0)+' 柜').join('、');
        parameters.push(['机柜搭配',summary,'面积口径','机房净面积按每柜 '+number(layout.assumptions.whiteSpaceM2PerRack,2)+' m² 折算']);
      }
    } catch {parameters.push(['空间规划','数值超出面积测算范围','机房布局','待核对']);}
    return `<header class="ga-r-head"><strong>算电图研 <span>GridAtlas</span></strong><span>方案测算简报</span></header>
      <h1>${escape(data.name)}</h1>
      <p class="ga-r-meta">场址　${escape(l.label || '自选场址')}　 ·　${coord(l.lat, 'N', 'S')}，${coord(l.lon, 'E', 'W')}（WGS84）</p>
      <p class="ga-r-meta">方案更新　${escape(date(data.updatedAt))}　 ·　简报生成　${escape(date(Date.now()))}</p>
      <h2>测算结果</h2>
      <div class="ga-r-metrics">${metrics.map(([label, value, unit]) => `<div><span>${label}</span><strong>${value} <small>${unit}</small></strong></div>`).join('')}</div>
      <h2>设计与运行假设</h2>
      <table><tbody>${parameters.map(([a, b, c, d]) => `<tr><th>${a}</th><td>${escape(b)}</td><th>${c}</th><td>${escape(d)}</td></tr>`).join('')}</tbody></table>
      <h2>计算口径</h2>
      <dl>
        <dt>设施峰值</dt><dd>设计 IT 功率 × PUE。规划机柜数按设计 IT 功率（kW）÷ 单柜功率向上取整。</dd>
        <dt>年度用电</dt><dd>设计 IT 功率 × IT 平均负载率 × PUE × 8,760 小时。全年平均设施负荷为 ${number(m.average)} MW。</dd>
        <dt>年度电费</dt><dd>年设施用电量（kWh）× 综合到户电价。模型采用全年固定的 PUE 和电价。</dd>
        <dt>绿电目标</dt><dd>按年设施用电量 × 绿电目标占比折算，年度目标绿电量为 ${number(m.greenEnergy)} GWh。</dd>
      </dl>
      <p class="ga-r-note">场址由方案编制人选定。接入容量以电网接入意见为准，电价及绿电供应以合同与结算资料为准。以上测算基于本页列示的设计假设。</p>`;
  }

  const printCSS = `
    .ga-print-report {display:none !important}
    @page {size:A4 portrait;margin:16mm 15mm}
    @media print {
      html, body {width:auto !important;height:auto !important;min-height:0 !important;max-height:none !important;display:block !important;overflow:visible !important;padding:0 !important;margin:0 !important;background:white !important}
      body > * {display:none !important}
      body > .ga-print-report {display:block !important;width:auto;margin:0;padding:0;background:white;color:#172942;font:10pt/1.55 Arial,"PingFang SC","Microsoft YaHei",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .ga-print-report, .ga-print-report * {box-sizing:border-box}
      .ga-print-report .ga-r-head {position:static;display:flex;justify-content:space-between;align-items:center;padding:0 0 4mm;margin:0;border-bottom:1pt solid #264cce;color:#213966;background:white;font-size:10pt;box-shadow:none}
      .ga-r-head strong {font-size:13pt}.ga-r-head strong span {font-size:9pt;font-weight:400}
      .ga-print-report h1 {font-size:23pt;font-weight:700;line-height:1.25;letter-spacing:0;margin:7mm 0 3mm;overflow-wrap:anywhere;color:#132b4b}
      .ga-print-report .ga-r-meta {font-size:9pt;color:#435775;margin:1.2mm 0;overflow-wrap:anywhere}
      .ga-print-report h2 {font-size:12pt;font-weight:700;color:#152f56;margin:6mm 0 2.5mm;break-after:avoid}
      .ga-r-metrics {display:grid;grid-template-columns:repeat(4,1fr);gap:2mm}
      .ga-r-metrics > div {padding:3mm 2.5mm;background:#edf2ff;border:0.5pt solid #ced7e9;border-radius:1.8mm;break-inside:avoid}
      .ga-r-metrics span {display:block;font-size:8pt;color:#435775}
      .ga-r-metrics strong {display:block;font-size:16pt;line-height:1.45;color:#203e8d;letter-spacing:-.2pt;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
      .ga-r-metrics small {font-weight:500;font-size:8pt;letter-spacing:0;white-space:nowrap}
      .ga-print-report table {width:100%;border-collapse:collapse;table-layout:fixed;font-size:10pt}
      .ga-print-report th,.ga-print-report td {width:25%;padding:2mm;text-align:left;border-bottom:.5pt solid #d3dae4;background:white;color:#172942;overflow-wrap:anywhere}
      .ga-print-report th {background:#f3f5f8;font-weight:500;color:#536177}
      .ga-print-report dl {display:grid;grid-template-columns:20mm 1fr;gap:1.8mm 3mm;margin:0}
      .ga-print-report dt {font-weight:700;color:#203c68}.ga-print-report dd {margin:0}
      .ga-print-report .ga-r-note {margin:6mm 0 0;padding-top:3mm;border-top:.5pt solid #b5c2d5;color:#536177;font-size:8.5pt}
    }`;

  let removeReport;
  async function printReport(project) {
    const data = cleanProject(project);
    if (typeof window.print !== 'function') throw new Error('当前浏览器无法打印，请使用 JSON 导出。');
    if (removeReport) removeReport();
    const style = document.createElement('style');
    style.textContent = printCSS;
    const report = document.createElement('article');
    report.className = 'ga-print-report';
    report.innerHTML = reportHTML(data);
    document.head.append(style);
    document.body.append(report);
    const previousTitle = document.title;
    document.title = data.name + ' · 方案测算简报';
    const cleanup = () => {
      window.removeEventListener('afterprint', cleanup);
      style.remove();
      report.remove();
      document.title = previousTitle;
      if (removeReport === cleanup) removeReport = null;
    };
    removeReport = cleanup;
    window.addEventListener('afterprint', cleanup, {once: true});
    try {
      window.print();
    } catch (err) {
      cleanup();
      throw err;
    }
  }

  window.GridIO = Object.freeze({ downloadJSON, printReport, readProject, cleanAidc });
})();
