import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/accounts.js',import.meta.url),'utf8');
function ui(hash=''){
 const handlers=[],requests=[],replacements=[];const responses=new Map();
 const location={hash,search:'',pathname:'/'};
 const context=vm.createContext({URLSearchParams,location,history:{replaceState(...args){replacements.push(args);location.hash='';location.search='';}},document:{addEventListener:(type,fn,capture)=>handlers.push({type,fn,capture}),body:{classList:{toggle(){}}}},window:{addEventListener(){}},renderers:{settings:()=>''},heading:(a,b)=>a+b,card:(a,b)=>a+b,field:(id)=>`<input id="${id}">`,form:(id,body)=>`<form id="${id}">${body}<button>Submit</button></form>`,esc:String,vals:f=>f.values,$:()=>null,render(){},ensureExtras(){},notify(){},alerted:new Set(),sentAlerts:new Set(),fetch:async(path,opts)=>{
  requests.push({path,opts,hash:location.hash});const data=responses.get(path)||{status:path.endsWith('session')?401:200,body:path.endsWith('health')?{hosted:true,recovery:true}: {error:'Sign in'}};return {ok:data.status<400,status:data.status,json:async()=>data.body};
 }});
 vm.runInContext(source,context);vm.runInContext('accountHeader=()=>{};',context);
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 const submit=async(id,values)=>{const b={disabled:false};const e={target:{id,values,querySelector:()=>b},preventDefault(){}};await handlers.find(h=>h.type==='submit'&&!h.capture).fn(e);};
 return {context,handlers,requests,responses,replacements,flush,submit,run:s=>vm.runInContext(s,context)};
}
test('only one entry form, with accessible links between sign-in, sign-up and recovery',async()=>{
 const u=ui();await u.flush();let html=u.run('accountGate()');assert(html.includes('loginForm'));assert(!html.includes('registerForm'));assert(html.includes('Forgot password?'));assert(html.includes('Sign up'));
 for(const mode of ['register','forgot','login']){
  const b={dataset:{accountMode:mode},closest:()=>null};const e={target:{closest:()=>b},preventDefault(){throw Error('Public auth toggle blocked')},stopImmediatePropagation(){throw Error('Public auth toggle blocked')}};
  u.handlers.find(h=>h.type==='click'&&h.capture).fn(e);await u.handlers.find(h=>h.type==='click'&&!h.capture).fn(e);
  html=u.run('accountGate()');assert(html.includes(mode==='register'?'registerForm':mode==='forgot'?'forgotForm':'loginForm'));
 }
});
test('password confirmation prevents accidental registration; verification stays on a pending screen',async()=>{
 const u=ui();await u.flush();await u.submit('registerForm',{registerEmail:'a@example.test',registerPassword:'long-password-A',registerConfirm:'long-password-B'});assert(u.run('accountError').includes('do not match'));assert(!u.requests.some(r=>r.path.endsWith('/register')));
 u.responses.set('/api/register',{status:200,body:{pendingVerification:true,message:'Check your email'}});
 await u.submit('registerForm',{registerEmail:'a@example.test',registerPassword:'long-password-A',registerConfirm:'long-password-A'});assert.equal(u.run('accountMode'),'check-email');assert.equal(u.run('accountUser'),null);
});
test('forgot-password feedback persists and successful reset returns to sign-in',async()=>{
 const u=ui();await u.flush();u.responses.set('/api/forgot-password',{status:200,body:{message:'If an account exists, check your inbox.'}});await u.submit('forgotForm',{recoveryEmail:'a@example.test'});assert.match(u.run('accountMessage'),/check your inbox/);
 u.run("accountMode='reset'; accountCsrf='csrf';");u.responses.set('/api/reset-password',{status:200,body:{message:'Password updated.'}});
 await u.submit('resetPasswordForm',{newPassword:'new-long-password',confirmPassword:'new-long-password'});assert.equal(u.run('accountMode'),'login');assert.equal(u.run('accountCsrf'),'');assert.equal(u.run('accountMessage'),'Password updated.');
});
test('email tokens are removed before any fetch and recovery opens the new-password screen',async()=>{
 const u=ui('#access_token=temporary&refresh_token=refresh-test&type=recovery');
 u.responses.set('/api/auth-callback',{status:200,body:{user:{email:'a@example.test'},csrf:'csrf',recovery:true}});await u.flush();
 assert.equal(u.replacements.length,1);assert(u.requests.every(r=>r.hash===''));assert.equal(u.run('accountMode'),'reset');assert.equal(u.run('accountUser'),null);assert.equal(u.run('accountCsrf'),'csrf');
});
test('postpartum risk page renders without a model-metrics panel',()=>{
 const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');const renderSource=app.slice(app.indexOf('function render(){'),app.indexOf('\nfunction predict('));
 const view={innerHTML:''};const context=vm.createContext({accountReady:true,accountUser:{email:'test@example.test'},location:{hash:'#risk'},model:{},renderers:{risk:()=>'<h1>Pregnancy model unavailable after birth</h1>'},document:{querySelectorAll:()=>[]},$:s=>s==='#view'?view:null});
 vm.runInContext(renderSource,context);vm.runInContext('render()',context);assert.match(view.innerHTML,/unavailable after birth/);
});
test('invalid pressure clears the previous risk result',()=>{
 const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');const start=app.indexOf("document.addEventListener('submit',e=>{");const end=app.indexOf("document.addEventListener('click',",start);let submitHandler;const result={innerHTML:'<div class="big">high risk</div>'};let message='';
 const inputs={Age:'23',SystolicBP:'70',DiastolicBP:'90',BS:'7',BodyTemp:'98',HeartRate:'76'};
 const context=vm.createContext({document:{addEventListener:(type,fn)=>{if(type==='submit')submitHandler=fn}},vals:()=>inputs,crypto:{randomUUID:()=> 'test-id'},model:{features:Object.keys(inputs)},$:s=>s==='#result'?result:null,notify:text=>message=text});
 vm.runInContext(app.slice(start,end),context);submitHandler({preventDefault(){},target:{id:'riskForm'}});assert.equal(result.innerHTML,'');assert.match(message,/Systolic/);
});
