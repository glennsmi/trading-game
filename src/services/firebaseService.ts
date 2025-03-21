import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

// Generic CRUD operations for Firestore
export const firebaseService = {
  // Create a document in a collection
  create: async (collectionName: string, data: any) => {
    try {
      // Add server timestamp for tracking
      const docData = {
        ...data,
        createdAt: data.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, collectionName), docData);
      return { id: docRef.id, ...docData };
    } catch (error: any) {
      console.error('Error adding document: ', error);
      if (error.code === 'permission-denied') {
        throw new Error('Authentication required. Please sign in first.');
      }
      throw error;
    }
  },

  // Read all documents from a collection
  getAll: async (collectionName: string) => {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error: any) {
      console.error('Error getting documents: ', error);
      if (error.code === 'permission-denied') {
        throw new Error('Authentication required to read this data.');
      }
      throw error;
    }
  },

  // Read documents with a simple query
  query: async (collectionName: string, field: string, operator: any, value: any) => {
    try {
      const q = query(collection(db, collectionName), where(field, operator, value));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error: any) {
      console.error('Error querying documents: ', error);
      if (error.code === 'permission-denied') {
        throw new Error('Authentication required to query this data.');
      }
      throw error;
    }
  },

  // Update a document
  update: async (collectionName: string, id: string, data: any) => {
    try {
      const updateData = {
        ...data,
        updatedAt: serverTimestamp()
      };
      
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, updateData);
      return { id, ...updateData };
    } catch (error: any) {
      console.error('Error updating document: ', error);
      if (error.code === 'permission-denied') {
        throw new Error('Authentication required or you do not have permission to update this document.');
      }
      throw error;
    }
  },

  // Delete a document
  delete: async (collectionName: string, id: string) => {
    try {
      await deleteDoc(doc(db, collectionName, id));
      return true;
    } catch (error: any) {
      console.error('Error deleting document: ', error);
      if (error.code === 'permission-denied') {
        throw new Error('Authentication required or you do not have permission to delete this document.');
      }
      throw error;
    }
  }
}; 