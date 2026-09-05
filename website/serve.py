#!/usr/bin/env python3
# הרצה: python3 serve.py  (או python3 serve.py 8082 לפורט אחר) — מדמה cleanUrls של Vercel מקומית
import os
import sys
import http.server


class CleanUrlHandler(http.server.SimpleHTTPRequestHandler):
    """Mirrors Vercel's cleanUrls: extensionless URLs serve the matching .html file."""

    def send_head(self):
        path = self.path.split('?', 1)[0].split('#', 1)[0]

        # 301 the legacy .html URL to its clean form, exactly like production does.
        if path.endswith('.html'):
            base = path[:-10] if path.endswith('/index.html') else path[:-5]
            target = (base or '/') + self.path[len(path):]
            self.send_response(301)
            self.send_header('Location', target)
            self.end_headers()
            return None

        # /properties -> properties.html (only when there is no real file/dir at that path)
        if path != '/' and not path.endswith('/'):
            local = self.translate_path(path)
            if not os.path.exists(local) and os.path.isfile(local + '.html'):
                self.path = path + '.html' + self.path[len(path):]

        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8081
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f'Safe Capital dev server (clean URLs) -> http://localhost:{port}')
    http.server.HTTPServer(('', port), CleanUrlHandler).serve_forever()
