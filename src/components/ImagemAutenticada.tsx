import React, { useState, useEffect } from 'react';
import { Image, ImageStyle, StyleProp, ImageResizeMode } from 'react-native';
import { identidadeApi } from '../api/identidadeApi';

interface ImagemAutenticadaProps {
  caminhoRelativo?: string | null;
  style?: StyleProp<ImageStyle>;
  fallback?: React.ReactNode;
  resizeMode?: ImageResizeMode;
  accessibilityLabel?: string;
}

const cacheDataUri = new Map<string, string>();

/**
 * Renderiza uma imagem servida pela API protegida por autenticação Bearer Token
 * (como a logo da oficina e a foto de perfil do usuário).
 * Suporta diretamente Data URIs (base64) e baixa URLs relativas com token HTTP.
 */
export const ImagemAutenticada: React.FC<ImagemAutenticadaProps> = ({
  caminhoRelativo,
  style,
  fallback = null,
  resizeMode = 'contain',
  accessibilityLabel,
}) => {
  const [dataUri, setDataUri] = useState<string | null>(() => {
    if (!caminhoRelativo) return null;
    if (caminhoRelativo.startsWith('data:')) return caminhoRelativo;
    return cacheDataUri.get(caminhoRelativo) || null;
  });
  const [erroAoCarregar, setErroAoCarregar] = useState<boolean>(false);

  useEffect(() => {
    setErroAoCarregar(false);
    if (!caminhoRelativo) {
      setDataUri(null);
      return;
    }

    if (caminhoRelativo.startsWith('data:')) {
      setDataUri(caminhoRelativo);
      return;
    }

    if (cacheDataUri.has(caminhoRelativo)) {
      setDataUri(cacheDataUri.get(caminhoRelativo)!);
      return;
    }

    let cancelado = false;
    identidadeApi.baixarImagemComoDataUri(caminhoRelativo).then((resultado) => {
      if (cancelado) return;
      if (resultado) {
        cacheDataUri.set(caminhoRelativo, resultado);
        setDataUri(resultado);
      } else {
        setErroAoCarregar(true);
      }
    });

    return () => {
      cancelado = true;
    };
  }, [caminhoRelativo]);

  if (!dataUri || erroAoCarregar) {
    return <>{fallback}</>;
  }

  return (
    <Image
      source={{ uri: dataUri }}
      style={style}
      resizeMode={resizeMode}
      accessibilityLabel={accessibilityLabel}
      onError={(e) => {
        console.warn('[ImagemAutenticada] Erro ao renderizar Data URI:', e.nativeEvent);
        setErroAoCarregar(true);
      }}
    />
  );
};
