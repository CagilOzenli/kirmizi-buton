import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  Alert,
  SafeAreaView,
} from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDvj2QYTBhmBwS8SoTYbZTwS570YmYVL20",
  authDomain: "racismbutton.firebaseapp.com",
  projectId: "racismbutton",
  storageBucket: "racismbutton.firebasestorage.app",
  messagingSenderId: "597933800259",
  appId: "1:597933800259:web:3a7779603d4e7dc16ecdf6",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [name, setName] = useState('');
  const [registered, setRegistered] = useState(false);
  const [log, setLog] = useState([]);
  const pushTokenRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'presses'), orderBy('createdAt', 'desc'), limit(20)),
      (snap) => setLog(snap.docs.map((d) => d.data()))
    );
    return unsub;
  }, []);

  async function registerForPush() {
    try {
      if (!name.trim()) {
        Alert.alert('Ad gerekli', 'Lütfen önce adını yaz.');
        return;
      }
      if (!Device.isDevice) {
        Alert.alert('Fiziksel cihaz gerekli', 'Bildirimler simülatörde/emülatörde çalışmaz.');
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('İzin gerekli', 'Bildirim izni vermeden uygulama çalışmaz.');
        return;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
        });
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig.extra.eas.projectId,
      });
      pushTokenRef.current = tokenData.data;

      await setDoc(doc(db, 'devices', tokenData.data), {
        name: name.trim(),
        token: tokenData.data,
        updatedAt: serverTimestamp(),
      });

      setRegistered(true);
    } catch (err) {
      Alert.alert('Hata', String(err));
    }
  }

  async function handlePress() {
    try {
      await addDoc(collection(db, 'presses'), {
        name: name.trim(),
        senderToken: pushTokenRef.current,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      Alert.alert('Hata', String(err));
    }
  }

  if (!registered) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Kayıt Ol</Text>
        <TextInput
          style={styles.input}
          placeholder="Adını yaz"
          placeholderTextColor="#8A8F98"
          value={name}
          onChangeText={setName}
        />
        <TouchableOpacity style={styles.smallButton} onPress={registerForPush}>
          <Text style={styles.smallButtonText}>Bildirimleri Aç ve Katıl</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.hello}>Merhaba {name}</Text>
      <TouchableOpacity style={styles.bigButton} onPress={handlePress} activeOpacity={0.7}>
        <Text style={styles.bigButtonText}>BAS</Text>
      </TouchableOpacity>
      <Text style={styles.logTitle}>Son basanlar</Text>
      <FlatList
        style={styles.log}
        data={log}
        keyExtractor={(item, i) => i.toString()}
        renderItem={({ item }) => <Text style={styles.logItem}>• {item.name} bastı</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#16181C', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { color: '#F2EFEA', fontSize: 24, marginBottom: 20, fontWeight: '600' },
  hello: { color: '#8A8F98', fontSize: 16, marginBottom: 20 },
  input: {
    backgroundColor: '#22252B',
    color: '#F2EFEA',
    width: '100%',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 16,
  },
  smallButton: { backgroundColor: '#C81E3A', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 10 },
  smallButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  bigButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#C81E3A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: '#7A0F1F',
    marginBottom: 30,
    shadowColor: '#C81E3A',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  bigButtonText: { color: '#fff', fontSize: 32, fontWeight: 'bold', letterSpacing: 2 },
  logTitle: { color: '#8A8F98', fontSize: 14, marginBottom: 8, alignSelf: 'flex-start' },
  log: { width: '100%' },
  logItem: { color: '#B8BCC4', paddingVertical: 4, fontSize: 14 },
});