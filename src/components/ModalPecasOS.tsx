import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  RespostaOSResumo,
  RespostaItemPecaOS,
  RespostaPeca,
  PedidoItemPecaOS,
} from '../types';
import { CORES } from '../constants';
import { pecasOSApi } from '../api/pecasOSApi';
import { estoqueApi } from '../api/estoqueApi';
import { extrairMensagemErro } from '../api/clienteHttp';
import { PlacaVeiculo } from './PlacaVeiculo';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ModalConfirmarLancamentoPeca } from './ModalConfirmarLancamentoPeca';

interface ModalPecasOSProps {
  visivel: boolean;
  os: RespostaOSResumo | null;
  aoFechar: () => void;
  aoAtualizarOS?: () => void;
}

export const ModalPecasOS: React.FC<ModalPecasOSProps> = ({
  visivel,
  os,
  aoFechar,
  aoAtualizarOS,
}) => {
  const insets = useSafeAreaInsets();

  const [itens, setItens] = useState<RespostaItemPecaOS[]>([]);
  const [totalPecas, setTotalPecas] = useState<number>(0);
  const [carregando, setCarregando] = useState<boolean>(false);
  const [recarregando, setRecarregando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  // Estados dos modais auxiliares
  const [scannerVisivel, setScannerVisivel] = useState<boolean>(false);
  const [modalConfirmarVisivel, setModalConfirmarVisivel] = useState<boolean>(false);
  const [pecaParaConfirmar, setPecaParaConfirmar] = useState<RespostaPeca | null>(null);
  const [salvandoLancamento, setSalvandoLancamento] = useState<boolean>(false);

  // Estado do modal de Busca no Catálogo
  const [modalCatalogoVisivel, setModalCatalogoVisivel] = useState<boolean>(false);
  const [termoBuscaCatalogo, setTermoBuscaCatalogo] = useState<string>('');
  const [resultadoCatalogo, setResultadoCatalogo] = useState<RespostaPeca[]>([]);
  const [buscandoCatalogo, setBuscandoCatalogo] = useState<boolean>(false);

  // ID do item com ação em andamento (alterar qtd ou aplicar)
  const [itemEmAcaoId, setItemEmAcaoId] = useState<string | null>(null);

  const carregarPecasOS = useCallback(async () => {
    if (!os?.id) return;
    setCarregando(true);
    setErro(null);
    try {
      const [lista, total] = await Promise.all([
        pecasOSApi.listarPecas(os.id),
        pecasOSApi.obterTotalPecas(os.id).catch(() => 0),
      ]);
      setItens(lista || []);
      // Se a API de total não retornou ou deu 0, calcula a soma local
      if (total > 0) {
        setTotalPecas(total);
      } else {
        const somaLocal = (lista || []).reduce(
          (acc, item) => acc + (item.total || item.precoUnitario * item.quantidade || 0),
          0
        );
        setTotalPecas(somaLocal);
      }
    } catch (e) {
      setErro(extrairMensagemErro(e));
    } finally {
      setCarregando(false);
      setRecarregando(false);
    }
  }, [os?.id]);

  useEffect(() => {
    if (visivel && os?.id) {
      carregarPecasOS();
    } else {
      setItens([]);
      setTotalPecas(0);
      setErro(null);
    }
  }, [visivel, os?.id, carregarPecasOS]);

  const onRefresh = () => {
    setRecarregando(true);
    carregarPecasOS();
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor || 0);
  };

  // Trata leitura do código de barras
  const handleCodigoEscaneado = async (codigoLido: string) => {
    setScannerVisivel(false);
    const codigoLimpo = codigoLido.trim();
    if (!codigoLimpo) return;

    setCarregando(true);
    try {
      const resultados = await estoqueApi.buscarPecas(codigoLimpo);
      if (resultados && resultados.length > 0) {
        // Tenta encontrar correspondência exata por GTIN, OEM ou código interno
        const correspondenciaExata = resultados.find(
          (p) =>
            p.gtin === codigoLimpo ||
            p.codigoInterno.toLowerCase() === codigoLimpo.toLowerCase() ||
            p.codigoOem?.toLowerCase() === codigoLimpo.toLowerCase()
        );
        const pecaEncontrada = correspondenciaExata || resultados[0];
        setPecaParaConfirmar(pecaEncontrada);
        setModalConfirmarVisivel(true);
      } else {
        Alert.alert(
          'Peça não encontrada',
          `Nenhuma peça correspondente ao código "${codigoLimpo}" foi localizada no estoque desta oficina.`
        );
      }
    } catch (e) {
      Alert.alert('Erro na Consulta', extrairMensagemErro(e));
    } finally {
      setCarregando(false);
    }
  };

  // Busca de peças para o Catálogo Modal
  const buscarNoCatalogo = useCallback(async (termo: string) => {
    setBuscandoCatalogo(true);
    try {
      const lista = await estoqueApi.buscarPecas(termo);
      setResultadoCatalogo(lista || []);
    } catch (e) {
      console.warn('Erro ao buscar catálogo:', e);
      setResultadoCatalogo([]);
    } finally {
      setBuscandoCatalogo(false);
    }
  }, []);

  useEffect(() => {
    if (modalCatalogoVisivel) {
      const handler = setTimeout(() => {
        buscarNoCatalogo(termoBuscaCatalogo);
      }, 350);
      return () => clearTimeout(handler);
    }
  }, [modalCatalogoVisivel, termoBuscaCatalogo, buscarNoCatalogo]);

  const handleSelecionarDoCatalogo = (peca: RespostaPeca) => {
    setModalCatalogoVisivel(false);
    setPecaParaConfirmar(peca);
    setModalConfirmarVisivel(true);
  };

  // Confirmação do lançamento da peça na OS
  const handleConfirmarLancamento = async (peca: RespostaPeca, quantidade: number) => {
    if (!os?.id) return;
    setSalvandoLancamento(true);
    try {
      const pedido: PedidoItemPecaOS = {
        pecaId: peca.id,
        quantidade,
        precoUnitario: peca.preco || null,
        desconto: null,
      };

      const resultado = await pecasOSApi.lancarPeca(os.id, pedido);

      setModalConfirmarVisivel(false);
      setPecaParaConfirmar(null);
      await carregarPecasOS();
      aoAtualizarOS?.();

      if (resultado.sugerirAguardandoPeca || resultado.status === 'aguardando') {
        Alert.alert(
          'Item Lançado com Aviso',
          `A peça "${peca.descricao}" foi adicionada à OS #${os.numero} com status "Aguardando Peça" devido a saldo insuficiente em estoque.`
        );
      }
    } catch (e) {
      Alert.alert('Erro ao Lançar Peça', extrairMensagemErro(e));
    } finally {
      setSalvandoLancamento(false);
    }
  };

  // Alteração de quantidade de item já existente
  const handleAlterarQuantidade = async (item: RespostaItemPecaOS, delta: number) => {
    if (!os?.id) return;
    const novaQtd = (item.quantidade || 1) + delta;

    if (novaQtd <= 0) {
      handleRemoverItem(item);
      return;
    }

    setItemEmAcaoId(item.id);
    try {
      await pecasOSApi.alterarQuantidade(os.id, item.id, novaQtd);
      await carregarPecasOS();
      aoAtualizarOS?.();
    } catch (e) {
      Alert.alert('Erro ao Atualizar', extrairMensagemErro(e));
    } finally {
      setItemEmAcaoId(null);
    }
  };

  // Aplicação da peça no veículo (baixa física)
  const handleAplicarItem = (item: RespostaItemPecaOS) => {
    if (!os?.id) return;

    Alert.alert(
      'Aplicar Peça no Veículo',
      `Confirma a aplicação física de "${item.descricao}" no veículo? Esta ação dará saída definitiva do item no estoque.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Aplicação',
          onPress: async () => {
            setItemEmAcaoId(item.id);
            try {
              await pecasOSApi.aplicarPeca(os.id, item.id);
              await carregarPecasOS();
              aoAtualizarOS?.();
              Alert.alert('Sucesso', 'Peça marcada como aplicada no veículo com sucesso!');
            } catch (e) {
              Alert.alert('Erro ao Aplicar', extrairMensagemErro(e));
            } finally {
              setItemEmAcaoId(null);
            }
          },
        },
      ]
    );
  };

  // Remoção de peça da OS
  const handleRemoverItem = (item: RespostaItemPecaOS) => {
    if (!os?.id) return;

    Alert.alert(
      'Remover Peça da OS',
      `Deseja realmente remover "${item.descricao}" da OS #${os.numero}? A reserva voltará para o estoque.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setItemEmAcaoId(item.id);
            try {
              await pecasOSApi.removerPeca(os.id, item.id);
              await carregarPecasOS();
              aoAtualizarOS?.();
            } catch (e) {
              Alert.alert('Erro ao Remover', extrairMensagemErro(e));
            } finally {
              setItemEmAcaoId(null);
            }
          },
        },
      ]
    );
  };

  const renderStatusItem = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'aplicado') {
      return (
        <View style={[styles.statusBadge, styles.statusAplicado]}>
          <Ionicons name="checkmark-circle" size={13} color="#4ADE80" />
          <Text style={[styles.statusTexto, { color: '#4ADE80' }]}>Montada / Aplicada</Text>
        </View>
      );
    }
    if (s === 'aguardando') {
      return (
        <View style={[styles.statusBadge, styles.statusAguardando]}>
          <Ionicons name="time" size={13} color="#FBBF24" />
          <Text style={[styles.statusTexto, { color: '#FBBF24' }]}>Sem Saldo / Aguardando</Text>
        </View>
      );
    }
    if (s === 'cancelado') {
      return (
        <View style={[styles.statusBadge, styles.statusCancelado]}>
          <Ionicons name="close-circle" size={13} color="#F87171" />
          <Text style={[styles.statusTexto, { color: '#F87171' }]}>Cancelado</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, styles.statusReservado]}>
        <Ionicons name="bookmark" size={13} color="#93C5FD" />
        <Text style={[styles.statusTexto, { color: '#93C5FD' }]}>Reservada</Text>
      </View>
    );
  };

  const renderItemPeca = ({ item }: { item: RespostaItemPecaOS }) => {
    const ocupado = itemEmAcaoId === item.id;
    const jaAplicado = (item.status || '').toLowerCase() === 'aplicado';

    return (
      <View style={styles.cardItem}>
        {/* Topo do Item */}
        <View style={styles.itemTopo}>
          <View style={styles.itemCodigoContainer}>
            <Text style={styles.itemCodigoInterno}>{item.codigoInterno}</Text>
            {renderStatusItem(item.status)}
          </View>
          <TouchableOpacity
            style={styles.botaoLixeira}
            onPress={() => handleRemoverItem(item)}
            disabled={ocupado}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={CORES.perigoTexto} />
          </TouchableOpacity>
        </View>

        {/* Descrição */}
        <Text style={styles.itemDescricao}>{item.descricao}</Text>

        {/* Localização na Prateleira */}
        {item.localizacao ? (
          <View style={styles.itemLocalizacaoBox}>
            <Ionicons name="location-sharp" size={14} color="#38BDF8" />
            <Text style={styles.itemLocalizacaoTexto}>{item.localizacao}</Text>
          </View>
        ) : null}

        {/* Valores e Quantidade */}
        <View style={styles.itemValoresLinha}>
          <View>
            <Text style={styles.itemValorUnitario}>
              Unit: {formatarMoeda(item.precoUnitario)}
            </Text>
            <Text style={styles.itemValorTotal}>
              Total: {formatarMoeda(item.total || item.precoUnitario * item.quantidade)}
            </Text>
          </View>

          {/* Ajuste de Quantidade */}
          <View style={styles.controlesQtdLinha}>
            <TouchableOpacity
              style={styles.btnAjusteQtd}
              onPress={() => handleAlterarQuantidade(item, -1)}
              disabled={ocupado}
            >
              <Ionicons name="remove" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.valorQtdBox}>
              <Text style={styles.valorQtdTexto}>
                {item.quantidade} {item.unidade || 'UN'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.btnAjusteQtd}
              onPress={() => handleAlterarQuantidade(item, 1)}
              disabled={ocupado}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Botão de Ação: Aplicar no Veículo */}
        <View style={styles.itemAcoesLinha}>
          {jaAplicado ? (
            <View style={styles.avisoJaAplicado}>
              <Ionicons name="checkmark-done" size={16} color="#4ADE80" />
              <Text style={styles.avisoJaAplicadoTexto}>
                Peça baixada do estoque e montada no veículo
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.botaoAplicar}
              onPress={() => handleAplicarItem(item)}
              disabled={ocupado}
            >
              {ocupado ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="build" size={16} color="#FFFFFF" />
                  <Text style={styles.botaoAplicarTexto}>Aplicar no Veículo</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (!os) return null;

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent={false}
      onRequestClose={aoFechar}
    >
      <View style={styles.container}>
        {/* Cabeçalho Superior Fixo */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerLinha}>
            <View style={styles.headerInfoVeiculo}>
              <PlacaVeiculo placa={os.placa} tamanho="pequeno" />
              <View style={styles.headerTextos}>
                <View style={styles.headerOSTituloLinha}>
                  <Text style={styles.headerOSTitulo}>OS #{os.numero}</Text>
                  {os.boxNome ? (
                    <Text style={styles.headerBoxTexto}>Box: {os.boxNome}</Text>
                  ) : null}
                </View>
                <Text style={styles.headerVeiculoTexto} numberOfLines={1}>
                  {os.veiculoDescricao}
                </Text>
                <Text style={styles.headerClienteTexto} numberOfLines={1}>
                  {os.clienteNome}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.botaoFecharHeader}
              onPress={aoFechar}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Botões Principais de Lançamento */}
          <View style={styles.botoesLancamentoLinha}>
            <TouchableOpacity
              style={styles.botaoBipar}
              onPress={() => setScannerVisivel(true)}
            >
              <Ionicons name="barcode-outline" size={20} color="#FFFFFF" />
              <Text style={styles.botaoBiparTexto}>Bipar Código de Barras</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botaoBuscarCatalogo}
              onPress={() => setModalCatalogoVisivel(true)}
            >
              <Ionicons name="search" size={18} color="#FFFFFF" />
              <Text style={styles.botaoBuscarCatalogoTexto}>Buscar Peça</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mensagem de Erro */}
        {erro && (
          <View style={styles.erroBox}>
            <Ionicons name="alert-circle" size={20} color={CORES.perigoTexto} />
            <Text style={styles.erroTexto}>{erro}</Text>
            <TouchableOpacity onPress={carregarPecasOS} style={styles.botaoTentarNovamente}>
              <Text style={styles.botaoTentarNovamenteTexto}>Tentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Lista de Peças da OS */}
        {carregando && !recarregando ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={CORES.primaria} />
            <Text style={styles.loadingTexto}>Carregando peças da Ordem de Serviço...</Text>
          </View>
        ) : (
          <FlatList
            data={itens}
            keyExtractor={(item) => item.id}
            renderItem={renderItemPeca}
            contentContainerStyle={[
              styles.listaConteudo,
              { paddingBottom: insets.bottom + 90 },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={recarregando}
                onRefresh={onRefresh}
                tintColor={CORES.primariaClara}
                colors={[CORES.primaria]}
              />
            }
            ListEmptyComponent={
              <View style={styles.vazioContainer}>
                <Ionicons name="cube-outline" size={64} color={CORES.borda} />
                <Text style={styles.vazioTitulo}>Nenhuma peça lançada nesta OS</Text>
                <Text style={styles.vazioSubtitulo}>
                  Toque em "Bipar Código de Barras" para ler a etiqueta da prateleira ou "Buscar Peça" para localizar no catálogo.
                </Text>
              </View>
            }
          />
        )}

        {/* Rodapé Totalizador Fixo */}
        <View style={[styles.rodapeTotalizador, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.infoTotalizador}>
            <Text style={styles.totalizadorLabel}>TOTAL DE PEÇAS ({itens.length})</Text>
            <Text style={styles.totalizadorValor}>{formatarMoeda(totalPecas)}</Text>
          </View>

          <TouchableOpacity style={styles.botaoConcluir} onPress={aoFechar}>
            <Text style={styles.botaoConcluirTexto}>Fechar</Text>
          </TouchableOpacity>
        </View>

        {/* Modal Leitor de Código de Barras */}
        <BarcodeScannerModal
          visivel={scannerVisivel}
          aoFechar={() => setScannerVisivel(false)}
          aoEscanear={handleCodigoEscaneado}
        />

        {/* Modal Confirmação de Lançamento */}
        <ModalConfirmarLancamentoPeca
          visivel={modalConfirmarVisivel}
          peca={pecaParaConfirmar}
          os={os}
          aoFechar={() => {
            setModalConfirmarVisivel(false);
            setPecaParaConfirmar(null);
          }}
          aoConfirmar={handleConfirmarLancamento}
          carregando={salvandoLancamento}
        />

        {/* Modal Busca no Catálogo */}
        <Modal
          visible={modalCatalogoVisivel}
          animationType="slide"
          transparent
          onRequestClose={() => setModalCatalogoVisivel(false)}
        >
          <View style={styles.fundoModalCatalogo}>
            <View style={styles.cardModalCatalogo}>
              <View style={styles.headerModalCatalogo}>
                <Text style={styles.tituloModalCatalogo}>Catálogo de Peças</Text>
                <TouchableOpacity onPress={() => setModalCatalogoVisivel(false)}>
                  <Ionicons name="close" size={24} color={CORES.texto} />
                </TouchableOpacity>
              </View>

              <View style={styles.buscaCatalogoContainer}>
                <Ionicons name="search" size={18} color={CORES.textoMudo} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.inputBuscaCatalogo}
                  placeholder="Buscar por descrição, código ou marca..."
                  placeholderTextColor={CORES.textoMudo}
                  value={termoBuscaCatalogo}
                  onChangeText={setTermoBuscaCatalogo}
                  autoFocus
                />
                {termoBuscaCatalogo.length > 0 && (
                  <TouchableOpacity onPress={() => setTermoBuscaCatalogo('')}>
                    <Ionicons name="close-circle" size={18} color={CORES.textoMudo} />
                  </TouchableOpacity>
                )}
              </View>

              {buscandoCatalogo ? (
                <View style={styles.loadingCatalogo}>
                  <ActivityIndicator size="small" color={CORES.primaria} />
                  <Text style={styles.loadingCatalogoTexto}>Pesquisando estoque...</Text>
                </View>
              ) : (
                <FlatList
                  data={resultadoCatalogo}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingVertical: 8, gap: 10 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.cardItemCatalogo}
                      onPress={() => handleSelecionarDoCatalogo(item)}
                    >
                      <View style={styles.topoItemCatalogo}>
                        <Text style={styles.codItemCatalogo}>{item.codigoInterno}</Text>
                        <Text
                          style={[
                            styles.saldoItemCatalogo,
                            { color: item.disponivel > 0 ? '#4ADE80' : '#F87171' },
                          ]}
                        >
                          Disp: {item.disponivel} {item.unidade || 'UN'}
                        </Text>
                      </View>
                      <Text style={styles.descItemCatalogo}>{item.descricao}</Text>
                      <View style={styles.rodapeItemCatalogo}>
                        <Text style={styles.locItemCatalogo}>
                          📍 {item.localizacao || 'Sem prateleira'}
                        </Text>
                        <Text style={styles.precoItemCatalogo}>
                          {formatarMoeda(item.preco)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={styles.vazioCatalogoContainer}>
                      <Text style={styles.vazioCatalogoTexto}>
                        Nenhuma peça encontrada para o termo pesquisado.
                      </Text>
                    </View>
                  }
                />
              )}
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  header: {
    backgroundColor: CORES.superficie,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
    gap: 12,
  },
  headerLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInfoVeiculo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTextos: {
    flex: 1,
  },
  headerOSTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerOSTitulo: {
    color: CORES.primariaClara,
    fontSize: 16,
    fontWeight: '800',
  },
  headerBoxTexto: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  headerVeiculoTexto: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
  },
  headerClienteTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
  },
  botaoFecharHeader: {
    padding: 6,
  },
  botoesLancamentoLinha: {
    flexDirection: 'row',
    gap: 10,
  },
  botaoBipar: {
    flex: 3,
    flexDirection: 'row',
    backgroundColor: CORES.primaria,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 3,
  },
  botaoBiparTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  botaoBuscarCatalogo: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: CORES.superficieClara,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  botaoBuscarCatalogoTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  erroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.perigoFundo,
    padding: 12,
    margin: 16,
    borderRadius: 8,
    gap: 8,
  },
  erroTexto: {
    color: CORES.perigoTexto,
    fontSize: 13,
    flex: 1,
  },
  botaoTentarNovamente: {
    backgroundColor: CORES.perigo,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  botaoTentarNovamenteTexto: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
    marginTop: 12,
  },
  listaConteudo: {
    padding: 16,
    gap: 12,
  },
  cardItem: {
    backgroundColor: CORES.superficie,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 10,
    elevation: 2,
  },
  itemTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCodigoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  itemCodigoInterno: {
    color: CORES.primariaClara,
    fontSize: 13,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  statusAplicado: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  statusAguardando: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusReservado: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
  statusCancelado: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusTexto: {
    fontSize: 11,
    fontWeight: '700',
  },
  botaoLixeira: {
    padding: 4,
  },
  itemDescricao: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  itemLocalizacaoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#0C4A6E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  itemLocalizacaoTexto: {
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '800',
  },
  itemValoresLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
  },
  itemValorUnitario: {
    color: CORES.textoMudo,
    fontSize: 11,
    fontWeight: '600',
  },
  itemValorTotal: {
    color: '#4ADE80',
    fontSize: 15,
    fontWeight: '800',
  },
  controlesQtdLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CORES.fundo,
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  btnAjusteQtd: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: CORES.superficieClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valorQtdBox: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valorQtdTexto: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '800',
  },
  itemAcoesLinha: {
    paddingTop: 4,
  },
  botaoAplicar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  botaoAplicarTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  avisoJaAplicado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  avisoJaAplicadoTexto: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600',
  },
  rodapeTotalizador: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: CORES.superficie,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  infoTotalizador: {
    flex: 1,
  },
  totalizadorLabel: {
    color: CORES.textoMudo,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  totalizadorValor: {
    color: '#4ADE80',
    fontSize: 20,
    fontWeight: '900',
  },
  botaoConcluir: {
    backgroundColor: CORES.superficieClara,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  botaoConcluirTexto: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
  },
  vazioContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  vazioTitulo: {
    color: CORES.texto,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  vazioSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  fundoModalCatalogo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  cardModalCatalogo: {
    backgroundColor: CORES.superficie,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  headerModalCatalogo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  tituloModalCatalogo: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
  },
  buscaCatalogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  inputBuscaCatalogo: {
    flex: 1,
    color: CORES.texto,
    fontSize: 14,
  },
  loadingCatalogo: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  loadingCatalogoTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
  },
  cardItemCatalogo: {
    backgroundColor: CORES.fundo,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 6,
  },
  topoItemCatalogo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  codItemCatalogo: {
    color: CORES.primariaClara,
    fontSize: 13,
    fontWeight: '800',
  },
  saldoItemCatalogo: {
    fontSize: 12,
    fontWeight: '700',
  },
  descItemCatalogo: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '600',
  },
  rodapeItemCatalogo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  locItemCatalogo: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  precoItemCatalogo: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '800',
  },
  vazioCatalogoContainer: {
    padding: 30,
    alignItems: 'center',
  },
  vazioCatalogoTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
  },
});
