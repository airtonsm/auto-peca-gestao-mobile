import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { CORES } from '../constants';

// Telas
import { LoginScreen } from '../screens/LoginScreen';
import { PatioScreen } from '../screens/PatioScreen';
import { EstoqueScreen } from '../screens/EstoqueScreen';
import { ChecklistScreen } from '../screens/ChecklistScreen';
import { PerfilScreen } from '../screens/PerfilScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AbasPrincipais = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: CORES.superficie,
        },
        headerTitleStyle: {
          color: CORES.texto,
          fontWeight: '800',
          fontSize: 18,
        },
        headerTintColor: CORES.texto,
        tabBarStyle: {
          backgroundColor: CORES.superficie,
          borderTopColor: CORES.bordaSuave,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: CORES.primariaClara,
        tabBarInactiveTintColor: CORES.textoMudo,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="Patio"
        component={PatioScreen}
        options={{
          title: 'Pátio & Veículos',
          tabBarLabel: 'Pátio (OS)',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-sport" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Estoque"
        component={EstoqueScreen}
        options={{
          title: 'Estoque de Peças',
          tabBarLabel: 'Estoque',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={PerfilScreen}
        options={{
          title: 'Minha Oficina',
          tabBarLabel: 'Oficina',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const { estaAutenticado, carregando } = useAuth();

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={CORES.primaria} />
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
});
