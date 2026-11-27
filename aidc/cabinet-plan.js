/* Planning geometry is in metres. One U is 44.45 mm; both ends of a U range are inclusive. */
(() => {
  'use strict';
  const U = .04445, EPS = 1e-7;
  const hallBatch = 5000;
  const good = n => Number.isFinite(n) && n > 0;
  const positiveInt = n => Number.isSafeInteger(n) && n > 0;
  const isAccessory = d => d.role === 'network' || d.role === 'storage';
  const model = d => String(d.model || d.name || d.id);
  const pad = (v,n=3) => String(v).padStart(n,'0');
  const decimal = n => Number(n.toFixed(5));

  function chassis(d) {
    const specs = d.spec || {};
    const form = String(specs['形态'] || '') + ' ' + String(specs['结构'] || '');
    const uMatch = form.match(/(?:^|\s)(\d{1,2})\s*U\b/i);
    const widthKnown = good(d.w) && d.w <= .50;
    let height = uMatch ? Number(uMatch[1]) : 0;
    let assumption = '';
    if (d.id === 'it-net-ib') {
      height = 4;
      assumption = '通用 InfiniBand 交换机只给出柜壳尺寸，按可上架 4U、1.00 m 深的规划机箱分配，需以订货型号确认。';
    } else if (height && !widthKnown && ['it-stor-flash','it-atlas-910c'].includes(d.id)) {
      assumption = model(d) + '以规格中的 '+height+'U 作为安装高度，按 19 英寸规划。原目录外形为机柜尺寸，规划深度沿用目录深度，安装前需核厂家尺寸。';
    } else if (!widthKnown) {
      return null;
    } else if (!height && good(d.h)) {
      height = Math.ceil((d.h - .002) / U);
    }
    const powerSpec = String(specs['功耗'] || specs['功耗与形态'] || '');
    let power = good(d.cap_kw) ? d.cap_kw : 0;
    for (const m of powerSpec.matchAll(/(?:最大(?:功耗)?|满载)\s*(?:约)?\s*(\d+(?:\.\d+)?)\s*(kW|W)\b/ig)) {
      power = Math.max(power, Number(m[1]) * (m[2].toLowerCase() === 'kw' ? 1 : .001));
    }
    return {height,depth:d.d,power,assumption};
  }

  // Distribute adjacent model batches around the same cycle. Every model differs by at
  // most one unit between halls, while rounding remainders balance the total hall loads.
  function rowsInHall(rows,index,count) {
    if(count===1)return rows;
    const byModel=new Map();
    for(const r of rows){
      const same=byModel.get(r.device.id);
      if(same)same.count+=r.count;
      else byModel.set(r.device.id,{...r});
    }
    const local=[];
    let offset=0;
    for(const r of byModel.values()){
      const first=(index-1-offset+count)%count;
      const units=Math.floor((r.count+count-1-first)/count);
      if(units)local.push({...r,count:units});
      offset=(offset+r.count)%count;
    }
    return local;
  }

  function build(scene,records,layout,options={}) {
    const grid = layout.zones.datahall;
    const original = scene.layout || {};
    const building = {...layout.building_default,...original.building};
    const baseRows = positiveInt(original.hall_rows) ? original.hall_rows : 1;
    const baseCols = positiveInt(original.hall_cols) ? original.hall_cols : 1;
    const pitch = good(grid.rack_pitch) ? grid.rack_pitch : .78;
    const cold = good(grid.cold_aisle) ? grid.cold_aisle : 1.8;
    const hot = good(grid.hot_aisle) ? grid.hot_aisle : 1;
    const baseW = good(building.w) ? building.w : baseCols*pitch+2.4;
    const baseD = good(building.d) ? building.d : baseRows*2.8+2.4;
    const baseH=good(building.h)?building.h:6;
    const room = {w:baseW,d:baseD,h:baseH,baseW,baseD,baseH,baseRows,baseCols,rows:baseRows,cols:baseCols,pitch,cold,hot,aisles:[]};
    const racks = [], devices = [], unresolved = [], notes = new Set();
    const totals = {requested:0,placed:0,addedRacks:0,addedForNetwork:0,sharedRacks:0,existingRacks:0};
    const plan = {arch:scene.arch,room,racks,devices,unresolved,assumptions:[],totals};
    const allInterior = records.filter(r => r.device && positiveInt(r.count) &&
      (r.zone || r.device.zone || layout.role_zone[r.device.role]) === 'datahall' &&
      (isAccessory(r.device) || r.device.role === 'it_rack'));
    const outside = records.filter(r => r.device && positiveInt(r.count) && isAccessory(r.device) &&
      (r.zone || r.device.zone || layout.role_zone[r.device.role]) !== 'datahall');
    function issue(row,reason) {
      unresolved.push({modelId:row.device.id,model:model(row.device),role:row.device.role,count:row.count,reason});
    }
    const totalDevices=allInterior.reduce((sum,r)=>sum+r.count,0);
    const count=Math.max(1,Math.ceil(totalDevices/hallBatch));
    const desired=Number(options?.hall);
    const index=Number.isSafeInteger(desired)?Math.max(1,Math.min(count,desired)):1;
    const interior=rowsInHall(allInterior,index,count);
    const outsideAccessories=outside.reduce((sum,r)=>sum+r.count,0);
    const totalAccessories=allInterior.reduce((sum,r)=>sum+(isAccessory(r.device)?r.count:0),outsideAccessories);
    plan.partition={index,count,totalDevices,totalAccessories,outsideAccessories,
      hallDevices:interior.reduce((sum,r)=>sum+r.count,0)};
    if(index===1)for(const row of outside)issue(row,'清单分配到其他功能分区；保留原分区，在第一间房的核对表汇总，需在对应区域核定宿主柜。');
    totals.requested=interior.reduce((sum,r)=>sum+(isAccessory(r.device)?r.count:0),index===1?outsideAccessories:0);
    const prefix=count>1?'H'+pad(index)+'-':'';
    if(count>1)notes.add('按清单各型号数量分摊到 '+count+' 间规划机房，柜位、供电与数据端口按当前机房分配。切换编号可查看其他机房。跨机房通信和建筑分区需按项目条件深化。');
    const serials = new Map(), shared = [];
    function serial(d) {
      const next = (serials.get(d.id)||0)+1;
      serials.set(d.id,next);
      return prefix+d.id+'-'+pad(next);
    }
    function makeRack(d,added,capacity,usedU,limit,load) {
      const n=racks.length+1, kind=capacity?'shared':'dedicated';
      const id=prefix+'R'+pad(n);
      const rack = {id,label:id,modelId:d.id,model:model(d),role:d.role,source:d,kind,added,
        w:d.w,d:d.d,h:d.h,capacityU:capacity,baseUsedU:usedU,usedU:usedU,baseKW:load,usedKW:load,
        powerLimitKW:limit,usableDepth:decimal(Math.max(0,d.d-.15)),items:[],computeItems:[]};
      racks.push(rack);
      if (capacity) shared.push(rack);
      if (added) totals.addedRacks++; else totals.existingRacks++;
      return rack;
    }
    const accessoryRows=[], computeRows=[];
    for (const row of interior) {
      const d=row.device;
      if (isAccessory(d)) {accessoryRows.push(row);continue;}
      if (!good(d.w) || !good(d.d) || !good(d.h)) {
        issue(row,'机柜或计算设备外形缺失，无法分配实体位置。');continue;
      }
      const shell=d.id==='it-rack-shell', standard=d.id==='it-gen-2u';
      if (!shell && !standard && chassis(d)) {computeRows.push(row);continue;}
      for (let k=0;k<row.count;k++) {
        const load=shell?0:(d.cap_kw||0);
        const rack=makeRack(d,false,shell||standard?42:0,standard?40:0,d.cap_kw||0,load);
        if (!shell) rack.sourceInstance=serial(d);
      }
      if (standard) notes.add('通用整柜的 20 台 2U 服务器预占 U1–U40，按目录 8 kW 整柜负荷保留其供电预算。');
    }
    function fit(r,c) {
      return r.capacityU-r.usedU>=c.height &&
        r.powerLimitKW-r.usedKW+EPS>=c.power && r.usableDepth+EPS>=c.depth;
    }
    function sizeFor(c) {
      return {limit:Math.ceil(c.power/15)*15,depth:Math.max(1.2,Math.ceil((c.depth+.15-EPS)*10)/10)};
    }
    function extra(d,c) {
      const {limit,depth}=sizeFor(c);
      const item={id:'plan-rack-'+limit+'-'+Math.round(depth*10),role:d.role,model:'规划综合机柜 · 42U / '+limit+' kW',w:.6,d:depth,h:2.0};
      const r=makeRack(item,true,42,0,limit,0);
      if (limit>15) notes.add('单台高功率设备另选 '+limit+' kW 规划柜，实际供配电、散热和承重需按设备手册核定。');
      if (isAccessory(d)) totals.addedForNetwork++;
      return r;
    }
    const cursors=new Map();
    function allocate(row) {
      const d=row.device,c=chassis(d);
      if (!c || !positiveInt(c.height) || c.height>42 || !good(c.power) || !good(c.depth)) {
        issue(row,'缺少可用的机架形态、U 高度、功率或深度，需确认是否支持 19 英寸/42U 机柜。');return;
      }
      if (c.assumption) notes.add(c.assumption);
      // Each placement fills a contiguous interval from the lowest unused U.
      // Availability only decreases, so a failed candidate for this model can be skipped for the rest of the row.
      let cursor=cursors.get(d)||0;
      for (let k=0;k<row.count;k++) {
        while(cursor<shared.length && !fit(shared[cursor],c))cursor++;
        const r=shared[cursor] || extra(d,c), start=r.usedU+1;
        const instance = {id:serial(d),modelId:d.id,model:model(d),role:d.role,rackId:r.id,
          uStart:start,uEnd:start+c.height-1,uHeight:c.height,powerKW:c.power,depth:c.depth,source:d};
        r.usedU=instance.uEnd;r.usedKW=decimal(r.usedKW+c.power);
        if (isAccessory(d)) {
          r.items.push(instance);devices.push(instance);totals.placed++;
        } else {
          r.computeItems.push(instance);r.baseUsedU=r.usedU;r.baseKW=r.usedKW;
        }
      }
      cursors.set(d,cursor);
    }
    computeRows.forEach(allocate);
    // Spread each accessory batch through the cluster in BOM proportions so storage and switching can share a host.
    const queue=[];
    for (const row of accessoryRows) {
      const c=chassis(row.device);
      if (!c || !positiveInt(c.height) || c.height>42 || !good(c.power) || !good(c.depth)) {
        allocate(row);continue;
      }
      for(let i=0;i<row.count;i++)queue.push({order:(i+.5)/row.count,row,c});
    }
    queue.sort((a,b)=>a.order-b.order);
    // Check the mixed sequence against a large-load-first packing. Prefer co-location when both need the same cabinet count.
    function newHostCount(sequence) {
      const bins=shared.map(r=>({capacityU:r.capacityU,usedU:r.usedU,powerLimitKW:r.powerLimitKW,usedKW:r.usedKW,usableDepth:r.usableDepth}));
      const cursorByType=new Map();
      for(const {c,row} of sequence) {
        let i=cursorByType.get(row.device)||0;
        while(i<bins.length && !fit(bins[i],c)) i++;
        if(i===bins.length) {
          const {limit,depth}=sizeFor(c);
          bins.push({capacityU:42,usedU:0,powerLimitKW:limit,usedKW:0,usableDepth:decimal(depth-.15)});
        }
        bins[i].usedU+=c.height;bins[i].usedKW=decimal(bins[i].usedKW+c.power);
        cursorByType.set(row.device,i);
      }
      return bins.length-shared.length;
    }
    const descending=queue.slice().sort((a,b)=>b.c.power-a.c.power||b.c.height-a.c.height);
    const sequence=newHostCount(descending)<newHostCount(queue)?descending:queue;
    for(const {row} of sequence)allocate({device:row.device,count:1});
    totals.sharedRacks = racks.filter(r=>r.items.length>0).length;
    notes.add('明确为空柜或已分配 U 位的综合柜优先合柜。原清单的整机柜和超节点按整套保留，未知的空闲 U 位不参与分配。');
    if (totals.addedRacks) notes.add('新增综合柜采用 42U、15 kW 规划起配，柜深至少 1.2 m，预留 0.15 m 走线空间。各路额定能力、端口制式、散热及承重仍按选定型号核实。');

    // Keep service space outside the original rack array. Extending the IT array enlarges the enclosing room by the same increment.
    const baseRowDepth = Math.max(1.2,...racks.filter(r=>!r.added).map(r=>r.d));
    const rowDepth=Math.max(baseRowDepth,...racks.map(r=>r.d));
    const span=r=>Math.max(1,Math.ceil((r.w-EPS)/pitch));
    room.cols=Math.max(baseCols,...racks.map(span));
    let row=0,col=0;
    for (const r of racks) {
      const cells=span(r);
      if (col+cells>room.cols) {row++;col=0;}
      r.row=row+1;r.col=col+1;r.span=cells;r.frontZ=row%2===0?1:-1;
      col+=cells;
    }
    room.rows=Math.max(baseRows,racks.length?row+1:0);
    function depthOf(rows,depth) {
      return rows*depth+Math.ceil((rows-1)/2)*cold+Math.floor((rows-1)/2)*hot;
    }
    room.baseArrayW=baseCols*pitch;room.baseArrayD=depthOf(baseRows,baseRowDepth);
    room.arrayW=room.cols*pitch;room.arrayD=depthOf(room.rows,rowDepth);
    const sideSpace=Math.max(2.4,baseW-room.baseArrayW),endSpace=Math.max(2.4,baseD-room.baseArrayD);
    room.w=decimal(room.arrayW+sideSpace);room.d=decimal(room.arrayD+endSpace);
    room.h=decimal(Math.max(baseH,...racks.map(r=>r.h+.6)));
    if(room.h>baseH)notes.add('按最高柜体上方 0.60 m 的走线预留扩大净高；桥架、喷淋及检修高度需随深化设计核对。');
    room.originX=sideSpace/2;room.originZ=endSpace/2;room.rowDepth=rowDepth;
    const rowZ=i=>room.originZ+i*rowDepth+Math.ceil(i/2)*cold+Math.floor(i/2)*hot;
    // A sparse imported grid can declare more empty rows than there are physical units.
    const aisleCount=room.rows>hallBatch?Math.min(room.rows-1,row+1):room.rows-1;
    for (let i=0;i<aisleCount;i++) {
      const depth=i%2===0?cold:hot;
      room.aisles.push({x:room.originX,z:rowZ(i)+rowDepth,depth,w:room.arrayW,kind:i%2===0?'cold':'hot'});
    }
    for (const r of racks) {
      r.x=decimal(room.originX+(r.col-1+r.span/2)*pitch);
      r.z=decimal(rowZ(r.row-1)+rowDepth/2);
    }
    plan.assumptions=[...notes];
    return plan;
  }
  window.GridCabinetPlan=Object.freeze({build});
})();
