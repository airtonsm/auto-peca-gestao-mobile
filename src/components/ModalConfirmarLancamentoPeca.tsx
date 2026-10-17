import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RespostaPeca, RespostaOSResumo } from '../types';
import { CORES } from '../constants';
import { PlacaVeiculo } from './PlacaVeiculo';

interface ModalConfirmarLancamentoPecaProps {
  visivel: boolean;
  peca: RespostaPeca | null;
  os?: RespostaOSResumo | null;
  aoFechar: () => void;
  aoConfirmar: (peca: RespostaPeca, quantidade: number) => Promise<void> | void;
  carregando?: boolean;
}

export const ModalConfirmarLancamentoPeca: React.FC<ModalConfirmarLancamentoPecaProps> = ({
  visivel,
  peca,
  os,
  aoFechar,
  aoConfirmar,
  carregando = false,
}) => {
  const insets = useSafeAreaInsets();
  const [quantidade, setQuantidade] = useState<number>(1);
  const [quantidadeTexto, setQuantidadeTexto] = useState<string>('1');

  useEffect(() => {
    if (visivel) {
      setQuantidade(1);
      setQuantidadeTexto('1');
    }
  }, [visivel, peca]);

  if (!peca) {
    return null;
  }

  const saldoDisponivel = peca.disponivel ?? 0;
  const temSaldo = saldoDisponivel > 0;
  const saldoInsuficiente = quantidade > saldoDisponivel;
  const valorTotal = (peca.preco || 0) * (quantidade || 1);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor || 0);
  };

  const alterarQuantidade = (novoValor: number) => {
    const ajustado = Math.max(1, novoValor);
    setQuantidade(ajustado);
    setQuantidadeTexto(String(ajustado));
  };

  const handleTextoQuantidadeChange = (text: string) => {
    const limpo = text.replace(/[^0-9]/g, '');
    setQuantidadeTexto(limpo);
    const num = parseInt(limpo, 10);
    if (!isNaN(num) && num > 0) {
      setQuantidade(num);
    }
  };

  const handleBlurQuantidade = () => {
    if (!quantidadeTexto || parseInt(quantidadeTexto, 10) <= 0) {
      setQuantidade(1);
      setQuantidadeTexto('1');
    }
  };

  const handleConfirmar = () => {
    if (carregando) return;
    const qtdFinal = quantidade > 0 ? quantidade : 1;
    aoConfirmar(peca, qtdFinal);
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent
      onRequestClose={carregando ? undefined : aoFechar}
    >
      <View style={styles.fundoModal}>
        <View style={styles.containerCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconeTitulo}>
              <View style={styles.iconeHeaderBox}>
                <Ionicons name="cart-outline" size={22} color={CORES.primariaClara} />
              </View>
              <View>
                <Text style={styles.headerTitulo}>Lançar Peça na OS</Text>
                <Text style={styles.headerSubtitulo}>Confirme a quantidade e a localização</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={aoFechar}
              disabled={carregando}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.botaoFechar}
            >
              <Ionicons name="close" size={24} color={CORES.textoSecundario} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.corpoScroll}
            contentContainerStyle={styles.corpoScrollConteudo}
            showsVerticalScrollIndicator={false}
          >
            {/* Informações da OS de Destino (se informada) */}
            {os && (
              <View style={styles.boxOSDestino}>
                <View style={styles.linhaOSDestino}>
                  <PlacaVeiculo placa={os.placa} tamanho="pequeno" />
                  <View style={styles.infoOSDestinoTexto}>
                    <Text style={styles.numeroOSText}>OS #{os.numero}</Text>
                    <Text style={styles.veiculoOSText} numberOfLines={1}>
                      {os.veiculoDescricao}
                    </Text>
                  </View>
                </View>
                <Text style={styles.clienteOSText} numberOfLines={1}>
                  Cliente: {os.clienteNome}
                </Text>
              </View>
            )}

            {/* Ficha da Peça */}
            <View style={styles.cardPeca}>
              <View style={styles.linhaTopoPeca}>
                <View style={styles.badgeCodigoInterno}>
                  <Text style={styles.badgeCodigoInternoTexto}>{peca.codigoInterno}</Text>
                </View>
                {peca.fabricante ? (
                  <Text style={styles.fabricanteTexto}>{peca.fabricante}</Text>
                ) : null}
              </View>

              <Text style={styles.descricaoPeca}>{peca.descricao}</Text>

              {/* Destaque da Localização / Prateleira */}
              <View style={styles.boxLocalizacao}>
                <Ionicons name="location-sharp" size={18} color="#38BDF8" />
                <View style={styles.infoLocalizacao}>
                  <Text style={styles.labelLocalizacao}>LOCALIZAÇÃO NO ESTOQUE</Text>
                  <Text style={styles.valorLocalizacao}>
                    {peca.localizacao || 'Sem prateleira cadastrada'}
                  </Text>
                </View>
              </View>

              {/* Grid: Saldo Disponível e Preço de Tabela */}
              <View style={styles.gridInfoPeca}>
                <View
                  style={[
                    styles.cardSaldo,
                    temSaldo ? styles.cardSaldoPositivo : styles.cardSaldoZero,
                  ]}
                >
                  <Text style={styles.labelGrid}>SALDO DISPONÍVEL</Text>
                  <View style={styles.linhaSaldo}>
                    <Ionicons
                      name={temSaldo ? 'checkmark-circle' : 'alert-circle'}
                      size={18}
                      color={temSaldo ? '#4ADE80' : '#F87171'}
                    />
                    <Text
                      style={[
                        styles.valorSaldo,
                        { color: temSaldo ? '#4ADE80' : '#F87171' },
                      ]}
                    >
                      {saldoDisponivel} {peca.unidade || 'UN'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardPreco}>
                  <Text style={styles.labelGrid}>PREÇO UNITÁRIO</Text>
                  <Text style={styles.valorPreco}>{formatarMoeda(peca.preco)}</Text>
                </View>
              </View>
            </View>

            {/* Alerta de Saldo Insuficiente */}
            {saldoInsuficiente && (
              <View style={styles.alertaSaldoBox}>
                <Ionicons name="warning" size={22} color="#FBBF24" />
                <View style={styles.alertaSaldoTextoBox}>
                  <Text style={styles.alertaSaldoTitulo}>Estoque Insuficiente</Text>
                  <Text style={styles.alertaSaldoDescricao}>
                    A quantidade solicitada ({quantidade}) é maior que o saldo em estoque ({saldoDisponivel}).
                    O item será lançado como <Text style={styles.alertaDestaque}>Aguardando Peça</Text> e
                    a oficina será sinalizada para compra.
                  </Text>
                </View>
              </View>
            )}

            {/* Seletor de Quantidade */}
            <View style={styles.secaoQuantidade}>
              <Text style={styles.secaoQuantidadeTitulo}>QUANTIDADE A LANÇAR</Text>

              <View style={styles.seletorLinha}>
                <TouchableOpacity
                  style={[styles.botaoQtd, quantidade <= 1 && styles.botaoQtdDesabilitado]}
                  onPress={() => alterarQuantidade(quantidade - 1)}
                  disabled={quantidade <= 1 || carregando}
                >
                  <Ionicons
                    name="remove"
                    size={24}
                    color={quantidade <= 1 ? CORES.textoMudo : '#FFFFFF'}
                  />
                </TouchableOpacity>

                <View style={styles.inputQtdContainer}>
                  <TextInput
                    style={styles.inputQtd}
                    keyboardType="numeric"
                    value={quantidadeTexto}
                    onChangeText={handleTextoQuantidadeChange}
                    onBlur={handleBlurQuantidade}
                    editable={!carregando}
                    maxLength={5}
                    selectTextOnFocus
                  />
                  <Text style={styles.unidadeTexto}>{peca.unidade || 'UN'}</Text>
                </View>

                <TouchableOpacity
                  style={styles.botaoQtd}
                  onPress={() => alterarQuantidade(quantidade + 1)}
                  disabled={carregando}
                >
                  <Ionicons name="add" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Botões de Incremento Rápido */}
              <View style={styles.chipsAtalho}>
                {[1, 2, 4, 5, 10].map((valor) => (
                  <TouchableOpacity
                    key={valor}
                    style={[
                      styles.chipAtalho,
                      quantidade === valor && styles.chipAtalhoAtivo,
                    ]}
                    onPress={() => alterarQuantidade(valor)}
                    disabled={carregando}
                  >
                    <Text
                      style={[
                        styles.chipAtalhoTexto,
                        quantidade === valor && styles.chipAtalhoTextoAtivo,
                      ]}
                    >
                      {valor} {peca.unidade || 'UN'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Totalizador Estimado */}
            <View style={styles.cardTotalizador}>
              <Text style={styles.totalizadorLabel}>Subtotal Estimado do Item:</Text>
              <Text style={styles.totalizadorValor}>{formatarMoeda(valorTotal)}</Text>
            </View>
          </ScrollView>

          {/* Rodapé com Botões de Ação */}
          <View style={[styles.rodape, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={styles.botaoCancelar}
              onPress={aoFechar}
              disabled={carregando}
            >
              <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.botaoConfirmar, carregando && styles.botaoConfirmarCarregando]}
              onPress={handleConfirmar}
              disabled={carregando}
            >
              {carregando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-sharp" size={20} color="#FFFFFF" />
                  <Text style={styles.botaoConfirmarTexto}>Confirmar e Adicionar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  containerCard: {
    backgroundColor: CORES.superficie,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  headerIconeTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconeHeaderBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitulo: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 12,
  },
  botaoFechar: {
    padding: 6,
  },
  corpoScroll: {
    maxHeight: 520,
  },
  corpoScrollConteudo: {
    padding: 20,
    gap: 16,
  },
  boxOSDestino: {
    backgroundColor: CORES.fundo,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: CORES.borda,
    gap: 8,
  },
  linhaOSDestino: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoOSDestinoTexto: {
    flex: 1,
  },
  numeroOSText: {
    color: CORES.primariaClara,
    fontSize: 14,
    fontWeight: '800',
  },
  veiculoOSText: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '600',
  },
  clienteOSText: {
    color: CORES.textoSecundario,
    fontSize: 12,
  },
  cardPeca: {
    backgroundColor: CORES.fundo,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 12,
  },
  linhaTopoPeca: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeCodigoInterno: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  badgeCodigoInternoTexto: {
    color: CORES.primariaClara,
    fontSize: 12,
    fontWeight: '800',
  },
  fabricanteTexto: {
    color: CORES.textoMudo,
    fontSize: 12,
    fontWeight: '600',
  },
  descricaoPeca: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  boxLocalizacao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C4A6E',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  infoLocalizacao: {
    flex: 1,
  },
  labelLocalizacao: {
    color: '#BAE6FD',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  valorLocalizacao: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  gridInfoPeca: {
    flexDirection: 'row',
    gap: 10,
  },
  cardSaldo: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardSaldoPositivo: {
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  cardSaldoZero: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  cardPreco: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: CORES.superficie,
    borderColor: CORES.bordaSuave,
  },
  labelGrid: {
    color: CORES.textoMudo,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  linhaSaldo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  valorSaldo: {
    fontSize: 14,
    fontWeight: '800',
  },
  valorPreco: {
    color: '#4ADE80',
    fontSize: 15,
    fontWeight: '800',
  },
  alertaSaldoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    gap: 12,
    alignItems: 'flex-start',
  },
  alertaSaldoTextoBox: {
    flex: 1,
  },
  alertaSaldoTitulo: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  alertaSaldoDescricao: {
    color: '#FDE68A',
    fontSize: 12,
    lineHeight: 17,
  },
  alertaDestaque: {
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  secaoQuantidade: {
    backgroundColor: CORES.fundo,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    alignItems: 'center',
  },
  secaoQuantidadeTitulo: {
    color: CORES.textoSecundario,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  seletorLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  botaoQtd: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: CORES.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  botaoQtdDesabilitado: {
    backgroundColor: CORES.superficieClara,
    opacity: 0.5,
  },
  inputQtdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
    height: 48,
    backgroundColor: CORES.superficie,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 8,
  },
  inputQtd: {
    color: CORES.texto,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    minWidth: 40,
    padding: 0,
  },
  unidadeTexto: {
    color: CORES.textoMudo,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  chipsAtalho: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  chipAtalho: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: CORES.superficie,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  chipAtalhoAtivo: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primariaClara,
  },
  chipAtalhoTexto: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontWeight: '700',
  },
  chipAtalhoTextoAtivo: {
    color: '#FFFFFF',
  },
  cardTotalizador: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CORES.superficieClara,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  totalizadorLabel: {
    color: CORES.textoSecundario,
    fontSize: 13,
    fontWeight: '600',
  },
  totalizadorValor: {
    color: '#4ADE80',
    fontSize: 18,
    fontWeight: '900',
  },
  rodape: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    backgroundColor: CORES.superficie,
  },
  botaoCancelar: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: CORES.superficieClara,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  botaoCancelarTexto: {
    color: CORES.texto,
    fontSize: 14,
    fontWeight: '700',
  },
  botaoConfirmar: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 3,
  },
  botaoConfirmarCarregando: {
    opacity: 0.8,
  },
  botaoConfirmarTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
