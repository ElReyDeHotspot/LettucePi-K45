from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1];q=root/'payload/usr/share/qmodem'
raw='''+QCAINFO: "PCC",66711,75,"LTE BAND 66",1,285,-114,-14,-78,252
+QCAINFO: "SCC",925,25,"LTE BAND 2",1,374,-111,-16,-83,0,0,-,-
+QCAINFO: "SCC",530190,7,"NR5G BAND 41",120
+QCAINFO: "SCC",507870,7,"NR5G BAND 41",1,120,0,-,-
'''
def parse(raw):return subprocess.check_output(['awk','-f',str(q/'quectel-ca.awk')],input=raw,text=True).splitlines()
expected=['LTE|pcc|66711|66|285|15','LTE|scc|925|2|374|5','NR|scc|530190|41|120|50','NR|scc|507870|41|120|50']
assert parse(raw)==expected
assert parse('ERROR\n')==[]
assert parse('+QCAINFO: "PCC",627264,12,"NR5G BAND 78",1,293\r\n')==['NR|pcc|627264|78|293|100']
assert parse('+QCAINFO: "PCC",100,999,"LTE BAND 2",1,-\n')==['LTE|pcc|100|2|-|-']
script='''source "$1/quectel-ca.sh"
quectel_merge_nsa_ca "$2"
printf '%s\\n' "$endc_lte_band" "$endc_nr_band" "$endc_nr_arfcn" "$endc_nr_physical_cell_id" "$endc_nr_dl_bandwidth"
quectel_current_band_from_ca '"LTE"' '' && exit 9
quectel_current_band_from_ca '"LTE"' 'LTE|scc|925|2|374|5' && exit 10
exit 0
'''
out=subprocess.check_output(['bash','-c',script,'test',str(q),'\n'.join(expected)],text=True).splitlines()
assert out==['66 / 2','41 / 41','530190 / 507870','120 / 120','50 / 50'],out
print('PASS QCAINFO: mixed NSA, compact/extended NR formats, repeated N41, LTE RB/NR bandwidth units, SA, missing values and serving-cell fallback.')

source=(q/'vendor/quectel.sh').read_text(encoding='utf-8')
scs=source[source.index('get_scs()'):source.index('get_phych()')]
script=scs+"\nfor v in 0 1 2 3 4 5 6 '' - invalid; do get_scs \"$v\"; done"
proc=subprocess.run(['bash','-c',script],text=True,capture_output=True)
assert proc.returncode==0 and not proc.stderr,proc.stderr
assert proc.stdout.splitlines()==['15','30','60','120','240','480','960','','','']
print('PASS missing/unknown SCS returns blank without executing invalid awk expressions.')
