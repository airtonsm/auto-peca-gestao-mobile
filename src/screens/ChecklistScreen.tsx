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
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { checklistApi } from '../api/checklistApi';
import {
  PerguntaChecklist,
  RespostaChecklistItem,
  AvariaLocal,
  PedidoChecklist,
  RegiaoAvaria,
  TipoAvaria,
  RespostaChecklist,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { ModalEnviarWhatsAppChecklist } from '../components/ModalEnviarWhatsAppChecklist';
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
import { CameraCaptureModal } from '../components/CameraCaptureModal';
import { SignaturePadModal } from '../components/SignaturePadModal';

interface ChecklistRouteParams {
  osId: string;
  numero: number;
  placa: string;
  veiculoDescricao: string;
  clienteNome: string;
  clienteId?: string;
  tipoInicial?: 'entrada' | 'saida';
}

interface RespostaItemEstado {
  resposta: RespostaChecklistItem;
  observacao: string;
  fotoLocalUri?: string;
}

interface RascunhoChecklist {
  passoAtual: number;
  tipo: 'entrada' | 'saida';
  km: string;
  nivelCombustivel: number;
  pertencesSelecionados: string[];
  novoPertence?: string;
  observacoesGerais: string;
  respostas: Record<string, RespostaItemEstado>;
  avarias: AvariaLocal[];
  assinaturaBase64: string | null;
  aguardandoOrigem?: 'item' | 'avaria' | null;
  ultimoItemAbertoFoto?: string | null;
  timestamp: number;
}

const getDraftPath = (id: string) => `${FileSystem.documentDirectory}checklist_rascunho_${id}.json`;

const OPCOES_COMBUSTIVEL = [
  { rotulo: 'Reserva (0%)', valor: 0.0 },
  { rotulo: '1/4 (25%)', valor: 0.25 },
  { rotulo: '1/2 (50%)', valor: 0.5 },
  { rotulo: '3/4 (75%)', valor: 0.75 },
  { rotulo: 'Cheio (100%)', valor: 1.0 },
];

const otimizarFoto = async (uri: string): Promise<string> => {
  try {
    // Redimensiona para no máximo 1024px de largura com compressão 0.7
    // Reduz drasticamente o consumo de memória RAM do Android e previne OOM killer
    const resultado = await manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.7, format: SaveFormat.JPEG }
    );
    // Remove o arquivo bruto gigante original da câmera para liberar armazenamento temporário
    if (uri !== resultado.uri) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
    return resultado.uri;
  } catch (err) {
    console.warn('Erro ao otimizar foto, mantendo URI original:', err);
    return uri;
  }
};

export const ChecklistScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<{ params: ChecklistRouteParams }, 'params'>>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { osId, numero, placa, veiculoDescricao, clienteNome, clienteId } = route.params;
  const { oficinaAtiva, usuario } = useAuth();

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
  const [respostas, setRespostas] = useState<Record<string, RespostaItemEstado>>({});
  const [carregandoPerguntas, setCarregandoPerguntas] = useState<boolean>(true);

  // Passo 3: Avarias
  const [avarias, setAvarias] = useState<AvariaLocal[]>([]);
  const [modalAvariaVisivel, setModalAvariaVisivel] = useState<boolean>(false);
  const [avariaParaEditarRegiao, setAvariaParaEditarRegiao] = useState<string | null>(null);
  const [avariaParaEditarTipo, setAvariaParaEditarTipo] = useState<string | null>(null);

  // Modal Foto em Tela Cheia
  const [fotoFullscreenUri, setFotoFullscreenUri] = useState<string | null>(null);

  // Câmera Interna (In-App) para Vistoria e Avarias
  const [cameraModalVisivel, setCameraModalVisivel] = useState<boolean>(false);
  const [cameraDestino, setCameraDestino] = useState<
    | { tipo: 'item'; perguntaId: string; titulo: string }
    | { tipo: 'avaria' }
    | null
  >(null);

  // Passo 4: Assinatura
  const [assinaturaBase64, setAssinaturaBase64] = useState<string | null>(null);
  const [modalAssinaturaVisivel, setModalAssinaturaVisivel] = useState<boolean>(false);

  // Passo 5: Envio e Progresso
  const [enviando, setEnviando] = useState<boolean>(false);
  const [etapaEnvioTexto, setEtapaEnvioTexto] = useState<string>('');
  const [sucessoConcluido, setSucessoConcluido] = useState<boolean>(false);
  const [checklistSalvoParaWhatsApp, setChecklistSalvoParaWhatsApp] = useState<RespostaChecklist | null>(null);
  const [modalWhatsAppVisivel, setModalWhatsAppVisivel] = useState<boolean>(false);

  // Controle de Rascunho e Recuperação contra encerramento de Activity no Android
  const [inicializado, setInicializado] = useState<boolean>(false);
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState<boolean>(false);

  // Função para salvar rascunho em disco
  const salvarRascunhoDisco = async (dadosCustomizados?: Partial<RascunhoChecklist>) => {
    try {
      const caminho = getDraftPath(osId);
      const dadosParaSalvar: RascunhoChecklist = {
        passoAtual,
        tipo,
        km,
        nivelCombustivel,
        pertencesSelecionados,
        novoPertence,
        observacoesGerais,
        respostas,
        avarias,
        assinaturaBase64,
        timestamp: Date.now(),
        ...dadosCustomizados,
      };
      await FileSystem.writeAsStringAsync(caminho, JSON.stringify(dadosParaSalvar));
    } catch (err) {
      console.warn('Erro ao salvar rascunho em disco:', err);
    }
  };

  const limparRascunhoLocal = async () => {
    try {
      const caminho = getDraftPath(osId);
      await FileSystem.deleteAsync(caminho, { idempotent: true });
    } catch (e) {
      // Ignora falha de exclusão
    }
  };

  // Carrega catálogo e recupera rascunho/foto pendente do Android
  useEffect(() => {
    let cancelado = false;

    const carregar = async () => {
      let perguntasCarregadas: PerguntaChecklist[] = [];
      try {
        const dados = await checklistApi.obterPerguntas();
        perguntasCarregadas = dados || [];
        setPerguntas(perguntasCarregadas);
      } catch (e) {
        console.warn('Erro ao carregar perguntas:', e);
        perguntasCarregadas = [
          { id: 'p1', secao: 'documentacao', pergunta: 'CRLV / Documento do veículo no interior', critico: false, ordem: 1 },
          { id: 'p2', secao: 'exterior', pergunta: 'Pintura geral e lataria sem avarias graves', critico: false, ordem: 2 },
          { id: 'p3', secao: 'interior', pergunta: 'Estofamento e bancos sem rasgos ou manchas', critico: false, ordem: 3 },
          { id: 'p4', secao: 'pneus', pergunta: 'Estado dos pneus e estepe calibrado', critico: true, ordem: 4 },
          { id: 'p5', secao: 'fluidos', pergunta: 'Nível de óleo do motor e arrefecimento', critico: true, ordem: 5 },
          { id: 'p6', secao: 'eletrica', pergunta: 'Faróis, lanternas e setas funcionando', critico: true, ordem: 6 },
          { id: 'p7', secao: 'seguranca', pergunta: 'Cintos de segurança e buzina operantes', critico: true, ordem: 7 },
        ];
        setPerguntas(perguntasCarregadas);
      } finally {
        setCarregandoPerguntas(false);
      }

      // Prepara mapa inicial de respostas com "ok" por padrão
      let respostasMap: Record<string, RespostaItemEstado> = {};
      perguntasCarregadas.forEach((p) => {
        respostasMap[p.id] = { resposta: 'ok', observacao: '', fotoLocalUri: undefined };
      });

      // Recupera rascunho em disco se existir
      let rascunhoSalvo: RascunhoChecklist | null = null;
      try {
        const caminho = getDraftPath(osId);
        const info = await FileSystem.getInfoAsync(caminho);
        if (info.exists) {
          const conteudo = await FileSystem.readAsStringAsync(caminho);
          if (conteudo) {
            rascunhoSalvo = JSON.parse(conteudo) as RascunhoChecklist;
          }
        }
      } catch (errDraft) {
        console.warn('Erro ao ler rascunho de checklist:', errDraft);
      }

      if (rascunhoSalvo && !cancelado) {
        if (rascunhoSalvo.passoAtual) setPassoAtual(rascunhoSalvo.passoAtual);
        if (rascunhoSalvo.tipo) setTipo(rascunhoSalvo.tipo);
        if (rascunhoSalvo.km !== undefined) setKm(rascunhoSalvo.km);
        if (rascunhoSalvo.nivelCombustivel !== undefined) setNivelCombustivel(rascunhoSalvo.nivelCombustivel);
        if (rascunhoSalvo.pertencesSelecionados) setPertencesSelecionados(rascunhoSalvo.pertencesSelecionados);
        if (rascunhoSalvo.novoPertence) setNovoPertence(rascunhoSalvo.novoPertence);
        if (rascunhoSalvo.observacoesGerais !== undefined) setObservacoesGerais(rascunhoSalvo.observacoesGerais);
        if (rascunhoSalvo.respostas) {
          respostasMap = { ...respostasMap, ...rascunhoSalvo.respostas };
        }
        if (rascunhoSalvo.avarias) setAvarias(rascunhoSalvo.avarias);
        if (rascunhoSalvo.assinaturaBase64) setAssinaturaBase64(rascunhoSalvo.assinaturaBase64);
        setRascunhoRestaurado(true);
      } else if (!cancelado) {
        // Sem rascunho local: verifica tipoInicial ou checklists já existentes no servidor
        if (route.params.tipoInicial) {
          setTipo(route.params.tipoInicial);
        } else {
          try {
            const existentes = await checklistApi.obterChecklistsDaOS(osId);
            if (existentes && existentes.length > 0 && !cancelado) {
              const temEntrada = existentes.some((c) => c.tipo === 'entrada');
              const temSaida = existentes.some((c) => c.tipo === 'saida');
              const chkEntrada = existentes.find((c) => c.tipo === 'entrada');

              if (temEntrada && !temSaida) {
                // Entrada já foi feita, prepara automaticamente a vistoria de saída
                setTipo('saida');
                if (chkEntrada) {
                  if (chkEntrada.km) setKm(String(chkEntrada.km));
                  if (chkEntrada.pertences && chkEntrada.pertences.length > 0) {
                    setPertencesSelecionados(chkEntrada.pertences);
                  }
                }
              } else if (temEntrada && temSaida) {
                Alert.alert(
                  'Checklists Concluídos',
                  'Esta Ordem de Serviço já possui checklists de Entrada e de Saída finalizados.',
                  [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
              }
            }
          } catch (eChk) {
            console.warn('Erro ao verificar checklists existentes da OS:', eChk);
          }
        }
      }

      setRespostas(respostasMap);

      // Tratamento nativo do Android: recupera foto caso a MainActivity tenha sido reiniciada enquanto a câmera estava aberta
      try {
        const pending = await ImagePicker.getPendingResultAsync();
        if (pending && 'assets' in pending && !pending.canceled && pending.assets && pending.assets.length > 0 && pending.assets[0]?.uri) {
          const otimizada = await otimizarFoto(pending.assets[0].uri);
          if (rascunhoSalvo?.aguardandoOrigem === 'item' && rascunhoSalvo.ultimoItemAbertoFoto) {
            const itemId = rascunhoSalvo.ultimoItemAbertoFoto;
            setRespostas((prev) => ({
              ...prev,
              [itemId]: {
                ...(prev[itemId] || { resposta: 'ok', observacao: '' }),
                fotoLocalUri: otimizada,
              },
            }));
          } else if (rascunhoSalvo?.aguardandoOrigem === 'avaria') {
            const novaAvaria: AvariaLocal = {
              id: Math.random().toString(36).substring(2, 9),
              regiao: 'para-choque-dianteiro',
              tipo: 'risco',
              descricao: '',
              localUri: otimizada,
            };
            setAvarias((prev) => [novaAvaria, ...prev]);
          }
        }
      } catch (errPending) {
        console.warn('Erro ao processar getPendingResultAsync:', errPending);
      }

      if (!cancelado) {
        setInicializado(true);
      }
    };

    carregar();

    return () => {
      cancelado = true;
    };
  }, [osId]);

  // Auto-save em disco a cada alteração de estado (debounced 400ms)
  useEffect(() => {
    if (!inicializado) return;
    const timer = setTimeout(() => {
      salvarRascunhoDisco();
    }, 400);
    return () => clearTimeout(timer);
  }, [
    inicializado,
    passoAtual,
    tipo,
    km,
    nivelCombustivel,
    pertencesSelecionados,
    novoPertence,
    observacoesGerais,
    respostas,
    avarias,
    assinaturaBase64,
  ]);

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
        fotoLocalUri: prev[perguntaId]?.fotoLocalUri,
      },
    }));
  };

  // Callback disparado quando uma foto é confirmada na Câmera Interna (In-App)
  const handleFotoCapturadaCameraInterna = (uri: string) => {
    if (cameraDestino?.tipo === 'item') {
      const pId = cameraDestino.perguntaId;
      setRespostas((prev) => ({
        ...prev,
        [pId]: {
          ...prev[pId],
          fotoLocalUri: uri,
        },
      }));
    } else if (cameraDestino?.tipo === 'avaria') {
      const novaAvaria: AvariaLocal = {
        id: Math.random().toString(36).substring(2, 9),
        regiao: 'para-choque-dianteiro',
        tipo: 'risco',
        descricao: '',
        localUri: uri,
      };
      setAvarias((prev) => [novaAvaria, ...prev]);
    }
    setCameraDestino(null);
    setCameraModalVisivel(false);
  };

  // Anexar foto em item de pergunta via Galeria
  const capturarFotoItemGaleria = async (perguntaId: string) => {
    try {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para anexar a foto.');
        return;
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });

      if (!resultado.canceled && resultado.assets[0]?.uri) {
        const otimizada = await otimizarFoto(resultado.assets[0].uri);
        setRespostas((prev) => ({
          ...prev,
          [perguntaId]: {
            ...prev[perguntaId],
            fotoLocalUri: otimizada,
          },
        }));
      }
    } catch (e) {
      console.error('Erro ao anexar foto do item da galeria:', e);
      Alert.alert('Erro', 'Não foi possível carregar a foto selecionada.');
    }
  };

  const abrirSeletorFotoItem = (perguntaId: string, tituloItem?: string) => {
    Alert.alert(
      'Comprovar Item com Foto',
      'Como deseja registrar a foto deste item?',
      [
        {
          text: 'Tirar Foto (Câmera)',
          onPress: () => {
            setCameraDestino({
              tipo: 'item',
              perguntaId,
              titulo: tituloItem || 'Comprovante do Item',
            });
            setCameraModalVisivel(true);
          },
        },
        {
          text: 'Escolher da Galeria',
          onPress: () => capturarFotoItemGaleria(perguntaId),
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const removerFotoItem = (perguntaId: string) => {
    const uri = respostas[perguntaId]?.fotoLocalUri;
    if (uri) {
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
    setRespostas((prev) => ({
      ...prev,
      [perguntaId]: {
        ...prev[perguntaId],
        fotoLocalUri: undefined,
      },
    }));
  };

  // Avarias diretas (Câmera In-App e Galeria)
  const capturarAvariaDireta = async (origem: 'camera' | 'galeria') => {
    if (origem === 'camera') {
      // Abre a câmera embutida diretamente dentro do app sem chamar o app de câmera externo
      setCameraDestino({ tipo: 'avaria' });
      setCameraModalVisivel(true);
      return;
    }

    try {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para selecionar a foto.');
        return;
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });

      if (!resultado.canceled && resultado.assets[0]?.uri) {
        const otimizada = await otimizarFoto(resultado.assets[0].uri);
        const novaAvaria: AvariaLocal = {
          id: Math.random().toString(36).substring(2, 9),
          regiao: 'para-choque-dianteiro',
          tipo: 'risco',
          descricao: '',
          localUri: otimizada,
        };
        setAvarias((prev) => [novaAvaria, ...prev]);
      }
    } catch (e) {
      console.error('Erro ao adicionar avaria da galeria:', e);
      Alert.alert('Erro', 'Não foi possível carregar a imagem da galeria.');
    }
  };

  const handleSalvarAvaria = (novaAvaria: AvariaLocal) => {
    setAvarias((prev) => [novaAvaria, ...prev]);
  };

  const atualizarAvariaCampo = (id: string, campo: 'regiao' | 'tipo' | 'descricao', valor: any) => {
    setAvarias((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [campo]: valor } : a))
    );
  };

  const removerAvaria = (id: string) => {
    const avaria = avarias.find((a) => a.id === id);
    if (avaria?.localUri) {
      FileSystem.deleteAsync(avaria.localUri, { idempotent: true }).catch(() => {});
    }
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
        'Sair do Checklist?',
        'Deseja sair do checklist? Se sair agora, o rascunho preenchido será descartado.',
        [
          { text: 'Continuar Preenchendo', style: 'cancel' },
          {
            text: 'Sair e Descartar',
            style: 'destructive',
            onPress: async () => {
              await limparRascunhoLocal();
              navigation.goBack();
            },
          },
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
  const totalFotosItens = Object.values(respostas).filter((r) => !!r.fotoLocalUri).length;

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

      const totalAvariasComFoto = avarias.filter((a) => !!a.localUri).length;
      let contadorAvaria = 0;

      for (let i = 0; i < avarias.length; i++) {
        const a = avarias[i];
        let caminhoFoto = '';

        if (a.localUri) {
          contadorAvaria++;
          setEtapaEnvioTexto(`Enviando foto da avaria (${contadorAvaria}/${totalAvariasComFoto})...`);
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

      // 2. Upload das fotos vinculadas em cada item do checklist
      const itensComFoto = Object.entries(respostas).filter(([_, item]) => !!item.fotoLocalUri);
      const fotosItensUrls: Record<string, string> = {};

      for (let i = 0; i < itensComFoto.length; i++) {
        const [perguntaId, item] = itensComFoto[i];
        if (item.fotoLocalUri) {
          setEtapaEnvioTexto(`Enviando foto da vistoria (${i + 1}/${itensComFoto.length})...`);
          const dadosUpload = await checklistApi.pedirUrlUpload(
            'checklists',
            `checklist_${perguntaId}_${Date.now()}.jpg`,
            'image/jpeg'
          );
          await checklistApi.enviarFotoArquivo(
            dadosUpload.urlDeEnvio,
            item.fotoLocalUri,
            'image/jpeg'
          );
          fotosItensUrls[perguntaId] = dadosUpload.caminho;
        }
      }

      // 3. Upload da assinatura
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

      // 4. Monta o payload final com as fotos vinculadas aos itens
      setEtapaEnvioTexto('Gravando checklist na Ordem de Serviço...');
      const itensEnvio = Object.entries(respostas).map(([perguntaId, item]) => ({
        perguntaId,
        resposta: item.resposta,
        observacao: item.observacao ? item.observacao.trim() : undefined,
        fotoUrl: fotosItensUrls[perguntaId] || undefined,
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
      await limparRascunhoLocal();

      // Monta a estrutura da vistoria recém-gravada para envio imediato por WhatsApp
      const checklistRecemGravado: RespostaChecklist = {
        id: 'recem-gravado',
        osId,
        tipo,
        km: parseInt(km, 10),
        nivelCombustivel,
        pertences: pertencesSelecionados,
        assinaturaUrl: caminhoAssinatura,
        preenchidoEm: new Date().toISOString(),
        itens: itensEnvio.map((it, idx) => ({
          id: `item-${idx}`,
          perguntaId: it.perguntaId,
          secao: '',
          pergunta: perguntas.find((p) => p.id === it.perguntaId)?.pergunta || '',
          resposta: it.resposta,
          observacao: it.observacao,
          critico: perguntas.find((p) => p.id === it.perguntaId)?.critico || false,
        })),
        avarias: avariasParaEnvio.map((av, idx) => ({
          id: `av-${idx}`,
          regiao: av.regiao,
          tipo: av.tipo,
          descricao: av.descricao,
          fotoUrl: av.fotoUrl,
        })),
        pendenciasCriticas: 0,
        observacoes: observacoesGerais.trim() || undefined,
      };

      setChecklistSalvoParaWhatsApp(checklistRecemGravado);
      setEtapaEnvioTexto('Vistoria gravada e sincronizada com sucesso!');
      setSucessoConcluido(true);
    } catch (e: any) {
      console.error('[Checklist] Erro ao submeter checklist:', e);
      setEnviando(false);
      const msg = extrairMensagemErro(e);
      Alert.alert('Erro ao gravar checklist', msg || e?.message || 'Erro inesperado.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho da OS */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
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

      {/* Banner Informativo quando Rascunho é Recuperado */}
      {rascunhoRestaurado && (
        <View style={styles.bannerRascunho}>
          <Ionicons name="cloud-done" size={18} color="#059669" />
          <Text style={styles.bannerRascunhoTexto}>
            Rascunho restaurado: suas fotos e dados preenchidos estão preservados.
          </Text>
          <TouchableOpacity
            onPress={() => setRascunhoRestaurado(false)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color="#059669" />
          </TouchableOpacity>
        </View>
      )}

      {/* Conteúdo do Passo Atual */}
      <ScrollView contentContainerStyle={[styles.scrollConteudo, { paddingBottom: insets.bottom + 80 }]} keyboardShouldPersistTaps="handled">
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

                          {/* 4 Botões Proporcionais e Responsivos com Ícones Indicativos */}
                          <View style={styles.respostasLinha}>
                            <TouchableOpacity
                              style={[
                                styles.respostaBotao,
                                styles.botaoOK,
                                respostaAtual === 'ok' && styles.botaoOKAtivo,
                              ]}
                              onPress={() => atualizarResposta(pergunta.id, 'ok')}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={respostaAtual === 'ok' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                                size={15}
                                color={respostaAtual === 'ok' ? '#FFFFFF' : CORES.sucessoTexto}
                              />
                              <Text
                                style={[
                                  styles.respostaBotaoTexto,
                                  styles.botaoOKTexto,
                                  respostaAtual === 'ok' && styles.respostaBotaoTextoAtivo,
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
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
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={respostaAtual === 'atencao' ? 'warning' : 'warning-outline'}
                                size={14}
                                color={respostaAtual === 'atencao' ? '#FFFFFF' : CORES.alertaTexto}
                              />
                              <Text
                                style={[
                                  styles.respostaBotaoTexto,
                                  styles.botaoAtencaoTexto,
                                  respostaAtual === 'atencao' && styles.respostaBotaoTextoAtivo,
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
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
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={respostaAtual === 'critico' ? 'close-circle' : 'close-circle-outline'}
                                size={15}
                                color={respostaAtual === 'critico' ? '#FFFFFF' : CORES.perigoTexto}
                              />
                              <Text
                                style={[
                                  styles.respostaBotaoTexto,
                                  styles.botaoCriticoTexto,
                                  respostaAtual === 'critico' && styles.respostaBotaoTextoAtivo,
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
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
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={respostaAtual === 'na' ? 'remove-circle' : 'remove-circle-outline'}
                                size={15}
                                color={respostaAtual === 'na' ? '#FFFFFF' : CORES.textoMudo}
                              />
                              <Text
                                style={[
                                  styles.respostaBotaoTexto,
                                  styles.botaoNATexto,
                                  respostaAtual === 'na' && styles.respostaBotaoTextoAtivo,
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
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

                          {/* Foto Comprobatória do Item */}
                          {respostas[pergunta.id]?.fotoLocalUri ? (
                            <View style={styles.fotoItemContainer}>
                              <TouchableOpacity
                                style={styles.fotoItemMiniaturaWrapper}
                                onPress={() => setFotoFullscreenUri(respostas[pergunta.id]?.fotoLocalUri!)}
                                activeOpacity={0.8}
                              >
                                <Image
                                  source={{ uri: respostas[pergunta.id]?.fotoLocalUri }}
                                  style={styles.fotoItemMiniatura}
                                />
                                <View style={styles.zoomPill}>
                                  <Ionicons name="expand" size={11} color="#FFFFFF" />
                                </View>
                              </TouchableOpacity>

                              <View style={styles.fotoItemInfo}>
                                <View style={styles.fotoItemBadge}>
                                  <Ionicons name="camera" size={13} color={CORES.primariaClara} />
                                  <Text style={styles.fotoItemBadgeTexto}>Foto anexada</Text>
                                </View>
                                <Text style={styles.fotoItemSubtexto}>Toque para tela cheia</Text>
                              </View>

                              <TouchableOpacity
                                style={styles.botaoRemoverFotoItem}
                                onPress={() => removerFotoItem(pergunta.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="trash-outline" size={18} color={CORES.perigoTexto} />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.botaoAdicionarFotoItem}
                              onPress={() => abrirSeletorFotoItem(pergunta.id, pergunta.pergunta)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="camera-outline" size={16} color={CORES.primariaClara} />
                              <Text style={styles.botaoAdicionarFotoItemTexto}>Adicionar Foto</Text>
                            </TouchableOpacity>
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
              <View style={{ flex: 1 }}>
                <Text style={styles.passoTitulo}>Passo 3: Avarias & Lataria</Text>
                <Text style={styles.passoSubtitulo}>
                  Adicione avarias diretamente com a câmera ou galeria
                </Text>
              </View>
            </View>

            {/* Dois Botões Diretos e Intuitivos: Câmera e Galeria */}
            <View style={styles.botoesAvariaDiretos}>
              <TouchableOpacity
                style={styles.botaoAvariaCamera}
                onPress={() => capturarAvariaDireta('camera')}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={20} color="#FFFFFF" />
                <Text style={styles.botaoAvariaTexto}>Câmera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoAvariaGaleria}
                onPress={() => capturarAvariaDireta('galeria')}
                activeOpacity={0.8}
              >
                <Ionicons name="images" size={20} color="#FFFFFF" />
                <Text style={styles.botaoAvariaTexto}>Galeria</Text>
              </TouchableOpacity>
            </View>

            {avarias.length === 0 ? (
              <View style={styles.avariasVazioBox}>
                <Ionicons name="car-outline" size={48} color={CORES.borda} />
                <Text style={styles.avariasVazioTitulo}>Nenhuma avaria catalogada</Text>
                <Text style={styles.avariasVazioSubtitulo}>
                  Se o carro estiver intacto, prossiga para a assinatura. Caso encontre riscos ou amassados, toque em Câmera ou Galeria acima.
                </Text>
              </View>
            ) : (
              <View style={styles.avariasLista}>
                {avarias.map((avaria) => {
                  const regiaoLabel =
                    REGIOES_AVARIA.find((r) => r.id === avaria.regiao)?.rotulo || avaria.regiao;
                  const tipoLabel =
                    TIPOS_AVARIA.find((t) => t.id === avaria.tipo)?.rotulo || avaria.tipo;

                  return (
                    <View key={avaria.id} style={styles.cardAvariaItem}>
                      {/* Miniatura da foto otimizada com botão para tela cheia */}
                      {avaria.localUri ? (
                        <TouchableOpacity
                          style={styles.avariaMiniaturaWrapper}
                          onPress={() => setFotoFullscreenUri(avaria.localUri!)}
                          activeOpacity={0.8}
                        >
                          <Image source={{ uri: avaria.localUri }} style={styles.avariaMiniatura} />
                          <View style={styles.zoomPill}>
                            <Ionicons name="expand" size={11} color="#FFFFFF" />
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.avariaMiniatura, styles.avariaSemFoto]}>
                          <Ionicons name="image-outline" size={24} color={CORES.textoMudo} />
                        </View>
                      )}

                      <View style={styles.avariaInfo}>
                        <View style={styles.avariaTagsLinha}>
                          <TouchableOpacity
                            style={styles.tagRegiaoBotao}
                            onPress={() => setAvariaParaEditarRegiao(avaria.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.tagRegiaoTexto} numberOfLines={1}>
                              {regiaoLabel}
                            </Text>
                            <Ionicons name="chevron-down" size={12} color="#38BDF8" />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.tagTipoBotao}
                            onPress={() => setAvariaParaEditarTipo(avaria.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.tagTipoTexto} numberOfLines={1}>
                              {tipoLabel}
                            </Text>
                            <Ionicons name="chevron-down" size={12} color="#FDE68A" />
                          </TouchableOpacity>
                        </View>

                        <TextInput
                          style={styles.avariaDescricaoInput}
                          placeholder="Descrição da avaria (opcional)..."
                          placeholderTextColor={CORES.textoMudo}
                          value={avaria.descricao}
                          onChangeText={(texto) =>
                            atualizarAvariaCampo(avaria.id, 'descricao', texto)
                          }
                        />
                      </View>

                      {/* Botão de excluir avaria */}
                      <TouchableOpacity
                        style={styles.botaoExcluirAvaria}
                        onPress={() => removerAvaria(avaria.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                <Text style={styles.resumoLabel}>Fotos dos Itens:</Text>
                <Text style={[styles.resumoValor, totalFotosItens > 0 && { color: CORES.primariaClara }]}>
                  {totalFotosItens} fotos anexadas
                </Text>
              </View>
              <View style={styles.resumoLinha}>
                <Text style={styles.resumoLabel}>Avarias Registradas:</Text>
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
      <View style={[styles.barraNavegacao, { paddingBottom: Math.max(insets.bottom, 16) }]}>
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

      {/* Modal para Adicionar Avaria Manual */}
      <AvariaPhotoCaptureModal
        visivel={modalAvariaVisivel}
        aoFechar={() => setModalAvariaVisivel(false)}
        aoSalvar={handleSalvarAvaria}
      />

      {/* Câmera Interna (In-App) para Vistoria e Avarias sem fechar o app */}
      <CameraCaptureModal
        visivel={cameraModalVisivel}
        titulo={
          cameraDestino?.tipo === 'item'
            ? 'Fotografar Item da Vistoria'
            : 'Fotografar Avaria'
        }
        subtitulo={
          cameraDestino?.tipo === 'item'
            ? cameraDestino.titulo
            : 'Aponte para o local da avaria no veículo'
        }
        aoFechar={() => {
          setCameraModalVisivel(false);
          setCameraDestino(null);
        }}
        aoCapturarFoto={handleFotoCapturadaCameraInterna}
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
              <>
                <Ionicons name="checkmark-circle" size={60} color={CORES.sucesso} />
                <Text style={styles.tituloModalEnvio}>Sucesso!</Text>
                <Text style={styles.textoEtapaEnvio}>{etapaEnvioTexto}</Text>

                <View style={styles.acoesSucessoEnvio}>
                  <TouchableOpacity
                    style={styles.botaoWhatsAppSucesso}
                    onPress={() => setModalWhatsAppVisivel(true)}
                  >
                    <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                    <Text style={styles.botaoWhatsAppSucessoTexto}>
                      Enviar Laudo ao Cliente via WhatsApp
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.botaoVoltarPatioSucesso}
                    onPress={() => {
                      setEnviando(false);
                      navigation.goBack();
                    }}
                  >
                    <Ionicons name="arrow-back" size={18} color={CORES.textoSecundario} />
                    <Text style={styles.botaoVoltarPatioSucessoTexto}>
                      Concluir e Voltar ao Pátio
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={CORES.primaria} />
                <Text style={styles.tituloModalEnvio}>Enviando Checklist</Text>
                <Text style={styles.textoEtapaEnvio}>{etapaEnvioTexto}</Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de Envio do Laudo por WhatsApp */}
      {checklistSalvoParaWhatsApp && (
        <ModalEnviarWhatsAppChecklist
          visivel={modalWhatsAppVisivel}
          onFechar={() => setModalWhatsAppVisivel(false)}
          os={{
            id: osId,
            numero,
            status: 'recebido',
            statusRotulo: 'Recebido',
            clienteId: clienteId || '',
            clienteNome,
            veiculoId: '',
            placa,
            veiculoDescricao,
            versao: 1,
          }}
          checklist={checklistSalvoParaWhatsApp}
          nomeOficina={oficinaAtiva?.nome || usuario?.empresa}
        />
      )}

      {/* Modal Seletor de Região da Avaria */}
      <Modal
        visible={!!avariaParaEditarRegiao}
        transparent
        animationType="slide"
        onRequestClose={() => setAvariaParaEditarRegiao(null)}
      >
        <View style={styles.fundoModalSeletor}>
          <View style={styles.cardModalSeletor}>
            <View style={styles.headerModalSeletor}>
              <Text style={styles.tituloModalSeletor}>Selecione a Região do Veículo</Text>
              <TouchableOpacity onPress={() => setAvariaParaEditarRegiao(null)}>
                <Ionicons name="close" size={24} color={CORES.texto} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {REGIOES_AVARIA.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.itemOpcaoSeletor}
                  onPress={() => {
                    if (avariaParaEditarRegiao) {
                      atualizarAvariaCampo(avariaParaEditarRegiao, 'regiao', r.id);
                      setAvariaParaEditarRegiao(null);
                    }
                  }}
                >
                  <Text style={styles.itemOpcaoSeletorTexto}>{r.rotulo}</Text>
                  <Ionicons name="chevron-forward" size={18} color={CORES.textoMudo} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Seletor de Tipo de Dano */}
      <Modal
        visible={!!avariaParaEditarTipo}
        transparent
        animationType="slide"
        onRequestClose={() => setAvariaParaEditarTipo(null)}
      >
        <View style={styles.fundoModalSeletor}>
          <View style={styles.cardModalSeletor}>
            <View style={styles.headerModalSeletor}>
              <Text style={styles.tituloModalSeletor}>Selecione o Tipo de Dano</Text>
              <TouchableOpacity onPress={() => setAvariaParaEditarTipo(null)}>
                <Ionicons name="close" size={24} color={CORES.texto} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {TIPOS_AVARIA.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.itemOpcaoSeletor}
                  onPress={() => {
                    if (avariaParaEditarTipo) {
                      atualizarAvariaCampo(avariaParaEditarTipo, 'tipo', t.id);
                      setAvariaParaEditarTipo(null);
                    }
                  }}
                >
                  <Text style={styles.itemOpcaoSeletorTexto}>{t.rotulo}</Text>
                  <Ionicons name="chevron-forward" size={18} color={CORES.textoMudo} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Foto em Tela Cheia */}
      <Modal
        visible={!!fotoFullscreenUri}
        transparent
        animationType="fade"
        onRequestClose={() => setFotoFullscreenUri(null)}
      >
        <View style={styles.fundoModalFullscreen}>
          <TouchableOpacity
            style={[styles.botaoFecharFullscreen, { top: insets.top + 16 }]}
            onPress={() => setFotoFullscreenUri(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close-circle" size={38} color="#FFFFFF" />
          </TouchableOpacity>
          {fotoFullscreenUri && (
            <Image
              source={{ uri: fotoFullscreenUri }}
              style={styles.imagemModalFullscreen}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
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
  bannerRascunho: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    borderBottomWidth: 1,
    borderBottomColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  bannerRascunhoTexto: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#D1FAE5',
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
    alignItems: 'center',
  },
  respostaBotao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    minHeight: 42,
  },
  respostaBotaoTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
  botaoOKTexto: {
    color: CORES.sucessoTexto,
  },
  botaoAtencaoTexto: {
    color: CORES.alertaTexto,
  },
  botaoCriticoTexto: {
    color: CORES.perigoTexto,
  },
  botaoNATexto: {
    color: CORES.textoSecundario,
  },
  respostaBotaoTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: '800',
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
  acoesSucessoEnvio: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  botaoWhatsAppSucesso: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
    width: '100%',
  },
  botaoWhatsAppSucessoTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  botaoVoltarPatioSucesso: {
    backgroundColor: CORES.superficieClara,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
    width: '100%',
  },
  botaoVoltarPatioSucessoTexto: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Botões diretos de avaria (Câmera e Galeria)
  botoesAvariaDiretos: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  botaoAvariaCamera: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.primaria,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    shadowColor: CORES.primaria,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  botaoAvariaGaleria: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.superficieClara,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  botaoAvariaTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  avariaMiniaturaWrapper: {
    position: 'relative',
  },
  zoomPill: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 4,
    padding: 3,
  },
  tagRegiaoBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C4A6E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#0369A1',
    maxWidth: 160,
  },
  tagTipoBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#78350F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#B45309',
    maxWidth: 130,
  },
  avariaDescricaoInput: {
    backgroundColor: CORES.fundo,
    borderWidth: 1,
    borderColor: CORES.borda,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: CORES.texto,
    fontSize: 13,
    marginTop: 4,
  },
  // Fotos de Itens do Checklist
  botaoAdicionarFotoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  botaoAdicionarFotoItemTexto: {
    color: CORES.primariaClara,
    fontSize: 12.5,
    fontWeight: '700',
  },
  fotoItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
    gap: 10,
  },
  fotoItemMiniaturaWrapper: {
    position: 'relative',
  },
  fotoItemMiniatura: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  fotoItemInfo: {
    flex: 1,
    gap: 2,
  },
  fotoItemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fotoItemBadgeTexto: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '700',
  },
  fotoItemSubtexto: {
    color: CORES.textoMudo,
    fontSize: 11,
  },
  botaoRemoverFotoItem: {
    padding: 8,
  },
  // Modais de Seleção (Região e Tipo)
  fundoModalSeletor: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardModalSeletor: {
    backgroundColor: CORES.superficie,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  headerModalSeletor: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  tituloModalSeletor: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '800',
  },
  itemOpcaoSeletor: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemOpcaoSeletorTexto: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal de Foto em Tela Cheia
  fundoModalFullscreen: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  botaoFecharFullscreen: {
    position: 'absolute',
    right: 20,
    zIndex: 20,
    padding: 8,
  },
  imagemModalFullscreen: {
    width: '100%',
    height: '85%',
  },
});
