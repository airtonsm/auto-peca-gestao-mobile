import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  RespostaOSResumo,
  RespostaChecklist,
  ContatoDaOS,
  RespostaConversaDaOS,
  RespostaTemplate,
} from '../types';
import { CORES } from '../constants';
import { PlacaVeiculo } from './PlacaVeiculo';
import { comunicacaoApi } from '../api/comunicacaoApi';
import { extrairMensagemErro } from '../api/clienteHttp';
import {
  gerarTextoLaudoChecklist,
  abrirWhatsAppDireto,
} from '../utils/whatsappHelper';

interface ModalEnviarWhatsAppChecklistProps {
  visivel: boolean;
  onFechar: () => void;
  os: RespostaOSResumo | null;
  checklist: RespostaChecklist | null;
  nomeOficina?: string;
  onSucessoEnvioOficial?: () => void;
}

export const ModalEnviarWhatsAppChecklist: React.FC<ModalEnviarWhatsAppChecklistProps> = ({
  visivel,
  onFechar,
  os,
  checklist,
  nomeOficina,
  onSucessoEnvioOficial,
}) => {
  const insets = useSafeAreaInsets();

  const [mensagem, setMensagem] = useState('');
  const [telefone, setTelefone] = useState('');
  const [contatos, setContatos] = useState<ContatoDaOS[]>([]);
  const [contatoSelecionado, setContatoSelecionado] = useState<ContatoDaOS | null>(null);
  const [carregandoContatos, setCarregandoContatos] = useState(false);
  const [conversaInfo, setConversaInfo] = useState<RespostaConversaDaOS['conversa'] | null>(null);
  const [templateAprovado, setTemplateAprovado] = useState<RespostaTemplate | null>(null);
  const [enviandoOficial, setEnviandoOficial] = useState(false);

  // Inicializa a mensagem e busca os contatos e templates sempre que o modal abre
  useEffect(() => {
    if (!visivel || !os || !checklist) return;

    // Gera texto padrão formatado
    const textoPadrao = gerarTextoLaudoChecklist({ os, checklist, nomeOficina });
    setMensagem(textoPadrao);

    let cancelado = false;
    const carregarDados = async () => {
      setCarregandoContatos(true);
      try {
        const [dadosConversaRes, templatesRes] = await Promise.allSettled([
          comunicacaoApi.obterConversaDaOS(os.id),
          comunicacaoApi.listarTemplates(),
        ]);

        if (cancelado) return;

        // Processa contatos e conversa da OS
        if (dadosConversaRes.status === 'fulfilled') {
          const dadosConversa = dadosConversaRes.value;
          const listaContatos = dadosConversa?.contatos || [];
          setContatos(listaContatos);
          setConversaInfo(dadosConversa?.conversa || null);

          // Define contato padrão (o lembrado, ou o principal, ou o primeiro disponível)
          const contatoPadrao =
            listaContatos.find((c) => c.id === dadosConversa?.contatoId) ||
            listaContatos.find((c) => c.principal) ||
            listaContatos[0] ||
            null;

          if (contatoPadrao) {
            setContatoSelecionado(contatoPadrao);
            setTelefone(contatoPadrao.telefoneExibicao || '');
          } else {
            setContatoSelecionado(null);
            setTelefone('');
          }
        } else {
          console.warn('[ModalWhatsApp] Não foi possível carregar contatos da OS:', dadosConversaRes.reason);
          setContatos([]);
          setConversaInfo(null);
        }

        // Processa templates para validar aprovação na Meta
        if (templatesRes.status === 'fulfilled') {
          const templates = templatesRes.value || [];
          const aprovado = templates.find(
            (t) =>
              (t.canal === 'whatsapp' || !t.canal) &&
              t.ativo !== false &&
              (t.statusAprovacao === 'aprovado' || t.aprovadoNoProvedor === true)
          );
          setTemplateAprovado(aprovado || null);
        } else {
          console.warn('[ModalWhatsApp] Não foi possível listar templates:', templatesRes.reason);
          setTemplateAprovado(null);
        }
      } catch (err) {
        console.warn('[ModalWhatsApp] Erro ao carregar dados para o modal:', err);
        if (!cancelado) {
          setContatos([]);
          setConversaInfo(null);
          setTemplateAprovado(null);
        }
      } finally {
        if (!cancelado) {
          setCarregandoContatos(false);
        }
      }
    };

    carregarDados();

    return () => {
      cancelado = true;
    };
  }, [visivel, os, checklist, nomeOficina]);

  if (!os || !checklist) {
    return null;
  }

  const handleRestaurarPadrao = () => {
    const textoPadrao = gerarTextoLaudoChecklist({ os, checklist, nomeOficina });
    setMensagem(textoPadrao);
  };

  const handleSelecionarContato = (contato: ContatoDaOS) => {
    setContatoSelecionado(contato);
    setTelefone(contato.telefoneExibicao || '');
  };

  // Envio via deep link direto no WhatsApp do smartphone
  const handleAbrirNoWhatsApp = async () => {
    if (!telefone.trim()) {
      Alert.alert(
        'Telefone Ausente',
        'Por favor, selecione ou digite o número de WhatsApp do cliente antes de prosseguir.'
      );
      return;
    }

    if (!mensagem.trim()) {
      Alert.alert('Mensagem Vazia', 'A mensagem do laudo não pode ficar em branco.');
      return;
    }

    const sucesso = await abrirWhatsAppDireto(telefone, mensagem);
    if (sucesso) {
      onFechar();
    }
  };

  // Envio pelo Canal Oficial via API do Backend
  const handleEnviarCanalOficial = async () => {
    if (!mensagem.trim()) {
      Alert.alert('Mensagem Vazia', 'A mensagem do laudo não pode ficar em branco.');
      return;
    }

    setEnviandoOficial(true);
    try {
      await comunicacaoApi.enviarMensagemOficial({
        clienteId: os.clienteId || '',
        contatoId: contatoSelecionado?.id || undefined,
        osId: os.id,
        canal: 'whatsapp',
        corpo: mensagem,
        templateId: templateAprovado?.id || null,
      });

      Alert.alert(
        'Mensagem Enviada!',
        'O laudo foi enviado com sucesso pelo canal oficial de WhatsApp da oficina.'
      );
      if (onSucessoEnvioOficial) {
        onSucessoEnvioOficial();
      }
      onFechar();
    } catch (e: any) {
      const msgErro = extrairMensagemErro(e);
      Alert.alert(
        'Falha no Envio Oficial',
        msgErro ||
          'Não foi possível enviar a mensagem pelo canal oficial. Verifique a integração ou utilize o envio pelo WhatsApp do Celular.'
      );
    } finally {
      setEnviandoOficial(false);
    }
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent
      onRequestClose={onFechar}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fundoModal}
      >
        <View style={styles.containerModal}>
          {/* Cabeçalho */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <View style={styles.headerPlacaLinha}>
                <PlacaVeiculo placa={os.placa} tamanho="pequeno" />
                <Text style={styles.numeroOsText}>OS #{os.numero}</Text>
              </View>
              <Text style={styles.veiculoDescricaoText} numberOfLines={1}>
                {os.veiculoDescricao || 'Veículo'}
              </Text>
              <Text style={styles.clienteNomeText} numberOfLines={1}>
                Cliente: {os.clienteNome || 'Não informado'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.botaoFechar}
              onPress={onFechar}
              accessibilityLabel="Fechar modal"
            >
              <Ionicons name="close" size={24} color={CORES.texto} />
            </TouchableOpacity>
          </View>

          {/* Conteúdo rolável */}
          <ScrollView
            style={styles.scrollConteudo}
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Título de Seção */}
            <View style={styles.tituloSecaoLinha}>
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              <Text style={styles.tituloSecao}>Enviar Laudo de Vistoria</Text>
            </View>

            {/* Status da Janela / Provedor Oficial */}
            {(conversaInfo || templateAprovado) && (
              <View
                style={[
                  styles.badgeCanalOficial,
                  conversaInfo?.janelaAberta || templateAprovado
                    ? styles.badgeJanelaAberta
                    : styles.badgeJanelaFechada,
                ]}
              >
                <Ionicons
                  name={
                    conversaInfo?.janelaAberta
                      ? 'radio-button-on'
                      : templateAprovado
                      ? 'checkmark-done-circle'
                      : 'information-circle'
                  }
                  size={16}
                  color={
                    conversaInfo?.janelaAberta || templateAprovado ? '#22C55E' : '#F59E0B'
                  }
                />
                <Text style={styles.textoBadgeCanalOficial}>
                  {conversaInfo?.janelaAberta
                    ? 'Canal Oficial: Janela de 24h aberta para envio'
                    : templateAprovado
                    ? `Canal Oficial: Template aprovado na Meta (${templateAprovado.nome})`
                    : 'Disparo via deep link do WhatsApp no celular'}
                </Text>
              </View>
            )}

            {/* Seletor de Contatos do Cliente */}
            <View style={styles.secaoBox}>
              <View style={styles.secaoBoxHeader}>
                <Ionicons name="people-outline" size={18} color={CORES.primariaClara} />
                <Text style={styles.secaoBoxTitulo}>Contato do Cliente</Text>
                {carregandoContatos && (
                  <ActivityIndicator size="small" color={CORES.primariaClara} style={{ marginLeft: 6 }} />
                )}
              </View>

              {contatos.length > 0 ? (
                <View style={styles.contatosLista}>
                  {contatos.map((c) => {
                    const selecionado = contatoSelecionado?.id === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.chipContato,
                          selecionado && styles.chipContatoSelecionado,
                        ]}
                        onPress={() => handleSelecionarContato(c)}
                      >
                        <Ionicons
                          name={selecionado ? 'checkmark-circle' : 'person-circle-outline'}
                          size={16}
                          color={selecionado ? '#25D366' : CORES.textoSecundario}
                        />
                        <View style={styles.chipContatoTextoCol}>
                          <Text
                            style={[
                              styles.chipContatoNome,
                              selecionado && styles.chipContatoNomeSelecionado,
                            ]}
                            numberOfLines={1}
                          >
                            {c.nome} {c.principal ? '(Principal)' : ''}
                          </Text>
                          <Text style={styles.chipContatoTelefone}>
                            {c.telefoneExibicao}
                            {c.cargo ? ` • ${c.cargo}` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                !carregandoContatos && (
                  <Text style={styles.textoAvisoSemContatos}>
                    Nenhum contato pré-carregado. Digite o número com DDD abaixo:
                  </Text>
                )
              )}

              {/* Campo para Digitação ou Ajuste Manual do Telefone */}
              <View style={styles.campoTelefoneContainer}>
                <Ionicons name="call-outline" size={18} color={CORES.textoMudo} style={styles.iconeTelefone} />
                <TextInput
                  style={styles.inputTelefone}
                  placeholder="Número de WhatsApp com DDD (ex: 11999998888)"
                  placeholderTextColor={CORES.textoMudo}
                  keyboardType="phone-pad"
                  value={telefone}
                  onChangeText={setTelefone}
                />
              </View>
            </View>

            {/* Prévia Editável da Mensagem */}
            <View style={styles.secaoBox}>
              <View style={styles.secaoBoxHeaderComAcao}>
                <View style={styles.secaoBoxHeader}>
                  <Ionicons name="document-text-outline" size={18} color={CORES.primariaClara} />
                  <Text style={styles.secaoBoxTitulo}>Prévia da Mensagem</Text>
                </View>
                <TouchableOpacity
                  style={styles.botaoRestaurar}
                  onPress={handleRestaurarPadrao}
                >
                  <Ionicons name="refresh-outline" size={14} color={CORES.primariaClara} />
                  <Text style={styles.botaoRestaurarTexto}>Restaurar padrão</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.subtituloEdicao}>
                Você pode revisar ou complementar o laudo antes de disparar:
              </Text>

              <TextInput
                style={styles.inputMensagem}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
                value={mensagem}
                onChangeText={setMensagem}
                placeholder="Texto da notificação do checklist..."
                placeholderTextColor={CORES.textoMudo}
              />
            </View>
          </ScrollView>

          {/* Rodapé com Botões de Envio */}
          <View
            style={[
              styles.rodapeBotoes,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            {/* Opção 1: Abrir no WhatsApp do Celular */}
            <TouchableOpacity
              style={styles.botaoWhatsAppCelular}
              onPress={handleAbrirNoWhatsApp}
            >
              <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
              <View style={styles.botaoWhatsAppCelularTextoCol}>
                <Text style={styles.botaoWhatsAppCelularTitulo}>
                  Abrir no WhatsApp do Celular
                </Text>
                <Text style={styles.botaoWhatsAppCelularSubtitulo}>
                  Dispara direto do seu aplicativo com a mensagem pronta
                </Text>
              </View>
            </TouchableOpacity>

            {/* Opção 2: Enviar pelo Canal Oficial (API do Backend) - exibido apenas com template aprovado na Meta */}
            {templateAprovado && (
              <TouchableOpacity
                style={styles.botaoCanalOficial}
                onPress={handleEnviarCanalOficial}
                disabled={enviandoOficial}
              >
                {enviandoOficial ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                )}
                <View style={styles.botaoCanalOficialTextoCol}>
                  <Text style={styles.botaoCanalOficialTitulo}>
                    {enviandoOficial ? 'Enviando...' : 'Enviar pelo Canal Oficial'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Botão Cancelar */}
            <TouchableOpacity style={styles.botaoCancelar} onPress={onFechar}>
              <Text style={styles.botaoCancelarTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  containerModal: {
    backgroundColor: CORES.fundo,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '92%',
    display: 'flex',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
    backgroundColor: CORES.superficie,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerInfo: {
    flex: 1,
    marginRight: 10,
  },
  headerPlacaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  numeroOsText: {
    color: CORES.primariaClara,
    fontSize: 15,
    fontWeight: '800',
  },
  veiculoDescricaoText: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  clienteNomeText: {
    color: CORES.textoSecundario,
    fontSize: 13,
    marginTop: 1,
  },
  botaoFechar: {
    padding: 4,
  },
  scrollConteudo: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    gap: 14,
  },
  tituloSecaoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  tituloSecao: {
    color: CORES.texto,
    fontSize: 17,
    fontWeight: '800',
  },
  badgeCanalOficial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  badgeJanelaAberta: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  badgeJanelaFechada: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  textoBadgeCanalOficial: {
    color: CORES.texto,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  secaoBox: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  secaoBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  secaoBoxHeaderComAcao: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  secaoBoxTitulo: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
  },
  botaoRestaurar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  botaoRestaurarTexto: {
    color: CORES.primariaClara,
    fontSize: 12,
    fontWeight: '600',
  },
  subtituloEdicao: {
    color: CORES.textoSecundario,
    fontSize: 12,
    marginBottom: 8,
  },
  contatosLista: {
    gap: 8,
    marginBottom: 10,
  },
  chipContato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CORES.superficieClara,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  chipContatoSelecionado: {
    backgroundColor: 'rgba(37, 211, 102, 0.12)',
    borderColor: '#25D366',
  },
  chipContatoTextoCol: {
    flex: 1,
  },
  chipContatoNome: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '700',
  },
  chipContatoNomeSelecionado: {
    color: '#25D366',
  },
  chipContatoTelefone: {
    color: CORES.textoSecundario,
    fontSize: 12,
    marginTop: 1,
  },
  textoAvisoSemContatos: {
    color: CORES.textoMudo,
    fontSize: 12,
    marginBottom: 8,
  },
  campoTelefoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 10,
    height: 44,
  },
  iconeTelefone: {
    marginRight: 8,
  },
  inputTelefone: {
    flex: 1,
    color: CORES.texto,
    fontSize: 14,
  },
  inputMensagem: {
    backgroundColor: CORES.fundo,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
    color: CORES.texto,
    padding: 12,
    fontSize: 13,
    lineHeight: 18,
    minHeight: 160,
    maxHeight: 260,
  },
  rodapeBotoes: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: CORES.superficie,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    gap: 10,
  },
  botaoWhatsAppCelular: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 12,
    elevation: 3,
  },
  botaoWhatsAppCelularTextoCol: {
    flex: 1,
  },
  botaoWhatsAppCelularTitulo: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  botaoWhatsAppCelularSubtitulo: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    marginTop: 1,
  },
  botaoCanalOficial: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 12,
  },
  botaoCanalOficialTextoCol: {
    flex: 1,
  },
  botaoCanalOficialTitulo: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  botaoCanalOficialSubtitulo: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 1,
  },
  botaoCancelar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  botaoCancelarTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
  },
});
