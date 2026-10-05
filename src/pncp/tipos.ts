// Formatos da API de Consultas do PNCP (RecuperarCompraDTO), conforme a especificação
// oficial em https://pncp.gov.br/api/consulta/v3/api-docs e respostas reais.

export interface OrgaoEntidadePncp {
  cnpj: string;
  razaoSocial: string;
  poderId: string | null;
  esferaId: string | null;
}

export interface UnidadeOrgaoPncp {
  ufNome: string | null;
  ufSigla: string | null;
  municipioNome: string | null;
  codigoIbge: string | null;
  codigoUnidade: string | null;
  nomeUnidade: string | null;
}

export interface FonteOrcamentariaPncp {
  codigo: number;
  nome: string;
  descricao?: string | null;
}

export interface ContratacaoPncp {
  numeroControlePNCP: string;
  anoCompra: number;
  sequencialCompra: number;
  numeroCompra?: string | null;
  processo?: string | null;
  orgaoEntidade: OrgaoEntidadePncp;
  unidadeOrgao: UnidadeOrgaoPncp | null;
  modalidadeId?: number | null;
  modalidadeNome?: string | null;
  modoDisputaId?: number | null;
  modoDisputaNome?: string | null;
  tipoInstrumentoConvocatorioCodigo?: number | null;
  tipoInstrumentoConvocatorioNome?: string | null;
  amparoLegal?: { codigo: number; nome: string; descricao?: string | null } | null;
  situacaoCompraId?: number | null;
  situacaoCompraNome?: string | null;
  objetoCompra?: string | null;
  informacaoComplementar?: string | null;
  valorTotalEstimado?: number | null;
  valorTotalHomologado?: number | null;
  indicadorOrcamentoSigiloso?: string | null;
  srp?: boolean | null;
  fontesOrcamentarias?: FonteOrcamentariaPncp[] | null;
  dataPublicacaoPncp?: string | null;
  dataAberturaProposta?: string | null;
  dataEncerramentoProposta?: string | null;
  dataInclusao?: string | null;
  dataAtualizacao?: string | null;
  dataAtualizacaoGlobal?: string | null;
  linkSistemaOrigem?: string | null;
  linkProcessoEletronico?: string | null;
}

export interface PaginaPncp<T> {
  data: T[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
  paginasRestantes: number;
  empty: boolean;
}

// Item das tabelas de domínio (ex.: /v1/modalidades).
export interface DominioPncp {
  id: number;
  nome: string;
  descricao?: string | null;
  statusAtivo?: boolean;
  [k: string]: unknown;
}
