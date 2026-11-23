const nvidiaHardware='https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html';
const digits=n=>String(n).padStart(2,'0');
const elem=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
function limit(n,max){return Math.min(Math.max(1,Math.trunc(Number(n))||1),Math.max(1,max));}
function count(n,max){return Number.isFinite(Number(n))?Math.min(max,Math.max(0,Math.trunc(Number(n)))):0;}
function node(kind,title,caption){return {kind,title,caption};}

export function mountFabric(host){
  const scope=elem('div','fb-panel');host.replaceChildren(scope);
  const titlebar=elem('div','fb-titlebar'),heading=elem('div'),title=elem('h3','', 'GPU 通信路径'),profileText=elem('p','fb-profile');
  heading.append(title,profileText);
  const play=elem('button','fb-play');play.type='button';titlebar.append(heading,play);scope.append(titlebar);
  const body=elem('div','fb-body'),tools=elem('div','fb-tools'),modes=elem('div','fb-modes');
  modes.setAttribute('role','group');modes.setAttribute('aria-label','选择通信场景');
  tools.append(modes);body.append(tools);
  const ends=elem('div','fb-ends'),fields=[];
  for(let i=0;i<2;i++){
    const group=elem('div','fb-end'),label=elem('span','fb-end-role',i?'终点':'起点');
    const name=elem('span','fb-rack-name'),head=elem('div','fb-end-head');
    const unit=elem('select'),gpu=elem('select');
    unit.setAttribute('aria-label',(i?'终点':'起点')+'托盘或服务器');gpu.setAttribute('aria-label',(i?'终点':'起点')+' GPU');
    const selectors=elem('div','fb-selectors');selectors.append(unit,gpu);head.append(label,name);group.append(head,selectors);
    ends.append(group);fields.push({group,name,unit,gpu});
  }
  body.append(ends);
  const diagram=elem('div','fb-diagram'),route=elem('ol','fb-route');
  route.setAttribute('aria-label','单向逻辑通信路径');diagram.append(route);
  const footer=elem('div','fb-foot'),note=elem('p','fb-note'),manual=elem('a','fb-source','NVIDIA DGX 硬件手册 ↗');
  manual.href=nvidiaHardware;manual.target='_blank';manual.rel='noopener noreferrer';footer.append(note,manual);
  const empty=elem('p','fb-empty','当前方案没有可选择的 GPU。增加服务器及 GPU 卡后即可查看路径。');
  scope.append(body,diagram,footer,empty);
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let active=false,paused=false,desiredMotion=!media.matches,outside=false,profile='',units=0,per=0,contextKey='',disposed=false;
  let source={u:1,g:1},target={u:1,g:1};
  const modeButtons=new Map();
  for(const key of ['near','far','outside']){
    const button=elem('button');button.type='button';button.dataset.fbMode=key;
    button.addEventListener('click',()=>switchMode(key));modes.append(button);modeButtons.set(key,button);
  }
  const gb=()=>profile==='gb200'||profile==='gb300';
  const family=()=>profile==='gb300'?'GB300':'GB200';
  const unitName=()=>gb()?'托盘':'服务器';
  const identical=()=>!outside&&source.u===target.u&&source.g===target.g;
  const different=(n,max)=>n<max?n+1:1;
  function switchMode(key){
    if(!active||!units||!per)return;
    outside=key==='outside';
    if(key==='near'){target.u=source.u;if(target.g===source.g&&per>1)target.g=different(source.g,per);}
    else if(key==='far'&&units>1){if(target.u===source.u)target.u=different(source.u,units);}
    refresh();
  }
  function options(select,total,prefix,selected){
    const identity=total+'|'+prefix;
    if(select.dataset.shape!==identity){
      select.dataset.shape=identity;const fragment=document.createDocumentFragment();
      for(let n=1;n<=total;n++){const o=elem('option','',prefix+' '+digits(n));o.value=String(n);fragment.append(o);}
      select.replaceChildren(fragment);
    }
    select.value=String(selected);
  }
  fields.forEach((f,i)=>{
    for(const [el,key] of [[f.unit,'u'],[f.gpu,'g']])el.addEventListener('change',()=>{
      if(!active)return;(i?target:source)[key]=Number(el.value);refresh();
    });
  });
  function playback(){
    const supported=active&&units>0&&per>0&&!identical()&&!media.matches;
    const moving=supported&&!paused&&desiredMotion&&!document.hidden;
    scope.dataset.moving=String(moving);play.disabled=!supported;
    play.textContent=media.matches?'静态显示':moving?'暂停流向':'播放流向';
    play.setAttribute('aria-pressed',String(moving));
  }
  play.addEventListener('click',()=>{if(play.disabled)return;desiredMotion=!desiredMotion;paused=false;playback();});
  const mediaChange=()=>{if(media.matches)desiredMotion=false;playback();};
  media.addEventListener?.('change',mediaChange);document.addEventListener('visibilitychange',playback);
  function gpuNode(a,side){
    const rack=outside?(side?'对端柜':'本柜'):'本柜';
    return node('gpu','GPU '+digits(a.g),rack+' · '+unitName()+' '+digits(a.u));
  }
  function routeData(){
    const src=gpuNode(source,0),dst=gpuNode(target,1);
    if(identical())return {nodes:[src],note:'起点与终点是同一颗 GPU，本次选择无需经过互联链路。'};
    if(outside)return {
      nodes:[src,node('nic','集群网卡','本柜计算节点'),node('network','集群网络','柜间通信域'),node('nic','集群网卡','对端计算节点'),dst],
      note:(gb()?'NVL72 的 72 颗 GPU 属于柜内 NVLink 域。跨柜通信经集群网卡进入集群网络。':'跨柜场景按两侧服务器经网卡接入集群网络演示。')+' 对端按同型参考柜展示，实际网卡绑定和交换路径以部署拓扑为准。'
    };
    if(gb()){
      const same=source.u===target.u;
      return {nodes:[src,node('fabric',same?'NVLink 互联域':'NVSwitch 互联','柜内 NVLink fabric'),dst],note:same?
        '两颗 GPU 位于同一计算托盘，同属柜内 NVLink 域。图中按逻辑域表示两端的通信关系。':
        '两颗 GPU 分属不同计算托盘。DGX '+family()+' 通过托盘后部的 NVLink 连接器及 NVSwitch 交换托盘实现柜内互联。'};
    }
    if(source.u===target.u)return {nodes:[src,node('io','服务器内 I/O','PCIe 拓扑相关'),dst],
      note:'两张参考卡各含一颗 GPU。同机传输方式取决于 PCIe 拓扑、驱动及对等访问支持，可能涉及主机内存中转。'};
    return {nodes:[src,node('nic','本端 I/O','服务器 '+digits(source.u)),node('network','节点间网络','柜内跨服务器'),node('nic','对端 I/O','服务器 '+digits(target.u)),dst],
      note:'两颗 GPU 分属不同服务器，此处按节点间网络通信的方案演示。实际数据搬运方式和网卡位置由服务器配置决定。'};
  }
  function drawNodes(data){
    route.replaceChildren();
    data.nodes.forEach((n,i)=>{
      const item=elem('li','fb-node fb-'+n.kind);
      if(i===0)item.classList.add('fb-from');else if(i===data.nodes.length-1)item.classList.add('fb-to');
      const glyph=elem('span','fb-glyph'),inner=elem('i');glyph.setAttribute('aria-hidden','true');glyph.append(inner);
      const labels=elem('span','fb-node-text');labels.append(elem('b','',n.title),elem('small','',n.caption));
      item.append(glyph,labels);
      if(i<data.nodes.length-1){
        const line=elem('span','fb-link'),pulse=elem('i');line.setAttribute('aria-hidden','true');
        pulse.style.animationDelay=(-i*.43)+'s';line.append(pulse);item.append(line);
      }
      route.append(item);
    });
    diagram.setAttribute('aria-label',data.nodes.map(n=>n.caption+' '+n.title).join(' → '));
    note.textContent=data.note;
  }
  function refresh(){
    const enough=units>0&&per>0;empty.hidden=enough;diagram.hidden=!enough;body.hidden=!enough;footer.hidden=!enough;
    if(!active||!enough){playback();return;}
    profileText.textContent=gb()?'DGX '+family()+' NVL72 · 18 托盘 × 4 GPU':'PCIe 风冷参考柜 · '+units+' 台服务器 × '+per+' 卡 · 每卡 1 GPU';
    const unit=unitName();
    fields.forEach((f,i)=>{const a=i?target:source;f.name.textContent=i&&outside?'对端同型柜':'本柜';options(f.unit,units,unit,a.u);options(f.gpu,per,'GPU',a.g);});
    const names={near:'同'+unit,far:'跨'+unit,outside:'跨机柜'};
    const scopeKey=outside?'outside':source.u===target.u?'near':'far';
    for(const [k,b] of modeButtons){b.textContent=names[k];b.disabled=k==='far'&&units<=1;b.setAttribute('aria-pressed',String(k===scopeKey));}
    manual.hidden=!gb();drawNodes(routeData());playback();
  }
  function update(s={}){
    if(disposed)return;
    active=s.category==='rack';host.hidden=!active;
    if(!active){paused=true;playback();return;}
    paused=false;
    const next=['gb200','gb300'].includes(s.profile)?s.profile:'pcie',changed=profile!==next;profile=next;
    units=gb()?18:count(s.servers,10);per=gb()?4:count(s.cards,4);
    const selectedUnit=limit(s.unit,units),selectedGpu=limit(s.gpu,per);
    const key=[profile,selectedUnit,selectedGpu].join('|');
    if(changed||contextKey!==key)source={u:selectedUnit,g:selectedGpu};
    contextKey=key;
    source={u:limit(source.u,units),g:limit(source.g,per)};
    if(changed){outside=units*per===1;target={u:units>1?different(source.u,units):source.u,g:per>1&&units<=1?different(source.g,per):source.g};}
    target={u:limit(target.u,units),g:limit(target.g,per)};
    profileText.textContent=gb()?'DGX '+family()+' NVL72':'PCIe 风冷参考柜';refresh();
  }
  host.hidden=true;
  return {update,pause(){paused=true;playback();},destroy(){disposed=true;media.removeEventListener?.('change',mediaChange);document.removeEventListener('visibilitychange',playback);scope.remove();host.hidden=true;}};
}
