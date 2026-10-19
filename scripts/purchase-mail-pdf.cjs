// Server-only PDF generation. Never accepts HTML, file paths or remote assets.
'use strict';
const PDFDocument=require('pdfkit'),path=require('node:path');
const font=path.resolve(__dirname,'../assets/mail-font/NotoSansCJKkr-Regular.otf');
const number=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:6});
async function renderPdf({document:d,company={}}){return new Promise((resolve,reject)=>{
  const pdf=new PDFDocument({size:'A4',margin:32,bufferPages:true,info:{Title:'발주서 '+d.id,Author:company.name||'REA ERP',Creator:'REA ERP'},autoFirstPage:true}),parts=[];let bytes=0;
  pdf.on('data',b=>{bytes+=b.length;if(bytes>8000000)pdf.destroy(Error('PDF 크기 한도를 초과했습니다.'));else parts.push(b);});pdf.on('error',reject);pdf.on('end',()=>resolve(Buffer.concat(parts)));pdf.font(font);
  const width=pdf.page.width-64,cols=[24,175,42,70,78,64,width-453],labels=['No.','품목 / 규격','수량','단가','공급가액','부가세','합계'];let y;
  function pageHeader(continued=false){
    pdf.fillColor('#183862').fontSize(23).text('발 주 서',32,30,{width,align:'center'});
    pdf.fillColor('#45546b').fontSize(9).text(d.id+(continued?' · 계속':''),32,66,{width,align:'right'});
    if(continued){y=88;return;}
    const left=['공급받는 거래처: '+d.partnerName,d.partnerAddress,d.partnerPhone].filter(Boolean).join('\n'),right=[company.name||'발주처',company.businessNumber?'사업자번호 '+company.businessNumber:'',company.representative?'대표 '+company.representative:'',company.phone,company.email,company.address].filter(Boolean).join('\n');
    pdf.fontSize(10);const h=Math.max(pdf.heightOfString(left,{width:245}),pdf.heightOfString(right,{width:245}));pdf.text(left,32,93,{width:245});pdf.text(right,310,93,{width:253});y=105+h;
    const meta='발주일 '+d.date+(d.dueDate?'   납기일 '+d.dueDate:'')+'   금액 단위: 원 (KRW)';pdf.fontSize(9).text(meta,32,y,{width});y+=24;
    if(d.currency!=='KRW'){pdf.fontSize(8).text('참고 통화코드: '+d.currency+' · 환산하지 않은 ERP 저장 금액입니다.',32,y,{width});y+=22;}
  }
  function tableHeader(){pdf.save().fillColor('#eaf0f8').rect(32,y,width,25).fill().restore();let x=32;pdf.fillColor('#243d61').fontSize(8);labels.forEach((v,i)=>{pdf.text(v,x+4,y+7,{width:cols[i]-8,align:i>1?'right':'left'});x+=cols[i];});y+=25;}
  pageHeader();tableHeader();
  d.lines.forEach((l,index)=>{const description=l.name+'\n['+l.item+']'+(l.spec?' '+l.spec:'')+(l.unit?' / '+l.unit:'')+(l.discount?'\n할인 '+number(l.discount)+'%':'')+(l.memo?'\n'+l.memo:''),values=[index+1,description,number(l.qty),number(l.price),number(l.supply),number(l.tax),number(l.total)];pdf.fontSize(8);const h=Math.max(30,...values.map((v,i)=>pdf.heightOfString(String(v),{width:cols[i]-8,lineGap:1})+12));if(y+h>755){pdf.addPage();pdf.font(font);pageHeader(true);tableHeader();}let x=32;pdf.fillColor('#1c293c');values.forEach((v,i)=>{pdf.text(String(v),x+4,y+6,{width:cols[i]-8,lineGap:1,align:i>1?'right':'left'});x+=cols[i];});pdf.strokeColor('#d4dce8').lineWidth(0.5).moveTo(32,y+h).lineTo(32+width,y+h).stroke();y+=h;});
  if(y+80>760){pdf.addPage();pdf.font(font);pageHeader(true);}const totals=d.lines.reduce((a,l)=>({supply:a.supply+l.supply,tax:a.tax+l.tax,total:a.total+l.total}),{supply:0,tax:0,total:0});
  pdf.fontSize(10).fillColor('#183862').text('공급가액 '+number(totals.supply)+'   부가세 '+number(totals.tax)+'   합계 '+number(totals.total)+' 원',32,y+15,{width,align:'right'});y+=50;
  if(d.memo){pdf.fillColor('#34445e').fontSize(9).text('요청사항\n'+d.memo,32,y,{width,lineGap:2});}
  const range=pdf.bufferedPageRange();for(let i=range.start;i<range.start+range.count;i++){pdf.switchToPage(i);pdf.font(font).fontSize(7).fillColor('#6c788c').text(d.id+' · '+(i+1)+' / '+range.count,32,795,{width,align:'right',lineBreak:false});}pdf.end();
});}
module.exports={renderPdf,font};
