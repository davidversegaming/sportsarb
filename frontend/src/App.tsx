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
  const [isLoading, setIsLoading] = useState(false);
  const [teamData, setTeamData] = useState<{[key: string]: string}>({});
  const [showOnlyArbitrage, setShowOnlyArbitrage] = useState(true);

  useEffect(() => {
    const fetchGames = async () => {
      setIsLoading(true);
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
      } finally {
        setIsLoading(false);
      }
    };

    fetchGames();
  }, []);

  useEffect(() => {
    // Fetch team data when component mounts
    fetch('https://api.sportsdata.io/v3/nba/scores/json/AllTeams?key=4f101f522aed47a99cc7a9738c2fc57d')
      .then(response => response.json())
      .then(data => {
        const logoMap = data.reduce((acc: {[key: string]: string}, team: any) => {
          acc[team.Key] = team.WikipediaLogoUrl;
          return acc;
        }, {});
        setTeamData(logoMap);
      })
      .catch(error => console.error('Error fetching team data:', error));
  }, []);

  const handleGameSelect = async (eventId: string) => {
    if (!eventId) return;
    setSelectedEventId(eventId);
    setIsLoading(true);
    
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
    } finally {
      setIsLoading(false);
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
        
        {isLoading ? (
          <div className="loading-spinner">
            Loading...
          </div>
        ) : !selectedEventId ? (
          <div className="games-grid">
            {games.map((game) => (
              <div
                key={game.betting_event_id}
                className={`game-card ${game.has_arbitrage ? 'has-arbitrage' : ''}`}
                onClick={() => handleGameSelect(game.betting_event_id.toString())}
              >
                {game.has_arbitrage && (
                  <div className={`arbitrage-badge ${game.best_profit >= 1 ? 'arbitrage-badge-high' : 'arbitrage-badge-low'}`}>
                    🎯 {game.best_profit}% Profit
                  </div>
                )}
                <div className="game-time">
                  {formatGameTime(game.start_time)}
                </div>
                <div className="teams">
                  <div className="team away">
                    {teamData[game.away_team] && (
                      <img 
                        src={teamData[game.away_team]} 
                        alt={game.away_team} 
                        className="team-logo"
                      />
                    )}
                    <span>{game.away_team}</span>
                  </div>
                  <div className="vs">@</div>
                  <div className="team home">
                    {teamData[game.home_team] && (
                      <img 
                        src={teamData[game.home_team]} 
                        alt={game.home_team} 
                        className="team-logo"
                      />
                    )}
                    <span>{game.home_team}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="markets-view">
            <div className="view-controls">
              <button 
                className="back-button"
                onClick={() => setSelectedEventId(null)}
              >
                ← Back to Games
              </button>
              <button
                className={`filter-button ${showOnlyArbitrage ? 'active' : ''}`}
                onClick={() => setShowOnlyArbitrage(!showOnlyArbitrage)}
              >
                {showOnlyArbitrage ? '🎯 Showing Arbitrage Only' : '👀 Showing All Props'}
              </button>
            </div>
            
            {apiData && (
              <div className="data-display">
                <h2>Player Props ({apiData.market_count})</h2>
                {apiData.markets
                  .filter((market: PlayerProp) => !showOnlyArbitrage || market.arbitrage)
                  .map((market: PlayerProp) => (
                    <div 
                      key={market.market_id} 
                      className={`market-card ${market.arbitrage ? 'has-arbitrage' : ''}`}
                    >
                      <div className="market-header">
                        <h3>{market.player_name} - {market.bet_type}</h3>
                        {market.arbitrage && (
                          <div className="profit-badge">
                            {market.arbitrage.profit_percentage.toFixed(2)}% Profit
                          </div>
                        )}
                      </div>
                      
                      {/* Only show stakes section if arbitrage exists */}
                      {market.arbitrage && (
                        <div className="stakes">
                          {Object.entries(market.arbitrage.optimal_stakes).map(([bet, info]: [string, any]) => {
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
                                    {info.odds > 0 ? '+' : ''}{info.odds}
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
                      )}
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