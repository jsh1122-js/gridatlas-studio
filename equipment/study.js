(() => {
  'use strict';
  const defaults = Object.freeze({profile:'gb200', servers:6, cards:4});
  function clean(value) {
    if (value == null) return {...defaults};
    if (!['gb200','gb300','pcie'].includes(value.profile) || !Number.isInteger(value.servers) || value.servers < 1 || value.servers > 10 ||
        !Number.isInteger(value.cards) || value.cards < 1 || value.cards > 4) throw new Error('请检查机柜样机类型、服务器数和卡数。');
    return {profile:value.profile,servers:value.servers,cards:value.cards};
  }
  function count(value) {
    const s=clean(value);
    return s.profile!=='pcie' ? {nodes:18,perNode:4,gpus:72,cards:null} : {nodes:s.servers,perNode:s.cards,gpus:s.servers*s.cards,cards:s.servers*s.cards};
  }
  window.GridRackStudy=Object.freeze({defaults,clean,count});
})();
