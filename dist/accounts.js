'use strict';
let accountUser=null,accountCsrf='',accountRevision=0,accountReady=false,accountBackend=true;
let accountMode='login',accountEmail='',accountError='',accountMessage='',accountHosted=false,accountRecovery=false;
let savePending=false,saveInFlight=false,saveBlocked=false,saveSequence=0;
const authForms=['loginForm','registerForm','forgotForm','resetPasswordForm'];
const initialState=()=>({profile:{},records:[],meds:[],appointments:[],questions:[],symptoms:[],wellness:[],movements:[],contractions:[],postpartumLogs:[],bag:['Medical notes and ID','Phone and charger','Comfortable clothes','Toiletries','Maternity pads','Baby clothes and nappies'].map((text,i)=>({id:'bag-'+i,text,done:false})),birthPlan:{},mode:'pregnancy',notificationEnabled:false});
async function api(path,method='GET',body){let r;try{r=await fetch('/api/'+path,{method,credentials:'same-origin',cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(accountCsrf?{'X-CSRF-Token':accountCsrf}:{}),...(accountUser?{'X-Bloom-Account':accountUser.email}:{})},...(body?{body:JSON.stringify(body)}:{})})}catch{throw Error('Could not connect. Check your internet connection and try again.')}let data;try{data=await r.json()}catch{throw Error('Account services are unavailable. Please try again later.')}if(!r.ok){let e=Error(data.error||'Request failed');e.status=r.status;throw e}return data}
function syncLabel(text){let el=$('#syncStatus');if(el)el.textContent=text}
function accountSave(){if(!accountUser||saveBlocked){syncLabel('Not saved — sign in or resolve the conflict');return false}savePending=true;saveSequence++;syncLabel('Saving…');void flushAccount();return true}
async function flushAccount(){if(saveInFlight||saveBlocked||!accountUser)return;saveInFlight=true;while(savePending&&!saveBlocked&&accountUser){savePending=false;let snap=JSON.parse(JSON.stringify(state));try{let result=await api('state','PUT',{state:snap,revision:accountRevision});accountRevision=result.revision;if(!savePending)syncLabel('Saved to your account')}catch(e){savePending=true;saveBlocked=true;syncLabel('Not saved');notify(e.message+' Your current edits remain in memory. Export them before reloading.');if($('#syncActions'))$('#syncActions').hidden=false;break}}saveInFlight=false}
function accountHeader(){
 let el=$('#accountControls');if(!el){el=document.createElement('div');el.id='accountControls';$('header').prepend(el)}
 el.innerHTML=accountUser?`<span>${esc(accountUser.email)}</span><small id="syncStatus">Saved to your account</small><button class="secondary" id="signout">Sign out</button><div id="syncActions" hidden><button id="retrySave">Retry save</button><button id="unsavedExport">Export current records</button></div>`:'<span class="account-wordmark">A little care, every day.</span>';
 if($('#report'))$('#report').hidden=!accountUser;$('#nav').hidden=!accountUser;
 document.body.classList.toggle('auth-screen',!accountUser);
 $('.aside-bottom').innerHTML='<p>Your space to plan, track, and prepare.<br>Educational support, one day at a time.</p>';
}
function authLink(mode,label){return `<button type="button" class="auth-switch" data-account-mode="${mode}">${label}</button>`}
function passwordField(name,label,autocomplete){return `<div class="password-field">${field(name,label,'password','','required minlength="12" maxlength="256" autocomplete="'+autocomplete+'"')}<button type="button" class="password-toggle" data-password-toggle="${name}" aria-label="Show ${label.toLowerCase()}">Show</button></div>`}
function accountGate(){
 accountHeader();
 const error=accountError?`<div class="auth-feedback error" role="alert">${esc(accountError)}</div>`:'';
 const message=accountMessage?`<div class="auth-feedback success" role="status">${esc(accountMessage)}</div>`:'';
 if(!accountBackend)return `<div class="auth-panel">${heading('Let’s get you connected','Your journal will be here when the account service is available.')}${card('Account service unavailable',error+'<p>Please try refreshing in a moment. If this is a new deployment, complete the account-service setup in the project instructions.</p>')}</div>`;
 let title,subtitle,content;
 if(accountMode==='check-email'){
  title='Check your inbox';subtitle='One more step to your personal space.';
  content=`${message}<p>Look for an email at <strong>${esc(accountEmail)}</strong>. Check your spam folder too.</p><p>${authLink('login','Back to sign in')} · ${authLink('forgot','Need a password-reset link?')}</p><button type="button" class="secondary" id="resendVerification">Resend verification email</button>`;
 }else if(accountMode==='reset'){
  title='Choose a new password';subtitle='Make it unique and easy for you to remember.';
  content=message+form('resetPasswordForm',passwordField('newPassword','New password','new-password')+passwordField('confirmPassword','Confirm new password','new-password')+'<p class="muted">Use at least 12 characters.</p>','Save new password');
 }else if(accountMode==='forgot'){
  title='Forgot your password?';subtitle='We’ll help you get back to your journal.';
  content=message+form('forgotForm',`<p>${field('recoveryEmail','Email address','email',accountEmail,'required autocomplete="email"')}</p><p class="muted">We’ll email a link to choose a new password.</p>`,'Send reset link')+`<p class="auth-switcher">${authLink('login','Back to sign in')}</p>`;
 }else if(accountMode==='register'){
  title='Your journey starts here';subtitle='Create your own space for every step ahead.';
  content=message+form('registerForm',`<p>${field('registerEmail','Email address','email',accountEmail,'required autocomplete="email"')}</p>`+passwordField('registerPassword','Create a password','new-password')+passwordField('registerConfirm','Confirm password','new-password')+'<p class="muted">Use at least 12 characters. You may be asked to verify your email.</p>','Create account')+`<p class="auth-switcher">Already have an account? ${authLink('login','Sign in')}</p>`;
 }else{
  title='Welcome back';subtitle='Your journal, your plans, your peace of mind.';
  content=message+form('loginForm',`<p>${field('loginEmail','Email address','email',accountEmail,'required autocomplete="username"')}</p>`+passwordField('loginPassword','Password','current-password')+`<p class="forgot-link">${authLink('forgot','Forgot password?')}</p>`,'Sign in')+`<p class="auth-switcher">Don’t have an account? ${authLink('register','Sign up')}</p><p class="verification-link"><button type="button" class="auth-switch" id="resendVerification">Resend verification email</button></p>`;
 }
 return `<div class="auth-panel"><span class="eyebrow">A SPACE THAT’S YOURS</span>${heading(title,subtitle)}<section class="card auth-card">${error}${content}</section><p class="auth-privacy">${accountHosted?'Your journal is saved privately to your account.':'Local preview · Your journal is saved on this computer.'} Use fictional health information while testing.</p></div>`;
}
async function loadAccount(){let data=await api('state');state={...initialState(),...data.state};accountRevision=data.revision;ensureExtras();savePending=false;saveBlocked=false;saveSequence=0;accountError='';render();accountHeader()}
const settingsBeforeAccounts=renderers.settings;
renderers.settings=()=>settingsBeforeAccounts()+card('Your account',`<p>Signed in as <strong>${esc(accountUser?.email)}</strong>.</p><p>${accountHosted?'Your journal is encrypted by the backend and stored in a database under your account.':'Your journal is encrypted in the local account database on this computer.'} Sign out on shared devices.</p><p>Export records before moving between the local and hosted versions. Import replaces the current journal after confirmation.</p><label for="importRecords">Import a Bloom journal export</label><input id="importRecords" type="file" accept="application/json,.json"><p><button id="accountDelete" class="danger">Delete account</button></p>`);
async function logOut(){if(savePending||saveInFlight){notify('Wait for saving to finish. Resolve any save error before signing out.');return}try{await api('logout','POST');accountUser=null;accountMode='login';accountCsrf='';state=initialState();ensureExtras();saveBlocked=false;savePending=false;alerted.clear();sentAlerts.clear();accountMessage='You have signed out.';render();accountHeader()}catch(e){notify(e.message)}}
async function resendVerification(button){
 const email=$('#loginEmail')?.value||$('#registerEmail')?.value||accountEmail;
 if(!email){accountError='Enter your email address first, then select resend.';render();return}
 button.disabled=true;accountEmail=email;accountError='';
 try{const result=await api('resend-verification','POST',{email});accountMessage=result.message;render()}catch(e){accountError=e.message;render()}
}
document.addEventListener('submit',async e=>{
 if(!authForms.includes(e.target.id))return;e.preventDefault();const id=e.target.id,v=vals(e.target),b=e.target.querySelector('button:not([type]),button[type="submit"]');
 accountEmail=v.loginEmail||v.registerEmail||v.recoveryEmail||accountEmail;accountError='';accountMessage='';
 if(id==='registerForm'&&v.registerPassword!==v.registerConfirm){accountError='The passwords do not match. Please enter them again.';render();return}
 if(id==='resetPasswordForm'&&v.newPassword!==v.confirmPassword){accountError='The passwords do not match. Please enter them again.';render();return}
 b.disabled=true;
 try{
  if(id==='forgotForm'){const r=await api('forgot-password','POST',{email:accountEmail});accountMessage=r.message;render();return}
  if(id==='resetPasswordForm'){const r=await api('reset-password','POST',{password:v.newPassword});accountUser=null;accountCsrf='';accountMode='login';accountMessage=r.message||'Password updated. Sign in with your new password.';render();return}
  const registering=id==='registerForm';const r=await api(registering?'register':'login','POST',{email:accountEmail,password:registering?v.registerPassword:v.loginPassword});
  if(r.pendingVerification){accountMode='check-email';accountMessage=r.message;render();return}
  accountUser=r.user;accountCsrf=r.csrf;await loadAccount();notify(registering?'Welcome to Bloom. Your journal is ready.':'Welcome back. Your journal is loaded.');
 }catch(err){if(!savePending)accountUser=null;accountError=err.message;render()}
});
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.passwordToggle){const input=$('#'+b.dataset.passwordToggle);const show=input.type==='password';input.type=show?'text':'password';b.textContent=show?'Hide':'Show';b.setAttribute('aria-label',(show?'Hide ':'Show ')+input.previousElementSibling.textContent.toLowerCase());return}
 if(b.dataset.accountMode){if(accountUser)return;accountEmail=$('#loginEmail')?.value||$('#registerEmail')?.value||$('#recoveryEmail')?.value||accountEmail;accountMode=b.dataset.accountMode;accountError='';accountMessage='';render();$('.auth-panel input')?.focus();return}
 if(b.id==='resendVerification'){await resendVerification(b);return}
 if(b.id==='signout')await logOut();if(b.id==='retrySave'){saveBlocked=false;void flushAccount()}if(b.id==='unsavedExport')download('bloom-unsaved-records.json',JSON.stringify(state,null,2),'application/json');
 if(b.id==='accountDelete'){if(savePending||saveInFlight){notify('Finish saving before deleting your account.');return}const pw=prompt('Enter your password to permanently delete this account and its saved records.');if(pw===null)return;if(!confirm('Permanently delete this account and all its saved health records?'))return;try{await api('account','DELETE',{password:pw});accountUser=null;accountMode='login';accountCsrf='';state=initialState();ensureExtras();accountMessage='Your account and its current records have been deleted.';render();accountHeader()}catch(err){notify(err.message)}}
});
document.addEventListener('change',async e=>{if(e.target.id!=='importRecords')return;let f=e.target.files[0];if(!f)return;try{if(f.size>1_900_000)throw Error('Import file is too large.');let data=JSON.parse(await f.text());if(!data||typeof data!=='object'||Array.isArray(data)||!data.profile||typeof data.profile!=='object')throw Error('Choose a valid Bloom JSON export.');for(let k of ['records','meds','appointments','questions','symptoms','wellness','movements','contractions','postpartumLogs','bag'])if(data[k]!==undefined&&(!Array.isArray(data[k])||data[k].some(x=>!x||typeof x!=='object'||Array.isArray(x))))throw Error('Invalid journal records.');if(!confirm('Replace this account’s journal with the selected export?'))return;let clean=initialState();for(let k of Object.keys(clean).concat(['birthDate','activeContraction']))if(data[k]!==undefined)clean[k]=data[k];state=clean;ensureExtras();accountSave();render();notify('Import queued for account storage. Check the save status.')}catch(err){notify(err.message)}});
// Only public account controls remain usable before authentication.
document.addEventListener('submit',e=>{if(!accountUser&&!authForms.includes(e.target.id)){e.preventDefault();e.stopImmediatePropagation();notify('Sign in first.')}},true);
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!accountUser&&b&&!b.dataset.accountMode&&!b.dataset.passwordToggle&&b.id!=='resendVerification'&&!authForms.includes(b.closest('form')?.id)){e.stopImmediatePropagation();e.preventDefault()}},true);
window.addEventListener('beforeunload',e=>{if(savePending||saveInFlight){e.preventDefault();e.returnValue=''}});
(async()=>{
 // Remove email tokens before making requests or rendering any callback content.
 const fragment=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);
 const callback=fragment.has('refresh_token')||fragment.has('error_description')||fragment.has('token_hash')||query.has('token_hash');
 let authData=null,callbackError='';
 if(callback){authData={refresh_token:fragment.get('refresh_token'),token_hash:fragment.get('token_hash')||query.get('token_hash'),type:fragment.get('type')||query.get('type')};callbackError=fragment.get('error_description')||'';history.replaceState(null,'',location.pathname);}
 try{
  const health=await api('health');accountHosted=Boolean(health.hosted);accountRecovery=Boolean(health.recovery);
  if(callbackError)throw Error('This email link is invalid or expired. Request a new link.');
  let session;
  if(authData)session=await api('auth-callback','POST',authData);
  else{try{session=await api('session')}catch(e){if(e.status===401)return;throw e}}
  accountCsrf=session.csrf;
  if(session.recovery){accountMode='reset';accountUser=null;return}
  accountUser=session.user;await loadAccount();
 }catch(e){accountUser=null;accountError=e.message;if(e.status===503)accountBackend=false;if(callback)accountMode='forgot'}
 finally{accountReady=true;render();accountHeader()}
})();
