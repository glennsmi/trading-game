import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { tradingService } from '../services/tradingService';
import { MarketPrice, MarketPriceFormData } from '../types/trading';

export default function Trading() {
  const { currentUser } = useAuth();
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [userMarketPrices, setUserMarketPrices] = useState<MarketPrice[]>([]);
  const [formData, setFormData] = useState<MarketPriceFormData>({
    symbol: '',
    bidPrice: 0,
    bidAmount: 0,
    offerPrice: 0,
    offerAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<string | null>(null);

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

  // Debounced save function
  const debouncedSave = useCallback(
    async (data: MarketPriceFormData) => {
      console.log('Starting debouncedSave with data:', data);
      
      if (!currentUser) {
        console.error('No currentUser found, cannot save');
        setError('You must be logged in to submit market prices');
        return;
      }

      if (!data.symbol || data.bidPrice <= 0 || data.offerPrice <= 0) {
        console.log('Incomplete data, skipping save:', data);
        // Don't show error during data entry, just don't save yet
        return;
      }

      // Validate bid must be less than offer
      if (data.bidPrice >= data.offerPrice) {
        console.warn('Invalid price relationship: bid must be < offer', data);
        setError('Bid price must be less than offer price');
        return;
      }

      try {
        setSavingInProgress(true);
        console.log('Starting save to Firestore...');
        
        const quoteData = {
          ...data,
          userId: currentUser.uid
        };
        
        console.log('Quote data to save:', quoteData);
        console.log('Current quote ID:', currentQuote);
        
        // If we already have a quote ID, update it rather than creating a new one
        if (currentQuote) {
          console.log('Updating existing quote with ID:', currentQuote);
          await tradingService.updateMarketPrice(currentQuote, {
            ...quoteData,
            status: 'active',  // Required by the MarketPrice type
            timestamp: null    // Will be set by serverTimestamp() in the service
          });
          console.log('Update successful');
        } else {
          console.log('Creating new quote...');
          const newQuoteId = await tradingService.saveMarketPrice({
            ...quoteData,
            status: 'active',  // Required by the MarketPrice type 
            timestamp: null    // Will be set by serverTimestamp() in the service
          });
          console.log('New quote created with ID:', newQuoteId);
          setCurrentQuote(newQuoteId);
        }
        
        setError('');
        console.log('Save operation completed successfully');
      } catch (err) {
        console.error('Detailed error saving market price:', err);
        setError('Failed to save market price');
      } finally {
        setSavingInProgress(false);
      }
    },
    [currentUser, currentQuote]
  );

  // Use effect to trigger save when form data changes
  useEffect(() => {
    // Skip empty or initial state
    if (!formData.symbol || (formData.bidPrice === 0 && formData.offerPrice === 0)) {
      return;
    }
    
    const timeoutId = setTimeout(() => {
      debouncedSave(formData);
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [formData, debouncedSave]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'symbol' ? value : parseInt(value) || 0
    });
  };

  const handleNewQuote = () => {
    // Clear the form to start a new quote
    setFormData({
      symbol: '',
      bidPrice: 0,
      bidAmount: 0,
      offerPrice: 0,
      offerAmount: 0
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

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Trading Dashboard</h1>
      
      {error && (
        <div style={{ backgroundColor: "#FEE2E2", borderLeft: "4px solid #EF4444", color: "#B91C1C", padding: "1rem", marginBottom: "1.5rem", borderRadius: "0.375rem" }}>
          <p>{error}</p>
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
              value={formData.symbol}
              onChange={handleInputChange}
              style={{ 
                width: "33%", 
                padding: "0.75rem", 
                fontSize: "1.25rem", 
                fontWeight: "bold", 
                border: "2px solid #D1D5DB", 
                borderRadius: "0.375rem", 
                textTransform: "uppercase" 
              }}
              placeholder="e.g. BTC/USD"
              required
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
              
              {/* Bid Price */}
              <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="bidPrice" style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", marginBottom: "0.25rem", textAlign: "center", color: "#374151" }}>
                  Price
                </label>
                <input
                  id="bidPrice"
                  type="number"
                  name="bidPrice"
                  value={formData.bidPrice || ''}
                  onChange={handleInputChange}
                  style={{ 
                    width: "100%", 
                    padding: "0.5rem", 
                    fontSize: "3rem", 
                    fontWeight: "bold", 
                    color: "#047857", 
                    border: "none", 
                    backgroundColor: "transparent", 
                    textAlign: "center" 
                  }}
                  min="0"
                  placeholder="0"
                  required
                />
              </div>
              
              {/* Bid Amount */}
              <div>
                <label htmlFor="bidAmount" style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", marginBottom: "0.25rem", textAlign: "center", color: "#374151" }}>
                  Amount
                </label>
                <input
                  id="bidAmount"
                  type="number"
                  name="bidAmount"
                  value={formData.bidAmount || ''}
                  onChange={handleInputChange}
                  style={{ 
                    width: "100%", 
                    padding: "0.5rem", 
                    fontSize: "1rem", 
                    border: "2px solid #6EE7B7", 
                    borderRadius: "0.375rem", 
                    backgroundColor: "white", 
                    textAlign: "center" 
                  }}
                  min="0"
                  placeholder="0"
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
              
              {/* Offer Price */}
              <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="offerPrice" style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", marginBottom: "0.25rem", textAlign: "center", color: "#374151" }}>
                  Price
                </label>
                <input
                  id="offerPrice"
                  type="number"
                  name="offerPrice"
                  value={formData.offerPrice || ''}
                  onChange={handleInputChange}
                  style={{ 
                    width: "100%", 
                    padding: "0.5rem", 
                    fontSize: "3rem", 
                    fontWeight: "bold", 
                    color: "#B91C1C", 
                    border: "none", 
                    backgroundColor: "transparent", 
                    textAlign: "center" 
                  }}
                  min="0"
                  placeholder="0"
                  required
                />
              </div>
              
              {/* Offer Amount */}
              <div>
                <label htmlFor="offerAmount" style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", marginBottom: "0.25rem", textAlign: "center", color: "#374151" }}>
                  Amount
                </label>
                <input
                  id="offerAmount"
                  type="number"
                  name="offerAmount"
                  value={formData.offerAmount || ''}
                  onChange={handleInputChange}
                  style={{ 
                    width: "100%", 
                    padding: "0.5rem", 
                    fontSize: "1rem", 
                    border: "2px solid #FECACA", 
                    borderRadius: "0.375rem", 
                    backgroundColor: "white", 
                    textAlign: "center" 
                  }}
                  min="0"
                  placeholder="0"
                  required
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Current market prices */}
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
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bid Price</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bid Amount</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Offer Price</th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Offer Amount</th>
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
                    <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", fontWeight: "500", color: "#DC2626" }}>{price.offerPrice.toFixed(0)}</td>
                    <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", color: "#6B7280" }}>{price.offerAmount.toFixed(0)}</td>
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
      
      {/* User's market prices */}
      {currentUser && (
        <div style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "0.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #E5E7EB" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1.5rem", borderBottom: "1px solid #E5E7EB", paddingBottom: "0.5rem", color: "#374151" }}>Your Quotes</h2>
          
          {userMarketPrices.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: "100%", backgroundColor: "white", borderCollapse: "collapse" }}>
                <thead style={{ backgroundColor: "#F9FAFB" }}>
                  <tr>
                    <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Symbol</th>
                    <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bid Price</th>
                    <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "500", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Offer Price</th>
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
                        backgroundColor: price.id === currentQuote ? "#EFF6FF" : "white",
                        cursor: "pointer"
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
                      <td style={{ padding: "1rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", fontWeight: "500", color: "#DC2626" }}>{price.offerPrice.toFixed(0)}</td>
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
            <div style={{ padding: "2.5rem 0", textAlign: "center", color: "#6B7280" }}>
              <p>You haven't submitted any quotes yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 