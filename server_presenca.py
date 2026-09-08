#!/usr/bin/env python3
import json, os, mimetypes
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'presencas-primeiros-socorros.json'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _send_json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.split('?',1)[0] == '/api/presenca':
            if DATA.exists():
                try: obj = json.loads(DATA.read_text(encoding='utf-8'))
                except Exception: obj = []
            else: obj = []
            return self._send_json(obj)
        return super().do_GET()

    def do_POST(self):
        if self.path.split('?',1)[0] != '/api/presenca':
            self.send_error(404); return
        length = int(self.headers.get('Content-Length','0') or 0)
        raw = self.rfile.read(length)
        try:
            item = json.loads(raw.decode('utf-8'))
            nome = str(item.get('nome','')).strip()
            cpf = str(item.get('cpf','')).strip()
            assinatura = str(item.get('assinatura','')).strip()
            if len(nome) < 5 or len(cpf) < 11 or not assinatura.startswith('data:image/png;base64,'):
                return self._send_json({'error':'dados inválidos'}, 400)
            current = json.loads(DATA.read_text(encoding='utf-8')) if DATA.exists() else []
            # evita duplicidade simples por CPF
            current = [p for p in current if str(p.get('cpf')) != cpf]
            current.append({'nome': nome, 'cpf': cpf, 'assinatura': assinatura, 'created_at': item.get('created_at','')})
            DATA.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding='utf-8')
            return self._send_json(current)
        except Exception as e:
            return self._send_json({'error': str(e)}, 400)

if __name__ == '__main__':
    port = int(os.environ.get('PORT','8091'))
    print(f'Servindo {ROOT} em http://127.0.0.1:{port}/treinamento-primeiros-socorros-presenca.html', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
