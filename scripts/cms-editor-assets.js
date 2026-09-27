const fs=require('node:fs');
const path=require('node:path');
async function prepareEditorAssets(){
  const root=path.join(__dirname,'..'),target=path.join(root,'source/admin/vendor/vditor');
  for(const file of ['dist/index.min.js','dist/index.css','dist/css/content-theme/light.css','dist/js/i18n/zh_CN.js','dist/js/lute/lute.min.js','LICENSE']){
    const destination=path.join(target,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(root,'node_modules/vditor',file),destination);
  }
}
if(require.main===module)prepareEditorAssets().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={prepareEditorAssets};
