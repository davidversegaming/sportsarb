import React, { useState, useEffect } from 'react';
import './App.css';

interface Game {
  betting_event_id: number;
  game_time: string;
  away_team: string;
  home_team: string;
}

function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [url, setUrl] = useState('');
  const [apiData, setApiData] = useState<any>(null);
  const [error, setError] = useState('');

  // Fetch games when component mounts
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch('/api/games');
        const data = await response.json();
        if (data.error) {
          setError(data.error);
        } else {
          setGames(data.games || []);
        }
      } catch (err) {
        setError('Failed to fetch games');
      }
    };

    fetchGames();
  }, []);

  const handleGameSelect = async (eventId: string) => {
    if (!eventId) return;
    setSelectedEventId(eventId);
    
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
        <select 
          value={selectedEventId}
          onChange={(e) => handleGameSelect(e.target.value)}
        >
          <option value="">Select a game</option>
          {games.map((game) => (
            <option key={game.betting_event_id} value={game.betting_event_id}>
              {game.away_team} @ {game.home_team} - {new Date(game.game_time).toLocaleString()}
            </option>
          ))}
        </select>
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
