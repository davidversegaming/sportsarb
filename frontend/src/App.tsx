import React, { useState, useEffect } from 'react';
import './App.css';

interface Game {
  betting_event_id: number;
  name: string;
  start_time: string;
  away_team: string;
  home_team: string;
  status: string;
}

interface BettingOutcome {
  sportsbook: string;
  odds: number;
  value: number;
}

interface PlayerProp {
  market_id: number;
  player_name: string;
  bet_type: string;
  market_type: string;
  outcomes: BettingOutcome[];
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

  const formatGameTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
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
              {game.name} - {formatGameTime(game.start_time)}
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
          <h2>Player Props ({apiData.market_count})</h2>
          {apiData.markets.map((prop: PlayerProp, index: number) => (
            <div key={prop.market_id} className="prop-card">
              <h3>{prop.player_name} - {prop.bet_type}</h3>
              <div className="outcomes">
                {prop.outcomes.map((outcome: BettingOutcome, oIndex: number) => (
                  <div key={oIndex} className="outcome">
                    <p>{outcome.sportsbook}</p>
                    <p>Value: {outcome.value}</p>
                    <p>Odds: {outcome.odds}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
