import React, { useState } from 'react';
import './App.css';

function App() {
  const [eventId, setEventId] = useState('');
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const findOpportunities = async () => {
    if (!eventId) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/arbitrage/${eventId}`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      setOpportunities(data.opportunities || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch opportunities');
      setOpportunities([]);
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
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      {opportunities.length > 0 ? (
        <div>
          <h2>Found Opportunities:</h2>
          {opportunities.map((opp, index) => (
            <div key={index}>
              <h3>{opp.market_type}</h3>
              <p>Profit: {opp.profit_percentage.toFixed(2)}%</p>
            </div>
          ))}
        </div>
      ) : (
        !error && opportunities && <div><h2>No arbitrage opportunities found</h2></div>
      )}
    </div>
  );
}

export default App;
