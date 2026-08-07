FROM python:3.13.5-slim-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates clamav clamav-daemon clamav-freshclam \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /run/clamav /var/lib/clamav /app \
  && chown -R clamav:clamav /run/clamav /var/lib/clamav

COPY clamd.conf /etc/clamav/clamd.conf
COPY freshclam.conf /etc/clamav/freshclam.conf
COPY scan-server.py /app/scan-server.py
COPY start-scanner.sh /app/start-scanner.sh

RUN chmod 0755 /app/start-scanner.sh

EXPOSE 8080
ENTRYPOINT ["/app/start-scanner.sh"]
