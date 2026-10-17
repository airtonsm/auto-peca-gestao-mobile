import React, { useState } from 'react';
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
import { ConfiguradorServidorModal } from '../components/ConfiguradorServidorModal';
import { AutoFLogo } from '../components/AutoFLogo';

export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    login,
    oficinasDisponiveis,
    precisaEscolherOficina,
    selecionarOficinaNoLogin,
    servidorUrl,
  } = useAuth();

  const [email, setEmail] = useState('airton@aftecnologia.com.br');
  const [senha, setSenha] = useState('oficina@2026');
  const [ocultarSenha, setOcultarSenha] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [modalServidorVisivel, setModalServidorVisivel] = useState(false);

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

          {/* Card do Formulário */}
          <View style={styles.cardFormulario}>
            <Text style={styles.cardTitulo}>Entrar na sua conta</Text>

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

            {/* Botão de Entrar */}
            <TouchableOpacity
              style={styles.botaoEntrar}
              onPress={handleLogin}
              disabled={carregando}
            >
              {carregando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.botaoEntrarTexto}>Acessar Pátio & Estoque</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            {/* Dica para Testes Locais */}
            <View style={styles.dicaBox}>
              <Ionicons name="information-circle-outline" size={16} color={CORES.textoMudo} />
              <Text style={styles.dicaTexto}>
                Conta de teste semeada:{'\n'}
                <Text style={{ fontWeight: '700' }}>airton@aftecnologia.com.br</Text> (2 oficinas)
              </Text>
            </View>
          </View>

          {/* Rodapé com Seletor de Servidor */}
          <TouchableOpacity
            style={styles.servidorRodape}
            onPress={() => setModalServidorVisivel(true)}
          >
            <Ionicons name="server-outline" size={16} color={CORES.textoSecundario} />
            <Text style={styles.servidorRodapeTexto} numberOfLines={1}>
              API: {servidorUrl}
            </Text>
            <Ionicons name="pencil-sharp" size={14} color={CORES.primariaClara} />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de Escolha de Oficina (Multi-Tenant nativo) */}
      <Modal
        visible={precisaEscolherOficina}
        animationType="slide"
        transparent
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
          </View>
        </View>
      </Modal>

      {/* Modal de Configuração de IP/Servidor */}
      <ConfiguradorServidorModal
        visivel={modalServidorVisivel}
        aoFechar={() => setModalServidorVisivel(false)}
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
  iconeLogoBox: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: CORES.primaria,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: CORES.primaria,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  appTitulo: {
    color: CORES.texto,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  appSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 14,
    marginTop: 4,
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
  cardTitulo: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
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
  dicaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficieClara,
    borderRadius: 8,
    padding: 10,
    marginTop: 20,
    gap: 8,
  },
  dicaTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  servidorRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    padding: 10,
    borderRadius: 8,
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 8,
  },
  servidorRodapeTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    maxWidth: '80%',
  },
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
});
