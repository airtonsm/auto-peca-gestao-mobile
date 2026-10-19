import { clienteHttp } from './clienteHttp';
import {
  RespostaOSResumo,
  RespostaOSCompleta,
  PedidoTransicaoStatusOS,
  PedidoCriarOS,
  RespostaVeiculo,
  PedidoCriarVeiculo,
  RespostaCliente,
  PedidoCriarCliente,
  RespostaBox,
} from '../types';

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
  async obterPorId(id: string): Promise<RespostaOSCompleta> {
    const response = await clienteHttp.get<RespostaOSCompleta>(`/api/os/${id}`);
    return response.data;
  },

  /**
   * Transiciona o status da Ordem de Serviço no backend com suporte a bloqueio otimista via campo versao.
   * Rota: POST /api/os/{osId}/status
   */
  async mudarStatus(osId: string, pedido: PedidoTransicaoStatusOS): Promise<any> {
    const response = await clienteHttp.post(`/api/os/${osId}/status`, pedido);
    return response.data;
  },

  /**
   * Cria uma nova Ordem de Serviço no pátio.
   * Rota: POST /api/os
   */
  async criarOS(pedido: PedidoCriarOS): Promise<RespostaOSResumo> {
    const response = await clienteHttp.post<RespostaOSResumo>('/api/os', pedido);
    return response.data;
  },

  /**
   * Busca veículos cadastrados pela placa (exata ou parcial).
   * Rota: GET /api/veiculos/busca?placa={placa}
   */
  async buscarVeiculosPorPlaca(placa: string): Promise<RespostaVeiculo[]> {
    const limpa = (placa || '').replace(/[^a-zA-Z0-9]/g, '');
    if (!limpa || limpa.length < 2) return [];
    const response = await clienteHttp.get<RespostaVeiculo[]>('/api/veiculos/busca', {
      params: { placa: limpa },
    });
    return response.data || [];
  },

  /**
   * Cadastra um novo veículo vinculado a um cliente.
   * Rota: POST /api/veiculos
   */
  async criarVeiculo(pedido: PedidoCriarVeiculo): Promise<RespostaVeiculo> {
    const response = await clienteHttp.post<RespostaVeiculo>('/api/veiculos', pedido);
    return response.data;
  },

  /**
   * Busca clientes cadastrados pelo termo (nome, CPF, telefone).
   * Rota: GET /api/clientes?q={termo}
   */
  async buscarClientes(termo: string): Promise<RespostaCliente[]> {
    if (!termo || termo.trim().length < 2) return [];
    const response = await clienteHttp.get<RespostaCliente[]>('/api/clientes', {
      params: { q: termo.trim() },
    });
    return response.data || [];
  },

  /**
   * Cadastra um novo cliente rapidamente.
   * Rota: POST /api/clientes
   */
  async criarCliente(pedido: PedidoCriarCliente): Promise<RespostaCliente> {
    const response = await clienteHttp.post<RespostaCliente>('/api/clientes', pedido);
    return response.data;
  },

  /**
   * Lista os boxes e elevadores disponíveis na oficina.
   * Rota: GET /api/boxes
   */
  async listarBoxes(): Promise<RespostaBox[]> {
    try {
      const response = await clienteHttp.get<RespostaBox[]>('/api/boxes');
      return response.data || [];
    } catch {
      return [];
    }
  },
};
