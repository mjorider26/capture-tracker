#!/bin/sh
# Keep the private health process available through recoverable initialization
# failures. `set -e` made a failing initialization command indistinguishable
# from an entrypoint crash in a managed Container.
set -u

trace_file="/run/clamav/startup-trace"
freshclam_log="/run/clamav/freshclam-startup.log"

record_state() {
  # State values are deliberately finite/sanitized. This file never contains
  # credentials, URLs, document bytes, object keys, or raw scanner output.
  printf '%s=%s\n' "$1" "$2" >> "$trace_file"
}

keep_health_server_alive() {
  # A failed signature update must remain fail-closed but observable through
  # the private health endpoint; it must not turn into a Container crash loop.
  while kill -0 "$server_pid" 2>/dev/null; do
    sleep 60
  done
}

mkdir -p /run/clamav /var/lib/clamav
chown -R clamav:clamav /run/clamav /var/lib/clamav
: > "$trace_file"
record_state CONTAINER_PROCESS PASS
record_state FILESYSTEM PASS

# Cloudflare injects this CA only when HTTPS egress interception is enabled.
# Trust it at runtime so FreshClam can reach the single allowlisted signature
# mirror; local Docker runs simply skip this step.
if test -f /etc/cloudflare/certs/cloudflare-containers-ca.crt; then
  cp /etc/cloudflare/certs/cloudflare-containers-ca.crt /usr/local/share/ca-certificates/cloudflare-containers-ca.crt
  update-ca-certificates
fi
record_state CA_CERTIFICATES PASS
record_state FRESHCLAM_CONFIGURATION PASS

# Cloudflare verifies that the declared port is listening shortly after the
# Container starts. Bind the private health endpoint first, but keep it
# fail-closed (503) until FreshClam and clamd are both actually ready.
python3 /app/scan-server.py &
server_pid="$!"
clamd_pid=""
trap 'test -n "$clamd_pid" && kill "$clamd_pid" 2>/dev/null || true; kill "$server_pid" 2>/dev/null || true; wait "$clamd_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true' EXIT INT TERM
record_state HTTP_PROCESS PASS
record_state HEALTH_BOUND PASS

record_state SIGNATURE_UPDATE ATTEMPTED
if freshclam --config-file=/etc/clamav/freshclam.conf --stdout > "$freshclam_log" 2>&1; then
  record_state SIGNATURE_UPDATE PASS
else
  freshclam_exit="$?"
  printf '%s' "$freshclam_exit" > /run/clamav/freshclam-exit-code
  record_state SIGNATURE_UPDATE FAIL
  keep_health_server_alive
  exit 0
fi

if { test -s /var/lib/clamav/main.cvd || test -s /var/lib/clamav/main.cld; } \
  && { test -s /var/lib/clamav/daily.cvd || test -s /var/lib/clamav/daily.cld; }; then
  record_state SIGNATURE_FILES PASS
else
  record_state SIGNATURE_FILES FAIL
  keep_health_server_alive
  exit 0
fi

clamd --config-file=/etc/clamav/clamd.conf > /run/clamav/clamd-startup.log 2>&1 &
clamd_pid="$!"
printf '%s' "$clamd_pid" > /run/clamav/clamd-launch.pid
record_state CLAMD_PROCESS STARTED

# Keep the private health server alive if clamd exits. It will surface a
# sanitized fail-closed state to the Queue consumer instead of restarting the
# Container and concealing the daemon failure.
keep_health_server_alive
