import axios from 'axios';
import { clienteHttp } from '../api/clienteHttp';

export interface DadosCnpjConsulta {
  razaoSocial?: string;
  nomeFantasia?: string;
  telefone?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
}

/**
 * Consulta os dados de um CNPJ na API pública (BrasilAPI) com fallback
 * para o endpoint do backend (/api/cnpj/{cnpj}).
 */
export async function consultarDadosCnpj(cnpjSemMascara: string): Promise<DadosCnpjConsulta | null> {
  const cnpjLimpo = cnpjSemMascara.replace(/\D/g, '');
  if (cnpjLimpo.length !== 14) {
    return null;
  }

  // 1. Consulta API pública BrasilAPI (traz razão social, nome fantasia, telefone e email)
  try {
    const resPublica = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      timeout: 5000,
    });

    if (resPublica.data) {
      const d = resPublica.data;
      const tel = d.ddd_telefone_1 ? `${d.ddd_telefone_1}`.replace(/\D/g, '') : undefined;
      return {
        razaoSocial: d.razao_social || '',
        nomeFantasia: d.nome_fantasia || '',
        telefone: tel,
        email: d.email ? d.email.toLowerCase() : '',
        logradouro: d.logradouro || '',
        numero: d.numero || '',
        bairro: d.bairro || '',
        municipio: d.municipio || '',
        uf: d.uf || '',
        cep: d.cep || '',
      };
    }
  } catch (e) {
    // Falha silenciosa no BrasilAPI, tenta o backend
  }

  // 2. Fallback: Endpoint interno do backend (/api/cnpj/{cnpj})
  try {
    const resBackend = await clienteHttp.get<any>(`/api/cnpj/${cnpjLimpo}`, {
      timeout: 5000,
    });

    if (resBackend.data) {
      const b = resBackend.data;
      return {
        razaoSocial: b.razaoSocial || '',
        nomeFantasia: b.nomeFantasia || '',
        email: b.email ? b.email.toLowerCase() : '',
        logradouro: b.endereco?.logradouro || '',
        numero: b.endereco?.numero || '',
        bairro: b.endereco?.bairro || '',
        municipio: b.endereco?.municipio || '',
        uf: b.endereco?.uf || '',
        cep: b.endereco?.cep || '',
      };
    }
  } catch (e) {
    // Ignore se ambos falharem
  }

  return null;
}
