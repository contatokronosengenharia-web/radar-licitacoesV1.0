# Radar de Licitações

SaaS em que cada empresa salva seus filtros uma vez e recebe as contratações do PNCP compatíveis.

Fluxo: **coleta PNCP (centralizada, a cada hora) → armazenamento → deduplicação pelo `numeroControlePNCP` → motor de filtros → oportunidades → relatório no horário de cada empresa → (futuro) WhatsApp**.

A coleta nunca roda por empresa. O relatório usa só o que já está no banco.

## Requisitos

- Node 22+
- PostgreSQL 15+ com a extensão `unaccent` (o Neon já tem)

## Configuração local

```bash
npm install
cp .env.example .env.local      # preencha DATABASE_URL, BETTER_AUTH_SECRET, CRON_SECRET
npm run db:migrate              # cria extensões e tabelas
npm run pncp:sincronizar-dominios   # modalidades, modos de disputa etc. direto do PNCP
npm run dev
```

1. Crie uma conta em http://localhost:3000/cadastro e configure os filtros.
2. Para coletar sem esperar o cron, rode `npm run fila:processar -- --coletar`. Isso abre uma coleta e processa a fila (páginas do PNCP + motor de filtros).
3. Para liberar o painel administrativo (/admin), rode `npm run admin:conceder -- seu@email.com`.

## Testes

```bash
createdb radar_teste
DATABASE_URL=postgres://.../radar_teste npm run db:migrate
npm test          # usa TEST_DATABASE_URL ou postgres://postgres@localhost:5432/radar_teste
npm run typecheck && npm run lint
```

Nos testes, o PNCP é simulado com registros reais salvos em `test/fixtures`.

## Rotas de cron (Vercel Pro)

Os agendamentos ficam em `vercel.json`. Toda rota exige o cabeçalho `Authorization: Bearer $CRON_SECRET`. Sem a variável `CRON_SECRET` configurada, a rota recusa qualquer chamada.

| Rota | Quando | O que faz |
| --- | --- | --- |
| `/api/cron/coletar` | a cada hora | abre a coleta de publicações desde o último sucesso |
| `/api/cron/processar-fila` | a cada minuto | busca as páginas, grava com deduplicação e roda o motor |
| `/api/cron/coletar-atualizacoes` | 1x/dia | revisa as contratações alteradas (revogações, novos prazos) |
| `/api/cron/sincronizar-dominios` | 1x/dia | atualiza as tabelas oficiais do PNCP |
| `/api/cron/gerar-relatorios` | a cada minuto | gera o relatório das empresas cujo horário chegou |

Para testar manualmente:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/coletar
```

## Deploy

1. Crie um banco no Neon e copie as duas URLs:
   - `DATABASE_URL`: com pooler, usada pela aplicação.
   - `DATABASE_URL_UNPOOLED`: conexão direta, usada nas migrações.
2. Na Vercel (plano Pro), importe o repositório e cadastre as variáveis do `.env.example`. Use a URL pública como `BETTER_AUTH_URL`.
3. Rode `npm run db:migrate` apontando para o Neon. Depois chame uma vez a rota `sincronizar-dominios`.

## Relatórios

Cada empresa escolhe hora e fuso em Configurações. O horário seguinte fica gravado em UTC em `empresa.proximo_relatorio_em`; o cron só procura empresas com esse horário vencido.

Na geração (`src/relatorios/gerar.ts`), nada é consultado no PNCP:

1. Pega as oportunidades da empresa que ainda não entraram em nenhum relatório.
2. Reaplica os filtros ativos naquele momento. O que deixou de atender (filtro alterado, prazo encerrado, revogada, descartada pelo usuário) fica marcado como excluído e não volta.
3. Grava `relatorio`, os itens em `relatorio_item` (com um retrato do conteúdo) e uma `entrega` no canal painel.
4. Agenda o próximo horário.

Garantias:
- Um relatório por empresa e horário (índice único em `empresa_id, agendado_para`).
- Uma oportunidade em no máximo um relatório (índice único em `relatorio_item.oportunidade_id`).
- Se o sistema ficar parado, sai um único relatório com tudo e o próximo vai para o horário futuro seguinte.

O histórico fica em /painel/relatorios.

## Ainda não implementado

- WhatsApp, pagamentos, assinatura, cobrança e planos pagos. As tabelas existem só como estrutura preparada.
  Para o WhatsApp, a ideia é criar uma `entrega` com canal `whatsapp` e situação `pendente` para cada relatório e enviar o texto de `montarTextoRelatorio` (`src/relatorios/mensagem.ts`).
