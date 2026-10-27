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
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VendaBalcao } from '../types';
import { CORES } from '../constants';
import { vendasApi, FiltrosVenda } from '../api/vendasApi';
import { extrairMensagemErro } from '../api/clienteHttp';
import {
  formatarMoeda,
  rotuloFormaPagamentoVenda,
} from '../utils/imprimirVendaHtml';
import { ModalNovaVendaBalcao } from '../components/ModalNovaVendaBalcao';
import { ModalDetalheVenda } from '../components/ModalDetalheVenda';
import { useAuth } from '../context/AuthContext';

type TipoAba = 'vendas' | 'orcamentos' | 'todas';
type OpcaoPeriodo = 'hoje' | 'ontem' | '7dias' | '30dias' | 'esteMes';

export const VendasScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { oficinaAtiva, usuario } = useAuth();
  const nomeOficina = oficinaAtiva?.nome || usuario?.empresa || 'AutoF Gestão';

  // Estados principais
  const [abaAtiva, setAbaAtiva] = useState<TipoAba>('vendas');
  const [periodo, setPeriodo] = useState<OpcaoPeriodo>('30dias');
  const [termoBusca, setTermoBusca] = useState<string>('');

  const [vendas, setVendas] = useState<VendaBalcao[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [recarregando, setRecarregando] = useState<boolean>(false);

  // Modais
  const [modalNovaVendaVisivel, setModalNovaVendaVisivel] = useState<boolean>(false);
  const [modoNovaVenda, setModoNovaVenda] = useState<'venda' | 'orcamento'>('venda');
  const [vendaIdDetalhe, setVendaIdDetalhe] = useState<string | null>(null);

  // Calcula intervalo de datas a partir do período selecionado
  const calcularDatasPeriodo = useCallback((opcao: OpcaoPeriodo): { de: string; ate: string } => {
    const hoje = new Date();
    const formatarISO = (d: Date) => d.toISOString().split('T')[0];

    switch (opcao) {
      case 'hoje': {
        const dia = formatarISO(hoje);
        return { de: dia, ate: dia };
      }
      case 'ontem': {
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        const dia = formatarISO(ontem);
        return { de: dia, ate: dia };
      }
      case '7dias': {
        const d7 = new Date(hoje);
        d7.setDate(hoje.getDate() - 7);
        return { de: formatarISO(d7), ate: formatarISO(hoje) };
      }
      case '30dias': {
        const d30 = new Date(hoje);
        d30.setDate(hoje.getDate() - 30);
        return { de: formatarISO(d30), ate: formatarISO(hoje) };
      }
      case 'esteMes': {
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        return { de: formatarISO(primeiroDia), ate: formatarISO(hoje) };
      }
    }
  }, []);

  // Carrega lista da API
  const carregarVendas = useCallback(
    async (isRefresh: boolean = false) => {
      if (isRefresh) {
        setRecarregando(true);
      } else {
        setCarregando(true);
      }

      try {
        const { de, ate } = calcularDatasPeriodo(periodo);
        const statusFiltro =
          abaAtiva === 'vendas'
            ? 'fechada'
            : abaAtiva === 'orcamentos'
            ? 'orcamento'
            : undefined;

        const filtros: FiltrosVenda = {
          de,
          ate,
          status: statusFiltro,
        };

        const dados = await vendasApi.listarVendas(filtros);
        setVendas(dados || []);
      } catch (err) {
        Alert.alert('Erro ao Carregar Vendas', extrairMensagemErro(err));
      } finally {
        setCarregando(false);
        setRecarregando(false);
      }
    },
    [abaAtiva, periodo, calcularDatasPeriodo]
  );

  useEffect(() => {
    carregarVendas();
  }, [carregarVendas]);

  // Filtra por termo de busca local (número, cliente ou descrição da peça)
  const vendasFiltradas = useMemo(() => {
    if (!termoBusca || termoBusca.trim() === '') {
      return vendas;
    }
    const q = termoBusca.trim().toLowerCase();
    return vendas.filter((v) => {
      const numMatch = String(v.numero).includes(q);
      const clienteMatch = v.clienteNome?.toLowerCase().includes(q) ?? false;
      const itensMatch = (v.itens || []).some((it) =>
        it.descricao?.toLowerCase().includes(q)
      );
      return numMatch || clienteMatch || itensMatch;
    });
  }, [vendas, termoBusca]);

  // Indicadores consolidados
  const metricas = useMemo(() => {
    const totalFaturado = vendasFiltradas
      .filter((v) => v.status === 'fechada')
      .reduce((soma, v) => soma + (v.total || 0), 0);

    const totalOrcado = vendasFiltradas
      .filter((v) => v.status === 'orcamento')
      .reduce((soma, v) => soma + (v.total || 0), 0);

    const quantidadeFechadas = vendasFiltradas.filter((v) => v.status === 'fechada').length;
    const ticketMedio = quantidadeFechadas > 0 ? totalFaturado / quantidadeFechadas : 0;

    return {
      totalFaturado,
      totalOrcado,
      quantidadeFechadas,
      ticketMedio,
    };
  }, [vendasFiltradas]);

  // Abrir criação
  const abrirNovaVenda = (modo: 'venda' | 'orcamento') => {
    setModoNovaVenda(modo);
    setModalNovaVendaVisivel(true);
  };

  // Render do Card de Venda / Orçamento
  const renderItemVenda = ({ item }: { item: VendaBalcao }) => {
    const ehOrcamento = item.status === 'orcamento';
    const ehCancelada = item.status === 'cancelada';
    const itensTexto = (item.itens || [])
      .map((i) => i.descricao)
      .join(', ');

    return (
      <TouchableOpacity
        style={styles.cardVenda}
        activeOpacity={0.8}
        onPress={() => setVendaIdDetalhe(item.id)}
      >
        {/* Topo do Card */}
        <View style={styles.cardVendaTopo}>
          <View style={styles.cardNumeroContainer}>
            <Text style={styles.cardNumeroTexto}>#{item.numero}</Text>
            <View
              style={[
                styles.chipStatus,
                ehCancelada
                  ? styles.chipCancelada
                  : ehOrcamento
                  ? styles.chipOrcamento
                  : styles.chipFechada,
              ]}
            >
              <Text
                style={[
                  styles.chipStatusTexto,
                  ehCancelada
                    ? styles.textoCancelado
                    : ehOrcamento
                    ? styles.textoOrcamento
                    : styles.textoFechado,
                ]}
              >
                {ehCancelada
                  ? 'Cancelada'
                  : ehOrcamento
                  ? item.vencido
                    ? 'Orçamento Vencido'
                    : 'Orçamento'
                  : 'Venda Fechada'}
              </Text>
            </View>
          </View>

          <Text style={styles.cardData}>
            {new Date(item.criadaEm).toLocaleDateString('pt-BR')} às{' '}
            {new Date(item.criadaEm).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Cliente e Vendedor */}
        <View style={styles.cardClienteLinha}>
          <Ionicons name="person" size={14} color={CORES.primariaClara} />
          <Text style={styles.cardClienteNome} numberOfLines={1}>
            {item.clienteNome || 'Consumidor Final (Balcão)'}
          </Text>
        </View>

        {/* Descrição resumida dos itens */}
        <View style={styles.cardItensResumo}>
          <Text style={styles.cardItensContagem}>
            {item.itens?.length || 0} {(item.itens?.length || 0) === 1 ? 'item' : 'itens'}:
          </Text>
          <Text style={styles.cardItensTexto} numberOfLines={1}>
            {itensTexto || 'Sem descrição'}
          </Text>
        </View>

        <View style={styles.divisorCard} />

        {/* Rodapé do Card: Pagamento e Total */}
        <View style={styles.cardRodape}>
          <View style={styles.cardPagamentoContainer}>
            {!ehOrcamento && item.formaPagamento ? (
              <View style={styles.badgePagamento}>
                <Ionicons name="card-outline" size={12} color={CORES.textoMudo} />
                <Text style={styles.badgePagamentoTexto}>
                  {rotuloFormaPagamentoVenda(item.formaPagamento)}
                </Text>
              </View>
            ) : ehOrcamento && item.validaAte ? (
              <Text
                style={[
                  styles.orcamentoValidadeTexto,
                  item.vencido && { color: CORES.perigoTexto, fontWeight: '700' },
                ]}
              >
                Válido até {new Date(item.validaAte).toLocaleDateString('pt-BR')}
              </Text>
            ) : (
              <View />
            )}
          </View>

          <View style={styles.cardTotalContainer}>
            {item.desconto > 0 && (
              <Text style={styles.cardDescontoTexto}>
                Desc: {formatarMoeda(item.desconto)}
              </Text>
            )}
            <Text style={styles.cardTotalValor}>{formatarMoeda(item.total)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Barra de Ações do Topo */}
      <View style={styles.barraTopoAcoes}>
        {/* Abas Segmentadas */}
        <View style={styles.segmentoAbas}>
          <TouchableOpacity
            style={[styles.botaoSegmento, abaAtiva === 'vendas' && styles.botaoSegmentoAtivo]}
            onPress={() => setAbaAtiva('vendas')}
          >
            <Ionicons
              name="cart"
              size={14}
              color={abaAtiva === 'vendas' ? '#FFFFFF' : CORES.textoMudo}
            />
            <Text
              style={[
                styles.botaoSegmentoTexto,
                abaAtiva === 'vendas' && styles.botaoSegmentoTextoAtivo,
              ]}
            >
              Vendas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.botaoSegmento, abaAtiva === 'orcamentos' && styles.botaoSegmentoAtivo]}
            onPress={() => setAbaAtiva('orcamentos')}
          >
            <Ionicons
              name="document-text"
              size={14}
              color={abaAtiva === 'orcamentos' ? '#FFFFFF' : CORES.textoMudo}
            />
            <Text
              style={[
                styles.botaoSegmentoTexto,
                abaAtiva === 'orcamentos' && styles.botaoSegmentoTextoAtivo,
              ]}
            >
              Orçamentos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.botaoSegmento, abaAtiva === 'todas' && styles.botaoSegmentoAtivo]}
            onPress={() => setAbaAtiva('todas')}
          >
            <Text
              style={[
                styles.botaoSegmentoTexto,
                abaAtiva === 'todas' && styles.botaoSegmentoTextoAtivo,
              ]}
            >
              Todas
            </Text>
          </TouchableOpacity>
        </View>

        {/* Botões de Criação Rápida */}
        <View style={styles.botoesCriacao}>
          <TouchableOpacity
            style={styles.botaoNovaVenda}
            onPress={() => abrirNovaVenda('venda')}
          >
            <Ionicons name="add-circle" size={16} color="#FFFFFF" />
            <Text style={styles.botaoNovaVendaTexto}>+ Venda</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botaoNovoOrcamento}
            onPress={() => abrirNovaVenda('orcamento')}
          >
            <Ionicons name="document-outline" size={16} color={CORES.primariaClara} />
            <Text style={styles.botaoNovoOrcamentoTexto}>+ Orçamento</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filtros de Período Rápido */}
      <View style={styles.barraPeriodo}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listaPeriodos}
          data={[
            { id: 'hoje', label: 'Hoje' },
            { id: 'ontem', label: 'Ontem' },
            { id: '7dias', label: '7 Dias' },
            { id: '30dias', label: '30 Dias' },
            { id: 'esteMes', label: 'Este Mês' },
          ]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.chipPeriodo,
                periodo === item.id && styles.chipPeriodoSelecionado,
              ]}
              onPress={() => setPeriodo(item.id as OpcaoPeriodo)}
            >
              <Text
                style={[
                  styles.chipPeriodoTexto,
                  periodo === item.id && styles.chipPeriodoTextoSelecionado,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Cartões de Indicadores Consolidados */}
      <View style={styles.containerIndicadores}>
        <View style={styles.cardIndicador}>
          <Text style={styles.indicadorRotulo}>
            {abaAtiva === 'orcamentos' ? 'Total Orçado' : 'Faturamento'}
          </Text>
          <Text style={styles.indicadorValor}>
            {formatarMoeda(
              abaAtiva === 'orcamentos' ? metricas.totalOrcado : metricas.totalFaturado
            )}
          </Text>
        </View>

        <View style={styles.cardIndicador}>
          <Text style={styles.indicadorRotulo}>Quantidade</Text>
          <Text style={styles.indicadorValor}>{vendasFiltradas.length}</Text>
        </View>

        <View style={styles.cardIndicador}>
          <Text style={styles.indicadorRotulo}>Ticket Médio</Text>
          <Text style={styles.indicadorValor}>
            {formatarMoeda(metricas.ticketMedio)}
          </Text>
        </View>
      </View>

      {/* Campo de Busca */}
      <View style={styles.containerBusca}>
        <View style={styles.inputBuscaWrapper}>
          <Ionicons name="search" size={18} color={CORES.textoMudo} />
          <TextInput
            style={styles.inputBusca}
            placeholder="Buscar por cliente, nº da venda ou peça..."
            placeholderTextColor={CORES.textoMudo}
            value={termoBusca}
            onChangeText={setTermoBusca}
          />
          {termoBusca.length > 0 && (
            <TouchableOpacity onPress={() => setTermoBusca('')}>
              <Ionicons name="close-circle" size={18} color={CORES.textoMudo} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Lista de Vendas */}
      {carregando ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={CORES.primariaClara} />
          <Text style={styles.loadingTexto}>Carregando movimentações...</Text>
        </View>
      ) : (
        <FlatList
          data={vendasFiltradas}
          keyExtractor={(item) => item.id}
          renderItem={renderItemVenda}
          contentContainerStyle={[
            styles.listaVendas,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={recarregando}
              onRefresh={() => carregarVendas(true)}
              tintColor={CORES.primariaClara}
              colors={[CORES.primaria]}
            />
          }
          ListEmptyComponent={
            <View style={styles.estadoVazio}>
              <Ionicons name="receipt-outline" size={54} color={CORES.textoMudo} />
              <Text style={styles.estadoVazioTitulo}>
                {abaAtiva === 'orcamentos'
                  ? 'Nenhum orçamento encontrado'
                  : 'Nenhuma venda encontrada'}
              </Text>
              <Text style={styles.estadoVazioSub}>
                Tente ajustar o período ou termos de busca, ou abra uma nova operação.
              </Text>

              <TouchableOpacity
                style={styles.botaoEstadoVazio}
                onPress={() => abrirNovaVenda(abaAtiva === 'orcamentos' ? 'orcamento' : 'venda')}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.botaoEstadoVazioTexto}>
                  {abaAtiva === 'orcamentos' ? 'Novo Orçamento' : 'Nova Venda'}
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Modal de Criação de Venda / Orçamento */}
      <ModalNovaVendaBalcao
        visivel={modalNovaVendaVisivel}
        modoInicial={modoNovaVenda}
        aoFechar={() => setModalNovaVendaVisivel(false)}
        aoConcluir={(novaVenda) => {
          carregarVendas();
          setVendaIdDetalhe(novaVenda.id);
        }}
      />

      {/* Modal de Detalhe e Comprovante de Venda */}
      <ModalDetalheVenda
        visivel={vendaIdDetalhe !== null}
        vendaId={vendaIdDetalhe}
        nomeOficina={nomeOficina}
        aoFechar={() => setVendaIdDetalhe(null)}
        aoAtualizar={() => carregarVendas()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  barraTopoAcoes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  segmentoAbas: {
    flexDirection: 'row',
    backgroundColor: CORES.superficie,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  botaoSegmento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  botaoSegmentoAtivo: {
    backgroundColor: CORES.primaria,
  },
  botaoSegmentoTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: CORES.textoMudo,
  },
  botaoSegmentoTextoAtivo: {
    color: '#FFFFFF',
  },
  botoesCriacao: {
    flexDirection: 'row',
    gap: 6,
  },
  botaoNovaVenda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: CORES.primaria,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  botaoNovaVendaTexto: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  botaoNovoOrcamento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.primariaClara,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  botaoNovoOrcamentoTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: CORES.primariaClara,
  },
  barraPeriodo: {
    paddingVertical: 6,
  },
  listaPeriodos: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chipPeriodo: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  chipPeriodoSelecionado: {
    backgroundColor: CORES.primariaClara + '25',
    borderColor: CORES.primariaClara,
  },
  chipPeriodoTexto: {
    fontSize: 11,
    fontWeight: '600',
    color: CORES.textoMudo,
  },
  chipPeriodoTextoSelecionado: {
    color: CORES.primariaClara,
    fontWeight: '700',
  },
  containerIndicadores: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginVertical: 4,
  },
  cardIndicador: {
    flex: 1,
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    alignItems: 'center',
  },
  indicadorRotulo: {
    fontSize: 10,
    color: CORES.textoMudo,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 2,
  },
  indicadorValor: {
    fontSize: 13,
    fontWeight: '900',
    color: CORES.texto,
  },
  containerBusca: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputBuscaWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    height: 40,
    gap: 8,
  },
  inputBusca: {
    flex: 1,
    color: CORES.texto,
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingTexto: {
    marginTop: 12,
    fontSize: 13,
    color: CORES.textoMudo,
  },
  listaVendas: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 10,
  },
  cardVenda: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  cardVendaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardNumeroContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardNumeroTexto: {
    fontSize: 15,
    fontWeight: '900',
    color: CORES.texto,
  },
  chipStatus: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  chipFechada: {
    backgroundColor: CORES.sucessoFundo,
  },
  chipOrcamento: {
    backgroundColor: CORES.alertaFundo,
  },
  chipCancelada: {
    backgroundColor: CORES.perigoFundo,
  },
  chipStatusTexto: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
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
  cardData: {
    fontSize: 11,
    color: CORES.textoMudo,
  },
  cardClienteLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  cardClienteNome: {
    fontSize: 13,
    fontWeight: '700',
    color: CORES.texto,
  },
  cardItensResumo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardItensContagem: {
    fontSize: 12,
    color: CORES.textoMudo,
    fontWeight: '600',
  },
  cardItensTexto: {
    flex: 1,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  divisorCard: {
    height: 1,
    backgroundColor: CORES.bordaSuave,
    marginVertical: 6,
  },
  cardRodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPagamentoContainer: {
    flex: 1,
  },
  badgePagamento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: CORES.superficieElevada,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgePagamentoTexto: {
    fontSize: 11,
    color: CORES.textoMudo,
    fontWeight: '600',
  },
  orcamentoValidadeTexto: {
    fontSize: 11,
    color: CORES.alertaTexto,
  },
  cardTotalContainer: {
    alignItems: 'flex-end',
  },
  cardDescontoTexto: {
    fontSize: 10,
    color: CORES.sucessoTexto,
    fontWeight: '600',
  },
  cardTotalValor: {
    fontSize: 16,
    fontWeight: '900',
    color: CORES.primariaClara,
  },
  estadoVazio: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  estadoVazioTitulo: {
    fontSize: 16,
    fontWeight: '800',
    color: CORES.texto,
    marginTop: 12,
    textAlign: 'center',
  },
  estadoVazioSub: {
    fontSize: 12,
    color: CORES.textoMudo,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  botaoEstadoVazio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CORES.primaria,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginTop: 18,
  },
  botaoEstadoVazioTexto: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
