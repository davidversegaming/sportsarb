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

interface BettingLine {
  odds: number;
  value: number | null;
}

interface Sportsbook {
  name: string;
  outcomes: {
    [key: string]: BettingLine;  // Dynamic outcome types
  };
}

interface ArbitrageInfo {
  profit_percentage: number;
  optimal_stakes: {
    [key: string]: number;
  };
}

interface PlayerProp {
  market_id: number;
  player_name: string;
  bet_type: string;
  market_type: string;
  outcome_types: string[];
  sportsbooks: Sportsbook[];
  arbitrage: ArbitrageInfo | null;
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
          {apiData.markets.map((prop: PlayerProp) => (
            <div key={prop.market_id} className="prop-card">
              <h3>{prop.player_name} - {prop.bet_type}</h3>
              {prop.arbitrage && (
                <div className="arbitrage-alert">
                  <h4>🎯 Arbitrage Opportunity!</h4>
                  <p>Profit: {prop.arbitrage.profit_percentage}%</p>
                  <div className="stakes">
                    <h5>Optimal Stakes ($1000 total):</h5>
                    {Object.entries(prop.arbitrage.optimal_stakes).map(([bet, stake]) => (
                      <p key={bet}>{bet}: ${stake}</p>
                    ))}
                  </div>
                </div>
              )}
              <div className="sportsbooks">
                {prop.sportsbooks.map((book, index) => (
                  <div key={index} className="sportsbook-card">
                    <h4>{book.name}</h4>
                    <div className="lines">
                      {prop.outcome_types.map(type => (
                        <div key={type} className="line">
                          <p>
                            {type} {book.outcomes[type].value !== null && 
                              `${book.outcomes[type].value}`}
                          </p>
                          <p>
                            {book.outcomes[type].odds > 0 ? '+' : ''}
                            {book.outcomes[type].odds}
                          </p>
                        </div>
                      ))}
                    </div>
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
