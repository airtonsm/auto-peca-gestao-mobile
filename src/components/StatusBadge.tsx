import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle, DimensionValue } from 'react-native';
import { STATUS_CORES, CORES } from '../constants';

interface StatusBadgeProps {
  status: string;
  rotulo?: string;
  tamanho?: 'pequeno' | 'medio' | 'grande';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  maxWidth?: DimensionValue;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  rotulo,
  tamanho = 'medio',
  style,
  textStyle,
  maxWidth,
}) => {
  const chave = (status || '').toLowerCase().trim();
  const cores =
    STATUS_CORES[chave] ||
    STATUS_CORES[chave.replace(/_/g, '-')] ||
    STATUS_CORES[chave.replace(/-/g, '_')] || {
      bg: CORES.superficieClara,
      text: CORES.textoSecundario,
      borda: CORES.borda,
    };

  const tamanhoEstilos = {
    pequeno: {
      paddingHorizontal: 8,
      paddingVertical: 2.5,
      fontSize: 10,
    },
    medio: {
      paddingHorizontal: 9,
      paddingVertical: 3.5,
      fontSize: 11,
    },
    grande: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      fontSize: 13,
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
        maxWidth ? { maxWidth } : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.texto,
          {
            color: cores.text,
            fontSize: tamanhoEstilos.fontSize,
          },
          textStyle,
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
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
    flexShrink: 1,
    maxWidth: '100%',
  },
  texto: {
    fontWeight: '700',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
});
