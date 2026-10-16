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
  SafeAreaView,
  Modal,
  ScrollView,
} from 'react-native';
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

const FILTROS_STATUS = [
  { chave: 'todos', rotulo: 'Todas' },
  { chave: 'recebido', rotulo: 'Recebido' },
  { chave: 'diagnostico', rotulo: 'Diagnóstico' },
  { chave: 'em_execucao', rotulo: 'Em Execução' },
  { chave: 'pronto', rotulo: 'Pronto' },
];

export const PatioScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [ordens, setOrdens] = useState<RespostaOSResumo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Modal para ver histórico de checklists de uma OS
  const [modalChecklistsVisivel, setModalChecklistsVisivel] = useState(false);
  const [osHistoricoSelecionada, setOsHistoricoSelecionada] = useState<RespostaOSResumo | null>(null);
  const [historicoChecklists, setHistoricoChecklists] = useState<RespostaChecklist[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  const carregarOS = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await osApi.listarOS(true);
      setOrdens(dados || []);
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

  const abrirHistoricoChecklists = async (os: RespostaOSResumo) => {
    setOsHistoricoSelecionada(os);
    setModalChecklistsVisivel(true);
    setCarregandoHistorico(true);
    try {
      const listas = await checklistApi.obterChecklistsDaOS(os.id);
      setHistoricoChecklists(listas || []);
    } catch (e) {
      console.warn('Erro ao carregar checklists da OS:', e);
      setHistoricoChecklists([]);
    } finally {
      setCarregandoHistorico(false);
    }
  };

  const iniciarChecklist = (os: RespostaOSResumo) => {
    navigation.navigate('Checklist', {
      osId: os.id,
      numero: os.numero,
      placa: os.placa,
      veiculoDescricao: os.veiculoDescricao,
      clienteNome: os.clienteNome,
    });
  };

  const renderCardOS = ({ item }: { item: RespostaOSResumo }) => {
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
        </View>

        {/* Barra de Ações: Fazer Checklist / Ver Checklists */}
        <View style={styles.cardAcoes}>
          <TouchableOpacity
            style={styles.botaoVerChecklists}
            onPress={() => abrirHistoricoChecklists(item)}
          >
            <Ionicons name="document-text-outline" size={16} color={CORES.textoSecundario} />
            <Text style={styles.botaoVerChecklistsTexto}>Vistorias</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botaoFazerChecklist}
            onPress={() => iniciarChecklist(item)}
          >
            <Ionicons name="clipboard-outline" size={18} color="#FFFFFF" />
            <Text style={styles.botaoFazerChecklistTexto}>Fazer Checklist</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
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
          contentContainerStyle={styles.listaConteudo}
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

      {/* Modal Histórico de Checklists da OS */}
      <Modal
        visible={modalChecklistsVisivel}
        animationType="slide"
        transparent
        onRequestClose={() => setModalChecklistsVisivel(false)}
      >
        <View style={styles.fundoModal}>
          <View style={styles.cardModalHistorico}>
            <View style={styles.headerModalHistorico}>
              <View>
                <Text style={styles.tituloModalHistorico}>
                  Vistorias da OS #{osHistoricoSelecionada?.numero}
                </Text>
                <Text style={styles.subtituloModalHistorico}>
                  Placa: {osHistoricoSelecionada?.placa} • {osHistoricoSelecionada?.veiculoDescricao}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalChecklistsVisivel(false)}>
                <Ionicons name="close" size={24} color={CORES.texto} />
              </TouchableOpacity>
            </View>

            {carregandoHistorico ? (
              <View style={styles.loadingModal}>
                <ActivityIndicator size="large" color={CORES.primaria} />
                <Text style={styles.loadingTexto}>Buscando checklists gravados...</Text>
              </View>
            ) : historicoChecklists.length === 0 ? (
              <View style={styles.vazioHistorico}>
                <Ionicons name="clipboard-outline" size={48} color={CORES.borda} />
                <Text style={styles.vazioHistoricoTitulo}>Nenhum checklist registrado ainda</Text>
                <Text style={styles.vazioHistoricoSubtitulo}>
                  Esta ordem de serviço ainda não possui vistorias de entrada ou saída.
                </Text>
                {osHistoricoSelecionada && (
                  <TouchableOpacity
                    style={styles.botaoIniciarDoModal}
                    onPress={() => {
                      setModalChecklistsVisivel(false);
                      iniciarChecklist(osHistoricoSelecionada);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.botaoIniciarDoModalTexto}>Realizar Checklist Agora</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <ScrollView style={styles.corpoModalHistorico}>
                {historicoChecklists.map((chk) => (
                  <View key={chk.id} style={styles.itemChecklistHistorico}>
                    <View style={styles.topoChecklistLinha}>
                      <View
                        style={[
                          styles.badgeTipoChecklist,
                          chk.tipo === 'entrada'
                            ? styles.badgeTipoEntrada
                            : styles.badgeTipoSaida,
                        ]}
                      >
                        <Text style={styles.badgeTipoTexto}>
                          {chk.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA'}
                        </Text>
                      </View>
                      <Text style={styles.dataChecklistText}>
                        {new Date(chk.preenchidoEm).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>

                    <View style={styles.metricasChecklist}>
                      <Text style={styles.metricaText}>
                        Odômetro: <Text style={{ fontWeight: '700', color: CORES.texto }}>{chk.km} KM</Text>
                      </Text>
                      <Text style={styles.metricaText}>
                        Combustível: <Text style={{ fontWeight: '700', color: CORES.texto }}>{Math.round(chk.nivelCombustivel * 100)}%</Text>
                      </Text>
                      <Text style={styles.metricaText}>
                        Avarias: <Text style={{ fontWeight: '700', color: chk.avarias.length > 0 ? CORES.alertaTexto : CORES.sucessoTexto }}>
                          {chk.avarias.length}
                        </Text>
                      </Text>
                    </View>

                    {chk.observacoes ? (
                      <Text style={styles.obsChecklistText}>
                        Obs: {chk.observacoes}
                      </Text>
                    ) : null}

                    {chk.pertences && chk.pertences.length > 0 && (
                      <View style={styles.pertencesLinha}>
                        <Text style={styles.pertencesLabel}>Pertences:</Text>
                        <Text style={styles.pertencesValores}>
                          {chk.pertences.join(', ')}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.botaoFecharModal}
              onPress={() => setModalChecklistsVisivel(false)}
            >
              <Text style={styles.botaoFecharModalTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  cardModalHistorico: {
    backgroundColor: CORES.superficie,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  headerModalHistorico: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
    paddingBottom: 12,
  },
  tituloModalHistorico: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
  },
  subtituloModalHistorico: {
    color: CORES.textoSecundario,
    fontSize: 13,
    marginTop: 2,
  },
  corpoModalHistorico: {
    marginBottom: 16,
  },
  loadingModal: {
    padding: 40,
    alignItems: 'center',
  },
  vazioHistorico: {
    padding: 30,
    alignItems: 'center',
  },
  vazioHistoricoTitulo: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  vazioHistoricoSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  botaoIniciarDoModal: {
    backgroundColor: CORES.primaria,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  botaoIniciarDoModalTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  itemChecklistHistorico: {
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  topoChecklistLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeTipoChecklist: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeTipoEntrada: {
    backgroundColor: '#1E3A8A',
  },
  badgeTipoSaida: {
    backgroundColor: '#065F46',
  },
  badgeTipoTexto: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  dataChecklistText: {
    color: CORES.textoMudo,
    fontSize: 12,
  },
  metricasChecklist: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 8,
  },
  metricaText: {
    color: CORES.textoSecundario,
    fontSize: 13,
  },
  obsChecklistText: {
    color: CORES.texto,
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  pertencesLinha: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  pertencesLabel: {
    color: CORES.textoMudo,
    fontSize: 12,
    fontWeight: '600',
  },
  pertencesValores: {
    color: CORES.textoSecundario,
    fontSize: 12,
    flex: 1,
  },
  botaoFecharModal: {
    backgroundColor: CORES.superficieClara,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  botaoFecharModalTexto: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
  },
});
