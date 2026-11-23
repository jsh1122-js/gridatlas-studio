import * as T from './vendor/three.module.min.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {buildModel} from './models.js';

// The studio reflections were prefiltered from Three's RoomEnvironment at a 64 px face size.
let studioLight;
export const studioReady=fetch(new URL('./studio-light.bin',import.meta.url)).then(async response=>{
  if(!response.ok)return;
  const raw=await response.arrayBuffer(),header=new DataView(raw);
  const width=header.getUint16(0,true),height=header.getUint16(2,true);
  if(width!==336||height!==256||raw.byteLength!==4+width*height*6)return;
  const rgb=new Uint16Array(raw,4),rgba=new Uint16Array(width*height*4);
  for(let src=0,dst=0;src<rgb.length;src+=3,dst+=4){
    rgba[dst]=rgb[src];rgba[dst+1]=rgb[src+1];rgba[dst+2]=rgb[src+2];rgba[dst+3]=0x3c00;
  }
  studioLight=new T.DataTexture(rgba,width,height,T.RGBAFormat,T.HalfFloatType);
  studioLight.mapping=T.CubeUVReflectionMapping;studioLight.colorSpace=T.LinearSRGBColorSpace;
  studioLight.magFilter=studioLight.minFilter=T.LinearFilter;studioLight.needsUpdate=true;
}).catch(()=>{});
const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const limited=(n,lo,hi)=>Math.max(lo, Math.min(hi,n));
const labels={frame:'设备框架',fabric:'互联与交换',power:'电源架',cooling:'冷却组件',cpu:'处理器',substrate:'封装基板',package:'GPU 封装',thermal:'散热组件',rectifier:'整流模块',inverter:'逆变模块',battery:'蓄电池组',bypass:'旁路',input:'电源输入',output:'交流输出',plates:'芯片冷板',supply:'二次侧供液',return:'二次侧回液',primary:'一次侧接口',cdu:'CDU 换热器',coil:'换热盘管',fan:'循环风机',cold:'送风',hot:'回风',rack:'IT 机柜'};
const powerLabels={highSide:'高压侧端子',lowSide:'低压侧端子',windPrimary:'一次绕组',windSecondary:'二次绕组',core:'叠片铁芯',incoming:'交流进线',busbar:'中压母线',gasTank:'气体绝缘隔室',breaker:'馈线断路器',cable:'出线电缆',frontEnd:'整流模块',isolation:'隔离变换',dcBus:'直流母线',rackDc:'机架侧 DC/DC',storage:'电池支路',feeder:'直流馈线',hbm:'HBM3e 显存'};
function label(key,state) {
  if(state?.category==='sst'&&state.operating==='conventional'){
    if(key==='frontEnd')return '工频变压器';
    if(key==='isolation')return '集中整流';
  }
  if(state?.category==='sst'&&key==='frontEnd')return '有源整流';
  if(powerLabels[key])return powerLabels[key];
  if(key?.startsWith('unit-'))return '计算单元 '+key.slice(5).padStart(2,'0');
  if(key?.startsWith('gpu-'))return 'GPU '+key.slice(4).padStart(2,'0');
  return labels[key];
}
function softwareView(canvas){
  const ctx=canvas.getContext('2d'), xa=vec(),xb=vec(),xc=vec(),normal=vec(),cross=vec(),viewDir=vec(),instance=new T.Matrix4(),world=new T.Matrix4(),color=new T.Color();
  const light=vec(-.45,1,.7).normalize();
  // The same meshes, transforms and camera are projected when a WebGL context is unavailable.
  function draw(model,camera,w,h){
    const ratio=Math.min(1.5,devicePixelRatio||1);if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
    const triangles=[];model.root.updateMatrixWorld(true);camera.updateMatrixWorld();
    function project(p){p.project(camera);return [(p.x+1)*w*.5,(-p.y+1)*h*.5,p.z];}
    function object(o){
      if(!o.isMesh||!o.visible||o.material?.transparent||o.geometry.type==='PlaneGeometry')return;
      const geometry=o.geometry.userData.compat||o.geometry;const pos=geometry.attributes.position,idx=geometry.index,ls=idx?idx.count:pos.count;
      for(let j=0;j<(o.isInstancedMesh?o.count:1);j++){
        world.copy(o.matrixWorld);if(o.isInstancedMesh){o.getMatrixAt(j,instance);world.multiply(instance);}
        for(let i=0;i<ls;i+=3){
          xa.fromBufferAttribute(pos,idx?idx.getX(i):i).applyMatrix4(world);xb.fromBufferAttribute(pos,idx?idx.getX(i+1):i+1).applyMatrix4(world);xc.fromBufferAttribute(pos,idx?idx.getX(i+2):i+2).applyMatrix4(world);
          normal.copy(xb).sub(xa).cross(cross.copy(xc).sub(xa)).normalize();viewDir.copy(camera.position).sub(xa).normalize();if(normal.dot(viewDir)<.01)continue;
          const lum=.50+.48*Math.max(0,normal.dot(light))+.18*Math.pow(1-Math.max(0,normal.dot(viewDir)),3);
          color.copy(o.material.color).multiplyScalar(lum);const fill=color.getStyle();
          const a=project(xa),b=project(xb),c=project(xc);triangles.push([a,b,c,(a[2]+b[2]+c[2])/3,fill]);
        }
      }
    }
    model.root.traverseVisible(object);triangles.sort((a,b)=>b[3]-a[3]);
    for(const [a,b,c,z,fill] of triangles){ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.closePath();ctx.fill();}
  }
  return {draw};
}
export function createViewer(host,{onPick,onEngine}={}){
  let canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','设备三维模型，拖动旋转，方向键调整视角，回车选择部件');host.replaceChildren(canvas);
  const badge=document.createElement('span');badge.className='eq-callout';badge.hidden=true;host.append(badge);
  const hover=document.createElement('span');hover.className='eq-hover';hover.hidden=true;host.append(hover);
  let names={},lastHover=0,priorFrame=null,shadowDirty=true,badgeWidth=84;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let gl,soft,lowPowerGPU=false,shadowPad,grid,last=0,frame=0,visible=true,dead=false,dirty=true,model,state,selection,phase=0,load=.8,playing=!reduced.matches,orbit=false;
  let split=0,splitTarget=0,targetView,transition=1,width=1,height=1,startPoint,accum=0,activeFrames=10;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.03,120);
  const stage=new T.Group();scene.add(stage);
  let contact,contactTexture;
  const dprLimit=()=>lowPowerGPU ? .84 : Math.min(devicePixelRatio||1,innerWidth<660?1.5:1.65);
  try{
    gl=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
    const context=gl.getContext(),debugInfo=context.getExtension('WEBGL_debug_renderer_info');
    lowPowerGPU=Boolean(debugInfo && /swiftshader|llvmpipe|software rasterizer/i.test(context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)));
    gl.setPixelRatio(dprLimit());gl.setClearColor(0x101b28,0);
    gl.toneMapping=T.ACESFilmicToneMapping;gl.toneMappingExposure=1.02;
    gl.shadowMap.enabled=!lowPowerGPU;gl.shadowMap.type=T.PCFSoftShadowMap;gl.shadowMap.autoUpdate=false;
    scene.environment=studioLight||null;scene.environmentIntensity=.83;
    if(!studioLight)studioReady.then(()=>{if(!dead&&gl&&studioLight){scene.environment=studioLight;queue();}});
    const key=new T.DirectionalLight(0xffedcf,2.8);key.position.set(-4,8,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
    Object.assign(key.shadow.camera,{left:-4,right:4,top:6,bottom:-4,near:.1,far:20});key.shadow.camera.updateProjectionMatrix();key.shadow.bias=-.0006;key.shadow.normalBias=.02;scene.add(key);
    const rim=new T.DirectionalLight(0x79cfff,2.1);rim.position.set(4,4,-3);scene.add(rim,new T.HemisphereLight(0xc8e5ff,0x405468,.85));
    shadowPad=new T.Mesh(new T.PlaneGeometry(36,36),new T.ShadowMaterial({opacity:.30}));shadowPad.rotation.x=-Math.PI/2;shadowPad.position.y=-.02;shadowPad.receiveShadow=true;scene.add(shadowPad);
    grid=new T.GridHelper(24,60,0x466a79,0x315363);grid.position.y=-.025;grid.material.transparent=true;grid.material.opacity=.23;scene.add(grid);
    const pad=document.createElement('canvas');pad.width=128;pad.height=128;
    const ctx=pad.getContext('2d'),gradient=ctx.createRadialGradient(64,64,4,64,64,63);
    gradient.addColorStop(0,'rgba(0,0,0,.42)');gradient.addColorStop(.44,'rgba(0,0,0,.24)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);contactTexture=new T.CanvasTexture(pad);
    contact=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false}));
    contact.rotation.x=-Math.PI/2;scene.add(contact);
    onEngine?.('三维模型');
  }catch{
    gl?.dispose();gl=null;canvas.remove();canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','设备三维模型，拖动或方向键旋转');host.prepend(canvas);soft=softwareView(canvas);onEngine?.('兼容三维视图');
  }
  const initialRenderer=gl;
  let compatCanvas;
  if(gl)canvas.addEventListener('webglcontextlost',event=>{
    if(dead||!gl)return;
    event.preventDefault();
    compatCanvas=document.createElement('canvas');
    compatCanvas.style.cssText='position:absolute;inset:0;pointer-events:none';
    compatCanvas.setAttribute('aria-hidden','true');
    canvas.style.opacity='0';host.insertBefore(compatCanvas,badge);
    soft=softwareView(compatCanvas);gl=null;
    onEngine?.('兼容三维视图');queue();
  });
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.095;controls.enablePan=false;controls.rotateSpeed=.68;controls.zoomSpeed=.78;controls.minDistance=1.45;controls.maxDistance=24;controls.maxPolarAngle=Math.PI*.51;
  let autoZoomFactor=1;
  function queue(){dirty=true;activeFrames=Math.max(activeFrames,4);if(!dead&&visible&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);}
  controls.addEventListener('start',()=>{targetView=null;activeFrames=20;queue();});controls.addEventListener('change',queue);
  function view(){
    if(!model)return;
    const center=model.center.clone();let dir;
    if(state.category==='rack'&&state.level==='rack')dir=vec(3.3,1.55,6.7);
    else if(state.category==='rack'&&state.level==='tray')dir=vec(2.9,5.3,4.7);
    else if(state.category==='rack')dir=vec(3.1,3.8,4.9);
    else dir=vec(3.6,2.45,6.5);
    dir.normalize();
    const right=vec(0,1,0).cross(dir).normalize(),up=dir.clone().cross(right).normalize();
    const tangent=Math.tan(camera.fov*Math.PI/360);
    const half=model.size.clone().multiplyScalar(.5);
    let distance=1;
    for(const a of [-1,1])for(const b of [-1,1])for(const c of [-1,1]){
      const corner=vec(a*half.x,b*half.y,c*half.z);
      const required=Math.max(Math.abs(corner.dot(right))/(tangent*camera.aspect),Math.abs(corner.dot(up))/tangent);
      distance=Math.max(distance,corner.dot(dir)+required);
    }
    const margin=state.level==='gpu'?1.26:1.14;
    return {look:center,eye:center.clone().addScaledVector(dir,distance*margin*autoZoomFactor)};

  }
  function fit(instant=false){
    const wanted=view();if(!wanted)return;
    if(instant||reduced.matches){camera.position.copy(wanted.eye);controls.target.copy(wanted.look);controls.update();targetView=null;}
    else targetView=wanted;
    queue();
  }
  function resize(){
    const bounds=host.getBoundingClientRect();if(bounds.width<2||bounds.height<2)return;
    const portraitChanged=(width/height<.95)!==(bounds.width/bounds.height<.95);
    width=bounds.width;height=bounds.height;camera.aspect=width/height;camera.updateProjectionMatrix();
    if(gl){gl.setPixelRatio(dprLimit());gl.setSize(width,height,false);}
    if(portraitChanged&&model)fit(true);queue();
  }
  const observer=new ResizeObserver(resize);observer.observe(host);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=0;queue();}else{cancelAnimationFrame(frame);frame=0;}});
  intersection.observe(host);
  const signals=new AbortController(),listen={signal:signals.signal};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=0;queue();}},listen);
  reduced.addEventListener('change',()=>{if(reduced.matches){orbit=false;playing=false;targetView=null;transition=1;split=splitTarget;}queue();},listen);
  const ray=new T.Raycaster(),uv=new T.Vector2();
  function pickAt(e){
    const bounds=canvas.getBoundingClientRect();
    uv.set((e.clientX-bounds.left)/bounds.width*2-1,1-(e.clientY-bounds.top)/bounds.height*2);
    ray.setFromCamera(uv,camera);
    return ray.intersectObjects(model.picks,false).find(hit=>hit.object.userData.key)?.object.userData.key;
  }
  function clearHover(){hover.hidden=true;canvas.style.cursor='';}
  canvas.addEventListener('pointerleave',clearHover,listen);
  canvas.addEventListener('pointercancel',()=>{startPoint=null;clearHover();},listen);
  canvas.addEventListener('pointermove',e=>{
    if(!model||e.pointerType!=='mouse'||e.buttons||startPoint||performance.now()-lastHover<65)return;
    lastHover=performance.now();
    const key=pickAt(e),title=names[key]||label(key,state);
    if(!key||!title){clearHover();return;}
    const r=canvas.getBoundingClientRect();
    hover.textContent=title;hover.hidden=false;canvas.style.cursor='pointer';
    hover.style.left=limited(e.clientX-r.left+12,4,width-hover.offsetWidth-4)+'px';
    hover.style.top=limited(e.clientY-r.top+15,4,height-28)+'px';
  },listen);
  canvas.addEventListener('pointerdown',e=>{clearHover();startPoint=[e.clientX,e.clientY];},listen);
  canvas.addEventListener('pointerup',e=>{
    if(!model||!startPoint||Math.hypot(e.clientX-startPoint[0],e.clientY-startPoint[1])>5){startPoint=null;return;}startPoint=null;
    const key=pickAt(e);if(key)onPick?.(key);
  },listen);
  canvas.addEventListener('keydown',e=>{
    if(!model)return;
    if(e.key==='Enter'){onPick?.(selection||(state.category==='rack'?'unit-1':'frame'));return;}
    if(e.key==='Home'){fit();e.preventDefault();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;
    const sph=new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(e.key==='ArrowLeft')sph.theta-=.13;if(e.key==='ArrowRight')sph.theta+=.13;
    if(e.key==='ArrowUp')sph.phi-=.1;if(e.key==='ArrowDown')sph.phi+=.1;sph.phi=limited(sph.phi,.1,controls.maxPolarAngle);
    if(e.key==='+'||e.key==='=')sph.radius/=1.15;if(e.key==='-')sph.radius*=1.15;
    targetView={look:controls.target.clone(),eye:vec().setFromSpherical(sph).add(controls.target)};e.preventDefault();queue();
  },listen);
  let labelAnchor=null;
  function setSelected(key,displayLabel,{focus=false}={}){
    selection=key;model?.select(key);
    const part=model?.parts.get(key),name=displayLabel||names[key]||label(key,state);
    badge.hidden=!part||!name;labelAnchor=null;
    if(part&&name){
      const bb=new T.Box3().setFromObject(part);
      if(!bb.isEmpty()){
        const center=bb.getCenter(vec());
        labelAnchor=part.worldToLocal(center.clone());badge.textContent=name;badgeWidth=badge.offsetWidth||84;
        if(focus){
          const overall=view(),baseDist=overall.eye.distanceTo(overall.look);
          const ratio=limited(bb.getSize(vec()).length()/Math.max(.01,model.size.length()),0,1);
          const look=model.center.clone().lerp(center,.81);
          const axis=camera.position.clone().sub(controls.target).normalize();
          targetView={look,eye:look.clone().addScaledVector(axis,limited(baseDist*(.50+.50*ratio),controls.minDistance,controls.maxDistance))};
          if(reduced.matches){camera.position.copy(targetView.eye);controls.target.copy(look);controls.update();targetView=null;}
        }
      }
    }
    queue();
  }
  function snapshot(){
    priorFrame?.remove();priorFrame=null;
    if(reduced.matches||!model||!visible||width<2||height<2)return;
    const source=compatCanvas||canvas;
    if(gl)gl.render(scene,camera);
    const layer=document.createElement('canvas'),scale=Math.min(1,1024/source.width);
    layer.width=Math.max(1,Math.round(source.width*scale));layer.height=Math.max(1,Math.round(source.height*scale));
    layer.getContext('2d').drawImage(source,0,0,layer.width,layer.height);layer.className='eq-last-frame';
    layer.setAttribute('aria-hidden','true');host.insertBefore(layer,badge);priorFrame=layer;
  }
  function updateBadge(){
    const part=model?.parts.get(selection);if(!part||!labelAnchor)return;
    const p=part.localToWorld(labelAnchor.clone()).project(camera),x=(p.x*.5+.5)*width,y=(.5-p.y*.5)*height;
    if(x<6||x>width-6||y<8||y>height-8){badge.hidden=true;return;}
    badge.hidden=false;badge.style.left=limited(x+14,8,width-badgeWidth-8)+'px';badge.style.top=limited(y-25,7,height-28)+'px';
  }
  function tick(now){
    frame=0;if(dead||document.hidden||!visible||!model)return;
    const delta=last?Math.min(.10,(now-last)/1000):0;last=now;accum+=delta;
    const continuous=playing&&load>0&&model.hasFlow&&!reduced.matches;
    const moving=targetView||Math.abs(split-splitTarget)>.001||transition<1||orbit||activeFrames>0;
    const interval=soft||lowPowerGPU?(moving?1/24:1/12):(moving?1/55:1/28);
    if(accum>=interval||!delta){
      const dt=Math.min(.12,accum);accum=0;
      if(targetView){const blend=reduced.matches?1:1-Math.exp(-dt*8);camera.position.lerp(targetView.eye,blend);controls.target.lerp(targetView.look,blend);if(camera.position.distanceToSquared(targetView.eye)<1e-5&&controls.target.distanceToSquared(targetView.look)<1e-5)targetView=null;}
      if(orbit&&!reduced.matches){const off=camera.position.clone().sub(controls.target);off.applyAxisAngle(vec(0,1,0),dt*.22);camera.position.copy(controls.target).add(off);}
      const previous=split;split+= (splitTarget-split)*(reduced.matches?1:1-Math.exp(-dt*10));if(Math.abs(split-splitTarget)<.001)split=splitTarget;
      if(continuous)phase+=dt*(.2+.8*load);
      if(transition<1){transition=Math.min(1,transition+dt*2.4);const v=1-Math.pow(1-transition,3);model.root.position.y=-.024*(1-v);model.root.scale.setScalar(.985+.015*v);}
      model.tick(phase,split,load);controls.update();scene.updateMatrixWorld(true);camera.updateMatrixWorld();updateBadge();
      if(gl){if(previous!==split||transition<1||shadowDirty)gl.shadowMap.needsUpdate=true;gl.render(scene,camera);shadowDirty=false;}else soft.draw(model,camera,width,height);
      if(priorFrame){
        const layer=priorFrame;priorFrame=null;
        layer.animate([{opacity:1},{opacity:0}],{duration:180,easing:'ease-out',fill:'both'}).finished.then(()=>layer.remove(),()=>layer.remove());
      }
      activeFrames=Math.max(0,activeFrames-1);dirty=false;
    }
    if(!frame&&(continuous||moving||activeFrames>0||dirty))frame=requestAnimationFrame(tick);
  }
  resize();
  return {
    show(next){
      if(state&&JSON.stringify(state)===JSON.stringify(next))return;
      const first=!model,keep=state && next.category===state.category && next.level===state.level&&next.profile===state.profile;
      if(!keep)snapshot();clearHover();state={...next};shadowDirty=true;
      if(model){stage.remove(model.root);model.dispose();}
      model=buildModel(state);stage.add(model.root);transition=reduced.matches||keep?1:0;selection=null;labelAnchor=null;badge.hidden=true;
      if(contact){contact.position.set(model.center.x,-.012,model.center.z);contact.scale.set(model.size.x*1.75,model.size.z*1.7,1);}
      if(!keep){autoZoomFactor=1;fit(true);if(!first&&!reduced.matches){const dest=view();camera.position.sub(dest.look).multiplyScalar(1.065).add(dest.look);targetView=dest;}}queue();
    },
    select:setSelected,
    setLabels(next){names=next||{};},
    captureView(){return {eye:camera.position.toArray(),look:controls.target.toArray()};},
    restoreView(saved){
      if(!saved||![saved.eye,saved.look].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))return;
      camera.position.fromArray(saved.eye);controls.target.fromArray(saved.look);targetView=null;controls.update();queue();
    },
    setExplode(value){splitTarget=limited(Number(value)||0,0,1);queue();},
    setLoad(value){load=limited(Number(value)||0,0,1);queue();},
    setPlaying(value){playing=Boolean(value);queue();},
    setOrbit(value){orbit=Boolean(value);queue();},
    zoomBy(f){if(!Number.isFinite(f)||f<=0)return;const dir=camera.position.clone().sub(controls.target);const dist=limited(dir.length()/f,controls.minDistance,controls.maxDistance);targetView={look:controls.target.clone(),eye:controls.target.clone().addScaledVector(dir.normalize(),dist)};queue();},
    reset(){autoZoomFactor=1;fit();},
    destroy(){dead=true;cancelAnimationFrame(frame);controls.dispose();signals.abort();observer.disconnect();intersection.disconnect();model?.dispose();contactTexture?.dispose();contact?.geometry.dispose();contact?.material.dispose();shadowPad?.geometry.dispose();shadowPad?.material.dispose();grid?.geometry.dispose();grid?.material.dispose();if(initialRenderer){initialRenderer.dispose();if(gl)gl.forceContextLoss();}host.replaceChildren();}
  };
}
