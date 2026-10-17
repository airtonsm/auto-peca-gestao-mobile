import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { estoqueApi } from '../api/estoqueApi';
import { RespostaPeca } from '../types';
import { CORES } from '../constants';
import { extrairMensagemErro } from '../api/clienteHttp';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

export const EstoqueScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [termoBusca, setTermoBusca] = useState('');
  const [pecas, setPecas] = useState<RespostaPeca[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [scannerVisivel, setScannerVisivel] = useState(false);
  const [pecaSelecionada, setPecaSelecionada] = useState<RespostaPeca | null>(null);

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

            <TouchableOpacity
              style={[styles.botaoFecharModalDetalhe, { marginBottom: Math.max(insets.bottom, 12) }]}
              onPress={() => setPecaSelecionada(null)}
            >
              <Text style={styles.botaoFecharModalDetalheTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    backgroundColor: CORES.superficieClara,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  botaoFecharModalDetalheTexto: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
  },
});
