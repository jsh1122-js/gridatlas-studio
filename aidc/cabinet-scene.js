/* The hall, U elevations and both cable ends share one metre-based scene and camera. */
(() => {
  'use strict';
  const vendor=new URL('../equipment/vendor/',document.currentScript.src);
  let modules;
  const engines=()=>modules||(modules=Promise.all([import(new URL('three.module.min.js',vendor)),import(new URL('OrbitControls.js',vendor))]));
  const color={power:'#ffbd63',network:'#43e1d0',compute:'#537aa1',shared:'#48adab',networkRack:'#9582c4'};
  const make=(tag,cls='',text='')=>{const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=text;return n;};
  const button=(action,text,fn)=>{const b=make('button','',text);b.type='button';b.dataset.cabAction=action;b.onclick=fn;return b;};
  const opt=(v,text)=>{const o=make('option','',text);o.value=v;return o;};
  const limits=(n,a,b)=>Math.min(b,Math.max(a,n));
  const units=d=>!d.uStart?'整柜':d.uStart===d.uEnd?'U'+d.uStart:'U'+d.uStart+'–'+d.uEnd;
  const byId=list=>new Map(list.map(r=>[r.id,r]));
  const round=n=>Number(n.toFixed(2));
  const mount=(host,plan,wiring,options={})=>{
    const racks=plan.racks||[],devices=plan.devices||[],links=wiring.links||[];
    const rackMap=byId(racks),deviceMap=byId(devices),linkMap=byId(links);
    const studio=make('section','c3-studio');studio.setAttribute('aria-label','可开门的三维机房');
    const stage=make('div','c3-stage'),canvas=make('canvas');canvas.tabIndex=0;
    canvas.setAttribute('aria-label','三维机房。点机柜开门、点设备看接线。拖动旋转，滚轮或双指缩放。');
    const place=make('span','c3-place'),homeButton=button('home','机房全景',()=>home());homeButton.className='c3-home';
    const legend=make('div','c3-legend');
    for(const [key,label] of [['compute','计算柜'],['shared','网络与存储柜'],['power','供电'],['network','网络']]){const n=make('span','',label);n.dataset.layer=key;n.style.setProperty('--line',color[key]);legend.append(n);}
    const tools=make('div','c3-tools'),rackField=make('label','','选择机柜'),rackPick=make('select'),devField=make('label','','柜内设备'),devPick=make('select');
    rackPick.setAttribute('aria-label','选择机柜');devPick.setAttribute('aria-label','选择柜内设备');
    const openBtn=button('open-rack','打开柜门',()=>openRack(rackPick.value)),devBtn=button('select-device','查看设备',()=>selectDevice(devPick.value));
    const readout=make('div','c3-readout');
    rackField.append(rackPick);devField.append(devPick);tools.append(rackField,openBtn,devField,devBtn);
    stage.append(canvas,place,homeButton,legend);studio.append(stage,tools,readout);host.replaceChildren(studio);
    const targetRacks=racks.filter(r=>r.items?.length),otherRacks=racks.filter(r=>!r.items?.length);
    for(const [title,set] of [['网络与存储',targetRacks],['其他机柜',otherRacks]])if(set.length){
      const group=make('optgroup');group.label=title;for(const rack of set)group.append(opt(rack.id,rack.label+' · '+(rack.items?.length?rack.items.length+' 台':rack.model||'算力柜')));rackPick.append(group);
    }
    let view='room',rack=null,device=null,link=null,peer=null,engine=null,dead=false,everAttached=studio.isConnected;
    const peerOf=(wire,id)=>wire.from.deviceId===id?wire.to:wire.from;
    function update(){
      stage.dataset.cabView=view;stage.dataset.cabRack=rack?.id||'';stage.dataset.cabDevice=device?.id||'';stage.dataset.cabLink=link?.id||'';stage.dataset.cabPeerRack=peer?.rackId||'';stage.dataset.cabPeerDevice=peer?.deviceId||'';
      const candidates=rack?.items||[];devField.hidden=devBtn.hidden=!candidates.length;
      if(rack){rackPick.value=rack.id;devPick.replaceChildren(...candidates.map(d=>opt(d.id,units(d)+' · '+d.model+' · '+d.id)));if(device)devPick.value=device.id;}
      openBtn.disabled=!racks.length;homeButton.hidden=view==='room';
      place.textContent=view==='room'?'机房全景 · '+racks.length+' 柜':view==='peer'?'接线对端 · '+(peer?.port||''):rack.label+(device?' · '+units(device):' · 柜门已打开');
      readout.replaceChildren();
      const line=(text,cls='')=>readout.append(make('p',cls,text));
      if(view==='room'){
        line('机房 '+round(plan.room.w)+' × '+round(plan.room.d)+' m。点柜体或柜号开门，拖动可旋转视角。');
      }else if(!device){
        line(rack.label+' · '+(rack.model||'共享机柜')+' · '+round(rack.w)+' × '+round(rack.d)+' m');
        line(rack.items.length?'点机架上的设备，或从上方选择具体 U 位。':'计算设备占用此柜，可从网络与存储柜追踪到对应的计算网络端点。','c3-note');
      }else{
        readout.append(make('h4','',device.model+' · '+units(device)));
        line(rack.label+' / '+device.id+'，规划功耗 '+round(device.powerKW||0)+' kW。','c3-note');
        const wires=wiring.byDevice?.[device.id]||[],items=make('div','c3-links');
        for(const wire of wires){
          const out=peerOf(wire,device.id),src=wire.from.deviceId===device.id?wire.from:wire.to;
          const b=button('cable','',()=>showCable(wire.id));b.dataset.cabLink=wire.id;b.setAttribute('aria-pressed',String(link===wire));
          const tag=make('span','c3-kind',wire.kind==='power'?'供电':'网络');tag.dataset.power=String(wire.kind==='power');
          b.append(tag,make('span','',src.port+' 接 '+out.label));items.append(b);
        }
        if(wires.length)readout.append(items);
        for(const note of wiring.issues?.[device.id]||[])line(note,'c3-note');
        if(link){
          const target=peerOf(link,device.id);
          line(link.note||'当前规划接线','c3-note');
          const actions=make('div','c3-peer-tools');
          actions.append(button('peer','定位对端 · '+target.port,()=>followPeer()),button('return-device','回到本设备',()=>selectDevice(device.id)));
          if(view==='peer'&&deviceMap.has(target.deviceId))actions.append(button('inspect-peer','查看对端设备',()=>selectDevice(target.deviceId)));
          readout.append(actions);
        }
      }
      engine?.selection(view,rack,device,link,peer);
      options.onSelect?.({view,rackId:rack?.id,deviceId:device?.id,linkId:link?.id});
    }
    function home(){view='room';rack=device=link=peer=null;update();return true;}
    function openRack(id){const next=rackMap.get(id);if(!next)return false;rack=next;device=link=peer=null;view='rack';update();return true;}
    function selectDevice(id){const next=deviceMap.get(id);if(!next||!rackMap.has(next.rackId))return false;device=next;rack=rackMap.get(next.rackId);link=peer=null;view='device';update();return true;}
    function showCable(id){const next=linkMap.get(id);if(!next)return false;
      if(!device||![next.from.deviceId,next.to.deviceId].includes(device.id)){
        const origin=deviceMap.get(next.from.deviceId)||deviceMap.get(next.to.deviceId);if(!origin)return false;
        device=origin;rack=rackMap.get(origin.rackId);
      }
      link=next;peer=null;view='cable';update();return true;
    }
    function followPeer(){if(!link||!device)return;peer=peerOf(link,device.id);view='peer';update();}
    rackPick.onchange=()=>openRack(rackPick.value);devPick.onchange=()=>selectDevice(devPick.value);
    canvas.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();if(device)openRack(device.rackId);else home();}else if(e.key==='Enter'){e.preventDefault();if(view==='room')openRack(rackPick.value);else if(devPick.value)selectDevice(devPick.value);}};
    const pins=[];
    for(const r of targetRacks.slice(0,12)){
      const b=button('pin','',()=>openRack(r.id));b.className='c3-pin';b.dataset.cabPin=r.id;b.textContent=r.label;b.title='打开 '+r.label;stage.append(b);pins.push({el:b,r});
    }
    const api={home,openRack,selectDevice,showCable,dispose};
    const observer=new MutationObserver(()=>{if(studio.isConnected)everAttached=true;else if(everAttached)dispose();});observer.observe(document.documentElement,{subtree:true,childList:true});
    function dispose(){if(dead)return;dead=true;observer.disconnect();engine?.dispose();studio.remove();}
    if(!options.initialDeviceId||!selectDevice(options.initialDeviceId)){if(!options.initialRackId||!openRack(options.initialRackId))home();}
    if(racks.length)engines().then(([T,{OrbitControls}])=>{
      if(dead)return;
      engine=makeEngine(T,OrbitControls,{stage,canvas,plan,racks,rackMap,deviceMap,pins,openRack,selectDevice,showCable,wiring});
      engine.selection(view,rack,device,link,peer);stage.dataset.cabReady='true';
    }).catch(error=>{if(!dead){stage.dataset.cabReady='error';place.textContent='三维视图载入失败，可从下方查看设备与接线。';console.error(error);}});
    return api;
  };
  function makeEngine(T,OrbitControls,{stage,canvas,plan,racks,rackMap,deviceMap,pins,openRack,selectDevice,showCable,wiring}){
    const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),scene=new T.Scene();
    const camera=new T.PerspectiveCamera(35,1,.015,5000),room=plan.room;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)'),geo=new T.BoxGeometry(1,1,1);
    const materials=new Map(),textures=new Map(),ownedGeometry=[geo],softScene=[],rackIndices=new Map(racks.map((r,i)=>[r.id,i]));
    let renderer,ctx,lostCanvas=null;
    try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));}
    catch{ctx=canvas.getContext('2d');if(!ctx)throw Error('WebGL and Canvas 2D are unavailable');}
    stage.dataset.cabEngine=renderer?'webgl':'canvas3d';
    const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.rotateSpeed=.68;controls.zoomSpeed=.9;controls.minDistance=.22;controls.maxDistance=3500;controls.maxPolarAngle=Math.PI*.497;
    const key=new T.DirectionalLight(0xf5f7ff,3);key.position.set(-15,30,12);
    const rim=new T.DirectionalLight(0x98e8ea,1.65);rim.position.set(14,8,-16);
    scene.add(key,rim,new T.HemisphereLight(0xf0f6ff,0x909fab,1.85));
    const swatches={steel:'#7b95a6',shell:'#3a5367',glass:'#486578',floor:'#203748',rail:'#5c7483',power:color.power,network:color.network};
    function mat(tint,lit=true){
      tint=swatches[tint]||tint;const id=tint+lit;
      if(!materials.has(id))materials.set(id,lit?new T.MeshStandardMaterial({color:tint,metalness:.16,roughness:.52}):new T.MeshBasicMaterial({color:tint}));
      return materials.get(id);
    }
    function faceTexture(key,kind){
      const id=key+'-'+kind;if(textures.has(id))return textures.get(id);
      const c=document.createElement('canvas');c.width=kind==='rail'?64:192;c.height=kind==='rail'?1024:kind==='door'?384:48;
      const g=c.getContext('2d'),w=c.width,h=c.height;
      const gradient=g.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#637784');gradient.addColorStop(.22,'#324654');gradient.addColorStop(1,'#1c303d');
      g.fillStyle=gradient;g.fillRect(0,0,w,h);
      if(kind==='floor'){
        g.fillStyle='#415763';g.fillRect(0,0,w,h);g.strokeStyle='#526a77';g.lineWidth=3;g.strokeRect(1,1,w-2,h-2);
        g.lineWidth=1;g.strokeStyle='#3a4f5d';g.beginPath();g.moveTo(w/2,0);g.lineTo(w/2,h);g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();
      }else if(kind==='door'){
        g.strokeStyle='#90a5ae';g.lineWidth=4;g.strokeRect(4,4,w-8,h-8);g.fillStyle='#304451';g.fillRect(14,14,w-28,h-28);
        g.fillStyle='#101e28';for(let y=23;y<h-18;y+=8)for(let x=22+(y%16?2:0);x<w-19;x+=7){g.fillRect(x,y,4,3);}
        g.fillStyle='#bfcdd2';g.fillRect(w-21,h*.45,4,28);
      }else if(kind==='rail'){
        const count=Number(key)||42;for(let u=1;u<=count;u++){
          const yy=h-(u-.5)*h/count;g.fillStyle='#94aeb7';g.fillRect(w*.73,yy-1,w*.27,2);
          if(u===1||u===count||u%5===0){g.fillStyle='#e0f3f5';g.font='bold 18px sans-serif';g.textAlign='right';g.fillText(String(u),w*.67,yy+6);}
        }
      }else{
        const isNet=kind==='network';g.fillStyle='#0b1a23';
        const n=isNet?16:7;for(let i=0;i<n;i++){
          const x=8+i*(w-39)/n;
          if(isNet){g.fillRect(x,10,6,10);g.fillRect(x,24,6,10);g.fillStyle='#75d4af';g.fillRect(x,34,3,2);g.fillStyle='#0b1a23';}
          else{g.fillRect(x,6,15,h-13);g.fillStyle='#869ca3';g.fillRect(x+2,9,9,3);g.fillStyle='#0b1a23';}
        }
        g.fillStyle=isNet?'#bc9ce2':kind==='it_rack'?'#81b3de':'#70d5c6';g.fillRect(w-27,8,13,4);g.fillStyle='#7ee5ab';g.fillRect(w-18,18,4,4);
      }
      const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;textures.set(id,tex);return tex;
    }
    function skin(kind,key=''){
      const id='tex/'+kind+key;if(!materials.has(id))materials.set(id,new T.MeshStandardMaterial({map:faceTexture(key,kind),metalness:.10,roughness:.57}));return materials.get(id);
    }
    function box(group,x,y,z,w,h,d,tint,pick){
      const material=typeof tint==='string'?mat(tint):tint,obj=new T.Mesh(geo,material);
      obj.position.set(x,y,z);obj.scale.set(w,h,d);if(pick)obj.userData.pick=pick;group.add(obj);return obj;
    }
    const roomGroup=new T.Group();scene.add(roomGroup);
    let xmin=Infinity,xmax=-Infinity,zmin=Infinity,zmax=-Infinity;
    for(const r of racks){xmin=Math.min(xmin,r.x-r.w/2);xmax=Math.max(xmax,r.x+r.w/2);zmin=Math.min(zmin,r.z-r.d/2);zmax=Math.max(zmax,r.z+r.d/2);}
    const center=v((xmin+xmax)/2,.5,(zmin+zmax)/2),rackH=Math.max(1.9,...racks.map(r=>r.h));
    const gridTex=faceTexture('room','floor');gridTex.wrapS=gridTex.wrapT=T.RepeatWrapping;gridTex.repeat.set(room.w/2.4,room.d/2.4);
    const floorMat=new T.MeshStandardMaterial({map:gridTex,roughness:.92,metalness:.04});materials.set('floor-grid',floorMat);
    const floor=box(roomGroup,room.w/2,-.09,room.d/2,room.w,.16,room.d,floorMat);softScene.push(floor);
    const boundary='#4e7883';
    for(const [x,z,w,d] of [[room.w/2,0,room.w,.065],[room.w/2,room.d,room.w,.065],[0,room.d/2,.065,room.d],[room.w,room.d/2,.065,room.d]]){
      const edge=box(roomGroup,x,.08,z,w,.18,d,boundary);softScene.push(edge);
    }
    for(const a of room.aisles||[]){
      const w=xmax-xmin,z=a.z+a.depth/2,tint=a.kind==='cold'?'#3f6471':'#796c59';
      softScene.push(box(roomGroup,center.x,.001,z,w,.01,a.depth*.97,tint));
      box(roomGroup,center.x,.013,a.z+.07,w,.013,.025,a.kind==='cold'?'#5e919e':'#997b63');
    }
    // Fore-and-aft row trays share a transverse service tray beyond the last column.
    const tray=new T.Group();scene.add(tray);
    const trayY=rackH+.28,trunkX=xmax+.46,rowLanes=new Map();
    for(const r of racks)if(!rowLanes.has(r.row))rowLanes.set(r.row,r.z+r.frontZ*(r.d/2+.16));
    const laneOf=r=>rowLanes.get(r.row);
    const trayColor='#85a3ad',rung='#566e79';
    for(const [row,lane] of rowLanes){
      const first=racks.find(r=>r.row===row),left=xmin-.14,span=trunkX-left;
      for(const gap of [-.072,.072])box(tray,(left+trunkX)/2,trayY-.055,lane+gap,span,.062,.018,trayColor);
      for(let x=left+.35;x<trunkX;x+=1.4)box(tray,x,trayY-.073,lane,.045,.02,.145,rung);
      if(first)for(const x of [left+.28,trunkX-.25])box(tray,x,(rackH+trayY)/2,lane,.024,trayY-rackH,.024,rung);
    }
    const laneVals=[...rowLanes.values()],z0=Math.min(...laneVals)-.09,z1=Math.max(...laneVals)+.09;
    for(const shift of [-.072,.072])box(tray,trunkX+shift,trayY-.055,(z0+z1)/2,.018,.062,z1-z0,trayColor);
    for(let z=z0;z<=z1;z+=1.1)box(tray,trunkX,trayY-.073,z,.145,.02,.045,rung);
    // The background remains one batch per part, even with hundreds of cabinets.
    const groups=[],staticBatches=[],dummy=new T.Object3D();
    // Repeated cable-tray rungs and aisle strips can be rendered in one call per finish.
    const fallbackTray=tray.children.filter(o=>o.scale.x>.3||o.scale.z>.3);
    for(const group of [tray,roomGroup]){
      const finishes=new Map();group.updateMatrixWorld(true);
      for(const o of [...group.children]){
        const same=finishes.get(o.material)||[];same.push(o);finishes.set(o.material,same);
      }
      for(const [finish,parts] of finishes)if(parts.length>1){
        const merged=new T.InstancedMesh(geo,finish,parts.length);
        parts.forEach((o,i)=>{merged.setMatrixAt(i,o.matrix);group.remove(o);});
        group.add(merged);staticBatches.push(merged);
      }
    }
    const pduBanks=new Map(),portCounts=new Map();
    for(const c of wiring.links)for(const e of [c.from,c.to]){
      if(e.kind==='pdu'){const k=e.rackId+e.side;pduBanks.set(k,Math.max(pduBanks.get(k)||1,e.bank||1));}
      if(e.kind==='device'&&c.kind==='network'){const n=Number(e.port.match(/\d+/)?.[0]||1);portCounts.set(e.deviceId,Math.max(n,portCounts.get(e.deviceId)||0));}
    }
    const bankZ=(r,side,bank)=>-r.d/2+.058+(bank-1)*Math.min(.075,(r.d-.22)/Math.max(1,(pduBanks.get(r.id+side)||1)-1));
    const kindOf=item=>['network','storage'].includes(item.role)?item.role:'it_rack';
    const roleTint=r=>r.items?.length?(r.items.some(d=>d.role==='storage')?'#4dd9c2':'#63c6bd'):color.compute;
    function batch(material,parts){
      const m=material.clone(),im=new T.InstancedMesh(geo,m,racks.length);im.frustumCulled=false;im.userData.rackBatch=true;scene.add(im);
      function place(i,hide=false){const r=racks[i],p=parts(r);dummy.position.set(r.x+p[0],p[1],r.z+p[2]*r.frontZ);dummy.rotation.y=r.frontZ<0?Math.PI:0;
        dummy.scale.set(hide?0:p[3],hide?0:p[4],hide?0:p[5]);dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);}
      for(let i=0;i<racks.length;i++){place(i);if(material.userData.tintRack)im.setColorAt(i,new T.Color(roleTint(racks[i])));}
      im.instanceMatrix.needsUpdate=true;groups.push({im,place});
    }
    batch(mat('shell'),r=>[0,r.h/2,0,r.w,r.h,r.d]);batch(skin('door'),r=>[0,r.h/2,r.d/2+.002,r.w*.87,r.h*.93,.016]);
    const accent=mat('#ffffff');accent.userData.tintRack=true;batch(accent,r=>[0,r.h*.960,r.d/2+.016,r.w*.88,r.items?.length ? .12 : .039,.017]);
    const topMat=mat('#ffffff',false);topMat.userData.tintRack=true;
    batch(topMat,r=>[0,r.h+.004,0,r.w*.85,.012,r.items?.length?r.d*.84:r.d*.082]);
    const active=new Map(),wireGroup=new T.Group();scene.add(wireGroup);
    let pickWires=[],wirePaths=[],view='room',rack,dev,wire,peer,frame=0,dead=false,destination,intersect=true;
    let width=1,height=1,oldFocus='',markers=[],pickedStart=null;
    const railStep=r=>Math.min(.04445,(r.h-.12)/Math.max(1,r.capacityU||42));
    const deviceFace=(d,r)=>{
      if(d?.uStart){const step=railStep(r);return {y:.065+((d.uStart+d.uEnd)/2-.5)*step,h:Math.max(.027,(d.uEnd-d.uStart+1)*step-.004)};}
      return {y:r.h*.52,h:r.h*.83};
    };
    function groupFor(r){
      const g=new T.Group();g.position.set(r.x,0,r.z);if(r.frontZ<0)g.rotation.y=Math.PI;scene.add(g);
      const shelves=[],soft=[],target={rack:r.id};const add=(...args)=>{const o=box(g,...args);soft.push(o);return o;};
      const {w,d,h}=r,hw=w/2,hd=d/2;
      for(const x of [-hw+.015,hw-.015]){
        add(x,h/2,0,.032,h,d*.97,'shell',target);
        add(x,h/2,hd-.022,.032,h,.036,'steel',target);
      }
      add(0,.034,0,w,.065,d,'shell',target);add(0,h-.018,0,w,.034,d,'shell',target);
      add(0,h-.072,-hd+.019,w-.04,.065,.032,'#465963',target);
      const rail=skin('rail',String(r.capacityU||42));
      add(-hw+.044,Math.min(h/2,.065+railStep(r)*(r.capacityU||42)/2),hd-.031,.049,railStep(r)*(r.capacityU||42),.022,rail,target);
      add(hw-.046,h/2,hd-.029,.028,h-.12,.021,'rail',target);
      for(const side of [-1,1]){
        const band=side<0?'A':'B';
        for(let bank=1;bank<=(pduBanks.get(r.id+band)||0);bank++){
          const z=bankZ(r,band,bank);
          add(side*(hw-.103),h/2,z,.041,h-.18,.053,side<0?'#966a46':'#997e57',target);
          for(let j=0;j<24;j++)add(side*(hw-.103),.12+(j+.5)*(h-.24)/24,z-.028,.024,.027,.009,'#232d32',target);
        }
      }
      for(const side of [-1,1])add(side*(hw-.035),h/2,hd-.056,.008,h-.16,.012,'#a2d1cf',target);
      const contents=[...(r.computeItems||[]),...(r.items||[])];
      if(!contents.length&&r.kind==='dedicated')for(let n=0;n<9;n++)add(0,.18+n*(h-.38)/9,hd-.12,w*.77,.098,.13,skin('it_rack'),target);
      for(const item of contents){
        const {y,h:dh}=deviceFace(item,r),isDevice=deviceMap.has(item.id);
        const pick=isDevice?{device:item.id}:target;
        const body=add(0,y,0,w*.78,dh,d*.76,'#455a66',pick);
        const face=add(.013,y,hd-.047,w*.74,dh,.028,skin(kindOf(item)),pick);
        face.userData.device=item.id;
        for(const sign of [-1,1])add(sign*w*.19,y,-hd+.041,w*.20,Math.min(dh*.73,.057),.032,'#657565',pick);
        add(-w*.39,y,hd-.05,.012,dh,.03,item.role==='network'?'#ad8bc8':item.role==='storage'?'#6bc6b6':'#85a3c2',pick);
        const sel=new T.Group();g.add(sel);
        for(const sy of [-1,1])box(sel,.013,y+sy*(dh/2+.002),hd-.028,w*.76,.006,.014,mat('#62f4d9',false));
        for(const sx of [-1,1])box(sel,.013+sx*w*.38,y,hd-.028,.006,dh,.014,mat('#62f4d9',false));
        sel.visible=false;shelves.push({item,body,face,sel});
      }
      const hinge=new T.Group();hinge.position.set(-hw+.011,.006,hd+.015);g.add(hinge);
      const door=box(hinge,w*.478,h/2,0,w*.956,h*.979,.031,skin('door'),target);soft.push(door);
      g.updateMatrixWorld(true);return {rack:r,g,hinge,soft,shelves,progress:0};
    }
    function updateActive(ids){
      for(const [id,a] of active)if(!ids.has(id)){scene.remove(a.g);active.delete(id);groups.forEach(s=>s.place(rackIndices.get(id),false));}
      for(const id of ids)if(!active.has(id)&&rackMap.has(id)){const r=rackMap.get(id);active.set(id,groupFor(r));groups.forEach(s=>s.place(rackIndices.get(id),true));}
      for(const s of groups){s.im.instanceMatrix.needsUpdate=true;s.im.material.transparent=!!ids.size;s.im.material.opacity=ids.size ? .12 : 1;s.im.material.depthWrite=!ids.size;s.im.material.needsUpdate=true;}
    }
    const world=(r,x,y,z)=>v(r.x+r.frontZ*x,y,r.z+r.frontZ*z);
    function anchor(end,kind){
      const r=rackMap.get(end.rackId);if(!r)return null;
      const hd=r.d/2,hw=r.w/2,side=end.side==='B'?1:-1;
      if(end.kind==='pdu')return world(r,side*(hw-.103),.12+(end.outlet-.5)*(r.h-.24)/24,bankZ(r,end.side,end.bank||1)-.033);
      const unit=deviceMap.get(end.deviceId)||end;
      const part=deviceFace(unit,r),n=Number(end.port.match(/\d+/)?.[0]||1);
      if(kind==='power'){
        const isB=/B\b/.test(end.port),i=isB?1:(n-1)%2;
        return world(r,(i?1:-1)*r.w*.19,part.y+Math.min(part.h*.2,Math.floor((n-1)/2)*.016),-hd+.022);
      }
      if(end.kind==='compute')return world(r,-r.w*.09,r.h*.64,hd-.018);
      const rows=unit.role==='network'?Math.min(8,Math.max(2,Math.floor(part.h/.022))):1;
      const visiblePorts=Math.max(32,portCounts.get(end.deviceId)||0);
      const cols=Math.ceil(visiblePorts/rows),row=Math.floor((n-1)/cols)%rows,col=(n-1)%cols;
      return world(r,unit.role==='network'?(-.32+col*.61/(cols-1))*r.w:(/B|2/.test(end.port)?1:-1)*r.w*.19,part.y+(row-(rows-1)/2)*Math.min(.027,part.h/(rows+.5)),hd-.022);
    }
    function wirePoints(c){
      const a=anchor(c.from,c.kind),b=anchor(c.to,c.kind);if(!a||!b)return [];
      const ra=rackMap.get(c.from.rackId),rb=rackMap.get(c.to.rackId),power=c.kind==='power',sign=power?-1:1;
      const exit=(pos,r)=>v(pos.x,pos.y,r.z+r.frontZ*(r.d/2+.045)*sign);
      const pa=exit(a,ra),pb=exit(b,rb),channelA=ra.x+ra.frontZ*(power?(c.to.side==='B'?1:-1):1)*(ra.w/2-.05);
      const channelB=rb.x+rb.frontZ*(rb.w/2-.05),top=trayY;
      const pts=[a,pa,v(channelA,pa.y,pa.z)];
      if(ra===rb){pts.push(v(channelA,pb.y,pb.z));}
      else{
        const laneA=laneOf(ra),laneB=laneOf(rb);
        pts.push(v(channelA,top,pa.z),v(channelA,top,laneA));
        if(ra.row!==rb.row)pts.push(v(trunkX,top,laneA),v(trunkX,top,laneB));
        pts.push(v(channelB,top,laneB),v(channelB,top,pb.z),v(channelB,pb.y,pb.z));
      }
      pts.push(pb,b);return pts.filter((p,i)=>!i||p.distanceToSquared(pts[i-1])>1e-10);
    }
    const cyl=new T.CylinderGeometry(1,1,1,8),ball=new T.SphereGeometry(1,10,8),up=v(0,1,0);ownedGeometry.push(cyl,ball);
    function wires(){
      wireGroup.clear();pickWires=[];wirePaths=[];for(const m of markers)m.el.remove();markers=[];
      if(!wire)return;
      const pts=wirePoints(wire);if(pts.length<2)return;
      // Both endpoints, all bends and the selectable tube are placed from the same route.
      const accent=wire.kind==='power'?color.power:color.network;
      const thick=view==='peer' ? .0038 : wire.from.rackId===wire.to.rackId ? .006 : .012;
      const m=mat(accent,false);
      for(let i=1;i<pts.length;i++){
        const dir=pts[i].clone().sub(pts[i-1]),mesh=new T.Mesh(cyl,m);
        mesh.position.copy(pts[i-1]).addScaledVector(dir,.5);mesh.scale.set(thick,dir.length(),thick);
        mesh.quaternion.setFromUnitVectors(up,dir.normalize());mesh.userData.pick={wire:wire.id};wireGroup.add(mesh);pickWires.push(mesh);
      }
      for(const [i,end] of [[0,wire.from],[pts.length-1,wire.to]]){
        const mesh=new T.Mesh(ball,m);mesh.position.copy(pts[i]);mesh.scale.setScalar(thick*2.35);wireGroup.add(mesh);
        const mark=make('span','c3-port-marker',end.rackId+' · '+end.port);
        mark.style.setProperty('--c3-mark',accent);stage.append(mark);markers.push({el:mark,at:pts[i]});
      }
      wirePaths.push({pts,accent});
    }
    function frameTarget(){
      let target,offset;
      const aspect=Math.max(.35,width/Math.max(1,height)),dir=v(.65,.79,1.05).normalize();
      if(view==='room'){
        target=center.clone();const bounds=new T.Box3(v(xmin,0,zmin),v(xmax,rackH,zmax));
        offset=overview(bounds,dir,aspect);
      }else if(view==='cable'&&wire&&wire.from.rackId!==wire.to.rackId){
        const pts=wirePaths[0]?.pts||[];const bb=new T.Box3().setFromPoints(pts);
        target=bb.getCenter(v());offset=overview(bb,dir,aspect);
      }else{
        const end=view==='peer'?peer:null;
        const r=(end&&rackMap.get(end.rackId))||rack;
        const y=end?anchor(end,wire.kind)?.y:dev?deviceFace(dev,r).y:r.h*.49;
        const backside=wire?.kind==='power'&&(view==='cable'||view==='peer');
        const side=backside?-1:1;
        if(view==='rack'){
          target=world(r,0,y||r.h*.49,r.d*.25);offset=v(r.frontZ*r.w*.68,.55,r.frontZ*Math.max(r.h*2.03,r.w/aspect*2.45));
        }else if(view==='cable'&&wirePaths.length){
          const bb=new T.Box3().setFromPoints(wirePaths[0].pts);target=bb.getCenter(v());bb.expandByScalar(.13);
          offset=overview(bb,v(r.frontZ*.24,.14,r.frontZ*side).normalize(),aspect);
        }else{
          target=end?anchor(end,wire.kind):world(r,0,y,r.d*.43);
          const distance=Math.max(.68,r.w*1.48/aspect);
          offset=v(r.frontZ*.16,.09,r.frontZ*side).normalize().multiplyScalar(distance);
        }
      }
      if(!target||!Number.isFinite(target.x))return;
      destination={p:target.clone().add(offset),t:target};
      if(reduced.matches||oldFocus===''){camera.position.copy(destination.p);controls.target.copy(destination.t);controls.update();destination=null;}
    }
    function overview(bb,dir,aspect){
      const center=bb.getCenter(v()),right=v(0,1,0).cross(dir).normalize(),up=dir.clone().cross(right),tan=Math.tan(camera.fov*Math.PI/360);
      let distance=.48;
      for(const x of [bb.min.x,bb.max.x])for(const y of [bb.min.y,bb.max.y])for(const z of [bb.min.z,bb.max.z]){
        const p=v(x,y,z).sub(center);
        distance=Math.max(distance,p.dot(dir)+Math.max(Math.abs(p.dot(right))/(tan*aspect),Math.abs(p.dot(up))/tan)*1.14);
      }
      return dir.clone().multiplyScalar(distance);
    }
    function selection(nextView,nextRack,nextDev,nextWire,nextPeer){
      view=nextView;rack=nextRack;dev=nextDev;wire=nextWire;peer=nextPeer;
      const ids=new Set(rack?[rack.id]:[]);
      if(wire){ids.add(wire.from.rackId);ids.add(wire.to.rackId);}
      updateActive(ids);wires();tray.visible=view==='room'||(view==='cable'&&wire?.from.rackId!==wire?.to.rackId);
      for(const a of active.values())for(const s of a.shelves){
        const selected=s.item.id===dev?.id||s.item.id===peer?.deviceId;
        s.sel.visible=selected;s.body.material=mat(selected?'#3f8f95':'#455a66');
        if(selected){s.face.material=skin(kindOf(s.item));}
      }
      frameTarget();oldFocus=view;queue();
    }
    const visible=(x,y)=>x>=8&&x<width-8&&y>32&&y<height-22;
    function project(p){
      const q=p.clone().project(camera);return {x:(q.x+1)*width/2,y:(1-q.y)*height/2,z:q.z};
    }
    function positionLabels(){
      const occupied=[];
      for(const p of pins){
        const q=project(v(p.r.x,p.r.h+.10,p.r.z)),ok=view==='room'&&q.z<1&&q.z>-1&&visible(q.x,q.y)&&occupied.every(a=>Math.abs(a.x-q.x)>52||Math.abs(a.y-q.y)>25);
        p.el.hidden=!ok;if(ok){p.el.style.left=q.x+'px';p.el.style.top=q.y+'px';occupied.push(q);}
      }
      const labels=[];
      for(const [i,m] of markers.entries()){
        const q=project(m.at);
        m.el.hidden=!visible(q.x,q.y)||q.z>=1||q.z< -1;if(m.el.hidden)continue;
        const half=m.el.offsetWidth/2+3,ht=m.el.offsetHeight/2+2;
        const x=limits(q.x,half+2,width-half-2);
        const y=[i?18:-18,i?-18:18,-39,39,-63,63].map(d=>limits(q.y+d,44,height-29))
          .find(c=>labels.every(a=>Math.abs(c-a.y)>ht+a.ht||Math.abs(x-a.x)>a.half+half))??limits(q.y+18,44,height-29);
        m.el.style.left=x+'px';m.el.style.top=y+'px';labels.push({x,y,half,ht});
      }
    }
    // Perspective canvas fallback uses the same metre coordinates, hinges, transforms and picking meshes.
    function software(){
      const ratio=Math.min(1.6,devicePixelRatio||1),surface=ctx.canvas;
      if(surface.width!==Math.round(width*ratio)||surface.height!==Math.round(height*ratio)){
        surface.width=Math.round(width*ratio);surface.height=Math.round(height*ratio);
      }
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);scene.updateMatrixWorld(true);
      const faces=[],tmp=new T.Color(),eye=camera.position;
      const indices=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];
      function cuboid(corners,tint,alpha=1,texture=null){
        const q=corners.map(project);
        if(q.every(p=>p.x<0)||q.every(p=>p.x>width)||q.every(p=>p.y<0)||q.every(p=>p.y>height))return;
        for(const outward of indices){
          const ids=[...outward].reverse();
          const points=ids.map(i=>q[i]);if(points.some(p=>p.z>1||p.z< -1))continue;
          const first=corners[ids[0]],n=corners[ids[1]].clone().sub(first).cross(corners[ids[2]].clone().sub(first)).normalize();
          if(n.dot(eye.clone().sub(first))<=0)continue;
          const lum=.68+.31*Math.max(0,n.y)+.17*Math.max(0,n.z);
          tmp.set(tint).multiplyScalar(lum);const f={points,tint:tmp.getStyle(),z:points.reduce((s,p)=>s+p.z,0)/4,alpha};
          if(texture&&(outward===indices[0]||outward===indices[1])){
            f.image=texture;f.uv=(outward===indices[0]?[3,2,1]:[6,7,4]).map(i=>q[i]);
          }
          faces.push(f);
        }
      }
      const basis=[];for(const z of [-.5,.5])for(const y of [-.5,.5])for(const x of [-.5,.5])basis.push(v(x,y,z));
      function mesh(o){let tint=o.material.color;if(o.material===floorMat)tint='#435a67';else if(o.material.map)tint=o.userData.device?(o.userData.device.includes('stor')?'#74a49d':'#917da8'):'#4c6272';cuboid(basis.map(p=>p.clone().applyMatrix4(o.matrixWorld)),tint,1,o.material===floorMat?null:o.material.map?.image);}
      for(const o of softScene)mesh(o);
      if(tray.visible)for(const o of fallbackTray)mesh(o);
      for(const r of racks){
        if(active.has(r.id))continue;
        if(active.size&&r.x!==rack?.x&&r.z!==rack?.z)continue;
        cuboid(basis.map(p=>v(r.x+p.x*r.w,r.h/2+p.y*r.h,r.z+p.z*r.d)),roleTint(r),active.size ? .12 : 1);
      }
      for(const group of active.values()){
        for(const o of group.soft)mesh(o);
        for(const s of group.shelves)if(s.sel.visible)for(const o of s.sel.children)mesh(o);
      }
      faces.sort((a,b)=>b.z-a.z);ctx.lineWidth=.55;
      for(const f of faces){
        ctx.globalAlpha=f.alpha;ctx.fillStyle=f.tint;ctx.strokeStyle='#253d4c';ctx.beginPath();
        f.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();
        if(f.uv&&f.image){
          const [a,b,c]=f.uv,img=f.image;ctx.save();ctx.clip();
          ctx.transform((b.x-a.x)/img.width,(b.y-a.y)/img.width,(c.x-a.x)/img.height,(c.y-a.y)/img.height,a.x,a.y);ctx.drawImage(img,0,0);ctx.restore();
        }
      }
      ctx.globalAlpha=1;ctx.lineJoin='round';
      for(const {pts,accent} of wirePaths){
        ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.beginPath();pts.map(project).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
      }
    }
    function queue(){if(!frame&&!dead&&intersect&&!document.hidden)frame=requestAnimationFrame(draw);}
    let last=0;
    function draw(now){
      frame=0;if(dead)return;const dt=Math.min(.05,Math.max(.001,(now-last)/1000));last=now;
      let animate=false;
      if(destination){
        const t=1-Math.exp(-dt*8.5);
        camera.position.lerp(destination.p,t);controls.target.lerp(destination.t,t);
        if(camera.position.distanceTo(destination.p)+controls.target.distanceTo(destination.t)<.003){camera.position.copy(destination.p);controls.target.copy(destination.t);destination=null;}else animate=true;
      }
      for(const a of active.values()){
        a.progress=reduced.matches?1:Math.min(1,a.progress+dt*1.9);
        a.hinge.rotation.y=-a.progress*a.progress*(3-2*a.progress)*Math.PI*.65;if(a.progress<1)animate=true;
      }
      controls.update();camera.updateMatrixWorld();
      if(renderer&&!lostCanvas)renderer.render(scene,camera);else software();positionLabels();if(animate)queue();
    }
    function size(){
      width=stage.clientWidth||640;height=stage.clientHeight||380;
      camera.aspect=width/height;camera.updateProjectionMatrix();renderer?.setSize(width,height,false);
      if(oldFocus)frameTarget();queue();
    }
    const ro=new ResizeObserver(size);ro.observe(stage);size();
    const io=new IntersectionObserver(([e])=>{intersect=e.isIntersecting;if(intersect)queue();},{rootMargin:'80px'});io.observe(stage);
    function lost(e){
      if(dead||lostCanvas)return;e.preventDefault();
      lostCanvas=make('canvas','c3-backup');lostCanvas.setAttribute('aria-hidden','true');canvas.after(lostCanvas);
      ctx=lostCanvas.getContext('2d');stage.dataset.cabEngine='canvas3d';queue();
    }
    function restored(){
      if(!lostCanvas)return;lostCanvas.remove();lostCanvas=null;ctx=null;stage.dataset.cabEngine='webgl';queue();
    }
    if(renderer){canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);}
    const onVisibility=()=>{if(!document.hidden)queue();};document.addEventListener('visibilitychange',onVisibility);
    controls.addEventListener('start',()=>{destination=null;});controls.addEventListener('change',queue);
    const caster=new T.Raycaster(),mouse=new T.Vector2();
    const down=e=>{if(e.isPrimary)pickedStart=[e.clientX,e.clientY];};
    const upEvent=e=>{
      if(!e.isPrimary||!pickedStart||Math.hypot(e.clientX-pickedStart[0],e.clientY-pickedStart[1])>7){pickedStart=null;return;}
      pickedStart=null;const bounds=canvas.getBoundingClientRect();
      mouse.set((e.clientX-bounds.left)/bounds.width*2-1,1-(e.clientY-bounds.top)/bounds.height*2);caster.setFromCamera(mouse,camera);scene.updateMatrixWorld(true);
      const local=[...active.values()].map(a=>a.g),hits=caster.intersectObjects([...pickWires,...local],true);
      for(const hit of hits){
        const p=hit.object.userData.pick;if(!p)continue;
        if(p.device){selectDevice(p.device);return;}if(p.wire){showCable(p.wire);return;}if(p.rack){if(view==='room')openRack(p.rack);return;}
      }
      const hit=caster.intersectObject(groups[0].im).find(k=>racks[k.instanceId]);
      if(hit)openRack(racks[hit.instanceId].id);
    };
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerup',upEvent);
    canvas.addEventListener('pointercancel',()=>{pickedStart=null;});
    function dispose(){
      dead=true;cancelAnimationFrame(frame);controls.dispose();ro.disconnect();io.disconnect();
      document.removeEventListener('visibilitychange',onVisibility);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',upEvent);
      for(const b of staticBatches)b.dispose();for(const g of groups){g.im.dispose();g.im.material.dispose();}for(const g of ownedGeometry)g.dispose();for(const m of materials.values())m.dispose();for(const t of textures.values())t.dispose();
      canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);lostCanvas?.remove();
      renderer?.dispose();renderer?.forceContextLoss();
    }
    return {selection,dispose};
  }
  window.GridAidcCabinetScene=Object.freeze({mount});
})();
