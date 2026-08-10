import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Switch, StyleSheet } from 'react-native';
import { useAuth } from '../auth-context';
import { apiFetch, ApiError } from '../api';

interface Me {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  pointsTotal: number;
  roles: { role: { id: string; name: string } }[];
}

interface Vehicle {
  id: string;
  make: string;
  model: string;
  plateNumber: string;
  isPlatePublic: boolean;
}

export function ProfileScreen() {
  const { token, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [isPlatePublic, setIsPlatePublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function loadMe() {
    if (!token) return;
    apiFetch<Me>('/users/me', { token })
      .then((result) => {
        setMe(result);
        setDisplayName(result.displayName);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить профиль'));
  }

  function loadVehicles() {
    if (!token) return;
    apiFetch<Vehicle[]>('/users/me/vehicles', { token })
      .then(setVehicles)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить автомобили'));
  }

  useEffect(() => {
    loadMe();
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onSaveProfile() {
    if (!token || !displayName) return;
    setError(null);
    setSaving(true);
    try {
      const result = await apiFetch<Me>('/users/me', { method: 'PATCH', token, body: { displayName } });
      setMe(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  }

  async function onAddVehicle() {
    if (!token || !make || !model || !plateNumber) return;
    setError(null);
    try {
      await apiFetch('/users/me/vehicles', {
        method: 'POST',
        token,
        body: { make, model, plateNumber, isPlatePublic },
      });
      setMake('');
      setModel('');
      setPlateNumber('');
      setIsPlatePublic(false);
      loadVehicles();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось добавить автомобиль');
    }
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={vehicles}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          {error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.sectionTitle}>Профиль</Text>
          {me && (
            <Text style={styles.dim}>
              Статус: {me.status} · Баллы: {me.pointsTotal} · Роли:{' '}
              {me.roles.map((r) => r.role.name).join(', ') || 'участник'}
            </Text>
          )}
          <TextInput
            style={styles.input}
            placeholder="Имя"
            placeholderTextColor="#888"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <Pressable style={styles.button} onPress={onSaveProfile} disabled={saving}>
            <Text style={styles.buttonText}>{saving ? 'Сохраняем…' : 'Сохранить'}</Text>
          </Pressable>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Мои автомобили</Text>
          <TextInput style={styles.input} placeholder="Марка" placeholderTextColor="#888" value={make} onChangeText={setMake} />
          <TextInput style={styles.input} placeholder="Модель" placeholderTextColor="#888" value={model} onChangeText={setModel} />
          <TextInput
            style={styles.input}
            placeholder="Гос. номер"
            placeholderTextColor="#888"
            autoCapitalize="characters"
            value={plateNumber}
            onChangeText={setPlateNumber}
          />
          <View style={styles.row}>
            <Text style={styles.dim}>Показывать номер другим участникам</Text>
            <Switch value={isPlatePublic} onValueChange={setIsPlatePublic} />
          </View>
          <Pressable style={styles.button} onPress={onAddVehicle}>
            <Text style={styles.buttonText}>Добавить автомобиль</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.vehicleRow}>
          <Text style={styles.vehicleText}>
            {item.make} {item.model} · {item.plateNumber}
            {item.isPlatePublic ? '' : ' (номер скрыт)'}
          </Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.dim}>Пока нет добавленных автомобилей</Text>}
      ListFooterComponent={
        <Pressable style={[styles.button, styles.logoutButton]} onPress={() => logout()}>
          <Text style={styles.buttonText}>Выйти</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115' },
  content: { padding: 24, paddingTop: 56 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#333842',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    color: '#fff',
    backgroundColor: '#1b1f27',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  button: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  logoutButton: { backgroundColor: '#1b1f27', marginTop: 24, marginBottom: 24 },
  buttonText: { color: '#fff', fontWeight: '600' },
  dim: { color: '#888', marginBottom: 4 },
  error: { color: '#f87171', marginBottom: 8 },
  vehicleRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1b1f27' },
  vehicleText: { color: '#fff' },
});
