#!/usr/bin/env python3
"""DotStudio POS — native desktop launcher (pywebview + local HTTP server)."""
import os
import sys
import threading
import functools
import http.server
import socketserver
import webbrowser

BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def find_free_port(start=8756):
    import socket
    for port in range(start, start + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start


def start_server(port):
    handler = functools.partial(QuietHandler, directory=BASE_DIR)
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    httpd.allow_reuse_address = True
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def main():
    port = find_free_port()
    start_server(port)
    url = "http://127.0.0.1:%d/index.html" % port
    try:
        import webview
        window = webview.create_window(
            "DotStudio POS",
            url,
            width=1400,
            height=900,
            min_size=(1024, 700),
            background_color="#0a0a0b",
        )
        webview.start()
    except Exception as e:
        sys.stderr.write("pywebview failed: %s\n" % e)
        webbrowser.open(url)
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
