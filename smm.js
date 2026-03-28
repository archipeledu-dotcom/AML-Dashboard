
/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; STATE &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
let URL_PERF='', URL_SMM='', URL_PROD='', URL_CENT='';
let TAB_PERF='performance', TAB_SMM='smm', TAB_PROD='prod', TAB_CENT='centres';
let centRows=[], centWeeks=[];
let chCentInsc, chCentHist;
const CENTRES = ['Menzah','Aouina','Boumhal','Bardo','Mourouj'];
const CENT_COLORS = ['#3b6d11','#185fa5','#ba7517','#993556','#534ab7'];
let perfRows=[], smmRows=[], prodRows=[];
let perfWeeks=[], smmWeeks=[], prodWeeks=[];
let wIdx=0;
let currentPeriod='week'; // 'day' | 'week' | 'month'
let chPerf, chPerfHist, chSmmReach, chSmmFollow, chProdHist;
let activeSection='perf';

/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; JSONP FETCH &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
function fetchSheet(url, tab) {
  return new Promise((resolve, reject) => {
    const cb = 'cb_' + tab.replace(/\W/g,'') + '_' + Date.now();
    const src = url.split('?')[0] + '?sheet=' + encodeURIComponent(tab) + '&callback=' + cb;
    const script = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('Timeout sur onglet "' + tab + '"')); }, 12000);
    window[cb] = (data) => {
      cleanup();
      if (data.error) { reject(new Error(data.error)); return; }
      resolve(data.rows || []);
    };
    function cleanup() { clearTimeout(timer); delete window[cb]; if (script.parentNode) script.parentNode.removeChild(script); }
    script.onerror = () => { cleanup(); reject(new Error('Erreur script - verifiez l\'URL')); };
    script.src = src;
    document.head.appendChild(script);
  });
}

/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; CONFIG TABS &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
function switchCfgTab(id, el) {
  document.querySelectorAll('.cfg-tab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.cfg-sheet-block').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('cfg-' + id).classList.add('on');
}

/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; CONNECT &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
async function connectAll() {
  const urlP  = document.getElementById('in-url-perf').value.trim();
  const urlS  = document.getElementById('in-url-smm').value.trim();
  const urlPr = document.getElementById('in-url-prod').value.trim();
  const urlC  = document.getElementById('in-url-centres').value.trim();
  const tabP  = document.getElementById('in-tab-perf').value.trim() || 'performance';
  const tabS  = document.getElementById('in-tab-smm').value.trim()  || 'smm';
  const tabPr = document.getElementById('in-tab-prod').value.trim() || 'prod';
  const tabC  = document.getElementById('in-tab-centres').value.trim() || 'centres';
  const errEl = document.getElementById('cfg-err');
  const btn   = document.getElementById('cfg-btn');
  if (!urlP && !urlS && !urlPr && !urlC) { errEl.textContent = 'Remplissez au moins une URL Apps Script.'; return; }
  errEl.textContent = ''; btn.textContent = 'Connexion...'; btn.disabled = true;
  try {
    const [rP, rS, rPr, rC] = await Promise.all([
      urlP  ? fetchSheet(urlP,  tabP)  : Promise.resolve([]),
      urlS  ? fetchSheet(urlS,  tabS)  : Promise.resolve([]),
      urlPr ? fetchSheet(urlPr, tabPr) : Promise.resolve([]),
      urlC  ? fetchSheet(urlC,  tabC)  : Promise.resolve([])
    ]);
    URL_PERF=urlP; URL_SMM=urlS; URL_PROD=urlPr; URL_CENT=urlC;
    TAB_PERF=tabP; TAB_SMM=tabS; TAB_PROD=tabPr; TAB_CENT=tabC;
    localStorage.setItem('smm_archi_url_perf', urlP);
    localStorage.setItem('archi_url_smm',  urlS);
    localStorage.setItem('smm_archi_url_prod', urlPr);
    localStorage.setItem('smm_archi_url_cent', urlC);
    localStorage.setItem('smm_archi_tab_perf', tabP);
    localStorage.setItem('archi_tab_smm',  tabS);
    localStorage.setItem('smm_archi_tab_prod', tabPr);
    localStorage.setItem('smm_archi_tab_cent', tabC);
    perfRows=rP; smmRows=rS; prodRows=rPr; centRows=rC;
    perfWeeks=buildWeeks(rP); smmWeeks=buildWeeks(rS); prodWeeks=buildWeeks(rPr); centWeeks=buildWeeks(rC);
    wIdx = Math.max(perfWeeks.length,smmWeeks.length,prodWeeks.length,centWeeks.length) - 1;
    currentPeriod='week';
    document.getElementById('cfg').style.display = 'none';
    setStatus('live', 'Connecte ' + (rP.length+rS.length+rPr.length+rC.length) + ' lignes');
    setUptime(); renderAll();
  } catch(e) {
    errEl.textContent = e.message;
    btn.textContent = 'Connecter et charger les donnees'; btn.disabled = false;
  }
}

function openCfg() {
  document.getElementById('cfg').style.display = 'flex';
  document.getElementById('cfg-btn').textContent = 'Connecter et charger les donnees';
  document.getElementById('cfg-btn').disabled = false;
  document.getElementById('cfg-err').textContent = '';
}

/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; REFRESH &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
async function doRefresh() {
  if (!URL_PERF && !URL_SMM && !URL_PROD && !URL_CENT) { loadDemo(); return; }
  const btn=document.getElementById('ref-btn'), spin=document.getElementById('spin');
  btn.disabled=true; spin.classList.add('on');
  document.getElementById('ref-lbl').textContent='Chargement...';
  try {
    const [rP,rS,rPr,rC] = await Promise.all([
      URL_PERF ? fetchSheet(URL_PERF, TAB_PERF) : Promise.resolve([]),
      URL_SMM  ? fetchSheet(URL_SMM,  TAB_SMM)  : Promise.resolve([]),
      URL_PROD ? fetchSheet(URL_PROD, TAB_PROD) : Promise.resolve([]),
      URL_CENT ? fetchSheet(URL_CENT, TAB_CENT) : Promise.resolve([])
    ]);
    perfRows=rP; smmRows=rS; prodRows=rPr; centRows=rC;
    perfWeeks=buildWeeks(rP); smmWeeks=buildWeeks(rS); prodWeeks=buildWeeks(rPr); centWeeks=buildWeeks(rC);
    wIdx = Math.max(perfWeeks.length,smmWeeks.length,prodWeeks.length,centWeeks.length) - 1;
    setStatus('live','Connecte '+(rP.length+rS.length+rPr.length+rC.length)+' lignes');
    setUptime(); renderAll();
  } catch(e) { setStatus('err','Erreur - '+e.message); }
  finally { btn.disabled=false; spin.classList.remove('on'); document.getElementById('ref-lbl').textContent='Actualiser'; }
}

function setStatus(m,l){
  const c={live:'var(--teal)',demo:'var(--amber)',err:'var(--coral)'};
  document.getElementById('sdot').style.background=c[m];
  document.getElementById('stxt').style.color=c[m];
  document.getElementById('stxt').textContent=l;
}
function setUptime(){ document.getElementById('uptime').textContent='Mis a jour '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }

/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; SECTION SWITCH &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
function switchSection(id, el) {
  document.querySelectorAll('.stab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('sec-'+id).classList.add('on');
  activeSection = id;
  if(id==='cent') renderCentres();
}

/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; WEEK UTILS &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
function isoWeek(ds) {
  const d=new Date(ds+'T00:00:00'); const day=d.getDay()||7;
  d.setDate(d.getDate()+4-day);
  const jan=new Date(d.getFullYear(),0,1);
  return d.getFullYear()+'-W'+String(Math.ceil(((d-jan)/86400000+1)/7)).padStart(2,'0');
}
function buildWeeks(rows) {
  const m={};
  rows.forEach(r=>{ const k=isoWeek(r.date); if(!m[k]) m[k]={key:k,rows:[]}; m[k].rows.push(r); });
  return Object.values(m).sort((a,b)=>a.key.localeCompare(b.key));
}
function wSum(w,f){ return w?w.rows.reduce((s,r)=>s+(+r[f]||0),0):0; }
function wAvg(w,f){ if(!w||!w.rows.length) return 0; return wSum(w,f)/w.rows.length; }
function wNum(w){ return parseInt(w.key.split('-W')[1]); }
function wYear(w){ return parseInt(w.key.split('-W')[0]); }
function wDates(w) {
  const dates=w.rows.map(r=>r.date).sort();
  const fmt=d=>new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  return fmt(dates[0])+' &#8211; '+fmt(dates[dates.length-1]);
}
function fn(n){ return Math.round(n).toLocaleString('fr-FR'); }
function fc(n){ return fn(n)+' DT'; }
function fp(n){ return n.toFixed(1)+'%'; }
function fd(cur,prev,lower_is_better) {
  if(!prev) return '<span class="fl">Premiere semaine</span>';
  const p=Math.round((cur/prev-1)*100);
  if(p===0) return '<span class="fl">stable</span>';
  const good = lower_is_better ? p<0 : p>0;
  const sign=p>0?'+':'';
  return good ? '<span class="up">&#8593; '+sign+p+'% vs S-1</span>' : '<span class="dn">&#8595; '+sign+p+'% vs S-1</span>';
}

function getW(weeks, idx) { return idx>=0&&idx<weeks.length ? weeks[idx] : null; }

/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; CHANGE WEEK &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
function changePeriod(dir) {
  const items = getPeriodItems();
  wIdx = Math.max(0, Math.min(items.length-1, wIdx+dir));
  renderAll();
}

function setPeriod(p, el) {
  currentPeriod = p;
  document.querySelectorAll('.pbtn').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  const items = getPeriodItems();
  if(!items.length){ wIdx=0; renderAll(); return; }
  // Find today's period and jump to it
  const today = new Date().toISOString().slice(0,10);
  let targetKey;
  if(p === 'day') targetKey = today;
  else if(p === 'week') targetKey = isoWeek(today);
  else if(p === 'month') targetKey = today.slice(0,7);
  const idx = items.findIndex(i=>i.key===targetKey);
  wIdx = idx >= 0 ? idx : items.length - 1;
  renderAll();
}

function getPeriodItems() {
  if (currentPeriod === 'day') return getAllDays();
  if (currentPeriod === 'month') return getMonths();
  // Merge all week keys from all sources
  const allKeys = new Set([
    ...perfWeeks.map(w=>w.key),
    ...smmWeeks.map(w=>w.key),
    ...prodWeeks.map(w=>w.key),
    ...centWeeks.map(w=>w.key)
  ]);
  if(!allKeys.size) return [];
  return Array.from(allKeys).sort().map(k=>{
    return perfWeeks.find(w=>w.key===k)
      || smmWeeks.find(w=>w.key===k)
      || prodWeeks.find(w=>w.key===k)
      || centWeeks.find(w=>w.key===k)
      || {key:k, rows:[]};
  });
}

function getAllDays() {
  const dates = [...new Set([
    ...perfRows.map(r=>r.date),
    ...smmRows.map(r=>r.date),
    ...prodRows.map(r=>r.date),
    ...centRows.map(r=>r.date)
  ])].sort();
  return dates.map(d=>({key:d, date:d, rows:null}));
}

function getMonths() {
  const map = {};
  [...perfRows,...smmRows,...prodRows,...centRows].forEach(r=>{
    const k = r.date.slice(0,7);
    if (!map[k]) map[k] = {key:k, rows:[]};
    map[k].rows.push(r);
  });
  return Object.values(map).sort((a,b)=>a.key.localeCompare(b.key));
}

function getPerfRows(item) {
  if (currentPeriod === 'day') return perfRows.filter(r=>r.date===item.key);
  if (currentPeriod === 'month') return perfRows.filter(r=>r.date.startsWith(item.key));
  return item.rows || [];
}
function getSmmRows(item) {
  if (currentPeriod === 'day') return smmRows.filter(r=>r.date===item.key);
  if (currentPeriod === 'month') return smmRows.filter(r=>r.date.startsWith(item.key));
  return item.rows || [];
}
function getProdRows(item) {
  if (currentPeriod === 'day') return prodRows.filter(r=>r.date===item.key);
  if (currentPeriod === 'month') return prodRows.filter(r=>r.date.startsWith(item.key));
  return item.rows || [];
}

function makeFakeWeek(rows) { return rows.length ? {key:'', rows} : null; }

function periodLabel(item) {
  if (currentPeriod === 'day') {
    return new Date(item.key+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  }
  if (currentPeriod === 'month') {
    const [y,m] = item.key.split('-');
    return new Date(y,m-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  }
  return 'Semaine '+wNum(item)+' . '+wYear(item);
}

function periodSubLabel(item) {
  if (currentPeriod === 'day') return '';
  if (currentPeriod === 'month') return item.rows ? item.rows.length+' lignes' : '';
  return wDates(item);
}

/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; RENDER ALL &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
function renderAll() {
  const items = getPeriodItems();
  if(!items.length) return;
  wIdx = Math.max(0, Math.min(items.length-1, wIdx));
  const cur = items[wIdx];
  document.getElementById('wtitle').textContent = periodLabel(cur);
  document.getElementById('wsub').textContent = periodSubLabel(cur);
  document.getElementById('wctr').textContent = (wIdx+1)+' / '+items.length;
  document.getElementById('wprev').disabled = wIdx===0;
  document.getElementById('wnext').disabled = wIdx===items.length-1;
  renderSMM();
}

/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; RENDER PERF &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
function renderPerf() {
  const items = getPeriodItems();
  const curItem = items[wIdx], prevItem = wIdx>0?items[wIdx-1]:null;
  const curRows = getPerfRows(curItem||{key:''});
  const prevRows = prevItem ? getPerfRows(prevItem) : [];
  const cur = makeFakeWeek(curRows);
  const prev = makeFakeWeek(prevRows);
  function sk(id,val,delta,ko){ document.getElementById('p-'+id).textContent=val; document.getElementById('pd-'+id).innerHTML=delta; document.getElementById('po-'+id).textContent=ko; }
  function cmpBadge(cur,prev,lowerBetter){
    if(!prev) return '';
    const p=Math.round((cur/prev-1)*100);
    if(p===0) return '<span class="kpi-cmp fl">= stable</span>';
    const good = lowerBetter ? p<0 : p>0;
    const sign=p>0?'+':'';
    return good
      ? '<span class="kpi-cmp up">&#8593; '+sign+p+'% vs prec.</span>'
      : '<span class="kpi-cmp dn">&#8595; '+sign+p+'% vs prec.</span>';
  }
  const lbl = currentPeriod==='day' ? 'J-1' : currentPeriod==='month' ? 'M-1' : 'S-1';

  const ca=wSum(cur,'ca'), pca=wSum(prev,'ca');
  const leads=wSum(cur,'leads'), pleads=wSum(prev,'leads');
  const cpl=wAvg(cur,'cpl'), pcpl=wAvg(prev,'cpl');
  const tconv=wAvg(cur,'taux_conv'), ptconv=wAvg(prev,'taux_conv');
  const roas=wAvg(cur,'roas'), proas=wAvg(prev,'roas');
  const budget=wSum(cur,'budget_ads'), pbudget=wSum(prev,'budget_ads');
  const trafic=wSum(cur,'trafic_site'), ptrafic=wSum(prev,'trafic_site');

  sk('ca',    fc(ca),               cmpBadge(ca,pca),          prev?lbl+' : '+fc(pca):'');
  sk('leads', fn(leads),            cmpBadge(leads,pleads),     prev?lbl+' : '+fn(pleads):'');
  sk('cpl',   fc(cpl),              cmpBadge(cpl,pcpl,true),    prev?lbl+' : '+fc(pcpl):'');
  sk('tconv', fp(tconv),            cmpBadge(tconv,ptconv),     prev?lbl+' : '+fp(ptconv):'');
  sk('roas',  roas.toFixed(1)+'x',  cmpBadge(roas,proas),       prev?lbl+' : '+proas.toFixed(1)+'x':'');
  sk('budget',fc(budget),           cmpBadge(budget,pbudget),   prev?lbl+' : '+fc(pbudget):'');
  sk('trafic',fn(trafic),           cmpBadge(trafic,ptrafic),   prev?lbl+' : '+fn(ptrafic):'');

  // Leads joignables / injoignables
  const joign   = wSum(cur,'leads_joignables'),   pjoign   = prev?wSum(prev,'leads_joignables'):0;
  const injoign = wSum(cur,'leads_injoignables'), pinjoign = prev?wSum(prev,'leads_injoignables'):0;
  const tinjoign  = (joign+injoign)>0 ? +((injoign/(joign+injoign))*100).toFixed(1) : 0;
  const ptinjoign = (pjoign+pinjoign)>0 ? +((pinjoign/(pjoign+pinjoign))*100).toFixed(1) : 0;
  const cpl_joign  = joign  ? Math.round(budget/joign)  : 0;
  const pcpl_joign = pjoign ? Math.round(pbudget/pjoign) : 0;

  function skp(id,val,delta,ko){
    var v=document.getElementById('p-'+id); if(v) v.textContent=val;
    var d=document.getElementById('pd-'+id); if(d) d.innerHTML=delta;
    var o=document.getElementById('po-'+id); if(o) o.textContent=ko;
  }
  skp('cpl-gen',  fc(cpl),           cmpBadge(cpl,pcpl,true),          prev?lbl+' : '+fc(pcpl):'');
  skp('joign',    fn(joign),          cmpBadge(joign,pjoign),           prev?lbl+' : '+fn(pjoign):'');
  skp('injoign',  fn(injoign),        cmpBadge(injoign,pinjoign,true),  prev?lbl+' : '+fn(pinjoign):'');
  skp('tinjoign', tinjoign.toFixed(1)+'%', cmpBadge(tinjoign,ptinjoign,true), prev?lbl+' : '+ptinjoign.toFixed(1)+'%':'');
  skp('cpl-joign',fc(cpl_joign),      cmpBadge(cpl_joign,pcpl_joign,true), prev?lbl+' : '+fc(pcpl_joign):'');

  // Chart perf semaine
  if(cur) {
    const days=[...cur.rows].sort((a,b)=>a.date.localeCompare(b.date));
    const labels=days.map(r=>new Date(r.date+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'}));
    if(chPerf) chPerf.destroy();
    chPerf=new Chart(document.getElementById('ch-perf'),{
      type:'line',
      data:{labels,datasets:[
        {label:'CA',data:days.map(r=>r.ca||0),borderColor:'#0f6e56',backgroundColor:'rgba(15,110,86,0.07)',borderWidth:2,pointRadius:4,pointBackgroundColor:'#0f6e56',tension:0.35,fill:true,yAxisID:'y1'},
        {label:'Leads',data:days.map(r=>r.leads||0),borderColor:'#185fa5',backgroundColor:'rgba(24,95,165,0.05)',borderWidth:2,pointRadius:4,pointBackgroundColor:'#185fa5',tension:0.35,fill:true,yAxisID:'y2'}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{color:'#bbb',font:{size:10,family:'Courier New'},maxRotation:0}},
                y1:{position:'left',grid:{color:'rgba(0,0,0,0.04)'},ticks:{color:'#bbb',font:{size:10,family:'Courier New'}}},
                y2:{position:'right',grid:{display:false},ticks:{color:'#bbb',font:{size:10,family:'Courier New'}}}}}
    });
  }

  // Comparison
  const el=document.getElementById('cmp-perf');
  if(!prev){el.innerHTML='<div class="empty">Aucune semaine precedente.</div>';}
  else {
    const metrics=[
      {label:'CA (&#8364;)',f:'ca',c:'#0f6e56',fmt:v=>fc(v)},
      {label:'Leads',f:'leads',c:'#185fa5',fmt:v=>fn(v)},
      {label:'Budget Ads',f:'budget_ads',c:'#ba7517',fmt:v=>fc(v)},
      {label:'Trafic site',f:'trafic_site',c:'#993556',fmt:v=>fn(v)},
    ];
    el.innerHTML=metrics.map(m=>{
      const cv=wSum(cur,m.f),pv=wSum(prev,m.f);
      const max=Math.max(cv,pv)||1;
      const pct=pv?Math.round((cv/pv-1)*100):0;
      const cls=pct>0?'up':pct<0?'dn':'fl';
      return `<div class="cmp-row"><div class="cmp-hdr"><span class="cmp-name">${m.label}</span><div class="cmp-vals"><span class="cmp-prev">${m.fmt(pv)}</span><span style="font-size:9px;color:var(--hint)">&#8594;</span><span class="cmp-cur">${m.fmt(cv)}</span><span class="cmp-pct ${cls}">${pct>0?'+':''}${pct}%</span></div></div><div class="bbar"><div class="bprev" style="width:${Math.round(pv/max*100)}%"></div><div class="bcur" style="width:${Math.round(cv/max*100)}%;background:${m.c};opacity:.75"></div></div></div>`;
    }).join('');
  }

  // Camp table - on agrege par camp_nom sur la semaine
  const tbody=document.getElementById('camp-tbody');
  if(cur&&cur.rows.length) {
    const camps={};
    cur.rows.forEach(r=>{
      if(!r.camp_nom) return;
      const n=r.camp_nom;
      if(!camps[n]) camps[n]={nom:n,budget:0,leads:0};
      camps[n].budget+=(+r.camp_budget||0);
      camps[n].leads+=(+r.camp_leads||0);
    });
    const arr=Object.values(camps);
    if(arr.length) {
      tbody.innerHTML=arr.map(c=>{
        const cpl=c.leads?Math.round(c.budget/c.leads):0;
        const roas=c.budget?(c.leads*50/c.budget).toFixed(1):'-';
        return `<tr><td>${c.nom}</td><td>${fc(c.budget)}</td><td>${fn(c.leads)}</td><td>${fc(cpl)}</td><td>${roas}x</td></tr>`;
      }).join('');
    } else {
      tbody.innerHTML='<tr><td colspan="5"><div class="empty">Pas de donnees campagne cette semaine</div></td></tr>';
    }
  }

  // Gouvernorats
  const govWrap=document.getElementById('gov-wrap');
  if(cur) {
    const govs=[
      {name:'Tunis',f:'gov_tunis',color:'#185fa5'},
      {name:'Sfax',f:'gov_sfax',color:'#0f6e56'},
      {name:'Sousse',f:'gov_sousse',color:'#993556'},
      {name:'Autres',f:'gov_autres',color:'#888780'},
    ];
    const totGov=govs.reduce((s,g)=>s+wSum(cur,g.f),0);
    document.getElementById('gov-total').textContent=fn(totGov)+' leads';
    if(totGov>0) {
      govWrap.innerHTML=govs.map(g=>{
        const v=wSum(cur,g.f);
        const pct=Math.round(v/totGov*100);
        return `<div class="gov-row"><div class="gov-name">${g.name}</div><div class="gov-bar-bg"><div class="gov-bar" style="background:${g.color};width:${pct}%"></div></div><div class="gov-val">${fn(v)}</div><div class="gov-pct">${pct}%</div></div>`;
      }).join('');
    } else {
      govWrap.innerHTML='<div class="empty">Remplissez les colonnes gov_ dans Sheets</div>';
    }
  }

  // Hist chart
  const hw=perfWeeks.slice(-8);
  if(chPerfHist) chPerfHist.destroy();
  chPerfHist=new Chart(document.getElementById('ch-perf-hist'),{
    type:'bar',
    data:{labels:hw.map(w=>'S'+wNum(w)),datasets:[
      {label:'CA',data:hw.map(w=>wSum(w,'ca')),backgroundColor:'rgba(15,110,86,0.75)',borderRadius:4,yAxisID:'y1'},
      {label:'Budget',data:hw.map(w=>wSum(w,'budget_ads')),backgroundColor:'rgba(186,117,23,0.6)',borderRadius:4,yAxisID:'y1'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},ticks:{color:'#bbb',font:{size:10,family:'Courier New'}}},
              y1:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{color:'#bbb',font:{size:10,family:'Courier New'}}}}}
  });
}

/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; RENDER SMM &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
function renderSMM() {
  const items = getPeriodItems();
  const curItem = items[wIdx], prevItem = wIdx>0?items[wIdx-1]:null;
  const curRows = getSmmRows(curItem||{key:''});
  const prevRows = prevItem ? getSmmRows(prevItem) : [];
  const cur = makeFakeWeek(curRows);
  const prev = makeFakeWeek(prevRows);
  function sk(id,val,delta,ko){ document.getElementById('s-'+id).textContent=val; document.getElementById('sd-'+id).innerHTML=delta; document.getElementById('so-'+id).textContent=ko; }

  function cmpB(c,p,lb){ if(!p) return ''; const pc=Math.round((c/p-1)*100); if(!pc) return '<span class="kpi-cmp fl">= stable</span>'; const g=lb?pc<0:pc>0; const s=pc>0?'+':''; return g?'<span class="kpi-cmp up">&#8593; '+s+pc+'% vs prec.</span>':'<span class="kpi-cmp dn">&#8595; '+s+pc+'% vs prec.</span>'; }
  const lbl2 = currentPeriod==='day'?'J-1':currentPeriod==='month'?'M-1':'S-1';
  const reach=wSum(cur,'reach_fb')+wSum(cur,'reach_ig')+wSum(cur,'reach_li');
  const preach=prev?wSum(prev,'reach_fb')+wSum(prev,'reach_ig')+wSum(prev,'reach_li'):0;
  const foll=wSum(cur,'followers_fb')+wSum(cur,'followers_ig')+wSum(cur,'followers_li')+wSum(cur,'followers_tt');
  const pfoll=prev?wSum(prev,'followers_fb')+wSum(prev,'followers_ig')+wSum(prev,'followers_li')+wSum(prev,'followers_tt'):0;
  const eng=wAvg(cur,'engagement_ig'), peng=prev?wAvg(prev,'engagement_ig'):0;
  const posts=wSum(cur,'posts_total'), pposts=prev?wSum(prev,'posts_total'):0;

  sk('reach',fn(reach),cmpB(reach,preach),prev?lbl2+' : '+fn(preach):'');
  sk('followers',fn(foll),cmpB(foll,pfoll),prev?lbl2+' : '+fn(pfoll):'');
  sk('eng',fp(eng),cmpB(eng,peng),prev?lbl2+' : '+fp(peng):'');
  sk('posts',fn(posts),cmpB(posts,pposts),prev?lbl2+' : '+fn(pposts):'');

  // Canal cards
  const canals=[
    {name:'Facebook',rf:'reach_fb',ff:'followers_fb',ef:'engagement_fb',color:'#185fa5'},
    {name:'Instagram',rf:'reach_ig',ff:'followers_ig',ef:'engagement_ig',color:'#993556'},
    {name:'LinkedIn',rf:'reach_li',ff:'followers_li',ef:'engagement_li',color:'#0f6e56'},
    {name:'TikTok',rf:'reach_tt',ff:'followers_tt',ef:'engagement_tt',color:'#1a1a1a'},
  ];
  const grid=document.getElementById('canal-grid');
  if(cur) {
    grid.innerHTML=canals.map(c=>{
      const r=wSum(cur,c.rf), f=wSum(cur,c.ff), e=wAvg(cur,c.ef);
      const pr=prev?wSum(prev,c.rf):0;
      const pct=pr?Math.round((r/pr-1)*100):0;
      const cls=pct>=0?'up':'dn';
      return `<div class="canal-card">
        <div class="canal-name" style="color:${c.color}">${c.name}</div>
        <div class="canal-val">${fn(r)}</div>
        <div class="canal-delta ${cls}" style="font-size:10px;font-family:var(--mono)">${pct>=0?'+':''}${pct}% reach</div>
        <div class="canal-sub">Followers: ${fn(f)} . Eng: ${e.toFixed(1)}%</div>
      </div>`;
    }).join('');
  }

  // Charts
  const hw=smmWeeks.slice(-8);
  if(chSmmReach) chSmmReach.destroy();
  chSmmReach=new Chart(document.getElementById('ch-smm-reach'),{
    type:'line',
    data:{labels:hw.map(w=>'S'+wNum(w)),datasets:[
      {label:'FB',data:hw.map(w=>wSum(w,'reach_fb')),borderColor:'#185fa5',backgroundColor:'rgba(24,95,165,0.06)',borderWidth:2,pointRadius:3,tension:0.35,fill:true},
      {label:'IG',data:hw.map(w=>wSum(w,'reach_ig')),borderColor:'#993556',backgroundColor:'rgba(153,53,86,0.05)',borderWidth:2,pointRadius:3,tension:0.35,fill:true},
      {label:'LI',data:hw.map(w=>wSum(w,'reach_li')),borderColor:'#0f6e56',backgroundColor:'rgba(15,110,86,0.05)',borderWidth:2,pointRadius:3,tension:0.35,fill:true}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},ticks:{color:'#bbb',font:{size:10,family:'Courier New'}}},
              y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{color:'#bbb',font:{size:10,family:'Courier New'}}}}}
  });

  if(chSmmFollow) chSmmFollow.destroy();
  chSmmFollow=new Chart(document.getElementById('ch-smm-follow'),{
    type:'bar',
    data:{labels:hw.map(w=>'S'+wNum(w)),datasets:[
      {label:'FB',data:hw.map(w=>wSum(w,'followers_fb')),backgroundColor:'rgba(24,95,165,0.7)',borderRadius:3},
      {label:'IG',data:hw.map(w=>wSum(w,'followers_ig')),backgroundColor:'rgba(153,53,86,0.65)',borderRadius:3},
      {label:'LI',data:hw.map(w=>wSum(w,'followers_li')),backgroundColor:'rgba(15,110,86,0.6)',borderRadius:3},
      {label:'TT',data:hw.map(w=>wSum(w,'followers_tt')),backgroundColor:'rgba(100,100,100,0.5)',borderRadius:3}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},stacked:true,ticks:{color:'#bbb',font:{size:10,family:'Courier New'}}},
              y:{stacked:true,grid:{color:'rgba(0,0,0,0.04)'},ticks:{color:'#bbb',font:{size:10,family:'Courier New'}}}}}
  });

  // Comparison SMM
  const el=document.getElementById('cmp-smm');
  if(!prev){el.innerHTML='<div class="empty">Aucune semaine precedente.</div>';return;}
  const metrics=[
    {label:'Reach Facebook',f:'reach_fb',c:'#185fa5'},
    {label:'Reach Instagram',f:'reach_ig',c:'#993556'},
    {label:'Reach LinkedIn',f:'reach_li',c:'#0f6e56'},
    {label:'Posts publies',f:'posts_total',c:'#ba7517'},
  ];
  el.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">`+metrics.map(m=>{
    const cv=wSum(cur,m.f),pv=wSum(prev,m.f);
    const max=Math.max(cv,pv)||1;
    const pct=pv?Math.round((cv/pv-1)*100):0;
    const cls=pct>0?'up':pct<0?'dn':'fl';
    return `<div class="cmp-row"><div class="cmp-hdr"><span class="cmp-name">${m.label}</span><span class="cmp-pct ${cls}">${pct>0?'+':''}${pct}%</span></div><div class="bbar"><div class="bprev" style="width:${Math.round(pv/max*100)}%"></div><div class="bcur" style="width:${Math.round(cv/max*100)}%;background:${m.c};opacity:.75"></div></div><div style="display:flex;justify-content:space-between;font-size:9px;font-family:var(--mono);color:var(--hint);margin-top:2px"><span>${fn(pv)}</span><span>${fn(cv)}</span></div></div>`;
  }).join('')+'</div>';
}

/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; RENDER PROD &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
function renderProd() {
  const items = getPeriodItems();
  const curItem = items[wIdx], prevItem = wIdx>0?items[wIdx-1]:null;
  const curRows = getProdRows(curItem||{key:''});
  const prevRows = prevItem ? getProdRows(prevItem) : [];
  const cur = makeFakeWeek(curRows);
  const prev = makeFakeWeek(prevRows);
  function sk(id,val,delta,ko){ document.getElementById('pr-'+id).textContent=val; document.getElementById('prd-'+id).innerHTML=delta; document.getElementById('pro-'+id).textContent=ko; }

  function cmpP(c,p){ if(!p) return ''; const pc=Math.round((c/p-1)*100); if(!pc) return '<span class="kpi-cmp fl">= stable</span>'; return pc>0?'<span class="kpi-cmp up">&#8593; +'+pc+'% vs prec.</span>':'<span class="kpi-cmp dn">&#8595; '+pc+'% vs prec.</span>'; }
  const lbl3 = currentPeriod==='day'?'J-1':currentPeriod==='month'?'M-1':'S-1';
  const creas=wSum(cur,'creas_produites'), pcreas=wSum(prev,'creas_produites');
  const modifs=wSum(cur,'modifs'), pmodifs=wSum(prev,'modifs');
  const videos=wSum(cur,'videos'), pvideos=wSum(prev,'videos');
  const visuels=wSum(cur,'visuels'), pvisuels=wSum(prev,'visuels');
  const copies=wSum(cur,'copies');
  const validees=wSum(cur,'validees');
  const refusees=wSum(cur,'refusees');
  const total=creas+modifs;

  sk('creas',fn(creas),cmpP(creas,pcreas),prev?lbl3+' : '+fn(pcreas):'');
  sk('modifs',fn(modifs),cmpP(modifs,pmodifs),prev?lbl3+' : '+fn(pmodifs):'');
  sk('videos',fn(videos),cmpP(videos,pvideos),prev?lbl3+' : '+fn(pvideos):'');
  sk('visuels',fn(visuels),cmpP(visuels,pvisuels),prev?lbl3+' : '+fn(pvisuels):'');

  document.getElementById('pr-copies').textContent=fn(copies);
  document.getElementById('pr-validees').textContent=fn(validees);
  document.getElementById('pr-refusees').textContent=fn(refusees);
  document.getElementById('pr-total').textContent=fn(total);

  // Comparison prod
  const el=document.getElementById('cmp-prod');
  if(!prev){el.innerHTML='<div class="empty">Aucune semaine precedente.</div>';}
  else {
    const metrics=[
      {label:'Creas produites',f:'creas_produites',c:'#534ab7'},
      {label:'Modifications',f:'modifs',c:'#ba7517'},
      {label:'Videos',f:'videos',c:'#185fa5'},
      {label:'Visuels',f:'visuels',c:'#0f6e56'},
    ];
    el.innerHTML=metrics.map(m=>{
      const cv=wSum(cur,m.f),pv=wSum(prev,m.f);
      const max=Math.max(cv,pv)||1;
      const pct=pv?Math.round((cv/pv-1)*100):0;
      const cls=pct>0?'up':pct<0?'dn':'fl';
      return `<div class="cmp-row"><div class="cmp-hdr"><span class="cmp-name">${m.label}</span><div class="cmp-vals"><span class="cmp-prev">${fn(pv)}</span><span style="font-size:9px;color:var(--hint)">&#8594;</span><span class="cmp-cur">${fn(cv)}</span><span class="cmp-pct ${cls}">${pct>0?'+':''}${pct}%</span></div></div><div class="bbar"><div class="bprev" style="width:${Math.round(pv/max*100)}%"></div><div class="bcur" style="width:${Math.round(cv/max*100)}%;background:${m.c};opacity:.75"></div></div></div>`;
    }).join('');
  }

  // Hist chart
  const hw=prodWeeks.slice(-8);
  if(chProdHist) chProdHist.destroy();
  chProdHist=new Chart(document.getElementById('ch-prod-hist'),{
    type:'bar',
    data:{labels:hw.map(w=>'S'+wNum(w)),datasets:[
      {label:'Creas',data:hw.map(w=>wSum(w,'creas_produites')),backgroundColor:'rgba(83,74,183,0.7)',borderRadius:4},
      {label:'Modifs',data:hw.map(w=>wSum(w,'modifs')),backgroundColor:'rgba(186,117,23,0.6)',borderRadius:4},
      {label:'Videos',data:hw.map(w=>wSum(w,'videos')),backgroundColor:'rgba(24,95,165,0.55)',borderRadius:4}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},ticks:{color:'#bbb',font:{size:10,family:'Courier New'}}},
              y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{color:'#bbb',font:{size:10,family:'Courier New'}}}}}
  });
}

function getCentRows(item) {
  if(!item) return [];
  if(currentPeriod === 'day') return centRows.filter(r=>r.date===item.key);
  if(currentPeriod === 'month') return centRows.filter(r=>r.date&&r.date.startsWith(item.key));
  // For week: get the week key and match centRows by same iso week
  const itemWeekKey = item.key; // format YYYY-Www
  return centRows.filter(r=>r.date&&isoWeek(r.date)===itemWeekKey);
}

function renderCentres() {
  const items = getPeriodItems();
  if(!items.length) return;
  const curItem = items[wIdx], prevItem = wIdx>0?items[wIdx-1]:null;
  const cRows = getCentRows(curItem);
  const pRows = prevItem ? getCentRows(prevItem) : [];

  function cSum(rows, f){ return rows.reduce((s,r)=>s+(+r[f]||0),0); }
  function cmpC(c,p){ if(!p) return ''; const pc=Math.round((c/p-1)*100); if(!pc) return '<span class="kpi-cmp fl">= stable</span>'; return pc>0?'<span class="kpi-cmp up">&#8593; +'+pc+'% vs prec.</span>':'<span class="kpi-cmp dn">&#8595; '+pc+'% vs prec.</span>'; }
  function sk(id,val,delta,ko){ document.getElementById('ct-'+id).textContent=val; document.getElementById('ctd-'+id).innerHTML=delta; document.getElementById('cto-'+id).textContent=ko; }
  const lbl = currentPeriod==='day'?'J-1':currentPeriod==='month'?'M-1':'S-1';

  const tel   = cSum(cRows,'contacts_tel'),   ptel   = cSum(pRows,'contacts_tel');
  const preinsc= cSum(cRows,'preinscriptions'),ppreinsc=cSum(pRows,'preinscriptions');
  const insc  = cSum(cRows,'inscriptions_campagne'), pinsc = cSum(pRows,'inscriptions_campagne');
  const bao   = cSum(cRows,'inscriptions_bao'),      pbao  = cSum(pRows,'inscriptions_bao');
  const ca    = cSum(cRows,'paiement_total'),         pca   = cSum(pRows,'paiement_total');
  const leads = tel + preinsc + insc;
  const pleads= ptel + ppreinsc + pinsc;
  // Budget centre vient du fichier Performance Online (rempli par le Growth)
  function pSum(rows,f){ return rows.reduce((s,r)=>s+(+r[f]||0),0); }
  const perfCurRows  = getPerfRows(curItem||{key:''});
  const perfPrevRows = prevItem ? getPerfRows(prevItem) : [];
  const budget  = pSum(perfCurRows,'budget_centre');
  const pbudget = pSum(perfPrevRows,'budget_centre');
  const cpl   = leads ? Math.round((budget||ca)/leads) : 0;
  const pcpl  = pleads ? Math.round((pbudget||pca)/pleads) : 0;
  const tconv = leads ? +((insc/leads)*100).toFixed(1) : 0;
  const ptconv= pleads ? +((pinsc/pleads)*100).toFixed(1) : 0;

  sk('tel',   fn(tel),              cmpC(tel,ptel),        pRows.length?lbl+' : '+fn(ptel):'');
  sk('preinsc',fn(preinsc),         cmpC(preinsc,ppreinsc),pRows.length?lbl+' : '+fn(ppreinsc):'');
  sk('insc',  fn(insc),             cmpC(insc,pinsc),      pRows.length?lbl+' : '+fn(pinsc):'');
  sk('bao',   fn(bao),              cmpC(bao,pbao),        pRows.length?lbl+' : '+fn(pbao):'');
  sk('ca',    fc(ca),               cmpC(ca,pca),          pRows.length?lbl+' : '+fc(pca):'');
  sk('leads', fn(leads),            cmpC(leads,pleads),    pRows.length?lbl+' : '+fn(pleads):'');
  sk('cpl',   fc(cpl),              cmpC(cpl,pcpl,true),   pRows.length?lbl+' : '+fc(pcpl):'');
  sk('tconv', tconv.toFixed(1)+'%', cmpC(tconv,ptconv),   pRows.length?lbl+' : '+ptconv.toFixed(1)+'%':'');

  // Budget, ROAS, CA/lead from perf file
  function skc(id,val,delta,ko){ 
    var v=document.getElementById('ct-'+id); if(v) v.textContent=val;
    var d=document.getElementById('ctd-'+id); if(d) d.innerHTML=delta;
    var o=document.getElementById('cto-'+id); if(o) o.textContent=ko;
  }
  var roas_c = budget>0 ? (ca/budget).toFixed(1)+'x' : '-';
  var pRoas_c = pbudget>0 ? (pca/pbudget).toFixed(1)+'x' : '-';
  var calead = leads>0 ? Math.round(ca/leads)+' DT' : '-';
  var pCalead = pleads>0 ? Math.round(pca/pleads)+' DT' : '-';
  skc('budgetc', fc(budget), cmpC(budget,pbudget), pRows.length?lbl+' : '+fc(pbudget):'');
  skc('roas', roas_c, cmpC(budget>0?ca/budget:0, pbudget>0?pca/pbudget:0), pRows.length?lbl+' : '+pRoas_c:'');
  skc('calead', calead, '', pRows.length?lbl+' : '+pCalead:'');

  document.getElementById('ct-total-badge').textContent = fn(leads)+' leads . '+fc(ca);

  // Table par centre
  const tbody = document.getElementById('centres-tbody');
  if(cRows.length) {
    const byC = {};
    CENTRES.forEach(c=>{ byC[c]={tel:0,preinsc:0,insc:0,bao:0,ca:0}; });
    cRows.forEach(r=>{
      const c = r.centre;
      if(!byC[c]) byC[c]={tel:0,preinsc:0,insc:0,bao:0,ca:0};
      byC[c].tel    += (+r.contacts_tel||0);
      byC[c].preinsc+= (+r.preinscriptions||0);
      byC[c].insc   += (+r.inscriptions_campagne||0);
      byC[c].bao    += (+r.inscriptions_bao||0);
      byC[c].ca     += (+r.paiement_total||0);
    });
    tbody.innerHTML = CENTRES.map((c,i)=>{
      const d=byC[c]||{tel:0,preinsc:0,insc:0,bao:0,ca:0};
      const leads_c=d.tel+d.preinsc+d.insc;
      const tconv_c=leads_c?((d.insc/leads_c)*100).toFixed(1)+'%':'-';
      return `<tr>
        <td style="color:${CENT_COLORS[i]};font-weight:700">${c}</td>
        <td>${fn(d.tel)}</td><td>${fn(d.preinsc)}</td>
        <td>${fn(d.insc)}</td><td>${fn(d.bao)}</td>
        <td>${fc(d.ca)}</td><td>${tconv_c}</td>
      </tr>`;
    }).join('');
    // Total row
    tbody.innerHTML += `<tr style="border-top:1px solid var(--border);font-weight:700">
      <td style="color:var(--txt)">Total</td>
      <td>${fn(tel)}</td><td>${fn(preinsc)}</td>
      <td>${fn(insc)}</td><td>${fn(bao)}</td>
      <td>${fc(ca)}</td><td>${tconv.toFixed(1)}%</td>
    </tr>`;
  } else {
    tbody.innerHTML='<tr><td colspan="7"><div class="empty">Aucune donnee - centRows: '+centRows.length+' lignes chargees | semaine: '+(curItem&&curItem.key)+'</div></td></tr>';
  }

  // Comparison S vs S-1
  const elCmp = document.getElementById('cmp-cent');
  if(!pRows.length){ elCmp.innerHTML='<div class="empty">Aucune periode precedente.</div>'; }
  else {
    const metrics=[
      {label:'Contacts tel',   cv:tel,    pv:ptel,    c:'#3b6d11'},
      {label:'Pre-inscriptions',cv:preinsc,pv:ppreinsc,c:'#185fa5'},
      {label:'Inscriptions',   cv:insc,   pv:pinsc,   c:'#ba7517'},
      {label:'CA (DT)',         cv:ca,     pv:pca,     c:'#0f6e56'},
    ];
    elCmp.innerHTML = metrics.map(m=>{
      const max=Math.max(m.cv,m.pv)||1;
      const pct=m.pv?Math.round((m.cv/m.pv-1)*100):0;
      const cls=pct>0?'up':pct<0?'dn':'fl';
      return `<div class="cmp-row"><div class="cmp-hdr"><span class="cmp-name">${m.label}</span><div class="cmp-vals"><span class="cmp-prev">${fn(m.pv)}</span><span style="font-size:9px;color:var(--hint)">&#8594;</span><span class="cmp-cur">${fn(m.cv)}</span><span class="cmp-pct ${cls}">${pct>0?'+':''}${pct}%</span></div></div><div class="bbar"><div class="bprev" style="width:${Math.round(m.pv/max*100)}%"></div><div class="bcur" style="width:${Math.round(m.cv/max*100)}%;background:${m.c};opacity:.8"></div></div></div>`;
    }).join('');
  }

  // Chart inscriptions par centre
  const byCentInsc = CENTRES.map(c=>{
    return cRows.filter(r=>r.centre===c).reduce((s,r)=>s+(+r.inscriptions_campagne||0),0);
  });
  if(chCentInsc) chCentInsc.destroy();
  chCentInsc = new Chart(document.getElementById('ch-cent-insc'),{
    type:'bar',
    data:{labels:CENTRES, datasets:[
      {label:'Inscriptions',data:byCentInsc,backgroundColor:CENT_COLORS.map(c=>c+'cc'),borderRadius:6}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},ticks:{color:'#bbb',font:{size:11,family:'Courier New'}}},
              y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{color:'#bbb',font:{size:10,family:'Courier New'}}}}}
  });

  // Chart tendance 8 semaines contacts totaux - utilise les semaines de perfWeeks comme reference
  const refW = (perfWeeks.length ? perfWeeks : smmWeeks).slice(-8);
  const histData = refW.map(w=>{
    const wr = centRows.filter(r=>r.date&&isoWeek(r.date)===w.key);
    return wr.reduce((s,r)=>s+(+r.contacts_tel||0)+(+r.preinscriptions||0),0);
  });
  const hw = refW;
  if(chCentHist) chCentHist.destroy();
  chCentHist = new Chart(document.getElementById('ch-cent-hist'),{
    type:'line',
    data:{labels:hw.map(w=>'S'+wNum(w)),datasets:[
      {label:'Leads',data:histData,borderColor:'#3b6d11',backgroundColor:'rgba(59,109,17,0.08)',borderWidth:2,pointRadius:4,pointBackgroundColor:'#3b6d11',tension:0.35,fill:true}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},ticks:{color:'#bbb',font:{size:10,family:'Courier New'}}},
              y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{color:'#bbb',font:{size:10,family:'Courier New'}}}}}
  });
}

function loadDemo() {
  function makeRows(fields, weeks=12) {
    const rows=[], start=new Date('2026-01-05');
    for(let w=0;w<weeks;w++) for(let d=0;d<5;d++){
      const dt=new Date(start); dt.setDate(start.getDate()+w*7+d);
      const r={date:dt.toISOString().slice(0,10)};
      fields.forEach(f=>{ r[f.k]=Math.round(f.base+w*f.grow+Math.random()*f.rand); });
      rows.push(r);
    }
    return rows;
  }
  perfRows=makeRows([
    {k:'ca',base:800,grow:80,rand:200},{k:'leads',base:12,grow:1.5,rand:5},
    {k:'cpl',base:60,grow:-1,rand:10},{k:'taux_conv',base:2,grow:0.1,rand:0.5},
    {k:'roas',base:3,grow:0.1,rand:0.5},{k:'budget_ads',base:500,grow:20,rand:80},
    {k:'trafic_site',base:800,grow:60,rand:150},
    {k:'gov_tunis',base:6,grow:0.5,rand:2},{k:'gov_sfax',base:3,grow:0.3,rand:1},
    {k:'gov_sousse',base:2,grow:0.2,rand:1},{k:'gov_autres',base:1,grow:0.1,rand:1},
  ]);
  smmRows=makeRows([
    {k:'reach_fb',base:5000,grow:300,rand:800},{k:'reach_ig',base:8000,grow:500,rand:1200},
    {k:'reach_li',base:2000,grow:150,rand:400},{k:'followers_fb',base:3200,grow:50,rand:80},
    {k:'followers_ig',base:2800,grow:80,rand:100},{k:'followers_li',base:1500,grow:30,rand:40},
    {k:'followers_tt',base:900,grow:60,rand:80},{k:'engagement_fb',base:3,grow:0.05,rand:0.5},
    {k:'engagement_ig',base:5,grow:0.08,rand:0.8},{k:'engagement_li',base:4,grow:0.06,rand:0.6},
    {k:'posts_total',base:2,grow:0,rand:2},
  ]);
  prodRows=makeRows([
    {k:'creas_produites',base:5,grow:0.3,rand:3},{k:'modifs',base:3,grow:0.2,rand:2},
    {k:'videos',base:1,grow:0.1,rand:1},{k:'visuels',base:3,grow:0.2,rand:2},
    {k:'copies',base:4,grow:0.2,rand:2},{k:'validees',base:4,grow:0.3,rand:2},
    {k:'refusees',base:1,grow:0,rand:1},
  ]);
  perfWeeks=buildWeeks(perfRows); smmWeeks=buildWeeks(smmRows); prodWeeks=buildWeeks(prodRows);
  wIdx=perfWeeks.length-1;
  centRows = [];
  const centresNames = ['Menzah','Aouina','Boumhal','Bardo','Mourouj'];
  for(let w=0;w<12;w++) for(let d=0;d<5;d++){
    const dt=new Date('2026-01-05'); dt.setDate(dt.getDate()+w*7+d);
    const dateStr=dt.toISOString().slice(0,10);
    centresNames.forEach(c=>{
      centRows.push({
        date:dateStr, centre:c,
        contacts_tel:Math.round(5+Math.random()*10),
        preinscriptions:Math.round(2+Math.random()*5),
        inscriptions_campagne:Math.round(1+Math.random()*3),
        inscriptions_bao:Math.round(Math.random()*2),
        paiement_total:Math.round(800+Math.random()*1200),
        budget_centre:Math.round(200+w*20+Math.random()*100)
      });
    });
  }
  centWeeks=buildWeeks(centRows);
  URL_PERF='DEMO'; URL_SMM='DEMO'; URL_PROD='DEMO'; URL_CENT='DEMO';
  document.getElementById('cfg').style.display='none';
  setStatus('demo','Mode demo'); setUptime(); renderAll();
}

/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; INIT &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
(async function(){
  const uP  = localStorage.getItem('smm_archi_url_perf') || '';
  const uS  = localStorage.getItem('archi_url_smm')  || '';
  const uPr = localStorage.getItem('smm_archi_url_prod') || '';
  const uC  = localStorage.getItem('smm_archi_url_cent') || '';
  const tP  = localStorage.getItem('smm_archi_tab_perf') || 'performance';
  const tS  = localStorage.getItem('archi_tab_smm')  || 'smm';
  const tPr = localStorage.getItem('smm_archi_tab_prod') || 'prod';
  const tC  = localStorage.getItem('smm_archi_tab_cent') || 'centres';
  if(uP || uS || uPr || uC){
    if(uP) document.getElementById('in-url-perf').value=uP;
    if(uS) document.getElementById('in-url-smm').value=uS;
    if(uPr) document.getElementById('in-url-prod').value=uPr;
    if(uC) document.getElementById('in-url-centres').value=uC;
    document.getElementById('in-tab-perf').value=tP;
    document.getElementById('in-tab-smm').value=tS;
    document.getElementById('in-tab-prod').value=tPr;
    document.getElementById('in-tab-centres').value=tC;
    URL_PERF=uP; URL_SMM=uS; URL_PROD=uPr; URL_CENT=uC;
    TAB_PERF=tP; TAB_SMM=tS; TAB_PROD=tPr; TAB_CENT=tC;
    try{
      const [rP,rS,rPr,rC]=await Promise.all([
        uP  ? fetchSheet(uP,  tP)  : Promise.resolve([]),
        uS  ? fetchSheet(uS,  tS)  : Promise.resolve([]),
        uPr ? fetchSheet(uPr, tPr) : Promise.resolve([]),
        uC  ? fetchSheet(uC,  tC)  : Promise.resolve([])
      ]);
      perfRows=rP; smmRows=rS; prodRows=rPr; centRows=rC;
      perfWeeks=buildWeeks(rP); smmWeeks=buildWeeks(rS); prodWeeks=buildWeeks(rPr); centWeeks=buildWeeks(rC);
      wIdx=Math.max(perfWeeks.length,smmWeeks.length,prodWeeks.length,centWeeks.length)-1;
      document.getElementById('cfg').style.display='none';
      setStatus('live','Connecte '+(rP.length+rS.length+rPr.length+rC.length)+' lignes');
      setUptime(); renderAll();
    } catch(e){ setStatus('err','Reconnexion requise'); }
  }
})();