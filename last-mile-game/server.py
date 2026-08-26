import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

class ReuseHTTPServer(HTTPServer):
    allow_reuse_address = True

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    os.chdir('/Users/neerajb/AI Games_Dev/last-mile-game')
    server = ReuseHTTPServer(('127.0.0.1', port), SimpleHTTPRequestHandler)
    print(f"Serving Shiplyp: Last Mile at http://localhost:{port}/")
    server.serve_forever()
