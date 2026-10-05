import { z } from "zod";

// Formato salvo em perfil_filtro.criterios. Chave ausente ou lista vazia = qualquer valor.
// Os valores das listas são códigos oficiais vindos das tabelas de domínio, nunca fixos aqui.

const listaTexto = z.array(z.string().trim().min(1).max(200)).max(200).default([]);
const listaInt = z.array(z.number().int()).max(500).default([]);

export const STATUS_PRAZO = ["recebendo_propostas", "propostas_encerradas"] as const;
export type StatusPrazo = (typeof STATUS_PRAZO)[number];

export const criteriosSchema = z.object({
  schema: z.literal(1).default(1),
  palavras: z
    .object({
      incluir: listaTexto,
      excluir: listaTexto,
    })
    .default({ incluir: [], excluir: [] }),
  status: z.array(z.enum(STATUS_PRAZO)).default([]),
  situacoes: listaInt,
  modalidades: listaInt,
  modosDisputa: listaInt,
  instrumentos: listaInt,
  orgaos: z.array(z.string().regex(/^\d{14}$/)).max(500).default([]),
  // Unidade = "CNPJ do órgão:código da unidade"
  unidades: z.array(z.string().regex(/^\d{14}:.+$/)).max(500).default([]),
  ufs: z.array(z.string().regex(/^[A-Z]{2}$/)).max(27).default([]),
  municipios: z.array(z.string().regex(/^\d{7}$/)).max(500).default([]),
  esferas: listaTexto,
  poderes: listaTexto,
  amparosLegais: listaInt,
  fontesOrcamentarias: listaInt,
  valor: z
    .object({
      min: z.number().nonnegative().nullable().default(null),
      max: z.number().nonnegative().nullable().default(null),
      incluirSigiloso: z.boolean().default(true),
    })
    .refine((v) => v.min == null || v.max == null || v.min <= v.max, {
      message: "O valor mínimo não pode ser maior que o máximo",
    })
    .default({ min: null, max: null, incluirSigiloso: true }),
  srp: z.boolean().nullable().default(null),
  prazoMinimoDias: z.number().int().min(0).max(365).nullable().default(null),
});

export type Criterios = z.infer<typeof criteriosSchema>;

// Perfil novo: só contratações recebendo propostas, para evitar ruído no primeiro relatório.
export function criteriosPadrao(): Criterios {
  return criteriosSchema.parse({ status: ["recebendo_propostas"] });
}
