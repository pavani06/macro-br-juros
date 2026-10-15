/** Third-party data cited on outputs. Not covered by this package's MIT license. */
export type Attribution = {
  provider: string;
  citation: string;
  redistribution: string;
};

const NOT_MIT = 'Dado de terceiro. Não é coberto pela licença MIT deste pacote.';

export const SOURCES = {
  anbima: {
    provider: 'ANBIMA',
    citation:
      'ANBIMA — Estrutura a Termo das Taxas de Juros (ETTJ), parâmetros Nelson-Siegel-Svensson (CZ-down.asp) e taxas indicativas (ms*.txt).',
    redistribution:
      'A ANBIMA pode ser redistribuída publicamente desde que citada. Não é coberta pela licença MIT deste pacote.',
  },
  tesouro: {
    provider: 'Tesouro Transparente',
    citation: 'Tesouro Transparente — Preço e Taxa do Tesouro Direto (PrecoTaxaTesouroDireto).',
    redistribution: NOT_MIT,
  },
  focus: {
    provider: 'BCB Focus',
    citation:
      'Banco Central do Brasil — Expectativas de Mercado (API Olinda, ExpectativasMercadoAnuais, mediana, baseCalculo=0).',
    redistribution: NOT_MIT,
  },
  sgs: {
    provider: 'BCB SGS',
    citation: 'Banco Central do Brasil — SGS 432 (meta para a taxa Selic).',
    redistribution: NOT_MIT,
  },
  cmn: {
    provider: 'CMN',
    citation: 'Conselho Monetário Nacional — meta de inflação (IPCA).',
    redistribution: NOT_MIT,
  },
} as const satisfies Record<string, Attribution>;
