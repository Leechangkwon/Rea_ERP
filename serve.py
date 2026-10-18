"""Serve only the independent, local demo. Never proxy the original ERP."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent / 'dist'


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def allowed(self):
        target = (ROOT / unquote(urlsplit(self.path).path).lstrip('/')).resolve()
        return target.is_relative_to(ROOT) and (target == ROOT or (target.is_file() and target.suffix in {'.html', '.js', '.css', '.json', '.woff'}))

    def do_GET(self):
        if not self.allowed():
            self.send_error(404)
        else:
            super().do_GET()

    def do_HEAD(self):
        if not self.allowed():
            self.send_error(404)
        else:
            super().do_HEAD()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; img-src 'self' data:; frame-src 'none'; form-action 'none'; base-uri 'none'")
        super().end_headers()


if __name__ == '__main__':
    print('Ecount local menu sample: http://127.0.0.1:8780', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8780), Handler).serve_forever()
