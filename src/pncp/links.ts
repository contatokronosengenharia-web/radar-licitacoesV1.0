// Página pública da contratação no portal do PNCP (formato ainda a confirmar no primeiro teste real).
export const BASE_LINK_PNCP = "https://pncp.gov.br/app/editais/";

export function linkPncp(orgaoCnpj: string, anoCompra: number, sequencialCompra: number): string {
  return `${BASE_LINK_PNCP}${orgaoCnpj}/${anoCompra}/${sequencialCompra}`;
}
