import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler,seal,unseal} from '../netlify/functions/api.mjs';
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'test-public-key',APP_URL:'https://bloom.test',BLOOM_DATA_KEY:'01'.repeat(32)};
function fixture(){
 const accounts=new Map(),records=new Map(),tokens=new Map();let next=0,confirm=false,expire=false,mailFail=false,signouts=0;
 const response=(status,data)=>new Response(JSON.stringify(data),{status});
 const session=user=>{const access_token='access-'+user.id+'-'+(++next),refresh_token='refresh-'+user.id+'-'+next;tokens.set(access_token,user);tokens.set(refresh_token,user);return {access_token,refresh_token,user:{id:user.id,email:user.email,email_confirmed_at:'2026-10-23'}}};
 const fetcher=async(url,options={})=>{
  const u=new URL(url),p=u.pathname,body=options.body?JSON.parse(options.body):{},access=options.headers?.Authorization?.replace('Bearer ',''),user=tokens.get(access),method=options.method||'GET';
  if(p==='/auth/v1/signup'){
   if(confirm)return response(200,{user:{id:'pending',email:body.email}});
   const a={id:'user-'+(++next),email:body.email,password:body.password};accounts.set(a.email,a);return response(200,session(a));
  }
  if(p==='/auth/v1/token'){
   if(u.searchParams.get('grant_type')==='refresh_token'){const a=tokens.get(body.refresh_token);return a&&accounts.has(a.email)?response(200,session(a)):response(400,{error_code:'invalid_grant'});}
   const a=accounts.get(body.email);return a&&a.password===body.password?response(200,session(a)):response(400,{error_code:'invalid_credentials'});
  }
  if(p==='/auth/v1/recover'||p==='/auth/v1/resend')return mailFail?response(500,{error_code:'email_send_failed'}):response(200,{});
  if(p==='/auth/v1/user'){
   if(!user||!accounts.has(user.email))return response(401,{});
   if(expire&&method==='GET'){expire=false;return response(401,{});}
   if(method==='PUT')user.password=body.password;
   return response(200,{id:user.id,email:user.email,email_confirmed_at:'2026-10-23'});
  }
  if(p==='/auth/v1/logout'){signouts++;return response(200,{});}
  if(p==='/rest/v1/bloom_journals'){
   if(!user)return response(401,{});
   const id=u.searchParams.get('user_id')?.replace('eq.','');
   if(method==='POST'){assert.equal(body.user_id,user.id);if(!records.has(user.id))records.set(user.id,body);return response(200,{});}
   if(method==='PATCH'){assert.equal(id,user.id);const r=records.get(id);if(!r||'eq.'+r.revision!==u.searchParams.get('revision'))return response(200,[]);Object.assign(r,body);return response(200,[r]);}
   assert.equal(id,user.id);return response(200,records.has(id)?[records.get(id)]:[]);
  }
  if(p==='/rest/v1/rpc/delete_own_bloom_account'){accounts.delete(user.email);records.delete(user.id);return response(200,{});}
  throw Error('Unexpected upstream request '+method+' '+url);
 };
 const handler=makeHandler(env,fetcher);
 const call=async(path,method='GET',body,cookie,csrf,origin=env.APP_URL,accountEmail)=>{
  const r=await handler({path:'/api/'+path,httpMethod:method,headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{}),...(accountEmail?{'x-bloom-account':accountEmail}:{})},body:body===undefined?null:JSON.stringify(body)});
  return {status:r.statusCode,data:JSON.parse(r.body),cookie:r.multiValueHeaders?.['Set-Cookie']?.[0]?.split(';')[0],raw:r};
 };
 return {call,records,accounts,tokens,setConfirm:v=>confirm=v,setMailFail:v=>mailFail=v,setExpire:()=>expire=true,signouts:()=>signouts};
}
test('registration, HttpOnly sessions, wrong-password errors, owner isolation, encryption and conflicting saves',async()=>{
 const f=fixture();assert.equal((await f.call('state')).status,401);
 const a=await f.call('register','POST',{email:'a@example.test',password:'long-password-A'}),b=await f.call('register','POST',{email:'b@example.test',password:'long-password-B'});
 assert.equal(a.status,200);assert.match(a.raw.multiValueHeaders['Set-Cookie'][0],/HttpOnly; Secure; SameSite=Lax/);assert(!a.cookie.includes('access-'));assert(!a.cookie.includes('refresh-'));
 assert.equal((await f.call('login','POST',{email:'a@example.test',password:'wrong-password'})).status,401);
 assert.equal((await f.call('state','GET',undefined,a.cookie)).status,200);assert.equal((await f.call('state','GET',undefined,b.cookie)).status,200);
 const body={state:{profile:{name:'private A'}},revision:0};
 assert.equal((await f.call('state','PUT',body,a.cookie)).status,403);
 assert.equal((await f.call('state','PUT',body,a.cookie,a.data.csrf,'https://evil.test')).status,403);
 assert.equal((await f.call('state','PUT',body,b.cookie,b.data.csrf,env.APP_URL,'a@example.test')).status,409);
 assert.equal((await f.call('state','PUT',body,a.cookie,a.data.csrf)).status,200);
 assert.equal((await f.call('state','PUT',body,a.cookie,a.data.csrf)).status,409);
 assert.equal((await f.call('state','GET',undefined,a.cookie)).data.state.profile.name,'private A');assert.deepEqual((await f.call('state','GET',undefined,b.cookie)).data.state.profile,{});
 assert(![...f.records.values()].some(r=>r.body.includes('private A')));
 const malformed={state:{profile:[]},revision:1};assert.equal((await f.call('state','PUT',malformed,a.cookie,a.data.csrf)).status,400);
});
test('confirmation pending, reset requests are generic, and email delivery failures are visible',async()=>{
 const f=fixture();f.setConfirm(true);const r=await f.call('register','POST',{email:'pending@example.test',password:'long-password-X'});assert.equal(r.data.pendingVerification,true);assert.equal(r.cookie,undefined);
 const known=await f.call('forgot-password','POST',{email:'pending@example.test'}),unknown=await f.call('forgot-password','POST',{email:'nobody@example.test'});assert.deepEqual(known.data,unknown.data);assert.equal(known.status,200);
 f.setMailFail(true);assert.equal((await f.call('forgot-password','POST',{email:'pending@example.test'})).status,503);
});
test('email recovery exchanges valid tokens, requires confirmation CSRF and resets password',async()=>{
 const f=fixture();const a=await f.call('register','POST',{email:'a@example.test',password:'long-password-A'});
 assert.equal((await f.call('reset-password','POST',{password:'new-long-password'},a.cookie,a.data.csrf)).status,403);
 assert.equal((await f.call('auth-callback','POST',{refresh_token:'invalid',type:'recovery'})).status,401);
 const refresh=[...f.tokens.keys()].find(x=>x.startsWith('refresh-'));
 const recovery=await f.call('auth-callback','POST',{refresh_token:refresh,type:'recovery'});assert.equal(recovery.status,200);assert.equal(recovery.data.recovery,true);
 assert.equal((await f.call('state','GET',undefined,recovery.cookie)).status,403);
 assert.equal((await f.call('reset-password','POST',{password:'new-long-password'},recovery.cookie)).status,403);
 const changed=await f.call('reset-password','POST',{password:'new-long-password'},recovery.cookie,recovery.data.csrf);assert.equal(changed.status,200);assert.match(changed.raw.multiValueHeaders['Set-Cookie'][0],/Max-Age=0/);assert.equal(f.signouts(),1);
 assert.equal((await f.call('login','POST',{email:'a@example.test',password:'long-password-A'})).status,401);assert.equal((await f.call('login','POST',{email:'a@example.test',password:'new-long-password'})).status,200);
});
test('session refresh preserves CSRF; deleting an account requires the password',async()=>{
 const f=fixture();const a=await f.call('register','POST',{email:'a@example.test',password:'long-password-A'});await f.call('state','GET',undefined,a.cookie);
 f.setExpire();const r=await f.call('session','GET',undefined,a.cookie);assert.equal(r.status,200);assert.equal(r.data.csrf,a.data.csrf);assert(r.cookie);
 assert.equal((await f.call('account','DELETE',{password:'wrong-password'},r.cookie,r.data.csrf)).status,403);
 assert.equal((await f.call('account','DELETE',{password:'long-password-A'},r.cookie,r.data.csrf)).status,200);assert.equal(f.records.size,0);assert.equal((await f.call('session','GET',undefined,r.cookie)).status,401);
});
test('ciphertext is authenticated and bound to the journal owner',()=>{
 const key=Buffer.from(env.BLOOM_DATA_KEY,'hex'),sealed=seal({value:'private'},key,'journal:A');assert.deepEqual(unseal(sealed,key,'journal:A'),{value:'private'});assert.throws(()=>unseal(sealed,key,'journal:B'));assert.throws(()=>unseal(sealed.slice(0,-2)+'xx',key,'journal:A'));
});
test('unconfigured deployment fails clearly, rejects malformed cookies and oversized requests',async()=>{
 const handler=makeHandler({});assert.equal((await handler({path:'/api/health',httpMethod:'GET'})).statusCode,503);
 const f=fixture();assert.equal((await f.call('session','GET',undefined,'__Host-bloom_session=garbage')).status,401);
 assert.equal((await f.call('register','POST',{email:'a@example.test',password:'x'.repeat(2_000_001)})).status,413);
});
