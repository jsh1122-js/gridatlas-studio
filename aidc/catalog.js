(() => {
  "use strict";
  const originURL = "https://newdpower.cloud/aidc-design.html";
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const fmt = (n, precision = 2) =>
    typeof n === "number" && Number.isFinite(n)
      ? n.toLocaleString("zh-CN", { maximumFractionDigits: precision })
      : "—";
  const tabs = {
    devices: "设备型号",
    scenes: "场景与配置",
    topologies: "场景拓扑",
    sites: "区域参数",
    econ: "经济参数",
    layout: "空间与链路",
    sources: "数据来源",
  };
  const label = {
    id: "记录编号",
    name: "名称",
    model: "型号",
    vendor: "厂商",
    role: "用途",
    cap_kw: "额定有功功率 (kW)",
    cap_kva: "视在功率 (kVA)",
    cap_kwh: "额定储能 (kWh)",
    w: "宽 (m)",
    d: "深 (m)",
    h: "高 (m)",
    price_wan: "参考单价 (万元)",
    eff: "效率",
    eff_eco: "经济模式效率",
    cop: "机械制冷 COP",
    cop_free: "自然冷却 COP",
    arch: "供电架构",
    shape: "模型类别",
    outdoor: "室外设备",
    spec: "技术参数",
    compute: "计算性能",
    as_of: "资料日期",
    src: "参数出处",
    backup_min: "备电时间 (分钟)",
    backup_sec: "备电时间 (秒)",
    pue_bonus: "PUE 修正",
    zone: "设备分区",
    hidden3d: "模型默认隐藏",
    has_source_note: "原表另有估算或补充说明",
    gpus: "GPU 数",
    gpu_tdp_w: "GPU 热设计功耗 (W)",
    hbm_gb: "HBM (GB)",
    nvlink_gbs: "NVLink (GB/s)",
    fp4_pflops: "FP4 (PFLOPS)",
    tokens_per_s: "峰值吞吐 (token/s)",
    tokens_bench: "吞吐基准",
    heat_to_liquid: "液冷承担热量比例",
    water_class: "供水等级",
    weight_kg: "重量 (kg)",
    climate: "气候",
    power: "供电",
    green: "绿电",
    water: "用水",
    land: "土地",
    latency: "网络时延",
    score: "原站评分",
    hub: "枢纽定位",
    level: "区域类别",
    geo: "参考坐标 (纬度、经度)",
    t_avg: "年平均气温 (℃)",
    t_summer: "夏季均温 (℃)",
    t_winter: "冬季均温 (℃)",
    t_wetbulb_summer: "夏季湿球温度 (℃)",
    free_cooling_hours: "自然冷却时数 (h)",
    free_cooling_ratio: "自然冷却时数比例",
    price_datacenter: "数据中心电价假设 (元/kWh)",
    price_industrial: "工业电价参考 (元/kWh)",
    peak_valley_spread: "峰谷价差 (元/kWh)",
    green_ratio_target: "绿电目标占比",
    ppa_price: "绿电 PPA 价格假设 (元/kWh)",
    re_share: "可再生占比",
    solar_hours: "日照小时数",
    wind_capacity_factor: "风电容量因子",
    price_wan_per_mu: "地价 (万元/亩)",
    price_yuan_per_t: "水价 (元/吨)",
    stress: "水资源压力",
    beijing_ms: "北京时延 (ms)",
    shanghai_ms: "上海时延 (ms)",
    guangzhou_ms: "广州时延 (ms)",
    site_id: "地区编号",
    capex: "建设投资",
    operation: "运维",
    electricity: "电力与碳",
    finance: "财务",
    revenue: "收入",
    benchmark: "对标参数",
    architecture: "供电架构",
    cooling: "制冷方案",
    ac_ups: "交流 UPS",
    hvdc: "高压直流",
    sst: "固态变压器",
    air_chiller: "冷冻水风冷",
    air_ahu: "组合式空气处理",
    air_crah: "机房空气处理",
    liquid_cdu_dry: "冷板液冷 + 干冷器",
    liquid_cdu_tower: "冷板液冷 + 冷却塔",
    immersion: "浸没冷却",
    grid_ef_kg_per_kwh: "电网排放因子 (kgCO₂/kWh)",
    grid_ef_source: "排放因子来源",
    carbon_price_yuan_per_t: "碳价 (元/t)",
    green_cert_yuan_per_mwh: "绿证成本 (元/MWh)",
    peak_valley_spread_enabled: "分时模型开关",
    peak_ratio: "峰段比例",
    flat_ratio: "平段比例",
    valley_ratio: "谷段比例",
    peak_multiplier: "峰段系数",
    flat_multiplier: "平段系数",
    valley_multiplier: "谷段系数",
    demand_charge_yuan_per_kva_month: "容量费用 (元/kVA/月)",
    it_utilization: "IT 利用率",
    rack_utilization: "机柜利用率",
    uptime_hours: "年运行小时",
    pue_other_ratio: "辅助用电比例",
    water_price_yuan_per_t: "水价 (元/t)",
    om_rate_of_capex: "设施运维费率",
    it_om_rate_of_capex: "IT 运维费率",
    staff_per_100racks: "每百柜人员数",
    staff_cost_wan_per_year: "人均年成本 (万元)",
    network_cost_yuan_per_mbps_month: "每 Mbps 月成本 (元)",
    network_bandwidth_gbps: "带宽 (Gbps)",
    install_rate: "安装费率",
    design_other_rate: "设计及其他费率",
    land_price_wan_per_mu: "地价 (万元/亩)",
    civil_wan_per_m2: "土建单价 (万元/㎡)",
    contingency_rate: "预备费率",
    period_years: "计算期 (年)",
    discount_rate: "折现率",
    it_depreciation_years: "IT 折旧期 (年)",
    infra_depreciation_years: "基础设施折旧期 (年)",
    residual_rate: "残值率",
    vat_rate: "增值税率",
    income_tax_rate: "所得税率",
    mode: "模式",
    mode_options: "可选模式",
    token_price_yuan_per_mtok: "每百万 token 单价 (元)",
    token_effective_ratio: "有效产能比例",
    gpu_rent_yuan_per_card_hour: "卡时租金 (元)",
    rack_rent_yuan_per_kw_month: "功率租金 (元/kW/月)",
    online_ramp: "分年投产率",
    price_decay_year: "单价年变化率",
    it_reinvest_year6_ratio: "第六年再投资比例",
    it_ownership: "IT 资产归属",
    pue_excellent: "PUE 优秀参考",
    pue_good: "PUE 良好参考",
    pue_average_cn: "PUE 全国参考",
    wue_excellent: "WUE 优秀参考",
    wue_average: "WUE 平均参考",
    green_ratio_policy: "绿电比例基准",
    copper_index: "用铜比较系数",
    psu_maintenance_index: "PSU 维护比较系数",
    chain: "供电环节",
    stage: "环节",
    cop_mech: "机械制冷 COP",
    wue: "WUE",
    building_default: "建筑尺寸",
    floors: "楼层",
    zones: "功能分区",
    role_zone: "设备分区对应关系",
    flows: "系统流向",
    building: "建筑",
    hall_rows: "机房排数",
    hall_cols: "机房列数",
    site: "参考地区",
    params: "场景假设",
    green_ratio: "绿电比例",
    revenue_mode: "收入模式",
    layout: "建筑布局",
    stations: "链路节点",
    roles: "设备用途",
    floor: "楼层",
    label: "标记",
    en: "英文名",
    hot_aisle: "热通道 (m)",
    cold_aisle: "冷通道 (m)",
    rack_pitch: "机柜间距 (m)",
    deck: "楼板",
    lift: "图示层间距",
    speed: "图示流速",
    rack_rent: "机柜租赁",
    gpu_rent: "卡时租赁",
    token: "Token 服务",
    power_cost: "电力成本",
    network: "网络",
    policy: "政策",
    data: "数据流",
    heat: "热流",
  };
  function field(k) {
    return label[k] || k;
  }
  function atom(v) {
    if (v === null || v === undefined) return "—";
    if (typeof v === "boolean") return v ? "是" : "否";
    return esc(typeof v === "number" ? fmt(v, 7) : label[v] || v);
  }
  function tree(v, depth = 0) {
    if (v === null || typeof v !== "object") return atom(v);
    if (Array.isArray(v) && v.every((x) => x === null || typeof x !== "object"))
      return v.map(atom).join(" · ");
    return (
      '<dl class="data-tree">' +
      Object.entries(v)
        .map(
          ([k, value]) =>
            "<dt>" +
            esc(Array.isArray(v) ? Number(k) + 1 : field(k)) +
            "</dt><dd>" +
            (value &&
            typeof value === "object" &&
            !(
              Array.isArray(value) && value.every((x) => typeof x !== "object")
            ) &&
            depth > 0
              ? "<details><summary>查看" +
                (Array.isArray(value) ? value.length + " 项" : "字段") +
                "</summary>" +
                tree(value, depth + 1) +
                "</details>"
              : tree(value, depth + 1)) +
            "</dd>",
        )
        .join("") +
      "</dl>"
    );
  }
  let data,
    devices,
    byId,
    bySite,
    tab = "devices",
    page = 0,
    sceneId,
    slots = [],
    scenarioAssumptions = {},
    fin = {};
  const Finance = window.GridAidcFinance;
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  function validAssume(a) {
    return (
      isObj(a) &&
      Object.keys(a).length === 3 &&
      Number.isFinite(a.pue) &&
      a.pue >= 1 &&
      a.pue <= 10 &&
      Number.isFinite(a.load) &&
      a.load >= 0 &&
      a.load <= 100 &&
      Number.isFinite(a.tariff) &&
      a.tariff >= 0 &&
      a.tariff <= 100
    );
  }
  function getSnapshot() {
    return {
      version: 1,
      sceneId,
      items: slots.map((i) => ({ ...i })),
      assumptions: { ...scenarioAssumptions },
      finance: { ...fin },
    };
  }
  function restore(snapshot) {
    if (snapshot == null) {
      selectScene(null);
      render();
      return true;
    }
    if (
      !isObj(snapshot) ||
      snapshot.version !== 1 ||
      !data.scenes.some((s) => s.id === snapshot.sceneId) ||
      !Array.isArray(snapshot.items) ||
      snapshot.items.length > 2000 ||
      !validAssume(snapshot.assumptions) ||
      !Finance.validate(snapshot.finance)
    )
      return false;
    if (
      !snapshot.items.every(
        (i) =>
          isObj(i) &&
          byId.has(i.dev) &&
          Number.isSafeInteger(i.count) &&
          i.count >= 0 &&
          i.count <= 999999 &&
          (i.zone === "" || Object.hasOwn(data.layout.zones, i.zone)),
      )
    )
      return false;
    sceneId = snapshot.sceneId;
    slots = snapshot.items.map((i) => ({
      dev: i.dev,
      count: i.count,
      zone: i.zone,
    }));
    scenarioAssumptions = { ...snapshot.assumptions };
    fin = { ...snapshot.finance };
    render();
    return true;
  }
  function changed() {
    if (parent !== window)
      parent.postMessage(
        { type: "gridatlas-aidc-state", snapshot: getSnapshot() },
        location.origin,
      );
  }
  const pageSize = 18,
    query = { value: "", category: "" };
  const api = new URLSearchParams(location.search);
  function error(message) {
    const box = $("#err");
    box.textContent = message;
    box.hidden = !message;
  }
  function dialog(title, html) {
    $("#d-title").textContent = title;
    $("#d-body").innerHTML = html;
    $("#detail").showModal();
  }
  function deviceInfo(id) {
    const d = byId.get(id);
    if (!d) return;
    const { category, categoryId, ...rest } = d;
    dialog(
      d.name,
      '<p class="hint">' +
        esc(category) +
        " · " +
        esc(d.vendor) +
        "</p>" +
        tree(rest) +
        '<p class="src-line">单价为原表的方案估值。型号参数与备注可在原表按编号检索。 <a href="https://newdpower.cloud/data/aidc/devices.json" target="_blank" rel="noopener">打开原始设备表</a></p>',
    );
  }
  function table(head, body) {
    return (
      '<div class="table-scroll"><table class="grid"><thead><tr>' +
      head.map((h) => '<th scope="col">' + h + "</th>").join("") +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table></div>"
    );
  }
  function nav() {
    $("#tabs").innerHTML = Object.entries(tabs)
      .map(
        ([key, name]) =>
          '<button type="button" data-tab="' +
          key +
          '"' +
          (key === tab ? ' aria-current="page"' : "") +
          ">" +
          name +
          "</button>",
      )
      .join("");
  }
  function showLayout() {
    tab = "topologies";
    GridAidcTopology.showCabinets($("#body"));
    render();
    requestAnimationFrame(() => document.querySelector(".cr-room")?.scrollIntoView({block:"start"}));
  }
  function render() {
    error("");
    nav();
    if (tab === "devices") deviceView();
    else if (tab === "scenes") sceneView();
    else if (tab === "sites") siteView();
    else if (tab === "sources") sourceView();
    else if (tab === "topologies") {
      const root = $("#body");
      root.replaceChildren();
      window.GridAidcTopology.render(root, {
        scene: data.scenes.find((s) => s.id === sceneId),
        items: slots.map((s) => ({ ...s })),
        devices: byId,
        data,
      });
    } else parameterView();
  }
  function deviceView() {
    $("#body").innerHTML =
      '<div class="panel"><div class="title-row"><h2>设备型号目录</h2><span class="stat">' +
      devices.length +
      " 个型号 · " +
      data.devices.length +
      " 个分类</span></div>" +
      '<div class="tools"><input id="query" aria-label="搜索设备" placeholder="搜索厂商、型号、名称或技术参数"><select id="cat" aria-label="设备分类"><option value="">全部分类</option>' +
      data.devices
        .map(
          (c) =>
            '<option value="' +
            esc(c.id) +
            '">' +
            esc(c.name) +
            " (" +
            c.devices.length +
            ")</option>",
        )
        .join("") +
      '</select></div><div id="results"></div></div>';
    $("#query").value = query.value;
    $("#cat").value = query.category;
    $("#query").oninput = (event) => {
      query.value = event.target.value;
      page = 0;
      deviceResults();
    };
    $("#cat").onchange = (event) => {
      query.category = event.target.value;
      page = 0;
      deviceResults();
    };
    deviceResults();
  }
  function deviceResults() {
    const needle = query.value.trim().toLocaleLowerCase();
    const hits = devices.filter(
      (d) =>
        (!query.category || query.category === d.categoryId) &&
        (!needle || d.search.includes(needle)),
    );
    if (needle) {
      const rank = (d) =>
        [d.id, d.name, d.model, d.vendor]
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle)
          ? 0
          : 1;
      hits.sort((a, b) => rank(a) - rank(b));
    }
    const last = Math.max(0, Math.ceil(hits.length / pageSize) - 1);
    page = Math.max(0, Math.min(page, last));
    const rows = hits
      .slice(page * pageSize, (page + 1) * pageSize)
      .map(
        (d) =>
          '<tr><td><button class="link" data-device="' +
          esc(d.id) +
          '">' +
          esc(d.name) +
          '</button><span class="sub">' +
          esc(d.model) +
          "</span></td><td>" +
          esc(d.vendor) +
          "</td><td>" +
          esc(d.category) +
          '</td><td class="num mono">' +
          fmt(d.cap_kw) +
          '</td><td class="num mono">' +
          fmt(d.price_wan) +
          "</td></tr>",
      )
      .join("");
    $("#results").innerHTML =
      (hits.length
        ? table(["名称 / 型号", "厂商", "分类", "额定 kW", "单价 / 万元"], rows)
        : '<p class="empty">未找到匹配设备。</p>') +
      '<div class="pagebar"><span class="stat">共 ' +
      hits.length +
      " 个结果" +
      (hits.length ? " · 第 " + (page + 1) + " / " + (last + 1) + " 页" : "") +
      '</span><div class="tabs-actions"><button data-step="-1" ' +
      (page <= 0 ? "disabled" : "") +
      '>上一页</button><button data-step="1" ' +
      (page >= last ? "disabled" : "") +
      ">下一页</button></div></div>";
  }
  function selectScene(id) {
    const s = data.scenes.find((s) => s.id === id) || data.scenes[0];
    sceneId = s.id;
    slots = s.items.map((i) => ({
      dev: i.dev,
      count: i.count ?? 1,
      zone: i.zone || "",
    }));
    fin = Finance.defaults(s, data.econ);
    scenarioAssumptions = {
      pue: 1.25,
      load: Math.round(s.params.it_utilization * 100),
      tariff: bySite.get(s.site).power.price_datacenter,
    };
  }
  function totals() {
    const total = { count: 0, price: 0, it: 0, itCost: 0, gpus: 0, tokens: 0 };
    for (const line of slots) {
      const d = byId.get(line.dev);
      if (!d || !line.count) continue;
      total.count += line.count;
      total.price += (d.price_wan || 0) * line.count;
      if (["it_rack", "network", "storage"].includes(d.role)) {
        total.itCost += (d.price_wan || 0) * line.count;
      }
      if (d.role === "it_rack") {
        total.it += ((d.cap_kw || 0) * line.count) / 1000;
        total.gpus += (d.compute?.gpus || 0) * line.count;
        total.tokens += (d.compute?.tokens_per_s || 0) * line.count;
      }
    }
    return total;
  }
  function cards(entries) {
    return (
      '<div class="snap">' +
      entries
        .map(
          ([key, value]) =>
            "<div>" + esc(key) + "<strong>" + esc(value) + "</strong></div>",
        )
        .join("") +
      "</div>"
    );
  }
  function sceneView() {
    const scene = data.scenes.find((s) => s.id === sceneId);
    const site = bySite.get(scene.site);
    $("#body").innerHTML =
      '<div class="panel"><div class="scene-top"><div class="scene-controls"><label for="scene">预设场景</label><select id="scene">' +
      data.scenes
        .map((s) => '<option value="' + s.id + '">' + esc(s.name) + "</option>")
        .join("") +
      '</select></div><a class="external" href="' +
      originURL +
      "?scene=" +
      encodeURIComponent(scene.id) +
      '" target="_blank" rel="noopener">打开该场景原版 ↗</a></div><p class="hint">' +
      esc(site.name) +
      " · " +
      esc(data.econ.architecture[scene.arch]?.name || scene.arch) +
      " · " +
      esc(data.econ.cooling[scene.cooling]?.name || scene.cooling) +
      '</p><div id="scene-totals"></div></div>' +
      '<div class="panel"><div class="title-row"><h2>设备清单</h2><div class="actions"><button id="csv">导出清单 CSV</button><button id="restore">恢复预设</button></div></div><div class="picker"><select id="new-device" aria-label="要添加的设备">' +
      data.devices
        .map(
          (c) =>
            '<optgroup label="' +
            esc(c.name) +
            '">' +
            c.devices
              .map(
                (d) =>
                  '<option value="' +
                  esc(d.id) +
                  '">' +
                  esc(d.vendor) +
                  " · " +
                  esc(d.model) +
                  "</option>",
              )
              .join("") +
            "</optgroup>",
        )
        .join("") +
      '</select><input type="number" id="new-count" min="1" max="999999" step="1" value="1" aria-label="添加数量"><button id="add">添加设备</button></div><div id="bom"></div></div>' +
      '<div class="panel"><div class="title-row"><h2>运行与电费测算</h2><button class="primary" id="apply-scene">带入当前方案</button></div><div class="fin">' +
      [
        ["pue", "设计 PUE", 1, 10, ".01"],
        ["load", "平均 IT 负载率 (%)", 0, 100, ".01"],
        ["tariff", "到户电价 (元/kWh)", 0, 100, ".001"],
      ]
        .map(
          ([k, title, min, max, step]) =>
            "<label>" +
            title +
            '<input id="edit-' +
            k +
            '" type="number" data-assume="' +
            k +
            '" min="' +
            min +
            '" max="' +
            max +
            '" step="' +
            step +
            '" value="' +
            scenarioAssumptions[k] +
            '"></label>',
        )
        .join("") +
      '</div><div id="run"></div><p class="hint">IT 额定取清单中算力设备的额定有功功率合计。年耗电按固定 PUE、平均负载率和 8,760 小时计算。参考采购额仅计设备台数与参考单价。</p><p id="bridge" class="status" role="status"></p></div>' +
      '<div class="panel"><div class="title-row"><h2>项目现金流估算</h2><span class="stat">税前 · 无融资</span></div><div id="finance-inputs"></div><div id="finance-results"></div><details><summary>计算口径</summary><p class="hint">单位为万元。期初投资含设备、安装和手动增补投资；需将土地、土建、设计及预备费等填入增补投资。设备投资范围可选择业主自购 IT 或仅承担基础设施。逐年收入按收入单价、投产比例及单价变化计算。卡时按已知 GPU 数和负载率，机柜按额定 IT 功率和可出租比例，Token 按记录内峰值吞吐、负载率及可售系数。电费随投产比例变动，固定运维按设备购置额计提。其他年支出用于人工、水、网络等。第六年按自有 IT 购置额计提再投资，末年按期初投资计残值。NPV 折现到期初，静态回收期按首次回正线性插值。现金流多次变号或无可解回报率时，IRR 显示空值。此为本站独立测算。</p></details></div>' +
      '<details class="panel"><summary>场景原始配置参数</summary>' +
      tree({
        id: scene.id,
        arch: scene.arch,
        cooling: scene.cooling,
        site: scene.site,
        layout: scene.layout,
        params: scene.params,
      }) +
      "</details>";
    $("#scene").value = scene.id;
    $("#scene").onchange = (e) => {
      selectScene(e.target.value);
      sceneView();
      changed();
    };
    $("#add").onclick = () => {
      if (slots.length >= 2000) {
        error("清单已达到 2,000 行上限。");
        return;
      }
      const count = Number($("#new-count").value);
      if (!Number.isInteger(count) || count < 1 || count > 999999) {
        error("数量须为 1 至 999999 之间的整数。");
        return;
      }
      const dev = $("#new-device").value;
      slots.push({
        dev,
        count,
        zone: GridAidcLayoutReview.defaultZone(byId.get(dev), data.layout),
      });
      error("");
      renderBOM();
      changed();
    };
    $("#restore").onclick = () => {
      selectScene(scene.id);
      sceneView();
      changed();
    };
    $("#csv").onclick = exportBom;
    $("#apply-scene").onclick = () => {
      const it = totals().it;
      if (!validAssumptions() || it <= 0) {
        error("请检查运行参数，并配置至少一项有功功率大于零的算力设备。");
        return;
      }
      applySite(
        site,
        {
          it: Number(it.toFixed(6)),
          architecture: {ac_ups:'交流 UPS',hvdc:'集中式 HVDC',sst:'SST 800V 直流'}[scene.arch],
          cooling: scene.cooling?.startsWith('air_')?'风冷':scene.cooling?.startsWith('liquid_')?'冷板液冷':undefined,
          load: scenarioAssumptions.load,
          tariff: scenarioAssumptions.tariff,
          pue: scenarioAssumptions.pue,
          green: scene.params.green_ratio * 100,
        },
        "scene",
        scene.name,
      );
    };
    $("#finance-inputs").innerHTML = Finance.inputs(fin);
    renderBOM();
  }
  function validAssumptions() {
    return [...document.querySelectorAll("[data-assume]")].every(
      (el) =>
        el.value !== "" &&
        el.validity.rangeUnderflow === false &&
        el.validity.rangeOverflow === false &&
        Number.isFinite(Number(el.value)),
    );
  }
  function renderBOM() {
    $("#bom").innerHTML = table(
      ["型号", "分区", "单价 / 万元", "数量", "小计 / 万元"],
      slots
        .map((i, j) => {
          const d = byId.get(i.dev);
          const zone = data.layout.zones[i.zone];
          return (
            '<tr><td><button class="link" data-device="' +
            esc(i.dev) +
            '">' +
            esc(d.model) +
            '</button><span class="sub">' +
            esc(d.vendor) +
            "</span></td><td>" +
            esc(zone?.label || i.zone || "—") +
            '</td><td class="num mono">' +
            fmt(d.price_wan) +
            '</td><td><input class="count" type="number" min="0" max="999999" step="1" value="' +
            i.count +
            '" data-row="' +
            j +
            '" aria-label="' +
            esc(d.model) +
            ' 数量"></td><td class="num mono" data-subtotal="' +
            j +
            '">' +
            fmt(d.price_wan * i.count) +
            "</td></tr>"
          );
        })
        .join(""),
    );
    renderSceneTotals();
  }
  function renderSceneTotals() {
    const a = totals();
    $("#scene-totals").innerHTML = cards([
      ["IT 额定功率", fmt(a.it, 3) + " MW"],
      ["已知 GPU 数", fmt(a.gpus, 0) + " 卡"],
      ["清单数量", fmt(a.count, 0) + " 台 / 套"],
      ["设备参考采购额", fmt(a.price / 10000, 3) + " 亿元"],
    ]);
    const p = scenarioAssumptions,
      facility = a.it * p.pue,
      energy = ((facility * p.load) / 100) * 8.76;
    $("#run").innerHTML = validAssumptions()
      ? cards([
          ["设施峰值功率", fmt(facility, 3) + " MW"],
          ["年用电量", fmt(energy, 3) + " GWh"],
          ["年电费", fmt((energy * p.tariff) / 100, 4) + " 亿元"],
          [
            "年度绿电目标",
            fmt(
              energy *
                data.scenes.find((s) => s.id === sceneId).params.green_ratio,
              3,
            ) + " GWh",
          ],
        ])
      : '<p class="hint">请补全有效运行参数。</p>';
    renderFinance();
  }
  function renderFinance() {
    const el = $("#finance-results");
    if (!el) return;
    if (
      !validAssumptions() ||
      !Finance.validate(fin) ||
      [...document.querySelectorAll("input[data-fin]")].some(
        (i) => i.value === "" || !i.validity.valid,
      )
    ) {
      el.innerHTML = '<p class="hint">请填写有效的参数后查看现金流。</p>';
      return;
    }
    const r = Finance.calculate(totals(), scenarioAssumptions, fin, data.econ);
    el.innerHTML =
      cards([
        ["期初投资", fmt(r.initial / 10000, 3) + " 亿元"],
        ["净现值 NPV", fmt(r.npv / 10000, 3) + " 亿元"],
        ["内部收益率 IRR", r.irr == null ? "—" : fmt(r.irr * 100, 2) + "%"],
        [
          "静态回收期",
          r.payback === null ? "期内未回收" : fmt(r.payback, 2) + " 年",
        ],
      ]) +
      "<details><summary>逐年现金流（万元）</summary>" +
      table(
        [
          "年度",
          "投产率",
          "收入",
          "电费",
          "其他运营支出",
          "IT 再投资",
          "残值",
          "净现金流",
          "累计现金流",
        ],
        '<tr><td>期初</td><td colspan="6">建设投入</td><td>' +
          fmt(-r.initial) +
          "</td><td>" +
          fmt(-r.initial) +
          "</td></tr>" +
          r.rows
            .map(
              (y) =>
                "<tr><td>" +
                y.year +
                "</td><td>" +
                fmt(y.ramp * 100) +
                "%</td>" +
                [
                  "revenue",
                  "power",
                  "fixed",
                  "reinvest",
                  "salvage",
                  "net",
                  "balance",
                ]
                  .map((key) => '<td class="num mono">' + fmt(y[key]) + "</td>")
                  .join("") +
                "</tr>",
            )
            .join(""),
      ) +
      "</details>";
  }
  function exportBom() {
    const header = [
      "设备编号",
      "型号",
      "厂商",
      "分区",
      "数量",
      "参考单价（万元）",
      "参考小计（万元）",
    ];
    const rows = slots.map((i) => {
      const d = byId.get(i.dev);
      return [
        d.id,
        d.model,
        d.vendor,
        data.layout.zones[i.zone]?.label || i.zone,
        i.count,
        d.price_wan,
        d.price_wan * i.count,
      ];
    });
    function safeCell(s) {
      let t = String(s ?? "");
      if (/^[\t\r=+@-]/.test(t)) t = "'" + t;
      return '"' + t.replaceAll('"', '""') + '"';
    }
    const blob = new Blob(
      [
        "\ufeff" +
          [header, ...rows]
            .map((row) => row.map(safeCell).join(","))
            .join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = sceneId + "-BOM.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2500);
  }
  function applySite(site, config, mode, title) {
    if (parent === window) {
      error("请从算电图研工作台进入资料库，以便将参数写入当前方案。");
      return;
    }
    parent.postMessage(
      {
        type: "gridatlas-aidc-apply",
        mode,
        label: title || site.name,
        location: { lat: site.geo[0], lon: site.geo[1], label: site.name },
        config,
      },
      location.origin,
    );
    $("#detail").open && $("#detail").close();
    const status = $("#bridge");
    if (status) status.textContent = "参数已提交到当前工作区。";
  }
  function siteView() {
    $("#body").innerHTML =
      '<div class="panel"><div class="title-row"><h2>地区参考参数</h2><span class="stat">' +
      data.sites.length +
      ' 个地区</span></div><p class="hint">电价采用原始场景假设，绿电占比采用目标值。坐标代表地区参考点。</p>' +
      '<div class="category-grid">' +
      data.sites
        .map(
          (s) =>
            '<div class="entry"><strong>' +
            esc(s.name) +
            "</strong><small>" +
            esc(s.level) +
            " · " +
            fmt(s.power.price_datacenter, 4) +
            " 元/kWh</small><small>年平均 " +
            fmt(s.climate.t_avg) +
            " ℃ · 自然冷却 " +
            fmt(s.climate.free_cooling_hours, 0) +
            ' h</small><button class="link" data-site="' +
            esc(s.id) +
            '">查看地区参数</button></div>',
        )
        .join("") +
      '</div><p class="status" id="bridge" role="status"></p></div><details class="panel"><summary>地区表公共默认值</summary>' +
      tree(data.siteDefaults) +
      "</details>";
  }
  function showSite(id) {
    const s = bySite.get(id);
    if (!s) return;
    dialog(
      s.name,
      '<button class="primary" id="site-apply">带入场址和参考电价</button>' +
        tree(s),
    );
    $("#site-apply").onclick = () =>
      applySite(s, { tariff: s.power.price_datacenter }, "site");
  }
  function parameterView() {
    const isEco = tab === "econ";
    const value = isEco
      ? { ...data.econ, 原站脚本内模型参数: data.coefficients }
      : data[tab];
    const what = isEco ? "经济参数与设计假设" : "建筑分区与系统链路";
    $("#body").innerHTML =
      '<div class="panel"><h2>' +
      what +
      '</h2><p class="hint">' +
      (isEco
        ? "查看电力、投资、运维、收入假设及各架构参数。费率与效率以小数记录。"
        : "查看建筑尺寸、楼层、设备分区、角色映射及各链路节点。空间坐标和颜色取自源布局模型。") +
      "</p></div>" +
      Object.entries(value)
        .map(
          ([k, v], i) =>
            '<details class="panel" ' +
            (i === 0 ? "open" : "") +
            "><summary>" +
            esc(field(k)) +
            "</summary>" +
            tree(v) +
            "</details>",
        )
        .join("");
  }
  function sourceView() {
    const modelSources = Object.entries(data.scripts || {})
      .map(
        ([name, source]) =>
          "<details><summary>" +
          esc(name) +
          '</summary><p class="src-line"><a href="' +
          esc(source.url) +
          '" target="_blank" rel="noopener">原站版本</a> · SHA-256 ' +
          esc(source.sha256) +
          "</p></details>",
      )
      .join("");
    const rows = [...data.sources]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(
        (s) =>
          '<tr><td><a href="' +
          s.url +
          '" target="_blank" rel="noopener">' +
          s.id +
          ".json ↗</a></td><td>" +
          esc(s.coverage) +
          '</td><td class="mono">' +
          esc(s.sourceDate) +
          '</td><td><details><summary>SHA-256</summary><span class="sm" style="overflow-wrap:anywhere">' +
          s.sha256 +
          "</span></details></td></tr>",
      )
      .join("");
    $("#body").innerHTML =
      '<div class="panel"><h2>五份启动数据表</h2><p class="hint">' +
      esc(data.sources[0].verified) +
      " 核对 NewdPower 工作台实际载入的公开 JSON。本站保存目录、规格数值、地区和模型假设。每份原始表可直接打开，包含原站注释、来源说明和最新改动。</p>" +
      table(["原始数据", "快照覆盖", "表内更新日期", "原文件校验值"], rows) +
      '<div class="tools"><label for="raw-choice">在线原表</label><select id="raw-choice">' +
      data.sources
        .map((s) => '<option value="' + s.id + '">' + s.id + ".json</option>")
        .join("") +
      '</select><button id="raw-open">在站内查看全部字段</button></div><div id="raw-frame"></div></div><div class="panel"><h2>模型常数版本</h2>' +
      modelSources +
      '</div><div class="panel source-list"><h2>原版工作台服务</h2><p class="hint">五张交互拓扑、原版 8,760 小时引擎、实况天气、账户仿真额度和云端报告由 NewdPower 提供。厂家资料、市场估价和场景参数沿用各表标注的时间口径。</p><a class="external" href="' +
      originURL +
      '" target="_blank" rel="noopener">在 NewdPower 运行原版设计 ↗</a></div>';
    $("#raw-open").onclick = () => {
      const src = data.sources.find((s) => s.id === $("#raw-choice").value);
      if (src)
        $("#raw-frame").innerHTML =
          '<p class="src-line">以下为来源网站当前提供的原始 JSON。<a href="' +
          src.url +
          '" target="_blank" rel="noopener">单独打开原表</a></p><iframe class="raw-source" title="' +
          src.id +
          ' 官方原始数据" referrerpolicy="no-referrer" src="' +
          src.url +
          '"></iframe>';
    };
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.tab) {
      tab = b.dataset.tab;
      render();
    }
    if (b.dataset.device) deviceInfo(b.dataset.device);
    if (b.dataset.site) showSite(b.dataset.site);
    if (b.dataset.step) {
      page += Number(b.dataset.step);
      deviceResults();
    }
  });
  document.addEventListener("input", (e) => {
    const input = e.target;
    if (input.dataset.row !== undefined) {
      const index = Number(input.dataset.row),
        n = Number(input.value);
      if (input.value === "" || !Number.isInteger(n) || n < 0 || n > 999999) {
        error("清单数量须为 0 至 999999 之间的整数。");
        return;
      }
      error("");
      slots[index].count = n;
      const d = byId.get(slots[index].dev);
      document.querySelector('[data-subtotal="' + index + '"]').textContent =
        fmt(n * d.price_wan);
      renderSceneTotals();
      changed();
    } else if (input.dataset.assume) {
      if (
        input.value !== "" &&
        input.validity.rangeUnderflow === false &&
        input.validity.rangeOverflow === false &&
        Number.isFinite(Number(input.value))
      )
        scenarioAssumptions[input.dataset.assume] = Number(input.value);
      renderSceneTotals();
    } else if (input.dataset.fin && input.tagName === "INPUT") {
      if (input.value !== "" && input.validity.valid)
        fin[input.dataset.fin] = Number(input.value);
      renderFinance();
    }
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.fin && el.tagName === "SELECT") {
      fin[el.dataset.fin] = el.value;
      $("#finance-inputs").innerHTML = Finance.inputs(fin);
      renderFinance();
    }
    if (
      el.dataset.fin &&
      el.tagName === "INPUT" &&
      (el.value === "" || !el.validity.valid)
    ) {
      el.value = fin[el.dataset.fin];
      renderFinance();
    }
    if (
      el.dataset.assume &&
      (el.value === "" ||
        el.validity.rangeUnderflow ||
        el.validity.rangeOverflow)
    ) {
      el.value = scenarioAssumptions[el.dataset.assume];
      renderSceneTotals();
    }
    if (el.dataset.fin || el.dataset.assume) changed();
    if (
      e.target.dataset.row !== undefined &&
      (e.target.value === "" || !e.target.validity.valid)
    ) {
      e.target.value = String(slots[Number(e.target.dataset.row)].count);
      error("已保留上一次有效数量。");
    }
  });
  $("#close").onclick = () => $("#detail").close();
  fetch("records.json")
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then((result) => {
      data = result;
      devices = data.devices.flatMap((c) =>
        c.devices.map((d) => ({ ...d, category: c.name, categoryId: c.id })),
      );
      byId = new Map(devices.map((d) => [d.id, d]));
      bySite = new Map(data.sites.map((s) => [s.id, s]));
      for (const d of devices)
        Object.defineProperty(d, "search", {
          value: [
            d.id,
            d.category,
            d.vendor,
            d.name,
            d.model,
            JSON.stringify(d.spec),
          ]
            .join(" ")
            .toLocaleLowerCase(),
          enumerable: false,
        });
      selectScene(api.get("scene"));
      if (api.get("scene")) tab = "scenes";
      if (tabs[api.get("tab")]) tab = api.get("tab");
      if (api.get("view") === "layout") showLayout();
      else render();
      window.GridAidcProject = Object.freeze({ getSnapshot, restore, showLayout, showEquipmentList(id){
        if(id&&id!==sceneId&&data.scenes.some(s=>s.id===id)){selectScene(id);changed();}
        tab="scenes";render();
      } });
      if (parent !== window)
        parent.postMessage({ type: "gridatlas-aidc-ready" }, location.origin);
    })
    .catch((e) => {
      error("设计资料读取失败。请重新加载页面。");
      $("#body").textContent = e.message;
    });
})();
