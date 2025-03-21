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