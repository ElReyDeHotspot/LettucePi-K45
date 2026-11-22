# Parse Quectel QCAINFO carrier rows without merging repeated bands.
# Output: RAT|role|channel|band|PCI|DL bandwidth in MHz
BEGIN { lte[6]="1.4";lte[15]=3;lte[25]=5;lte[50]=10;lte[75]=15;lte[100]=20 }
/^[[:space:]]*\+QCAINFO:/ {
 sub(/^[[:space:]]*\+QCAINFO:[[:space:]]*/, "")
 sub(/\r$/, "")
 count=split($0,f,",")
 for(i=1;i<=count;i++){gsub(/"/,"",f[i]);gsub(/^[[:space:]]+|[[:space:]]+$/,"",f[i])}
 role=tolower(f[1]);if(role!="pcc"&&role!="scc")next
 if(f[4] ~ /^LTE BAND [0-9]+$/)rat="LTE"
 else if(f[4] ~ /^(NR5G|NR) BAND [0-9]+$/)rat="NR"
 else next
 band=f[4];sub(/^.*BAND /,"",band)
 channel=f[2];if(channel!~/^[0-9]+$/)next
 pci=(rat=="NR"&&count==5)?f[5]:f[6];if(pci!~/^[0-9]+$/)pci="-"
 bw="-"
 if(rat=="LTE"&&f[3] in lte)bw=lte[f[3]]
 if(rat=="NR"&&f[3]~/^[0-9]+$/){n=f[3]+0;if(n<=5)bw=(n+1)*5;else if(n<=12)bw=(n-2)*10;else if(n==13)bw=200;else if(n==14)bw=400}
 print rat "|" role "|" channel "|" band "|" pci "|" bw
}
