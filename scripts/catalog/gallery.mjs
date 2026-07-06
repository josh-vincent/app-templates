#!/usr/bin/env node
// Generate the visual component library: a self-contained HTML gallery of
// every UI component in every template, rendered as variant × state matrices
// using each template's real theme palette (light + dark).
//
//   node scripts/catalog/gallery.mjs        # → catalog/gallery/index.html
//
// Previews are CSS approximations driven by real extracted data (variant
// unions, boolean state props, traits, palettes parsed from each template's
// theme files) — a browsable spec of what exists and what states it has, not
// a pixel-perfect RN render. Live rendering of @jv/* components stays in
// apps/showcase.

import fs from 'node:fs';
import path from 'node:path';
import { readJson, exists, loadRegistry, REPO_ROOT, CATALOG_DIR } from './lib.mjs';
import { REGISTRY_DIR } from './registry-build.mjs';

const OUT = path.join(CATALOG_DIR, 'gallery', 'index.html');

/** Parse light/dark palettes out of a template's theme files (best effort). */
function extractPalette(root) {
  const defaults = {
    light: { background: '#ffffff', secondary: '#f5f5f5', text: '#0a0a0a', border: '#e5e5e5', highlight: '#00A6F4' },
    dark: { background: '#0a0a0a', secondary: '#171717', text: '#ffffff', border: '#262626', highlight: '#00A6F4' },
  };
  const keys = ['background', 'secondary', 'text', 'border', 'highlight'];
  const sources = ['utils/color-theme.ts', 'global.css', 'contexts/ThemeColors.tsx', 'app/contexts/ThemeColors.tsx']
    .map((f) => path.join(root, f))
    .filter(exists)
    .map((f) => fs.readFileSync(f, 'utf8'));
  for (const src of sources) {
    // Split into light/dark halves on the best-effort markers
    const darkIdx = src.search(/dark\s*[:{(]|@variant dark|\.dark|isDark\s*\?/);
    const halves = darkIdx > 0 ? { light: src.slice(0, darkIdx), dark: src.slice(darkIdx) } : { light: src, dark: src };
    for (const mode of ['light', 'dark']) {
      for (const k of keys) {
        const re = new RegExp(`(?:--color-)?${k}["']?\\s*[:=]\\s*["']?(#[0-9a-fA-F]{3,8}|rgba?\\([^)]*\\))`);
        const m = halves[mode].match(re);
        if (m) defaults[mode][k] = m[1];
      }
    }
  }
  return defaults;
}

function buildData() {
  const registryIndex = readJson(path.join(REGISTRY_DIR, 'registry.json'));
  const catalogIndex = readJson(path.join(CATALOG_DIR, 'index.json'));
  const reg = loadRegistry();

  const templates = {};
  for (const t of catalogIndex.templates) {
    const entry = reg.templates[t.name];
    const root = entry && path.resolve(REPO_ROOT, entry.localPath);
    templates[t.name] = {
      title: t.title,
      family: t.styleProfile?.family || 'flat',
      palette: root && exists(root) ? extractPalette(root) : extractPalette(''),
      counts: t.counts,
    };
  }
  const ui = registryIndex.items.filter((i) => i.type === 'registry:ui');
  return { templates, ui, generated: 'scripts/catalog/gallery.mjs' };
}

function html(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Component Library — Mobile App Factory</title>
<style>
:root{--bg:#fafafa;--fg:#111;--card:#fff;--muted:#666;--line:#e5e5e5;--accent:#00A6F4}
[data-mode=dark]{--bg:#0d0d0f;--fg:#f2f2f2;--card:#17171a;--muted:#999;--line:#2a2a2e}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 -apple-system,system-ui,sans-serif;background:var(--bg);color:var(--fg)}
header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:14px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
header h1{font-size:16px;margin:0 12px 0 0}
input[type=search]{padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--fg);min-width:220px}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{padding:5px 12px;border:1px solid var(--line);border-radius:999px;background:var(--card);cursor:pointer;font-size:12.5px;user-select:none}
.chip.on{background:var(--accent);border-color:var(--accent);color:#fff}
main{max-width:1200px;margin:0 auto;padding:20px}
.tpl{margin:26px 0}
.tpl>h2{font-size:15px;display:flex;gap:10px;align-items:baseline}.tpl>h2 small{color:var(--muted);font-weight:400}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}
.item{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;overflow:hidden}
.item h3{margin:0 0 2px;font-size:13.5px;display:flex;justify-content:space-between;gap:8px}
.item h3 .grp{color:var(--muted);font-weight:400;font-size:11px}
.traits{display:flex;gap:4px;flex-wrap:wrap;margin:4px 0 8px}
.trait{font-size:10.5px;padding:2px 7px;border-radius:999px;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent)}
.preview{border:1px dashed var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:10px;overflow-x:auto}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.lbl{font-size:10px;color:var(--muted);min-width:64px;text-transform:uppercase;letter-spacing:.4px}
.install{margin-top:10px;font:11px ui-monospace,monospace;color:var(--muted);background:color-mix(in srgb,var(--fg) 5%,transparent);padding:6px 8px;border-radius:8px;white-space:nowrap;overflow-x:auto;cursor:copy}
.props{font-size:11px;color:var(--muted);margin-top:6px}
.count{color:var(--muted);font-size:12px;margin-left:auto}
.empty{color:var(--muted);padding:40px;text-align:center}
</style></head><body data-mode="light">
<header>
  <h1>📱 Component Library</h1>
  <input type="search" id="q" placeholder="Search components, variants, traits…"/>
  <div class="chips" id="tplChips"></div>
  <div class="chips">
    <span class="chip on" data-grp="all">all</span><span class="chip" data-grp="elements">elements</span>
    <span class="chip" data-grp="forms">forms</span><span class="chip" data-grp="layout">layout</span>
  </div>
  <span class="chip" id="mode">🌙 dark</span>
  <span class="count" id="count"></span>
</header>
<main id="main"></main>
<script>
const DATA = ${json};
const state = { q:'', tpl:null, grp:'all', mode:'light' };

const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const baseName = id => id.split('/')[1];

// ---- CSS-approximation renderers, driven by extracted props ----------------
function btn(p, label, {variant='primary', size='medium', disabled=false, loading=false, pill=false}={}){
  const h = {small:28, medium:36, large:44}[size]||36;
  const styles = {
    primary:\`background:\${p.highlight};color:#fff;border:1px solid \${p.highlight}\`,
    secondary:\`background:\${p.secondary};color:\${p.text};border:1px solid \${p.secondary}\`,
    outline:\`background:transparent;color:\${p.text};border:1.5px solid \${p.border}\`,
    ghost:\`background:transparent;color:\${p.text};border:1px solid transparent\`,
  };
  return \`<span style="display:inline-flex;align-items:center;gap:6px;justify-content:center;height:\${h}px;padding:0 \${h/2.2}px;border-radius:\${pill?999:10}px;font-size:\${h/2.8}px;font-weight:600;\${styles[variant]||styles.primary};\${disabled?'opacity:.45;':''}">\${loading?'<span style="width:.8em;height:.8em;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;display:inline-block;animation:spin 1s linear infinite"></span>':''}\${esc(label)}</span>\`;
}
function chipEl(p,label,{selected=false,bordered=false}={}){
  return \`<span style="display:inline-flex;align-items:center;height:30px;padding:0 13px;border-radius:999px;font-size:12px;\${selected?\`background:\${p.highlight};color:#fff;border:1px solid \${p.highlight}\`:\`background:\${bordered?'transparent':p.secondary};color:\${p.text};border:1px solid \${bordered?p.border:p.secondary}\`}">\${esc(label)}</span>\`;
}
function avatarEl(p,txt,size){return \`<span style="width:\${size}px;height:\${size}px;border-radius:50%;background:\${p.highlight};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:\${size/2.6}px;font-weight:600">\${esc(txt)}</span>\`}
function inputEl(p,{variant='classic',error=false,disabled=false,label='Email'}={}){
  const b = error? '#e5484d' : p.border;
  if(variant==='underlined') return \`<span style="display:inline-flex;flex-direction:column;min-width:150px;\${disabled?'opacity:.45':''}"><span style="font-size:10px;color:\${p.text}99">\${label}</span><span style="border-bottom:1.5px solid \${b};padding:6px 0;color:\${p.text}66;font-size:13px">you@example.com</span></span>\`;
  return \`<span style="display:inline-flex;flex-direction:column;min-width:150px;gap:3px;\${disabled?'opacity:.45':''}"><span style="font-size:10px;color:\${p.text}99">\${label}\${error?' — invalid':''}</span><span style="border:1.5px solid \${b};border-radius:10px;padding:8px 10px;color:\${p.text}66;font-size:13px;background:\${p.background}">you@example.com</span></span>\`;
}
function cardEl(p,{variant='classic'}={}){
  const img=\`background:linear-gradient(135deg,\${p.highlight}66,\${p.highlight});\`;
  if(variant==='overlay') return \`<span style="display:inline-flex;width:140px;height:100px;border-radius:14px;\${img}position:relative;overflow:hidden"><span style="position:absolute;inset:auto 0 0 0;padding:8px;background:linear-gradient(transparent,rgba(0,0,0,.65));color:#fff;font-size:11px;font-weight:600">Title<br/><span style="font-weight:400;opacity:.8;font-size:10px">Description</span></span></span>\`;
  if(variant==='compact'||variant==='minimal') return \`<span style="display:inline-flex;gap:8px;align-items:center;width:170px;padding:\${variant==='minimal'?'0':'8px'};border-radius:12px;background:\${variant==='minimal'?'transparent':p.secondary}"><span style="width:44px;height:44px;border-radius:10px;\${img}"></span><span style="font-size:11px;color:\${p.text}"><b>Title</b><br/><span style="opacity:.6">Description</span></span></span>\`;
  return \`<span style="display:inline-flex;flex-direction:column;width:140px;border-radius:14px;background:\${p.secondary};overflow:hidden"><span style="height:70px;\${img}"></span><span style="padding:8px;font-size:11px;color:\${p.text}"><b>Title</b><br/><span style="opacity:.6">Description</span></span></span>\`;
}
function switchEl(p,on){return \`<span style="width:44px;height:26px;border-radius:999px;background:\${on?p.highlight:p.border};display:inline-flex;align-items:center;padding:2px;\${on?'justify-content:flex-end':''}"><span style="width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></span></span>\`}
function progressEl(p,pct){return \`<span style="display:inline-block;width:150px;height:8px;border-radius:999px;background:\${p.border};overflow:hidden"><span style="display:block;width:\${pct}%;height:100%;background:\${p.highlight}"></span></span>\`}
function rowsHtml(rows){return rows.map(([lbl,html])=>\`<div class="row"><span class="lbl">\${lbl}</span>\${html}</div>\`).join('')}

function preview(item, p){
  const name = baseName(item.name); const pr = item.props||{};
  const variants = pr.variants?.length? pr.variants : null;
  const states = pr.states||[];
  const pill = (pr.rounded||[]).includes('full');
  if(/button$/.test(name) && !/tab|drawer|floating/.test(name)){
    const rows=[['variants',(variants||['primary']).map(v=>btn(p,v,{variant:v})).join(' ')]];
    if(pr.sizes?.length) rows.push(['sizes',pr.sizes.map(s=>btn(p,s,{size:s})).join(' ')]);
    const st=[]; if(states.includes('disabled')) st.push(btn(p,'disabled',{disabled:true})); if(states.includes('loading')) st.push(btn(p,'loading',{loading:true})); if(pill) st.push(btn(p,'pill',{pill:true}));
    if(st.length) rows.push(['states',st.join(' ')]);
    return rowsHtml(rows);
  }
  if(name==='chip'){ return rowsHtml([['states',[chipEl(p,'default'),chipEl(p,'selected',{selected:true}),chipEl(p,'bordered',{bordered:true})].join(' ')]]); }
  if(name==='avatar'){ return rowsHtml([['sizes',[24,32,40,48,64].map(s=>avatarEl(p,'JD',s)).join(' ')]]); }
  if(name==='card'||name==='custom-card'){ return rowsHtml((variants||['classic','overlay']).slice(0,4).map(v=>[v,cardEl(p,{variant:v})])); }
  if(name==='input'){ const rows=[['variants',(variants||['classic','underlined']).slice(0,3).map(v=>inputEl(p,{variant:v})).join(' ')]]; const st=[]; if(states.includes('error')||true) st.push(inputEl(p,{error:true,label:'Email'})); if(states.includes('disabled')) st.push(inputEl(p,{disabled:true,label:'Disabled'})); rows.push(['states',st.join(' ')]); return rowsHtml(rows); }
  if(name==='switch'||name==='toggle'){ return rowsHtml([['states',switchEl(p,true)+' '+switchEl(p,false)]]); }
  if(name==='progress-bar'){ return rowsHtml([['60%',progressEl(p,60)]]); }
  if(name==='select'){ return rowsHtml([['closed',inputEl(p,{label:'Category'}).replace('you@example.com','Select option ▾')]]); }
  if(name==='header'){ return rowsHtml([['default',\`<span style="display:inline-flex;justify-content:space-between;align-items:center;width:250px;padding:10px 12px;background:\${p.background};border:1px solid \${p.border};border-radius:12px;color:\${p.text};font-size:13px"><span>‹</span><b>Title</b><span>⚙︎</span></span>\`]]); }
  if(/tab-button|tab-bar/.test(name)){ return rowsHtml([['tabs',\`<span style="display:inline-flex;gap:18px;padding:10px 16px;background:\${p.secondary};border-radius:14px;color:\${p.text};font-size:11px"><span style="color:\${p.highlight};text-align:center">●<br/>Home</span><span style="opacity:.55;text-align:center">○<br/>Search</span><span style="opacity:.55;text-align:center">○<br/>Profile</span></span>\`]]); }
  return null;
}

function propsLine(item){
  const pr=item.props||{}; const bits=[];
  if(pr.variants?.length) bits.push('variant: '+pr.variants.join(' | '));
  if(pr.sizes?.length) bits.push('size: '+pr.sizes.join(' | '));
  if(pr.rounded?.length) bits.push('rounded: '+pr.rounded.join(' | '));
  if(pr.states?.length) bits.push('states: '+pr.states.join(', '));
  return bits.join(' · ');
}

function render(){
  const main=document.getElementById('main'); const q=state.q.toLowerCase();
  let shown=0; let out='';
  for(const [tname,t] of Object.entries(DATA.templates)){
    if(state.tpl && state.tpl!==tname) continue;
    const p=t.palette[state.mode];
    const items=DATA.ui.filter(i=>i.template===tname)
      .filter(i=>state.grp==='all'||i.group===state.grp)
      .filter(i=>!q || (i.name+' '+(i.traits||[]).join(' ')+' '+propsLine(i)).toLowerCase().includes(q));
    if(!items.length) continue;
    shown+=items.length;
    out+=\`<section class="tpl"><h2>\${esc(t.title||tname)} <small>\${t.family} · \${items.length} components</small></h2><div class="grid">\`;
    for(const item of items){
      const pv=preview(item,p);
      out+=\`<div class="item"><h3>\${esc(baseName(item.name))}<span class="grp">\${item.group||''}</span></h3>
      \${(item.traits||[]).length?'<div class="traits">'+item.traits.map(x=>'<span class="trait">'+esc(x)+'</span>').join('')+'</div>':''}
      \${pv?\`<div class="preview" style="background:\${p.background}">\${pv}</div>\`:''}
      \${propsLine(item)?'<div class="props">'+esc(propsLine(item))+'</div>':''}
      <div class="install" title="click to copy" onclick="navigator.clipboard&&navigator.clipboard.writeText(this.textContent)">pnpm catalog:add \${esc(item.name)} --to ../my-app</div></div>\`;
    }
    out+='</div></section>';
  }
  main.innerHTML=out||'<div class="empty">No components match.</div>';
  document.getElementById('count').textContent=shown+' components';
}

// controls
const tplChips=document.getElementById('tplChips');
tplChips.innerHTML='<span class="chip on" data-tpl="">all templates</span>'+Object.keys(DATA.templates).map(n=>\`<span class="chip" data-tpl="\${n}">\${n}</span>\`).join('');
tplChips.onclick=e=>{const c=e.target.closest('.chip');if(!c)return;tplChips.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));c.classList.add('on');state.tpl=c.dataset.tpl||null;render();};
document.querySelectorAll('[data-grp]').forEach(c=>c.onclick=()=>{document.querySelectorAll('[data-grp]').forEach(x=>x.classList.remove('on'));c.classList.add('on');state.grp=c.dataset.grp;render();});
document.getElementById('q').oninput=e=>{state.q=e.target.value;render();};
document.getElementById('mode').onclick=function(){state.mode=state.mode==='light'?'dark':'light';document.body.dataset.mode=state.mode;this.textContent=state.mode==='light'?'🌙 dark':'☀️ light';render();};
const style=document.createElement('style');style.textContent='@keyframes spin{to{transform:rotate(360deg)}}';document.head.appendChild(style);
render();
</script></body></html>`;
}

const data = buildData();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html(data));
console.log(`gallery: ${data.ui.length} UI components across ${Object.keys(data.templates).length} templates → ${path.relative(REPO_ROOT, OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
