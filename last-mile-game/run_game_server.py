from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class CleanHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

if __name__ == '__main__':
    os.chdir('/Users/neerajb/AI Games_Dev/last-mile-game')
    server = HTTPServer(('0.0.0.0', 8085), CleanHandler)
    print("Serving game on http://localhost:8085/")
    server.serve_forever()
