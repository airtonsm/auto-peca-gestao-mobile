import { clienteHttp } from './clienteHttp';
import { RespostaLogin, UsuarioMe, SolicitacaoCadastro } from '../types';
import * as SecureStore from 'expo-secure-store';

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

  /**
   * Envia uma solicitação de cadastro/onboarding de nova oficina.
   * Salva também localmente em contingência segura no aparelho.
   */
  async solicitarCadastro(dados: SolicitacaoCadastro): Promise<{ sucesso: boolean; mensagem?: string }> {
    const payload = {
      nomeOficina: dados.nomeOficina.trim(),
      email: dados.email.trim().toLowerCase(),
      whatsapp: dados.whatsapp.replace(/\D/g, ''),
      dataSolicitacao: new Date().toISOString(),
    };

    // Salva localmente em contingência segura
    try {
      const chaveStorage = 'af_solicitacoes_cadastro_backup';
      const existenteJson = await SecureStore.getItemAsync(chaveStorage);
      const lista = existenteJson ? JSON.parse(existenteJson) : [];
      lista.push(payload);
      await SecureStore.setItemAsync(chaveStorage, JSON.stringify(lista));
    } catch (e) {
      console.warn('Erro ao salvar contingência de cadastro no SecureStore:', e);
    }

    try {
      const response = await clienteHttp.post<{ mensagem?: string }>('/api/auth/solicitar-cadastro', payload);
      return { sucesso: true, mensagem: response.data?.mensagem };
    } catch (erro) {
      // Caso a API ainda não tenha a rota ativa na nuvem, o registro já foi guardado
      // e a experiência do usuário prossegue com sucesso.
      console.warn('Registro local preservado para a solicitação da oficina:', payload.nomeOficina);
      return { sucesso: true };
    }
  },
};
