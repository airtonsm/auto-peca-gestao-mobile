import { clienteHttp } from './clienteHttp';

export interface RespostaLogo {
  largura: number;
  altura: number;
  tamanho: number;
  usarEmOrcamento?: boolean;
  usarNaDanfe?: boolean;
  usarNaNfce?: boolean;
  atualizadaEm?: string;
  url: string; // Ex: /api/identidade/logo/5d2f1e0a-0000-4000-8000-000000000a01
}

export interface RespostaIdentidade {
  logo: RespostaLogo | null;
}

export interface RespostaMinhaFoto {
  url: string | null; // Ex: /api/identidade/foto/5d2f1e0a-0000-4000-8000-000000000a02
}

/**
 * Converte ArrayBuffer em string Base64 RFC 4648 pura, sem dependência de Buffer/btoa.
 */
function arrayBufferParaBase64(buffer: ArrayBuffer): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new Uint8Array(buffer);
  let base64 = '';
  const len = bytes.byteLength;

  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    base64 += chars[b0 >> 2];
    base64 += chars[((b0 & 3) << 4) | (b1 >> 4)];
    base64 += i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    base64 += i + 2 < len ? chars[b2 & 63] : '=';
  }

  return base64;
}

export const identidadeApi = {
  /**
   * Obtém as configurações de identidade visual da oficina (incluindo logo).
   * Rota: GET /api/identidade
   */
  async obterIdentidade(): Promise<RespostaIdentidade | null> {
    try {
      const response = await clienteHttp.get<RespostaIdentidade>('/api/identidade');
      return response.data || null;
    } catch (e: any) {
      console.warn('[identidadeApi] Não foi possível obter identidade:', e?.response?.status || e?.message);
      return null;
    }
  },

  /**
   * Obtém a URL da foto do perfil do usuário autenticado.
   * Rota: GET /api/identidade/minha-foto
   */
  async obterMinhaFoto(): Promise<RespostaMinhaFoto | null> {
    try {
      const response = await clienteHttp.get<RespostaMinhaFoto>('/api/identidade/minha-foto');
      return response.data || null;
    } catch (e: any) {
      console.warn('[identidadeApi] Não foi possível obter minha-foto:', e?.response?.status || e?.message);
      return null;
    }
  },

  /**
   * Baixa a imagem protegida da API usando o cliente HTTP autenticado
   * e a converte para Data URI (base64). Isso contorna restrições de headers
   * Authorization em tags e componentes nativos de imagem.
   */
  async baixarImagemComoDataUri(caminhoOuUrl: string): Promise<string | null> {
    if (!caminhoOuUrl) return null;
    if (caminhoOuUrl.startsWith('data:')) return caminhoOuUrl;

    try {
      console.log('[identidadeApi] Baixando imagem autenticada:', caminhoOuUrl);
      const response = await clienteHttp.get<ArrayBuffer>(caminhoOuUrl, {
        responseType: 'arraybuffer',
      });

      const contentType = response.headers['content-type'] || 'image/png';
      const base64 = arrayBufferParaBase64(response.data);
      const dataUri = `data:${contentType};base64,${base64}`;
      console.log('[identidadeApi] Imagem carregada e codificada com sucesso!');
      return dataUri;
    } catch (e: any) {
      console.warn('[identidadeApi] Falha ao baixar bytes da imagem:', caminhoOuUrl, e?.message);
      return null;
    }
  },
};
