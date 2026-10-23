#!/bin/bash
cd /Users/duochat/Desktop/query-campus/report-build
rm -rf out && mkdir -p out/p
/Applications/LibreOffice.app/Contents/MacOS/soffice --headless --convert-to pdf --outdir out Query_Campus_Project_Report.docx >/dev/null 2>&1
python3 - <<'P'
import fitz,glob
from PIL import Image
d=fitz.open('out/Query_Campus_Project_Report.pdf'); print('pages',len(d))
for i,p in enumerate(d): p.get_pixmap(dpi=45).save(f'out/p/{i+1:02d}.png')
fs=sorted(glob.glob('out/p/*.png'))
for n in range(0,len(fs),12):
    ims=[Image.open(f) for f in fs[n:n+12]]; w=max(i.width for i in ims); h=max(i.height for i in ims)
    S=Image.new('RGB',(4*w,3*h),'white')
    for k,im in enumerate(ims): S.paste(im,((k%4)*w,(k//4)*h))
    S.save(f'out/sheet{n//12}.png')
P
