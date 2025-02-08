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
  arbitrage: ArbitrageInfo | null;
}

function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [apiData, setApiData] = useState<any>(null);
  const [error, setError] = useState('');
  const [totalStakes, setTotalStakes] = useState<{ [key: string]: number }>({});

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

  const handleStakeChange = (marketId: number, newStake: number) => {
    setTotalStakes(prev => ({
      ...prev,
      [marketId]: newStake
    }));
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
                {apiData.markets
                  .filter((market: PlayerProp) => market.arbitrage)
                  .map((market: PlayerProp) => (
                    <div key={market.market_id} className="prop-card">
                      <h3>{market.player_name} - {market.bet_type}</h3>
                      <div className="arbitrage-alert">
                        <h4>🎯 Arbitrage Opportunity!</h4>
                        <p>Profit: {market.arbitrage!.profit_percentage}%</p>
                        <div className="stake-controls">
                          <input
                            type="number"
                            value={totalStakes[market.market_id] || 20}
                            onChange={(e) => handleStakeChange(market.market_id, parseFloat(e.target.value))}
                            min="0"
                            step="1"
                          />
                          <span className="guaranteed-profit">
                            Guaranteed Profit: ${(Object.values(market.arbitrage!.optimal_stakes)[0].profit * 
                              ((totalStakes[market.market_id] || 20) / 20)).toFixed(2)}
                          </span>
                        </div>
                        <div className="stakes">
                          {Object.entries(market.arbitrage!.optimal_stakes).map(([bet, info]: [string, any]) => {
                            const stakeRatio = info.stake / 20;
                            const newStake = stakeRatio * (totalStakes[market.market_id] || 20);
                            const winRatio = info.win / 20;
                            const newWin = winRatio * (totalStakes[market.market_id] || 20);
                            const profitRatio = info.profit / 20;
                            const newProfit = profitRatio * (totalStakes[market.market_id] || 20);
                            
                            return (
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
                                    {market.sportsbooks[0].outcomes[bet].odds > 0 ? '+' : ''}{market.sportsbooks[0].outcomes[bet].odds}
                                  </p>
                                </div>
                                <div className="stake-details">
                                  <span>Stake: ${newStake.toFixed(2)}</span>
                                  <span>Win: ${newWin.toFixed(2)}</span>
                                  <span>Profit: ${newProfit.toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="sportsbooks">
                        {market.sportsbooks.map((book, index) => (
                          <div key={index} className="sportsbook-card">
                            <h4>{book.name}</h4>
                            <div className="lines">
                              {market.outcome_types.map(type => (
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