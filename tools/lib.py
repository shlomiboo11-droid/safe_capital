import json, math

# ── פענוח TopoJSON (delta-encoded arcs → קואורדינטות) ──────────────
def decode(topo):
    sc, tr = topo['transform']['scale'], topo['transform']['translate']
    arcs=[]
    for arc in topo['arcs']:
        x=y=0; pts=[]
        for dx,dy in arc:
            x+=dx; y+=dy
            pts.append((x*sc[0]+tr[0], y*sc[1]+tr[1]))
        arcs.append(pts)
    return arcs

def ring(arcs, idxs):
    out=[]
    for i in idxs:
        a = arcs[~i][::-1] if i<0 else arcs[i]
        out.extend(a if not out else a[1:])
    return out

def polys(arcs, geom):
    t=geom['type']
    if t=='Polygon':      return [[ring(arcs,r) for r in geom['arcs']]]
    if t=='MultiPolygon': return [[ring(arcs,r) for r in p] for p in geom['arcs']]
    return []

# ── היטל Albers חרוטי שווה־שטח, אותו אחד לכל שלוש הרמות ──────────
def albers(lon, lat, lon0=-96.0, lat0=37.5, p1=29.5, p2=45.5):
    lon,lat = math.radians(lon), math.radians(lat)
    lon0,lat0 = math.radians(lon0), math.radians(lat0)
    p1,p2 = math.radians(p1), math.radians(p2)
    n = 0.5*(math.sin(p1)+math.sin(p2))
    C = math.cos(p1)**2 + 2*n*math.sin(p1)
    r0 = math.sqrt(C - 2*n*math.sin(lat0))/n
    r  = math.sqrt(C - 2*n*math.sin(lat))/n
    th = n*(lon-lon0)
    # SVG הוא y-כלפי-מטה; ההיטל הגולמי הוא y-כלפי-מעלה, ולכן היפוך.
    return (r*math.sin(th), r*math.cos(th) - r0)

# ── פישוט Douglas–Peucker ────────────────────────────────────────
def simplify(pts, tol):
    if len(pts)<3: return pts
    def d2(p,a,b):
        (x,y),(x1,y1),(x2,y2)=p,a,b
        dx,dy=x2-x1,y2-y1
        if dx==0 and dy==0: return (x-x1)**2+(y-y1)**2
        t=max(0,min(1,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)))
        return (x-(x1+t*dx))**2 + (y-(y1+t*dy))**2
    keep=[False]*len(pts); keep[0]=keep[-1]=True
    stack=[(0,len(pts)-1)]
    t2=tol*tol
    while stack:
        i,j=stack.pop()
        if j<=i+1: continue
        best,bi=0,-1
        for k in range(i+1,j):
            dd=d2(pts[k],pts[i],pts[j])
            if dd>best: best,bi=dd,k
        if best>t2:
            keep[bi]=True; stack.append((i,bi)); stack.append((bi,j))
    return [p for p,k in zip(pts,keep) if k]

def path_d(rings, nd=2):
    out=[]
    for r in rings:
        if len(r)<3: continue
        out.append('M'+' '.join(f'{x:.{nd}f},{y:.{nd}f}' for x,y in r)+'Z')
    return ''.join(out)
