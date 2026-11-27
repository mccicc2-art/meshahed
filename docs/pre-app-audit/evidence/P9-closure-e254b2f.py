import re,os
root='src/lib'
cls={}
for line in open('/home/claude/audit/docs/pre-app-audit/evidence/P9-lib-classification-e254b2f.txt'):
    m=re.match(r'^(\S+)\s+(\d+)\s+(\S+)',line)
    if m: cls[m.group(1)]=m.group(3)
# manual overrides
cls['i18n.ts']='SHARE'; cls['profilePrefs.ts']='SHARE'; cls['og.tsx']='SERVER'
cls['shareCard.tsx']='REWRITE(dom)'; cls['trailerCard.ts']='REWRITE(dom)'; cls['prefetchIntent.ts']='DROP'
share={f for f,c in cls.items() if c=='SHARE'}
def resolve(spec):
    if spec.startswith('@/lib/'): name=spec[6:]
    elif spec.startswith('./'): name=spec[2:]
    elif spec.startswith('@/'): return ('EXT_APP',spec)
    elif spec.startswith('.'): return ('REL',spec)
    else: return ('PKG',spec)
    for ext in ('.ts','.tsx','/index.ts'):
        if os.path.exists(os.path.join(root,name+ext)): return ('LIB',name+ext)
    return ('LIB?',name)
leaks={}
for f in sorted(share):
    s=open(os.path.join(root,f),encoding='utf-8').read()
    for m in re.finditer(r'^import\s+(type\s+)?[^;]*?from\s+"([^"]+)"',s,re.M):
        isType=bool(m.group(1)); kind,target=resolve(m.group(2))
        bad=None
        if kind=='PKG' and target not in ('react',): bad=f'pkg:{target}'
        elif kind=='EXT_APP': bad=f'app:{target}'
        elif kind=='LIB' and target.replace('/index.ts','') not in share and cls.get(target,'?')!='SHARE': bad=f'lib:{target}[{cls.get(target,"?")}]'
        elif kind=='LIB?': bad=f'unresolved:{target}'
        if bad: leaks.setdefault(f,[]).append(('type' if isType else 'value',bad))
for f,l in leaks.items(): print(f, l)
print('leaking files:',len(leaks),'of',len(share))

# corrected sets
value_leak={f for f,l in leaks.items() if any(k=='value' for k,_ in l)}
core=sorted(share-value_leak)
lines={}
for line in open('/home/claude/audit/docs/pre-app-audit/evidence/P9-lib-classification-e254b2f.txt'):
    m=re.match(r'^(\S+)\s+(\d+)\s+',line)
    if m: lines[m.group(1)]=int(m.group(2))
print('CORE',len(core),sum(lines[f] for f in core))
print('VALUE_LEAK',sorted(value_leak),sum(lines[f] for f in value_leak))
non_share=sorted(f for f in cls if f not in core)
open('/home/claude/scripts/core_files.txt','w').write('\n'.join(core)+'\n')
open('/home/claude/scripts/noncore_files.txt','w').write('\n'.join(non_share)+'\n')
