import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { CORES } from '../constants';
import { extrairMensagemErro } from '../api/clienteHttp';
import { ConfiguradorServidorModal } from '../components/ConfiguradorServidorModal';
import { authApi } from '../api/authApi';

export const PerfilScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    usuario,
    oficinaAtiva,
    oficinasDisponiveis,
    trocarOficina,
    logout,
    servidorUrl,
  } = useAuth();

  const [trocandoOficina, setTrocandoOficina] = useState<string | null>(null);
  const [modalServidorVisivel, setModalServidorVisivel] = useState(false);
  const [testandoSaude, setTestandoSaude] = useState(false);

  const handleTrocarOficina = async (oficinaId: string, nomeOficina: string) => {
    if (oficinaId === oficinaAtiva?.id) return;

    Alert.alert(
      'Mudar de Oficina',
      `Deseja alternar a operação ativa para "${nomeOficina}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Troca',
          onPress: async () => {
            setTrocandoOficina(oficinaId);
            try {
              await trocarOficina(oficinaId);
              Alert.alert('Sucesso', `Ambiente alterado para: ${nomeOficina}`);
            } catch (e) {
              Alert.alert('Não foi possível trocar de oficina', extrairMensagemErro(e));
            } finally {
              setTrocandoOficina(null);
            }
          },
        },
      ]
    );
  };

  const testarSaudeServidor = async () => {
    setTestandoSaude(true);
    try {
      const resp = await authApi.testarConexao();
      Alert.alert(
        'Servidor Online',
        `Conexão bem-sucedida com a API.\nVersão do Backend: ${resp.versao || '1.0'}\nStatus: ${resp.status}`
      );
    } catch (e) {
      Alert.alert('Falha na Conexão', extrairMensagemErro(e));
    } finally {
      setTestandoSaude(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Deseja realmente encerrar a sessão deste dispositivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}>
        {/* Card do Usuário */}
        <View style={styles.cardUsuario}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarTexto}>
              {(usuario?.nome || 'U').substring(0, 2).toUpperCase()}
            </Text>
          </View>

          <View style={styles.usuarioInfo}>
            <Text style={styles.usuarioNome}>{usuario?.nome || 'Usuário'}</Text>
            <Text style={styles.usuarioEmail}>{usuario?.email || 'email@oficina.com'}</Text>

            <View style={styles.badgePapel}>
              <Ionicons name="shield-outline" size={13} color={CORES.primariaClara} />
              <Text style={styles.badgePapelTexto}>
                {usuario?.papelRotulo || usuario?.papel || 'Operador'}
              </Text>
            </View>
          </View>
        </View>

        {/* Seção Mudar de Oficina (Multi-Tenant nativo) */}
        <View style={styles.secao}>
          <View style={styles.secaoTituloLinha}>
            <Ionicons name="business-outline" size={20} color={CORES.primariaClara} />
            <Text style={styles.secaoTitulo}>Oficina Ativa & Multi-Tenant</Text>
          </View>

          {/* Oficina Ativa Atual */}
          <View style={styles.oficinaAtivaCard}>
            <View style={styles.oficinaAtivaTopo}>
              <View style={styles.pontoAtivo} />
              <Text style={styles.oficinaAtivaTag}>OFICINA EM OPERAÇÃO</Text>
            </View>
            <Text style={styles.oficinaAtivaNome}>
              {oficinaAtiva?.nome || usuario?.empresa || 'Oficina Principal'}
            </Text>
            <Text style={styles.oficinaAtivaId}>
              Tenant ID: {oficinaAtiva?.id || usuario?.tenantId || '---'}
            </Text>
          </View>

          {/* Lista de Outras Oficinas Permitidas */}
          {oficinasDisponiveis.length > 1 ? (
            <View style={styles.outrasOficinasBox}>
              <Text style={styles.subtituloSecao}>
                Você tem permissão para operar em outras oficinas:
              </Text>

              {oficinasDisponiveis.map((of) => {
                const isAtiva = of.id === oficinaAtiva?.id;
                const estaTrocandoEsta = trocandoOficina === of.id;

                return (
                  <TouchableOpacity
                    key={of.id}
                    style={[
                      styles.itemOficinaAlternar,
                      isAtiva && styles.itemOficinaAlternarAtiva,
                    ]}
                    onPress={() => handleTrocarOficina(of.id, of.nome)}
                    disabled={isAtiva || !!trocandoOficina}
                  >
                    <View style={styles.itemOficinaInfo}>
                      <Text
                        style={[
                          styles.itemOficinaNome,
                          isAtiva && { color: CORES.primariaClara },
                        ]}
                      >
                        {of.nome}
                      </Text>
                      <Text style={styles.itemOficinaStatus}>
                        {isAtiva ? 'Oficina conectada no momento' : 'Toque para alternar para esta oficina'}
                      </Text>
                    </View>

                    {estaTrocandoEsta ? (
                      <ActivityIndicator size="small" color={CORES.primaria} />
                    ) : isAtiva ? (
                      <Ionicons name="checkmark-circle" size={22} color={CORES.sucesso} />
                    ) : (
                      <Ionicons name="swap-horizontal" size={20} color={CORES.textoSecundario} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.infoOficinaUnica}>
              <Ionicons name="information-circle-outline" size={16} color={CORES.textoMudo} />
              <Text style={styles.infoOficinaUnicaTexto}>
                Seu usuário está vinculado a 1 oficina. Para suporte a multi-oficinas, solicite vinculação ao gestor da rede.
              </Text>
            </View>
          )}
        </View>

        {/* Seção Conexão de Rede & API */}
        <View style={styles.secao}>
          <View style={styles.secaoTituloLinha}>
            <Ionicons name="wifi-outline" size={20} color={CORES.primariaClara} />
            <Text style={styles.secaoTitulo}>Conectividade & Servidor</Text>
          </View>

          <View style={styles.servidorInfoCard}>
            <View style={styles.servidorInfoLinha}>
              <Text style={styles.servidorInfoLabel}>Endereço da API Backend:</Text>
              <Text style={styles.servidorInfoUrl}>{servidorUrl}</Text>
            </View>

            <View style={styles.servidorBotoesLinha}>
              <TouchableOpacity
                style={styles.botaoTestarConexao}
                onPress={testarSaudeServidor}
                disabled={testandoSaude}
              >
                {testandoSaude ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="pulse" size={16} color="#FFFFFF" />
                    <Text style={styles.botaoTestarConexaoTexto}>Testar Conexão</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoAlterarIp}
                onPress={() => setModalServidorVisivel(true)}
              >
                <Ionicons name="settings-outline" size={16} color={CORES.texto} />
                <Text style={styles.botaoAlterarIpTexto}>Mudar IP / Porta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Botão de Logout */}
        <TouchableOpacity style={styles.botaoLogout} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={CORES.perigoTexto} />
          <Text style={styles.botaoLogoutTexto}>Encerrar Sessão</Text>
        </TouchableOpacity>

        {/* Informações de Versão */}
        <Text style={styles.versaoTexto}>
          AutoF Sistema de Gestão Mobile v1.0.0 (Build Produção)
        </Text>
      </ScrollView>

      {/* Modal Configurador de Servidor */}
      <ConfiguradorServidorModal
        visivel={modalServidorVisivel}
        aoFechar={() => setModalServidorVisivel(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  cardUsuario: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 14,
  },
  avatarBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: CORES.primaria,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTexto: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  usuarioInfo: {
    flex: 1,
    gap: 3,
  },
  usuarioNome: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
  },
  usuarioEmail: {
    color: CORES.textoSecundario,
    fontSize: 13,
  },
  badgePapel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 4,
  },
  badgePapelTexto: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  secao: {
    backgroundColor: CORES.superficie,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 12,
  },
  secaoTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secaoTitulo: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '800',
  },
  oficinaAtivaCard: {
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  oficinaAtivaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pontoAtivo: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  oficinaAtivaTag: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  oficinaAtivaNome: {
    color: CORES.texto,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  oficinaAtivaId: {
    color: CORES.textoMudo,
    fontSize: 11,
  },
  outrasOficinasBox: {
    gap: 8,
    marginTop: 4,
  },
  subtituloSecao: {
    color: CORES.textoSecundario,
    fontSize: 13,
    marginBottom: 4,
  },
  itemOficinaAlternar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CORES.superficieClara,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  itemOficinaAlternarAtiva: {
    borderColor: CORES.primaria,
    backgroundColor: '#1E3A8A',
  },
  itemOficinaInfo: {
    flex: 1,
  },
  itemOficinaNome: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
  },
  itemOficinaStatus: {
    color: CORES.textoMudo,
    fontSize: 11,
    marginTop: 2,
  },
  infoOficinaUnica: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.fundo,
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  infoOficinaUnicaTexto: {
    color: CORES.textoMudo,
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  servidorInfoCard: {
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 12,
  },
  servidorInfoLinha: {
    gap: 4,
  },
  servidorInfoLabel: {
    color: CORES.textoMudo,
    fontSize: 12,
    fontWeight: '600',
  },
  servidorInfoUrl: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  servidorBotoesLinha: {
    flexDirection: 'row',
    gap: 10,
  },
  botaoTestarConexao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.primaria,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  botaoTestarConexaoTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  botaoAlterarIp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.superficieClara,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
    gap: 6,
  },
  botaoAlterarIpTexto: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '700',
  },
  botaoLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.perigoFundo,
    borderWidth: 1,
    borderColor: CORES.perigo,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  botaoLogoutTexto: {
    color: CORES.perigoTexto,
    fontSize: 15,
    fontWeight: '700',
  },
  versaoTexto: {
    color: CORES.textoMudo,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
