"""Emit native ucode validation/storage tests using a disposable /tmp directory."""
from pathlib import Path
src=(Path(__file__).resolve().parents[1]/'payload/usr/share/rpcd/ucode/chester.topology').read_text(encoding='utf-8')
src=src.replace("DIR='/etc/chester-topology'","DIR='/tmp/chester-topology-qa'").replace("'/tmp/chester-topology-save.lock'","'/tmp/chester-topology-qa.lock'").replace("return {'chester.topology':{","let api={'chester.topology':{")
src+='''
function check(ok,label){if(!ok)die(label+'\\n');}
let m=blank();check(valid(m),'blank invalid');m.parents={'custom:a':'custom:b','custom:b':'custom:a'};check(!valid(m),'cycle allowed');m=blank();m.positions={'router':{x:'x',y:0}};check(!valid(m),'bad coordinates allowed');m=blank();let a=api['chester.topology'].save.call({args:{map:sprintf('%J',m),revision:0}});check(a.success,'save failed '+sprintf('%J',a));check(readmap().revision==1,'not persisted');let conflict=api['chester.topology'].save.call({args:{map:sprintf('%J',m),revision:0}});check(!conflict.success,'stale revision accepted');let r=api['chester.topology'].read.call();check(length(r.ports)>0,'no ports');unlink(PATH);rmdir(DIR);print('PASS native topology: atomic save, persistence, revision conflicts, cycle rejection, physical discovery.\\n');
'''
print(src)
