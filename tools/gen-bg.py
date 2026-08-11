"""Фон полотна сообщений: детерминированное «созвездие»."""
import os
import random, math
random.seed(20240512)
W,H = 1200, 900
pts=[]
cell=95
for gy in range(0, H+cell, cell):
    for gx in range(0, W+cell, cell):
        x = gx + random.uniform(-38,38)
        y = gy + random.uniform(-38,38)
        pts.append((round(x,1), round(y,1)))
edges=set()
for i,(x1,y1) in enumerate(pts):
    d=[]
    for j,(x2,y2) in enumerate(pts):
        if i==j: continue
        dist=math.hypot(x1-x2,y1-y2)
        if dist < 165: d.append((dist,j))
    d.sort()
    for _,j in d[:3]:
        edges.add((min(i,j),max(i,j)))
lines=[]
for a,b in sorted(edges):
    x1,y1=pts[a]; x2,y2=pts[b]
    lines.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"/>')
dots=[]
for x,y in pts:
    r=round(random.choice([0.9,1.1,1.3,1.6,2.0]),1)
    o=round(random.uniform(.18,.55),2)
    dots.append(f'<circle cx="{x}" cy="{y}" r="{r}" opacity="{o}"/>')
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <g stroke="#9FB6C9" stroke-width=".55" opacity=".085" fill="none">
    {chr(10).join("    "+l for l in lines)}
  </g>
  <g fill="#C6D7E5" opacity=".38">
    {chr(10).join("    "+d for d in dots)}
  </g>
</svg>'''
open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'bg', 'constellation.svg'), 'w').write(svg)
print('bytes', len(svg), 'points', len(pts), 'edges', len(edges))
