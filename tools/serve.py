# 手元で動かすためのサーバー（python3 tools/serve.py [ポート]）
# ブラウザがファイルを覚えないようにして、書き換えたらすぐ反映されるようにする。
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


class NoCache(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), NoCache) as s:
        print(f'http://localhost:{PORT}')
        s.serve_forever()
