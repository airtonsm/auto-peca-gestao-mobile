import { clienteHttp } from './clienteHttp';
import {
  VendaBalcao,
  ComprovanteVenda,
  PedidoFecharVenda,
} from '../types';

export interface FiltrosVenda {
  de?: string;
  ate?: string;
  status?: string; // 'fechada' | 'orcamento' | 'cancelada' | 'aberta'
}

export const vendasApi = {
  /**
   * Abre uma nova venda no balcão.
   */
  async abrirVenda(clienteId?: string | null): Promise<VendaBalcao> {
    const response = await clienteHttp.post<VendaBalcao>('/api/vendas', {
      clienteId: clienteId ?? null,
    });
    return response.data;
  },

  /**
   * Abre um novo orçamento de balcão.
   */
  async abrirOrcamento(clienteId?: string | null): Promise<VendaBalcao> {
    const response = await clienteHttp.post<VendaBalcao>('/api/vendas/orcamento', {
      clienteId: clienteId ?? null,
    });
    return response.data;
  },

  /**
   * Lista vendas e orçamentos conforme filtros de período e status.
   */
  async listarVendas(filtros?: FiltrosVenda): Promise<VendaBalcao[]> {
    const params: Record<string, string> = {};
    if (filtros?.de) params.de = filtros.de;
    if (filtros?.ate) params.ate = filtros.ate;
    if (filtros?.status && filtros.status !== 'todas') params.status = filtros.status;

    const response = await clienteHttp.get<VendaBalcao[]>('/api/vendas', { params });
    return response.data;
  },

  /**
   * Obtém detalhes de uma venda ou orçamento por ID.
   */
  async obterPorId(id: string): Promise<VendaBalcao> {
    const response = await clienteHttp.get<VendaBalcao>(`/api/vendas/${id}`);
    return response.data;
  },

  /**
   * Adiciona uma peça na venda aberta.
   */
  async adicionarItem(
    vendaId: string,
    pecaId: string,
    quantidade: number,
    precoUnitario?: number | null
  ): Promise<VendaBalcao> {
    const response = await clienteHttp.post<VendaBalcao>(`/api/vendas/${vendaId}/itens`, {
      pecaId,
      quantidade,
      precoUnitario: precoUnitario ?? null,
    });
    return response.data;
  },

  /**
   * Remove um item da venda aberta.
   */
  async removerItem(vendaId: string, itemId: string): Promise<VendaBalcao> {
    const response = await clienteHttp.delete<VendaBalcao>(
      `/api/vendas/${vendaId}/itens/${itemId}`
    );
    return response.data;
  },

  /**
   * Associa ou desassocia um cliente à venda.
   */
  async definirCliente(vendaId: string, clienteId: string | null): Promise<VendaBalcao> {
    const response = await clienteHttp.put<VendaBalcao>(`/api/vendas/${vendaId}/cliente`, {
      clienteId,
    });
    return response.data;
  },

  /**
   * Conclui a venda no balcão com forma de pagamento, parcelas e desconto.
   */
  async fecharVenda(vendaId: string, dados: PedidoFecharVenda): Promise<VendaBalcao> {
    const response = await clienteHttp.post<VendaBalcao>(`/api/vendas/${vendaId}/fechar`, {
      formaPagamento: dados.formaPagamento,
      desconto: dados.desconto || 0,
      motivo: dados.motivo ?? null,
      parcelas: dados.parcelas ?? 1,
      autorizacaoCartao: dados.autorizacaoCartao?.trim() || '',
      autorizacaoCreditoId: dados.autorizacaoCreditoId ?? null,
      observacoes: dados.observacoes?.trim() || null,
    });
    return response.data;
  },

  /**
   * Salva a venda em andamento como um Orçamento de balcão.
   */
  async salvarComoOrcamento(
    vendaId: string,
    clienteId?: string | null,
    observacoes?: string
  ): Promise<VendaBalcao> {
    const response = await clienteHttp.post<VendaBalcao>(`/api/vendas/${vendaId}/orcamento`, {
      clienteId: clienteId ?? null,
      observacoes: observacoes?.trim() || null,
    });
    return response.data;
  },

  /**
   * Aprova um orçamento prévio, transformando-o em venda fechada.
   */
  async aprovarOrcamento(vendaId: string, dados: PedidoFecharVenda): Promise<VendaBalcao> {
    const response = await clienteHttp.post<VendaBalcao>(`/api/vendas/${vendaId}/aprovar`, {
      formaPagamento: dados.formaPagamento,
      desconto: dados.desconto || 0,
      motivo: dados.motivo ?? null,
      parcelas: dados.parcelas ?? 1,
      autorizacaoCartao: dados.autorizacaoCartao?.trim() || '',
      autorizacaoCreditoId: dados.autorizacaoCreditoId ?? null,
      observacoes: dados.observacoes?.trim() || null,
    });
    return response.data;
  },

  /**
   * Cancela uma venda ou orçamento.
   */
  async cancelarVenda(vendaId: string): Promise<VendaBalcao> {
    const response = await clienteHttp.post<VendaBalcao>(`/api/vendas/${vendaId}/cancelar`, {});
    return response.data;
  },

  /**
   * Obtém os dados completos formatados do comprovante não fiscal.
   */
  async obterComprovante(vendaId: string): Promise<ComprovanteVenda> {
    const response = await clienteHttp.get<ComprovanteVenda>(`/api/vendas/${vendaId}/comprovante`);
    return response.data;
  },
};
