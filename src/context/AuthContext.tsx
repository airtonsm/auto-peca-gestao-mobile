import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
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
import { identidadeApi } from '../api/identidadeApi';
import { CONFIG_STORAGE_KEYS } from '../constants';
import {
  TipoBiometria,
  verificarSuporteBiometria,
  salvarCredencialBiometria,
  obterCredencialBiometria,
  removerCredencialBiometria,
  executarLeituraBiometrica,
  obterRotuloBiometria,
} from '../utils/biometriaLoginHelper';

interface AuthContextData {
  usuario: UsuarioMe | null;
  oficinaAtiva: OficinaDaSessao | null;
  oficinasDisponiveis: OficinaDaSessao[];
  token: string | null;
  estaAutenticado: boolean;
  carregando: boolean;
  servidorUrl: string;
  precisaEscolherOficina: boolean;
  logoUrl: string | null;
  fotoUrl: string | null;
  // Estados de Biometria
  biometriaDisponivel: boolean;
  hardwareBiometrico: boolean;
  biometriaCadastrada: boolean;
  biometriaAtiva: boolean;
  biometriaDispensada: boolean;
  tipoBiometria: TipoBiometria;
  rotuloBiometria: string;
  ultimoUsuarioBiometria: { email: string; nome: string } | null;
  temSenhaEmMemoria: boolean;
  // Métodos de Autenticação e Biometria
  login: (
    email: string,
    senha: string,
    oficinaId?: string,
    adiarFinalizacao?: boolean
  ) => Promise<{
    sucesso: boolean;
    precisaEscolherOficina?: boolean;
    oficinas?: OficinaDaSessao[];
    mensagem?: string;
    resposta?: RespostaLogin;
  }>;
  concluirLogin: (resposta: RespostaLogin, senhaUtilizada?: string) => Promise<void>;
  loginComBiometria: () => Promise<{ sucesso: boolean; mensagem?: string }>;
  ativarBiometria: (
    ativar: boolean,
    senhaOpcional?: string,
    emailOpcional?: string,
    nomeOpcional?: string
  ) => Promise<boolean>;
  dispensarBiometria: () => Promise<void>;
  recarregarEstadoBiometria: () => Promise<void>;
  selecionarOficinaNoLogin: (oficinaId: string) => Promise<{ sucesso: boolean; mensagem?: string }>;
  cancelarEscolhaOficina: () => void;
  trocarOficina: (oficinaId: string) => Promise<boolean>;
  logout: () => Promise<void>;
  atualizarServidorUrl: (novaUrl: string) => Promise<void>;
  recarregarUsuario: () => Promise<void>;
  recarregarIdentidadeVisual: () => Promise<void>;
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [credenciaisTemporarias, setCredenciaisTemporarias] = useState<{
    email: string;
    senha: string;
  } | null>(null);

  // Estados Biométricos
  const [biometriaDisponivel, setBiometriaDisponivel] = useState<boolean>(false);
  const [hardwareBiometrico, setHardwareBiometrico] = useState<boolean>(false);
  const [biometriaCadastrada, setBiometriaCadastrada] = useState<boolean>(false);
  const [biometriaAtiva, setBiometriaAtiva] = useState<boolean>(false);
  const [biometriaDispensada, setBiometriaDispensada] = useState<boolean>(false);
  const [tipoBiometria, setTipoBiometria] = useState<TipoBiometria>('OUTRO');
  const [ultimoUsuarioBiometria, setUltimoUsuarioBiometria] = useState<{
    email: string;
    nome: string;
  } | null>(null);

  // Mantém a senha na memória volátil durante a sessão ativa (nunca exposta em storage inseguro)
  const senhaEmMemoriaRef = useRef<string | null>(null);
  const emailEmMemoriaRef = useRef<string | null>(null);
  const nomeEmMemoriaRef = useRef<string | null>(null);

  const rotuloBiometria = obterRotuloBiometria(tipoBiometria);

  /**
   * Recarrega o estado de compatibilidade e ativação da biometria no aparelho.
   */
  const recarregarEstadoBiometria = async () => {
    try {
      const suporte = await verificarSuporteBiometria();
      console.log('[Biometria] Suporte retornado:', JSON.stringify(suporte));
      const disponivel = suporte.compativel && suporte.cadastrado;
      setHardwareBiometrico(suporte.compativel);
      setBiometriaCadastrada(suporte.cadastrado);
      setBiometriaDisponivel(disponivel);
      setTipoBiometria(suporte.tipo);

      const credSalva = await obterCredencialBiometria();
      console.log('[Biometria] Credencial salva no SecureStore:', !!credSalva);
      if (credSalva) {
        setBiometriaAtiva(true);
        setUltimoUsuarioBiometria({
          email: credSalva.email,
          nome: credSalva.nome,
        });
      } else {
        setBiometriaAtiva(false);
        setUltimoUsuarioBiometria(null);
      }

      const dispensada = await SecureStore.getItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_DISPENSADA);
      setBiometriaDispensada(dispensada === 'true');
    } catch (e) {
      console.warn('[Biometria] Erro ao carregar suporte e credenciais:', e);
    }
  };

  const carregarIdentidadeVisual = async () => {
    try {
      console.log('[Identidade] Iniciando carregamento de logo e foto...');
      const [identidade, minhaFoto] = await Promise.all([
        identidadeApi.obterIdentidade(),
        identidadeApi.obterMinhaFoto(),
      ]);

      // Baixa os bytes autenticados com token e converte para Data URI (base64)
      const [logoDataUri, fotoDataUri] = await Promise.all([
        identidade?.logo?.url
          ? identidadeApi.baixarImagemComoDataUri(identidade.logo.url)
          : Promise.resolve(null),
        minhaFoto?.url
          ? identidadeApi.baixarImagemComoDataUri(minhaFoto.url)
          : Promise.resolve(null),
      ]);

      setLogoUrl(logoDataUri || null);
      setFotoUrl(fotoDataUri || null);
    } catch (e) {
      console.warn('[Identidade] Erro ao carregar identidade visual:', e);
    }
  };

  // Inicializa o contexto carregando dados salvos
  useEffect(() => {
    const inicializar = async () => {
      setCarregando(true);
      try {
        await recarregarEstadoBiometria();

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

            // Carrega lista de oficinas do usuário
            if (me.oficinas && me.oficinas.length > 0) {
              setOficinasDisponiveis(me.oficinas);
              await SecureStore.setItemAsync(
                CONFIG_STORAGE_KEYS.OFICINAS_DISPONIVEIS,
                JSON.stringify(me.oficinas)
              );
            } else {
              const oficinasJson = await SecureStore.getItemAsync(CONFIG_STORAGE_KEYS.OFICINAS_DISPONIVEIS);
              if (oficinasJson) {
                try {
                  const parsedOficinas = JSON.parse(oficinasJson);
                  if (Array.isArray(parsedOficinas) && parsedOficinas.length > 0) {
                    setOficinasDisponiveis(parsedOficinas);
                  }
                } catch {
                  // ignora
                }
              }
            }

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

            await carregarIdentidadeVisual();
          } catch (e) {
            console.log('[Auth] Token existente inválido ou expirado, limpando sessão:', e);
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
    oficinaId?: string,
    adiarFinalizacao: boolean = false
  ): Promise<{
    sucesso: boolean;
    precisaEscolherOficina?: boolean;
    oficinas?: OficinaDaSessao[];
    mensagem?: string;
    resposta?: RespostaLogin;
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
          resposta,
        };
      }

      if (resposta.tokenAcesso) {
        senhaEmMemoriaRef.current = senha;
        setCredenciaisTemporarias(null);

        // Se adiarFinalizacao for true, a tela de Login chamará concluirLogin após o diálogo biométrico
        if (adiarFinalizacao) {
          return {
            sucesso: true,
            resposta,
          };
        }

        await processarLoginSucesso(resposta);
        return { sucesso: true, resposta };
      }

      setCredenciaisTemporarias(null);
      return {
        sucesso: false,
        mensagem: 'Não foi possível concluir a autenticação. Verifique suas credenciais.',
      };
    } catch (error) {
      setCredenciaisTemporarias(null);
      return {
        sucesso: false,
        mensagem: extrairMensagemErro(error),
      };
    }
  };

  const concluirLogin = async (resposta: RespostaLogin, senhaUtilizada?: string) => {
    if (senhaUtilizada) {
      senhaEmMemoriaRef.current = senhaUtilizada;
    }
    await processarLoginSucesso(resposta);
  };

  const loginComBiometria = async (): Promise<{ sucesso: boolean; mensagem?: string }> => {
    const credencialSalva = await obterCredencialBiometria();
    if (!credencialSalva) {
      return {
        sucesso: false,
        mensagem: 'Nenhuma credencial biométrica ativa encontrada neste dispositivo.',
      };
    }

    const rotulo = obterRotuloBiometria(tipoBiometria);
    const autenticado = await executarLeituraBiometrica(`Acessar oficina com ${rotulo}`);

    if (!autenticado) {
      return {
        sucesso: false,
        mensagem: 'Biometria não reconhecida ou cancelada pelo usuário.',
      };
    }

    // Tenta autenticar na API com a credencial segura recuperada
    try {
      const resposta: RespostaLogin = await authApi.login(
        credencialSalva.email,
        credencialSalva.credencial
      );

      // Cenário Multi-Oficina
      if (!resposta.tokenAcesso && resposta.oficinas && resposta.oficinas.length > 0) {
        setOficinasDisponiveis(resposta.oficinas);
        setPrecisaEscolherOficina(true);
        setCredenciaisTemporarias({
          email: credencialSalva.email,
          senha: credencialSalva.credencial,
        });
        return {
          sucesso: false,
          mensagem: 'Selecione a oficina para continuar.',
        };
      }

      if (resposta.tokenAcesso) {
        senhaEmMemoriaRef.current = credencialSalva.credencial;
        await processarLoginSucesso(resposta);
        return { sucesso: true };
      }

      return {
        sucesso: false,
        mensagem: 'Não foi possível validar o acesso com a credencial salva.',
      };
    } catch (error) {
      console.warn('[Biometria] Erro ao autenticar credencial biométrica:', error);
      // Se a credencial falhou no backend (ex: senha mudou), limpa o SecureStore
      await removerCredencialBiometria();
      await recarregarEstadoBiometria();
      return {
        sucesso: false,
        mensagem: 'Credenciais expiradas ou alteradas. Por favor, entre com sua senha.',
      };
    }
  };

  const ativarBiometria = async (
    ativar: boolean,
    senhaOpcional?: string,
    emailOpcional?: string,
    nomeOpcional?: string
  ): Promise<boolean> => {
    if (!ativar) {
      await removerCredencialBiometria();
      await SecureStore.setItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_DISPENSADA, 'true');
      setBiometriaDispensada(true);
      await recarregarEstadoBiometria();
      return true;
    }

    if (!biometriaDisponivel && !hardwareBiometrico) {
      return false;
    }

    const rotulo = obterRotuloBiometria(tipoBiometria);
    const confirmado = await executarLeituraBiometrica(
      `Confirme com ${rotulo} para ativar o login biométrico`
    );

    if (!confirmado) {
      return false;
    }

    const senha = senhaOpcional || senhaEmMemoriaRef.current;
    const email =
      emailOpcional ||
      usuario?.email ||
      emailEmMemoriaRef.current ||
      ultimoUsuarioBiometria?.email;
    const nome =
      nomeOpcional ||
      usuario?.nome ||
      nomeEmMemoriaRef.current ||
      ultimoUsuarioBiometria?.nome ||
      email?.split('@')[0] ||
      'Usuário';

    if (!senha || !email) {
      console.warn('[Biometria] Senha ou e-mail indisponível para salvar biometria.');
      return false;
    }

    try {
      await salvarCredencialBiometria(email, nome, senha);
      await SecureStore.setItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_DISPENSADA, 'false');
      setBiometriaDispensada(false);
      senhaEmMemoriaRef.current = senha;
      emailEmMemoriaRef.current = email;
      nomeEmMemoriaRef.current = nome;
      await recarregarEstadoBiometria();
      return true;
    } catch (e) {
      console.error('[Biometria] Falha ao ativar biometria:', e);
      return false;
    }
  };

  const dispensarBiometria = async (): Promise<void> => {
    try {
      await SecureStore.setItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_DISPENSADA, 'true');
      setBiometriaDispensada(true);
    } catch (e) {
      console.warn('[Biometria] Erro ao salvar dispensa de biometria:', e);
    }
  };

  const cancelarEscolhaOficina = () => {
    setPrecisaEscolherOficina(false);
    setCredenciaisTemporarias(null);
  };

  const selecionarOficinaNoLogin = async (
    oficinaId: string
  ): Promise<{ sucesso: boolean; mensagem?: string }> => {
    if (!credenciaisTemporarias) {
      setPrecisaEscolherOficina(false);
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
    const oficinasRecebidas = resposta.oficinas && resposta.oficinas.length > 0 ? resposta.oficinas : [];
    if (oficinasRecebidas.length > 0) {
      setOficinasDisponiveis(oficinasRecebidas);
      await SecureStore.setItemAsync(
        CONFIG_STORAGE_KEYS.OFICINAS_DISPONIVEIS,
        JSON.stringify(oficinasRecebidas)
      );
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
      if (me.oficinas && me.oficinas.length > 0) {
        setOficinasDisponiveis(me.oficinas);
        await SecureStore.setItemAsync(
          CONFIG_STORAGE_KEYS.OFICINAS_DISPONIVEIS,
          JSON.stringify(me.oficinas)
        );
      }
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

    const emailFinal = me?.email || resposta.usuario?.email || '';
    const nomeFinal = me?.nome || resposta.usuario?.nome || emailFinal.split('@')[0] || 'Usuário';
    if (emailFinal) emailEmMemoriaRef.current = emailFinal;
    if (nomeFinal) nomeEmMemoriaRef.current = nomeFinal;

    setPrecisaEscolherOficina(false);
    setCredenciaisTemporarias(null);
    await carregarIdentidadeVisual();
  };

  const trocarOficina = async (novaOficinaId: string): Promise<boolean> => {
    try {
      const resposta = await authApi.trocarOficina(novaOficinaId);
      if (resposta.tokenAcesso) {
        await processarLoginSucesso(resposta);
        await carregarIdentidadeVisual();
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
    setLogoUrl(null);
    setFotoUrl(null);
    senhaEmMemoriaRef.current = null;

    await definirTokenAutenticacao(null);
    try {
      await SecureStore.deleteItemAsync(CONFIG_STORAGE_KEYS.OFICINA_ATIVA);
      await SecureStore.deleteItemAsync(CONFIG_STORAGE_KEYS.OFICINAS_DISPONIVEIS);
      await SecureStore.deleteItemAsync(CONFIG_STORAGE_KEYS.USER);
    } catch (e) {
      // ignora
    }

    // Mantém as credenciais biométricas seguras para o próximo login,
    // atualizando os estados da tela de login
    await recarregarEstadoBiometria();
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
      if (me.oficinas && me.oficinas.length > 0) {
        setOficinasDisponiveis(me.oficinas);
        await SecureStore.setItemAsync(
          CONFIG_STORAGE_KEYS.OFICINAS_DISPONIVEIS,
          JSON.stringify(me.oficinas)
        );
      }
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
        logoUrl,
        fotoUrl,
        biometriaDisponivel,
        hardwareBiometrico,
        biometriaCadastrada,
        biometriaAtiva,
        biometriaDispensada,
        tipoBiometria,
        rotuloBiometria,
        ultimoUsuarioBiometria,
        temSenhaEmMemoria: !!senhaEmMemoriaRef.current,
        login,
        concluirLogin,
        loginComBiometria,
        ativarBiometria,
        dispensarBiometria,
        recarregarEstadoBiometria,
        selecionarOficinaNoLogin,
        cancelarEscolhaOficina,
        trocarOficina,
        logout,
        atualizarServidorUrl,
        recarregarUsuario,
        recarregarIdentidadeVisual: carregarIdentidadeVisual,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
