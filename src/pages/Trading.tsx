import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { tradingService } from '../services/tradingService';
import { MarketPrice, MarketPriceFormData, Trade } from '../types/trading';

export default function Trading() {
  const { currentUser } = useAuth();
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [userMarketPrices, setUserMarketPrices] = useState<MarketPrice[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [formData, setFormData] = useState<MarketPriceFormData>({
    symbol: 'NVDA',
    bidPrice: 0,
    bidAmount: 10,
    offerPrice: 0,
    offerAmount: 10
  });
  const [tradeAmount, setTradeAmount] = useState<{ bid: number | string; offer: number | string }>({
    bid: '',
    offer: ''
  });
  const [selectedPrice, setSelectedPrice] = useState<{ type: 'bid' | 'offer' | null; price: number | null }>({
    type: null,
    price: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<string | null>(null);

  // Get user's active price
  const userActivePrice = useMemo(() => 
    marketPrices.find(price => 
      price.userId === currentUser?.uid && 
      price.status === 'active'
    ),
    [marketPrices, currentUser]
  );

  // Update form data when user's active price changes
  useEffect(() => {
    if (userActivePrice) {
      setFormData({
        symbol: userActivePrice.symbol,
        bidPrice: userActivePrice.bidPrice,
        bidAmount: userActivePrice.bidAmount,
        offerPrice: userActivePrice.offerPrice,
        offerAmount: userActivePrice.offerAmount
      });
      setCurrentQuote(userActivePrice.id || null);
    }
  }, [userActivePrice]);

  // Fetch all active market prices in real-time
  useEffect(() => {
    const unsubscribe = tradingService.subscribeToMarketPrices((prices) => {
      setMarketPrices(prices);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Fetch user's market prices
  useEffect(() => {
    if (!currentUser) return;

    const fetchUserMarketPrices = async () => {
      try {
        const data = await tradingService.getUserMarketPrices(currentUser.uid);
        setUserMarketPrices(data);
      } catch (err) {
        console.error('Error fetching user market prices:', err);
        setError('Failed to fetch your market prices');
      }
    };

    fetchUserMarketPrices();
  }, [currentUser]);

  // Subscribe to trades
  useEffect(() => {
    const unsubscribe = tradingService.subscribeToTrades((newTrades) => {
      setTrades(newTrades);
    });

    return () => unsubscribe();
  }, []);

  // Near the top of the file, add a helper function
  const isFirestoreError = (error: any): boolean => {
    return (
      error && 
      (error.name === 'FirebaseError' || 
       error.message?.includes('Firestore') || 
       error.message?.includes('BloomFilterError'))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser || !currentUser.uid) {
      setError('You must be logged in to submit market prices.');
      return;
    }

    if (!formData.symbol || formData.bidPrice <= 0 || formData.offerPrice <= 0) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.bidPrice >= formData.offerPrice) {
      setError('Bid price must be less than offer price');
      return;
    }

    try {
      setSavingInProgress(true);
      
      const quoteData = {
        ...formData,
        userId: currentUser.uid,
        status: 'active' as const,
        timestamp: null
      };
      
      if (currentQuote) {
        await tradingService.updateMarketPrice(currentQuote, quoteData);
      } else {
        const newQuoteId = await tradingService.saveMarketPrice(quoteData);
        setCurrentQuote(newQuoteId);
      }
      
      setError('');
    } catch (err) {
      console.error('Error saving market price:', err);
      if (isFirestoreError(err)) {
        setError('Database error: Please check your connection and permissions.');
      } else {
        setError('Failed to save market price: ' + (err instanceof Error ? err.message : String(err)));
      }
    } finally {
      setSavingInProgress(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Handle different input types
    let parsedValue: string | number = value;
    if (name !== 'symbol') {
      // For numeric fields, parse as integer and handle empty string
      parsedValue = value === '' ? 0 : parseInt(value);
      // If parsing failed, keep the previous value
      if (isNaN(parsedValue)) {
        parsedValue = formData[name as keyof MarketPriceFormData];
      }
    }

    setFormData({
      ...formData,
      [name]: parsedValue
    });
  };

  const handleNewQuote = () => {
    setFormData({
      symbol: 'NVDA',
      bidPrice: 0,
      bidAmount: 10,
      offerPrice: 0,
      offerAmount: 10
    });
    setCurrentQuote(null);
    setError('');
  };

  const handleCancel = async (id: string) => {
    if (!id) return;
    
    try {
      setLoading(true);
      await tradingService.cancelMarketPrice(id);
      
      // If we're canceling the current quote, reset the form
      if (id === currentQuote) {
        handleNewQuote();
      }
      
      setUserMarketPrices(prevPrices => 
        prevPrices.map(price => 
          price.id === id ? { ...price, status: 'canceled' } : price
        )
      );
    } catch (err) {
      console.error('Error canceling market price:', err);
      setError('Failed to cancel market price');
    } finally {
      setLoading(false);
    }
  };

  // Add this new function to handle box clicks
  const handlePriceBoxClick = (type: 'bid' | 'offer', price: number) => {
    if (!currentUser) return;
    
    // If clicking the same box, clear selection
    if (selectedPrice.type === type && selectedPrice.price === price) {
      setSelectedPrice({ type: null, price: null });
      return;
    }
    
    setSelectedPrice({ type, price });
    setTradeAmount({ ...tradeAmount, [type]: '' }); // Reset amount for the selected side
  };

  // Add a proper number parsing function
  const parseNumber = (value: string | number): number | null => {
    console.log('parseNumber input:', { value, type: typeof value });
    if (typeof value === 'number') return value;
    if (value === '') return null;
    const parsed = Number(value);
    console.log('parseNumber result:', { parsed, isNaN: isNaN(parsed) });
    return isNaN(parsed) ? null : parsed;
  };

  // Add this new function to ensure numeric inputs
  const ensureNumericInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove any non-numeric characters except decimal point
    const value = e.target.value.replace(/[^0-9]/g, '');
    // Update the input directly to ensure only numbers
    e.target.value = value;
    return value;
  };

  // Update the handleTradeAmountChange function
  const handleTradeAmountChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'bid' | 'offer') => {
    // Force numeric input
    const inputValue = ensureNumericInput(e);
    console.log('handleTradeAmountChange input (after cleaning):', { type, inputValue, valueType: typeof inputValue });
    
    // Allow empty input
    if (inputValue === '') {
      console.log('Empty input detected, setting empty string');
      setTradeAmount(prev => ({ ...prev, [type]: '' }));
      setError('');
      return;
    }

    // Parse the number using our helper
    const parsedValue = parseNumber(inputValue);
    console.log('After parsing:', { parsedValue, type: typeof parsedValue });
    
    // Validate the parsed value
    if (parsedValue === null || parsedValue <= 0) {
      console.log('Invalid value detected:', { parsedValue });
      setError('Please enter a valid trade amount greater than 0');
      return;
    }

    console.log('Setting valid trade amount:', { type, parsedValue });
    setTradeAmount(prev => ({ ...prev, [type]: parsedValue }));
    setError('');
  };

  // Add a function to validate trade amount before attempting trade
  const validateTradeAmount = (amount: string | number | null | undefined, side: 'hit' | 'lift'): boolean => {
    console.log('validateTradeAmount called:', { amount, side, type: typeof amount });

    if (amount === undefined || amount === null || amount === '') {
      console.log('Trade amount is empty or null');
      setError('Please enter a trade amount');
      return false;
    }

    const parsedAmount = parseNumber(amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      console.log('Invalid trade amount:', { parsedAmount });
      setError(`Please enter a valid trade amount greater than 0. Current value: ${parsedAmount === null ? 'null' : parsedAmount}`);
      return false;
    }

    return true;
  };

  // Update the executeTrade function with better number handling
  const executeTrade = async (marketPrice: MarketPrice, side: 'hit' | 'lift') => {
    console.log('executeTrade called:', { side, marketPrice });
    
    if (!currentUser) {
      setError('You must be logged in to trade');
      return;
    }

    // Clear any previous errors
    setError('');

    // Get and parse the trade amount
    const inputAmount = side === 'hit' ? tradeAmount.offer : tradeAmount.bid;
    console.log('Trade input amount:', { side, inputAmount, type: typeof inputAmount });
    
    const tradeAmountValue = parseNumber(inputAmount);
    console.log('After parsing trade amount:', { tradeAmountValue, type: typeof tradeAmountValue });
    
    const availableAmount = side === 'hit' ? marketPrice.offerAmount : marketPrice.bidAmount;
    console.log('Available amount:', { availableAmount, type: typeof availableAmount });

    console.log('Trade attempt details:', { 
      side, 
      inputAmount, 
      inputAmountType: typeof inputAmount,
      tradeAmountValue, 
      tradeAmountValueType: typeof tradeAmountValue,
      availableAmount,
      availableAmountType: typeof availableAmount,
      isInputValid: !(tradeAmountValue === null || tradeAmountValue <= 0),
      isAmountAvailable: tradeAmountValue !== null && tradeAmountValue <= availableAmount
    });

    // Validate trade amount
    if (tradeAmountValue === null || tradeAmountValue <= 0) {
      console.log('Invalid trade amount detected:', { tradeAmountValue });
      setError(`Please enter a valid trade amount greater than 0. Current value: ${tradeAmountValue === null ? 'null' : tradeAmountValue}`);
      return;
    }

    if (tradeAmountValue > availableAmount) {
      console.log('Trade amount exceeds available amount:', { tradeAmountValue, availableAmount });
      setError(`Cannot trade ${tradeAmountValue} shares. Maximum available is ${availableAmount}`);
      return;
    }

    try {
      console.log('Creating trade object');
      const trade = {
        symbol: marketPrice.symbol,
        price: side === 'hit' ? marketPrice.offerPrice : marketPrice.bidPrice,
        amount: tradeAmountValue,
        buyerId: side === 'hit' ? currentUser.uid : marketPrice.userId,
        sellerId: side === 'hit' ? marketPrice.userId : currentUser.uid,
        marketPriceId: marketPrice.id!,
        side,
        status: 'executed' as const,
        timestamp: null
      };
      console.log('Trade object created:', trade);

      // Handle partial trades
      const remainingAmount = availableAmount - tradeAmountValue;
      console.log('Calculated remaining amount:', { remainingAmount });
      
      if (remainingAmount > 0) {
        console.log('Executing partial trade, updating market price');
        await tradingService.updateMarketPrice(marketPrice.id!, {
          ...marketPrice,
          [side === 'hit' ? 'offerAmount' : 'bidAmount']: remainingAmount
        });
      } else {
        console.log('Executing full trade, market price completed');
        await tradingService.updateMarketPrice(marketPrice.id!, {
          ...marketPrice,
          status: 'executed'
        });
      }

      console.log('Executing trade with tradingService');
      await tradingService.executeTrade(trade);
      console.log('Trade executed successfully');
      setError('');
      setSelectedPrice({ type: null, price: null });
      setTradeAmount({ bid: '', offer: '' });
    } catch (err) {
      console.error('Error executing trade:', err);
      setError('Failed to execute trade: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Also, let's log the user state when component renders
  useEffect(() => {
    console.log('Trading component loaded, auth state:', 
      currentUser ? `Authenticated as ${currentUser.uid}` : 'Not authenticated');
  }, [currentUser]);

  // Calculate best bid and offer
  const bestBid = marketPrices
    .filter(price => price.status === 'active' && price.bidPrice > 0)
    .reduce((max, price) => Math.max(max, price.bidPrice), 0);

  const bestOffer = marketPrices
    .filter(price => price.status === 'active' && price.offerPrice > 0)
    .reduce((min, price) => min === 0 ? price.offerPrice : Math.min(min, price.offerPrice), 0);

  const bestBidAmount = marketPrices
    .find(price => price.status === 'active' && price.bidPrice === bestBid)?.bidAmount || 0;

  const bestOfferAmount = marketPrices
    .find(price => price.status === 'active' && price.offerPrice === bestOffer)?.offerAmount || 0;

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Trading Dashboard</h1>
      
      {/* Best Bid/Offer Summary */}
      <div style={{ 
        backgroundColor: "white", 
        padding: "1.5rem", 
        borderRadius: "0.5rem", 
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)", 
        marginBottom: "1.5rem", 
        border: "1px solid #E5E7EB"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "4rem",
          marginBottom: selectedPrice.type ? "1rem" : "0"
        }}>
          {/* Best Bid Box */}
          <div 
            onClick={() => bestBid > 0 && handlePriceBoxClick('bid', bestBid)}
            style={{
              textAlign: "center",
              padding: "1rem",
              backgroundColor: selectedPrice.type === 'bid' ? "#D1FAE5" : "#ECFDF5",
              borderRadius: "0.5rem",
              minWidth: "200px",
              cursor: bestBid > 0 ? "pointer" : "default",
              border: selectedPrice.type === 'bid' ? "2px solid #059669" : "none",
              transition: "all 0.2s"
            }}
          >
            <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "#065F46" }}>
              {bestBid > 0 ? bestBid.toFixed(0) : '-'}
            </div>
            <div style={{ fontSize: "1rem", color: "#065F46", marginTop: "0.5rem" }}>
              Best Bid
            </div>
            <div style={{ fontSize: "0.875rem", color: "#059669", marginTop: "0.25rem" }}>
              Amount: {bestBidAmount > 0 ? bestBidAmount.toFixed(0) : '-'}
            </div>
          </div>

          {/* Best Offer Box */}
          <div 
            onClick={() => bestOffer > 0 && handlePriceBoxClick('offer', bestOffer)}
            style={{
              textAlign: "center",
              padding: "1rem",
              backgroundColor: selectedPrice.type === 'offer' ? "#FEE2E2" : "#FEF2F2",
              borderRadius: "0.5rem",
              minWidth: "200px",
              cursor: bestOffer > 0 ? "pointer" : "default",
              border: selectedPrice.type === 'offer' ? "2px solid #DC2626" : "none",
              transition: "all 0.2s"
            }}
          >
            <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "#991B1B" }}>
              {bestOffer > 0 ? bestOffer.toFixed(0) : '-'}
            </div>
            <div style={{ fontSize: "1rem", color: "#991B1B", marginTop: "0.5rem" }}>
              Best Offer
            </div>
            <div style={{ fontSize: "0.875rem", color: "#DC2626", marginTop: "0.25rem" }}>
              Amount: {bestOfferAmount > 0 ? bestOfferAmount.toFixed(0) : '-'}
            </div>
          </div>
        </div>

        {/* Trade Amount Input */}
        {selectedPrice.type && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "#F9FAFB",
            borderRadius: "0.5rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <input
                type="number"
                value={tradeAmount[selectedPrice.type] || ''}
                onChange={(e) => handleTradeAmountChange(e, selectedPrice.type!)}
                min="1"
                step="1"
                placeholder="Enter amount"
                style={{
                  width: "150px",
                  padding: "0.5rem",
                  fontSize: "1.25rem",
                  fontWeight: "bold",
                  border: `2px solid ${selectedPrice.type === 'bid' ? '#059669' : '#DC2626'}`,
                  borderRadius: "0.375rem",
                  textAlign: "center"
                }}
              />
              <button
                onClick={() => {
                  console.log('Trade box button clicked:', { selectedPrice, tradeAmount });
                  if (!selectedPrice.type) {
                    console.error('No price type selected');
                    return;
                  }
                  
                  const currentAmount = tradeAmount[selectedPrice.type];
                  // Validate amount first
                  if (!validateTradeAmount(currentAmount, selectedPrice.type === 'bid' ? 'hit' : 'lift')) {
                    return;
                  }
                  
                  const matchingPrice = marketPrices.find(p => 
                    selectedPrice.type === 'bid' ? 
                      p.bidPrice === selectedPrice.price : 
                      p.offerPrice === selectedPrice.price
                  );
                  console.log('Found matching price:', matchingPrice);
                  if (matchingPrice) {
                    const tradeType = selectedPrice.type === 'bid' ? 'hit' : 'lift';
                    console.log('Executing trade:', { tradeType, matchingPrice });
                    executeTrade(matchingPrice, tradeType);
                  } else {
                    console.error('No matching price found!');
                  }
                }}
                disabled={!tradeAmount[selectedPrice.type]}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: selectedPrice.type === 'bid' ? '#059669' : '#DC2626',
                  color: "white",
                  borderRadius: "0.375rem",
                  fontSize: "1rem",
                  fontWeight: "500",
                  opacity: tradeAmount[selectedPrice.type] ? 1 : 0.5,
                  cursor: tradeAmount[selectedPrice.type] ? "pointer" : "not-allowed"
                }}
              >
                {selectedPrice.type === 'bid' ? 'Hit Bid' : 'Lift Offer'}
              </button>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div style={{ backgroundColor: "#FEE2E2", borderLeft: "4px solid #EF4444", color: "#B91C1C", padding: "1rem", marginBottom: "1.5rem", borderRadius: "0.375rem" }}>
          <p>{error}</p>
          {process.env.NODE_ENV !== 'production' && (
            <details style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
              <summary>Debug Info</summary>
              <pre style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap", fontSize: "0.75rem" }}>
                Selected Price: {JSON.stringify(selectedPrice, null, 2)}
                Trade Amount: {JSON.stringify(tradeAmount, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
      
      {/* Market price submission form */}
      <div style={{ backgroundColor: "white", padding: "2rem", borderRadius: "0.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "2.5rem", border: "1px solid #E5E7EB" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid #E5E7EB", paddingBottom: "0.5rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#374151" }}>
            {currentQuote ? 'Edit Quote' : 'New Quote'}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {savingInProgress && (
              <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>Saving...</span>
            )}
            {currentQuote && (
              <button
                type="button"
                onClick={handleNewQuote}
                style={{ 
                  padding: "0.5rem 1rem", 
                  backgroundColor: "#4B5563", 
                  color: "white", 
                  borderRadius: "0.375rem", 
                  fontSize: "0.875rem",
                  fontWeight: "500"
                }}
              >
                New Quote
              </button>
            )}
          </div>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Symbol Input */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label htmlFor="symbol" style={{ display: "block", fontSize: "1.125rem", fontWeight: "500", marginBottom: "0.5rem", color: "#374151" }}>
              Symbol
            </label>
            <input
              id="symbol"
              type="text"
              name="symbol"
              value="NVDA"
              readOnly
              style={{ 
                width: "33%", 
                padding: "0.75rem", 
                fontSize: "1.25rem", 
                fontWeight: "bold", 
                border: "2px solid #D1D5DB", 
                borderRadius: "0.375rem", 
                textTransform: "uppercase",
                backgroundColor: "#F3F4F6",
                cursor: "not-allowed"
              }}
            />
          </div>
          
          {/* Trading Prices Container */}
          <div style={{ display: "flex", flexDirection: "row", gap: "1rem" }}>
            {/* BID SECTION */}
            <div style={{ 
              flex: 1, 
              border: "2px solid #10B981", 
              borderRadius: "0.5rem", 
              padding: "1rem", 
              backgroundColor: "#ECFDF5" 
            }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#065F46", marginBottom: "0.5rem", textAlign: "center" }}>
                Bid (Buy)
              </h3>
              
              {/* Current Active Bid Display */}
              {userActivePrice && userActivePrice.bidPrice > 0 && (
                <div style={{ 
                  marginBottom: "1rem", 
                  padding: "0.5rem",
                  backgroundColor: "white",
                  borderRadius: "0.375rem",
                  border: "1px solid #10B981"
                }}>
                  <div style={{ textAlign: "center", color: "#065F46", fontWeight: "500", marginBottom: "0.25rem" }}>
                    Your Active Bid
                  </div>
                  <div style={{ 
                    fontSize: "1.5rem", 
                    fontWeight: "bold", 
                    color: "#065F46",
                    textAlign: "center"
                  }}>
                    {userActivePrice.bidPrice.toFixed(0)}
                  </div>
                  <div style={{ 
                    fontSize: "0.875rem", 
                    color: "#059669",
                    textAlign: "center"
                  }}>
                    Amount: {userActivePrice.bidAmount.toFixed(0)}
                  </div>
                </div>
              )}
              
              {/* Bid Price Input */}
              <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="bidPrice" style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", marginBottom: "0.25rem", color: "#065F46", textAlign: "center" }}>
                  {userActivePrice ? 'Update Bid Price' : 'New Bid Price'}
                </label>
                <input
                  id="bidPrice"
                  type="number"
                  name="bidPrice"
                  value={formData.bidPrice || ''}
                  onChange={handleInputChange}
                  min="0"
                  style={{ 
                    width: "120px",
                    height: "120px",
                    padding: "0.5rem",
                    fontSize: "2.5rem",
                    fontWeight: "bold",
                    border: "2px solid #10B981",
                    borderRadius: "0.375rem",
                    backgroundColor: "white",
                    textAlign: "center",
                    display: "block",
                    margin: "0 auto"
                  }}
                  required
                />
              </div>
              
              {/* Bid Amount */}
              <div>
                <label htmlFor="bidAmount" style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", marginBottom: "0.25rem", color: "#065F46", textAlign: "center" }}>
                  {userActivePrice ? 'Update Amount' : 'Amount'}
                </label>
                <input
                  id="bidAmount"
                  type="number"
                  name="bidAmount"
                  value={formData.bidAmount || 10}
                  onChange={handleInputChange}
                  min="0"
                  style={{ 
                    width: "100%",
                    padding: "0.75rem",
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    border: "2px solid #10B981",
                    borderRadius: "0.375rem",
                    backgroundColor: "white",
                    textAlign: "center"
                  }}
                  required
                />
              </div>
            </div>
            
            {/* OFFER SECTION */}
            <div style={{ 
              flex: 1, 
              border: "2px solid #EF4444", 
              borderRadius: "0.5rem", 
              padding: "1rem", 
              backgroundColor: "#FEF2F2" 
            }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#991B1B", marginBottom: "0.5rem", textAlign: "center" }}>
                Offer (Sell)
              </h3>
              
              {/* Current Active Offer Display */}
              {userActivePrice && userActivePrice.offerPrice > 0 && (
                <div style={{ 
                  marginBottom: "1rem", 
                  padding: "0.5rem",
                  backgroundColor: "white",
                  borderRadius: "0.375rem",
                  border: "1px solid #EF4444"
                }}>
                  <div style={{ textAlign: "center", color: "#991B1B", fontWeight: "500", marginBottom: "0.25rem" }}>
                    Your Active Offer
                  </div>
                  <div style={{ 
                    fontSize: "1.5rem", 
                    fontWeight: "bold", 
                    color: "#991B1B",
                    textAlign: "center"
                  }}>
                    {userActivePrice.offerPrice.toFixed(0)}
                  </div>
                  <div style={{ 
                    fontSize: "0.875rem", 
                    color: "#DC2626",
                    textAlign: "center"
                  }}>
                    Amount: {userActivePrice.offerAmount.toFixed(0)}
                  </div>
                </div>
              )}
              
              {/* Offer Price */}
              <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="offerPrice" style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", marginBottom: "0.25rem", color: "#991B1B", textAlign: "center" }}>
                  {userActivePrice ? 'Update Offer Price' : 'New Offer Price'}
                </label>
                <input
                  id="offerPrice"
                  type="number"
                  name="offerPrice"
                  value={formData.offerPrice || ''}
                  onChange={handleInputChange}
                  min="0"
                  style={{ 
                    width: "120px",
                    height: "120px",
                    padding: "0.5rem",
                    fontSize: "2.5rem",
                    fontWeight: "bold",
                    border: "2px solid #EF4444",
                    borderRadius: "0.375rem",
                    backgroundColor: "white",
                    textAlign: "center",
                    display: "block",
                    margin: "0 auto"
                  }}
                  required
                />
              </div>
              
              {/* Offer Amount */}
              <div>
                <label htmlFor="offerAmount" style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", marginBottom: "0.25rem", color: "#991B1B", textAlign: "center" }}>
                  {userActivePrice ? 'Update Amount' : 'Amount'}
                </label>
                <input
                  id="offerAmount"
                  type="number"
                  name="offerAmount"
                  value={formData.offerAmount || 10}
                  onChange={handleInputChange}
                  min="0"
                  style={{ 
                    width: "100%",
                    padding: "0.75rem",
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    border: "2px solid #EF4444",
                    borderRadius: "0.375rem",
                    backgroundColor: "white",
                    textAlign: "center"
                  }}
                  required
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={savingInProgress}
              style={{ 
                padding: "0.75rem 2rem",
                backgroundColor: "#4F46E5",
                color: "white",
                borderRadius: "0.375rem",
                fontSize: "1rem",
                fontWeight: "500",
                cursor: savingInProgress ? "not-allowed" : "pointer",
                opacity: savingInProgress ? 0.7 : 1
              }}
            >
              {savingInProgress ? "Saving..." : currentQuote ? "Update Quote" : "Submit Quote"}
            </button>
          </div>
        </div>
      </div>
      
      {/* User's market prices - Moved right after the quote form */}
      {currentUser && (
        <div style={{ 
          backgroundColor: "white", 
          padding: "1.5rem", 
          borderRadius: "0.5rem", 
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)", 
          border: "1px solid #E5E7EB",
          marginBottom: "2.5rem"
        }}>
          <h2 style={{ 
            fontSize: "1.5rem", 
            fontWeight: "600", 
            marginBottom: "1rem", 
            color: "#374151",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}>
            <span>Your Quotes</span>
            {userMarketPrices.some(p => p.status === 'active') && (
              <span style={{
                fontSize: "0.875rem",
                padding: "0.25rem 0.5rem",
                backgroundColor: "#D1FAE5",
                color: "#065F46",
                borderRadius: "9999px",
                fontWeight: "500"
              }}>
                Active
              </span>
            )}
          </h2>
          
          {userMarketPrices.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: "100%", backgroundColor: "white", borderCollapse: "collapse" }}>
                <thead style={{ backgroundColor: "#F9FAFB" }}>
                  <tr>
                    <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Symbol</th>
                    <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bid Price</th>
                    <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bid Amount</th>
                    <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Offer Price</th>
                    <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Offer Amount</th>
                    <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                    <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userMarketPrices.map((price) => (
                    <tr 
                      key={price.id} 
                      style={{ 
                        borderBottom: "1px solid #E5E7EB",
                        backgroundColor: price.id === currentQuote ? "#EFF6FF" : price.status === 'active' ? "#F0FDF4" : "white",
                        cursor: price.status === 'active' ? "pointer" : "default"
                      }}
                      onClick={() => {
                        if (price.status === 'active') {
                          setFormData({
                            symbol: price.symbol,
                            bidPrice: price.bidPrice,
                            bidAmount: price.bidAmount,
                            offerPrice: price.offerPrice,
                            offerAmount: price.offerAmount
                          });
                          setCurrentQuote(price.id || null);
                        }
                      }}
                    >
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", fontWeight: "500", color: "#111827" }}>{price.symbol}</td>
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", fontWeight: "500", color: "#059669" }}>{price.bidPrice.toFixed(0)}</td>
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", color: "#6B7280" }}>{price.bidAmount.toFixed(0)}</td>
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", fontWeight: "500", color: "#DC2626" }}>{price.offerPrice.toFixed(0)}</td>
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", color: "#6B7280" }}>{price.offerAmount.toFixed(0)}</td>
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap" }}>
                        <span style={{ 
                          display: "inline-flex", 
                          padding: "0.125rem 0.5rem", 
                          fontSize: "0.75rem", 
                          fontWeight: "600", 
                          borderRadius: "9999px", 
                          backgroundColor: price.status === 'active' ? "#D1FAE5" : price.status === 'executed' ? "#DBEAFE" : "#F3F4F6", 
                          color: price.status === 'active' ? "#065F46" : price.status === 'executed' ? "#1E40AF" : "#374151"
                        }}>
                          {price.status}
                        </span>
                      </td>
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem" }}>
                        {price.status === 'active' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              price.id && handleCancel(price.id);
                            }}
                            style={{ 
                              backgroundColor: "#DC2626", 
                              color: "white", 
                              padding: "0.25rem 0.75rem", 
                              borderRadius: "0.375rem", 
                              fontSize: "0.875rem", 
                              fontWeight: "500", 
                              cursor: "pointer" 
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ 
              padding: "2.5rem", 
              textAlign: "center", 
              color: "#6B7280",
              backgroundColor: "#F9FAFB",
              borderRadius: "0.5rem",
              border: "2px dashed #E5E7EB"
            }}>
              <p>You haven't submitted any quotes yet</p>
              <p style={{ fontSize: "0.875rem", marginTop: "0.5rem", color: "#9CA3AF" }}>
                Use the form above to submit your first quote
              </p>
            </div>
          )}
        </div>
      )}

      {/* Market prices table - Keep this section */}
      <div style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "0.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "2.5rem", border: "1px solid #E5E7EB" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1.5rem", borderBottom: "1px solid #E5E7EB", paddingBottom: "0.5rem", color: "#374151" }}>Market Prices</h2>
        
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "2.5rem 0" }}>
            <div style={{ 
              width: "2.5rem", 
              height: "2.5rem", 
              borderRadius: "9999px", 
              borderWidth: "2px", 
              borderColor: "#E5E7EB", 
              borderTopColor: "#3B82F6", 
              animation: "spin 1s linear infinite" 
            }}></div>
          </div>
        ) : marketPrices.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: "100%", backgroundColor: "white", borderCollapse: "collapse" }}>
              <thead style={{ backgroundColor: "#F9FAFB" }}>
                <tr>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Symbol</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bid</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Amount</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Action</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Offer</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Amount</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {marketPrices.map((price) => (
                  <tr key={price.id} style={{ 
                    backgroundColor: price.userId === currentUser?.uid ? "#EFF6FF" : "white",
                    borderBottom: "1px solid #E5E7EB"
                  }}>
                    <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", fontWeight: "500", color: "#111827" }}>{price.symbol}</td>
                    <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", fontWeight: "500", color: "#059669" }}>{price.bidPrice.toFixed(0)}</td>
                    <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", color: "#6B7280" }}>{price.bidAmount.toFixed(0)}</td>
                    <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap" }}>
                      {currentUser && price.userId !== currentUser.uid && price.status === 'active' && (
                        <>
                          <input
                            type="number"
                            value={tradeAmount.bid || ''}
                            onChange={(e) => handleTradeAmountChange(e, 'bid')}
                            min="1"
                            step="1"
                            max={price.bidAmount}
                            placeholder="Amount"
                            style={{
                              width: "80px",
                              padding: "0.25rem",
                              marginRight: "0.5rem",
                              border: "1px solid #D1D5DB",
                              borderRadius: "0.25rem",
                              fontSize: "0.875rem"
                            }}
                          />
                          <button
                            onClick={() => {
                              console.log('Hit Bid button clicked:', { price, tradeAmount });
                              // Validate amount first
                              if (!validateTradeAmount(tradeAmount.bid, 'hit')) {
                                return;
                              }
                              
                              if (price.status === 'active') {
                                console.log('Price is active, executing hit trade');
                                executeTrade(price, 'hit');
                              } else {
                                console.log('Price is not active, cannot trade');
                              }
                            }}
                            disabled={!tradeAmount.bid || price.status !== 'active'}
                            style={{ 
                              backgroundColor: "#059669",
                              color: "white",
                              padding: "0.25rem 0.75rem",
                              borderRadius: "0.375rem",
                              fontSize: "0.875rem",
                              fontWeight: "500",
                              opacity: (!tradeAmount.bid || price.status !== 'active') ? 0.5 : 1,
                              cursor: (!tradeAmount.bid || price.status !== 'active') ? "not-allowed" : "pointer"
                            }}
                          >
                            Hit Bid
                          </button>
                        </>
                      )}
                    </td>
                    <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", fontWeight: "500", color: "#DC2626" }}>{price.offerPrice.toFixed(0)}</td>
                    <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", color: "#6B7280" }}>{price.offerAmount.toFixed(0)}</td>
                    <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap" }}>
                      {currentUser && price.userId !== currentUser.uid && price.status === 'active' && (
                        <>
                          <input
                            type="number"
                            value={tradeAmount.offer || ''}
                            onChange={(e) => handleTradeAmountChange(e, 'offer')}
                            min="1"
                            step="1"
                            max={price.offerAmount}
                            placeholder="Amount"
                            style={{
                              width: "80px",
                              padding: "0.25rem",
                              marginRight: "0.5rem",
                              border: "1px solid #D1D5DB",
                              borderRadius: "0.25rem",
                              fontSize: "0.875rem"
                            }}
                          />
                          <button
                            onClick={() => {
                              console.log('Lift Offer button clicked:', { price, tradeAmount });
                              // Validate amount first
                              if (!validateTradeAmount(tradeAmount.offer, 'lift')) {
                                return;
                              }
                              
                              if (price.status === 'active') {
                                console.log('Price is active, executing lift trade');
                                executeTrade(price, 'lift');
                              } else {
                                console.log('Price is not active, cannot trade');
                              }
                            }}
                            disabled={!tradeAmount.offer || price.status !== 'active'}
                            style={{ 
                              backgroundColor: "#DC2626",
                              color: "white",
                              padding: "0.25rem 0.75rem",
                              borderRadius: "0.375rem",
                              fontSize: "0.875rem",
                              fontWeight: "500",
                              opacity: (!tradeAmount.offer || price.status !== 'active') ? 0.5 : 1,
                              cursor: (!tradeAmount.offer || price.status !== 'active') ? "not-allowed" : "pointer"
                            }}
                          >
                            Lift Offer
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "2.5rem 0", textAlign: "center", color: "#6B7280" }}>
            <p>No market prices available</p>
          </div>
        )}
      </div>

      {/* Trading Ledger */}
      <div style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "0.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "2.5rem", border: "1px solid #E5E7EB" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1.5rem", borderBottom: "1px solid #E5E7EB", paddingBottom: "0.5rem", color: "#374151" }}>Trading Ledger</h2>
        
        {trades.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: "100%", backgroundColor: "white", borderCollapse: "collapse" }}>
              <thead style={{ backgroundColor: "#F9FAFB" }}>
                <tr>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Time</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Symbol</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Price</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Amount</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Side</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Role</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => {
                  const isUserBuyer = currentUser && trade.buyerId === currentUser.uid;
                  const isUserSeller = currentUser && trade.sellerId === currentUser.uid;
                  const userRole = isUserBuyer ? 'Buyer' : isUserSeller ? 'Seller' : 'Observer';
                  
                  return (
                    <tr key={trade.id} style={{ 
                      backgroundColor: (isUserBuyer || isUserSeller) ? "#EFF6FF" : "white",
                      borderBottom: "1px solid #E5E7EB"
                    }}>
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", color: "#6B7280" }}>
                        {trade.timestamp?.toDate().toLocaleTimeString() || 'Just now'}
                      </td>
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", fontWeight: "500", color: "#111827" }}>{trade.symbol}</td>
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", fontWeight: "500", color: trade.side === 'hit' ? "#DC2626" : "#059669" }}>{trade.price.toFixed(0)}</td>
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", color: "#6B7280" }}>{trade.amount.toFixed(0)}</td>
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", color: "#6B7280" }}>
                        {trade.side === 'hit' ? 'Hit Offer' : 'Lift Bid'}
                      </td>
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", fontWeight: "500", color: "#111827" }}>
                        {userRole}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "2.5rem 0", textAlign: "center", color: "#6B7280" }}>
            <p>No trades executed yet</p>
          </div>
        )}
      </div>
    </div>
  );
} 