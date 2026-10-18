import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RespostaOSResumo, StatusTransicaoInfo, PedidoTransicaoStatusOS } from '../types';
import { CORES } from '../constants';
import {
  obterInfoStatus,
  obterTransicoesValidas,
  isEstadoFinal,
  MOTIVOS_RAPIDOS_POR_STATUS,
} from '../constants/transicoesOS';
import { osApi } from '../api/osApi';
import { extrairMensagemErro } from '../api/clienteHttp';
import { PlacaVeiculo } from './PlacaVeiculo';
import { StatusBadge } from './StatusBadge';

interface ModalMudarStatusOSProps {
  visivel: boolean;
  os: RespostaOSResumo | null;
  aoFechar: () => void;
  aoMudarStatusSucesso: (osAtualizada: any) => void;
  aoSolicitarRecarregar?: () => void;
}

export const ModalMudarStatusOS: React.FC<ModalMudarStatusOSProps> = ({
  visivel,
  os,
  aoFechar,
  aoMudarStatusSucesso,
  aoSolicitarRecarregar,
}) => {
  const insets = useSafeAreaInsets();

  const [statusSelecionado, setStatusSelecionado] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<string>('');
  const [salvando, setSalvando] = useState<boolean>(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  // Calcula transições válidas a partir do status atual da OS
  const transicoesValidas = useMemo<StatusTransicaoInfo[]>(() => {
    if (!os?.status) return [];
    return obterTransicoesValidas(os.status);
  }, [os?.status]);

  const estadoFinal = useMemo(() => {
    if (!os?.status) return false;
    return isEstadoFinal(os.status);
  }, [os?.status]);

  // Pré-seleciona a transição recomendada (passo natural) ao abrir o modal
  useEffect(() => {
    if (visivel && os) {
      setMotivo('');
      setErroLocal(null);
      const passoNatural = transicoesValidas.find((t) => t.destaque);
      if (passoNatural) {
        setStatusSelecionado(passoNatural.chave);
      } else if (transicoesValidas.length > 0) {
        setStatusSelecionado(transicoesValidas[0].chave);
      } else {
        setStatusSelecionado(null);
      }
    }
  }, [visivel, os, transicoesValidas]);

  // Tags contextuais de motivo para o status de destino selecionado
  const tagsMotivo = useMemo(() => {
    if (!statusSelecionado) {
      return MOTIVOS_RAPIDOS_POR_STATUS['padrao'];
    }
    return (
      MOTIVOS_RAPIDOS_POR_STATUS[statusSelecionado] ||
      MOTIVOS_RAPIDOS_POR_STATUS['padrao']
    );
  }, [statusSelecionado]);

  const handleSelecionarTag = (textoTag: string) => {
    if (!motivo.trim()) {
      setMotivo(textoTag);
    } else if (motivo.includes(textoTag)) {
      // Já contém a tag, não duplica
      return;
    } else {
      setMotivo((prev) => `${prev.trim()} • ${textoTag}`);
    }
  };

  const handleConfirmarMudanca = async () => {
    if (!os || !statusSelecionado) {
      Alert.alert('Atenção', 'Selecione o novo status da Ordem de Serviço.');
      return;
    }

    if (statusSelecionado === os.status) {
      Alert.alert('Atenção', 'O status selecionado é idêntico ao status atual.');
      return;
    }

    const infoDestino = obterInfoStatus(statusSelecionado);

    setSalvando(true);
    setErroLocal(null);

    const pedido: PedidoTransicaoStatusOS = {
      status: statusSelecionado,
      versao: os.versao,
      motivo: motivo.trim() || undefined,
    };

    try {
      const resposta = await osApi.mudarStatus(os.id, pedido);

      aoMudarStatusSucesso(resposta);
      aoFechar();

      Alert.alert(
        'Status Atualizado!',
        `A OS #${os.numero} foi alterada para "${infoDestino.rotulo}" com sucesso.`
      );
    } catch (e: any) {
      const statusHttp = e?.response?.status;
      const mensagem = extrairMensagemErro(e);

      // Bloqueio otimista: Erro 409 (Conflito de versão concorrente)
      if (
        statusHttp === 409 ||
        mensagem.toLowerCase().includes('conflito') ||
        mensagem.toLowerCase().includes('versão') ||
        mensagem.toLowerCase().includes('modificado')
      ) {
        Alert.alert(
          'Conflito de Versão (OS Alterada)',
          'Esta Ordem de Serviço foi alterada por outro usuário ou estação simultaneamente. A tela do pátio será atualizada com os dados mais recentes.',
          [
            {
              text: 'Recarregar Pátio',
              onPress: () => {
                aoSolicitarRecarregar?.();
                aoFechar();
              },
            },
          ]
        );
      } else {
        setErroLocal(mensagem);
        Alert.alert('Erro ao Alterar Status', mensagem);
      }
    } finally {
      setSalvando(false);
    }
  };

  if (!os) return null;

  const infoAtual = obterInfoStatus(os.status);
  const infoSelecionado = statusSelecionado ? obterInfoStatus(statusSelecionado) : null;

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent
      onRequestClose={aoFechar}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fundoModal}
      >
        <View style={[styles.containerModal, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Cabeçalho do Modal com Informações da OS */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <View style={styles.headerPlacaLinha}>
                <PlacaVeiculo placa={os.placa} tamanho="pequeno" />
                <Text style={styles.numeroOsText}>OS #{os.numero}</Text>
              </View>

              <View style={styles.headerStatusLinha}>
                <Text style={styles.labelStatusAtual}>Status atual:</Text>
                <StatusBadge
                  status={os.status}
                  rotulo={os.statusRotulo || infoAtual.rotulo}
                  tamanho="pequeno"
                />
              </View>

              <Text style={styles.veiculoDescricaoText} numberOfLines={1}>
                {os.veiculoDescricao || 'Veículo não informado'}
              </Text>
              <Text style={styles.clienteNomeText} numberOfLines={1}>
                Cliente: {os.clienteNome || 'Cliente não identificado'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.botaoFechar}
              onPress={aoFechar}
              accessibilityLabel="Fechar modal de mudança de status"
            >
              <Ionicons name="close" size={24} color={CORES.texto} />
            </TouchableOpacity>
          </View>

          {/* Conteúdo rolável */}
          <ScrollView
            style={styles.scrollConteudo}
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Título da Ação */}
            <View style={styles.secaoTituloLinha}>
              <Ionicons name="swap-horizontal" size={20} color={CORES.primariaClara} />
              <Text style={styles.secaoTitulo}>Alterar Status no Pátio</Text>
            </View>

            {/* Aviso de Erro Local */}
            {erroLocal && (
              <View style={styles.erroBox}>
                <Ionicons name="alert-circle" size={18} color={CORES.perigoTexto} />
                <Text style={styles.erroTexto}>{erroLocal}</Text>
              </View>
            )}

            {/* Lista de Transições Válidas */}
            {estadoFinal ? (
              <View style={styles.estadoFinalBox}>
                <Ionicons name="lock-closed-outline" size={28} color={CORES.textoMudo} />
                <Text style={styles.estadoFinalTitulo}>
                  Status Final: {infoAtual.rotulo}
                </Text>
                <Text style={styles.estadoFinalDescricao}>
                  Esta Ordem de Serviço foi concluída ou cancelada e não permite novas mudanças de status no pátio.
                </Text>
              </View>
            ) : transicoesValidas.length === 0 ? (
              <View style={styles.estadoFinalBox}>
                <Ionicons name="information-circle-outline" size={28} color={CORES.textoMudo} />
                <Text style={styles.estadoFinalTitulo}>Nenhuma transição disponível</Text>
                <Text style={styles.estadoFinalDescricao}>
                  Não há transições válidas cadastradas para o status atual ({infoAtual.rotulo}).
                </Text>
              </View>
            ) : (
              <View style={styles.transicoesContainer}>
                <Text style={styles.subtituloSecao}>
                  Selecione o próximo status para este atendimento:
                </Text>

                {transicoesValidas.map((item) => {
                  const estaSelecionado = statusSelecionado === item.chave;
                  const eRecomendado = item.destaque;

                  return (
                    <TouchableOpacity
                      key={item.chave}
                      style={[
                        styles.cardTransicao,
                        eRecomendado && styles.cardTransicaoRecomendado,
                        estaSelecionado && {
                          borderColor: item.cor || CORES.primariaClara,
                          backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        },
                      ]}
                      onPress={() => setStatusSelecionado(item.chave)}
                      activeOpacity={0.7}
                    >
                      {/* Ícone e Indicador */}
                      <View
                        style={[
                          styles.iconeContainer,
                          {
                            backgroundColor: estaSelecionado
                              ? item.cor
                              : 'rgba(255, 255, 255, 0.08)',
                          },
                        ]}
                      >
                        <Ionicons
                          name={item.icone as any}
                          size={22}
                          color={estaSelecionado ? '#FFFFFF' : item.cor || CORES.texto}
                        />
                      </View>

                      {/* Textos: Rótulo e Descrição */}
                      <View style={styles.infoTransicaoCol}>
                        <View style={styles.linhaRotuloDestaque}>
                          <Text
                            style={[
                              styles.rotuloTransicao,
                              estaSelecionado && {
                                color: item.cor || CORES.texto,
                                fontWeight: '800',
                              },
                            ]}
                          >
                            {item.rotulo}
                          </Text>

                          {eRecomendado && (
                            <View style={styles.badgeRecomendado}>
                              <Ionicons name="flash" size={11} color="#F59E0B" />
                              <Text style={styles.badgeRecomendadoTexto}>Recomendado</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.descricaoTransicao} numberOfLines={2}>
                          {item.descricao}
                        </Text>
                      </View>

                      {/* Botão de Seleção (Checkmark/Rádio) */}
                      <View
                        style={[
                          styles.radioCheck,
                          estaSelecionado && {
                            backgroundColor: item.cor || CORES.primaria,
                            borderColor: item.cor || CORES.primaria,
                          },
                        ]}
                      >
                        {estaSelecionado && (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Campo Opcional de Motivo / Observação */}
            {!estadoFinal && transicoesValidas.length > 0 && (
              <View style={styles.motivoSecao}>
                <View style={styles.motivoHeaderLinha}>
                  <Text style={styles.motivoTitulo}>
                    Motivo / Observação <Text style={styles.opcionalTexto}>(opcional)</Text>
                  </Text>
                  {motivo.length > 0 && (
                    <TouchableOpacity onPress={() => setMotivo('')}>
                      <Text style={styles.limparTexto}>Limpar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Tags de preenchimento rápido */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tagsScroll}
                >
                  {tagsMotivo.map((tag, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.chipTag}
                      onPress={() => handleSelecionarTag(tag)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={12} color={CORES.primariaClara} />
                      <Text style={styles.chipTagTexto}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Input de Texto Multi-linha */}
                <TextInput
                  style={styles.inputMotivo}
                  placeholder="Ex: Peças chegaram da distribuidora, iniciando montagem..."
                  placeholderTextColor={CORES.textoMudo}
                  value={motivo}
                  onChangeText={setMotivo}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            )}
          </ScrollView>

          {/* Rodapé com Botão de Confirmação */}
          {!estadoFinal && transicoesValidas.length > 0 && (
            <View style={styles.rodape}>
              <TouchableOpacity
                style={[
                  styles.botaoConfirmar,
                  (!statusSelecionado || salvando) && styles.botaoConfirmarDesabilitado,
                  statusSelecionado && infoSelecionado
                    ? { backgroundColor: infoSelecionado.cor }
                    : null,
                ]}
                onPress={handleConfirmarMudanca}
                disabled={!statusSelecionado || salvando}
                activeOpacity={0.8}
              >
                {salvando ? (
                  <View style={styles.botaoConfirmarConteudo}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.botaoConfirmarTexto}>Salvando alteração...</Text>
                  </View>
                ) : (
                  <View style={styles.botaoConfirmarConteudo}>
                    <Ionicons
                      name={infoSelecionado?.icone as any || 'checkmark-circle-outline'}
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.botaoConfirmarTexto}>
                      {infoSelecionado
                        ? `Mudar para "${infoSelecionado.rotulo}"`
                        : 'Confirmar Mudança de Status'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoCancelar}
                onPress={aoFechar}
                disabled={salvando}
              >
                <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {estadoFinal && (
            <View style={styles.rodape}>
              <TouchableOpacity style={styles.botaoCancelar} onPress={aoFechar}>
                <Text style={styles.botaoCancelarTexto}>Fechar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  containerModal: {
    backgroundColor: CORES.fundo,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '92%',
    height: '86%',
    display: 'flex',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
    backgroundColor: CORES.superficie,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  headerInfo: {
    flex: 1,
    marginRight: 10,
  },
  headerPlacaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  numeroOsText: {
    color: CORES.primariaClara,
    fontSize: 15,
    fontWeight: '800',
  },
  headerStatusLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  labelStatusAtual: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '600',
  },
  veiculoDescricaoText: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  clienteNomeText: {
    color: CORES.textoSecundario,
    fontSize: 13,
    marginTop: 2,
  },
  botaoFechar: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: CORES.superficieClara,
  },
  scrollConteudo: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    gap: 14,
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
  },
  subtituloSecao: {
    color: CORES.textoSecundario,
    fontSize: 13,
    marginBottom: 6,
  },
  erroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.perigoFundo,
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  erroTexto: {
    color: CORES.perigoTexto,
    fontSize: 13,
    flex: 1,
  },
  estadoFinalBox: {
    backgroundColor: CORES.superficie,
    padding: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    marginTop: 10,
  },
  estadoFinalTitulo: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
  },
  estadoFinalDescricao: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  transicoesContainer: {
    gap: 10,
  },
  cardTransicao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: CORES.bordaSuave,
    gap: 12,
    minHeight: 68,
  },
  cardTransicaoRecomendado: {
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  iconeContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTransicaoCol: {
    flex: 1,
  },
  linhaRotuloDestaque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  rotuloTransicao: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
  },
  badgeRecomendado: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  badgeRecomendadoTexto: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  descricaoTransicao: {
    color: CORES.textoMudo,
    fontSize: 12,
    lineHeight: 16,
  },
  radioCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: CORES.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motivoSecao: {
    backgroundColor: CORES.superficie,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 8,
    marginTop: 4,
  },
  motivoHeaderLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  motivoTitulo: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '700',
  },
  opcionalTexto: {
    color: CORES.textoMudo,
    fontWeight: '400',
    fontSize: 12,
  },
  limparTexto: {
    color: CORES.primariaClara,
    fontSize: 12,
    fontWeight: '600',
  },
  tagsScroll: {
    gap: 6,
    paddingVertical: 4,
  },
  chipTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficieClara,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: CORES.borda,
    gap: 4,
  },
  chipTagTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '600',
  },
  inputMotivo: {
    backgroundColor: CORES.fundo,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
    color: CORES.texto,
    padding: 10,
    fontSize: 13,
    lineHeight: 18,
    minHeight: 64,
  },
  rodape: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    backgroundColor: CORES.superficie,
    gap: 8,
  },
  botaoConfirmar: {
    backgroundColor: CORES.primaria,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoConfirmarDesabilitado: {
    opacity: 0.5,
  },
  botaoConfirmarConteudo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  botaoConfirmarTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  botaoCancelar: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoCancelarTexto: {
    color: CORES.textoMudo,
    fontSize: 13,
    fontWeight: '600',
  },
});
