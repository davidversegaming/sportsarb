import React, { useState, useEffect } from 'react';
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
  arbitrage?: ArbitrageInfo;
}

function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [arbitrageData, setArbitrageData] = useState<{ [key: string]: any }>({});
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
          // Fetch arbitrage data for games with opportunities
          data.games.forEach(async (game: Game) => {
            if (game.has_arbitrage) {
              const arbResponse = await fetch(`/api/arbitrage/${game.betting_event_id}`);
              const arbData = await arbResponse.json();
              if (!arbData.error) {
                setArbitrageData(prev => ({
                  ...prev,
                  [game.betting_event_id]: arbData.data
                }));
              }
            }
          });
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
              <div key={game.betting_event_id} className="game-container">
                <div
                  className={`game-card ${game.has_arbitrage ? 'has-arbitrage' : ''}`}
                  onClick={() => handleGameSelect(game.betting_event_id.toString())}
                >
                  <div className="game-header">
                    <h2>{game.name}</h2>
                    <p className="game-time">{formatGameTime(game.start_time)}</p>
                  </div>
                  <div className="game-teams">
                    <p>{game.away_team} @ {game.home_team}</p>
                  </div>
                  {game.has_arbitrage && (
                    <div className="arbitrage-badge">
                      🎯 Arbitrage Available! Best Profit: {game.best_profit}%
                    </div>
                  )}
                </div>
                
                {/* Show arbitrage opportunities below the card */}
                {game.has_arbitrage && arbitrageData[game.betting_event_id] && (
                  <div className="arbitrage-details">
                    {arbitrageData[game.betting_event_id].markets.map((market: any, index: number) => (
                      <div key={index} className="arbitrage-opportunity">
                        <h3>{market.player_name} - {market.bet_type}</h3>
                        <p className="profit">Profit: {market.arbitrage.profit_percentage}%</p>
                        <div className="optimal-bets">
                          {Object.entries(market.arbitrage.optimal_stakes).map(([bet, info]: [string, any]) => (
                            <div key={bet} className="bet-info">
                              <p className="bet-name">
                                {bet}
                                <span className="odds">
                                  {info.odds > 0 ? '+' : ''}{info.odds}
                                </span>
                              </p>
                              <div className="bet-details">
                                <span>Stake: ${info.stake}</span>
                                <span>Win: ${info.win}</span>
                                <span>Profit: ${info.profit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="markets-view">
            <button className="back-button" onClick={() => setSelectedEventId(null)}>
              ← Back to Games
            </button>
            <h2>All Markets</h2>
            {apiData?.markets.map((market: PlayerProp) => (
              <div key={market.market_id} className="market-card">
                <h3>{market.player_name} - {market.bet_type}</h3>
                {market.arbitrage && (
                  <div className="arbitrage-alert">
                    🎯 Arbitrage Opportunity! Profit: {market.arbitrage.profit_percentage}%
                  </div>
                )}
                <div className="sportsbooks">
                  {market.sportsbooks.map((book, index) => (
                    <div key={index} className="sportsbook">
                      <h4>{book.name}</h4>
                      {Object.entries(book.outcomes).map(([type, data]) => (
                        <div key={type} className="outcome">
                          <span>{type}:</span>
                          <span className="odds">{data.odds > 0 ? '+' : ''}{data.odds}</span>
                          <span className="value">{data.value}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;