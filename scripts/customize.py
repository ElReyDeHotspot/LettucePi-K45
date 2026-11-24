#!/usr/bin/env python3
"""Apply the K45P UI port to an extracted, unmodified K45P rootfs."""
from pathlib import Path
import shutil, re, sys, json, hashlib

root=Path(sys.argv[1]).resolve(); repo=Path(__file__).resolve().parents[1]
assert root != Path('/') and (root/'etc/openwrt_release').is_file()
assert "r37978-cd0a06bfd3fd" in (root/'etc/openwrt_release').read_text()
# The vendor script otherwise resets even a restored password on sysupgrade.
pw=root/'etc/uci-defaults/50-root-passwd'
guard="""# K45P: initialize factory credentials only when no password hash exists.
current_hash=$(sed -n 's/^root:\\([^:]*\\):.*/\\1/p' /etc/shadow)
case "$current_hash" in
    ''|'!'|'*'|'x') ;;
    *) exit 0 ;;
esac
"""
pw.write_text(guard+pw.read_text())
original_backend=(root/'usr/share/rpcd/ucode/misectel').read_text()
shutil.copytree(repo/'payload',root,dirs_exist_ok=True)
# LuCI is served by ucode CGI. The patched upstream server has no Lua module.
p=root/'etc/config/uhttpd'
p.write_text('\n'.join(line for line in p.read_text().splitlines() if 'lua_prefix' not in line)+'\n')
# config_generate only creates a missing network config, preserving retained LANs.
p=root/'bin/config_generate'
s=p.read_text()
assert 'lan) ipad=${ipaddr:-"192.168.1.1"}' in s
p.write_text(s.replace('lan) ipad=${ipaddr:-"192.168.1.1"}', 'lan) ipad=${ipaddr:-"192.168.100.1"}'))
backend=root/'usr/share/rpcd/ucode/misectel'
s=backend.read_text()
# Retain the current vendor's OEM methods, which did not exist on the K43P.
for name in ['oem_mac_address','oem_serial_number']:
    m=re.search(r'\n\t'+name+r': \{.*?(?=\n\t[a-z_]+: \{|\n};)',original_backend,re.S)
    if m:
        s=s.replace('\n\tttl_status:',m[0].rstrip().rstrip(',')+',\n\tttl_status:',1)
# Model display is a K45P property, never inferred from a K43P boot environment.
s=re.sub(r'\n\toem_model_name: \{.*?(?=\n\t[a-z_]+: \{)',"\n\toem_model_name: { call: function() { return { model_name: 'Chester K45P' }; } },\n",s,count=1,flags=re.S)
s=s.replace("const APN_FALLBACK_COUNTRY = 'unknown'","const APN_FALLBACK_COUNTRY = 'us'")
backend.write_text(s.replace('readMisectelOption','readLettucePiOption'))

# The current vendor firmware uses gateway-* routes; align the routes in the
# existing views, menu tree, config and templates with the ported overview.
routes={'gateway-dashboard':'dashboard','gateway-wireless':'wifi','gateway-network':'settings','gateway-system':'settings','gateway-portmap':'portmap','gateway-vpnoverview':'overview','gateway-wireguard':'wireguard','gateway-openvpn':'openvpn','gateway-l2tp':'l2tp','gateway-pptp':'pptp','gateway-vxlan':'vxlan','gateway-vrf':'vrf','gateway-dns':'dns'}
text_roots=['www','usr/share/luci/menu.d','usr/share/ucode/luci/template','usr/share/rpcd','etc/config','etc/uci-defaults','lib/wifi']
changed=[]
for folder in text_roots:
    for p in (root/folder).rglob('*'):
        if not p.is_file() or p.is_symlink():continue
        try:old=p.read_text()
        except (UnicodeError,OSError):continue
        s=old
        for a,b in routes.items():s=s.replace(a,b)
        # Legacy route compatibility fallbacks in the vendor theme.
        for a,b in [('admin/misectel-dashboard','admin/dashboard'),('admin-misectel-dashboard','admin-dashboard')]:s=s.replace(a,b)
        if p.suffix in ['.ut','.json'] or p.name=='misectel':
            s=s.replace('Misectel','LettucePi')
        s=s.replace("option lang auto","option lang en")
        s=s.replace('set luci.main.lang="auto"','set luci.main.lang="en"')
        s=s.replace("DEFAULT_APN_COUNTRY='unknown'","DEFAULT_APN_COUNTRY='us'")
        s=s.replace("country || 'CN'","country || 'US'").replace('country || "CN"','country || "US"')
        s=s.replace("isZh()?'确认':'OK'","'OK'").replace("isZh()?'正在处理，请稍候…':'Processing, please wait…'","'Processing, please wait…'")
        if s!=old:p.write_text(s);changed.append(str(p.relative_to(root)))

# Enable Apps in the themed navigation (these are intentionally disabled until
# the operator turns them on; installing the UI never changes data traffic).
menu=root/'www/luci-static/resources/menu-misectel.js'
s=menu.read_text()
for a,b in {'misectel-dashboard':'dashboard','misectel-wireless':'wifi','misectel-network':'settings','misectel-system':'settings','misectel-portmap':'portmap'}.items():s=s.replace(a,b)
# Chester Mods owns the app navigation; legacy app URLs remain aliases.
s=s.replace("const DEFAULT_ALWAYS_SHOW=['apps','apps/tailscale','apps/speedtest','apps/sqm','apps/zapret',", "const DEFAULT_ALWAYS_SHOW=[")
menu.write_text(s)
custom=root/'www/luci-static/misectel/custom.css'
custom.write_text(custom.read_text().replace('--misectel-shell-sidebar-width: 184px','--misectel-shell-sidebar-width: 232px'))

# Keep defaults aligned with routes and expose the installed apps.
cfg=root/'etc/config/misectel'
s=cfg.read_text()
for name,value in [('brand_name','LettucePi'),('model_name','K45P'),('header_name','Chester K45P'),('apn_country','us')]:
    s=re.sub(r"(option "+name+r"\s+)'[^']*'",lambda m:m[1]+repr(value),s)
cfg.write_text(s)
p=root/'etc/config/rpcd'
p.write_text(re.sub(r"(option username\s+)'admin'",r"\1'root'",p.read_text())+"\nconfig login 'admin'\n\toption username 'admin'\n\toption password '$p$root'\n\tlist read '*'\n\tlist write '*'\n")

# Preserve old Client List bookmarks while the network menu owns its entry.
p=root/'usr/share/luci/menu.d/luci-app-misectel-dashboard.json'
d=json.loads(p.read_text());d['admin/dashboard/clients']={'hidden':True,'action':{'type':'alias','path':'admin/network/clients'},'depends':{'acl':['luci-app-misectel-device']}}
# Preserve the vendor's unauthenticated setup route; the wizard is reachable
# from setup and can be revisited using its normal setup entry.
p.write_text(json.dumps(d,indent=2)+'\n')

# An IPv6 TTL rule must leave NDP/MLD hop limits intact.
p=root/'etc/init.d/qmodem_ttl'
if p.exists():
    s=p.read_text()
    if 'meta l4proto != ipv6-icmp' not in s:
        s=s.replace('iifname "br-lan" ip6 hoplimit set $ttl', 'iifname "br-lan" meta l4proto != ipv6-icmp ip6 hoplimit set $ttl')
    p.write_text(s)

# Only English catalogs and picker entries are shipped.
translations={'通知内容':'Message','来源号码':'Sender number','通话类型':'Call type','通知标题':'Notification title','设备名称':'Device name','App应用名':'App name','接收时间':'Received at','自定义':'Custom','短信通知':'SMS notification','中国电信':'China Telecom','中国移动':'China Mobile','中国联通':'China Unicom','成功转发短信至飞书':'Forwarded SMS to Feishu','最终发送失败':'Final delivery failed','放弃重试':'No more retries','短信来自':'SMS from','长度':'length','字符':'characters','准备推送到飞书':'sending to Feishu','次发送失败':'delivery failed','重试中':'retrying','第':'Attempt '}
han=re.compile('[\u3400-\u9fff]')
for p in root.rglob('*'):
    if not p.is_file() or p.is_symlink():continue
    try:s=p.read_text()
    except (UnicodeError,OSError):continue
    if not han.search(s):continue
    if p.name=='at_commands_zh.json':
        p.unlink();continue
    if p.name=='apns.json':
        d=json.loads(s);d['apns']['apn']=[a for a in d['apns']['apn'] if a.get('_mcc') in {'001','310','311','312','313','314','315','316'}]
        p.write_text(json.dumps(d,indent=2)+'\n');continue
    # Drop Chinese comments without touching functional shell or JavaScript.
    s=re.sub(r'/\*.*?\*/',lambda m:'' if han.search(m[0]) else m[0],s,flags=re.S)
    lines=[]
    for line in s.splitlines():
        if han.search(line):
            if line.lstrip().startswith(('#','//')):continue
            for a,b in translations.items():line=line.replace(a,b)
            if han.search(line) and ' #' in line:line=line.split(' #',1)[0]
            if han.search(line) and ' //' in line:line=line.split(' //',1)[0]
        lines.append(line)
    s='\n'.join(lines)+'\n'
    if han.search(s):raise RuntimeError('Untranslated Chinese text in '+str(p))
    p.write_text(s)
p=root/'usr/share/qmodem/modem_ctrl.sh'
p.write_text(p.read_text().replace('at_commands_zh.json','at_commands_en.json'))

# Use the same US presets in the QModem manual APN dropdowns.
nc=root/'www/luci-static/resources/view/qmodem/network_config.js'
if nc.exists():
    s=nc.read_text();presets=json.loads((root/'usr/share/misectel/apn-presets/defaults/us.json').read_text())['presets']
    def esc(v):return v.replace('\\','\\\\').replace("'","\\'")
    opts="o.value('',_('Auto Choose'));"+''.join("o.value('%s','%s');"%(esc(e['apn']),esc(e['operator'])) for e in presets)
    val=re.compile(r"o\.value\('[^']*',(?:_\()?'[^']*'\)?\);")
    for name in ['apn','apn2']:
        m=re.search(r"o=s\.option\(form\.Value,'"+name+r"',",s)
        if not m:continue
        start=m.start();end=s.find('o=s.option(',start+5);end=end if end>0 else len(s)
        block=s[start:end];first=val.search(block)
        if first:block=block[:first.start()]+opts+val.sub('',block[first.start():]);s=s[:start]+block+s[end:]
    nc.write_text(s)

for p in root.rglob('*'):
    if p.is_file() and not p.is_symlink() and ('zh-cn' in p.name or 'zh-tw' in p.name or 'zh_cn' in p.name or 'zh_tw' in p.name):p.unlink()
for folder in ['usr/sbin','usr/libexec','usr/share/rpcd/ucode','etc/init.d','etc/hotplug.d','etc/uci-defaults','lib/preinit','www/cgi-bin']:
    for p in (repo/'payload'/folder).rglob('*') if (repo/'payload'/folder).exists() else []:
        if p.is_file():(root/p.relative_to(repo/'payload')).chmod(0o755)
(root/'usr/share/rpcd/ucode/misectel').chmod(0o755)

# Preserve binary contents and architecture of the bundled tpws engine.
assert (root/'usr/sbin/tpws').read_bytes()[:4]==b'\x7fELF'
tc=root/'sbin/tc'
if not tc.exists() and not tc.is_symlink():tc.symlink_to('/usr/libexec/tc-full')
for name,start in [('chester-sqm',96),('ttyd',99),('failover',99)]:
    init=(root/('etc/init.d/'+name)).read_text()
    stop=re.search(r'^STOP=(\d+)',init,re.M)
    timings=[('S',start)]+([('K',int(stop[1]))] if stop else [])
    for prefix,order in timings:
        link=root/('etc/rc.d/%s%02d%s'%(prefix,order,name))
        if not link.is_symlink():link.symlink_to('../init.d/'+name)
print(f'Customized K45P rootfs; normalized {len(changed)} files')

# apk --no-scripts defers package post-install actions. Apply the companion
# LuCI init override and default config to the staged root, without starting it.
z2=root/'opt/zapret2'
if z2.is_dir():
    shutil.copy2(root/'usr/share/luci-app-zapret2/init.d-zapret2',root/'etc/init.d/zapret2')
    (root/'etc/init.d/zapret2').chmod(0o755)
    if not (z2/'config').exists(): shutil.copy2(z2/'config.default',z2/'config')
    nft=z2/'common/nft.sh'
    text=nft.read_text()
    if 'counter queue num' not in text: nft.write_text(text.replace('queue num ','counter queue num '))

# US build: remove optional Chinese SMS notification integrations.
for provider in ('feishu','pushdeer','serverchan'):
    (root/f'usr/share/sms_forwarder/sms_forward_{provider}.sh').unlink(missing_ok=True)
for script in ('usr/share/misectel/wan5g-probe.sh','usr/share/qmodem/led_scripts/connectivity.sh'):
    (root/script).chmod(0o755)

# VPN starts only after an explicit Chester Mods / Tailscale enable action.
for link in (root/'etc/rc.d').glob('*tailscale'):
    link.unlink()

# Remove inherited Chinese DNS probe defaults without changing unrelated config.
for name in ('etc/config/misectel_uplink',):
    p=root/name
    if p.exists():
        text=p.read_text()
        for old,new in [('223.5.5.5','1.1.1.1'),('223.6.6.6','1.0.0.1'),('119.29.29.29','8.8.8.8'),('114.114.114.114','9.9.9.9')]: text=text.replace(old,new)
        p.write_text(text)


# Shared modem helpers copied from the vendor tree must remain executable.
for p in (repo/'payload/usr/share/qmodem').rglob('*.sh'):
    (root/p.relative_to(repo/'payload')).chmod(0o755)

# Both on-demand speed-test engines are immutable image content.
for name in ['usr/bin/speedtest','usr/libexec/chester-ndt7']:
    engine=root/name
    assert engine.is_file() and engine.stat().st_size>100000, 'Missing bundled test engine: '+name
    engine.chmod(0o755)

# SIM policy daemon ships in Manual mode and starts its local status reader.
for link in ['S99chester_sim','K09chester_sim']:
    target=root/'etc/rc.d'/link
    if not target.exists() and not target.is_symlink():target.symlink_to('../init.d/chester_sim')

# K45P has no configured modem-boost GPIO. Keep the unused polling service frozen.
for link in (root/'etc/rc.d').glob('*misectel_modem_boost'):
    if link.is_symlink():link.unlink()

# Match the shared page-loader title in both initial and dynamic view loads.
for name in ('www/luci-static/resources/luci.js', 'usr/share/ucode/luci/template/view.ut'):
    page=root/name
    text=page.read_text(encoding='utf-8')
    page.write_text(text.replace('Loading view', 'Loading View'),encoding='utf-8')
