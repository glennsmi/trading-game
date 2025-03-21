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
  serverTimestamp,
  limit,
  runTransaction,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { MarketPrice, Trade } from '../types/trading';
import { getAuth } from 'firebase/auth';

const COLLECTION_NAME = 'marketPrices';
const TRADES_COLLECTION = 'trades';

// Add a debug helper to test permissions
const testFirestorePermissions = async () => {
  console.log('Testing Firestore permissions...');
  
  try {
    // Test read permissions
    console.log('Testing read permissions...');
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    console.log(`Read success: Retrieved ${snapshot.docs.length} documents`);
    
    // Test write permissions with basic document
    console.log('Testing write permissions...');
    const testDoc = {
      symbol: 'TEST/PERMISSION',
      bidPrice: 100,
      bidAmount: 1,
      offerPrice: 101,
      offerAmount: 1,
      status: 'active' as const,
      timestamp: serverTimestamp(),
      userId: 'test-permissions'
    };
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), testDoc);
    console.log('Write success:', docRef.id);
    
    // Test delete permissions
    console.log('Testing delete permissions...');
    await deleteDoc(docRef);
    console.log('Delete success');
    
    return { success: true, message: 'All Firestore permission tests passed' };
  } catch (error) {
    console.error('Firestore permission test failed:', error);
    return { 
      success: false, 
      message: 'Firestore permission test failed',
      error
    };
  }
};

// Add a collection initialization function
const initializeCollections = async () => {
  try {
    // Check if the collection exists by trying to get some documents
    const q = query(collection(db, COLLECTION_NAME), limit(1));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('Collection appears empty, creating seed document...');
      
      // Create a seed document to ensure collection exists
      const seedDoc = {
        symbol: 'SYSTEM/TEST',
        bidPrice: 1,
        bidAmount: 1,
        offerPrice: 2,
        offerAmount: 1,
        userId: 'system',
        status: 'active' as const,
        timestamp: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), seedDoc);
      console.log('Created seed document with ID:', docRef.id);
      
      // Immediately delete it to keep the collection clean
      await deleteDoc(docRef);
      console.log('Deleted seed document, collection is now initialized');
    } else {
      console.log('Collection already exists with documents');
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize collections:', error);
    return false;
  }
};

// Initialize collections when module is loaded
initializeCollections().then(result => {
  console.log('Collection initialization:', result ? 'successful' : 'failed');
});

// Add trade-related functions to the service export
export const tradingService = {
  // Create or update market price
  saveMarketPrice: async (data: Omit<MarketPrice, 'id'>) => {
    try {
      // Ensure the user is authenticated before saving
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User is not authenticated');
      }

      const docData = {
        ...data,
        timestamp: serverTimestamp(),
        status: 'active'
      };
      
      console.log('Saving with auth user:', user.uid);
      console.log('Document data:', docData);
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
      return docRef.id;
    } catch (error: any) {
      console.error('Error saving market price: ', error);
      throw error;
    }
  },

  // Update an existing market price
  updateMarketPrice: async (quoteId: string, quoteData: Omit<MarketPrice, 'id'>) => {
    if (!quoteId) throw new Error('Quote ID is required for updates');

    try {
      // Ensure the user is authenticated before updating
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User is not authenticated');
      }

      const updateData = {
        ...quoteData,
        timestamp: serverTimestamp()
      };
      
      console.log('Updating with auth user:', user.uid);
      console.log('Update data:', updateData);
      
      const docRef = doc(db, COLLECTION_NAME, quoteId);
      await updateDoc(docRef, updateData);
      return quoteId;
    } catch (error) {
      console.error('Error updating market price:', error);
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
  },

  // Add the test method to the service
  testFirestorePermissions,

  // Add the initialization function
  initializeCollections,

  // Execute a trade
  executeTrade: async (trade: Omit<Trade, 'id'>) => {
    try {
      // Start a transaction to ensure atomicity
      await runTransaction(db, async (transaction) => {
        // Get the market price document
        const marketPriceRef = doc(db, COLLECTION_NAME, trade.marketPriceId);
        const marketPriceDoc = await transaction.get(marketPriceRef);
        
        if (!marketPriceDoc.exists()) {
          throw new Error('Market price no longer exists');
        }

        const marketPrice = marketPriceDoc.data() as MarketPrice;
        
        // Verify the price is still active
        if (marketPrice.status !== 'active') {
          throw new Error('Market price is no longer active');
        }

        // Create the trade with buyer and seller references
        const tradeRef = doc(collection(db, TRADES_COLLECTION));
        const tradeData = {
          ...trade,
          timestamp: serverTimestamp(),
          buyerRef: doc(db, 'users', trade.buyerId),
          sellerRef: doc(db, 'users', trade.sellerId)
        };
        transaction.set(tradeRef, tradeData);

        // Determine the amount available and the side
        const side = trade.side;
        const availableAmount = side === 'hit' ? marketPrice.bidAmount : marketPrice.offerAmount;
        const remainingAmount = availableAmount - trade.amount;

        // Update the market price based on the remaining amount
        if (remainingAmount > 0) {
          // For partial trades: keep the price active but update the amount
          const updateData = {
            [side === 'hit' ? 'bidAmount' : 'offerAmount']: remainingAmount,
            timestamp: serverTimestamp(),
            lastTradeId: tradeRef.id
          };
          transaction.update(marketPriceRef, updateData);
        } else {
          // For full trades: mark the price as executed
          transaction.update(marketPriceRef, {
            status: 'executed',
            timestamp: serverTimestamp(),
            executedTradeId: tradeRef.id
          });
        }

        // Create entries in user's trade collections
        const buyerTradeRef = doc(collection(db, `users/${trade.buyerId}/trades`));
        const sellerTradeRef = doc(collection(db, `users/${trade.sellerId}/trades`));

        transaction.set(buyerTradeRef, {
          tradeId: tradeRef.id,
          role: 'buyer',
          ...tradeData
        });

        transaction.set(sellerTradeRef, {
          tradeId: tradeRef.id,
          role: 'seller',
          ...tradeData
        });
      });

      return true;
    } catch (error: any) {
      console.error('Error executing trade: ', error);
      throw error;
    }
  },

  // Subscribe to trades
  subscribeToTrades: (callback: (trades: Trade[]) => void) => {
    // Query for all trades, ordered by timestamp
    const q = query(
      collection(db, TRADES_COLLECTION),
      limit(100) // Limit to last 100 trades
    );

    return onSnapshot(q, (querySnapshot) => {
      const trades = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Trade[];
      
      // Sort trades by timestamp, most recent first
      trades.sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeB - timeA;
      });
      
      callback(trades);
    });
  },

  // Get trades for a specific user
  getUserTrades: async (userId: string) => {
    try {
      const userTradesRef = collection(db, `users/${userId}/trades`);
      const querySnapshot = await getDocs(userTradesRef);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Trade[];
    } catch (error) {
      console.error('Error getting user trades:', error);
      throw error;
    }
  },

  // Subscribe to trades for a specific user
  subscribeToUserTrades: (userId: string, callback: (trades: Trade[]) => void) => {
    const userTradesRef = collection(db, `users/${userId}/trades`);
    const q = query(userTradesRef, limit(100));

    return onSnapshot(q, (querySnapshot) => {
      const trades = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Trade[];
      
      // Sort trades by timestamp, most recent first
      trades.sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeB - timeA;
      });
      
      callback(trades);
    });
  },

  // Get trade details by ID
  getTradeById: async (tradeId: string) => {
    try {
      const tradeRef = doc(db, TRADES_COLLECTION, tradeId);
      const tradeDoc = await getDoc(tradeRef);
      
      if (!tradeDoc.exists()) {
        throw new Error('Trade not found');
      }
      
      return {
        id: tradeDoc.id,
        ...tradeDoc.data()
      } as Trade;
    } catch (error) {
      console.error('Error getting trade:', error);
      throw error;
    }
  },
}; 