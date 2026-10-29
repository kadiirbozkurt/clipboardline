'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Boots renderer.js with recorded commands and dispatchable document events.
function fixture({pasteFails=false,settings={},reducedMotion=false}={}){
 const nodes=new Map(),listeners={};class Element{constructor(tag='DIV'){this.tagName=tag;this.dataset={};this.innerHTML='';this.textContent='';this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){},contains(){return false;}};}querySelector(){return null;}querySelectorAll(){return [];}setAttribute(){}focus(){}blur(){}matches(selector){return this.tagName==='INPUT'&&selector.includes('input');}closest(){return null;}addEventListener(){}scrollIntoView(){}}
 const document={body:new Element(),documentElement:new Element(),activeElement:null,getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},querySelector:()=>null,querySelectorAll:()=>[],addEventListener(type,fn){(listeners[type]||=[]).push(fn);}};
 const value=(n,kind)=>({id:'80000000-0000-4000-8000-'+String(n).padStart(12,'0'),kind,createdAt:n,updatedAt:n,text:kind==='text'?'body '+n:'',name:'',title:'',url:'',note:'',ocrText:'',pinned:false,folderIds:[],tags:[],hiddenFromShelf:false,trashedAt:null});
 const raw={items:[value(1,'text'),value(2,'text')],folders:[],view:'shelves',windowVisible:true,settings:{visibleKinds:['image','text','link'],localShortcuts:{},shortcuts:{},language:'en',cardSize:'medium',theme:'soft',swayCards:true,...settings}};
 const commands=[];const window={innerWidth:1920,clipboardLine:{state:async()=>structuredClone(raw),subscribe(){},command:async(action,payload)=>{commands.push([action,payload]);if(action==='paste'&&pasteFails)throw new Error('Select an editable field in another application, then reopen the shelves.');return structuredClone(raw);}},addEventListener(){},matchMedia:()=>({matches:reducedMotion,addEventListener(){}})};
 const context={window,document,HTMLElement:Element,HTMLTextAreaElement:class extends Element{},HTMLInputElement:class extends Element{},Image:class{},URL,console,structuredClone,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn()};vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer.js'),'utf8').replace(/\}\)\(\);\s*$/,'window.__keys={ui,state,shelves,overlayHTML:typeof overlayHTML==="function"?overlayHTML:null};})();'),context);
 const fire=async(type,init)=>{const event={key:'',code:'',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,repeat:false,isComposing:false,target:new Element(),defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...init};for(const fn of listeners[type]||[])await fn(event);return event;};
 return{raw,commands,fire,Element,toast:()=>nodes.get('toast')?.textContent||'',overlay:()=>nodes.get('overlay-root')?.innerHTML||'',ready:()=>new Promise(setImmediate),get api(){return window.__keys;}};
}
const focusFirst=f=>{f.api.ui.focus=f.raw.items[0].id;f.api.ui.active='text';};
const names=f=>f.commands.map(([action])=>action);
test('Enter pastes and Ctrl+C copies',async()=>{
 const f=fixture();await f.ready();focusFirst(f);
 await f.fire('keydown',{key:'Enter',code:'Enter'});assert.ok(names(f).includes('paste'));
 f.commands.length=0;await f.fire('keydown',{key:'c',code:'KeyC',ctrlKey:true});assert.ok(names(f).includes('copy'));assert.ok(!names(f).includes('paste'));
});
test('Enter falls back to copy when the paste target is unavailable',async()=>{
 const f=fixture({pasteFails:true});await f.ready();focusFirst(f);const focused=f.api.ui.focus;
 await f.fire('keydown',{key:'Enter',code:'Enter'});
 assert.deepEqual(names(f).filter(name=>['paste','copy'].includes(name)),['paste','copy']);
 assert.equal(f.toast(),'Copied — paste target unavailable');assert.equal(f.api.ui.focus,focused);
});
test('F2 renames and Ctrl+D pins while the old keys keep working',async()=>{
 const f=fixture();await f.ready();focusFirst(f);
 await f.fire('keydown',{key:'F2',code:'F2'});assert.equal(f.api.ui.modal?.type,'name');f.api.ui.modal=null;
 await f.fire('keydown',{key:'d',code:'KeyD',ctrlKey:true});assert.ok(names(f).includes('pin'));
 f.commands.length=0;await f.fire('keydown',{key:'p',code:'KeyP'});assert.ok(names(f).includes('pin'));
});
test('F1 and ? open the keyboard shortcuts sheet',async()=>{
 for(const init of [{key:'F1',code:'F1'},{key:'?',code:'Minus',shiftKey:true}]){const f=fixture();await f.ready();focusFirst(f);await f.fire('keydown',init);assert.equal(f.api.ui.modal?.type,'shortcuts',init.key);assert.match(f.overlay(),/Paste into previous app/);assert.match(f.overlay(),/<kbd>Enter<\/kbd>/);}
});
test('typing keys stay in text fields',async()=>{
 const f=fixture();await f.ready();focusFirst(f);const input=new f.Element('INPUT');
 for(const init of [{key:'Enter',code:'Enter'},{key:'F2',code:'F2'},{key:'d',code:'KeyD',ctrlKey:true},{key:'?',code:'Minus',shiftKey:true}])await f.fire('keydown',{...init,target:input});
 assert.equal(f.api.ui.modal,null);assert.ok(!names(f).some(name=>['paste','copy','pin'].includes(name)));
});
test('right-click opens Actions for that card',async()=>{
 const f=fixture();await f.ready();const id=f.raw.items[1].id;const card={dataset:{itemId:id},closest:selector=>selector.includes('card')?card:null};
 const target={closest:selector=>selector.includes('[data-item-id]')?card:null};
 const event=await f.fire('contextmenu',{target,clientX:10,clientY:10});
 assert.equal(event.defaultPrevented,true);assert.equal(f.api.ui.focus,id);assert.equal(f.api.ui.modal?.type,'actions');
});
test('sway follows the setting and reduced motion',async()=>{
 const on=fixture();await on.ready();assert.match(on.api.shelves(),/class="content shelves sway"/);
 const off=fixture({settings:{swayCards:false}});await off.ready();assert.doesNotMatch(off.api.shelves(),/ sway"/);
 const reduced=fixture({reducedMotion:true});await reduced.ready();assert.doesNotMatch(reduced.api.shelves(),/ sway"/);
});
