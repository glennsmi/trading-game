export interface MarketPrice {
  id?: string;
  userId: string;
  symbol: string;
  bidPrice: number;
  bidAmount: number;
  offerPrice: number;
  offerAmount: number;
  timestamp: Date | any; // Firebase Timestamp
  status: 'active' | 'canceled' | 'executed';
}

// Type for form inputs when creating/updating market prices
export interface MarketPriceFormData {
  symbol: string;
  bidPrice: number;
  bidAmount: number;
  offerPrice: number;
  offerAmount: number;
}

// New types for trades
export interface Trade {
  id?: string;
  symbol: string;
  price: number;
  amount: number;
  timestamp: Date | any;
  buyerId: string;
  sellerId: string;
  marketPriceId: string; // Reference to the market price that was hit/lifted
  side: 'hit' | 'lift'; // hit = hitting the offer, lift = lifting the bid
  status: 'executed';
}

export interface TradeSummary extends Trade {
  buyerName: string;
  sellerName: string;
} 