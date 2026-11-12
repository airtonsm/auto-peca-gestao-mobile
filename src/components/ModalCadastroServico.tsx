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
import {
  servicosApi,
  CategoriaServicoItem,
  CATEGORIAS_SERVICO_PADRAO,
  normalizarChaveCategoria,
} from '../api/servicosApi';
import { RespostaServico } from '../types';
import { CORES } from '../constants';
import { extrairMensagemErro } from '../api/clienteHttp';
import {
  mascaraMoeda,
  converterMoedaParaNumero,
} from '../utils/mascaras';

interface ModalCadastroServicoProps {
  visivel: boolean;
  aoFechar: () => void;
  aoSalvar: (servico: RespostaServico) => void;
  nomeInicial?: string;
  categoriaInicial?: string;
}

const SERVICOS_SUGERIDOS = [
  'Alinhamento e Balanceamento',
  'Troca de Óleo e Filtros',
  'Troca de Pastilha de Freio Dianteira',
  'Revisão Preventiva Completa',
  'Limpeza de Bicos Injetores',
  'Troca de Correia Dentada',
  'Diagnóstico Eletrônico com Scanner',
  'Higienização de Ar-condicionado',
];

const TEMPOS_SUGERIDOS = [
  { rotulo: '30min', valor: 0.5 },
  { rotulo: '1 hora', valor: 1.0 },
  { rotulo: '1h30', valor: 1.5 },
  { rotulo: '2 horas', valor: 2.0 },
  { rotulo: '3 horas', valor: 3.0 },
  { rotulo: '4 horas', valor: 4.0 },
];

export const ModalCadastroServico: React.FC<ModalCadastroServicoProps> = ({
  visivel,
  aoFechar,
  aoSalvar,
  nomeInicial = '',
  categoriaInicial = 'revisao',
}) => {
  const insets = useSafeAreaInsets();

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState<CategoriaServicoItem[]>(CATEGORIAS_SERVICO_PADRAO);
  const [valorMaoObra, setValorMaoObra] = useState('');
  const [tempoEstimado, setTempoEstimado] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregandoCategorias, setCarregandoCategorias] = useState(false);

  useEffect(() => {
    if (visivel) {
      setNome(nomeInicial);
      setCategoria(normalizarChaveCategoria(categoriaInicial));
      setValorMaoObra('');
      setTempoEstimado('');
      setSalvando(false);

      // Carrega categorias da oficina ativa no backend
      setCarregandoCategorias(true);
      servicosApi
        .listarCategoriasServico()
        .then((cats) => {
          if (cats && cats.length > 0) {
            setCategoriasDisponiveis(cats);
            if (!categoriaInicial && cats[0]) {
              setCategoria(cats[0].chave);
            }
          }
        })
        .finally(() => {
          setCarregandoCategorias(false);
        });
    }
  }, [visivel, nomeInicial, categoriaInicial]);

  const handleValorChange = (texto: string) => {
    setValorMaoObra(mascaraMoeda(texto));
  };

  const handleSalvar = async () => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      Alert.alert('Nome Obrigatório', 'Informe o nome do serviço ou mão de obra.');
      return;
    }

    const valorNum = converterMoedaParaNumero(valorMaoObra);
    const tempoNum = tempoEstimado ? parseFloat(tempoEstimado.replace(',', '.')) : undefined;

    setSalvando(true);
    try {
      const novoServico = await servicosApi.criarServico({
        nome: nomeLimpo,
        categoria: categoria || 'revisao',
        valorMaoObra: valorNum > 0 ? valorNum : undefined,
        tempoPadraoHoras: tempoNum && !isNaN(tempoNum) ? tempoNum : undefined,
      });

      aoSalvar(novoServico);
      aoFechar();
    } catch (e) {
      Alert.alert('Erro ao Cadastrar Serviço', extrairMensagemErro(e, 'Não foi possível cadastrar o serviço.'));
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
                <Ionicons name="build" size={20} color="#38BDF8" />
              </View>
              <View style={styles.cabecalhoTextosCol}>
                <Text style={styles.titulo} numberOfLines={1}>Novo Serviço</Text>
                <Text style={styles.subtitulo} numberOfLines={1} ellipsizeMode="tail">Mão de obra e tabela de preços R$</Text>
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
            {/* Campo Nome do Serviço */}
            <View style={styles.campoContainer}>
              <Text style={styles.rotuloCampo}>NOME DO SERVIÇO / MÃO DE OBRA *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Troca de Pastilhas de Freio Dianteiras"
                placeholderTextColor={CORES.textoMudo}
                value={nome}
                onChangeText={setNome}
                autoCapitalize="sentences"
              />

              {/* Sugestões rápidas de serviços */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
                style={styles.chipsScrollWrapper}
              >
                {SERVICOS_SUGERIDOS.map((srv) => (
                  <TouchableOpacity
                    key={srv}
                    style={[
                      styles.chipSugestao,
                      nome.toLowerCase() === srv.toLowerCase() && styles.chipSugestaoAtivo,
                    ]}
                    onPress={() => setNome(srv)}
                  >
                    <Text
                      style={[
                        styles.chipSugestaoTexto,
                        nome.toLowerCase() === srv.toLowerCase() && styles.chipSugestaoTextoAtivo,
                      ]}
                    >
                      {srv}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Seletor de Categoria */}
            <View style={styles.campoContainer}>
              <View style={styles.rotuloComAcao}>
                <Text style={styles.rotuloCampo}>CATEGORIA DO SERVIÇO</Text>
                {carregandoCategorias && <ActivityIndicator size="small" color="#38BDF8" />}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {categoriasDisponiveis.map((cat) => {
                  const ativa = categoria.toLowerCase() === cat.chave.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={cat.chave}
                      style={[styles.chipCategoria, ativa && styles.chipCategoriaAtiva]}
                      onPress={() => setCategoria(cat.chave)}
                    >
                      <Ionicons
                        name="pricetag-outline"
                        size={13}
                        color={ativa ? '#FFFFFF' : '#38BDF8'}
                      />
                      <Text style={[styles.chipCategoriaTexto, ativa && styles.chipCategoriaTextoAtiva]}>
                        {cat.rotulo}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Linha Preço Mão de Obra e Tempo Estimado */}
            <View style={styles.linhaDupla}>
              {/* Preço Mão de Obra (R$) */}
              <View style={[styles.campoContainer, { flex: 1.2 }]}>
                <Text style={styles.rotuloCampo}>VALOR MÃO DE OBRA (R$)</Text>
                <View style={styles.inputMoedaContainer}>
                  <Text style={styles.prefixoMoeda}>R$</Text>
                  <TextInput
                    style={styles.inputMoeda}
                    placeholder="0,00"
                    placeholderTextColor={CORES.textoMudo}
                    value={valorMaoObra}
                    onChangeText={handleValorChange}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Tempo Estimado (Horas) */}
              <View style={[styles.campoContainer, { flex: 1 }]}>
                <Text style={styles.rotuloCampo}>TEMPO ESTIMADO (H)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 1.5"
                  placeholderTextColor={CORES.textoMudo}
                  value={tempoEstimado}
                  onChangeText={setTempoEstimado}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Atalhos de Tempo */}
            <View style={[styles.campoContainer, { marginTop: -4 }]}>
              <Text style={[styles.rotuloCampo, { fontSize: 10, color: CORES.textoMudo }]}>
                ATALHOS DE TEMPO PADRÃO:
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {TEMPOS_SUGERIDOS.map((t) => (
                  <TouchableOpacity
                    key={t.rotulo}
                    style={[
                      styles.chipTempo,
                      tempoEstimado === String(t.valor) && styles.chipTempoAtivo,
                    ]}
                    onPress={() => setTempoEstimado(String(t.valor))}
                  >
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={tempoEstimado === String(t.valor) ? '#FFFFFF' : CORES.textoSecundario}
                    />
                    <Text
                      style={[
                        styles.chipTempoTexto,
                        tempoEstimado === String(t.valor) && styles.chipTempoTextoAtivo,
                      ]}
                    >
                      {t.rotulo}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
                  <Text style={styles.botaoSalvarTexto}>Salvar Serviço</Text>
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
    maxHeight: 480,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
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
  rotuloComAcao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
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
  chipsScrollWrapper: {
    marginTop: 8,
  },
  chipsScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  chipSugestao: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  chipSugestaoAtivo: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderColor: '#38BDF8',
  },
  chipSugestaoTexto: {
    fontSize: 12,
    color: CORES.textoSecundario,
    fontWeight: '500',
  },
  chipSugestaoTextoAtivo: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  chipCategoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  chipCategoriaAtiva: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primariaClara,
  },
  chipCategoriaTexto: {
    fontSize: 12,
    color: CORES.textoSecundario,
    fontWeight: '600',
  },
  chipCategoriaTextoAtiva: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  linhaDupla: {
    flexDirection: 'row',
    gap: 10,
  },
  inputMoedaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  prefixoMoeda: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
    marginRight: 6,
  },
  inputMoeda: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: '700',
    color: CORES.texto,
  },
  chipTempo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  chipTempoAtivo: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primariaClara,
  },
  chipTempoTexto: {
    fontSize: 11,
    color: CORES.textoSecundario,
    fontWeight: '600',
  },
  chipTempoTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: '700',
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
