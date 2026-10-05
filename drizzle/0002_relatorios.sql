CREATE TABLE "relatorio_item" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"relatorio_id" bigint NOT NULL,
	"oportunidade_id" bigint NOT NULL,
	"perfil_id" uuid,
	"posicao" integer NOT NULL,
	"resumo" jsonb NOT NULL
);
--> statement-breakpoint
DROP INDEX "relatorio_empresa_periodo_uk";--> statement-breakpoint
DROP INDEX "oportunidade_sem_relatorio_idx";--> statement-breakpoint
ALTER TABLE "relatorio" ALTER COLUMN "periodo_inicio" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oportunidade" ADD COLUMN "excluida_relatorio_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "relatorio" ADD COLUMN "agendado_para" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "relatorio" ADD COLUMN "fuso_horario" text NOT NULL;--> statement-breakpoint
ALTER TABLE "relatorio" ADD COLUMN "hora_relatorio" text NOT NULL;--> statement-breakpoint
ALTER TABLE "relatorio" ADD COLUMN "excluidas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "relatorio" ADD COLUMN "perfis" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "relatorio_item" ADD CONSTRAINT "relatorio_item_relatorio_id_relatorio_id_fk" FOREIGN KEY ("relatorio_id") REFERENCES "public"."relatorio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relatorio_item" ADD CONSTRAINT "relatorio_item_oportunidade_id_oportunidade_id_fk" FOREIGN KEY ("oportunidade_id") REFERENCES "public"."oportunidade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relatorio_item" ADD CONSTRAINT "relatorio_item_perfil_id_perfil_filtro_id_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfil_filtro"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "relatorio_item_oportunidade_uk" ON "relatorio_item" USING btree ("oportunidade_id");--> statement-breakpoint
CREATE INDEX "relatorio_item_relatorio_idx" ON "relatorio_item" USING btree ("relatorio_id","posicao");--> statement-breakpoint
CREATE UNIQUE INDEX "entrega_relatorio_canal_uk" ON "entrega" USING btree ("relatorio_id","canal");--> statement-breakpoint
CREATE INDEX "entrega_pendente_idx" ON "entrega" USING btree ("canal","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "relatorio_empresa_agendado_uk" ON "relatorio" USING btree ("empresa_id","agendado_para");--> statement-breakpoint
CREATE INDEX "relatorio_empresa_gerado_idx" ON "relatorio" USING btree ("empresa_id","gerado_em");--> statement-breakpoint
CREATE INDEX "oportunidade_sem_relatorio_idx" ON "oportunidade" USING btree ("empresa_id") WHERE "oportunidade"."relatorio_id" is null and "oportunidade"."excluida_relatorio_em" is null;