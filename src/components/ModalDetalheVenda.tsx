import React, { useState, useEffect } from 'react';
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
import { VendaBalcao, ComprovanteVenda, PedidoFecharVenda } from '../types';
import { CORES } from '../constants';
import { vendasApi } from '../api/vendasApi';
import { extrairMensagemErro } from '../api/clienteHttp';
import {
  formatarMoeda,
  gerarHtmlComprovanteVenda,
  gerarTextoVendaParaWhatsApp,
  rotuloFormaPagamentoVenda,
} from '../utils/imprimirVendaHtml';
import { abrirWhatsAppDireto } from '../utils/whatsappHelper';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

interface ModalDetalheVendaProps {
  visivel: boolean;
  vendaId: string | null;
  aoFechar: () => void;
  aoAtualizar?: () => void;
  nomeOficina?: string;
}

export const ModalDetalheVenda: React.FC<ModalDetalheVendaProps> = ({
  visivel,
  vendaId,
  aoFechar,
  aoAtualizar,
  nomeOficina = 'AutoF - Gestão de Oficinas',
}) => {
  const insets = useSafeAreaInsets();

  const [carregando, setCarregando] = useState<boolean>(true);
  const [comprovante, setComprovante] = useState<ComprovanteVenda | null>(null);
  const [processandoAcao, setProcessandoAcao] = useState<boolean>(false);

  // Modal interno de aprovação de orçamento
  const [dialogoAprovacaoAberto, setDialogoAprovacaoAberto] = useState<boolean>(false);
  const [formaPagamentoAprovacao, setFormaPagamentoAprovacao] = useState<string>('dinheiro');
  const [parcelasAprovacao, setParcelasAprovacao] = useState<number>(1);

  useEffect(() => {
    if (!visivel || !vendaId) {
      setComprovante(null);
      setDialogoAprovacaoAberto(false);
      return;
    }
    carregarComprovante();
  }, [visivel, vendaId]);

  const carregarComprovante = async () => {
    if (!vendaId) return;
    setCarregando(true);
    try {
      const dados = await vendasApi.obterComprovante(vendaId);
      setComprovante(dados);
    } catch (err) {
      Alert.alert('Erro', extrairMensagemErro(err, 'Falha ao carregar detalhes da venda.'));
      aoFechar();
    } finally {
      setCarregando(false);
    }
  };

  const ehOrcamento = comprovante?.status === 'orcamento';
  const ehCancelada = comprovante?.status === 'cancelada';

  // Compartilhar WhatsApp
  const handleCompartilharWhatsApp = async () => {
    if (!comprovante) return;
    const texto = gerarTextoVendaParaWhatsApp(comprovante, nomeOficina);
    const tel = comprovante.clienteTelefone || '';
    if (tel) {
      await abrirWhatsAppDireto(tel, texto);
    } else {
      // Abre sem telefone direto ou compartilha texto
      await abrirWhatsAppDireto('', texto);
    }
  };

  // Imprimir / Salvar PDF
  const handleImprimirOuCompartilharPDF = async () => {
    if (!comprovante) return;
    try {
      setProcessandoAcao(true);
      const html = gerarHtmlComprovanteVenda({
        comprovante,
        nomeOficina,
        formato: 'termico',
      });

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `${ehOrcamento ? 'Orçamento' : 'Comprovante'} #${comprovante.numero}`,
        });
      } else {
        await Print.printAsync({ html });
      }
    } catch (err) {
      Alert.alert('Erro ao Gerar Documento', extrairMensagemErro(err, 'Não foi possível imprimir o comprovante.'));
    } finally {
      setProcessandoAcao(false);
    }
  };

  // Cancelar Venda
  const handleCancelar = () => {
    if (!comprovante || !vendaId) return;
    const tipo = ehOrcamento ? 'o orçamento' : 'a venda';
    Alert.alert(
      `Cancelar ${tipo.toUpperCase()}`,
      `Deseja realmente cancelar ${tipo} #${comprovante.numero}? As peças retornarão ao estoque imediatamente.`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessandoAcao(true);
              await vendasApi.cancelarVenda(vendaId);
              Alert.alert('Sucesso', `${tipo} foi cancelado com sucesso.`);
              aoAtualizar?.();
              aoFechar();
            } catch (err) {
              Alert.alert('Erro ao Cancelar', extrairMensagemErro(err, 'Não foi possível cancelar.'));
            } finally {
              setProcessandoAcao(false);
            }
          },
        },
      ]
    );
  };

  // Aprovar Orçamento
  const handleConfirmarAprovacao = async () => {
    if (!comprovante || !vendaId) return;
    try {
      setProcessandoAcao(true);
      const pedido: PedidoFecharVenda = {
        formaPagamento: formaPagamentoAprovacao,
        desconto: comprovante.desconto || 0,
        parcelas: parcelasAprovacao,
      };
      await vendasApi.aprovarOrcamento(vendaId, pedido);
      setDialogoAprovacaoAberto(false);
      Alert.alert('Sucesso', `Orçamento #${comprovante.numero} aprovado e transformado em venda!`);
      aoAtualizar?.();
      await carregarComprovante();
    } catch (err) {
      Alert.alert('Erro ao Aprovar', extrairMensagemErro(err, 'Não foi possível aprovar o orçamento.'));
    } finally {
      setProcessandoAcao(false);
    }
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent={false}
      onRequestClose={aoFechar}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.botaoFechar}
            onPress={aoFechar}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={CORES.texto} />
          </TouchableOpacity>

          <View style={styles.headerTituloContainer}>
            <Text style={styles.headerTitulo}>
              {ehOrcamento ? 'Orçamento de Peças' : 'Comprovante de Venda'}
            </Text>
            {comprovante && (
              <Text style={styles.headerSubtitulo}>#{comprovante.numero}</Text>
            )}
          </View>

          <View style={{ width: 40 }} />
        </View>

        {carregando ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={CORES.primariaClara} />
            <Text style={styles.loadingTexto}>Carregando detalhes...</Text>
          </View>
        ) : !comprovante ? (
          <View style={styles.loadingContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={CORES.textoMudo} />
            <Text style={styles.loadingTexto}>Venda não encontrada.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.conteudo}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 150 }]}
          >
            {/* Faixa de Status */}
            <View
              style={[
                styles.badgeStatusContainer,
                ehCancelada
                  ? styles.badgeCancelada
                  : ehOrcamento
                  ? styles.badgeOrcamento
                  : styles.badgeFechada,
              ]}
            >
              <Ionicons
                name={
                  ehCancelada
                    ? 'close-circle'
                    : ehOrcamento
                    ? 'time-outline'
                    : 'checkmark-circle'
                }
                size={18}
                color={
                  ehCancelada
                    ? CORES.perigoTexto
                    : ehOrcamento
                    ? CORES.alertaTexto
                    : CORES.sucessoTexto
                }
              />
              <Text
                style={[
                  styles.badgeStatusTexto,
                  ehCancelada
                    ? styles.textoCancelado
                    : ehOrcamento
                    ? styles.textoOrcamento
                    : styles.textoFechado,
                ]}
              >
                {ehCancelada
                  ? 'VENDA CANCELADA'
                  : ehOrcamento
                  ? comprovante.vencido
                    ? 'ORÇAMENTO VENCIDO'
                    : 'ORÇAMENTO EM VIGOR'
                  : 'VENDA CONCLUÍDA'}
              </Text>
            </View>

            {/* Informações Principais */}
            <View style={styles.card}>
              <View style={styles.linhaInfo}>
                <Text style={styles.rotuloInfo}>Data da Emissão:</Text>
                <Text style={styles.valorInfo}>
                  {new Date(comprovante.criadaEm).toLocaleDateString('pt-BR')} às{' '}
                  {new Date(comprovante.criadaEm).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>

              {ehOrcamento && comprovante.validaAte && (
                <View style={styles.linhaInfo}>
                  <Text style={styles.rotuloInfo}>Validade:</Text>
                  <Text
                    style={[
                      styles.valorInfo,
                      comprovante.vencido && { color: CORES.perigoTexto, fontWeight: '700' },
                    ]}
                  >
                    Até {new Date(comprovante.validaAte).toLocaleDateString('pt-BR')}{' '}
                    {comprovante.vencido ? '(Vencido)' : ''}
                  </Text>
                </View>
              )}

              <View style={styles.linhaInfo}>
                <Text style={styles.rotuloInfo}>Vendedor / Operador:</Text>
                <Text style={styles.valorInfo}>
                  {comprovante.vendedorNome || 'Balcão da Loja'}
                </Text>
              </View>

              <View style={styles.divisor} />

              <View style={styles.linhaInfo}>
                <Text style={styles.rotuloInfo}>Cliente:</Text>
                <Text style={[styles.valorInfo, styles.destaqueCliente]}>
                  {comprovante.clienteNome || 'Consumidor Final (Avulso)'}
                </Text>
              </View>

              {comprovante.clienteDocumento && (
                <View style={styles.linhaInfo}>
                  <Text style={styles.rotuloInfo}>CPF / CNPJ:</Text>
                  <Text style={styles.valorInfo}>{comprovante.clienteDocumento}</Text>
                </View>
              )}

              {comprovante.clienteTelefone && (
                <View style={styles.linhaInfo}>
                  <Text style={styles.rotuloInfo}>Telefone / WhatsApp:</Text>
                  <Text style={styles.valorInfo}>{comprovante.clienteTelefone}</Text>
                </View>
              )}
            </View>

            {/* Lista de Peças */}
            <View style={styles.secaoTituloContainer}>
              <Ionicons name="cube-outline" size={18} color={CORES.primariaClara} />
              <Text style={styles.secaoTitulo}>
                Itens da Venda ({comprovante.itens?.length || 0})
              </Text>
            </View>

            <View style={styles.cardItens}>
              {(comprovante.itens || []).map((item, idx) => (
                <View
                  key={item.id || String(idx)}
                  style={[
                    styles.itemLinha,
                    idx < (comprovante.itens?.length || 0) - 1 && styles.itemLinhaBorda,
                  ]}
                >
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemDescricao}>
                      {idx + 1}. {item.descricao}
                    </Text>
                    <Text style={styles.itemTotal}>{formatarMoeda(item.total)}</Text>
                  </View>

                  <View style={styles.itemSubLinha}>
                    <Text style={styles.itemMeta}>
                      {item.codigo ? `Cód: ${item.codigo}` : ''}
                      {item.marca ? ` · Marca: ${item.marca}` : ''}
                    </Text>
                    <Text style={styles.itemQtdPreco}>
                      {item.quantidade} UN x {formatarMoeda(item.precoUnitario)}
                    </Text>
                  </View>

                  {item.desconto > 0 && (
                    <Text style={styles.itemDescontoTexto}>
                      Desconto no item: - {formatarMoeda(item.desconto)}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            {/* Resumo Financeiro */}
            <View style={styles.card}>
              <View style={styles.linhaFinanceira}>
                <Text style={styles.rotuloFinanceiro}>Subtotal Bruto:</Text>
                <Text style={styles.valorFinanceiro}>
                  {formatarMoeda(
                    comprovante.subtotal ||
                      comprovante.total + (comprovante.desconto || 0)
                  )}
                </Text>
              </View>

              {comprovante.desconto > 0 && (
                <View style={styles.linhaFinanceira}>
                  <Text style={[styles.rotuloFinanceiro, { color: CORES.sucessoTexto }]}>
                    Desconto:
                  </Text>
                  <Text style={[styles.valorFinanceiro, { color: CORES.sucessoTexto }]}>
                    - {formatarMoeda(comprovante.desconto)}
                  </Text>
                </View>
              )}

              <View style={styles.divisor} />

              <View style={styles.linhaFinanceiraTotal}>
                <Text style={styles.rotuloFinanceiroTotal}>TOTAL LÍQUIDO:</Text>
                <Text style={styles.valorFinanceiroTotal}>
                  {formatarMoeda(comprovante.total)}
                </Text>
              </View>

              {!ehOrcamento && comprovante.formaPagamento && (
                <View style={styles.blocoPagamentoFechado}>
                  <Text style={styles.pagamentoTitulo}>Forma de Pagamento:</Text>
                  <Text style={styles.pagamentoDescricao}>
                    {rotuloFormaPagamentoVenda(comprovante.formaPagamento)}
                    {comprovante.parcelas && comprovante.parcelas > 1
                      ? ` (em ${comprovante.parcelas}x)`
                      : ''}
                  </Text>
                  {comprovante.autorizacaoCartao ? (
                    <Text style={styles.pagamentoNsu}>
                      NSU/Autorização: {comprovante.autorizacaoCartao}
                    </Text>
                  ) : null}
                </View>
              )}

              {comprovante.observacoes ? (
                <View style={styles.blocoObservacoes}>
                  <Text style={styles.observacoesTitulo}>Observações:</Text>
                  <Text style={styles.observacoesTexto}>{comprovante.observacoes}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        )}

        {/* Rodapé de Ações */}
        {comprovante && !carregando && (
          <View style={[styles.rodapeAcoes, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            {/* Se for orçamento: Botão Destacado de Aprovação */}
            {ehOrcamento && !ehCancelada && (
              <TouchableOpacity
                style={styles.botaoAcaoAprovar}
                onPress={() => setDialogoAprovacaoAberto(true)}
                disabled={processandoAcao}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.botaoAcaoAprovarTexto}>Aprovar Orçamento e Vender</Text>
              </TouchableOpacity>
            )}

            {/* Linha de Ações: WhatsApp, Imprimir/PDF e Cancelar */}
            <View style={styles.linhaAcoesSecundarias}>
              <TouchableOpacity
                style={styles.botaoAcaoWhatsapp}
                onPress={handleCompartilharWhatsApp}
                disabled={processandoAcao}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                <Text style={styles.botaoAcaoTexto}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoAcaoPdf}
                onPress={handleImprimirOuCompartilharPDF}
                disabled={processandoAcao}
              >
                {processandoAcao ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="print-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.botaoAcaoTexto}>Imprimir / PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              {!ehCancelada && (
                <TouchableOpacity
                  style={styles.botaoAcaoCancelar}
                  onPress={handleCancelar}
                  disabled={processandoAcao}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Cancelar Operação"
                >
                  <Ionicons name="trash-outline" size={18} color={CORES.perigoTexto} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Modal Diálogo de Aprovação de Orçamento */}
        {dialogoAprovacaoAberto && (
          <Modal
            visible={dialogoAprovacaoAberto}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setDialogoAprovacaoAberto(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.dialogoCard}>
                <Text style={styles.dialogoTitulo}>Aprovar Orçamento e Fechar Venda</Text>
                <Text style={styles.dialogoMensagem}>
                  Selecione a forma de pagamento para concluir a venda no valor de{' '}
                  <Text style={{ fontWeight: '800', color: CORES.primariaClara }}>
                    {formatarMoeda(comprovante?.total)}
                  </Text>
                </Text>

                {/* Formas de pagamento */}
                <Text style={styles.campoLabel}>Forma de Pagamento</Text>
                <View style={styles.gridFormas}>
                  {[
                    { id: 'dinheiro', nome: 'Dinheiro', icone: 'cash-outline' },
                    { id: 'pix', nome: 'PIX', icone: 'qr-code-outline' },
                    { id: 'cartao_credito', nome: 'Crédito', icone: 'card-outline' },
                    { id: 'cartao_debito', nome: 'Débito', icone: 'card' },
                    { id: 'boleto', nome: 'Boleto', icone: 'barcode-outline' },
                    { id: 'crediario', nome: 'A Prazo', icone: 'receipt-outline' },
                  ].map((f) => (
                    <TouchableOpacity
                      key={f.id}
                      style={[
                        styles.opcaoForma,
                        formaPagamentoAprovacao === f.id && styles.opcaoFormaSelecionada,
                      ]}
                      onPress={() => setFormaPagamentoAprovacao(f.id)}
                    >
                      <Ionicons
                        name={f.icone as any}
                        size={16}
                        color={
                          formaPagamentoAprovacao === f.id ? CORES.primariaClara : CORES.textoMudo
                        }
                      />
                      <Text
                        style={[
                          styles.opcaoFormaTexto,
                          formaPagamentoAprovacao === f.id && styles.opcaoFormaTextoSelecionado,
                        ]}
                      >
                        {f.nome}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Parcelas */}
                {formaPagamentoAprovacao === 'cartao_credito' && (
                  <View style={styles.parcelasWrapper}>
                    <Text style={styles.campoLabel}>Número de Parcelas</Text>
                    <View style={styles.linhaParcelas}>
                      {[1, 2, 3, 4, 5, 6, 10, 12].map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={[
                            styles.chipParcela,
                            parcelasAprovacao === num && styles.chipParcelaSelecionado,
                          ]}
                          onPress={() => setParcelasAprovacao(num)}
                        >
                          <Text
                            style={[
                              styles.chipParcelaTexto,
                              parcelasAprovacao === num && styles.chipParcelaTextoSelecionado,
                            ]}
                          >
                            {num}x
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Botões do Diálogo */}
                <View style={styles.dialogoBotoes}>
                  <TouchableOpacity
                    style={styles.botaoDialogoCancelar}
                    onPress={() => setDialogoAprovacaoAberto(false)}
                    disabled={processandoAcao}
                  >
                    <Text style={styles.botaoDialogoCancelarTexto}>Voltar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.botaoDialogoConfirmar}
                    onPress={handleConfirmarAprovacao}
                    disabled={processandoAcao}
                  >
                    {processandoAcao ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.botaoDialogoConfirmarTexto}>Confirmar Venda</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: CORES.superficie,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  botaoFechar: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: CORES.superficieElevada,
  },
  headerTituloContainer: {
    alignItems: 'center',
  },
  headerTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: CORES.texto,
  },
  headerSubtitulo: {
    fontSize: 13,
    color: CORES.primariaClara,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingTexto: {
    marginTop: 12,
    fontSize: 14,
    color: CORES.textoMudo,
  },
  conteudo: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  badgeStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  badgeFechada: {
    backgroundColor: CORES.sucessoFundo,
  },
  badgeOrcamento: {
    backgroundColor: CORES.alertaFundo,
  },
  badgeCancelada: {
    backgroundColor: CORES.perigoFundo,
  },
  badgeStatusTexto: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textoFechado: {
    color: CORES.sucessoTexto,
  },
  textoOrcamento: {
    color: CORES.alertaTexto,
  },
  textoCancelado: {
    color: CORES.perigoTexto,
  },
  card: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 8,
  },
  linhaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rotuloInfo: {
    fontSize: 13,
    color: CORES.textoMudo,
  },
  valorInfo: {
    fontSize: 13,
    fontWeight: '600',
    color: CORES.texto,
  },
  destaqueCliente: {
    fontWeight: '700',
    color: CORES.primariaClara,
  },
  divisor: {
    height: 1,
    backgroundColor: CORES.bordaSuave,
    marginVertical: 4,
  },
  secaoTituloContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  secaoTitulo: {
    fontSize: 15,
    fontWeight: '800',
    color: CORES.texto,
  },
  cardItens: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    overflow: 'hidden',
  },
  itemLinha: {
    padding: 14,
  },
  itemLinhaBorda: {
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemDescricao: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: CORES.texto,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: CORES.texto,
  },
  itemSubLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  itemMeta: {
    fontSize: 12,
    color: CORES.textoMudo,
  },
  itemQtdPreco: {
    fontSize: 12,
    color: CORES.texto,
    fontWeight: '500',
  },
  itemDescontoTexto: {
    fontSize: 11,
    color: CORES.sucessoTexto,
    marginTop: 4,
  },
  linhaFinanceira: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rotuloFinanceiro: {
    fontSize: 13,
    color: CORES.textoMudo,
  },
  valorFinanceiro: {
    fontSize: 13,
    fontWeight: '600',
    color: CORES.texto,
  },
  linhaFinanceiraTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  rotuloFinanceiroTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: CORES.texto,
  },
  valorFinanceiroTotal: {
    fontSize: 18,
    fontWeight: '900',
    color: CORES.primariaClara,
  },
  blocoPagamentoFechado: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
  },
  pagamentoTitulo: {
    fontSize: 11,
    color: CORES.textoMudo,
    textTransform: 'uppercase',
  },
  pagamentoDescricao: {
    fontSize: 13,
    fontWeight: '700',
    color: CORES.texto,
    marginTop: 2,
  },
  pagamentoNsu: {
    fontSize: 11,
    color: CORES.textoMudo,
    marginTop: 2,
  },
  blocoObservacoes: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
  },
  observacoesTitulo: {
    fontSize: 11,
    color: CORES.textoMudo,
    textTransform: 'uppercase',
  },
  observacoesTexto: {
    fontSize: 12,
    color: CORES.texto,
    marginTop: 2,
  },
  rodapeAcoes: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: CORES.superficie,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    gap: 10,
  },
  botaoAcaoAprovar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CORES.sucesso,
    paddingVertical: 13,
    borderRadius: 10,
    width: '100%',
  },
  botaoAcaoAprovarTexto: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  linhaAcoesSecundarias: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  botaoAcaoWhatsapp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: 10,
  },
  botaoAcaoPdf: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: CORES.primaria,
    paddingVertical: 12,
    borderRadius: 10,
  },
  botaoAcaoCancelar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: CORES.perigoFundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoAcaoTexto: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogoCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: CORES.superficie,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  dialogoTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: CORES.texto,
    marginBottom: 6,
  },
  dialogoMensagem: {
    fontSize: 13,
    color: CORES.textoMudo,
    marginBottom: 16,
    lineHeight: 18,
  },
  campoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: CORES.texto,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  gridFormas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  opcaoForma: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    backgroundColor: CORES.superficieElevada,
  },
  opcaoFormaSelecionada: {
    borderColor: CORES.primariaClara,
    backgroundColor: CORES.primariaClara + '15',
  },
  opcaoFormaTexto: {
    fontSize: 12,
    color: CORES.textoMudo,
    fontWeight: '600',
  },
  opcaoFormaTextoSelecionado: {
    color: CORES.primariaClara,
    fontWeight: '700',
  },
  parcelasWrapper: {
    marginBottom: 14,
  },
  linhaParcelas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipParcela: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: CORES.superficieElevada,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  chipParcelaSelecionado: {
    backgroundColor: CORES.primariaClara,
    borderColor: CORES.primariaClara,
  },
  chipParcelaTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: CORES.textoMudo,
  },
  chipParcelaTextoSelecionado: {
    color: '#FFFFFF',
  },
  dialogoBotoes: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  botaoDialogoCancelar: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: CORES.superficieElevada,
  },
  botaoDialogoCancelarTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: CORES.textoMudo,
  },
  botaoDialogoConfirmar: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: CORES.primaria,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoDialogoConfirmarTexto: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
