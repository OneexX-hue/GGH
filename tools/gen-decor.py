"""Декоративные объёмные иконки для блока «Ключевые функции» и шапки телефона."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'decor')
os.makedirs(OUT, exist_ok=True)

GRADS = '''    <linearGradient id="{u}f" x1=".18" y1="0" x2=".82" y2="1">
      <stop offset="0" stop-color="#5C6873"/><stop offset=".42" stop-color="#2A323B"/><stop offset="1" stop-color="#0C1116"/>
    </linearGradient>
    <linearGradient id="{u}r" x1=".1" y1="0" x2=".7" y2=".85">
      <stop offset="0" stop-color="#DCE6EF" stop-opacity=".85"/><stop offset=".55" stop-color="#7E8B97" stop-opacity=".34"/><stop offset="1" stop-color="#0A0D10" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="{u}g" cx="38%" cy="26%" r="72%">
      <stop offset="0" stop-color="#A8BCCD" stop-opacity=".38"/><stop offset="1" stop-color="#0A0D10" stop-opacity="0"/>
    </radialGradient>'''

def doc(uid, body, vb=64):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb} {vb}" width="{vb}" height="{vb}">\n'
            f'  <defs>\n{GRADS.format(u=uid)}\n  </defs>\n{body}</svg>\n')

SHIELD = "M32 4 8.5 13.6v17.2C8.5 46 17.9 55.9 32 60.6 46.1 55.9 55.5 46 55.5 30.8V13.6Z"

shield = doc('s', f'''  <path d="{SHIELD}" fill="url(#sf)"/>
  <path d="{SHIELD}" fill="url(#sg)"/>
  <path d="{SHIELD}" fill="none" stroke="url(#sr)" stroke-width="1.6"/>
  <rect x="23" y="29" width="18" height="15.5" rx="3.4" fill="#D5E1EB" fill-opacity=".24" stroke="#E2EBF3" stroke-opacity=".8" stroke-width="1.5"/>
  <path d="M27 29v-3.6a5 5 0 0 1 10 0V29" fill="none" stroke="#E2EBF3" stroke-opacity=".8" stroke-width="1.5"/>
  <circle cx="32" cy="35.4" r="1.9" fill="#EDF3F8" fill-opacity=".9"/>
  <path d="M32 37v3.4" stroke="#EDF3F8" stroke-opacity=".9" stroke-width="1.5" stroke-linecap="round"/>
''')

stopwatch = doc('t', '''  <circle cx="32" cy="36" r="23" fill="url(#tf)"/>
  <circle cx="32" cy="36" r="23" fill="url(#tg)"/>
  <circle cx="32" cy="36" r="23" fill="none" stroke="url(#tr)" stroke-width="1.8"/>
  <circle cx="32" cy="36" r="18.4" fill="none" stroke="#D3E0EA" stroke-opacity=".46" stroke-width="1.2"/>
  <circle cx="32" cy="36" r="23" fill="none" stroke="#E2EBF3" stroke-opacity=".46" stroke-width="1.5"/>
  <rect x="26" y="4.5" width="12" height="4.6" rx="2.3" fill="#3D4751" stroke="#D3E0EA" stroke-opacity=".6" stroke-width="1.2"/>
  <path d="M32 9.1V13" stroke="#D3E0EA" stroke-opacity=".62" stroke-width="2"/>
  <path d="M50.5 17.5 54 21" stroke="#D3E0EA" stroke-opacity=".5" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M32 21.4v14.8" stroke="#F0F5F9" stroke-opacity=".92" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M32 36.2h8.6" stroke="#F0F5F9" stroke-opacity=".7" stroke-width="1.7" stroke-linecap="round"/>
  <circle cx="32" cy="36.2" r="1.9" fill="#E4EDF4" fill-opacity=".85"/>
''')

mask = doc('m', '''  <circle cx="32" cy="32" r="30" fill="url(#mf)"/>
  <circle cx="32" cy="32" r="30" fill="url(#mg)"/>
  <circle cx="32" cy="32" r="30" fill="none" stroke="url(#mr)" stroke-width="1.6"/>
  <path d="M11 27.6c0-3.1 2.4-5.2 5.6-5.2h30.8c3.2 0 5.6 2.1 5.6 5.2 0 7.2-4.1 14-10.2 14-3.6 0-6.2-2-8.6-4.9-2.4 2.9-5 4.9-8.6 4.9-6.1 0-10.6-6.8-10.6-14Z" fill="#04060A"/>
  <ellipse cx="23" cy="30.4" rx="4.6" ry="3.1" fill="#E9F0F6" fill-opacity=".92" transform="rotate(-9 23 30.4)"/>
  <ellipse cx="41" cy="30.4" rx="4.6" ry="3.1" fill="#E9F0F6" fill-opacity=".92" transform="rotate(9 41 30.4)"/>
''')

devices = doc('d', '''  <rect x="14" y="6" width="27" height="46" rx="6" fill="url(#df)"/>
  <rect x="14" y="6" width="27" height="46" rx="6" fill="url(#dg)"/>
  <rect x="14" y="6" width="27" height="46" rx="6" fill="none" stroke="url(#dr)" stroke-width="1.6"/>
  <rect x="17.6" y="10.6" width="19.8" height="34" rx="3" fill="#0B0F13" stroke="#B3C4D2" stroke-opacity=".26"/>
  <path d="M24.4 8.4h6.2" stroke="#D3E0EA" stroke-opacity=".65" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="27.5" cy="48.2" r="2.1" fill="none" stroke="#D3E0EA" stroke-opacity=".55" stroke-width="1.2"/>
  <rect x="36" y="28" width="18" height="30" rx="4.4" fill="url(#df)" stroke="url(#dr)" stroke-width="1.5"/>
  <rect x="38.4" y="31.6" width="13.2" height="21.4" rx="2.2" fill="#0C1116" stroke="#B3C4D2" stroke-opacity=".26"/>
  <circle cx="45" cy="55.4" r="1.5" fill="none" stroke="#D3E0EA" stroke-opacity=".55" stroke-width="1.1"/>
''')

for name, data in [('shield.svg', shield), ('stopwatch.svg', stopwatch),
                   ('mask.svg', mask), ('devices.svg', devices)]:
    open(os.path.join(OUT, name), 'w').write(data)
print(sorted(os.listdir(OUT)))
