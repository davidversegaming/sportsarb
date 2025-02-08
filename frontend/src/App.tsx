import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

interface Game {
  betting_event_id: number;
  name: string;
  start_time: string;
  away_team: string;
  home_team: string;
  status: string;
  has_arbitrage: boolean;
  best_profit: number;
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

interface StakeInfo {
  stake: number;
  win: number;
  profit: number;
  odds: number;
  url?: string;  // Add optional URL
}

interface ArbitrageInfo {
  profit_percentage: number;
  optimal_stakes: {
    [key: string]: StakeInfo;
  };
  guaranteed_profit: number;
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
  const [socket, setSocket] = useState<WebSocket | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('WebSocket Connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'arbitrage_update') {
        // Update games list with new arbitrage data
        setGames(prevGames => {
          return prevGames.map(game => {
            if (game.betting_event_id === data.game.betting_event_id) {
              return {
                ...game,
                has_arbitrage: data.opportunities.market_count > 0,
                best_profit: Math.max(...data.opportunities.markets
                  .map((m: any) => m.arbitrage?.profit_percentage || 0))
              };
            }
            return game;
          });
        });

        // If this game is currently selected, update its arbitrage data
        if (selectedEventId === data.game.betting_event_id.toString()) {
          setApiData(data.opportunities);
        }
      }
    };

    ws.onclose = () => {
      console.log('WebSocket Disconnected');
      // Try to reconnect in 5 seconds
      setTimeout(() => {
        setSocket(null);
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      setError('Lost connection to server');
    };

    setSocket(ws);

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, [selectedEventId]);

  // Initial games fetch
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
            {!socket && (
              <button onClick={() => setSocket(null)} className="retry-button">
                Retry Connection
              </button>
            )}
          </div>
        )}
        
        {!selectedEventId ? (
          <div className="games-grid">
            {games.map((game) => (
              <div
                key={game.betting_event_id}
                className={`game-card ${game.has_arbitrage ? 'has-arbitrage' : ''}`}
                onClick={() => handleGameSelect(game.betting_event_id.toString())}
              >
                {game.has_arbitrage && (
                  <div className="arbitrage-badge">
                    🎯 {game.best_profit}% Profit
                  </div>
                )}
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
                          <h5>Optimal Stakes ($20 total) - Guaranteed Profit: ${prop.arbitrage.guaranteed_profit}</h5>
                          {Object.entries(prop.arbitrage.optimal_stakes).map(([bet, info]) => (
                            <div key={bet} className="stake-info">
                              <div className="stake-header">
                                <p className="stake-bet">
                                  {info.url ? (
                                    <a 
                                      href={info.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {bet} 🔗
                                    </a>
                                  ) : (
                                    bet
                                  )}
                                </p>
                                <p className="stake-odds">
                                  {info.odds > 0 ? '+' : ''}{info.odds}
                                </p>
                              </div>
                              <div className="stake-details">
                                <span>Stake: ${info.stake}</span>
                                <span>Win: ${info.win}</span>
                                <span>Profit: ${info.profit}</span>
                              </div>
                            </div>
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
