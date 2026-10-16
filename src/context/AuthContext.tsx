import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  UsuarioMe,
  OficinaDaSessao,
  RespostaLogin,
} from '../types';
import {
  carregarConfiguracoesSalvas,
  definirTokenAutenticacao,
  definirBaseUrl,
  obterBaseUrlAtual,
  registrarCallbackNaoAutorizado,
  extrairMensagemErro,
} from '../api/clienteHttp';
import { authApi } from '../api/authApi';
import { CONFIG_STORAGE_KEYS } from '../constants';

interface AuthContextData {
  usuario: UsuarioMe | null;
  oficinaAtiva: OficinaDaSessao | null;
  oficinasDisponiveis: OficinaDaSessao[];
  token: string | null;
  estaAutenticado: boolean;
  carregando: boolean;
  servidorUrl: string;
  precisaEscolherOficina: boolean;
  login: (email: string, senha: string, oficinaId?: string) => Promise<{
    sucesso: boolean;
    precisaEscolherOficina?: boolean;
    oficinas?: OficinaDaSessao[];
    mensagem?: string;
  }>;
  selecionarOficinaNoLogin: (oficinaId: string) => Promise<{ sucesso: boolean; mensagem?: string }>;
  trocarOficina: (oficinaId: string) => Promise<boolean>;
  logout: () => Promise<void>;
  atualizarServidorUrl: (novaUrl: string) => Promise<void>;
  recarregarUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<UsuarioMe | null>(null);
  const [oficinaAtiva, setOficinaAtiva] = useState<OficinaDaSessao | null>(null);
  const [oficinasDisponiveis, setOficinasDisponiveis] = useState<OficinaDaSessao[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [servidorUrl, setServidorUrl] = useState<string>(obterBaseUrlAtual());
  const [precisaEscolherOficina, setPrecisaEscolherOficina] = useState<boolean>(false);
  const [credenciaisTemporarias, setCredenciaisTemporarias] = useState<{
    email: string;
    senha: string;
  } | null>(null);

  // Inicializa o contexto carregando dados salvos
  useEffect(() => {
    const inicializar = async () => {
      setCarregando(true);
      try {
        const { token: tokenSalvo, baseUrl } = await carregarConfiguracoesSalvas();
        setServidorUrl(baseUrl);

        if (tokenSalvo) {
          setToken(tokenSalvo);
          try {
            const me = await authApi.obterEu();
            setUsuario(me);
            setOficinaAtiva({
              id: me.tenantId,
              nome: me.empresa,
            });

            // Recupera oficina salva se houver
            const oficinaJson = await SecureStore.getItemAsync(CONFIG_STORAGE_KEYS.OFICINA_ATIVA);
            if (oficinaJson) {
              try {
                const parsed = JSON.parse(oficinaJson);
                setOficinaAtiva(parsed);
              } catch (e) {
                // ignora
              }
            }
          } catch (e) {
            console.warn('Token existente inválido ou expirado:', e);
            await logout();
          }
        }
      } catch (e) {
        console.error('Erro na inicialização da autenticação:', e);
      } finally {
        setCarregando(false);
      }
    };

    registrarCallbackNaoAutorizado(() => {
      logout();
    });

    inicializar();
  }, []);

  const login = async (
    email: string,
    senha: string,
    oficinaId?: string
  ): Promise<{
    sucesso: boolean;
    precisaEscolherOficina?: boolean;
    oficinas?: OficinaDaSessao[];
    mensagem?: string;
  }> => {
    try {
      const resposta: RespostaLogin = await authApi.login(email, senha, oficinaId);

      // Cenário Multi-Oficina: senha correta, mas possui 2+ oficinas e não enviou oficinaId
      if (!resposta.tokenAcesso && resposta.oficinas && resposta.oficinas.length > 0) {
        setOficinasDisponiveis(resposta.oficinas);
        setPrecisaEscolherOficina(true);
        setCredenciaisTemporarias({ email, senha });
        return {
          sucesso: false,
          precisaEscolherOficina: true,
          oficinas: resposta.oficinas,
        };
      }

      if (resposta.tokenAcesso) {
        await processarLoginSucesso(resposta);
        return { sucesso: true };
      }

      return {
        sucesso: false,
        mensagem: 'Não foi possível concluir a autenticação. Verifique suas credenciais.',
      };
    } catch (error) {
      return {
        sucesso: false,
        mensagem: extrairMensagemErro(error),
      };
    }
  };

  const selecionarOficinaNoLogin = async (
    oficinaId: string
  ): Promise<{ sucesso: boolean; mensagem?: string }> => {
    if (!credenciaisTemporarias) {
      return {
        sucesso: false,
        mensagem: 'Sessão expirada. Digite seu e-mail e senha novamente.',
      };
    }

    const res = await login(
      credenciaisTemporarias.email,
      credenciaisTemporarias.senha,
      oficinaId
    );

    if (res.sucesso) {
      setPrecisaEscolherOficina(false);
      setCredenciaisTemporarias(null);
    }

    return res;
  };

  const processarLoginSucesso = async (resposta: RespostaLogin) => {
    if (!resposta.tokenAcesso) return;

    await definirTokenAutenticacao(resposta.tokenAcesso);
    setToken(resposta.tokenAcesso);

    // Salva lista de oficinas do usuário
    if (resposta.oficinas && resposta.oficinas.length > 0) {
      setOficinasDisponiveis(resposta.oficinas);
    }

    // Busca perfil atualizado
    let me: UsuarioMe | null = resposta.usuario;
    if (!me) {
      try {
        me = await authApi.obterEu();
      } catch (e) {
        console.warn('Erro ao carregar me após login:', e);
      }
    }

    if (me) {
      setUsuario(me);
      const oficina = {
        id: me.tenantId,
        nome: me.empresa,
      };
      setOficinaAtiva(oficina);
      await SecureStore.setItemAsync(
        CONFIG_STORAGE_KEYS.OFICINA_ATIVA,
        JSON.stringify(oficina)
      );
    }

    setPrecisaEscolherOficina(false);
    setCredenciaisTemporarias(null);
  };

  const trocarOficina = async (novaOficinaId: string): Promise<boolean> => {
    try {
      const resposta = await authApi.trocarOficina(novaOficinaId);
      if (resposta.tokenAcesso) {
        await processarLoginSucesso(resposta);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Erro ao trocar de oficina:', e);
      throw e;
    }
  };

  const logout = async () => {
    setUsuario(null);
    setOficinaAtiva(null);
    setToken(null);
    setOficinasDisponiveis([]);
    setPrecisaEscolherOficina(false);
    setCredenciaisTemporarias(null);

    await definirTokenAutenticacao(null);
    try {
      await SecureStore.deleteItemAsync(CONFIG_STORAGE_KEYS.OFICINA_ATIVA);
      await SecureStore.deleteItemAsync(CONFIG_STORAGE_KEYS.USER);
    } catch (e) {
      // ignora
    }
  };

  const atualizarServidorUrl = async (novaUrl: string) => {
    await definirBaseUrl(novaUrl);
    setServidorUrl(obterBaseUrlAtual());
  };

  const recarregarUsuario = async () => {
    if (!token) return;
    try {
      const me = await authApi.obterEu();
      setUsuario(me);
      setOficinaAtiva({
        id: me.tenantId,
        nome: me.empresa,
      });
    } catch (e) {
      console.warn('Falha ao recarregar dados do usuário:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        oficinaAtiva,
        oficinasDisponiveis,
        token,
        estaAutenticado: !!token && !!usuario,
        carregando,
        servidorUrl,
        precisaEscolherOficina,
        login,
        selecionarOficinaNoLogin,
        trocarOficina,
        logout,
        atualizarServidorUrl,
        recarregarUsuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
