from pathlib import Path
import subprocess,json,sys,shlex
repo=Path(__file__).resolve().parents[1]
s=(repo/'payload/usr/share/qmodem/led_scripts/misectel_modem_status.sh').read_text(encoding='utf-8')
functions=s[s.index('get_mode()'):s.index('update_modem_leds()')]
entries=[{'key':'network_mode','value':'EN-DC Mode'}]+[{'key':'RSRP','value':'-109'} for _ in range(2000)]
script=functions+'''\nat(){ return 1; }; last_is_nr=0; get_mode "$1"; get_rsrp "$1"'''
if len(sys.argv)>1:
    payload=shlex.quote(json.dumps({'modem_info':entries}))
    shell=functions+"\nat(){ return 1; }; last_is_nr=0\npayload="+payload+"\n"
    shell+='err=$(mktemp /tmp/chester-led-test.XXXXXX) || exit 1\ntrap \'rm -f "$err"\' EXIT\nout=$(get_mode "$payload"; get_rsrp "$payload") 2>"$err"\n[ "$out" = "$(printf \'1\\n-109\')" ] && [ ! -s "$err" ] || exit 1\nout=$(get_mode \'{"modem_info":[]}\'; get_rsrp \'{"modem_info":[]}\') 2>"$err"\n[ "$out" = "$(printf \'0\\n0\')" ] && [ ! -s "$err" ] || exit 1\necho \'PASS LED status: large-response extraction, absent-data fallback and no broken pipe. AT transport mocked.\'\n'
    Path(sys.argv[1]).write_text(shell,encoding='utf-8',newline='\n')
    sys.exit(0)
p=subprocess.run(['bash','-c',script,'test',json.dumps({'modem_info':entries})],text=True,capture_output=True)
assert p.returncode==0 and p.stdout.splitlines()==['1','-109'] and not p.stderr,(p.stdout,p.stderr)
p=subprocess.run(['bash','-c',script,'test','{"modem_info":[]}'],text=True,capture_output=True)
assert p.returncode==0 and p.stdout.splitlines()==['0','0'] and not p.stderr,(p.stdout,p.stderr)
print('PASS LED status: first mode/RSRP from large responses, absent-data fallback, no jq broken-pipe errors. AT transport mocked.')
