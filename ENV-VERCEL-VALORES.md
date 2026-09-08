# Variáveis para configurar na Vercel

Configure em Vercel > Project > Settings > Environment Variables.

## SUPABASE_URL

Use a URL base do projeto, sem `/rest/v1/` no final:

```text
https://dxyneyrnykrfywsducwo.supabase.co
```

## SUPABASE_SERVICE_ROLE_KEY

Cole a service role key diretamente no painel da Vercel.

Nunca coloque essa chave em HTML, JavaScript público, GitHub público, Telegram ou README.

```text
[REDACTED]
```

## ADMIN_PIN

Escolha um PIN administrativo para acessar `/admin.html`.

```text
[ESCOLHER_UM_PIN_SEGURO]
```

## Observação de segurança

A chave service_role tem poder administrativo no Supabase. Se ela foi exposta em chat, gere/rotacione uma nova chave quando possível e substitua na Vercel.
