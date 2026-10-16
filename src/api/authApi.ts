import { clienteHttp } from './clienteHttp';
import { RespostaLogin, UsuarioMe } from '../types';

export const authApi = {
  /**
   * Realiza login no sistema. Se o usuário tiver múltiplas oficinas e não passar oficina,
   * a resposta trará tokenAcesso: null e a lista de oficinas disponíveis.
   */
  async login(email: string, senha: string, oficinaId?: string): Promise<RespostaLogin> {
    const payload: { email: string; senha: string; oficina?: string } = {
      email: email.trim(),
      senha,
    };
    if (oficinaId) {
      payload.oficina = oficinaId;
    }
    const response = await clienteHttp.post<RespostaLogin>('/api/auth/login', payload);
    return response.data;
  },

  /**
   * Troca a oficina atual para outra permitida ao usuário.
   * Devolve uma nova RespostaLogin com novo token JWT contextualizado no novo tenant.
   */
  async trocarOficina(oficinaId: string): Promise<RespostaLogin> {
    const response = await clienteHttp.post<RespostaLogin>('/api/auth/trocar-oficina', {
      oficina: oficinaId,
    });
    return response.data;
  },

  /**
   * Obtém a identidade e permissões do usuário na oficina ativa.
   */
  async obterEu(): Promise<UsuarioMe> {
    const response = await clienteHttp.get<UsuarioMe>('/api/me');
    return response.data;
  },

  /**
   * Testa conectividade com a API (endpoint público de saúde).
   */
  async testarConexao(): Promise<{ status: string; versao?: string }> {
    const response = await clienteHttp.get<{ status: string; versao?: string }>('/api/saude');
    return response.data;
  },
};
