// Read-only post-initialization check for the pinned vendor MT7992 driver.
// No EEPROM/eFuse write commands, replacement data or persistent per-unit state.
#include <linux/module.h>
#include <linux/device.h>
#include <linux/pci.h>
#include <linux/skbuff.h>
#include <linux/unaligned.h>

extern int mt76_mcu_send_and_get_msg(void *, int, const void *, int, bool, struct sk_buff **);
static char result[160]="verified=0 reason=not_run";
module_param_string(result,result,sizeof(result),0400);
static const u16 offsets[]={0x44c,0x44d,0x44e,0x44f,0x450,0x451,0x453,0x455,0x457,0x459,0x470,0x471,0xb90,0xb91,0xb94,0xb95,0xba6,0xba8,0xbaa};

static int read_block(void *mdev,u16 offset,u8 *data)
{
 u8 req[20]={0},header[48];
 struct sk_buff *skb=NULL;
 int ret;
 put_unaligned_le16(1,req+4);put_unaligned_le16(16,req+6);
 put_unaligned_le32(offset,req+8);
 // Vendor EEPROM_ACCESS READ request, established from the shipped driver.
 ret=mt76_mcu_send_and_get_msg(mdev,0x13002d,req,sizeof(req),true,&skb);
 if(ret)return ret;
 if(!skb)return -EPROTO;
 ret=skb_copy_bits(skb,0,header,sizeof(header));
 if(!ret){
  if(get_unaligned_le32(header+12)!=offset)ret=-EPROTO;
  else if(!get_unaligned_le32(header+16))ret=-ENODATA;
  else ret=skb_copy_bits(skb,48,data,16);
 }
 consume_skb(skb);
 return ret;
}

static int __init verify_init(void)
{
 struct device *dev;
 u8 *mdev,*active,block[16];
 int ret=0,i,matched=0,blocks=0;
 u16 cached_base=0xffff,base;
 const char *reason="driver_not_ready";
 static_assert(offsetof(struct device,driver_data)==120);
 dev=bus_find_device_by_name(&pci_bus_type,NULL,"0000:01:00.0");
 if(!dev)goto unavailable;
 mdev=dev_get_drvdata(dev);
 if(!mdev)goto release;
 // These layout offsets are allowed only with the pinned vendor module hash.
 reason="unsupported_driver_layout";
 if(*(void **)(mdev+0x848)!=dev || get_unaligned_le16(mdev+0x5e86)!=0x7992)goto release;
 reason="unsupported_radio_variant";
 if(mdev[0xe511]!=0x11)goto release;
 active=*(u8 **)(mdev+0x5eb8);
 reason="active_eeprom_unavailable";
 if(!active)goto release;
 for(i=0;i<ARRAY_SIZE(offsets);i++){
  base=offsets[i]&~15;
  if(base!=cached_base){
   ret=read_block(mdev,base,block);
   reason=ret==-ENODATA?"efuse_block_not_programmed":"efuse_read_unavailable";
   if(ret)goto release;
   cached_base=base;blocks++;
  }
  if(active[offsets[i]]!=block[offsets[i]&15]){
   reason="active_override_mismatch";goto release;
  }
  matched++;
 }
 snprintf(result,sizeof(result),"verified=1 matched=%d total=%zu blocks=%d",matched,ARRAY_SIZE(offsets),blocks);
 pr_info("Wi-Fi: eFuse calibration verified (%d/%zu override bytes match active EEPROM)\n",matched,ARRAY_SIZE(offsets));
 put_device(dev);
 return 0;
release:
 put_device(dev);
unavailable:
 snprintf(result,sizeof(result),"verified=0 reason=%s matched=%d total=%zu blocks=%d error=%d",reason,matched,ARRAY_SIZE(offsets),blocks,ret);
 pr_info("Wi-Fi: eFuse calibration verification unavailable (%s); calibration unchanged\n",reason);
 return 0;
}
static void __exit verify_exit(void){}
module_init(verify_init);module_exit(verify_exit);
MODULE_LICENSE("GPL");
MODULE_DESCRIPTION("One-shot read-only vendor MT7992 calibration verification");
