import { clienteHttp } from './clienteHttp';
import { RespostaPeca, PedidoCriarPeca } from '../types';

export { PedidoCriarPeca };

export const estoqueApi = {
  /**
   * Busca peças no estoque por termo (código interno, OEM, descrição ou fabricante).
   */
  async buscarPecas(termo: string = '', incluirInativos: boolean = false): Promise<RespostaPeca[]> {
    const params: Record<string, string | boolean> = {
      inativos: incluirInativos,
    };
    if (termo && termo.trim().length > 0) {
      params.q = termo.trim();
    }
    const response = await clienteHttp.get<RespostaPeca[]>('/api/pecas', { params });
    return response.data;
  },

  /**
   * Busca peça por ID específico.
   */
  async obterPorId(id: string): Promise<RespostaPeca> {
    const response = await clienteHttp.get<RespostaPeca>(`/api/pecas/${id}`);
    return response.data;
  },

  /**
   * Cadastra uma nova peça no catálogo com suporte a saldo inicial físico.
   */
  async criarPeca(pedido: PedidoCriarPeca): Promise<RespostaPeca> {
    const response = await clienteHttp.post<RespostaPeca>('/api/pecas', pedido);
    return response.data;
  },
};
