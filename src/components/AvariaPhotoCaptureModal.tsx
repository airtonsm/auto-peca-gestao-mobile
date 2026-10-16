import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { CORES, REGIOES_AVARIA, TIPOS_AVARIA } from '../constants';
import { AvariaLocal, RegiaoAvaria, TipoAvaria } from '../types';

interface AvariaPhotoCaptureModalProps {
  visivel: boolean;
  aoFechar: () => void;
  aoSalvar: (avaria: AvariaLocal) => void;
}

export const AvariaPhotoCaptureModal: React.FC<AvariaPhotoCaptureModalProps> = ({
  visivel,
  aoFechar,
  aoSalvar,
}) => {
  const [regiao, setRegiao] = useState<RegiaoAvaria>('para-choque-dianteiro');
  const [tipo, setTipo] = useState<TipoAvaria>('risco');
  const [descricao, setDescricao] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [processandoFoto, setProcessandoFoto] = useState(false);

  const resetarFormulario = () => {
    setRegiao('para-choque-dianteiro');
    setTipo('risco');
    setDescricao('');
    setFotoUri(null);
  };

  const fecharEResetar = () => {
    resetarFormulario();
    aoFechar();
  };

  const otimizarFoto = async (uri: string): Promise<string> => {
    // Redimensiona para no máximo 1600px de largura mantendo a proporção,
    // com compressão JPEG a 80% de qualidade para economizar banda no pátio.
    const resultado = await manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );
    return resultado.uri;
  };

  const tirarFotoCamera = async () => {
    try {
      const permissao = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert(
          'Permissão necessária',
          'Autorize o acesso à câmera para fotografar a avaria do veículo.'
        );
        return;
      }

      setProcessandoFoto(true);
      const resultado = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!resultado.canceled && resultado.assets[0]?.uri) {
        const fotoOtimizada = await otimizarFoto(resultado.assets[0].uri);
        setFotoUri(fotoOtimizada);
      }
    } catch (e) {
      console.error('Erro ao capturar foto da câmera:', e);
      Alert.alert('Erro', 'Não foi possível capturar a foto da câmera.');
    } finally {
      setProcessandoFoto(false);
    }
  };

  const escolherFotoGaleria = async () => {
    try {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert(
          'Permissão necessária',
          'Autorize o acesso à galeria para anexar fotos de avaria.'
        );
        return;
      }

      setProcessandoFoto(true);
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!resultado.canceled && resultado.assets[0]?.uri) {
        const fotoOtimizada = await otimizarFoto(resultado.assets[0].uri);
        setFotoUri(fotoOtimizada);
      }
    } catch (e) {
      console.error('Erro ao selecionar foto da galeria:', e);
      Alert.alert('Erro', 'Não foi possível carregar a imagem selecionada.');
    } finally {
      setProcessandoFoto(false);
    }
  };

  const handleSalvar = () => {
    if (!descricao.trim()) {
      Alert.alert('Atenção', 'Informe uma descrição breve da avaria encontrada.');
      return;
    }

    const novaAvaria: AvariaLocal = {
      id: Math.random().toString(36).substring(2, 9),
      regiao,
      tipo,
      descricao: descricao.trim(),
      localUri: fotoUri || undefined,
    };

    aoSalvar(novaAvaria);
    fecharEResetar();
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent={false}
      onRequestClose={fecharEResetar}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={fecharEResetar} style={styles.botaoVoltar}>
            <Ionicons name="arrow-back" size={24} color={CORES.texto} />
          </TouchableOpacity>
          <Text style={styles.headerTitulo}>Catalogar Nova Avaria</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Seletor de Região */}
          <View style={styles.bloco}>
            <Text style={styles.labelBloco}>1. Região do Veículo</Text>
            <View style={styles.gridSelecao}>
              {REGIOES_AVARIA.map((item) => {
                const selecionado = regiao === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.chipSelecao,
                      selecionado && styles.chipSelecaoAtivo,
                    ]}
                    onPress={() => setRegiao(item.id as RegiaoAvaria)}
                  >
                    <Text
                      style={[
                        styles.chipTexto,
                        selecionado && styles.chipTextoAtivo,
                      ]}
                    >
                      {item.rotulo}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Seletor de Tipo de Avaria */}
          <View style={styles.bloco}>
            <Text style={styles.labelBloco}>2. Tipo de Dano</Text>
            <View style={styles.gridSelecao}>
              {TIPOS_AVARIA.map((item) => {
                const selecionado = tipo === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.chipSelecao,
                      selecionado && styles.chipSelecaoTipoAtivo,
                    ]}
                    onPress={() => setTipo(item.id as TipoAvaria)}
                  >
                    <Text
                      style={[
                        styles.chipTexto,
                        selecionado && styles.chipTextoAtivo,
                      ]}
                    >
                      {item.rotulo}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Descrição Detalhada */}
          <View style={styles.bloco}>
            <Text style={styles.labelBloco}>3. Descrição / Detalhe</Text>
            <TextInput
              style={styles.inputDescricao}
              placeholder="Ex: Ralado profundo próximo ao farol de neblina direito..."
              placeholderTextColor={CORES.textoMudo}
              multiline
              numberOfLines={3}
              value={descricao}
              onChangeText={setDescricao}
            />
          </View>

          {/* Foto da Avaria */}
          <View style={styles.bloco}>
            <Text style={styles.labelBloco}>4. Foto da Avaria (Recomendado)</Text>

            {processandoFoto ? (
              <View style={styles.loadingFoto}>
                <ActivityIndicator size="large" color={CORES.primaria} />
                <Text style={styles.textoCarregando}>Otimizando foto para envio...</Text>
              </View>
            ) : fotoUri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: fotoUri }} style={styles.previewFoto} />
                <TouchableOpacity
                  style={styles.botaoRemoverFoto}
                  onPress={() => setFotoUri(null)}
                >
                  <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.botaoRemoverFotoTexto}>Excluir Foto</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.botoesFotoLinha}>
                <TouchableOpacity
                  style={[styles.botaoFoto, styles.botaoFotoCamera]}
                  onPress={tirarFotoCamera}
                >
                  <Ionicons name="camera" size={24} color="#FFFFFF" />
                  <Text style={styles.botaoFotoTexto}>Tirar Foto Agora</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.botaoFoto, styles.botaoFotoGaleria]}
                  onPress={escolherFotoGaleria}
                >
                  <Ionicons name="images-outline" size={24} color={CORES.texto} />
                  <Text style={[styles.botaoFotoTexto, { color: CORES.texto }]}>
                    Galeria
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Botão Salvar Avaria */}
          <TouchableOpacity style={styles.botaoSalvar} onPress={handleSalvar}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />
            <Text style={styles.botaoSalvarTexto}>Adicionar à Vistoria</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
    backgroundColor: CORES.superficie,
  },
  headerTitulo: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '700',
  },
  botaoVoltar: {
    padding: 6,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  bloco: {
    marginBottom: 20,
    backgroundColor: CORES.superficie,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  labelBloco: {
    color: CORES.texto,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  gridSelecao: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipSelecao: {
    backgroundColor: CORES.superficieClara,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  chipSelecaoAtivo: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primariaClara,
  },
  chipSelecaoTipoAtivo: {
    backgroundColor: '#B45309',
    borderColor: '#F59E0B',
  },
  chipTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inputDescricao: {
    backgroundColor: CORES.fundo,
    color: CORES.texto,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.borda,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  botoesFotoLinha: {
    flexDirection: 'row',
    gap: 12,
  },
  botaoFoto: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  botaoFotoCamera: {
    backgroundColor: CORES.primaria,
  },
  botaoFotoGaleria: {
    backgroundColor: CORES.superficieClara,
    borderWidth: 1,
    borderColor: CORES.borda,
  },
  botaoFotoTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingFoto: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoCarregando: {
    color: CORES.textoSecundario,
    fontSize: 13,
    marginTop: 8,
  },
  previewContainer: {
    alignItems: 'center',
    gap: 12,
  },
  previewFoto: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#000000',
  },
  botaoRemoverFoto: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.perigo,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  botaoRemoverFotoTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  botaoSalvar: {
    backgroundColor: CORES.sucesso,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  botaoSalvarTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
