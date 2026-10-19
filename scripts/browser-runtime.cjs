const fs=require('node:fs'),path=require('node:path');
const libraryDirectory=path.resolve(__dirname,'../.artifacts/browser-libs/usr/lib/x86_64-linux-gnu');
function browserEnvironment(){
  return fs.existsSync(libraryDirectory)?{...process.env,LD_LIBRARY_PATH:[libraryDirectory,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')}:{...process.env};
}
module.exports={browserEnvironment};
