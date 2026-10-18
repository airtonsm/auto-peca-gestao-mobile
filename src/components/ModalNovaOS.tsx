import React, { useState, useEffect, useCallback } from 'react';
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
import {
  RespostaOSResumo,
  RespostaVeiculo,
  RespostaBox,
} from '../types';
import { CORES } from '../constants';
import { extrairMensagemErro } from '../api/clienteHttp';
import { PlacaVeiculo } from './PlacaVeiculo';

interface ModalNovaOSProps {
  visivel: boolean;
  aoFechar: () => void;
  aoOSCriadaComSucesso: (novaOS: RespostaOSResumo) => void;
  aoIniciarChecklistAposCriar?: (novaOS: RespostaOSResumo) => void;
}

const QUEIXAS_SUGERIDAS = [
  'Revisão Preventiva',
  'Troca de Óleo e Filtros',
  'Barulho na Suspensão',
  'Freio Chiando / Baixo',
  'Luz da Injeção Acesa',
  'Ar-condicionado não gela',
  'Alinhamento e Balanceamento',
  'Vazamento de Óleo / Água',
];

const PRIORIDADES: Array<{ chave: 'normal' | 'alta' | 'urgente'; rotulo: string; cor: string }> = [
  { chave: 'normal', rotulo: 'Normal', cor: '#10B981' },
  { chave: 'alta', rotulo: 'Alta', cor: '#F59E0B' },
  { chave: 'urgente', rotulo: 'Urgente', cor: '#EF4444' },
];

export const ModalNovaOS: React.FC<ModalNovaOSProps> = ({
  visivel,
  aoFechar,
  aoOSCriadaComSucesso,
  aoIniciarChecklistAposCriar,
}) => {
  const insets = useSafeAreaInsets();

  // Estados de Busca e Veículo
  const [placaTexto, setPlacaTexto] = useState('');
  const [buscandoVeiculo, setBuscandoVeiculo] = useState(false);
  const [veiculoEncontrado, setVeiculoEncontrado] = useState<RespostaVeiculo | null>(null);
  const [veiculoNaoEncontrado, setVeiculoNaoEncontrado] = useState(false);

  // Estados de Cadastro Rápido (caso o veículo não exista na oficina)
  const [novoModelo, setNovoModelo] = useState('');
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('');

  // Estados do Atendimento da OS
  const [kmEntrada, setKmEntrada] = useState('');
  const [queixaCliente, setQueixaCliente] = useState('');
  const [prioridade, setPrioridade] = useState<'normal' | 'alta' | 'urgente'>('normal');
  const [boxId, setBoxId] = useState<string | null>(null);

  // Boxes
  const [boxes, setBoxes] = useState<RespostaBox[]>([]);
  const [salvando, setSalvando] = useState(false);

  // Carrega lista de boxes ao abrir
  useEffect(() => {
    if (visivel) {
      osApi.listarBoxes().then((lista) => {
        setBoxes(lista.filter((b) => b.ativo));
      });
    }
  }, [visivel]);

  // Reseta campos ao fechar
  const resetarFormulario = useCallback(() => {
    setPlacaTexto('');
    setBuscandoVeiculo(false);
    setVeiculoEncontrado(null);
    setVeiculoNaoEncontrado(false);
    setNovoModelo('');
    setNovoClienteNome('');
    setNovoClienteTelefone('');
    setKmEntrada('');
    setQueixaCliente('');
    setPrioridade('normal');
    setBoxId(null);
    setSalvando(false);
  }, []);

  const handleFechar = () => {
    resetarFormulario();
    aoFechar();
  };

  // Busca o veículo pela placa informada
  const pesquisarPlaca = async (placa: string) => {
    const limpa = placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (limpa.length < 3) {
      setVeiculoEncontrado(null);
      setVeiculoNaoEncontrado(false);
      return;
    }

    setBuscandoVeiculo(true);
    setVeiculoNaoEncontrado(false);
    try {
      const encontrados = await osApi.buscarVeiculosPorPlaca(limpa);
      if (encontrados && encontrados.length > 0) {
        // Encontrou veículo
        const v = encontrados[0];
        setVeiculoEncontrado(v);
        setVeiculoNaoEncontrado(false);
        if (v.kmAtual) {
          setKmEntrada(String(v.kmAtual));
        }
      } else if (limpa.length >= 7) {
        // Placa completa digitada e não achou
        setVeiculoEncontrado(null);
        setVeiculoNaoEncontrado(true);
      } else {
        setVeiculoEncontrado(null);
        setVeiculoNaoEncontrado(false);
      }
    } catch {
      setVeiculoEncontrado(null);
    } finally {
      setBuscandoVeiculo(false);
    }
  };

  const handlePlacaChange = (texto: string) => {
    const formato = texto.toUpperCase();
    setPlacaTexto(formato);
    if (formato.length >= 3) {
      pesquisarPlaca(formato);
    } else {
      setVeiculoEncontrado(null);
      setVeiculoNaoEncontrado(false);
    }
  };

  // Submissão da criação da Ordem de Serviço
  const handleCriarOS = async (confirmarKmMenor = false) => {
    const placaFinal = placaTexto.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!placaFinal || placaFinal.length < 7) {
      Alert.alert('Placa Inválida', 'Informe a placa completa do veículo (7 caracteres).');
      return;
    }

    setSalvando(true);

    try {
      let veiculoIdFinal = veiculoEncontrado?.id;
      let clienteIdFinal = veiculoEncontrado?.clienteId;

      // 1. Se o veículo NÃO existe, cadastra cliente e veículo antes
      if (!veiculoIdFinal) {
        if (!novoClienteNome.trim()) {
          Alert.alert('Cliente Obrigatório', 'Informe o nome do cliente proprietário do veículo.');
          setSalvando(false);
          return;
        }
        if (!novoModelo.trim()) {
          Alert.alert('Modelo Obrigatório', 'Informe a marca/modelo do veículo (ex: Fiat Argo 1.0).');
          setSalvando(false);
          return;
        }

        // Cria o cliente
        const clienteCriado = await osApi.criarCliente({
          tipo: 'pf',
          nome: novoClienteNome.trim(),
          contatos: novoClienteTelefone.trim()
            ? [
                {
                  nome: novoClienteNome.trim(),
                  telefone: novoClienteTelefone.trim(),
                  whatsapp: true,
                  principal: true,
                },
              ]
            : undefined,
        });

        clienteIdFinal = clienteCriado.id;

        // Cria o veículo
        const kmInicialNum = kmEntrada ? parseInt(kmEntrada.replace(/\D/g, ''), 10) : undefined;
        const veiculoCriado = await osApi.criarVeiculo({
          clienteId: clienteIdFinal,
          placa: placaFinal,
          modelo: novoModelo.trim(),
          kmAtual: kmInicialNum,
        });

        veiculoIdFinal = veiculoCriado.id;
      }

      // 2. Cria a Ordem de Serviço
      const kmNum = kmEntrada ? parseInt(kmEntrada.replace(/\D/g, ''), 10) : null;

      const novaOS = await osApi.criarOS({
        clienteId: clienteIdFinal!,
        veiculoId: veiculoIdFinal!,
        kmEntrada: kmNum,
        queixaCliente: queixaCliente.trim() || undefined,
        boxId: boxId || null,
        prioridade,
        status: 'recebido',
        confirmarKmMenor,
      });

      setSalvando(false);
      aoOSCriadaComSucesso(novaOS);

      // Pergunta se deseja fazer o checklist imediatamente
      Alert.alert(
        'OS Aberta com Sucesso!',
        `Ordem de Serviço #${novaOS.numero} (${novaOS.placa}) criada com status "Recebido".`,
        [
          {
            text: 'Ver no Pátio',
            style: 'cancel',
            onPress: handleFechar,
          },
          {
            text: 'Fazer Checklist',
            style: 'default',
            onPress: () => {
              handleFechar();
              if (aoIniciarChecklistAposCriar) {
                aoIniciarChecklistAposCriar(novaOS);
              }
            },
          },
        ]
      );
    } catch (e: any) {
      setSalvando(false);
      const mensagem = extrairMensagemErro(e);

      // Tratamento especial se o km for menor que o registrado no veículo
      if (!confirmarKmMenor && mensagem.toLowerCase().includes('menor que a registrada')) {
        Alert.alert(
          'Aviso de Quilometragem',
          `${mensagem}\n\nDeseja abrir a Ordem de Serviço assim mesmo?`,
          [
            { text: 'Corrigir KM', style: 'cancel' },
            {
              text: 'Confirmar e Abrir',
              onPress: () => handleCriarOS(true),
            },
          ]
        );
        return;
      }

      Alert.alert('Erro ao Abrir OS', mensagem);
    }
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent
      onRequestClose={handleFechar}
    >
      <KeyboardAvoidingView
        style={styles.fundoModal}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.cardModal}>
          {/* Cabeçalho */}
          <View style={styles.cabecalho}>
            <View style={styles.cabecalhoTextoCol}>
              <Text style={styles.tituloModal}>Nova Ordem de Serviço</Text>
              <Text style={styles.subtituloModal}>
                Abertura rápida para entrada de veículo no pátio
              </Text>
            </View>
            <TouchableOpacity onPress={handleFechar} style={styles.botaoFecharIcone}>
              <Ionicons name="close" size={24} color={CORES.texto} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.corpoScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. SEÇÃO DO VEÍCULO / PLACA */}
            <View style={styles.secaoBox}>
              <Text style={styles.secaoTitulo}>1. Identificação do Veículo</Text>

              <View style={styles.campoContainer}>
                <Text style={styles.rotuloCampo}>PLACA DO VEÍCULO *</Text>
                <View style={styles.inputPlacaLinha}>
                  <TextInput
                    style={styles.inputPlaca}
                    placeholder="Ex: ABC1D23"
                    placeholderTextColor={CORES.textoMudo}
                    value={placaTexto}
                    onChangeText={handlePlacaChange}
                    autoCapitalize="characters"
                    maxLength={8}
                  />
                  {buscandoVeiculo && (
                    <ActivityIndicator size="small" color={CORES.primariaClara} style={{ marginRight: 8 }} />
                  )}
                  {placaTexto.length >= 7 && (
                    <PlacaVeiculo placa={placaTexto} tamanho="pequeno" />
                  )}
                </View>
              </View>

              {/* Veículo Encontrado no Banco */}
              {veiculoEncontrado && (
                <View style={styles.cardVeiculoIdentificado}>
                  <View style={styles.topoVeiculoIdentificado}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={styles.textoVeiculoIdentificadoTitulo}>Veículo Cadastrado na Oficina</Text>
                  </View>
                  <Text style={styles.textoVeiculoIdentificadoDescricao}>
                    {veiculoEncontrado.descricao || `${veiculoEncontrado.marca || ''} ${veiculoEncontrado.modelo || ''}`}
                  </Text>
                  <View style={styles.clienteVeiculoLinha}>
                    <Ionicons name="person-outline" size={14} color="#94A3B8" />
                    <Text style={styles.clienteVeiculoTexto}>
                      Cliente: <Text style={{ color: '#F1F5F9', fontWeight: '700' }}>{veiculoEncontrado.clienteNome}</Text>
                    </Text>
                  </View>
                  {veiculoEncontrado.kmAtual > 0 && (
                    <Text style={styles.kmAnteriorTexto}>
                      Último KM registrado: {veiculoEncontrado.kmAtual.toLocaleString('pt-BR')} km
                    </Text>
                  )}
                </View>
              )}

              {/* Veículo Novo: Formulário de Cadastro Rápido */}
              {veiculoNaoEncontrado && (
                <View style={styles.boxCadastroRapido}>
                  <View style={styles.avisoNovoVeiculo}>
                    <Ionicons name="sparkles" size={18} color="#38BDF8" />
                    <Text style={styles.avisoNovoVeiculoTexto}>
                      Placa nova! Complete os dados do veículo e cliente:
                    </Text>
                  </View>

                  <View style={styles.campoContainer}>
                    <Text style={styles.rotuloCampo}>MODELO DO CARRO *</Text>
                    <TextInput
                      style={styles.inputGeral}
                      placeholder="Ex: Fiat Argo 1.0 Flex, VW Gol 1.6"
                      placeholderTextColor={CORES.textoMudo}
                      value={novoModelo}
                      onChangeText={setNovoModelo}
                    />
                  </View>

                  <View style={styles.campoContainer}>
                    <Text style={styles.rotuloCampo}>NOME DO CLIENTE *</Text>
                    <TextInput
                      style={styles.inputGeral}
                      placeholder="Nome completo do proprietário"
                      placeholderTextColor={CORES.textoMudo}
                      value={novoClienteNome}
                      onChangeText={setNovoClienteNome}
                    />
                  </View>

                  <View style={styles.campoContainer}>
                    <Text style={styles.rotuloCampo}>WHATSAPP / CELULAR (OPCIONAL)</Text>
                    <TextInput
                      style={styles.inputGeral}
                      placeholder="(DD) 99999-9999"
                      placeholderTextColor={CORES.textoMudo}
                      value={novoClienteTelefone}
                      onChangeText={setNovoClienteTelefone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              )}
            </View>

            {/* 2. SEÇÃO DE DETALHES DO ATENDIMENTO */}
            <View style={styles.secaoBox}>
              <Text style={styles.secaoTitulo}>2. Detalhes da Entrada</Text>

              {/* KM Atual */}
              <View style={styles.campoContainer}>
                <Text style={styles.rotuloCampo}>QUILOMETRAGEM ATUAL (KM)</Text>
                <TextInput
                  style={styles.inputGeral}
                  placeholder="Ex: 45000"
                  placeholderTextColor={CORES.textoMudo}
                  value={kmEntrada}
                  onChangeText={setKmEntrada}
                  keyboardType="numeric"
                />
              </View>

              {/* Box / Elevador de Alocação */}
              {boxes.length > 0 && (
                <View style={styles.campoContainer}>
                  <Text style={styles.rotuloCampo}>ALOCAÇÃO DE BOX NO PÁTIO (OPCIONAL)</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsScroll}
                  >
                    <TouchableOpacity
                      style={[styles.chipBox, boxId === null && styles.chipBoxAtivo]}
                      onPress={() => setBoxId(null)}
                    >
                      <Text style={[styles.chipBoxTexto, boxId === null && styles.chipBoxTextoAtivo]}>
                        Nenhum Box
                      </Text>
                    </TouchableOpacity>
                    {boxes.map((b) => (
                      <TouchableOpacity
                        key={b.id}
                        style={[styles.chipBox, boxId === b.id && styles.chipBoxAtivo]}
                        onPress={() => setBoxId(b.id)}
                      >
                        <Ionicons
                          name="business-outline"
                          size={13}
                          color={boxId === b.id ? '#FFFFFF' : '#38BDF8'}
                        />
                        <Text style={[styles.chipBoxTexto, boxId === b.id && styles.chipBoxTextoAtivo]}>
                          {b.nome}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Prioridade */}
              <View style={styles.campoContainer}>
                <Text style={styles.rotuloCampo}>PRIORIDADE DA ORDEM DE SERVIÇO</Text>
                <View style={styles.prioridadeLinha}>
                  {PRIORIDADES.map((p) => {
                    const ativa = prioridade === p.chave;
                    return (
                      <TouchableOpacity
                        key={p.chave}
                        style={[
                          styles.chipPrioridade,
                          ativa && { backgroundColor: `${p.cor}22`, borderColor: p.cor },
                        ]}
                        onPress={() => setPrioridade(p.chave)}
                      >
                        <View style={[styles.pontoPrioridade, { backgroundColor: p.cor }]} />
                        <Text
                          style={[
                            styles.chipPrioridadeTexto,
                            ativa && { color: p.cor, fontWeight: '800' },
                          ]}
                        >
                          {p.rotulo}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Queixa do Cliente / Motivo */}
              <View style={styles.campoContainer}>
                <Text style={styles.rotuloCampo}>QUEIXA DO CLIENTE / MOTIVO DA ENTRADA</Text>
                <TextInput
                  style={styles.inputMultiLinha}
                  placeholder="Descreva o problema relatado pelo cliente ou serviço desejado..."
                  placeholderTextColor={CORES.textoMudo}
                  value={queixaCliente}
                  onChangeText={setQueixaCliente}
                  multiline
                  numberOfLines={3}
                />

                {/* Sugestões Rápidas de Queixa */}
                <Text style={styles.dicaSugestoes}>Sugestões rápidas:</Text>
                <View style={styles.sugestoesLinha}>
                  {QUEIXAS_SUGERIDAS.map((sugestao) => (
                    <TouchableOpacity
                      key={sugestao}
                      style={styles.chipSugestao}
                      onPress={() => {
                        if (!queixaCliente) {
                          setQueixaCliente(sugestao);
                        } else if (!queixaCliente.includes(sugestao)) {
                          setQueixaCliente(`${queixaCliente}; ${sugestao}`);
                        }
                      }}
                    >
                      <Text style={styles.chipSugestaoTexto}>{sugestao}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Rodapé com Botão de Confirmação */}
          <View style={[styles.rodape, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[styles.botaoAbrirOS, salvando && { opacity: 0.7 }]}
              onPress={() => handleCriarOS(false)}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="car-sport" size={20} color="#FFFFFF" />
                  <Text style={styles.botaoAbrirOSTexto}>Abrir Ordem de Serviço</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botaoCancelar}
              onPress={handleFechar}
              disabled={salvando}
            >
              <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  cardModal: {
    backgroundColor: CORES.superficie,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingTop: 16,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  cabecalhoTextoCol: {
    flex: 1,
  },
  tituloModal: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
  },
  subtituloModal: {
    color: CORES.textoSecundario,
    fontSize: 12,
    marginTop: 2,
  },
  botaoFecharIcone: {
    padding: 6,
  },
  corpoScroll: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  secaoBox: {
    backgroundColor: CORES.fundo,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  secaoTitulo: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  campoContainer: {
    marginBottom: 12,
  },
  rotuloCampo: {
    color: CORES.textoMudo,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputPlacaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 12,
    height: 48,
  },
  inputPlaca: {
    flex: 1,
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  cardVeiculoIdentificado: {
    backgroundColor: '#0F2942',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  topoVeiculoIdentificado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  textoVeiculoIdentificadoTitulo: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  textoVeiculoIdentificadoDescricao: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  clienteVeiculoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clienteVeiculoTexto: {
    color: '#94A3B8',
    fontSize: 13,
  },
  kmAnteriorTexto: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  boxCadastroRapido: {
    backgroundColor: '#0B1E2D',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#0369A1',
  },
  avisoNovoVeiculo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  avisoNovoVeiculoTexto: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  inputGeral: {
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 12,
    height: 44,
    color: CORES.texto,
    fontSize: 14,
  },
  inputMultiLinha: {
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
    padding: 12,
    color: CORES.texto,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  dicaSugestoes: {
    color: CORES.textoMudo,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 6,
  },
  sugestoesLinha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipSugestao: {
    backgroundColor: CORES.superficieClara,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  chipSugestaoTexto: {
    color: CORES.textoSecundario,
    fontSize: 11,
    fontWeight: '600',
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  chipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: CORES.superficieClara,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  chipBoxAtivo: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  chipBoxTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '700',
  },
  chipBoxTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  prioridadeLinha: {
    flexDirection: 'row',
    gap: 8,
  },
  chipPrioridade: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: CORES.superficieClara,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  pontoPrioridade: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipPrioridadeTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '700',
  },
  rodape: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: CORES.superficie,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    gap: 8,
  },
  botaoAbrirOS: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    elevation: 3,
  },
  botaoAbrirOSTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  botaoCancelar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  botaoCancelarTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
    fontWeight: '600',
  },
});
