import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATUS_CORES, CORES } from '../constants';

interface StatusBadgeProps {
  status: string;
  rotulo?: string;
  tamanho?: 'pequeno' | 'medio' | 'grande';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  rotulo,
  tamanho = 'medio',
}) => {
  const chave = (status || '').toLowerCase().trim();
  const cores = STATUS_CORES[chave] || {
    bg: CORES.superficieClara,
    text: CORES.textoSecundario,
    borda: CORES.borda,
  };

  const tamanhoEstilos = {
    pequeno: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      fontSize: 10,
    },
    medio: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      fontSize: 12,
    },
    grande: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      fontSize: 14,
    },
  }[tamanho];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: cores.bg,
          borderColor: cores.borda || cores.text,
          paddingHorizontal: tamanhoEstilos.paddingHorizontal,
          paddingVertical: tamanhoEstilos.paddingVertical,
        },
      ]}
    >
      <Text
        style={[
          styles.texto,
          {
            color: cores.text,
            fontSize: tamanhoEstilos.fontSize,
          },
        ]}
        numberOfLines={1}
      >
        {rotulo || status}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 9999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
