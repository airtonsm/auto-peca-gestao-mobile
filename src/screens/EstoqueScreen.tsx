import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { estoqueApi } from '../api/estoqueApi';
import { osApi } from '../api/osApi';
import { pecasOSApi } from '../api/pecasOSApi';
import { RespostaPeca, RespostaOSResumo } from '../types';
import { CORES } from '../constants';
import { extrairMensagemErro } from '../api/clienteHttp';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { PlacaVeiculo } from '../components/PlacaVeiculo';
import { ModalConfirmarLancamentoPeca } from '../components/ModalConfirmarLancamentoPeca';

export const EstoqueScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [termoBusca, setTermoBusca] = useState('');
  const [pecas, setPecas] = useState<RespostaPeca[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [scannerVisivel, setScannerVisivel] = useState(false);
  const [pecaSelecionada, setPecaSelecionada] = useState<RespostaPeca | null>(null);

  // Estados para lançamento da peça em uma OS aberta
  const [modalSelecaoOSVisivel, setModalSelecaoOSVisivel] = useState(false);
  const [ordensServico, setOrdensServico] = useState<RespostaOSResumo[]>([]);
  const [carregandoOS, setCarregandoOS] = useState(false);
  const [buscaOS, setBuscaOS] = useState('');
  const [pecaParaLancar, setPecaParaLancar] = useState<RespostaPeca | null>(null);
  const [osSelecionadaParaLancar, setOsSelecionadaParaLancar] = useState<RespostaOSResumo | null>(null);
  const [modalConfirmarLancamentoVisivel, setModalConfirmarLancamentoVisivel] = useState(false);
  const [salvandoLancamento, setSalvandoLancamento] = useState(false);

  const abrirSelecaoOSParaPeca = async (peca: RespostaPeca) => {
    setPecaParaLancar(peca);
    setModalSelecaoOSVisivel(true);
    setCarregandoOS(true);
    try {
      const lista = await osApi.listarOS(true);
      setOrdensServico(lista || []);
    } catch (e) {
      Alert.alert('Erro ao carregar veículos', extrairMensagemErro(e));
    } finally {
      setCarregandoOS(false);
    }
  };

  const handleSelecionarOS = (os: RespostaOSResumo) => {
    setOsSelecionadaParaLancar(os);
    setModalSelecaoOSVisivel(false);
    setModalConfirmarLancamentoVisivel(true);
  };

  const handleConfirmarLancamentoPeca = async (peca: RespostaPeca, quantidade: number) => {
    if (!osSelecionadaParaLancar) return;
    setSalvandoLancamento(true);
    try {
      const resultado = await pecasOSApi.lancarPeca(osSelecionadaParaLancar.id, {
        pecaId: peca.id,
        quantidade,
        precoUnitario: peca.preco || null,
        desconto: null,
      });

      setModalConfirmarLancamentoVisivel(false);
      setPecaParaLancar(null);
      setOsSelecionadaParaLancar(null);

      // Atualiza o estoque para refletir a nova reserva
      carregarPecas(termoBusca);

      if (resultado.sugerirAguardandoPeca || resultado.status === 'aguardando') {
        Alert.alert(
          'Peça Lançada com Aviso',
          `"${peca.descricao}" lançada na OS #${osSelecionadaParaLancar.numero} com status "Aguardando Peça" (saldo insuficiente).`
        );
      } else {
        Alert.alert(
          'Sucesso!',
          `"${peca.descricao}" (${quantidade} ${peca.unidade || 'UN'}) vinculada à OS #${osSelecionadaParaLancar.numero} (${osSelecionadaParaLancar.placa}) com sucesso!`
        );
      }
    } catch (e) {
      Alert.alert('Erro ao Lançar Peça', extrairMensagemErro(e));
    } finally {
      setSalvandoLancamento(false);
    }
  };

  const ordensServicoFiltradas = useMemo(() => {
    if (!buscaOS.trim()) return ordensServico;
    const termo = buscaOS.toLowerCase().trim();
    return ordensServico.filter((os) => {
      const placa = (os.placa || '').toLowerCase();
      const cliente = (os.clienteNome || '').toLowerCase();
      const veiculo = (os.veiculoDescricao || '').toLowerCase();
      const numero = String(os.numero);
      return (
        placa.includes(termo) ||
        cliente.includes(termo) ||
        veiculo.includes(termo) ||
        numero.includes(termo)
      );
    });
  }, [ordensServico, buscaOS]);

  const carregarPecas = useCallback(async (termo: string = '') => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await estoqueApi.buscarPecas(termo);
      setPecas(dados || []);
    } catch (e) {
      setErro(extrairMensagemErro(e));
    } finally {
      setCarregando(false);
      setRecarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarPecas();
  }, [carregarPecas]);

  // Debounce na busca por texto
  useEffect(() => {
    const handler = setTimeout(() => {
      carregarPecas(termoBusca);
    }, 400);

    return () => clearTimeout(handler);
  }, [termoBusca, carregarPecas]);

  const onRefresh = () => {
    setRecarregando(true);
    carregarPecas(termoBusca);
  };

  const handleCodigoEscaneado = (codigoLido: string) => {
    setTermoBusca(codigoLido);
    carregarPecas(codigoLido);
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor || 0);
  };

  const renderItemPeca = ({ item }: { item: RespostaPeca }) => {
    const temSaldo = (item.disponivel || 0) > 0;

    return (
      <TouchableOpacity
        style={styles.cardPeca}
        activeOpacity={0.7}
        onPress={() => setPecaSelecionada(item)}
      >
        <View style={styles.cardTopoLinha}>
          <View style={styles.codigosContainer}>
            <Text style={styles.codigoInternoText}>{item.codigoInterno}</Text>
            {item.fabricante && (
              <Text style={styles.fabricanteText}> • {item.fabricante}</Text>
            )}
          </View>

          {/* Saldo Disponível em Destaque */}
          <View
            style={[
              styles.badgeSaldo,
              temSaldo ? styles.badgeSaldoPositivo : styles.badgeSaldoZero,
            ]}
          >
            <Ionicons
              name={temSaldo ? 'checkmark-circle' : 'alert-circle'}
              size={14}
              color={temSaldo ? CORES.sucessoTexto : CORES.perigoTexto}
            />
            <Text
              style={[
                styles.textoSaldo,
                { color: temSaldo ? CORES.sucessoTexto : CORES.perigoTexto },
              ]}
            >
              Disp: {item.disponivel} {item.unidade || 'UN'}
            </Text>
          </View>
        </View>

        {/* Descrição Principal */}
        <Text style={styles.descricaoPeca} numberOfLines={2}>
          {item.descricao}
        </Text>

        {/* Rodapé do Card com Localização e Preço */}
        <View style={styles.cardRodape}>
          {/* Localização / Prateleira em Destaque */}
          <View style={styles.localizacaoContainer}>
            <Ionicons name="location-sharp" size={16} color="#38BDF8" />
            <Text style={styles.localizacaoTexto} numberOfLines={1}>
              {item.localizacao || 'Sem prateleira definida'}
            </Text>
          </View>

          {/* Preço de Venda */}
          <Text style={styles.precoText}>{formatarMoeda(item.preco)}</Text>
        </View>

        {/* Códigos Adicionais (OEM / GTIN) */}
        {(item.codigoOem || item.gtin) && (
          <View style={styles.extrasLinha}>
            {item.codigoOem && (
              <Text style={styles.extraTexto}>OEM: {item.codigoOem}</Text>
            )}
            {item.gtin && (
              <Text style={styles.extraTexto}>EAN/GTIN: {item.gtin}</Text>
            )}
          </View>
        )}

        {/* Ação rápida: Lançar na OS */}
        <View style={styles.cardAcaoLinha}>
          <TouchableOpacity
            style={styles.botaoLancarOSCard}
            onPress={() => abrirSelecaoOSParaPeca(item)}
          >
            <Ionicons name="clipboard" size={14} color="#38BDF8" />
            <Text style={styles.botaoLancarOSCardTexto}>Lançar na OS</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Barra de Pesquisa com Atalho para Scanner de Câmera */}
      <View style={styles.buscaSecao}>
        <View style={styles.inputBuscaContainer}>
          <Ionicons name="search" size={20} color={CORES.textoMudo} style={styles.iconeBusca} />
          <TextInput
            style={styles.inputBusca}
            placeholder="Buscar por descrição, código ou fabricante..."
            placeholderTextColor={CORES.textoMudo}
            value={termoBusca}
            onChangeText={setTermoBusca}
            returnKeyType="search"
          />
          {termoBusca.length > 0 && (
            <TouchableOpacity onPress={() => setTermoBusca('')} style={styles.botaoLimparBusca}>
              <Ionicons name="close-circle" size={18} color={CORES.textoMudo} />
            </TouchableOpacity>
          )}
        </View>

        {/* Botão Scanner Código de Barras */}
        <TouchableOpacity
          style={styles.botaoScanner}
          onPress={() => setScannerVisivel(true)}
        >
          <Ionicons name="barcode-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Mensagem de Erro se houver */}
      {erro && (
        <View style={styles.erroBox}>
          <Ionicons name="cloud-offline" size={20} color={CORES.perigoTexto} />
          <Text style={styles.erroTexto}>{erro}</Text>
          <TouchableOpacity onPress={() => carregarPecas(termoBusca)} style={styles.botaoTentarNovamente}>
            <Text style={styles.botaoTentarNovamenteTexto}>Tentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de Peças */}
      {carregando && !recarregando ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={CORES.primaria} />
          <Text style={styles.loadingTexto}>Consultando estoque da oficina...</Text>
        </View>
      ) : (
        <FlatList
          data={pecas}
          keyExtractor={(item) => item.id}
          renderItem={renderItemPeca}
          contentContainerStyle={[styles.listaConteudo, { paddingBottom: insets.bottom + 80 }]}
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
              <Ionicons name="file-tray-outline" size={64} color={CORES.borda} />
              <Text style={styles.vazioTitulo}>Nenhuma peça encontrada</Text>
              <Text style={styles.vazioSubtitulo}>
                {termoBusca
                  ? `Não encontramos itens correspondentes a "${termoBusca}". Tente outro código ou escaneie o código de barras da peça.`
                  : 'Nenhuma peça cadastrada no catálogo desta oficina.'}
              </Text>
              {termoBusca ? (
                <TouchableOpacity
                  style={styles.botaoLimparFiltros}
                  onPress={() => setTermoBusca('')}
                >
                  <Text style={styles.botaoLimparFiltrosTexto}>Limpar Busca</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      {/* Modal Leitor de Código de Barras via Câmera */}
      <BarcodeScannerModal
        visivel={scannerVisivel}
        aoFechar={() => setScannerVisivel(false)}
        aoEscanear={handleCodigoEscaneado}
      />

      {/* Modal Ficha Rápida da Peça */}
      <Modal
        visible={!!pecaSelecionada}
        animationType="slide"
        transparent
        onRequestClose={() => setPecaSelecionada(null)}
      >
        <View style={styles.fundoModalDetalhe}>
          <View style={styles.cardModalDetalhe}>
            <View style={styles.headerModalDetalhe}>
              <Text style={styles.tituloModalDetalhe}>Ficha da Peça</Text>
              <TouchableOpacity onPress={() => setPecaSelecionada(null)}>
                <Ionicons name="close" size={24} color={CORES.texto} />
              </TouchableOpacity>
            </View>

            {pecaSelecionada && (
              <ScrollView style={styles.corpoModalDetalhe}>
                <Text style={styles.modalDescricao}>{pecaSelecionada.descricao}</Text>

                <View style={styles.modalGridInfo}>
                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>CÓDIGO INTERNO</Text>
                    <Text style={styles.modalInfoValor}>{pecaSelecionada.codigoInterno}</Text>
                  </View>

                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>FABRICANTE / MARCA</Text>
                    <Text style={styles.modalInfoValor}>{pecaSelecionada.fabricante || '---'}</Text>
                  </View>

                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>LOCALIZAÇÃO NO ESTOQUE</Text>
                    <Text style={[styles.modalInfoValor, { color: '#38BDF8', fontWeight: '800' }]}>
                      {pecaSelecionada.localizacao || 'Sem localização definida'}
                    </Text>
                  </View>

                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>PREÇO DE VENDA</Text>
                    <Text style={[styles.modalInfoValor, { color: '#22C55E', fontWeight: '800', fontSize: 18 }]}>
                      {formatarMoeda(pecaSelecionada.preco)}
                    </Text>
                  </View>

                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>SALDO DISPONÍVEL</Text>
                    <Text style={[styles.modalInfoValor, { color: pecaSelecionada.disponivel > 0 ? '#22C55E' : '#EF4444' }]}>
                      {pecaSelecionada.disponivel} {pecaSelecionada.unidade || 'UN'}
                    </Text>
                  </View>

                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>ESTOQUE ATUAL FÍSICO</Text>
                    <Text style={styles.modalInfoValor}>
                      {pecaSelecionada.estoqueAtual} {pecaSelecionada.unidade || 'UN'}
                    </Text>
                  </View>

                  {pecaSelecionada.codigoOem && (
                    <View style={styles.modalInfoItem}>
                      <Text style={styles.modalInfoLabel}>CÓDIGO OEM</Text>
                      <Text style={styles.modalInfoValor}>{pecaSelecionada.codigoOem}</Text>
                    </View>
                  )}

                  {pecaSelecionada.gtin && (
                    <View style={styles.modalInfoItem}>
                      <Text style={styles.modalInfoLabel}>CÓDIGO DE BARRAS / EAN</Text>
                      <Text style={styles.modalInfoValor}>{pecaSelecionada.gtin}</Text>
                    </View>
                  )}

                  {pecaSelecionada.garantiaDias ? (
                    <View style={styles.modalInfoItem}>
                      <Text style={styles.modalInfoLabel}>GARANTIA</Text>
                      <Text style={styles.modalInfoValor}>{pecaSelecionada.garantiaDias} dias</Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            )}

            {/* Ações da Ficha */}
            <View style={[styles.acoesModalDetalhe, { marginBottom: Math.max(insets.bottom, 12) }]}>
              <TouchableOpacity
                style={styles.botaoLancarNaOSModal}
                onPress={() => {
                  const p = pecaSelecionada;
                  setPecaSelecionada(null);
                  if (p) abrirSelecaoOSParaPeca(p);
                }}
              >
                <Ionicons name="clipboard" size={18} color="#FFFFFF" />
                <Text style={styles.botaoLancarNaOSModalTexto}>Lançar nesta Peça na OS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoFecharModalDetalhe}
                onPress={() => setPecaSelecionada(null)}
              >
                <Text style={styles.botaoFecharModalDetalheTexto}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Selecionar Veículo / OS para lançamento */}
      <Modal
        visible={modalSelecaoOSVisivel}
        animationType="slide"
        transparent
        onRequestClose={() => setModalSelecaoOSVisivel(false)}
      >
        <View style={styles.fundoModalSelecaoOS}>
          <View style={styles.cardModalSelecaoOS}>
            {/* Header */}
            <View style={styles.headerModalSelecaoOS}>
              <View>
                <Text style={styles.tituloModalSelecaoOS}>Lançar Peça em Veículo</Text>
                <Text style={styles.subtituloModalSelecaoOS}>
                  Selecione a Ordem de Serviço em atendimento
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalSelecaoOSVisivel(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={CORES.texto} />
              </TouchableOpacity>
            </View>

            {/* Banner da Peça Sendo Lançada */}
            {pecaParaLancar && (
              <View style={styles.bannerPecaSendoLancada}>
                <Ionicons name="cube" size={18} color="#38BDF8" />
                <View style={styles.bannerPecaTextos}>
                  <Text style={styles.bannerPecaCodigo}>{pecaParaLancar.codigoInterno}</Text>
                  <Text style={styles.bannerPecaDescricao} numberOfLines={1}>
                    {pecaParaLancar.descricao}
                  </Text>
                </View>
                <Text style={styles.bannerPecaSaldo}>
                  Disp: {pecaParaLancar.disponivel} {pecaParaLancar.unidade || 'UN'}
                </Text>
              </View>
            )}

            {/* Campo de Busca de OS */}
            <View style={styles.buscaOSContainer}>
              <Ionicons name="search" size={18} color={CORES.textoMudo} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.inputBuscaOS}
                placeholder="Buscar por placa, cliente ou veículo..."
                placeholderTextColor={CORES.textoMudo}
                value={buscaOS}
                onChangeText={setBuscaOS}
              />
              {buscaOS.length > 0 && (
                <TouchableOpacity onPress={() => setBuscaOS('')}>
                  <Ionicons name="close-circle" size={18} color={CORES.textoMudo} />
                </TouchableOpacity>
              )}
            </View>

            {/* Lista de Ordens de Serviço */}
            {carregandoOS ? (
              <View style={styles.loadingOSContainer}>
                <ActivityIndicator size="small" color={CORES.primaria} />
                <Text style={styles.loadingOSTexto}>Carregando veículos no pátio...</Text>
              </View>
            ) : (
              <FlatList
                data={ordensServicoFiltradas}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingVertical: 8, gap: 10 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.cardOSSelecao}
                    activeOpacity={0.7}
                    onPress={() => handleSelecionarOS(item)}
                  >
                    <View style={styles.cardOSSelecaoTopo}>
                      <PlacaVeiculo placa={item.placa} tamanho="pequeno" />
                      <View style={styles.cardOSSelecaoNumeroBox}>
                        <Text style={styles.cardOSSelecaoNumero}>OS #{item.numero}</Text>
                        {item.boxNome && (
                          <Text style={styles.cardOSSelecaoBox}>Box: {item.boxNome}</Text>
                        )}
                      </View>
                      <View style={styles.cardOSSelecaoSeta}>
                        <Ionicons name="chevron-forward" size={20} color={CORES.primariaClara} />
                      </View>
                    </View>

                    <Text style={styles.cardOSSelecaoVeiculo} numberOfLines={1}>
                      {item.veiculoDescricao}
                    </Text>

                    <Text style={styles.cardOSSelecaoCliente} numberOfLines={1}>
                      Cliente: {item.clienteNome}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.vazioOSContainer}>
                    <Ionicons name="car-sport-outline" size={48} color={CORES.borda} />
                    <Text style={styles.vazioOSTitulo}>Nenhum veículo encontrado</Text>
                    <Text style={styles.vazioOSSubtitulo}>
                      {buscaOS
                        ? 'Não há OSs correspondentes à busca informada.'
                        : 'Não há ordens de serviço abertas no momento.'}
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmação de Quantidade e Localização */}
      <ModalConfirmarLancamentoPeca
        visivel={modalConfirmarLancamentoVisivel}
        peca={pecaParaLancar}
        os={osSelecionadaParaLancar}
        aoFechar={() => {
          setModalConfirmarLancamentoVisivel(false);
          setOsSelecionadaParaLancar(null);
        }}
        aoConfirmar={handleConfirmarLancamentoPeca}
        carregando={salvandoLancamento}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  buscaSecao: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: CORES.superficie,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  inputBuscaContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 12,
  },
  iconeBusca: {
    marginRight: 8,
  },
  inputBusca: {
    flex: 1,
    height: 44,
    color: CORES.texto,
    fontSize: 14,
  },
  botaoLimparBusca: {
    padding: 6,
  },
  botaoScanner: {
    width: 46,
    height: 44,
    backgroundColor: CORES.primaria,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  erroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.perigoFundo,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
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
  cardPeca: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTopoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  codigosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  codigoInternoText: {
    color: CORES.primariaClara,
    fontSize: 14,
    fontWeight: '800',
  },
  fabricanteText: {
    color: CORES.textoMudo,
    fontSize: 13,
    fontWeight: '600',
  },
  badgeSaldo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  badgeSaldoPositivo: {
    backgroundColor: CORES.sucessoFundo,
    borderColor: CORES.sucesso,
    borderWidth: 1,
  },
  badgeSaldoZero: {
    backgroundColor: CORES.perigoFundo,
    borderColor: CORES.perigo,
    borderWidth: 1,
  },
  textoSaldo: {
    fontSize: 12,
    fontWeight: '700',
  },
  descricaoPeca: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 10,
  },
  cardRodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
  },
  localizacaoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C4A6E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    maxWidth: '65%',
  },
  localizacaoTexto: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  precoText: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '800',
  },
  extrasLinha: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  extraTexto: {
    color: CORES.textoMudo,
    fontSize: 11,
  },
  vazioContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  vazioTitulo: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 6,
  },
  vazioSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  botaoLimparFiltros: {
    marginTop: 16,
    backgroundColor: CORES.superficieClara,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  botaoLimparFiltrosTexto: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '600',
  },
  fundoModalDetalhe: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  cardModalDetalhe: {
    backgroundColor: CORES.superficie,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  headerModalDetalhe: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tituloModalDetalhe: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
  },
  corpoModalDetalhe: {
    marginBottom: 16,
  },
  modalDescricao: {
    color: CORES.texto,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 16,
  },
  modalGridInfo: {
    gap: 12,
  },
  modalInfoItem: {
    backgroundColor: CORES.fundo,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  modalInfoLabel: {
    color: CORES.textoMudo,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalInfoValor: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '600',
  },
  botaoFecharModalDetalhe: {
    flex: 1,
    backgroundColor: CORES.superficieClara,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  botaoFecharModalDetalheTexto: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
  },
  cardAcaoLinha: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    alignItems: 'flex-end',
  },
  botaoLancarOSCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    gap: 6,
  },
  botaoLancarOSCardTexto: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  acoesModalDetalhe: {
    flexDirection: 'row',
    gap: 10,
  },
  botaoLancarNaOSModal: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: CORES.primaria,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botaoLancarNaOSModalTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  fundoModalSelecaoOS: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  cardModalSelecaoOS: {
    backgroundColor: CORES.superficie,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  headerModalSelecaoOS: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  tituloModalSelecaoOS: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
  },
  subtituloModalSelecaoOS: {
    color: CORES.textoSecundario,
    fontSize: 12,
    marginTop: 2,
  },
  bannerPecaSendoLancada: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C4A6E',
    padding: 10,
    borderRadius: 8,
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  bannerPecaTextos: {
    flex: 1,
  },
  bannerPecaCodigo: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  bannerPecaDescricao: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bannerPecaSaldo: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: '800',
  },
  buscaOSContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  inputBuscaOS: {
    flex: 1,
    color: CORES.texto,
    fontSize: 14,
  },
  loadingOSContainer: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  loadingOSTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
  },
  cardOSSelecao: {
    backgroundColor: CORES.fundo,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 6,
  },
  cardOSSelecaoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardOSSelecaoNumeroBox: {
    flex: 1,
    marginLeft: 10,
  },
  cardOSSelecaoNumero: {
    color: CORES.primariaClara,
    fontSize: 13,
    fontWeight: '800',
  },
  cardOSSelecaoBox: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  cardOSSelecaoSeta: {
    padding: 4,
  },
  cardOSSelecaoVeiculo: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
  },
  cardOSSelecaoCliente: {
    color: CORES.textoSecundario,
    fontSize: 12,
  },
  vazioOSContainer: {
    padding: 30,
    alignItems: 'center',
    gap: 6,
  },
  vazioOSTitulo: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  vazioOSSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 12,
    textAlign: 'center',
  },
});
