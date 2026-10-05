import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { criarEmpresa } from "@/contas/empresa";
import { db } from "@/db";
import { perfilFiltroVersao, usuario } from "@/db/schema";
import { criteriosSchema } from "@/filtros/criterios";
import { perfilPrincipal, salvarCriterios } from "@/filtros/perfil";
import { limparBanco } from "./util";

describe("perfil de filtros", () => {
  beforeEach(limparBanco);

  it("cada alteração gera nova versão e fica no histórico", async () => {
    await db.insert(usuario).values({ id: "u1", name: "Ana", email: "ana@x.com" });
    const e = await criarEmpresa(db, { usuarioId: "u1", razaoSocial: "Empresa X", cnpj: "88124961000159" });

    const inicial = await perfilPrincipal(db, e.id);
    expect(inicial?.versao).toBe(1);
    expect(inicial?.criterios.status).toEqual(["recebendo_propostas"]);

    const novos = criteriosSchema.parse({ palavras: { incluir: ["pneu"] }, ufs: ["RS"] });
    const salvo = await salvarCriterios(db, e.id, "u1", novos);
    expect(salvo.versao).toBe(2);

    const historico = await db.select().from(perfilFiltroVersao).where(eq(perfilFiltroVersao.perfilId, salvo.id));
    expect(historico.map((h) => h.versao).sort()).toEqual([1, 2]);
    const log = await db.execute<{ n: number }>(sql`select count(*)::int n from log_auditoria where acao = 'perfil_filtro.alterado'`);
    expect(log.rows[0].n).toBe(1);
  });
});
