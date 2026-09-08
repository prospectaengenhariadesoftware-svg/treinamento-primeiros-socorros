# Engenharia Segura — Primeiros Socorros

Site estático educativo sobre primeiros socorros em ambientes de engenharia, obras, laboratórios, oficinas e indústrias.

## Arquivos

- `index.html` — site completo com HTML, CSS e JavaScript incorporados.
- `package.json` — metadados e scripts opcionais.
- `vercel.json` — configuração para publicar na Vercel.
- `netlify.toml` — configuração para publicar na Netlify.

## Como abrir localmente

Abra diretamente o arquivo:

```bash
xdg-open index.html
```

Ou rode um servidor local:

```bash
python3 -m http.server 8080
```

Depois acesse:

```text
http://localhost:8080
```

## Como publicar

### Vercel

1. Entre em https://vercel.com
2. Crie um novo projeto
3. Faça upload desta pasta ou conecte a um repositório GitHub
4. Framework: `Other`
5. Build command: deixe vazio ou use `npm run build`
6. Output directory: `.`

### Netlify

1. Entre em https://netlify.com
2. Vá em **Add new site** → **Deploy manually**
3. Arraste esta pasta ou o ZIP
4. O site será publicado automaticamente

## Aviso

O conteúdo é educativo e não substitui atendimento médico, treinamento certificado, normas oficiais ou procedimentos internos de segurança.
