import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { estoqueApi } from '../api/estoqueApi';
import { RespostaPeca } from '../types';
import { CORES } from '../constants';
import { extrairMensagemErro } from '../api/clienteHttp';
import {
  mascaraMoeda,
  converterMoedaParaNumero,
  limparApenasNumeros,
} from '../utils/mascaras';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface ModalCadastroPecaProps {
  visivel: boolean;
  aoFechar: () => void;
  aoSalvar: (peca: RespostaPeca) => void;
  codigoBarrasInicial?: string;
  descricaoInicial?: string;
}

const FABRICANTES_SUGERIDOS = [
  'Cobreq',
  'Bosch',
  'Nakata',
  'Tecfil',
  'Fram',
  'Fras-le',
  'Mahle',
  'Cofap',
  'Monroe',
];

const UNIDADES_SUGERIDAS = ['UN', 'PC', 'JG', 'LT', 'CX', 'KG', 'MT'];

export const ModalCadastroPeca: React.FC<ModalCadastroPecaProps> = ({
  visivel,
  aoFechar,
  aoSalvar,
  codigoBarrasInicial = '',
  descricaoInicial = '',
}) => {
  const insets = useSafeAreaInsets();

  const [gtin, setGtin] = useState('');
  const [descricao, setDescricao] = useState('');
  const [fabricante, setFabricante] = useState('');
  const [preco, setPreco] = useState('');
  const [unidade, setUnidade] = useState('UN');
  const [localizacao, setLocalizacao] = useState('');
  const [quantidadeInicial, setQuantidadeInicial] = useState('');
  const [custoInicial, setCustoInicial] = useState('');

  const [scannerVisivel, setScannerVisivel] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [secaoEstoqueAberta, setSecaoEstoqueAberta] = useState(true);

  useEffect(() => {
    if (visivel) {
      setGtin(codigoBarrasInicial || '');
      setDescricao(descricaoInicial || '');
      setFabricante('');
      setPreco('');
      setUnidade('UN');
      setLocalizacao('');
      setQuantidadeInicial('');
      setCustoInicial('');
      setSalvando(false);
      setScannerVisivel(false);
      setSecaoEstoqueAberta(true);
    }
  }, [visivel, codigoBarrasInicial, descricaoInicial]);

  const handlePrecoChange = (texto: string) => {
    setPreco(mascaraMoeda(texto));
  };

  const handleCustoChange = (texto: string) => {
    setCustoInicial(mascaraMoeda(texto));
  };

  const handleBarcodeEscaneado = (codigo: string) => {
    try {
      Vibration.vibrate(50);
    } catch {
      // Vibração não suportada ou sem permissão
    }
    setGtin(codigo.trim());
    setScannerVisivel(false);
  };

  const handleSalvar = async () => {
    const descLimpa = descricao.trim();
    if (!descLimpa) {
      Alert.alert('Descrição Obrigatória', 'Por favor, informe a descrição ou nome da peça.');
      return;
    }

    const valorPreco = converterMoedaParaNumero(preco);
    if (!valorPreco || valorPreco <= 0) {
      Alert.alert('Preço Obrigatório', 'Por favor, informe o preço de venda da peça.');
      return;
    }

    const qtdNumero = quantidadeInicial ? parseInt(limparApenasNumeros(quantidadeInicial), 10) : 0;
    const valorCusto = converterMoedaParaNumero(custoInicial);

    if (qtdNumero > 0 && (!valorCusto || valorCusto <= 0)) {
      Alert.alert(
        'Custo Inicial Obrigatório',
        'Ao lançar uma quantidade inicial em estoque, é obrigatório informar o custo unitário de aquisição.'
      );
      return;
    }

    setSalvando(true);
    try {
      const novaPeca = await estoqueApi.criarPeca({
        gtin: gtin.trim() || undefined,
        descricao: descLimpa,
        fabricante: fabricante.trim() || undefined,
        preco: valorPreco,
        unidade: unidade.trim() || 'UN',
        localizacao: localizacao.trim() || undefined,
        quantidadeInicial: qtdNumero > 0 ? qtdNumero : undefined,
        custoInicial: qtdNumero > 0 && valorCusto > 0 ? valorCusto : undefined,
      });

      Alert.alert('Sucesso', `Peça "${novaPeca.descricao}" cadastrada no estoque!`);
      aoSalvar(novaPeca);
      aoFechar();
    } catch (e) {
      Alert.alert('Erro ao Cadastrar Peça', extrairMensagemErro(e, 'Não foi possível cadastrar a peça.'));
    } finally {
      setSalvando(false);
    }
  };

  const qtdInformada = parseInt(limparApenasNumeros(quantidadeInicial), 10) || 0;

  return (
    <>
      <Modal
        visible={visivel}
        animationType="slide"
        transparent
        onRequestClose={aoFechar}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <View style={[styles.conteudoModal, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Cabeçalho */}
            <View style={styles.cabecalho}>
              <View style={styles.cabecalhoIconeETexto}>
                <View style={styles.iconeHeaderBox}>
                  <Ionicons name="cube" size={20} color="#A855F7" />
                </View>
                <View style={styles.cabecalhoTextosCol}>
                  <Text style={styles.titulo} numberOfLines={1}>Cadastro Rápido de Peça</Text>
                  <Text style={styles.subtitulo} numberOfLines={1}>Escanear código, preço e prateleira</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={aoFechar}
                style={styles.botaoFechar}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={CORES.textoSecundario} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Código de Barras (EAN / GTIN) com Botão de Câmera */}
              <View style={styles.campoGrupo}>
                <View style={styles.labelLinha}>
                  <Text style={styles.label}>Código de Barras (EAN / GTIN)</Text>
                  <Text style={styles.labelOpcional}>Opcional</Text>
                </View>
                <View style={styles.inputComBotaoContainer}>
                  <TextInput
                    style={styles.inputComBotao}
                    placeholder="789... ou código da etiqueta"
                    placeholderTextColor={CORES.textoMudo}
                    value={gtin}
                    onChangeText={setGtin}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                  {gtin.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setGtin('')}
                      style={styles.botaoLimparInput}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={18} color={CORES.textoMudo} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.botaoEscanear}
                    activeOpacity={0.8}
                    onPress={() => setScannerVisivel(true)}
                  >
                    <Ionicons name="barcode-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.botaoEscanearTexto}>Escanear</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Descrição da Peça */}
              <View style={styles.campoGrupo}>
                <View style={styles.labelLinha}>
                  <Text style={styles.label}>
                    Descrição da Peça <Text style={styles.asterisco}>*</Text>
                  </Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Pastilha de Freio Dianteira, Filtro PSL55"
                  placeholderTextColor={CORES.textoMudo}
                  value={descricao}
                  onChangeText={setDescricao}
                  autoCapitalize="sentences"
                  returnKeyType="next"
                />
              </View>

              {/* Fabricante / Marca */}
              <View style={styles.campoGrupo}>
                <View style={styles.labelLinha}>
                  <Text style={styles.label}>Marca / Fabricante</Text>
                  <Text style={styles.labelOpcional}>Opcional</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Cobreq, Bosch, Nakata, Tecfil"
                  placeholderTextColor={CORES.textoMudo}
                  value={fabricante}
                  onChangeText={setFabricante}
                  autoCapitalize="words"
                />

                {/* Chips de marcas sugeridas */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScroll}
                >
                  {FABRICANTES_SUGERIDOS.map((marca) => {
                    const ativa = fabricante.toLowerCase() === marca.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={marca}
                        style={[styles.chipSugestao, ativa && styles.chipSugestaoAtivo]}
                        onPress={() => setFabricante(marca)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.chipSugestaoTexto,
                            ativa && styles.chipSugestaoTextoAtivo,
                          ]}
                        >
                          {marca}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Linha Preço de Venda e Unidade */}
              <View style={styles.linhaDupla}>
                {/* Preço de Venda */}
                <View style={[styles.campoGrupo, { flex: 1.6 }]}>
                  <View style={styles.labelLinha}>
                    <Text style={styles.label}>
                      Preço de Venda <Text style={styles.asterisco}>*</Text>
                    </Text>
                  </View>
                  <View style={styles.inputComPrefixoContainer}>
                    <Text style={styles.prefixoMoeda}>R$</Text>
                    <TextInput
                      style={styles.inputComPrefixo}
                      placeholder="0,00"
                      placeholderTextColor={CORES.textoMudo}
                      value={preco}
                      onChangeText={handlePrecoChange}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Unidade */}
                <View style={[styles.campoGrupo, { flex: 1 }]}>
                  <View style={styles.labelLinha}>
                    <Text style={styles.label}>Unidade</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { textAlign: 'center', fontWeight: '700' }]}
                    placeholder="UN"
                    placeholderTextColor={CORES.textoMudo}
                    value={unidade}
                    onChangeText={(txt) => setUnidade(txt.toUpperCase().slice(0, 4))}
                    autoCapitalize="characters"
                    maxLength={4}
                  />
                </View>
              </View>

              {/* Chips rápidos de unidade */}
              <View style={styles.unidadesChipsLinha}>
                {UNIDADES_SUGERIDAS.map((u) => {
                  const ativa = unidade.toUpperCase() === u;
                  return (
                    <TouchableOpacity
                      key={u}
                      style={[styles.chipUnidade, ativa && styles.chipUnidadeAtivo]}
                      onPress={() => setUnidade(u)}
                    >
                      <Text
                        style={[
                          styles.chipUnidadeTexto,
                          ativa && styles.chipUnidadeTextoAtivo,
                        ]}
                      >
                        {u}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Card de Estoque Físico Inicial e Localização */}
              <View style={styles.cardEstoqueInicial}>
                <TouchableOpacity
                  style={styles.cardEstoqueHeader}
                  activeOpacity={0.8}
                  onPress={() => setSecaoEstoqueAberta((prev) => !prev)}
                >
                  <View style={styles.cardEstoqueTituloLinha}>
                    <Ionicons name="file-tray-full-outline" size={18} color="#38BDF8" />
                    <Text style={styles.cardEstoqueTitulo}>Saldo Físico & Localização</Text>
                  </View>
                  <Ionicons
                    name={secaoEstoqueAberta ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={CORES.textoMudo}
                  />
                </TouchableOpacity>

                {secaoEstoqueAberta && (
                  <View style={styles.cardEstoqueCorpo}>
                    {/* Linha Quantidade e Custo */}
                    <View style={styles.linhaDupla}>
                      {/* Quantidade Inicial */}
                      <View style={[styles.campoGrupo, { flex: 1 }]}>
                        <View style={styles.labelLinha}>
                          <Text style={styles.label}>Qtd Inicial</Text>
                        </View>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          placeholderTextColor={CORES.textoMudo}
                          value={quantidadeInicial}
                          onChangeText={setQuantidadeInicial}
                          keyboardType="numeric"
                        />
                      </View>

                      {/* Custo Unitário (R$) */}
                      <View style={[styles.campoGrupo, { flex: 1.4 }]}>
                        <View style={styles.labelLinha}>
                          <Text style={styles.label}>
                            Custo Unitário {qtdInformada > 0 && <Text style={styles.asterisco}>*</Text>}
                          </Text>
                        </View>
                        <View style={styles.inputComPrefixoContainer}>
                          <Text style={styles.prefixoMoeda}>R$</Text>
                          <TextInput
                            style={styles.inputComPrefixo}
                            placeholder="0,00"
                            placeholderTextColor={CORES.textoMudo}
                            value={custoInicial}
                            onChangeText={handleCustoChange}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                    </View>

                    {/* Localização Física / Prateleira */}
                    <View style={styles.campoGrupo}>
                      <View style={styles.labelLinha}>
                        <Text style={styles.label}>Localização Física</Text>
                        <Text style={styles.labelOpcional}>Prateleira / Gaveta</Text>
                      </View>
                      <View style={styles.inputComIconeContainer}>
                        <Ionicons name="location-outline" size={18} color={CORES.textoMudo} />
                        <TextInput
                          style={styles.inputComIcone}
                          placeholder="Ex: Corredor B - Prat. 3, Gaveta 04"
                          placeholderTextColor={CORES.textoMudo}
                          value={localizacao}
                          onChangeText={setLocalizacao}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Rodapé de Ações */}
            <View style={styles.rodape}>
              <TouchableOpacity
                style={styles.botaoCancelar}
                onPress={aoFechar}
                disabled={salvando}
              >
                <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.botaoSalvar, salvando && styles.botaoSalvarDesabilitado]}
                onPress={handleSalvar}
                disabled={salvando}
                activeOpacity={0.8}
              >
                {salvando ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" />
                    <Text style={styles.botaoSalvarTexto}>Salvar Peça</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Barcode Scanner Modal acionado pela câmera */}
      <BarcodeScannerModal
        visivel={scannerVisivel}
        aoFechar={() => setScannerVisivel(false)}
        aoEscanear={handleBarcodeEscaneado}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  conteudoModal: {
    backgroundColor: CORES.fundo,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  cabecalhoIconeETexto: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 10,
  },
  cabecalhoTextosCol: {
    flex: 1,
  },
  iconeHeaderBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontSize: 17,
    fontWeight: '700',
    color: CORES.texto,
  },
  subtitulo: {
    fontSize: 12,
    color: CORES.textoSecundario,
    marginTop: 2,
  },
  botaoFechar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: CORES.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  campoGrupo: {
    marginBottom: 14,
  },
  linhaDupla: {
    flexDirection: 'row',
    gap: 12,
  },
  labelLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: CORES.textoSecundario,
  },
  asterisco: {
    color: CORES.perigoTexto,
    fontWeight: '700',
  },
  labelOpcional: {
    fontSize: 11,
    color: CORES.textoMudo,
  },
  input: {
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: CORES.texto,
  },
  inputComBotaoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    overflow: 'hidden',
  },
  inputComBotao: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: CORES.texto,
  },
  botaoLimparInput: {
    paddingHorizontal: 8,
  },
  botaoEscanear: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 6,
  },
  botaoEscanearTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  chipsScroll: {
    paddingVertical: 8,
    gap: 8,
  },
  chipSugestao: {
    backgroundColor: CORES.superficieElevada,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  chipSugestaoAtivo: {
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderColor: '#A855F7',
  },
  chipSugestaoTexto: {
    fontSize: 12,
    color: CORES.textoSecundario,
    fontWeight: '500',
  },
  chipSugestaoTextoAtivo: {
    color: '#C084FC',
    fontWeight: '700',
  },
  inputComPrefixoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    paddingHorizontal: 12,
  },
  prefixoMoeda: {
    fontSize: 14,
    fontWeight: '700',
    color: CORES.textoMudo,
    marginRight: 6,
  },
  inputComPrefixo: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: '700',
    color: CORES.sucessoTexto,
  },
  unidadesChipsLinha: {
    flexDirection: 'row',
    gap: 6,
    marginTop: -6,
    marginBottom: 14,
  },
  chipUnidade: {
    backgroundColor: CORES.superficieElevada,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  chipUnidadeAtivo: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primaria,
  },
  chipUnidadeTexto: {
    fontSize: 11,
    color: CORES.textoMudo,
    fontWeight: '600',
  },
  chipUnidadeTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cardEstoqueInicial: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 8,
  },
  cardEstoqueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: CORES.superficieElevada,
  },
  cardEstoqueTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardEstoqueTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: CORES.texto,
  },
  cardEstoqueCorpo: {
    padding: 14,
  },
  inputComIconeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    paddingHorizontal: 12,
    gap: 8,
  },
  inputComIcone: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: CORES.texto,
  },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
  },
  botaoCancelar: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  botaoCancelarTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: CORES.textoSecundario,
  },
  botaoSalvar: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    gap: 8,
  },
  botaoSalvarDesabilitado: {
    opacity: 0.6,
  },
  botaoSalvarTexto: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
