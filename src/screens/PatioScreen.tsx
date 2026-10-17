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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { osApi } from '../api/osApi';
import { checklistApi } from '../api/checklistApi';
import { RespostaOSResumo, RespostaChecklist } from '../types';
import { CORES } from '../constants';
import { extrairMensagemErro } from '../api/clienteHttp';
import { PlacaVeiculo } from '../components/PlacaVeiculo';
import { StatusBadge } from '../components/StatusBadge';
import { ChecklistDetalhesModal } from '../components/ChecklistDetalhesModal';

const FILTROS_STATUS = [
  { chave: 'todos', rotulo: 'Todas' },
  { chave: 'recebido', rotulo: 'Recebido' },
  { chave: 'diagnostico', rotulo: 'Diagnóstico' },
  { chave: 'em_execucao', rotulo: 'Em Execução' },
  { chave: 'pronto', rotulo: 'Pronto' },
];

export const PatioScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [ordens, setOrdens] = useState<RespostaOSResumo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Mapeamento dos checklists de cada OS ({ [osId]: RespostaChecklist[] })
  const [checklistsPorOS, setChecklistsPorOS] = useState<Record<string, RespostaChecklist[]>>({});

  // Modal para ver detalhes completos do checklist de uma OS
  const [modalChecklistsVisivel, setModalChecklistsVisivel] = useState(false);
  const [osHistoricoSelecionada, setOsHistoricoSelecionada] = useState<RespostaOSResumo | null>(null);
  const [historicoChecklists, setHistoricoChecklists] = useState<RespostaChecklist[]>([]);

  const carregarOS = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await osApi.listarOS(true);
      const lista = dados || [];
      setOrdens(lista);

      // Busca os checklists de todas as OSs em paralelo para exibir botões e status corretos
      if (lista.length > 0) {
        const mapa: Record<string, RespostaChecklist[]> = {};
        await Promise.all(
          lista.map(async (os) => {
            try {
              const chks = await checklistApi.obterChecklistsDaOS(os.id);
              mapa[os.id] = chks || [];
            } catch {
              mapa[os.id] = [];
            }
          })
        );
        setChecklistsPorOS(mapa);
      } else {
        setChecklistsPorOS({});
      }
    } catch (e) {
      setErro(extrairMensagemErro(e));
    } finally {
      setCarregando(false);
      setRecarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarOS();
  }, [carregarOS]);

  const onRefresh = () => {
    setRecarregando(true);
    carregarOS();
  };

  const ordensFiltradas = useMemo(() => {
    return ordens.filter((os) => {
      // Filtro por status
      if (filtroStatus !== 'todos') {
        if ((os.status || '').toLowerCase() !== filtroStatus.toLowerCase()) {
          return false;
        }
      }

      // Filtro por busca de placa ou nome do cliente
      if (termoBusca.trim().length > 0) {
        const termo = termoBusca.toLowerCase().trim();
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
      }

      return true;
    });
  }, [ordens, filtroStatus, termoBusca]);

  const abrirDetalhesChecklist = async (os: RespostaOSResumo) => {
    setOsHistoricoSelecionada(os);
    const chksSalvos = checklistsPorOS[os.id];
    if (chksSalvos && chksSalvos.length > 0) {
      setHistoricoChecklists(chksSalvos);
      setModalChecklistsVisivel(true);
    } else {
      setModalChecklistsVisivel(true);
      try {
        const listas = await checklistApi.obterChecklistsDaOS(os.id);
        setHistoricoChecklists(listas || []);
        setChecklistsPorOS((prev) => ({ ...prev, [os.id]: listas || [] }));
      } catch (e) {
        console.warn('Erro ao carregar checklists da OS:', e);
        setHistoricoChecklists([]);
      }
    }
  };

  const iniciarChecklist = (os: RespostaOSResumo, tipoPreferencia?: 'entrada' | 'saida') => {
    navigation.navigate('Checklist', {
      osId: os.id,
      numero: os.numero,
      placa: os.placa,
      veiculoDescricao: os.veiculoDescricao,
      clienteNome: os.clienteNome,
      tipoInicial: tipoPreferencia,
    });
  };

  const renderCardOS = ({ item }: { item: RespostaOSResumo }) => {
    const checklistsDaOS = checklistsPorOS[item.id] || [];
    const temChecklist = checklistsDaOS.length > 0;
    const temEntrada = checklistsDaOS.some((c) => c.tipo === 'entrada');
    const temSaida = checklistsDaOS.some((c) => c.tipo === 'saida');

    return (
      <View style={styles.cardOS}>
        {/* Cabeçalho do Card: Placa, Número da OS e Status */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderEsquerda}>
            <PlacaVeiculo placa={item.placa} tamanho="pequeno" />
            <Text style={styles.numeroOSText}>OS #{item.numero}</Text>
          </View>
          <StatusBadge status={item.status} rotulo={item.statusRotulo} />
        </View>

        {/* Informações do Veículo e Cliente */}
        <View style={styles.cardCorpo}>
          <Text style={styles.veiculoDescricaoText} numberOfLines={1}>
            {item.veiculoDescricao || 'Veículo não informado'}
          </Text>

          <View style={styles.linhaInfo}>
            <Ionicons name="person-outline" size={15} color={CORES.textoSecundario} />
            <Text style={styles.clienteNomeText} numberOfLines={1}>
              {item.clienteNome || 'Cliente não identificado'}
            </Text>
          </View>

          {item.boxNome && (
            <View style={styles.linhaInfo}>
              <Ionicons name="cube-outline" size={15} color="#38BDF8" />
              <Text style={[styles.infoSecundariaText, { color: '#38BDF8' }]}>
                Box: {item.boxNome}
              </Text>
            </View>
          )}

          {item.servicoPrincipal && (
            <View style={styles.linhaInfo}>
              <Ionicons name="construct-outline" size={15} color={CORES.textoMudo} />
              <Text style={styles.infoSecundariaText} numberOfLines={1}>
                {item.servicoPrincipal}
              </Text>
            </View>
          )}

          {/* Badge Indicador de Checklist */}
          <View style={styles.linhaChecklistStatus}>
            {temChecklist ? (
              <View
                style={[
                  styles.tagChecklist,
                  temEntrada && temSaida
                    ? styles.tagChecklistCompleto
                    : styles.tagChecklistParcial,
                ]}
              >
                <Ionicons
                  name={temEntrada && temSaida ? 'checkmark-done-circle' : 'checkmark-circle'}
                  size={14}
                  color={temEntrada && temSaida ? '#22C55E' : '#38BDF8'}
                />
                <Text
                  style={[
                    styles.tagChecklistTexto,
                    { color: temEntrada && temSaida ? '#22C55E' : '#38BDF8' },
                  ]}
                >
                  {temEntrada && temSaida
                    ? 'Checklists Entrada e Saída Concluídos'
                    : 'Checklist de Entrada Preenchido'}
                </Text>
              </View>
            ) : (
              <View style={[styles.tagChecklist, styles.tagChecklistPendente]}>
                <Ionicons name="time-outline" size={14} color={CORES.alertaTexto} />
                <Text style={[styles.tagChecklistTexto, { color: CORES.alertaTexto }]}>
                  Checklist Pendente
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Barra de Ações: Mostrar Checklist ou Fazer Checklist */}
        <View style={styles.cardAcoes}>
          {temChecklist ? (
            <>
              {/* Botão Principal: Mostrar Checklist */}
              <TouchableOpacity
                style={styles.botaoMostrarChecklist}
                onPress={() => abrirDetalhesChecklist(item)}
              >
                <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
                <Text style={styles.botaoMostrarChecklistTexto}>Mostrar Checklist</Text>
              </TouchableOpacity>

              {/* Botão Secundário: Preencher Saída se apenas Entrada foi feita */}
              {temEntrada && !temSaida && (
                <TouchableOpacity
                  style={styles.botaoFazerSaida}
                  onPress={() => iniciarChecklist(item, 'saida')}
                >
                  <Ionicons name="exit-outline" size={16} color="#10B981" />
                  <Text style={styles.botaoFazerSaidaTexto}>+ Saída</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            /* Botão Principal quando NÃO tem checklist preenchido: Fazer Checklist */
            <TouchableOpacity
              style={styles.botaoFazerChecklist}
              onPress={() => iniciarChecklist(item, 'entrada')}
            >
              <Ionicons name="clipboard-outline" size={18} color="#FFFFFF" />
              <Text style={styles.botaoFazerChecklistTexto}>Fazer Checklist</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Barra de Busca de OS */}
      <View style={styles.topoSecao}>
        <View style={styles.inputBuscaContainer}>
          <Ionicons name="search" size={20} color={CORES.textoMudo} style={styles.iconeBusca} />
          <TextInput
            style={styles.inputBusca}
            placeholder="Buscar por placa, cliente ou veículo..."
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

        {/* Pills de Filtro por Status */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtrosScroll}
        >
          {FILTROS_STATUS.map((f) => {
            const ativo = filtroStatus === f.chave;
            return (
              <TouchableOpacity
                key={f.chave}
                style={[styles.chipFiltro, ativo && styles.chipFiltroAtivo]}
                onPress={() => setFiltroStatus(f.chave)}
              >
                <Text style={[styles.chipFiltroTexto, ativo && styles.chipFiltroTextoAtivo]}>
                  {f.rotulo}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Erro de Comunicação */}
      {erro && (
        <View style={styles.erroBox}>
          <Ionicons name="cloud-offline" size={20} color={CORES.perigoTexto} />
          <Text style={styles.erroTexto}>{erro}</Text>
          <TouchableOpacity onPress={carregarOS} style={styles.botaoRecarregar}>
            <Text style={styles.botaoRecarregarTexto}>Recarregar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de Ordens de Serviço */}
      {carregando && !recarregando ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={CORES.primaria} />
          <Text style={styles.loadingTexto}>Carregando veículos no pátio...</Text>
        </View>
      ) : (
        <FlatList
          data={ordensFiltradas}
          keyExtractor={(item) => item.id}
          renderItem={renderCardOS}
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
              <Ionicons name="car-sport-outline" size={64} color={CORES.borda} />
              <Text style={styles.vazioTitulo}>Nenhum veículo encontrado</Text>
              <Text style={styles.vazioSubtitulo}>
                {termoBusca || filtroStatus !== 'todos'
                  ? 'Não há ordens de serviço correspondentes aos filtros aplicados.'
                  : 'Nenhum veículo em atendimento aberto no pátio no momento.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Modal Detalhado de Checklist */}
      <ChecklistDetalhesModal
        visivel={modalChecklistsVisivel}
        onFechar={() => setModalChecklistsVisivel(false)}
        os={osHistoricoSelecionada}
        checklists={historicoChecklists}
        onIniciarSaida={(os) => iniciarChecklist(os, 'saida')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  topoSecao: {
    backgroundColor: CORES.superficie,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  inputBuscaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
  },
  iconeBusca: {
    marginRight: 8,
  },
  inputBusca: {
    flex: 1,
    color: CORES.texto,
    fontSize: 14,
  },
  filtrosScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chipFiltro: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: CORES.superficieClara,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  chipFiltroAtivo: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primariaClara,
  },
  chipFiltroTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
    fontWeight: '600',
  },
  chipFiltroTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  botaoRecarregar: {
    backgroundColor: CORES.perigo,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  botaoRecarregarTexto: {
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
    gap: 14,
  },
  cardOS: {
    backgroundColor: CORES.superficie,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderEsquerda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  numeroOSText: {
    color: CORES.primariaClara,
    fontSize: 14,
    fontWeight: '800',
  },
  cardCorpo: {
    marginBottom: 14,
    gap: 6,
  },
  veiculoDescricaoText: {
    color: CORES.texto,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  linhaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clienteNomeText: {
    color: CORES.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
  },
  infoSecundariaText: {
    color: CORES.textoMudo,
    fontSize: 13,
  },
  cardAcoes: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
  },
  botaoVerChecklists: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: CORES.superficieClara,
    borderWidth: 1,
    borderColor: CORES.borda,
    gap: 6,
  },
  botaoVerChecklistsTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
    fontWeight: '600',
  },
  linhaChecklistStatus: {
    marginTop: 4,
  },
  tagChecklist: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagChecklistCompleto: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  tagChecklistParcial: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  tagChecklistPendente: {
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.25)',
  },
  tagChecklistTexto: {
    fontSize: 11,
    fontWeight: '700',
  },
  botaoMostrarChecklist: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    gap: 6,
  },
  botaoMostrarChecklistTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  botaoFazerSaida: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#10B981',
    gap: 4,
  },
  botaoFazerSaidaTexto: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '800',
  },
  botaoFazerChecklist: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: CORES.primaria,
    gap: 6,
  },
  botaoFazerChecklistTexto: {
    color: '#FFFFFF',
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
});
