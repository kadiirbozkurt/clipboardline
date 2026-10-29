'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Boots renderer.js with N text clips on a 1920px window (8 cards per page).
function fixture(count=20){
 const nodes=new Map(),listeners={};class Element{constructor(){this.dataset={};this.innerHTML='';this.textContent='';this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){},contains(){return false;}};}querySelector(){return null;}querySelectorAll(){return [];}setAttribute(){}focus(){}blur(){}matches(){return false;}closest(){return null;}addEventListener(){}scrollIntoView(){}}
 const document={body:new Element(),documentElement:new Element(),activeElement:null,getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},querySelector:()=>null,querySelectorAll:()=>[],addEventListener(type,fn){(listeners[type]||=[]).push(fn);}};
 const items=Array.from({length:count},(_,n)=>({id:'90000000-0000-4000-8000-'+String(n+1).padStart(12,'0'),kind:'text',createdAt:1000-n,updatedAt:1000-n,text:'clip '+n,name:'',title:'',url:'',note:'',ocrText:'',pinned:false,folderIds:[],tags:[],hiddenFromShelf:false,trashedAt:null}));
 const raw={items,folders:[],view:'shelves',windowVisible:true,settings:{visibleKinds:['image','text','link'],localShortcuts:{},shortcuts:{},language:'en',cardSize:'medium',theme:'soft',swayCards:true}};
 const commands=[];const window={innerWidth:1920,clipboardLine:{state:async()=>structuredClone(raw),subscribe(){},command:async action=>{commands.push(action);return structuredClone(raw);}},addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
 const context={window,document,HTMLElement:Element,HTMLTextAreaElement:class extends Element{},HTMLInputElement:class extends Element{},Image:class{},URL,console,structuredClone,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn()};vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer.js'),'utf8').replace(/\}\)\(\);\s*$/,'window.__rope={ui,scrollRope,rowItems,shelfRow};})();'),context);
 const fire=async(type,init)=>{const event={key:'',code:'',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,isComposing:false,deltaX:0,deltaY:0,clientX:0,clientY:0,button:0,target:new Element(),defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...init};for(const fn of listeners[type]||[])await fn(event);return event;};
 const shelf={dataset:{shelf:'text'}};const onRope={classList:{contains:()=>false},closest:selector=>selector.includes('[data-shelf]')?shelf:null};
 return{items,commands,fire,onRope,ready:()=>new Promise(setImmediate),get api(){return window.__rope;}};
}
test('arrow past the last visible card slides the rope',async()=>{
 const f=fixture();await f.ready();f.api.ui.active='text';f.api.ui.focus=f.items[7].id;f.api.ui.pages.text=0;
 await f.fire('keydown',{key:'ArrowRight',code:'ArrowRight'});
 assert.equal(f.api.ui.focus,f.items[8].id);assert.equal(f.api.ui.pages.text,1);
 assert.match(f.api.shelfRow('text',8),/class="cards slide-next"/);
});
test('wheel over a rope scrolls that rope',async()=>{
 const vertical=fixture();await vertical.ready();const event=await vertical.fire('wheel',{deltaY:120,target:vertical.onRope});assert.equal(event.defaultPrevented,true);assert.equal(vertical.api.ui.pages.text,1);
 const horizontal=fixture();await horizontal.ready();await horizontal.fire('wheel',{deltaX:-120,target:horizontal.onRope});assert.equal(horizontal.api.ui.pages.text,0);
 horizontal.api.ui.pages.text=2;await horizontal.fire('wheel',{deltaX:-120,deltaY:10,target:horizontal.onRope});assert.equal(horizontal.api.ui.pages.text,1);
});
test('drag on empty rope space scrolls and does not hide the shelves',async()=>{
 const f=fixture();await f.ready();
 await f.fire('pointerdown',{clientX:900,target:f.onRope});await f.fire('pointerup',{clientX:820,target:f.onRope});
 assert.equal(f.api.ui.pages.text,1);
 await f.fire('click',{target:f.onRope});assert.ok(!f.commands.includes('hide'));
});
test('short ropes do not scroll',async()=>{
 const f=fixture(1);await f.ready();
 assert.equal(f.api.scrollRope('text',1),false);assert.equal(f.api.scrollRope('text',-1),false);assert.equal(f.api.scrollRope('link',1),false);
 assert.equal(f.api.ui.pages.text||0,0);
});
