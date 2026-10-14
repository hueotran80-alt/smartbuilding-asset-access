import os, re, zipfile, html
from xml.sax.saxutils import escape

ROOT="/Users/trantuan/vercel-recovery/recovered-project"
MD=os.path.join(ROOT,"report_Nhung_IoT_2026.md")
OUT=os.path.join(ROOT,"Bao_cao_BTL_Nhung_IoT_HUNRE_2026.docx")
DIAG=os.path.join(ROOT,"drawio")
os.makedirs(DIAG, exist_ok=True)

def svg_diagram(path, title, nodes, edges, width=1200, height=650):
    # nodes: (id,x,y,w,h,text)
    # edges: (a,b)
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
           '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L10,3 L0,6 Z" fill="#333"/></marker></defs>',
           f'<rect x="0" y="0" width="{width}" height="{height}" fill="white"/><text x="{width/2}" y="35" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold">{escape(title)}</text>']
    nd={n[0]:n for n in nodes}
    for a,b in edges:
        x1,y1,w1,h1=nd[a][1:5]; x2,y2,w2,h2=nd[b][1:5]
        sx=x1+w1; sy=y1+h1/2; tx=x2; ty=y2+h2/2
        if x2 < x1: sx=x1; tx=x2+w2
        parts.append(f'<line x1="{sx}" y1="{sy}" x2="{tx}" y2="{ty}" stroke="#333" stroke-width="2" marker-end="url(#arrow)"/>')
    for _,x,y,w,h,text in nodes:
        parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#f5f7fa" stroke="#222" stroke-width="2"/>')
        lines=text.split("\n")
        start=y+h/2-(len(lines)-1)*9
        for i,line in enumerate(lines):
            parts.append(f'<text x="{x+w/2}" y="{start+i*20}" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="17">{escape(line)}</text>')
    parts.append('</svg>')
    open(path,'w',encoding='utf-8').write(''.join(parts))

def drawio_xml(title, nodes, edges):
    cells=['<mxCell id="0"/>','<mxCell id="1" parent="0"/>']
    for i,(nid,x,y,w,h,text) in enumerate(nodes, start=2):
        cells.append(f'<mxCell id="{nid}" value="{html.escape(text).replace(chr(10), "&lt;br&gt;")}" style="rounded=1;whiteSpace=wrap;html=1;strokeWidth=2;" vertex="1" parent="1"><mxGeometry x="{x}" y="{y+55}" width="{w}" height="{h}" as="geometry"/></mxCell>')
    eid=100
    for a,b in edges:
        cells.append(f'<mxCell id="{eid}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;" edge="1" parent="1" source="{a}" target="{b}"><mxGeometry relative="1" as="geometry"/></mxCell>')
        eid+=1
    return f'''<mxfile host="app.diagrams.net" modified="2026-10-03T00:00:00.000Z" agent="ChatGPT" version="28.0.0" type="device"><diagram id="{re.sub(r"\\W","",title)[:20]}" name="{html.escape(title)}"><mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0"><root>{''.join(cells)}</root></mxGraphModel></diagram></mxfile>'''

diagrams = {
"01_kien_truc_he_thong": ("Kiến trúc tổng thể hệ thống",[
("n1",40,110,190,80,"Web / Android"),("n2",300,110,210,80,"Supabase\nAuth + DB + Realtime"),("n3",590,110,210,80,"MQTT Broker"),("n4",880,110,210,80,"ESP8266"),("n5",880,300,210,80,"Relay + Khóa"),("n6",300,300,210,80,"Camera Signaling\nSupabase Broadcast"),("n7",590,300,210,80,"WebRTC\nSTUN / TURN")],
[("n1","n2"),("n2","n3"),("n3","n4"),("n4","n5"),("n1","n6"),("n6","n7")]),
"02_luong_mo_cua": ("Luồng xác thực và mở cửa",[
("n1",50,100,180,70,"Người dùng"),("n2",300,100,210,70,"Xác thực\nPIN / Passkey"),("n3",580,100,210,70,"Kiểm tra quyền"),("n4",860,100,210,70,"Tạo lệnh OPEN"),("n5",860,280,210,70,"MQTT"),("n6",580,280,210,70,"ESP8266"),("n7",300,280,210,70,"Relay"),("n8",50,280,180,70,"Khóa mở")],
[("n1","n2"),("n2","n3"),("n3","n4"),("n4","n5"),("n5","n6"),("n6","n7"),("n7","n8")]),
"03_luong_esp8266": ("Luồng hoạt động firmware ESP8266",[
("n1",60,100,180,70,"Khởi động"),("n2",310,100,190,70,"Đọc EEPROM"),("n3",570,100,190,70,"Kết nối Wi-Fi"),("n4",830,100,190,70,"Kết nối MQTT"),("n5",830,280,190,70,"Chờ lệnh / Keypad"),("n6",570,280,190,70,"OPEN / LOCK"),("n7",310,280,190,70,"Relay"),("n8",60,280,180,70,"Tự khóa")],
[("n1","n2"),("n2","n3"),("n3","n4"),("n4","n5"),("n5","n6"),("n6","n7"),("n7","n8")]),
"04_webauthn": ("Luồng xác thực WebAuthn / Passkey",[
("n1",50,100,180,70,"Web / Android"),("n2",300,100,210,70,"Challenge"),("n3",590,100,210,70,"Authenticator\nđiện thoại"),("n4",880,100,210,70,"Assertion"),("n5",590,280,210,70,"Server xác minh\npublic key"),("n6",300,280,210,70,"Cho phép truy cập")],
[("n1","n2"),("n2","n3"),("n3","n4"),("n4","n5"),("n5","n6")]),
"05_webrtc": ("Luồng WebRTC, Signaling và ICE",[
("n1",50,100,180,70,"Camera"),("n2",300,100,220,70,"Supabase Broadcast\nOffer / Answer / ICE"),("n3",590,100,180,70,"Viewer"),("n4",300,290,220,70,"STUN / TURN"),("n5",590,290,180,70,"RTCPeerConnection")],
[("n1","n2"),("n2","n3"),("n1","n4"),("n4","n5"),("n3","n5")]),
"06_realtime": ("Đồng bộ trạng thái thời gian thực",[
("n1",50,100,180,70,"ESP8266"),("n2",300,100,210,70,"MQTT / Bridge"),("n3",590,100,210,70,"Supabase DB"),("n4",880,40,180,70,"Web"),("n5",880,180,180,70,"Android"),("n6",590,300,210,70,"Realtime")],
[("n1","n2"),("n2","n3"),("n3","n6"),("n6","n4"),("n6","n5")])
}
for key,(title,nodes,edges) in diagrams.items():
    svg_diagram(os.path.join(DIAG,key+".svg"),title,nodes,edges)
    open(os.path.join(DIAG,key+".drawio"),"w",encoding="utf-8").write(drawio_xml(title,nodes,edges))

# ---- minimal DOCX writer ----
NS_W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS_R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS_A='http://schemas.openxmlformats.org/drawingml/2006/main'
NS_WP='http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
NS_REL='http://schemas.openxmlformats.org/package/2006/relationships'
NS_CT='http://schemas.openxmlformats.org/package/2006/content-types'
def X(tag,attrs='',inner=''): return f'<{tag}{attrs}>{inner}</{tag}>'
def esc(s): return escape(s)
def p(text='',style=None,align=None,bold=False,size=26,italic=False,first=True):
    a=(f' w:val="{style}"' if style else '')+(f' w:jc="{align}"' if align else '')
    ppr=f'<w:pPr{a}/>' if a else ''
    if first: ppr += '<w:spacing w:after="120" w:line="312" w:lineRule="auto"/>'
    rpr=f'<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="{size}"/>'+('<w:b/>' if bold else '')+('<w:i/>' if italic else '')+'</w:rPr>'
    return f'<w:p>{ppr}<w:r>{rpr}<w:t xml:space="preserve">{esc(text)}</w:t></w:r>'
def heading(text,level):
    size={1:32,2:28,3:26}.get(level,26)
    return p(text,align='left',bold=True,size=size)
def bullet(text):
    return f'<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="26"/></w:rPr><w:t>{esc(text)}</w:t></w:r></w:p>'
def table(rows):
    out='<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders><w:tblW w:w="0" w:type="auto"/></w:tblPr>'
    for ri,row in enumerate(rows):
        out+='<w:tr>'
        for cell in row:
            out+='<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>'
            out+=p(cell, bold=(ri==0), size=22, first=False)
            out+='</w:tc>'
        out+='</w:tr>'
    return out+'</w:tbl>'
def pagebreak(): return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
def figure(path, rid, caption):
    # 6.4 inches x 3.45 inches
    return f'''<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="5850000" cy="3150000"/><wp:docPr id="{rid}" name="Figure {rid}"/><a:graphic xmlns:a="{NS_A}"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="{rid}" name="{os.path.basename(path)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="{path}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5850000" cy="3150000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr><w:t>{esc(caption)}</w:t></w:r> </w:p>'''

# Build body from markdown.
lines=open(MD,encoding='utf-8').read().splitlines()
body=[]
# cover from first 16 lines
for line in lines[:16]:
    if line.strip():
        body.append(p(line,align='center',bold=('BÁO CÁO' in line or 'XÂY DỰNG' in line or 'MÔN HỌC' in line),size=26))
body.append(pagebreak())
body.append(heading('MỤC LỤC',1))
body.append(p('Mục lục được trình bày theo hệ thống chương và mục của báo cáo. Khi mở tệp bằng Microsoft Word, có thể cập nhật trường mục lục nếu cần.',size=24))
body.append(pagebreak())
body.append(heading('DANH MỤC HÌNH ẢNH, BẢNG BIỂU',1))
figs=[]
for line in lines:
    if line.startswith('Hình '): figs.append(line)
for f in figs: body.append(p(f,size=23))
body.append(pagebreak())

i=16
fig_counter=1
while i < len(lines):
    line=lines[i]
    if not line.strip(): i+=1; continue
    if line.startswith('TRƯỜNG ') or line.startswith('BÁO CÁO ') or line.startswith('Nhóm sinh viên') or line.startswith('1. Nguyễn') or line.startswith('2. Nguyễn') or line.startswith('3. Nguyễn') or line.startswith('4. Trần') or line.startswith('5. Nguyễn') or line.startswith('Lớp:') or line.startswith('GIẢNG VIÊN') or line.startswith('HÀ NỘI'):
        i+=1; continue
    if line.startswith('# '):
        if line.startswith('# CHƯƠNG') or line.startswith('# KẾT LUẬN') or line.startswith('# TÀI LIỆU') or line.startswith('# PHỤ LỤC'):
            body.append(pagebreak())
        body.append(heading(line[2:].strip(),1)); i+=1; continue
    if line.startswith('## '):
        body.append(heading(line[3:].strip(),2)); i+=1; continue
    if line.startswith('### '):
        body.append(heading(line[4:].strip(),3)); i+=1; continue
    if line.startswith('[FIGURE:'):
        name=line[9:-1]
        path=os.path.join(DIAG,name)
        rid=200+fig_counter
        body.append(figure(path,'rId'+str(rid),''))
        fig_counter+=1; i+=1; continue
    if line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].startswith('|'):
            vals=[v.strip() for v in lines[i].strip().strip('|').split('|')]
            if not all(set(v)<=set('-: ') for v in vals):
                rows.append(vals)
            i+=1
        if rows: body.append(table(rows))
        continue
    if re.match(r'^[-*] ',line):
        body.append(bullet(line[2:].strip())); i+=1; continue
    body.append(p(line,size=25)); i+=1

# Fix figure relationship placeholders in body later.
doc_body=''.join(body)
# Relationship ids for images must be unique and known. Replace rId200 etc are already image ids.
rels=[('rId200','01_kien_truc_he_thong.svg'),('rId201','02_luong_mo_cua.svg'),('rId202','03_luong_esp8266.svg'),('rId203','04_webauthn.svg'),('rId204','05_webrtc.svg'),('rId205','06_realtime.svg')]

sect='''<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgNumType w:fmt="decimal"/></w:sectPr>'''
settings='''<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:updateFields w:val="true"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>'''
styles='''<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="26"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="312" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>'''
numbering='''<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>'''
footer='''<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:fldChar w:fldCharType="begin"/><w:instrText xml:space="preserve"> PAGE </w:instrText><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>'''
content_types='''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="svg" ContentType="image/svg+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>'''
rootrels='''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'''
docrels=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">','<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>']
for rid,f in rels:
    docrels.append(f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/{f}"/>')
docrels.append('</Relationships>')
docxml=f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="{NS_W}" xmlns:r="{NS_R}" xmlns:a="{NS_A}" xmlns:wp="{NS_WP}"><w:body>{doc_body}{sect}</w:body></w:document>'''

with zipfile.ZipFile(OUT,'w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml',content_types)
    z.writestr('_rels/.rels',rootrels)
    z.writestr('word/document.xml',docxml)
    z.writestr('word/styles.xml',styles)
    z.writestr('word/numbering.xml',numbering)
    z.writestr('word/settings.xml',settings)
    z.writestr('word/footer1.xml',footer)
    z.writestr('word/_rels/document.xml.rels',''.join(docrels))
    for _,f in rels:
        z.write(os.path.join(DIAG,f),'word/media/'+f)
print('CREATED',OUT)
print('SIZE',os.path.getsize(OUT))
