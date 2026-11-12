import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { CORES } from '../constants';
import { extrairMensagemErro } from '../api/clienteHttp';
import { ImagemAutenticada } from '../components/ImagemAutenticada';
import { ModalTrocarOficina } from '../components/ModalTrocarOficina';
import { ModalHubCadastros } from '../components/ModalHubCadastros';
import { obterIconeBiometria } from '../utils/biometriaLoginHelper';

export const PerfilScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    usuario,
    oficinaAtiva,
    oficinasDisponiveis,
    trocarOficina,
    logout,
    logoUrl,
    fotoUrl,
    biometriaDisponivel,
    hardwareBiometrico,
    biometriaCadastrada,
    biometriaAtiva,
    tipoBiometria,
    rotuloBiometria,
    ultimoUsuarioBiometria,
    temSenhaEmMemoria,
    ativarBiometria,
  } = useAuth();

  const [trocandoOficina, setTrocandoOficina] = useState<string | null>(null);
  const [modalTrocarOficinaVisivel, setModalTrocarOficinaVisivel] = useState(false);
  const [modalHubCadastrosVisivel, setModalHubCadastrosVisivel] = useState(false);

  // Estados para controle do switch e ativação biométrica
  const [alternandoBiometria, setAlternandoBiometria] = useState(false);
  const [modalSenhaVisivel, setModalSenhaVisivel] = useState(false);
  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [ocultarSenha, setOcultarSenha] = useState(true);
  const [erroSenha, setErroSenha] = useState<string | null>(null);

  const handleTrocarOficina = async (oficinaId: string, nomeOficina: string) => {
    if (oficinaId === oficinaAtiva?.id) return;

    Alert.alert(
      'Mudar de Oficina',
      `Deseja alternar a operação ativa para "${nomeOficina}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Troca',
          onPress: async () => {
            setTrocandoOficina(oficinaId);
            try {
              await trocarOficina(oficinaId);
              Alert.alert('Sucesso', `Ambiente alterado para: ${nomeOficina}`);
            } catch (e) {
              Alert.alert('Não foi possível trocar de oficina', extrairMensagemErro(e));
            } finally {
              setTrocandoOficina(null);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Deseja realmente encerrar a sessão deste dispositivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const handleToggleBiometria = async (novoValor: boolean) => {
    if (!novoValor) {
      // Confirmação para desativar biometria
      Alert.alert(
        'Desativar Biometria',
        `Deseja desativar o acesso por ${rotuloBiometria} neste aparelho?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Desativar',
            style: 'destructive',
            onPress: async () => {
              setAlternandoBiometria(true);
              try {
                await ativarBiometria(false);
                Alert.alert('Biometria Desativada', 'O acesso biométrico foi desativado com sucesso.');
              } catch (e) {
                Alert.alert('Erro', 'Não foi possível desativar a biometria.');
              } finally {
                setAlternandoBiometria(false);
              }
            },
          },
        ]
      );
      return;
    }

    // Caso o usuário queira ativar:
    if (!biometriaCadastrada && hardwareBiometrico) {
      Alert.alert(
        'Biometria Não Cadastrada',
        `O smartphone possui sensor, mas nenhuma impressão digital ou face foi cadastrada no sistema operacional. Cadastre sua biometria nas Configurações do aparelho antes de ativar.`
      );
      return;
    }

    if (temSenhaEmMemoria) {
      // Temos a credencial da sessão em memória -> dispara direto a confirmação biométrica
      setAlternandoBiometria(true);
      try {
        const sucesso = await ativarBiometria(true);
        if (sucesso) {
          Alert.alert('Sucesso', `Login por ${rotuloBiometria} ativado com sucesso!`);
        } else {
          Alert.alert('Não ativado', `A leitura de ${rotuloBiometria} não foi confirmada.`);
        }
      } catch (e) {
        Alert.alert('Erro', 'Ocorreu um erro ao registrar a biometria.');
      } finally {
        setAlternandoBiometria(false);
      }
    } else {
      // Se não temos a senha em memória (ex: sessão persistida de login antigo), pede a senha para salvar no SecureStore
      setSenhaDigitada('');
      setErroSenha(null);
      setModalSenhaVisivel(true);
    }
  };

  const handleConfirmarSenhaParaBiometria = async () => {
    if (!senhaDigitada.trim()) {
      setErroSenha('Digite sua senha para confirmar a ativação.');
      return;
    }

    setAlternandoBiometria(true);
    setErroSenha(null);
    try {
      const sucesso = await ativarBiometria(true, senhaDigitada);
      if (sucesso) {
        setModalSenhaVisivel(false);
        Alert.alert('Sucesso', `Login por ${rotuloBiometria} ativado com sucesso!`);
      } else {
        setErroSenha(`A confirmação de ${rotuloBiometria} falhou ou foi cancelada.`);
      }
    } catch (e) {
      setErroSenha('Não foi possível ativar a biometria.');
    } finally {
      setAlternandoBiometria(false);
    }
  };

  const iconeBiometria = obterIconeBiometria(tipoBiometria);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}>
        {/* Card do Usuário */}
        <View style={styles.cardUsuario}>
          <View style={styles.avatarBox}>
            <ImagemAutenticada
              caminhoRelativo={fotoUrl}
              style={styles.avatarImagem}
              resizeMode="cover"
              fallback={
                <Text style={styles.avatarTexto}>
                  {(usuario?.nome || 'U').substring(0, 2).toUpperCase()}
                </Text>
              }
            />
          </View>

          <View style={styles.usuarioInfo}>
            <Text style={styles.usuarioNome}>{usuario?.nome || 'Usuário'}</Text>
            <Text style={styles.usuarioEmail}>{usuario?.email || 'email@oficina.com'}</Text>

            <View style={styles.badgePapel}>
              <Ionicons name="shield-outline" size={13} color={CORES.primariaClara} />
              <Text style={styles.badgePapelTexto}>
                {usuario?.papelRotulo || usuario?.papel || 'Operador'}
              </Text>
            </View>
          </View>
        </View>

        {/* Ações Rápidas: Trocar Oficina e Sair */}
        <View style={styles.acoesRapidasLinha}>
          <TouchableOpacity
            style={styles.botaoAcaoRapidaOficina}
            onPress={() => setModalTrocarOficinaVisivel(true)}
          >
            <Ionicons name="business" size={18} color={CORES.primariaClara} />
            <Text style={styles.botaoAcaoRapidaOficinaTexto}>Trocar Oficina</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botaoAcaoRapidaSair}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={18} color={CORES.perigoTexto} />
            <Text style={styles.botaoAcaoRapidaSairTexto}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>

                {/* ======================================================== */}
        {/* SEÇÃO CADASTROS RÁPIDOS MOBILE (CLIENTE, VEÍCULO, SERVIÇO) */}
        {/* ======================================================== */}
        <View style={styles.secao}>
          <View style={styles.secaoTituloLinha}>
            <Ionicons name="flash" size={20} color="#F59E0B" />
            <Text style={styles.secaoTitulo}>Cadastros Rápidos</Text>
          </View>

          <TouchableOpacity
            style={styles.cardCadastrosRapidos}
            activeOpacity={0.85}
            onPress={() => setModalHubCadastrosVisivel(true)}
          >
            <View style={styles.cardCadastrosRapidosIconeBox}>
              <Ionicons name="flash-outline" size={26} color="#F59E0B" />
            </View>
            <View style={styles.cardCadastrosRapidosTextos}>
              <View style={styles.cardCadastrosRapidosTituloLinha}>
                <Text style={styles.cardCadastrosRapidosTitulo}>Central de Cadastros Rápidos</Text>
                <View style={styles.tagNovo}>
                  <Text style={styles.tagNovoTexto}>Ágil</Text>
                </View>
              </View>
              <Text style={styles.cardCadastrosRapidosSubtitulo}>
                Cadastre clientes, veículos com placa Mercosul e serviços de mão de obra em menos de 30 segundos.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={CORES.textoMudo} />
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* SEÇÃO SEGURANÇA & ACESSO (LOGIN POR BIOMETRIA)           */}
        {/* ======================================================== */}
        <View style={styles.secao}>
          <View style={styles.secaoTituloLinha}>
            <Ionicons name="shield-checkmark-outline" size={20} color={CORES.primariaClara} />
            <Text style={styles.secaoTitulo}>Segurança & Acesso</Text>
          </View>

          {!hardwareBiometrico && !biometriaDisponivel ? (
            <View style={styles.biometriaNaoDisponivelBox}>
              <Ionicons name="information-circle-outline" size={18} color={CORES.textoMudo} />
              <Text style={styles.biometriaNaoDisponivelTexto}>
                Sensor biométrico não suportado neste aparelho.
              </Text>
            </View>
          ) : (
            <View style={styles.itemBiometriaConfig}>
              <View style={styles.iconeBiometriaConfigBox}>
                <Ionicons name={iconeBiometria} size={24} color={CORES.primariaClara} />
              </View>

              <View style={styles.infoBiometriaConfig}>
                <Text style={styles.tituloBiometriaConfig}>
                  Login por {rotuloBiometria}
                </Text>
                <Text style={styles.subtituloBiometriaConfig}>
                  {biometriaAtiva
                    ? `Ativo para ${ultimoUsuarioBiometria?.email || usuario?.email}`
                    : !biometriaCadastrada
                    ? 'Biometria não cadastrada no SO'
                    : `Acessar o aplicativo usando ${rotuloBiometria}`}
                </Text>
              </View>

              {alternandoBiometria ? (
                <ActivityIndicator size="small" color={CORES.primariaClara} />
              ) : (
                <Switch
                  value={biometriaAtiva}
                  onValueChange={handleToggleBiometria}
                  trackColor={{ false: CORES.borda, true: CORES.primaria }}
                  thumbColor={biometriaAtiva ? '#FFFFFF' : '#CBD5E1'}
                />
              )}
            </View>
          )}
        </View>

        {/* Seção Mudar de Oficina (Multi-Tenant nativo) */}
        <View style={styles.secao}>
          <View style={styles.secaoTituloLinha}>
            <Ionicons name="business-outline" size={20} color={CORES.primariaClara} />
            <Text style={styles.secaoTitulo}>Oficina Ativa & Multi-Tenant</Text>
          </View>

          {/* Oficina Ativa Atual */}
          <View style={styles.oficinaAtivaCard}>
            <View style={styles.oficinaAtivaCabecalhoLinha}>
              <ImagemAutenticada
                caminhoRelativo={logoUrl}
                style={styles.oficinaLogoCard}
                resizeMode="contain"
                fallback={
                  <View style={styles.oficinaIconeCard}>
                    <Ionicons name="business" size={24} color={CORES.primariaClara} />
                  </View>
                }
              />
              <View style={styles.oficinaAtivaDados}>
                <View style={styles.oficinaAtivaTopo}>
                  <View style={styles.pontoAtivo} />
                  <Text style={styles.oficinaAtivaTag}>OFICINA EM OPERAÇÃO</Text>
                </View>
                <Text style={styles.oficinaAtivaNome}>
                  {oficinaAtiva?.nome || usuario?.empresa || 'Oficina Principal'}
                </Text>
                <Text style={styles.oficinaAtivaId}>
                  Tenant ID: {oficinaAtiva?.id || usuario?.tenantId || '---'}
                </Text>
              </View>
            </View>
          </View>

          {/* Botão de Destaque para Trocar Oficina */}
          <TouchableOpacity
            style={styles.botaoAbrirModalTroca}
            onPress={() => setModalTrocarOficinaVisivel(true)}
          >
            <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" />
            <Text style={styles.botaoAbrirModalTrocaTexto}>
              {oficinasDisponiveis.length > 1
                ? `Selecionar Outra Oficina (${oficinasDisponiveis.length} disponíveis)`
                : 'Gerenciar / Trocar de Oficina'}
            </Text>
          </TouchableOpacity>

          {/* Lista de Outras Oficinas Permitidas */}
          {oficinasDisponiveis.length > 1 ? (
            <View style={styles.outrasOficinasBox}>
              <Text style={styles.subtituloSecao}>
                Você tem permissão para operar em outras oficinas:
              </Text>

              {oficinasDisponiveis.map((of) => {
                const isAtiva = of.id === oficinaAtiva?.id;
                const estaTrocandoEsta = trocandoOficina === of.id;

                return (
                  <TouchableOpacity
                    key={of.id}
                    style={[
                      styles.itemOficinaAlternar,
                      isAtiva && styles.itemOficinaAlternarAtiva,
                    ]}
                    onPress={() => handleTrocarOficina(of.id, of.nome)}
                    disabled={isAtiva || !!trocandoOficina}
                  >
                    <View style={styles.itemOficinaInfo}>
                      <Text
                        style={[
                          styles.itemOficinaNome,
                          isAtiva && { color: CORES.primariaClara },
                        ]}
                      >
                        {of.nome}
                      </Text>
                      <Text style={styles.itemOficinaStatus}>
                        {isAtiva ? 'Oficina conectada no momento' : 'Toque para alternar para esta oficina'}
                      </Text>
                    </View>

                    {estaTrocandoEsta ? (
                      <ActivityIndicator size="small" color={CORES.primaria} />
                    ) : isAtiva ? (
                      <Ionicons name="checkmark-circle" size={22} color={CORES.sucesso} />
                    ) : (
                      <Ionicons name="swap-horizontal" size={20} color={CORES.textoSecundario} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.infoOficinaUnica}>
              <Ionicons name="information-circle-outline" size={16} color={CORES.textoMudo} />
              <Text style={styles.infoOficinaUnicaTexto}>
                Seu usuário está vinculado a 1 oficina. Para suporte a multi-oficinas, solicite vinculação ao gestor da rede.
              </Text>
            </View>
          )}
        </View>

        {/* Botão de Logout */}
        <TouchableOpacity style={styles.botaoLogout} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={CORES.perigoTexto} />
          <Text style={styles.botaoLogoutTexto}>Encerrar Sessão</Text>
        </TouchableOpacity>

        {/* Informações de Versão */}
        <Text style={styles.versaoTexto}>
          AutoF Sistema de Gestão Mobile v1.1.4 (Build Produção)
        </Text>
      </ScrollView>

      {/* Modal para digitar a senha caso a biometria seja ativada sem senha em memória */}
      <Modal
        visible={modalSenhaVisivel}
        transparent
        animationType="fade"
        onRequestClose={() => setModalSenhaVisivel(false)}
      >
        <View style={styles.fundoModal}>
          <View style={styles.cardModalSenha}>
            <View style={styles.modalSenhaIconeBox}>
              <Ionicons name={iconeBiometria} size={32} color={CORES.primariaClara} />
            </View>

            <Text style={styles.modalSenhaTitulo}>
              Confirmar Ativação
            </Text>

            <Text style={styles.modalSenhaDescricao}>
              Para habilitar o login por {rotuloBiometria}, confirme sua senha atual de acesso:
            </Text>

            {erroSenha && (
              <View style={styles.modalErroBox}>
                <Ionicons name="alert-circle" size={18} color={CORES.perigoTexto} />
                <Text style={styles.modalErroTexto}>{erroSenha}</Text>
              </View>
            )}

            <View style={styles.inputLinha}>
              <Ionicons name="lock-closed-outline" size={20} color={CORES.textoMudo} style={styles.inputIcone} />
              <TextInput
                style={styles.input}
                placeholder="Sua senha atual"
                placeholderTextColor={CORES.textoMudo}
                value={senhaDigitada}
                onChangeText={setSenhaDigitada}
                secureTextEntry={ocultarSenha}
              />
              <TouchableOpacity
                onPress={() => setOcultarSenha(!ocultarSenha)}
                style={styles.botaoOlho}
              >
                <Ionicons
                  name={ocultarSenha ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={CORES.textoMudo}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBotoesLinha}>
              <TouchableOpacity
                style={styles.botaoModalCancelar}
                onPress={() => setModalSenhaVisivel(false)}
                disabled={alternandoBiometria}
              >
                <Text style={styles.botaoModalCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoModalConfirmar}
                onPress={handleConfirmarSenhaParaBiometria}
                disabled={alternandoBiometria}
              >
                {alternandoBiometria ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.botaoModalConfirmarTexto}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Trocar Oficina */}
      <ModalTrocarOficina
        visivel={modalTrocarOficinaVisivel}
        aoFechar={() => setModalTrocarOficinaVisivel(false)}
      />

      {/* Modal Central de Cadastros Rápidos */}
      <ModalHubCadastros
        visivel={modalHubCadastrosVisivel}
        aoFechar={() => setModalHubCadastrosVisivel(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
    cardCadastrosRapidos: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    gap: 14,
  },
  cardCadastrosRapidosIconeBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCadastrosRapidosTextos: {
    flex: 1,
  },
  cardCadastrosRapidosTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardCadastrosRapidosTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: CORES.texto,
  },
  tagNovo: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagNovoTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
  },
  cardCadastrosRapidosSubtitulo: {
    fontSize: 12,
    color: CORES.textoSecundario,
    lineHeight: 16,
  },
  cardUsuario: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 14,
  },
  acoesRapidasLinha: {
    flexDirection: 'row',
    gap: 12,
  },
  botaoAcaoRapidaOficina: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.4)',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  botaoAcaoRapidaOficinaTexto: {
    color: CORES.primariaClara,
    fontSize: 14,
    fontWeight: '700',
  },
  botaoAcaoRapidaSair: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.4)',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  botaoAcaoRapidaSairTexto: {
    color: CORES.perigoTexto,
    fontSize: 14,
    fontWeight: '700',
  },
  botaoAbrirModalTroca: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.primaria,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
    gap: 8,
  },
  botaoAbrirModalTrocaTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  avatarBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: CORES.primaria,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImagem: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarTexto: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  usuarioInfo: {
    flex: 1,
    gap: 3,
  },
  usuarioNome: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
  },
  usuarioEmail: {
    color: CORES.textoSecundario,
    fontSize: 13,
  },
  badgePapel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 4,
  },
  badgePapelTexto: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  secao: {
    backgroundColor: CORES.superficie,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 12,
  },
  secaoTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secaoTitulo: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '800',
  },
  itemBiometriaConfig: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: CORES.borda,
    gap: 12,
  },
  iconeBiometriaConfigBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBiometriaConfig: {
    flex: 1,
  },
  tituloBiometriaConfig: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
  },
  subtituloBiometriaConfig: {
    color: CORES.textoSecundario,
    fontSize: 12,
    marginTop: 2,
  },
  biometriaNaoDisponivelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 10,
  },
  biometriaNaoDisponivelTexto: {
    color: CORES.textoMudo,
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  oficinaAtivaCard: {
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  oficinaAtivaCabecalhoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  oficinaLogoCard: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  oficinaIconeCard: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  oficinaAtivaDados: {
    flex: 1,
  },
  oficinaAtivaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pontoAtivo: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  oficinaAtivaTag: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  oficinaAtivaNome: {
    color: CORES.texto,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  oficinaAtivaId: {
    color: CORES.textoMudo,
    fontSize: 11,
  },
  outrasOficinasBox: {
    gap: 8,
    marginTop: 4,
  },
  subtituloSecao: {
    color: CORES.textoSecundario,
    fontSize: 13,
    marginBottom: 4,
  },
  itemOficinaAlternar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CORES.superficieClara,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  itemOficinaAlternarAtiva: {
    borderColor: CORES.primaria,
    backgroundColor: '#1E3A8A',
  },
  itemOficinaInfo: {
    flex: 1,
  },
  itemOficinaNome: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
  },
  itemOficinaStatus: {
    color: CORES.textoMudo,
    fontSize: 11,
    marginTop: 2,
  },
  infoOficinaUnica: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  infoOficinaUnicaTexto: {
    color: CORES.textoMudo,
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  botaoLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.perigoFundo,
    borderWidth: 1,
    borderColor: CORES.perigo,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  botaoLogoutTexto: {
    color: CORES.perigoTexto,
    fontSize: 15,
    fontWeight: '700',
  },
  versaoTexto: {
    color: CORES.textoMudo,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardModalSenha: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: CORES.superficie,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  modalSenhaIconeBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalSenhaTitulo: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSenhaDescricao: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  modalErroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.perigoFundo,
    borderWidth: 1,
    borderColor: CORES.perigo,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  modalErroTexto: {
    color: CORES.perigoTexto,
    fontSize: 12,
    flex: 1,
  },
  inputLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  inputIcone: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    color: CORES.texto,
    fontSize: 15,
  },
  botaoOlho: {
    padding: 6,
  },
  modalBotoesLinha: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  botaoModalCancelar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoModalCancelarTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
  },
  botaoModalConfirmar: {
    flex: 1,
    backgroundColor: CORES.primaria,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoModalConfirmarTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
