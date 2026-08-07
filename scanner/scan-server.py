import json
import os
import socket
import struct
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MAX_BYTES = 10 * 1024 * 1024
SOCKET = "/run/clamav/clamd.ctl"

def signature_date():
    files = [path for path in Path("/var/lib/clamav").glob("*.cvd")] + [path for path in Path("/var/lib/clamav").glob("*.cld")]
    return int(max(path.stat().st_mtime for path in files)) if files else None

def scan(data):
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client.settimeout(35)
    try:
        client.connect(SOCKET)
        client.sendall(b"zINSTREAM\0")
        for start in range(0, len(data), 65536):
            part = data[start:start + 65536]
            client.sendall(struct.pack("!I", len(part)) + part)
        client.sendall(struct.pack("!I", 0))
        response = client.recv(4096).decode("utf-8", "replace")
    finally:
        client.close()
    # clamd's zINSTREAM protocol is NUL-terminated (for example,
    # "stream: OK\\0"), not line-terminated.
    response = response.rstrip("\x00\r\n")
    if response.endswith(" OK"):
        return "CLEAN"
    if response.endswith(" FOUND"):
        return "INFECTED"
    raise RuntimeError("ClamAV did not return a recognized scan result")

def clamd_ready():
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client.settimeout(2)
    try:
        client.connect(SOCKET)
        client.sendall(b"zPING\0")
        return client.recv(64).rstrip(b"\0\r\n") == b"PONG"
    except OSError:
        return False
    finally:
        client.close()

class Handler(BaseHTTPRequestHandler):
    server_version = "CaptureTrackerDocumentScanner"
    def log_message(self, *_args):
        pass
    def do_GET(self):
        if self.path != "/health":
            self.send_response(404); self.end_headers(); return
        ready = os.path.exists(SOCKET) and signature_date() is not None and clamd_ready()
        self.send_response(200 if ready else 503)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ready": ready, "signatureDate": signature_date()}).encode())
    def do_POST(self):
        if self.path != "/scan":
            self.send_response(404); self.end_headers(); return
        try:
            length = int(self.headers.get("content-length", "0"))
            if length < 1 or length > MAX_BYTES:
                raise ValueError("invalid length")
            payload = self.rfile.read(length)
            if len(payload) != length:
                raise ValueError("incomplete body")
            outcome = scan(payload)
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"outcome": outcome, "signaturesReady": True, "scannerVersion": "clamav"}).encode())
        except Exception:
            self.send_response(503)
            self.send_header("content-type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"outcome":"FAILED","signaturesReady":false}')

ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
