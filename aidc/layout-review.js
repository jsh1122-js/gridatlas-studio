/* Reconcile the selected source BOM with its own aisle grid. Dimensions in metres. */
(() => {
  'use strict';
  const positive=n=>Number.isFinite(n)&&n>0;
  const integer=n=>Number.isSafeInteger(n)&&n>0;
  const palette={it_rack:'#7ea9ff',network:'#bd90eb',storage:'#71d1ba',cold:'#265370',hot:'#59463d'};
  const label={it_rack:'计算',network:'网络',storage:'存储'};
  const qty=rs=>rs.reduce((sum,r)=>sum+r.count,0);
  const defaultZone=(device,layout)=>Object.hasOwn(layout.zones,device.zone)?device.zone:layout.role_zone[device.role]||'';
  function review(scene,records,layout){
    const interior=records.filter(r=>r.zone==='datahall'&&Object.hasOwn(label,r.device.role));
    // The catalog also lists individual 19-inch chassis alongside complete cabinet envelopes.
    const rackmounts=interior.filter(r=>positive(r.device.w)&&r.device.w<=.50&&positive(r.device.h)&&r.device.h<=1.65);
    const groups=interior.filter(r=>!rackmounts.includes(r)).map(r=>({device:r.device,count:r.count,placed:0}));
    const ambiguous=groups.filter(({device})=>{
      const match=String(device.spec?.['形态']||'').match(/^\s*(\d+)\s*U\b/i);
      return match&&Number(match[1])<=32&&device.h>Number(match[1])*.04445+.25;
    });
    const zones=layout.zones,grid=zones.datahall,b=scene.layout?.building||{};
    const outdoorConflicts=records.filter(r=>r.device.outdoor===true&&zones[r.zone]?.outdoor===false&&zones[r.zone]?.floor!=='rf');
    const support=records.filter(r=>r.zone==='datahall'&&!Object.hasOwn(label,r.device.role));
    const otherHall=records.filter(r=>r.zone==='supernode');
    const info={groups,rackmounts,ambiguous,outdoorConflicts,support,otherHall,footprints:[],aisles:[],demand:qty(groups),used:0,
      w:b.w,d:b.d,nrows:scene.layout?.hall_rows,ncols:scene.layout?.hall_cols,pitch:grid?.rack_pitch,cold:grid?.cold_aisle,hot:grid?.hot_aisle};
    const {w,d,nrows,ncols,pitch,cold,hot}=info;
    if(![w,d,pitch,cold,hot].every(positive)||![nrows,ncols].every(integer))return info;
    const known=groups.filter(r=>[r.device.w,r.device.d].every(positive));
    const rowDepth=Math.max(0,...known.map(r=>r.device.d));
    if(!rowDepth)return info;
    const cols=Math.min(ncols,Math.floor(w/pitch+1e-7)),rows=[];
    // Fronts face one another across a cold aisle; backs share the next hot aisle.
    for(let z=0,i=0;i<nrows&&z+rowDepth<=d+1e-7;i++){
      rows.push({z,cursor:0});
      const aisle=i%2===0?cold:hot;
      if(i+1<nrows&&z+rowDepth+aisle+rowDepth<=d+1e-7)
        info.aisles.push({z:z+rowDepth,depth:aisle,kind:i%2===0?'cold':'hot'});
      z+=rowDepth+aisle;
    }
    info.cells=rows.length*cols;info.cols=cols;info.rows=rows.length;info.rowDepth=rowDepth;
    info.arrayWidth=cols*pitch;info.arrayDepth=rows.length?rows.at(-1).z+rowDepth:0;
    for(const g of known){
      const device=g.device,span=Math.ceil(device.w/pitch-1e-9);
      for(const row of rows){
        const fit=Math.min(g.count-g.placed,Math.floor((cols-row.cursor)/span));
        for(let j=0;j<fit;j++){
          const x=row.cursor*pitch;row.cursor+=span;info.used+=span;g.placed++;
          info.footprints.push({x,z:row.z,w:device.w,d:device.d,role:device.role,id:device.id});
        }
        if(g.placed===g.count)break;
      }
    }
    return info;
  }
  function el(tag,text='',className=''){
    const n=document.createElement(tag);n.className=className;n.textContent=text;return n;
  }
  function draw(a){
    const canvas=el('canvas','','alr-plan');
    canvas.width=1000;canvas.height=Math.max(170,Math.min(470,Math.ceil(1000*a.arrayDepth/Math.max(1,a.arrayWidth))));
    canvas.setAttribute('role','img');canvas.setAttribute('aria-label','按设备宽深排入机柜行列，行间分别留出冷通道和热通道。');
    const ctx=canvas.getContext('2d');if(!ctx)return canvas;
    const scale=Math.min((canvas.width-6)/Math.max(.1,a.arrayWidth),(canvas.height-6)/Math.max(.1,a.arrayDepth));
    const x=(canvas.width-a.arrayWidth*scale)/2,y=(canvas.height-a.arrayDepth*scale)/2;
    ctx.fillStyle='#111f31';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    ctx.fillStyle='#25354a';ctx.fillRect(0,0,a.arrayWidth,a.arrayDepth);
    for(const gap of a.aisles){ctx.fillStyle=palette[gap.kind];ctx.fillRect(0,gap.z,a.arrayWidth,gap.depth);}
    for(const r of a.footprints){ctx.fillStyle=palette[r.role];ctx.fillRect(r.x,r.z,r.w,r.d);ctx.strokeStyle='#15293b';ctx.lineWidth=.6/scale;ctx.strokeRect(r.x,r.z,r.w,r.d);}
    ctx.restore();return canvas;
  }
  function render(container,scene,records,layout){
    const a=review(scene,records,layout),box=el('section','','alr-review');
    box.dataset.layoutReview=scene.id;box.dataset.placed=String(a.footprints.length);box.dataset.demand=String(a.demand);
    const unplaced=a.groups.filter(g=>g.count>g.placed);
    box.append(el('h3','原始柜阵 · 逐台占地对照'));
    if(a.cells!==undefined){
      const fmt=n=>Number(n.toFixed(2)).toLocaleString('zh-CN');
      box.append(el('p',a.nrows+' 行 × '+a.ncols+' 位。列距 '+fmt(a.pitch)+' m，冷通道 '+fmt(a.cold)+' m，热通道 '+fmt(a.hot)+' m。按清单顺序试排，每台设备根据外形宽度向上占用整柜位，较宽的整套设备连续跨位。'));
      box.append(draw(a));
      const legend=el('div','','alr-legend');
      for(const [key,name] of Object.entries({...label,cold:'冷通道',hot:'热通道'})){
        const entry=el('span',name);entry.style.setProperty('--alr-color',palette[key]);legend.append(entry);
      }
      box.append(legend,el('p','已排 '+a.footprints.length+' / '+a.demand+' 台或套，占用 '+a.used+' / '+a.cells+' 个可排柜位。柜区包络 '+fmt(a.arrayWidth)+' × '+fmt(a.arrayDepth)+' m，场景建筑外廓 '+fmt(a.w)+' × '+fmt(a.d)+' m。'));
    }else box.append(el('p',a.demand?'机柜外形或行列尺寸资料不足，当前清单无法完成几何排布。':'当前 IT 分区清单没有可落位的计算、网络或存储柜。'));
    if(unplaced.length){
      const detail=el('details');detail.open=true;detail.append(el('summary','原柜阵未独立落位 '+(a.demand-a.footprints.length)+' 台或套'));
      const list=el('ul');for(const g of unplaced)list.append(el('li',(g.device.model||g.device.name)+' × '+(g.count-g.placed)+(positive(g.device.w)&&positive(g.device.d)?'，当前行列或建筑边界容纳不下':'，缺外形尺寸')));
      detail.append(list);box.append(detail);
    }
    if(a.rackmounts.length)box.append(el('p','另有 '+qty(a.rackmounts)+' 台柜内设备。按外形筛出宽度不超过 0.50 m、高度不超过 1.65 m 的机架设备，在分配具体宿主柜和 U 位后计入占地。'));
    if(a.ambiguous.length)box.append(el('p','外形与安装口径需复核。'+a.ambiguous.map(r=>(r.device.model||r.device.name)+' × '+r.count+'（清单外形高 '+r.device.h+' m，规格注明 '+String(r.device.spec['形态']).match(/\d+\s*U/i)[0]+'）').join('、')+'。本图按清单外形逐台试排。合柜后的实际柜数取决于宿主柜、U 位和功率条件。','alr-conflict'));
    if(a.otherHall.length)box.append(el('p','独立超节点大厅另列 '+qty(a.otherHall)+' 台或套。当前场景仅给出一个机房行列参数，超节点大厅需另定阵列和通道。'));
    if(a.support.length)box.append(el('p','IT 分区另有 '+qty(a.support)+' 台或套配套设备。列头柜、桥架等设备的安装位置及检修空间须单列。'));
    if(a.outdoorConflicts.length)box.append(el('p','室内外标注待核对。'+a.outdoorConflicts.map(r=>(r.device.model||r.device.name)+' × '+r.count).join('、')+' 在设备表标为室外，在场景清单分配到室内。已保留两个来源字段。','alr-conflict'));
    const scope=el('details');scope.append(el('summary','分区与配套复核'));
    const list=el('ul');
    const qtyRole=(...roles)=>qty(records.filter(r=>roles.includes(r.device.role)));
    list.append(el('li','供电与备电。清单列有备用发电 '+qtyRole('gen')+' 台/套、电池 '+qtyRole('battery')+' 台/套、储能系统 '+qtyRole('ess')+' 台/套。双路进线独立性、切换或并机接点、旁路、燃料与排烟设施需结合单线图和设备条件确认。'),
      el('li','冷却与网络。核对末端、供回水、排热设备和冷却辅机供电，逐柜核对接入交换设备和存储的端口。清单提供类型和数量，未给出配管标高、配对阀门或端口分配。'),
      el('li','空间与运行保障。本图只核对当前 IT 分区柜阵内部。室外设备与道路、建筑之间的净距，以及疏散与消防、检修吊装、防漏排水、楼板承载、安防与运维用房，需结合总图和专项图纸复核。'));
    const overrides=records.filter(r=>r.device.zone&&r.zone!==r.device.zone&&layout.zones[r.device.zone]);
    if(overrides.length)list.append(el('li','以下设备的场景分区与设备表建议不同。'+overrides.map(r=>(r.device.model||r.device.name)+'（场景 '+(layout.zones[r.zone]?.label||r.zone)+'，设备表 '+(layout.zones[r.device.zone].label||r.device.zone)+'）').join('、')+'。按场景所选分区核对实际安装条件。'));
    const origin=el('a','原版剖视图');origin.href='https://newdpower.cloud/aidc-design.html';origin.target='_blank';origin.rel='noopener';
    const source=el('p','原版的“场地总长 / 宽”标到室内模型外缘，图中的室外机组另占用地。上方试排采用当前场景设备表中的建筑尺寸和设备外形，图上标尺与表中建筑参数需分别核对。');
    source.append(document.createTextNode(' '),origin);scope.append(list,source);box.append(scope);container.append(box);
  }
  window.GridAidcLayoutReview=Object.freeze({review,render,defaultZone});
})();
