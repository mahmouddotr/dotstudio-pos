const { chromium } = require('playwright');
const BASE='http://127.0.0.1:8000';
(async()=>{
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:844}});
const p=await ctx.newPage();
await p.goto(BASE+'/index.html');
await p.waitForSelector('#loginBtn');
await p.fill('#loginUser','customer'); await p.fill('#loginPass','customer2026');
await Promise.all([p.waitForURL(u=>!/index\.html$/.test(u.pathname)),p.click('#loginBtn')]);
await p.waitForTimeout(800);
await p.goto(BASE+'/customer/storefront.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1600);
const out=await p.evaluate(()=>{
  const vw=document.documentElement.clientWidth;
  const bad=[];
  document.querySelectorAll('body *').forEach(el=>{
    const r=el.getBoundingClientRect();
    if(r.width>0 && (r.right>vw+1||r.left<-1)){
      bad.push({tag:el.tagName,cls:(el.className&&el.className.toString().slice(0,60))||'',left:Math.round(r.left),right:Math.round(r.right),w:Math.round(r.width)});
    }
  });
  return {vw, scrollW:document.documentElement.scrollWidth, bodyScroll:document.body.scrollWidth, bad:bad.slice(0,25)};
});
console.log(JSON.stringify(out,null,1));
await p.screenshot({path:'.work/diag-mobile.png',fullPage:false});
await b.close();
})();
