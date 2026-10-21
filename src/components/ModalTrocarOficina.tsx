import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { CORES } from '../constants';
import { extrairMensagemErro } from '../api/clienteHttp';

interface ModalTrocarOficinaProps {
  visivel: boolean;
  aoFechar: () => void;
}

export const ModalTrocarOficina: React.FC<ModalTrocarOficinaProps> = ({
  visivel,
  aoFechar,
}) => {
  const {
    usuario,
    oficinaAtiva,
    oficinasDisponiveis,
    trocarOficina,
    recarregarUsuario,
    logout,
  } = useAuth();

  const [trocandoId, setTrocandoId] = useState<string | null>(null);
  const [atualizandoLista, setAtualizandoLista] = useState(false);

  const handleTrocar = (oficinaId: string, nomeOficina: string) => {
    if (oficinaId === oficinaAtiva?.id) return;

    Alert.alert(
      'Mudar de Oficina',
      `Deseja alternar a operação ativa para "${nomeOficina}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Troca',
          onPress: async () => {
            setTrocandoId(oficinaId);
            try {
              const sucesso = await trocarOficina(oficinaId);
              if (sucesso) {
                Alert.alert('Sucesso', `Ambiente alterado para: ${nomeOficina}`);
                aoFechar();
              }
            } catch (e) {
              Alert.alert('Não foi possível trocar de oficina', extrairMensagemErro(e));
            } finally {
              setTrocandoId(null);
            }
          },
        },
      ]
    );
  };

  const handleAtualizarLista = async () => {
    setAtualizandoLista(true);
    try {
      await recarregarUsuario();
      Alert.alert('Atualizado', 'Lista de permissões e oficinas recarregada com o servidor.');
    } catch (e) {
      Alert.alert('Erro', extrairMensagemErro(e));
    } finally {
      setAtualizandoLista(false);
    }
  };

  const handleSairConta = () => {
    Alert.alert(
      'Sair da Conta',
      'Deseja realmente encerrar a sessão deste dispositivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair da Conta',
          style: 'destructive',
          onPress: async () => {
            aoFechar();
            await logout();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visivel}
      animationType="fade"
      transparent
      onRequestClose={aoFechar}
    >
      <View style={styles.fundoOverlay}>
        <View style={styles.cardModal}>
          {/* Cabeçalho */}
          <View style={styles.cabecalho}>
            <View style={styles.tituloLinha}>
              <View style={styles.iconeTituloBox}>
                <Ionicons name="business" size={20} color={CORES.primariaClara} />
              </View>
              <View style={styles.titulosTextos}>
                <Text style={styles.titulo}>Trocar de Oficina</Text>
                <Text style={styles.subtitulo}>
                  {usuario?.nome || 'Operador'} • {usuario?.papelRotulo || usuario?.papel || 'Equipe'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={aoFechar}
              style={styles.botaoFechar}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color={CORES.textoSecundario} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Oficina Ativa Atual */}
            <Text style={styles.secaoRotulo}>OFICINA CONECTADA NO MOMENTO</Text>
            <View style={styles.cardOficinaAtiva}>
              <View style={styles.tagOperando}>
                <View style={styles.pontoAtivo} />
                <Text style={styles.tagOperandoTexto}>EM OPERAÇÃO</Text>
              </View>
              <Text style={styles.nomeOficinaAtiva}>
                {oficinaAtiva?.nome || usuario?.empresa || 'Oficina Principal'}
              </Text>
              <Text style={styles.idOficinaAtiva}>
                Tenant ID: {oficinaAtiva?.id || usuario?.tenantId || '---'}
              </Text>
            </View>

            {/* Lista de Outras Oficinas */}
            <View style={styles.divisor} />
            <Text style={styles.secaoRotulo}>
              {oficinasDisponiveis.length > 1
                ? `OUTRAS OFICINAS AUTORIZADAS (${oficinasDisponiveis.length})`
                : 'OFICINAS DISPONÍVEIS'}
            </Text>

            {oficinasDisponiveis.length > 1 ? (
              oficinasDisponiveis.map((of) => {
                const isAtiva = of.id === oficinaAtiva?.id;
                const estaTrocando = trocandoId === of.id;

                return (
                  <TouchableOpacity
                    key={of.id}
                    style={[
                      styles.itemOficina,
                      isAtiva && styles.itemOficinaAtiva,
                    ]}
                    onPress={() => handleTrocar(of.id, of.nome)}
                    disabled={isAtiva || !!trocandoId}
                  >
                    <View style={styles.itemOficinaCorpo}>
                      <View style={styles.itemOficinaIcone}>
                        <Ionicons
                          name={isAtiva ? 'checkmark-circle' : 'business-outline'}
                          size={22}
                          color={isAtiva ? CORES.sucesso : CORES.primariaClara}
                        />
                      </View>
                      <View style={styles.itemOficinaTextos}>
                        <Text
                          style={[
                            styles.itemOficinaNome,
                            isAtiva && { color: CORES.primariaClara, fontWeight: '800' },
                          ]}
                          numberOfLines={1}
                        >
                          {of.nome}
                        </Text>
                        <Text style={styles.itemOficinaSubtexto}>
                          {isAtiva
                            ? 'Oficina conectada atualmente'
                            : 'Toque para alternar o ambiente'}
                        </Text>
                      </View>
                    </View>

                    {estaTrocando ? (
                      <ActivityIndicator size="small" color={CORES.primaria} />
                    ) : isAtiva ? (
                      <View style={styles.badgeAtiva}>
                        <Text style={styles.badgeAtivaTexto}>Ativa</Text>
                      </View>
                    ) : (
                      <Ionicons name="swap-horizontal" size={20} color={CORES.textoSecundario} />
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.boxOficinaUnica}>
                <Ionicons name="information-circle-outline" size={22} color={CORES.primariaClara} />
                <Text style={styles.boxOficinaUnicaTexto}>
                  Sua conta está associada a 1 oficina. Caso você precise operar em outras filiais da rede, solicite o vínculo ao administrador.
                </Text>
              </View>
            )}

            {/* Botão para atualizar lista com o backend */}
            <TouchableOpacity
              style={styles.botaoAtualizar}
              onPress={handleAtualizarLista}
              disabled={atualizandoLista}
            >
              {atualizandoLista ? (
                <ActivityIndicator size="small" color={CORES.primariaClara} />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color={CORES.primariaClara} />
                  <Text style={styles.botaoAtualizarTexto}>Atualizar Lista de Oficinas</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>

          {/* Rodapé com Botão de Sair */}
          <View style={styles.rodape}>
            <TouchableOpacity
              style={styles.botaoSairConta}
              onPress={handleSairConta}
            >
              <Ionicons name="log-out-outline" size={20} color={CORES.perigoTexto} />
              <Text style={styles.botaoSairContaTexto}>Encerrar Sessão (Sair da Conta)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fundoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  cardModal: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: CORES.superficie,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    overflow: 'hidden',
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  tituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconeTituloBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titulosTextos: {
    flex: 1,
  },
  titulo: {
    fontSize: 18,
    fontWeight: '800',
    color: CORES.texto,
  },
  subtitulo: {
    fontSize: 12,
    color: CORES.textoSecundario,
    marginTop: 2,
  },
  botaoFechar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CORES.superficieClara,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  scroll: {
    maxHeight: 400,
  },
  scrollContent: {
    padding: 20,
  },
  secaoRotulo: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: CORES.textoMudo,
    marginBottom: 10,
  },
  cardOficinaAtiva: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: CORES.primaria,
    padding: 16,
  },
  tagOperando: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  pontoAtivo: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CORES.sucesso,
    marginRight: 6,
  },
  tagOperandoTexto: {
    fontSize: 10,
    fontWeight: '800',
    color: CORES.sucessoTexto,
    letterSpacing: 0.5,
  },
  nomeOficinaAtiva: {
    fontSize: 17,
    fontWeight: '800',
    color: CORES.texto,
  },
  idOficinaAtiva: {
    fontSize: 12,
    color: CORES.textoSecundario,
    marginTop: 3,
  },
  divisor: {
    height: 1,
    backgroundColor: CORES.bordaSuave,
    marginVertical: 18,
  },
  itemOficina: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CORES.superficieClara,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemOficinaAtiva: {
    borderColor: CORES.primaria,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  itemOficinaCorpo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  itemOficinaIcone: {
    marginRight: 12,
  },
  itemOficinaTextos: {
    flex: 1,
  },
  itemOficinaNome: {
    fontSize: 15,
    fontWeight: '700',
    color: CORES.texto,
  },
  itemOficinaSubtexto: {
    fontSize: 11,
    color: CORES.textoSecundario,
    marginTop: 2,
  },
  badgeAtiva: {
    backgroundColor: CORES.sucessoFundo,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeAtivaTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: CORES.sucessoTexto,
  },
  boxOficinaUnica: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  boxOficinaUnicaTexto: {
    fontSize: 12,
    color: CORES.textoSecundario,
    flex: 1,
    lineHeight: 18,
  },
  botaoAtualizar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 6,
    gap: 6,
  },
  botaoAtualizarTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: CORES.primariaClara,
  },
  rodape: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  botaoSairConta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.4)',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  botaoSairContaTexto: {
    fontSize: 14,
    fontWeight: '700',
    color: CORES.perigoTexto,
  },
});
