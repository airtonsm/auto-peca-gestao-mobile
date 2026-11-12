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
import { RespostaOSResumo, RespostaOSCompleta } from '../types';
import { CORES } from '../constants';
import { useAuth } from '../context/AuthContext';
import { podeFaturarCaixa } from '../utils/segurancaFiscal';
import { osApi } from '../api/osApi';
import { extrairMensagemErro } from '../api/clienteHttp';
import { PlacaVeiculo } from './PlacaVeiculo';

interface ModalFaturamentoCaixaProps {
  visivel: boolean;
  os: RespostaOSResumo | RespostaOSCompleta | null;
  aoFechar: () => void;
  aoFaturamentoSucesso: () => void;
}

interface FormaPagamentoOpcao {
  id: string;
  rotulo: string;
  icone: keyof typeof Ionicons.glyphMap;
}

const FORMAS_PAGAMENTO: FormaPagamentoOpcao[] = [
  { id: 'PIX', rotulo: 'PIX', icone: 'flash-outline' },
  { id: 'DINHEIRO', rotulo: 'Dinheiro', icone: 'cash-outline' },
  { id: 'CARTAO_DEBITO', rotulo: 'Cartão Débito', icone: 'card-outline' },
  { id: 'CARTAO_CREDITO', rotulo: 'Cartão Crédito', icone: 'card' },
  { id: 'BOLETO', rotulo: 'Boleto / A Prazo', icone: 'document-text-outline' },
];

export const ModalFaturamentoCaixa: React.FC<ModalFaturamentoCaixaProps> = ({
  visivel,
  os,
  aoFechar,
  aoFaturamentoSucesso,
}) => {
  const insets = useSafeAreaInsets();
  const { usuario } = useAuth();

  // Permissão do operador
  const temPermissao = useMemo(() => podeFaturarCaixa(usuario), [usuario]);

  // Estados Financeiros
  const valorServicos = Number(os?.valorTotal || 0);
  const valorPecas = Number(os?.valorPecas || 0);
  const subtotalBruto = valorServicos + valorPecas;

  const [descontoTexto, setDescontoTexto] = useState<string>('0');
  const descontoNumerico = useMemo(() => {
    const limpo = descontoTexto.replace(',', '.');
    const valor = parseFloat(limpo);
    return isNaN(valor) || valor < 0 ? 0 : Math.min(valor, subtotalBruto);
  }, [descontoTexto, subtotalBruto]);

  const totalFinal = Math.max(0, subtotalBruto - descontoNumerico);

  // Estados de Pagamento
  const [formaSelecionada, setFormaSelecionada] = useState<string>('PIX');
  const [parcelas, setParcelas] = useState<number>(1);
  const [valorRecebidoDinheiro, setValorRecebidoDinheiro] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');

  // Cálculo de troco em dinheiro
  const trocoDinheiro = useMemo(() => {
    if (formaSelecionada !== 'DINHEIRO') return 0;
    const recebido = parseFloat(valorRecebidoDinheiro.replace(',', '.')) || 0;
    return Math.max(0, recebido - totalFinal);
  }, [formaSelecionada, valorRecebidoDinheiro, totalFinal]);

  // Estados de Processamento e Sucesso
  const [processando, setProcessando] = useState<boolean>(false);
  const [faturamentoConcluido, setFaturamentoConcluido] = useState<boolean>(false);

  // Limpa o formulário quando o modal abre ou fecha
  useEffect(() => {
    if (!visivel || !os?.id) {
      setFaturamentoConcluido(false);
      setDescontoTexto('0');
      setFormaSelecionada('PIX');
      setParcelas(1);
      setValorRecebidoDinheiro('');
      setObservacoes('');
    }
  }, [visivel, os?.id]);

  // Execução do Faturamento no Caixa
  const handleConfirmarFaturamento = async () => {
    if (!os?.id) return;

    if (!temPermissao) {
      Alert.alert(
        'Acesso Restrito',
        'Apenas operadores com perfil Caixa, Administrador ou com autorização expressa do Administrador podem faturar a OS.'
      );
      return;
    }

    setProcessando(true);
    try {
      const pedidoFaturamento = {
        formaPagamento: formaSelecionada,
        desconto: descontoNumerico,
        parcelas: formaSelecionada === 'CARTAO_CREDITO' ? parcelas : 1,
        observacao: observacoes.trim() || undefined,
      };

      await osApi.faturarOS(os.id, pedidoFaturamento);

      setFaturamentoConcluido(true);
      aoFaturamentoSucesso();
    } catch (error: any) {
      const msg = extrairMensagemErro(error, 'Não foi possível concluir o faturamento da OS.');
      Alert.alert('Erro ao Faturar', msg);
    } finally {
      setProcessando(false);
    }
  };

  if (!visivel || !os) return null;

  return (
    <Modal visible={visivel} animationType="slide" transparent={false} onRequestClose={aoFechar}>
      <KeyboardAvoidingView
        style={styles.containerPrincipal}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Topo / Cabeçalho */}
        <View style={[styles.cabecalho, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity style={styles.botaoFechar} onPress={aoFechar} disabled={processando}>
            <Ionicons name="close" size={24} color={CORES.texto} />
          </TouchableOpacity>
          <View style={styles.cabecalhoInfo}>
            <Text style={styles.cabecalhoTitulo}>Caixa & Faturamento</Text>
            <Text style={styles.cabecalhoSubtitulo}>
              OS #{os.numero} · {os.clienteNome || 'Cliente'}
            </Text>
          </View>
          <View style={styles.espacadorDireito} />
        </View>

        {/* TELA DE SUCESSO / PÓS-FATURAMENTO */}
        {faturamentoConcluido ? (
          <View style={styles.sucessoContainer}>
            <ScrollView contentContainerStyle={styles.sucessoConteudo}>
              <View style={styles.sucessoIconeWrapper}>
                <Ionicons name="checkmark-circle" size={72} color={CORES.sucesso} />
              </View>

              <Text style={styles.sucessoTitulo}>OS #{os.numero} Faturada!</Text>
              <Text style={styles.sucessoSubtitulo}>
                O pagamento foi registrado com sucesso e o veículo foi finalizado para entrega.
              </Text>

              {/* Resumo do Pagamento */}
              <View style={styles.cardSucessoResumo}>
                <View style={styles.linhaResumo}>
                  <Text style={styles.linhaResumoLabel}>Forma de Pagamento:</Text>
                  <Text style={styles.linhaResumoValor}>{formaSelecionada}</Text>
                </View>
                <View style={styles.linhaResumo}>
                  <Text style={styles.linhaResumoLabel}>Subtotal Bruto:</Text>
                  <Text style={styles.linhaResumoValor}>R$ {subtotalBruto.toFixed(2)}</Text>
                </View>
                {descontoNumerico > 0 && (
                  <View style={styles.linhaResumo}>
                    <Text style={[styles.linhaResumoLabel, { color: CORES.sucessoTexto }]}>
                      Desconto:
                    </Text>
                    <Text style={[styles.linhaResumoValor, { color: CORES.sucessoTexto }]}>
                      - R$ {descontoNumerico.toFixed(2)}
                    </Text>
                  </View>
                )}
                <View style={styles.linhaResumo}>
                  <Text style={styles.linhaResumoLabel}>Total Recebido:</Text>
                  <Text style={[styles.linhaResumoValor, { color: CORES.sucessoTexto }]}>
                    R$ {totalFinal.toFixed(2)}
                  </Text>
                </View>
                {trocoDinheiro > 0 && (
                  <View style={styles.linhaResumo}>
                    <Text style={styles.linhaResumoLabel}>Troco Devolvido:</Text>
                    <Text style={[styles.linhaResumoValor, { color: '#86EFAC' }]}>
                      R$ {trocoDinheiro.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={[styles.rodapeFixo, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <TouchableOpacity style={styles.botaoConcluir} onPress={aoFechar}>
                <Text style={styles.botaoConcluirTexto}>Concluir e Voltar ao Pátio</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* FORMULÁRIO DE FECHAMENTO DE CAIXA */
          <ScrollView
            style={styles.scrollFormulario}
            contentContainerStyle={styles.scrollConteudo}
            keyboardShouldPersistTaps="handled"
          >
            {/* Banner de Verificação de Permissão */}
            {!temPermissao && (
              <View style={styles.bannerAlertaPermissao}>
                <Ionicons name="shield-outline" size={22} color="#EF4444" />
                <View style={styles.bannerAlertaTextoContainer}>
                  <Text style={styles.bannerAlertaTitulo}>Acesso Restrito ao Caixa</Text>
                  <Text style={styles.bannerAlertaDescricao}>
                    Apenas operadores com perfil Caixa, Administrador ou permissão de faturamento
                    concedida pelo Administrador podem finalizar esta OS.
                  </Text>
                </View>
              </View>
            )}

            {/* Card Veículo & Placa */}
            <View style={styles.cardVeiculo}>
              <PlacaVeiculo placa={os.placa} tamanho="pequeno" />
              <View style={styles.cardVeiculoTexto}>
                <Text style={styles.veiculoDescricao} numberOfLines={1}>
                  {os.veiculoDescricao || 'Veículo'}
                </Text>
                <Text style={styles.clienteDescricao} numberOfLines={1}>
                  {os.clienteNome || 'Cliente não identificado'}
                </Text>
              </View>
            </View>

            {/* SEÇÃO 1: RESUMO FINANCEIRO & DESCONTO */}
            <View style={styles.secao}>
              <Text style={styles.secaoTitulo}>1. Resumo Financeiro</Text>

              <View style={styles.cardFinanceiro}>
                <View style={styles.linhaFinanceira}>
                  <Text style={styles.linhaFinanceiraLabel}>Mão de Obra (Serviços):</Text>
                  <Text style={styles.linhaFinanceiraValor}>R$ {valorServicos.toFixed(2)}</Text>
                </View>
                <View style={styles.linhaFinanceira}>
                  <Text style={styles.linhaFinanceiraLabel}>Peças e Materiais:</Text>
                  <Text style={styles.linhaFinanceiraValor}>R$ {valorPecas.toFixed(2)}</Text>
                </View>
                <View style={[styles.linhaFinanceira, styles.linhaSubtotal]}>
                  <Text style={styles.linhaSubtotalLabel}>Subtotal Bruto:</Text>
                  <Text style={styles.linhaSubtotalValor}>R$ {subtotalBruto.toFixed(2)}</Text>
                </View>

                {/* Campo Desconto */}
                <View style={styles.descontoContainer}>
                  <Text style={styles.descontoLabel}>Desconto concedido (R$):</Text>
                  <View style={styles.inputDescontoWrapper}>
                    <Text style={styles.cifrao}>R$</Text>
                    <TextInput
                      style={styles.inputDesconto}
                      keyboardType="numeric"
                      value={descontoTexto}
                      onChangeText={setDescontoTexto}
                      placeholder="0.00"
                      placeholderTextColor={CORES.textoMudo}
                    />
                  </View>
                </View>

                {/* Total Final em Destaque */}
                <View style={styles.totalDestaqueContainer}>
                  <Text style={styles.totalDestaqueLabel}>Total Líquido a Pagar</Text>
                  <Text style={styles.totalDestaqueValor}>R$ {totalFinal.toFixed(2)}</Text>
                </View>
              </View>
            </View>

            {/* SEÇÃO 2: FORMAS DE PAGAMENTO */}
            <View style={styles.secao}>
              <Text style={styles.secaoTitulo}>2. Forma de Pagamento</Text>
              <View style={styles.gradeFormasPagamento}>
                {FORMAS_PAGAMENTO.map((f) => {
                  const ativa = formaSelecionada === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.botaoForma, ativa && styles.botaoFormaAtiva]}
                      onPress={() => setFormaSelecionada(f.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={f.icone}
                        size={20}
                        color={ativa ? '#FFFFFF' : CORES.primariaClara}
                      />
                      <Text style={[styles.botaoFormaTexto, ativa && styles.botaoFormaTextoAtiva]}>
                        {f.rotulo}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Detalhe Cartão de Crédito (Parcelamento) */}
              {formaSelecionada === 'CARTAO_CREDITO' && (
                <View style={styles.cardOpcaoExtra}>
                  <Text style={styles.opcaoExtraLabel}>Número de Parcelas:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.listaParcelas}
                  >
                    {[1, 2, 3, 4, 5, 6, 10, 12].map((p) => {
                      const selecionada = parcelas === p;
                      const valorParcela = totalFinal / p;
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[styles.botaoParcela, selecionada && styles.botaoParcelaAtiva]}
                          onPress={() => setParcelas(p)}
                        >
                          <Text
                            style={[styles.parcelaTitulo, selecionada && styles.parcelaTextoAtivo]}
                          >
                            {p}x
                          </Text>
                          <Text
                            style={[
                              styles.parcelaSubtitulo,
                              selecionada && styles.parcelaTextoAtivo,
                            ]}
                          >
                            R$ {valorParcela.toFixed(2)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Detalhe Dinheiro (Cálculo de Troco) */}
              {formaSelecionada === 'DINHEIRO' && (
                <View style={styles.cardOpcaoExtra}>
                  <Text style={styles.opcaoExtraLabel}>Valor entregue pelo cliente:</Text>
                  <View style={styles.inputTrocoWrapper}>
                    <Text style={styles.cifrao}>R$</Text>
                    <TextInput
                      style={styles.inputDesconto}
                      keyboardType="numeric"
                      value={valorRecebidoDinheiro}
                      onChangeText={setValorRecebidoDinheiro}
                      placeholder={totalFinal.toFixed(2)}
                      placeholderTextColor={CORES.textoMudo}
                    />
                  </View>
                  {trocoDinheiro > 0 && (
                    <View style={styles.trocoAlerta}>
                      <Ionicons name="cash" size={18} color="#22C55E" />
                      <Text style={styles.trocoAlertaTexto}>
                        Troco a devolver:{' '}
                        <Text style={styles.trocoAlertaValor}>R$ {trocoDinheiro.toFixed(2)}</Text>
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* SEÇÃO 3: OBSERVAÇÕES OPCIONAIS */}
            <View style={styles.secao}>
              <Text style={styles.secaoTitulo}>3. Observações do Fechamento (Opcional)</Text>
              <TextInput
                style={styles.inputObservacao}
                placeholder="Observações internas sobre o recebimento ou cliente..."
                placeholderTextColor={CORES.textoMudo}
                value={observacoes}
                onChangeText={setObservacoes}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* RODAPÉ COM BOTÃO DE CONFIRMAÇÃO DO CAIXA */}
        {!faturamentoConcluido && (
          <View style={[styles.rodapeFixo, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[
                styles.botaoFinalizar,
                !temPermissao && styles.botaoFinalizarDesabilitado,
                processando && styles.botaoFinalizarDesabilitado,
              ]}
              onPress={handleConfirmarFaturamento}
              disabled={!temPermissao || processando}
              activeOpacity={0.8}
            >
              {processando ? (
                <View style={styles.linhaBotao}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.botaoFinalizarTexto}>Processando Fechamento...</Text>
                </View>
              ) : (
                <View style={styles.linhaBotao}>
                  <Ionicons name="checkmark-done" size={22} color="#FFFFFF" />
                  <Text style={styles.botaoFinalizarTexto}>
                    Faturar no Caixa (R$ {totalFinal.toFixed(2)})
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  containerPrincipal: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: CORES.superficie,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  botaoFechar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabecalhoInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cabecalhoTitulo: {
    color: CORES.texto,
    fontSize: 17,
    fontWeight: '700',
  },
  cabecalhoSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 12,
    marginTop: 2,
  },
  espacadorDireito: {
    width: 36,
  },
  scrollFormulario: {
    flex: 1,
  },
  scrollConteudo: {
    padding: 16,
  },
  bannerAlertaPermissao: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  bannerAlertaTextoContainer: {
    flex: 1,
    marginLeft: 10,
  },
  bannerAlertaTitulo: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  bannerAlertaDescricao: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 18,
  },
  cardVeiculo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    marginBottom: 16,
  },
  cardVeiculoTexto: {
    flex: 1,
    marginLeft: 12,
  },
  veiculoDescricao: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
  },
  clienteDescricao: {
    color: CORES.textoSecundario,
    fontSize: 12,
    marginTop: 2,
  },
  secao: {
    marginBottom: 20,
  },
  secaoTitulo: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  cardFinanceiro: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  linhaFinanceira: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  linhaFinanceiraLabel: {
    color: CORES.textoSecundario,
    fontSize: 13,
  },
  linhaFinanceiraValor: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '600',
  },
  linhaSubtotal: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 4,
  },
  linhaSubtotalLabel: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '700',
  },
  linhaSubtotalValor: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
  },
  descontoContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  descontoLabel: {
    color: CORES.textoSecundario,
    fontSize: 12,
    marginBottom: 6,
  },
  inputDescontoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  cifrao: {
    color: CORES.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
  },
  inputDesconto: {
    flex: 1,
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 8,
  },
  totalDestaqueContainer: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalDestaqueLabel: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '700',
  },
  totalDestaqueValor: {
    color: '#60A5FA',
    fontSize: 20,
    fontWeight: '800',
  },
  gradeFormasPagamento: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  botaoForma: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 6,
  },
  botaoFormaAtiva: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primariaClara,
  },
  botaoFormaTexto: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '600',
  },
  botaoFormaTextoAtiva: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cardOpcaoExtra: {
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  opcaoExtraLabel: {
    color: CORES.textoSecundario,
    fontSize: 12,
    marginBottom: 8,
  },
  listaParcelas: {
    flexDirection: 'row',
  },
  botaoParcela: {
    backgroundColor: CORES.fundo,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  botaoParcelaAtiva: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primariaClara,
  },
  parcelaTitulo: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '700',
  },
  parcelaSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 11,
    marginTop: 2,
  },
  parcelaTextoAtivo: {
    color: '#FFFFFF',
  },
  inputTrocoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  trocoAlerta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  trocoAlertaTexto: {
    color: '#86EFAC',
    fontSize: 13,
  },
  trocoAlertaValor: {
    color: '#86EFAC',
    fontWeight: '800',
  },
  inputObservacao: {
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    color: CORES.texto,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  rodapeFixo: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: CORES.superficie,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
  },
  botaoFinalizar: {
    backgroundColor: CORES.primaria,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoFinalizarDesabilitado: {
    opacity: 0.5,
    backgroundColor: CORES.cinza,
  },
  linhaBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  botaoFinalizarTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sucessoContainer: {
    flex: 1,
  },
  sucessoConteudo: {
    padding: 24,
    alignItems: 'center',
  },
  sucessoIconeWrapper: {
    marginVertical: 16,
  },
  sucessoTitulo: {
    color: CORES.texto,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  sucessoSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  cardSucessoResumo: {
    width: '100%',
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  linhaResumo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  linhaResumoLabel: {
    color: CORES.textoSecundario,
    fontSize: 14,
  },
  linhaResumoValor: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
  },
  botaoConcluir: {
    backgroundColor: CORES.sucesso,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botaoConcluirTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
