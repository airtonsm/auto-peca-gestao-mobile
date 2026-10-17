import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RespostaChecklist, RespostaOSResumo } from '../types';
import { CORES, ROTULOS_SECAO, REGIOES_AVARIA, TIPOS_AVARIA } from '../constants';
import { PlacaVeiculo } from './PlacaVeiculo';
import { checklistApi } from '../api/checklistApi';

interface ChecklistDetalhesModalProps {
  visivel: boolean;
  onFechar: () => void;
  os: RespostaOSResumo | null;
  checklists: RespostaChecklist[];
  onIniciarSaida?: (os: RespostaOSResumo) => void;
}

export const ChecklistDetalhesModal: React.FC<ChecklistDetalhesModalProps> = ({
  visivel,
  onFechar,
  os,
  checklists,
  onIniciarSaida,
}) => {
  const insets = useSafeAreaInsets();
  const [tipoSelecionado, setTipoSelecionado] = useState<'entrada' | 'saida'>('entrada');
  const [fotoAmpliadaUrl, setFotoAmpliadaUrl] = useState<string | null>(null);

  // Mapas de URLs assinadas/locais resolvidas para avarias e assinatura
  const [urlsResolvidas, setUrlsResolvidas] = useState<Record<string, string>>({});
  const [carregandoUrls, setCarregandoUrls] = useState(false);

  // Seleciona a entrada por padrão, ou saída se só houver saída
  useEffect(() => {
    if (checklists && checklists.length > 0) {
      const temEntrada = checklists.some((c) => c.tipo === 'entrada');
      const temSaida = checklists.some((c) => c.tipo === 'saida');
      if (temEntrada) {
        setTipoSelecionado('entrada');
      } else if (temSaida) {
        setTipoSelecionado('saida');
      }
    }
  }, [checklists, visivel]);

  const checklistAtual = checklists.find((c) => c.tipo === tipoSelecionado) || checklists[0];

  // Resolve URLs de leitura para avarias, assinatura e fotos de itens do checklist atual
  useEffect(() => {
    if (!checklistAtual || !visivel) return;

    let cancelado = false;
    const resolverUrls = async () => {
      setCarregandoUrls(true);
      const caminhosParaResolver: string[] = [];

      if (checklistAtual.assinaturaUrl) {
        caminhosParaResolver.push(checklistAtual.assinaturaUrl);
      }

      if (checklistAtual.avarias) {
        checklistAtual.avarias.forEach((av) => {
          if (av.fotoUrl) caminhosParaResolver.push(av.fotoUrl);
        });
      }

      if (checklistAtual.itens) {
        checklistAtual.itens.forEach((it) => {
          if (it.fotoUrl) caminhosParaResolver.push(it.fotoUrl);
        });
      }

      const resultados: Record<string, string> = {};
      await Promise.all(
        caminhosParaResolver.map(async (caminho) => {
          try {
            const urlFinal = await checklistApi.obterUrlLeitura(caminho);
            resultados[caminho] = urlFinal;
          } catch {
            resultados[caminho] = '';
          }
        })
      );

      if (!cancelado) {
        setUrlsResolvidas(resultados);
        setCarregandoUrls(false);
      }
    };

    resolverUrls();

    return () => {
      cancelado = true;
    };
  }, [checklistAtual, visivel]);

  if (!os || !checklistAtual) {
    return null;
  }

  const temEntrada = checklists.some((c) => c.tipo === 'entrada');
  const temSaida = checklists.some((c) => c.tipo === 'saida');

  // Agrupa os itens do checklist por seção
  const secoesItens: Record<string, typeof checklistAtual.itens> = {};
  if (checklistAtual.itens) {
    checklistAtual.itens.forEach((item) => {
      const sec = item.secao || 'geral';
      if (!secoesItens[sec]) {
        secoesItens[sec] = [];
      }
      secoesItens[sec].push(item);
    });
  }

  const formatarResposta = (resp: string) => {
    switch (resp?.toLowerCase()) {
      case 'ok':
        return { texto: 'OK', cor: CORES.sucessoTexto, fundo: 'rgba(34, 197, 94, 0.15)', icone: 'checkmark-circle' as const };
      case 'atencao':
        return { texto: 'Atenção', cor: CORES.alertaTexto, fundo: 'rgba(234, 179, 8, 0.15)', icone: 'alert-circle' as const };
      case 'critico':
        return { texto: 'Crítico', cor: CORES.perigoTexto, fundo: 'rgba(239, 68, 68, 0.15)', icone: 'close-circle' as const };
      case 'na':
        return { texto: 'N/A', cor: CORES.textoMudo, fundo: 'rgba(148, 163, 184, 0.15)', icone: 'remove-circle' as const };
      default:
        return { texto: resp || 'N/A', cor: CORES.textoSecundario, fundo: CORES.superficieClara, icone: 'ellipse-outline' as const };
    }
  };

  const nivelCombustivelPorcentagem = Math.round((checklistAtual.nivelCombustivel || 0) * 100);

  const corBarraCombustivel = () => {
    if (nivelCombustivelPorcentagem <= 15) return CORES.perigo;
    if (nivelCombustivelPorcentagem <= 35) return CORES.alerta;
    return CORES.sucesso;
  };

  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={onFechar}>
      <View style={styles.fundoModal}>
        <View style={styles.containerModal}>
          {/* Header Superior com Placa e Dados da OS */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <View style={styles.headerPlacaLinha}>
                <PlacaVeiculo placa={os.placa} tamanho="pequeno" />
                <Text style={styles.numeroOsText}>OS #{os.numero}</Text>
              </View>
              <Text style={styles.veiculoDescricaoText} numberOfLines={1}>
                {os.veiculoDescricao || 'Veículo'}
              </Text>
              <Text style={styles.clienteNomeText} numberOfLines={1}>
                Cliente: {os.clienteNome || 'Não informado'}
              </Text>
            </View>
            <TouchableOpacity onPress={onFechar} style={styles.botaoFecharIcone}>
              <Ionicons name="close" size={26} color={CORES.texto} />
            </TouchableOpacity>
          </View>

          {/* Abas de Alternância: Entrada vs Saída */}
          <View style={styles.abasContainer}>
            <TouchableOpacity
              style={[
                styles.abaBotao,
                tipoSelecionado === 'entrada' && styles.abaBotaoAtivo,
                !temEntrada && styles.abaBotaoInativo,
              ]}
              onPress={() => temEntrada && setTipoSelecionado('entrada')}
              disabled={!temEntrada}
            >
              <Ionicons
                name="enter-outline"
                size={16}
                color={tipoSelecionado === 'entrada' ? '#FFFFFF' : CORES.textoMudo}
              />
              <Text
                style={[
                  styles.abaTexto,
                  tipoSelecionado === 'entrada' && styles.abaTextoAtivo,
                  !temEntrada && styles.abaTextoInativo,
                ]}
              >
                Vistoria de Entrada {temEntrada ? '✓' : '(Pendente)'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.abaBotao,
                tipoSelecionado === 'saida' && styles.abaBotaoAtivo,
                !temSaida && styles.abaBotaoInativo,
              ]}
              onPress={() => temSaida && setTipoSelecionado('saida')}
              disabled={!temSaida}
            >
              <Ionicons
                name="exit-outline"
                size={16}
                color={tipoSelecionado === 'saida' ? '#FFFFFF' : CORES.textoMudo}
              />
              <Text
                style={[
                  styles.abaTexto,
                  tipoSelecionado === 'saida' && styles.abaTextoAtivo,
                  !temSaida && styles.abaTextoInativo,
                ]}
              >
                Vistoria de Saída {temSaida ? '✓' : '(Pendente)'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Conteúdo com Scroll */}
          <ScrollView
            style={styles.conteudoScroll}
            contentContainerStyle={styles.scrollContainerInterno}
            showsVerticalScrollIndicator={false}
          >
            {/* Cartão de Resumo da Vistoria */}
            <View style={styles.cartaoResumo}>
              <View style={styles.cartaoResumoTopo}>
                <View
                  style={[
                    styles.badgeTipo,
                    checklistAtual.tipo === 'entrada'
                      ? styles.badgeTipoEntrada
                      : styles.badgeTipoSaida,
                  ]}
                >
                  <Text style={styles.badgeTipoTexto}>
                    CHECKLIST DE {checklistAtual.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA'}
                  </Text>
                </View>

                <Text style={styles.dataPreenchimento}>
                  {new Date(checklistAtual.preenchidoEm).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>

              {/* Pendências Críticas */}
              {checklistAtual.pendenciasCriticas > 0 ? (
                <View style={styles.alertaPendenciasBox}>
                  <Ionicons name="warning" size={18} color={CORES.perigoTexto} />
                  <Text style={styles.alertaPendenciasTexto}>
                    {checklistAtual.pendenciasCriticas} item(ns) com ressalva de segurança
                  </Text>
                </View>
              ) : (
                <View style={styles.sucessoPendenciasBox}>
                  <Ionicons name="shield-checkmark" size={18} color={CORES.sucessoTexto} />
                  <Text style={styles.sucessoPendenciasTexto}>
                    Todos os itens de segurança aprovados
                  </Text>
                </View>
              )}

              {/* Métricas: Odômetro e Combustível */}
              <View style={styles.metricasLinha}>
                <View style={styles.metricaItem}>
                  <Text style={styles.metricaLabel}>Odômetro</Text>
                  <Text style={styles.metricaValor}>
                    {checklistAtual.km ? `${checklistAtual.km.toLocaleString('pt-BR')} km` : '0 km'}
                  </Text>
                </View>

                <View style={styles.metricaItem}>
                  <Text style={styles.metricaLabel}>Combustível ({nivelCombustivelPorcentagem}%)</Text>
                  <View style={styles.barraCombustivelFundo}>
                    <View
                      style={[
                        styles.barraCombustivelProgresso,
                        {
                          width: `${Math.max(5, nivelCombustivelPorcentagem)}%`,
                          backgroundColor: corBarraCombustivel(),
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>

              {/* Pertences Catalogados */}
              <View style={styles.secaoBloco}>
                <Text style={styles.secaoTituloItem}>Pertences no Veículo</Text>
                {checklistAtual.pertences && checklistAtual.pertences.length > 0 ? (
                  <View style={styles.chipsContainer}>
                    {checklistAtual.pertences.map((p, idx) => (
                      <View key={idx} style={styles.chipPertence}>
                        <Ionicons name="checkmark" size={13} color={CORES.sucessoTexto} />
                        <Text style={styles.chipPertenceTexto}>{p}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.textoVazioSecundario}>Nenhum pertence registrado.</Text>
                )}
              </View>

              {/* Observações Gerais */}
              {checklistAtual.observacoes ? (
                <View style={styles.secaoBloco}>
                  <Text style={styles.secaoTituloItem}>Observações da Recepção</Text>
                  <View style={styles.obsBox}>
                    <Text style={styles.obsTexto}>{checklistAtual.observacoes}</Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Avarias na Lataria */}
            <View style={styles.cartaoSecao}>
              <View style={styles.cartaoSecaoHeader}>
                <Ionicons name="car-outline" size={20} color={CORES.primariaClara} />
                <Text style={styles.cartaoSecaoTitulo}>
                  Avarias Catalogadas ({checklistAtual.avarias?.length || 0})
                </Text>
              </View>

              {checklistAtual.avarias && checklistAtual.avarias.length > 0 ? (
                <View style={styles.listaAvarias}>
                  {checklistAtual.avarias.map((avaria, index) => {
                    const regiaoRotulo = REGIOES_AVARIA.find((r) => r.id === avaria.regiao)?.rotulo || avaria.regiao;
                    const tipoRotulo = TIPOS_AVARIA.find((t) => t.id === avaria.tipo)?.rotulo || avaria.tipo;
                    const fotoUrlFinal = urlsResolvidas[avaria.fotoUrl] || avaria.fotoUrl;

                    return (
                      <View key={avaria.id || index} style={styles.cartaoAvaria}>
                        <View style={styles.avariaTopo}>
                          <View style={styles.avariaBadgesLinha}>
                            <View style={styles.badgeRegiao}>
                              <Text style={styles.badgeRegiaoTexto}>{regiaoRotulo}</Text>
                            </View>
                            <View style={styles.badgeTipoAvaria}>
                              <Text style={styles.badgeTipoAvariaTexto}>{tipoRotulo}</Text>
                            </View>
                          </View>
                        </View>

                        {avaria.descricao ? (
                          <Text style={styles.avariaDescricao}>{avaria.descricao}</Text>
                        ) : null}

                        {fotoUrlFinal ? (
                          <TouchableOpacity
                            onPress={() => setFotoAmpliadaUrl(fotoUrlFinal)}
                            style={styles.containerFotoAvaria}
                          >
                            <Image
                              source={{ uri: fotoUrlFinal }}
                              style={styles.fotoAvaria}
                              resizeMode="cover"
                            />
                            <View style={styles.badgeToqueFoto}>
                              <Ionicons name="expand" size={14} color="#FFFFFF" />
                              <Text style={styles.badgeToqueFotoTexto}>Toque para ampliar</Text>
                            </View>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.vazioAvariasBox}>
                  <Ionicons name="shield-checkmark-outline" size={28} color={CORES.sucessoTexto} />
                  <Text style={styles.vazioAvariasTexto}>
                    Nenhuma avaria ou dano de lataria registrado nesta vistoria.
                  </Text>
                </View>
              )}
            </View>

            {/* Itens de Vistoria (Perguntas Respondidas) */}
            <View style={styles.cartaoSecao}>
              <View style={styles.cartaoSecaoHeader}>
                <Ionicons name="list-outline" size={20} color={CORES.primariaClara} />
                <Text style={styles.cartaoSecaoTitulo}>
                  Itens Inspecionados ({checklistAtual.itens?.length || 0})
                </Text>
              </View>

              {Object.entries(secoesItens).map(([secaoKey, itens]) => {
                const rotuloSecao = ROTULOS_SECAO[secaoKey]?.titulo || secaoKey.toUpperCase();

                return (
                  <View key={secaoKey} style={styles.grupoSecao}>
                    <Text style={styles.tituloGrupoSecao}>{rotuloSecao}</Text>

                    {itens.map((item) => {
                      const respInfo = formatarResposta(item.resposta);
                      const fotoItemFinal = item.fotoUrl ? urlsResolvidas[item.fotoUrl] || item.fotoUrl : null;

                      return (
                        <View key={item.id || item.perguntaId} style={styles.itemLinha}>
                          <View style={styles.itemConteudo}>
                            <Text style={styles.itemPerguntaTexto}>
                              {item.pergunta}
                              {item.critico && <Text style={{ color: CORES.perigoTexto }}> *</Text>}
                            </Text>

                            {item.observacao ? (
                              <Text style={styles.itemObsTexto}>Nota: {item.observacao}</Text>
                            ) : null}

                            {fotoItemFinal ? (
                              <TouchableOpacity
                                onPress={() => setFotoAmpliadaUrl(fotoItemFinal)}
                                style={styles.miniaturaItemContainer}
                              >
                                <Image
                                  source={{ uri: fotoItemFinal }}
                                  style={styles.miniaturaItem}
                                  resizeMode="cover"
                                />
                                <Text style={styles.miniaturaItemTexto}>Ver foto</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>

                          <View style={[styles.badgeResposta, { backgroundColor: respInfo.fundo }]}>
                            <Ionicons name={respInfo.icone} size={14} color={respInfo.cor} />
                            <Text style={[styles.badgeRespostaTexto, { color: respInfo.cor }]}>
                              {respInfo.texto}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>

            {/* Assinatura do Cliente */}
            <View style={styles.cartaoSecao}>
              <View style={styles.cartaoSecaoHeader}>
                <Ionicons name="pencil-outline" size={20} color={CORES.primariaClara} />
                <Text style={styles.cartaoSecaoTitulo}>Assinatura do Cliente</Text>
              </View>

              {checklistAtual.assinaturaUrl ? (
                <View style={styles.assinaturaContainer}>
                  {urlsResolvidas[checklistAtual.assinaturaUrl] ? (
                    <Image
                      source={{ uri: urlsResolvidas[checklistAtual.assinaturaUrl] }}
                      style={styles.assinaturaImagem}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.assinaturaCarregando}>
                      <ActivityIndicator size="small" color={CORES.primariaClara} />
                      <Text style={styles.assinaturaCarregandoTexto}>Carregando assinatura...</Text>
                    </View>
                  )}
                  <View style={styles.assinaturaLinhaRodape}>
                    <Ionicons name="checkmark-done-circle" size={16} color={CORES.sucessoTexto} />
                    <Text style={styles.assinaturaLegenda}>
                      Assinatura digital colhida no aparelho celular
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.textoVazioSecundario}>
                  Sem assinatura gravada para este checklist.
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Rodapé com Ações */}
          <View style={[styles.rodapeAcoes, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            {temEntrada && !temSaida && onIniciarSaida && (
              <TouchableOpacity
                style={styles.botaoIniciarSaida}
                onPress={() => {
                  onFechar();
                  onIniciarSaida(os);
                }}
              >
                <Ionicons name="exit-outline" size={18} color="#FFFFFF" />
                <Text style={styles.botaoIniciarSaidaTexto}>Preencher Checklist de Saída</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.botaoFechar} onPress={onFechar}>
              <Text style={styles.botaoFecharTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Modal Foto em Tela Cheia */}
      {fotoAmpliadaUrl && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setFotoAmpliadaUrl(null)}>
          <View style={styles.fundoFullscreen}>
            <TouchableOpacity
              style={styles.botaoFecharFullscreen}
              onPress={() => setFotoAmpliadaUrl(null)}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: fotoAmpliadaUrl }}
              style={styles.imagemFullscreen}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  containerModal: {
    backgroundColor: CORES.fundo,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '92%',
    display: 'flex',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
    backgroundColor: CORES.superficie,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerInfo: {
    flex: 1,
    marginRight: 10,
  },
  headerPlacaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  numeroOsText: {
    color: CORES.primariaClara,
    fontSize: 15,
    fontWeight: '800',
  },
  veiculoDescricaoText: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  clienteNomeText: {
    color: CORES.textoSecundario,
    fontSize: 13,
    marginTop: 1,
  },
  botaoFecharIcone: {
    padding: 4,
  },
  abasContainer: {
    flexDirection: 'row',
    backgroundColor: CORES.superficie,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  abaBotao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: CORES.superficieClara,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  abaBotaoAtivo: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primariaClara,
  },
  abaBotaoInativo: {
    opacity: 0.45,
  },
  abaTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '700',
  },
  abaTextoAtivo: {
    color: '#FFFFFF',
  },
  abaTextoInativo: {
    color: CORES.textoMudo,
  },
  conteudoScroll: {
    flex: 1,
  },
  scrollContainerInterno: {
    padding: 16,
    gap: 14,
  },
  cartaoResumo: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  cartaoResumoTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeTipo: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeTipoEntrada: {
    backgroundColor: '#1E3A8A',
  },
  badgeTipoSaida: {
    backgroundColor: '#064E3B',
  },
  badgeTipoTexto: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dataPreenchimento: {
    color: CORES.textoMudo,
    fontSize: 12,
  },
  alertaPendenciasBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  alertaPendenciasTexto: {
    color: CORES.perigoTexto,
    fontSize: 13,
    fontWeight: '700',
  },
  sucessoPendenciasBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  sucessoPendenciasTexto: {
    color: CORES.sucessoTexto,
    fontSize: 13,
    fontWeight: '700',
  },
  metricasLinha: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  metricaItem: {
    flex: 1,
    backgroundColor: CORES.superficieClara,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  metricaLabel: {
    color: CORES.textoMudo,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  metricaValor: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '800',
  },
  barraCombustivelFundo: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 4,
  },
  barraCombustivelProgresso: {
    height: '100%',
    borderRadius: 5,
  },
  secaoBloco: {
    marginTop: 10,
  },
  secaoTituloItem: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipPertence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: CORES.superficieClara,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  chipPertenceTexto: {
    color: CORES.texto,
    fontSize: 12,
  },
  obsBox: {
    backgroundColor: CORES.superficieClara,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: CORES.primariaClara,
  },
  obsTexto: {
    color: CORES.texto,
    fontSize: 13,
    lineHeight: 18,
  },
  textoVazioSecundario: {
    color: CORES.textoMudo,
    fontSize: 12,
    fontStyle: 'italic',
  },
  cartaoSecao: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  cartaoSecaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  cartaoSecaoTitulo: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '800',
  },
  listaAvarias: {
    gap: 10,
  },
  cartaoAvaria: {
    backgroundColor: CORES.superficieClara,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  avariaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  avariaBadgesLinha: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badgeRegiao: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  badgeRegiaoTexto: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTipoAvaria: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  badgeTipoAvariaTexto: {
    color: CORES.alertaTexto,
    fontSize: 11,
    fontWeight: '700',
  },
  avariaDescricao: {
    color: CORES.texto,
    fontSize: 13,
    marginBottom: 8,
  },
  containerFotoAvaria: {
    position: 'relative',
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  fotoAvaria: {
    width: '100%',
    height: '100%',
  },
  badgeToqueFoto: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeToqueFotoTexto: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  vazioAvariasBox: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  vazioAvariasTexto: {
    color: CORES.sucessoTexto,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  grupoSecao: {
    marginBottom: 14,
  },
  tituloGrupoSecao: {
    color: CORES.primariaClara,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  itemLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  itemConteudo: {
    flex: 1,
  },
  itemPerguntaTexto: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '600',
  },
  itemObsTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  miniaturaItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  miniaturaItem: {
    width: 34,
    height: 34,
    borderRadius: 4,
  },
  miniaturaItemTexto: {
    color: CORES.primariaClara,
    fontSize: 11,
    fontWeight: '700',
  },
  badgeResposta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeRespostaTexto: {
    fontSize: 11,
    fontWeight: '800',
  },
  assinaturaContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  assinaturaImagem: {
    width: '100%',
    height: 120,
  },
  assinaturaCarregando: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  assinaturaCarregandoTexto: {
    color: '#000000',
    fontSize: 12,
  },
  assinaturaLinhaRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    width: '100%',
    justifyContent: 'center',
  },
  assinaturaLegenda: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  rodapeAcoes: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    backgroundColor: CORES.superficie,
    gap: 8,
  },
  botaoIniciarSaida: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  botaoIniciarSaidaTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  botaoFechar: {
    backgroundColor: CORES.superficieClara,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  botaoFecharTexto: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
  },
  fundoFullscreen: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  botaoFecharFullscreen: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    padding: 6,
  },
  imagemFullscreen: {
    width: '100%',
    height: '80%',
  },
});
