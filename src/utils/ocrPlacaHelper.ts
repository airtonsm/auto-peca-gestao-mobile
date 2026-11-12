import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Normaliza e tenta extrair uma placa brasileira (Mercosul ou antiga) a partir de texto lido por OCR.
 */
export const extrairPlacaDoTexto = (textoBruto: string): string | null => {
  if (!textoBruto) return null;

  // Remove quebras de linha e caracteres especiais exceto alfanuméricos
  const textoLimpo = textoBruto.toUpperCase().replace(/[^A-Z0-9\s-]/g, ' ');

  // 1. Tenta encontrar placa Mercosul (ex: BRA2E19, ABC1D23) ou Antiga (ex: ABC1234)
  // Formato Mercosul: 3 letras + 1 número + 1 letra ou número + 2 números
  const regexMercosul = /\b([A-Z]{3})[- ]?([0-9])([A-Z0-9])([0-9]{2})\b/g;
  const matchMercosul = regexMercosul.exec(textoLimpo);
  if (matchMercosul) {
    const p1 = matchMercosul[1];
    const p2 = matchMercosul[2];
    const p3 = matchMercosul[3];
    const p4 = matchMercosul[4];
    return `${p1}${p2}${p3}${p4}`;
  }

  // 2. Tenta encontrar placa antiga tradicional (ex: ABC1234, ABC-1234)
  const regexAntiga = /\b([A-Z]{3})[- ]?([0-9]{4})\b/g;
  const matchAntiga = regexAntiga.exec(textoLimpo);
  if (matchAntiga) {
    return `${matchAntiga[1]}${matchAntiga[2]}`;
  }

  // 3. Fallback inteligente: procura por blocos alfanuméricos de 7 caracteres com substituição de confusões de OCR
  const palavras = textoLimpo.split(/\s+/);
  for (const p of palavras) {
    const candidata = p.replace(/[^A-Z0-9]/g, '');
    if (candidata.length === 7) {
      const corrigida = corrigirConfusoesPlaca(candidata);
      if (corrigida) return corrigida;
    }
  }

  return null;
};

/**
 * Corrige caracteres tipicamente confundidos por OCR:
 * - Posições 0, 1, 2 devem ser letras (A-Z)
 * - Posição 3 deve ser número (0-9)
 * - Posição 4 pode ser letra (Mercosul) ou número (Cinza)
 * - Posições 5, 6 devem ser números (0-9)
 */
export const corrigirConfusoesPlaca = (candidata: string): string | null => {
  if (candidata.length !== 7) return null;

  const mapParaLetra: Record<string, string> = {
    '0': 'O',
    '1': 'I',
    '2': 'Z',
    '3': 'B',
    '4': 'A',
    '5': 'S',
    '6': 'G',
    '7': 'T',
    '8': 'B',
  };

  const mapParaNumero: Record<string, string> = {
    O: '0',
    D: '0',
    Q: '0',
    I: '1',
    L: '1',
    Z: '2',
    B: '8',
    S: '5',
    G: '6',
    T: '7',
  };

  const chars = candidata.split('');

  // Posições 0, 1, 2 -> Letras
  for (let i = 0; i < 3; i++) {
    if (/[0-9]/.test(chars[i])) {
      chars[i] = mapParaLetra[chars[i]] || chars[i];
    }
    if (!/[A-Z]/.test(chars[i])) return null;
  }

  // Posição 3 -> Número
  if (/[A-Z]/.test(chars[3])) {
    chars[3] = mapParaNumero[chars[3]] || chars[3];
  }
  if (!/[0-9]/.test(chars[3])) return null;

  // Posições 5 e 6 -> Números
  for (let i = 5; i <= 6; i++) {
    if (/[A-Z]/.test(chars[i])) {
      chars[i] = mapParaNumero[chars[i]] || chars[i];
    }
    if (!/[0-9]/.test(chars[i])) return null;
  }

  // Posição 4 -> Alfanumérico
  return chars.join('');
};

/**
 * Envia a imagem para o serviço de reconhecimento OCR gratuito
 */
export const reconhecerPlacaDaImagem = async (uri: string): Promise<string | null> => {
  try {
    // 1. Otimiza a imagem: redimensiona para largura ideal de OCR e converte para JPEG
    const fotoOtimizada = await manipulateAsync(
      uri,
      [{ resize: { width: 1000 } }],
      { compress: 0.8, format: SaveFormat.JPEG, base64: true }
    );

    if (!fotoOtimizada.base64) {
      return null;
    }

    // 2. Chama a API gratuita de OCR (OCR.Space)
    const formData = new FormData();
    formData.append('base64Image', `data:image/jpeg;base64,${fotoOtimizada.base64}`);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2'); // Engine 2 é otimizada para textos numéricos e caracteres isolados

    const resposta = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        apikey: 'K87899148788957', // Chave padrão de API pública OCR.space
      },
      body: formData,
    });

    const json = await resposta.json();
    if (json?.ParsedResults && json.ParsedResults.length > 0) {
      const textoDetectado = json.ParsedResults[0].ParsedText || '';
      const placa = extrairPlacaDoTexto(textoDetectado);
      if (placa) {
        return placa;
      }
    }

    return null;
  } catch (e) {
    console.warn('Erro ao processar OCR da placa:', e);
    return null;
  }
};
