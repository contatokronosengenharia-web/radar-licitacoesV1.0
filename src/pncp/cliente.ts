import type { ContratacaoPncp, DominioPncp, PaginaPncp } from "./tipos";

// Bases configuráveis para permitir apontar para um servidor de teste.
const BASE_CONSULTA = process.env.PNCP_CONSULTA_URL ?? "https://pncp.gov.br/api/consulta";
const BASE_INTEGRACAO = process.env.PNCP_INTEGRACAO_URL ?? "https://pncp.gov.br/api/pncp";

// A API de Consultas recusa (HTTP 400) páginas acima de 50 registros; testado em 05/10/2026.
export const TAMANHO_PAGINA = Math.min(Number(process.env.PNCP_TAMANHO_PAGINA ?? 50), 50);
const TIMEOUT_MS = Number(process.env.PNCP_TIMEOUT_MS ?? 30_000);

export class ErroPncp extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly repetivel: boolean,
  ) {
    super(message);
    this.name = "ErroPncp";
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "RadarLicitacoes/1.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    throw new ErroPncp(`Falha de rede ao consultar ${url}: ${(e as Error).message}`, null, true);
  }
  // Sem resultados, a API responde 204 ou corpo vazio.
  if (resposta.status === 204) return null;
  if (!resposta.ok) {
    const repetivel = resposta.status === 429 || resposta.status >= 500;
    const corpo = (await resposta.text().catch(() => "")).slice(0, 300);
    throw new ErroPncp(`PNCP respondeu ${resposta.status} em ${url}: ${corpo}`, resposta.status, repetivel);
  }
  const texto = await resposta.text();
  if (!texto.trim()) return null;
  return JSON.parse(texto) as T;
}

export type EndpointContratacoes = "publicacao" | "atualizacao";

export interface ConsultaContratacoes {
  endpoint: EndpointContratacoes;
  dataInicial: string; // AAAAMMDD
  dataFinal: string; // AAAAMMDD
  codigoModalidadeContratacao: number;
  pagina: number;
}

export async function buscarContratacoes(c: ConsultaContratacoes): Promise<PaginaPncp<ContratacaoPncp>> {
  const params = new URLSearchParams({
    dataInicial: c.dataInicial,
    dataFinal: c.dataFinal,
    codigoModalidadeContratacao: String(c.codigoModalidadeContratacao),
    pagina: String(c.pagina),
    tamanhoPagina: String(TAMANHO_PAGINA),
  });
  const pagina = await getJson<PaginaPncp<ContratacaoPncp>>(
    `${BASE_CONSULTA}/v1/contratacoes/${c.endpoint}?${params}`,
  );
  return (
    pagina ?? { data: [], totalRegistros: 0, totalPaginas: 0, numeroPagina: c.pagina, paginasRestantes: 0, empty: true }
  );
}

export async function buscarDominio(caminho: string): Promise<DominioPncp[]> {
  const lista = await getJson<DominioPncp[]>(`${BASE_INTEGRACAO}${caminho}`);
  if (lista && !Array.isArray(lista)) throw new ErroPncp(`Resposta inesperada em ${caminho}`, null, false);
  return lista ?? [];
}
