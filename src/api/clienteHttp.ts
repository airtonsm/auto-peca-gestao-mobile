import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { CONFIG_STORAGE_KEYS, DEFAULT_API_URL } from '../constants';

let tokenEmMemoria: string | null = null;
let baseUrlEmMemoria: string = DEFAULT_API_URL;
let onNaoAutorizadoCallback: (() => void) | null = null;

export const registrarCallbackNaoAutorizado = (callback: () => void) => {
  onNaoAutorizadoCallback = callback;
};

export const obterBaseUrlAtual = (): string => baseUrlEmMemoria;

export const definirBaseUrl = async (novaUrl: string): Promise<void> => {
  let urlLimpa = novaUrl.trim();
  if (urlLimpa.endsWith('/')) {
    urlLimpa = urlLimpa.slice(0, -1);
  }
  baseUrlEmMemoria = urlLimpa;
  clienteHttp.defaults.baseURL = urlLimpa;
  try {
    await SecureStore.setItemAsync(CONFIG_STORAGE_KEYS.API_BASE_URL, urlLimpa);
  } catch (e) {
    console.warn('Erro ao salvar API_BASE_URL no SecureStore:', e);
  }
};

export const definirTokenAutenticacao = async (token: string | null): Promise<void> => {
  tokenEmMemoria = token;
  try {
    if (token) {
      await SecureStore.setItemAsync(CONFIG_STORAGE_KEYS.TOKEN, token);
    } else {
      await SecureStore.deleteItemAsync(CONFIG_STORAGE_KEYS.TOKEN);
    }
  } catch (e) {
    console.warn('Erro ao persistir token no SecureStore:', e);
  }
};

export const carregarConfiguracoesSalvas = async (): Promise<{
  token: string | null;
  baseUrl: string;
}> => {
  try {
    const urlSalva = await SecureStore.getItemAsync(CONFIG_STORAGE_KEYS.API_BASE_URL);
    if (urlSalva) {
      baseUrlEmMemoria = urlSalva;
      clienteHttp.defaults.baseURL = urlSalva;
    }
  } catch (e) {
    console.warn('Erro ao ler URL do SecureStore:', e);
  }

  try {
    const tokenSalvo = await SecureStore.getItemAsync(CONFIG_STORAGE_KEYS.TOKEN);
    if (tokenSalvo) {
      tokenEmMemoria = tokenSalvo;
    }
  } catch (e) {
    console.warn('Erro ao ler Token do SecureStore:', e);
  }

  return { token: tokenEmMemoria, baseUrl: baseUrlEmMemoria };
};

export const clienteHttp = axios.create({
  baseURL: baseUrlEmMemoria,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

clienteHttp.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (tokenEmMemoria && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${tokenEmMemoria}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

clienteHttp.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Se a sessão expirou ou o token foi invalidado
      if (onNaoAutorizadoCallback) {
        onNaoAutorizadoCallback();
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Extrai uma mensagem amigável de erro da resposta da API ou da falha de rede
 */
export const extrairMensagemErro = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, any> | undefined;

    // Padrão RFC 7807 Problem Details adotado no backend Spring
    if (data?.detail) {
      return String(data.detail);
    }
    if (data?.message) {
      return String(data.message);
    }
    if (data?.mensagem) {
      return String(data.mensagem);
    }
    if (data?.erro) {
      return String(data.erro);
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return 'Tempo limite esgotado ao tentar comunicar com o servidor da oficina. Verifique se o servidor está ativo.';
    }

    if (error.code === 'ERR_NETWORK' || !error.response) {
      return `Não foi possível conectar ao servidor em ${baseUrlEmMemoria}. Certifique-se de que o backend está ligado e o celular está na mesma rede Wi-Fi.`;
    }

    if (error.response?.status === 403) {
      return 'Você não tem permissão para realizar esta operação nesta oficina.';
    }

    if (error.response?.status === 404) {
      return 'Recurso não encontrado no servidor.';
    }

    if (error.response?.status >= 500) {
      return 'Erro interno no servidor da oficina. Tente novamente em instantes.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Ocorreu um erro inesperado ao processar a operação.';
};
