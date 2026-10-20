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
  RespostaOSCompleta,
  RespostaItemPecaOS,
  ContatoDaOS,
  RespostaTemplate,
} from '../types';
import { CORES } from '../constants';
import { osApi } from '../api/osApi';
import { pecasOSApi } from '../api/pecasOSApi';
import { comunicacaoApi } from '../api/comunicacaoApi';
import { extrairMensagemErro } from '../api/clienteHttp';
import { PlacaVeiculo } from './PlacaVeiculo';
import { AutoFLogo } from './AutoFLogo';
import {
  gerarTextoImpressaoOSParaWhatsApp,
  decidirVersaoOS,
  ROTULO_PAGAMENTO,
  abrirWhatsAppDireto,
} from '../utils/whatsappHelper';

interface ModalImprimirOSProps {
  visivel: boolean;
  onFechar: () => void;
  osResumo: RespostaOSResumo | null;
  nomeOficina?: string;
  onSucessoEnvioOficial?: () => void;
}

export const ModalImprimirOS: React.FC<ModalImprimirOSProps> = ({
  visivel,
  onFechar,
  osResumo,
  nomeOficina = 'Auto Peça & Oficina',
  onSucessoEnvioOficial,
}) => {
  const insets = useSafeAreaInsets();

  // Estados de dados completos da OS
  const [osCompleta, setOsCompleta] = useState<RespostaOSCompleta | null>(null);
  const [pecas, setPecas] = useState<RespostaItemPecaOS[]>([]);
  const [carregandoDados, setCarregandoDados] = useState<boolean>(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  // Versão ativa: 'orcamento' ou 'os' (reproduzindo imprimir-os.ts do Web)
  const [versao, setVersao] = useState<'orcamento' | 'os'>('orcamento');

  // WhatsApp e Contatos
  const [mensagemWhatsApp, setMensagemWhatsApp] = useState<string>('');
  const [telefone, setTelefone] = useState<string>('');
  const [contatos, setContatos] = useState<ContatoDaOS[]>([]);
  const [contatoSelecionado, setContatoSelecionado] = useState<ContatoDaOS | null>(null);
  const [templateAprovado, setTemplateAprovado] = useState<RespostaTemplate | null>(null);
  const [enviandoOficial, setEnviandoOficial] = useState<boolean>(false);
  const [abaAtiva, setAbaAtiva] = useState<'documento' | 'whatsapp'>('documento');

  // Carrega os dados da OS, peças e contatos ao abrir
  useEffect(() => {
    if (!visivel || !osResumo) return;

    let cancelado = false;
    const carregar = async () => {
      setCarregandoDados(true);
      setErroCarregamento(null);
      try {
        const versaoSugerida = decidirVersaoOS(osResumo.status);
        setVersao(versaoSugerida);

        const [osRes, pecasRes, conversaRes, templatesRes] = await Promise.allSettled([
          osApi.obterPorId(osResumo.id),
          pecasOSApi.listarPecas(osResumo.id),
          comunicacaoApi.obterConversaDaOS(osResumo.id),
          comunicacaoApi.listarTemplates(),
        ]);

        if (cancelado) return;

        let osDados: RespostaOSCompleta;
        if (osRes.status === 'fulfilled') {
          osDados = osRes.value;
          setOsCompleta(osDados);
        } else {
          // Fallback gracioso com os dados do resumo caso obterPorId falhe
          osDados = {
            ...osResumo,
            kmEntrada: undefined,
            desconto: 0,
            valorServicos: osResumo.valorTotal ?? 0,
            itens: [],
          };
          setOsCompleta(osDados);
        }

        let pecasDados: RespostaItemPecaOS[] = [];
        if (pecasRes.status === 'fulfilled') {
          pecasDados = pecasRes.value || [];
          setPecas(pecasDados);
        }

        // Gera o texto inicial formatado para WhatsApp
        const textoInicial = gerarTextoImpressaoOSParaWhatsApp({
          os: osDados,
          pecas: pecasDados,
          versao: versaoSugerida,
          nomeOficina,
        });
        setMensagemWhatsApp(textoInicial);

        // Processa contatos
        if (conversaRes.status === 'fulfilled') {
          const listaContatos = conversaRes.value?.contatos || [];
          setContatos(listaContatos);

          const contatoPadrao =
            listaContatos.find((c) => c.principal) ||
            listaContatos[0] ||
            null;

          if (contatoPadrao) {
            setContatoSelecionado(contatoPadrao);
            setTelefone(contatoPadrao.telefoneExibicao || '');
          }
        }

        // Processa templates Meta
        if (templatesRes.status === 'fulfilled') {
          const templates = templatesRes.value || [];
          const aprovado = templates.find(
            (t) =>
              (t.canal === 'whatsapp' || !t.canal) &&
              t.ativo !== false &&
              (t.statusAprovacao === 'aprovado' || t.aprovadoNoProvedor === true)
          );
          setTemplateAprovado(aprovado || null);
        }
      } catch (err) {
        if (!cancelado) {
          setErroCarregamento(extrairMensagemErro(err));
        }
      } finally {
        if (!cancelado) {
          setCarregandoDados(false);
        }
      }
    };

    carregar();

    return () => {
      cancelado = true;
    };
  }, [visivel, osResumo, nomeOficina]);

  // Atualiza a mensagem do WhatsApp se o usuário alternar a versão (Orçamento vs OS)
  const handleTrocarVersao = (novaVersao: 'orcamento' | 'os') => {
    setVersao(novaVersao);
    if (osCompleta) {
      const novoTexto = gerarTextoImpressaoOSParaWhatsApp({
        os: osCompleta,
        pecas,
        versao: novaVersao,
        nomeOficina,
      });
      setMensagemWhatsApp(novoTexto);
    }
  };

  const handleRestaurarTexto = () => {
    if (!osCompleta) return;
    const textoPadrao = gerarTextoImpressaoOSParaWhatsApp({
      os: osCompleta,
      pecas,
      versao,
      nomeOficina,
    });
    setMensagemWhatsApp(textoPadrao);
  };

  // Envio direto via deep link do aplicativo WhatsApp
  const handleEnviarWhatsAppDireto = async () => {
    if (!telefone.trim()) {
      Alert.alert(
        'Telefone Ausente',
        'Por favor, selecione ou digite o número de WhatsApp do cliente antes de enviar.'
      );
      return;
    }

    if (!mensagemWhatsApp.trim()) {
      Alert.alert('Mensagem Vazia', 'O texto da OS não pode estar em branco.');
      return;
    }

    const sucesso = await abrirWhatsAppDireto(telefone, mensagemWhatsApp);
    if (sucesso) {
      onFechar();
    }
  };

  // Envio pelo Canal Oficial da API (WABA)
  const handleEnviarCanalOficial = async () => {
    if (!osCompleta) return;
    if (!mensagemWhatsApp.trim()) {
      Alert.alert('Mensagem Vazia', 'O texto da OS não pode estar em branco.');
      return;
    }

    setEnviandoOficial(true);
    try {
      await comunicacaoApi.enviarMensagemOficial({
        clienteId: osCompleta.clienteId || '',
        contatoId: contatoSelecionado?.id || undefined,
        osId: osCompleta.id,
        canal: 'whatsapp',
        corpo: mensagemWhatsApp.trim(),
        templateId: templateAprovado?.id || null,
      });

      Alert.alert(
        'Enviado com Sucesso! 🚀',
        `O documento da OS #${osCompleta.numero} foi enviado pelo canal oficial de WhatsApp da oficina.`
      );

      if (onSucessoEnvioOficial) {
        onSucessoEnvioOficial();
      }
      onFechar();
    } catch (err) {
      Alert.alert('Falha no Envio Oficial', extrairMensagemErro(err));
    } finally {
      setEnviandoOficial(false);
    }
  };

  if (!osResumo) return null;

  // Cálculos financeiros idênticos ao imprimir-os.ts do Web
  const servicos = osCompleta?.itens || [];
  const pecasValidas = pecas.filter(
    (p) => p.status !== 'cancelado' && p.status !== 'cancelada'
  );
  const totalServicos =
    osCompleta?.valorServicos ??
    servicos.reduce((soma, it) => soma + (it.valor || 0), 0);
  const totalPecas = pecasValidas.reduce(
    (soma, it) => soma + (it.total || 0),
    0
  );
  const desconto = osCompleta?.desconto || 0;
  const totalGeral = Math.max(0, totalServicos + totalPecas - desconto);

  const formatarMoeda = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatarDataSimples = (dataStr?: string) => {
    if (!dataStr) return '—';
    try {
      const d = new Date(dataStr);
      if (isNaN(d.getTime())) return dataStr;
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      const hora = String(d.getHours()).padStart(2, '0');
      const minuto = String(d.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
    } catch {
      return dataStr;
    }
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onFechar}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 12 }]}>
        {/* Cabeçalho do Modal */}
        <View style={styles.headerModal}>
          <View style={styles.headerInfo}>
            <View style={styles.headerLinhaTitulo}>
              <Ionicons name="document-text" size={22} color={CORES.primariaClara} />
              <Text style={styles.tituloModal}>
                {versao === 'orcamento' ? 'Imprimir Orçamento' : 'Imprimir Ordem de Serviço'}
              </Text>
            </View>
            <Text style={styles.subtituloModal}>
              OS #{osResumo.numero} · {osResumo.placa} ({osResumo.clienteNome})
            </Text>
          </View>

          <TouchableOpacity onPress={onFechar} style={styles.botaoFechar} accessibilityLabel="Fechar">
            <Ionicons name="close" size={24} color={CORES.texto} />
          </TouchableOpacity>
        </View>

        {/* Abas Superiores: Alternar entre 'Visualizar Folha' e 'Enviar WhatsApp' */}
        <View style={styles.abasNavegacao}>
          <TouchableOpacity
            style={[styles.abaItem, abaAtiva === 'documento' && styles.abaItemAtiva]}
            onPress={() => setAbaAtiva('documento')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="document-text-outline"
              size={18}
              color={abaAtiva === 'documento' ? '#FFFFFF' : CORES.textoMudo}
            />
            <Text
              style={[
                styles.abaItemTexto,
                abaAtiva === 'documento' && styles.abaItemTextoAtivo,
              ]}
            >
              Visualizar Folha
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.abaItem, abaAtiva === 'whatsapp' && styles.abaItemAtivaWhatsApp]}
            onPress={() => setAbaAtiva('whatsapp')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="logo-whatsapp"
              size={18}
              color={abaAtiva === 'whatsapp' ? '#FFFFFF' : '#25D366'}
            />
            <Text
              style={[
                styles.abaItemTexto,
                abaAtiva === 'whatsapp' && styles.abaItemTextoAtivo,
              ]}
            >
              Enviar WhatsApp
            </Text>
          </TouchableOpacity>
        </View>

        {carregandoDados ? (
          <View style={styles.carregandoContainer}>
            <ActivityIndicator size="large" color={CORES.primariaClara} />
            <Text style={styles.carregandoTexto}>Gerando documento da OS...</Text>
          </View>
        ) : erroCarregamento ? (
          <View style={styles.erroContainer}>
            <Ionicons name="alert-circle" size={40} color={CORES.perigo} />
            <Text style={styles.erroTitulo}>Erro ao carregar OS</Text>
            <Text style={styles.erroSubtitulo}>{erroCarregamento}</Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {abaAtiva === 'documento' ? (
              /* ========================================================== */
              /* ABA 1: DOCUMENTO IMPRESSO (REPRODUZINDO imprimir-os.ts)     */
              /* ========================================================== */
              <ScrollView
                style={styles.conteudoScroll}
                contentContainerStyle={[styles.conteudoScrollInner, { paddingBottom: insets.bottom + 100 }]}
                showsVerticalScrollIndicator={false}
              >
                {/* Seletor de Versão (Orçamento vs Ordem de Serviço) */}
                <View style={styles.seletorVersaoContainer}>
                  <Text style={styles.seletorVersaoRotulo}>Tipo de Documento:</Text>
                  <View style={styles.seletorVersaoBotoes}>
                    <TouchableOpacity
                      style={[
                        styles.botaoVersao,
                        versao === 'orcamento' && styles.botaoVersaoAtivo,
                      ]}
                      onPress={() => handleTrocarVersao('orcamento')}
                    >
                      <Ionicons
                        name="calculator-outline"
                        size={16}
                        color={versao === 'orcamento' ? '#FFFFFF' : CORES.textoSecundario}
                      />
                      <Text
                        style={[
                          styles.botaoVersaoTexto,
                          versao === 'orcamento' && styles.botaoVersaoTextoAtivo,
                        ]}
                      >
                        Orçamento
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.botaoVersao,
                        versao === 'os' && styles.botaoVersaoAtivo,
                      ]}
                      onPress={() => handleTrocarVersao('os')}
                    >
                      <Ionicons
                        name="construct-outline"
                        size={16}
                        color={versao === 'os' ? '#FFFFFF' : CORES.textoSecundario}
                      />
                      <Text
                        style={[
                          styles.botaoVersaoTexto,
                          versao === 'os' && styles.botaoVersaoTextoAtivo,
                        ]}
                      >
                        Ordem de Serviço
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Folha do Documento (Visual idêntico à impressão do sistema) */}
                <View style={styles.folhaDocumento}>
                  {/* Topo da Folha: Oficina e Logo */}
                  <View style={styles.folhaHeader}>
                    <View style={styles.folhaOficinaInfo}>
                      <View style={styles.folhaLogoLinha}>
                        <AutoFLogo tamanho="mini" mostrarTexto={false} orientacao="horizontal" />
                        <Text style={styles.folhaNomeOficina} numberOfLines={1}>
                          {nomeOficina}
                        </Text>
                      </View>
                      <Text style={styles.folhaSubtituloOficina}>
                        Sistema de Gestão & Manutenção Automotiva
                      </Text>
                    </View>

                    <View style={styles.folhaBadgeNumero}>
                      <Text style={styles.folhaNumeroTitulo}>
                        {versao === 'orcamento' ? 'ORÇAMENTO' : 'ORDEM DE SERVIÇO'}
                      </Text>
                      <Text style={styles.folhaNumeroValor}>#{osResumo.numero}</Text>
                    </View>
                  </View>

                  <View style={styles.folhaDivisor} />

                  {/* Ficha do Cliente e Veículo */}
                  <View style={styles.fichaGrid}>
                    <View style={styles.fichaItem}>
                      <Text style={styles.fichaRotulo}>CLIENTE</Text>
                      <Text style={styles.fichaValorDestaque}>{osResumo.clienteNome}</Text>
                    </View>

                    <View style={styles.fichaItem}>
                      <Text style={styles.fichaRotulo}>VEÍCULO / PLACA</Text>
                      <View style={styles.placaLinhaDoc}>
                        <PlacaVeiculo placa={osResumo.placa} tamanho="pequeno" />
                        <Text style={styles.fichaValor}>
                          {osResumo.veiculoDescricao}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.fichaLinhaDupla}>
                      <View style={styles.fichaItemMeio}>
                        <Text style={styles.fichaRotulo}>KM DE ENTRADA</Text>
                        <Text style={styles.fichaValor}>
                          {typeof osCompleta?.kmEntrada === 'number'
                            ? `${osCompleta.kmEntrada.toLocaleString('pt-BR')} km`
                            : '—'}
                        </Text>
                      </View>
                      <View style={styles.fichaItemMeio}>
                        <Text style={styles.fichaRotulo}>STATUS ATUAL</Text>
                        <Text style={styles.fichaValor}>
                          {osResumo.statusRotulo || osResumo.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.fichaLinhaDupla}>
                      <View style={styles.fichaItemMeio}>
                        <Text style={styles.fichaRotulo}>ABERTA EM</Text>
                        <Text style={styles.fichaValor}>
                          {formatarDataSimples(osResumo.abertaEm)}
                        </Text>
                      </View>
                      <View style={styles.fichaItemMeio}>
                        <Text style={styles.fichaRotulo}>PREVISÃO DE ENTREGA</Text>
                        <Text style={styles.fichaValor}>
                          {formatarDataSimples(osResumo.previsaoEntrega)}
                        </Text>
                      </View>
                    </View>

                    {versao === 'os' && osCompleta?.formaPagamento && (
                      <View style={styles.fichaItem}>
                        <Text style={styles.fichaRotulo}>FORMA DE PAGAMENTO</Text>
                        <Text style={styles.fichaValor}>
                          {ROTULO_PAGAMENTO[osCompleta.formaPagamento] || osCompleta.formaPagamento}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Queixa do Cliente */}
                  {osCompleta?.queixaCliente ? (
                    <View style={styles.secaoDoc}>
                      <Text style={styles.secaoDocTitulo}>QUEIXA DO CLIENTE</Text>
                      <View style={styles.caixaTextoDoc}>
                        <Text style={styles.caixaTextoDocConteudo}>
                          {osCompleta.queixaCliente}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Diagnóstico */}
                  {osCompleta?.diagnostico ? (
                    <View style={styles.secaoDoc}>
                      <Text style={styles.secaoDocTitulo}>DIAGNÓSTICO TÉCNICO</Text>
                      <View style={styles.caixaTextoDoc}>
                        <Text style={styles.caixaTextoDocConteudo}>
                          {osCompleta.diagnostico}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Tabela de Serviços */}
                  <View style={styles.secaoDoc}>
                    <View style={styles.secaoDocTopoLinha}>
                      <Text style={styles.secaoDocTitulo}>SERVIÇOS EXECUTADOS</Text>
                      <Text style={styles.contadorBadgeDoc}>
                        {servicos.length} {servicos.length === 1 ? 'item' : 'itens'}
                      </Text>
                    </View>

                    {servicos.length === 0 ? (
                      <Text style={styles.textoVazioDoc}>Nenhum serviço lançado nesta OS.</Text>
                    ) : (
                      <View style={styles.tabelaDoc}>
                        <View style={styles.tabelaDocCabecalho}>
                          <Text style={[styles.tabelaDocCabecalhoTexto, { flex: 2 }]}>Serviço</Text>
                          <Text style={[styles.tabelaDocCabecalhoTexto, { flex: 1.2 }]}>Mecânico</Text>
                          <Text style={[styles.tabelaDocCabecalhoTexto, { flex: 0.8, textAlign: 'right' }]}>Garantia</Text>
                          <Text style={[styles.tabelaDocCabecalhoTexto, { flex: 1, textAlign: 'right' }]}>Valor</Text>
                        </View>
                        {servicos.map((item, idx) => (
                          <View
                            key={item.id || idx}
                            style={[
                              styles.tabelaDocLinha,
                              idx % 2 === 1 && styles.tabelaDocLinhaPar,
                            ]}
                          >
                            <Text style={[styles.tabelaDocItemTexto, { flex: 2, fontWeight: '600' }]}>
                              {item.descricao}
                            </Text>
                            <Text style={[styles.tabelaDocItemTexto, { flex: 1.2, color: CORES.textoSecundario }]}>
                              {item.mecanicoNome || '—'}
                            </Text>
                            <Text style={[styles.tabelaDocItemTexto, { flex: 0.8, textAlign: 'right' }]}>
                              {item.garantiaDias ? `${item.garantiaDias}d` : '—'}
                            </Text>
                            <Text style={[styles.tabelaDocItemTexto, { flex: 1, textAlign: 'right', fontWeight: '700' }]}>
                              {formatarMoeda(item.valor || 0)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Tabela de Peças */}
                  <View style={styles.secaoDoc}>
                    <View style={styles.secaoDocTopoLinha}>
                      <Text style={styles.secaoDocTitulo}>PEÇAS E MATERIAIS</Text>
                      <Text style={styles.contadorBadgeDoc}>
                        {pecasValidas.length} {pecasValidas.length === 1 ? 'item' : 'itens'}
                      </Text>
                    </View>

                    {pecasValidas.length === 0 ? (
                      <Text style={styles.textoVazioDoc}>Nenhuma peça vinculada a esta OS.</Text>
                    ) : (
                      <View style={styles.tabelaDoc}>
                        <View style={styles.tabelaDocCabecalho}>
                          <Text style={[styles.tabelaDocCabecalhoTexto, { flex: 2.2 }]}>Peça</Text>
                          <Text style={[styles.tabelaDocCabecalhoTexto, { flex: 0.8, textAlign: 'center' }]}>Qtd</Text>
                          <Text style={[styles.tabelaDocCabecalhoTexto, { flex: 1, textAlign: 'right' }]}>Unit.</Text>
                          <Text style={[styles.tabelaDocCabecalhoTexto, { flex: 1, textAlign: 'right' }]}>Total</Text>
                        </View>
                        {pecasValidas.map((item, idx) => (
                          <View
                            key={item.id || idx}
                            style={[
                              styles.tabelaDocLinha,
                              idx % 2 === 1 && styles.tabelaDocLinhaPar,
                            ]}
                          >
                            <View style={{ flex: 2.2 }}>
                              <Text style={[styles.tabelaDocItemTexto, { fontWeight: '600' }]} numberOfLines={2}>
                                {item.descricao}
                              </Text>
                              {item.codigoInterno ? (
                                <Text style={styles.codigoInternoDoc}>Cód: {item.codigoInterno}</Text>
                              ) : null}
                            </View>
                            <Text style={[styles.tabelaDocItemTexto, { flex: 0.8, textAlign: 'center' }]}>
                              {item.quantidade} {item.unidade || 'UN'}
                            </Text>
                            <Text style={[styles.tabelaDocItemTexto, { flex: 1, textAlign: 'right' }]}>
                              {formatarMoeda(item.precoUnitario || 0)}
                            </Text>
                            <Text style={[styles.tabelaDocItemTexto, { flex: 1, textAlign: 'right', fontWeight: '700' }]}>
                              {formatarMoeda(item.total || 0)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Quadro de Totais */}
                  <View style={styles.quadroTotais}>
                    <View style={styles.linhaTotal}>
                      <Text style={styles.rotuloTotal}>Mão de Obra (Serviços):</Text>
                      <Text style={styles.valorTotalParcial}>{formatarMoeda(totalServicos)}</Text>
                    </View>
                    <View style={styles.linhaTotal}>
                      <Text style={styles.rotuloTotal}>Peças e Materiais:</Text>
                      <Text style={styles.valorTotalParcial}>{formatarMoeda(totalPecas)}</Text>
                    </View>
                    {desconto > 0 ? (
                      <View style={styles.linhaTotal}>
                        <Text style={[styles.rotuloTotal, { color: CORES.sucessoTexto }]}>Desconto Aplicado:</Text>
                        <Text style={[styles.valorTotalParcial, { color: CORES.sucessoTexto }]}>
                          - {formatarMoeda(desconto)}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.divisorTotal} />

                    <View style={styles.linhaTotalDestaque}>
                      <Text style={styles.rotuloTotalGeral}>TOTAL GERAL:</Text>
                      <Text style={styles.valorTotalGeral}>{formatarMoeda(totalGeral)}</Text>
                    </View>
                  </View>

                  {/* Aviso Legal do Documento (idêntico ao Web) */}
                  <View style={styles.avisoLegalCard}>
                    <Ionicons
                      name={versao === 'orcamento' ? 'information-circle' : 'shield-checkmark'}
                      size={20}
                      color={versao === 'orcamento' ? '#F59E0B' : '#10B981'}
                    />
                    <Text style={styles.avisoLegalTexto}>
                      {versao === 'orcamento'
                        ? 'Valores sujeitos a alteração até a confirmação. Peças e serviços adicionais descobertos durante a execução serão orçados à parte e só executados com prévia autorização do cliente.'
                        : 'Serviços executados conforme especificado acima, com a garantia indicada em cada item a contar da data de entrega do veículo.'}
                    </Text>
                  </View>

                  {osCompleta?.observacoes ? (
                    <View style={styles.secaoDoc}>
                      <Text style={styles.secaoDocTitulo}>OBSERVAÇÕES GERAIS</Text>
                      <Text style={styles.observacoesTexto}>{osCompleta.observacoes}</Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            ) : (
              /* ========================================================== */
              /* ABA 2: ENVIAR VIA WHATSAPP AO CLIENTE                       */
              /* ========================================================== */
              <ScrollView
                style={styles.conteudoScroll}
                contentContainerStyle={[styles.conteudoScrollInner, { paddingBottom: insets.bottom + 120 }]}
                keyboardShouldPersistTaps="handled"
              >
                {/* Card do Cliente e Telefone */}
                <View style={styles.cardDestinatarioWhatsApp}>
                  <Text style={styles.cardDestinatarioTitulo}>Destinatário do WhatsApp</Text>

                  {/* Lista de Contatos da OS (se houver mais de um) */}
                  {contatos.length > 1 && (
                    <View style={styles.seletorContatosLinha}>
                      <Text style={styles.subtituloContatos}>Selecione o contato cadastrado:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContatosScroll}>
                        {contatos.map((c) => {
                          const selecionado = contatoSelecionado?.id === c.id;
                          return (
                            <TouchableOpacity
                              key={c.id}
                              style={[styles.chipContato, selecionado && styles.chipContatoSelecionado]}
                              onPress={() => {
                                setContatoSelecionado(c);
                                setTelefone(c.telefoneExibicao || '');
                              }}
                            >
                              <Ionicons
                                name={c.principal ? 'star' : 'person'}
                                size={14}
                                color={selecionado ? '#FFFFFF' : CORES.textoSecundario}
                              />
                              <Text
                                style={[
                                  styles.chipContatoTexto,
                                  selecionado && styles.chipContatoTextoSelecionado,
                                ]}
                              >
                                {c.nome} {c.cargo ? `(${c.cargo})` : ''}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Campo de Telefone com DDD */}
                  <Text style={styles.labelInput}>Número de WhatsApp do Cliente (com DDD)</Text>
                  <View style={styles.inputTelefoneContainer}>
                    <Ionicons name="call" size={18} color={CORES.textoMudo} style={styles.inputIcone} />
                    <TextInput
                      style={styles.inputTelefone}
                      placeholder="(11) 98888-7777"
                      placeholderTextColor={CORES.textoMudo}
                      value={telefone}
                      onChangeText={setTelefone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Pré-visualização da Mensagem formatada */}
                <View style={styles.cardMensagemWhatsApp}>
                  <View style={styles.mensagemTopoLinha}>
                    <Text style={styles.cardDestinatarioTitulo}>Mensagem que será enviada</Text>
                    <TouchableOpacity onPress={handleRestaurarTexto}>
                      <Text style={styles.botaoRestaurarTexto}>Restaurar Padrão</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.dicaEdicaoTexto}>
                    O texto já está formatado com resumo de serviços, peças, valores e termos da OS. Você pode revisar ou complementar:
                  </Text>

                  <TextInput
                    style={styles.inputMensagem}
                    multiline
                    value={mensagemWhatsApp}
                    onChangeText={setMensagemWhatsApp}
                    placeholderTextColor={CORES.textoMudo}
                    textAlignVertical="top"
                  />
                </View>
              </ScrollView>
            )}

            {/* Barra Inferior Fixa com Botão de Ação Imediata */}
            <View style={[styles.barraInferiorAcoes, { paddingBottom: Math.max(insets.bottom, 14) }]}>
              {abaAtiva === 'documento' ? (
                <TouchableOpacity
                  style={styles.botaoAcaoPrincipalWhatsApp}
                  onPress={() => setAbaAtiva('whatsapp')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                  <Text style={styles.botaoAcaoPrincipalTexto}>
                    Enviar este {versao === 'orcamento' ? 'Orçamento' : 'Documento'} via WhatsApp
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.botoesEnvioLinha}>
                  {/* Botão Oficial (se disponível) */}
                  {templateAprovado ? (
                    <TouchableOpacity
                      style={styles.botaoOficial}
                      onPress={handleEnviarCanalOficial}
                      disabled={enviandoOficial}
                      activeOpacity={0.8}
                    >
                      {enviandoOficial ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                          <Text style={styles.botaoOficialTexto}>Canal Oficial</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}

                  {/* Botão Abrir no WhatsApp Direto */}
                  <TouchableOpacity
                    style={[styles.botaoAcaoPrincipalWhatsApp, { flex: 1 }]}
                    onPress={handleEnviarWhatsAppDireto}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                    <Text style={styles.botaoAcaoPrincipalTexto}>
                      Abrir no WhatsApp
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  headerModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
    backgroundColor: CORES.superficie,
  },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  headerLinhaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tituloModal: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
  },
  subtituloModal: {
    color: CORES.textoSecundario,
    fontSize: 13,
    marginTop: 2,
  },
  botaoFechar: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: CORES.superficieClara,
  },
  abasNavegacao: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: CORES.superficie,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  abaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: CORES.superficieClara,
    gap: 6,
  },
  abaItemAtiva: {
    backgroundColor: CORES.primaria,
  },
  abaItemAtivaWhatsApp: {
    backgroundColor: '#16A34A',
  },
  abaItemTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
    fontWeight: '700',
  },
  abaItemTextoAtivo: {
    color: '#FFFFFF',
  },
  carregandoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  carregandoTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
  },
  erroContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  erroTitulo: {
    color: CORES.perigoTexto,
    fontSize: 16,
    fontWeight: '700',
  },
  erroSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
  },
  conteudoScroll: {
    flex: 1,
  },
  conteudoScrollInner: {
    padding: 16,
    gap: 14,
  },
  seletorVersaoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CORES.superficie,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  seletorVersaoRotulo: {
    color: CORES.textoSecundario,
    fontSize: 13,
    fontWeight: '600',
  },
  seletorVersaoBotoes: {
    flexDirection: 'row',
    gap: 8,
  },
  botaoVersao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: CORES.superficieClara,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  botaoVersaoAtivo: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primariaClara,
  },
  botaoVersaoTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '700',
  },
  botaoVersaoTextoAtivo: {
    color: '#FFFFFF',
  },
  folhaDocumento: {
    backgroundColor: CORES.superficie,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  folhaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  folhaOficinaInfo: {
    flex: 1,
    marginRight: 10,
  },
  folhaLogoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  folhaNomeOficina: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  folhaSubtituloOficina: {
    color: CORES.textoMudo,
    fontSize: 11,
    marginTop: 2,
  },
  folhaBadgeNumero: {
    alignItems: 'flex-end',
    backgroundColor: CORES.superficieClara,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  folhaNumeroTitulo: {
    color: CORES.primariaClara,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  folhaNumeroValor: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '900',
  },
  folhaDivisor: {
    height: 1,
    backgroundColor: CORES.bordaSuave,
  },
  fichaGrid: {
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 8,
  },
  fichaItem: {
    gap: 2,
  },
  fichaLinhaDupla: {
    flexDirection: 'row',
    gap: 12,
  },
  fichaItemMeio: {
    flex: 1,
    gap: 2,
  },
  fichaRotulo: {
    color: CORES.textoMudo,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  fichaValorDestaque: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '800',
  },
  fichaValor: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '600',
  },
  placaLinhaDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  secaoDoc: {
    gap: 6,
  },
  secaoDocTopoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secaoDocTitulo: {
    color: CORES.textoSecundario,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  contadorBadgeDoc: {
    color: CORES.textoMudo,
    fontSize: 11,
    fontWeight: '600',
  },
  caixaTextoDoc: {
    backgroundColor: CORES.fundo,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  caixaTextoDocConteudo: {
    color: CORES.texto,
    fontSize: 13,
    lineHeight: 18,
  },
  textoVazioDoc: {
    color: CORES.textoMudo,
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  tabelaDoc: {
    backgroundColor: CORES.fundo,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    overflow: 'hidden',
  },
  tabelaDocCabecalho: {
    flexDirection: 'row',
    backgroundColor: CORES.superficieClara,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  tabelaDocCabecalhoTexto: {
    color: CORES.textoSecundario,
    fontSize: 11,
    fontWeight: '700',
  },
  tabelaDocLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.4)',
  },
  tabelaDocLinhaPar: {
    backgroundColor: 'rgba(30, 41, 59, 0.35)',
  },
  tabelaDocItemTexto: {
    color: CORES.texto,
    fontSize: 12,
  },
  codigoInternoDoc: {
    color: CORES.textoMudo,
    fontSize: 10,
    marginTop: 2,
  },
  quadroTotais: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    padding: 14,
    gap: 6,
  },
  linhaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rotuloTotal: {
    color: CORES.textoSecundario,
    fontSize: 13,
    fontWeight: '600',
  },
  valorTotalParcial: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '700',
  },
  divisorTotal: {
    height: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    marginVertical: 4,
  },
  linhaTotalDestaque: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rotuloTotalGeral: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  valorTotalGeral: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '900',
  },
  avisoLegalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: CORES.fundo,
    padding: 10,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  avisoLegalTexto: {
    flex: 1,
    color: CORES.textoSecundario,
    fontSize: 11,
    lineHeight: 16,
  },
  observacoesTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  cardDestinatarioWhatsApp: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 10,
  },
  cardDestinatarioTitulo: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '800',
  },
  seletorContatosLinha: {
    gap: 6,
  },
  subtituloContatos: {
    color: CORES.textoSecundario,
    fontSize: 12,
  },
  chipsContatosScroll: {
    flexDirection: 'row',
  },
  chipContato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CORES.superficieClara,
    borderWidth: 1,
    borderColor: CORES.borda,
    marginRight: 8,
  },
  chipContatoSelecionado: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primariaClara,
  },
  chipContatoTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '700',
  },
  chipContatoTextoSelecionado: {
    color: '#FFFFFF',
  },
  labelInput: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '600',
  },
  inputTelefoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    borderWidth: 1,
    borderColor: CORES.borda,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputIcone: {
    marginRight: 8,
  },
  inputTelefone: {
    flex: 1,
    height: 44,
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '600',
  },
  cardMensagemWhatsApp: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 8,
  },
  mensagemTopoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  botaoRestaurarTexto: {
    color: CORES.primariaClara,
    fontSize: 12,
    fontWeight: '700',
  },
  dicaEdicaoTexto: {
    color: CORES.textoMudo,
    fontSize: 12,
    lineHeight: 16,
  },
  inputMensagem: {
    backgroundColor: CORES.fundo,
    borderWidth: 1,
    borderColor: CORES.borda,
    borderRadius: 8,
    padding: 12,
    color: CORES.texto,
    fontSize: 13,
    minHeight: 220,
    lineHeight: 19,
  },
  barraInferiorAcoes: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: CORES.superficie,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
  },
  botoesEnvioLinha: {
    flexDirection: 'row',
    gap: 10,
  },
  botaoAcaoPrincipalWhatsApp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  botaoAcaoPrincipalTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  botaoOficial: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.primaria,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  botaoOficialTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
