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
// Only inputs used to construct physical meshes belong in the model cache key.
function modelKey(s){
  const cat=s.category;
  if(cat==='rack'){
    const pcie=s.profile==='pcie';
    if(s.level==='rack')return [cat,s.level,s.profile,s.unit,pcie?s.servers:0,pcie?s.cards:0].join('/');
    if(s.level==='tray')return [cat,s.level,s.profile,s.unit,pcie?s.cards:0].join('/');
    return [cat,s.level,s.profile,s.gpu].join('/');
  }
  if(cat==='ups')return cat+'/'+s.condition;
  return [cat,s.operating,s.profile,s.architecture].join('/');
}
export function createViewer(host,{onPick,onEngine}={}){
  let canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','设备三维模型，拖动旋转，方向键调整视角，回车选择部件');host.replaceChildren(canvas);
  const badge=document.createElement('span');badge.className='eq-callout';badge.hidden=true;host.append(badge);
  const hover=document.createElement('span');hover.className='eq-hover';hover.hidden=true;host.append(hover);
  let names={},lastHover=0,shadowDirty=true,badgeWidth=84;
  let enabled=true,pending=null,shownKey=null;
  const recent=new Map(),proxyMeshes=new WeakMap();
  let fullResolution=true,cameraFrameTime=0;
  function setProxyGeometry(m,useProxy){
    if(!lowPowerGPU)return;
    let entries=proxyMeshes.get(m);
    if(!entries){
      entries=[];
      m.root.traverse(o=>{if(o.isMesh&&o.geometry.userData.compat)entries.push([o,o.geometry]);});
      proxyMeshes.set(m,entries);
    }
    for(const [mesh,detailed] of entries)mesh.geometry=useProxy?detailed.userData.compat:detailed;
  }
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let gl,soft,lowPowerGPU=false,shadowPad,grid,last=0,frame=0,visible=true,dead=false,dirty=true,model,state,selection,phase=0,load=.8,playing=!reduced.matches,orbit=false;
  let split=0,splitTarget=0,targetView,width=1,height=1,startPoint,accum=0,activeFrames=10;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.03,120);
  const stage=new T.Group();scene.add(stage);
  let contact,contactTexture;
  const dprLimit=()=>lowPowerGPU ? (fullResolution ? .84 : .64) : Math.min(devicePixelRatio||1,innerWidth<660?1.5:1.65);
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
  function queue(){dirty=true;activeFrames=Math.max(activeFrames,4);if(enabled&&!dead&&visible&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);}
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
  function moveTo(wanted){
    targetView=wanted;
    cameraFrameTime=performance.now();
  }
  function fit(instant=false){
    const wanted=view();if(!wanted)return;
    if(instant||reduced.matches){camera.position.copy(wanted.eye);controls.target.copy(wanted.look);controls.update();targetView=null;}
    else moveTo(wanted);
    queue();
  }
  function resize(){
    const bounds=host.getBoundingClientRect();if(bounds.width<2||bounds.height<2)return;
    if(width===bounds.width&&height===bounds.height&&(!gl||gl.getPixelRatio()===dprLimit()))return;
    const portraitChanged=(width/height<.95)!==(bounds.width/bounds.height<.95);
    width=bounds.width;height=bounds.height;camera.aspect=width/height;camera.updateProjectionMatrix();
    if(gl)gl.setDrawingBufferSize(width,height,dprLimit());
    if(portraitChanged&&model&&!pending)fit(reduced.matches);queue();
  }
  const observer=new ResizeObserver(resize);observer.observe(host);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=0;queue();}else{cancelAnimationFrame(frame);frame=0;}});
  intersection.observe(host);
  const signals=new AbortController(),listen={signal:signals.signal};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=0;queue();}},listen);
  reduced.addEventListener('change',()=>{if(reduced.matches){orbit=false;playing=false;if(targetView){camera.position.copy(targetView.eye);controls.target.copy(targetView.look);controls.update();targetView=null;}split=splitTarget;}queue();},listen);
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
    if(pending||!model||e.pointerType!=='mouse'||e.buttons||startPoint||performance.now()-lastHover<65)return;
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
    if(pending||!model||!startPoint||Math.hypot(e.clientX-startPoint[0],e.clientY-startPoint[1])>5){startPoint=null;return;}startPoint=null;
    const key=pickAt(e);if(key)onPick?.(key);
  },listen);
  canvas.addEventListener('keydown',e=>{
    if(pending||!model)return;
    if(e.key==='Enter'){onPick?.(selection||(state.category==='rack'?'unit-1':'frame'));return;}
    if(e.key==='Home'){fit();e.preventDefault();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;
    const sph=new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(e.key==='ArrowLeft')sph.theta-=.13;if(e.key==='ArrowRight')sph.theta+=.13;
    if(e.key==='ArrowUp')sph.phi-=.1;if(e.key==='ArrowDown')sph.phi+=.1;sph.phi=limited(sph.phi,.1,controls.maxPolarAngle);
    if(e.key==='+'||e.key==='=')sph.radius/=1.15;if(e.key==='-')sph.radius*=1.15;
    moveTo({look:controls.target.clone(),eye:vec().setFromSpherical(sph).add(controls.target)});e.preventDefault();queue();
  },listen);
  let labelAnchor=null;
  function setSelected(key,displayLabel,{focus=false}={}){
    if(pending){pending.part={key,displayLabel,focus};return;}
    if(!focus&&key===selection&&labelAnchor&&(!displayLabel||displayLabel===badge.textContent))return;
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
          moveTo({look,eye:look.clone().addScaledVector(axis,limited(baseDist*(.50+.50*ratio),controls.minDistance,controls.maxDistance))});
          if(reduced.matches){camera.position.copy(targetView.eye);controls.target.copy(look);controls.update();targetView=null;}
        }
      }
    }
    queue();
  }
  function activatePending(){
    const request=pending;
    pending=null;
    const first=!model,previous=state;
    const swap=request.key!==shownKey;
    if(swap){
      let next=recent.get(request.key);
      if(next)recent.delete(request.key);
      else next=buildModel(request.state);
      if(model){
        stage.remove(model.root);
        recent.set(shownKey,model);
      }
      model=next;shownKey=request.key;
      const capacity=lowPowerGPU||soft?2:3;
      while(recent.size>capacity){
        const [oldest,evicted]=recent.entries().next().value;
        recent.delete(oldest);
        evicted.dispose();
      }
      model.root.position.y=0;
      model.root.scale.setScalar(1);
      model.tick(phase,split,load);
      stage.add(model.root);
      selection=null;labelAnchor=null;shadowDirty=true;
      if(!request.part)model.select(null);
      if(contact){contact.position.set(model.center.x,-.012,model.center.z);contact.scale.set(model.size.x*1.75,model.size.z*1.7,1);}
    }
    state=request.state;
    const changedScale=first||state.category!==previous.category||state.level!==previous.level||state.profile!==previous.profile;
    if(changedScale){
      autoZoomFactor=1;
      // Interpolate from the visible pose, including when another switch interrupts the camera.
      fit(first||reduced.matches);
    }
    if(request.part)setSelected(request.part.key,request.part.displayLabel,{focus:request.part.focus});
    if(request.camera)restoreCamera(request.camera,first);
    clearHover();
  }
  function restoreCamera(saved,instant=false){
    const eye=vec().fromArray(saved.eye),look=vec().fromArray(saved.look);
    if(instant||reduced.matches){camera.position.copy(eye);controls.target.copy(look);controls.update();targetView=null;}
    else moveTo({eye,look});
    queue();
  }
  function updateBadge(){
    const part=model?.parts.get(selection);if(!part||!labelAnchor)return;
    const p=part.localToWorld(labelAnchor.clone()).project(camera),x=(p.x*.5+.5)*width,y=(.5-p.y*.5)*height;
    if(x<6||x>width-6||y<8||y>height-8){badge.hidden=true;return;}
    badge.hidden=false;badge.style.left=limited(x+14,8,width-badgeWidth-8)+'px';badge.style.top=limited(y-25,7,height-28)+'px';
  }
  function tick(now){
    frame=0;if(!enabled||dead||document.hidden||!visible||(!model&&!pending))return;
    const switched=Boolean(pending);
    if(switched)activatePending();
    const delta=last?Math.min(.10,(now-last)/1000):0;last=now;accum+=delta;
    const continuous=playing&&load>0&&model.hasFlow&&!reduced.matches;
    const moving=targetView||Math.abs(split-splitTarget)>.001||orbit||activeFrames>0;
    const interval=soft||lowPowerGPU?(moving?1/24:1/12):(moving?1/55:1/28);
    if(switched||accum>=interval||!delta){
      const dt=Math.min(.12,accum);accum=0;
      // Use elapsed wall time so a slow GPU does not stretch a short camera move over several seconds.
      const cameraDt=cameraFrameTime?Math.max(0,(now-cameraFrameTime)/1000):1/60;
      cameraFrameTime=now;
      if(targetView){const blend=reduced.matches||cameraDt>.32?1:1-Math.exp(-cameraDt*13);camera.position.lerp(targetView.eye,blend);controls.target.lerp(targetView.look,blend);if(camera.position.distanceToSquared(targetView.eye)<1e-5&&controls.target.distanceToSquared(targetView.look)<1e-5)targetView=null;}
      if(orbit&&!reduced.matches){const off=camera.position.clone().sub(controls.target);off.applyAxisAngle(vec(0,1,0),dt*.22);camera.position.copy(controls.target).add(off);}
      const previous=split;split+= (splitTarget-split)*(reduced.matches?1:1-Math.exp(-dt*10));if(Math.abs(split-splitTarget)<.001)split=splitTarget;
      if(continuous)phase+=dt*(.2+.8*load);
      if(lowPowerGPU&&gl){
        const detailedNow=!orbit&&!targetView&&split===splitTarget;
        if(detailedNow!==fullResolution){
          fullResolution=detailedNow;
          gl.setDrawingBufferSize(width,height,dprLimit());
        }
        // Simplify rounded edges only while travelling. The settled close-up uses the authored meshes.
        const useProxy=!detailedNow;
        if(switched||model.root.userData.proxyView!==useProxy){
          setProxyGeometry(model,useProxy);model.root.userData.proxyView=useProxy;
        }
      }
      model.tick(phase,split,load);controls.update();scene.updateMatrixWorld(true);camera.updateMatrixWorld();updateBadge();
      if(gl){if(previous!==split||shadowDirty)gl.shadowMap.needsUpdate=true;gl.render(scene,camera);shadowDirty=false;}else soft.draw(model,camera,width,height);
      activeFrames=Math.max(0,activeFrames-1);dirty=false;
    }
    if(!frame&&(continuous||moving||activeFrames>0||dirty))frame=requestAnimationFrame(tick);
  }
  resize();
  return {
    show(next){
      const key=modelKey(next);
      if(pending?.key===key){pending.state={...next};return;}
      if(!pending&&shownKey===key){state={...next};return;}
      // Keep the last rendered image in place until the newest request is ready for this frame.
      pending={key,state:{...next}};
      clearHover();badge.hidden=true;
      queue();
    },
    setActive(value){
      enabled=Boolean(value);
      if(enabled){last=0;queue();}
      else{cancelAnimationFrame(frame);frame=0;clearHover();}
    },
    select:setSelected,
    setLabels(next){names=next||{};},
    captureView(){
      if(pending)return pending.camera||null;
      return model?{eye:camera.position.toArray(),look:controls.target.toArray()}:null;
    },
    restoreView(saved){
      if(!saved||![saved.eye,saved.look].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))return;
      if(pending)pending.camera=saved;else restoreCamera(saved);
    },
    setExplode(value){const next=limited(Number(value)||0,0,1);if(next!==splitTarget){splitTarget=next;queue();}},
    setLoad(value){const next=limited(Number(value)||0,0,1);if(next!==load){load=next;queue();}},
    setPlaying(value){if(playing!==Boolean(value)){playing=Boolean(value);queue();}},
    setOrbit(value){if(orbit!==Boolean(value)){orbit=Boolean(value);queue();}},
    zoomBy(f){if(!Number.isFinite(f)||f<=0)return;const dir=camera.position.clone().sub(controls.target);const dist=limited(dir.length()/f,controls.minDistance,controls.maxDistance);moveTo({look:controls.target.clone(),eye:controls.target.clone().addScaledVector(dir.normalize(),dist)});queue();},
    reset(){autoZoomFactor=1;fit();},
    destroy(){dead=true;cancelAnimationFrame(frame);controls.dispose();signals.abort();observer.disconnect();intersection.disconnect();pending=null;model?.dispose();for(const item of recent.values())item.dispose();recent.clear();contactTexture?.dispose();contact?.geometry.dispose();contact?.material.dispose();shadowPad?.geometry.dispose();shadowPad?.material.dispose();grid?.geometry.dispose();grid?.material.dispose();if(initialRenderer){initialRenderer.dispose();if(gl)gl.forceContextLoss();}host.replaceChildren();}
  };
}
