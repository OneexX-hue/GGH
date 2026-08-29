"""Иконки: отдельные SVG-файлы + инлайновый спрайт для index.html."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'icons')
os.makedirs(OUT, exist_ok=True)

# name: (viewBox, inner markup). Stroked paths inherit from the <g> wrapper.
S = {
 'lock': "<rect x='5' y='10.5' width='14' height='10.5' rx='3'/><path d='M8.2 10.5V7.6a3.8 3.8 0 0 1 7.6 0v2.9'/>",
 'lock-solid': "<rect x='5.5' y='10.5' width='13' height='10' rx='3' fill='currentColor' stroke='none'/><path d='M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7'/><circle cx='12' cy='15.4' r='1.35' fill='#0B0F13' stroke='none'/>",
 'shield-lock': "<path d='M12 2.6 4.4 5.8v5.6c0 5.2 3 8.9 7.6 11 4.6-2.1 7.6-5.8 7.6-11V5.8Z'/><rect x='9.1' y='11.2' width='5.8' height='5' rx='1.4'/><path d='M10.4 11.2V9.9a1.6 1.6 0 0 1 3.2 0v1.3'/>",
 'settings': "<circle cx='12' cy='12' r='3.1'/><path d='M19.5 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z'/>",
 'search': "<circle cx='11' cy='11' r='6.4'/><path d='m15.7 15.7 4.1 4.1'/>",
 'sliders': "<path d='M4 8h11M4 16h7'/><path d='M17.5 5.8v4.4M12.5 13.8v4.4'/>",
 'star': "<path d='m12 3.9 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z'/>",
 'bell-off': "<path d='M18 8.6a6 6 0 0 0-8.4-5.5M6.2 6.8A6 6 0 0 0 6 8.6c0 5-2.2 6.4-2.2 6.4h12.4M9.6 19a2.6 2.6 0 0 0 4.8 0'/><path d='m3 3 18 18'/>",
 'bell': "<path d='M18 8.6a6 6 0 1 0-12 0c0 5-2.2 6.4-2.2 6.4h16.4S18 13.6 18 8.6Z'/><path d='M9.6 19a2.6 2.6 0 0 0 4.8 0'/>",
 'plus': "<path d='M12 5.4v13.2M5.4 12h13.2'/>",
 'chat': "<path d='M4 11.5c0-4 3.6-7 8-7s8 3 8 7-3.6 7-8 7c-1 0-2-.2-2.9-.4L5 20l1.2-3.3A6.7 6.7 0 0 1 4 11.5Z' fill='currentColor' stroke='none'/>",
 'chat-outline': "<path d='M4 11.5c0-4 3.6-7 8-7s8 3 8 7-3.6 7-8 7c-1 0-2-.2-2.9-.4L5 20l1.2-3.3A6.7 6.7 0 0 1 4 11.5Z'/>",
 'phone': "<path d='M8.1 4.3c.5-.4 1.3-.3 1.6.3l1.5 2.6c.3.5.2 1.1-.3 1.5l-1.2.9c-.3.2-.4.6-.2 1a10 10 0 0 0 4 4c.3.2.7 0 .9-.2l.9-1.2c.4-.5 1-.6 1.5-.3l2.6 1.5c.6.3.7 1.1.3 1.6l-1.4 1.6a3 3 0 0 1-3.2.8C11 18.6 6.6 14.5 5 9.7a3 3 0 0 1 .8-3Z'/>",
 'video': "<rect x='3' y='6.6' width='12.2' height='10.8' rx='2.6'/><path d='m15.2 12.4 4.6-2.9c.5-.3 1.2 0 1.2.7v5.6c0 .7-.7 1-1.2.7l-4.6-2.9Z'/>",
 'more': "<circle cx='12' cy='5.2' r='1.5' fill='currentColor' stroke='none'/><circle cx='12' cy='12' r='1.5' fill='currentColor' stroke='none'/><circle cx='12' cy='18.8' r='1.5' fill='currentColor' stroke='none'/>",
 'paperclip': "<path d='M19 11.3 12.1 18a4.4 4.4 0 0 1-6.2-6.2l7.5-7.5a2.9 2.9 0 0 1 4.1 4.1l-7.4 7.5a1.5 1.5 0 0 1-2-2.1l6.7-6.7'/>",
 'timer': "<circle cx='12' cy='13.4' r='7.2'/><path d='M12 10.2v3.2l2.2 1.6'/><path d='M9.6 2.8h4.8'/><path d='m18.4 7 1.4-1.4'/>",
 'mic': "<rect x='9.2' y='2.8' width='5.6' height='11' rx='2.8'/><path d='M5.6 11.8a6.4 6.4 0 0 0 12.8 0'/><path d='M12 18.2v3'/>",
 'x': "<path d='m6 6 12 12M18 6 6 18'/>",
 'minimize': "<path d='M5.5 12h13'/>",
 'maximize': "<rect x='5.5' y='5.5' width='13' height='13' rx='1.6'/>",
 'chevron-down': "<path d='m6.5 9.5 5.5 5.5 5.5-5.5'/>",
 'chevron-right': "<path d='m9.5 5.5 6.5 6.5-6.5 6.5'/>",
 'check-double': "<path d='m2.4 12.6 4.2 4.2 8.2-9'/><path d='m9.6 15.4 1.4 1.4 8.2-9'/>",
 'file': "<path d='M13.6 3H7.4A2.4 2.4 0 0 0 5 5.4v13.2A2.4 2.4 0 0 0 7.4 21h9.2a2.4 2.4 0 0 0 2.4-2.4V8.4Z'/><path d='M13.6 3v5.4H19'/>",
 'file-lines': "<path d='M13.6 3H7.4A2.4 2.4 0 0 0 5 5.4v13.2A2.4 2.4 0 0 0 7.4 21h9.2a2.4 2.4 0 0 0 2.4-2.4V8.4Z'/><path d='M13.6 3v5.4H19'/><path d='M8.4 12.6h7.2M8.4 16.2h5'/>",
 'folder': "<rect x='3.2' y='5.6' width='17.6' height='13' rx='2.6'/><path d='M3.2 9.2h17.6'/><circle cx='12' cy='14' r='1.3' fill='currentColor' stroke='none'/>",
 'pin': "<path d='M14.8 3.2 20.8 9.2M16.4 4.8l-5.6 3-4.4 4.4 5.4 5.4 4.4-4.4 3-5.6'/><path d='m8.6 15.4-4.4 4.4'/>",
 'trash': "<path d='M4.6 6.6h14.8'/><path d='M8.6 6.6V5a1.8 1.8 0 0 1 1.8-1.8h3.2A1.8 1.8 0 0 1 15.4 5v1.6'/><path d='M6.6 6.6 7.4 19a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.8-12.4'/><path d='M10.4 10.4v6.2M13.6 10.4v6.2'/>",
 'user': "<circle cx='12' cy='8.2' r='3.9'/><path d='M4.6 20.6c.7-4.3 3.8-6.6 7.4-6.6s6.7 2.3 7.4 6.6'/>",
 'mask': "<path d='M2.8 9.4c0-1.6 1.2-2.6 2.8-2.6h12.8c1.6 0 2.8 1 2.8 2.6 0 3.6-2 7-5 7-1.8 0-3-1-4.2-2.4-1.2 1.4-2.4 2.4-4.2 2.4-3 0-5-3.4-5-7Z' fill='currentColor' stroke='none'/>",
 'devices': "<rect x='3' y='2.8' width='11' height='18.4' rx='2.6'/><rect x='14.6' y='11' width='6.6' height='10.2' rx='1.8' fill='#05080B'/><path d='M9.4 5.4h1.4'/>",
 'signal': "<rect x='2' y='13.6' width='3' height='6' rx='1' fill='currentColor' stroke='none'/><rect x='7' y='10.4' width='3' height='9.2' rx='1' fill='currentColor' stroke='none'/><rect x='12' y='7.2' width='3' height='12.4' rx='1' fill='currentColor' stroke='none'/><rect x='17' y='4' width='3' height='15.6' rx='1' fill='currentColor' stroke='none'/>",
 'wifi': "<path d='M2.4 8.6a14 14 0 0 1 19.2 0M5.8 12.4a9.2 9.2 0 0 1 12.4 0M9.2 16.1a4.4 4.4 0 0 1 5.6 0'/><circle cx='12' cy='19.4' r='1.3' fill='currentColor' stroke='none'/>",
 'battery': "<rect x='2' y='7.4' width='18.4' height='9.2' rx='2.6'/><rect x='3.7' y='9.1' width='15' height='5.8' rx='1.5' fill='currentColor' stroke='none'/><path d='M22 10.6v2.8'/>",
 'stopwatch': "<circle cx='12' cy='13.6' r='7.6'/><path d='M12 9.6v4h3'/><path d='M9.4 2.6h5.2'/><path d='M12 2.6v3.4'/>",
 'clock': "<circle cx='12' cy='12' r='8.2'/><path d='M12 7.4V12l3 1.8'/>",
}

ATTRS = ("fill='none' stroke='currentColor' stroke-width='1.6' "
         "stroke-linecap='round' stroke-linejoin='round'")

for name, body in S.items():
    svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24' "
           f"{ATTRS}>{body}</svg>\n")
    open(os.path.join(OUT, f'{name}.svg'), 'w').write(svg)

sprite = ["<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"icon-sprite\" aria-hidden=\"true\">"]
for name, body in S.items():
    sprite.append(f'  <symbol id="i-{name}" viewBox="0 0 24 24">{body}</symbol>')
sprite.append("</svg>")
open(os.path.join(OUT, '_sprite.html'), 'w').write("\n".join(sprite) + "\n")

print(f'{len(S)} иконок → {OUT}')
print(f'спрайт для index.html → {OUT}/_sprite.html')
