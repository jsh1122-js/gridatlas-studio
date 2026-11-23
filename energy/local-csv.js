(() => {
  'use strict';

  const pageSize = 40;
  const dateText = time => new Date(time).toLocaleString('zh-CN', {hour12:false});
  function element(tag, content, className) {
    const node = document.createElement(tag);
    if (content != null) node.textContent = content;
    if (className) node.className = className;
    return node;
  }
  function decode(bytes) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return [new TextDecoder('utf-16le',{fatal:true}).decode(bytes), 'UTF-16 LE'];
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return [new TextDecoder('utf-16be',{fatal:true}).decode(bytes), 'UTF-16 BE'];
    try { return [new TextDecoder('utf-8',{fatal:true}).decode(bytes), 'UTF-8']; }
    catch { return [new TextDecoder('gb18030',{fatal:true}).decode(bytes), 'GB18030']; }
  }
  function delimiterOf(input) {
    const counts = new Map([[',',0],[';',0],['\t',0]]);
    let quoted = false;
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      if (c === '"') {
        if (quoted && input[i+1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted) {
        if (c === '\r' || c === '\n') break;
        if (counts.has(c)) counts.set(c, counts.get(c)+1);
      }
    }
    return [...counts].sort((a,b)=>b[1]-a[1])[0][0];
  }
  function parse(input) {
    input = input.replace(/^\uFEFF/, '');
    if(input.includes('\u0000')) throw Error('发现二进制内容，请选择 CSV 文本文件。');
    const sep = delimiterOf(input), records=[];
    let row=[], field='', quoted=false, closed=false;
    function pushRow() { row.push(field); records.push(row); row=[]; field=''; closed=false; }
    for (let i=0;i<input.length;i++) {
      const c=input[i];
      if (quoted) {
        if(c!=='"') field+=c;
        else if(input[i+1]==='"') {field+='"'; i++;}
        else {quoted=false;closed=true;}
      } else if(c===sep) { row.push(field);field='';closed=false;}
      else if(c==='\n'||c==='\r') {
        if(c==='\r'&&input[i+1]==='\n')i++;
        pushRow();
      } else if(c==='"'&&!field&&!closed) quoted=true;
      else if(closed && c.trim()) throw Error('引号后的字符不符合 CSV 格式。');
      else if(!closed) field+=c;
    }
    if(quoted)throw Error('有一处引号未闭合，请核对 CSV 文件。');
    if(row.length||field||closed)pushRow();
    if(!records.length || !records[0].some(x=>x.trim()))throw Error('找不到表头，请确认文件含有列名。');
    const headers = records.shift();
    let width = headers.length;
    for(const r of records)width = Math.max(width,r.length);
    const columns=Array.from({length:width},(_,i)=>headers[i]?.trim()||'列 '+(i+1));
    return {columns,rows:records};
  }
  function availableDB() {
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('gridatlas-energy-local-csv',1);
      req.onupgradeneeded=()=>{
        req.result.createObjectStore('files',{keyPath:'id'});
        req.result.createObjectStore('tables',{keyPath:'id'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
      req.onblocked=()=>reject(Error('本地数据库暂时被占用。'));
    });
  }
  function read(db,store,key){
    return new Promise((resolve,reject)=>{
      const table=db.transaction(store).objectStore(store);
      const req=key==null ? table.getAll() : table.get(key);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  function write(db,meta,data,remove=false) {
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['files','tables'],'readwrite');
      if(remove){tx.objectStore('files').delete(meta.id);tx.objectStore('tables').delete(meta.id);}
      else {tx.objectStore('files').put(meta);tx.objectStore('tables').put(data);}
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('保存已中止。'));
    });
  }
  async function mount(host) {
    if(!host||host.dataset.energyMounted)return;
    host.dataset.energyMounted='1';host.classList.add('ecsv');
    host.innerHTML='<h2>本地 CSV 数据</h2><p>可导入自己取得的 CSV 文件，按原始字段检索。数据保存在当前浏览器。</p><div class="ecsv-toolbar"><label>选择 CSV 文件 <input type="file" multiple accept=".csv,text/csv" data-files></label></div><p role="status" aria-live="polite" data-status></p><div class="ecsv-view" data-view hidden><div class="ecsv-toolbar"><label>数据文件 <select data-list></select></label><button type="button" data-delete>删除所选文件</button></div><p class="ecsv-meta" data-meta></p><label>搜索全表 <input type="search" placeholder="输入任一字段中的文字" data-search></label><p data-count></p><div class="ecsv-scroll" style="overflow:auto;max-width:100%;max-height:32rem"><table data-table></table></div><div class="ecsv-pager"><button type="button" data-prev>上一页</button><span data-page></span><button type="button" data-next>下一页</button></div></div>';
    const get=k=>host.querySelector('[data-'+k+']');
    const status=s=>{get('status').textContent=s;};
    let db, metas=[],data=null,indices=[],page=0,selected='',ticket=0,busy=false;
    const memory=new Map();
    const clock=()=>Date.now();
    async function listAll(){return db?read(db,'files'):[...memory.values()].map(x=>x.meta);}
    async function list(id){
      metas=(await listAll()).sort((a,b)=>b.imported-a.imported||a.name.localeCompare(b.name));
      get('list').replaceChildren(...metas.map(m=>new Option(m.name+' · '+m.rowCount+' 行',m.id)));
      const chosen=metas.some(m=>m.id===id)?id:metas[0]?.id;
      get('view').hidden=!chosen;
      if(!chosen){selected='';data=null;ticket++;return;}
      get('list').value=chosen;
      await select(chosen);
    }
    async function select(id){
      const t=++ticket;selected=id;
      const got=db?await read(db,'tables',id):memory.get(id)?.data;
      if(t!==ticket)return;
      if(!got){status('文件已被其他窗口移除，请重新选择。');await list();return;}
      data=got;get('search').value='';
      const m=metas.find(x=>x.id===id);
      get('meta').textContent=m.name+' · '+m.encoding+' · '+m.cols+' 列 · 导入 '+dateText(m.imported)+(m.modified?' · 文件修改 '+dateText(m.modified):'');
      const header=element('thead'),tr=element('tr');
      for(const label of data.columns){const th=element('th',label);th.scope='col';tr.append(th);}
      header.append(tr);get('table').replaceChildren(header,element('tbody'));filter();
    }
    function filter(){
      if(!data)return;
      const q=get('search').value.trim().toLocaleLowerCase();
      indices=[];
      data.rows.forEach((r,i)=>{if(!q||r.some(v=>v.toLocaleLowerCase().includes(q)))indices.push(i);});
      page=0;render();
    }
    function render(){
      const count=indices.length,pages=Math.max(1,Math.ceil(count/pageSize));
      const body=get('table').tBodies[0];body.replaceChildren();
      for(const i of indices.slice(page*pageSize,(page+1)*pageSize)){
        const tr=element('tr'),r=data.rows[i];
        for(let c=0;c<data.columns.length;c++)tr.append(element('td',r[c]??''));
        body.append(tr);
      }
      get('count').textContent='匹配 '+count.toLocaleString('zh-CN')+' 行 / 文件共 '+data.rows.length.toLocaleString('zh-CN')+' 行';
      get('page').textContent='第 '+(page+1)+' / '+pages+' 页';
      get('prev').disabled=!page;get('next').disabled=page+1>=pages;
    }
    try {db=await availableDB();await list();}catch{db=null;status('此浏览器暂时无法使用本地数据库。本次打开期间仍可查看导入的数据。');}
    get('files').onchange=async e=>{
      const files=[...e.target.files];if(!files.length||busy)return;
      busy=true;get('files').disabled=true;get('delete').disabled=true;
      const errors=[];let ok=0,reused=0,last='';
      try{
        for(const f of files){
          try{
            status('正在读取 '+f.name);
            const bytes=new Uint8Array(await f.arrayBuffer());
            const hash=await crypto.subtle.digest('SHA-256',bytes);
            const id=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
            const existing=db?await read(db,'files',id):memory.get(id)?.meta;
            if(existing){reused++;last=id;continue;}
            const [content,encoding]=decode(bytes);
            const result=parse(content), obj={id,...result};
            const meta={id,name:f.name,modified:f.lastModified,imported:clock(),rowCount:result.rows.length,cols:result.columns.length,encoding};
            if(db)await write(db,meta,obj);else memory.set(id,{meta,data:obj});
            ok++;last=id;
          } catch(err){errors.push(f.name+'：'+(err?.name==='QuotaExceededError'?'浏览器存储空间不足。':err.message));}
        }
        await list(last||selected);
        status('已导入 '+ok+' 份，复用 '+reused+' 份相同内容。'+(!db?' 数据仅在当前会话保留。':'')+(errors.length?' '+errors.join('；'):''));
      }finally{busy=false;get('files').disabled=false;get('delete').disabled=false;e.target.value='';}
    };
    get('list').onchange=e=>select(e.target.value).catch(err=>status(err.message));
    get('search').oninput=filter;
    get('prev').onclick=()=>{if(page){page--;render();}};
    get('next').onclick=()=>{if((page+1)*pageSize<indices.length){page++;render();}};
    get('delete').onclick=async()=>{
      const m=metas.find(x=>x.id===selected);
      if(busy||!m||!window.confirm('从本浏览器删除「'+m.name+'」？'))return;
      try{if(db)await write(db,m,null,true);else memory.delete(m.id);await list();status('已从本机目录删除「'+m.name+'」。');}catch(err){status(err.message);}
    };
  }
  window.EnergyCsv=Object.freeze({mount});
})();
