import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CORES } from '../constants';

interface PlacaVeiculoProps {
  placa: string;
  tamanho?: 'pequeno' | 'medio' | 'grande';
}

export const PlacaVeiculo: React.FC<PlacaVeiculoProps> = ({
  placa,
  tamanho = 'medio',
}) => {
  const placaFormatada = (placa || '').toUpperCase().trim();

  const config = {
    pequeno: {
      largura: 86,
      altura: 32,
      faixaAltura: 9,
      fonteTamanho: 12,
      brTamanho: 6,
    },
    medio: {
      largura: 110,
      altura: 42,
      faixaAltura: 12,
      fonteTamanho: 16,
      brTamanho: 8,
    },
    grande: {
      largura: 140,
      altura: 52,
      faixaAltura: 15,
      fonteTamanho: 20,
      brTamanho: 10,
    },
  }[tamanho];

  return (
    <View
      style={[
        styles.container,
        {
          width: config.largura,
          height: config.altura,
        },
      ]}
    >
      {/* Faixa azul superior Mercosul */}
      <View style={[styles.faixaAzul, { height: config.faixaAltura }]}>
        <Text style={[styles.textoBrasil, { fontSize: config.brTamanho }]}>
          BRASIL
        </Text>
      </View>

      {/* Letras da Placa */}
      <View style={styles.corpoPlaca}>
        <Text
          style={[
            styles.textoPlaca,
            {
              fontSize: config.fonteTamanho,
            },
          ]}
          numberOfLines={1}
        >
          {placaFormatada || '---'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderColor: '#1E293B',
    borderWidth: 2,
    borderRadius: 5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 4,
  },
  faixaAzul: {
    backgroundColor: '#003399',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  textoBrasil: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  corpoPlaca: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  textoPlaca: {
    color: '#000000',
    fontWeight: '900',
    letterSpacing: 1.5,
    fontFamily: 'monospace',
  },
});
