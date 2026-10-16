import React, { useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { Ionicons } from '@expo/vector-icons';
import { CORES } from '../constants';

interface SignaturePadModalProps {
  visivel: boolean;
  aoFechar: () => void;
  aoConfirmar: (assinaturaBase64: string) => void;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  visivel,
  aoFechar,
  aoConfirmar,
}) => {
  const ref = useRef<SignatureViewRef>(null);

  const handleOK = (signature: string) => {
    if (!signature) {
      Alert.alert('Assinatura vazia', 'Por favor, assine no quadro antes de confirmar.');
      return;
    }
    aoConfirmar(signature);
    aoFechar();
  };

  const handleEmpty = () => {
    Alert.alert('Quadro em branco', 'Por favor, colha a assinatura do cliente com o dedo.');
  };

  const handleClear = () => {
    ref.current?.clearSignature();
  };

  const handleConfirm = () => {
    ref.current?.readSignature();
  };

  // Estilo CSS injetado dentro da WebView do SignatureCanvas
  const webStyle = `
    .m-signature-pad {
      box-shadow: none;
      border: none;
      background-color: #FFFFFF;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .m-signature-pad--body {
      border: 2px dashed #94A3B8;
      border-radius: 8px;
      margin: 10px;
      flex: 1;
      background-color: #F8FAFC;
    }
    .m-signature-pad--footer {
      display: none;
      margin: 0px;
    }
    body,html {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #0F172A;
    }
  `;

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent={false}
      onRequestClose={aoFechar}
    >
      <SafeAreaView style={styles.container}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity onPress={aoFechar} style={styles.botaoFechar}>
            <Ionicons name="close" size={26} color={CORES.texto} />
          </TouchableOpacity>
          <View style={styles.headerTextos}>
            <Text style={styles.headerTitulo}>Assinatura do Cliente</Text>
            <Text style={styles.headerSubtitulo}>Assine com o dedo no quadro abaixo</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Quadro de Assinatura */}
        <View style={styles.canvasContainer}>
          <SignatureScreen
            ref={ref}
            onOK={handleOK}
            onEmpty={handleEmpty}
            webStyle={webStyle}
            penColor="#0F172A"
            imageType="image/png"
            autoClear={false}
          />
        </View>

        {/* Barra de Ações Inferior */}
        <View style={styles.footerAcoes}>
          <TouchableOpacity style={styles.botaoLimpar} onPress={handleClear}>
            <Ionicons name="trash-outline" size={20} color={CORES.perigoTexto} />
            <Text style={styles.botaoLimparTexto}>Limpar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.botaoConfirmar} onPress={handleConfirm}>
            <Ionicons name="checkmark-sharp" size={20} color="#FFFFFF" />
            <Text style={styles.botaoConfirmarTexto}>Confirmar Assinatura</Text>
          </TouchableOpacity>
        </View>
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
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: CORES.superficie,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  botaoFechar: {
    padding: 6,
  },
  headerTextos: {
    alignItems: 'center',
  },
  headerTitulo: {
    color: CORES.texto,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitulo: {
    color: CORES.textoSecundario,
    fontSize: 12,
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 8,
  },
  footerAcoes: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: CORES.superficie,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
  },
  botaoLimpar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: CORES.perigoFundo,
    borderWidth: 1,
    borderColor: CORES.perigo,
    gap: 6,
  },
  botaoLimparTexto: {
    color: CORES.perigoTexto,
    fontSize: 15,
    fontWeight: '700',
  },
  botaoConfirmar: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: CORES.sucesso,
    gap: 6,
  },
  botaoConfirmarTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
