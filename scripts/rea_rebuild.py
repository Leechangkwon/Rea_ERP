"""Re-run pinned REA on inert public sources and the prior committed implementation.

No browser control, cookies, login submissions, or original application execution.
"""
import gzip, hashlib, json, shutil, subprocess, sys
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
URLS = [
 'https://resource.ecount.com/ec5/static/ecountv5/presentation/app.login/app.login.erp_login/app.login.erp_login.827a45ec.20.js',
 'https://resourcev3.ecount.com/ec3/freq/ecerp/contents/pages/view.selfcustomize/info/views/xinfo001m.1797956672484306771.20.js',
 'https://resourcev3.ecount.com/ec3/freq/ecerp/contents/pages/view.selfcustomize/emm/views/xemm001m.721226057673937475.20.js',
 'https://resourcev3.ecount.com/ec3/freq/ecerp/contents/pages/view.selfcustomize/emm/views/xemm009m.-5849592966470963154.20.js',
 'https://resourcev3.ecount.com/ec3/freq/ecerp/contents/pages/view.selfcustomize/esc/views/xesc006m.-232706259923588377.20.js',
 'https://resourcev3.ecount.com/ec3/freq/ecerp/contents/pages/view.selfcustomize/emm/views/xemm005m.-666333030118062553.20.js',
 'https://resourcev3.ecount.com/ec3/freq/ecerp/contents/js/ecmodule/common/ecmodule.common.defaultvalue.-2236058844672273776.20.js',
 'https://resourcev3.ecount.com/ec3/freq/ecerp/contents/js/ecount.formset.-8545507540860893780.20.js',
 'https://resource.ecount.com/ec5/static/freq/ecountv56/modules/inventory_shared/inventory_shared.8b01b9b1.js',
 'https://resource.ecount.com/ec5/static/freq/ecountv56/modules/inventory.order_management/inventory.order_management.ff2d28de.js',
 'https://resource.ecount.com/ec5/static/freq/ecountv5/modules/ecount.infra.attribute/ecount.infra.attribute.85b62891.20.js',
]

def capture():
 out=ROOT/'analysis/source-self';out.mkdir(parents=True,exist_ok=True)
 records=[]
 for u in URLS:
  with urlopen(Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=25) as r:
   b=r.read(8_000_001)
   if b[:2]==b'\x1f\x8b':b=gzip.decompress(b)
   if r.status!=200 or len(b)>8_000_000:raise ValueError('Public script size/status limit')
   b.decode('utf-8')
  name=u.rsplit('/',1)[1];(out/name).write_bytes(b)
  records.append({'name':name,'url':u,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'authenticated':False})
  print('Captured',name,len(b),flush=True)
 (ROOT/'evidence/self-public-sources.json').write_text(json.dumps(records,indent=2),encoding='utf-8')

def baseline():
 out=ROOT/'analysis/rea-input/baseline';out.mkdir(parents=True,exist_ok=True)
 files=subprocess.check_output(['git','ls-tree','-r','--name-only','HEAD','dist','worker'],cwd=ROOT,text=True).splitlines()
 records=[]
 for name in files:
  if not name.endswith(('.js','.cjs')) or name.startswith('dist/server/'):continue
  b=subprocess.check_output(['git','show','HEAD:'+name],cwd=ROOT);target=out/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b)
  records.append({'file':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 (ROOT/'evidence/rea-rebuild-baseline.json').write_text(json.dumps({'commit':sha,'files':records},indent=2),encoding='utf-8')

def analyze(label,directory):
 exe=shutil.which('node')
 cli=ROOT/'node_modules/rea-agents/scripts/rea.mjs'
 if not exe or not cli.is_file():raise RuntimeError('Run npm ci to install pinned REA 6.4.0')
 dest=ROOT/'.artifacts'/('rea-'+label+'.json');dest.parent.mkdir(exist_ok=True)
 with dest.open('wb') as out,(ROOT/'.artifacts'/('rea-'+label+'.stderr.log')).open('wb') as err:
  result=subprocess.run([exe,str(cli),'analyze-javascript-application',str(directory),'--artifact-format','directory','--max-heap-mb','4096','--analysis-timeout-ms','45000','--format','json'],cwd=ROOT,stdout=out,stderr=err,timeout=900)
 print('REA',label,'exit',result.returncode,'bytes',dest.stat().st_size,flush=True)
 return result.returncode

if __name__=='__main__':
 mode=sys.argv[1]
 if mode=='capture':capture()
 elif mode=='baseline':baseline();sys.exit(analyze('baseline',ROOT/'analysis/rea-input/baseline'))
 elif mode=='original':sys.exit(analyze('original',ROOT/'analysis/source-self'))
 elif mode=='rebuilt':
  target=ROOT/'analysis/rea-input/rebuilt';target.mkdir(parents=True,exist_ok=True)
  for folder in ['dist','worker']:
   for p in (ROOT/folder).glob('*'):
    if p.suffix in ['.js','.cjs']:
     dst=target/folder/p.name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dst)
  sys.exit(analyze('rebuilt',target))
