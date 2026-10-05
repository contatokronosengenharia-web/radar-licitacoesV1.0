CREATE TABLE "conta" (
	"id" text PRIMARY KEY NOT NULL,
	"conta_externa_id" text NOT NULL,
	"provedor" text NOT NULL,
	"usuario_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expira_em" timestamp with time zone,
	"refresh_token_expira_em" timestamp with time zone,
	"escopo" text,
	"senha_hash" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessao" (
	"id" text PRIMARY KEY NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	"usuario_id" text NOT NULL,
	CONSTRAINT "sessao_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"email_verificado" boolean DEFAULT false NOT NULL,
	"imagem" text,
	"admin_plataforma" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificacao" (
	"id" text PRIMARY KEY NOT NULL,
	"identificador" text NOT NULL,
	"valor" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"razao_social" text NOT NULL,
	"cnpj" varchar(14) NOT NULL,
	"telefone" text,
	"fuso_horario" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"hora_relatorio" varchar(5) DEFAULT '08:00' NOT NULL,
	"proximo_relatorio_em" timestamp with time zone,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empresa_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "empresa_usuario" (
	"empresa_id" uuid NOT NULL,
	"usuario_id" text NOT NULL,
	"papel" text DEFAULT 'dono' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empresa_usuario_empresa_id_usuario_id_pk" PRIMARY KEY("empresa_id","usuario_id")
);
--> statement-breakpoint
CREATE TABLE "log_auditoria" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"usuario_id" text,
	"empresa_id" uuid,
	"acao" text NOT NULL,
	"entidade" text,
	"entidade_id" text,
	"dados" jsonb,
	"ip" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contratacao" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"numero_controle_pncp" text NOT NULL,
	"orgao_cnpj" varchar(14) NOT NULL,
	"ano_compra" integer NOT NULL,
	"sequencial_compra" integer NOT NULL,
	"numero_compra" text,
	"processo" text,
	"orgao_razao_social" text,
	"esfera_id" text,
	"poder_id" text,
	"codigo_unidade" text,
	"nome_unidade" text,
	"uf_sigla" varchar(2),
	"codigo_ibge" varchar(7),
	"municipio_nome" text,
	"modalidade_id" integer,
	"modo_disputa_id" integer,
	"instrumento_convocatorio_id" integer,
	"amparo_legal_codigo" integer,
	"situacao_id" integer,
	"objeto_compra" text,
	"informacao_complementar" text,
	"valor_total_estimado" numeric(18, 2),
	"valor_total_homologado" numeric(18, 2),
	"orcamento_sigiloso" text,
	"srp" boolean,
	"fontes_orcamentarias" integer[] DEFAULT '{}' NOT NULL,
	"data_publicacao_pncp" timestamp with time zone,
	"data_abertura_proposta" timestamp with time zone,
	"data_encerramento_proposta" timestamp with time zone,
	"data_inclusao" timestamp with time zone,
	"data_atualizacao" timestamp with time zone,
	"data_atualizacao_global" timestamp with time zone,
	"link_sistema_origem" text,
	"link_processo_eletronico" text,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"busca" "tsvector",
	"primeira_coleta_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ultima_coleta_em" timestamp with time zone DEFAULT now() NOT NULL,
	"motor_processado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dominio" (
	"tipo" text NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"origem" text NOT NULL,
	"dados" jsonb,
	"sincronizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dominio_tipo_codigo_pk" PRIMARY KEY("tipo","codigo")
);
--> statement-breakpoint
CREATE TABLE "municipio" (
	"codigo_ibge" varchar(7) PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"uf" varchar(2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orgao" (
	"cnpj" varchar(14) PRIMARY KEY NOT NULL,
	"razao_social" text NOT NULL,
	"esfera_id" text,
	"poder_id" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unidade_orgao" (
	"id" serial PRIMARY KEY NOT NULL,
	"orgao_cnpj" varchar(14) NOT NULL,
	"codigo_unidade" text NOT NULL,
	"nome_unidade" text NOT NULL,
	"codigo_ibge" varchar(7),
	"uf_sigla" varchar(2),
	"municipio_nome" text
);
--> statement-breakpoint
CREATE TABLE "coleta_controle" (
	"tipo" text PRIMARY KEY NOT NULL,
	"ultima_iniciada_em" timestamp with time zone,
	"ultima_iniciada_execucao_id" bigint,
	"ultima_sucesso_em" timestamp with time zone,
	"ultima_sucesso_execucao_id" bigint,
	"ultima_sucesso_janela_fim" date
);
--> statement-breakpoint
CREATE TABLE "coleta_execucao" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"situacao" text DEFAULT 'em_andamento' NOT NULL,
	"gatilho" text DEFAULT 'cron' NOT NULL,
	"janela_inicio" date NOT NULL,
	"janela_fim" date NOT NULL,
	"iniciada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluida_em" timestamp with time zone,
	"duracao_ms" integer,
	"paginas" integer DEFAULT 0 NOT NULL,
	"registros_recebidos" integer DEFAULT 0 NOT NULL,
	"registros_novos" integer DEFAULT 0 NOT NULL,
	"registros_duplicados" integer DEFAULT 0 NOT NULL,
	"registros_atualizados" integer DEFAULT 0 NOT NULL,
	"erros" integer DEFAULT 0 NOT NULL,
	"erro_detalhe" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarefa" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"parametros" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"situacao" text DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"max_tentativas" integer DEFAULT 5 NOT NULL,
	"executar_apos" timestamp with time zone DEFAULT now() NOT NULL,
	"travada_ate" timestamp with time zone,
	"chave_unica" text,
	"execucao_id" bigint,
	"ultimo_erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluida_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "oportunidade" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"contratacao_id" bigint NOT NULL,
	"encontrada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"relatorio_id" bigint,
	"marcacao" text
);
--> statement-breakpoint
CREATE TABLE "oportunidade_perfil" (
	"oportunidade_id" bigint NOT NULL,
	"perfil_id" uuid NOT NULL,
	"perfil_versao" integer NOT NULL,
	CONSTRAINT "oportunidade_perfil_oportunidade_id_perfil_id_pk" PRIMARY KEY("oportunidade_id","perfil_id")
);
--> statement-breakpoint
CREATE TABLE "perfil_filtro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" text DEFAULT 'Perfil principal' NOT NULL,
	"principal" boolean DEFAULT true NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criterios" jsonb NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perfil_filtro_versao" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"perfil_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	"criterios" jsonb NOT NULL,
	"alterado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assinatura" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"plano_id" text,
	"situacao" text DEFAULT 'teste' NOT NULL,
	"teste_inicio" timestamp with time zone,
	"teste_fim" timestamp with time zone,
	"periodo_inicio" timestamp with time zone,
	"periodo_fim" timestamp with time zone,
	"gateway" text,
	"gateway_cliente_id" text,
	"gateway_assinatura_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canal_contato" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"canal" text NOT NULL,
	"destino" text NOT NULL,
	"consentimento_em" timestamp with time zone,
	"verificado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entrega" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"relatorio_id" bigint NOT NULL,
	"canal" text NOT NULL,
	"destino" text,
	"situacao" text DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"provedor_mensagem_id" text,
	"erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"enviado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plano" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"preco_centavos" integer DEFAULT 0 NOT NULL,
	"periodicidade" text DEFAULT 'mensal' NOT NULL,
	"dias_teste" integer DEFAULT 7 NOT NULL,
	"limite_perfis" integer DEFAULT 1 NOT NULL,
	"limite_usuarios" integer DEFAULT 1 NOT NULL,
	"ativo" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relatorio" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"periodo_inicio" timestamp with time zone,
	"periodo_fim" timestamp with time zone NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"gerado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conta" ADD CONSTRAINT "conta_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresa_usuario" ADD CONSTRAINT "empresa_usuario_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresa_usuario" ADD CONSTRAINT "empresa_usuario_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oportunidade" ADD CONSTRAINT "oportunidade_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oportunidade" ADD CONSTRAINT "oportunidade_contratacao_id_contratacao_id_fk" FOREIGN KEY ("contratacao_id") REFERENCES "public"."contratacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oportunidade_perfil" ADD CONSTRAINT "oportunidade_perfil_oportunidade_id_oportunidade_id_fk" FOREIGN KEY ("oportunidade_id") REFERENCES "public"."oportunidade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oportunidade_perfil" ADD CONSTRAINT "oportunidade_perfil_perfil_id_perfil_filtro_id_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfil_filtro"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perfil_filtro" ADD CONSTRAINT "perfil_filtro_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perfil_filtro_versao" ADD CONSTRAINT "perfil_filtro_versao_perfil_id_perfil_filtro_id_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfil_filtro"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assinatura" ADD CONSTRAINT "assinatura_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assinatura" ADD CONSTRAINT "assinatura_plano_id_plano_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."plano"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canal_contato" ADD CONSTRAINT "canal_contato_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_relatorio_id_relatorio_id_fk" FOREIGN KEY ("relatorio_id") REFERENCES "public"."relatorio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relatorio" ADD CONSTRAINT "relatorio_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conta_usuario_idx" ON "conta" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "sessao_usuario_idx" ON "sessao" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "verificacao_identificador_idx" ON "verificacao" USING btree ("identificador");--> statement-breakpoint
CREATE INDEX "empresa_proximo_relatorio_idx" ON "empresa" USING btree ("proximo_relatorio_em") WHERE "empresa"."ativa";--> statement-breakpoint
CREATE INDEX "empresa_usuario_usuario_idx" ON "empresa_usuario" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "log_auditoria_empresa_idx" ON "log_auditoria" USING btree ("empresa_id","criado_em");--> statement-breakpoint
CREATE INDEX "log_auditoria_acao_idx" ON "log_auditoria" USING btree ("acao","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "contratacao_numero_controle_uk" ON "contratacao" USING btree ("numero_controle_pncp");--> statement-breakpoint
CREATE INDEX "contratacao_motor_pendente_idx" ON "contratacao" USING btree ("id") WHERE "contratacao"."motor_processado_em" is null;--> statement-breakpoint
CREATE INDEX "contratacao_busca_idx" ON "contratacao" USING gin ("busca");--> statement-breakpoint
CREATE INDEX "contratacao_publicacao_idx" ON "contratacao" USING btree ("data_publicacao_pncp");--> statement-breakpoint
CREATE INDEX "contratacao_modalidade_idx" ON "contratacao" USING btree ("modalidade_id");--> statement-breakpoint
CREATE INDEX "contratacao_uf_idx" ON "contratacao" USING btree ("uf_sigla");--> statement-breakpoint
CREATE INDEX "contratacao_municipio_idx" ON "contratacao" USING btree ("codigo_ibge");--> statement-breakpoint
CREATE INDEX "contratacao_orgao_idx" ON "contratacao" USING btree ("orgao_cnpj");--> statement-breakpoint
CREATE INDEX "municipio_uf_idx" ON "municipio" USING btree ("uf");--> statement-breakpoint
CREATE UNIQUE INDEX "unidade_orgao_uk" ON "unidade_orgao" USING btree ("orgao_cnpj","codigo_unidade");--> statement-breakpoint
CREATE INDEX "coleta_execucao_tipo_idx" ON "coleta_execucao" USING btree ("tipo","iniciada_em");--> statement-breakpoint
CREATE UNIQUE INDEX "tarefa_chave_unica_uk" ON "tarefa" USING btree ("chave_unica");--> statement-breakpoint
CREATE INDEX "tarefa_fila_idx" ON "tarefa" USING btree ("executar_apos") WHERE "tarefa"."situacao" = 'pendente';--> statement-breakpoint
CREATE INDEX "tarefa_execucao_idx" ON "tarefa" USING btree ("execucao_id","situacao");--> statement-breakpoint
CREATE UNIQUE INDEX "oportunidade_empresa_contratacao_uk" ON "oportunidade" USING btree ("empresa_id","contratacao_id");--> statement-breakpoint
CREATE INDEX "oportunidade_sem_relatorio_idx" ON "oportunidade" USING btree ("empresa_id") WHERE "oportunidade"."relatorio_id" is null;--> statement-breakpoint
CREATE INDEX "oportunidade_empresa_data_idx" ON "oportunidade" USING btree ("empresa_id","encontrada_em");--> statement-breakpoint
CREATE UNIQUE INDEX "perfil_filtro_principal_uk" ON "perfil_filtro" USING btree ("empresa_id") WHERE "perfil_filtro"."principal";--> statement-breakpoint
CREATE INDEX "perfil_filtro_empresa_idx" ON "perfil_filtro" USING btree ("empresa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "perfil_filtro_versao_uk" ON "perfil_filtro_versao" USING btree ("perfil_id","versao");--> statement-breakpoint
CREATE INDEX "assinatura_empresa_idx" ON "assinatura" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "entrega_relatorio_idx" ON "entrega" USING btree ("relatorio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "relatorio_empresa_periodo_uk" ON "relatorio" USING btree ("empresa_id","periodo_fim");