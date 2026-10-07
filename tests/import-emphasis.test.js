const test=require('node:test'),assert=require('node:assert/strict');const renderer=require('../lib/render'),importer=require('../lib/import'),emphasis=require('../lib/import-emphasis');
test('PDF imports recover real bold fonts and fill-stroke bold without making ordinary words bold',async()=>{
 const {PDFDocument,StandardFonts,setTextRenderingMode}=renderer.dependency('pdf-lib'),pdf=await PDFDocument.create(),page=pdf.addPage(),normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 page.drawText('Example Name',{x:40,y:800,size:15,font:normal});page.drawText('Summary',{x:40,y:760,size:12,font:normal});
 page.drawText('Design',{x:40,y:730,size:10,font:bold});page.drawText(' systems',{x:75,y:730,size:10,font:normal});
 page.pushOperators(setTextRenderingMode(2));page.drawText('Research',{x:40,y:710,size:10,font:normal});page.pushOperators(setTextRenderingMode(0));page.drawText(' skills',{x:85,y:710,size:10,font:normal});
 const result=await importer.prepare(Buffer.from(await pdf.save()),'bold.pdf','projects');assert.match(result.document.markdown,/\*\*Design\*\*/);assert.match(result.document.markdown,/\*\*Research\*\*/);assert.doesNotMatch(result.document.markdown,/\*\*systems\*\*|\*\*skills\*\*/);
});
test('emphasis recovery preserves existing styles and uses source context for repeated phrases',()=>{
 const markdown='Repeated phrase, first context.\nRepeated phrase, another context.\nAlready **styled** text.';
 assert.equal(emphasis.restore(markdown,['Repeated phrase','styled']),markdown);
 const result=emphasis.restore(markdown,[{text:'Repeated phrase',after:', first context.'}]);assert.match(result,/^\*\*Repeated phrase\*\*, first/);assert.match(result,/\nRepeated phrase, another/);
});
