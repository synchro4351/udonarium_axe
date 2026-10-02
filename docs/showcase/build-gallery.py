from pathlib import Path
import json,html
out=Path(__file__).parent
sections=json.loads((out/'sections.json').read_text(encoding='utf-8'))
manifest={x['file']:x for x in json.loads((out/'manifest.json').read_text(encoding='utf-8'))}
repo='https://github.com/synchro4351/udonarium_axe'
esc=html.escape
intro='Udonarium Axe tyoitashiは、Axeの基本操作に、カード・チャット・画像・演出の使いやすさを足した非公式フォークです。'
notice='試用サイトは固定版r5（Axe v1.57.1）。「開発版」の機能はまだ試用サイトに入っていません。写真は公開用の架空サンプルを使い、機能ごとに撮影したソースを記録しています。'
md=['# 卓の操作を、ちょい足し。','',intro,'',f'[非公式デモ](https://udonarium-trial.synwork.work/) · [ソースと変更一覧]({repo}) · [公式の使い方](https://xelltis.github.io/udonarium_axe/)','',notice,'']
cards=[]
for section in sections:
 branch=repo+'/tree/'+section['branch']
 md += ['## '+section['title'],'','**'+section['version']+'** — '+section['text'],'']
 figures=[]
 for file,caption in section['images']:
  if file not in manifest:raise ValueError(file)
  source=manifest[file]['source'];link=repo+'/tree/'+source
  md += ['!['+caption+']('+file+')','',caption+' [撮影ソース '+source[:8]+']('+link+')','']
  figures.append(f'<figure><a href="{esc(file)}" aria-label="{esc(caption)}の画像を大きく表示"><img src="{esc(file)}" alt="{esc(caption)}" loading="lazy"></a><figcaption>{esc(caption)} <a href="{esc(link)}">撮影版 {source[:8]}</a></figcaption></figure>')
 md += ['[機能のソース]('+branch+')','']
 cards.append(f'<section id="{section["id"]}" class="feature"><div class="section-heading"><span class="badge {"dev" if section["version"]=="開発版" else ""}">{esc(section["version"])}</span><h2>{esc(section["title"])}</h2></div><p>{esc(section["text"])}</p><div class="shots">'+''.join(figures)+f'</div><p class="source"><a href="{esc(branch)}">機能のソースを見る ↗</a></p></section>')
rights='画面は本フォークと公式Axeの公開サンプル、独自の検証素材で撮影しています。実卓・参加者の私的情報や、持ち込みの第三者スタンプ素材は含めていません。ソースと同梱素材の条件はリポジトリのLICENSEを参照してください。絵文字の形は端末のフォントで変わります。'
md += ['## 素材と利用条件','',rights+' [LICENSE]('+repo+'/blob/main/LICENSE)。','', 'スクリーンショットは動きを静止した紹介です。操作・保存・同期の検証結果は[変更一覧]('+repo+'/blob/main/TYOITASHI_CHANGES.md)と各機能文書を参照してください。','']
(out/'README.md').write_text('\n'.join(md),encoding='utf-8',newline='\n')
style='''*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:20px}body{margin:0;background:#f5f6f8;color:#172334;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.75}a{color:#215a99;text-underline-offset:3px}a:hover{color:#163c66}a:focus-visible{outline:3px solid #237ac0;outline-offset:4px}header{background:linear-gradient(130deg,#162537,#234864);color:white;padding:64px max(24px,calc((100vw - 1060px)/2)) 38px}header .label{margin:0;color:#bbd5e8;font-size:.85rem;letter-spacing:.1em}h1{font-size:clamp(1.9rem,4vw,3.25rem);line-height:1.25;margin:16px 0 24px;font-weight:800}header p{max-width:720px}header a{color:#d7edff}header .links{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0 0}header .links a{border:1px solid #7395af;border-radius:8px;padding:8px 14px;text-decoration:none}.container{max-width:1100px;margin:auto;padding:28px 20px 60px}.notice{border-left:4px solid #ba884b;background:#fff8ed;padding:16px 20px;margin:0 0 28px;border-radius:0 8px 8px 0}.nav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 28px}.nav a{padding:5px 10px;background:white;border:1px solid #d3dce6;border-radius:30px;font-size:.85rem;text-decoration:none}.feature{padding:28px;margin:0 0 30px;background:white;border:1px solid #dce3eb;border-radius:16px;box-shadow:0 5px 20px #17233406}.section-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap}h2{font-size:clamp(1.35rem,3vw,1.75rem);line-height:1.4;margin:0}.badge{display:inline-flex;background:#e6f2eb;color:#246545;padding:3px 9px;border-radius:5px;font-size:.75rem;font-weight:700}.badge.dev{color:#735311;background:#fff0c8}.feature>p{max-width:820px;margin:16px 0 24px}.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px;align-items:start}figure{margin:0;background:#f2f5f9;border:1px solid #dae1ea;border-radius:8px;overflow:hidden}figure>a{display:flex;min-height:180px;align-items:center;justify-content:center;padding:8px;background:#17212d}img{display:block;max-width:100%;width:auto;height:auto;max-height:540px;object-fit:contain}figcaption{font-size:.8rem;color:#46596b;padding:12px 14px}figcaption a{display:block;margin-top:6px;font-size:.75rem}.feature .source{font-size:.85rem;margin:18px 0 0}footer{padding:24px;background:#e9eef4;border-radius:12px;font-size:.85rem;color:#45576c}footer p{margin:0 0 12px}footer p:last-child{margin:0}@media(max-width:600px){header{padding:40px 20px 26px}.container{padding:22px 12px 40px}.feature{padding:20px 16px;border-radius:10px}.shots{gap:14px}figure>a{min-height:0}.section-heading{gap:8px}.notice{padding:14px 16px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}'''
nav=''.join(f'<a href="#{s["id"]}">{esc(s["title"])}</a>' for s in sections)
doc=f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="{esc(intro)}"><title>Udonarium Axe tyoitashi — 機能紹介</title><style>{style}</style></head><body><header><p class="label">UDONARIUM AXE TYOITASHI / 非公式フォーク</p><h1>卓の操作を、ちょい足し。</h1><p>{esc(intro)}</p><div class="links"><a href="https://udonarium-trial.synwork.work/">固定版r5を試す ↗</a><a href="{repo}">ソースと変更一覧 ↗</a><a href="https://xelltis.github.io/udonarium_axe/">公式の使い方 ↗</a></div></header><main class="container"><aside class="notice">{esc(notice)}</aside><nav class="nav" aria-label="紹介する機能">{nav}</nav>{''.join(cards)}<footer><p>{esc(rights)} <a href="{repo}/blob/main/LICENSE">LICENSE</a></p><p>スクリーンショットは動きを静止した紹介です。操作・保存・同期の検証結果は<a href="{repo}/blob/main/TYOITASHI_CHANGES.md">変更一覧</a>と各機能文書を参照してください。</p></footer></main></body></html>'''
(out/'index.html').write_text(doc,encoding='utf-8',newline='\n')
print(f'Generated gallery with {len(sections)} sections')
