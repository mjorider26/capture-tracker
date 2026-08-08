import json
import os
import socket
import struct
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MAX_BYTES = 10 * 1024 * 1024
SOCKET = "/run/clamav/clamd.ctl"
CLAMD_PID = "/run/clamav/clamd-launch.pid"
CLAMD_LOG = "/run/clamav/clamd-startup.log"
FRESHCLAM_EXIT = "/run/clamav/freshclam-exit-code"
STARTUP_TRACE = "/run/clamav/startup-trace"

def freshclam_failure_reason():
    try:
        with open(FRESHCLAM_EXIT, "r", encoding="ascii") as exit_file:
            code = int(exit_file.read().strip())
        return f"FRESHCLAM_EXIT_{code}" if 1 <= code <= 255 else "FRESHCLAM_FAILED"
    except (OSError, ValueError):
        return None

def clamd_exit_reason():
    try:
        with open(CLAMD_LOG, "r", encoding="utf-8", errors="replace") as log_file:
            output = log_file.read(32_768).lower()
    except OSError:
        return "CLAMD_EXITED"
    if "permission denied" in output:
        return "CLAMD_PERMISSION_DENIED"
    if "no supported database files" in output or "database directory" in output:
        return "CLAMD_DATABASE_UNREADABLE"
    if "not enough memory" in output or "out of memory" in output:
        return "CLAMD_MEMORY_LIMIT"
    if "socket" in output:
        return "CLAMD_SOCKET_FAILURE"
    if "config" in output:
        return "CLAMD_CONFIG_FAILURE"
    return "CLAMD_EXITED"

def clamd_state():
    if not os.path.exists(SOCKET):
        try:
            with open(CLAMD_PID, "r", encoding="ascii") as pid_file:
                os.kill(int(pid_file.read().strip()), 0)
            return "CLAMD_STARTING"
        except (OSError, ValueError):
            return clamd_exit_reason()
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client.settimeout(2)
    try:
        client.connect(SOCKET)
        client.sendall(b"zPING\0")
        return "READY" if client.recv(64).rstrip(b"\0\r\n") == b"PONG" else "CLAMD_UNRESPONSIVE"
    except TimeoutError:
        return "CLAMD_LOADING"
    except OSError:
        return "CLAMD_UNRESPONSIVE"
    finally:
        client.close()

def signature_date():
    files = [path for path in Path("/var/lib/clamav").glob("*.cvd")] + [path for path in Path("/var/lib/clamav").glob("*.cld")]
    return int(max(path.stat().st_mtime for path in files)) if files else None

def startup_trace():
    allowed = {
        "CONTAINER_PROCESS", "FILESYSTEM", "CA_CERTIFICATES",
        "FRESHCLAM_CONFIGURATION", "HTTP_PROCESS", "HEALTH_BOUND",
        "SIGNATURE_UPDATE", "SIGNATURE_FILES", "CLAMD_PROCESS",
    }
    states = {}
    try:
        with open(STARTUP_TRACE, "r", encoding="ascii", errors="ignore") as trace_file:
            for line in trace_file:
                key, sep, value = line.strip().partition("=")
                if sep and key in allowed and value in {"PASS", "FAIL", "ATTEMPTED", "STARTED"}:
                    states[key] = value
    except OSError:
        pass
    return states

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

class Handler(BaseHTTPRequestHandler):
    server_version = "CaptureTrackerDocumentScanner"
    def log_message(self, *_args):
        pass
    def do_GET(self):
        if self.path != "/health":
            self.send_response(404); self.end_headers(); return
        signatures_ready = signature_date() is not None
        freshclam_failure = freshclam_failure_reason()
        daemon_state = clamd_state()
        ready = not freshclam_failure and signatures_ready and daemon_state == "READY"
        reason = None if ready else (freshclam_failure or ("SIGNATURES_MISSING" if not signatures_ready else daemon_state))
        self.send_response(200 if ready else 503)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ready": ready, "signatureDate": signature_date(), "reason": reason, "trace": startup_trace()}).encode())
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
