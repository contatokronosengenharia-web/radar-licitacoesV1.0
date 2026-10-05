// O PNCP devolve datas sem fuso ("2026-10-05T09:00:00"), no horário de Brasília.
// O Brasil não tem horário de verão desde 2019, então o deslocamento é fixo em -03:00.
const OFFSET_BRASILIA = "-03:00";
const FUSO_BRASILIA = "America/Sao_Paulo";

export function parseDataPncp(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const temFuso = /([zZ]|[+-]\d{2}:?\d{2})$/.test(valor);
  const d = new Date(temFuso ? valor : `${valor}${OFFSET_BRASILIA}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Data de hoje (calendário de Brasília) no formato ISO "AAAA-MM-DD". */
export function hojeBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BRASILIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function somarDias(dataIso: string, dias: number): string {
  const d = new Date(`${dataIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diferencaDias(deIso: string, ateIso: string): number {
  const a = Date.parse(`${deIso}T12:00:00Z`);
  const b = Date.parse(`${ateIso}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Lista de dias de inicio até fim, inclusive. */
export function diasEntre(inicioIso: string, fimIso: string): string[] {
  const dias: string[] = [];
  for (let d = inicioIso; d <= fimIso; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

/** "AAAA-MM-DD" → "AAAAMMDD", formato exigido pela API de Consultas. */
export function paraParametroPncp(dataIso: string): string {
  return dataIso.replaceAll("-", "");
}
