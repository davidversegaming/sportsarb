import React, { useState } from 'react';
import './App.css';

function App() {
  const [eventId, setEventId] = useState('');
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(false);

  const findOpportunities = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/arbitrage/${eventId}`);
      const data = await response.json();
      setOpportunities(data.opportunities);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="App">
      <h1>Sports Arbitrage Finder</h1>
      <div>
        <input
          type="number"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          placeholder="Enter Event ID"
        />
        <button onClick={findOpportunities} disabled={loading}>
          {loading ? 'Searching...' : 'Find Opportunities'}
        </button>
      </div>
    </div>
  );
}

export default App;
