import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { CORES } from '../constants';
import { ModalCadastroOficina } from '../components/ModalCadastroOficina';
import { AutoFLogo } from '../components/AutoFLogo';
import { obterIconeBiometria } from '../utils/biometriaLoginHelper';

export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    login,
    loginComBiometria,
    ativarBiometria,
    biometriaDisponivel,
    hardwareBiometrico,
    biometriaCadastrada,
    biometriaAtiva,
    tipoBiometria,
    rotuloBiometria,
    ultimoUsuarioBiometria,
    oficinasDisponiveis,
    precisaEscolherOficina,
    selecionarOficinaNoLogin,
    cancelarEscolhaOficina,
    servidorUrl,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ocultarSenha, setOcultarSenha] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [modalCadastroVisivel, setModalCadastroVisivel] = useState(false);

  // Controle de modo: Biométrico (Card de Boas-Vindas) ou Senha Manual
  const [modoBiometrico, setModoBiometrico] = useState<boolean>(false);
  const executandoBiometriaRef = useRef(false);

  // Ao montar a tela ou quando biometriaAtiva atualizar, define o modo padrão
  useEffect(() => {
    if (biometriaAtiva && ultimoUsuarioBiometria) {
      setModoBiometrico(true);
      setEmail(ultimoUsuarioBiometria.email);
    } else {
      setModoBiometrico(false);
    }
  }, [biometriaAtiva, ultimoUsuarioBiometria]);

  // Ação de Login com Biometria (com trava para evitar disparos duplicados)
  const handleLoginBiometria = async () => {
    if (executandoBiometriaRef.current) return;
    executandoBiometriaRef.current = true;
    setCarregando(true);
    setMensagemErro(null);

    try {
      const resultado = await loginComBiometria();
      if (!resultado.sucesso) {
        setMensagemErro(
          resultado.mensagem || 'Falha na autenticação biométrica. Tente novamente ou entre com sua senha.'
        );
      }
    } finally {
      setCarregando(false);
      executandoBiometriaRef.current = false;
    }
  };

  // Ação de Login Tradicional com E-mail e Senha
  const handleLogin = async () => {
    if (!email.trim() || !senha) {
      Alert.alert('Campos obrigatórios', 'Por favor, informe seu e-mail e senha.');
      return;
    }

    setCarregando(true);
    setMensagemErro(null);

    const resultado = await login(email, senha);
    setCarregando(false);

    if (!resultado.sucesso && !resultado.precisaEscolherOficina) {
      setMensagemErro(
        resultado.mensagem || 'Falha ao autenticar. Verifique o servidor e suas credenciais.'
      );
    }
  };

  const handleSelecionarOficina = async (oficinaId: string) => {
    setCarregando(true);
    setMensagemErro(null);

    const resultado = await selecionarOficinaNoLogin(oficinaId);
    setCarregando(false);

    if (!resultado.sucesso) {
      setMensagemErro(resultado.mensagem || 'Não foi possível acessar a oficina selecionada.');
    }
  };

  const iconeBiometria = obterIconeBiometria(tipoBiometria);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Topo / Logo Oficial AutoF */}
          <View style={styles.logoSecao}>
            <AutoFLogo tamanho="grande" mostrarSubtitulo orientacao="vertical" />
          </View>

          {/* ======================================================== */}
          {/* MODO BIOMÉTRICO (CARD DE BOAS-VINDAS)                     */}
          {/* ======================================================== */}
          {modoBiometrico && ultimoUsuarioBiometria ? (
            <View style={styles.cardFormulario}>
              <View style={styles.biometriaHeader}>
                <View style={styles.biometriaAvatarCirculo}>
                  <Ionicons name={iconeBiometria} size={42} color={CORES.primariaClara} />
                </View>

                <Text style={styles.biometriaSaudacao}>
                  Olá, {ultimoUsuarioBiometria.nome}!
                </Text>

                <View style={styles.badgeEmail}>
                  <Ionicons name="mail-outline" size={13} color={CORES.textoSecundario} />
                  <Text style={styles.badgeEmailTexto} numberOfLines={1}>
                    {ultimoUsuarioBiometria.email}
                  </Text>
                </View>

                <Text style={styles.biometriaDescricao}>
                  Acesse com {rotuloBiometria} com apenas um toque no sensor.
                </Text>
              </View>

              {/* Mensagem de Erro / Falha de leitura */}
              {mensagemErro && (
                <View style={styles.erroBox}>
                  <Ionicons name="alert-circle" size={20} color={CORES.perigoTexto} />
                  <Text style={styles.erroTexto}>{mensagemErro}</Text>
                </View>
              )}

              {/* Botão em destaque com ícone de biometria */}
              <TouchableOpacity
                style={styles.botaoBiometriaDestaque}
                onPress={handleLoginBiometria}
                disabled={carregando}
                activeOpacity={0.8}
              >
                {carregando ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name={iconeBiometria} size={24} color="#FFFFFF" />
                    <Text style={styles.botaoBiometriaDestaqueTexto}>
                      Entrar com {rotuloBiometria}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Botão Secundário: Entrar com senha / Outra conta */}
              <TouchableOpacity
                style={styles.botaoAlternarSenha}
                onPress={() => {
                  setModoBiometrico(false);
                  setMensagemErro(null);
                  if (ultimoUsuarioBiometria?.email) {
                    setEmail(ultimoUsuarioBiometria.email);
                  }
                }}
                disabled={carregando}
                activeOpacity={0.7}
              >
                <Ionicons name="key-outline" size={18} color={CORES.textoSecundario} />
                <Text style={styles.botaoAlternarSenhaTexto}>
                  Entrar com senha / Outra conta
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ======================================================== */
            /* MODO MANUAL (E-MAIL E SENHA TRADICIONAIS)                */
            /* ======================================================== */
            <View style={styles.cardFormulario}>
              <View style={styles.cardTituloLinha}>
                <Text style={styles.cardTitulo}>Entrar na sua conta</Text>
                {biometriaAtiva && ultimoUsuarioBiometria && (
                  <TouchableOpacity
                    style={styles.badgeVoltarBiometria}
                    onPress={() => {
                      setModoBiometrico(true);
                      setMensagemErro(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={iconeBiometria} size={16} color={CORES.primariaClara} />
                    <Text style={styles.badgeVoltarBiometriaTexto}>
                      Usar {rotuloBiometria}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Mensagem de Erro */}
              {mensagemErro && (
                <View style={styles.erroBox}>
                  <Ionicons name="alert-circle" size={20} color={CORES.perigoTexto} />
                  <Text style={styles.erroTexto}>{mensagemErro}</Text>
                </View>
              )}

              {/* Campo E-mail */}
              <Text style={styles.label}>E-mail de Acesso</Text>
              <View style={styles.inputLinha}>
                <Ionicons name="mail-outline" size={20} color={CORES.textoMudo} style={styles.inputIcone} />
                <TextInput
                  style={styles.input}
                  placeholder="seu.email@oficina.com.br"
                  placeholderTextColor={CORES.textoMudo}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Campo Senha */}
              <Text style={styles.label}>Senha</Text>
              <View style={styles.inputLinha}>
                <Ionicons name="lock-closed-outline" size={20} color={CORES.textoMudo} style={styles.inputIcone} />
                <TextInput
                  style={styles.input}
                  placeholder="Digite sua senha"
                  placeholderTextColor={CORES.textoMudo}
                  value={senha}
                  onChangeText={setSenha}
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

              {/* Botão de Entrar com Senha */}
              <TouchableOpacity
                style={styles.botaoEntrar}
                onPress={handleLogin}
                disabled={carregando}
              >
                {carregando ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.botaoEntrarTexto}>Acessar</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>

              {/* Botão Visível de Entrar com Biometria */}
              <TouchableOpacity
                style={styles.botaoBiometriaNaFormulario}
                onPress={() => {
                  if (biometriaAtiva && ultimoUsuarioBiometria) {
                    setModoBiometrico(true);
                    handleLoginBiometria();
                  } else if (!hardwareBiometrico) {
                    Alert.alert(
                      'Biometria Indisponível',
                      'Este aparelho não possui hardware biométrico (sensor de digital ou Face ID) compatível.'
                    );
                  } else if (!biometriaCadastrada) {
                    Alert.alert(
                      'Biometria Não Cadastrada',
                      'O sensor biométrico foi detectado, mas você ainda não cadastrou nenhuma digital ou rosto no celular. Cadastre sua biometria nas configurações do aparelho.'
                    );
                  } else {
                    Alert.alert(
                      `Como ativar o login por ${rotuloBiometria}`,
                      `Para usar a biometria, faça o primeiro acesso com seu e-mail e senha acima e toque em "Acessar". O aplicativo exibirá um convite para ativar o acesso por ${rotuloBiometria} em seguida!`,
                      [{ text: 'Entendido' }]
                    );
                  }
                }}
                disabled={carregando}
                activeOpacity={0.8}
              >
                <Ionicons name={iconeBiometria} size={22} color={CORES.primariaClara} />
                <Text style={styles.botaoBiometriaNaFormularioTexto}>
                  {biometriaAtiva && ultimoUsuarioBiometria
                    ? `Entrar com ${rotuloBiometria} (${ultimoUsuarioBiometria.nome})`
                    : `Entrar com ${rotuloBiometria}`}
                </Text>
              </TouchableOpacity>

              {/* Divisor */}
              <View style={styles.divisorContainer}>
                <View style={styles.divisorLinha} />
                <Text style={styles.divisorTexto}>ou</Text>
                <View style={styles.divisorLinha} />
              </View>

              {/* Botão de Solicitação de Cadastro da Oficina */}
              <TouchableOpacity
                style={styles.botaoCadastro}
                onPress={() => setModalCadastroVisivel(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="business-outline" size={19} color={CORES.sucessoTexto} />
                <Text style={styles.botaoCadastroTexto}>Cadastrar Oficina</Text>
              </TouchableOpacity>

              <Text style={styles.cadastroAjudaTexto}>
                Ainda não tem conta? Solicite a liberação da sua oficina.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de Escolha de Oficina (Multi-Tenant nativo) */}
      <Modal
        visible={precisaEscolherOficina}
        animationType="slide"
        transparent
        onRequestClose={cancelarEscolhaOficina}
      >
        <View style={styles.fundoModal}>
          <View style={styles.cardEscolhaOficina}>
            <View style={styles.headerOficina}>
              <View style={styles.iconePredio}>
                <Ionicons name="business" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.tituloEscolhaOficina}>Selecione a Oficina</Text>
              <Text style={styles.subtituloEscolhaOficina}>
                Sua conta possui acesso a múltiplas filiais. Selecione onde irá operar agora:
              </Text>
            </View>

            <ScrollView style={styles.listaOficinasModal}>
              {oficinasDisponiveis.map((oficina) => (
                <TouchableOpacity
                  key={oficina.id}
                  style={styles.itemOficinaCard}
                  onPress={() => handleSelecionarOficina(oficina.id)}
                  disabled={carregando}
                >
                  <View style={styles.infoOficina}>
                    <Text style={styles.nomeOficina}>{oficina.nome}</Text>
                    <Text style={styles.idOficina}>ID: {oficina.id.substring(0, 8)}...</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={CORES.primariaClara} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            {carregando && (
              <View style={styles.carregandoOficina}>
                <ActivityIndicator size="small" color={CORES.primariaClara} />
                <Text style={styles.carregandoOficinaTexto}>Carregando ambiente da oficina...</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.botaoCancelarEscolhaOficina}
              onPress={cancelarEscolhaOficina}
              disabled={carregando}
              activeOpacity={0.8}
            >
              <Text style={styles.botaoCancelarEscolhaOficinaTexto}>Cancelar e Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Cadastro de Nova Oficina */}
      <ModalCadastroOficina
        visivel={modalCadastroVisivel}
        aoFechar={() => setModalCadastroVisivel(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoSecao: {
    alignItems: 'center',
    marginBottom: 32,
  },
  cardFormulario: {
    backgroundColor: CORES.superficie,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  cardTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  cardTitulo: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '700',
  },
  badgeVoltarBiometria: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  badgeVoltarBiometriaTexto: {
    color: CORES.primariaClara,
    fontSize: 12,
    fontWeight: '700',
  },
  biometriaHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  biometriaAvatarCirculo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(37, 99, 235, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  biometriaSaudacao: {
    color: CORES.texto,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  badgeEmail: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficieClara,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
    gap: 6,
  },
  badgeEmailTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '600',
  },
  biometriaDescricao: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  botaoBiometriaDestaque: {
    backgroundColor: CORES.primaria,
    borderRadius: 12,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
    shadowColor: CORES.primaria,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  botaoBiometriaDestaqueTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  botaoAlternarSenha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    backgroundColor: 'transparent',
    marginTop: 12,
    gap: 8,
  },
  botaoAlternarSenhaTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
  },
  erroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.perigoFundo,
    borderWidth: 1,
    borderColor: CORES.perigo,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  erroTexto: {
    color: CORES.perigoTexto,
    fontSize: 13,
    flex: 1,
  },
  label: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
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
  botaoEntrar: {
    backgroundColor: CORES.primaria,
    borderRadius: 10,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    shadowColor: CORES.primaria,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  botaoEntrarTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  botaoBiometriaNaFormulario: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.35)',
    borderRadius: 10,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  botaoBiometriaNaFormularioTexto: {
    color: CORES.primariaClara,
    fontSize: 15,
    fontWeight: '700',
  },
  divisorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  divisorLinha: {
    flex: 1,
    height: 1,
    backgroundColor: CORES.bordaSuave,
  },
  divisorTexto: {
    color: CORES.textoMudo,
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 12,
    textTransform: 'uppercase',
  },
  botaoCadastro: {
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.4)',
    borderRadius: 10,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botaoCadastroTexto: {
    color: CORES.sucessoTexto,
    fontSize: 15,
    fontWeight: '700',
  },
  cadastroAjudaTexto: {
    color: CORES.textoMudo,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
  },
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardConviteBiometria: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: CORES.superficie,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  iconeConviteBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(37, 99, 235, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  tituloConvite: {
    color: CORES.texto,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtituloConvite: {
    color: CORES.textoSecundario,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  botaoAtivarConvite: {
    width: '100%',
    backgroundColor: CORES.primaria,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botaoAtivarConviteTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  botaoRecusarConvite: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  botaoRecusarConviteTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
  },
  cardEscolhaOficina: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: CORES.superficie,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    maxHeight: '80%',
  },
  headerOficina: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconePredio: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: CORES.primaria,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  tituloEscolhaOficina: {
    color: CORES.texto,
    fontSize: 20,
    fontWeight: '800',
  },
  subtituloEscolhaOficina: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  listaOficinasModal: {
    maxHeight: 280,
  },
  itemOficinaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CORES.superficieClara,
    borderWidth: 1,
    borderColor: CORES.borda,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  infoOficina: {
    flex: 1,
  },
  nomeOficina: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '700',
  },
  idOficina: {
    color: CORES.textoMudo,
    fontSize: 12,
    marginTop: 4,
  },
  carregandoOficina: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  carregandoOficinaTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
  },
  botaoCancelarEscolhaOficina: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: CORES.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoCancelarEscolhaOficinaTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
    fontWeight: '700',
  },
});
