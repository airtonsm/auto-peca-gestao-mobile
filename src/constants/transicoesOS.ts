import { StatusTransicaoInfo } from '../types';

/**
 * Normaliza qualquer variante de status (ex: com hífen, underline ou variações textuais)
 * para a chave canônica correspondente ao enum StatusOS do backend.
 */
export function normalizarChaveStatus(status?: string | null): string {
  if (!status) return '';
  const limpo = status.trim().toLowerCase();

  switch (limpo) {
    case 'diagnostico':
    case 'em_diagnostico':
    case 'em-diagnostico':
      return 'em-diagnostico';
    case 'aguardando_aprovacao':
    case 'aguardando-aprovacao':
    case 'orcamento':
      return 'aguardando-aprovacao';
    case 'aguardando_peca':
    case 'aguardando-peca':
      return 'aguardando-peca';
    case 'em_execucao':
    case 'em-execucao':
      return 'em-execucao';
    case 'cancelado':
    case 'cancelada':
      return 'cancelada';
    default:
      return limpo.replace(/_/g, '-');
  }
}

/**
 * Tabela de metadados de cada status de Ordem de Serviço (conforme StatusOS.java).
 * Contém rótulos amigáveis, descrições para a equipe de oficina, ícones Ionicons e cores.
 */
export const TABELA_STATUS_OS: Record<string, StatusTransicaoInfo> = {
  agendado: {
    chave: 'agendado',
    rotulo: 'Agendado',
    descricao: 'Agendamento confirmado, aguardando chegada do veículo',
    icone: 'calendar-outline',
    cor: '#64748B',
  },
  recebido: {
    chave: 'recebido',
    rotulo: 'Veículo Recebido',
    descricao: 'Veículo entregue na oficina, pronto para triagem ou checklist',
    icone: 'car-outline',
    cor: '#3B82F6',
  },
  'em-diagnostico': {
    chave: 'em-diagnostico',
    rotulo: 'Em Diagnóstico',
    descricao: 'Mecânico avaliando o veículo e identificando reparos necessários',
    icone: 'search-outline',
    cor: '#F97316',
  },
  'aguardando-aprovacao': {
    chave: 'aguardando-aprovacao',
    rotulo: 'Aguardando Aprovação',
    descricao: 'Orçamento gerado e aguardando autorização do cliente',
    icone: 'hourglass-outline',
    cor: '#F59E0B',
  },
  aprovado: {
    chave: 'aprovado',
    rotulo: 'Orçamento Aprovado',
    descricao: 'Serviços e peças autorizados, liberado para execução',
    icone: 'checkmark-circle-outline',
    cor: '#10B981',
  },
  'aguardando-peca': {
    chave: 'aguardando-peca',
    rotulo: 'Aguardando Peça',
    descricao: 'Serviço pausado aguardando chegada de peças solicitadas',
    icone: 'cube-outline',
    cor: '#EAB308',
  },
  'em-execucao': {
    chave: 'em-execucao',
    rotulo: 'Em Execução',
    descricao: 'Mecânico trabalhando ativamente no veículo no box/elevador',
    icone: 'construct-outline',
    cor: '#0284C7',
  },
  pronto: {
    chave: 'pronto',
    rotulo: 'Pronto para Entrega',
    descricao: 'Serviços finalizados, veículo testado e limpo para retirada',
    icone: 'checkmark-done-circle-outline',
    cor: '#22C55E',
  },
  reprovado: {
    chave: 'reprovado',
    rotulo: 'Orçamento Reprovado',
    descricao: 'Orçamento não autorizado pelo cliente ou suspenso',
    icone: 'close-circle-outline',
    cor: '#EF4444',
  },
  entregue: {
    chave: 'entregue',
    rotulo: 'Entregue',
    descricao: 'Veículo retirado pelo cliente e atendimento concluído',
    icone: 'flag-outline',
    cor: '#64748B',
  },
  cancelada: {
    chave: 'cancelada',
    rotulo: 'Cancelada',
    descricao: 'Ordem de serviço cancelada',
    icone: 'ban-outline',
    cor: '#DC2626',
  },
};

/**
 * Tabela de transições válidas a partir de cada status, espelhando fielmente
 * as regras de negócio de StatusOS.java no backend Spring Boot.
 */
export const TRANSIÇÕES_VALIDAS: Record<string, string[]> = {
  agendado: ['recebido', 'cancelada'],
  recebido: ['em-diagnostico', 'aguardando-aprovacao', 'aprovado', 'aguardando-peca', 'cancelada'],
  'em-diagnostico': ['aguardando-aprovacao', 'aprovado', 'aguardando-peca', 'cancelada'],
  'aguardando-aprovacao': ['aprovado', 'reprovado', 'aguardando-peca', 'cancelada'],
  aprovado: ['em-execucao', 'aguardando-peca', 'cancelada'],
  'aguardando-peca': ['em-execucao', 'aprovado', 'cancelada'],
  'em-execucao': ['pronto', 'aguardando-peca', 'aguardando-aprovacao', 'cancelada'],
  pronto: ['entregue', 'em-execucao'],
  reprovado: ['aprovado', 'aguardando-peca'],
  entregue: [],
  cancelada: [],
};

/**
 * Próximo passo natural / recomendado no fluxo da oficina mecânica.
 */
export const PROXIMO_PASSO_NATURAL: Record<string, string> = {
  agendado: 'recebido',
  recebido: 'em-diagnostico',
  'em-diagnostico': 'aguardando-aprovacao',
  'aguardando-aprovacao': 'aprovado',
  aprovado: 'em-execucao',
  'aguardando-peca': 'em-execucao',
  'em-execucao': 'pronto',
  pronto: 'entregue',
  reprovado: 'aprovado',
};

/**
 * Rótulos de ação rápida para o próximo passo natural (ex: no rodapé do card).
 */
export const ROTULOS_ACAO_RAPIDA: Record<string, string> = {
  recebido: 'Iniciar Diagnóstico',
  'em-diagnostico': 'Enviar p/ Aprovação',
  'aguardando-aprovacao': 'Aprovar Orçamento',
  aprovado: 'Iniciar Execução',
  'aguardando-peca': 'Retomar Execução',
  'em-execucao': 'Marcar como Pronto',
  pronto: 'Registrar Entrega',
  agendado: 'Receber Veículo',
};

/**
 * Sugestões contextuais de motivos rápidos para preenchimento ágil pelo mecânico.
 */
export const MOTIVOS_RAPIDOS_POR_STATUS: Record<string, string[]> = {
  'em-execucao': [
    'Iniciando reparo no elevador',
    'Peças chegaram da distribuidora',
    'Retomando execução do serviço',
    'Mecânico alocado no veículo',
  ],
  'aguardando-peca': [
    'Aguardando chegada de peças',
    'Peça em falta no distribuidor',
    'Peça recebida com avaria/troca solicitada',
    'Aguardando cotação de componentes',
  ],
  pronto: [
    'Serviços finalizados e testados',
    'Veículo pronto e lavado',
    'Aprovado em teste de rodagem',
    'Liberado para retirada pelo cliente',
  ],
  'em-diagnostico': [
    'Iniciando diagnóstico eletrônico',
    'Veículo posicionado para teste',
    'Identificando causa da falha',
  ],
  'aguardando-aprovacao': [
    'Orçamento enviado ao cliente',
    'Aguardando retorno do cliente',
    'Acréscimo de serviços solicitado',
  ],
  aprovado: [
    'Cliente autorizou por telefone',
    'Autorizado via WhatsApp',
    'Aprovado no balcão da oficina',
  ],
  reprovado: [
    'Cliente não autorizou o orçamento',
    'Valor não aceito pelo proprietário',
    'Retirada sem reparo',
  ],
  entregue: [
    'Veículo entregue ao proprietário',
    'Retirado por terceiro autorizado',
    'Chaves entregues na recepção',
  ],
  cancelada: [
    'Cancelamento solicitado pelo cliente',
    'Desistência do atendimento',
    'Cadastro duplicado',
  ],
  padrao: [
    'Avanço de etapa do serviço',
    'Atualização de status no pátio',
    'Informado pelo encarregado',
  ],
};

/**
 * Retorna as informações completas de um status a partir de sua chave.
 */
export function obterInfoStatus(status?: string | null): StatusTransicaoInfo {
  const chave = normalizarChaveStatus(status);
  return (
    TABELA_STATUS_OS[chave] || {
      chave: chave || 'desconhecido',
      rotulo: status || 'Desconhecido',
      descricao: 'Status não mapeado',
      icone: 'help-circle-outline',
      cor: '#64748B',
    }
  );
}

/**
 * Retorna a lista de próximas transições válidas a partir do status atual,
 * marcando com destaque=true o próximo passo natural recomendado.
 */
export function obterTransicoesValidas(statusAtual?: string | null): StatusTransicaoInfo[] {
  const chaveAtual = normalizarChaveStatus(statusAtual);
  const chavesValidas = TRANSIÇÕES_VALIDAS[chaveAtual] || [];
  const proximoPasso = PROXIMO_PASSO_NATURAL[chaveAtual];

  return chavesValidas.map((chaveDestino) => {
    const info = obterInfoStatus(chaveDestino);
    return {
      ...info,
      destaque: chaveDestino === proximoPasso,
    };
  });
}

/**
 * Retorna o próximo passo recomendado para ações rápidas no card da OS, se houver.
 */
export function obterProximoPassoRecomendado(statusAtual?: string | null): {
  info: StatusTransicaoInfo;
  rotuloAcao: string;
} | null {
  const chaveAtual = normalizarChaveStatus(statusAtual);
  const proximoChave = PROXIMO_PASSO_NATURAL[chaveAtual];
  if (!proximoChave) return null;

  const info = obterInfoStatus(proximoChave);
  const rotuloAcao = ROTULOS_ACAO_RAPIDA[chaveAtual] || `Mudar para ${info.rotulo}`;
  return { info, rotuloAcao };
}

/**
 * Verifica se um status é estado final (sem novas transições permitidas).
 */
export function isEstadoFinal(status?: string | null): boolean {
  const chave = normalizarChaveStatus(status);
  return chave === 'entregue' || chave === 'cancelada';
}
