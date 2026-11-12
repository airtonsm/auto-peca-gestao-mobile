import { clienteHttp } from './clienteHttp';
import { RespostaServico, PedidoServico } from '../types';

export interface CategoriaServicoItem {
  chave: string;
  rotulo: string;
}

export const CATEGORIAS_SERVICO_PADRAO: CategoriaServicoItem[] = [
  { chave: 'revisao', rotulo: 'Revisão preventiva' },
  { chave: 'motor', rotulo: 'Motor' },
  { chave: 'freios', rotulo: 'Freios' },
  { chave: 'suspensao', rotulo: 'Suspensão' },
  { chave: 'alinhamento', rotulo: 'Alinhamento e Balanceamento' },
  { chave: 'eletrica', rotulo: 'Elétrica' },
  { chave: 'ar-condicionado', rotulo: 'Ar-condicionado' },
  { chave: 'transmissao', rotulo: 'Transmissão' },
  { chave: 'diagnostico', rotulo: 'Diagnóstico' },
  { chave: 'arrefecimento', rotulo: 'Arrefecimento' },
  { chave: 'injecao', rotulo: 'Injeção Eletrônica' },
  { chave: 'escapamento', rotulo: 'Escapamento' },
  { chave: 'acessorios', rotulo: 'Acessórios' },
];

/**
 * Normaliza qualquer categoria ou rótulo recebido para uma chave válida no backend
 */
export function normalizarChaveCategoria(cat?: string): string {
  if (!cat || !cat.trim()) return 'revisao';
  const c = cat.trim().toLowerCase();
  if (c === 'mecânica' || c === 'mecanica') return 'motor';

  const matchChave = CATEGORIAS_SERVICO_PADRAO.find((p) => p.chave === c);
  if (matchChave) return matchChave.chave;

  const matchRotulo = CATEGORIAS_SERVICO_PADRAO.find((p) => p.rotulo.toLowerCase() === c);
  if (matchRotulo) return matchRotulo.chave;

  if (c.includes('freio')) return 'freios';
  if (c.includes('motor')) return 'motor';
  if (c.includes('suspens')) return 'suspensao';
  if (c.includes('revis')) return 'revisao';
  if (c.includes('eletric')) return 'eletrica';
  if (c.includes('ar-') || c.includes('ar condicionado')) return 'ar-condicionado';
  if (c.includes('alinh') || c.includes('balance')) return 'alinhamento';
  if (c.includes('transmiss') || c.includes('cambio')) return 'transmissao';
  if (c.includes('injec')) return 'injecao';
  if (c.includes('escap')) return 'escapamento';

  return 'revisao';
}

export const servicosApi = {
  /**
   * Lista todos os serviços cadastrados na oficina ativa.
   * Rota: GET /api/servicos
   */
  async listarServicos(): Promise<RespostaServico[]> {
    const response = await clienteHttp.get<RespostaServico[]>('/api/servicos');
    return response.data || [];
  },

  /**
   * Lista as categorias de serviços ativas da oficina.
   * Rota: GET /api/servicos/categorias?ativas=true
   */
  async listarCategoriasServico(): Promise<CategoriaServicoItem[]> {
    try {
      const response = await clienteHttp.get<any[]>('/api/servicos/categorias', {
        params: { ativas: true },
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data.map((item) => ({
          chave: item.chave || String(item).toLowerCase(),
          rotulo: item.rotulo || item.chave || String(item),
        }));
      }
      return CATEGORIAS_SERVICO_PADRAO;
    } catch {
      return CATEGORIAS_SERVICO_PADRAO;
    }
  },

  /**
   * Cadastra um novo serviço de mão de obra na oficina.
   * Rota: POST /api/servicos
   */
  async criarServico(pedido: PedidoServico): Promise<RespostaServico> {
    const categoriaNormalizada = normalizarChaveCategoria(pedido.categoria);
    const payload = {
      ...pedido,
      nome: pedido.nome.trim(),
      categoria: categoriaNormalizada,
    };

    const response = await clienteHttp.post<RespostaServico>('/api/servicos', payload);
    return response.data;
  },
};
