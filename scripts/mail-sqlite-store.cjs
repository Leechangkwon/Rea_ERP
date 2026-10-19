// Local SQLite has the same optimistic concurrency contract as the remote store.
'use strict';
const fs=require('node:fs'),path=require('node:path');
function createSqliteMailStore(db,{directory}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS rea_local_mailboxes(id TEXT PRIMARY KEY,address TEXT UNIQUE NOT NULL,revision INTEGER NOT NULL,body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS rea_local_mail_messages(id TEXT PRIMARY KEY,mailbox_id TEXT NOT NULL,source_id TEXT,revision INTEGER NOT NULL,body TEXT NOT NULL,UNIQUE(mailbox_id,source_id)); CREATE TABLE IF NOT EXISTS rea_local_mail_keys(token_hash TEXT PRIMARY KEY,enabled INTEGER NOT NULL); CREATE UNIQUE INDEX IF NOT EXISTS rea_local_mail_request ON rea_local_mail_messages(mailbox_id,json_extract(body,'$.request_id')) WHERE json_extract(body,'$.request_id') IS NOT NULL`);
 const copy=JSON.parse.bind(JSON), get=(table,id)=>{const row=db.prepare('SELECT body FROM '+table+' WHERE id=?').get(id);return row?JSON.parse(row.body):null;};
 const file=key=>{if(!directory||!/^([a-f0-9-]{36}\/){2}[a-f0-9-]{36}$/.test(key))throw Error('Invalid local attachment key');const target=path.resolve(directory,key);if(!target.startsWith(path.resolve(directory)+path.sep))throw Error('Invalid local attachment path');return target;};
 return {async probe(){},async boxes(){return db.prepare('SELECT body FROM rea_local_mailboxes ORDER BY address').all().map(r=>JSON.parse(r.body));},async box(id){return get('rea_local_mailboxes',id);},
  async saveBox(row,revision){if(revision===null){db.prepare('INSERT INTO rea_local_mailboxes VALUES(?,?,?,?)').run(row.id,row.address,row.revision,JSON.stringify(row));return row;}const next={...row,revision:revision+1};const r=db.prepare('UPDATE rea_local_mailboxes SET address=?,revision=?,body=? WHERE id=? AND revision=?').run(next.address,next.revision,JSON.stringify(next),row.id,revision);return r.changes?next:null;},
  async list({box,folder,query='',offset=0}){return db.prepare('SELECT body FROM rea_local_mail_messages WHERE mailbox_id=?').all(box).map(r=>JSON.parse(r.body)).filter(r=>r.folder===folder&&(!query||r.search_text.toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id)).slice(offset,offset+51);},
  async message(id){return get('rea_local_mail_messages',id);},async source(box,source){const r=db.prepare('SELECT body FROM rea_local_mail_messages WHERE mailbox_id=? AND source_id=?').get(box,source);return r?JSON.parse(r.body):null;},
  async messageByHeader(box,id){return db.prepare('SELECT body FROM rea_local_mail_messages WHERE mailbox_id=?').all(box).map(r=>JSON.parse(r.body)).find(r=>r.message_id===id)||null;},
  async create(row){db.prepare('INSERT INTO rea_local_mail_messages VALUES(?,?,?,?,?)').run(row.id,row.mailbox_id,row.source_id||null,row.revision,JSON.stringify(row));return row;},
  async update(id,revision,patch){const row=get('rea_local_mail_messages',id);if(!row||row.revision!==revision)return null;const next={...row,...patch,revision:revision+1};const r=db.prepare('UPDATE rea_local_mail_messages SET revision=?,body=? WHERE id=? AND revision=?').run(next.revision,JSON.stringify(next),id,revision);return r.changes?next:null;},
  async token(hash){return !!db.prepare('SELECT token_hash FROM rea_local_mail_keys WHERE token_hash=? AND enabled=1').get(hash);},
  async upload(key,bytes){const target=file(key);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.writeFileSync(target,bytes,{mode:0o600,flag:'wx'});},async download(key){return new Uint8Array(fs.readFileSync(file(key)));},async removeFiles(keys){for(const key of keys)try{fs.unlinkSync(file(key));}catch{}}
 };
}
module.exports={createSqliteMailStore};
