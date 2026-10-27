import fitz,json
d=fitz.open('out/Query_Campus_Project_Report.pdf')
data=json.load(open('headings.json'))
fm={'fm_cert':'CERTIFICATE','fm_rec':'Recommendation','fm_decl':'Candidate Declaration','fm_plag':'SELF-DECLARATION OF PLAGIARISM','fm_ack':'ACKNOWLEDGEMENTS','fm_abs':'ABSTRACT','refs':'REFERENCES','appx':'APPENDIX'}
lines=[[l.strip() for l in p.get_text().split('\n')] for p in d]
toc=[i for i,p in enumerate(d) if 'TABLE OF CONTENTS' in p.get_text()][0]
body=[i for i in range(len(d)) if 'Chapter-1 Introduction' in lines[i]][0]   # first body page
roman=['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii']
out={}
for k,lab in fm.items():
    if k in ('refs','appx'):
        for i in range(body,len(d)):
            if lab in lines[i]: out[k]=str(i-body+1); break
    else:
        for i in range(1,toc):
            if lab in lines[i][:4] or lab in lines[i]: out[k]=roman[i-1]; break
for h in data['bookmarks']:
    for i in range(body,len(d)):
        if h['label'] in lines[i]: out[h['id']]=str(i-body+1); break
for c in data['captions']:
    prefix=c['label'].split(':')[0]+':'
    for i in range(body,len(d)):
        if any(l.startswith(prefix) for l in lines[i]): out[c['id']]=str(i-body+1); break
json.dump(out,open('pagenums_found.json','w'),indent=1)
missing=[c['id'] for c in data['captions'] if c['id'] not in out]
print('captions',len(data['captions']),'missing',missing,'body starts at pdf page',body+1,'toc page',toc+1)
