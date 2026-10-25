(()=>{
'use strict';
// Discovery metadata ONLY. Do not expose tools to AI unless a tested adapter
// registers through CivweaveCreatorToolsV1 and enforces user authorization.
const APPS=[
  ['photocraft','PhotoCraft','creative','Layered image editing, masks, typography and PSD','PSD, PNG, JPEG','web'],
  ['vectorcraft','VectorCraft','creative','Vector illustration and scalable artwork','SVG, vector artwork','web'],
  ['filmcraft','FilmCraft','creative','Video editing, color and sound','Video projects and exports','experimental'],
  ['lightcraft','LightCraft','creative','Photo library and RAW development','RAW, photo exports','web'],
  ['pdfcraft','PdfCraft','office','Read, organize and protect PDF documents','PDF','web'],
  ['effectcraft','EffectCraft','creative','Motion graphics, animation and visual effects','Motion graphics projects','web'],
  ['designcraft','DesignCraft','creative','Page layout and publishing','Print and publishing layouts','web'],
  ['cadcraft','CADCraft','cad','2D/3D drafting, measurements, plans and CAD export','DXF, DWG, PDF, SVG','web'],
  ['wordcraft','WordCraft','office','Business writing, tracked changes, templates and mail merge','DOCX, ODT, Markdown, PDF','web'],
  ['gridcraft','GridCraft','office','Budgets, worksheets, formulas, tables and reports','XLSX, CSV, TSV','web'],
  ['deckcraft','DeckCraft','office','Presentations, slide masters and exports','PPTX, PDF','web']
];
const SERVICES=[
  ['gotenberg','Gotenberg','Document conversion and PDF generation','https://github.com/gotenberg/gotenberg','container-service'],
  ['paperless-ngx','Paperless-ngx','OCR, searchable business archive and filing','https://github.com/paperless-ngx/paperless-ngx','container-service'],
  ['stirling-pdf','Stirling PDF','Advanced PDF processing through a self-hosted API; check component licenses','https://github.com/Stirling-Tools/Stirling-PDF','open-core-service'],
  ['collabora','Collabora Online','Optional real-time collaborative office editing','https://github.com/CollaboraOnline/online','copyleft-service'],
  ['documenso','Documenso','Optional electronic signature and approval flows','https://github.com/documenso/documenso','copyleft-service']
];
const applications=Object.freeze(APPS.map(([id,name,category,summary,formats,browser])=>Object.freeze({
  id,name,category,summary,formats,browser,
  repository:'https://github.com/storytold/'+id,
  upstreamAutomation:'MCP / CLI / command interface',
  connection:'not-connected'
})));
const services=Object.freeze(SERVICES.map(([id,name,summary,repository,deployment])=>Object.freeze({
  id,name,category:'services',summary,repository,deployment,connection:'not-connected'
})));
function list(category='all'){
  return [...applications,...services].filter(item=>category==='all'||item.category===category).map(item=>({...item}));
}
function get(id){const item=[...applications,...services].find(item=>item.id===id);return item?{...item}:null;}
globalThis.CivweaveCraftCatalogV1=Object.freeze({
  schema:'civweave.craft-tool-catalog.v1',version:'1.0.0',applications,services,list,get
});
})();
