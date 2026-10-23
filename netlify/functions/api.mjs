import {randomBytes,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import {blank,validateState} from '../lib/journal.mjs';
const COOKIE='__Host-bloom_session';
const JSON_HEADERS={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
export function seal(value,key,context){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(context));const bytes=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),bytes]).toString('base64url');}
export function unseal(value,key,context){const b=Buffer.from(value,'base64url');if(b.length<29)throw Error('Invalid ciphertext');const d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAAD(Buffer.from(context));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8'));}
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function makeHandler(env=process.env,fetcher=fetch){return async event=>{
 let session=null,sessionChanged=false,clearCookie=false,key;
 const reply=(status,data)=>{
  const headers={...JSON_HEADERS};const r={statusCode:status,headers,body:JSON.stringify(data)};
  if(clearCookie)r.multiValueHeaders={'Set-Cookie':[`${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`]};
  else if(sessionChanged&&session){const cookie=seal(session,key,'bloom-session-v1');if(cookie.length>3900)return {statusCode:500,headers,body:JSON.stringify({error:'Account session is too large. Please contact the project owner.'})};r.multiValueHeaders={'Set-Cookie':[`${COOKIE}=${cookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`]};}
  return r;
 };
 try{
  const headers=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
  const method=event.httpMethod;const path=(event.path||'').replace(/^\/\.netlify\/functions\/api\/?/,'').replace(/^\/api\/?/,'').replace(/^\//,'');
  const root=(env.SUPABASE_URL||'').replace(/\/$/,'');const anon=env.SUPABASE_ANON_KEY;const origin=(env.APP_URL||env.URL||'').replace(/\/$/,'');
  if(!root||!anon||!/^https:\/\//.test(root)||!/^https:\/\//.test(origin)||!/^[a-fA-F0-9]{64}$/.test(env.BLOOM_DATA_KEY||''))throw new HttpError(503,'Account setup is incomplete. Configure Supabase, APP_URL and BLOOM_DATA_KEY in Netlify.');
  key=Buffer.from(env.BLOOM_DATA_KEY,'hex');
  if(!['GET','POST','PUT','DELETE'].includes(method))throw new HttpError(405,'Method not allowed.');
  if(method!=='GET'&&headers.origin!==origin)throw new HttpError(403,'Request origin could not be verified. Reload this website and try again.');
  if(headers['sec-fetch-site']==='cross-site')throw new HttpError(403,'Cross-site request rejected.');
  if(path==='health'&&method==='GET')return reply(200,{status:'ready',hosted:true,storage:'Supabase PostgreSQL',recovery:true,emailVerification:true});
  let body={};if(event.body){const bytes=Buffer.from(event.body,event.isBase64Encoded?'base64':'utf8');if(bytes.length>2_000_000)throw new HttpError(413,'Request must be under 2 MB.');if(!headers['content-type']?.startsWith('application/json'))throw new HttpError(400,'JSON required.');try{body=JSON.parse(bytes.toString('utf8'));}catch{throw new HttpError(400,'Invalid request data.');}if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(400,'Invalid request data.');}
  const request=async(path,{token,body,method='GET',prefer}={})=>{
   let r;try{r=await fetcher(root+path,{method,headers:{apikey:anon,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...(prefer?{Prefer:prefer}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});}catch{throw new HttpError(503,'The account service is temporarily unavailable. Please try again.');}
   let data;try{data=await r.json();}catch{data={};}return {ok:r.ok,status:r.status,data};
  };
  const authError=r=>{const code=r.data?.error_code||r.data?.code;if(r.status===429)throw new HttpError(429,'Too many attempts. Please wait before trying again.');if(code==='email_not_confirmed')throw new HttpError(403,'Verify your email before signing in. Use “Resend verification email” below.');if(code==='email_address_not_authorized'||/Email address not authorized/i.test(r.data?.msg||''))throw new HttpError(503,'Email delivery is restricted by the prototype email service. The project owner needs to configure SMTP.');if(r.status>=500)throw new HttpError(503,'The account or email service is unavailable. Please try again later.');throw new HttpError(400,'The request could not be completed. Check the details or request a new email link.');};
  const emailInput=()=>{const email=String(body.email||'').trim().toLowerCase();if(!/^[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{1,50}$/.test(email))throw new HttpError(400,'Enter a valid email address.');return email;};
  const passwordInput=()=>{if(typeof body.password!=='string'||body.password.length<12||body.password.length>256)throw new HttpError(400,'Use a password of 12–256 characters.');return body.password;};
  const startSession=(data,recovery=false)=>{if(!data.access_token||!data.refresh_token||!data.user?.id)throw new HttpError(401,'This link has expired or is invalid. Request a new one.');session={access:data.access_token,refresh:data.refresh_token,csrf:randomBytes(24).toString('base64url'),started:Date.now(),recovery};sessionChanged=true;};
  const publicUser=user=>({id:user.id,email:user.email,emailVerified:Boolean(user.email_confirmed_at)});
  if(path==='register'&&method==='POST'){
   const r=await request('/auth/v1/signup?redirect_to='+encodeURIComponent(origin+'/#auth-callback'),{method:'POST',body:{email:emailInput(),password:passwordInput()}});if(!r.ok)authError(r);
   // Keep the response generic: Supabase deliberately obscures duplicate email registrations.
   if(!r.data.access_token)return reply(200,{pendingVerification:true,message:'Check your inbox to verify your email. If you already have an account, sign in or reset your password.'});
   startSession(r.data);return reply(200,{user:publicUser(r.data.user),csrf:session.csrf});
  }
  if(path==='login'&&method==='POST'){
   const r=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:emailInput(),password:passwordInput()}});
   if(!r.ok){if(r.status===400&&['invalid_credentials','invalid_grant'].includes(r.data.error_code||r.data.error))throw new HttpError(401,'Email or password is incorrect. You can reset your password below.');authError(r);}startSession(r.data);return reply(200,{user:publicUser(r.data.user),csrf:session.csrf});
  }
  if(['forgot-password','resend-verification'].includes(path)&&method==='POST'){
   const email=emailInput(),reset=path==='forgot-password';const r=await request('/auth/v1/'+(reset?'recover':'resend')+'?redirect_to='+encodeURIComponent(origin+(reset?'/#reset-password':'/#auth-callback')),{method:'POST',body:reset?{email}:{email,type:'signup'}});
   if(!r.ok&&r.status!==404){if(r.status===429||r.status>=500||r.data?.error_code==='email_address_not_authorized')authError(r);if(!['user_not_found','email_not_found'].includes(r.data?.error_code))authError(r);}
   return reply(200,{message:reset?'If an account exists for this email, a password-reset link has been sent. Check your inbox and spam folder.':'If this account needs verification, a new email has been sent. Check your inbox and spam folder.'});
  }
  if(path==='auth-callback'&&method==='POST'){
   let r;
   if(body.token_hash){if(!['recovery','signup','email'].includes(body.type))throw new HttpError(400,'Invalid email link.');r=await request('/auth/v1/verify',{method:'POST',body:{token_hash:body.token_hash,type:body.type}});}
   else{if(typeof body.refresh_token!=='string'||body.refresh_token.length>4096)throw new HttpError(400,'Invalid email link.');r=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:body.refresh_token}});}
   if(!r.ok)throw new HttpError(401,'This email link has expired or was already used. Request a new link.');startSession(r.data,body.type==='recovery');return reply(200,{user:publicUser(r.data.user),csrf:session.csrf,recovery:session.recovery});
  }
  const encoded=(headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  try{session=unseal(encoded||'',key,'bloom-session-v1');if(!session.csrf||Date.now()-session.started>604800000)throw Error();}catch{clearCookie=true;throw new HttpError(401,'Sign in to continue.');}
  if(method!=='GET'&&!same(headers['x-csrf-token'],session.csrf))throw new HttpError(403,'Request verification failed. Reload the page and try again.');
  let identity=await request('/auth/v1/user',{token:session.access});
  if(!identity.ok&&identity.status===401){const r=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh}});if(!r.ok){clearCookie=true;throw new HttpError(401,'Your session expired. Please sign in again.');}session.access=r.data.access_token;session.refresh=r.data.refresh_token;sessionChanged=true;identity={ok:true,data:r.data.user};}
  if(!identity.ok){if(identity.status>=500)throw new HttpError(503,'The account service is temporarily unavailable.');clearCookie=true;throw new HttpError(401,'Please sign in again.');}
  const user=identity.data;if(!user?.id){clearCookie=true;throw new HttpError(401,'Please sign in again.');}
  if(headers['x-bloom-account']&&headers['x-bloom-account']!==user.email)throw new HttpError(409,'A different account is signed in in another tab. Export unsaved changes, then reload.');
  if(path==='session'&&method==='GET')return reply(200,{user:publicUser(user),csrf:session.csrf,recovery:session.recovery});
  if(path==='logout'&&method==='POST'){const r=await request('/auth/v1/logout?scope=global',{method:'POST',token:session.access});if(!r.ok&&r.status>=500)throw new HttpError(503,'Sign-out could not finish. Please try again.');clearCookie=true;return reply(200,{ok:true});}
  if(path==='reset-password'&&method==='POST'){
   if(!session.recovery)throw new HttpError(403,'Open the password-reset link from your email first.');const r=await request('/auth/v1/user',{method:'PUT',token:session.access,body:{password:passwordInput()}});if(!r.ok)authError(r);
   const revoked=await request('/auth/v1/logout?scope=global',{method:'POST',token:session.access});clearCookie=true;
   return reply(200,{ok:true,message:revoked.ok?'Password updated. Sign in with your new password.':'Password updated. Sign in again; revoking other sessions could not be confirmed.'});
  }
  if(session.recovery)throw new HttpError(403,'Choose your new password before opening your journal.');
  const table='/rest/v1/bloom_journals';const own='user_id=eq.'+encodeURIComponent(user.id);
  if(path==='state'&&method==='GET'){
   const created=await request(table,{method:'POST',token:session.access,body:{user_id:user.id,body:seal(blank(),key,'journal:'+user.id),revision:0},prefer:'resolution=ignore-duplicates,return=minimal'});if(!created.ok)throw new HttpError(503,'Journal storage is not ready. Apply the database migration first.');
   const r=await request(table+'?'+own+'&select=body,revision',{token:session.access});if(!r.ok||!r.data[0])throw new HttpError(503,'Could not load your saved journal. Please try again.');
   let state;try{state=unseal(r.data[0].body,key,'journal:'+user.id);}catch{throw new HttpError(503,'Your journal could not be decrypted. The project owner must check the data key; do not overwrite the saved records.');}return reply(200,{state,revision:r.data[0].revision});
  }
  if(path==='state'&&method==='PUT'){
   try{validateState(body.state);}catch(e){throw new HttpError(400,e.message);}if(!Number.isSafeInteger(body.revision)||body.revision<0)throw new HttpError(400,'Journal revision is required.');
   const r=await request(table+'?'+own+'&revision=eq.'+body.revision,{method:'PATCH',token:session.access,body:{body:seal(body.state,key,'journal:'+user.id),revision:body.revision+1},prefer:'return=representation'});if(!r.ok)throw new HttpError(503,'Could not save your journal. Your edits remain in this tab.');if(!r.data.length)throw new HttpError(409,'Records changed in another tab. Export unsaved changes, then reload.');return reply(200,{revision:r.data[0].revision});
  }
  if(path==='account'&&method==='DELETE'){
   const check=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:user.email,password:passwordInput()}});if(!check.ok)throw new HttpError(403,'Password is incorrect.');
   const deleted=await request('/rest/v1/rpc/delete_own_bloom_account',{method:'POST',token:check.data.access_token,body:{}});if(!deleted.ok)throw new HttpError(503,'Account deletion failed. Please try again.');clearCookie=true;return reply(200,{ok:true});
  }
  throw new HttpError(404,'Not found.');
 }catch(e){return reply(e instanceof HttpError?e.status:500,{error:e instanceof HttpError?e.message:'The request could not be completed. Please try again.'});}
};}
export const handler=makeHandler();
