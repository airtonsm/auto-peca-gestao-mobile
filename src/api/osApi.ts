import { clienteHttp } from './clienteHttp';
import { RespostaOSResumo } from '../types';

export const osApi = {
  /**
   * Lista as ordens de serviço do pátio. Por padrão lista as abertas.
   */
  async listarOS(apenasAbertas: boolean = true, status?: string[]): Promise<RespostaOSResumo[]> {
    const params: Record<string, any> = {
      abertas: apenasAbertas,
    };
    if (status && status.length > 0) {
      params.status = status;
    }
    const response = await clienteHttp.get<RespostaOSResumo[]>('/api/os', { params });
    return response.data;
  },

  /**
   * Obtém os detalhes completos de uma Ordem de Serviço pelo ID.
   */
  async obterPorId(id: string): Promise<any> {
    const response = await clienteHttp.get(`/api/os/${id}`);
    return response.data;
  },
};
