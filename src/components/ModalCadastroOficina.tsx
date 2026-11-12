import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CORES } from '../constants';
import { authApi } from '../api/authApi';

interface ModalCadastroOficinaProps {
  visivel: boolean;
  aoFechar: () => void;
}

const WHATSAPP_COMERCIAL = '5561998970848';
const EMAIL_COMERCIAL = 'comercial@aftecnologias.com.br';

export const ModalCadastroOficina: React.FC<ModalCadastroOficinaProps> = ({
  visivel,
  aoFechar,
}) => {
  const [nomeOficina, setNomeOficina] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoSucesso, setEnviadoSucesso] = useState(false);

  // Formatação em tempo real para WhatsApp brasileiro (DDD + 8 ou 9 dígitos)
  const lidarComMudancaWhatsapp = (texto: string) => {
    const apenasDigitos = texto.replace(/\D/g, '').slice(0, 11);
    if (!apenasDigitos.length) {
      setWhatsapp('');
      return;
    }
    if (apenasDigitos.length <= 2) {
      setWhatsapp(`(${apenasDigitos}`);
      return;
    }
    if (apenasDigitos.length <= 6) {
      setWhatsapp(`(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2)}`);
      return;
    }
    if (apenasDigitos.length <= 10) {
      setWhatsapp(`(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2, 6)}-${apenasDigitos.slice(6)}`);
      return;
    }
    setWhatsapp(`(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2, 7)}-${apenasDigitos.slice(7, 11)}`);
  };

  const resetarFormulario = () => {
    setNomeOficina('');
    setEmail('');
    setWhatsapp('');
    setErro(null);
    setEnviadoSucesso(false);
    setCarregando(false);
  };

  const handleFechar = () => {
    resetarFormulario();
    aoFechar();
  };

  const validarCampos = (): boolean => {
    if (!nomeOficina.trim()) {
      setErro('Por favor, informe o nome da sua oficina.');
      return false;
    }
    if (nomeOficina.trim().length < 3) {
      setErro('O nome da oficina deve ter pelo menos 3 caracteres.');
      return false;
    }

    const emailLimpo = email.trim();
    if (!emailLimpo) {
      setErro('Por favor, informe o seu e-mail de contato.');
      return false;
    }
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo);
    if (!emailValido) {
      setErro('Por favor, informe um endereço de e-mail válido.');
      return false;
    }

    const digitosWhats = whatsapp.replace(/\D/g, '');
    if (!digitosWhats) {
      setErro('Por favor, informe o WhatsApp para contato.');
      return false;
    }
    if (digitosWhats.length < 10) {
      setErro('Informe um WhatsApp válido com DDD (mínimo de 10 dígitos).');
      return false;
    }

    setErro(null);
    return true;
  };

  // OPÇÃO 1: Direciona para o WhatsApp comercial da equipe com mensagem pronta
  const direcionarParaWhatsAppComercial = async (dados: {
    nomeOficina: string;
    email: string;
    whatsapp: string;
  }) => {
    const textoMensagem =
      `Olá equipe AutoF! 👋\n` +
      `Gostaria de solicitar o cadastro e liberação da minha oficina:\n\n` +
      `🏢 *Oficina:* ${dados.nomeOficina}\n` +
      `📧 *E-mail:* ${dados.email}\n` +
      `📱 *WhatsApp:* ${dados.whatsapp}\n\n` +
      `Aguardo o envio dos dados de acesso!`;

    const textoCodificado = encodeURIComponent(textoMensagem);
    const urlNativa = `whatsapp://send?phone=${WHATSAPP_COMERCIAL}&text=${textoCodificado}`;
    const urlWeb = `https://wa.me/${WHATSAPP_COMERCIAL}?text=${textoCodificado}`;

    try {
      const suportaNativo = await Linking.canOpenURL(urlNativa);
      if (suportaNativo) {
        await Linking.openURL(urlNativa);
      } else {
        await Linking.openURL(urlWeb);
      }
    } catch {
      await Linking.openURL(urlWeb);
    }
  };

  // Disparo complementar via cliente de e-mail para comercial@aftecnologias.com.br
  const direcionarParaEmailComercial = async () => {
    const assunto = encodeURIComponent(`Solicitação de Cadastro: ${nomeOficina.trim()}`);
    const corpo = encodeURIComponent(
      `Olá equipe AutoF,\n\n` +
      `Solicito o cadastro da minha oficina no sistema AutoF:\n\n` +
      `Oficina: ${nomeOficina.trim()}\n` +
      `E-mail: ${email.trim()}\n` +
      `WhatsApp: ${whatsapp.trim()}\n\n` +
      `Aguardo o preparo do ambiente e as credenciais de acesso.`
    );
    const urlMailto = `mailto:${EMAIL_COMERCIAL}?subject=${assunto}&body=${corpo}`;
    try {
      await Linking.openURL(urlMailto);
    } catch (e) {
      console.warn('Não foi possível abrir o cliente de e-mail:', e);
    }
  };

  const handleEnviarCadastro = async () => {
    if (!validarCampos()) return;

    setCarregando(true);
    setErro(null);

    const dados = {
      nomeOficina: nomeOficina.trim(),
      email: email.trim(),
      whatsapp: whatsapp.trim(),
    };

    try {
      // OPÇÃO 2: Dispara para a API do sistema e registra a contingência segura
      await authApi.solicitarCadastro(dados);

      // OPÇÃO 1: Direciona imediatamente para o WhatsApp comercial da equipe
      await direcionarParaWhatsAppComercial(dados);

      setEnviadoSucesso(true);
    } catch (e: any) {
      setErro(e?.message || 'Ocorreu um erro ao enviar sua solicitação. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Modal
      visible={visivel}
      animationType="fade"
      transparent
      onRequestClose={handleFechar}
    >
      <View style={styles.fundoModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.cardModal}>
              {/* Botão de Fechar no topo direito */}
              <TouchableOpacity
                style={styles.botaoFecharTopo}
                onPress={handleFechar}
                disabled={carregando}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color={CORES.textoSecundario} />
              </TouchableOpacity>

              {!enviadoSucesso ? (
                <>
                  {/* Cabeçalho do Formulário */}
                  <View style={styles.headerSecao}>
                    <View style={styles.iconeHeaderBox}>
                      <Ionicons name="business" size={28} color="#FFFFFF" />
                    </View>
                    <Text style={styles.tituloModal}>Cadastrar Oficina</Text>
                    <Text style={styles.subtituloModal}>
                      Preencha os dados abaixo. Nossa equipe entrará em contato para liberar o seu acesso.
                    </Text>
                  </View>

                  {/* Mensagem de Erro */}
                  {erro && (
                    <View style={styles.erroBox}>
                      <Ionicons name="alert-circle" size={18} color={CORES.perigoTexto} />
                      <Text style={styles.erroTexto}>{erro}</Text>
                    </View>
                  )}

                  {/* Campo: Nome da Oficina */}
                  <Text style={styles.label}>Nome da Oficina *</Text>
                  <View style={styles.inputLinha}>
                    <Ionicons name="business-outline" size={20} color={CORES.textoMudo} style={styles.inputIcone} />
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: Auto Mecânica Silva ou Peças Central"
                      placeholderTextColor={CORES.textoMudo}
                      value={nomeOficina}
                      onChangeText={(t) => {
                        setNomeOficina(t);
                        if (erro) setErro(null);
                      }}
                      autoCapitalize="words"
                      editable={!carregando}
                    />
                  </View>

                  {/* Campo: E-mail */}
                  <Text style={styles.label}>E-mail de Contrato / Acesso *</Text>
                  <View style={styles.inputLinha}>
                    <Ionicons name="mail-outline" size={20} color={CORES.textoMudo} style={styles.inputIcone} />
                    <TextInput
                      style={styles.input}
                      placeholder="seu.email@oficina.com.br"
                      placeholderTextColor={CORES.textoMudo}
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        if (erro) setErro(null);
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!carregando}
                    />
                  </View>

                  {/* Campo: WhatsApp */}
                  <Text style={styles.label}>WhatsApp com DDD *</Text>
                  <View style={styles.inputLinha}>
                    <Ionicons name="logo-whatsapp" size={20} color="#22C55E" style={styles.inputIcone} />
                    <TextInput
                      style={styles.input}
                      placeholder="(11) 99999-9999"
                      placeholderTextColor={CORES.textoMudo}
                      value={whatsapp}
                      onChangeText={(t) => {
                        lidarComMudancaWhatsapp(t);
                        if (erro) setErro(null);
                      }}
                      keyboardType="phone-pad"
                      editable={!carregando}
                    />
                  </View>

                  {/* Botão de Envio (Executa Opção 2 dispara + Opção 1 direciona) */}
                  <TouchableOpacity
                    style={[styles.botaoEnviar, carregando && styles.botaoDesabilitado]}
                    onPress={handleEnviarCadastro}
                    disabled={carregando}
                    activeOpacity={0.8}
                  >
                    {carregando ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color="#FFFFFF" />
                        <Text style={styles.botaoEnviarTexto}>Enviar e Notificar Equipe</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Botão Voltar */}
                  <TouchableOpacity
                    style={styles.botaoCancelar}
                    onPress={handleFechar}
                    disabled={carregando}
                  >
                    <Text style={styles.botaoCancelarTexto}>Voltar ao Login</Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* Tela de Confirmação e Sucesso */
                <View style={styles.sucessoContainer}>
                  <View style={styles.sucessoIconeBox}>
                    <Ionicons name="checkmark-circle" size={54} color={CORES.sucessoTexto} />
                  </View>

                  <Text style={styles.sucessoTitulo}>Cadastro Enviado!</Text>

                  {/* Mensagem solicitada pelo usuário */}
                  <View style={styles.sucessoAvisoBox}>
                    <Text style={styles.sucessoAvisoTexto}>
                      Nossa equipe vai preparar o ambiente e será enviado por e-mail/WhatsApp o acesso.
                    </Text>
                  </View>

                  {/* Card com resumo dos dados */}
                  <View style={styles.resumoCard}>
                    <View style={styles.resumoLinha}>
                      <Ionicons name="business" size={16} color={CORES.primariaClara} />
                      <Text style={styles.resumoLabel}>Oficina:</Text>
                      <Text style={styles.resumoValor} numberOfLines={1}>{nomeOficina}</Text>
                    </View>
                    <View style={styles.resumoLinha}>
                      <Ionicons name="mail" size={16} color={CORES.primariaClara} />
                      <Text style={styles.resumoLabel}>E-mail:</Text>
                      <Text style={styles.resumoValor} numberOfLines={1}>{email}</Text>
                    </View>
                    <View style={styles.resumoLinha}>
                      <Ionicons name="logo-whatsapp" size={16} color="#22C55E" />
                      <Text style={styles.resumoLabel}>WhatsApp:</Text>
                      <Text style={styles.resumoValor}>{whatsapp}</Text>
                    </View>
                  </View>

                  {/* Ação 1: Reabrir WhatsApp da equipe caso queira enviar novamente */}
                  <TouchableOpacity
                    style={styles.botaoWhatsAppSucesso}
                    onPress={() => direcionarParaWhatsAppComercial({ nomeOficina, email, whatsapp })}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                    <Text style={styles.botaoWhatsAppSucessoTexto}>Conversar no WhatsApp Comercial</Text>
                  </TouchableOpacity>

                  {/* Ação 2: Enviar cópia por e-mail se desejar */}
                  <TouchableOpacity
                    style={styles.botaoEmailSucesso}
                    onPress={direcionarParaEmailComercial}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="mail-outline" size={18} color={CORES.primariaClara} />
                    <Text style={styles.botaoEmailSucessoTexto}>Enviar também por E-mail</Text>
                  </TouchableOpacity>

                  {/* Botão de Fechar */}
                  <TouchableOpacity
                    style={styles.botaoEntendido}
                    onPress={handleFechar}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.botaoEntendidoTexto}>Entendido, voltar ao login</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    padding: 16,
  },
  keyboardContainer: {
    width: '100%',
    maxWidth: 440,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  cardModal: {
    backgroundColor: CORES.superficie,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    position: 'relative',
  },
  botaoFecharTopo: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 10,
    padding: 4,
  },
  headerSecao: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  iconeHeaderBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: CORES.primaria,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: CORES.primaria,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  tituloModal: {
    color: CORES.texto,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtituloModal: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  erroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.perigoFundo,
    borderWidth: 1,
    borderColor: CORES.perigo,
    borderRadius: 8,
    padding: 10,
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
    marginBottom: 16,
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
  botaoEnviar: {
    backgroundColor: CORES.sucesso,
    borderRadius: 10,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: CORES.sucesso,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  botaoEnviarTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  botaoCancelar: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  botaoCancelarTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
  },
  sucessoContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sucessoIconeBox: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: CORES.sucessoFundo,
    borderWidth: 2,
    borderColor: CORES.sucesso,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  sucessoTitulo: {
    color: CORES.texto,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  sucessoAvisoBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderLeftWidth: 4,
    borderLeftColor: CORES.sucesso,
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  sucessoAvisoTexto: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
  resumoCard: {
    width: '100%',
    backgroundColor: CORES.fundo,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  resumoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resumoLabel: {
    color: CORES.textoMudo,
    fontSize: 13,
    fontWeight: '600',
    width: 75,
  },
  resumoValor: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  botaoWhatsAppSucesso: {
    backgroundColor: '#16A34A',
    borderRadius: 10,
    height: 48,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  botaoWhatsAppSucessoTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  botaoEmailSucesso: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.4)',
    borderRadius: 10,
    height: 46,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  botaoEmailSucessoTexto: {
    color: CORES.primariaClara,
    fontSize: 14,
    fontWeight: '600',
  },
  botaoEntendido: {
    backgroundColor: CORES.primaria,
    borderRadius: 10,
    height: 48,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botaoEntendidoTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
