import { clienteHttp, obterBaseUrlAtual } from './clienteHttp';
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
   * Solicita autorização / URL assinada para upload de imagem ou assinatura.
   */
  async pedirUrlUpload(
    pasta: 'avarias' | 'assinaturas',
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
   * ATENÇÃO: NÃO envia o cabeçalho Authorization do Spring no PUT.
   */
  async enviarFotoArquivo(
    urlDeEnvio: string,
    localUri: string,
    tipoDeConteudo: string = 'image/jpeg'
  ): Promise<void> {
    const urlDestino = urlDeEnvio.startsWith('http://') || urlDeEnvio.startsWith('https://')
      ? urlDeEnvio
      : `${obterBaseUrlAtual()}${urlDeEnvio}`;

    // Converte o arquivo local em blob para upload binário PUT
    const responseLocal = await fetch(localUri);
    const blob = await responseLocal.blob();

    const uploadResponse = await fetch(urlDestino, {
      method: 'PUT',
      headers: {
        'Content-Type': tipoDeConteudo,
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Falha no upload da foto (${uploadResponse.status} ${uploadResponse.statusText})`);
    }
  },

  /**
   * Envia a assinatura digital (Base64 PNG) colhida na tela.
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
    
    // Converte Base64 para Uint8Array / Blob
    const binaryString = atob(limpo);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });

    const uploadResponse = await fetch(urlDestino, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/png',
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Falha no upload da assinatura (${uploadResponse.status} ${uploadResponse.statusText})`);
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
