import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { CONFIG_STORAGE_KEYS } from '../constants';

export type TipoBiometria = 'FACE_ID' | 'FINGERPRINT' | 'OUTRO';

export interface SuporteBiometriaResultado {
  compativel: boolean;
  cadastrado: boolean;
  tipo: TipoBiometria;
}

export interface CredencialBiometriaSalva {
  email: string;
  nome: string;
  credencial: string;
}

/**
 * Verifica se o dispositivo possui hardware biométrico compatível e se há
 * biometrias cadastradas no sistema operacional do celular.
 */
export async function verificarSuporteBiometria(): Promise<SuporteBiometriaResultado> {
  try {
    const compativel = await LocalAuthentication.hasHardwareAsync();
    console.log('[Biometria] hasHardwareAsync:', compativel);
    if (!compativel) {
      return { compativel: false, cadastrado: false, tipo: 'OUTRO' };
    }

    const cadastrado = await LocalAuthentication.isEnrolledAsync();
    console.log('[Biometria] isEnrolledAsync:', cadastrado);
    const tiposSuportados = await LocalAuthentication.supportedAuthenticationTypesAsync();
    console.log('[Biometria] supportedAuthenticationTypesAsync:', tiposSuportados);

    let tipo: TipoBiometria = 'OUTRO';
    if (Platform.OS === 'ios') {
      if (tiposSuportados.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        tipo = 'FACE_ID';
      } else if (tiposSuportados.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        tipo = 'FINGERPRINT';
      }
    } else {
      // No Android, se houver sensor de digital (1), prioriza Impressão Digital
      if (tiposSuportados.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        tipo = 'FINGERPRINT';
      } else if (tiposSuportados.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        tipo = 'FACE_ID';
      }
    }

    return { compativel: true, cadastrado, tipo };
  } catch (error) {
    console.warn('[Biometria] Erro ao verificar suporte do dispositivo:', error);
    return { compativel: false, cadastrado: false, tipo: 'OUTRO' };
  }
}

/**
 * Salva as credenciais no hardware de armazenamento criptografado (Keystore / Keychain)
 * e marca a flag de biometria como ativada.
 */
export async function salvarCredencialBiometria(
  email: string,
  nome: string,
  credencial: string
): Promise<void> {
  try {
    await SecureStore.setItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_ATIVADA, 'true');
    await SecureStore.setItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_ULTIMO_EMAIL, email.trim());
    await SecureStore.setItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_ULTIMO_NOME, (nome || email.split('@')[0]).trim());
    await SecureStore.setItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_CREDENCIAL, credencial);
  } catch (error) {
    console.error('[Biometria] Erro ao salvar credenciais seguras:', error);
    throw error;
  }
}

/**
 * Obtém as credenciais biométricas salvas, desde que a biometria esteja explicitamente ativada.
 */
export async function obterCredencialBiometria(): Promise<CredencialBiometriaSalva | null> {
  try {
    const ativada = await SecureStore.getItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_ATIVADA);
    if (ativada !== 'true') {
      return null;
    }

    const email = await SecureStore.getItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_ULTIMO_EMAIL);
    const nome = await SecureStore.getItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_ULTIMO_NOME);
    const credencial = await SecureStore.getItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_CREDENCIAL);

    if (!email || !credencial) {
      return null;
    }

    return {
      email,
      nome: nome || email.split('@')[0],
      credencial,
    };
  } catch (error) {
    console.warn('[Biometria] Erro ao recuperar credenciais salvas:', error);
    return null;
  }
}

/**
 * Remove com segurança as credenciais criptografadas e desativa o login biométrico.
 */
export async function removerCredencialBiometria(): Promise<void> {
  try {
    await SecureStore.setItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_ATIVADA, 'false');
    await SecureStore.deleteItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_CREDENCIAL);
    await SecureStore.deleteItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_ULTIMO_EMAIL);
    await SecureStore.deleteItemAsync(CONFIG_STORAGE_KEYS.BIOMETRIA_ULTIMO_NOME);
  } catch (error) {
    console.warn('[Biometria] Erro ao remover credenciais do SecureStore:', error);
  }
}

/**
 * Dispara o prompt nativo de autenticação biométrica (Impressão Digital ou Face ID).
 */
export async function executarLeituraBiometrica(mensagem: string): Promise<boolean> {
  try {
    const resultado = await LocalAuthentication.authenticateAsync({
      promptMessage: mensagem || 'Autenticação Biométrica',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    return resultado.success;
  } catch (error) {
    console.warn('[Biometria] Erro ao executar leitura biométrica:', error);
    return false;
  }
}

/**
 * Retorna o rótulo amigável em português para exibição em botões e mensagens.
 */
export function obterRotuloBiometria(tipo: TipoBiometria): string {
  switch (tipo) {
    case 'FACE_ID':
      return 'Face ID';
    case 'FINGERPRINT':
      return 'Impressão Digital';
    default:
      return 'Biometria';
  }
}

/**
 * Retorna o ícone do Ionicons correspondente ao tipo biométrico.
 */
export function obterIconeBiometria(tipo: TipoBiometria): 'scan-outline' | 'finger-print-outline' {
  if (tipo === 'FACE_ID') {
    return 'scan-outline';
  }
  return 'finger-print-outline';
}
