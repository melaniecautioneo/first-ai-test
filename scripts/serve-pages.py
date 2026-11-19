#!/usr/bin/env python3
"""Petit serveur qui imite GitHub Pages, pour tester le build localement.

  - sert frontend/dist/client sous /<repo>/
  - renvoie 404.html (avec le code 404) pour toute URL inconnue,
    exactement comme GitHub Pages.

Usage :  python3 scripts/serve-pages.py [port] [base]
"""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist", "client")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
BASE = sys.argv[2] if len(sys.argv) > 2 else "/first-ai-test/"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def translate_path(self, path):
        if path.startswith(BASE):
            path = "/" + path[len(BASE):]
        return super().translate_path(path)

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            fallback = os.path.join(ROOT, "404.html")
            if os.path.exists(fallback):
                body = open(fallback, "rb").read()
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        super().send_error(code, message, explain)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"GitHub Pages simulé : http://localhost:{PORT}{BASE}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
