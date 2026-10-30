'use strict';
const keys=['x','y','width','height'];
const same=(left,right)=>!!left&&!!right&&keys.every(key=>left[key]===right[key]);
const copy=value=>Object.fromEntries(keys.map(key=>[key,value[key]]));

// Windows can realize frameless work-area bounds differently from the request
// or report that work-area window as maximized. Remember both sides. A repeated
// request is cheap only while the actual window still has that realized frame.
class WindowBounds {
 constructor(){this.requested=null;this.realized=null;}
 retains(window,requested){return same(this.requested,requested)&&same(this.realized,window.getBounds());}
 apply(window,requested,{overlay=false}={}){
  if(window.isMinimized())window.restore();
  const retained=overlay&&this.retains(window,requested);
  if(window.isMaximized()&&!retained)window.unmaximize();
  if(!same(window.getBounds(),requested)&&!retained)window.setBounds(requested);
  this.requested=overlay?copy(requested):null;this.realized=overlay?copy(window.getBounds()):null;
 }
 shown(window){if(this.requested)this.realized=copy(window.getBounds());}
}
// After a monitor is added, removed or rescaled: shelves cover the work area of
// the display they are on (or the cursor display); a normal window is kept while
// it overlaps a live work area, otherwise centered and clamped on the cursor display.
function relocate(bounds,displays,cursor,{overlay=false}={}){
 const inside=(area,point)=>point.x>=area.x&&point.x<area.x+area.width&&point.y>=area.y&&point.y<area.y+area.height;
 const atCursor=(displays.find(display=>inside(display.workArea,cursor))||displays[0]).workArea;
 if(overlay){const center={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};return copy((displays.find(display=>inside(display.workArea,center))?.workArea)||atCursor);}
 const overlaps=displays.some(({workArea:area})=>bounds.x<area.x+area.width&&bounds.x+bounds.width>area.x&&bounds.y<area.y+area.height&&bounds.y+bounds.height>area.y);
 if(overlaps)return copy(bounds);
 const width=Math.min(bounds.width,atCursor.width),height=Math.min(bounds.height,atCursor.height);
 return {x:Math.round(atCursor.x+(atCursor.width-width)/2),y:Math.round(atCursor.y+(atCursor.height-height)/2),width,height};
}
function relocationNeeded(current,next,{overlay=false,maximized=false}={}){return !same(current,next)&&(overlay||!maximized);}
module.exports={WindowBounds,relocate,relocationNeeded};
