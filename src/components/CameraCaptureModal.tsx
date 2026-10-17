import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { CORES } from '../constants';

interface CameraCaptureModalProps {
  visivel: boolean;
  titulo?: string;
  subtitulo?: string;
  aoFechar: () => void;
  aoCapturarFoto: (uri: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  visivel,
  titulo = 'Capturar Foto',
  subtitulo,
  aoFechar,
  aoCapturarFoto,
}) => {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [facing, setFacing] = useState<CameraType>('back');
  const [torch, setTorch] = useState<boolean>(false);
  const [cameraPronta, setCameraPronta] = useState<boolean>(false);
  const [capturando, setCapturando] = useState<boolean>(false);
  const [fotoPreviewUri, setFotoPreviewUri] = useState<string | null>(null);
  const [processandoConfirmacao, setProcessandoConfirmacao] = useState<boolean>(false);

  const resetarEstado = () => {
    if (fotoPreviewUri) {
      FileSystem.deleteAsync(fotoPreviewUri, { idempotent: true }).catch(() => {});
    }
    setFotoPreviewUri(null);
    setCapturando(false);
    setProcessandoConfirmacao(false);
  };

  const handleFechar = () => {
    resetarEstado();
    aoFechar();
  };

  const tirarFoto = async () => {
    if (!cameraRef.current || capturando || !cameraPronta) return;

    try {
      setCapturando(true);
      const foto = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (foto?.uri) {
        setFotoPreviewUri(foto.uri);
      }
    } catch (e) {
      console.error('Erro ao capturar foto na câmera interna:', e);
      Alert.alert('Erro na Câmera', 'Não foi possível capturar a foto. Tente novamente.');
    } finally {
      setCapturando(false);
    }
  };

  const descartarFotoPreview = () => {
    if (fotoPreviewUri) {
      FileSystem.deleteAsync(fotoPreviewUri, { idempotent: true }).catch(() => {});
    }
    setFotoPreviewUri(null);
  };

  const confirmarFoto = async () => {
    if (!fotoPreviewUri || processandoConfirmacao) return;

    try {
      setProcessandoConfirmacao(true);
      // Otimização segura em memória: largura 1024px, JPEG 0.7
      const resultado = await manipulateAsync(
        fotoPreviewUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: SaveFormat.JPEG }
      );

      // Remove a foto temporária da pré-visualização
      if (fotoPreviewUri !== resultado.uri) {
        await FileSystem.deleteAsync(fotoPreviewUri, { idempotent: true }).catch(() => {});
      }

      setFotoPreviewUri(null);
      setProcessandoConfirmacao(false);
      aoCapturarFoto(resultado.uri);
      aoFechar();
    } catch (e) {
      console.error('Erro ao otimizar foto capturada:', e);
      setProcessandoConfirmacao(false);
      aoCapturarFoto(fotoPreviewUri);
      aoFechar();
    }
  };

  const alternarCamera = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const alternarTorch = () => {
    setTorch((prev) => !prev);
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent={false}
      onRequestClose={handleFechar}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Câmera ou Prévia da Foto */}
        <View style={styles.cameraWrapper}>
          {!fotoPreviewUri ? (
            !permission ? (
              <View style={styles.centralizado}>
                <ActivityIndicator size="large" color="#38BDF8" />
                <Text style={styles.textoCarregando}>Verificando câmera...</Text>
              </View>
            ) : !permission.granted ? (
              <View style={styles.centralizado}>
                <Ionicons name="camera-outline" size={64} color="#F59E0B" />
                <Text style={styles.permissaoTitulo}>Acesso à Câmera Necessário</Text>
                <Text style={styles.permissaoDescricao}>
                  Para fotografar veículos e avarias no pátio sem reiniciar o app, autorize o acesso à câmera.
                </Text>
                <TouchableOpacity style={styles.botaoPermissao} onPress={requestPermission}>
                  <Text style={styles.botaoPermissaoTexto}>Autorizar Câmera</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                enableTorch={torch}
                onCameraReady={() => setCameraPronta(true)}
              />
            )
          ) : (
            <Image
              source={{ uri: fotoPreviewUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          )}

          {/* Barra Superior Translúcida */}
          <View style={[styles.barraSuperior, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.botaoCirculo}
              onPress={handleFechar}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.cabecalhoCentro}>
              <Text style={styles.cabecalhoTitulo} numberOfLines={1}>
                {titulo}
              </Text>
              {subtitulo ? (
                <Text style={styles.cabecalhoSubtitulo} numberOfLines={1}>
                  {subtitulo}
                </Text>
              ) : null}
            </View>

            {!fotoPreviewUri ? (
              <TouchableOpacity
                style={[styles.botaoCirculo, torch && styles.botaoCirculoAtivo]}
                onPress={alternarTorch}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name={torch ? 'flash' : 'flash-off'}
                  size={22}
                  color={torch ? '#FACC15' : '#FFFFFF'}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.espacadorLateral} />
            )}
          </View>

          {/* Indicador de Processamento / Shutter em andamento */}
          {(capturando || processandoConfirmacao) && (
            <View style={styles.overlayProcessando}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.textoProcessando}>
                {processandoConfirmacao ? 'Otimizando imagem...' : 'Capturando...'}
              </Text>
            </View>
          )}
        </View>

        {/* Barra Inferior de Ações */}
        <View style={[styles.barraInferior, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {!fotoPreviewUri ? (
            <View style={styles.controlesCamera}>
              <View style={styles.espacadorAcao} />

              {/* Botão de Disparo */}
              <TouchableOpacity
                style={[styles.botaoShutterExterno, capturando && styles.shutterDesabilitado]}
                onPress={tirarFoto}
                disabled={capturando || !cameraPronta}
                activeOpacity={0.7}
              >
                <View style={styles.botaoShutterInterno} />
              </TouchableOpacity>

              {/* Alternar Câmera Frontal / Traseira */}
              <TouchableOpacity
                style={styles.botaoCirculoAcao}
                onPress={alternarCamera}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="camera-reverse-outline" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.controlesPreview}>
              {/* Botão Tirar Outra */}
              <TouchableOpacity
                style={styles.botaoTirarOutra}
                onPress={descartarFotoPreview}
                disabled={processandoConfirmacao}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={20} color="#F87171" />
                <Text style={styles.botaoTirarOutraTexto}>Tirar Outra</Text>
              </TouchableOpacity>

              {/* Botão Confirmar Foto */}
              <TouchableOpacity
                style={styles.botaoConfirmarFoto}
                onPress={confirmarFoto}
                disabled={processandoConfirmacao}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                <Text style={styles.botaoConfirmarFotoTexto}>Usar Esta Foto</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centralizado: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  textoCarregando: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 8,
  },
  permissaoTitulo: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  permissaoDescricao: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  botaoPermissao: {
    backgroundColor: CORES.primaria,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  botaoPermissaoTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  barraSuperior: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 10,
  },
  cabecalhoCentro: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  cabecalhoTitulo: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cabecalhoSubtitulo: {
    color: '#93C5FD',
    fontSize: 12,
    marginTop: 2,
  },
  botaoCirculo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoCirculoAtivo: {
    backgroundColor: 'rgba(234, 179, 8, 0.3)',
    borderWidth: 1,
    borderColor: '#FACC15',
  },
  espacadorLateral: {
    width: 44,
  },
  overlayProcessando: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    gap: 12,
  },
  textoProcessando: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  barraInferior: {
    backgroundColor: '#0F172A',
    paddingTop: 18,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  controlesCamera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  espacadorAcao: {
    width: 48,
  },
  botaoShutterExterno: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterDesabilitado: {
    opacity: 0.5,
  },
  botaoShutterInterno: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#3B82F6',
  },
  botaoCirculoAcao: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlesPreview: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  botaoTirarOutra: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  botaoTirarOutraTexto: {
    color: '#F87171',
    fontSize: 15,
    fontWeight: '700',
  },
  botaoConfirmarFoto: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2563EB',
  },
  botaoConfirmarFotoTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
