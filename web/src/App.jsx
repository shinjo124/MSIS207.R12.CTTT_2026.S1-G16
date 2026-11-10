import { useEffect, useState } from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function App() {
  const [health, setHealth] = useState('Checking API…');
  const [destinations, setDestinations] = useState([]);
  const [category, setCategory] = useState('');
  const [destinationStatus, setDestinationStatus] = useState('loading');
  const [destinationError, setDestinationError] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/health`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.database || 'API unavailable');
        setHealth('API and database connected');
      })
      .catch(() => setHealth('API unavailable — start the API and MySQL'));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    setDestinationStatus('loading');
    setDestinationError('');

    fetch(`${apiBaseUrl}/api/destinations${query}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || 'Could not load destinations.');
        return result.data || [];
      })
      .then((data) => {
        setDestinations(data);
        if (!category) setCategories([...new Set(data.map((place) => place.category))].sort());
        setDestinationStatus(data.length ? 'ready' : 'empty');
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setDestinationError(error.message || 'Could not load destinations.');
        setDestinationStatus('error');
      });

    return () => controller.abort();
  }, [category]);

  return <main><h1>Tripo</h1><p role="status">{health}</p></main>;
}
