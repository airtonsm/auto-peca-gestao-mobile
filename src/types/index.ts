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

export interface RespostaItemServicoOS {
  id: string;
  servicoId?: string;
  mecanicoId?: string;
  mecanicoNome?: string;
  descricao: string;
  tempoPadraoHoras?: number;
  tempoRealHoras?: number;
  valor: number;
  status?: string;
  garantiaDias: number;
  garantiaAte?: string;
  naGarantia?: boolean;
  ordem: number;
}

export interface RespostaOSCompleta extends RespostaOSResumo {
  kmEntrada?: number;
  queixaCliente?: string;
  diagnostico?: string;
  observacoes?: string;
  desconto?: number;
  formaPagamento?: string;
  autorizacaoCartao?: string;
  aprovadaEm?: string;
  iniciadaEm?: string;
  entregueEm?: string;
  valorServicos?: number;
  itens?: RespostaItemServicoOS[];
}

// ============================================================================
// Tipos para Transição e Mudança de Status da OS (ControladorOrdemServico.java)
// ============================================================================

export interface PedidoTransicaoStatusOS {
  status: string;
  versao: number;
  motivo?: string;
  boxId?: string | null;
}

export interface StatusTransicaoInfo {
  chave: string;
  rotulo: string;
  descricao: string;
  icone: string;
  cor: string;
  destaque?: boolean;
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

export interface RespostaItemPecaOS {
  id: string;
  osId: string;
  pecaId: string;
  codigoInterno: string;
  descricao: string;
  quantidade: number;
  custoUnitario?: number;
  precoUnitario: number;
  desconto: number;
  total: number;
  status: 'reservado' | 'aguardando' | 'aplicado' | 'cancelado' | string;
  garantiaAte?: string;
  ordem: number;
  sugerirAguardandoPeca: boolean;
  localizacao?: string; // Prateleira/corredor
  unidade?: string;     // un, l, kg, etc.
}

export interface PedidoItemPecaOS {
  pecaId: string;
  quantidade: number;
  precoUnitario?: number | null;
  desconto?: number | null;
}

export interface PedidoQuantidadeItemPecaOS {
  quantidade: number;
}

// ============================================================================
// Tipos para Comunicação e Envio de WhatsApp da OS (ControladorComunicacao.java)
// ============================================================================

export interface ContatoDaOS {
  id: string;
  nome: string;
  cargo?: string;
  telefoneExibicao: string;
  principal: boolean;
}

export interface RespostaConversaDaOS {
  osId: string;
  osNumero: number;
  clienteId: string;
  clienteNome: string;
  contatos: ContatoDaOS[];
  contatoId?: string;
  escolhaLembrada: boolean;
  conversa?: {
    id: string;
    canal: string;
    identificador: string;
    status: string;
    janelaAberta: boolean;
    segundosRestantes: number;
  };
}

export interface PedidoEnvioMensagemOS {
  clienteId: string;
  contatoId?: string;
  osId: string;
  canal: string;
  corpo: string;
  templateId?: string | null;
}

export interface RespostaTemplate {
  id: string;
  nome: string;
  gatilho: string;
  canal: string;
  categoria: string;
  categoriaAprovada?: string;
  statusAprovacao: 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | string;
  aprovadoNoProvedor: boolean;
  ativo: boolean;
  referenciaProvedor?: string;
}

// ============================================================================
// Tipos para Abertura de Nova OS, Veículos, Clientes e Boxes
// ============================================================================

export interface RespostaVeiculo {
  id: string;
  clienteId: string;
  clienteNome: string;
  placa: string;
  marca?: string;
  modelo?: string;
  versao?: string;
  descricao: string;
  anoFabricacao?: number;
  anoModelo?: number;
  cor?: string;
  kmAtual: number;
  observacoes?: string;
  ativo: boolean;
}

export interface PedidoCriarVeiculo {
  clienteId: string;
  placa: string;
  marca?: string;
  modelo?: string;
  versao?: string;
  anoFabricacao?: number;
  anoModelo?: number;
  cor?: string;
  kmAtual?: number;
  observacoes?: string;
}

export interface RespostaCliente {
  id: string;
  nome: string;
  documento?: string;
  telefone?: string;
  email?: string;
  tipo?: 'pf' | 'pj' | string;
  ativo?: boolean;
}

export interface PedidoCriarCliente {
  tipo: 'pf' | 'pj';
  nome: string;
  documento?: string;
  contatos?: {
    nome: string;
    telefone: string;
    whatsapp: boolean;
    principal: boolean;
  }[];
}

export interface RespostaBox {
  id: string;
  nome: string;
  tipo?: string;
  ativo: boolean;
}

export interface PedidoCriarOS {
  clienteId: string;
  veiculoId: string;
  tipo?: string;
  prioridade?: string;
  boxId?: string | null;
  kmEntrada?: number | null;
  queixaCliente?: string;
  diagnostico?: string;
  observacoes?: string;
  status: 'recebido' | 'agendado';
  confirmarKmMenor?: boolean;
}

// ============================================================================
// Tipos para Gestão e Cadastro de Usuários da Oficina (ControladorUsuario.java)
// ============================================================================

export interface OpcaoUsuario {
  chave: string;
  rotulo: string;
  descricao?: string;
}

export interface OpcoesDeUsuario {
  papeis: OpcaoUsuario[];
  permissoes: OpcaoUsuario[];
}

export interface PedidoUsuario {
  nome: string;
  email: string;
  telefone?: string;
  papel: string;
  permissoesExtras?: string[];
  permissoesRemovidas?: string[];
  ativo?: boolean;
  mecanicoId?: string | null;
}

export interface RespostaUsuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  papel: string;
  papelRotulo: string;
  permissoesExtras?: string[];
  permissoesRemovidas?: string[];
  permissoesEfetivas?: string[];
  ativo: boolean;
  ultimoAcessoEm?: string;
  deveTrocarSenha?: boolean;
  mecanicoId?: string | null;
  criadoEm?: string;
  senhaInicial?: string;
}

