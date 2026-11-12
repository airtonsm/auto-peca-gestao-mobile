import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { osApi } from '../api/osApi';
import { RespostaVeiculo, RespostaCliente } from '../types';
import { CORES } from '../constants';
import { extrairMensagemErro } from '../api/clienteHttp';
import { ModalCadastroCliente } from './ModalCadastroCliente';
import { ModalCapturaFotoPlaca } from './ModalCapturaFotoPlaca';
import { normalizarPlaca, mascaraPlacaExibicao, limparApenasNumeros } from '../utils/mascaras';

interface ModalCadastroVeiculoProps {
  visivel: boolean;
  aoFechar: () => void;
  aoSalvar: (veiculo: RespostaVeiculo) => void;
  placaInicial?: string;
  clienteInicial?: RespostaCliente | null;
}

const MODELOS_SUGERIDOS = [
  'Fiat Strada',
  'VW Gol',
  'Chevrolet Onix',
  'Hyundai HB20',
  'Fiat Argo',
  'Toyota Corolla',
  'Fiat Toro',
  'Renault Kwid',
  'Jeep Renegade',
  'VW Polo',
];

const CORES_SUGERIDAS = ['Branco', 'Prata', 'Preto', 'Cinza', 'Vermelho', 'Azul'];

export const ModalCadastroVeiculo: React.FC<ModalCadastroVeiculoProps> = ({
  visivel,
  aoFechar,
  aoSalvar,
  placaInicial = '',
  clienteInicial = null,
}) => {
  const insets = useSafeAreaInsets();

  // Dados do veículo
  const [placa, setPlaca] = useState('');
  const [marcaModelo, setMarcaModelo] = useState('');
  const [anoFabricacao, setAnoFabricacao] = useState('');
  const [anoModelo, setAnoModelo] = useState('');
  const [cor, setCor] = useState('');
  const [kmAtual, setKmAtual] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Cliente vinculado
  const [clienteSelecionado, setClienteSelecionado] = useState<RespostaCliente | null>(null);
  const [buscaClienteTexto, setBuscaClienteTexto] = useState('');
  const [clientesEncontrados, setClientesEncontrados] = useState<RespostaCliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);

  // Modal aninhado para criar novo cliente inline
  const [modalNovoClienteVisivel, setModalNovoClienteVisivel] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [modalFotoPlacaVisivel, setModalFotoPlacaVisivel] = useState(false);
  const [consultandoPlaca, setConsultandoPlaca] = useState(false);
  const [statusPreenchimento, setStatusPreenchimento] = useState<string | null>(null);
  const timeoutBuscaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visivel) {
      setPlaca(normalizarPlaca(placaInicial));
      setMarcaModelo('');
      setAnoFabricacao('');
      setAnoModelo('');
      setCor('');
      setKmAtual('');
      setObservacoes('');
      setClienteSelecionado(clienteInicial || null);
      setBuscaClienteTexto('');
      setClientesEncontrados([]);
      setSalvando(false);
    }
  }, [visivel, placaInicial, clienteInicial]);

  // Busca de clientes com debounce
  const handleBuscaCliente = (texto: string) => {
    setBuscaClienteTexto(texto);
    if (timeoutBuscaRef.current) {
      clearTimeout(timeoutBuscaRef.current);
    }

    if (texto.trim().length < 2) {
      setClientesEncontrados([]);
      setBuscandoClientes(false);
      return;
    }

    setBuscandoClientes(true);
    timeoutBuscaRef.current = setTimeout(async () => {
      try {
        const resultados = await osApi.buscarClientes(texto);
        setClientesEncontrados(resultados || []);
      } catch {
        setClientesEncontrados([]);
      } finally {
        setBuscandoClientes(false);
      }
    }, 350);
  };


  // Consulta automática dos dados do carro pela placa
  const consultarDadosVeiculoAutomatico = async (placaParaConsultar: string) => {
    const limpa = normalizarPlaca(placaParaConsultar);
    if (limpa.length < 7) {
      setStatusPreenchimento(null);
      return;
    }

    setConsultandoPlaca(true);
    setStatusPreenchimento('Consultando dados do veículo...');

    try {
      // 1. Verifica se já está cadastrado nesta oficina
      const cadastrados = await osApi.buscarVeiculosPorPlaca(limpa);
      if (cadastrados && cadastrados.length > 0) {
        const v = cadastrados[0];
        if (v.modelo || v.descricao) setMarcaModelo(v.modelo || v.descricao);
        if (v.anoFabricacao) setAnoFabricacao(String(v.anoFabricacao));
        if (v.anoModelo) setAnoModelo(String(v.anoModelo));
        if (v.cor) setCor(v.cor);
        if (v.kmAtual) setKmAtual(String(v.kmAtual));
        if (v.clienteId && v.clienteNome) {
          setClienteSelecionado({
            id: v.clienteId,
            nome: v.clienteNome,
            ativo: true,
          });
        }
        setStatusPreenchimento('Veículo já cadastrado na oficina! Dados preenchidos.');
        setConsultandoPlaca(false);
        return;
      }

      // 2. Não cadastrado na oficina: consulta dados da base oficial do veículo (FIPE/Denatran)
      const dadosOficiais = await osApi.consultarPlaca(limpa);
      if (dadosOficiais?.encontrado && dadosOficiais?.veiculo) {
        const v = dadosOficiais.veiculo;
        const partesModelo = [v.marca, v.modelo, v.versao, v.motor].filter(Boolean);
        if (partesModelo.length > 0) {
          setMarcaModelo(partesModelo.join(' '));
        }
        if (v.anoFabricacao) setAnoFabricacao(String(v.anoFabricacao));
        if (v.anoModelo) setAnoModelo(String(v.anoModelo));
        setStatusPreenchimento('Veículo identificado automaticamente via placa!');
      } else {
        setStatusPreenchimento('Placa nova. Preencha os dados do veículo:');
      }
    } catch {
      setStatusPreenchimento(null);
    } finally {
      setConsultandoPlaca(false);
    }
  };

  const handlePlacaChange = (texto: string) => {
    const limpa = normalizarPlaca(texto);
    setPlaca(limpa);
    if (limpa.length === 7) {
      consultarDadosVeiculoAutomatico(limpa);
    } else {
      setStatusPreenchimento(null);
    }
  };


  const handleSalvar = async () => {
    const placaFinal = normalizarPlaca(placa);
    if (!placaFinal || placaFinal.length < 7) {
      Alert.alert('Placa Inválida', 'Informe a placa completa de 7 caracteres (Mercosul ou antiga).');
      return;
    }

    if (!marcaModelo.trim()) {
      Alert.alert('Modelo Obrigatório', 'Informe a marca/modelo do veículo (ex: Fiat Strada 1.4).');
      return;
    }

    if (!clienteSelecionado) {
      Alert.alert('Cliente Proprietário Obrigatório', 'Selecione ou cadastre o cliente proprietário do veículo.');
      return;
    }

    const kmNum = kmAtual ? parseInt(limparApenasNumeros(kmAtual), 10) : undefined;
    const anoFabNum = anoFabricacao ? parseInt(limparApenasNumeros(anoFabricacao), 10) : undefined;
    const anoModNum = anoModelo ? parseInt(limparApenasNumeros(anoModelo), 10) : undefined;

    setSalvando(true);
    try {
      const novoVeiculo = await osApi.criarVeiculo({
        clienteId: clienteSelecionado.id,
        placa: placaFinal,
        modelo: marcaModelo.trim(),
        cor: cor.trim() || undefined,
        anoFabricacao: anoFabNum,
        anoModelo: anoModNum,
        kmAtual: kmNum,
        observacoes: observacoes.trim() || undefined,
      });

      aoSalvar(novoVeiculo);
      aoFechar();
    } catch (e) {
      Alert.alert('Erro ao Cadastrar Veículo', extrairMensagemErro(e, 'Não foi possível cadastrar o veículo.'));
    } finally {
      setSalvando(false);
    }
  };

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
                  <Ionicons name="car-sport" size={20} color="#38BDF8" />
                </View>
                <View style={styles.cabecalhoTextosCol}>
                  <Text style={styles.titulo} numberOfLines={1}>Novo Veículo</Text>
                  <Text style={styles.subtitulo} numberOfLines={1} ellipsizeMode="tail">Placa Mercosul e proprietário</Text>
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
              {/* Box Placa Mercosul com Ação de Foto/Scanner */}
              <View style={styles.campoContainer}>
                <View style={styles.rotuloComAcao}>
                  <Text style={styles.rotuloCampo}>PLACA DO VEÍCULO *</Text>
                  {placa.length > 0 && (
                    <Text style={styles.dicaPlaca}>
                      {mascaraPlacaExibicao(placa)} ({placa.length}/7)
                    </Text>
                  )}
                </View>

                <View style={styles.linhaPlacaECamera}>
                  <View style={styles.placaMercosulCard}>
                    <View style={styles.placaFaixaAzul}>
                      <Text style={styles.placaTextoBrasil}>BRASIL</Text>
                    </View>
                    <View style={styles.placaCorpoInput}>
                      <TextInput
                        style={styles.placaInput}
                        placeholder="ABC1D23"
                        placeholderTextColor="#94A3B8"
                        value={placa}
                        onChangeText={handlePlacaChange}
                        autoCapitalize="characters"
                        maxLength={7}
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.botaoIconeCameraPlaca}
                    onPress={() => setModalFotoPlacaVisivel(true)}
                    activeOpacity={0.8}
                    accessibilityLabel="Tirar foto da placa do veículo para reconhecer automaticamente"
                  >
                    <Ionicons name="camera" size={24} color="#38BDF8" />
                    <Text style={styles.botaoIconeCameraPlacaSub}>Foto Placa</Text>
                  </TouchableOpacity>
                </View>

                {consultandoPlaca && (
                  <View style={styles.boxConsultando}>
                    <ActivityIndicator size="small" color="#38BDF8" />
                    <Text style={styles.boxConsultandoTexto}>Buscando dados do carro na base oficial...</Text>
                  </View>
                )}

                {!consultandoPlaca && statusPreenchimento && (
                  <View style={[
                    styles.boxStatusPreenchimento,
                    statusPreenchimento.includes('identificado') || statusPreenchimento.includes('cadastrado')
                      ? styles.boxStatusSucesso
                      : styles.boxStatusAviso
                  ]}>
                    <Ionicons
                      name={statusPreenchimento.includes('identificado') || statusPreenchimento.includes('cadastrado') ? "checkmark-circle" : "sparkles"}
                      size={15}
                      color={statusPreenchimento.includes('identificado') || statusPreenchimento.includes('cadastrado') ? "#22C55E" : "#38BDF8"}
                    />
                    <Text style={[
                      styles.textoStatusPreenchimento,
                      statusPreenchimento.includes('identificado') || statusPreenchimento.includes('cadastrado')
                        ? { color: '#86EFAC' }
                        : { color: '#BAE6FD' }
                    ]}>
                      {statusPreenchimento}
                    </Text>
                  </View>
                )}
              </View>

              {/* Marca / Modelo */}
              <View style={styles.campoContainer}>
                <Text style={styles.rotuloCampo}>MARCA / MODELO *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Fiat Strada 1.4 Fire / VW Gol 1.6"
                  placeholderTextColor={CORES.textoMudo}
                  value={marcaModelo}
                  onChangeText={setMarcaModelo}
                  autoCapitalize="words"
                />

                {/* Sugestões rápidas de modelos */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScroll}
                  style={styles.chipsScrollWrapper}
                >
                  {MODELOS_SUGERIDOS.map((mod) => (
                    <TouchableOpacity
                      key={mod}
                      style={[
                        styles.chipSugestao,
                        marcaModelo.toLowerCase().startsWith(mod.toLowerCase()) && styles.chipSugestaoAtivo,
                      ]}
                      onPress={() => setMarcaModelo(mod)}
                    >
                      <Text
                        style={[
                          styles.chipSugestaoTexto,
                          marcaModelo.toLowerCase().startsWith(mod.toLowerCase()) && styles.chipSugestaoTextoAtivo,
                        ]}
                      >
                        {mod}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Linha 1: Ano Fabricação e Ano Modelo */}
              <View style={styles.linhaDupla}>
                <View style={[styles.campoContainer, { flex: 1 }]}>
                  <Text style={styles.rotuloCampo} numberOfLines={1}>ANO FABRICAÇÃO</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 2021"
                    placeholderTextColor={CORES.textoMudo}
                    value={anoFabricacao}
                    onChangeText={setAnoFabricacao}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>

                <View style={[styles.campoContainer, { flex: 1 }]}>
                  <Text style={styles.rotuloCampo} numberOfLines={1}>ANO MODELO</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 2022"
                    placeholderTextColor={CORES.textoMudo}
                    value={anoModelo}
                    onChangeText={setAnoModelo}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
              </View>

              {/* Linha 2: Cor e KM Atual */}
              <View style={styles.linhaDupla}>
                <View style={[styles.campoContainer, { flex: 1.1 }]}>
                  <Text style={styles.rotuloCampo} numberOfLines={1}>COR DO VEÍCULO</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Prata"
                    placeholderTextColor={CORES.textoMudo}
                    value={cor}
                    onChangeText={setCor}
                    autoCapitalize="words"
                  />
                </View>

                <View style={[styles.campoContainer, { flex: 1 }]}>
                  <Text style={styles.rotuloCampo} numberOfLines={1}>KM ATUAL</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 45000"
                    placeholderTextColor={CORES.textoMudo}
                    value={kmAtual}
                    onChangeText={setKmAtual}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Chips de Cores comuns */}
              <View style={styles.secaoChipsCores}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScroll}
                >
                  {CORES_SUGERIDAS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chipSugestao, cor.toLowerCase() === c.toLowerCase() && styles.chipSugestaoAtivo]}
                      onPress={() => setCor(c)}
                    >
                      <Text
                        style={[
                          styles.chipSugestaoTexto,
                          cor.toLowerCase() === c.toLowerCase() && styles.chipSugestaoTextoAtivo,
                        ]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Seletor / Busca do Cliente Proprietário */}
              <View style={styles.campoContainer}>
                <View style={styles.rotuloComAcao}>
                  <Text style={styles.rotuloCampo}>PROPRIETÁRIO DO VEÍCULO *</Text>
                  <TouchableOpacity
                    style={styles.botaoInlineNovoCliente}
                    onPress={() => setModalNovoClienteVisivel(true)}
                  >
                    <Ionicons name="add-circle" size={14} color="#38BDF8" />
                    <Text style={styles.botaoInlineNovoClienteTexto}>Novo Cliente</Text>
                  </TouchableOpacity>
                </View>

                {clienteSelecionado ? (
                  /* Card de Cliente Selecionado */
                  <View style={styles.cardClienteSelecionado}>
                    <View style={styles.clienteIconeBox}>
                      <Ionicons name="person" size={18} color="#38BDF8" />
                    </View>
                    <View style={styles.clienteTextosBox}>
                      <Text style={styles.clienteNomeSelecionado} numberOfLines={1}>
                        {clienteSelecionado.nome}
                      </Text>
                      <Text style={styles.clienteDetalhesSelecionado} numberOfLines={1}>
                        {clienteSelecionado.telefone || clienteSelecionado.documento || 'Cliente cadastrado'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.botaoTrocarCliente}
                      onPress={() => setClienteSelecionado(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={20} color={CORES.textoSecundario} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Busca de Cliente */
                  <View>
                    <View style={styles.buscaClienteContainer}>
                      <Ionicons name="search" size={16} color={CORES.textoMudo} style={styles.iconeBusca} />
                      <TextInput
                        style={styles.inputBusca}
                        placeholder="Buscar por nome, CPF ou celular..."
                        placeholderTextColor={CORES.textoMudo}
                        value={buscaClienteTexto}
                        onChangeText={handleBuscaCliente}
                      />
                      {buscandoClientes && <ActivityIndicator size="small" color="#38BDF8" />}
                    </View>

                    {/* Lista de resultados da busca */}
                    {clientesEncontrados.length > 0 && (
                      <View style={styles.listaResultadosClientes}>
                        {clientesEncontrados.map((cli) => (
                          <TouchableOpacity
                            key={cli.id}
                            style={styles.itemClienteResultado}
                            onPress={() => {
                              setClienteSelecionado(cli);
                              setBuscaClienteTexto('');
                              setClientesEncontrados([]);
                            }}
                          >
                            <Ionicons name="person-outline" size={16} color={CORES.primariaClara} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.itemClienteNome} numberOfLines={1}>
                                {cli.nome}
                              </Text>
                              <Text style={styles.itemClienteDetalhes} numberOfLines={1}>
                                {cli.telefone || cli.documento || 'Sem telefone informado'}
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={CORES.textoMudo} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Observações */}
              <View style={styles.campoContainer}>
                <Text style={styles.rotuloCampo}>OBSERVAÇÕES (OPCIONAL)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  placeholder="Informações adicionais do veículo ou histórico..."
                  placeholderTextColor={CORES.textoMudo}
                  value={observacoes}
                  onChangeText={setObservacoes}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </ScrollView>

            {/* Rodapé com Botão Salvar */}
            <View style={styles.rodape}>
              <TouchableOpacity
                style={styles.botaoCancelar}
                onPress={aoFechar}
                disabled={salvando}
              >
                <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.botaoSalvar, salvando && styles.botaoSalvarDesativado]}
                onPress={handleSalvar}
                disabled={salvando}
                activeOpacity={0.85}
              >
                {salvando ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" />
                    <Text style={styles.botaoSalvarTexto}>Salvar Veículo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      
      {/* Modal de Reconhecimento OCR de Placa por Foto */}
      <ModalCapturaFotoPlaca
        visivel={modalFotoPlacaVisivel}
        aoFechar={() => setModalFotoPlacaVisivel(false)}
        aoPlacaDetectada={(placaLida) => {
          setPlaca(placaLida);
          consultarDadosVeiculoAutomatico(placaLida);
        }}
      />

      {/* Modal Inline para Novo Cliente */}
      <ModalCadastroCliente
        visivel={modalNovoClienteVisivel}
        aoFechar={() => setModalNovoClienteVisivel(false)}
        aoSalvar={(novoClienteCriado) => {
          setClienteSelecionado(novoClienteCriado);
          setBuscaClienteTexto('');
          setClientesEncontrados([]);
        }}
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
    paddingTop: 20,
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
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontSize: 18,
    fontWeight: '700',
    color: CORES.texto,
  },
  subtitulo: {
    fontSize: 12,
    color: CORES.textoSecundario,
    marginTop: 1,
  },
  botaoFechar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: CORES.superficie,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
    rotuloComAcaoPlaca: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  botaoTirarFotoPlaca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  botaoTirarFotoPlacaTexto: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  linhaPlacaECamera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  botaoIconeCameraPlaca: {
    width: 68,
    height: 58,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  botaoIconeCameraPlacaSub: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  boxConsultando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    width: '100%',
  },
  boxConsultandoTexto: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  boxStatusPreenchimento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 8,
    width: '100%',
  },
  boxStatusSucesso: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  boxStatusAviso: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  textoStatusPreenchimento: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  secaoPlacaContainer: {
    marginBottom: 14,
  },
  placaMercosulCard: {
    flex: 1,
    height: 58,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0F172A',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  placaFaixaAzul: {
    backgroundColor: '#003399',
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placaTextoBrasil: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
  },
  placaCorpoInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placaInput: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 3,
    textAlign: 'center',
    width: '100%',
    padding: 0,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dicaPlaca: {
    fontSize: 11,
    color: CORES.textoMudo,
    fontWeight: '600',
  },
  campoContainer: {
    marginBottom: 14,
  },
  rotuloCampo: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: CORES.textoSecundario,
    marginBottom: 6,
  },
  rotuloComAcao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  botaoInlineNovoCliente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  botaoInlineNovoClienteTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  input: {
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: CORES.texto,
    minHeight: 46,
  },
  chipsScrollWrapper: {
    marginTop: 8,
  },
  secaoChipsCores: {
    marginTop: -4,
    marginBottom: 14,
  },
  chipsScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  chipSugestao: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  chipSugestaoAtivo: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderColor: '#38BDF8',
  },
  chipSugestaoTexto: {
    fontSize: 12,
    color: CORES.textoSecundario,
    fontWeight: '500',
  },
  chipSugestaoTextoAtivo: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  linhaDupla: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardClienteSelecionado: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    minHeight: 46,
  },
  clienteIconeBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clienteTextosBox: {
    flex: 1,
  },
  clienteNomeSelecionado: {
    fontSize: 14,
    fontWeight: '700',
    color: CORES.texto,
  },
  clienteDetalhesSelecionado: {
    fontSize: 12,
    color: CORES.textoSecundario,
    marginTop: 2,
  },
  botaoTrocarCliente: {
    padding: 4,
  },
  buscaClienteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  iconeBusca: {
    marginRight: 8,
  },
  inputBusca: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: CORES.texto,
  },
  listaResultadosClientes: {
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
    maxHeight: 160,
  },
  itemClienteResultado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  itemClienteNome: {
    fontSize: 13,
    fontWeight: '600',
    color: CORES.texto,
  },
  itemClienteDetalhes: {
    fontSize: 11,
    color: CORES.textoMudo,
    marginTop: 1,
  },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
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
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: CORES.primaria,
  },
  botaoSalvarDesativado: {
    opacity: 0.6,
  },
  botaoSalvarTexto: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
