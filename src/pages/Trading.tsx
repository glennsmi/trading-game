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
      [name]: name === 'symbol' ? value : parseInt(value) || 0
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
    <div className="container mx-auto p-6 max-w-5xl">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Trading Dashboard</h1>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md shadow-sm">
          <p>{error}</p>
        </div>
      )}
      
      {/* Market price submission form */}
      <div className="bg-white p-8 rounded-lg shadow-md mb-10 border border-gray-200">
        <h2 className="text-2xl font-semibold mb-6 text-gray-700 border-b pb-2">Submit Market Price</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Symbol Input */}
          <div className="mb-6">
            <label htmlFor="symbol" className="block text-lg font-medium text-gray-700 mb-2">
              Symbol
            </label>
            <input
              id="symbol"
              type="text"
              name="symbol"
              value={formData.symbol}
              onChange={handleInputChange}
              className="w-full sm:w-1/2 md:w-1/3 p-3 text-xl font-bold border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
              placeholder="e.g. BTC/USD"
              required
            />
          </div>
          
          {/* Trading Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* BID SECTION */}
            <div className="border-2 border-green-500 rounded-lg shadow-md p-4 bg-green-50">
              <h3 className="text-xl font-bold text-green-800 mb-4 text-center">Bid (Buy)</h3>
              
              {/* Bid Price */}
              <div className="mb-6">
                <label htmlFor="bidPrice" className="block text-md font-medium text-gray-700 mb-2 text-center">
                  Price
                </label>
                <input
                  id="bidPrice"
                  type="number"
                  name="bidPrice"
                  value={formData.bidPrice || ''}
                  onChange={handleInputChange}
                  className="w-full p-2 text-6xl font-bold text-green-700 border-0 bg-transparent text-center focus:outline-none focus:ring-0"
                  min="0"
                  placeholder="0"
                  required
                />
              </div>
              
              {/* Bid Amount */}
              <div>
                <label htmlFor="bidAmount" className="block text-md font-medium text-gray-700 mb-2 text-center">
                  Amount
                </label>
                <input
                  id="bidAmount"
                  type="number"
                  name="bidAmount"
                  value={formData.bidAmount || ''}
                  onChange={handleInputChange}
                  className="w-full p-2 text-lg border-2 border-green-300 rounded-md bg-white text-center focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  min="0"
                  placeholder="0"
                  required
                />
              </div>
            </div>
            
            {/* OFFER SECTION */}
            <div className="border-2 border-red-500 rounded-lg shadow-md p-4 bg-red-50">
              <h3 className="text-xl font-bold text-red-800 mb-4 text-center">Offer (Sell)</h3>
              
              {/* Offer Price */}
              <div className="mb-6">
                <label htmlFor="offerPrice" className="block text-md font-medium text-gray-700 mb-2 text-center">
                  Price
                </label>
                <input
                  id="offerPrice"
                  type="number"
                  name="offerPrice"
                  value={formData.offerPrice || ''}
                  onChange={handleInputChange}
                  className="w-full p-2 text-6xl font-bold text-red-700 border-0 bg-transparent text-center focus:outline-none focus:ring-0"
                  min="0"
                  placeholder="0"
                  required
                />
              </div>
              
              {/* Offer Amount */}
              <div>
                <label htmlFor="offerAmount" className="block text-md font-medium text-gray-700 mb-2 text-center">
                  Amount
                </label>
                <input
                  id="offerAmount"
                  type="number"
                  name="offerAmount"
                  value={formData.offerAmount || ''}
                  onChange={handleInputChange}
                  className="w-full p-2 text-lg border-2 border-red-300 rounded-md bg-white text-center focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  min="0"
                  placeholder="0"
                  required
                />
              </div>
            </div>
          </div>
          
          {/* Submit Button */}
          <div className="pt-6 flex justify-center">
            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-4 text-lg font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Quote'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Current market prices */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-10 border border-gray-200">
        <h2 className="text-2xl font-semibold mb-6 text-gray-700 border-b pb-2">Market Prices</h2>
        
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
          </div>
        ) : marketPrices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bid Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bid Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offer Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offer Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {marketPrices.map((price) => (
                  <tr key={price.id} className={price.userId === currentUser?.uid ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{price.symbol}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-700">{price.bidPrice.toFixed(0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{price.bidAmount.toFixed(0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-700">{price.offerPrice.toFixed(0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{price.offerAmount.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center text-gray-500">
            <p>No market prices available</p>
          </div>
        )}
      </div>
      
      {/* User's market prices */}
      {currentUser && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700 border-b pb-2">Your Quotes</h2>
          
          {userMarketPrices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bid Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offer Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {userMarketPrices.map((price) => (
                    <tr key={price.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{price.symbol}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-700">{price.bidPrice.toFixed(0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-700">{price.offerPrice.toFixed(0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${price.status === 'active' ? 'bg-green-100 text-green-800' : 
                            price.status === 'executed' ? 'bg-blue-100 text-blue-800' : 
                            'bg-gray-100 text-gray-800'}`}>
                          {price.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {price.status === 'active' && (
                          <button
                            onClick={() => price.id && handleCancel(price.id)}
                            className="text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
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
            <div className="py-10 text-center text-gray-500">
              <p>You haven't submitted any quotes yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 