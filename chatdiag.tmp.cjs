/* Does chat 502 for EVERY request, or only some? Distinguishes a bad
 * credential (always) from a model/payload defect (request-dependent). */
const BASE="https://qelvora.vercel.app";const ts=Date.now();
function client(){let c="";const cap=r=>{for(const x of r.headers.getSetCookie?.()??[]){const p=x.split(";")[0],n=p.split("=")[0];c=c.split("; ").filter(y=>y&&y.split("=")[0]!==n).concat(p).join("; ");}};return async(path,init={})=>{const r=await fetch(BASE+path,{...init,headers:{"Content-Type":"application/json",...(c?{Cookie:c}:{}),...(init.headers??{})},redirect:"manual"});cap(r);const t=await r.text();let b;try{b=JSON.parse(t);}catch{b=t.slice(0,200);}return{status:r.status,body:b};};}
(async()=>{
  const A=client();const email=`syraven.cd.${ts}@gmail.com`;
  const r=await A("/api/auth/register",{method:"POST",body:JSON.stringify({email,password:`Str0ng!P${ts}`,name:"CD"})});
  if(r.status!==201){console.log("reg",r.status);return;}
  const cases=[
    ["plain",{messages:[{role:"user",content:"hi"}]}],
    ["explicit groq model",{messages:[{role:"user",content:"hi"}],model:"llama-3.3-70b-versatile"}],
    ["explicit openai model",{messages:[{role:"user",content:"hi"}],model:"gpt-4o-mini"}],
    ["nonsense model",{messages:[{role:"user",content:"hi"}],model:"not-a-real-model"}],
    ["streaming",{messages:[{role:"user",content:"hi"}],stream:true}],
  ];
  for(const [label,payload] of cases){
    const x=await A("/api/chat",{method:"POST",body:JSON.stringify(payload)});
    console.log(label.padEnd(24),x.status,JSON.stringify(x.body).slice(0,90));
  }
  console.log("EMAIL",email);
})();
