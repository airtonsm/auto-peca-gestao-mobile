import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { CORES, SERVIDORES_PREDEFINIDOS } from '../constants';
import { useAuth } from '../context/AuthContext';

interface ConfiguradorServidorModalProps {
  visivel: boolean;
  aoFechar: () => void;
}

interface ResultadoValidacaoUrl {
  valida: boolean;
  erro?: string;
  avisoSeguranca?: string;
  urlNormalizada: string;
}

const validarUrlServidor = (urlBruta: string): ResultadoValidacaoUrl => {
  let limpa = urlBruta.trim();
  if (!limpa) {
    return { valida: false, erro: 'O endereço do servidor não pode estar vazio.', urlNormalizada: '' };
  }

  // Bloqueia esquemas perigosos (javascript:, data:, file:, etc.)
  if (/^(javascript|data|file|ftp):/i.test(limpa)) {
    return { valida: false, erro: 'Protocolo não permitido. Utilize http:// ou https://.', urlNormalizada: '' };
  }

  if (!/^https?:\/\//i.test(limpa)) {
    limpa = `http://${limpa}`;
  }

  try {
    const parsed = new URL(limpa);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valida: false, erro: 'Protocolo inválido. Utilize http:// ou https://.', urlNormalizada: '' };
    }

    const host = parsed.hostname.toLowerCase();
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2';
    const isPrivateIp = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(host);

    let avisoSeguranca: string | undefined;
    if (parsed.protocol === 'http:' && !isLocalhost && !isPrivateIp) {
      avisoSeguranca = 'Você está configurando um domínio público sem criptografia (HTTP). Para ambientes de produção com dados de clientes, o uso de HTTPS é fortemente recomendado para evitar interceptação de dados.';
    }

    const normalizada = `${parsed.protocol}//${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`.replace(/\/+$/, '');
    return { valida: true, avisoSeguranca, urlNormalizada: normalizada };
  } catch {
    return { valida: false, erro: 'Formato de URL inválido. Exemplo: http://192.168.1.10:8080 ou https://minhaoficina.com.br', urlNormalizada: '' };
  }
};

export const ConfiguradorServidorModal: React.FC<ConfiguradorServidorModalProps> = ({
  visivel,
  aoFechar,
}) => {
  const { servidorUrl, atualizarServidorUrl } = useAuth();
  const [urlDigitada, setUrlDigitada] = useState<string>(servidorUrl);
  const [testando, setTestando] = useState<boolean>(false);
  const [resultadoTeste, setResultadoTeste] = useState<{
    sucesso: boolean;
    mensagem: string;
  } | null>(null);

  const testarConexao = async (urlParaTestar: string) => {
    const validacao = validarUrlServidor(urlParaTestar);
    if (!validacao.valida) {
      setResultadoTeste({
        sucesso: false,
        mensagem: validacao.erro || 'Endereço inválido.',
      });
      return;
    }

    const urlLimpa = validacao.urlNormalizada;
    setTestando(true);
    setResultadoTeste(null);
    try {
      const resp = await axios.get(`${urlLimpa}/api/saude`, { timeout: 6000 });
      if (resp.status === 200 && resp.data?.status === 'ok') {
        setResultadoTeste({
          sucesso: true,
          mensagem: `Conexão bem-sucedida! Servidor ativo na versão ${resp.data.versao || '1.0'}.`,
        });
      } else {
        setResultadoTeste({
          sucesso: true,
          mensagem: 'Servidor respondeu com sucesso.',
        });
      }
    } catch (e: any) {
      setResultadoTeste({
        sucesso: false,
        mensagem: `Falha ao alcançar ${urlLimpa}: ${e.message || 'Sem resposta.'}`,
      });
    } finally {
      setTestando(false);
    }
  };

  const handleSalvar = async () => {
    const validacao = validarUrlServidor(urlDigitada);
    if (!validacao.valida) {
      Alert.alert('Endereço Inválido', validacao.erro || 'Verifique o endereço digitado.');
      return;
    }

    const urlLimpa = validacao.urlNormalizada;

    if (validacao.avisoSeguranca) {
      Alert.alert(
        'Alerta de Segurança (HTTP)',
        `${validacao.avisoSeguranca}\n\nDeseja prosseguir mesmo assim?`,
        [
          { text: 'Voltar e Corrigir', style: 'cancel' },
          {
            text: 'Confirmar e Usar HTTP',
            style: 'destructive',
            onPress: async () => {
              await atualizarServidorUrl(urlLimpa);
              Alert.alert('Configuração Salva', `Endereço da API atualizado para:\n${urlLimpa}`);
              aoFechar();
            },
          },
        ]
      );
      return;
    }

    await atualizarServidorUrl(urlLimpa);
    Alert.alert('Configuração Salva', `Endereço da API atualizado para:\n${urlLimpa}`);
    aoFechar();
  };

  return (
    <Modal
      visible={visivel}
      animationType="fade"
      transparent
      onRequestClose={aoFechar}
    >
      <View style={styles.fundoModal}>
        <View style={styles.cardModal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTituloIcone}>
              <Ionicons name="server-outline" size={24} color={CORES.primariaClara} />
              <Text style={styles.titulo}>Configurar Servidor da API</Text>
            </View>
            <TouchableOpacity onPress={aoFechar} style={styles.botaoFechar}>
              <Ionicons name="close" size={24} color={CORES.textoSecundario} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitulo}>
            Selecione o endereço de rede onde o backend Spring Boot está rodando:
          </Text>

          {/* Atalhos Rápidos */}
          <View style={styles.listaPredefinidos}>
            {SERVIDORES_PREDEFINIDOS.map((item) => {
              const selecionado = urlDigitada === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.itemPredefinido,
                    selecionado && styles.itemPredefinidoAtivo,
                  ]}
                  onPress={() => {
                    setUrlDigitada(item.value);
                    testarConexao(item.value);
                  }}
                >
                  <Text
                    style={[
                      styles.textoPredefinido,
                      selecionado && styles.textoPredefinidoAtivo,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {selecionado && (
                    <Ionicons name="checkmark-circle" size={18} color={CORES.primariaClara} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Campo de Texto Personalizado */}
          <Text style={styles.labelInput}>Endereço Personalizado:</Text>
          <View style={styles.linhaInput}>
            <TextInput
              style={styles.inputUrl}
              value={urlDigitada}
              onChangeText={setUrlDigitada}
              placeholder="http://192.168.1.100:8080"
              placeholderTextColor={CORES.textoMudo}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.botaoTestar}
              onPress={() => testarConexao(urlDigitada)}
              disabled={testando}
            >
              {testando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.botaoTestarTexto}>Testar</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Feedback do Teste */}
          {resultadoTeste && (
            <View
              style={[
                styles.feedbackBox,
                resultadoTeste.sucesso ? styles.feedbackSucesso : styles.feedbackErro,
              ]}
            >
              <Ionicons
                name={resultadoTeste.sucesso ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={resultadoTeste.sucesso ? CORES.sucessoTexto : CORES.perigoTexto}
              />
              <Text
                style={[
                  styles.feedbackTexto,
                  {
                    color: resultadoTeste.sucesso ? CORES.sucessoTexto : CORES.perigoTexto,
                  },
                ]}
              >
                {resultadoTeste.mensagem}
              </Text>
            </View>
          )}

          {/* Botões de Ação */}
          <View style={styles.acoesContainer}>
            <TouchableOpacity style={styles.botaoCancelar} onPress={aoFechar}>
              <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.botaoSalvar} onPress={handleSalvar}>
              <Text style={styles.botaoSalvarTexto}>Salvar e Aplicar</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardModal: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: CORES.superficie,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTituloIcone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titulo: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '700',
  },
  botaoFechar: {
    padding: 4,
  },
  subtitulo: {
    color: CORES.textoSecundario,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  listaPredefinidos: {
    gap: 8,
    marginBottom: 16,
  },
  itemPredefinido: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CORES.superficieClara,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  itemPredefinidoAtivo: {
    borderColor: CORES.primaria,
    backgroundColor: '#1E3A8A',
  },
  textoPredefinido: {
    color: CORES.textoSecundario,
    fontSize: 13,
  },
  textoPredefinidoAtivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  labelInput: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  linhaInput: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  inputUrl: {
    flex: 1,
    backgroundColor: CORES.fundo,
    borderWidth: 1,
    borderColor: CORES.borda,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: CORES.texto,
    fontSize: 14,
  },
  botaoTestar: {
    backgroundColor: CORES.superficieClara,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  botaoTestarTexto: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  feedbackSucesso: {
    backgroundColor: CORES.sucessoFundo,
  },
  feedbackErro: {
    backgroundColor: CORES.perigoFundo,
  },
  feedbackTexto: {
    fontSize: 12,
    flex: 1,
  },
  acoesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  botaoCancelar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
    alignItems: 'center',
  },
  botaoCancelarTexto: {
    color: CORES.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
  },
  botaoSalvar: {
    flex: 2,
    backgroundColor: CORES.primaria,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  botaoSalvarTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
