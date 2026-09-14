"""
Serve a local tile folder for `VITE_TILE_BASE`, with the CORS header GitHub
Pages sends. Plain `python -m http.server` will not do: the app loads tiles
with crossorigin set, and without the header the browser refuses them.

    python scripts/serve-tiles.py ../wardogs-maps [port]
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'public, max-age=600')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8787
    server = ThreadingHTTPServer(('0.0.0.0', port), partial(Handler, directory=sys.argv[1]))
    print(f'serving {sys.argv[1]} on http://localhost:{port}')
    server.serve_forever()
