/* LUMA Asset Strategy & Management — Initiative Portfolio Visualizer
   No build step. Reads data/initiatives.csv at load and derives all views. */
'use strict';

const COLS = ['Category','Name','Assets Involved','Assets Involved 2','Description','Owner','Collaborator','Person in Charge'];
const PALETTE = ['#F58220','#0E2A47','#2E8B7B','#8E5DA8','#C0392B','#2C82C9','#E0A800','#16A085',
                 '#D35400','#7F8C8D','#9B59B6','#27AE60','#2980B9','#E74C3C','#1ABC9C','#34495E'];
const UNASSIGNED = 'Unassigned';

let MODEL = null;
const teamColor = {};
let activeFilter = null;   // {type:'asset'|'person'|'team', value, category?}

/* ---------- LOAD ---------- */
fetch('data/initiatives.csv')
  .then(r => { if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); })
  .then(text => {
    const parsed = Papa.parse(text, {header:true, skipEmptyLines:'greedy'});
    const rows = parsed.data.filter(r => (r.Name||'').trim() !== '');
    MODEL = buildModel(rows);
    assignColors(MODEL.teams);
    renderLegend(); renderNetwork(); renderDashboard(); renderTable(); wireUI();
  })
  .catch(err => {
    const el = document.getElementById('loadError');
    el.hidden = false;
    el.innerHTML = 'Could not load <code>data/initiatives.csv</code> (' + err.message +
      ').<br>Run via a web server or GitHub Pages — opening index.html directly with file:// blocks fetch.';
  });

/* ---------- MODEL ---------- */
function buildModel(rows){
  const initiatives = rows.map((r,i) => ({
    id:'init-'+i,
    category:(r['Category']||'Other').trim(),
    name:(r['Name']||'').trim(),
    asset1:(r['Assets Involved']||'').trim(),
    asset2:(r['Assets Involved 2']||'').trim(),
    description:(r['Description']||'').trim(),
    owner:(r['Owner']||'').trim() || UNASSIGNED,
    collaborator:(r['Collaborator']||'').trim(),
    person:(r['Person in Charge']||'').trim() || UNASSIGNED
  }));
  const categories = [...new Set(initiatives.map(d=>d.category))];
  const teamsSet = new Set();
  initiatives.forEach(d=>{ if(d.owner) teamsSet.add(d.owner); if(d.collaborator) teamsSet.add(d.collaborator); });
  const teams = [...teamsSet].sort();
  const persons = [...new Set(initiatives.map(d=>d.person))].sort();
  return {initiatives, categories, teams, persons};
}
function assetsOf(d){ return [d.asset1,d.asset2].filter(Boolean); }
function assignColors(teams){
  teams.forEach((t,i)=>{ teamColor[t] = (t===UNASSIGNED)?'#9aa6b3':PALETTE[i%PALETTE.length]; });
  teamColor[UNASSIGNED]='#9aa6b3';
}
function colorFor(team){ return teamColor[team] || '#9aa6b3'; }

/* ---------- NETWORK GRAPH (D3 v7 force) ---------- */
let simulation, gZoom, svgSel;
function buildGraphData(){
  const nodes=[], links=[];
  nodes.push({id:'root', type:'root', label:'Asset Management'});
  MODEL.categories.forEach(cat=>{
    const cid='cat-'+cat;
    nodes.push({id:cid, type:'category', label:cat, collapsed:false});
    links.push({source:'root', target:cid, kind:'own'});
    const assetMap={};
    MODEL.initiatives.filter(d=>d.category===cat).forEach(d=>{
      const as = assetsOf(d);
      const primary = as[0] || '(no asset)';
      (assetMap[primary] = assetMap[primary] || []).push(d);
    });
    Object.keys(assetMap).forEach(asset=>{
      const aid='asset-'+cat+'-'+asset;
      nodes.push({id:aid, type:'asset', label:asset, category:cat});
      links.push({source:cid, target:aid, kind:'own'});
      assetMap[asset].forEach(d=>{
        nodes.push({id:d.id, type:'init', label:d.name, data:d});
        links.push({source:aid, target:d.id, kind:'own', color:colorFor(d.owner)});
      });
    });
  });
  return {nodes, links};
}

function renderNetwork(){
  const host = document.getElementById('graph');
  host.innerHTML='';
  const {nodes, links} = buildGraphData();
  const W=host.clientWidth, H=host.clientHeight;
  const svg = d3.select(host).append('svg').attr('viewBox',[0,0,W,H]);
  svgSel = svg;
  const root = svg.append('g'); gZoom = root;
  const zoom = d3.zoom().scaleExtent([0.25,3]).on('zoom',ev=>root.attr('transform',ev.transform));
  svg.call(zoom);

  const link = root.append('g').selectAll('line').data(links).join('line')
     .attr('class',d=>'link '+(d.kind==='collab'?'collab':''))
     .attr('stroke',d=>d.color||null);

  const node = root.append('g').selectAll('g').data(nodes).join('g')
     .attr('class','node')
     .call(d3.drag()
        .on('start',(ev,d)=>{if(!ev.active)simulation.alphaTarget(.3).restart();d.fx=d.x;d.fy=d.y;})
        .on('drag',(ev,d)=>{d.fx=ev.x;d.fy=ev.y;})
        .on('end',(ev,d)=>{if(!ev.active)simulation.alphaTarget(0);d.fx=null;d.fy=null;}));

  node.append('circle')
     .attr('r',d=> d.type==='root'?26: d.type==='category'?18: d.type==='asset'?10:7)
     .attr('fill',d=>{
        if(d.type==='root') return 'var(--luma-orange)';
        if(d.type==='category') return 'var(--luma-navy)';
        if(d.type==='asset') return '#5b7da3';
        return colorFor(d.data.owner);
     })
     .attr('stroke',d=> d.type==='init' && d.data.collaborator ? '#e0a36a':'#fff')
     .attr('stroke-width',d=> d.type==='init' && d.data.collaborator ? 2.5:1.5)
     .attr('stroke-dasharray',d=> d.type==='init' && d.data.collaborator ? '3 2':null);

  node.append('text')
     .attr('x',d=> (d.type==='root'||d.type==='category')?0:11)
     .attr('y',d=> (d.type==='root'||d.type==='category')?4:3)
     .attr('text-anchor',d=> (d.type==='root'||d.type==='category')?'middle':'start')
     .attr('font-weight',d=> (d.type==='root'||d.type==='category')?'700':'400')
     .attr('fill',d=> (d.type==='root'||d.type==='category')?'#fff':null)
     .text(d=> d.label.length>34? d.label.slice(0,32)+'…':d.label);

  const tip = d3.select('body').append('div').attr('class','tooltip').style('opacity',0);
  node.on('mouseover',(ev,d)=>{
        let html = '<b>'+d.label+'</b>';
        if(d.type==='init') html += '<br>Owner: '+d.data.owner + (d.data.collaborator?'<br>Collab: '+d.data.collaborator:'');
        if(d.type==='asset') html += '<br>Asset class · '+d.category;
        tip.html(html).style('opacity',1);
     })
     .on('mousemove',ev=>tip.style('left',(ev.pageX+12)+'px').style('top',(ev.pageY-10)+'px'))
     .on('mouseout',()=>tip.style('opacity',0))
     .on('click',(ev,d)=>{
        ev.stopPropagation();
        if(d.type==='init') showInitiative(d.data);
        else if(d.type==='asset') filterByAsset(d.label, d.category);
        else if(d.type==='category') toggleCategory(d, node, link);
        else clearFilter();
     });

  simulation = d3.forceSimulation(nodes)
     .force('link', d3.forceLink(links).id(d=>d.id).distance(d=>d.target.type==='init'?42:90).strength(.7))
     .force('charge', d3.forceManyBody().strength(-220))
     .force('center', d3.forceCenter(W/2,H/2))
     .force('collide', d3.forceCollide().radius(d=>d.type==='init'?16:26))
     .on('tick',()=>{
        link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
        node.attr('transform',d=>`translate(${d.x},${d.y})`);
     });

  svg.on('click',()=>clearFilter());
  MODEL._d3 = {node, link};
  applyFilterStyles();
}

function toggleCategory(cat, node, link){
  cat.collapsed = !cat.collapsed;
  node.style('display',n=>{
     if(n.type==='asset' && n.category===cat.label) return cat.collapsed?'none':null;
     if(n.type==='init' && n.data.category===cat.label) return cat.collapsed?'none':null;
     return null;
  });
  link.style('display',l=>{
     const s=l.source, t=l.target;
     if((s.type==='asset'&&s.category===cat.label)||(t.type==='asset'&&t.category===cat.label)) return cat.collapsed?'none':null;
     if((t.type==='init'&&t.data.category===cat.label)) return cat.collapsed?'none':null;
     return null;
  });
}

/* ---------- FILTERS ---------- */
function filterByAsset(asset, category){
  activeFilter = {type:'asset', value:asset, category};
  const matches = MODEL.initiatives.filter(d=> assetsOf(d).includes(asset) && (!category||d.category===category));
  showFilterBar('Asset: '+asset+(category?' ('+category+')':'')+' — '+matches.length+' initiative(s)');
  applyFilterStyles();
  panelList('Asset · '+asset, category||'', matches);
}
function filterByPerson(person){
  activeFilter = {type:'person', value:person};
  const matches = MODEL.initiatives.filter(d=>d.person===person);
  showFilterBar('Person in Charge: '+person+' — '+matches.length+' initiative(s)');
  applyFilterStyles();
  panelList('Person in Charge', person, matches);
}
function clearFilter(){ activeFilter=null; document.getElementById('filterBar').hidden=true; applyFilterStyles(); }
function showFilterBar(text){ document.getElementById('filterBar').hidden=false; document.getElementById('filterLabel').textContent=text; }
function matchInit(d){
  if(!activeFilter) return true;
  if(activeFilter.type==='asset') return assetsOf(d).includes(activeFilter.value) && (!activeFilter.category||d.category===activeFilter.category);
  if(activeFilter.type==='person') return d.person===activeFilter.value;
  if(activeFilter.type==='team') return d.owner===activeFilter.value || d.collaborator===activeFilter.value;
  return true;
}
function applyFilterStyles(){
  if(!MODEL._d3) return;
  const {node, link}=MODEL._d3;
  node.classed('dim', n=> activeFilter && n.type==='init' && !matchInit(n.data));
  link.classed('dim', l=> activeFilter && l.target.type==='init' && !matchInit(l.target.data));
}

/* ---------- SIDE PANEL ---------- */
function openPanel(html){
  document.getElementById('panelContent').innerHTML=html;
  document.getElementById('sidePanel').classList.add('open');
  document.getElementById('panelScrim').hidden=false;
}
function closePanel(){ document.getElementById('sidePanel').classList.remove('open'); document.getElementById('panelScrim').hidden=true; }
function chip(team, ghost){
  const c = ghost?'':('style="background:'+colorFor(team)+'"');
  return '<span class="chip '+(ghost?'ghost':'')+'" '+c+' data-team="'+esc(team)+'"><span class="dot"></span>'+esc(team)+'</span>';
}
function showInitiative(d){
  const html =
    '<div class="panel-sub">'+esc(d.category)+' Initiative</div>'+
    '<div class="panel-h">'+esc(d.name)+'</div>'+
    '<div class="kv"><div class="k">Description</div><div class="v">'+esc(d.description||'—')+'</div></div>'+
    '<div class="kv"><div class="k">Assets Involved</div><div class="v">'+(assetsOf(d).map(esc).join(', ')||'—')+'</div></div>'+
    '<div class="kv"><div class="k">Owner</div><div class="v">'+ (d.owner===UNASSIGNED?'<span class="chip" style="background:#9aa6b3"><span class="dot"></span>Unassigned ⚠</span>':chip(d.owner)) +'</div></div>'+
    '<div class="kv"><div class="k">Collaborator</div><div class="v">'+(d.collaborator?chip(d.collaborator):'—')+'</div></div>'+
    '<div class="kv"><div class="k">Person in Charge</div><div class="v"><span class="chip ghost" data-person="'+esc(d.person)+'">👤 '+esc(d.person)+'</span></div></div>';
  openPanel(html); wirePanelChips();
}
function panelList(kind, sub, items){
  let html = '<div class="panel-sub">'+esc(kind)+'</div><div class="panel-h">'+esc(sub||kind)+'</div>'+
    '<div class="panel-sub" style="margin-top:8px">'+items.length+' initiative(s)</div>';
  items.forEach(d=>{
    html += '<div class="list-item" data-init="'+d.id+'">'+esc(d.name)+
      '<div class="li-sub">'+esc(d.category)+' · Owner: '+esc(d.owner)+(d.collaborator?' · Collab: '+esc(d.collaborator):'')+'</div></div>';
  });
  openPanel(html);
  document.querySelectorAll('#panelContent .list-item').forEach(el=>{
    el.onclick=()=>{ const d=MODEL.initiatives.find(x=>x.id===el.dataset.init); showInitiative(d); };
  });
}
function showTeam(team){
  const owns = MODEL.initiatives.filter(d=>d.owner===team);
  const collabs = MODEL.initiatives.filter(d=>d.collaborator===team);
  const inter = {};
  MODEL.initiatives.forEach(d=>{
    if(d.owner===team && d.collaborator) inter[d.collaborator]=(inter[d.collaborator]||0)+1;
    if(d.collaborator===team && d.owner!==UNASSIGNED) inter[d.owner]=(inter[d.owner]||0)+1;
  });
  let html =
    '<div class="panel-sub">Team</div><div class="panel-h">'+chip(team)+'</div>'+
    '<div class="stat-row"><div class="stat"><div class="n">'+owns.length+'</div><div class="l">Owns</div></div>'+
    '<div class="stat"><div class="n">'+collabs.length+'</div><div class="l">Collaborates</div></div></div>';
  html += '<div class="kv"><div class="k">Interconnects with</div><div class="v">';
  const ks = Object.keys(inter).sort((a,b)=>inter[b]-inter[a]);
  html += ks.length? ks.map(t=>chip(t,true)+' <b>'+inter[t]+'</b>').join('  '):'—';
  html += '</div></div>';
  html += '<div class="kv"><div class="k">Owns ('+owns.length+')</div></div>';
  owns.forEach(d=> html+='<div class="list-item" data-init="'+d.id+'">'+esc(d.name)+'<div class="li-sub">'+esc(d.category)+'</div></div>');
  if(collabs.length){
    html += '<div class="kv"><div class="k">Collaborates on ('+collabs.length+')</div></div>';
    collabs.forEach(d=> html+='<div class="list-item" data-init="'+d.id+'">'+esc(d.name)+'<div class="li-sub">'+esc(d.category)+' · Owner: '+esc(d.owner)+'</div></div>');
  }
  openPanel(html);
  document.querySelectorAll('#panelContent .list-item').forEach(el=>{
    el.onclick=()=>showInitiative(MODEL.initiatives.find(x=>x.id===el.dataset.init));
  });
  wirePanelChips();
}
function wirePanelChips(){
  document.querySelectorAll('#panelContent .chip[data-team]').forEach(el=>{ el.onclick=()=>showTeam(el.dataset.team); });
  document.querySelectorAll('#panelContent .chip[data-person]').forEach(el=>{ el.onclick=()=>{ closePanel(); filterByPerson(el.dataset.person); }; });
}

/* ---------- DASHBOARD ---------- */
function countBy(arr, fn){ const m={}; arr.forEach(d=>{const k=fn(d); m[k]=(m[k]||0)+1;}); return m; }
function barChart(map, accent){
  const max=Math.max(...Object.values(map),1);
  return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([k,v])=>
    '<div class="bar-row"><div class="lab">'+esc(k)+'</div>'+
    '<div class="bar" style="width:'+(v/max*180+8)+'px;background:'+(accent||'var(--luma-orange)')+'"></div>'+
    '<div class="val">'+v+'</div></div>').join('');
}
function renderDashboard(){
  const I=MODEL.initiatives;
  const unassigned = I.filter(d=>d.owner===UNASSIGNED);
  const byCat=countBy(I,d=>d.category), byOwner=countBy(I,d=>d.owner), byPerson=countBy(I,d=>d.person);
  const owners=[...new Set(I.map(d=>d.owner))].sort();
  let matrix='<table class="matrix"><tr><th>Owner \\ Category</th>'+MODEL.categories.map(c=>'<th>'+esc(c)+'</th>').join('')+'<th>Σ</th></tr>';
  owners.forEach(o=>{
    matrix+='<tr><td class="rowh">'+(o===UNASSIGNED?'⚠ Unassigned':esc(o))+'</td>';
    let rt=0;
    MODEL.categories.forEach(c=>{
      const n=I.filter(d=>d.owner===o&&d.category===c).length; rt+=n;
      matrix+= n? '<td class="has" style="background:'+colorFor(o)+'">'+n+'</td>':'<td>·</td>';
    });
    matrix+='<td><b>'+rt+'</b></td></tr>';
  });
  matrix+='</table>';
  const pairs={};
  I.forEach(d=>{ if(d.collaborator){const key=d.owner+' → '+d.collaborator; pairs[key]=(pairs[key]||0)+1;} });
  const interRows=Object.entries(pairs).sort((a,b)=>b[1]-a[1])
     .map(([k,v])=>'<div class="bar-row"><div class="lab" style="width:230px">'+esc(k)+'</div><div class="bar" style="width:'+(v*22+8)+'px"></div><div class="val">'+v+'</div></div>').join('');

  document.getElementById('dashboard').innerHTML =
   '<div class="dash-grid">'+
   '<div class="card callout"><h3>Data-quality callout</h3><div class="big">'+unassigned.length+'</div>'+
     '<div style="margin-top:6px;color:#8a4b12;font-weight:600">initiatives have NO owner assigned (governance gaps)</div>'+
     '<div style="margin-top:10px">'+unassigned.map(d=>'<div class="list-item" data-init="'+d.id+'">'+esc(d.name)+'<div class="li-sub">'+esc(d.category)+'</div></div>').join('')+'</div></div>'+
   '<div class="card"><h3>Initiatives by Category</h3>'+barChart(byCat,'var(--luma-navy)')+'</div>'+
   '<div class="card"><h3>Initiatives by Owner Team</h3>'+barChart(byOwner)+'</div>'+
   '<div class="card"><h3>Initiatives by Person in Charge</h3>'+barChart(byPerson,'#2E8B7B')+'</div>'+
   '<div class="card" style="grid-column:1/-1"><h3>Ownership Matrix (Owner × Category)</h3>'+matrix+'</div>'+
   '<div class="card" style="grid-column:1/-1"><h3>Team Interconnections (Owner → Collaborator)</h3>'+interRows+'</div>'+
   '</div>';
  document.querySelectorAll('#dashboard .list-item').forEach(el=>{
    el.onclick=()=>{switchView('network'); showInitiative(MODEL.initiatives.find(x=>x.id===el.dataset.init));};
  });
}

/* ---------- TABLE ---------- */
let sortKey='category', sortDir=1;
function renderTable(){
  const cols=[['category','Category'],['name','Name'],['asset1','Assets'],['owner','Owner'],['collaborator','Collaborator'],['person','Person'],['description','Description']];
  const wrap=document.getElementById('tableWrap');
  wrap.innerHTML='<div class="tbl-controls"><input id="tblSearch" placeholder="Filter table…"/></div><div id="tblBody"></div>';
  const draw=(q)=>{
    let rows=MODEL.initiatives.slice();
    if(q){q=q.toLowerCase(); rows=rows.filter(d=>[d.name,d.description,d.owner,d.collaborator,d.person,d.asset1,d.asset2,d.category].join(' ').toLowerCase().includes(q));}
    rows.sort((a,b)=>{const x=(a[sortKey]||'').toString().toLowerCase(),y=(b[sortKey]||'').toString().toLowerCase();return x<y?-sortDir:x>y?sortDir:0;});
    let h='<table class="dtable"><tr>'+cols.map(c=>'<th data-k="'+c[0]+'">'+c[1]+(sortKey===c[0]?(sortDir>0?' ▲':' ▼'):'')+'</th>').join('')+'</tr>';
    rows.forEach(d=>{
      h+='<tr data-init="'+d.id+'" '+(d.owner===UNASSIGNED?'class="unassigned"':'')+'>'+
         '<td>'+esc(d.category)+'</td><td><b>'+esc(d.name)+'</b></td><td>'+esc(assetsOf(d).join(', ')||'—')+'</td>'+
         '<td>'+esc(d.owner)+'</td><td>'+esc(d.collaborator||'—')+'</td><td>'+esc(d.person)+'</td>'+
         '<td style="max-width:340px">'+esc(d.description)+'</td></tr>';
    });
    h+='</table>';
    document.getElementById('tblBody').innerHTML=h;
    document.querySelectorAll('#tblBody th').forEach(th=>th.onclick=()=>{const k=th.dataset.k; if(k===sortKey)sortDir*=-1; else{sortKey=k;sortDir=1;} draw(document.getElementById('tblSearch').value);});
    document.querySelectorAll('#tblBody tr[data-init]').forEach(tr=>tr.onclick=()=>{switchView('network');showInitiative(MODEL.initiatives.find(x=>x.id===tr.dataset.init));});
  };
  draw('');
  document.getElementById('tblSearch').oninput=e=>draw(e.target.value);
}

/* ---------- GLOBAL SEARCH ---------- */
function globalSearch(q){
  const box=document.getElementById('searchResults');
  if(!q || q.length<2){box.hidden=true;return;}
  q=q.toLowerCase();
  const res=[];
  MODEL.initiatives.forEach(d=>{ if([d.name,d.description,d.asset1,d.asset2,d.owner,d.collaborator,d.person].join(' ').toLowerCase().includes(q)) res.push({type:'Initiative',label:d.name,act:()=>showInitiative(d)});});
  MODEL.teams.filter(t=>t.toLowerCase().includes(q)).forEach(t=>res.push({type:'Team',label:t,act:()=>showTeam(t)}));
  MODEL.persons.filter(p=>p.toLowerCase().includes(q)).forEach(p=>res.push({type:'Person',label:p,act:()=>filterByPerson(p)}));
  const assets=new Set(); MODEL.initiatives.forEach(d=>assetsOf(d).forEach(a=>{if(a.toLowerCase().includes(q))assets.add(a+'|'+d.category);}));
  [...assets].forEach(a=>{const[name,cat]=a.split('|');res.push({type:'Asset',label:name+' ('+cat+')',act:()=>filterByAsset(name,cat)});});
  box.innerHTML=res.slice(0,40).map((r,i)=>'<div class="sr-item" data-i="'+i+'"><div class="sr-type">'+r.type+'</div>'+esc(r.label)+'</div>').join('')||'<div class="sr-item">No matches</div>';
  box.hidden=false;
  box.querySelectorAll('.sr-item[data-i]').forEach(el=>el.onclick=()=>{box.hidden=true;document.getElementById('globalSearch').value='';switchView('network');res[+el.dataset.i].act();});
}

/* ---------- UI WIRING ---------- */
function switchView(v){
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  document.querySelectorAll('.view').forEach(s=>s.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  if(v==='network' && simulation) simulation.alpha(.3).restart();
}
function renderLegend(){
  const el=document.getElementById('legend');
  el.innerHTML='<h4>Owning teams</h4>'+MODEL.teams.map(t=>'<div class="lg" data-team="'+esc(t)+'"><span class="sw" style="background:'+colorFor(t)+'"></span>'+esc(t)+'</div>').join('')+
    '<div class="lg" style="margin-top:8px;cursor:default"><span class="sw" style="background:#fff;border:2.5px dashed #e0a36a"></span>has collaborator</div>';
  el.querySelectorAll('.lg[data-team]').forEach(d=>d.onclick=()=>showTeam(d.dataset.team));
}
function wireUI(){
  document.querySelectorAll('.view-btn').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  document.getElementById('closePanel').onclick=closePanel;
  document.getElementById('panelScrim').onclick=closePanel;
  document.getElementById('clearFilter').onclick=clearFilter;
  document.getElementById('globalSearch').oninput=e=>globalSearch(e.target.value);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePanel();document.getElementById('searchResults').hidden=true;}});
  window.addEventListener('resize',()=>{ if(document.getElementById('view-network').classList.contains('active')) renderNetwork(); });
}
function esc(s){return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
