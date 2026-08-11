import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'avatars')
os.makedirs(OUT, exist_ok=True)

def wrap(uid, body, defs=""):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <clipPath id="c{uid}"><circle cx="32" cy="32" r="32"/></clipPath>
    <radialGradient id="bg{uid}" cx="38%" cy="26%" r="82%">
      <stop offset="0" stop-color="#3E4751"/><stop offset=".42" stop-color="#141A21"/><stop offset="1" stop-color="#05080B"/>
    </radialGradient>
    <linearGradient id="rim{uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#C4D0DA" stop-opacity=".78"/><stop offset=".55" stop-color="#49535C" stop-opacity=".38"/><stop offset="1" stop-color="#0A0F14" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="tor{uid}" x1=".2" y1="0" x2=".8" y2="1">
      <stop offset="0" stop-color="#2C343C"/><stop offset="1" stop-color="#080C10"/>
    </linearGradient>
{defs}  </defs>
  <g clip-path="url(#c{uid})">
    <rect width="64" height="64" fill="url(#bg{uid})"/>
{body}    <circle cx="32" cy="32" r="31.5" fill="none" stroke="#FFFFFF" stroke-opacity=".10"/>
  </g>
</svg>'''

# 1. Алексей — hooded figure, balaclava
alexey = wrap('a', '''    <path d="M12 64c1.5-13 9-19.5 20-19.5S50.5 51 52 64Z" fill="url(#tora)"/>
    <path d="M32 12c-8.4 0-13.6 6.2-13.6 14.6 0 8 4.2 15.4 13.6 15.4s13.6-7.4 13.6-15.4C45.6 18.2 40.4 12 32 12Z" fill="#080D12" stroke="#C7D4DF" stroke-opacity=".22" stroke-width=".8"/>
    <path d="M32 12c-8.4 0-13.6 6.2-13.6 14.6 0 3 .6 6 1.8 8.6-.4-9.6 3.6-17 11.8-17 5.4 0 9.2 3 11.2 7.6.9-9-3.4-13.8-11.2-13.8Z" fill="url(#rima)"/>
    <path d="M22.5 27.6c2.4-1.6 5.2-1.6 7.6 0-2.3 1.5-5.2 1.5-7.6 0Zm11.4 0c2.4-1.6 5.2-1.6 7.6 0-2.3 1.5-5.2 1.5-7.6 0Z" fill="#C9D6E1" fill-opacity=".62"/>
    <path d="M18.4 44.5c3.6-3.6 8.2-5.4 13.6-5.4s10 1.8 13.6 5.4c-3.4 3-8.2 4.6-13.6 4.6s-10.2-1.6-13.6-4.6Z" fill="#070C11" stroke="#C7D4DF" stroke-opacity=".18" stroke-width=".8" fill-opacity=".8"/>
''')

# 2. Елена — woman, long hair
elena = wrap('e', '''    <path d="M11 64c1.8-12.4 9.6-18.6 21-18.6S51.2 51.6 53 64Z" fill="url(#tore)"/>
    <path d="M32 13c-7.6 0-12.4 5.6-12.4 13.4 0 4 .8 7.6 2.4 10.4-3 3.2-4.4 8.6-4.6 15.2h5.4c.6-6.4 3.2-10 9.2-10s8.6 3.6 9.2 10h5.4c-.2-6.6-1.6-12-4.6-15.2 1.6-2.8 2.4-6.4 2.4-10.4C44.4 18.6 39.6 13 32 13Z" fill="#090F15" stroke="#C7D4DF" stroke-opacity=".2" stroke-width=".8"/>
    <ellipse cx="32" cy="28.5" rx="8.2" ry="10" fill="#2B333C"/>
    <path d="M32 18.5c4.8 0 7.8 3.4 8.2 9-1.6-3.4-4.4-5.2-8.2-5.2s-6.6 1.8-8.2 5.2c.4-5.6 3.4-9 8.2-9Z" fill="#090F15" stroke="#C7D4DF" stroke-opacity=".2" stroke-width=".8"/>
    <path d="M23.8 26.6c.4-6.4 3.6-10 8.2-10 2.8 0 5 1.2 6.5 3.3-1.7-1-3.6-1.5-5.7-1.5-4.8 0-7.9 3.2-9 8.2Z" fill="url(#rime)"/>
    <circle cx="28.6" cy="28.4" r="1.05" fill="#0A0E12" fill-opacity=".85"/>
    <circle cx="35.4" cy="28.4" r="1.05" fill="#0A0E12" fill-opacity=".85"/>
    <path d="M29.7 34.4c1.5.9 3.1.9 4.6 0" stroke="#0A0E12" stroke-opacity=".5" stroke-width="1" fill="none" stroke-linecap="round"/>
''')

# 3. Оперативная группа — three figures
group = wrap('g', '''    <g fill="#080D12" stroke="#C7D4DF" stroke-opacity=".22" stroke-width=".8">
      <path d="M2 64c1-9.4 6.4-14.2 14-14.2S29 54.6 30 64Z"/>
      <ellipse cx="16" cy="41" rx="8" ry="9"/>
      <path d="M34 64c1-9.4 6.4-14.2 14-14.2S61 54.6 62 64Z"/>
      <ellipse cx="48" cy="41" rx="8" ry="9"/>
    </g>
    <path d="M16 32c-5.2 0-8 3.6-8 9 0 1.6.2 3 .6 4.3C9.4 39.6 12.2 36 16 36s6.6 3.6 7.4 9.3c.4-1.3.6-2.7.6-4.3 0-5.4-2.8-9-8-9Z" fill="url(#rimg)" opacity=".7"/>
    <path d="M14 62c1.6-13.4 9-20 18-20s16.4 6.6 18 20Z" fill="url(#torg)"/>
    <path d="M32 15c-7.8 0-12.6 5.8-12.6 13.6C19.4 36 23.6 43 32 43s12.6-7 12.6-14.4C44.6 20.8 39.8 15 32 15Z" fill="#080D12" stroke="#C7D4DF" stroke-opacity=".22" stroke-width=".8"/>
    <path d="M32 15c-7.8 0-12.6 5.8-12.6 13.6 0 2.4.4 4.8 1.2 6.9-.2-8.8 3.6-15.5 11.4-15.5 5 0 8.6 2.8 10.4 7.1C43.2 19.4 39.2 15 32 15Z" fill="url(#rimg)"/>
    <path d="M23.6 29.4c2.2-1.5 4.8-1.5 7 0-2.1 1.4-4.8 1.4-7 0Zm10.2 0c2.2-1.5 4.8-1.5 7 0-2.1 1.4-4.8 1.4-7 0Z" fill="#C9D6E1" fill-opacity=".55"/>
''')

# 4. Дмитрий — man, short hair
dmitry = wrap('d', '''    <path d="M10 64c2-12.6 10-19 22-19s20 6.4 22 19Z" fill="url(#tord)"/>
    <ellipse cx="32" cy="28" rx="10.6" ry="12.6" fill="#2F3841"/>
    <path d="M32 14.4c6 0 9.8 3.6 10.6 10.4-1-4.4-5-7-10.6-7s-9.6 2.6-10.6 7C22.2 18 26 14.4 32 14.4Z" fill="#080D12" stroke="#C7D4DF" stroke-opacity=".22" stroke-width=".8"/>
    <path d="M21.4 26.8C22 18.6 26 14.4 32 14.4c3.4 0 6.2 1.4 8 3.9-2-1.3-4.5-2-7.4-2-5.9 0-9.7 3.6-11.2 10.5Z" fill="url(#rimd)"/>
    <circle cx="27.9" cy="27.6" r="1.15" fill="#0A0E12" fill-opacity=".85"/>
    <circle cx="36.1" cy="27.6" r="1.15" fill="#0A0E12" fill-opacity=".85"/>
    <path d="M29.4 34.6c1.7 1 3.5 1 5.2 0" stroke="#0A0E12" stroke-opacity=".55" stroke-width="1.1" fill="none" stroke-linecap="round"/>
    <path d="M23.6 45.4 32 52l8.4-6.6c4.8 1.8 8 6.4 9.2 13.6H14.4c1.2-7.2 4.4-11.8 9.2-13.6Z" fill="#171E25"/>
''')

# 5. Архив — masked figure, dimmer
archive = wrap('r', '''    <path d="M13 64c1.4-12.6 8.6-19 19-19s17.6 6.4 19 19Z" fill="url(#torr)"/>
    <path d="M32 13.5c-8 0-13 5.8-13 13.8 0 7.6 4 14.7 13 14.7s13-7.1 13-14.7c0-8-5-13.8-13-13.8Z" fill="#070C11" stroke="#C7D4DF" stroke-opacity=".18" stroke-width=".8"/>
    <path d="M32 13.5c-8 0-13 5.8-13 13.8 0 2.6.5 5.2 1.4 7.5-.2-9 3.5-15.9 11.6-15.9 5.1 0 8.8 2.9 10.7 7.3-.5-8.4-4.6-12.7-10.7-12.7Z" fill="url(#rimr)" opacity=".75"/>
    <path d="M23.4 28.2c2.3-1.5 5-1.5 7.3 0-2.2 1.4-5 1.4-7.3 0Zm10.9 0c2.3-1.5 5-1.5 7.3 0-2.2 1.4-5 1.4-7.3 0Z" fill="#B9C7D3" fill-opacity=".45"/>
    <rect width="64" height="64" fill="#04070A" opacity=".16"/>
''')

for name, data in [('alexey',alexey),('elena',elena),('group',group),('dmitry',dmitry),('archive',archive)]:
    open(os.path.join(OUT, f'{name}.svg'), 'w').write(data)

# Large portrait for info panel (128 viewBox)
portrait = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <clipPath id="cp"><circle cx="64" cy="64" r="64"/></clipPath>
    <radialGradient id="pbg" cx="42%" cy="24%" r="80%">
      <stop offset="0" stop-color="#5A6673"/><stop offset=".4" stop-color="#242C35"/><stop offset="1" stop-color="#070B0F"/>
    </radialGradient>
    <linearGradient id="phood" x1=".15" y1="0" x2=".85" y2="1">
      <stop offset="0" stop-color="#D2DDE6" stop-opacity=".72"/><stop offset=".5" stop-color="#4C5661" stop-opacity=".42"/><stop offset="1" stop-color="#080D12" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="ptor" x1=".2" y1="0" x2=".8" y2="1">
      <stop offset="0" stop-color="#2E3740"/><stop offset="1" stop-color="#080D12"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#cp)">
    <rect width="128" height="128" fill="url(#pbg)"/>
    <path d="M22 128c3-26.5 18.6-39 42-39s39 12.5 42 39Z" fill="url(#ptor)"/>
    <path d="M64 22c-17.2 0-27.8 12.6-27.8 29.8 0 16.4 8.6 31.4 27.8 31.4s27.8-15 27.8-31.4C91.8 34.6 81.2 22 64 22Z" fill="#070C11" stroke="#C7D4DF" stroke-opacity=".18" stroke-width=".8"/>
    <path d="M64 22c-17.2 0-27.8 12.6-27.8 29.8 0 5.6 1 10.9 3 15.5-1.4-19.6 6.4-34.5 24.8-34.5 11 0 18.8 6 22.8 15.6C88.4 30.6 79.4 22 64 22Z" fill="url(#phood)"/>
    <path d="M43.6 54.6c4.8-3.2 10.6-3.2 15.4 0-4.6 3-10.6 3-15.4 0Zm25.4 0c4.8-3.2 10.6-3.2 15.4 0-4.6 3-10.6 3-15.4 0Z" fill="#D2DEE8" fill-opacity=".7"/>
    <path d="M36.5 88c7.4-7 16.6-10.6 27.5-10.6S84.1 81 91.5 88c-7.2 6.2-16.4 9.4-27.5 9.4S43.7 94.2 36.5 88Z" fill="#0D1218" fill-opacity=".8"/>
    <circle cx="64" cy="64" r="62.5" fill="none" stroke="#D3DFEA" stroke-opacity=".38" stroke-width="2"/>
  </g>
</svg>'''
open(os.path.join(OUT, 'portrait.svg'), 'w').write(portrait)
print('avatars written:', sorted(os.listdir(OUT)))
