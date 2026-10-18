const {defineConfig}=require('drizzle-kit');
module.exports=defineConfig({dialect:'sqlite',schema:'./db/schema.js',out:'./drizzle'});
