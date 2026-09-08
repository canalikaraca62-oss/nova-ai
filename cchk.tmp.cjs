const BASE="https://qelvora.vercel.app";const ts=Date.now();
function client(){let c="";const cap=r=>{for(const x of r.headers.getSetCookie?.()??[]){const p=x.split(";")[0],n=p.split("=")[0];c=c.split("; ").filter(y=>y&&y.split("=")[0]!==n).concat(p).join("; ");}};return async(path,init={})=>{const r=await fetch(BASE+path,{...init,headers:{"Content-Type":"application/json",...(c?{Cookie:c}:{}),...(init.headers??{})},redirect:"manual"});cap(r);const t=await r.text();let b;try{b=JSON.parse(t);}catch{b=t.slice(0,250);}return{status:r.status,body:b};};}
(async()=>{
  const A=client();const email=`syraven.cc.${ts}@gmail.com`;
  const r=await A("/api/auth/register",{method:"POST",body:JSON.stringify({email,password:`Str0ng!P${ts}`,name:"CC"})});
  if(r.status!==201){console.log("reg",r.status);return;}
  const x=await A("/api/chat",{method:"POST",body:JSON.stringify({messages:[{role:"user",content:"hi"}]})});
  console.log("chat ->",x.status,JSON.stringify(x.body));
  console.log("EMAIL",email);
})();
