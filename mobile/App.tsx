import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth-context';
import { ChatProvider } from './src/chat-context';
import { CallsProvider } from './src/calls/calls-context';
import { CallOverlay } from './src/components/CallOverlay';
import { RootNavigator } from './src/navigation';
import { paperTheme } from './src/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <AuthProvider>
          <ChatProvider>
            <CallsProvider>
              <RootNavigator />
              <CallOverlay />
            </CallsProvider>
          </ChatProvider>
        </AuthProvider>
      </PaperProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
