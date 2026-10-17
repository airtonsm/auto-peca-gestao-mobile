import { clienteHttp } from './clienteHttp';
import {
  RespostaItemPecaOS,
  PedidoItemPecaOS,
  PedidoQuantidadeItemPecaOS,
} from '../types';

export const pecasOSApi = {
  /**
   * Lista todas as peças associadas a uma Ordem de Serviço específica.
   */
  async listarPecas(osId: string): Promise<RespostaItemPecaOS[]> {
    const response = await clienteHttp.get<RespostaItemPecaOS[]>(`/api/os/${osId}/pecas`);
    return response.data || [];
  },

  /**
   * Obtém o valor total acumulado das peças da Ordem de Serviço.
   */
  async obterTotalPecas(osId: string): Promise<number> {
    const response = await clienteHttp.get<{ total: number }>(`/api/os/${osId}/pecas/total`);
    return response.data?.total ?? 0;
  },

  /**
   * Lança uma peça na Ordem de Serviço.
   * Se o saldo for insuficiente, a API vincula o item com status "aguardando".
   */
  async lancarPeca(osId: string, pedido: PedidoItemPecaOS): Promise<RespostaItemPecaOS> {
    const response = await clienteHttp.post<RespostaItemPecaOS>(
      `/api/os/${osId}/pecas`,
      pedido
    );
    return response.data;
  },

  /**
   * Altera a quantidade de uma peça já lançada na OS.
   */
  async alterarQuantidade(
    osId: string,
    itemId: string,
    quantidade: number
  ): Promise<RespostaItemPecaOS> {
    const payload: PedidoQuantidadeItemPecaOS = { quantidade };
    const response = await clienteHttp.patch<RespostaItemPecaOS>(
      `/api/os/${osId}/pecas/${itemId}`,
      payload
    );
    return response.data;
  },

  /**
   * Marca a peça como aplicada (montada) no veículo e efetiva a saída física do estoque.
   */
  async aplicarPeca(
    osId: string,
    itemId: string,
    motivo?: string
  ): Promise<RespostaItemPecaOS> {
    const response = await clienteHttp.post<RespostaItemPecaOS>(
      `/api/os/${osId}/pecas/${itemId}/aplicar`,
      null,
      {
        params: motivo ? { motivo } : undefined,
      }
    );
    return response.data;
  },

  /**
   * Remove a peça da Ordem de Serviço e devolve a reserva ao estoque da oficina.
   */
  async removerPeca(osId: string, itemId: string): Promise<void> {
    await clienteHttp.delete(`/api/os/${osId}/pecas/${itemId}`);
  },
};
