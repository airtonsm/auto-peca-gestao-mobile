import { clienteHttp, obterBaseUrlAtual } from './clienteHttp';
import * as FileSystem from 'expo-file-system/legacy';
import {
  PerguntaChecklist,
  PedidoChecklist,
  RespostaChecklist,
  UrlDeUpload,
} from '../types';

export const checklistApi = {
  /**
   * Catálogo canônico de perguntas de vistoria.
   */
  async obterPerguntas(): Promise<PerguntaChecklist[]> {
    const response = await clienteHttp.get<PerguntaChecklist[]>('/api/checklists/perguntas');
    return response.data;
  },

  /**
   * Lista todos os checklists já realizados para uma determinada OS.
   */
  async obterChecklistsDaOS(osId: string): Promise<RespostaChecklist[]> {
    const response = await clienteHttp.get<RespostaChecklist[]>(`/api/os/${osId}/checklists`);
    return response.data;
  },

  /**
   * Obtém a URL legível/assinada para exibir uma imagem ou assinatura.
   * Suporta rotas locais (/api/arquivos/local/...) e URLs assinadas do Cloud Storage.
   */
  async obterUrlLeitura(caminho: string): Promise<string> {
    if (!caminho || caminho.trim() === '') {
      return '';
    }
    if (caminho.startsWith('http://') || caminho.startsWith('https://')) {
      return caminho;
    }
    try {
      const response = await clienteHttp.post<{ url: string }>(
        `/api/arquivos/url-de-leitura?caminho=${encodeURIComponent(caminho)}`
      );
      const url = response.data?.url || '';
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      return `${obterBaseUrlAtual()}${url.startsWith('/') ? '' : '/'}${url}`;
    } catch {
      // Fallback para rota local de arquivos
      const limpo = caminho.startsWith('/') ? caminho.substring(1) : caminho;
      return `${obterBaseUrlAtual()}/api/arquivos/local/${limpo}`;
    }
  },

  /**
   * Solicita autorização / URL assinada para upload de imagem ou assinatura.
   */
  async pedirUrlUpload(
    pasta: 'avarias' | 'assinaturas' | 'checklists' | string,
    nomeArquivo: string,
    tipoDeConteudo: string
  ): Promise<UrlDeUpload> {
    const response = await clienteHttp.post<UrlDeUpload>('/api/arquivos/url-de-envio', {
      pasta,
      nomeArquivo,
      tipoDeConteudo,
    });
    return response.data;
  },

  /**
   * Envia os bytes de uma foto para a URL de envio (pode ser Cloud Storage ou endpoint local).
   * Utiliza upload nativo via FileSystem.uploadAsync para evitar erros de Blob/ArrayBuffer no React Native.
   */
  async enviarFotoArquivo(
    urlDeEnvio: string,
    localUri: string,
    tipoDeConteudo: string = 'image/jpeg'
  ): Promise<void> {
    const urlDestino = urlDeEnvio.startsWith('http://') || urlDeEnvio.startsWith('https://')
      ? urlDeEnvio
      : `${obterBaseUrlAtual()}${urlDeEnvio}`;

    const uploadResponse = await FileSystem.uploadAsync(urlDestino, localUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Content-Type': tipoDeConteudo,
      },
    });

    if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
      throw new Error(`Falha no upload da foto (${uploadResponse.status}): ${uploadResponse.body || 'Erro'}`);
    }
  },

  /**
   * Envia a assinatura digital (Base64 PNG) colhida na tela.
   * Grava temporariamente no cache e faz upload nativo streaming PUT sem utilizar Blobs do JS.
   */
  async enviarAssinaturaBase64(
    urlDeEnvio: string,
    base64Png: string
  ): Promise<void> {
    const urlDestino = urlDeEnvio.startsWith('http://') || urlDeEnvio.startsWith('https://')
      ? urlDeEnvio
      : `${obterBaseUrlAtual()}${urlDeEnvio}`;

    // Remove prefixo data:image/png;base64, se houver
    const limpo = base64Png.replace(/^data:image\/\w+;base64,/, '');

    const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    const caminhoTemp = `${dir}temp_assinatura_${Date.now()}.png`;
    try {
      await FileSystem.writeAsStringAsync(caminhoTemp, limpo, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const uploadResponse = await FileSystem.uploadAsync(urlDestino, caminhoTemp, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': 'image/png',
        },
      });

      if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
        throw new Error(`Falha no upload da assinatura (${uploadResponse.status}): ${uploadResponse.body || 'Erro'}`);
      }
    } finally {
      await FileSystem.deleteAsync(caminhoTemp, { idempotent: true }).catch(() => {});
    }
  },

  /**
   * Grava o checklist preenchido na Ordem de Serviço.
   */
  async gravarChecklist(osId: string, pedido: PedidoChecklist): Promise<RespostaChecklist> {
    const response = await clienteHttp.post<RespostaChecklist>(
      `/api/os/${osId}/checklists`,
      pedido
    );
    return response.data;
  },
};
