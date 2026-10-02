from pathlib import Path
import json,html
out=Path(__file__).parent
sections=json.loads((out/'sections.json').read_text(encoding='utf-8'))
manifest_list=json.loads((out/'manifest.json').read_text(encoding='utf-8'))
manifest={x['file']:x for x in manifest_list}
repo='https://github.com/synchro4351/udonarium_axe'
dev='DEVELOPER_REFERENCE.md'
dev_url=repo+'/blob/main/docs/showcase/'+dev
esc=html.escape
intro='Udonarium Axe tyoitashiは、オンライン卓ツールUdonarium Axeの基本操作に、カード・チャット・画像・演出の使いやすさを足した、非公式の派生版です。'
notice='デモで試せるのは固定版r5（Axe v1.57.1）です。「開発版」と書いた機能は、まだデモに入っていません。画面写真には、公開用の架空のサンプルを使っています。'
labels={'r5で利用可':'デモ（r5）で試せます','開発版':'開発版（デモにはまだありません）'}
used=[f for s in sections for f,_ in s['images']]
if sorted(used)!=sorted(manifest) or len(set(used))!=len(used):raise ValueError('sections and manifest differ')
md=['# 卓の操作を、ちょい足し。','',intro,'',f'[非公式デモ](https://udonarium-trial.synwork.work/) · [公式の使い方](https://xelltis.github.io/udonarium_axe/)','',notice,'']
cards=[]
ref=['# 機能紹介の開発者向け資料','','機能紹介（[README.md](README.md)）の各機能と画面写真について、ブランチと撮影元のコミットを記録します。`manifest.json` と `sections.json` から `build-gallery.py` が生成するため、直接は編集しません。','',f'- 変更一覧: [TYOITASHI_CHANGES.md]({repo}/blob/main/TYOITASHI_CHANGES.md)','']
for section in sections:
 branch=repo+'/tree/'+section['branch']
 label=labels[section['version']]
 md += ['## '+section['title'],'','**'+label+'**','',section['text'].replace('|漢字<かんじ>','`|漢字<かんじ>`').replace('|漢字《かんじ》','`|漢字《かんじ》`').replace('2*3','`2*3`'),'']
 ref += ['## '+section['title'],'','- 提供状況: '+section['version'],'- 機能のブランチ: ['+section['branch']+']('+branch+')','']
 figures=[]
 for file,caption in section['images']:
  source=manifest[file]['source'];link=repo+'/tree/'+source
  md += ['!['+caption+']('+file+')','',caption,'']
  ref.append('- `'+file+'`: 撮影ソース ['+source+']('+link+')、素材: '+manifest[file]['sample'])
  figures.append(f'<figure><a href="{esc(file)}" aria-label="{esc(caption)}（画像を大きく表示）"><img src="{esc(file)}" alt="{esc(caption)}" loading="lazy"></a><figcaption>{esc(caption)}</figcaption></figure>')
 ref.append('')
 cards.append(f'<section id="{section["id"]}" class="feature"><div class="section-heading"><span class="badge {"dev" if section["version"]=="開発版" else ""}">{esc(label)}</span><h2>{esc(section["title"])}</h2></div><p>{esc(section["text"])}</p><div class="shots">'+''.join(figures)+'</div></section>')
rights='画面写真は動きを止めたものです。ソースと同梱素材の条件は、リポジトリの'
materials='画面は本派生版と公式Axeの公開サンプル、独自の検証素材で撮影しています。実際の卓や参加者の私的な情報、持ち込みの第三者スタンプ素材は入っていません。ソースと同梱素材の条件は、リポジトリのLICENSEを見てください。絵文字の形は、端末のフォントで変わります。動作・保存・同期の確認結果は、各機能のブランチで確認できます。'
md += ['## 素材と利用条件','',rights+'[LICENSE]('+repo+'/blob/main/LICENSE)を見てください。くわしい確認結果は[開発者向け資料]('+dev+')にあります。','']
ref += ['## 素材と確認','',materials,'']
(out/'README.md').write_text('\n'.join(md),encoding='utf-8',newline='\n')
(out/dev).write_text('\n'.join(ref),encoding='utf-8',newline='\n')
style='''*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:20px}body{margin:0;background:#f5f6f8;color:#172334;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.75}a{color:#215a99;text-underline-offset:3px}a:hover{color:#163c66}a:focus-visible{outline:3px solid #237ac0;outline-offset:4px}header{background:linear-gradient(130deg,#162537,#234864);color:white;padding:64px max(24px,calc((100vw - 1060px)/2)) 38px}header .label{margin:0;color:#bbd5e8;font-size:.85rem;letter-spacing:.1em}h1{font-size:clamp(1.9rem,4vw,3.25rem);line-height:1.25;margin:16px 0 24px;font-weight:800}header p{max-width:720px}header a{color:#d7edff}header .links{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0 0}header .links a{border:1px solid #7395af;border-radius:8px;padding:8px 14px;text-decoration:none}.container{max-width:1100px;margin:auto;padding:28px 20px 60px}.notice{border-left:4px solid #ba884b;background:#fff8ed;padding:16px 20px;margin:0 0 28px;border-radius:0 8px 8px 0}.nav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 28px}.nav a{padding:5px 10px;background:white;border:1px solid #d3dce6;border-radius:30px;font-size:.85rem;text-decoration:none}.feature{padding:28px;margin:0 0 30px;background:white;border:1px solid #dce3eb;border-radius:16px;box-shadow:0 5px 20px #17233406}.section-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap}h2{font-size:clamp(1.35rem,3vw,1.75rem);line-height:1.4;margin:0}.badge{display:inline-flex;background:#e6f2eb;color:#246545;padding:3px 9px;border-radius:5px;font-size:.75rem;font-weight:700}.badge.dev{color:#735311;background:#fff0c8}.feature>p{max-width:820px;margin:16px 0 24px}.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px;align-items:start}figure{margin:0;background:#f2f5f9;border:1px solid #dae1ea;border-radius:8px;overflow:hidden}figure>a{display:flex;min-height:180px;align-items:center;justify-content:center;padding:8px;background:#17212d}img{display:block;max-width:100%;width:auto;height:auto;max-height:540px;object-fit:contain}figcaption{font-size:.8rem;color:#46596b;padding:12px 14px}footer{padding:24px;background:#e9eef4;border-radius:12px;font-size:.85rem;color:#45576c}footer p{margin:0 0 12px}footer p:last-child{margin:0}@media(max-width:600px){header{padding:40px 20px 26px}.container{padding:22px 12px 40px}.feature{padding:20px 16px;border-radius:10px}.shots{gap:14px}figure>a{min-height:0}.section-heading{gap:8px}.notice{padding:14px 16px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}'''
nav=''.join(f'<a href="#{s["id"]}">{esc(s["title"])}</a>' for s in sections)
doc=f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="{esc(intro)}"><title>Udonarium Axe tyoitashi — 機能紹介</title><style>{style}</style></head><body><header><p class="label">UDONARIUM AXE TYOITASHI / 非公式の派生版</p><h1>卓の操作を、ちょい足し。</h1><p>{esc(intro)}</p><div class="links"><a href="https://udonarium-trial.synwork.work/">デモ（固定版r5）を試す ↗</a><a href="https://xelltis.github.io/udonarium_axe/">公式の使い方 ↗</a></div></header><main class="container"><aside class="notice">{esc(notice)}</aside><nav class="nav" aria-label="紹介する機能">{nav}</nav>{''.join(cards)}<footer><p>{esc(rights)}<a href="{repo}/blob/main/LICENSE">LICENSE</a>を見てください。<a href="{repo}">ソースコードと変更一覧</a>・<a href="{dev_url}">開発者向け資料</a></p></footer></main></body></html>'''
(out/'index.html').write_text(doc,encoding='utf-8',newline='\n')
print(f'Generated gallery with {len(sections)} sections and {len(used)} screenshots')
