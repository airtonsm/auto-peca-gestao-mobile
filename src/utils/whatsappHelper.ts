import { Linking, Alert } from 'react-native';
import { RespostaOSResumo, RespostaChecklist } from '../types';
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
