import { useState, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';
import { useAuth } from '../context/AuthContext';

interface Item {
  id?: string;
  name: string;
  description: string;
  ownerId?: string;
}

export default function FirebaseDemo() {
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState<Item>({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();

  // Fetch items on component mount
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await firebaseService.getAll('items') as Item[];
      setItems(data);
      setError('');
    } catch (err) {
      setError('Failed to fetch items');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !currentUser) return;
    
    try {
      setLoading(true);
      const itemWithOwner = {
        ...newItem,
        ownerId: currentUser.uid,
        createdAt: new Date()
      };
      const created = await firebaseService.create('items', itemWithOwner);
      setItems([...items, created]);
      setNewItem({ name: '', description: '' });
      setError('');
    } catch (err) {
      setError('Failed to create item');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, ownerId?: string) => {
    // Check if user is owner of the item
    if (!currentUser || (ownerId && ownerId !== currentUser.uid)) {
      setError('You can only delete your own items');
      return;
    }
    
    try {
      setLoading(true);
      await firebaseService.delete('items', id);
      setItems(items.filter(item => item.id !== id));
      setError('');
    } catch (err) {
      setError('Failed to delete item');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="firebase-demo">
      <h2>Firebase Demo</h2>
      
      {error && <p className="error">{error}</p>}
      
      {currentUser ? (
        <form onSubmit={handleSubmit}>
          <div>
            <input
              type="text"
              placeholder="Item name"
              value={newItem.name}
              onChange={(e) => setNewItem({...newItem, name: e.target.value})}
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Item description"
              value={newItem.description}
              onChange={(e) => setNewItem({...newItem, description: e.target.value})}
            />
          </div>
          <button type="submit" disabled={loading}>Add Item</button>
        </form>
      ) : (
        <p>Please sign in to add items</p>
      )}
      
      <div className="items-list">
        <h3>Items:</h3>
        {loading && <p>Loading...</p>}
        {items.length === 0 && !loading ? (
          <p>No items yet. Add some above!</p>
        ) : (
          <ul>
            {items.map(item => (
              <li key={item.id}>
                <strong>{item.name}</strong>: {item.description}
                {currentUser && (item.ownerId === currentUser.uid || !item.ownerId) && (
                  <button onClick={() => item.id && handleDelete(item.id, item.ownerId)}>
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 