from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.endswith('/models'):
            body = json.dumps({"object": "list", "data": [{"id": "mock/alpha", "owned_by": "mock"}, {"id": "mock/beta", "owned_by": "mock"}]}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()
    def log_message(self, *_):
        pass

HTTPServer(('127.0.0.1', 3999), Handler).serve_forever()
