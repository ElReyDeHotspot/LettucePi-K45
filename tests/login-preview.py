import json,sys,urllib.request,urllib.error
url=(sys.argv[1] if len(sys.argv)>1 else 'http://192.168.100.1').rstrip('/')+'/cgi-bin/chester-cellular'
allowed={'networkmode','band','bandca','arfcn','arfcnca','earfcn','earfcnca','nrarfcn','physicalcellid','physicalcellidca','pci','pcid','dlbandwidth','dlbandwidthca','rsrp','rsrq','sinr'}
for query in ['', '?config_section=../../etc/shadow']:
 with urllib.request.urlopen(url+query,timeout=10) as response:
  data=json.load(response)
  assert set(data)=={'available','carrier','network_mode','age','entries'}
  for entry in data['entries']:
   assert set(entry)=={'key','value','extra_info'}
   assert ''.join(c for c in entry['key'].lower() if c.isalnum()) in allowed
  assert not any(word in json.dumps(data).lower() for word in ['imei','imsi','iccid','password','ipaddr','apn'])
try:
 urllib.request.urlopen(urllib.request.Request(url,data=b'x',method='POST'),timeout=10)
 raise AssertionError('POST unexpectedly accepted')
except urllib.error.HTTPError as error:
 assert error.code==405
print('Unauthenticated login preview: strict radio whitelist, ignored query parameters, and GET-only behavior passed.')
