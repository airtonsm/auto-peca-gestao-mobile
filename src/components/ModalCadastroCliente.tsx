import React, { useState, useEffect } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { osApi } from '../api/osApi';
import { RespostaCliente } from '../types';
import { CORES } from '../constants';
import { extrairMensagemErro } from '../api/clienteHttp';
import {
  mascaraTelefone,
  mascaraCpfCnpj,
  limparApenasNumeros,
} from '../utils/mascaras';
import { consultarDadosCnpj } from '../utils/cnpjHelper';

interface ModalCadastroClienteProps {
  visivel: boolean;
  aoFechar: () => void;
  aoSalvar: (cliente: RespostaCliente) => void;
  nomeInicial?: string;
  telefoneInicial?: string;
}

export const ModalCadastroCliente: React.FC<ModalCadastroClienteProps> = ({
  visivel,
  aoFechar,
  aoSalvar,
  nomeInicial = '',
  telefoneInicial = '',
}) => {
  const insets = useSafeAreaInsets();

  const [tipo, setTipo] = useState<'pf' | 'pj'>('pf');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [documento, setDocumento] = useState('');
  const [email, setEmail] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [statusCnpj, setStatusCnpj] = useState<{ sucesso: boolean; mensagem: string } | null>(null);

  useEffect(() => {
    if (visivel) {
      setNome(nomeInicial);
      setTelefone(telefoneInicial ? mascaraTelefone(telefoneInicial) : '');
      setDocumento('');
      setEmail('');
      setTipo('pf');
      setSalvando(false);
      setConsultandoCnpj(false);
      setStatusCnpj(null);
    }
  }, [visivel, nomeInicial, telefoneInicial]);

  const consultarCnpjAutomatico = async (cnpjNumeros: string) => {
    if (cnpjNumeros.length !== 14) return;
    setConsultandoCnpj(true);
    setStatusCnpj(null);
    try {
      const dados = await consultarDadosCnpj(cnpjNumeros);
      if (dados) {
        const nomeEmpresa = dados.nomeFantasia || dados.razaoSocial;
        if (nomeEmpresa) {
          setNome(nomeEmpresa);
        }
        if (dados.telefone && !telefone) {
          setTelefone(mascaraTelefone(dados.telefone));
        }
        if (dados.email && !email) {
          setEmail(dados.email.toLowerCase());
        }
        setStatusCnpj({
          sucesso: true,
          mensagem: dados.razaoSocial || dados.nomeFantasia || 'Dados da empresa localizados com sucesso!',
        });
      } else {
        setStatusCnpj({
          sucesso: false,
          mensagem: 'CNPJ não encontrado na base pública. Preencha os campos manualmente.',
        });
      }
    } catch {
      setStatusCnpj({
        sucesso: false,
        mensagem: 'Falha ao consultar CNPJ na base pública.',
      });
    } finally {
      setConsultandoCnpj(false);
    }
  };

  const handleTelefoneChange = (texto: string) => {
    setTelefone(mascaraTelefone(texto));
  };

  const handleDocumentoChange = (texto: string) => {
    const formatado = mascaraCpfCnpj(texto, tipo);
    setDocumento(formatado);

    if (tipo === 'pj') {
      const nums = formatado.replace(/\D/g, '');
      if (nums.length === 14) {
        consultarCnpjAutomatico(nums);
      } else {
        setStatusCnpj(null);
      }
    }
  };

  const handleTrocarTipo = (novoTipo: 'pf' | 'pj') => {
    setTipo(novoTipo);
    setStatusCnpj(null);
    if (documento) {
      const formatado = mascaraCpfCnpj(documento, novoTipo);
      setDocumento(formatado);
      if (novoTipo === 'pj') {
        const nums = formatado.replace(/\D/g, '');
        if (nums.length === 14) {
          consultarCnpjAutomatico(nums);
        }
      }
    }
  };

  const handleSalvar = async () => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      Alert.alert('Nome Obrigatório', 'Por favor, informe o nome ou razão social do cliente.');
      return;
    }

    const telLimpo = limparApenasNumeros(telefone);
    const docLimpo = limparApenasNumeros(documento);
    const emailLimpo = email.trim();

    setSalvando(true);
    try {
      const novoCliente = await osApi.criarCliente({
        tipo,
        nome: nomeLimpo,
        documento: docLimpo || undefined,
        email: emailLimpo || undefined,
        contatos: telLimpo
          ? [
              {
                nome: nomeLimpo,
                telefone: telLimpo,
                whatsapp: true,
                principal: true,
              },
            ]
          : undefined,
      });

      aoSalvar(novoCliente);
      aoFechar();
    } catch (e) {
      Alert.alert('Erro ao Cadastrar Cliente', extrairMensagemErro(e, 'Não foi possível cadastrar o cliente.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent
      onRequestClose={aoFechar}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.conteudoModal, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Cabeçalho */}
          <View style={styles.cabecalho}>
            <View style={styles.cabecalhoIconeETexto}>
              <View style={styles.iconeHeaderBox}>
                <Ionicons name="person-add" size={20} color="#38BDF8" />
              </View>
              <View style={styles.cabecalhoTextosCol}>
                <Text style={styles.titulo} numberOfLines={1}>Novo Cliente</Text>
                <Text style={styles.subtitulo} numberOfLines={1} ellipsizeMode="tail">Cadastro rápido de PF ou PJ</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={aoFechar}
              style={styles.botaoFechar}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={CORES.textoSecundario} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Seletor PF / PJ */}
            <View style={styles.tipoSelector}>
              <TouchableOpacity
                style={[styles.tipoBotao, tipo === 'pf' && styles.tipoBotaoAtivo]}
                onPress={() => handleTrocarTipo('pf')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="person"
                  size={16}
                  color={tipo === 'pf' ? '#FFFFFF' : CORES.textoSecundario}
                />
                <Text style={[styles.tipoBotaoTexto, tipo === 'pf' && styles.tipoBotaoTextoAtivo]}>
                  Pessoa Física (PF)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tipoBotao, tipo === 'pj' && styles.tipoBotaoAtivo]}
                onPress={() => handleTrocarTipo('pj')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="business"
                  size={16}
                  color={tipo === 'pj' ? '#FFFFFF' : CORES.textoSecundario}
                />
                <Text style={[styles.tipoBotaoTexto, tipo === 'pj' && styles.tipoBotaoTextoAtivo]}>
                  Pessoa Jurídica (PJ)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Campo Nome */}
            <View style={styles.campoContainer}>
              <Text style={styles.rotuloCampo}>
                {tipo === 'pf' ? 'NOME COMPLETO *' : 'RAZÃO SOCIAL / NOME FANTASIA *'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={tipo === 'pf' ? 'Ex: João da Silva Santos' : 'Ex: Transportes Silva LTDA'}
                placeholderTextColor={CORES.textoMudo}
                value={nome}
                onChangeText={setNome}
                autoCapitalize="words"
              />
            </View>

            {/* Campo WhatsApp */}
            <View style={styles.campoContainer}>
              <View style={styles.rotuloComTag}>
                <Text style={styles.rotuloCampo}>WHATSAPP / CELULAR</Text>
                <View style={styles.tagZap}>
                  <Ionicons name="logo-whatsapp" size={11} color="#22C55E" />
                  <Text style={styles.tagZapTexto}>Notificações OS</Text>
                </View>
              </View>
              <TextInput
                style={styles.input}
                placeholder="(00) 00000-0000"
                placeholderTextColor={CORES.textoMudo}
                value={telefone}
                onChangeText={handleTelefoneChange}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>

            {/* Campo CPF / CNPJ */}
            <View style={styles.campoContainer}>
              <View style={styles.rotuloComTag}>
                <Text style={styles.rotuloCampo}>
                  {tipo === 'pf' ? 'CPF (OPCIONAL)' : 'CNPJ (PREENCHIMENTO AUTOMÁTICO)'}
                </Text>
                {tipo === 'pj' && (
                  <View style={styles.tagCnpj}>
                    <Ionicons name="sparkles" size={11} color="#38BDF8" />
                    <Text style={styles.tagCnpjTexto}>Auto-preenchimento</Text>
                  </View>
                )}
              </View>
              <TextInput
                style={styles.input}
                placeholder={tipo === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'}
                placeholderTextColor={CORES.textoMudo}
                value={documento}
                onChangeText={handleDocumentoChange}
                keyboardType="numeric"
                maxLength={tipo === 'pf' ? 14 : 18}
              />

              {consultandoCnpj && (
                <View style={styles.boxConsultandoCnpj}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                  <Text style={styles.boxConsultandoCnpjTexto}>
                    Buscando dados da empresa na base oficial...
                  </Text>
                </View>
              )}

              {!consultandoCnpj && statusCnpj && (
                <View
                  style={[
                    styles.boxStatusCnpj,
                    statusCnpj.sucesso ? styles.boxStatusCnpjSucesso : styles.boxStatusCnpjErro,
                  ]}
                >
                  <Ionicons
                    name={statusCnpj.sucesso ? 'checkmark-circle' : 'information-circle'}
                    size={14}
                    color={statusCnpj.sucesso ? '#22C55E' : '#F59E0B'}
                  />
                  <Text
                    style={[
                      styles.boxStatusCnpjTexto,
                      statusCnpj.sucesso ? styles.boxStatusCnpjTextoSucesso : styles.boxStatusCnpjTextoErro,
                    ]}
                    numberOfLines={2}
                  >
                    {statusCnpj.mensagem}
                  </Text>
                </View>
              )}
            </View>

            {/* Campo E-mail */}
            <View style={styles.campoContainer}>
              <Text style={styles.rotuloCampo}>E-MAIL (OPCIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="cliente@email.com"
                placeholderTextColor={CORES.textoMudo}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </ScrollView>

          {/* Rodapé com Botão Salvar */}
          <View style={styles.rodape}>
            <TouchableOpacity
              style={styles.botaoCancelar}
              onPress={aoFechar}
              disabled={salvando}
            >
              <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.botaoSalvar, salvando && styles.botaoSalvarDesativado]}
              onPress={handleSalvar}
              disabled={salvando}
              activeOpacity={0.85}
            >
              {salvando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" />
                  <Text style={styles.botaoSalvarTexto}>Salvar Cliente</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  conteudoModal: {
    backgroundColor: CORES.fundo,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  cabecalhoIconeETexto: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 10,
  },
  cabecalhoTextosCol: {
    flex: 1,
  },
  iconeHeaderBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontSize: 18,
    fontWeight: '700',
    color: CORES.texto,
  },
  subtitulo: {
    fontSize: 12,
    color: CORES.textoSecundario,
    marginTop: 1,
  },
  botaoFechar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: CORES.superficie,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scroll: {
    maxHeight: 460,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  tipoSelector: {
    flexDirection: 'row',
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  tipoBotao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tipoBotaoAtivo: {
    backgroundColor: CORES.primaria,
  },
  tipoBotaoTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: CORES.textoSecundario,
  },
  tipoBotaoTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  campoContainer: {
    marginBottom: 14,
  },
  rotuloCampo: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: CORES.textoSecundario,
    marginBottom: 6,
  },
  rotuloComTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tagZap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagZapTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22C55E',
  },
  tagCnpj: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagCnpjTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
  },
  boxConsultandoCnpj: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 8,
  },
  boxConsultandoCnpjTexto: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '500',
  },
  boxStatusCnpj: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  boxStatusCnpjSucesso: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  boxStatusCnpjErro: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  boxStatusCnpjTexto: {
    fontSize: 11,
    flex: 1,
    fontWeight: '600',
  },
  boxStatusCnpjTextoSucesso: {
    color: '#22C55E',
  },
  boxStatusCnpjTextoErro: {
    color: '#F59E0B',
  },
  input: {
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: CORES.texto,
  },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
  },
  botaoCancelar: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  botaoCancelarTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: CORES.textoSecundario,
  },
  botaoSalvar: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: CORES.primaria,
  },
  botaoSalvarDesativado: {
    opacity: 0.6,
  },
  botaoSalvarTexto: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
