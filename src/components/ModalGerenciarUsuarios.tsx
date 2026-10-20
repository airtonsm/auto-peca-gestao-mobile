import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  OpcaoUsuario,
  PedidoUsuario,
  RespostaUsuario,
} from '../types';
import { CORES } from '../constants';
import { useAuth } from '../context/AuthContext';
import { usuarioApi } from '../api/usuarioApi';
import { extrairMensagemErro } from '../api/clienteHttp';
import {
  ModalFormularioUsuario,
  PAPEIS_PADRAO_FALLBACK,
  obterEstiloPapel,
} from './ModalFormularioUsuario';

type FiltroStatus = 'todos' | 'ativos' | 'inativos';

interface ModalGerenciarUsuariosProps {
  visivel: boolean;
  aoFechar: () => void;
  aoAtualizarContagem?: (total: number, ativos: number) => void;
}

const formatarDataAcesso = (iso?: string): string => {
  if (!iso) return 'Nenhum acesso registrado';
  try {
    const data = new Date(iso);
    if (isNaN(data.getTime())) return iso;
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, '0');
    const min = String(data.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} às ${hora}:${min}`;
  } catch {
    return iso;
  }
};

export const ModalGerenciarUsuarios: React.FC<ModalGerenciarUsuariosProps> = ({
  visivel,
  aoFechar,
  aoAtualizarContagem,
}) => {
  const insets = useSafeAreaInsets();
  const { usuario: usuarioLogado, oficinaAtiva } = useAuth();

  const [usuarios, setUsuarios] = useState<RespostaUsuario[]>([]);
  const [papeisOpcoes, setPapeisOpcoes] = useState<OpcaoUsuario[]>(PAPEIS_PADRAO_FALLBACK);
  const [carregando, setCarregando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [filtroPapel, setFiltroPapel] = useState<string>('todos');

  // Estados de ação e formulário
  const [modalFormularioVisivel, setModalFormularioVisivel] = useState(false);
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<RespostaUsuario | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  const podeEditarUsuarios = useMemo(() => {
    if (!usuarioLogado) return false;
    const permissoes = usuarioLogado.permissoes || [];
    const papelAtual = (usuarioLogado.papel || '').toLowerCase();
    return (
      permissoes.includes('usuario.editar') ||
      papelAtual === 'administrador' ||
      papelAtual === 'gestor'
    );
  }, [usuarioLogado]);

  const notificarContagem = useCallback(
    (lista: RespostaUsuario[]) => {
      if (aoAtualizarContagem) {
        const ativosCount = lista.filter((u) => u.ativo).length;
        aoAtualizarContagem(lista.length, ativosCount);
      }
    },
    [aoAtualizarContagem]
  );

  const carregarDados = useCallback(
    async (silencioso = false) => {
      if (!silencioso) {
        setCarregando(true);
      } else {
        setAtualizando(true);
      }
      setErro(null);

      try {
        const [listaUsuarios, opcoesResp] = await Promise.all([
          usuarioApi.listarUsuarios(),
          usuarioApi.obterOpcoes().catch(() => null),
        ]);

        setUsuarios(listaUsuarios);
        notificarContagem(listaUsuarios);

        if (opcoesResp?.papeis && opcoesResp.papeis.length > 0) {
          setPapeisOpcoes(opcoesResp.papeis);
        }
      } catch (e) {
        setErro(extrairMensagemErro(e));
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [notificarContagem]
  );

  useEffect(() => {
    if (visivel) {
      carregarDados();
    }
  }, [visivel, carregarDados]);

  const isMesmoUsuarioLogado = useCallback(
    (alvo: RespostaUsuario): boolean => {
      if (!usuarioLogado) return false;
      if (alvo.id && usuarioLogado.id && alvo.id === usuarioLogado.id) {
        return true;
      }
      if (
        alvo.email &&
        usuarioLogado.email &&
        alvo.email.trim().toLowerCase() === usuarioLogado.email.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    },
    [usuarioLogado]
  );

  // Lista filtrada em tempo real por nome/e-mail, status e papel
  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return usuarios.filter((u) => {
      if (filtroStatus === 'ativos' && !u.ativo) return false;
      if (filtroStatus === 'inativos' && u.ativo) return false;

      if (filtroPapel !== 'todos' && u.papel?.toLowerCase() !== filtroPapel.toLowerCase()) {
        return false;
      }

      if (termo.length > 0) {
        const matchNome = (u.nome || '').toLowerCase().includes(termo);
        const matchEmail = (u.email || '').toLowerCase().includes(termo);
        const matchTelefone = (u.telefone || '').toLowerCase().includes(termo);
        if (!matchNome && !matchEmail && !matchTelefone) return false;
      }

      return true;
    });
  }, [usuarios, busca, filtroStatus, filtroPapel]);

  // Resumo rápido de contagens
  const resumoEquipe = useMemo(() => {
    const total = usuarios.length;
    const ativos = usuarios.filter((u) => u.ativo).length;
    const pendentes = usuarios.filter((u) => u.deveTrocarSenha).length;
    return { total, ativos, inativos: total - ativos, pendentes };
  }, [usuarios]);

  const handleAbrirNovoUsuario = () => {
    setUsuarioEmEdicao(null);
    setModalFormularioVisivel(true);
  };

  const handleAbrirEdicao = (alvo: RespostaUsuario) => {
    setUsuarioEmEdicao(alvo);
    setModalFormularioVisivel(true);
  };

  const handleAlternarStatusRapido = (alvo: RespostaUsuario) => {
    if (isMesmoUsuarioLogado(alvo)) {
      Alert.alert(
        'Operação Não Permitida',
        'Por segurança, você não pode desativar o seu próprio usuário nesta oficina.'
      );
      return;
    }

    const novoStatus = !alvo.ativo;
    const acaoTitulo = novoStatus ? 'Reativar Colaborador' : 'Desativar Colaborador';
    const acaoDescricao = novoStatus
      ? `Deseja reativar o acesso de "${alvo.nome}" nesta oficina?`
      : `Deseja suspender temporariamente o acesso de "${alvo.nome}" nesta oficina?`;

    Alert.alert(acaoTitulo, acaoDescricao, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: novoStatus ? 'Reativar' : 'Desativar',
        style: novoStatus ? 'default' : 'destructive',
        onPress: async () => {
          setProcessandoId(alvo.id);
          try {
            const payload: PedidoUsuario = {
              nome: alvo.nome,
              email: alvo.email,
              telefone: alvo.telefone,
              papel: alvo.papel,
              ativo: novoStatus,
              mecanicoId: alvo.mecanicoId ?? null,
              permissoesExtras: alvo.permissoesExtras,
              permissoesRemovidas: alvo.permissoesRemovidas,
            };
            const atualizado = await usuarioApi.atualizarUsuario(alvo.id, payload);
            setUsuarios((prev) => {
              const novaLista = prev.map((item) =>
                item.id === atualizado.id ? atualizado : item
              );
              notificarContagem(novaLista);
              return novaLista;
            });
          } catch (e) {
            Alert.alert('Erro ao alterar status', extrairMensagemErro(e));
          } finally {
            setProcessandoId(null);
          }
        },
      },
    ]);
  };

  const handleConfirmarDesvinculacao = (alvo: RespostaUsuario) => {
    if (isMesmoUsuarioLogado(alvo)) {
      Alert.alert(
        'Operação Não Permitida',
        'Você não pode remover ou desvincular a si mesmo da oficina ativa.'
      );
      return;
    }

    Alert.alert(
      'Desvincular Colaborador',
      `Deseja remover "${alvo.nome}" (${alvo.email}) da equipe de ${
        oficinaAtiva?.nome || 'sua oficina'
      }?\n\nEsta ação encerra o vínculo e o acesso do usuário a esta oficina.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular da Oficina',
          style: 'destructive',
          onPress: async () => {
            setProcessandoId(alvo.id);
            try {
              await usuarioApi.desvincularUsuario(alvo.id);
              setUsuarios((prev) => {
                const novaLista = prev.filter((item) => item.id !== alvo.id);
                notificarContagem(novaLista);
                return novaLista;
              });
              Alert.alert(
                'Colaborador Desvinculado',
                `${alvo.nome} foi removido da equipe desta oficina.`
              );
            } catch (e) {
              Alert.alert('Não foi possível desvincular', extrairMensagemErro(e));
            } finally {
              setProcessandoId(null);
            }
          },
        },
      ]
    );
  };

  const handleSalvarFormularioSucesso = (usuarioSalvo: RespostaUsuario) => {
    setUsuarios((prev) => {
      const existe = prev.some((u) => u.id === usuarioSalvo.id);
      const novaLista = existe
        ? prev.map((u) => (u.id === usuarioSalvo.id ? { ...u, ...usuarioSalvo } : u))
        : [...prev, usuarioSalvo].sort((a, b) =>
            (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
          );
      notificarContagem(novaLista);
      return novaLista;
    });
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent
      onRequestClose={aoFechar}
    >
      <View style={styles.fundoModal}>
        <View style={[styles.containerModal, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Cabeçalho */}
          <View style={styles.header}>
            <View style={styles.headerEsquerda}>
              <View style={styles.headerIconeBox}>
                <Ionicons name="people" size={22} color={CORES.primariaClara} />
              </View>
              <View style={styles.headerTextos}>
                <Text style={styles.headerTitulo}>Equipe da Oficina</Text>
                <Text style={styles.headerSubtitulo} numberOfLines={1}>
                  {oficinaAtiva?.nome || usuarioLogado?.empresa || 'Gestão de Colaboradores'}
                </Text>
              </View>
            </View>

            <View style={styles.headerAcoes}>
              {podeEditarUsuarios && (
                <TouchableOpacity
                  style={styles.botaoNovoTopo}
                  onPress={handleAbrirNovoUsuario}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-add" size={16} color="#FFFFFF" />
                  <Text style={styles.botaoNovoTopoTexto}>Novo</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.botaoFechar}
                onPress={aoFechar}
                accessibilityLabel="Fechar gestão de usuários"
              >
                <Ionicons name="close" size={24} color={CORES.texto} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Resumo Rápido de Indicadores */}
          <View style={styles.resumoRow}>
            <View style={styles.resumoPill}>
              <Text style={styles.resumoValor}>{resumoEquipe.total}</Text>
              <Text style={styles.resumoLabel}>Total</Text>
            </View>
            <View style={[styles.resumoPill, styles.resumoPillSucesso]}>
              <Text style={[styles.resumoValor, { color: CORES.sucessoTexto }]}>
                {resumoEquipe.ativos}
              </Text>
              <Text style={styles.resumoLabel}>Ativos</Text>
            </View>
            <View style={styles.resumoPill}>
              <Text style={[styles.resumoValor, { color: CORES.textoSecundario }]}>
                {resumoEquipe.inativos}
              </Text>
              <Text style={styles.resumoLabel}>Inativos</Text>
            </View>
            <View style={[styles.resumoPill, styles.resumoPillAlerta]}>
              <Text style={[styles.resumoValor, { color: CORES.alertaTexto }]}>
                {resumoEquipe.pendentes}
              </Text>
              <Text style={styles.resumoLabel}>1º Acesso</Text>
            </View>
          </View>

          {/* Barra de Busca e Filtros */}
          <View style={styles.filtrosContainer}>
            {/* Campo de busca por nome ou e-mail */}
            <View style={styles.buscaBox}>
              <Ionicons name="search-outline" size={18} color={CORES.textoMudo} />
              <TextInput
                style={styles.buscaInput}
                value={busca}
                onChangeText={setBusca}
                placeholder="Buscar colaborador por nome ou e-mail..."
                placeholderTextColor={CORES.textoMudo}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {busca.length > 0 && (
                <TouchableOpacity onPress={() => setBusca('')}>
                  <Ionicons name="close-circle" size={18} color={CORES.textoSecundario} />
                </TouchableOpacity>
              )}
            </View>

            {/* Filtro de Status */}
            <View style={styles.statusTabsRow}>
              {(
                [
                  { id: 'todos', label: `Todos (${resumoEquipe.total})` },
                  { id: 'ativos', label: `Ativos (${resumoEquipe.ativos})` },
                  { id: 'inativos', label: `Inativos (${resumoEquipe.inativos})` },
                ] as Array<{ id: FiltroStatus; label: string }>
              ).map((tab) => {
                const ativo = filtroStatus === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.statusTab, ativo && styles.statusTabAtiva]}
                    onPress={() => setFiltroStatus(tab.id)}
                  >
                    <Text
                      style={[
                        styles.statusTabTexto,
                        ativo && styles.statusTabTextoAtivo,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Filtro Horizontal por Papel */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.papeisChipsScroll}
            >
              <TouchableOpacity
                style={[
                  styles.chipPapelFiltro,
                  filtroPapel === 'todos' && styles.chipPapelFiltroAtivo,
                ]}
                onPress={() => setFiltroPapel('todos')}
              >
                <Ionicons
                  name="apps-outline"
                  size={13}
                  color={filtroPapel === 'todos' ? '#FFFFFF' : CORES.textoSecundario}
                />
                <Text
                  style={[
                    styles.chipPapelFiltroTexto,
                    filtroPapel === 'todos' && styles.chipPapelFiltroTextoAtivo,
                  ]}
                >
                  Todos os Papéis
                </Text>
              </TouchableOpacity>

              {papeisOpcoes.map((p) => {
                const selecionado = filtroPapel === p.chave;
                const estilo = obterEstiloPapel(p.chave);
                return (
                  <TouchableOpacity
                    key={p.chave}
                    style={[
                      styles.chipPapelFiltro,
                      selecionado && {
                        backgroundColor: estilo.corFundo,
                        borderColor: estilo.corBorda,
                      },
                    ]}
                    onPress={() =>
                      setFiltroPapel(selecionado ? 'todos' : p.chave)
                    }
                  >
                    <Ionicons
                      name={estilo.icone}
                      size={13}
                      color={selecionado ? estilo.corTexto : CORES.textoSecundario}
                    />
                    <Text
                      style={[
                        styles.chipPapelFiltroTexto,
                        selecionado && { color: estilo.corTexto, fontWeight: '800' },
                      ]}
                    >
                      {p.rotulo}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Conteúdo Principal: Lista de Usuários */}
          {carregando ? (
            <View style={styles.centroContainer}>
              <ActivityIndicator size="large" color={CORES.primariaClara} />
              <Text style={styles.carregandoTexto}>
                Carregando colaboradores da oficina...
              </Text>
            </View>
          ) : erro ? (
            <View style={styles.centroContainer}>
              <Ionicons name="alert-circle-outline" size={44} color={CORES.perigoTexto} />
              <Text style={styles.erroTitulo}>Falha ao carregar equipe</Text>
              <Text style={styles.erroSubtitulo}>{erro}</Text>
              <TouchableOpacity
                style={styles.botaoTentarNovamente}
                onPress={() => carregarDados()}
              >
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.botaoTentarNovamenteTexto}>Tentar Novamente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.listaScroll}
              contentContainerStyle={styles.listaContent}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={atualizando}
                  onRefresh={() => carregarDados(true)}
                  tintColor={CORES.primariaClara}
                  colors={[CORES.primaria]}
                />
              }
            >
              {usuariosFiltrados.length === 0 ? (
                <View style={styles.vazioBox}>
                  <Ionicons name="people-outline" size={42} color={CORES.textoMudo} />
                  <Text style={styles.vazioTitulo}>
                    Nenhum colaborador encontrado
                  </Text>
                  <Text style={styles.vazioSubtitulo}>
                    {busca || filtroStatus !== 'todos' || filtroPapel !== 'todos'
                      ? 'Tente ajustar os filtros de busca, status ou papel selecionados.'
                      : 'Adicione o primeiro colaborador desta oficina tocando no botão abaixo.'}
                  </Text>
                </View>
              ) : (
                usuariosFiltrados.map((item) => {
                  const ehVoce = isMesmoUsuarioLogado(item);
                  const estiloPapel = obterEstiloPapel(item.papel);
                  const estaProcessando = processandoId === item.id;
                  const iniciais = (item.nome || 'U')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join('');

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.cardColaborador,
                        !item.ativo && styles.cardColaboradorInativo,
                        ehVoce && styles.cardColaboradorVoce,
                      ]}
                    >
                      {/* Topo do Card: Avatar + Identificação + Badges */}
                      <View style={styles.cardTopo}>
                        <View
                          style={[
                            styles.avatarCirculo,
                            {
                              backgroundColor: item.ativo
                                ? estiloPapel.corFundo
                                : CORES.superficieClara,
                              borderColor: item.ativo
                                ? estiloPapel.corBorda
                                : CORES.borda,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.avatarIniciais,
                              {
                                color: item.ativo
                                  ? estiloPapel.corTexto
                                  : CORES.textoMudo,
                              },
                            ]}
                          >
                            {iniciais || 'U'}
                          </Text>
                        </View>

                        <View style={styles.identificacaoCol}>
                          <View style={styles.nomeLinha}>
                            <Text style={styles.nomeColaborador} numberOfLines={1}>
                              {item.nome}
                            </Text>
                            {ehVoce && (
                              <View style={styles.badgeVoce}>
                                <Text style={styles.badgeVoceTexto}>VOCÊ</Text>
                              </View>
                            )}
                          </View>

                          <Text style={styles.emailColaborador} numberOfLines={1}>
                            {item.email}
                          </Text>

                          {!!item.telefone && (
                            <View style={styles.telefoneLinha}>
                              <Ionicons
                                name="call-outline"
                                size={12}
                                color={CORES.textoMudo}
                              />
                              <Text style={styles.telefoneTexto}>{item.telefone}</Text>
                            </View>
                          )}
                        </View>

                        {/* Badge de Status Ativo / Inativo */}
                        <View
                          style={[
                            styles.badgeStatus,
                            item.ativo
                              ? styles.badgeStatusAtivo
                              : styles.badgeStatusInativo,
                          ]}
                        >
                          <View
                            style={[
                              styles.pontoStatus,
                              {
                                backgroundColor: item.ativo
                                  ? CORES.sucessoTexto
                                  : CORES.perigoTexto,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.badgeStatusTexto,
                              {
                                color: item.ativo
                                  ? CORES.sucessoTexto
                                  : CORES.perigoTexto,
                              },
                            ]}
                          >
                            {item.ativo ? 'Ativo' : 'Inativo'}
                          </Text>
                        </View>
                      </View>

                      {/* Linha de Badges: Papel + Indicador de Nunca Fez Login (deveTrocarSenha) */}
                      <View style={styles.badgesMeioRow}>
                        {/* Badge de Papel com Ícone e Cor do Tema */}
                        <View
                          style={[
                            styles.badgePapel,
                            {
                              backgroundColor: estiloPapel.corFundo,
                              borderColor: estiloPapel.corBorda,
                            },
                          ]}
                        >
                          <Ionicons
                            name={estiloPapel.icone}
                            size={13}
                            color={estiloPapel.corTexto}
                          />
                          <Text
                            style={[
                              styles.badgePapelTexto,
                              { color: estiloPapel.corTexto },
                            ]}
                          >
                            {item.papelRotulo || item.papel}
                          </Text>
                        </View>

                        {/* Indicador Visual de Primeiro Acesso / Nunca fez login */}
                        {item.deveTrocarSenha ? (
                          <View style={styles.badgePrimeiroAcesso}>
                            <Ionicons
                              name="key-outline"
                              size={12}
                              color={CORES.alertaTexto}
                            />
                            <Text style={styles.badgePrimeiroAcessoTexto}>
                              Nunca fez login • Senha temporária
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.infoUltimoAcesso}>
                            <Ionicons
                              name="time-outline"
                              size={12}
                              color={CORES.textoMudo}
                            />
                            <Text style={styles.infoUltimoAcessoTexto}>
                              {item.ultimoAcessoEm
                                ? `Último acesso: ${formatarDataAcesso(item.ultimoAcessoEm)}`
                                : 'Senha pessoal definida'}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Ações do Card */}
                      {podeEditarUsuarios && (
                        <View style={styles.acoesCardRow}>
                          <TouchableOpacity
                            style={styles.botaoAcaoEditar}
                            onPress={() => handleAbrirEdicao(item)}
                            disabled={estaProcessando}
                          >
                            <Ionicons
                              name="create-outline"
                              size={16}
                              color={CORES.primariaClara}
                            />
                            <Text style={styles.botaoAcaoEditarTexto}>
                              Editar Papel / Dados
                            </Text>
                          </TouchableOpacity>

                          {!ehVoce ? (
                            <>
                              <TouchableOpacity
                                style={styles.botaoAcaoStatus}
                                onPress={() => handleAlternarStatusRapido(item)}
                                disabled={estaProcessando}
                              >
                                {estaProcessando ? (
                                  <ActivityIndicator
                                    size="small"
                                    color={CORES.textoSecundario}
                                  />
                                ) : (
                                  <>
                                    <Ionicons
                                      name={
                                        item.ativo
                                          ? 'pause-circle-outline'
                                          : 'play-circle-outline'
                                      }
                                      size={16}
                                      color={
                                        item.ativo
                                          ? CORES.alertaTexto
                                          : CORES.sucessoTexto
                                      }
                                    />
                                    <Text
                                      style={[
                                        styles.botaoAcaoStatusTexto,
                                        {
                                          color: item.ativo
                                            ? CORES.alertaTexto
                                            : CORES.sucessoTexto,
                                        },
                                      ]}
                                    >
                                      {item.ativo ? 'Desativar' : 'Ativar'}
                                    </Text>
                                  </>
                                )}
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.botaoAcaoDesvincular}
                                onPress={() => handleConfirmarDesvinculacao(item)}
                                disabled={estaProcessando}
                                accessibilityLabel={`Desvincular ${item.nome}`}
                              >
                                <Ionicons
                                  name="trash-outline"
                                  size={16}
                                  color={CORES.perigoTexto}
                                />
                              </TouchableOpacity>
                            </>
                          ) : (
                            <View style={styles.protecaoProprioUsuarioBox}>
                              <Ionicons
                                name="shield-checkmark-outline"
                                size={14}
                                color={CORES.textoMudo}
                              />
                              <Text style={styles.protecaoProprioUsuarioTexto}>
                                Sessão atual protegida
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Rodapé */}
          <View style={styles.rodape}>
            {podeEditarUsuarios && (
              <TouchableOpacity
                style={styles.botaoAdicionarRodape}
                onPress={handleAbrirNovoUsuario}
                activeOpacity={0.85}
              >
                <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
                <Text style={styles.botaoAdicionarRodapeTexto}>
                  Cadastrar Novo Colaborador
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.botaoFecharRodape} onPress={aoFechar}>
              <Text style={styles.botaoFecharRodapeTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Modal de Criação / Edição e Senha Inicial */}
      <ModalFormularioUsuario
        visivel={modalFormularioVisivel}
        usuarioParaEditar={usuarioEmEdicao}
        papeisDisponiveis={papeisOpcoes}
        usuarioLogadoId={usuarioLogado?.id}
        nomeOficina={oficinaAtiva?.nome || usuarioLogado?.empresa}
        aoFechar={() => {
          setModalFormularioVisivel(false);
          setUsuarioEmEdicao(null);
        }}
        aoSalvarSucesso={handleSalvarFormularioSucesso}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  containerModal: {
    backgroundColor: CORES.fundo,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '95%',
    height: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: CORES.superficie,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  headerEsquerda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  headerIconeBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CORES.primaria,
  },
  headerTextos: {
    flex: 1,
  },
  headerTitulo: {
    color: CORES.texto,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 12,
    marginTop: 2,
  },
  headerAcoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  botaoNovoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.primaria,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 5,
  },
  botaoNovoTopoTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  botaoFechar: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: CORES.superficieClara,
  },
  resumoRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  resumoPill: {
    flex: 1,
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  resumoPillSucesso: {
    borderColor: 'rgba(22, 163, 74, 0.4)',
  },
  resumoPillAlerta: {
    borderColor: 'rgba(217, 119, 6, 0.4)',
  },
  resumoValor: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '900',
  },
  resumoLabel: {
    color: CORES.textoMudo,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  filtrosContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  buscaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: CORES.borda,
    gap: 8,
  },
  buscaInput: {
    flex: 1,
    color: CORES.texto,
    fontSize: 14,
    paddingVertical: 10,
  },
  statusTabsRow: {
    flexDirection: 'row',
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 4,
  },
  statusTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 7,
    alignItems: 'center',
  },
  statusTabAtiva: {
    backgroundColor: CORES.primaria,
  },
  statusTabTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '700',
  },
  statusTabTextoAtivo: {
    color: '#FFFFFF',
  },
  papeisChipsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  chipPapelFiltro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CORES.borda,
    gap: 5,
  },
  chipPapelFiltroAtivo: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primariaClara,
  },
  chipPapelFiltroTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '600',
  },
  chipPapelFiltroTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  centroContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  carregandoTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
    marginTop: 6,
  },
  erroTitulo: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '800',
  },
  erroSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  botaoTentarNovamente: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.primaria,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 6,
  },
  botaoTentarNovamenteTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listaScroll: {
    flex: 1,
  },
  listaContent: {
    padding: 16,
    gap: 12,
  },
  vazioBox: {
    backgroundColor: CORES.superficie,
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 8,
    marginTop: 12,
  },
  vazioTitulo: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '800',
  },
  vazioSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  cardColaborador: {
    backgroundColor: CORES.superficie,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 12,
  },
  cardColaboradorInativo: {
    opacity: 0.72,
    borderColor: CORES.borda,
  },
  cardColaboradorVoce: {
    borderColor: CORES.primaria,
  },
  cardTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarCirculo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIniciais: {
    fontSize: 16,
    fontWeight: '900',
  },
  identificacaoCol: {
    flex: 1,
    gap: 2,
  },
  nomeLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  nomeColaborador: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
  },
  badgeVoce: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: CORES.primaria,
  },
  badgeVoceTexto: {
    color: CORES.primariaClara,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emailColaborador: {
    color: CORES.textoSecundario,
    fontSize: 12,
  },
  telefoneLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  telefoneTexto: {
    color: CORES.textoMudo,
    fontSize: 11,
  },
  badgeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 5,
    borderWidth: 1,
  },
  badgeStatusAtivo: {
    backgroundColor: CORES.sucessoFundo,
    borderColor: CORES.sucesso,
  },
  badgeStatusInativo: {
    backgroundColor: CORES.perigoFundo,
    borderColor: CORES.perigo,
  },
  pontoStatus: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeStatusTexto: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgesMeioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgePapel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
  },
  badgePapelTexto: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  badgePrimeiroAcesso: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.alertaFundo,
    borderColor: CORES.alerta,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  badgePrimeiroAcessoTexto: {
    color: CORES.alertaTexto,
    fontSize: 11,
    fontWeight: '700',
  },
  infoUltimoAcesso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoUltimoAcessoTexto: {
    color: CORES.textoMudo,
    fontSize: 11,
  },
  acoesCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    gap: 8,
  },
  botaoAcaoEditar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.fundo,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
    gap: 6,
  },
  botaoAcaoEditarTexto: {
    color: CORES.primariaClara,
    fontSize: 12,
    fontWeight: '700',
  },
  botaoAcaoStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.fundo,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
    gap: 5,
  },
  botaoAcaoStatusTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
  botaoAcaoDesvincular: {
    width: 36,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.perigoFundo,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.perigo,
  },
  protecaoProprioUsuarioBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  protecaoProprioUsuarioTexto: {
    color: CORES.textoMudo,
    fontSize: 11,
    fontWeight: '600',
  },
  rodape: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    backgroundColor: CORES.superficie,
    gap: 8,
  },
  botaoAdicionarRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.primaria,
    paddingVertical: 13,
    borderRadius: 10,
    gap: 8,
  },
  botaoAdicionarRodapeTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  botaoFecharRodape: {
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoFecharRodapeTexto: {
    color: CORES.textoMudo,
    fontSize: 13,
    fontWeight: '600',
  },
});
