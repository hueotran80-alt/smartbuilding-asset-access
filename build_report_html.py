import re, html, base64, os
base='/Users/trantuan/vercel-recovery/recovered-project'
md=open(base+'/report_Nhung_IoT_2026.md',encoding='utf-8').read().splitlines()
imgs={
'## 3.1. Kiến trúc tổng thể':'01_kien_truc_he_thong.svg',
'## 4.1. Khởi tạo ESP8266':'03_luong_esp8266.svg',
'## 4.2. Luồng xử lý mở cửa bằng keypad':'02_luong_mo_cua.svg',
'## 5.2. Xác thực nhiều lớp':'04_webauthn.svg',
'## 5.4. Đồng bộ thời gian thực':'06_realtime.svg',
'## 6.1. Kiến trúc camera':'05_webrtc.svg'}
out=[]; i=0
out.append('''<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:2.5cm 2cm 2cm 2.5cm}body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.5}h1{text-align:center;font-size:16pt;page-break-before:always}h2{font-size:14pt;margin-top:18pt}p{text-align:justify;text-indent:1cm;margin:6pt 0}li{margin:4pt 0}table{border-collapse:collapse;width:100%;margin:10pt 0}td,th{border:1px solid #000;padding:5pt}th{font-weight:bold}.cover{text-align:center;height:25cm}.cover p{text-align:center;text-indent:0}.title{font-weight:bold;font-size:16pt;margin-top:30pt}.diagram{display:block;max-width:100%;margin:12pt auto}.caption{text-align:center;font-style:italic;text-indent:0}</style></head><body>''')
# cover
cover=['TRƯỜNG ĐẠI HỌC TÀI NGUYÊN VÀ MÔI TRƯỜNG HÀ NỘI','KHOA CÔNG NGHỆ THÔNG TIN','','BÁO CÁO BÀI TẬP LỚN','MÔN HỌC: NHÚNG VÀ IoT','', 'XÂY DỰNG HỆ THỐNG QUẢN LÝ VÀ KIỂM SOÁT TRUY CẬP TÒA NHÀ THÔNG MINH TÍCH HỢP XÁC THỰC SINH TRẮC HỌC, GIÁM SÁT CAMERA VÀ ĐIỀU KHIỂN KHÓA','', 'Nhóm sinh viên thực hiện:','1. Nguyễn Hữu Tùng','2. Nguyễn Quang Phúc','3. Nguyễn Đức Mạnh','4. Trần Xuân Hùng','5. Nguyễn Đình Đức','Lớp: ĐH13C5','GIẢNG VIÊN GIẢNG DẠY: ThS. Nguyễn Văn Hách','', 'HÀ NỘI, 10/2026']
out.append('<div class="cover">')
for j,s in enumerate(cover):
 cls='title' if j in (3,6) else ''
 out.append(f'<p class="{cls}"><b>{html.escape(s)}</b></p>')
out.append('</div><div style="page-break-after:always"></div>')
start=next(i for i,l in enumerate(md) if l.startswith('# LỜI MỞ ĐẦU'))
in_code=False; table=[]
for line in md[start:]:
 if line.startswith('```'):
  if not in_code: out.append('<pre>')
  else: out.append('</pre>')
  in_code=not in_code; continue
 if in_code:
  out.append(html.escape(line)+'\n'); continue
 if not line.strip(): continue
 if line.startswith('# '): out.append('<h1>'+html.escape(line[2:])+'</h1>'); continue
 if line.startswith('## '):
  out.append('<h2>'+html.escape(line[3:])+'</h2>')
  fn=imgs.get(line)
  if fn:
   raw=open(base+'/drawio/'+fn,'rb').read(); b64=base64.b64encode(raw).decode()
   out.append(f'<img class="diagram" src="data:image/svg+xml;base64,{b64}"><p class="caption">Hình: {html.escape(line[3:])}</p>')
  continue
 if line.startswith('### '): out.append('<h3>'+html.escape(line[4:])+'</h3>'); continue
 if line.startswith('|'):
  cells=[x.strip() for x in line.strip('|').split('|')]
  if all(re.fullmatch(r'[-: ]+',c or '-') for c in cells): continue
  tag='th' if not table else 'td'
  if not table: out.append('<table>')
  out.append('<tr>'+''.join(f'<{tag}>{html.escape(c)}</{tag}>' for c in cells)+'</tr>')
  table.append(1); continue
 if table:
  out.append('</table>'); table=[]
 if line.startswith('- '): out.append('<ul><li>'+html.escape(line[2:])+'</li></ul>'); continue
 m=re.match(r'^\d+\.\s+(.*)',line)
 if m: out.append('<p><b>'+html.escape(line.split('.',1)[0])+'.</b> '+html.escape(m.group(1))+'</p>'); continue
 out.append('<p>'+html.escape(line)+'</p>')
if table: out.append('</table>')
out.append('</body></html>')
open(base+'/Bao_cao_BTL_Nhung_IoT_HUNRE_2026.html','w',encoding='utf-8').write(''.join(out))
print('HTML created')
