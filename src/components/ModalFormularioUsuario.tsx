import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  OpcaoUsuario,
  PedidoUsuario,
  RespostaUsuario,
} from '../types';
import { CORES } from '../constants';
import { usuarioApi } from '../api/usuarioApi';
import { extrairMensagemErro } from '../api/clienteHttp';
import { abrirWhatsAppDireto } from '../utils/whatsappHelper';

export const PAPEIS_PADRAO_FALLBACK: OpcaoUsuario[] = [
  {
    chave: 'administrador',
    rotulo: 'Administrador',
    descricao: 'Acesso total, incluindo usuários e configurações do sistema.',
  },
  {
    chave: 'gestor',
    rotulo: 'Gestor',
    descricao: 'Toda a operação, o financeiro e o RH. Não administra o sistema.',
  },
  {
    chave: 'administrativo',
    rotulo: 'Administrativo',
    descricao: 'Recepção, OS, clientes, agenda e comunicação. Sem custos nem margem.',
  },
  {
    chave: 'financeiro',
    rotulo: 'Financeiro',
    descricao: 'Faturamento, margem, comissões e relatórios. Não edita a operação.',
  },
  {
    chave: 'rh',
    rotulo: 'RH',
    descricao: 'Mecânicos, jornada, produtividade, comissões e custos de pessoal.',
  },
  {
    chave: 'mecanico',
    rotulo: 'Mecânico',
    descricao: 'Apenas as próprias ordens: apontar tempo e preencher checklist.',
  },
  {
    chave: 'caixa',
    rotulo: 'Caixa',
    descricao: 'Fatura e entrega a OS pronta, vende no balcão e fecha o dia. Não edita a operação nem vê custo.',
  },
];

export interface EstiloPapelInfo {
  icone: keyof typeof Ionicons.glyphMap;
  corTexto: string;
  corFundo: string;
  corBorda: string;
}

export const obterEstiloPapel = (papelChave: string): EstiloPapelInfo => {
  switch (papelChave?.toLowerCase()) {
    case 'administrador':
      return {
        icone: 'shield-checkmark-outline',
        corTexto: CORES.primariaClara,
        corFundo: '#1E3A8A',
        corBorda: CORES.primaria,
      };
    case 'gestor':
      return {
        icone: 'briefcase-outline',
        corTexto: '#C7D2FE',
        corFundo: '#3730A3',
        corBorda: '#6366F1',
      };
    case 'administrativo':
      return {
        icone: 'desktop-outline',
        corTexto: '#7DD3FC',
        corFundo: '#0C4A6E',
        corBorda: '#0284C7',
      };
    case 'financeiro':
      return {
        icone: 'cash-outline',
        corTexto: CORES.sucessoTexto,
        corFundo: CORES.sucessoFundo,
        corBorda: CORES.sucesso,
      };
    case 'rh':
      return {
        icone: 'people-outline',
        corTexto: '#FDBA74',
        corFundo: '#451A03',
        corBorda: '#F97316',
      };
    case 'mecanico':
      return {
        icone: 'construct-outline',
        corTexto: CORES.alertaTexto,
        corFundo: CORES.alertaFundo,
        corBorda: CORES.alerta,
      };
    case 'caixa':
      return {
        icone: 'card-outline',
        corTexto: '#6EE7B7',
        corFundo: '#064E3B',
        corBorda: '#10B981',
      };
    default:
      return {
        icone: 'person-outline',
        corTexto: CORES.textoSecundario,
        corFundo: CORES.superficieClara,
        corBorda: CORES.borda,
      };
  }
};

const formatarTelefoneInput = (valor: string): string => {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`;
};

interface ModalFormularioUsuarioProps {
  visivel: boolean;
  usuarioParaEditar?: RespostaUsuario | null;
  papeisDisponiveis?: OpcaoUsuario[];
  usuarioLogadoId?: string;
  nomeOficina?: string;
  aoFechar: () => void;
  aoSalvarSucesso: (usuarioSalvo: RespostaUsuario) => void;
}

export const ModalFormularioUsuario: React.FC<ModalFormularioUsuarioProps> = ({
  visivel,
  usuarioParaEditar = null,
  papeisDisponiveis = [],
  usuarioLogadoId,
  nomeOficina = 'Oficina AutoF',
  aoFechar,
  aoSalvarSucesso,
}) => {
  const insets = useSafeAreaInsets();
  const modoEdicao = !!usuarioParaEditar;
  const editandoASiMesmo =
    modoEdicao && !!usuarioLogadoId && usuarioParaEditar?.id === usuarioLogadoId;

  const listaPapeis = useMemo<OpcaoUsuario[]>(() => {
    return papeisDisponiveis.length > 0 ? papeisDisponiveis : PAPEIS_PADRAO_FALLBACK;
  }, [papeisDisponiveis]);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [papel, setPapel] = useState('mecanico');
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  // Estado para o diálogo pós-criação com a senhaInicial
  const [usuarioRecemCriado, setUsuarioRecemCriado] = useState<RespostaUsuario | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (visivel) {
      setErroLocal(null);
      setUsuarioRecemCriado(null);
      setCopiado(false);

      if (usuarioParaEditar) {
        setNome(usuarioParaEditar.nome || '');
        setEmail(usuarioParaEditar.email || '');
        setTelefone(formatarTelefoneInput(usuarioParaEditar.telefone || ''));
        setPapel(usuarioParaEditar.papel || 'mecanico');
        setAtivo(usuarioParaEditar.ativo ?? true);
      } else {
        setNome('');
        setEmail('');
        setTelefone('');
        setPapel(listaPapeis.find((p) => p.chave === 'mecanico')?.chave || listaPapeis[0]?.chave || 'mecanico');
        setAtivo(true);
      }
    }
  }, [visivel, usuarioParaEditar, listaPapeis]);

  const validarFormulario = (): string | null => {
    if (!nome.trim() || nome.trim().length < 2) {
      return 'Informe o nome completo do colaborador.';
    }
    const emailLimpo = email.trim();
    if (!emailLimpo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      return 'Informe um endereço de e-mail válido.';
    }
    if (!papel) {
      return 'Selecione o papel de acesso do colaborador.';
    }
    if (editandoASiMesmo && !ativo) {
      return 'Você não pode desativar o seu próprio usuário.';
    }
    return null;
  };

  const handleSalvar = async () => {
    const erroValidacao = validarFormulario();
    if (erroValidacao) {
      setErroLocal(erroValidacao);
      Alert.alert('Campos Inválidos', erroValidacao);
      return;
    }

    setSalvando(true);
    setErroLocal(null);

    const payload: PedidoUsuario = {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      telefone: telefone.trim() || undefined,
      papel,
      ativo: editandoASiMesmo ? true : ativo,
      mecanicoId: usuarioParaEditar?.mecanicoId ?? null,
      permissoesExtras: usuarioParaEditar?.permissoesExtras,
      permissoesRemovidas: usuarioParaEditar?.permissoesRemovidas,
    };

    try {
      if (modoEdicao && usuarioParaEditar) {
        const atualizado = await usuarioApi.atualizarUsuario(usuarioParaEditar.id, payload);
        aoSalvarSucesso(atualizado);
        Alert.alert('Sucesso', `Os dados de "${atualizado.nome}" foram atualizados.`);
        aoFechar();
      } else {
        const criado = await usuarioApi.criarUsuario(payload);
        aoSalvarSucesso(criado);

        if (criado.senhaInicial && criado.senhaInicial.trim().length > 0) {
          setUsuarioRecemCriado(criado);
        } else {
          Alert.alert(
            'Colaborador Vinculado',
            `${criado.nome} já possuía uma conta no sistema e foi vinculado a esta oficina mantendo sua senha atual.`
          );
          aoFechar();
        }
      }
    } catch (e) {
      const msg = extrairMensagemErro(e);
      setErroLocal(msg);
      Alert.alert('Não foi possível salvar', msg);
    } finally {
      setSalvando(false);
    }
  };

  const handleCopiarSenha = async () => {
    if (!usuarioRecemCriado?.senhaInicial) return;
    try {
      await Clipboard.setStringAsync(usuarioRecemCriado.senhaInicial);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      Alert.alert('Erro', 'Não foi possível copiar a senha para a área de transferência.');
    }
  };

  const handleCompartilharWhatsApp = async () => {
    if (!usuarioRecemCriado) return;
    const senha = usuarioRecemCriado.senhaInicial || '';
    const papelRotulo =
      usuarioRecemCriado.papelRotulo ||
      listaPapeis.find((p) => p.chave === usuarioRecemCriado.papel)?.rotulo ||
      usuarioRecemCriado.papel;

    const mensagem = `Olá, *${usuarioRecemCriado.nome}*! 👋
Seu acesso à oficina *${nomeOficina}* no sistema *AutoF Gestão* foi liberado.

🔐 *Credenciais de Acesso:*
• *E-mail:* ${usuarioRecemCriado.email}
• *Senha Inicial:* ${senha}
• *Perfil:* ${papelRotulo}

⚠️ _Por segurança, o sistema solicitará a criação de uma nova senha pessoal no seu primeiro login._`;

    if (usuarioRecemCriado.telefone && usuarioRecemCriado.telefone.replace(/\D/g, '').length >= 10) {
      await abrirWhatsAppDireto(usuarioRecemCriado.telefone, mensagem);
      return;
    }

    const textoCodificado = encodeURIComponent(mensagem);
    const appUrl = `whatsapp://send?text=${textoCodificado}`;
    const webUrl = `https://wa.me/?text=${textoCodificado}`;

    try {
      const podeAbrir = await Linking.canOpenURL(appUrl);
      if (podeAbrir) {
        await Linking.openURL(appUrl);
        return;
      }
    } catch {
      // fallback abaixo
    }

    try {
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert(
        'WhatsApp Indisponível',
        'Não foi possível abrir o WhatsApp neste dispositivo. Copie a senha inicial para enviá-la manualmente.'
      );
    }
  };

  const handleToggleAtivo = (novoValor: boolean) => {
    if (editandoASiMesmo && !novoValor) {
      Alert.alert(
        'Operação Bloqueada',
        'Por segurança, você não pode desativar a sua própria conta na oficina.'
      );
      return;
    }
    setAtivo(novoValor);
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
        style={styles.fundoModal}
      >
        <View style={[styles.containerModal, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Cabeçalho */}
          <View style={styles.header}>
            <View style={styles.headerTituloRow}>
              <View style={styles.headerIconeBox}>
                <Ionicons
                  name={
                    usuarioRecemCriado
                      ? 'key-outline'
                      : modoEdicao
                      ? 'create-outline'
                      : 'person-add-outline'
                  }
                  size={22}
                  color={CORES.primariaClara}
                />
              </View>
              <View style={styles.headerTextos}>
                <Text style={styles.headerTitulo}>
                  {usuarioRecemCriado
                    ? 'Credenciais de Primeiro Acesso'
                    : modoEdicao
                    ? 'Editar Colaborador'
                    : 'Novo Colaborador'}
                </Text>
                <Text style={styles.headerSubtitulo}>
                  {usuarioRecemCriado
                    ? 'Envie a senha inicial ao colaborador'
                    : modoEdicao
                    ? `Atualizando participação em ${nomeOficina}`
                    : `Adicionar membro à equipe de ${nomeOficina}`}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.botaoFechar}
              onPress={aoFechar}
              accessibilityLabel="Fechar formulário de usuário"
            >
              <Ionicons name="close" size={24} color={CORES.texto} />
            </TouchableOpacity>
          </View>

          {/* Modo Pós-Criação: Exibição da Senha Inicial */}
          {usuarioRecemCriado ? (
            <ScrollView
              style={styles.scrollConteudo}
              contentContainerStyle={styles.scrollContainer}
            >
              <View style={styles.cardSucessoCriacao}>
                <View style={styles.iconeSucessoCirculo}>
                  <Ionicons name="checkmark-circle" size={44} color={CORES.sucessoTexto} />
                </View>

                <Text style={styles.sucessoTitulo}>
                  Conta criada para {usuarioRecemCriado.nome}!
                </Text>
                <Text style={styles.sucessoSubtitulo}>
                  A senha inicial abaixo é exibida apenas uma única vez. Copie ou compartilhe pelo WhatsApp para que o colaborador realize o primeiro acesso.
                </Text>

                {/* Box da Senha Inicial */}
                <View style={styles.senhaDestaqueBox}>
                  <Text style={styles.senhaDestaqueLabel}>SENHA INICIAL TEMPORÁRIA</Text>
                  <Text style={styles.senhaDestaqueValor} selectable>
                    {usuarioRecemCriado.senhaInicial}
                  </Text>
                  <View style={styles.infoUsuarioCriado}>
                    <Ionicons name="mail-outline" size={14} color={CORES.textoSecundario} />
                    <Text style={styles.infoUsuarioCriadoTexto}>
                      {usuarioRecemCriado.email}
                    </Text>
                  </View>
                </View>

                {/* Botão Copiar Senha */}
                <TouchableOpacity
                  style={[
                    styles.botaoCopiarSenha,
                    copiado && styles.botaoCopiarSenhaSucesso,
                  ]}
                  onPress={handleCopiarSenha}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={copiado ? 'checkmark-done-outline' : 'copy-outline'}
                    size={20}
                    color={copiado ? CORES.sucessoTexto : '#FFFFFF'}
                  />
                  <Text
                    style={[
                      styles.botaoCopiarSenhaTexto,
                      copiado && { color: CORES.sucessoTexto },
                    ]}
                  >
                    {copiado
                      ? 'Senha Copiada para a Área de Transferência!'
                      : 'Copiar Senha Inicial'}
                  </Text>
                </TouchableOpacity>

                {/* Botão Compartilhar no WhatsApp */}
                <TouchableOpacity
                  style={styles.botaoWhatsAppCredenciais}
                  onPress={handleCompartilharWhatsApp}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                  <Text style={styles.botaoWhatsAppCredenciaisTexto}>
                    Compartilhar Acesso no WhatsApp
                  </Text>
                </TouchableOpacity>

                <View style={styles.avisoTrocaSenhaBox}>
                  <Ionicons
                    name="shield-half-outline"
                    size={16}
                    color={CORES.alertaTexto}
                  />
                  <Text style={styles.avisoTrocaSenhaTexto}>
                    No primeiro login, o colaborador será solicitado a definir uma nova senha pessoal.
                  </Text>
                </View>
              </View>
            </ScrollView>
          ) : (
            /* Formulário de Criação / Edição */
            <ScrollView
              style={styles.scrollConteudo}
              contentContainerStyle={styles.scrollContainer}
              keyboardShouldPersistTaps="handled"
            >
              {erroLocal && (
                <View style={styles.erroBox}>
                  <Ionicons name="alert-circle" size={18} color={CORES.perigoTexto} />
                  <Text style={styles.erroTexto}>{erroLocal}</Text>
                </View>
              )}

              {/* Campo Nome */}
              <View style={styles.campoGrupo}>
                <Text style={styles.label}>
                  Nome Completo <Text style={styles.obrigatorio}>*</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={CORES.textoMudo}
                    style={styles.inputIcone}
                  />
                  <TextInput
                    style={styles.input}
                    value={nome}
                    onChangeText={setNome}
                    placeholder="Ex: Carlos Eduardo Silva"
                    placeholderTextColor={CORES.textoMudo}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Campo E-mail */}
              <View style={styles.campoGrupo}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>
                    E-mail de Acesso <Text style={styles.obrigatorio}>*</Text>
                  </Text>
                  {modoEdicao && (
                    <Text style={styles.tagSomenteLeitura}>Identidade fixa</Text>
                  )}
                </View>
                <View
                  style={[
                    styles.inputWrapper,
                    modoEdicao && styles.inputWrapperDesabilitado,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={CORES.textoMudo}
                    style={styles.inputIcone}
                  />
                  <TextInput
                    style={[styles.input, modoEdicao && styles.inputDesabilitado]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="colaborador@oficina.com.br"
                    placeholderTextColor={CORES.textoMudo}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!modoEdicao}
                  />
                  {modoEdicao && (
                    <Ionicons name="lock-closed-outline" size={16} color={CORES.textoMudo} />
                  )}
                </View>
                {modoEdicao && (
                  <Text style={styles.dicaCampo}>
                    O e-mail identifica a conta em todas as oficinas e não pode ser alterado.
                  </Text>
                )}
              </View>

              {/* Campo Telefone / WhatsApp */}
              <View style={styles.campoGrupo}>
                <Text style={styles.label}>Telefone / WhatsApp</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="call-outline"
                    size={18}
                    color={CORES.textoMudo}
                    style={styles.inputIcone}
                  />
                  <TextInput
                    style={styles.input}
                    value={telefone}
                    onChangeText={(txt) => setTelefone(formatarTelefoneInput(txt))}
                    placeholder="(11) 98888-7777"
                    placeholderTextColor={CORES.textoMudo}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Seletor de Papel */}
              <View style={styles.campoGrupo}>
                <Text style={styles.label}>
                  Papel na Oficina <Text style={styles.obrigatorio}>*</Text>
                </Text>
                <Text style={styles.subtituloPapel}>
                  Escolha a função do colaborador para definir suas permissões operacionais:
                </Text>

                <View style={styles.listaPapeis}>
                  {listaPapeis.map((opcao) => {
                    const selecionado = papel === opcao.chave;
                    const estiloPapel = obterEstiloPapel(opcao.chave);
                    const descricaoPapel =
                      opcao.descricao ||
                      PAPEIS_PADRAO_FALLBACK.find((p) => p.chave === opcao.chave)?.descricao ||
                      '';

                    return (
                      <TouchableOpacity
                        key={opcao.chave}
                        style={[
                          styles.cardPapel,
                          selecionado && {
                            borderColor: estiloPapel.corBorda,
                            backgroundColor: 'rgba(30, 41, 59, 0.95)',
                          },
                        ]}
                        onPress={() => setPapel(opcao.chave)}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.iconePapelBox,
                            {
                              backgroundColor: selecionado
                                ? estiloPapel.corFundo
                                : CORES.superficieClara,
                              borderColor: selecionado
                                ? estiloPapel.corBorda
                                : CORES.borda,
                            },
                          ]}
                        >
                          <Ionicons
                            name={estiloPapel.icone}
                            size={20}
                            color={selecionado ? estiloPapel.corTexto : CORES.textoSecundario}
                          />
                        </View>

                        <View style={styles.infoPapelCol}>
                          <Text
                            style={[
                              styles.rotuloPapel,
                              selecionado && {
                                color: estiloPapel.corTexto,
                                fontWeight: '800',
                              },
                            ]}
                          >
                            {opcao.rotulo}
                          </Text>
                          {!!descricaoPapel && (
                            <Text style={styles.descricaoPapel}>
                              {descricaoPapel}
                            </Text>
                          )}
                        </View>

                        <View
                          style={[
                            styles.radioCirculo,
                            selecionado && {
                              backgroundColor: estiloPapel.corBorda,
                              borderColor: estiloPapel.corBorda,
                            },
                          ]}
                        >
                          {selecionado && (
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Switch Status Ativo */}
              <View style={styles.switchCard}>
                <View style={styles.switchTextosCol}>
                  <View style={styles.switchTituloRow}>
                    <Ionicons
                      name={ativo ? 'checkmark-circle-outline' : 'pause-circle-outline'}
                      size={18}
                      color={ativo ? CORES.sucessoTexto : CORES.textoMudo}
                    />
                    <Text style={styles.switchTitulo}>
                      Participação Ativa na Oficina
                    </Text>
                  </View>
                  <Text style={styles.switchDescricao}>
                    {editandoASiMesmo
                      ? 'Você está editando seu próprio perfil e não pode desativar seu acesso.'
                      : ativo
                      ? 'O colaborador pode acessar o sistema e operar normalmente nesta oficina.'
                      : 'Acesso suspenso nesta oficina. O histórico de OS permanece preservado.'}
                  </Text>
                </View>

                <Switch
                  value={ativo}
                  onValueChange={handleToggleAtivo}
                  disabled={editandoASiMesmo}
                  trackColor={{ false: CORES.superficieClara, true: CORES.sucesso }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </ScrollView>
          )}

          {/* Rodapé */}
          <View style={styles.rodape}>
            {usuarioRecemCriado ? (
              <TouchableOpacity
                style={styles.botaoConfirmar}
                onPress={aoFechar}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.botaoConfirmarTexto}>Concluir</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.botaoConfirmar,
                    salvando && styles.botaoDesabilitado,
                  ]}
                  onPress={handleSalvar}
                  disabled={salvando}
                  activeOpacity={0.85}
                >
                  {salvando ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.botaoConfirmarTexto}>Salvando...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name={modoEdicao ? 'save-outline' : 'person-add-outline'}
                        size={19}
                        color="#FFFFFF"
                      />
                      <Text style={styles.botaoConfirmarTexto}>
                        {modoEdicao ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.botaoCancelar}
                  onPress={aoFechar}
                  disabled={salvando}
                >
                  <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '94%',
    height: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: CORES.superficie,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  headerTituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
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
  botaoFechar: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: CORES.superficieClara,
  },
  scrollConteudo: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    gap: 16,
  },
  erroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.perigoFundo,
    borderWidth: 1,
    borderColor: CORES.perigo,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  erroTexto: {
    color: CORES.perigoTexto,
    fontSize: 13,
    flex: 1,
  },
  campoGrupo: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '700',
  },
  obrigatorio: {
    color: CORES.perigoTexto,
  },
  tagSomenteLeitura: {
    color: CORES.textoMudo,
    fontSize: 11,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.borda,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  inputWrapperDesabilitado: {
    backgroundColor: CORES.fundo,
    borderColor: CORES.bordaSuave,
    opacity: 0.75,
  },
  inputIcone: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: CORES.texto,
    fontSize: 14,
    paddingVertical: 12,
  },
  inputDesabilitado: {
    color: CORES.textoSecundario,
  },
  dicaCampo: {
    color: CORES.textoMudo,
    fontSize: 11,
    lineHeight: 15,
  },
  subtituloPapel: {
    color: CORES.textoSecundario,
    fontSize: 12,
    marginBottom: 4,
  },
  listaPapeis: {
    gap: 8,
  },
  cardPapel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: CORES.bordaSuave,
    gap: 12,
  },
  iconePapelBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoPapelCol: {
    flex: 1,
    gap: 2,
  },
  rotuloPapel: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
  },
  descricaoPapel: {
    color: CORES.textoSecundario,
    fontSize: 12,
    lineHeight: 16,
  },
  radioCirculo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: CORES.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 12,
  },
  switchTextosCol: {
    flex: 1,
    gap: 4,
  },
  switchTituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchTitulo: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
  },
  switchDescricao: {
    color: CORES.textoSecundario,
    fontSize: 12,
    lineHeight: 16,
  },
  cardSucessoCriacao: {
    backgroundColor: CORES.superficie,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    alignItems: 'center',
    gap: 14,
  },
  iconeSucessoCirculo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: CORES.sucessoFundo,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CORES.sucesso,
  },
  sucessoTitulo: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  sucessoSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  senhaDestaqueBox: {
    width: '100%',
    backgroundColor: CORES.fundo,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: CORES.primaria,
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  senhaDestaqueLabel: {
    color: CORES.primariaClara,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  senhaDestaqueValor: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
  },
  infoUsuarioCriado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  infoUsuarioCriadoTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
  },
  botaoCopiarSenha: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.primaria,
    paddingVertical: 13,
    borderRadius: 10,
    gap: 8,
  },
  botaoCopiarSenhaSucesso: {
    backgroundColor: CORES.sucessoFundo,
    borderWidth: 1,
    borderColor: CORES.sucesso,
  },
  botaoCopiarSenhaTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  botaoWhatsAppCredenciais: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803D',
    paddingVertical: 13,
    borderRadius: 10,
    gap: 8,
  },
  botaoWhatsAppCredenciaisTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  avisoTrocaSenhaBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.alertaFundo,
    padding: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 4,
  },
  avisoTrocaSenhaTexto: {
    color: CORES.alertaTexto,
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  rodape: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    backgroundColor: CORES.superficie,
    gap: 8,
  },
  botaoConfirmar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.primaria,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  botaoDesabilitado: {
    opacity: 0.55,
  },
  botaoConfirmarTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  botaoCancelar: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoCancelarTexto: {
    color: CORES.textoMudo,
    fontSize: 13,
    fontWeight: '600',
  },
});
