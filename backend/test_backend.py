import sys,tempfile,threading,json,urllib.request,urllib.error,sqlite3
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from server import Backend,Storage
with tempfile.TemporaryDirectory() as temp:
 store=Storage(Path(temp)/'bloom.sqlite3');server=Backend(('127.0.0.1',0),store);threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://localhost:{server.server_port}'
 def call(path,method='GET',data=None,cookie=None,csrf=None,origin=None):
  h={}
  if data is not None:h['Content-Type']='application/json'
  if cookie:h['Cookie']=cookie
  if csrf:h['X-CSRF-Token']=csrf
  if origin:h['Origin']=origin
  req=urllib.request.Request(base+'/api/'+path,data=json.dumps(data).encode() if data is not None else None,headers=h,method=method)
  try:r=urllib.request.urlopen(req)
  except urllib.error.HTTPError as e:r=e
  return r.status,json.loads(r.read()),r.headers.get('Set-Cookie')
 assert call('state')[0]==401
 status,a,ca=call('register','POST',{'email':'a@example.test','password':'unique-test-password-A'});assert status==200
 status,b,cb=call('register','POST',{'email':'b@example.test','password':'unique-test-password-B'});assert status==200
 assert call('login','POST',{'email':'a@example.test','password':'incorrect-password'})[0]==401
 assert call('state','PUT',{'state':{'profile':{'name':'private-a'}},'revision':0},ca)[0]==403
 assert call('state','PUT',{'state':{'profile':{'name':'private-a'}},'revision':0},ca,a['csrf'],origin='https://evil.test')[0]==403
 assert call('state','PUT',{'state':{'profile':{'name':'private-a'}},'revision':0},ca,a['csrf'])[0]==200
 assert call('state','PUT',{'state':{},'revision':0},ca,a['csrf'])[0]==409
 assert call('state',cookie=cb)[1]['state']['profile']=={}
 assert call('state',cookie=ca)[1]['state']['profile']['name']=='private-a'
 store2=Storage(Path(temp)/'bloom.sqlite3')
 with store2.connect() as db:
  row=db.execute('SELECT body FROM records JOIN users ON users.id=records.user_id WHERE email=?',('a@example.test',)).fetchone();assert b'private-a' not in row['body'];assert store2.decode(row['body'])['profile']['name']=='private-a'
 assert call('logout','POST',cookie=ca,csrf=a['csrf'])[0]==200
 assert call('state',cookie=ca)[0]==401
 assert call('account','DELETE',{'password':'wrong-password'},cb,b['csrf'])[0]==403
 assert call('account','DELETE',{'password':'unique-test-password-B'},cb,b['csrf'])[0]==200
 assert call('state',cookie=cb)[0]==401
 with store.connect() as db:assert db.execute('SELECT count(*) FROM users').fetchone()[0]==1;assert db.execute('SELECT count(*) FROM records').fetchone()[0]==1
 server.shutdown()
 print('PASS: registration, sign-in, password checks, CSRF/origin checks, owner isolation, conflicting saves, encrypted persistence, logout revocation and account deletion.')
