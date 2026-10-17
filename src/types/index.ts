// Contratos e tipos do aplicativo mobile AutoF Sistema de Gestão

export interface UsuarioMe {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  papel: string;
  papelRotulo: string;
  tenantId: string;
  empresa: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  permissoes: string[];
  plano: string;
}

export interface OficinaDaSessao {
  id: string;
  nome: string;
}

export interface RespostaLogin {
  tokenAcesso: string | null;
  expiraEmSegundos: number;
  usuario: UsuarioMe | null;
  oficinas: OficinaDaSessao[];
}

export interface RespostaPeca {
  id: string;
  codigoInterno: string;
  codigoOem?: string;
  codigosParalelos?: string[];
  gtin?: string;
  descricao: string;
  fabricante?: string;
  linha?: string;
  familia?: string;
  ncm?: string;
  unidade?: string;
  preco: number;
  custoMedio?: number;
  estoqueAtual: number;
  reservado?: number;
  disponivel: number;
  estoqueMinimo?: number;
  abaixoDoMinimo?: boolean;
  localizacao?: string;
  ativo: boolean;
  garantiaDias?: number;
}

export interface RespostaOSResumo {
  id: string;
  numero: number;
  status: string;
  statusRotulo: string;
  tipo?: string;
  prioridade?: string;
  clienteId: string;
  clienteNome: string;
  veiculoId: string;
  placa: string;
  veiculoDescricao: string;
  boxNome?: string;
  servicoPrincipal?: string;
  mecanicoPrincipal?: string;
  tempoPadraoHoras?: number;
  tempoRealHoras?: number;
  valorTotal?: number;
  valorPecas?: number;
  abertaEm?: string;
  previsaoEntrega?: string;
  concluidaEm?: string;
  atrasada?: boolean;
  deGarantia?: boolean;
  aguardandoPeca?: boolean;
  pecasChegaram?: boolean;
  temApontamentoAberto?: boolean;
  versao: number;
}

export interface PerguntaChecklist {
  id: string;
  secao: string;
  pergunta: string;
  critico: boolean;
  ordem: number;
}

export type RespostaChecklistItem = 'ok' | 'atencao' | 'critico' | 'na';

export interface ItemChecklistPreenchido {
  perguntaId: string;
  resposta: RespostaChecklistItem;
  observacao?: string;
}

export type RegiaoAvaria =
  | 'capo'
  | 'teto'
  | 'porta-malas'
  | 'para-choque-dianteiro'
  | 'para-choque-traseiro'
  | 'lateral-esquerda'
  | 'lateral-direita'
  | 'parabrisa'
  | 'vidro-traseiro'
  | 'rodas';

export type TipoAvaria =
  | 'risco'
  | 'amassado'
  | 'trinca'
  | 'pintura'
  | 'falta'
  | 'oxidacao';

export interface AvariaLocal {
  id: string;
  regiao: RegiaoAvaria;
  tipo: TipoAvaria;
  descricao: string;
  localUri?: string;
  fotoUrl?: string;
}

export interface PedidoChecklist {
  tipo: 'entrada' | 'saida';
  km: number;
  nivelCombustivel: number; // 0.00 a 1.00
  observacoes?: string;
  pertences: string[];
  assinaturaUrl: string;
  itens: Array<{
    perguntaId: string;
    resposta: RespostaChecklistItem;
    observacao?: string;
    fotoUrl?: string;
  }>;
  avarias: Array<{
    regiao: string;
    tipo: string;
    descricao: string;
    fotoUrl: string;
  }>;
  confirmarKmMenor?: boolean;
}

export interface RespostaItemChecklist {
  id: string;
  perguntaId: string;
  secao: string;
  pergunta: string;
  resposta: string;
  observacao?: string;
  fotoUrl?: string;
  critico: boolean;
}

export interface RespostaAvariaChecklist {
  id: string;
  regiao: string;
  tipo: string;
  descricao: string;
  fotoUrl: string;
}

export interface RespostaChecklist {
  id: string;
  osId: string;
  tipo: 'entrada' | 'saida';
  km: number;
  nivelCombustivel: number;
  responsavelId?: string;
  observacoes?: string;
  pertences: string[];
  assinaturaUrl: string;
  preenchidoEm: string;
  itens: RespostaItemChecklist[];
  avarias: RespostaAvariaChecklist[];
  pendenciasCriticas: number;
}

export interface UrlDeUpload {
  urlDeEnvio: string;
  caminho: string;
  urlDeLeitura: string;
  expiraEmSegundos: number;
}
