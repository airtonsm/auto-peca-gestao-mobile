import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { CORES } from '../constants';
import { reconhecerPlacaDaImagem, extrairPlacaDoTexto } from '../utils/ocrPlacaHelper';
import { normalizarPlaca, mascaraPlacaExibicao } from '../utils/mascaras';

interface ModalCapturaFotoPlacaProps {
  visivel: boolean;
  aoFechar: () => void;
  aoPlacaDetectada: (placa: string) => void;
}

export const ModalCapturaFotoPlaca: React.FC<ModalCapturaFotoPlacaProps> = ({
  visivel,
  aoFechar,
  aoPlacaDetectada,
}) => {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [torch, setTorch] = useState<boolean>(false);
  const [cameraPronta, setCameraPronta] = useState<boolean>(false);
  const [processando, setProcessando] = useState<boolean>(false);

  // Placa candidata detectada para confirmação
  const [placaDetectada, setPlacaDetectada] = useState<string | null>(null);

  const resetar = () => {
    setTorch(false);
    setProcessando(false);
    setPlacaDetectada(null);
  };

  const handleFechar = () => {
    resetar();
    aoFechar();
  };

  const processarUri = async (uri: string) => {
    setProcessando(true);
    try {
      const placa = await reconhecerPlacaDaImagem(uri);
      if (placa) {
        setPlacaDetectada(placa);
      } else {
        Alert.alert(
          'Placa não identificada',
          'Não conseguimos ler a placa com clareza. Certifique-se de que a placa está bem iluminada e enquadrada na moldura.',
          [{ text: 'Tentar Novamente' }]
        );
      }
    } catch {
      Alert.alert('Erro no Reconhecimento', 'Não foi possível analisar a imagem da placa.');
    } finally {
      setProcessando(false);
    }
  };

  const tirarFoto = async () => {
    if (!cameraRef.current || processando || !cameraPronta) return;

    try {
      setProcessando(true);
      const foto = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });

      if (foto?.uri) {
        await processarUri(foto.uri);
      } else {
        setProcessando(false);
      }
    } catch (e) {
      console.warn('Erro ao tirar foto da placa:', e);
      setProcessando(false);
      Alert.alert('Erro na Câmera', 'Não foi possível capturar a foto. Tente novamente.');
    }
  };

  const escolherDaGaleria = async () => {
    try {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      });

      if (!resultado.canceled && resultado.assets[0]?.uri) {
        await processarUri(resultado.assets[0].uri);
      }
    } catch {
      Alert.alert('Galeria', 'Não foi possível carregar a imagem da galeria.');
    }
  };

  const handleConfirmarPlaca = () => {
    if (!placaDetectada) return;
    const final = normalizarPlaca(placaDetectada);
    aoPlacaDetectada(final);
    handleFechar();
  };

  if (!visivel) return null;

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent={false}
      onRequestClose={handleFechar}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Cabeçalho */}
        <View style={styles.cabecalho}>
          <TouchableOpacity
            style={styles.botaoVoltar}
            onPress={handleFechar}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.cabecalhoTitulos}>
            <Text style={styles.cabecalhoTitulo}>Leitor de Placa</Text>
            <Text style={styles.cabecalhoSubtitulo}>Enquadre a placa do carro na moldura</Text>
          </View>

          <TouchableOpacity
            style={[styles.botaoIconeTop, torch && styles.botaoIconeTopAtivo]}
            onPress={() => setTorch((prev) => !prev)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={torch ? 'flash' : 'flash-outline'} size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* View da Câmera com Mira */}
        <View style={styles.cameraWrapper}>
          {!permission?.granted ? (
            <View style={styles.semPermissaoContainer}>
              <Ionicons name="camera-outline" size={56} color="#F59E0B" />
              <Text style={styles.semPermissaoTitulo}>Câmera Desativada</Text>
              <Text style={styles.semPermissaoTexto}>
                Precisamos de acesso à câmera para fotografar e reconhecer a placa automaticamente.
              </Text>
              <TouchableOpacity style={styles.botaoPermissao} onPress={requestPermission}>
                <Text style={styles.botaoPermissaoTexto}>Permitir Acesso à Câmera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              onCameraReady={() => setCameraPronta(true)}
            />
          )}

          {/* Máscara e Moldura da Placa */}
          <View style={styles.overlayMascara} pointerEvents="none">
            <View style={styles.mascaraSuperior} />
            <View style={styles.linhaCentralMira}>
              <View style={styles.mascaraLateral} />
              <View style={styles.molduraPlaca}>
                <View style={styles.cantoSuperiorEsquerdo} />
                <View style={styles.cantoSuperiorDireito} />
                <View style={styles.cantoInferiorEsquerdo} />
                <View style={styles.cantoInferiorDireito} />

                {/* Tag Mercosul Guia */}
                <View style={styles.tagMercosulGuia}>
                  <Text style={styles.tagMercosulGuiaTexto}>PLACA MERCOSUL / BRASIL</Text>
                </View>
              </View>
              <View style={styles.mascaraLateral} />
            </View>
            <View style={styles.mascaraInferior}>
              <Text style={styles.instrucaoTexto}>
                Aponte para a placa traseira ou dianteira
              </Text>
            </View>
          </View>

          {/* Loading do OCR */}
          {processando && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#38BDF8" />
              <Text style={styles.loadingTexto}>Reconhecendo placa com Inteligência Artificial...</Text>
            </View>
          )}
        </View>

        {/* Modal de Confirmação da Placa Reconhecida */}
        {placaDetectada && (
          <View style={styles.cardConfirmacao}>
            <View style={styles.confirmacaoTopo}>
              <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
              <Text style={styles.confirmacaoTitulo}>Placa Reconhecida!</Text>
            </View>

            {/* Visual da Placa Mercosul */}
            <View style={styles.placaPreviewBox}>
              <View style={styles.placaFaixaAzul}>
                <Text style={styles.placaTextoBrasil}>BRASIL</Text>
              </View>
              <TextInput
                style={styles.placaTextoInput}
                value={placaDetectada}
                onChangeText={(t) => setPlacaDetectada(normalizarPlaca(t))}
                autoCapitalize="characters"
                maxLength={7}
              />
            </View>

            <Text style={styles.confirmacaoDica}>
              Formato: {mascaraPlacaExibicao(placaDetectada)} • Toque para corrigir se necessário
            </Text>

            <View style={styles.botoesConfirmacaoLinha}>
              <TouchableOpacity
                style={styles.botaoTentarOutra}
                onPress={() => setPlacaDetectada(null)}
              >
                <Text style={styles.botaoTentarOutraTexto}>Tirar Outra</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoConfirmar}
                onPress={handleConfirmarPlaca}
                activeOpacity={0.85}
              >
                <Ionicons name="sparkles" size={17} color="#FFFFFF" />
                <Text style={styles.botaoConfirmarTexto}>Preencher Dados do Carro</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Barra de Controles Inferior (quando não está confirmando) */}
        {!placaDetectada && (
          <View style={styles.controlesBarra}>
            <TouchableOpacity
              style={styles.botaoGaleria}
              onPress={escolherDaGaleria}
              disabled={processando}
            >
              <Ionicons name="images-outline" size={24} color="#FFFFFF" />
              <Text style={styles.botaoGaleriaTexto}>Galeria</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.botaoDisparo, processando && styles.botaoDisparoDesativado]}
              onPress={tirarFoto}
              disabled={processando || !cameraPronta}
              activeOpacity={0.8}
            >
              <View style={styles.botaoDisparoInterno}>
                <Ionicons name="camera" size={32} color="#0F172A" />
              </View>
            </TouchableOpacity>

            <View style={{ width: 64 }} />
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
  },
  botaoVoltar: {
    padding: 6,
  },
  cabecalhoTitulos: {
    flex: 1,
    alignItems: 'center',
  },
  cabecalhoTitulo: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cabecalhoSubtitulo: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  botaoIconeTop: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  botaoIconeTopAtivo: {
    backgroundColor: '#F59E0B',
  },
  cameraWrapper: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  semPermissaoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#0F172A',
  },
  semPermissaoTitulo: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
  },
  semPermissaoTexto: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  botaoPermissao: {
    marginTop: 20,
    backgroundColor: CORES.primaria,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  botaoPermissaoTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  overlayMascara: {
    ...StyleSheet.absoluteFill,
  },
  mascaraSuperior: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  linhaCentralMira: {
    height: 120,
    flexDirection: 'row',
  },
  mascaraLateral: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  molduraPlaca: {
    width: 290,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#38BDF8',
    position: 'relative',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cantoSuperiorEsquerdo: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 10,
  },
  cantoSuperiorDireito: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 10,
  },
  cantoInferiorEsquerdo: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 10,
  },
  cantoInferiorDireito: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 10,
  },
  tagMercosulGuia: {
    backgroundColor: 'rgba(0, 51, 153, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagMercosulGuiaTexto: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  mascaraInferior: {
    flex: 1.2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    paddingTop: 20,
  },
  instrucaoTexto: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  cardConfirmacao: {
    backgroundColor: CORES.superficie,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: CORES.bordaSuave,
    alignItems: 'center',
  },
  confirmacaoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  confirmacaoTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  placaPreviewBox: {
    width: 200,
    height: 72,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#0F172A',
    overflow: 'hidden',
  },
  placaFaixaAzul: {
    backgroundColor: '#003399',
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placaTextoBrasil: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  placaTextoInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    padding: 0,
  },
  confirmacaoDica: {
    color: CORES.textoMudo,
    fontSize: 11,
    marginTop: 8,
    marginBottom: 16,
  },
  botoesConfirmacaoLinha: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  botaoTentarOutra: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: CORES.fundo,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  botaoTentarOutraTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
    fontWeight: '700',
  },
  botaoConfirmar: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: CORES.primaria,
  },
  botaoConfirmarTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  controlesBarra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 20,
    backgroundColor: '#000000',
  },
  botaoGaleria: {
    alignItems: 'center',
    gap: 4,
    width: 64,
  },
  botaoGaleriaTexto: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  botaoDisparo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  botaoDisparoDesativado: {
    opacity: 0.5,
  },
  botaoDisparoInterno: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
