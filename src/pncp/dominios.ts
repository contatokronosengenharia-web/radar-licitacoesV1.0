import { and, eq, notInArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { dominio } from "@/db/schema";
import { buscarDominio } from "./cliente";

// Tabelas oficiais publicadas pela API de integração do PNCP (verificadas em 05/10/2026).
export const DOMINIOS_API: { tipo: string; caminho: string }[] = [
  { tipo: "modalidade", caminho: "/v1/modalidades" },
  { tipo: "modo_disputa", caminho: "/v1/modos-disputas" },
  { tipo: "instrumento_convocatorio", caminho: "/v1/tipos-instrumentos-convocatorios" },
  { tipo: "amparo_legal", caminho: "/v1/amparos-legais" },
  { tipo: "criterio_julgamento", caminho: "/v1/criterios-julgamentos" },
];

// Domínios sem endpoint encontrado: valores do Manual das APIs de Consultas do PNCP
// (e as 27 UFs do IBGE). Códigos novos vistos nos dados entram por descoberta automática.
export const DOMINIOS_MANUAL: { tipo: string; codigo: string; nome: string }[] = [
  { tipo: "situacao_contratacao", codigo: "1", nome: "Divulgada no PNCP" },
  { tipo: "situacao_contratacao", codigo: "2", nome: "Revogada" },
  { tipo: "situacao_contratacao", codigo: "3", nome: "Anulada" },
  { tipo: "situacao_contratacao", codigo: "4", nome: "Suspensa" },
  { tipo: "esfera", codigo: "F", nome: "Federal" },
  { tipo: "esfera", codigo: "E", nome: "Estadual" },
  { tipo: "esfera", codigo: "M", nome: "Municipal" },
  { tipo: "esfera", codigo: "D", nome: "Distrital" },
  { tipo: "poder", codigo: "L", nome: "Legislativo" },
  { tipo: "poder", codigo: "E", nome: "Executivo" },
  { tipo: "poder", codigo: "J", nome: "Judiciário" },
  ...(
    [
      ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"], ["BA", "Bahia"],
      ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"],
      ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"],
      ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"], ["PE", "Pernambuco"], ["PI", "Piauí"],
      ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"], ["RS", "Rio Grande do Sul"],
      ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"], ["SP", "São Paulo"],
      ["SE", "Sergipe"], ["TO", "Tocantins"],
    ] as const
  ).map(([codigo, nome]) => ({ tipo: "uf", codigo, nome })),
];

export interface ResultadoSincronizacao {
  tipo: string;
  recebidos: number;
  inativados: number;
  erro?: string;
}

/** Garante os domínios do manual sem sobrescrever nomes que já existam. */
export async function carregarDominiosManual(db: Db) {
  await db
    .insert(dominio)
    .values(DOMINIOS_MANUAL.map((d) => ({ ...d, origem: "manual_pncp" })))
    .onConflictDoNothing();
}

/** Sincroniza as tabelas oficiais: upsert por (tipo, código); o que sumiu fica inativo. */
export async function sincronizarDominios(db: Db): Promise<ResultadoSincronizacao[]> {
  await carregarDominiosManual(db);
  const resultados: ResultadoSincronizacao[] = [];
  for (const { tipo, caminho } of DOMINIOS_API) {
    try {
      const itens = await buscarDominio(caminho);
      if (itens.length === 0) throw new Error(`Lista vazia em ${caminho}`);
      const agora = new Date();
      await db
        .insert(dominio)
        .values(
          itens.map((i) => ({
            tipo,
            codigo: String(i.id),
            nome: String(i.nome).trim(),
            descricao: i.descricao ?? null,
            ativo: i.statusAtivo ?? true,
            origem: "api_pncp",
            dados: i,
            sincronizadoEm: agora,
          })),
        )
        .onConflictDoUpdate({
          target: [dominio.tipo, dominio.codigo],
          set: {
            nome: sql`excluded.nome`,
            descricao: sql`excluded.descricao`,
            ativo: sql`excluded.ativo`,
            origem: sql`excluded.origem`,
            dados: sql`excluded.dados`,
            sincronizadoEm: sql`excluded.sincronizado_em`,
          },
        });
      // Nunca apagamos: contratações antigas ainda usam códigos que saíram da tabela.
      const inativados = await db
        .update(dominio)
        .set({ ativo: false, sincronizadoEm: agora })
        .where(
          and(
            eq(dominio.tipo, tipo),
            eq(dominio.origem, "api_pncp"),
            notInArray(
              dominio.codigo,
              itens.map((i) => String(i.id)),
            ),
          ),
        )
        .returning({ codigo: dominio.codigo });
      resultados.push({ tipo, recebidos: itens.length, inativados: inativados.length });
    } catch (e) {
      resultados.push({ tipo, recebidos: 0, inativados: 0, erro: (e as Error).message });
    }
  }
  return resultados;
}

/** Modalidades ativas no banco: a coleta percorre esta lista, nunca uma lista fixa. */
export async function modalidadesAtivas(db: Db): Promise<number[]> {
  const linhas = await db
    .select({ codigo: dominio.codigo })
    .from(dominio)
    .where(and(eq(dominio.tipo, "modalidade"), eq(dominio.ativo, true)));
  return linhas.map((l) => Number(l.codigo)).filter(Number.isInteger).sort((a, b) => a - b);
}
