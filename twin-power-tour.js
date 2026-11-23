((root) => {
  'use strict';
  const clamp=n=>Math.max(0,Math.min(1,n));
  const textOf=s=>String(s?.text||'');

  // Camera progress is absolute within a route segment. Aborted work cannot advance a newer run.
  function createController(callbacks={},env={}) {
    const timer=env.setTimer||setTimeout,clearTimer=env.clearTimer||clearTimeout;
    const holdMs=env.holdMs||(step=>Math.min(12000,Math.max(3200,1100+textOf(step).length*130)));
    let stops=[],index=0,fraction=0,status='idle',reason='',voice='',readIssue=false;
    let prepare=null,run=null,disposed=false;
    const getState=()=>({status,reason,index,total:stops.length,step:stops[index]||null,fraction,voice,voiceEnabled:Boolean(voice),readIssue,active:status!=='idle'});
    const emit=()=>callbacks.onChange?.(getState());
    function stopWork(why,notify=true){
      const info={reason:why,index,step:stops[index]||null,fraction};
      const p=prepare,r=run;prepare=null;run=null;
      if(p)p.abort.abort();
      if(r){
        clearTimer(r.holdTimer);r.abort.abort();r.speech?.abort();
      }
      if(notify&&(p||r))callbacks.onHalt?.(info);
      return info;
    }
    function interrupt(why='inspect'){
      if(status!=='playing'&&status!=='preparing')return;
      stopWork(why);status='paused';reason=why;emit();
    }
    function finishRun(r){
      if(run!==r||!r.arrived||!r.read||!r.held)return;
      clearTimer(r.holdTimer);run=null;
      if(r.single){status='paused';reason='step';emit();return;}
      if(index===stops.length-1){
        status='complete';reason='complete';emit();
        callbacks.onFinish?.({reason:'complete',index,step:stops[index],fraction});
      }else{index++;fraction=0;begin();}
    }
    function read(r){
      const old=r.speech;r.speech=null;old?.abort();
      r.read=!voice||!env.read||r.single;readIssue=false;
      if(r.read){finishRun(r);return;}
      const speech=new AbortController();r.speech=speech;
      const current=()=>r===run&&r.speech===speech&&!speech.signal.aborted;
      Promise.resolve().then(()=>current()?env.read(stops[index],voice,speech.signal):false)
        .then(ok=>settled(ok!==false),()=>settled(false));
      function settled(ok){
        if(!current())return;
        r.read=true;r.speech=null;readIssue=!ok;emit();finishRun(r);
      }
    }
    function begin(single=false){
      if(disposed||!stops[index])return;
      if(env.isHidden?.()){status='paused';reason='hidden';emit();return;}
      status='playing';reason='';readIssue=false;
      const step=stops[index],from=fraction,abort=new AbortController();
      const r={abort,arrived:false,held:single,read:false,single,holdTimer:null,speech:null};
      run=r;emit();if(run!==r)return;
      if(!single)r.holdTimer=timer(()=>{if(run===r){r.held=true;finishRun(r);}},holdMs(step));
      read(r);
      const onProgress=value=>{
        if(run!==r||!Number.isFinite(value))return;
        const percent=Math.round(fraction*100);
        fraction=Math.max(fraction,clamp(value));
        if(Math.round(fraction*100)!==percent)emit();
      };
      Promise.resolve().then(()=>run===r?callbacks.onTravel?.({step,index,fromFraction:from,onProgress,signal:abort.signal,reducedMotion:Boolean(env.reducedMotion?.())}):false)
        .then(arrived=>{
          if(run!==r)return;
          if(arrived===false){interrupt('unavailable');return;}
          fraction=1;r.arrived=true;emit();finishRun(r);
        },()=>{if(run===r)interrupt('unavailable');});
    }
    function prepareStart(){
      if(disposed)return Promise.resolve(false);
      if(prepare)return prepare.promise;
      stops=[];index=0;fraction=0;reason='';readIssue=false;status='preparing';
      const task={abort:new AbortController(),promise:null};
      prepare=task;
      task.promise=Promise.resolve().then(()=>prepare===task?callbacks.onPrepare?.({signal:task.abort.signal}):[])
        .then(value=>{
          if(prepare!==task)return false;
          const route=Array.isArray(value)?value:value?.stops;
          if(!Array.isArray(route)||!route.length||route.some(s=>!s||!s.key||!s.title))throw new Error('路线暂未就绪');
          prepare=null;stops=route.slice();begin();return true;
        }).catch(()=>{
          if(prepare!==task)return false;
          prepare=null;status='error';reason='unavailable';emit();return false;
        });
      emit();return task.promise;
    }
    function resume(){
      if(disposed||status!=='paused')return Promise.resolve(false);
      if(stops.length){begin();return Promise.resolve(true);}
      return prepareStart();
    }
    function start(){
      if(disposed)return Promise.resolve(false);
      if(prepare)return prepare.promise;
      if(status==='playing')return Promise.resolve(true);
      if(status==='paused')return resume();
      return prepareStart();
    }
    function restart(){
      if(prepare)return prepare.promise;
      stopWork('restart');return prepareStart();
    }
    function seek(delta){
      if(disposed||!stops.length)return;
      const next=index+delta;if(next<0||next>=stops.length)return;
      const single=status!=='playing'||Boolean(run?.single);
      stopWork('step');index=next;fraction=0;begin(single);
    }
    function setVoice(id){
      if(id===voice)return;
      voice=id||'';readIssue=false;if(run)read(run);emit();
    }
    function close(){
      if(status==='idle')return;
      const info=stopWork('close');
      stops=[];index=0;fraction=0;status='idle';reason='';readIssue=false;emit();callbacks.onFinish?.(info);
    }
    return {getState,start,pause:()=>interrupt('pause'),resume,restart,interrupt,
      next:()=>seek(1),previous:()=>seek(-1),setVoice,close,
      destroy(){if(disposed)return;disposed=true;close();}};
  }

  // Some browsers expose voices after the first gesture and some never fire an end event.
  function createNarrator(synth,makeUtterance,env={}){
    const timer=env.setTimer||setTimeout,clearTimer=env.clearTimer||clearTimeout;
    const available=Boolean(synth&&makeUtterance);
    function voices(){
      if(!available)return [];
      try{
        const seen=new Set();
        return synth.getVoices().filter(v=>/^(zh|cmn|yue)([-_]|$)/i.test(v.lang)).map(v=>({id:JSON.stringify([v.voiceURI,v.name,v.lang]),label:v.name+' · '+v.lang,voice:v}))
          .filter(v=>{if(seen.has(v.id))return false;seen.add(v.id);return true;});
      }catch{return [];}
    }
    function read(step,id,signal){
      if(!available||signal.aborted)return Promise.resolve(false);
      return new Promise(resolve=>{
        let end=false,utterance,watchdog;
        const finish=(ok,cancel=false)=>{
          if(end)return;end=true;clearTimer(watchdog);
          signal.removeEventListener('abort',aborted);
          if(utterance){utterance.onend=null;utterance.onerror=null;}
          if(cancel){try{synth.cancel();}catch{/* The browser can revoke speech access. */}}
          resolve(ok);
        };
        const aborted=()=>finish(false,true);
        try{
          const text=step.title+'。'+textOf(step),list=voices();
          const selected=list.find(v=>v.id===id)||list.find(v=>/^zh[-_]CN/i.test(v.voice.lang))||list[0];
          if(!selected){finish(false);return;}
          utterance=makeUtterance(text);utterance.lang=selected.voice.lang;utterance.voice=selected.voice;
          utterance.onend=()=>finish(true);utterance.onerror=()=>finish(false);
          signal.addEventListener('abort',aborted,{once:true});
          watchdog=timer(()=>finish(false,true),Math.min(65000,Math.max(9000,5500+text.length*430)));
          synth.speak(utterance);
        }catch{finish(false);}
      });
    }
    return {available,voices,read};
  }

  function mount(host,callbacks={}){
    const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
    const box=make('section','tpt-panel'),head=make('div','tpt-head'),heading=make('h3','','供电巡视');
    const counter=make('span','tpt-count'),stage=make('div','tpt-stage'),title=make('strong','tpt-title'),subtitle=make('p','tpt-text');
    stage.setAttribute('aria-live','polite');stage.setAttribute('aria-atomic','true');stage.append(title,subtitle);head.append(heading,counter);
    const progress=make('progress','tpt-progress');progress.max=100;progress.setAttribute('aria-label','供电巡视总进度');
    const controls=make('div','tpt-controls');
    function button(text,act,cls){const b=make('button',cls,text);b.type='button';b.addEventListener('click',act);controls.append(b);return b;}
    let controller,synth;
    try{synth=root.speechSynthesis;}catch{/* Caption-only mode. */}
    const narrator=createNarrator(synth,root.SpeechSynthesisUtterance?t=>new root.SpeechSynthesisUtterance(t):null);
    const play=button('暂停',()=>{if(controller.getState().status==='playing')controller.pause();else controller.start();},'tpt-primary');
    const prev=button('上一步',()=>controller.previous()),next=button('下一步',()=>controller.next());
    const inspect=button('细看本站',()=>{const {step,index}=controller.getState();if(step){controller.interrupt('inspect');callbacks.onInspect?.(step,index);}});
    const restart=button('重新开始',()=>controller.restart()),end=button('结束',()=>controller.close());
    end.setAttribute('aria-label','结束巡视');
    const voiceLabel=make('label','tpt-voice'),voice=make('select');voiceLabel.append(make('span','','朗读'),voice);controls.append(voiceLabel);
    const statusLine=make('span','tpt-status');statusLine.setAttribute('role','status');
    const speechNote=make('span','tpt-speech-note');speechNote.setAttribute('role','status');speechNote.hidden=true;
    box.append(head,progress,stage,controls,statusLine,speechNote);host.replaceChildren(box);host.hidden=true;
    const reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
    let lastStep=null,requestedVoice='',preferredVoice='',voiceHint='';
    const preference='gridatlas.powerTour.captionsOnly';
    let captionsOnly=false;
    try{captionsOnly=root.localStorage.getItem(preference)==='1';}catch{/* Browser storage is optional. */}
    function render(s){
      host.hidden=!s.active;if(!s.active){lastStep=null;return;}
      const pending=s.status==='preparing',error=s.status==='error',complete=s.status==='complete',paused=s.status==='paused';
      counter.textContent=s.total?'第 '+(s.index+1)+' 站 / '+s.total+' 站':'';
      const value=s.total?Math.round(100*(s.index+s.fraction)/s.total):0;if(progress.value!==value)progress.value=value;
      if(lastStep!==s.step||!s.step){lastStep=s.step;title.textContent=s.step?.title||(pending?'正在准备路线':error?'巡视路线暂未就绪':'巡视已暂停');subtitle.textContent=textOf(s.step);}
      stage.hidden=!s.step&&!pending&&!error&&!paused;
      play.hidden=complete;play.disabled=pending;play.textContent=paused?'继续巡视':error?'重试':pending?'准备中':'暂停';
      prev.disabled=s.index<=0||pending;next.disabled=!s.total||s.index>=s.total-1||pending;
      inspect.hidden=!callbacks.onInspect||!s.step;restart.hidden=pending||error;voice.disabled=!narrator.available;
      const info=complete?'已到达最后一站':s.reason==='hidden'?'已暂停，返回后可继续巡视。':s.reason==='unavailable'?'当前路线未就绪，可重新尝试。':
        s.status==='paused'?'巡视已暂停。':s.readIssue?'本段朗读未完成，字幕继续。':'';
      if(statusLine.textContent!==info)statusLine.textContent=info;statusLine.hidden=!info;
    }
    controller=createController({...callbacks,onChange:s=>{render(s);callbacks.onChange?.(s);}},
      {read:narrator.read,isHidden:()=>document.hidden,reducedMotion:()=>reduced.matches});
    function showHint(text){
      if(text!==voiceHint){voiceHint=text;speechNote.textContent=text;}
      speechNote.hidden=!text;
    }
    function syncVoices(){
      const selected=controller.getState().voice,options=[new Option('仅字幕','')],list=narrator.voices();
      if(narrator.available&&list.length){
        options.push(new Option('系统中文语音','auto'));
        for(const v of list)options.push(new Option(v.label,v.id));
      }
      voice.replaceChildren(...options);
      voice.value=requestedVoice&&list.length?(options.some(o=>o.value===requestedVoice)?requestedVoice:'auto'):'';
      if(selected!==voice.value)controller.setVoice(voice.value);
      showHint(!narrator.available?'当前浏览器未提供系统朗读，巡视使用字幕。':!list.length?'系统尚无可用的中文语音，巡视使用字幕。':'');
    }
    voice.addEventListener('change',()=>{
      requestedVoice=voice.value;preferredVoice=voice.value;captionsOnly=!voice.value;
      try{if(captionsOnly)root.localStorage.setItem(preference,'1');else root.localStorage.removeItem(preference);}catch{/* Keep the current choice in memory. */}
      controller.setVoice(voice.value);
    });
    function start({speakIfAvailable=false}={}){
      const s=controller.getState();
      if(speakIfAvailable&&!captionsOnly)requestedVoice=preferredVoice||'auto';
      else if(!speakIfAvailable&&!['playing','paused','preparing'].includes(s.status)){
        requestedVoice='';
      }
      syncVoices();
      return controller.start();
    }
    const visibility=()=>{if(document.hidden)controller.interrupt('hidden');};
    document.addEventListener('visibilitychange',visibility);synth?.addEventListener?.('voiceschanged',syncVoices);
    syncVoices();
    return {...controller,start,destroy(){document.removeEventListener('visibilitychange',visibility);synth?.removeEventListener?.('voiceschanged',syncVoices);controller.destroy();box.remove();}};
  }
  root.GridPowerTour=Object.freeze({mount,createController,createNarrator});
})(typeof window==='undefined'?globalThis:window);
