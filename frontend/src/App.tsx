import React, { useState } from 'react';
import './App.css';

function App() {
  const [eventId, setEventId] = useState('');
  const [url, setUrl] = useState('');
  const [apiData, setApiData] = useState<any>(null);
  const [error, setError] = useState('');

  const handleClick = async () => {
    if (!eventId) return;
    try {
      const response = await fetch(`/api/arbitrage/${eventId}`);
      const data = await response.json();
      setUrl(data.debug_url);
      if (data.error) {
        setError(data.error);
        setApiData(null);
      } else {
        setError('');
        setApiData(data.data);
      }
    } catch (err) {
      setError('Failed to fetch data');
      setApiData(null);
    }
  };

  return (
    <div className="App">
      <h1>Sports API URL Generator</h1>
      <div>
        <input
          type="number"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          placeholder="Enter Event ID"
        />
        <button onClick={handleClick}>
          Show API URL and Data
        </button>
      </div>
      {url && (
        <div className="url-display">
          <p>API URL:</p>
          <p>{url}</p>
        </div>
      )}
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      {apiData && (
        <div className="data-display">
          <h2>API Response Data:</h2>
          <p>Number of Markets: {apiData.market_count}</p>
          {apiData.first_market && (
            <div>
              <h3>First Market Details:</h3>
              <pre>{JSON.stringify(apiData.first_market, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
