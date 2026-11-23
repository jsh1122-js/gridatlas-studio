/* Project planning assumptions, independent of the illustrative rack selected in the equipment viewer. */
((root) => {
  'use strict';
  const defaults = Object.freeze({maxRacksPerHall:160, whiteSpaceM2PerRack:4, whiteSpacePct:55});
  const hallAspectRatio = 1.6;
  const maxDrawnRacks = 48;
  const fields = Object.freeze([
    Object.freeze({key:'maxRacksPerHall', label:'每间机房机柜上限', unit:'柜/间', detail:'按机房依次装满，尾厅按实际剩余柜数配置。'}),
    Object.freeze({key:'whiteSpaceM2PerRack', label:'单柜机房净面积', unit:'m²/柜', detail:'包括柜体占地、冷热通道和机房内操作空间，可调整面积预留。'}),
    Object.freeze({key:'whiteSpacePct', label:'机房净面积占建筑面积', unit:'%', detail:'全部机房净面积除以该比例，得到包含机电及辅助空间的估算建筑面积。'})
  ]);
  const notes = Object.freeze({
    counting:'全项目柜数按设计 IT 功率（MW）× 1,000 ÷ 单柜设计功率（kW/柜）向上取整。设备样机用于剖解展示。',
    area:'总机房净面积按实际机柜数量折算，尾厅仅计其实际柜数。建筑面积含机电及辅助空间，室外道路、场坪等用地另计。',
    dimensions:'机房长宽按 1.6∶1 的等面积矩形示意。机柜排布、柱网、设备检修和疏散空间需在工程设计阶段核实。',
    display:'代表机房的三维画面最多绘制 48 个示意机柜，数量和面积指标始终按实际规划柜数计算。'
  });
  function clean(value) {
    if (value == null) return {...defaults};
    if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('空间规划参数应为对象。');
    const result = {};
    for (const {key,label} of fields) {
      const raw = Object.hasOwn(value,key) ? value[key] : defaults[key];
      const number = typeof raw === 'number' || (typeof raw === 'string' && raw.trim()) ? Number(raw) : NaN;
      if (!Number.isFinite(number) || number <= 0) throw new RangeError(label+'须为大于零的有限数。');
      if (key === 'maxRacksPerHall' && !Number.isSafeInteger(number)) throw new RangeError('每间机房的机柜上限须为可精确计数的正整数。');
      if (key === 'whiteSpacePct' && number > 100) throw new RangeError('机房净面积占比须大于 0 且不超过 100%。');
      result[key] = number;
    }
    return result;
  }
  function validate(value) {
    try { clean(value); return true; } catch { return false; }
  }
  function calculate(config, _rackStudy, assumptions) {
    const input = clean(assumptions);
    const racks = root.GridDesign.calculate(config).racks;
    if (!Number.isSafeInteger(racks) || racks < 1) throw new RangeError('设计规模与单柜功率须对应可精确计数的正整数机柜数。');
    const racksPerHall = Math.min(racks,input.maxRacksPerHall);
    const halls = Math.ceil(racks / input.maxRacksPerHall);
    const lastHallRacks = racks % input.maxRacksPerHall || racksPerHall;
    const whiteSpaceM2 = racks * input.whiteSpaceM2PerRack;
    const grossM2 = whiteSpaceM2 / (input.whiteSpacePct / 100);
    if (!Number.isFinite(grossM2)) throw new RangeError('面积测算超出数值范围，请核对规模、单柜面积与净面积占比。');
    const hallWhiteSpaceM2 = racksPerHall * input.whiteSpaceM2PerRack;
    const lastHallWhiteSpaceM2 = lastHallRacks * input.whiteSpaceM2PerRack;
    const shape = Math.sqrt(hallAspectRatio);
    return {
      assumptions:input, racks,halls,racksPerHall,lastHallRacks,displayRacksPerHall:Math.min(racksPerHall,maxDrawnRacks),
      whiteSpaceM2,grossM2,hallWhiteSpaceM2,lastHallWhiteSpaceM2,
      hallLengthM:Math.sqrt(hallWhiteSpaceM2)*shape,hallWidthM:Math.sqrt(hallWhiteSpaceM2)/shape,
      lastHallLengthM:Math.sqrt(lastHallWhiteSpaceM2)*shape,lastHallWidthM:Math.sqrt(lastHallWhiteSpaceM2)/shape
    };
  }
  root.GridSpacePlan = Object.freeze({defaults,fields,notes,hallAspectRatio,maxDrawnRacks,clean,validate,calculate});
})(typeof window !== 'undefined' ? window : globalThis);
