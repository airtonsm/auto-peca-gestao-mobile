import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  RespostaOSCompleta,
  RespostaOSResumo,
  RespostaItemPecaOS,
  RespostaChecklist,
} from '../types';
import { CORES } from '../constants';
import { osApi } from '../api/osApi';
import { pecasOSApi } from '../api/pecasOSApi';
import { checklistApi } from '../api/checklistApi';
import { extrairMensagemErro } from '../api/clienteHttp';
import { PlacaVeiculo } from './PlacaVeiculo';
import { StatusBadge } from './StatusBadge';
import { ImagemAutenticada } from './ImagemAutenticada';
import { useAuth } from '../context/AuthContext';
import { abrirWhatsAppDireto } from '../utils/whatsappHelper';
import { gerarTextoImpressaoOSParaWhatsApp } from '../utils/whatsappHelper';
import { ModalFaturamentoCaixa } from './ModalFaturamentoCaixa';

interface ModalDetalheOSProps {
  visivel: boolean;
  osId: string | null;
  aoFechar: () => void;
  aoAtualizar?: () => void;
  aoAbrirChecklist?: (os: RespostaOSResumo, tipo: 'entrada' | 'saida') => void;
  aoAbrirPecas?: (os: RespostaOSResumo) => void;
  aoAbrirMudarStatus?: (os: RespostaOSResumo) => void;
  aoAbrirImprimir?: (os: RespostaOSResumo) => void;
  aoVerDetalhesChecklist?: (os: RespostaOSResumo, checklists: RespostaChecklist[]) => void;
}

const formatarMoeda = (val?: number): string => {
  return (val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const formatarData = (dataStr?: string): string => {
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

export const ModalDetalheOS: React.FC<ModalDetalheOSProps> = ({
  visivel,
  osId,
  aoFechar,
  aoAtualizar,
  aoAbrirChecklist,
  aoAbrirPecas,
  aoAbrirMudarStatus,
  aoAbrirImprimir,
  aoVerDetalhesChecklist,
}) => {
  const insets = useSafeAreaInsets();
  const { oficinaAtiva, usuario, logoUrl } = useAuth();
  const nomeOficina = oficinaAtiva?.nome || usuario?.empresa || 'Auto Peça & Oficina';

  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [os, setOs] = useState<RespostaOSCompleta | null>(null);
  const [pecas, setPecas] = useState<RespostaItemPecaOS[]>([]);
  const [checklists, setChecklists] = useState<RespostaChecklist[]>([]);
  const [modalCaixaVisivel, setModalCaixaVisivel] = useState<boolean>(false);

  const carregarDetalhes = useCallback(async () => {
    if (!osId) return;
    setCarregando(true);
    setErro(null);

    try {
      const [dadosOS, dadosPecas, dadosChecklists] = await Promise.all([
        osApi.obterPorId(osId),
        pecasOSApi.listarPecas(osId).catch(() => []),
        checklistApi.obterChecklistsDaOS(osId).catch(() => []),
      ]);

      setOs(dadosOS);
      setPecas(dadosPecas || []);
      setChecklists(dadosChecklists || []);
    } catch (e) {
      setErro(extrairMensagemErro(e, 'Não foi possível carregar os dados da OS.'));
    } finally {
      setCarregando(false);
    }
  }, [osId]);

  useEffect(() => {
    if (visivel && osId) {
      carregarDetalhes();
    } else {
      setOs(null);
      setPecas([]);
      setChecklists([]);
    }
  }, [visivel, osId, carregarDetalhes]);

  if (!visivel) return null;

  const checklistEntrada = checklists.find((c) => c.tipo === 'entrada');
  const checklistSaida = checklists.find((c) => c.tipo === 'saida');

  const subtotalServicos = os?.valorServicos ?? os?.itens?.reduce((acc, item) => acc + (item.valor || 0), 0) ?? 0;
  const subtotalPecas = os?.valorPecas ?? pecas.reduce((acc, p) => acc + (p.total || (p.quantidade * p.precoUnitario) || 0), 0);
  const desconto = os?.desconto || 0;
  const totalGeral = os?.valorTotal || Math.max(0, subtotalServicos + subtotalPecas - desconto);

  const handleCompartilharWhatsApp = async () => {
    if (!os) return;
    const texto = gerarTextoImpressaoOSParaWhatsApp({
      os,
      pecas,
      nomeOficina,
    });
    await abrirWhatsAppDireto('', texto);
  };

  const handleAbrirChecklistEntrada = () => {
    if (!os) return;
    aoFechar();
    aoAbrirChecklist?.(os, 'entrada');
  };

  const handleAbrirChecklistSaida = () => {
    if (!os) return;
    aoFechar();
    aoAbrirChecklist?.(os, 'saida');
  };

  const handleVerChecklist = () => {
    if (!os) return;
    if (aoVerDetalhesChecklist) {
      aoVerDetalhesChecklist(os, checklists);
    }
  };

  const handleGerenciarPecas = () => {
    if (!os) return;
    aoFechar();
    aoAbrirPecas?.(os);
  };

  const handleMudarStatus = () => {
    if (!os) return;
    aoAbrirMudarStatus?.(os);
  };

  const handleImprimir = () => {
    if (!os) return;
    aoAbrirImprimir?.(os);
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={aoFechar}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
        {/* Cabeçalho do Modal */}
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderEsquerda}>
            <ImagemAutenticada
              caminhoRelativo={logoUrl}
              style={styles.logoOficinaHeader}
              resizeMode="contain"
              fallback={
                <View style={styles.logoOficinaFallback}>
                  <Ionicons name="car-sport" size={18} color={CORES.primariaClara} />
                </View>
              }
            />
            <View>
              <Text style={styles.modalTitulo}>Ordem de Serviço #{os?.numero ?? '---'}</Text>
              <Text style={styles.modalSubtitulo}>{nomeOficina}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.botaoFechar}
            onPress={aoFechar}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={24} color={CORES.texto} />
          </TouchableOpacity>
        </View>

        {carregando ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={CORES.primariaClara} />
            <Text style={styles.loadingTexto}>Carregando visualização da OS...</Text>
          </View>
        ) : erro || !os ? (
          <View style={styles.erroContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={CORES.perigoTexto} />
            <Text style={styles.erroTitulo}>Erro ao carregar OS</Text>
            <Text style={styles.erroDescricao}>{erro || 'Ordem de serviço não encontrada.'}</Text>
            <TouchableOpacity style={styles.botaoTentarNovamente} onPress={carregarDetalhes}>
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.botaoTentarNovamenteTexto}>Tentar Novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 140 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* Card Destaque: Placa, Status e Box */}
              <View style={styles.cardDestaque}>
                <View style={styles.cardDestaqueLinha}>
                  <PlacaVeiculo placa={os.placa} tamanho="medio" />

                  <TouchableOpacity
                    style={styles.badgeStatusWrapper}
                    onPress={handleMudarStatus}
                    activeOpacity={0.7}
                  >
                    <StatusBadge status={os.status} rotulo={os.statusRotulo} tamanho="medio" />
                    <View style={styles.iconeTrocaStatus}>
                      <Ionicons name="swap-horizontal" size={14} color={CORES.primariaClara} />
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={styles.destaqueInfosLinha}>
                  <View style={styles.destaqueInfoItem}>
                    <Ionicons name="cube-outline" size={16} color="#38BDF8" />
                    <Text style={styles.destaqueInfoTexto}>
                      Box: <Text style={styles.destaqueInfoValor}>{os.boxNome || 'Sem box definido'}</Text>
                    </Text>
                  </View>

                  {os.prioridade && (
                    <View style={styles.destaqueInfoItem}>
                      <Ionicons name="flag-outline" size={16} color={os.prioridade === 'alta' ? CORES.perigoTexto : CORES.textoMudo} />
                      <Text style={styles.destaqueInfoTexto}>
                        Prioridade: <Text style={styles.destaqueInfoValor}>{os.prioridade.toUpperCase()}</Text>
                      </Text>
                    </View>
                  )}
                </View>

                {/* Linhas de Datas */}
                <View style={styles.datasGrid}>
                  <View style={styles.dataCol}>
                    <Text style={styles.dataLabel}>Aberta em:</Text>
                    <Text style={styles.dataValor}>{formatarData(os.abertaEm)}</Text>
                  </View>
                  <View style={styles.dataCol}>
                    <Text style={styles.dataLabel}>Previsão de Entrega:</Text>
                    <Text style={[styles.dataValor, os.atrasada && { color: CORES.perigoTexto }]}>
                      {formatarData(os.previsaoEntrega)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Seção Veículo e Cliente */}
              <View style={styles.secaoCard}>
                <View style={styles.secaoTituloLinha}>
                  <Ionicons name="car-outline" size={19} color={CORES.primariaClara} />
                  <Text style={styles.secaoTitulo}>Veículo & Cliente</Text>
                </View>

                <View style={styles.infoBloco}>
                  <Text style={styles.infoTitulo}>{os.veiculoDescricao || 'Veículo não informado'}</Text>
                  <View style={styles.infoMetaLinha}>
                    <View style={styles.tagInfo}>
                      <Ionicons name="speedometer-outline" size={14} color={CORES.textoSecundario} />
                      <Text style={styles.tagInfoTexto}>
                        {os.kmEntrada ? `${os.kmEntrada.toLocaleString('pt-BR')} KM` : 'KM não anotado'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.divisor} />

                <View style={styles.infoBloco}>
                  <View style={styles.clienteLinha}>
                    <View style={styles.clienteAvatar}>
                      <Ionicons name="person" size={18} color="#93C5FD" />
                    </View>
                    <View style={styles.clienteTextos}>
                      <Text style={styles.clienteNome}>{os.clienteNome || 'Cliente não identificado'}</Text>
                      <Text style={styles.clienteSub}>ID: {os.clienteId ? os.clienteId.substring(0, 8) : '---'}</Text>
                    </View>
                  </View>
                </View>

                {/* Queixa do Cliente */}
                {!!os.queixaCliente && (
                  <View style={styles.boxQueixa}>
                    <View style={styles.boxQueixaTopo}>
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color="#F59E0B" />
                      <Text style={styles.boxQueixaTitulo}>Queixa / Relato do Cliente:</Text>
                    </View>
                    <Text style={styles.boxQueixaTexto}>{os.queixaCliente}</Text>
                  </View>
                )}

                {/* Diagnóstico Técnico */}
                {!!os.diagnostico && (
                  <View style={styles.boxDiagnostico}>
                    <View style={styles.boxDiagnosticoTopo}>
                      <Ionicons name="build-outline" size={16} color="#38BDF8" />
                      <Text style={styles.boxDiagnosticoTitulo}>Diagnóstico Técnico:</Text>
                    </View>
                    <Text style={styles.boxDiagnosticoTexto}>{os.diagnostico}</Text>
                  </View>
                )}

                {/* Observações Gerais */}
                {!!os.observacoes && (
                  <View style={styles.boxObservacoes}>
                    <Text style={styles.boxObservacoesTitulo}>Observações Internas:</Text>
                    <Text style={styles.boxObservacoesTexto}>{os.observacoes}</Text>
                  </View>
                )}
              </View>

              {/* Seção de Checklists de Vistoria (Entrada e Saída) */}
              <View style={styles.secaoCard}>
                <View style={styles.secaoTituloLinha}>
                  <Ionicons name="clipboard-outline" size={19} color="#10B981" />
                  <Text style={styles.secaoTitulo}>Vistoria & Checklist</Text>
                </View>

                {/* Card Checklist de Entrada */}
                <View style={styles.checklistCard}>
                  <View style={styles.checklistCardTopo}>
                    <View style={styles.checklistTipoLinha}>
                      <Ionicons
                        name={checklistEntrada ? 'checkmark-circle' : 'time-outline'}
                        size={18}
                        color={checklistEntrada ? '#22C55E' : '#F59E0B'}
                      />
                      <Text style={styles.checklistCardTitulo}>Checklist de Entrada</Text>
                    </View>
                    <Text style={[styles.checklistCardStatus, checklistEntrada ? styles.statusConcluido : styles.statusPendente]}>
                      {checklistEntrada ? 'CONCLUÍDO' : 'PENDENTE'}
                    </Text>
                  </View>

                  {checklistEntrada ? (
                    <View style={styles.checklistCorpoPreenchido}>
                      <Text style={styles.checklistDataTexto}>
                        Realizado em: {formatarData(checklistEntrada.preenchidoEm)}
                      </Text>
                      {checklistEntrada.km !== undefined && (
                        <Text style={styles.checklistKmTexto}>
                          KM Marcado: {checklistEntrada.km.toLocaleString('pt-BR')} km • Tanque: {Math.round((checklistEntrada.nivelCombustivel || 0) * 100)}%
                        </Text>
                      )}
                      {checklistEntrada.avarias && checklistEntrada.avarias.length > 0 && (
                        <View style={styles.avariasTagLinha}>
                          <Text style={styles.avariasTagLabel}>Avarias na lataria:</Text>
                          <View style={styles.avariasBadges}>
                            {checklistEntrada.avarias.map((av, idx) => (
                              <View key={idx} style={styles.avariaChip}>
                                <Text style={styles.avariaChipTexto}>{av.regiao}: {av.tipo}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.botaoVerLaudoChecklist}
                        onPress={handleVerChecklist}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="eye-outline" size={16} color={CORES.primariaClara} />
                        <Text style={styles.botaoVerLaudoChecklistTexto}>Ver Laudo e Fotos de Entrada</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.checklistAcaoBox}>
                      <Text style={styles.checklistAcaoDesc}>
                        A vistoria de entrada registra o estado inicial do veículo e protege contra reclamações de avarias.
                      </Text>
                      <TouchableOpacity
                        style={styles.botaoFazerChecklistEntrada}
                        onPress={handleAbrirChecklistEntrada}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.botaoFazerChecklistEntradaTexto}>+ Preencher Checklist de Entrada</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Card Checklist de Saída */}
                <View style={styles.checklistCard}>
                  <View style={styles.checklistCardTopo}>
                    <View style={styles.checklistTipoLinha}>
                      <Ionicons
                        name={checklistSaida ? 'checkmark-circle' : 'exit-outline'}
                        size={18}
                        color={checklistSaida ? '#22C55E' : '#38BDF8'}
                      />
                      <Text style={styles.checklistCardTitulo}>Checklist de Saída</Text>
                    </View>
                    <Text style={[styles.checklistCardStatus, checklistSaida ? styles.statusConcluido : styles.statusPendente]}>
                      {checklistSaida ? 'CONCLUÍDO' : 'PENDENTE'}
                    </Text>
                  </View>

                  {checklistSaida ? (
                    <View style={styles.checklistCorpoPreenchido}>
                      <Text style={styles.checklistDataTexto}>
                        Realizado em: {formatarData(checklistSaida.preenchidoEm)}
                      </Text>
                      <TouchableOpacity
                        style={styles.botaoVerLaudoChecklist}
                        onPress={handleVerChecklist}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="eye-outline" size={16} color={CORES.primariaClara} />
                        <Text style={styles.botaoVerLaudoChecklistTexto}>Ver Laudo de Saída</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.checklistAcaoBox}>
                      <Text style={styles.checklistAcaoDesc}>
                        O checklist de saída comprova a integridade e limpeza do veículo na entrega ao cliente.
                      </Text>
                      <TouchableOpacity
                        style={styles.botaoFazerChecklistSaida}
                        onPress={handleAbrirChecklistSaida}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="exit-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.botaoFazerChecklistSaidaTexto}>+ Preencher Checklist de Saída</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {/* Seção Mão de Obra e Serviços */}
              <View style={styles.secaoCard}>
                <View style={styles.secaoTituloLinha}>
                  <Ionicons name="construct-outline" size={19} color="#A78BFA" />
                  <Text style={styles.secaoTitulo}>Mão de Obra & Serviços</Text>
                  <Text style={styles.contadorItens}>
                    {os.itens?.length || 0} {os.itens?.length === 1 ? 'item' : 'itens'}
                  </Text>
                </View>

                {os.itens && os.itens.length > 0 ? (
                  <View style={styles.listaItensBox}>
                    {os.itens.map((servico, index) => (
                      <View key={servico.id || index} style={styles.itemServicoCard}>
                        <View style={styles.itemServicoTopo}>
                          <Text style={styles.itemServicoDescricao}>{servico.descricao}</Text>
                          <Text style={styles.itemServicoValor}>{formatarMoeda(servico.valor)}</Text>
                        </View>
                        <View style={styles.itemServicoMeta}>
                          {servico.mecanicoNome && (
                            <View style={styles.mecanicoTag}>
                              <Ionicons name="person-outline" size={12} color="#C4B5FD" />
                              <Text style={styles.mecanicoTagTexto}>{servico.mecanicoNome}</Text>
                            </View>
                          )}
                          {servico.garantiaDias ? (
                            <Text style={styles.garantiaTexto}>{servico.garantiaDias} dias de garantia</Text>
                          ) : null}
                        </View>
                      </View>
                    ))}

                    <View style={styles.subtotalLinha}>
                      <Text style={styles.subtotalLabel}>Subtotal Mão de Obra:</Text>
                      <Text style={styles.subtotalValor}>{formatarMoeda(subtotalServicos)}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.vazioBox}>
                    <Text style={styles.vazioTexto}>Nenhum serviço lançado nesta Ordem de Serviço.</Text>
                  </View>
                )}
              </View>

              {/* Seção Peças Lançadas */}
              <View style={styles.secaoCard}>
                <View style={styles.secaoTituloLinha}>
                  <Ionicons name="cube-outline" size={19} color="#38BDF8" />
                  <Text style={styles.secaoTitulo}>Peças Lançadas</Text>
                  <Text style={styles.contadorItens}>
                    {pecas.length} {pecas.length === 1 ? 'peça' : 'peças'}
                  </Text>
                </View>

                {pecas.length > 0 ? (
                  <View style={styles.listaItensBox}>
                    {pecas.map((peca, index) => {
                      const totalItem = peca.total ?? (peca.quantidade * peca.precoUnitario);
                      const ehAguardando = peca.status === 'aguardando' || peca.sugerirAguardandoPeca;
                      const ehAplicada = peca.status === 'aplicada' || peca.status === 'aplicado';

                      return (
                        <View key={peca.id || index} style={styles.itemPecaCard}>
                          <View style={styles.itemPecaTopo}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.itemPecaDescricao}>{peca.descricao}</Text>
                              {peca.codigoInterno && <Text style={styles.itemPecaCodigo}>Cód: {peca.codigoInterno}</Text>}
                            </View>
                            <Text style={styles.itemPecaValor}>{formatarMoeda(totalItem)}</Text>
                          </View>

                          <View style={styles.itemPecaMeta}>
                            <Text style={styles.itemPecaQtd}>
                              {peca.quantidade} x {formatarMoeda(peca.precoUnitario)}
                            </Text>

                            <View
                              style={[
                                styles.statusPecaBadge,
                                ehAplicada
                                  ? styles.statusPecaAplicada
                                  : ehAguardando
                                  ? styles.statusPecaAguardando
                                  : styles.statusPecaReservada,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusPecaTexto,
                                  ehAplicada
                                    ? { color: '#22C55E' }
                                    : ehAguardando
                                    ? { color: '#EF4444' }
                                    : { color: '#38BDF8' },
                                ]}
                              >
                                {ehAplicada ? 'Aplicada' : ehAguardando ? 'Aguardando Peça' : 'Reservada'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}

                    <View style={styles.subtotalLinha}>
                      <Text style={styles.subtotalLabel}>Subtotal Peças:</Text>
                      <Text style={styles.subtotalValor}>{formatarMoeda(subtotalPecas)}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.vazioBox}>
                    <Text style={styles.vazioTexto}>Nenhuma peça vinculada a esta OS até o momento.</Text>
                  </View>
                )}

                {/* Botão de Destaque para Lançar/Gerenciar Peças */}
                <TouchableOpacity
                  style={styles.botaoGerenciarPecas}
                  onPress={handleGerenciarPecas}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cube" size={18} color="#38BDF8" />
                  <Text style={styles.botaoGerenciarPecasTexto}>
                    {pecas.length > 0 ? 'Gerenciar / Adicionar Mais Peças' : '+ Lançar Peças do Estoque'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Seção Resumo Financeiro */}
              <View style={styles.secaoCard}>
                <View style={styles.secaoTituloLinha}>
                  <Ionicons name="cash-outline" size={19} color="#34D399" />
                  <Text style={styles.secaoTitulo}>Resumo Financeiro da OS</Text>
                </View>

                <View style={styles.tabelaFinanceira}>
                  <View style={styles.linhaFin}>
                    <Text style={styles.linhaFinLabel}>Total Mão de Obra:</Text>
                    <Text style={styles.linhaFinValor}>{formatarMoeda(subtotalServicos)}</Text>
                  </View>

                  <View style={styles.linhaFin}>
                    <Text style={styles.linhaFinLabel}>Total Peças:</Text>
                    <Text style={styles.linhaFinValor}>{formatarMoeda(subtotalPecas)}</Text>
                  </View>

                  {desconto > 0 && (
                    <View style={styles.linhaFin}>
                      <Text style={[styles.linhaFinLabel, { color: CORES.sucessoTexto }]}>Desconto Concedido:</Text>
                      <Text style={[styles.linhaFinValor, { color: CORES.sucessoTexto }]}>- {formatarMoeda(desconto)}</Text>
                    </View>
                  )}

                  <View style={styles.divisorFin} />

                  <View style={styles.linhaFinTotal}>
                    <Text style={styles.totalLabel}>TOTAL GERAL:</Text>
                    <Text style={styles.totalValor}>{formatarMoeda(totalGeral)}</Text>
                  </View>

                  {os.formaPagamento && (
                    <View style={styles.formaPagamentoLinha}>
                      <Ionicons name="card-outline" size={16} color={CORES.textoMudo} />
                      <Text style={styles.formaPagamentoTexto}>
                        Pagamento: <Text style={styles.formaPagamentoDestaque}>{os.formaPagamento.toUpperCase()}</Text>
                      </Text>
                    </View>
                  )}

                  {/* Botão de Destaque: Caixa & Faturamento da OS */}
                  {os.status !== 'cancelada' && (
                    <TouchableOpacity
                      style={[
                        styles.botaoCaixaDestaque,
                        os.status === 'entregue' && styles.botaoCaixaDestaqueEntregue,
                      ]}
                      onPress={() => setModalCaixaVisivel(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cash-outline" size={20} color="#FFFFFF" />
                      <View style={styles.botaoCaixaTextoContainer}>
                        <Text style={styles.botaoCaixaTitulo}>
                          {os.status === 'entregue'
                            ? 'Ver Detalhes do Pagamento'
                            : 'Receber no Caixa / Faturar'}
                        </Text>
                        <Text style={styles.botaoCaixaSubtitulo}>
                          {os.status === 'entregue'
                            ? 'OS já faturada · Toque para ver detalhes'
                            : 'Registrar pagamento e concluir entrega da OS'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#93C5FD" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ScrollView>

            {/* Barra Inferior Fixa com Ações Rápidas (Organizada em 2 Níveis) */}
            <View style={[styles.rodapeFixo, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              {/* Linha 1: Operações Principais (Caixa & Mudar Status) */}
              <View style={styles.rodapeLinha}>
                <TouchableOpacity
                  style={styles.botaoRodapeCaixa}
                  onPress={() => setModalCaixaVisivel(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cash" size={18} color="#FFFFFF" />
                  <Text style={styles.botaoRodapeCaixaTexto}>Caixa / Faturar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.botaoRodapeStatus}
                  onPress={handleMudarStatus}
                  activeOpacity={0.8}
                >
                  <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" />
                  <Text style={styles.botaoRodapeStatusTexto}>Mudar Status</Text>
                </TouchableOpacity>
              </View>

              {/* Linha 2: Documentos e Comunicação (Imprimir & WhatsApp) */}
              <View style={styles.rodapeLinha}>
                <TouchableOpacity
                  style={styles.botaoRodapeImprimir}
                  onPress={handleImprimir}
                  activeOpacity={0.8}
                >
                  <Ionicons name="print-outline" size={18} color="#38BDF8" />
                  <Text style={styles.botaoRodapeImprimirTexto}>Imprimir / PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.botaoRodapeWhatsApp}
                  onPress={handleCompartilharWhatsApp}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                  <Text style={styles.botaoRodapeWhatsAppTexto}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Modal de Caixa e Emissão Fiscal com Biometria */}
            <ModalFaturamentoCaixa
              visivel={modalCaixaVisivel}
              os={os}
              aoFechar={() => setModalCaixaVisivel(false)}
              aoFaturamentoSucesso={() => {
                carregarDetalhes();
                aoAtualizar?.();
              }}
            />
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: CORES.superficie,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  modalHeaderEsquerda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logoOficinaHeader: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  logoOficinaFallback: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitulo: {
    color: CORES.texto,
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitulo: {
    color: CORES.textoMudo,
    fontSize: 12,
  },
  botaoFechar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CORES.superficieClara,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
  },
  erroContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  erroTitulo: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
  },
  erroDescricao: {
    color: CORES.textoMudo,
    fontSize: 14,
    textAlign: 'center',
  },
  botaoTentarNovamente: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.primaria,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  botaoTentarNovamenteTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  cardDestaque: {
    backgroundColor: CORES.superficie,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    gap: 14,
  },
  cardDestaqueLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeStatusWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconeTrocaStatus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  destaqueInfosLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  destaqueInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  destaqueInfoTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
  },
  destaqueInfoValor: {
    color: CORES.texto,
    fontWeight: '700',
  },
  datasGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  dataCol: {
    flex: 1,
    gap: 2,
  },
  dataLabel: {
    color: CORES.textoMudo,
    fontSize: 11,
    fontWeight: '600',
  },
  dataValor: {
    color: CORES.texto,
    fontSize: 12,
    fontWeight: '700',
  },
  secaoCard: {
    backgroundColor: CORES.superficie,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 12,
  },
  secaoTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secaoTitulo: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  contadorItens: {
    color: CORES.textoMudo,
    fontSize: 12,
    fontWeight: '600',
  },
  infoBloco: {
    gap: 6,
  },
  infoTitulo: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '800',
  },
  infoMetaLinha: {
    flexDirection: 'row',
    gap: 8,
  },
  tagInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficieClara,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  tagInfoTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '600',
  },
  divisor: {
    height: 1,
    backgroundColor: CORES.bordaSuave,
  },
  clienteLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clienteAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clienteTextos: {
    flex: 1,
  },
  clienteNome: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
  },
  clienteSub: {
    color: CORES.textoMudo,
    fontSize: 11,
  },
  boxQueixa: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    padding: 10,
    borderRadius: 6,
    gap: 4,
  },
  boxQueixaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  boxQueixaTitulo: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
  },
  boxQueixaTexto: {
    color: CORES.texto,
    fontSize: 13,
    lineHeight: 18,
  },
  boxDiagnostico: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
    padding: 10,
    borderRadius: 6,
    gap: 4,
  },
  boxDiagnosticoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  boxDiagnosticoTitulo: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  boxDiagnosticoTexto: {
    color: CORES.texto,
    fontSize: 13,
    lineHeight: 18,
  },
  boxObservacoes: {
    backgroundColor: CORES.fundo,
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  boxObservacoesTitulo: {
    color: CORES.textoMudo,
    fontSize: 12,
    fontWeight: '700',
  },
  boxObservacoesTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
    lineHeight: 18,
  },
  checklistCard: {
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 10,
  },
  checklistCardTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checklistTipoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checklistCardTitulo: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
  },
  checklistCardStatus: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusConcluido: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    color: '#22C55E',
  },
  statusPendente: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: '#F59E0B',
  },
  checklistCorpoPreenchido: {
    gap: 6,
  },
  checklistDataTexto: {
    color: CORES.textoMudo,
    fontSize: 12,
  },
  checklistKmTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '600',
  },
  avariasTagLinha: {
    gap: 4,
    marginTop: 2,
  },
  avariasTagLabel: {
    color: CORES.textoMudo,
    fontSize: 11,
    fontWeight: '600',
  },
  avariasBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  avariaChip: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  avariaChipTexto: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  botaoVerLaudoChecklist: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  botaoVerLaudoChecklistTexto: {
    color: CORES.primariaClara,
    fontSize: 13,
    fontWeight: '700',
  },
  checklistAcaoBox: {
    gap: 8,
  },
  checklistAcaoDesc: {
    color: CORES.textoMudo,
    fontSize: 12,
    lineHeight: 16,
  },
  botaoFazerChecklistEntrada: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.primaria,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  botaoFazerChecklistEntradaTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  botaoFazerChecklistSaida: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  botaoFazerChecklistSaidaTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listaItensBox: {
    gap: 8,
  },
  itemServicoCard: {
    backgroundColor: CORES.fundo,
    borderRadius: 8,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  itemServicoTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemServicoDescricao: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    paddingRight: 8,
  },
  itemServicoValor: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '800',
  },
  itemServicoMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mecanicoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mecanicoTagTexto: {
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: '600',
  },
  garantiaTexto: {
    color: CORES.textoMudo,
    fontSize: 11,
  },
  itemPecaCard: {
    backgroundColor: CORES.fundo,
    borderRadius: 8,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  itemPecaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemPecaDescricao: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    paddingRight: 8,
  },
  itemPecaCodigo: {
    color: CORES.textoMudo,
    fontSize: 11,
  },
  itemPecaValor: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '800',
  },
  itemPecaMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  itemPecaQtd: {
    color: CORES.textoSecundario,
    fontSize: 12,
  },
  statusPecaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPecaAplicada: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  statusPecaAguardando: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statusPecaReservada: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  statusPecaTexto: {
    fontSize: 11,
    fontWeight: '700',
  },
  subtotalLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
  },
  subtotalLabel: {
    color: CORES.textoSecundario,
    fontSize: 13,
    fontWeight: '600',
  },
  subtotalValor: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '800',
  },
  vazioBox: {
    backgroundColor: CORES.fundo,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  vazioTexto: {
    color: CORES.textoMudo,
    fontSize: 12,
  },
  botaoGerenciarPecas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 8,
    marginTop: 4,
  },
  botaoGerenciarPecasTexto: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  tabelaFinanceira: {
    gap: 8,
  },
  linhaFin: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linhaFinLabel: {
    color: CORES.textoSecundario,
    fontSize: 13,
  },
  linhaFinValor: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '600',
  },
  divisorFin: {
    height: 1,
    backgroundColor: CORES.bordaSuave,
    marginVertical: 4,
  },
  linhaFinTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  totalLabel: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '900',
  },
  totalValor: {
    color: '#22C55E',
    fontSize: 18,
    fontWeight: '900',
  },
  formaPagamentoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  formaPagamentoTexto: {
    color: CORES.textoMudo,
    fontSize: 12,
  },
  formaPagamentoDestaque: {
    color: CORES.texto,
    fontWeight: '700',
  },
  rodapeFixo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: CORES.superficie,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  rodapeLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  botaoRodapeCaixa: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
  },
  botaoRodapeCaixaTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  botaoRodapeStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
  },
  botaoRodapeStatusTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  botaoRodapeImprimir: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
  },
  botaoRodapeImprimirTexto: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  botaoRodapeWhatsApp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
  },
  botaoRodapeWhatsAppTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  botaoCaixaDestaque: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    padding: 14,
    marginTop: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
  },
  botaoCaixaDestaqueEntregue: {
    backgroundColor: '#334155',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  botaoCaixaTextoContainer: {
    flex: 1,
  },
  botaoCaixaTitulo: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  botaoCaixaSubtitulo: {
    color: '#BFDBFE',
    fontSize: 11,
    marginTop: 2,
  },
});
