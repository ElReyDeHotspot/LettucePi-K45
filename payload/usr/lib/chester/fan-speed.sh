#!/bin/sh
# PWM output uses the Linux hwmon scale, 0..255. Preserve vendor output until selected.
chester_fan_write_duty() {
 local target duty_node percent duty current
 target="$1"
 duty_node="${target%_enable}"
 [ "$duty_node" != "$target" ] && [ -w "$duty_node" ] || return 1
 percent="$(uci -q get misectel.main.fan_speed_percent)"
 case "$percent" in
  '') duty=100 ;;
  *[!0-9]*) return 1 ;;
  *)
   [ "${#percent}" -le 3 ] && [ "$percent" -ge 20 ] && [ "$percent" -le 100 ] || return 1
   duty=$(( (percent * 255 + 50) / 100 )) ;;
 esac
 current="$(cat "$duty_node" 2>/dev/null)"
 [ "$current" = "$duty" ] && return 0
 printf '%s\n' "$duty" > "$duty_node"
}
