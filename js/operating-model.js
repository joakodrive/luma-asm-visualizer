/* LUMA Asset Strategy & Management — Operating Model
   Reads data/structure.csv (+ structure_links.csv) and renders the same structure
   three ways (by domain / by function / matrix). Joins live initiatives from
   data/initiatives.csv. No build step; vanilla JS + PapaParse. */
'use strict';

const FUNCTION_ORDER = ['Asset Management Leadership','Reporting & Analytics','Maintenance Programs','Investment & Initiatives','Commissioning & Acceptance'];
const DOMAIN_ORDER   = ['Substation','Distribution','Transmission'];
const CROSS = 'Cross-cutting';

const COLOR = {
  type:   {function:'#0E2A47', asset:'#5b7da3', program:'#F58220', external:'#7F8C8D', input:'#2E8B7B'},
  domain: {Substation:'#2C82C9', Distribution:'#27AE60', Transmission:'#8E5DA8', 'Cross-cutting':'#7F8C8D'},
  tier:   {Owner:'#C0392B', Manager:'#0E2A47', 'Service Provider':'#2E8B7B', '':'#c2cdda'},
  functionPalette: ['#0E2A47','#2C82C9','#16A085','#F58220','#8E5DA8','#C0392B','#27AE60']
};
const TYPE_BADGE = {function:'FN', asset:'ASSET', program:'PROG', external:'EXT', input:'INPUT'};

let NODES=[], LINKS=[], INITS=[], funcColorMap={};
let viewMode='domain', colorBy='type', focusId=null;

/* ---------- LOAD ---------- */
Promise.all([
  fetch('data/structure.csv').then(r=>{if(!r.ok)throw new Error('structure.csv '+r.status);return r.text();}),
  fetch('data/structure_links.csv').then(r=>r.ok?r.text():''),     // optional
  fetch('data/initiatives.csv').then(r=>r.ok?r.text():'')          // optional (for the join)
]).then(([sText,lText,iText])=>{
  NODES = Papa.parse(sText,{header:true,skipEmptyLines:'greedy'}).data
            .filter(r=>(r.Node||'').trim()!=='')
            .map((r,i)=>({
              i, label:(r.Node||'').trim(), type:(r.Type||'').trim().toLowerCase(),
              func:(r.Function||'').trim(), domain:(r.Domain||'').trim()||CROSS,
              tier:(r.Tier||'').trim(), desc:(r.Description||'').trim(),
              id:((r.Type||'').trim().toLowerCase()==='function')
                 ? 'fn::'+(r.Function||'').trim()+'@'+((r.Domain||'').trim()||CROSS)
                 : (r.Type||'').trim().toLowerCase()+'::'+(r.Node||'').trim()
            }));
  if(lText) LINKS = Papa.parse(lText,{header:true,skipEmptyLines:'greedy'}).data
            .filter(r=>(r.Source||'').trim() && (r.Target||'').trim())
            .map(r=>({source:(r.Source||'').trim(), target:(r.Target||'').trim(),
                      rel:(r.Relationship||'').trim()||'related', style:(r.Style||'').trim()||'dashed'}));
  if(iText) INITS = Papa.parse(iText,{header:true,skipEmptyLines:'greedy'}).data
            .filter(r=>(r.Name||'').trim())
            .map(r=>({name:(r.Name||'').trim(), cat:(r.Category||'').trim(),
                      assets:[(r['Assets Involved']||'').trim(),(r['Assets Involved 2']||'').trim()].filter(Boolean),
                      owner:(r.Owner||'').trim()||'Unassigned', collab:(r.Collaborator||'').trim(),
                      person:(r['Person in Charge']||'').trim()}));
  // function color palette
  const fns=[...new Set(NODES.filter(n=>n.func).map(n=>n.func))];
  orderedFns().concat(fns).forEach(f=>{ if(f && !(f in funcColorMap)){ funcColorMap[f]=COLOR.functionPalette[Object.keys(funcColorMap).length % COLOR.functionPalette.length]; } });
  wire(); renderPrinciple(); renderInterfaces(); render();
}).catch(err=>{
  const el=document.getElementById('loadError');
  el.hidden=false;
  el.innerHTML='Could not load <code>data/structure.csv</code> ('+err.message+').<br>Open via GitHub Pages or a local web server — file:// blocks fetch.';
});

/* ---------- helpers ---------- */
function esc(s){return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function byId(id){return NODES.find(n=>n.id===id);}
function nodeByName(name){return NODES.find(n=>n.type!=='function'&&n.label===name);}
function orderedFns(){ const present=[...new Set(NODES.filter(n=>n.type==='function').map(n=>n.func))];
  return FUNCTION_ORDER.filter(f=>present.includes(f)).concat(present.filter(f=>!FUNCTION_ORDER.includes(f))); }
function orderedDomains(){ const present=[...new Set(NODES.map(n=>n.domain))].filter(d=>d!==CROSS);
  return DOMAIN_ORDER.filter(d=>present.includes(d)).concat(present.filter(d=>!DOMAIN_ORDER.includes(d))); }
function colorFor(n){
  if(colorBy==='type')   return COLOR.type[n.type]||'#c2cdda';
  if(colorBy==='domain') return COLOR.domain[n.domain]||'#7F8C8D';
  if(colorBy==='tier')   return COLOR.tier[n.tier]!==undefined?COLOR.tier[n.tier]:'#c2cdda';
  if(colorBy==='function')return n.func?(funcColorMap[n.func]||'#c2cdda'):'#c2cdda';
  return '#c2cdda';
}
function cardHTML(n){
  const c=colorFor(n);
  const tier = n.tier? '<span class="tier-pill" style="background:'+COLOR.tier[n.tier]+'">'+esc(n.tier)+'</span>':'';
  return '<div class="node-card n-'+n.type+'" data-id="'+esc(n.id)+'" style="border-color:'+c+'">'+
           '<div class="nc-top"><span class="dot" style="background:'+c+'"></span>'+
           '<span class="nc-name">'+esc(n.label)+tier+'</span>'+
           '<span class="nc-badge">'+(TYPE_BADGE[n.type]||'')+'</span></div></div>';
}

/* ---------- VIEW: by domain ---------- */
function renderDomain(){
  const doms=orderedDomains();
  let h='<div class="cols">';
  doms.forEach(dom=>{
    h+='<div class="col"><h2>'+esc(dom)+'</h2><div class="col-sub">Asset domain</div>';
    const fns=NODES.filter(n=>n.type==='function'&&n.domain===dom);
    if(fns.length){ h+='<div class="subhead">AM Functions</div>'+fns.map(cardHTML).join(''); }
    const progs=NODES.filter(n=>n.type==='program'&&n.domain===dom);
    if(progs.length){ h+='<div class="subhead">Programs</div>'+progs.map(cardHTML).join(''); }
    const assets=NODES.filter(n=>n.type==='asset'&&n.domain===dom);
    if(assets.length){ h+='<div class="subhead">Assets</div>'+assets.map(cardHTML).join(''); }
    h+='</div>';
  });
  // cross-cutting column
  const crossNodes=NODES.filter(n=>n.domain===CROSS && n.type!=='external' && n.type!=='input');
  if(crossNodes.length){
    h+='<div class="col"><h2>Cross-cutting</h2><div class="col-sub">Spans all domains</div>'+
       crossNodes.map(cardHTML).join('')+'</div>';
  }
  h+='</div>';
  document.getElementById('board').innerHTML=h;
}

/* ---------- VIEW: by function ---------- */
function renderFunction(){
  const fns=orderedFns();
  let h='<div class="cols">';
  fns.forEach(fn=>{
    const cells=NODES.filter(n=>n.type==='function'&&n.func===fn);
    const domains=[...new Set(cells.map(c=>c.domain))];
    h+='<div class="col"><h2>'+esc(fn)+'</h2><div class="col-sub">AM function</div>';
    h+='<div class="subhead">Operates across</div><div class="chips-wrap">'+
       (domains.length?domains.map(d=>'<span class="dchip">'+esc(d)+'</span>').join(''):'<span class="mini-note">—</span>')+'</div>';
    // representative card (first cell) so it is clickable/colored
    if(cells.length){ h+='<div class="subhead">Detail</div>'+cardHTML(cells[0]); }
    const progs=NODES.filter(n=>n.type==='program'&&n.func===fn);
    if(progs.length){ h+='<div class="subhead">Programs</div>'+progs.map(cardHTML).join(''); }
    h+='</div>';
  });
  h+='</div>';
  document.getElementById('board').innerHTML=h;
}

/* ---------- VIEW: matrix ---------- */
function renderMatrix(){
  const fns=orderedFns(), doms=orderedDomains();
  // cross-cutting functions shown as a band above
  const crossFns=NODES.filter(n=>n.type==='function'&&n.domain===CROSS);
  const crossProg=NODES.filter(n=>n.type==='program'&&n.domain===CROSS);
  let h='';
  if(crossFns.length||crossProg.length){
    h+='<div class="cross-band"><h3>Cross-cutting</h3><div class="chips-wrap">'+
        crossFns.concat(crossProg).map(cardHTML).join('')+'</div></div>';
  }
  h+='<table class="om-matrix"><thead><tr><th>Function \\ Domain</th>'+
       doms.map(d=>'<th>'+esc(d)+'</th>').join('')+'</tr></thead><tbody>';
  fns.filter(f=>!crossFns.some(c=>c.func===f)).forEach(fn=>{
    h+='<tr><td class="rowhead">'+esc(fn)+'</td>';
    doms.forEach(dom=>{
      const cell=NODES.find(n=>n.type==='function'&&n.func===fn&&n.domain===dom);
      const progs=NODES.filter(n=>n.type==='program'&&n.func===fn&&n.domain===dom);
      h+='<td class="cell">'+(cell?cardHTML(cell):'<span class="mini-note">—</span>')+
         progs.map(cardHTML).join('')+'</td>';
    });
    h+='</tr>';
  });
  // assets row
  h+='<tr class="assets-row"><td class="assets-label">Assets</td>'+
     doms.map(dom=>'<td>'+NODES.filter(n=>n.type==='asset'&&n.domain===dom).map(cardHTML).join('')+'</td>').join('')+
     '</tr>';
  h+='</tbody></table>';
  document.getElementById('board').innerHTML=h;
}

/* ---------- principle banner ---------- */
function renderPrinciple(){
  const steps=[
    {t:'Levels of Service & Risk Appetite'},
    {t:'Data & Analytics'},
    {t:'Risk Assessment (PoF × CoF)'},
    {t:'Maintenance (risk + standards)', in:true},
    {t:'Long-term Initiatives (risk + EOL + economics)', in:true},
    {t:'Execution (Operations)'}
  ];
  document.getElementById('omPrinciple').innerHTML =
    steps.map((s,i)=>(i?'<span class="arr">→</span>':'')+'<span class="step'+(s.in?' in':'')+'">'+esc(s.t)+'</span>').join('')+
    '<span class="loop">↺ execution generates new data</span>';
}

/* ---------- external interfaces band ---------- */
function renderInterfaces(){
  const ext=NODES.filter(n=>n.type==='external');
  document.getElementById('omInterfaces').innerHTML =
    '<h3>External Interfaces — Asset Management directs; these teams support or execute</h3><div class="row">'+
    ext.map(n=>{
      const sp=n.tier==='Service Provider';
      return '<div class="iface" data-id="'+esc(n.id)+'" title="'+esc(n.desc)+'">'+esc(n.label)+
             '<span class="role'+(sp?' sp':'')+'">'+esc(n.tier||'Support')+'</span></div>';
    }).join('')+'</div>';
}

/* ---------- legend ---------- */
function renderLegend(){
  let entries=[];
  if(colorBy==='type')   entries=Object.entries(COLOR.type).map(([k,v])=>[k,v]);
  if(colorBy==='domain') entries=Object.entries(COLOR.domain);
  if(colorBy==='tier')   entries=[['Owner',COLOR.tier.Owner],['Manager',COLOR.tier.Manager],['Service Provider',COLOR.tier['Service Provider']],['(unset)',COLOR.tier['']]];
  if(colorBy==='function')entries=orderedFns().map(f=>[f,funcColorMap[f]]);
  document.getElementById('omLegend').innerHTML =
    entries.map(([k,v])=>'<span class="lg"><span class="sw" style="background:'+v+'"></span>'+esc(k)+'</span>').join('');
}

/* ---------- render dispatch ---------- */
function render(){
  if(viewMode==='domain') renderDomain();
  else if(viewMode==='function') renderFunction();
  else renderMatrix();
  renderLegend();
  applyFocus();
  wireCards();
  drawTies();
}

/* ---------- focus / ties ---------- */
function linkedIds(id){
  const n=byId(id); if(!n) return [];
  const out=new Set();
  LINKS.forEach(l=>{
    if(l.source===n.label){ const t=nodeByName(l.target); if(t) out.add(t.id); }
    if(l.target===n.label){ const s=nodeByName(l.source); if(s) out.add(s.id); }
  });
  return [...out];
}
function applyFocus(){
  const board=document.getElementById('board');
  const cards=board.querySelectorAll('.node-card');
  if(!focusId){ cards.forEach(c=>c.classList.remove('focus','linked','dim')); document.getElementById('clearFocus').hidden=true; return; }
  document.getElementById('clearFocus').hidden=false;
  const lk=new Set(linkedIds(focusId));
  cards.forEach(c=>{
    const id=c.dataset.id;
    c.classList.toggle('focus', id===focusId);
    c.classList.toggle('linked', lk.has(id));
    c.classList.toggle('dim', id!==focusId && !lk.has(id));
  });
}
function drawTies(){
  const svg=document.getElementById('ties');
  svg.innerHTML='';
  if(!focusId) return;
  const main=document.querySelector('.om-main');
  const base=main.getBoundingClientRect();
  const src=document.querySelector('.node-card.focus');
  if(!src) return;
  const sr=src.getBoundingClientRect();
  const sx=sr.left-base.left+sr.width/2+main.scrollLeft, sy=sr.top-base.top+sr.height/2+main.scrollTop;
  linkedIds(focusId).forEach(id=>{
    const el=document.querySelector('.node-card[data-id="'+cssEsc(id)+'"]');
    if(!el) return;
    const r=el.getBoundingClientRect();
    const x=r.left-base.left+r.width/2+main.scrollLeft, y=r.top-base.top+r.height/2+main.scrollTop;
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',sx);line.setAttribute('y1',sy);line.setAttribute('x2',x);line.setAttribute('y2',y);
    svg.appendChild(line);
  });
}
function cssEsc(s){ return (window.CSS&&CSS.escape)?CSS.escape(s):s.replace(/["\\]/g,'\\$&'); }

/* ---------- side panel ---------- */
function openPanel(html){document.getElementById('panelContent').innerHTML=html;document.getElementById('sidePanel').classList.add('open');document.getElementById('panelScrim').hidden=false;}
function closePanel(){document.getElementById('sidePanel').classList.remove('open');document.getElementById('panelScrim').hidden=true;}
function showNode(n){
  const c=colorFor(n);
  let h='<div class="panel-sub">'+esc(n.type)+(n.domain&&n.domain!==CROSS?' · '+esc(n.domain):'')+'</div>'+
        '<div class="panel-h"><span class="dot" style="display:inline-block;width:11px;height:11px;border-radius:50%;background:'+c+';margin-right:7px"></span>'+esc(n.label)+'</div>';
  if(n.func)  h+='<div class="kv"><div class="k">Function</div><div class="v">'+esc(n.func)+'</div></div>';
  if(n.tier)  h+='<div class="kv"><div class="k">Governance tier</div><div class="v"><span class="tier-pill" style="background:'+COLOR.tier[n.tier]+'">'+esc(n.tier)+'</span></div></div>';
  if(n.desc)  h+='<div class="kv"><div class="k">Description</div><div class="v">'+esc(n.desc)+'</div></div>';

  // ties out (acts-on / interfaces)
  const out=LINKS.filter(l=>l.source===n.label);
  if(out.length){
    h+='<div class="kv"><div class="k">Connections</div><div class="v">';
    h+=out.map(l=>{const t=nodeByName(l.target);return '<div class="list-item" '+(t?'data-id="'+esc(t.id)+'"':'')+'>'+esc(l.rel)+' → <b>'+esc(l.target)+'</b></div>';}).join('');
    h+='</div></div>';
  }
  // reverse ties (programs that act on this asset / external referenced by programs)
  const incoming=LINKS.filter(l=>l.target===n.label);
  if(incoming.length){
    h+='<div class="kv"><div class="k">Referenced by</div><div class="v">';
    h+=incoming.map(l=>{const s=nodeByName(l.source);return '<div class="list-item" '+(s?'data-id="'+esc(s.id)+'"':'')+'><b>'+esc(l.source)+'</b> '+esc(l.rel)+' this</div>';}).join('');
    h+='</div></div>';
  }
  // live initiatives join
  let inits=[];
  if(n.type==='program') inits=INITS.filter(i=>i.name===n.label);
  else if(n.type==='asset') inits=INITS.filter(i=>i.assets.includes(n.label));
  if(inits.length){
    h+='<div class="kv"><div class="k">Live initiatives ('+inits.length+')</div><div class="v">';
    h+=inits.map(i=>'<div class="list-item"><b>'+esc(i.name)+'</b><div class="li-sub">Owner: '+esc(i.owner)+(i.person?' · '+esc(i.person):'')+'</div></div>').join('');
    h+='</div></div>';
    h+='<div class="mini-note">Pulled live from the initiative portfolio (initiatives.csv).</div>';
  }
  openPanel(h);
  // wire panel jumps
  document.querySelectorAll('#panelContent .list-item[data-id]').forEach(el=>{
    el.onclick=()=>{ const t=byId(el.dataset.id); if(t){ focusId=t.id; applyFocus(); drawTies(); showNode(t); } };
  });
}

/* ---------- wiring ---------- */
function wireCards(){
  document.querySelectorAll('#board .node-card').forEach(el=>{
    el.onclick=(e)=>{ e.stopPropagation(); const n=byId(el.dataset.id); if(!n) return;
      focusId = (focusId===n.id)? null : n.id; applyFocus(); drawTies(); if(focusId) showNode(n); };
  });
}
function wire(){
  document.querySelectorAll('#viewSeg button').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#viewSeg button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); viewMode=b.dataset.view; render();
  });
  document.getElementById('colorBy').onchange=e=>{ colorBy=e.target.value; render(); };
  document.getElementById('clearFocus').onclick=()=>{ focusId=null; applyFocus(); drawTies(); };
  document.getElementById('closePanel').onclick=closePanel;
  document.getElementById('panelScrim').onclick=closePanel;
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closePanel(); focusId=null; applyFocus(); drawTies(); } });
  document.getElementById('omInterfaces').addEventListener('click',e=>{
    const f=e.target.closest('.iface'); if(f){ const n=byId(f.dataset.id); if(n){ focusId=n.id; applyFocus(); drawTies(); showNode(n);} }
  });
  window.addEventListener('resize',drawTies);
  document.querySelector('.om-main').addEventListener('scroll',drawTies);
}
