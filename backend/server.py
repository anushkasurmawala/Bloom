"""Loopback-only development backend. Do not expose this HTTP server publicly."""
import argparse, hashlib, hmac, json, os, re, secrets, sqlite3, time
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from http.cookies import SimpleCookie
from urllib.parse import urlsplit
from collections import defaultdict, deque
from threading import Lock
from cryptography.fernet import Fernet
ROOT=Path(__file__).resolve().parents[1]
ARRAYS=['records','meds','appointments','questions','symptoms','wellness','movements','contractions','postpartumLogs','bag']
def blank():return {'profile':{},**{k:[] for k in ARRAYS},'bag':[{'id':'bag-'+str(i),'text':x,'done':False} for i,x in enumerate(['Medical notes and ID','Phone and charger','Comfortable clothes','Toiletries','Maternity pads','Baby clothes and nappies'])],'birthPlan':{},'mode':'pregnancy','notificationEnabled':False}
def password_hash(password,salt):return hashlib.scrypt(password.encode(),salt=salt,n=32768,r=8,p=1,maxmem=128*1024*1024,dklen=32)
class Storage:
 def __init__(self,path):
  self.path=Path(path);self.path.parent.mkdir(parents=True,exist_ok=True,mode=0o700);os.chmod(self.path.parent,0o700)
  keyfile=self.path.parent/'encryption.key'
  if not keyfile.exists():
   if self.path.exists():raise RuntimeError('Database exists but encryption key is missing. Restore the key; do not replace it.')
   fd=os.open(keyfile,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
   with os.fdopen(fd,'wb') as f:f.write(Fernet.generate_key())
  self.cipher=Fernet(keyfile.read_bytes())
  with self.connect() as db:db.executescript('''CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,salt BLOB NOT NULL,password BLOB NOT NULL,created INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS records(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,body BLOB NOT NULL,revision INTEGER NOT NULL DEFAULT 0);''')
  os.chmod(self.path,0o600)
 def connect(self):
  db=sqlite3.connect(self.path,timeout=10);db.row_factory=sqlite3.Row;db.execute('PRAGMA foreign_keys=ON');return db
 def encode(self,data):return self.cipher.encrypt(json.dumps(data,allow_nan=False).encode())
 def decode(self,data):return json.loads(self.cipher.decrypt(data))
class Backend(ThreadingHTTPServer):
 def __init__(self,address,store):
  self.store=store;self.attempts=defaultdict(deque);self.rate_lock=Lock();super().__init__(address,Handler)
 def limited(self,key):
  with self.rate_lock:
   q=self.attempts[key];now=time.time()
   while q and q[0]<now-600:q.popleft()
   if len(q)>=20:return True
   q.append(now);return False
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'dist'),**kwargs)
 def log_message(self,*args):pass # No account identifiers or health payloads in logs.
 def end_headers(self):
  self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','no-referrer');self.send_header('X-Frame-Options','DENY');self.send_header('Cache-Control','no-store');super().end_headers()
 def reply(self,status,data,cookie=None):
  encoded=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(encoded)));
  if cookie:self.send_header('Set-Cookie',cookie)
  self.end_headers();self.wfile.write(encoded)
 def origin_ok(self):
  allowed={f'localhost:{self.server.server_port}',f'127.0.0.1:{self.server.server_port}'}
  if self.headers.get('Host') not in allowed:return False
  origin=self.headers.get('Origin')
  return origin is None or origin in {f'http://{x}' for x in allowed}
 def identity(self):
  c=SimpleCookie()
  try:c.load(self.headers.get('Cookie',''));token=c['bloom_session'].value
  except (KeyError,ValueError):return None
  digest=hashlib.sha256(token.encode()).hexdigest()
  with self.server.store.connect() as db:return db.execute('SELECT sessions.*,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?',(digest,int(time.time()))).fetchone()
 def body(self):
  size=int(self.headers.get('Content-Length','0'))
  if size<=0 or size>2_000_000:raise ValueError('Request must be under 2 MB.')
  if self.headers.get('Content-Type','').split(';')[0]!='application/json':raise ValueError('JSON required.')
  data=json.loads(self.rfile.read(size))
  if not isinstance(data,dict):raise ValueError('Object required.')
  return data
 def do_GET(self):
  if not self.origin_ok():return self.reply(403,{'error':'Invalid origin.'})
  path=urlsplit(self.path).path
  if path.startswith('/api/'):
   if path=='/api/health':return self.reply(200,{'status':'ready','storage':'local SQLite','hosted':False,'recovery':False,'emailVerification':False})
   identity=self.identity()
   if not identity:return self.reply(401,{'error':'Sign in required.'})
   if self.headers.get('X-Bloom-Account') and self.headers['X-Bloom-Account']!=identity['email']:return self.reply(409,{'error':'A different account is signed in in another tab. Export unsaved changes, then reload.'})
   if path=='/api/session':return self.reply(200,{'user':{'email':identity['email']},'csrf':identity['csrf']})
   if path=='/api/state':
    with self.server.store.connect() as db:row=db.execute('SELECT body,revision FROM records WHERE user_id=?',(identity['user_id'],)).fetchone()
    return self.reply(200,{'state':self.server.store.decode(row['body']),'revision':row['revision']})
   return self.reply(404,{'error':'Not found.'})
  if path=='/sw.js':return super().do_GET()
  return super().do_GET()
 def do_POST(self):self.mutate('POST')
 def do_PUT(self):self.mutate('PUT')
 def do_DELETE(self):self.mutate('DELETE')
 def mutate(self,method):
  if not self.origin_ok():return self.reply(403,{'error':'Invalid origin.'})
  path=urlsplit(self.path).path
  try:
   if path=='/api/forgot-password' and method=='POST':return self.reply(503,{'error':'Password-reset emails are available in the hosted version. This local preview has no email service connected.'})
   if path=='/api/resend-verification' and method=='POST':return self.reply(200,{'message':'Local preview accounts do not require email verification. You can sign in directly.'})
   if path in ['/api/register','/api/login'] and method=='POST':
    if self.server.limited(self.client_address[0]):return self.reply(429,{'error':'Too many attempts. Try again in 10 minutes.'})
    data=self.body();email=str(data.get('email','')).strip().lower();password=data.get('password','')
    if not re.fullmatch(r'[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{1,50}',email) or not isinstance(password,str) or not 12<=len(password)<=256:return self.reply(400,{'error':'Enter a valid email and a password of 12–256 characters.'})
    with self.server.store.connect() as db:
     if path=='/api/register':
      uid=secrets.token_hex(16);salt=secrets.token_bytes(16)
      try:db.execute('INSERT INTO users VALUES(?,?,?,?,?)',(uid,email,salt,password_hash(password,salt),int(time.time())))
      except sqlite3.IntegrityError:return self.reply(409,{'error':'An account with this email already exists. Sign in or use password recovery on the hosted version.'})
      db.execute('INSERT INTO records VALUES(?,?,0)',(uid,self.server.store.encode(blank())))
     else:
      user=db.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone();salt=user['salt'] if user else bytes(16);derived=password_hash(password,salt)
      if not user or not hmac.compare_digest(derived,user['password']):return self.reply(401,{'error':'Email or password is incorrect.'})
      uid=user['id']
     token=secrets.token_urlsafe(32);csrf=secrets.token_urlsafe(32);db.execute('DELETE FROM sessions WHERE expires<?',(int(time.time()),));db.execute('INSERT INTO sessions VALUES(?,?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),uid,csrf,int(time.time())+43200))
    return self.reply(200,{'user':{'email':email},'csrf':csrf},f'bloom_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200')
   identity=self.identity()
   if not identity:return self.reply(401,{'error':'Sign in required.'})
   if self.headers.get('X-Bloom-Account') and self.headers['X-Bloom-Account']!=identity['email']:return self.reply(409,{'error':'A different account is signed in in another tab. Export unsaved changes, then reload.'})
   if not hmac.compare_digest(self.headers.get('X-CSRF-Token',''),identity['csrf']):return self.reply(403,{'error':'Request verification failed.'})
   if path=='/api/logout' and method=='POST':
    with self.server.store.connect() as db:db.execute('DELETE FROM sessions WHERE token=?',(identity['token'],))
    return self.reply(200,{'ok':True},'bloom_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
   if path=='/api/account' and method=='DELETE':
    data=self.body()
    with self.server.store.connect() as db:
     user=db.execute('SELECT * FROM users WHERE id=?',(identity['user_id'],)).fetchone()
     if not hmac.compare_digest(password_hash(str(data.get('password',''))[:256],user['salt']),user['password']):return self.reply(403,{'error':'Password is incorrect.'})
     db.execute('DELETE FROM users WHERE id=?',(identity['user_id'],))
    return self.reply(200,{'ok':True},'bloom_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
   if path=='/api/state' and method=='PUT':
    data=self.body();value=data.get('state');rev=data.get('revision')
    if not isinstance(value,dict) or not isinstance(rev,int) or isinstance(rev,bool):raise ValueError('State and revision required.')
    if not isinstance(value.get('profile',{}),dict) or not isinstance(value.get('birthPlan',{}),dict):raise ValueError('Invalid profile.')
    for k in ARRAYS:
     if not isinstance(value.get(k,[]),list) or len(value.get(k,[]))>10000 or any(not isinstance(x,dict) for x in value.get(k,[])):raise ValueError('Invalid records.')
    allowed=set(blank())|{'activeContraction','birthDate'}
    if set(value)-allowed:raise ValueError('Unknown state fields.')
    with self.server.store.connect() as db:
     updated=db.execute('UPDATE records SET body=?,revision=revision+1 WHERE user_id=? AND revision=?',(self.server.store.encode(value),identity['user_id'],rev)).rowcount
    if not updated:return self.reply(409,{'error':'Records changed in another tab. Export unsaved changes, then reload.'})
    return self.reply(200,{'revision':rev+1})
   return self.reply(404,{'error':'Not found.'})
  except (ValueError,TypeError,json.JSONDecodeError):return self.reply(400,{'error':'Invalid request data.'})
  except Exception:return self.reply(500,{'error':'Unable to process request. No changes confirmed.'})
def main():
 p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8081);p.add_argument('--database',default=str(ROOT.parents[1]/'work/bloom-data/bloom.sqlite3'));a=p.parse_args()
 server=Backend(('127.0.0.1',a.port),Storage(a.database));print(f'Bloom accounts preview: http://localhost:{a.port}',flush=True);server.serve_forever()
if __name__=='__main__':main()
