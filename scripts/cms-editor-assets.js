const fs=require('node:fs');
const path=require('node:path');
async function prepareEditorAssets(){
  const root=path.join(__dirname,'..'),target=path.join(root,'source/admin/vendor/vditor');
  for(const file of ['dist/index.min.js','dist/index.css','dist/css/content-theme/light.css','dist/js/i18n/zh_CN.js','dist/js/lute/lute.min.js','dist/js/icons/material.js','LICENSE']){
    const destination=path.join(target,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(root,'node_modules/vditor',file),destination);
  }
  await require('esbuild').build({entryPoints:{app:path.join(root,'source/admin/app.js'),'article-editor-ui':path.join(root,'source/admin/article-editor-ui.js')},outdir:path.join(root,'source/admin/vendor'),bundle:true,splitting:true,format:'esm',platform:'browser',minify:true});
  const licenses=path.join(root,'source/admin/vendor/licenses');fs.mkdirSync(licenses,{recursive:true});
  for(const name of ['dompurify','marked','highlight.js','mermaid']){const directory=path.join(root,'node_modules',name),file=fs.readdirSync(directory).find(name=>/^license(?:\.md|\.txt)?$/i.test(name));if(file)fs.copyFileSync(path.join(directory,file),path.join(licenses,name+'.txt'));}
}
if(require.main===module)prepareEditorAssets().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={prepareEditorAssets};
