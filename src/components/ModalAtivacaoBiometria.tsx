import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { CORES } from '../constants';
import { obterIconeBiometria } from '../utils/biometriaLoginHelper';

interface ModalAtivacaoBiometriaProps {
  visivel: boolean;
  aoFechar: () => void;
}

export const ModalAtivacaoBiometria: React.FC<ModalAtivacaoBiometriaProps> = ({
  visivel,
  aoFechar,
}) => {
  const {
    usuario,
    rotuloBiometria,
    tipoBiometria,
    ativarBiometria,
    dispensarBiometria,
    temSenhaEmMemoria,
    biometriaCadastrada,
  } = useAuth();

  const [carregando, setCarregando] = useState(false);
  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [ocultarSenha, setOcultarSenha] = useState(true);
  const [precisaDigitarSenha, setPrecisaDigitarSenha] = useState(!temSenhaEmMemoria);
  const [erro, setErro] = useState<string | null>(null);

  const icone = obterIconeBiometria(tipoBiometria);

  const handleAtivar = async () => {
    if (!biometriaCadastrada) {
      Alert.alert(
        'Biometria no Aparelho',
        `Nenhuma ${rotuloBiometria} foi cadastrada no seu smartphone. Cadastre uma biometria nas configurações do celular para poder ativá-la no app.`
      );
      aoFechar();
      return;
    }

    // Se não tem senha em memória e não exibiu o campo de senha ainda, solicita a senha
    if (!temSenhaEmMemoria && !precisaDigitarSenha) {
      setPrecisaDigitarSenha(true);
      return;
    }

    if (precisaDigitarSenha && !senhaDigitada.trim()) {
      setErro('Por favor, digite sua senha de acesso.');
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      const senhaParaUsar = precisaDigitarSenha ? senhaDigitada : undefined;
      const sucesso = await ativarBiometria(true, senhaParaUsar);

      if (sucesso) {
        aoFechar();
        Alert.alert(
          'Biometria Ativada!',
          `Pronto! Nas próximas vezes, você poderá entrar no aplicativo usando sua ${rotuloBiometria}.`,
          [{ text: 'Excelente!' }]
        );
      } else {
        setErro(`A leitura da sua ${rotuloBiometria} não foi confirmada. Tente novamente.`);
      }
    } catch (e) {
      setErro('Não foi possível ativar a biometria.');
    } finally {
      setCarregando(false);
    }
  };

  const handleRecusar = async () => {
    setErro(null);
    setSenhaDigitada('');
    try {
      await dispensarBiometria();
    } catch (e) {
      // ignora
    } finally {
      aoFechar();
    }
  };

  const primeiroNome = usuario?.nome?.split(' ')[0] || 'Colaborador';

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={handleRecusar}
    >
      <View style={styles.fundoModal}>
        <View style={styles.cardModal}>
          {/* Ícone com Destaque Circular */}
          <View style={styles.iconeCirculo}>
            <Ionicons name={icone} size={42} color={CORES.primariaClara} />
          </View>

          {/* Título e Boas-Vindas */}
          <Text style={styles.titulo}>Ativar Login por {rotuloBiometria}?</Text>
          <Text style={styles.subtitulo}>
            Olá, <Text style={styles.nomeDestaque}>{primeiroNome}</Text>! Acesse sua oficina com muito mais rapidez e segurança usando sua {rotuloBiometria} nas próximas vezes.
          </Text>

          {/* Mensagem de Erro */}
          {erro && (
            <View style={styles.erroBox}>
              <Ionicons name="alert-circle" size={18} color={CORES.perigoTexto} />
              <Text style={styles.erroTexto}>{erro}</Text>
            </View>
          )}

          {/* Campo de Senha (caso necessário confirmar) */}
          {precisaDigitarSenha && (
            <View style={styles.campoSenhaContainer}>
              <Text style={styles.labelSenha}>Confirme sua senha atual:</Text>
              <View style={styles.inputLinha}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={CORES.textoMudo}
                  style={styles.inputIcone}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Sua senha"
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
                    size={18}
                    color={CORES.textoMudo}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Botão de Confirmação em Destaque */}
          <TouchableOpacity
            style={styles.botaoAtivar}
            onPress={handleAtivar}
            disabled={carregando}
            activeOpacity={0.8}
          >
            {carregando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name={icone} size={22} color="#FFFFFF" />
                <Text style={styles.botaoAtivarTexto}>
                  Ativar {rotuloBiometria}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Botão de Lembrar Depois */}
          <TouchableOpacity
            style={styles.botaoAgoraNao}
            onPress={handleRecusar}
            disabled={carregando}
            activeOpacity={0.7}
          >
            <Text style={styles.botaoAgoraNaoTexto}>Agora Não / Lembrar Depois</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardModal: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: CORES.superficie,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.35)',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  iconeCirculo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(37, 99, 235, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  titulo: {
    color: CORES.texto,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitulo: {
    color: CORES.textoSecundario,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  nomeDestaque: {
    color: CORES.primariaClara,
    fontWeight: '700',
  },
  erroBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.perigoFundo,
    borderWidth: 1,
    borderColor: CORES.perigo,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  erroTexto: {
    color: CORES.perigoTexto,
    fontSize: 13,
    flex: 1,
  },
  campoSenhaContainer: {
    width: '100%',
    marginBottom: 16,
  },
  labelSenha: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 12,
  },
  inputIcone: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 46,
    color: CORES.texto,
    fontSize: 15,
  },
  botaoOlho: {
    padding: 6,
  },
  botaoAtivar: {
    width: '100%',
    backgroundColor: CORES.primaria,
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: CORES.primaria,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  botaoAtivarTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  botaoAgoraNao: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  botaoAgoraNaoTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
  },
});
