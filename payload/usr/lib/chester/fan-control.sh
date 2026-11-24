#!/bin/sh
chester_fan_percent_duty() {
 local percent="$1"
 case "$percent" in
  '') printf '100\n'; return 0 ;;
  *[!0-9]*|0*) return 1 ;;
 esac
 [ "${#percent}" -le 3 ] && [ "$percent" -ge 20 ] && [ "$percent" -le 100 ] || return 1
 printf '%s\n' "$(( (percent * 255 + 50) / 100 ))"
}
chester_fan_auto_state() {
 if [ "$1" -ge "$2" ]; then printf '1\n'
 elif [ "$1" -lt "$(( $2 - 2 ))" ]; then printf '0\n'
 else printf '%s\n' "$3"; fi
}
chester_fan_boost_state() {
 if [ "$1" -ge 85 ]; then printf '1\n'
 elif [ "$1" -le 80 ]; then printf '0\n'
 else printf '%s\n' "$2"; fi
}
chester_fan_output() {
 local target="$1" duty="$2" pwm="${1%_enable}" actual
 [ -w "$target" ] && [ -w "$pwm" ] || return 1
 if [ "$duty" -gt 0 ]; then
  # pwm-fan ignores duty writes while hard-disabled. Enable power first.
  [ "$(cat "$target")" = 1 ] || printf '1\n' > "$target" || return 1
  [ "$(cat "$pwm")" = "$duty" ] || printf '%s\n' "$duty" > "$pwm" || return 1
 else
  [ "$(cat "$pwm")" = 0 ] || printf '0\n' > "$pwm" || return 1
  [ "$(cat "$target")" = 0 ] || printf '0\n' > "$target" || return 1
 fi
 actual="$(cat "$pwm")"
 [ "$actual" = "$duty" ]
}
chester_fan_claim_policy() {
 local zone="$1" record="$2" binding device='' found=0 old
 # Never take ownership of a zone that also controls CPU clocks or another device.
 for binding in "$zone"/cdev[0-9]*; do
  [ -L "$binding" ] || continue
  [ "$(cat "$binding/type" 2>/dev/null)" = pwm-fan ] || return 1
  if [ -n "$device" ]; then [ "$(readlink -f "$binding")" = "$device" ] || return 1
  else device="$(readlink -f "$binding")"; fi
  found=1
 done
 [ "$found" = 1 ] || return 1
 [ "$(cat "$zone/mode" 2>/dev/null)" = enabled ] || return 1
 old="$(cat "$zone/policy")"
 case "$old" in step_wise|bang_bang|fair_share|user_space) ;; *) return 1 ;; esac
 grep -qw user_space "$zone/available_policies" || return 1
 printf '%s %s\n' "$zone" "$old" >> "$record" || return 1
 printf 'user_space\n' > "$zone/policy"
}
chester_fan_restore_policies() {
 local record="$1" zone policy
 [ -f "$record" ] || return 0
 while read -r zone policy; do
  case "$zone" in /sys/class/thermal/thermal_zone[0-9]*) ;; *) continue ;; esac
  case "$policy" in step_wise|bang_bang|fair_share|user_space) ;; *) continue ;; esac
  [ ! -w "$zone/policy" ] || printf '%s\n' "$policy" > "$zone/policy"
 done < "$record"
 rm -f "$record"
}
