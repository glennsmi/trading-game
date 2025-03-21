import { useState, useEffect } from 'react';
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'symbol' ? value : parseFloat(value) || 0
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('You must be logged in to submit market prices');
      return;
    }

    if (!formData.symbol || formData.bidPrice <= 0 || formData.offerPrice <= 0) {
      setError('Please fill all required fields with valid values');
      return;
    }

    // Validate bid must be less than offer
    if (formData.bidPrice >= formData.offerPrice) {
      setError('Bid price must be less than offer price');
      return;
    }

    try {
      setLoading(true);
      
      const newMarketPrice = {
        ...formData,
        userId: currentUser.uid
      };
      
      await tradingService.saveMarketPrice(newMarketPrice);
      
      // Reset form
      setFormData({
        symbol: '',
        bidPrice: 0,
        bidAmount: 0,
        offerPrice: 0,
        offerAmount: 0
      });
      
      setError('');
    } catch (err) {
      console.error('Error saving market price:', err);
      setError('Failed to save market price');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!id) return;
    
    try {
      setLoading(true);
      await tradingService.cancelMarketPrice(id);
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
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Trading Page</h1>
      
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
      
      {/* Market price submission form */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Submit Market Price</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Symbol</label>
              <input
                type="text"
                name="symbol"
                value={formData.symbol}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            
            <div>
              <label className="block mb-1">Bid Price</label>
              <input
                type="number"
                name="bidPrice"
                value={formData.bidPrice || ''}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                step="0.01"
                min="0"
                required
              />
            </div>
            
            <div>
              <label className="block mb-1">Bid Amount</label>
              <input
                type="number"
                name="bidAmount"
                value={formData.bidAmount || ''}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                step="0.01"
                min="0"
                required
              />
            </div>
            
            <div>
              <label className="block mb-1">Offer Price</label>
              <input
                type="number"
                name="offerPrice"
                value={formData.offerPrice || ''}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                step="0.01"
                min="0"
                required
              />
            </div>
            
            <div>
              <label className="block mb-1">Offer Amount</label>
              <input
                type="number"
                name="offerAmount"
                value={formData.offerAmount || ''}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                step="0.01"
                min="0"
                required
              />
            </div>
          </div>
          
          <button
            type="submit"
            className="mt-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>
      
      {/* Current market prices */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Market Prices</h2>
        
        {loading ? (
          <p>Loading market prices...</p>
        ) : marketPrices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Symbol</th>
                  <th className="py-2 px-4 border-b">Bid Price</th>
                  <th className="py-2 px-4 border-b">Bid Amount</th>
                  <th className="py-2 px-4 border-b">Offer Price</th>
                  <th className="py-2 px-4 border-b">Offer Amount</th>
                </tr>
              </thead>
              <tbody>
                {marketPrices.map((price) => (
                  <tr key={price.id} className={price.userId === currentUser?.uid ? 'bg-blue-50' : ''}>
                    <td className="py-2 px-4 border-b">{price.symbol}</td>
                    <td className="py-2 px-4 border-b">{price.bidPrice.toFixed(2)}</td>
                    <td className="py-2 px-4 border-b">{price.bidAmount.toFixed(2)}</td>
                    <td className="py-2 px-4 border-b">{price.offerPrice.toFixed(2)}</td>
                    <td className="py-2 px-4 border-b">{price.offerAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No market prices available</p>
        )}
      </div>
      
      {/* User's market prices */}
      {currentUser && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Your Market Prices</h2>
          
          {userMarketPrices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border-b">Symbol</th>
                    <th className="py-2 px-4 border-b">Bid Price</th>
                    <th className="py-2 px-4 border-b">Offer Price</th>
                    <th className="py-2 px-4 border-b">Status</th>
                    <th className="py-2 px-4 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userMarketPrices.map((price) => (
                    <tr key={price.id}>
                      <td className="py-2 px-4 border-b">{price.symbol}</td>
                      <td className="py-2 px-4 border-b">{price.bidPrice.toFixed(2)}</td>
                      <td className="py-2 px-4 border-b">{price.offerPrice.toFixed(2)}</td>
                      <td className="py-2 px-4 border-b">{price.status}</td>
                      <td className="py-2 px-4 border-b">
                        {price.status === 'active' && (
                          <button
                            onClick={() => price.id && handleCancel(price.id)}
                            className="bg-red-500 text-white py-1 px-2 rounded hover:bg-red-600"
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
            <p>You haven't submitted any market prices yet</p>
          )}
        </div>
      )}
    </div>
  );
} 