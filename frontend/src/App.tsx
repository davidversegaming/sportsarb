import React, { useState } from 'react';
import './App.css';

function App() {
  const [eventId, setEventId] = useState('');
  const [url, setUrl] = useState('');

  const handleClick = async () => {
    if (!eventId) return;
    const response = await fetch(`/api/arbitrage/${eventId}`);
    const data = await response.json();
    setUrl(data.debug_url);
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
          Show API URL
        </button>
      </div>
      {url && (
        <div className="url-display">
          <p>API URL:</p>
          <p>{url}</p>
        </div>
      )}
    </div>
  );
}

export default App;
