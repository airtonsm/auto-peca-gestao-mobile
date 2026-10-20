import { clienteHttp } from './clienteHttp';
import {
  OpcoesDeUsuario,
  PedidoUsuario,
  RespostaUsuario,
} from '../types';

export const listarUsuarios = async (): Promise<RespostaUsuario[]> => {
  const response = await clienteHttp.get<RespostaUsuario[]>('/api/usuarios');
  return response.data;
};

export const obterOpcoes = async (): Promise<OpcoesDeUsuario> => {
  const response = await clienteHttp.get<OpcoesDeUsuario>('/api/usuarios/opcoes');
  return response.data;
};

export const criarUsuario = async (dados: PedidoUsuario): Promise<RespostaUsuario> => {
  const response = await clienteHttp.post<RespostaUsuario>('/api/usuarios', dados);
  return response.data;
};

export const atualizarUsuario = async (
  id: string,
  dados: PedidoUsuario
): Promise<RespostaUsuario> => {
  const response = await clienteHttp.put<RespostaUsuario>(`/api/usuarios/${id}`, dados);
  return response.data;
};

export const desvincularUsuario = async (id: string): Promise<void> => {
  await clienteHttp.delete(`/api/usuarios/${id}`);
};

export const usuarioApi = {
  listarUsuarios,
  obterOpcoes,
  criarUsuario,
  atualizarUsuario,
  desvincularUsuario,
};
