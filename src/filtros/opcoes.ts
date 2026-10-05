import { asc, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { dominio, municipio, orgao } from "@/db/schema";
import type { Criterios } from "./criterios";

export interface Opcao {
  valor: string;
  rotulo: string;
  inativo?: boolean;
}

// Domínios exibidos na tela de filtros, todos lidos da tabela sincronizada com o PNCP.
export const DOMINIOS_FILTRO = [
  "situacao_contratacao",
  "modalidade",
  "modo_disputa",
  "instrumento_convocatorio",
  "esfera",
  "poder",
  "uf",
  "amparo_legal",
  "fonte_orcamentaria",
] as const;
export type TipoDominioFiltro = (typeof DOMINIOS_FILTRO)[number];

export async function opcoesDominios(db: Db): Promise<Record<TipoDominioFiltro, Opcao[]>> {
  const linhas = await db
    .select()
    .from(dominio)
    .where(inArray(dominio.tipo, [...DOMINIOS_FILTRO]))
    .orderBy(asc(dominio.tipo), sql`case when ${dominio.codigo} ~ '^[0-9]+$' then lpad(${dominio.codigo}, 10, '0') else ${dominio.codigo} end`);
  const r = Object.fromEntries(DOMINIOS_FILTRO.map((t) => [t, [] as Opcao[]])) as Record<TipoDominioFiltro, Opcao[]>;
  for (const l of linhas) {
    const rotulo = l.tipo === "uf" ? `${l.codigo} – ${l.nome}` : l.nome;
    r[l.tipo as TipoDominioFiltro].push({ valor: l.codigo, rotulo, inativo: !l.ativo });
  }
  return r;
}

export type TipoBusca = "municipio" | "orgao" | "unidade";

/** Busca por nome para os seletores de município, órgão e unidade (dados vindos das coletas). */
export async function buscarOpcoes(db: Db, tipo: TipoBusca, termo: string, limite = 20): Promise<Opcao[]> {
  const q = `%${termo.trim()}%`;
  if (tipo === "municipio") {
    const r = await db.execute<{ valor: string; rotulo: string }>(sql`
      select codigo_ibge as valor, nome || ' / ' || uf as rotulo from municipio
      where radar_unaccent(nome) ilike radar_unaccent(${q}) or codigo_ibge = ${termo.trim()}
      order by nome limit ${limite}`);
    return r.rows;
  }
  if (tipo === "orgao") {
    const digitos = termo.replace(/\D/g, "");
    const r = await db.execute<{ valor: string; rotulo: string }>(sql`
      select cnpj as valor, razao_social || ' (' || cnpj || ')' as rotulo from orgao
      where radar_unaccent(razao_social) ilike radar_unaccent(${q})
         ${digitos.length >= 4 ? sql`or cnpj like ${`${digitos}%`}` : sql``}
      order by razao_social limit ${limite}`);
    return r.rows;
  }
  const r = await db.execute<{ valor: string; rotulo: string }>(sql`
    select u.orgao_cnpj || ':' || u.codigo_unidade as valor,
           u.nome_unidade || ' – ' || coalesce(o.razao_social, u.orgao_cnpj) as rotulo
    from unidade_orgao u left join orgao o on o.cnpj = u.orgao_cnpj
    where radar_unaccent(u.nome_unidade) ilike radar_unaccent(${q}) or u.codigo_unidade = ${termo.trim()}
    order by u.nome_unidade limit ${limite}`);
  return r.rows;
}

/** Rótulos dos municípios, órgãos e unidades já escolhidos, para mostrar na tela. */
export async function rotulosSelecionados(db: Db, c: Criterios) {
  const municipios = c.municipios.length
    ? await db.select().from(municipio).where(inArray(municipio.codigoIbge, c.municipios))
    : [];
  const orgaos = c.orgaos.length ? await db.select().from(orgao).where(inArray(orgao.cnpj, c.orgaos)) : [];
  const unidades = c.unidades.length
    ? (
        await db.execute<{ valor: string; rotulo: string }>(sql`
          select orgao_cnpj || ':' || codigo_unidade as valor, nome_unidade as rotulo from unidade_orgao
          where orgao_cnpj || ':' || codigo_unidade = any(array(select jsonb_array_elements_text(${JSON.stringify(c.unidades)}::jsonb)))`)
      ).rows
    : [];
  const rotular = (valores: string[], achados: Opcao[]) =>
    valores.map((v) => achados.find((a) => a.valor === v) ?? { valor: v, rotulo: v });
  return {
    municipios: rotular(c.municipios, municipios.map((m) => ({ valor: m.codigoIbge, rotulo: `${m.nome} / ${m.uf}` }))),
    orgaos: rotular(c.orgaos, orgaos.map((o) => ({ valor: o.cnpj, rotulo: `${o.razaoSocial} (${o.cnpj})` }))),
    unidades: rotular(c.unidades, unidades),
  };
}
