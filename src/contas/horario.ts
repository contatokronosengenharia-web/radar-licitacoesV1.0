// Fusos oficiais do Brasil (base IANA). Sem horário de verão desde 2019.
export const FUSOS_BRASIL = [
  { id: "America/Noronha", nome: "Fernando de Noronha (UTC−2)" },
  { id: "America/Sao_Paulo", nome: "Brasília (UTC−3)" },
  { id: "America/Manaus", nome: "Amazonas, MT, MS, RO, RR (UTC−4)" },
  { id: "America/Rio_Branco", nome: "Acre (UTC−5)" },
] as const;

export const FUSO_PADRAO = "America/Sao_Paulo";

export function fusoValido(fuso: string): boolean {
  return FUSOS_BRASIL.some((f) => f.id === fuso);
}

export function horaValida(hora: string): boolean {
  return /^([01]\d|2[0-3]):(00|30)$/.test(hora);
}

function partesLocais(instante: Date, fuso: string) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instante);
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  return { ano: v("year"), mes: v("month"), dia: v("day"), hora: v("hour"), minuto: v("minute") };
}

/** Instante UTC de uma data/hora local no fuso informado. */
function instanteLocal(ano: number, mes: number, dia: number, hora: number, minuto: number, fuso: string): Date {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto);
  const l = partesLocais(new Date(palpite), fuso);
  const deslocamento = Date.UTC(l.ano, l.mes - 1, l.dia, l.hora, l.minuto) - palpite;
  return new Date(palpite - deslocamento);
}

/** Próximo horário de relatório (em UTC) estritamente depois de "agora". */
export function proximoRelatorio(hora: string, fuso: string, agora: Date = new Date()): Date {
  const [h, m] = hora.split(":").map(Number);
  const hoje = partesLocais(agora, fuso);
  let alvo = instanteLocal(hoje.ano, hoje.mes, hoje.dia, h, m, fuso);
  if (alvo <= agora) alvo = new Date(alvo.getTime() + 86_400_000);
  return alvo;
}
