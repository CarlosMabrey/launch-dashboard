#!/usr/bin/env python3
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import datetime

class SnippetHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/':
            self.serve_file('index.html', 'text/html')
        elif parsed_path.path == '/script.js':
            self.serve_file('script.js', 'application/javascript')
        elif parsed_path.path == '/style.css':
            self.serve_file('style.css', 'text/css')
        elif parsed_path.path == '/api/snippets':
            self.load_snippets()
        else:
            self.send_error(404)
    
    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/snippets':
            self.save_snippets()
        else:
            self.send_error(404)
    
    def serve_file(self, filename, content_type):
        try:
            with open(filename, 'rb') as f:
                self.send_response(200)
                self.send_header('Content-type', content_type)
                self.end_headers()
                self.wfile.write(f.read())
        except FileNotFoundError:
            self.send_error(404)
    
    def load_snippets(self):
        try:
            if os.path.exists('saved/graphite_snippets.json'):
                with open('saved/graphite_snippets.json', 'r') as f:
                    snippets = json.load(f)
            else:
                snippets = []
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(snippets).encode())
        except Exception as e:
            self.send_error(500, str(e))
    
    def save_snippets(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            snippets = json.loads(post_data.decode('utf-8'))
            
            os.makedirs('saved', exist_ok=True)
            with open('saved/graphite_snippets.json', 'w') as f:
                json.dump(snippets, f, indent=2)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success"}).encode())
        except Exception as e:
            self.send_error(500, str(e))

if __name__ == '__main__':
    os.makedirs('saved', exist_ok=True)
    server = HTTPServer(('localhost', 8000), SnippetHandler)
    print("Server running at http://localhost:8000")
    server.serve_forever()
