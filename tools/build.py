import sys, json, re; sys.path.insert(0,'.')
from lib import *
K=100000; SKIP={'02','15','60','66','69','72','78'}
def proj(p): return [[[(x*K,y*K) for x,y in (albers(lo,la) for lo,la in r)] for r in poly] for poly in p]
def simp(ps,t): return [[simplify(r,t) for r in poly] for poly in ps]
def d_of(ps,nd): return path_d([r for poly in ps for r in poly], nd)
def area(r):
    a=0
    for i in range(len(r)-1): a+=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1]
    return abs(a)/2
def keep_major(ps,frac=0.01):
    tot=sum(area(p[0]) for p in ps)
    return [p for p in ps if area(p[0])>=tot*frac]

U={'us':72200/1400,'al':5323/1400,'focus':251/1400}
TOL={'states':U['us']*0.7,'al':U['al']*0.7,'bham':U['focus']*2.5,'nbhd':U['focus']*0.7}

out={'K':K,'projection':'Albers conic equal-area, lon0=-96, lat0=37.5, parallels 29.5/45.5'}
st=json.load(open('states-10m.json')); sa=decode(st)
others=[]; alabama=None
for g in st['objects']['states']['geometries']:
    if g['id'] in SKIP: continue
    p=proj(polys(sa,g))
    if g['id']=='01': alabama=p
    else: others.append((g['properties']['name'],p))
out['states']=[{'name':n,'d':d_of(simp(p,TOL['states']),0)} for n,p in others]
out['alabama']={'name':'Alabama','d':d_of(simp(alabama,TOL['al']),1)}
co=json.load(open('counties-10m.json')); ca=decode(co)
out['alCounties']=[{'name':g['properties']['name'],'d':d_of(simp(proj(polys(ca,g)),TOL['al']),1)}
                   for g in co['objects']['counties']['geometries'] if str(g['id']).startswith('01')]
def city(f,t,nd):
    d=json.load(open(f))[0]; g=d['geojson']
    cs=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
    ps=keep_major(proj(cs))
    return {'name':d['name'],'parts':len(ps),'d':d_of(simp(ps,t),nd)}
out['birmingham']=city('Birmingham.json',TOL['bham'],1)
out['mountainBrook']=city('Mountain_Brook.json',TOL['nbhd'],2)
out['vestaviaHills']=city('Vestavia_Hills.json',TOL['nbhd'],2)

def bb(d):
    n=[float(x) for x in re.findall(r'-?\d+\.?\d*',d)]
    return [min(n[0::2]),min(n[1::2]),max(n[0::2]),max(n[1::2])]
def pad(b,f):
    w,h=b[2]-b[0],b[3]-b[1]; m=max(w,h)*f
    return [round(b[0]-m,1),round(b[1]-m,1),round(w+2*m,1),round(h+2*m,1)]
usb=bb(''.join(s['d'] for s in out['states'])+out['alabama']['d'])
out['views']={'us':pad(usb,0.02),'alabama':pad(bb(out['alabama']['d']),0.10),
              'focus':pad(bb(out['mountainBrook']['d']+out['vestaviaHills']['d']),0.25)}
json.dump(out,open('layers.json','w'))
tot=sum(len(x['d']) for x in out['states'])+sum(len(x['d']) for x in out['alCounties'])+sum(len(out[k]['d']) for k in ('alabama','birmingham','mountainBrook','vestaviaHills'))
print(f'path data total: {tot/1024:.1f}K')
for k,v in out['views'].items(): print(f'  {k:8s} {v}   aspect {v[2]/v[3]:.2f}')
