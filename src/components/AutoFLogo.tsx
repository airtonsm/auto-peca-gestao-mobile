import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AutoFLogoProps {
  tamanho?: 'pequeno' | 'medio' | 'grande';
  mostrarSubtitulo?: boolean;
  orientacao?: 'vertical' | 'horizontal';
}

export const AutoFLogo: React.FC<AutoFLogoProps> = ({
  tamanho = 'grande',
  mostrarSubtitulo = true,
  orientacao = 'vertical',
}) => {
  const isGrande = tamanho === 'grande';
  const isMedio = tamanho === 'medio';

  const dimensaoSimbolo = isGrande ? 74 : isMedio ? 56 : 42;
  const raioBorda = isGrande ? 18 : isMedio ? 14 : 10;
  const tamanhoFonteA = isGrande ? 44 : isMedio ? 32 : 24;
  const barraAmarelaTop = isGrande ? 25 : isMedio ? 18.5 : 14;
  const barraAmarelaLargura = isGrande ? 22 : isMedio ? 16 : 12;
  const barraAmarelaAltura = isGrande ? 4.5 : isMedio ? 3.5 : 2.5;

  const tamanhoFonteTexto = isGrande ? 28 : isMedio ? 22 : 17;
  const tamanhoFonteSubtitulo = isGrande ? 13 : isMedio ? 11 : 9.5;

  return (
    <View
      style={[
        styles.container,
        orientacao === 'horizontal' ? styles.containerHorizontal : styles.containerVertical,
      ]}
    >
      {/* Símbolo AutoF */}
      <View
        style={[
          styles.simboloBox,
          {
            width: dimensaoSimbolo,
            height: dimensaoSimbolo,
            borderRadius: raioBorda,
          },
        ]}
      >
        <View style={styles.simboloLetraContainer}>
          <Text
            style={[
              styles.simboloLetraA,
              {
                fontSize: tamanhoFonteA,
                lineHeight: tamanhoFonteA * 1.15,
              },
            ]}
          >
            A
          </Text>
          {/* Barra transversal destacada em amarelo */}
          <View
            style={[
              styles.barraTransversalAmarela,
              {
                top: barraAmarelaTop,
                width: barraAmarelaLargura,
                height: barraAmarelaAltura,
              },
            ]}
          />
        </View>
      </View>

      {/* Tipografia da Marca */}
      <View
        style={[
          styles.textosContainer,
          orientacao === 'horizontal' && styles.textosContainerHorizontal,
        ]}
      >
        <View style={styles.linhaNome}>
          <Text style={[styles.textoAuto, { fontSize: tamanhoFonteTexto }]}>Auto</Text>
          <Text style={[styles.textoF, { fontSize: tamanhoFonteTexto }]}>F</Text>
        </View>

        {mostrarSubtitulo && (
          <Text style={[styles.subtitulo, { fontSize: tamanhoFonteSubtitulo }]}>
            Sistema de Gestão
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  containerVertical: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  containerHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  simboloBox: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  simboloLetraContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simboloLetraA: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  barraTransversalAmarela: {
    position: 'absolute',
    backgroundColor: '#F59E0B',
    borderRadius: 2,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
    elevation: 3,
  },
  textosContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  textosContainerHorizontal: {
    alignItems: 'flex-start',
    marginTop: 0,
  },
  linhaNome: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textoAuto: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  textoF: {
    color: '#93C5FD',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitulo: {
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 3,
    textTransform: 'uppercase',
  },
});
