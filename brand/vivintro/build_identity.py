"""Build the reviewable VivIntro identity kit. Requires fonttools and brotli.
Usage: python build_identity.py --font-cache PATH_TO_NEXT_STATIC_MEDIA
Generated assets are kept separate from application code.
"""
from pathlib import Path
import argparse, json, shutil
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--font-cache', type=Path, required=True)
args = parser.parse_args()
assets = ROOT / 'assets'
assets.mkdir(exist_ok=True)
fonts = {}
for file in args.font_cache.glob('*.woff2'):
    font = TTFont(file)
    family = font['name'].getDebugName(1)
    if 86 in font.getBestCmap() and family in ['Manrope ExtraLight', 'Playfair Display', 'Geist', 'Tenor Sans']:
        name = {'Manrope ExtraLight': 'Manrope', 'Playfair Display': 'PlayfairDisplay', 'Geist': 'Geist', 'Tenor Sans': 'TenorSans'}[family]
        fonts[name] = font
        shutil.copyfile(file, ROOT / 'fonts' / (name + '.woff2'))
        (ROOT / 'fonts' / (name + '-metadata.txt')).write_text('\n\n'.join(font['name'].getDebugName(i) or '' for i in [0,1,8,9,13,14]), encoding='utf-8')
assert all(n in fonts for n in ['Manrope', 'PlayfairDisplay', 'Geist', 'TenorSans'])

# Opening chapter: a V-like folio with a deliberate opening at the upper right.
symbol = '<path d="M14 15V48L32 57V24L14 15ZM32 24L50 15V34M32 57L50 48V43" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
simple = '<path d="M4 4V12L8 14V6L4 4ZM8 6L12 4V8M8 14L12 12V11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
def svg(body, view='0 0 64 72', color='#174b55', title='VivIntro — Opening chapter'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" fill="none" style="color:{color}" role="img"><title>{title}</title>{body}</svg>'
def save(name, data):
    (assets / name).write_text(data, encoding='utf-8')
for name, color in [('teal','#174b55'),('ink','#162a33'),('reverse','#fffdf8'),('black','#000000')]:
    save(f'symbol-{name}.svg', svg(symbol,color=color))

# Fixed outline wordmark, drawn from the existing Manrope face, weight 600.
# Tracking is set here so exports never depend on the recipient's installed fonts.
font = instantiateVariableFont(fonts['Manrope'], {'wght':600}, inplace=False)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
scale = 64 / font['head'].unitsPerEm
x = 0
paths = []
for char in 'VivIntro':
    glyph = glyphs[cmap[ord(char)]]
    pen = SVGPathPen(glyphs)
    glyph.draw(pen)
    paths.append(f'<path d="{pen.getCommands()}" transform="translate({x:.3f} 66) scale({scale} {-scale})"/>')
    x += glyph.width * scale - 1.2
word = '<g fill="currentColor">' + ''.join(paths) + '</g>'
width = round(x+4, 2)
for name, color in [('teal','#174b55'),('ink','#162a33'),('reverse','#fffdf8'),('black','#000000')]:
    save(f'wordmark-{name}.svg',svg(word, f'0 0 {width} 84',color,'VivIntro'))
    save(f'lockup-{name}.svg',svg(f'<g transform="translate(0 6)">{symbol}</g><g transform="translate(82 0)">{word}</g>',f'0 0 {width+82} 84',color,'VivIntro'))
save('concept-02-chosen-frame.svg',svg('<path d="M23 14H14V57H50V48M32 14H50V34M24 28H40M24 37H35M24 46H40" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',title='Concept 02 — Chosen frame'))
save('concept-03-shared-line.svg',svg('<path d="M12 18L28 53Q32 62 36 53L52 18M20 36H44" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',title='Concept 03 — Shared line'))
save('app-icon.svg',svg(f'<rect width="1024" height="1024" fill="#174b55"/><g transform="translate(192 152) scale(10)">{symbol}</g>','0 0 1024 1024','#fffdf8'))
save('social-avatar.svg',svg(f'<rect width="512" height="512" fill="#f8f6f0"/><circle cx="256" cy="256" r="232" fill="#174b55"/><g transform="translate(112 94) scale(4.5)">{symbol}</g>','0 0 512 512','#fffdf8'))
save('favicon.svg',svg(f'<rect width="16" height="16" rx="3" fill="#174b55"/>{simple}','0 0 16 16','#fffdf8'))
save('chapter-pattern.svg',svg(''.join(f'<g transform="translate({i*96} {j*100})">{symbol}</g>' for j in range(3) for i in range(5)),'0 0 480 300','#477b77','VivIntro chapter pattern'))
tokens = {
  'status':'Proposed brand aliases; not a replacement for application or portfolio tokens',
  'light': {'paper':'#f8f6f0','surface':'#fffdf8','ink':'#162a33','muted':'#627178','primary':'#174b55','protected':'#477b77','gold':'#a86708','line':'#d9d7ce'},
  'dark': {'paper':'#111b22','surface':'#1b2932','ink':'#edf2ef','muted':'#b0bfca','accent':'#8fd4c8','gold':'#e2c07a','line':'#6b838f'},
  'textVariants': {'goldOnPaper':'#8f6628','goldOnTint':'#805c24','teal':'#315f5c','mutedOnTint':'#58666d'},
  'spacing':[4,8,12,16,24,32,48,64,96],
  'radius':{'control':9,'card':16},
  'fonts':{'wordmark':'Manrope 600 outlined','editorial':'Playfair Display','body':'Manrope','application':'Geist','chapter':'Tenor Sans'}
}
(ROOT/'tokens.json').write_text(json.dumps(tokens, indent=2)+'\n',encoding='utf-8')
print('Generated vector assets, outlined wordmark, font specimens and proposed tokens.')
