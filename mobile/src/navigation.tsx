import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from './auth-context';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { ChatListScreen } from './screens/ChatListScreen';
import { NewChatScreen } from './screens/NewChatScreen';
import { ConversationScreen } from './screens/ConversationScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import type { RoomType } from './rocketchat/types';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ChatList: undefined;
  NewChat: undefined;
  Conversation: { roomId: string; roomType: RoomType; title: string };
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {token ? (
          <>
            <Stack.Screen name="ChatList" component={ChatListScreen} options={{ headerShown: false }} />
            <Stack.Screen name="NewChat" component={NewChatScreen} options={{ title: 'Новый чат' }} />
            <Stack.Screen name="Conversation" component={ConversationScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
