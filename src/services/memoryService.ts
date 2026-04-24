import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

export const signIn = () => signInWithPopup(auth, provider);
export const signOut = () => auth.signOut();

export interface Memory {
  id?: string;
  content: string;
  timestamp: Timestamp;
  category: string;
  userId: string;
}

export async function saveMemory(content: string, category: string = 'interaction') {
  if (!auth.currentUser) return;
  try {
    await addDoc(collection(db, 'memories'), {
      content,
      category,
      userId: auth.currentUser.uid,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.error("Error saving memory:", e);
  }
}

export async function getRecentMemories(count: number = 5): Promise<string[]> {
  if (!auth.currentUser) return [];
  try {
    const q = query(
      collection(db, 'memories'),
      where('userId', '==', auth.currentUser.uid),
      where('category', '==', 'interaction'),
      orderBy('timestamp', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => (doc.data() as Memory).content);
  } catch (e) {
    console.error("Error getting memories:", e);
    return [];
  }
}

export async function getTraits(count: number = 10): Promise<string[]> {
  if (!auth.currentUser) return [];
  try {
    const q = query(
      collection(db, 'memories'),
      where('userId', '==', auth.currentUser.uid),
      where('category', '==', 'trait'),
      orderBy('timestamp', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => (doc.data() as Memory).content);
  } catch (e) {
    console.error("Error getting traits:", e);
    return [];
  }
}
