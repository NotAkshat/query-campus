import fitz,json,re
d=fitz.open('out/Query_Campus_Project_Report.pdf')
heads=json.load(open('headings.json'))
fm={'fm_cert':'CERTIFICATE','fm_rec':'Recommendation','fm_decl':'Candidate Declaration','fm_plag':'SELF-DECLARATION OF PLAGIARISM','fm_ack':'ACKNOWLEDGEMENTS','fm_abs':'ABSTRACT','refs':'REFERENCES','appx':'APPENDIX'}
# locate the TOC page
toc=[i for i,p in enumerate(d) if 'TABLE OF CONTENTS' in p.get_text()][0]
lines=[[l.strip() for l in p.get_text().split('\n')] for p in d]
roman=['i','ii','iii','iv','v','vi','vii','viii','ix','x']
out={}
for k,lab in fm.items():
    for i in range(1,len(d)):
        if i==toc: continue
        if lab in lines[i][:4] or lab in lines[i]:
            if k in ('refs','appx') and i<=toc: continue
            out[k]= roman[i-1] if i<=toc else str(i-toc)
            break
for h in heads:
    for i in range(toc+1,len(d)):
        if h['label'] in lines[i]:
            out[h['id']]=str(i-toc); break
json.dump(out,open('pagenums_found.json','w'),indent=1)
print(out)
