import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { useAuth } from '../auth-context';
import { ApiError } from '../api';
import { Icon } from '../components/Icon';
import { colors } from '../theme';

export function RegisterScreen() {
  const { register } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await register({ inviteCode, displayName, email, password });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось зарегистрироваться');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.brandMark}>
        <Icon name="shield-lock" size={30} color={colors.primary} />
      </View>
      <Text variant="titleLarge" style={styles.title}>
        Регистрация по приглашению
      </Text>
      <TextInput
        mode="outlined"
        label="Инвайт-код"
        autoCapitalize="characters"
        value={inviteCode}
        onChangeText={setInviteCode}
        style={styles.input}
      />
      <TextInput mode="outlined" label="Имя" value={displayName} onChangeText={setDisplayName} style={styles.input} />
      <TextInput
        mode="outlined"
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Пароль"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      {error && <HelperText type="error">⚠️ {error}</HelperText>}
      <Button
        mode="contained"
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
        style={styles.button}
        icon={({ size, color }) => <Icon name="plus" size={size * 0.75} color={color} />}
      >
        {submitting ? 'Отправляем…' : 'Зарегистрироваться'}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#050506' },
  brandMark: { alignItems: 'center', marginBottom: 6 },
  title: { marginBottom: 20, textAlign: 'center', fontWeight: '700' },
  input: { marginBottom: 12 },
  button: { marginTop: 8, borderRadius: 10 },
});
