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
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  updateDoc,
  doc,
  increment,
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

const STORAGE_NAME_KEY = 'kirmizibuton_name';
const STORAGE_TOKEN_KEY = 'kirmizibuton_token';

export default function App() {
  const [name, setName] = useState('');
  const [registered, setRegistered] = useState(false);
  const [checkingStorage, setCheckingStorage] = useState(true);
  const [screen, setScreen] = useState('press'); // 'press' | 'leaderboard' | 'chat'
  const [log, setLog] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const pushTokenRef = useRef(null);

  // Uygulama açılır açılmaz daha önce kayıt olunmuş mu diye kontrol eder
  useEffect(() => {
    (async () => {
      try {
        const savedName = await AsyncStorage.getItem(STORAGE_NAME_KEY);
        const savedToken = await AsyncStorage.getItem(STORAGE_TOKEN_KEY);
        if (savedName && savedToken) {
          setName(savedName);
          pushTokenRef.current = savedToken;
          setRegistered(true);
        }
      } catch (err) {
        // depolama okunamazsa kayıt ekranına düşer, sorun değil
      } finally {
        setCheckingStorage(false);
      }
    })();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'presses'), orderBy('createdAt', 'desc'), limit(20)),
      (snap) => setLog(snap.docs.map((d) => d.data()))
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'devices'), orderBy('pressCount', 'desc'), limit(20)),
      (snap) => setLeaderboard(snap.docs.map((d) => d.data()))
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(50)),
      (snap) => setMessages(snap.docs.map((d) => d.data()).reverse())
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
        pressCount: 0,
        updatedAt: serverTimestamp(),
      });

      // Kayıt bilgisini telefona kalıcı olarak kaydet
      await AsyncStorage.setItem(STORAGE_NAME_KEY, name.trim());
      await AsyncStorage.setItem(STORAGE_TOKEN_KEY, tokenData.data);

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

      if (pushTokenRef.current) {
        await updateDoc(doc(db, 'devices', pushTokenRef.current), {
          pressCount: increment(1),
        });
      }
    } catch (err) {
      Alert.alert('Hata', String(err));
    }
  }

  async function sendMessage() {
    if (!chatText.trim()) return;
    try {
      await addDoc(collection(db, 'messages'), {
        name: name.trim(),
        text: chatText.trim(),
        createdAt: serverTimestamp(),
      });
      setChatText('');
    } catch (err) {
      Alert.alert('Hata', String(err));
    }
  }

  async function handleForget() {
    Alert.alert('Kaydı sil', 'Bu cihazdaki kaydı silmek istiyor musun? Bir dahaki açılışta tekrar isim gireceksin.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(STORAGE_NAME_KEY);
          await AsyncStorage.removeItem(STORAGE_TOKEN_KEY);
          setRegistered(false);
          setName('');
          pushTokenRef.current = null;
        },
      },
    ]);
  }

  if (checkingStorage) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.hello}>Yükleniyor…</Text>
      </SafeAreaView>
    );
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
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <Text style={styles.hello}>Merhaba {name}</Text>
          <TouchableOpacity onPress={handleForget}>
            <Text style={styles.forgetLink}>Çıkış</Text>
          </TouchableOpacity>
        </View>

        {screen === 'press' && (
          <View style={styles.screenBody}>
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
          </View>
        )}

        {screen === 'leaderboard' && (
          <View style={styles.screenBody}>
            <Text style={styles.logTitle}>Sıralama</Text>
            <FlatList
              style={styles.log}
              data={leaderboard}
              keyExtractor={(item, i) => i.toString()}
              renderItem={({ item, index }) => (
                <View style={styles.leaderRow}>
                  <Text style={styles.leaderRank}>{index + 1}.</Text>
                  <Text style={styles.leaderName}>{item.name}</Text>
                  <Text style={styles.leaderCount}>{item.pressCount || 0}</Text>
                </View>
              )}
            />
          </View>
        )}

        {screen === 'chat' && (
          <View style={styles.screenBody}>
            <Text style={styles.logTitle}>Sohbet</Text>
            <FlatList
              style={styles.log}
              data={messages}
              keyExtractor={(item, i) => i.toString()}
              renderItem={({ item }) => (
                <View style={styles.chatBubble}>
                  <Text style={styles.chatName}>{item.name}</Text>
                  <Text style={styles.chatText}>{item.text}</Text>
                </View>
              )}
            />
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Bir şey yaz…"
                placeholderTextColor="#8A8F98"
                value={chatText}
                onChangeText={setChatText}
              />
              <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                <Text style={styles.sendButtonText}>Gönder</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.navBar}>
          <TouchableOpacity style={styles.navItem} onPress={() => setScreen('press')}>
            <Text style={[styles.navText, screen === 'press' && styles.navTextActive]}>Buton</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setScreen('leaderboard')}>
            <Text style={[styles.navText, screen === 'leaderboard' && styles.navTextActive]}>Sıralama</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setScreen('chat')}>
            <Text style={[styles.navText, screen === 'chat' && styles.navTextActive]}>Sohbet</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#16181C', alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  screenBody: { flex: 1, width: '100%', alignItems: 'center', padding: 20 },
  title: { color: '#F2EFEA', fontSize: 24, marginBottom: 20, fontWeight: '600' },
  hello: { color: '#8A8F98', fontSize: 16 },
  forgetLink: { color: '#8A8F98', fontSize: 13, textDecorationLine: 'underline' },
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
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#C81E3A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: '#7A0F1F',
    marginTop: 70,
    marginBottom: 24,
    shadowColor: '#C81E3A',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  bigButtonText: { color: '#fff', fontSize: 30, fontWeight: 'bold', letterSpacing: 2 },
  logTitle: { color: '#8A8F98', fontSize: 14, marginTop: 12, marginBottom: 8, alignSelf: 'flex-start' },
  log: { width: '100%' },
  logItem: { color: '#B8BCC4', paddingVertical: 4, fontSize: 14 },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#22252B',
  },
  leaderRank: { color: '#8A8F98', width: 28, fontSize: 14 },
  leaderName: { color: '#F2EFEA', flex: 1, fontSize: 15 },
  leaderCount: { color: '#C81E3A', fontWeight: 'bold', fontSize: 15 },
  chatBubble: { marginBottom: 10 },
  chatName: { color: '#C81E3A', fontSize: 12, fontWeight: 'bold' },
  chatText: { color: '#F2EFEA', fontSize: 15 },
  chatInputRow: { flexDirection: 'row', width: '100%', marginTop: 8, gap: 8 },
  chatInput: {
    flex: 1,
    backgroundColor: '#22252B',
    color: '#F2EFEA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#C81E3A',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 10,
  },
  sendButtonText: { color: '#fff', fontWeight: 'bold' },
  navBar: {
    flexDirection: 'row',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#2C3038',
    backgroundColor: '#1C1F26',
    paddingTop: 14,
    paddingBottom: 28,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  navText: { color: '#8A8F98', fontSize: 15 },
  navTextActive: { color: '#C81E3A', fontWeight: 'bold', fontSize: 16 },
});
