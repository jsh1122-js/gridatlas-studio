(() => {
  "use strict";
  const ranges = {
    years: [1, 40, 1],
    discount: [0, 100],
    decay: [-100, 100],
    addition: [0, 1e9],
    annual: [0, 1e9],
    install: [0, 200],
    infraOm: [0, 100],
    itOm: [0, 100],
    residual: [0, 100],
    reinvest: [0, 100],
    tokenPrice: [0, 1e9],
    gpuPrice: [0, 1e9],
    rackPrice: [0, 1e9],
    effective: [0, 100],
    rackShare: [0, 100],
  };
  const choices = {
    mode: ["rack_rent", "gpu_rent", "token"],
    ramp: ["source", "full"],
    owner: ["all", "infrastructure"],
  };
  const labels = {
    mode: "收入模式",
    ramp: "投产节奏",
    owner: "设备投资范围",
    years: "计算期 (年)",
    discount: "折现率 (%)",
    decay: "单价年变化率 (%)",
    addition: "增补投资 (万元)",
    annual: "其他年支出 (万元)",
    install: "设备安装费率 (%)",
    infraOm: "设施设备年运维费率 (%)",
    itOm: "IT 设备年运维费率 (%)",
    residual: "期末残值率 (%)",
    reinvest: "第六年 IT 再投资率 (%)",
    tokenPrice: "每百万 token 单价 (元)",
    gpuPrice: "卡时租金 (元)",
    rackPrice: "机柜租金 (元/kW/月)",
    effective: "可售吞吐比例 (%)",
    rackShare: "机柜可出租比例 (%)",
  };
  const options = {
    all: "包括 IT 设备",
    infrastructure: "仅基础设施",
    source: "使用场景投产曲线",
    full: "首年满产",
    token: "Token 服务",
    gpu_rent: "GPU 租赁",
    rack_rent: "机柜功率租赁",
  };
  function defaults(scene, econ) {
    const revenue = econ.revenue,
      op = econ.operation,
      f = econ.finance;
    return {
      mode: scene.params.revenue_mode,
      ramp: "source",
      owner:
        scene.params.revenue_mode === "rack_rent" ? "infrastructure" : "all",
      years: f.period_years,
      discount: f.discount_rate * 100,
      decay: revenue.price_decay_year * 100,
      addition: 0,
      annual: 0,
      install: econ.capex.install_rate * 100,
      infraOm: op.om_rate_of_capex * 100,
      itOm: op.it_om_rate_of_capex * 100,
      residual: f.residual_rate * 100,
      reinvest: revenue.it_reinvest_year6_ratio * 100,
      tokenPrice:
        scene.params.token_price_yuan_per_mtok ??
        revenue.token_price_yuan_per_mtok,
      gpuPrice:
        scene.params.gpu_rent_yuan_per_card_hour ??
        revenue.gpu_rent_yuan_per_card_hour,
      rackPrice:
        scene.params.rack_rent_yuan_per_kw_month ??
        revenue.rack_rent_yuan_per_kw_month,
      effective: revenue.token_effective_ratio * 100,
      rackShare: op.rack_utilization * 100,
    };
  }
  function validate(obj) {
    return (
      !!obj &&
      typeof obj === "object" &&
      !Array.isArray(obj) &&
      Object.keys(obj).length ===
        Object.keys(choices).length + Object.keys(ranges).length &&
      Object.entries(choices).every(([k, opts]) => opts.includes(obj[k])) &&
      Object.entries(ranges).every(
        ([k, [min, max, integer]]) =>
          Number.isFinite(obj[k]) &&
          obj[k] >= min &&
          obj[k] <= max &&
          (!integer || Number.isInteger(obj[k])),
      )
    );
  }
  function inputs(values) {
    let controls = Object.entries(choices)
      .map(
        ([k, opts]) =>
          "<label>" +
          labels[k] +
          '<select data-fin="' +
          k +
          '">' +
          opts
            .map(
              (o) =>
                '<option value="' +
                o +
                '"' +
                (o === values[k] ? " selected" : "") +
                ">" +
                options[o] +
                "</option>",
            )
            .join("") +
          "</select></label>",
      )
      .join("");
    for (const [k, [min, max, int]] of Object.entries(ranges)) {
      if (
        (["rackPrice", "rackShare"].includes(k) &&
          values.mode !== "rack_rent") ||
        (k === "gpuPrice" && values.mode !== "gpu_rent") ||
        (["tokenPrice", "effective"].includes(k) && values.mode !== "token")
      )
        continue;
      controls +=
        "<label>" +
        labels[k] +
        '<input data-fin="' +
        k +
        '" type="number" min="' +
        min +
        '" max="' +
        max +
        '" step="' +
        (int ? "1" : "any") +
        '" value="' +
        values[k] +
        '"></label>';
    }
    return '<div class="fin">' + controls + "</div>";
  }
  function npv(cash, rate) {
    return cash.reduce((sum, c, i) => sum + c / (1 + rate) ** i, 0);
  }
  function irr(cash) {
    const signs = cash.filter((x) => x !== 0).map(Math.sign);
    const changes = signs.slice(1).filter((x, i) => x !== signs[i]).length;
    if (changes !== 1 || cash[0] >= 0 || !cash.some((x) => x > 0)) return null;
    // Discounting in reverse avoids numeric overflow close to -100%.
    const value = (rate) => {
      let acc = 0;
      for (let i = cash.length - 1; i >= 0; i--)
        acc = cash[i] + acc / (1 + rate);
      return acc;
    };
    let lo = -0.9999999,
      hi = 1;
    for (let i = 0; i < 80 && value(hi) > 0; i++) hi = hi * 2 + 1;
    if (!(value(lo) > 0 && value(hi) <= 0)) return null;
    for (let i = 0; i < 160; i++) {
      const m = (lo + hi) / 2;
      if (value(m) > 0) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  }
  function calculate(a, assumptions, f, econ) {
    const ownIT = f.owner === "all" ? a.itCost : 0,
      infra = a.price - a.itCost;
    const equipment = infra + ownIT,
      initial = equipment * (1 + f.install / 100) + f.addition;
    const fixed = (infra * f.infraOm) / 100 + (ownIT * f.itOm) / 100 + f.annual,
      util = assumptions.load / 100;
    const yearEnergy = a.it * 1000 * assumptions.pue * util * 8760;
    const electricity = (yearEnergy * assumptions.tariff) / 10000;
    const sales = {
      rack_rent: (a.it * 1000 * 12 * f.rackPrice * f.rackShare) / 100,
      gpu_rent: a.gpus * 8760 * util * f.gpuPrice,
      token:
        (a.tokens * 3600 * 8760 * util * (f.effective / 100) * f.tokenPrice) /
        1e6,
    };
    const yearRevenue = sales[f.mode] / 10000;
    let balance = -initial,
      payback = null;
    const rows = [],
      cash = [-initial];
    const ramps = econ.revenue.online_ramp;
    for (let y = 1; y <= f.years; y++) {
      const ramp =
        f.ramp === "full" ? 1 : ramps[Math.min(y - 1, ramps.length - 1)];
      const revenue = yearRevenue * ramp * (1 + f.decay / 100) ** (y - 1),
        power = electricity * ramp;
      const reinvest = y === 6 ? (ownIT * f.reinvest) / 100 : 0;
      const salvage = y === f.years ? (initial * f.residual) / 100 : 0;
      const net = revenue - power - fixed - reinvest + salvage;
      if (
        payback === null &&
        initial > 0 &&
        net > 0 &&
        balance < 0 &&
        balance + net >= 0
      )
        payback = y - 1 - balance / net;
      balance += net;
      rows.push({
        year: y,
        ramp,
        revenue,
        power,
        fixed,
        reinvest,
        salvage,
        net,
        balance,
      });
      cash.push(net);
    }
    return {
      initial,
      rows,
      ramp: ramps,
      npv: npv(cash, f.discount / 100),
      irr: irr(cash),
      payback,
    };
  }
  window.GridAidcFinance = Object.freeze({
    defaults,
    validate,
    inputs,
    calculate,
  });
})();
