const {DatabaseSync}=require('node:sqlite'),fs=require('node:fs'),path=require('node:path');
function sqliteD1(filename=':memory:'){
  const db=new DatabaseSync(filename);db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  const dir=path.resolve(__dirname,'../drizzle');for(const name of fs.readdirSync(dir).filter(x=>x.endsWith('.sql')).sort()){if(!db.prepare('SELECT name FROM local_migrations WHERE name=?').get(name)){db.exec(fs.readFileSync(path.join(dir,name),'utf8'));db.prepare('INSERT INTO local_migrations(name) VALUES (?)').run(name);}}
  return {prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null;},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};},async all(){return {results:db.prepare(sql).all(...args)};}};}};},close(){db.close();},raw:db};
}
module.exports={sqliteD1};
