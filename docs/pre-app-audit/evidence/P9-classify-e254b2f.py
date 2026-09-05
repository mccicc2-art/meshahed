import re,os,json,sys
root='src/lib'
rows=[]
for f in sorted(os.listdir(root)):
    p=os.path.join(root,f)
    if not os.path.isfile(p): continue
    s=open(p,encoding='utf-8').read()
    lines=s.count('\n')
    m=lambda pat: bool(re.search(pat,s))
    flags=[]
    if m(r'"use client"|\'use client\''): flags.append('client')
    if m(r'"use server"|\'use server\''): flags.append('server-action')
    if m(r'from "server-only"|from "next/headers"|next/cache|unstable_cache|revalidatePath|revalidateTag'): flags.append('next-server')
    if m(r'supabase/server'): flags.append('sb-server')
    if m(r'supabase/client'): flags.append('sb-client')
    if m(r'process\.env\.(?!NEXT_PUBLIC)[A-Z_]+'): flags.append('secret-env')
    if m(r'\bwindow\.|\bdocument\.|localStorage|sessionStorage|\bnavigator\.|matchMedia|IntersectionObserver|HTMLElement|MouseEvent|KeyboardEvent'): flags.append('dom')
    if m(r'from "react"|from "react/'): flags.append('react')
    if m(r'from "next/'): flags.append('next-import')
    if m(r'\bfetch\('): flags.append('fetch')
    if f.endswith('.tsx'): flags.append('tsx')
    if not flags: cat='SHARE'
    elif set(flags)<= {'react','fetch'}: cat='SHARE'
    elif 'dom' in flags and not ({'next-server','sb-server','secret-env','server-action'} & set(flags)): cat='REWRITE(dom)'
    elif {'next-server','sb-server','secret-env','server-action'} & set(flags): cat='SERVER'
    else: cat='REVIEW'
    rows.append((f,lines,cat,','.join(flags)))
from collections import Counter
c=Counter(r[2] for r in rows); tl=Counter()
for r in rows: tl[r[2]]+=r[1]
print(dict(c)); print(dict(tl))
for r in rows: print(f"{r[0]:22} {r[1]:5} {r[2]:14} {r[3]}")
