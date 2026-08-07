#!/bin/sh
set -eu

# Cloudflare injects this CA only when HTTPS egress interception is enabled.
# Trust it at runtime so FreshClam can reach the single allowlisted signature
# mirror; local Docker runs simply skip this step.
if test -f /etc/cloudflare/certs/cloudflare-containers-ca.crt; then
  cp /etc/cloudflare/certs/cloudflare-containers-ca.crt /usr/local/share/ca-certificates/cloudflare-containers-ca.crt
  update-ca-certificates
fi

freshclam --config-file=/etc/clamav/freshclam.conf --stdout
test -s /var/lib/clamav/main.cvd -o -s /var/lib/clamav/main.cld
test -s /var/lib/clamav/daily.cvd -o -s /var/lib/clamav/daily.cld

clamd --config-file=/etc/clamav/clamd.conf &
clamd_pid="$!"
trap 'kill "$clamd_pid" 2>/dev/null || true; wait "$clamd_pid" 2>/dev/null || true' EXIT INT TERM

until test -S /run/clamav/clamd.ctl; do
  kill -0 "$clamd_pid"
  sleep 1
done

exec python3 /app/scan-server.py
