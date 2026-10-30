'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Boots renderer.js with 20 text clips on a 1920px window and recorded commands.
function fixture({update=null}={}){
 const nodes=new Map(),listeners={};class Element{constructor(){this.dataset={};this.innerHTML='';this.textContent='';this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){},contains(){return false;}};}querySelector(){return null;}querySelectorAll(){return [];}setAttribute(){}focus(){}blur(){}matches(){return false;}closest(){return null;}addEventListener(){}scrollIntoView(){}}
 const document={body:new Element(),documentElement:new Element(),activeElement:null,getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},querySelector:()=>null,querySelectorAll:()=>[],addEventListener(type,fn){(listeners[type]||=[]).push(fn);}};
 const items=Array.from({length:20},(_,n)=>({id:'a0000000-0000-4000-8000-'+String(n+1).padStart(12,'0'),kind:'text',createdAt:1000-n,updatedAt:1000-n,text:'clip '+n,name:'',title:'',url:'',note:'',ocrText:'',pinned:false,folderIds:[],tags:[],hiddenFromShelf:false,trashedAt:null}));
 const raw={items,folders:[],view:'shelves',windowVisible:true,update,settings:{visibleKinds:['image','text','link'],localShortcuts:{},shortcuts:{},language:'en',cardSize:'medium',theme:'soft',swayCards:true,autoCheckUpdates:false,retentionDays:{image:30,text:30,link:30}}};
 const commands=[];const window={innerWidth:1920,clipboardLine:{state:async()=>structuredClone(raw),subscribe(){},command:async action=>{commands.push(action);return structuredClone(raw);}},addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
 const context={window,document,HTMLElement:Element,HTMLTextAreaElement:class extends Element{},HTMLInputElement:class extends Element{},Image:class{},URL,console,structuredClone,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn()};vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer.js'),'utf8').replace(/\}\)\(\);\s*$/,'window.__polish={ui,state,shelfRow,settings,shortcutSheet};})();'),context);
 const fire=async(type,init)=>{const event={key:'',code:'',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,isComposing:false,target:new Element(),defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...init};for(const fn of listeners[type]||[])await fn(event);return event;};
 return{items,commands,fire,Element,ready:()=>new Promise(setImmediate),get api(){return window.__polish;}};
}
test('right-click selects the card before Actions opens',async()=>{
 const f=fixture();await f.ready();const id=f.items[3].id;const card={dataset:{itemId:id}};
 await f.fire('contextmenu',{target:{closest:selector=>selector.includes('[data-item-id]')?card:null}});
 assert.equal(f.api.ui.focus,id);assert.ok(f.api.ui.selected.has(id));assert.equal(f.api.ui.active,'text');assert.equal(f.api.ui.modal?.type,'actions');
});
test('Enter on a focused shelf toolbar button presses the button instead of pasting',async()=>{
 const f=fixture();await f.ready();f.api.ui.focus=f.items[0].id;f.api.ui.active='text';const button=new f.Element();button.closest=selector=>selector==='button'?button:null;
 const event=await f.fire('keydown',{key:'Enter',code:'Enter',target:button});
 assert.ok(!f.commands.includes('paste'));assert.equal(event.defaultPrevented,false);
});
test('page buttons slide the rope',async()=>{
 const f=fixture();await f.ready();const button={dataset:{action:'page-next',kind:'text'},classList:{contains:()=>false}};
 await f.fire('click',{target:{classList:{contains:()=>false},closest:selector=>selector==='[data-action]'?button:null}});
 assert.equal(f.api.ui.pages.text,1);assert.match(f.api.shelfRow('text',8),/class="cards slide-next"/);
});
test('a rope slide survives a re-render and expires afterwards',async()=>{
 const f=fixture();await f.ready();f.api.ui.pages.text=1;
 f.api.ui.slide={kind:'text',direction:1,at:Date.now()-100};const row=f.api.shelfRow('text',8);
 assert.match(row,/class="cards slide-next" style="animation-delay:-\d+ms"/);
 f.api.ui.slide={kind:'text',direction:1,at:Date.now()-1000};assert.doesNotMatch(f.api.shelfRow('text',8),/slide-next/);
});
test('the shortcuts sheet shows the 1–9 quick slots as one row',async()=>{
 const f=fixture();await f.ready();const sheet=f.api.shortcutSheet('shelves');
 assert.match(sheet,/Select item 1–9<\/span><span><kbd>1–9<\/kbd>/);assert.doesNotMatch(sheet,/Select item 1<\/span>/);
});
test('the update toggle is hidden in fork builds',async()=>{
 const f=fixture({update:{status:'disabled',message:'This is your own build. Updates are applied manually from your fork.'}});await f.ready();f.api.ui.settingsTab='updates';
 assert.doesNotMatch(f.api.settings(),/data-setting="autoCheckUpdates"/);
 const official=fixture({update:{status:'idle'}});await official.ready();official.api.ui.settingsTab='updates';
 assert.match(official.api.settings(),/data-setting="autoCheckUpdates"/);
});
