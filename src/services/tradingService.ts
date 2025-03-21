import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { MarketPrice } from '../types/trading';

const COLLECTION_NAME = 'marketPrices';

export const tradingService = {
  // Create or update market price
  saveMarketPrice: async (marketPrice: Omit<MarketPrice, 'id' | 'timestamp' | 'status'>) => {
    try {
      // Add server timestamp and status
      const docData = {
        ...marketPrice,
        timestamp: serverTimestamp(),
        status: 'active'
      };
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
      return { id: docRef.id, ...docData };
    } catch (error: any) {
      console.error('Error saving market price: ', error);
      throw error;
    }
  },

  // Update an existing market price
  updateMarketPrice: async (id: string, data: Partial<MarketPrice>) => {
    try {
      const updateData = {
        ...data,
        timestamp: serverTimestamp()
      };
      
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, updateData);
      return { id, ...updateData };
    } catch (error: any) {
      console.error('Error updating market price: ', error);
      throw error;
    }
  },

  // Get all market prices for a user
  getUserMarketPrices: async (userId: string) => {
    try {
      const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MarketPrice[];
    } catch (error: any) {
      console.error('Error getting user market prices: ', error);
      throw error;
    }
  },

  // Get all active market prices
  getActiveMarketPrices: async () => {
    try {
      const q = query(collection(db, COLLECTION_NAME), where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MarketPrice[];
    } catch (error: any) {
      console.error('Error getting active market prices: ', error);
      throw error;
    }
  },

  // Listen to real-time updates of all market prices
  subscribeToMarketPrices: (callback: (prices: MarketPrice[]) => void) => {
    const q = query(collection(db, COLLECTION_NAME), where('status', '==', 'active'));
    return onSnapshot(q, (querySnapshot) => {
      const prices = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MarketPrice[];
      callback(prices);
    });
  },

  // Cancel a market price
  cancelMarketPrice: async (id: string) => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        status: 'canceled',
        timestamp: serverTimestamp()
      });
      return true;
    } catch (error: any) {
      console.error('Error canceling market price: ', error);
      throw error;
    }
  },

  // Delete a market price document
  deleteMarketPrice: async (id: string) => {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      return true;
    } catch (error: any) {
      console.error('Error deleting market price: ', error);
      throw error;
    }
  }
}; 