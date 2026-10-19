import { Linking, Alert } from 'react-native';
import {
  RespostaOSResumo,
  RespostaOSCompleta,
  RespostaChecklist,
  RespostaItemPecaOS,
} from '../types';
import { REGIOES_AVARIA, TIPOS_AVARIA } from '../constants';

/**
 * Sanitiza e normaliza o número de telefone para o padrão exigido pelo WhatsApp (apenas dígitos com DDI).
 * Se for um número brasileiro sem DDI (10 ou 11 dígitos), adiciona automaticamente o DDI 55.
 */
export const sanitizarTelefoneWhatsApp = (telefone: string): string => {
  if (!telefone) return '';

  let digitos = telefone.replace(/\D/g, '');

  // Remove zero à esquerda caso inserido (ex: 011988887777 -> 11988887777)
  if (digitos.startsWith('0')) {
    digitos = digitos.substring(1);
  }

  // Se tem 10 dígitos (DDD + 8 dígitos) ou 11 dígitos (DDD + 9 dígitos), adiciona DDI Brasil (55)
  if (digitos.length === 10 || digitos.length === 11) {
    digitos = `55${digitos}`;
  }

  return digitos;
};

interface GerarTextoLaudoParams {
  os: RespostaOSResumo;
  checklist: RespostaChecklist;
  nomeOficina?: string;
}

/**
 * Gera o texto do laudo de vistoria formatado com emojis e destaques Markdown para WhatsApp.
 */
export const gerarTextoLaudoChecklist = ({
  os,
  checklist,
  nomeOficina = 'Auto Peça & Oficina',
}: GerarTextoLaudoParams): string => {
  const clienteNome = os.clienteNome?.trim() || 'Cliente';
  const veiculoDescricao = os.veiculoDescricao?.trim() || 'Veículo';
  const placa = os.placa?.trim() || '';
  const osNumero = os.numero;

  const ehSaida = checklist.tipo === 'saida';
  const tipoVistoriaRotulo = ehSaida ? 'Saída (Entrega)' : 'Entrada (Recepção)';

  // Formatação de data e hora
  let dataHoraFormatada = '';
  if (checklist.preenchidoEm) {
    try {
      const data = new Date(checklist.preenchidoEm);
      if (!isNaN(data.getTime())) {
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        const hora = String(data.getHours()).padStart(2, '0');
        const minuto = String(data.getMinutes()).padStart(2, '0');
        dataHoraFormatada = `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
      }
    } catch {
      dataHoraFormatada = checklist.preenchidoEm;
    }
  }

  if (!dataHoraFormatada) {
    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    const hora = String(agora.getHours()).padStart(2, '0');
    const minuto = String(agora.getMinutes()).padStart(2, '0');
    dataHoraFormatada = `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
  }

  const kmTexto =
    typeof checklist.km === 'number'
      ? checklist.km.toLocaleString('pt-BR')
      : String(checklist.km || 0);

  const combustivelPct = Math.round((checklist.nivelCombustivel ?? 0) * 100);

  const pertencesTexto =
    checklist.pertences && checklist.pertences.length > 0
      ? checklist.pertences.join(', ')
      : 'Nenhum pertence informado';

  // Formatação da seção de avarias
  let secaoAvarias = '';
  if (checklist.avarias && checklist.avarias.length > 0) {
    const avariasFormatadas = checklist.avarias.map((av) => {
      const regiaoRotulo =
        REGIOES_AVARIA.find((r) => r.id === av.regiao)?.rotulo || av.regiao;
      const tipoRotulo =
        TIPOS_AVARIA.find((t) => t.id === av.tipo)?.rotulo || av.tipo;
      const desc = av.descricao ? ` — ${av.descricao}` : '';
      return `• *${regiaoRotulo}:* ${tipoRotulo}${desc}`;
    });
    secaoAvarias = `⚠️ *Avarias Registradas (${checklist.avarias.length}):*\n${avariasFormatadas.join('\n')}`;
  } else {
    secaoAvarias = '✅ *Avarias:* Nenhuma avaria prévia registrada.';
  }

  // Formatação da seção de itens críticos e de segurança
  const itensComApontamento =
    checklist.itens?.filter(
      (it) => it.resposta === 'critico' || it.resposta === 'atencao'
    ) || [];

  let secaoItensSeguranca = '';
  if (itensComApontamento.length > 0) {
    const itensFormatados = itensComApontamento.map((item) => {
      const respRotulo =
        item.resposta === 'critico' ? '❌ Crítico' : '⚠️ Atenção';
      const obs = item.observacao ? ` — ${item.observacao}` : '';
      return `• ${item.pergunta}: ${respRotulo}${obs}`;
    });
    secaoItensSeguranca = `🔍 *Apontamentos Técnicos e Segurança:*\n${itensFormatados.join('\n')}`;
  } else {
    secaoItensSeguranca =
      '✅ *Itens de Inspeção:* Todos os itens inspecionados em conformidade.';
  }

  // Observações gerais adicionais
  const secaoObservacoes = checklist.observacoes?.trim()
    ? `\n📝 *Observações:* ${checklist.observacoes.trim()}\n`
    : '';

  // Mensagem inicial de acordo com entrada ou saída
  const introducao = ehSaida
    ? `Olá, *${clienteNome}*! 👋\nSeu veículo *${veiculoDescricao}* (Placa *${placa}*) concluiu a manutenção na *${nomeOficina}*. Segue o laudo de vistoria de entrega:`
    : `Olá, *${clienteNome}*! 👋\nRecebemos o seu veículo *${veiculoDescricao}* (Placa *${placa}*) na *${nomeOficina}*.`;

  const rodape = ehSaida
    ? `✍️ _Vistoria de entrega conferida e assinada digitalmente._\nAgradecemos a confiança e preferência!`
    : `✍️ _Vistoria conferida e assinada digitalmente na recepção do pátio._\nAssim que tivermos o diagnóstico técnico completo, entraremos em contato por aqui!`;

  return `${introducao}

📋 *Ordem de Serviço:* #${osNumero}
🗓️ *Vistoria:* ${tipoVistoriaRotulo} — ${dataHoraFormatada}
🚗 *Odômetro:* ${kmTexto} km
⛽ *Nível de Combustível:* ${combustivelPct}%
🧰 *Pertences no Veículo:* ${pertencesTexto}
${secaoObservacoes}
${secaoAvarias}

${secaoItensSeguranca}

${rodape}`.trim();
};

/**
 * Abre diretamente o aplicativo WhatsApp do celular do usuário (ou fallback para wa.me no navegador).
 */
export const abrirWhatsAppDireto = async (
  telefone: string,
  mensagem: string
): Promise<boolean> => {
  const numeroSanitizado = sanitizarTelefoneWhatsApp(telefone);
  if (!numeroSanitizado) {
    Alert.alert(
      'Telefone Inválido',
      'Por favor, informe um número de telefone com DDD válido para envio do WhatsApp.'
    );
    return false;
  }

  const textoCodificado = encodeURIComponent(mensagem);
  const appUrl = `whatsapp://send?phone=${numeroSanitizado}&text=${textoCodificado}`;
  const webUrl = `https://wa.me/${numeroSanitizado}?text=${textoCodificado}`;

  try {
    const podeAbrir = await Linking.canOpenURL(appUrl);
    if (podeAbrir) {
      await Linking.openURL(appUrl);
      return true;
    }
  } catch (err) {
    console.warn('[WhatsApp] Falha ao tentar whatsapp://, tentando wa.me:', err);
  }

  try {
    await Linking.openURL(webUrl);
    return true;
  } catch (err) {
    console.error('[WhatsApp] Falha ao abrir link wa.me:', err);
    Alert.alert(
      'Erro ao Abrir WhatsApp',
      'Não foi possível abrir o WhatsApp no seu smartphone.'
    );
    return false;
  }
};

export const ROTULO_PAGAMENTO: Record<string, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  debito: 'Cartão de Débito',
  credito: 'Cartão de Crédito',
  'credito-parcelado': 'Crédito Parcelado',
  boleto: 'Boleto Bancário',
  faturado: 'Faturado (Frota)',
};

/**
 * Decide a versão padrão do documento (Orçamento vs Ordem de Serviço) a partir do status,
 * reproduzindo exatamente o comportamento de imprimir-os.ts da versão Web.
 */
export const decidirVersaoOS = (status: string): 'orcamento' | 'os' => {
  switch (status) {
    case 'agendado':
    case 'recebido':
    case 'em-diagnostico':
    case 'aguardando-aprovacao':
    case 'reprovado':
      return 'orcamento';
    default:
      return 'os';
  }
};

export interface GerarTextoImpressaoOSParams {
  os: RespostaOSCompleta;
  pecas?: RespostaItemPecaOS[];
  versao?: 'orcamento' | 'os';
  nomeOficina?: string;
}

/**
 * Gera o texto do documento oficial de Impressão da OS (Orçamento ou Ordem de Serviço)
 * formatado com emojis, quebras e destaques para envio ao cliente via WhatsApp.
 */
export const gerarTextoImpressaoOSParaWhatsApp = ({
  os,
  pecas = [],
  versao,
  nomeOficina = 'Auto Peça & Oficina',
}: GerarTextoImpressaoOSParams): string => {
  const versaoEfetiva = versao || decidirVersaoOS(os.status || '');
  const ehOrcamento = versaoEfetiva === 'orcamento';
  const tipoTitulo = ehOrcamento ? 'ORÇAMENTO' : 'ORDEM DE SERVIÇO';

  const clienteNome = os.clienteNome?.trim() || 'Cliente';
  const veiculoDescricao = os.veiculoDescricao?.trim() || 'Veículo';
  const placa = os.placa?.trim() || '';
  const numero = os.numero;
  const statusRotulo = os.statusRotulo || os.status || 'Ativo';

  // Formatação de datas
  const formatarData = (dataStr?: string) => {
    if (!dataStr) return '—';
    try {
      const d = new Date(dataStr);
      if (isNaN(d.getTime())) return dataStr;
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      const hora = String(d.getHours()).padStart(2, '0');
      const minuto = String(d.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
    } catch {
      return dataStr;
    }
  };

  const abertaEm = formatarData(os.abertaEm);
  const previsaoEntrega = formatarData(os.previsaoEntrega);
  const kmEntrada =
    typeof os.kmEntrada === 'number'
      ? `${os.kmEntrada.toLocaleString('pt-BR')} km`
      : '—';
  const formaPgto = os.formaPagamento
    ? ROTULO_PAGAMENTO[os.formaPagamento] || os.formaPagamento
    : null;

  // Queixa do cliente e Diagnóstico
  const queixa = os.queixaCliente?.trim()
    ? `🗣️ *Queixa do Cliente:*\n${os.queixaCliente.trim()}\n\n`
    : '';
  const diagnostico = os.diagnostico?.trim()
    ? `🔍 *Diagnóstico Técnico:*\n${os.diagnostico.trim()}\n\n`
    : '';

  // Lista de Serviços
  const servicos = os.itens || [];
  let secaoServicos = '';
  if (servicos.length > 0) {
    const linhasServicos = servicos.map((item, idx) => {
      const mecanico = item.mecanicoNome ? ` (Mecânico: ${item.mecanicoNome})` : '';
      const garantia = item.garantiaDias ? ` [Garantia: ${item.garantiaDias} dias]` : '';
      const val = (item.valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      return `  ${idx + 1}. *${item.descricao}*${mecanico}\n     Garantia: ${item.garantiaDias || 90} dias | Valor: ${val}`;
    });
    secaoServicos = `🔧 *SERVIÇOS EXECUTADOS / ORÇADOS (${servicos.length}):*\n${linhasServicos.join('\n')}\n\n`;
  } else {
    secaoServicos = '🔧 *SERVIÇOS:* Nenhum serviço lançado no momento.\n\n';
  }

  // Lista de Peças (excluindo canceladas)
  const pecasValidas = pecas.filter(
    (p) => p.status !== 'cancelado' && p.status !== 'cancelada'
  );
  let secaoPecas = '';
  if (pecasValidas.length > 0) {
    const linhasPecas = pecasValidas.map((item, idx) => {
      const cod = item.codigoInterno ? `[${item.codigoInterno}] ` : '';
      const qtd = `${item.quantidade} ${item.unidade || 'UN'}`;
      const unit = (item.precoUnitario || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      const tot = (item.total || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      return `  ${idx + 1}. *${cod}${item.descricao}*\n     Qtd: ${qtd} x ${unit} = *${tot}*`;
    });
    secaoPecas = `🔩 *PEÇAS E MATERIAIS (${pecasValidas.length}):*\n${linhasPecas.join('\n')}\n\n`;
  } else {
    secaoPecas = '🔩 *PEÇAS:* Nenhuma peça aplicada ou orçada.\n\n';
  }

  // Totais financeiros
  const totalServicos =
    os.valorServicos ??
    servicos.reduce((soma, it) => soma + (it.valor || 0), 0);
  const totalPecas = pecasValidas.reduce(
    (soma, it) => soma + (it.total || 0),
    0
  );
  const desconto = os.desconto || 0;
  const totalGeral = Math.max(0, totalServicos + totalPecas - desconto);

  const formatarMoeda = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let resumoFinanceiro = `💰 *RESUMO FINANCEIRO:*
• Mão de Obra (Serviços): ${formatarMoeda(totalServicos)}
• Peças e Materiais: ${formatarMoeda(totalPecas)}`;

  if (desconto > 0) {
    resumoFinanceiro += `\n• Desconto Aplicado: - ${formatarMoeda(desconto)}`;
  }

  resumoFinanceiro += `\n⭐️ *TOTAL GERAL: ${formatarMoeda(totalGeral)}*`;

  // Termo / Aviso Legal
  const termoLegal = ehOrcamento
    ? `⚠️ *Termo de Orçamento:* Valores sujeitos a alteração até a aprovação. Peças e serviços adicionais descobertos durante a execução serão orçados à parte e só executados com autorização do cliente.`
    : `✅ *Garantia e Entrega:* Serviços executados conforme descrito acima, com a garantia indicada em cada item a contar da entrega do veículo.`;

  const obs = os.observacoes?.trim()
    ? `\n\n📝 *Observações:* ${os.observacoes.trim()}`
    : '';

  return `🏢 *${nomeOficina}*
📄 *${tipoTitulo} #${numero}*
────────────────────────
👤 *Cliente:* ${clienteNome}
🚗 *Veículo:* ${veiculoDescricao}
🚘 *Placa:* ${placa}
🛣️ *KM de Entrada:* ${kmEntrada}
📌 *Status:* ${statusRotulo}
📅 *Abertura:* ${abertaEm}
⏱️ *Previsão de Entrega:* ${previsaoEntrega}${formaPgto ? `\n💳 *Pagamento:* ${formaPgto}` : ''}
────────────────────────

${queixa}${diagnostico}${secaoServicos}${secaoPecas}${resumoFinanceiro}${obs}

────────────────────────
${termoLegal}

Ficamos à disposição para quaisquer dúvidas! 🤝`.trim();
};
