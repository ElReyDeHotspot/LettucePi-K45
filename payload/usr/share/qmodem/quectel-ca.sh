# Shared QCAINFO parsing for native QModem cell_info and current_band.
quectel_ca_rows() {
    cmd_qcainfo "$at_port" | awk -f "${QMODEM_HOME:-/usr/share/qmodem}/quectel-ca.awk"
}
quectel_merge_nsa_ca() {
    local rows="$1" rat role channel band pci bw
    local lte_channels='' lte_bands='' lte_pcis='' lte_bw=''
    local nr_channels='' nr_bands='' nr_pcis='' nr_bw=''
    while IFS='|' read -r rat role channel band pci bw; do
        case "$rat" in
            LTE)
                lte_channels="${lte_channels:+$lte_channels / }$channel"
                lte_bands="${lte_bands:+$lte_bands / }$band"
                lte_pcis="${lte_pcis:+$lte_pcis / }$pci"
                lte_bw="${lte_bw:+$lte_bw / }$bw"
                ;;
            NR)
                nr_channels="${nr_channels:+$nr_channels / }$channel"
                nr_bands="${nr_bands:+$nr_bands / }$band"
                nr_pcis="${nr_pcis:+$nr_pcis / }$pci"
                nr_bw="${nr_bw:+$nr_bw / }$bw"
                ;;
        esac
    done <<EOF
$rows
EOF
    if [ -n "$lte_channels" ]; then
        endc_lte_earfcn="$lte_channels"; endc_lte_band="$lte_bands"
        endc_lte_physical_cell_id="$lte_pcis"; endc_lte_dl_bandwidth="$lte_bw"
    fi
    if [ -n "$nr_channels" ]; then
        endc_nr_arfcn="$nr_channels"; endc_nr_band="$nr_bands"
        endc_nr_physical_cell_id="$nr_pcis"; endc_nr_dl_bandwidth="$nr_bw"
    fi
}
quectel_current_band_from_ca() {
    local response="$1" rows="$2" rat role channel band pci bw type mode ul scs serving info qchannel code
    [ -n "$rows" ] || return 1
    # Keep QENG as the fallback if the aggregation response has no primary cell.
    printf '%s\n' "$rows" | grep -q '|pcc|' || return 1
    case "$response" in *'"NR5G-NSA"'*) mode='EN-DC';; *'"NR5G-SA"'*) mode='NR5G-SA';; *'"LTE"'*) mode='LTE';; *) return 1;; esac
    json_add_object current_band
    json_add_string vendor "$_Vendor"
    json_add_string status ok
    json_add_string network_mode "$mode"
    json_add_array cells
    while IFS='|' read -r rat role channel band pci bw; do
        [ -n "$channel" ] || continue
        case "$rat" in LTE) type='EARFCN';; NR) type='NR-ARFCN';; *) continue;; esac
        [ "$pci" = '-' ] && pci=''
        [ "$bw" = '-' ] && bw=''
        # Keep QENG-only metadata for the matching serving carrier.
        ul=''; scs=''
        if [ "$rat" = LTE ]; then
            if [ "$mode" = EN-DC ]; then
                info=$(printf '%s\n' "$response" | awk -F, '/\+QENG: "LTE"/ {print $7 "|" $9; exit}')
            else
                info=$(printf '%s\n' "$response" | awk -F, '/\+QENG:/ {print $9 "|" $11; exit}')
            fi
            qchannel=${info%%|*}; code=${info#*|}
            if [ "$qchannel" = "$channel" ]; then ul=$(get_bandwidth LTE "$code"); fi
        else
            if [ "$mode" = EN-DC ]; then
                info=$(printf '%s\n' "$response" | awk -F, '/\+QENG: "NR5G-NSA"/ {print $8 "|" $16; exit}')
            else
                info=$(printf '%s\n' "$response" | awk -F, '/\+QENG:/ {print $10 "|" $16; exit}')
            fi
            qchannel=${info%%|*}; code=$(printf '%s' "${info#*|}" | tr -d '\r')
            if [ "$qchannel" = "$channel" ]; then case "$code" in 0|1|2|3|4|5) scs=$(get_scs "$code");; esac; fi
        fi
        qmodem_add_current_band_cell "$role" "$rat" "$band" "$channel" "$type" "$pci" "$ul" "$bw" "$scs"
    done <<EOF
$rows
EOF
    json_close_array
    json_close_object
    return 0
}
