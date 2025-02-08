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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [apiData, setApiData] = useState<any>(null);
  const [error, setError] = useState('');

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
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getTeamInitials = (teamName: string) => {
    return teamName.split(' ').map(word => word[0]).join('');
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>NBA Arbitrage Finder</h1>
        <p>Select a game to view available betting markets</p>
      </header>

      <main>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {!selectedEventId ? (
          <div className="games-grid">
            {games.map((game) => (
              <div
                key={game.betting_event_id}
                className="game-card"
                onClick={() => handleGameSelect(game.betting_event_id.toString())}
              >
                <div className="game-time">
                  {formatGameTime(game.start_time)}
                </div>
                <div className="teams">
                  <div className="team away">
                    <div className="team-circle">
                      {getTeamInitials(game.away_team)}
                    </div>
                    <span>{game.away_team}</span>
                  </div>
                  <div className="vs">@</div>
                  <div className="team home">
                    <div className="team-circle">
                      {getTeamInitials(game.home_team)}
                    </div>
                    <span>{game.home_team}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="markets-view">
            <button 
              className="back-button"
              onClick={() => setSelectedEventId(null)}
            >
              ← Back to Games
            </button>
            
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
                          <h5>Optimal Stakes ($20 total):</h5>
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
        )}
      </main>
    </div>
  );
}

export default App;
