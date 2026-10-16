import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Modal,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { checklistApi } from '../api/checklistApi';
import {
  PerguntaChecklist,
  RespostaChecklistItem,
  AvariaLocal,
  PedidoChecklist,
} from '../types';
import {
  CORES,
  PERTENCES_SUGERIDOS,
  ROTULOS_SECAO,
  REGIOES_AVARIA,
  TIPOS_AVARIA,
} from '../constants';
import { extrairMensagemErro } from '../api/clienteHttp';
import { PlacaVeiculo } from '../components/PlacaVeiculo';
import { AvariaPhotoCaptureModal } from '../components/AvariaPhotoCaptureModal';
import { SignaturePadModal } from '../components/SignaturePadModal';

interface ChecklistRouteParams {
  osId: string;
  numero: number;
  placa: string;
  veiculoDescricao: string;
  clienteNome: string;
}

const OPCOES_COMBUSTIVEL = [
  { rotulo: 'Reserva (0%)', valor: 0.0 },
  { rotulo: '1/4 (25%)', valor: 0.25 },
  { rotulo: '1/2 (50%)', valor: 0.5 },
  { rotulo: '3/4 (75%)', valor: 0.75 },
  { rotulo: 'Cheio (100%)', valor: 1.0 },
];

export const ChecklistScreen: React.FC = () => {
  const route = useRoute<RouteProp<{ params: ChecklistRouteParams }, 'params'>>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { osId, numero, placa, veiculoDescricao, clienteNome } = route.params;

  // Estado do Wizard (Passos 1 a 5)
  const [passoAtual, setPassoAtual] = useState<number>(1);

  // Passo 1: Dados Básicos
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [km, setKm] = useState<string>('');
  const [nivelCombustivel, setNivelCombustivel] = useState<number>(0.5);
  const [pertencesSelecionados, setPertencesSelecionados] = useState<string[]>([
    'Estepe',
    'Macaco',
    'Chave de roda',
  ]);
  const [novoPertence, setNovoPertence] = useState<string>('');
  const [observacoesGerais, setObservacoesGerais] = useState<string>('');

  // Passo 2: Catálogo de Perguntas
  const [perguntas, setPerguntas] = useState<PerguntaChecklist[]>([]);
  const [respostas, setRespostas] = useState<
    Record<string, { resposta: RespostaChecklistItem; observacao: string }>
  >({});
  const [carregandoPerguntas, setCarregandoPerguntas] = useState<boolean>(true);

  // Passo 3: Avarias
  const [avarias, setAvarias] = useState<AvariaLocal[]>([]);
  const [modalAvariaVisivel, setModalAvariaVisivel] = useState<boolean>(false);

  // Passo 4: Assinatura
  const [assinaturaBase64, setAssinaturaBase64] = useState<string | null>(null);
  const [modalAssinaturaVisivel, setModalAssinaturaVisivel] = useState<boolean>(false);

  // Passo 5: Envio e Progresso
  const [enviando, setEnviando] = useState<boolean>(false);
  const [etapaEnvioTexto, setEtapaEnvioTexto] = useState<string>('');
  const [sucessoConcluido, setSucessoConcluido] = useState<boolean>(false);

  // Carrega o catálogo canônico de perguntas ao montar
  useEffect(() => {
    const carregar = async () => {
      try {
        const dados = await checklistApi.obterPerguntas();
        setPerguntas(dados || []);

        // Inicializa todas como "ok" por padrão para agilizar na oficina
        const inicial: Record<string, { resposta: RespostaChecklistItem; observacao: string }> = {};
        dados.forEach((p) => {
          inicial[p.id] = { resposta: 'ok', observacao: '' };
        });
        setRespostas(inicial);
      } catch (e) {
        console.warn('Erro ao carregar perguntas:', e);
        // Fallback com perguntas canônicas caso a API esteja offline
        const mockPerguntas: PerguntaChecklist[] = [
          { id: 'p1', secao: 'documentacao', pergunta: 'CRLV / Documento do veículo no interior', critico: false, ordem: 1 },
          { id: 'p2', secao: 'exterior', pergunta: 'Pintura geral e lataria sem avarias graves', critico: false, ordem: 2 },
          { id: 'p3', secao: 'interior', pergunta: 'Estofamento e bancos sem rasgos ou manchas', critico: false, ordem: 3 },
          { id: 'p4', secao: 'pneus', pergunta: 'Estado dos pneus e estepe calibrado', critico: true, ordem: 4 },
          { id: 'p5', secao: 'fluidos', pergunta: 'Nível de óleo do motor e arrefecimento', critico: true, ordem: 5 },
          { id: 'p6', secao: 'eletrica', pergunta: 'Faróis, lanternas e setas funcionando', critico: true, ordem: 6 },
          { id: 'p7', secao: 'seguranca', pergunta: 'Cintos de segurança e buzina operantes', critico: true, ordem: 7 },
        ];
        setPerguntas(mockPerguntas);
        const inicial: Record<string, { resposta: RespostaChecklistItem; observacao: string }> = {};
        mockPerguntas.forEach((p) => {
          inicial[p.id] = { resposta: 'ok', observacao: '' };
        });
        setRespostas(inicial);
      } finally {
        setCarregandoPerguntas(false);
      }
    };

    carregar();
  }, []);

  const togglePertence = (item: string) => {
    if (pertencesSelecionados.includes(item)) {
      setPertencesSelecionados((prev) => prev.filter((p) => p !== item));
    } else {
      setPertencesSelecionados((prev) => [...prev, item]);
    }
  };

  const adicionarPertencePersonalizado = () => {
    const texto = novoPertence.trim();
    if (texto && !pertencesSelecionados.includes(texto)) {
      setPertencesSelecionados((prev) => [...prev, texto]);
      setNovoPertence('');
    }
  };

  const atualizarResposta = (
    perguntaId: string,
    resposta: RespostaChecklistItem,
    observacao?: string
  ) => {
    setRespostas((prev) => ({
      ...prev,
      [perguntaId]: {
        resposta,
        observacao: observacao !== undefined ? observacao : prev[perguntaId]?.observacao || '',
      },
    }));
  };

  const handleSalvarAvaria = (novaAvaria: AvariaLocal) => {
    setAvarias((prev) => [...prev, novaAvaria]);
  };

  const removerAvaria = (id: string) => {
    setAvarias((prev) => prev.filter((a) => a.id !== id));
  };

  // Validação do Passo 1
  const validarPasso1 = (): boolean => {
    const kmNum = parseInt(km, 10);
    if (isNaN(kmNum) || kmNum <= 0) {
      Alert.alert('Quilometragem obrigatória', 'Informe o odômetro atual (KM) do veículo.');
      return false;
    }
    return true;
  };

  // Validação do Passo 4
  const validarPasso4 = (): boolean => {
    if (!assinaturaBase64) {
      Alert.alert('Assinatura necessária', 'Por favor, colha a assinatura do cliente na tela antes de avançar.');
      return false;
    }
    return true;
  };

  const avancarPasso = () => {
    if (passoAtual === 1 && !validarPasso1()) return;
    if (passoAtual === 4 && !validarPasso4()) return;
    if (passoAtual < 5) {
      setPassoAtual((prev) => prev + 1);
    }
  };

  const voltarPasso = () => {
    if (passoAtual > 1) {
      setPassoAtual((prev) => prev - 1);
    } else {
      Alert.alert(
        'Descartar checklist?',
        'Deseja sair do checklist? As informações preenchidas não serão salvas.',
        [
          { text: 'Continuar Preenchendo', style: 'cancel' },
          { text: 'Sair', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    }
  };

  // Agrupa perguntas por seção
  const secoesAgrupadas = React.useMemo(() => {
    const grupos: Record<string, PerguntaChecklist[]> = {};
    perguntas.forEach((p) => {
      const s = p.secao || 'geral';
      if (!grupos[s]) grupos[s] = [];
      grupos[s].push(p);
    });
    return grupos;
  }, [perguntas]);

  // Contagem de alertas no checklist
  const totalCriticos = Object.values(respostas).filter((r) => r.resposta === 'critico').length;
  const totalAtencao = Object.values(respostas).filter((r) => r.resposta === 'atencao').length;

  // Submissão do Checklist Completo
  const submeterChecklist = async () => {
    setEnviando(true);
    setEtapaEnvioTexto('Iniciando envio do checklist...');

    try {
      // 1. Upload das fotos das avarias
      const avariasParaEnvio: Array<{
        regiao: string;
        tipo: string;
        descricao: string;
        fotoUrl: string;
      }> = [];

      for (let i = 0; i < avarias.length; i++) {
        const a = avarias[i];
        let caminhoFoto = '';

        if (a.localUri) {
          setEtapaEnvioTexto(`Enviando foto da avaria (${i + 1}/${avarias.length})...`);
          const dadosUpload = await checklistApi.pedirUrlUpload(
            'avarias',
            `avaria_${Date.now()}_${i}.jpg`,
            'image/jpeg'
          );
          await checklistApi.enviarFotoArquivo(
            dadosUpload.urlDeEnvio,
            a.localUri,
            'image/jpeg'
          );
          caminhoFoto = dadosUpload.caminho;
        }

        avariasParaEnvio.push({
          regiao: a.regiao,
          tipo: a.tipo,
          descricao: a.descricao,
          fotoUrl: caminhoFoto,
        });
      }

      // 2. Upload da assinatura
      setEtapaEnvioTexto('Enviando assinatura digital do cliente...');
      let caminhoAssinatura = '';
      if (assinaturaBase64) {
        const dadosUploadAssinatura = await checklistApi.pedirUrlUpload(
          'assinaturas',
          `assinatura_${Date.now()}.png`,
          'image/png'
        );
        await checklistApi.enviarAssinaturaBase64(
          dadosUploadAssinatura.urlDeEnvio,
          assinaturaBase64
        );
        caminhoAssinatura = dadosUploadAssinatura.caminho;
      }

      // 3. Monta o payload final
      setEtapaEnvioTexto('Gravando checklist na Ordem de Serviço...');
      const itensEnvio = Object.entries(respostas).map(([perguntaId, item]) => ({
        perguntaId,
        resposta: item.resposta,
        observacao: item.observacao,
      }));

      const payload: PedidoChecklist = {
        tipo,
        km: parseInt(km, 10),
        nivelCombustivel,
        observacoes: observacoesGerais.trim() || undefined,
        pertences: pertencesSelecionados,
        assinaturaUrl: caminhoAssinatura,
        itens: itensEnvio,
        avarias: avariasParaEnvio,
        confirmarKmMenor: false,
      };

      await checklistApi.gravarChecklist(osId, payload);

      setEtapaEnvioTexto('Checklist gravado com sucesso!');
      setSucessoConcluido(true);

      setTimeout(() => {
        setEnviando(false);
        navigation.goBack();
      }, 1500);
    } catch (e) {
      setEnviando(false);
      Alert.alert('Erro ao gravar checklist', extrairMensagemErro(e));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabeçalho da OS */}
      <View style={styles.header}>
        <TouchableOpacity onPress={voltarPasso} style={styles.botaoVoltar}>
          <Ionicons name="arrow-back" size={24} color={CORES.texto} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={styles.headerLinha1}>
            <PlacaVeiculo placa={placa} tamanho="pequeno" />
            <Text style={styles.headerNumeroOS}>OS #{numero}</Text>
          </View>
          <Text style={styles.headerVeiculo} numberOfLines={1}>
            {veiculoDescricao}
          </Text>
        </View>

        <View style={styles.passoIndicadorBadge}>
          <Text style={styles.passoIndicadorTexto}>{passoAtual}/5</Text>
        </View>
      </View>

      {/* Barra de Progresso do Wizard */}
      <View style={styles.barraProgressoContainer}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              styles.segmentoProgresso,
              i <= passoAtual && styles.segmentoProgressoAtivo,
            ]}
          />
        ))}
      </View>

      {/* Conteúdo do Passo Atual */}
      <ScrollView contentContainerStyle={styles.scrollConteudo} keyboardShouldPersistTaps="handled">
        {/* ============================================================== */}
        {/* PASSO 1: DADOS BÁSICOS (KM, COMBUSTÍVEL, TIPO, PERTENCES)      */}
        {/* ============================================================== */}
        {passoAtual === 1 && (
          <View style={styles.passoBox}>
            <Text style={styles.passoTitulo}>Passo 1: Dados Básicos da Recepção</Text>

            {/* Tipo: Entrada ou Saída */}
            <Text style={styles.campoLabel}>Tipo do Checklist</Text>
            <View style={styles.tipoLinha}>
              <TouchableOpacity
                style={[styles.tipoBotao, tipo === 'entrada' && styles.tipoBotaoAtivo]}
                onPress={() => setTipo('entrada')}
              >
                <Ionicons
                  name="log-in-outline"
                  size={20}
                  color={tipo === 'entrada' ? '#FFFFFF' : CORES.textoSecundario}
                />
                <Text style={[styles.tipoBotaoTexto, tipo === 'entrada' && styles.tipoBotaoTextoAtivo]}>
                  Entrada (Recepção)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tipoBotao, tipo === 'saida' && styles.tipoBotaoAtivo]}
                onPress={() => setTipo('saida')}
              >
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color={tipo === 'saida' ? '#FFFFFF' : CORES.textoSecundario}
                />
                <Text style={[styles.tipoBotaoTexto, tipo === 'saida' && styles.tipoBotaoTextoAtivo]}>
                  Saída (Entrega)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Odômetro KM */}
            <Text style={styles.campoLabel}>Odômetro Atual (KM) *</Text>
            <View style={styles.kmInputLinha}>
              <Ionicons name="speedometer-outline" size={22} color={CORES.primariaClara} />
              <TextInput
                style={styles.kmInput}
                placeholder="Ex: 85400"
                placeholderTextColor={CORES.textoMudo}
                keyboardType="numeric"
                value={km}
                onChangeText={setKm}
              />
              <Text style={styles.kmSufixo}>KM</Text>
            </View>

            {/* Marcador de Combustível */}
            <Text style={styles.campoLabel}>Nível do Tanque de Combustível</Text>
            <View style={styles.combustivelGrid}>
              {OPCOES_COMBUSTIVEL.map((op) => {
                const ativo = Math.abs(nivelCombustivel - op.valor) < 0.05;
                return (
                  <TouchableOpacity
                    key={op.valor}
                    style={[styles.chipCombustivel, ativo && styles.chipCombustivelAtivo]}
                    onPress={() => setNivelCombustivel(op.valor)}
                  >
                    <Ionicons
                      name="water"
                      size={14}
                      color={ativo ? '#FFFFFF' : CORES.textoSecundario}
                    />
                    <Text
                      style={[
                        styles.chipCombustivelTexto,
                        ativo && styles.chipCombustivelTextoAtivo,
                      ]}
                    >
                      {op.rotulo}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Pertences no Porta-Malas / Cabine */}
            <Text style={styles.campoLabel}>Pertences / Objetos Deixados no Carro</Text>
            <View style={styles.pertencesGrid}>
              {PERTENCES_SUGERIDOS.map((item) => {
                const marcado = pertencesSelecionados.includes(item);
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chipPertence, marcado && styles.chipPertenceAtivo]}
                    onPress={() => togglePertence(item)}
                  >
                    <Ionicons
                      name={marcado ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={marcado ? '#38BDF8' : CORES.textoMudo}
                    />
                    <Text
                      style={[
                        styles.chipPertenceTexto,
                        marcado && styles.chipPertenceTextoAtivo,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Adicionar Pertence Personalizado */}
            <View style={styles.novoPertenceLinha}>
              <TextInput
                style={styles.novoPertenceInput}
                placeholder="Outro pertence (ex: Mochila, Guarda-chuva)..."
                placeholderTextColor={CORES.textoMudo}
                value={novoPertence}
                onChangeText={setNovoPertence}
              />
              <TouchableOpacity
                style={styles.novoPertenceBotao}
                onPress={adicionarPertencePersonalizado}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Observações Gerais */}
            <Text style={styles.campoLabel}>Observações Gerais</Text>
            <TextInput
              style={styles.inputArea}
              placeholder="Ex: Cliente relatou barulho na suspensão dianteira ao passar em lombadas..."
              placeholderTextColor={CORES.textoMudo}
              multiline
              numberOfLines={3}
              value={observacoesGerais}
              onChangeText={setObservacoesGerais}
            />
          </View>
        )}

        {/* ============================================================== */}
        {/* PASSO 2: VISTORIA RÁPIDA (PERGUNTAS DO CATÁLOGO)               */}
        {/* ============================================================== */}
        {passoAtual === 2 && (
          <View style={styles.passoBox}>
            <View style={styles.vistoriaHeaderLinha}>
              <View>
                <Text style={styles.passoTitulo}>Passo 2: Vistoria Rápida</Text>
                <Text style={styles.passoSubtitulo}>
                  Toque nos botões para classificar cada item
                </Text>
              </View>

              <View style={styles.vistoriaContadores}>
                {totalCriticos > 0 && (
                  <View style={styles.contadorCritico}>
                    <Text style={styles.contadorCriticoTexto}>{totalCriticos} Críticos</Text>
                  </View>
                )}
                {totalAtencao > 0 && (
                  <View style={styles.contadorAtencao}>
                    <Text style={styles.contadorAtencaoTexto}>{totalAtencao} Atenção</Text>
                  </View>
                )}
              </View>
            </View>

            {carregandoPerguntas ? (
              <ActivityIndicator size="large" color={CORES.primaria} style={{ margin: 30 }} />
            ) : (
              Object.entries(secoesAgrupadas).map(([secao, itens]) => {
                const infoSecao = ROTULOS_SECAO[secao] || { titulo: secao, icone: 'list' };

                return (
                  <View key={secao} style={styles.secaoCard}>
                    <View style={styles.secaoHeader}>
                      <Ionicons name="shield-checkmark-outline" size={18} color={CORES.primariaClara} />
                      <Text style={styles.secaoTitulo}>{infoSecao.titulo}</Text>
                    </View>

                    {itens.map((pergunta) => {
                      const respostaAtual = respostas[pergunta.id]?.resposta || 'ok';
                      const obsAtual = respostas[pergunta.id]?.observacao || '';
                      const precisaObs = respostaAtual === 'atencao' || respostaAtual === 'critico';

                      return (
                        <View key={pergunta.id} style={styles.perguntaItem}>
                          <View style={styles.perguntaTextoLinha}>
                            <Text style={styles.perguntaTexto}>{pergunta.pergunta}</Text>
                            {pergunta.critico && (
                              <Text style={styles.criticoTag}>SEGURANÇA</Text>
                            )}
                          </View>

                          {/* 4 Botões Grandes de Toque Rápido */}
                          <View style={styles.respostasLinha}>
                            <TouchableOpacity
                              style={[
                                styles.respostaBotao,
                                styles.botaoOK,
                                respostaAtual === 'ok' && styles.botaoOKAtivo,
                              ]}
                              onPress={() => atualizarResposta(pergunta.id, 'ok')}
                            >
                              <Text
                                style={[
                                  styles.respostaBotaoTexto,
                                  respostaAtual === 'ok' && styles.respostaBotaoTextoAtivo,
                                ]}
                              >
                                OK
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.respostaBotao,
                                styles.botaoAtencao,
                                respostaAtual === 'atencao' && styles.botaoAtencaoAtivo,
                              ]}
                              onPress={() => atualizarResposta(pergunta.id, 'atencao')}
                            >
                              <Text
                                style={[
                                  styles.respostaBotaoTexto,
                                  respostaAtual === 'atencao' && styles.respostaBotaoTextoAtivo,
                                ]}
                              >
                                Atenção
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.respostaBotao,
                                styles.botaoCritico,
                                respostaAtual === 'critico' && styles.botaoCriticoAtivo,
                              ]}
                              onPress={() => atualizarResposta(pergunta.id, 'critico')}
                            >
                              <Text
                                style={[
                                  styles.respostaBotaoTexto,
                                  respostaAtual === 'critico' && styles.respostaBotaoTextoAtivo,
                                ]}
                              >
                                Crítico
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.respostaBotao,
                                styles.botaoNA,
                                respostaAtual === 'na' && styles.botaoNAAtivo,
                              ]}
                              onPress={() => atualizarResposta(pergunta.id, 'na')}
                            >
                              <Text
                                style={[
                                  styles.respostaBotaoTexto,
                                  respostaAtual === 'na' && styles.respostaBotaoTextoAtivo,
                                ]}
                              >
                                N/A
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Campo de observação aberto quando marcado Atenção ou Crítico */}
                          {precisaObs && (
                            <TextInput
                              style={styles.inputObsPergunta}
                              placeholder="Descreva o problema observado neste item..."
                              placeholderTextColor={CORES.textoMudo}
                              value={obsAtual}
                              onChangeText={(texto) =>
                                atualizarResposta(pergunta.id, respostaAtual, texto)
                              }
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ============================================================== */}
        {/* PASSO 3: AVARIAS DO VEÍCULO (FOTOS COM CÂMERA & REGIÕES)       */}
        {/* ============================================================== */}
        {passoAtual === 3 && (
          <View style={styles.passoBox}>
            <View style={styles.vistoriaHeaderLinha}>
              <View>
                <Text style={styles.passoTitulo}>Passo 3: Avarias & Lataria</Text>
                <Text style={styles.passoSubtitulo}>
                  Registre arranhões, mossas ou peças ausentes com foto
                </Text>
              </View>

              <TouchableOpacity
                style={styles.botaoAdicionarAvaria}
                onPress={() => setModalAvariaVisivel(true)}
              >
                <Ionicons name="camera" size={18} color="#FFFFFF" />
                <Text style={styles.botaoAdicionarAvariaTexto}>Nova Avaria</Text>
              </TouchableOpacity>
            </View>

            {avarias.length === 0 ? (
              <View style={styles.avariasVazioBox}>
                <Ionicons name="car-outline" size={48} color={CORES.borda} />
                <Text style={styles.avariasVazioTitulo}>Nenhuma avaria catalogada</Text>
                <Text style={styles.avariasVazioSubtitulo}>
                  Se o carro estiver intacto, prossiga para a assinatura. Caso encontre riscos ou amassados, clique no botão acima para fotografar.
                </Text>
              </View>
            ) : (
              <View style={styles.avariasLista}>
                {avarias.map((avaria, index) => {
                  const regiaoLabel =
                    REGIOES_AVARIA.find((r) => r.id === avaria.regiao)?.rotulo || avaria.regiao;
                  const tipoLabel =
                    TIPOS_AVARIA.find((t) => t.id === avaria.tipo)?.rotulo || avaria.tipo;

                  return (
                    <View key={avaria.id} style={styles.cardAvariaItem}>
                      {avaria.localUri ? (
                        <Image source={{ uri: avaria.localUri }} style={styles.avariaMiniatura} />
                      ) : (
                        <View style={[styles.avariaMiniatura, styles.avariaSemFoto]}>
                          <Ionicons name="image-outline" size={24} color={CORES.textoMudo} />
                        </View>
                      )}

                      <View style={styles.avariaInfo}>
                        <View style={styles.avariaTagsLinha}>
                          <View style={styles.tagRegiao}>
                            <Text style={styles.tagRegiaoTexto}>{regiaoLabel}</Text>
                          </View>
                          <View style={styles.tagTipo}>
                            <Text style={styles.tagTipoTexto}>{tipoLabel}</Text>
                          </View>
                        </View>
                        <Text style={styles.avariaDescricaoTexto}>{avaria.descricao}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.botaoExcluirAvaria}
                        onPress={() => removerAvaria(avaria.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color={CORES.perigoTexto} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ============================================================== */}
        {/* PASSO 4: ASSINATURA DO CLIENTE                                 */}
        {/* ============================================================== */}
        {passoAtual === 4 && (
          <View style={styles.passoBox}>
            <Text style={styles.passoTitulo}>Passo 4: Assinatura do Cliente</Text>
            <Text style={styles.passoSubtitulo}>
              Colha o aceite das condições e pertences do veículo
            </Text>

            <View style={styles.termoBox}>
              <Text style={styles.termoTexto}>
                "Declaro ter conferido o odômetro ({km} KM), nível de combustível e a vistoria de
                pertences e avarias descritas neste documento de {tipo === 'entrada' ? 'recepção' : 'entrega'}."
              </Text>
            </View>

            {assinaturaBase64 ? (
              <View style={styles.assinaturaPreviewBox}>
                <Image
                  source={{ uri: assinaturaBase64 }}
                  style={styles.assinaturaImagem}
                  resizeMode="contain"
                />
                <View style={styles.assinaturaConfirmadaBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={CORES.sucessoTexto} />
                  <Text style={styles.assinaturaConfirmadaTexto}>Assinatura Colhida</Text>
                </View>

                <TouchableOpacity
                  style={styles.botaoRefazerAssinatura}
                  onPress={() => setModalAssinaturaVisivel(true)}
                >
                  <Ionicons name="refresh" size={16} color={CORES.texto} />
                  <Text style={styles.botaoRefazerAssinaturaTexto}>Refazer Assinatura</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.botaoAbrirAssinatura}
                onPress={() => setModalAssinaturaVisivel(true)}
              >
                <Ionicons name="pencil" size={32} color={CORES.primariaClara} />
                <Text style={styles.botaoAbrirAssinaturaTitulo}>Tocar para Assinar na Tela</Text>
                <Text style={styles.botaoAbrirAssinaturaSubtitulo}>
                  O cliente assina diretamente com o dedo
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ============================================================== */}
        {/* PASSO 5: REVISÃO GERAL E GRAVAÇÃO                             */}
        {/* ============================================================== */}
        {passoAtual === 5 && (
          <View style={styles.passoBox}>
            <Text style={styles.passoTitulo}>Passo 5: Revisão & Envio</Text>
            <Text style={styles.passoSubtitulo}>
              Confira os dados antes de gravar definitivamente na OS #{numero}
            </Text>

            <View style={styles.resumoCard}>
              <View style={styles.resumoLinha}>
                <Text style={styles.resumoLabel}>Tipo:</Text>
                <Text style={styles.resumoValor}>{tipo.toUpperCase()}</Text>
              </View>
              <View style={styles.resumoLinha}>
                <Text style={styles.resumoLabel}>Odômetro:</Text>
                <Text style={styles.resumoValor}>{km} KM</Text>
              </View>
              <View style={styles.resumoLinha}>
                <Text style={styles.resumoLabel}>Combustível:</Text>
                <Text style={styles.resumoValor}>{Math.round(nivelCombustivel * 100)}%</Text>
              </View>
              <View style={styles.resumoLinha}>
                <Text style={styles.resumoLabel}>Pertences:</Text>
                <Text style={styles.resumoValor}>{pertencesSelecionados.length} itens</Text>
              </View>
              <View style={styles.resumoLinha}>
                <Text style={styles.resumoLabel}>Avarias com Foto:</Text>
                <Text style={styles.resumoValor}>{avarias.length} avarias</Text>
              </View>
              <View style={styles.resumoLinha}>
                <Text style={styles.resumoLabel}>Pendências Críticas:</Text>
                <Text style={[styles.resumoValor, totalCriticos > 0 && { color: CORES.perigoTexto }]}>
                  {totalCriticos}
                </Text>
              </View>
              <View style={styles.resumoLinha}>
                <Text style={styles.resumoLabel}>Assinatura do Cliente:</Text>
                <Text style={[styles.resumoValor, { color: CORES.sucessoTexto }]}>
                  {assinaturaBase64 ? '✓ Presente' : 'Ausente'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.botaoGravarFinal} onPress={submeterChecklist}>
              <Ionicons name="cloud-upload" size={24} color="#FFFFFF" />
              <Text style={styles.botaoGravarFinalTexto}>Gravar Checklist na OS</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Barra de Navegação Inferior (Avançar / Voltar) */}
      <View style={styles.barraNavegacao}>
        <TouchableOpacity style={styles.botaoNavegacaoVoltar} onPress={voltarPasso}>
          <Ionicons name="arrow-back" size={18} color={CORES.textoSecundario} />
          <Text style={styles.botaoNavegacaoVoltarTexto}>
            {passoAtual === 1 ? 'Cancelar' : 'Voltar'}
          </Text>
        </TouchableOpacity>

        {passoAtual < 5 && (
          <TouchableOpacity style={styles.botaoNavegacaoAvancar} onPress={avancarPasso}>
            <Text style={styles.botaoNavegacaoAvancarTexto}>
              {passoAtual === 4 ? 'Ir para Revisão' : 'Próximo Passo'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Modal para Adicionar Avaria */}
      <AvariaPhotoCaptureModal
        visivel={modalAvariaVisivel}
        aoFechar={() => setModalAvariaVisivel(false)}
        aoSalvar={handleSalvarAvaria}
      />

      {/* Modal para Assinatura do Cliente */}
      <SignaturePadModal
        visivel={modalAssinaturaVisivel}
        aoFechar={() => setModalAssinaturaVisivel(false)}
        aoConfirmar={(base64) => setAssinaturaBase64(base64)}
      />

      {/* Modal de Progresso do Envio */}
      <Modal visible={enviando} transparent animationType="fade">
        <View style={styles.fundoModalEnvio}>
          <View style={styles.cardModalEnvio}>
            {sucessoConcluido ? (
              <Ionicons name="checkmark-circle" size={60} color={CORES.sucesso} />
            ) : (
              <ActivityIndicator size="large" color={CORES.primaria} />
            )}
            <Text style={styles.tituloModalEnvio}>
              {sucessoConcluido ? 'Sucesso!' : 'Enviando Checklist'}
            </Text>
            <Text style={styles.textoEtapaEnvio}>{etapaEnvioTexto}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CORES.superficie,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  botaoVoltar: {
    padding: 6,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerLinha1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerNumeroOS: {
    color: CORES.primariaClara,
    fontSize: 14,
    fontWeight: '800',
  },
  headerVeiculo: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  passoIndicadorBadge: {
    backgroundColor: CORES.superficieClara,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  passoIndicadorTexto: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '800',
  },
  barraProgressoContainer: {
    flexDirection: 'row',
    height: 4,
    backgroundColor: CORES.superficieClara,
  },
  segmentoProgresso: {
    flex: 1,
    height: 4,
    backgroundColor: 'transparent',
  },
  segmentoProgressoAtivo: {
    backgroundColor: CORES.primaria,
  },
  scrollConteudo: {
    padding: 16,
    paddingBottom: 40,
  },
  passoBox: {
    gap: 16,
  },
  passoTitulo: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
  },
  passoSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 13,
    marginTop: 2,
  },
  campoLabel: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  tipoLinha: {
    flexDirection: 'row',
    gap: 12,
  },
  tipoBotao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.borda,
    gap: 8,
  },
  tipoBotaoAtivo: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primariaClara,
  },
  tipoBotaoTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
  },
  tipoBotaoTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  kmInputLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 12,
  },
  kmInput: {
    flex: 1,
    height: 48,
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  kmSufixo: {
    color: CORES.textoSecundario,
    fontSize: 14,
    fontWeight: '700',
  },
  combustivelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipCombustivel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  chipCombustivelAtivo: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  chipCombustivelTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '600',
  },
  chipCombustivelTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pertencesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipPertence: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 6,
  },
  chipPertenceAtivo: {
    borderColor: '#0284C7',
    backgroundColor: '#0C4A6E',
  },
  chipPertenceTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
  },
  chipPertenceTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  novoPertenceLinha: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  novoPertenceInput: {
    flex: 1,
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.borda,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: CORES.texto,
    fontSize: 13,
  },
  novoPertenceBotao: {
    backgroundColor: CORES.primaria,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  inputArea: {
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.borda,
    borderRadius: 10,
    padding: 12,
    color: CORES.texto,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  vistoriaHeaderLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  vistoriaContadores: {
    flexDirection: 'row',
    gap: 6,
  },
  contadorCritico: {
    backgroundColor: CORES.perigoFundo,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  contadorCriticoTexto: {
    color: CORES.perigoTexto,
    fontSize: 11,
    fontWeight: '800',
  },
  contadorAtencao: {
    backgroundColor: CORES.alertaFundo,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  contadorAtencaoTexto: {
    color: CORES.alertaTexto,
    fontSize: 11,
    fontWeight: '800',
  },
  secaoCard: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 12,
  },
  secaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
    paddingBottom: 8,
  },
  secaoTitulo: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '800',
  },
  perguntaItem: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  perguntaTextoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  perguntaTexto: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  criticoTag: {
    backgroundColor: CORES.perigoFundo,
    color: CORES.perigoTexto,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  respostasLinha: {
    flexDirection: 'row',
    gap: 6,
  },
  respostaBotao: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  respostaBotaoTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
  respostaBotaoTextoAtivo: {
    color: '#FFFFFF',
  },
  botaoOK: {
    backgroundColor: CORES.superficieClara,
    borderColor: CORES.borda,
  },
  botaoOKAtivo: {
    backgroundColor: CORES.sucesso,
    borderColor: '#4ADE80',
  },
  botaoAtencao: {
    backgroundColor: CORES.superficieClara,
    borderColor: CORES.borda,
  },
  botaoAtencaoAtivo: {
    backgroundColor: CORES.alerta,
    borderColor: '#FDE047',
  },
  botaoCritico: {
    backgroundColor: CORES.superficieClara,
    borderColor: CORES.borda,
  },
  botaoCriticoAtivo: {
    backgroundColor: CORES.perigo,
    borderColor: '#FCA5A5',
  },
  botaoNA: {
    backgroundColor: CORES.superficieClara,
    borderColor: CORES.borda,
  },
  botaoNAAtivo: {
    backgroundColor: CORES.cinza,
    borderColor: '#94A3B8',
  },
  inputObsPergunta: {
    marginTop: 8,
    backgroundColor: CORES.fundo,
    borderWidth: 1,
    borderColor: CORES.borda,
    borderRadius: 6,
    padding: 8,
    color: CORES.texto,
    fontSize: 12,
  },
  botaoAdicionarAvaria: {
    backgroundColor: CORES.primaria,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  botaoAdicionarAvariaTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  avariasVazioBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  avariasVazioTitulo: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  avariasVazioSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  avariasLista: {
    gap: 10,
  },
  cardAvariaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 10,
  },
  avariaMiniatura: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  avariaSemFoto: {
    backgroundColor: CORES.superficieClara,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avariaInfo: {
    flex: 1,
    gap: 4,
  },
  avariaTagsLinha: {
    flexDirection: 'row',
    gap: 6,
  },
  tagRegiao: {
    backgroundColor: '#0C4A6E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagRegiaoTexto: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  tagTipo: {
    backgroundColor: '#78350F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagTipoTexto: {
    color: '#FDE68A',
    fontSize: 10,
    fontWeight: '700',
  },
  avariaDescricaoTexto: {
    color: CORES.texto,
    fontSize: 13,
  },
  botaoExcluirAvaria: {
    padding: 8,
  },
  termoBox: {
    backgroundColor: CORES.superficie,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  termoTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  botaoAbrirAssinatura: {
    backgroundColor: CORES.superficie,
    borderWidth: 2,
    borderColor: CORES.primaria,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botaoAbrirAssinaturaTitulo: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '700',
  },
  botaoAbrirAssinaturaSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 12,
  },
  assinaturaPreviewBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  assinaturaImagem: {
    width: '100%',
    height: 160,
  },
  assinaturaConfirmadaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.sucessoFundo,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  assinaturaConfirmadaTexto: {
    color: CORES.sucessoTexto,
    fontSize: 13,
    fontWeight: '700',
  },
  botaoRefazerAssinatura: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficieClara,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  botaoRefazerAssinaturaTexto: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '600',
  },
  resumoCard: {
    backgroundColor: CORES.superficie,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 10,
  },
  resumoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  resumoLabel: {
    color: CORES.textoSecundario,
    fontSize: 14,
  },
  resumoValor: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
  },
  botaoGravarFinal: {
    backgroundColor: CORES.sucesso,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    elevation: 4,
  },
  botaoGravarFinalTexto: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  barraNavegacao: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: CORES.superficie,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    gap: 12,
  },
  botaoNavegacaoVoltar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
    gap: 6,
  },
  botaoNavegacaoVoltarTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
  },
  botaoNavegacaoAvancar: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: CORES.primaria,
    gap: 6,
  },
  botaoNavegacaoAvancarTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  fundoModalEnvio: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cardModalEnvio: {
    backgroundColor: CORES.superficie,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    gap: 14,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  tituloModalEnvio: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
  },
  textoEtapaEnvio: {
    color: CORES.textoSecundario,
    fontSize: 14,
    textAlign: 'center',
  },
});
