import { clienteHttp } from './clienteHttp';
import {
  RespostaConversaDaOS,
  PedidoEnvioMensagemOS,
  RespostaTemplate,
} from '../types';

export const comunicacaoApi = {
  /**
   * Obtém a conversa vinculada à Ordem de Serviço, incluindo contatos do cliente
   * e dados da janela oficial de WhatsApp (Z-API / Meta Cloud API).
   * Rota: GET /api/comunicacao/os/{osId}/conversa
   */
  async obterConversaDaOS(osId: string): Promise<RespostaConversaDaOS> {
    const response = await clienteHttp.get<RespostaConversaDaOS>(
      `/api/comunicacao/os/${osId}/conversa`
    );
    return response.data;
  },

  /**
   * Dispara uma mensagem manual através do canal oficial de comunicação (WhatsApp Business).
   * Rota: POST /api/comunicacao/mensagens
   */
  async enviarMensagemOficial(pedido: PedidoEnvioMensagemOS): Promise<any> {
    const response = await clienteHttp.post('/api/comunicacao/mensagens', pedido);
    return response.data;
  },

  /**
   * Lista os templates de comunicação cadastrados e seu estado de aprovação na Meta / Provedor.
   * Rota: GET /api/comunicacao/templates
   */
  async listarTemplates(): Promise<RespostaTemplate[]> {
    try {
      const response = await clienteHttp.get<RespostaTemplate[]>('/api/comunicacao/templates');
      return response.data || [];
    } catch (e) {
      console.warn('[comunicacaoApi] Falha ao consultar templates da oficina:', e);
      return [];
    }
  },
};
