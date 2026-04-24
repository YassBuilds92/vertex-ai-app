import { collection, deleteDoc, doc, getDocs, limit, query, writeBatch } from 'firebase/firestore';

import { db } from '../firebase';

const DELETE_BATCH_SIZE = 400;

export async function deleteSessionTree(userId: string, sessionId: string) {
  if (!userId || !sessionId) return;

  const messagesRef = collection(db, 'users', userId, 'sessions', sessionId, 'messages');

  while (true) {
    const messagesSnapshot = await getDocs(query(messagesRef, limit(DELETE_BATCH_SIZE)));
    if (messagesSnapshot.empty) break;

    const batch = writeBatch(db);
    for (const messageDoc of messagesSnapshot.docs) {
      batch.delete(messageDoc.ref);
    }
    await batch.commit();

    if (messagesSnapshot.size < DELETE_BATCH_SIZE) break;
  }

  await deleteDoc(doc(db, 'users', userId, 'sessions', sessionId));
}
