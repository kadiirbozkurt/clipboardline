'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Loads renderer.js in a minimal DOM and exposes the shelf helpers under test.
function fixture({width=2560,settings={}}={}){
 const nodes=new Map();class Element{constructor(){this.dataset={};this.innerHTML='';this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){},contains(){return false;}};}querySelector(){return null;}querySelectorAll(){return [];}setAttribute(){}focus(){}matches(){return false;}closest(){return null;}addEventListener(){}}
 const document={body:new Element(),documentElement:new Element(),activeElement:null,getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
 const value=(n,kind,extra={})=>({id:'70000000-0000-4000-8000-'+String(n).padStart(12,'0'),kind,createdAt:n,updatedAt:n,text:kind==='text'?'body '+n:'',name:'',title:'',url:kind==='link'?'https://example.com/'+n:'',note:'',ocrText:'',pinned:false,folderIds:[],tags:[],hiddenFromShelf:false,trashedAt:null,...extra});
 const raw={items:[value(1,'image'),value(2,'text'),value(3,'link')],folders:[],view:'shelves',windowVisible:true,settings:{visibleKinds:['image','text','link'],localShortcuts:{},shortcuts:{},language:'en',cardSize:'medium',theme:'soft',swayCards:true,...settings}};
 const focus=[];const window={innerWidth:width,clipboardLine:{state:async()=>structuredClone(raw),subscribe(){},command:async()=>structuredClone(raw)},addEventListener(type,fn){if(type==='focus')focus.push(fn);},matchMedia:()=>({matches:false,addEventListener(){}})};
 const context={window,document,HTMLElement:Element,HTMLTextAreaElement:class extends Element{},HTMLInputElement:class extends Element{},Image:class{},URL,console,structuredClone,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn()};vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer.js'),'utf8').replace(/\}\)\(\);\s*$/,'window.__glass={ui,state,cardWidth,shelfPageSize,card,shelfRow,shelves};})();'),context);
 return{window,focus,ready:()=>new Promise(setImmediate),get api(){return window.__glass;},raw};
}
test('card width scales with the window',async()=>{
 for(const [width,expected] of [[1920,211],[2560,282],[1280,180],[4000,360]]){const f=fixture({width});await f.ready();assert.equal(f.api.cardWidth(),expected,String(width));}
 const large=fixture({width:2560,settings:{cardSize:'large'}});await large.ready();assert.equal(large.api.cardWidth(),366);
 const small=fixture({width:2560,settings:{cardSize:'small'}});await small.ready();assert.equal(small.api.cardWidth(),225);
});
test('page size follows card width',async()=>{
 for(const [width,expected] of [[2560,8],[1920,8],[1280,6]]){const f=fixture({width});await f.ready();assert.equal(f.api.shelfPageSize(),expected,String(width));}
});
test('shelf cards render a clothespin and Library cards do not',async()=>{
 const f=fixture();await f.ready();const value=f.raw.items[0];
 assert.match(f.api.card(value,0,false),/class="clothespin"/);
 assert.doesNotMatch(f.api.card(value,0,true),/clothespin/);
 // Width is CSS-owned so a render taken before the window grew can never pin it.
 assert.doesNotMatch(f.api.shelves(),/--card-width:\d/);
 const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
 assert.match(css,/\.shelves \{[^}]*--card-width: calc\(clamp\(180px, 11vw, 360px\) \* var\(--card-scale, 1\)\)/);
 assert.match(css,/\.size-small \.shelves \{ --card-scale: \.8; \}/);assert.match(css,/\.size-large \.shelves \{ --card-scale: 1\.3; \}/);
});
test('a window that grew while hidden re-renders the shelves when it gains focus',async()=>{
 const f=fixture({width:1200});await f.ready();f.api.shelves();assert.equal(f.api.ui.layoutWidth,1200);
 f.window.innerWidth=2560;for(const fn of f.focus)fn();assert.equal(f.api.ui.layoutWidth,2560);
});
test('image cards draw one selection ring',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
 const rule=css.match(/^\.shelves \.card[^{\n]*\.focused[^{\n]*\{ outline: 3px solid #ffd54a/m)[0];
 assert.match(rule,/\.shelves \.card:not\(\.kind-image\)\.focused/);assert.doesNotMatch(rule,/\.shelves \.card\.focused/);
});
