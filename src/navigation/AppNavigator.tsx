import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { CORES } from '../constants';
import { AutoFLogo } from '../components/AutoFLogo';
import { ImagemAutenticada } from '../components/ImagemAutenticada';
import { ModalTrocarOficina } from '../components/ModalTrocarOficina';
import { ModalAtivacaoBiometria } from '../components/ModalAtivacaoBiometria';
import { ModalHubCadastros } from '../components/ModalHubCadastros';
import { ModalMenuSanduiche } from '../components/ModalMenuSanduiche';
import { ModalCadastroCliente } from '../components/ModalCadastroCliente';
import { ModalCadastroVeiculo } from '../components/ModalCadastroVeiculo';
import { ModalCadastroServico } from '../components/ModalCadastroServico';

// Telas
import { LoginScreen } from '../screens/LoginScreen';
import { PatioScreen } from '../screens/PatioScreen';
import { VendasScreen } from '../screens/VendasScreen';
import { EstoqueScreen } from '../screens/EstoqueScreen';
import { ChecklistScreen } from '../screens/ChecklistScreen';
import { PerfilScreen } from '../screens/PerfilScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

interface HeaderOficinaComLogoProps {
  aoTocar?: () => void;
}

const HeaderOficinaComLogo: React.FC<HeaderOficinaComLogoProps> = ({ aoTocar }) => {
  const { oficinaAtiva, usuario, logoUrl } = useAuth();
  const nomeOficina = oficinaAtiva?.nome || usuario?.empresa || 'Minha Oficina';

  return (
    <TouchableOpacity
      style={styles.headerOficinaContainer}
      onPress={aoTocar}
      activeOpacity={aoTocar ? 0.7 : 1}
    >
      <ImagemAutenticada
        caminhoRelativo={logoUrl}
        style={styles.headerLogoOficina}
        resizeMode="contain"
        fallback={<AutoFLogo tamanho="mini" mostrarTexto={false} orientacao="horizontal" />}
      />
      <View style={styles.headerOficinaTextoWrapper}>
        <Text style={styles.headerOficinaTexto} numberOfLines={1} ellipsizeMode="tail">
          {nomeOficina}
        </Text>
        {aoTocar && (
          <Ionicons
            name="chevron-down"
            size={14}
            color={CORES.primariaClara}
            style={styles.headerOficinaChevron}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const AbasPrincipais = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { logout, hardwareBiometrico, biometriaAtiva, biometriaDispensada } = useAuth();
  const [modalTrocarOficinaVisivel, setModalTrocarOficinaVisivel] = useState(false);
  const [modalBiometriaVisivel, setModalBiometriaVisivel] = useState(false);
  const [modalMenuSanduicheVisivel, setModalMenuSanduicheVisivel] = useState(false);
  const [modalHubCadastrosVisivel, setModalHubCadastrosVisivel] = useState(false);
  const [modalClienteVisivel, setModalClienteVisivel] = useState(false);
  const [modalVeiculoVisivel, setModalVeiculoVisivel] = useState(false);
  const [modalServicoVisivel, setModalServicoVisivel] = useState(false);
  const popUpDisparadoRef = React.useRef(false);

  React.useEffect(() => {
    // Se o usuário desativou no Perfil ou dispensou, garante que o pop-up NUNCA seja aberto
    if (biometriaAtiva || biometriaDispensada) {
      setModalBiometriaVisivel(false);
      return;
    }

    // Se o aparelho possui sensor biométrico e ainda não foi ativado nem dispensado, exibe o pop-up no acesso inicial
    if (hardwareBiometrico && !biometriaAtiva && !biometriaDispensada && !popUpDisparadoRef.current) {
      popUpDisparadoRef.current = true;
      const timer = setTimeout(() => {
        setModalBiometriaVisivel(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [hardwareBiometrico, biometriaAtiva, biometriaDispensada]);

  const handleConfirmarLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Deseja realmente encerrar a sessão deste dispositivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair da Conta',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerTitleAlign: 'left',
          headerStyle: {
            backgroundColor: CORES.superficie,
          },
          headerTitleStyle: {
            color: CORES.texto,
            fontWeight: '800',
            fontSize: 18,
          },
          headerTintColor: CORES.texto,
          headerRight: () => (
            <View style={styles.headerAcoesContainer}>
              {/* Botão Menu Sanduíche */}
              <TouchableOpacity
                style={styles.botaoHeaderMenuSanduiche}
                onPress={() => setModalMenuSanduicheVisivel(true)}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
                accessibilityLabel="Abrir Menu Lateral"
              >
                <Ionicons name="menu" size={24} color={CORES.texto} />
              </TouchableOpacity>
            </View>
          ),
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            display: 'none',
          },
        }}
      >
        <Tab.Screen
          name="Patio"
          component={PatioScreen}
          options={{
            headerTitle: () => (
              <HeaderOficinaComLogo aoTocar={() => setModalTrocarOficinaVisivel(true)} />
            ),
          }}
        />
        <Tab.Screen
          name="Vendas"
          component={VendasScreen}
          options={{
            title: 'Vendas de Peças',
          }}
        />
        <Tab.Screen
          name="Estoque"
          component={EstoqueScreen}
          options={{
            title: 'Consulta de Peças',
          }}
        />
        <Tab.Screen
          name="Perfil"
          component={PerfilScreen}
          options={{
            title: 'Meu Perfil',
          }}
        />
      </Tab.Navigator>

      
      {/* Modal Menu Sanduíche Lateral */}
      <ModalMenuSanduiche
        visivel={modalMenuSanduicheVisivel}
        aoFechar={() => setModalMenuSanduicheVisivel(false)}
        aoAbrirCadastros={() => setModalHubCadastrosVisivel(true)}
        aoAbrirNovoCliente={() => setModalClienteVisivel(true)}
        aoAbrirNovoVeiculo={() => setModalVeiculoVisivel(true)}
        aoAbrirNovoServico={() => setModalServicoVisivel(true)}
        aoAbrirTrocarOficina={() => setModalTrocarOficinaVisivel(true)}
        aoNavegarPara={(tela) => {
          navigation.navigate(tela);
        }}
      />

      {/* Modal Central de Cadastros Rápidos */}
      <ModalHubCadastros
        visivel={modalHubCadastrosVisivel}
        aoFechar={() => setModalHubCadastrosVisivel(false)}
        aoClienteCriado={(cli) => {
          Alert.alert('Sucesso', `Cliente "${cli.nome}" cadastrado com sucesso!`);
        }}
        aoVeiculoCriado={(veic) => {
          Alert.alert('Sucesso', `Veículo placa ${veic.placa} cadastrado com sucesso!`);
        }}
        aoServicoCriado={(srv) => {
          Alert.alert('Sucesso', `Serviço "${srv.nome}" cadastrado com sucesso!`);
        }}
      />

      {/* Modais Diretos dos Cadastros */}
      <ModalCadastroCliente
        visivel={modalClienteVisivel}
        aoFechar={() => setModalClienteVisivel(false)}
        aoSalvar={(cli) => {
          Alert.alert('Sucesso', `Cliente "${cli.nome}" cadastrado com sucesso!`);
        }}
      />

      <ModalCadastroVeiculo
        visivel={modalVeiculoVisivel}
        aoFechar={() => setModalVeiculoVisivel(false)}
        aoSalvar={(veic) => {
          Alert.alert('Sucesso', `Veículo placa ${veic.placa} cadastrado com sucesso!`);
        }}
      />

      <ModalCadastroServico
        visivel={modalServicoVisivel}
        aoFechar={() => setModalServicoVisivel(false)}
        aoSalvar={(srv) => {
          Alert.alert('Sucesso', `Serviço "${srv.nome}" cadastrado com sucesso!`);
        }}
      />

      {/* Modal Rápido de Troca de Oficina e Logout */}
      <ModalTrocarOficina
        visivel={modalTrocarOficinaVisivel}
        aoFechar={() => setModalTrocarOficinaVisivel(false)}
      />

      {/* Pop-up Amigável de Ativação de Biometria no Acesso */}
      <ModalAtivacaoBiometria
        visivel={modalBiometriaVisivel}
        aoFechar={() => setModalBiometriaVisivel(false)}
      />
    </>
  );
};

export const AppNavigator: React.FC = () => {
  const { estaAutenticado, carregando } = useAuth();

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <AutoFLogo tamanho="grande" mostrarSubtitulo={false} orientacao="vertical" />
        <ActivityIndicator size="large" color={CORES.primariaClara} style={styles.loadingSpinner} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: CORES.fundo,
          },
        }}
      >
        {!estaAutenticado ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={AbasPrincipais} />
            <Stack.Screen
              name="Checklist"
              component={ChecklistScreen}
              options={{
                presentation: 'fullScreenModal',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: CORES.fundo,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSpinner: {
    marginTop: 28,
  },
  headerOficinaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 6,
  },
  headerLogoOficina: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerOficinaTextoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  headerOficinaTexto: {
    color: CORES.texto,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    maxWidth: 180,
  },
  headerOficinaChevron: {
    marginLeft: 4,
  },
    botaoHeaderMenuSanduiche: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  abaCentralIconeBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
  headerAcoesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    gap: 8,
  },
  botaoHeaderOficina: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
  botaoHeaderSair: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
});
