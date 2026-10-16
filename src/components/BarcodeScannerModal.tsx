import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { CORES } from '../constants';

interface BarcodeScannerModalProps {
  visivel: boolean;
  aoFechar: () => void;
  aoEscanear: (codigo: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visivel,
  aoFechar,
  aoEscanear,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [flashAtivo, setFlashAtivo] = useState(false);
  const [escaneado, setEscaneado] = useState(false);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (escaneado) return;
    if (result.data) {
      setEscaneado(true);
      aoEscanear(result.data);
      setTimeout(() => {
        setEscaneado(false);
        aoFechar();
      }, 300);
    }
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent={false}
      onRequestClose={aoFechar}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.botaoFechar}
            onPress={aoFechar}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitulo}>Escanear Código de Barras</Text>
          <TouchableOpacity
            style={styles.botaoFlash}
            onPress={() => setFlashAtivo((prev) => !prev)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={flashAtivo ? 'flash' : 'flash-off'}
              size={24}
              color={flashAtivo ? '#FACC15' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>

        {!permission ? (
          <View style={styles.centralizado}>
            <Text style={styles.textoInfo}>Carregando permissões da câmera...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.centralizado}>
            <Ionicons name="camera-outline" size={64} color={CORES.alerta} />
            <Text style={styles.permissaoTitulo}>Acesso à Câmera Necessário</Text>
            <Text style={styles.permissaoDescricao}>
              Para escanear etiquetas de peças no estoque, precisamos da autorização de câmera do dispositivo.
            </Text>
            <TouchableOpacity style={styles.botaoPermissao} onPress={requestPermission}>
              <Text style={styles.botaoPermissaoTexto}>Autorizar Câmera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={flashAtivo}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'qr',
                  'ean13',
                  'ean8',
                  'code128',
                  'code39',
                  'upc_a',
                  'upc_e',
                  'itf14',
                ],
              }}
              onBarcodeScanned={escaneado ? undefined : handleBarcodeScanned}
            />

            {/* Overlay com mira */}
            <View style={styles.overlay}>
              <View style={styles.mascaraSuperior} />

              <View style={styles.linhaCentral}>
                <View style={styles.mascaraLateral} />

                <View style={styles.reticuloMira}>
                  <View style={[styles.canto, styles.cantoSuperiorEsquerdo]} />
                  <View style={[styles.canto, styles.cantoSuperiorDireito]} />
                  <View style={[styles.canto, styles.cantoInferiorEsquerdo]} />
                  <View style={[styles.canto, styles.cantoInferiorDireito]} />

                  {/* Linha vermelha de leitura */}
                  <View style={styles.linhaLaser} />
                </View>

                <View style={styles.mascaraLateral} />
              </View>

              <View style={styles.mascaraInferior}>
                <Text style={styles.instrucaoTexto}>
                  Aponte para o código de barras ou EAN/GTIN da etiqueta da peça
                </Text>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#0F172A',
    zIndex: 10,
  },
  headerTitulo: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  botaoFechar: {
    padding: 6,
  },
  botaoFlash: {
    padding: 6,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  centralizado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: CORES.fundo,
  },
  textoInfo: {
    color: CORES.textoSecundario,
    fontSize: 16,
  },
  permissaoTitulo: {
    color: CORES.texto,
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissaoDescricao: {
    color: CORES.textoSecundario,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  botaoPermissao: {
    backgroundColor: CORES.primaria,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  botaoPermissaoTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  mascaraSuperior: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  linhaCentral: {
    flexDirection: 'row',
    height: 220,
  },
  mascaraLateral: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  reticuloMira: {
    width: 280,
    height: 220,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  canto: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#22C55E',
  },
  cantoSuperiorEsquerdo: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cantoSuperiorDireito: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cantoInferiorEsquerdo: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cantoInferiorDireito: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  linhaLaser: {
    height: 2,
    width: '90%',
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    shadowColor: '#EF4444',
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  mascaraInferior: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  instrucaoTexto: {
    color: '#E2E8F0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
});
