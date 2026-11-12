import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CORES } from '../constants';
import { useAuth } from '../context/AuthContext';
import { ImagemAutenticada } from './ImagemAutenticada';

interface ModalMenuSanduicheProps {
  visivel: boolean;
  aoFechar: () => void;
  aoAbrirCadastros: () => void;
  aoAbrirNovoCliente: () => void;
  aoAbrirNovoVeiculo: () => void;
  aoAbrirNovoServico: () => void;
  aoAbrirTrocarOficina: () => void;
  aoNavegarPara: (tela: string) => void;
}

export const ModalMenuSanduiche: React.FC<ModalMenuSanduicheProps> = ({
  visivel,
  aoFechar,
  aoAbrirCadastros,
  aoAbrirNovoCliente,
  aoAbrirNovoVeiculo,
  aoAbrirNovoServico,
  aoAbrirTrocarOficina,
  aoNavegarPara,
}) => {
  const insets = useSafeAreaInsets();
  const { usuario, oficinaAtiva, logoUrl, fotoUrl, logout } = useAuth();

  const handleLogout = () => {
    aoFechar();
    Alert.alert(
      'Sair da Conta',
      'Deseja realmente encerrar a sessão deste dispositivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const handleNavegar = (tela: string) => {
    aoFechar();
    aoNavegarPara(tela);
  };

  const handleAcao = (acao: () => void) => {
    aoFechar();
    setTimeout(() => {
      acao();
    }, 200);
  };

  return (
    <Modal
      visible={visivel}
      animationType="fade"
      transparent
      onRequestClose={aoFechar}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.fundoBackdrop}
          activeOpacity={1}
          onPress={aoFechar}
        />

        <View style={[styles.gavetaMenu, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Topo da Gaveta: Usuário & Oficina */}
          <View style={styles.topoPerfil}>
            <View style={styles.topoLinha}>
              <View style={styles.avatarBox}>
                <ImagemAutenticada
                  caminhoRelativo={fotoUrl}
                  style={styles.avatarImagem}
                  resizeMode="cover"
                  fallback={
                    <Text style={styles.avatarTexto}>
                      {(usuario?.nome || 'U').substring(0, 2).toUpperCase()}
                    </Text>
                  }
                />
              </View>

              <TouchableOpacity
                onPress={aoFechar}
                style={styles.botaoFechar}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={CORES.textoSecundario} />
              </TouchableOpacity>
            </View>

            <Text style={styles.nomeUsuario} numberOfLines={1}>
              {usuario?.nome || 'Operador'}
            </Text>
            <Text style={styles.emailUsuario} numberOfLines={1}>
              {usuario?.email || 'operador@oficina.com'}
            </Text>

            {/* Card da Oficina Conectada */}
            <View style={styles.cardOficinaAtual}>
              <View style={styles.oficinaIconeMini}>
                <Ionicons name="business" size={13} color={CORES.primariaClara} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.oficinaNomeMini} numberOfLines={1}>
                  {oficinaAtiva?.nome || usuario?.empresa || 'Oficina Principal'}
                </Text>
                <Text style={styles.oficinaStatusMini}>Oficina em Operação</Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.scrollMenu} showsVerticalScrollIndicator={false}>
            {/* LISTA DE OPÇÕES */}
            <View style={styles.secao}>
              {/* 1. Pátio */}
              <TouchableOpacity
                style={styles.itemMenu}
                activeOpacity={0.7}
                onPress={() => handleNavegar('Patio')}
              >
                <View style={styles.iconeBox}>
                  <Ionicons name="car-sport-outline" size={19} color={CORES.primariaClara} />
                </View>
                <Text style={styles.itemTitulo}>Pátio</Text>
              </TouchableOpacity>

              {/* 2. Vendas de Peças */}
              <TouchableOpacity
                style={styles.itemMenu}
                activeOpacity={0.7}
                onPress={() => handleNavegar('Vendas')}
              >
                <View style={styles.iconeBox}>
                  <Ionicons name="cart-outline" size={19} color={CORES.primariaClara} />
                </View>
                <Text style={styles.itemTitulo}>Vendas de Peças</Text>
              </TouchableOpacity>

              {/* 3. Consulta de Peças */}
              <TouchableOpacity
                style={styles.itemMenu}
                activeOpacity={0.7}
                onPress={() => handleNavegar('Estoque')}
              >
                <View style={styles.iconeBox}>
                  <Ionicons name="search-outline" size={19} color={CORES.primariaClara} />
                </View>
                <Text style={styles.itemTitulo}>Consulta Peças</Text>
              </TouchableOpacity>

              {/* 4. Cadastrar */}
              <TouchableOpacity
                style={styles.itemMenu}
                activeOpacity={0.7}
                onPress={() => handleAcao(aoAbrirCadastros)}
              >
                <View style={[styles.iconeBox, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
                  <Ionicons name="add-circle-outline" size={19} color="#F59E0B" />
                </View>
                <Text style={styles.itemTitulo}>Cadastrar</Text>
              </TouchableOpacity>
            </View>

            {/* SEÇÃO CONTA & OFICINA */}
            <View style={[styles.secao, styles.secaoConta]}>
              <TouchableOpacity
                style={styles.itemMenu}
                activeOpacity={0.7}
                onPress={() => handleNavegar('Perfil')}
              >
                <View style={styles.iconeBox}>
                  <Ionicons name="person-circle-outline" size={19} color={CORES.primariaClara} />
                </View>
                <Text style={styles.itemTitulo}>Meu Perfil</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.itemMenu}
                activeOpacity={0.7}
                onPress={() => handleAcao(aoAbrirTrocarOficina)}
              >
                <View style={styles.iconeBox}>
                  <Ionicons name="business-outline" size={19} color={CORES.primariaClara} />
                </View>
                <Text style={styles.itemTitulo}>Trocar de Oficina</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.itemMenu, styles.itemMenuSair]}
                activeOpacity={0.7}
                onPress={handleLogout}
              >
                <View style={[styles.iconeBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Ionicons name="log-out-outline" size={19} color={CORES.perigoTexto} />
                </View>
                <Text style={[styles.itemTitulo, { color: CORES.perigoTexto }]}>
                  Sair da Conta
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Rodapé da Gaveta */}
          <View style={styles.rodape}>
            <Text style={styles.rodapeTexto}>AutoF Sistema de Gestão Mobile</Text>
            <Text style={styles.rodapeVersao}>Versão 1.0 • Produção</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  fundoBackdrop: {
    flex: 1,
  },
  gavetaMenu: {
    width: '82%',
    maxWidth: 320,
    backgroundColor: CORES.superficie,
    borderLeftWidth: 1,
    borderColor: CORES.bordaSuave,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 16,
  },
  topoPerfil: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  topoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CORES.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImagem: {
    width: 44,
    height: 44,
  },
  avatarTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  botaoFechar: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: CORES.fundo,
  },
  nomeUsuario: {
    color: CORES.texto,
    fontSize: 16,
    fontWeight: '800',
  },
  emailUsuario: {
    color: CORES.textoSecundario,
    fontSize: 12,
    marginTop: 1,
    marginBottom: 10,
  },
  cardOficinaAtual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CORES.fundo,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  oficinaIconeMini: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oficinaNomeMini: {
    color: CORES.texto,
    fontSize: 11,
    fontWeight: '700',
  },
  oficinaStatusMini: {
    color: CORES.sucessoTexto,
    fontSize: 9,
    fontWeight: '600',
  },
  scrollMenu: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  secao: {
    marginBottom: 16,
  },
  secaoConta: {
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    paddingTop: 10,
    marginTop: 4,
  },
  secaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  secaoTitulo: {
    color: CORES.textoMudo,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  itemMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 3,
  },
  itemMenuDestaque: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    marginBottom: 6,
  },
  itemMenuSair: {
    marginTop: 2,
  },
  iconeBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: CORES.fundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosItem: {
    flex: 1,
  },
  itemTitulo: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: '600',
  },
  itemDescricao: {
    color: CORES.textoMudo,
    fontSize: 10,
    marginTop: 1,
  },
  rodape: {
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: CORES.bordaSuave,
    alignItems: 'center',
  },
  rodapeTexto: {
    color: CORES.textoMudo,
    fontSize: 10,
    fontWeight: '600',
  },
  rodapeVersao: {
    color: CORES.textoMudo,
    fontSize: 9,
    marginTop: 1,
  },
});
