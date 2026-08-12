const {Pool}=require('pg');const fs=require('fs');
const env={};
for(const l of fs.readFileSync('.env.local','utf8').split('\n')){
  const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) env[m[1]]=m[2].replace(/^["']|["']$/g,'');
}
const p=new Pool({connectionString:env.DATABASE_URL_OWNER||env.DATABASE_URL,ssl:{rejectUnauthorized:true}});
const file=process.argv[2];
p.query(fs.readFileSync(file,'utf8'))
 .then(()=>{console.log('OK',file);return p.end()})
 .catch(e=>{console.error('ERRORE:',e.message);process.exit(1)});
