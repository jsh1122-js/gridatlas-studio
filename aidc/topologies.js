(() => {
  'use strict';
  const views = {facility:'园区分区',cabinets:'三维机房',power:'供配电',cooling:'制冷循环',rack:'机柜与网络',super:'超节点'};
  const archNames={ac_ups:'交流 UPS',hvdc:'高压直流',sst:'固态变压器'};
  const coolingNames={air_chiller:'冷冻水风冷',air_ahu:'空气处理机组',air_crah:'机房空气处理',liquid_cdu_dry:'冷板液冷与干冷器',liquid_cdu_tower:'冷板液冷与冷却塔',immersion:'浸没冷却'};
  const zoneNames={grid:'市电接入',powerpod:'电力模块',ess:'备电与储能',datahall:'IT 机房',supernode:'超节点大厅',thermal_in:'室内热管理',thermal_out:'室外冷源',mech:'水泵与机房',roof:'屋面排热'};
  const prefs=new WeakMap();
  const fmt=(v,digits=1)=>Number(v).toLocaleString('zh-CN',{maximumFractionDigits:digits});
  function el(tag,txt='',cls=''){const n=document.createElement(tag);if(txt!=='')n.textContent=String(txt);if(cls)n.className=cls;return n;}
  const role=(records,...roles)=>records.filter(item=>roles.includes(item.device.role));
  const count=records=>records.reduce((n,line)=>n+line.count,0);
  const total=(records,fn)=>records.reduce((n,line)=>n+(Number(fn(line.device))||0)*line.count,0);
  const superKind=d=>d.role==='it_rack'&&/超节点|superpod|cloudmatrix|\bnvl\s*\d+|\snvl\d+/i.test((d.name||'')+' '+(d.model||''));
  function block(id,title,rows,tone='blue',caption=''){return {id,title,rows,tone,caption};}
  function groupLine(rows,defaultLabel='清单数量'){
    if(!rows.length)return '清单未配置';
    const n=count(rows);return defaultLabel+' '+fmt(n,0);
  }
  function normalize(items,devices,data){
    return items.map(line=>({device:devices.get(line.dev),count:Number(line.count??1),zone:line.zone||''})).filter(x=>x.device&&Number.isFinite(x.count)&&x.count>0).map(x=>({...x,zone:x.zone||GridAidcLayoutReview.defaultZone(x.device,data.layout)||'elsewhere'}));
  }
  function layout(view,scene,rows,selectedModel){
    const racks=role(rows,'it_rack'), network=role(rows,'network'),storage=role(rows,'storage');
    const superRows=racks.filter(r=>superKind(r.device)), has=(...roleNames)=>role(rows,...roleNames);
    if(view==='facility'){
      const ordered=['grid','powerpod','ess','datahall','supernode','thermal_in','thermal_out','mech','roof'];
      const nodes=ordered.map((key,i)=>block(key,zoneNames[key],rows.filter(r=>r.zone===key),i<3?'amber':i<5?'blue':'teal'));
      const extra=rows.filter(r=>!ordered.includes(r.zone));if(extra.length)nodes.push(block('elsewhere','其他或未分区',extra,'slate'));
      return {type:'floor',heading:'场景空间分区',guide:'按设备清单的分区汇总。分区的相对位置仅用于浏览。',nodes};
    }
    if(view==='power'){
      const arch=scene.arch||'ac_ups';
      const tru=r=>/\bTRU\b|变压器整流单元/i.test(r.device.model+' '+r.device.name);
      const transformer=has('transformer'),dc=has('hvdc'),solid=has('sst');
      const nodes=[block('grid','市电与开关',has('grid'),'amber')];
      if(arch==='ac_ups'||arch==='hvdc'&&transformer.length)nodes.push(block('xfm','独立配电变压器',transformer,'amber'));
      const converters=arch==='ac_ups'?has('ups'):arch==='hvdc'?[...dc,...solid.filter(tru)]:solid.filter(r=>!tru(r));
      nodes.push(block('conv',arch==='ac_ups'?'UPS 变换':arch==='hvdc'?'直流整流 / TRU':'SST 变换',converters,'amber'),
        block('dist','末端配电',has('dist','pdu'),'amber'),block('load','计算、网络与存储',[...racks,...network,...storage],'blue'));
      const branches=[block('generator','备用发电',has('gen'),'amber','经切换或并机设备接应急配电'),
        block('battery','电池后备',has('battery'),'slate','按变换设备的直流接口核对'),
        block('ess','储能系统',has('ess'),'teal','接入点与控制策略另行核对'),
        block('aux','冷却辅机供电',has('pump','chiller','crah','ahu','cdu','drycooler','cooling_tower').filter(r=>r.device.id!=='hex-plate-3000'),'teal','应急供电范围以负荷清单为准')];
      const extra=has('ups','hvdc','sst','transformer').filter(r=>!nodes.some(n=>n.rows.includes(r)));
      if(extra.length)branches.push(block('other','其他变换设备',extra,'slate','清单另列'));
      return {type:'flow',heading:(archNames[arch]||arch)+'供电路径',guide:'主线按供电架构排列。发电机经切换或并机进入应急配电，电池接入相应电源的直流侧。储能系统的接入点以方案单线图为准。',nodes,branches};
    }
    if(view==='cooling'){
      const liquid=String(scene.cooling).startsWith('liquid'),immersion=scene.cooling==='immersion';
      const source=has('chiller'),outs=rows.filter(r=>['drycooler','cooling_tower'].includes(r.device.role)||r.zone==='roof'&&r.device.shape==='drycooler');
      const exchangers=has('pump').filter(r=>/板式换热|板换/.test(r.device.name)),pumps=has('pump').filter(r=>!exchangers.includes(r));
      const nodes=[block('heat','IT 热源',racks,'blue'),
        block('terminal',liquid?'冷板与 CDU':immersion?'浸没槽与换热':'机房空气换热',liquid?has('cdu'):immersion?has('immersion'):has('crah','ahu'),'teal'),
        block('loop','循环泵',pumps,'teal')];
      if(source.length)nodes.push(block('source','压缩式冷源',source,'teal'));
      nodes.push(block('out','室外与屋面排热',outs,'teal'));
      const other=liquid?has('ahu','crah','immersion'):immersion?has('ahu','crah','cdu'):has('cdu','immersion');
      const branches=[];
      if(exchangers.length)branches.push(block('hex','独立换热设备',exchangers,'teal','两侧流体分别循环'));
      if(other.length)branches.push(block('extracool','并列热管理设备',other,'slate','清单另列'));
      return {type:'flow',heading:coolingNames[scene.cooling]||scene.cooling||'制冷循环',guide:liquid?'图中按散热功能排列。机柜二次侧经回液管回 CDU；一次侧独立循环，将热量送到室外。压缩制冷与自然冷源的运行组合需核对水系统图。':'图中按散热功能排列。泵组、换热设备和室外排热设备各自列出，具体供回水与旁通关系需核对水系统图。',nodes,branches};
    }
    if(view==='rack'){
      return {type:'system',heading:'算力、网络与存储',guide:'以交换设备为互联节点。图中展示已选型号及数量，现场端口和实际连线需另行确认。',nodes:[block('compute','计算设备',racks,'blue'),block('network','交换网络',network,'violet'),block('storage','存储设备',storage,'teal')],branches:[block('pdu','机柜配电',has('pdu'),'amber'),block('mgmt','管控平台',has('mgmt'),'slate')]};
    }
    const current=superRows.filter(r=>r.device.id===selectedModel),d=current[0]?.device;
    const chipCount=Number(d?.compute?.gpus),known=Number.isFinite(chipCount);
    const fabric=Object.entries(d?.spec||{}).find(([k])=>/互联|NVLink|交换结构/i.test(k));
    const nodes=[block('cluster','系统间网络',network,'violet'),block('group','超节点系统',current,'blue'),block('fabric','系统内互联',current,'violet',fabric?String(fabric[1]):'资料未列互联细节'),block('chips','加速芯片',current,'teal',known?fmt(chipCount,0)+' 颗 / 系统':'资料未列单套数量')];
    return {type:'system',heading:d?.model||'超节点结构',guide:'从系统间网络到单套系统内的互联与芯片。额定值按已选型号口径展示。',nodes,superRows,current,d};
  }
  function merge(records){
    const totals=new Map();for(const r of records){const prior=totals.get(r.device.id);if(prior)prior.count+=r.count;else totals.set(r.device.id,{...r});}
    return [...totals.values()].sort((a,b)=>b.count-a.count||String(a.device.model).localeCompare(String(b.device.model)));
  }
  function appendMetrics(container,pairs){
    const strip=el('div','','gt-summary');for(const [label,value] of pairs){const tile=el('div');tile.append(el('span',label),el('strong',value));strip.append(tile);}container.append(strip);
  }
  function render(root,{scene,items,devices,data}){
    if(!root||!scene||!(devices instanceof Map))return;
    let state=prefs.get(root);if(!state){state={view:'facility',node:null,model:null};prefs.set(root,state);}
    const rows=normalize(items,devices,data);
    const redraw=()=>{
      root.replaceChildren();const panel=el('section','','gt');root.append(panel);
      const heading=el('div','','gt-heading');heading.append(el('h2','场景拓扑'),el('span',String(scene.name).replace(/^[①②③④⑤]\s*/,'')));panel.append(heading);
      const tabs=el('div','','gt-tabs');tabs.setAttribute('aria-label','系统拓扑视图');panel.append(tabs);
      for(const [key,label] of Object.entries(views)){
        const b=el('button',label);b.type='button';b.setAttribute('aria-pressed',String(key===state.view));b.onclick=()=>{state.view=key;state.node=null;redraw();};tabs.append(b);
      }
      if(state.view==='cabinets'){
        const host=el('div');panel.append(host);
        GridCabinetRoom.mount(host,scene,rows,data.layout,{source:'当前设备清单',edit:()=>document.querySelector('[data-tab="scenes"]').click()});
        const baseline=el('details','','cr-check');baseline.append(el('summary','对照原始柜阵与分区清单'));panel.append(baseline);
        baseline.addEventListener('toggle',()=>{
          if(baseline.open&&!baseline.querySelector('.alr-review'))GridAidcLayoutReview.render(baseline,scene,rows,data.layout);
        });
        return;
      }
      const superRows=rows.filter(r=>superKind(r.device)),models=merge(superRows);
      if(!models.some(r=>r.device.id===state.model))state.model=models[0]?.device.id;
      const v=layout(state.view,scene,rows,state.model),canvas=el('div','','gt-canvas');panel.append(canvas);
      const cap=el('div','','gt-cap');cap.append(el('strong',v.heading),el('span',state.view==='facility'?'功能分区':'系统关系'));canvas.append(cap);
      if(state.view==='super'){
        if(models.length){const field=el('label','设备型号 ','gt-select');const sel=el('select');for(const r of models){const opt=el('option',r.device.model);opt.value=r.device.id;sel.append(opt);}sel.value=state.model;sel.onchange=()=>{state.model=sel.value;state.node='group';redraw();};field.append(sel);canvas.append(field);}
        else canvas.append(el('p','当前清单未配置可识别的超节点系统。可在“场景与配置”中选择超节点场景或添加型号。','gt-empty'));
      }
      const blocks=[...v.nodes,...(v.branches||[])];
      if(!blocks.some(b=>b.id===state.node))state.node=(v.nodes.find(b=>b.rows.length)||v.nodes[0]).id;
      function diagramNode(node){
        const b=el('button','','gt-node '+node.tone);b.type='button';b.dataset.group=node.id;b.setAttribute('aria-pressed',String(state.node===node.id));b.classList.toggle('gt-none',!node.rows.length);
        b.append(el('strong',node.title));
        if(state.view==='super'&&['fabric','chips'].includes(node.id))b.append(el('span',node.caption));
        else {b.append(el('span',groupLine(node.rows)));if((v.branches||[]).includes(node)&&node.caption)b.append(el('small',node.caption));}
        b.onclick=()=>{state.node=node.id;redraw();};return b;
      }
      const grid=el('div','','gt-'+v.type);grid.style.setProperty('--stages',v.nodes.length);
      for(const n of v.nodes)grid.append(diagramNode(n));canvas.append(grid);
      if(v.branches?.length){const row=el('div','','gt-branches');for(const n of v.branches)row.append(diagramNode(n));canvas.append(row);}
      panel.append(el('p',v.guide,'gt-guide'));
      const racks=role(rows,'it_rack'),capacity=total(racks,d=>d.cap_kw)/1000,known=total(racks,d=>d.compute?.gpus);
      if(state.view==='facility') {
        const dims=scene.layout?.building||{},dim=[dims.w,dims.d,dims.h].every(Number.isFinite)?[dims.w,dims.d,dims.h].join(' × ')+' m':'未给出';
        appendMetrics(panel,[['场景建筑长 × 深 × 高',dim],['清单数量',fmt(count(rows),0)+' 台 / 套'],['算力设备额定功率',fmt(capacity,3)+' MW']]);
        GridAidcLayoutReview.render(panel,scene,rows,data.layout);
      }else if(state.view==='rack')appendMetrics(panel,[['计算设备',fmt(count(racks),0)+' 台 / 套'],['已记录加速芯片数',fmt(known,0)+' 颗'],['交换设备',fmt(count(role(rows,'network')),0)+' 台']]);
      else if(state.view==='super'&&v.d){
        const hasGpu=Number.isFinite(v.d.compute?.gpus),units=count(v.current),pcap=Number(v.d.cap_kw);
        appendMetrics(panel,[['选用系统',fmt(units,0)+' 台 / 套'],['该型号芯片合计',hasGpu?fmt(units*v.d.compute.gpus,0)+' 颗':'资料未列'],['该型号额定功率合计',Number.isFinite(pcap)?fmt(units*pcap/1000,3)+' MW':'资料未列']]);
      }
      const focus=blocks.find(b=>b.id===state.node),detail=el('section','','gt-detail');panel.append(detail);
      detail.append(el('h3',focus.title+' · 当前设备清单'));
      if(!focus.rows.length)detail.append(el('p','当前清单未配置此类设备。','gt-guide'));
      if(state.view==='super'&&focus.id==='fabric'&&v.d)detail.append(el('p',focus.caption,'gt-guide'));
      const list=el('div','','gt-device-list');detail.append(list);
      for(const r of merge(focus.rows)){
        const button=el('button');button.type='button';button.dataset.device=r.device.id;
        button.append(el('span',r.device.model||r.device.name),el('b','× '+fmt(r.count,0)));list.append(button);
      }
    };
    redraw();
  }
  window.GridAidcTopology={render,showCabinets:root=>prefs.set(root,{view:'cabinets',node:null,model:null})};
})();
