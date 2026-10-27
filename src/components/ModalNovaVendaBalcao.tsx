import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  RespostaPeca,
  RespostaCliente,
  VendaBalcao,
  PedidoFecharVenda,
} from '../types';
import { CORES } from '../constants';
import { estoqueApi } from '../api/estoqueApi';
import { osApi } from '../api/osApi';
import { vendasApi } from '../api/vendasApi';
import { extrairMensagemErro } from '../api/clienteHttp';
import { formatarMoeda } from '../utils/imprimirVendaHtml';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface ItemCarrinho {
  peca: RespostaPeca;
  quantidade: number;
  precoUnitario: number;
}

interface ModalNovaVendaBalcaoProps {
  visivel: boolean;
  modoInicial?: 'venda' | 'orcamento';
  aoFechar: () => void;
  aoConcluir: (venda: VendaBalcao) => void;
}

export const ModalNovaVendaBalcao: React.FC<ModalNovaVendaBalcaoProps> = ({
  visivel,
  modoInicial = 'venda',
  aoFechar,
  aoConcluir,
}) => {
  const insets = useSafeAreaInsets();

  // Modo: Venda Direta ou Orçamento
  const [modo, setModo] = useState<'venda' | 'orcamento'>(modoInicial);

  // Cliente
  const [tipoCliente, setTipoCliente] = useState<'avulso' | 'cadastrado'>('avulso');
  const [clienteBusca, setClienteBusca] = useState<string>('');
  const [clientesEncontrados, setClientesEncontrados] = useState<RespostaCliente[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<RespostaCliente | null>(null);
  const [buscandoClientes, setBuscandoClientes] = useState<boolean>(false);

  // Carrinho de Peças
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [termoPeca, setTermoPeca] = useState<string>('');
  const [pecasEncontradas, setPecasEncontradas] = useState<RespostaPeca[]>([]);
  const [buscandoPecas, setBuscandoPecas] = useState<boolean>(false);
  const [scannerVisivel, setScannerVisivel] = useState<boolean>(false);

  // Pagamento e Fechamento
  const [descontoTexto, setDescontoTexto] = useState<string>('0');
  const [formaPagamento, setFormaPagamento] = useState<string>('dinheiro');
  const [parcelas, setParcelas] = useState<number>(1);
  const [observacoes, setObservacoes] = useState<string>('');

  // Processamento
  const [salvando, setSalvando] = useState<boolean>(false);

  useEffect(() => {
    if (visivel) {
      setModo(modoInicial);
      setTipoCliente('avulso');
      setClienteBusca('');
      setClienteSelecionado(null);
      setClientesEncontrados([]);
      setCarrinho([]);
      setTermoPeca('');
      setPecasEncontradas([]);
      setDescontoTexto('0');
      setFormaPagamento('dinheiro');
      setParcelas(1);
      setObservacoes('');
    }
  }, [visivel, modoInicial]);

  // Busca de clientes
  useEffect(() => {
    if (!clienteBusca || clienteBusca.trim().length < 2) {
      setClientesEncontrados([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setBuscandoClientes(true);
        const resultados = await osApi.buscarClientes(clienteBusca.trim());
        setClientesEncontrados(resultados);
      } catch (e) {
        console.warn('Erro ao buscar clientes:', e);
      } finally {
        setBuscandoClientes(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [clienteBusca]);

  // Busca de peças no estoque
  useEffect(() => {
    if (!termoPeca || termoPeca.trim().length < 2) {
      setPecasEncontradas([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setBuscandoPecas(true);
        const resultados = await estoqueApi.buscarPecas(termoPeca.trim());
        setPecasEncontradas(resultados.filter((p) => p.ativo));
      } catch (e) {
        console.warn('Erro ao buscar peças:', e);
      } finally {
        setBuscandoPecas(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [termoPeca]);

  // Ao escanear código de barras
  const handleCodigoDeBarras = async (codigo: string) => {
    setScannerVisivel(false);
    try {
      setBuscandoPecas(true);
      const resultados = await estoqueApi.buscarPecas(codigo.trim());
      if (resultados.length === 1) {
        adicionarAoCarrinho(resultados[0]);
        Alert.alert('Peça Adicionada', `${resultados[0].descricao} entrou no carrinho.`);
      } else if (resultados.length > 1) {
        setPecasEncontradas(resultados);
        setTermoPeca(codigo);
      } else {
        Alert.alert('Não encontrada', `Nenhuma peça com o código ${codigo} foi encontrada no estoque.`);
      }
    } catch (e) {
      Alert.alert('Erro', 'Falha ao buscar peça pelo código escaneado.');
    } finally {
      setBuscandoPecas(false);
    }
  };

  // Gerenciamento de itens no carrinho
  const adicionarAoCarrinho = (peca: RespostaPeca) => {
    setCarrinho((prev) => {
      const index = prev.findIndex((item) => item.peca.id === peca.id);
      if (index >= 0) {
        const novo = [...prev];
        novo[index] = {
          ...novo[index],
          quantidade: novo[index].quantidade + 1,
        };
        return novo;
      }
      return [
        ...prev,
        {
          peca,
          quantidade: 1,
          precoUnitario: peca.preco || 0,
        },
      ];
    });
    setTermoPeca('');
    setPecasEncontradas([]);
  };

  const alterarQuantidade = (pecaId: string, delta: number) => {
    setCarrinho((prev) =>
      prev
        .map((item) => {
          if (item.peca.id === pecaId) {
            const novaQtd = Math.max(1, item.quantidade + delta);
            return { ...item, quantidade: novaQtd };
          }
          return item;
        })
    );
  };

  const removerDoCarrinho = (pecaId: string) => {
    setCarrinho((prev) => prev.filter((item) => item.peca.id !== pecaId));
  };

  // Totais financeiros
  const subtotal = carrinho.reduce(
    (soma, it) => soma + it.quantidade * it.precoUnitario,
    0
  );
  const descontoNum = Math.max(0, parseFloat(descontoTexto.replace(',', '.')) || 0);
  const totalLiquido = Math.max(0, subtotal - descontoNum);

  // Fechar Venda / Salvar Orçamento
  const handleFinalizar = async () => {
    if (carrinho.length === 0) {
      Alert.alert('Atenção', 'Adicione pelo menos uma peça ao carrinho antes de continuar.');
      return;
    }

    try {
      setSalvando(true);
      const clienteId =
        tipoCliente === 'cadastrado' && clienteSelecionado ? clienteSelecionado.id : null;

      // 1. Abre a venda ou orçamento
      const vendaAberta =
        modo === 'venda'
          ? await vendasApi.abrirVenda(clienteId)
          : await vendasApi.abrirOrcamento(clienteId);

      // 2. Adiciona os itens sequencialmente
      for (const item of carrinho) {
        await vendasApi.adicionarItem(
          vendaAberta.id,
          item.peca.id,
          item.quantidade,
          item.precoUnitario
        );
      }

      // 3. Conclui conforme o modo
      let vendaFinal: VendaBalcao;
      if (modo === 'venda') {
        const dadosFechamento: PedidoFecharVenda = {
          formaPagamento,
          desconto: descontoNum,
          parcelas: formaPagamento === 'cartao_credito' || formaPagamento === 'crediario' ? parcelas : 1,
          observacoes: observacoes.trim() || undefined,
        };
        vendaFinal = await vendasApi.fecharVenda(vendaAberta.id, dadosFechamento);
      } else {
        vendaFinal = await vendasApi.salvarComoOrcamento(
          vendaAberta.id,
          clienteId,
          observacoes.trim() || undefined
        );
      }

      Alert.alert(
        'Sucesso!',
        `${modo === 'venda' ? 'Venda' : 'Orçamento'} #${vendaFinal.numero} concluído com sucesso!`
      );
      aoConcluir(vendaFinal);
      aoFechar();
    } catch (err) {
      Alert.alert(
        'Erro ao Finalizar',
        extrairMensagemErro(err, 'Não foi possível concluir a operação no balcão.')
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent={false}
      onRequestClose={aoFechar}
    >
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.botaoFechar}
            onPress={aoFechar}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={CORES.texto} />
          </TouchableOpacity>

          {/* Abas Alternadoras Venda / Orçamento */}
          <View style={styles.abasAlternadoras}>
            <TouchableOpacity
              style={[styles.abaBotao, modo === 'venda' && styles.abaBotaoAtiva]}
              onPress={() => setModo('venda')}
            >
              <Ionicons
                name="cart"
                size={16}
                color={modo === 'venda' ? '#FFFFFF' : CORES.textoMudo}
              />
              <Text
                style={[styles.abaBotaoTexto, modo === 'venda' && styles.abaBotaoTextoAtiva]}
              >
                Venda Balcão
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.abaBotao, modo === 'orcamento' && styles.abaBotaoAtiva]}
              onPress={() => setModo('orcamento')}
            >
              <Ionicons
                name="document-text"
                size={16}
                color={modo === 'orcamento' ? '#FFFFFF' : CORES.textoMudo}
              />
              <Text
                style={[styles.abaBotaoTexto, modo === 'orcamento' && styles.abaBotaoTextoAtiva]}
              >
                Orçamento
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.conteudo}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Seção Cliente */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-outline" size={18} color={CORES.primariaClara} />
              <Text style={styles.cardTitulo}>Cliente da Venda</Text>
            </View>

            <View style={styles.linhaOpcoesCliente}>
              <TouchableOpacity
                style={[
                  styles.opcaoCliente,
                  tipoCliente === 'avulso' && styles.opcaoClienteSelecionada,
                ]}
                onPress={() => {
                  setTipoCliente('avulso');
                  setClienteSelecionado(null);
                }}
              >
                <Ionicons
                  name="storefront-outline"
                  size={16}
                  color={tipoCliente === 'avulso' ? CORES.primariaClara : CORES.textoMudo}
                />
                <Text
                  style={[
                    styles.opcaoClienteTexto,
                    tipoCliente === 'avulso' && styles.opcaoClienteTextoSelecionado,
                  ]}
                >
                  Consumidor Final (Avulso)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.opcaoCliente,
                  tipoCliente === 'cadastrado' && styles.opcaoClienteSelecionada,
                ]}
                onPress={() => setTipoCliente('cadastrado')}
              >
                <Ionicons
                  name="person-add-outline"
                  size={16}
                  color={tipoCliente === 'cadastrado' ? CORES.primariaClara : CORES.textoMudo}
                />
                <Text
                  style={[
                    styles.opcaoClienteTexto,
                    tipoCliente === 'cadastrado' && styles.opcaoClienteTextoSelecionado,
                  ]}
                >
                  Cadastrado
                </Text>
              </TouchableOpacity>
            </View>

            {tipoCliente === 'cadastrado' && (
              <View style={styles.blocoBuscaCliente}>
                {clienteSelecionado ? (
                  <View style={styles.badgeClienteSelecionado}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.clienteNomeSelecionado}>
                        {clienteSelecionado.nome}
                      </Text>
                      {clienteSelecionado.telefone && (
                        <Text style={styles.clienteDocSelecionado}>
                          {clienteSelecionado.telefone}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => setClienteSelecionado(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={20} color={CORES.perigoTexto} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.inputContainer}>
                      <Ionicons name="search" size={18} color={CORES.textoMudo} />
                      <TextInput
                        style={styles.input}
                        placeholder="Buscar cliente por nome ou telefone..."
                        placeholderTextColor={CORES.textoMudo}
                        value={clienteBusca}
                        onChangeText={setClienteBusca}
                      />
                      {buscandoClientes && (
                        <ActivityIndicator size="small" color={CORES.primariaClara} />
                      )}
                    </View>

                    {clientesEncontrados.length > 0 && (
                      <View style={styles.listaResultadosClientes}>
                        {clientesEncontrados.slice(0, 5).map((cli) => (
                          <TouchableOpacity
                            key={cli.id}
                            style={styles.itemClienteResultado}
                            onPress={() => {
                              setClienteSelecionado(cli);
                              setClienteBusca('');
                              setClientesEncontrados([]);
                            }}
                          >
                            <Text style={styles.itemClienteNome}>{cli.nome}</Text>
                            <Text style={styles.itemClienteSub}>
                              {cli.telefone || cli.documento || 'Sem telefone'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>

          {/* Seção Adicionar Peças */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="barcode-outline" size={18} color={CORES.primariaClara} />
              <Text style={styles.cardTitulo}>Buscar Peças no Estoque</Text>
            </View>

            <View style={styles.linhaBuscaPeca}>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Ionicons name="search" size={18} color={CORES.textoMudo} />
                <TextInput
                  style={styles.input}
                  placeholder="Nome, código interno ou OEM..."
                  placeholderTextColor={CORES.textoMudo}
                  value={termoPeca}
                  onChangeText={setTermoPeca}
                />
                {buscandoPecas && (
                  <ActivityIndicator size="small" color={CORES.primariaClara} />
                )}
              </View>

              <TouchableOpacity
                style={styles.botaoCameraBarcode}
                onPress={() => setScannerVisivel(true)}
              >
                <Ionicons name="barcode-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Resultados de Peças */}
            {pecasEncontradas.length > 0 && (
              <View style={styles.listaPecasResultados}>
                <Text style={styles.resultadosTitulo}>
                  Toque para adicionar ao carrinho:
                </Text>
                {pecasEncontradas.slice(0, 6).map((peca) => (
                  <TouchableOpacity
                    key={peca.id}
                    style={styles.pecaResultadoItem}
                    onPress={() => adicionarAoCarrinho(peca)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pecaDescricao}>{peca.descricao}</Text>
                      <Text style={styles.pecaMeta}>
                        Cód: {peca.codigoInterno}
                        {peca.fabricante ? ` · ${peca.fabricante}` : ''}
                      </Text>
                      <Text
                        style={[
                          styles.pecaEstoque,
                          peca.estoqueAtual <= 0 && { color: CORES.perigoTexto },
                        ]}
                      >
                        Estoque: {peca.estoqueAtual} UN
                      </Text>
                    </View>
                    <View style={styles.pecaPrecoContainer}>
                      <Text style={styles.pecaPreco}>{formatarMoeda(peca.preco)}</Text>
                      <View style={styles.botaoAdicionarMini}>
                        <Ionicons name="add" size={16} color="#FFFFFF" />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Carrinho / Itens Selecionados */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="cart-outline" size={18} color={CORES.primariaClara} />
              <Text style={styles.cardTitulo}>
                Itens no Carrinho ({carrinho.length})
              </Text>
            </View>

            {carrinho.length === 0 ? (
              <View style={styles.carrinhoVazio}>
                <Ionicons name="basket-outline" size={36} color={CORES.textoMudo} />
                <Text style={styles.carrinhoVazioTexto}>
                  Nenhuma peça adicionada ainda.
                </Text>
                <Text style={styles.carrinhoVazioSub}>
                  Use a busca acima ou o leitor de código de barras.
                </Text>
              </View>
            ) : (
              <View style={styles.listaCarrinho}>
                {carrinho.map((item, idx) => (
                  <View
                    key={item.peca.id}
                    style={[
                      styles.itemCarrinhoLinha,
                      idx < carrinho.length - 1 && styles.itemCarrinhoBorda,
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.itemCarrinhoDescricao}>
                        {item.peca.descricao}
                      </Text>
                      <Text style={styles.itemCarrinhoCodigo}>
                        Cód: {item.peca.codigoInterno} · {formatarMoeda(item.precoUnitario)} un
                      </Text>
                    </View>

                    {/* Stepper de Quantidade */}
                    <View style={styles.stepperContainer}>
                      <TouchableOpacity
                        style={styles.stepperBotao}
                        onPress={() => alterarQuantidade(item.peca.id, -1)}
                      >
                        <Ionicons name="remove" size={16} color={CORES.texto} />
                      </TouchableOpacity>

                      <Text style={styles.stepperTexto}>{item.quantidade}</Text>

                      <TouchableOpacity
                        style={styles.stepperBotao}
                        onPress={() => alterarQuantidade(item.peca.id, 1)}
                      >
                        <Ionicons name="add" size={16} color={CORES.texto} />
                      </TouchableOpacity>
                    </View>

                    {/* Total do Item */}
                    <Text style={styles.itemCarrinhoTotal}>
                      {formatarMoeda(item.quantidade * item.precoUnitario)}
                    </Text>

                    {/* Remover */}
                    <TouchableOpacity
                      style={styles.botaoRemoverItem}
                      onPress={() => removerDoCarrinho(item.peca.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={CORES.perigoTexto} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Pagamento e Desconto */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="cash-outline" size={18} color={CORES.primariaClara} />
              <Text style={styles.cardTitulo}>
                {modo === 'venda' ? 'Pagamento e Valores' : 'Totais do Orçamento'}
              </Text>
            </View>

            {/* Linha Subtotal */}
            <View style={styles.linhaValor}>
              <Text style={styles.rotuloValor}>Subtotal Bruto:</Text>
              <Text style={styles.valorDestaque}>{formatarMoeda(subtotal)}</Text>
            </View>

            {/* Desconto */}
            <View style={styles.linhaDesconto}>
              <Text style={styles.rotuloValor}>Desconto (R$):</Text>
              <TextInput
                style={styles.inputDesconto}
                keyboardType="numeric"
                value={descontoTexto}
                onChangeText={setDescontoTexto}
                placeholder="0,00"
                placeholderTextColor={CORES.textoMudo}
              />
            </View>

            <View style={styles.divisor} />

            {/* Total Líquido */}
            <View style={styles.linhaTotalFinal}>
              <Text style={styles.rotuloTotalFinal}>TOTAL LÍQUIDO:</Text>
              <Text style={styles.valorTotalFinal}>{formatarMoeda(totalLiquido)}</Text>
            </View>

            {/* Formas de Pagamento (somente na Venda) */}
            {modo === 'venda' && (
              <>
                <Text style={styles.subtituloSecao}>Forma de Pagamento</Text>
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
                        formaPagamento === f.id && styles.opcaoFormaSelecionada,
                      ]}
                      onPress={() => setFormaPagamento(f.id)}
                    >
                      <Ionicons
                        name={f.icone as any}
                        size={16}
                        color={
                          formaPagamento === f.id ? CORES.primariaClara : CORES.textoMudo
                        }
                      />
                      <Text
                        style={[
                          styles.opcaoFormaTexto,
                          formaPagamento === f.id && styles.opcaoFormaTextoSelecionado,
                        ]}
                      >
                        {f.nome}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Se Cartão Crédito */}
                {formaPagamento === 'cartao_credito' && (
                  <View style={styles.blocoParcelas}>
                    <Text style={styles.subtituloSecao}>Parcelas:</Text>
                    <View style={styles.linhaChipsParcela}>
                      {[1, 2, 3, 4, 5, 6, 10, 12].map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={[
                            styles.chipParcela,
                            parcelas === num && styles.chipParcelaSelecionado,
                          ]}
                          onPress={() => setParcelas(num)}
                        >
                          <Text
                            style={[
                              styles.chipParcelaTexto,
                              parcelas === num && styles.chipParcelaTextoSelecionado,
                            ]}
                          >
                            {num}x
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Observações */}
            <Text style={styles.subtituloSecao}>Observações (Opcional)</Text>
            <TextInput
              style={styles.inputObservacoes}
              placeholder="Ex: Entrega no balcão, garantia estendida..."
              placeholderTextColor={CORES.textoMudo}
              value={observacoes}
              onChangeText={setObservacoes}
              multiline
              numberOfLines={2}
            />
          </View>
        </ScrollView>

        {/* Rodapé com botão de Finalizar */}
        <View style={[styles.rodape, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.rodapeTotalContainer}>
            <Text style={styles.rodapeTotalRotulo}>Total:</Text>
            <Text style={styles.rodapeTotalValor}>{formatarMoeda(totalLiquido)}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.botaoFinalizar,
              carrinho.length === 0 && styles.botaoFinalizarDesativado,
            ]}
            onPress={handleFinalizar}
            disabled={salvando || carrinho.length === 0}
          >
            {salvando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name={modo === 'venda' ? 'checkmark-circle' : 'document-text'}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.botaoFinalizarTexto}>
                  {modo === 'venda' ? 'Finalizar Venda' : 'Salvar Orçamento'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Modal de Leitura de Código de Barras */}
        <BarcodeScannerModal
          visivel={scannerVisivel}
          aoFechar={() => setScannerVisivel(false)}
          aoEscanear={handleCodigoDeBarras}
        />
      </KeyboardAvoidingView>
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
    paddingVertical: 12,
    backgroundColor: CORES.superficie,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  botaoFechar: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: CORES.superficieElevada,
  },
  abasAlternadoras: {
    flexDirection: 'row',
    backgroundColor: CORES.superficieElevada,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  abaBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  abaBotaoAtiva: {
    backgroundColor: CORES.primaria,
  },
  abaBotaoTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: CORES.textoMudo,
  },
  abaBotaoTextoAtiva: {
    color: '#FFFFFF',
  },
  conteudo: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitulo: {
    fontSize: 14,
    fontWeight: '800',
    color: CORES.texto,
    textTransform: 'uppercase',
  },
  linhaOpcoesCliente: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  opcaoCliente: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    backgroundColor: CORES.superficieElevada,
  },
  opcaoClienteSelecionada: {
    borderColor: CORES.primariaClara,
    backgroundColor: CORES.primariaClara + '15',
  },
  opcaoClienteTexto: {
    fontSize: 11,
    color: CORES.textoMudo,
    fontWeight: '600',
  },
  opcaoClienteTextoSelecionado: {
    color: CORES.primariaClara,
    fontWeight: '700',
  },
  blocoBuscaCliente: {
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficieElevada,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  input: {
    flex: 1,
    color: CORES.texto,
    fontSize: 13,
  },
  badgeClienteSelecionado: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.primariaClara + '15',
    borderWidth: 1,
    borderColor: CORES.primariaClara,
    borderRadius: 8,
    padding: 10,
  },
  clienteNomeSelecionado: {
    fontSize: 13,
    fontWeight: '700',
    color: CORES.primariaClara,
  },
  clienteDocSelecionado: {
    fontSize: 11,
    color: CORES.textoMudo,
    marginTop: 2,
  },
  listaResultadosClientes: {
    backgroundColor: CORES.superficieElevada,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    marginTop: 6,
    overflow: 'hidden',
  },
  itemClienteResultado: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  itemClienteNome: {
    fontSize: 13,
    fontWeight: '700',
    color: CORES.texto,
  },
  itemClienteSub: {
    fontSize: 11,
    color: CORES.textoMudo,
    marginTop: 2,
  },
  linhaBuscaPeca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  botaoCameraBarcode: {
    backgroundColor: CORES.primaria,
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listaPecasResultados: {
    marginTop: 10,
    backgroundColor: CORES.superficieElevada,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    padding: 8,
    gap: 6,
  },
  resultadosTitulo: {
    fontSize: 11,
    fontWeight: '700',
    color: CORES.textoMudo,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  pecaResultadoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  pecaDescricao: {
    fontSize: 13,
    fontWeight: '700',
    color: CORES.texto,
  },
  pecaMeta: {
    fontSize: 11,
    color: CORES.textoMudo,
    marginTop: 2,
  },
  pecaEstoque: {
    fontSize: 11,
    color: CORES.sucessoTexto,
    marginTop: 2,
    fontWeight: '600',
  },
  pecaPrecoContainer: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 8,
  },
  pecaPreco: {
    fontSize: 13,
    fontWeight: '800',
    color: CORES.texto,
  },
  botaoAdicionarMini: {
    backgroundColor: CORES.primaria,
    borderRadius: 6,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carrinhoVazio: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  carrinhoVazioTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: CORES.textoMudo,
    marginTop: 8,
  },
  carrinhoVazioSub: {
    fontSize: 11,
    color: CORES.textoMudo,
    marginTop: 2,
  },
  listaCarrinho: {
    gap: 8,
  },
  itemCarrinhoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  itemCarrinhoBorda: {
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  itemCarrinhoDescricao: {
    fontSize: 13,
    fontWeight: '700',
    color: CORES.texto,
  },
  itemCarrinhoCodigo: {
    fontSize: 11,
    color: CORES.textoMudo,
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficieElevada,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    marginHorizontal: 8,
  },
  stepperBotao: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepperTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: CORES.texto,
    minWidth: 20,
    textAlign: 'center',
  },
  itemCarrinhoTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: CORES.texto,
    minWidth: 65,
    textAlign: 'right',
  },
  botaoRemoverItem: {
    paddingLeft: 8,
  },
  linhaValor: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rotuloValor: {
    fontSize: 13,
    color: CORES.textoMudo,
  },
  valorDestaque: {
    fontSize: 14,
    fontWeight: '700',
    color: CORES.texto,
  },
  linhaDesconto: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputDesconto: {
    backgroundColor: CORES.superficieElevada,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    width: 90,
    textAlign: 'right',
    color: CORES.sucessoTexto,
    fontWeight: '700',
    fontSize: 13,
  },
  divisor: {
    height: 1,
    backgroundColor: CORES.bordaSuave,
    marginVertical: 8,
  },
  linhaTotalFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rotuloTotalFinal: {
    fontSize: 15,
    fontWeight: '800',
    color: CORES.texto,
  },
  valorTotalFinal: {
    fontSize: 18,
    fontWeight: '900',
    color: CORES.primariaClara,
  },
  subtituloSecao: {
    fontSize: 11,
    fontWeight: '700',
    color: CORES.textoMudo,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  gridFormas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
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
    fontSize: 11,
    color: CORES.textoMudo,
    fontWeight: '600',
  },
  opcaoFormaTextoSelecionado: {
    color: CORES.primariaClara,
    fontWeight: '700',
  },
  blocoParcelas: {
    marginBottom: 12,
  },
  linhaChipsParcela: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipParcela: {
    paddingVertical: 6,
    paddingHorizontal: 10,
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
    fontSize: 11,
    fontWeight: '700',
    color: CORES.textoMudo,
  },
  chipParcelaTextoSelecionado: {
    color: '#FFFFFF',
  },
  inputObservacoes: {
    backgroundColor: CORES.superficieElevada,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    borderRadius: 8,
    padding: 10,
    color: CORES.texto,
    fontSize: 12,
    textAlignVertical: 'top',
  },
  rodape: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CORES.superficie,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
  },
  rodapeTotalContainer: {
    flex: 1,
  },
  rodapeTotalRotulo: {
    fontSize: 11,
    color: CORES.textoMudo,
    textTransform: 'uppercase',
  },
  rodapeTotalValor: {
    fontSize: 18,
    fontWeight: '900',
    color: CORES.primariaClara,
  },
  botaoFinalizar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CORES.primaria,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  botaoFinalizarDesativado: {
    opacity: 0.5,
  },
  botaoFinalizarTexto: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
