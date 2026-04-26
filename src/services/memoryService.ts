import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  serverTimestamp, 
  Timestamp,
  onSnapshot,
  updateDoc,
  doc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const provider = new GoogleAuthProvider();

export const signIn = () => signInWithPopup(auth, provider);
export const signOut = () => auth.signOut();

export interface Memory {
  id?: string;
  content: string;
  timestamp: Timestamp;
  category: 'interaction' | 'trait' | 'fact' | 'preference' | 'emotion';
  userId: string;
}

export async function saveMemory(content: string, category: Memory['category'] = 'interaction') {
  if (!auth.currentUser) return;
  const path = 'memories';
  try {
    await addDoc(collection(db, path), {
      content,
      category,
      userId: auth.currentUser.uid,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, path);
  }
}

export async function getKnowledge(category: Memory['category'], count: number = 10): Promise<string[]> {
  if (!auth.currentUser) return [];
  const path = 'memories';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', auth.currentUser.uid),
      where('category', '==', category),
      orderBy('timestamp', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => (doc.data() as Memory).content);
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, path);
    return [];
  }
}

export async function getRecentMemories(count: number = 5): Promise<string[]> {
  return getKnowledge('interaction', count);
}

export async function getTraits(count: number = 10): Promise<string[]> {
  return getKnowledge('trait', count);
}

// Remote Input Bridge
export function onRemoteCommand(callback: (command: string, id: string) => void) {
  if (!auth.currentUser) return () => {};
  const path = 'remote_inputs';
  
  const q = query(
    collection(db, path),
    where('userId', '==', auth.currentUser.uid),
    where('processed', '==', false),
    orderBy('timestamp', 'asc'),
    limit(1)
  );

  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        callback(data.command, change.doc.id);
      }
    });
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export async function markCommandProcessed(id: string) {
  const path = `remote_inputs/${id}`;
  try {
    await updateDoc(doc(db, 'remote_inputs', id), {
      processed: true
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
  }
}

export async function sendRemoteCommand(command: string) {
  if (!auth.currentUser) return;
  const path = 'remote_inputs';
  try {
    await addDoc(collection(db, path), {
      command,
      userId: auth.currentUser.uid,
      timestamp: serverTimestamp(),
      processed: false
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
  }
}

export async function clearAllMemories() {
  if (!auth.currentUser) return;
  const path = 'memories';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', auth.currentUser.uid)
    );
    const snapshot = await getDocs(q);
    // Delete in a loop or batch (using deleteDoc)
    const { deleteDoc } = await import('firebase/firestore');
    const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
  }
}
