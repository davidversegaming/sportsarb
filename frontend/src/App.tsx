import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css'; // or use CSS Modules: import styles from './App.module.css';

// --- Interfaces and Types ---

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
  outcomes: Record<string, BettingLine>;  // Use Record for type safety
}

interface StakeInfo {
  stake: number;
  win: number;
  profit: number;
  odds: number;
  url?: string; // Optional URL
}

interface ArbitrageInfo {
    profit_percentage: number;
    optimal_stakes: Record<string, StakeInfo>;
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


// --- Helper Functions ---

const formatGameTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
};

// --- Components ---

interface GameCardProps {
  game: Game;
  teamLogos: Record<string, string>; // Pass team logos down
  onSelect: (eventId: number) => void;
}

const GameCard: React.FC<GameCardProps> = React.memo(({ game, teamLogos, onSelect }) => {
  return (
    <div
      className={`game-card ${game.has_arbitrage ? 'has-arbitrage' : ''}`}
      data-profit={game.best_profit >= 1 ? 'high' : 'low'}
      onClick={() => onSelect(game.betting_event_id)}
    >
      {game.has_arbitrage && (
        <div className={`arbitrage-badge ${game.best_profit >= 1 ? 'arbitrage-badge-high' : 'arbitrage-badge-low'}`}>
          🎯 {game.best_profit}%
        </div>
      )}

      <div className="game-time">
        {formatGameTime(game.start_time)}
      </div>

      <div className="teams">
        <TeamDisplay teamKey={game.away_team} teamLogos={teamLogos} />
        <div className="vs">@</div>
        <TeamDisplay teamKey={game.home_team} teamLogos={teamLogos} />
      </div>
    </div>
  );
});

interface TeamDisplayProps {
    teamKey: string;
    teamLogos: Record<string, string>;
}
const TeamDisplay: React.FC<TeamDisplayProps> = React.memo(({teamKey, teamLogos}) => {
    return (
    <div className="team">
        {teamLogos[teamKey] && (
            <img
            src={teamLogos[teamKey]}
            alt={teamKey}
            className="team-logo"
            />
        )}
        <span>{teamKey}</span>
    </div>
    )
});

interface PropCardProps {
    market: PlayerProp;
    totalStakes: Record<number, number>; //Use Number
    onStakeChange: (marketId: number, newStake: number) => void;
}

const PropCard: React.FC<PropCardProps> = React.memo(({ market, totalStakes, onStakeChange }) => {
    //Memoize stake calculation
    const calculatedStakes = useMemo(() => {
        if (!market.arbitrage) {
          return [];
        }
        const baseStake = totalStakes[market.market_id] || 20;

        return (Object.entries(market.arbitrage.optimal_stakes) as [string, StakeInfo][]).map(([bet, info]) => {
            const stakeRatio = info.stake / 20;
            const newStake = stakeRatio * baseStake;
            const winRatio = info.win / 20;
            const newWin = winRatio * baseStake;
            const profitRatio = info.profit / 20;
            const newProfit = profitRatio * baseStake;

            const [bookName, ...betParts] = bet.split(' ');
            const betType = betParts.join(' ');
            const sportsbook = market.sportsbooks.find(book => book.name === bookName);
            const odds = sportsbook?.outcomes[betType]?.odds;

            const betDisplay = odds !== undefined
            ? `${bet} ${odds > 0 ? `(+${odds})` : `(${odds})`}`
            : bet;

              return {
                bet,
                betDisplay,
                newStake,
                newWin,
                newProfit,
                url: info.url,
              };
            });
    }, [market.arbitrage, totalStakes, market.market_id, market.sportsbooks]);


  return (
    <div className="prop-card">
      <h3>{market.player_name} - {market.bet_type}</h3>
      <div className="arbitrage-alert">
        <h4>🎯 Arbitrage Opportunity!</h4>
        <p>Profit: {market.arbitrage!.profit_percentage}%</p>
        <div className="stake-controls">
          <input
            type="number"
            value={totalStakes[market.market_id] || 20}
            onChange={(e) => onStakeChange(market.market_id, parseFloat(e.target.value))}
            min="0"
            step="1"
          />
          <span className="guaranteed-profit">
             Guaranteed Profit: ${((Object.values(market.arbitrage!.optimal_stakes) as StakeInfo[])[0].profit *
                              (totalStakes[market.market_id] || 20) / 20).toFixed(2)}
          </span>
        </div>
        <div className="stakes">
          {/*Using calculated stakes*/}
          {calculatedStakes.map(({bet, betDisplay, newStake, newWin, newProfit, url}) => (
            <div key={bet} className="stake-info">
              <div className="stake-header">
                <p className="stake-bet">
                    {url ? (
                        <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        >
                        {betDisplay} 🔗
                        </a>
                    ) : (
                        betDisplay
                    )}
                </p>
              </div>
              <div className="stake-details">
                <span>Stake: ${newStake.toFixed(2)}</span>
                <span>Win: ${newWin.toFixed(2)}</span>
                <span>Profit: ${newProfit.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <SportsbooksDisplay market={market} />
    </div>
  );
});

interface SportsbooksDisplayProps {
    market: PlayerProp
}
const SportsbooksDisplay: React.FC<SportsbooksDisplayProps> = React.memo(({market}) => {
    return(
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
    )
});

interface MarketsViewProps {
  apiData: { market_count: number; markets: PlayerProp[] } | null;
  onBack: () => void;
  totalStakes: Record<number, number>;
  onStakeChange: (marketId: number, newStake: number) => void;
}

const MarketsView: React.FC<MarketsViewProps> = ({ apiData, onBack, totalStakes, onStakeChange }) => {
  return (
    <div className="markets-view">
      <button className="back-button" onClick={onBack}>
        ← Back to Games
      </button>

      {apiData && (
        <div className="data-display">
          <h2>Player Props ({apiData.market_count})</h2>
          {apiData.markets
            .filter((market) => market.arbitrage)
            .map((market) => (
              <PropCard
                key={market.market_id}
                market={market}
                totalStakes={totalStakes}
                onStakeChange={onStakeChange}
              />
            ))}
        </div>
      )}
    </div>
  );
};



// --- Main App Component ---

const App: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null); // Use Number
  const [apiData, setApiData] = useState<{ market_count: number; markets: PlayerProp[] } | null>(null);
  const [error, setError] = useState('');
  const [totalStakes, setTotalStakes] = useState<Record<number, number>>({}); // number, not string
  const [isLoading, setIsLoading] = useState(false);
  const [teamLogos, setTeamLogos] = useState<Record<string, string>>({}); // Better name

    // Use useCallback to memoize fetch functions, preventing unnecessary re-creation
    const fetchGames = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/games');
            if (!response.ok) {  // Better error handling
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.error) {
                setError(data.error);
                setGames([]); // Clear games on error
            } else {
                setGames(data.games || []);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch games'); // Display specific error
        } finally {
            setIsLoading(false);
        }
    }, []); // No dependencies, only runs on mount

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);


    const fetchTeamLogos = useCallback(async () => {

        try{
            const response = await fetch('https://api.sportsdata.io/v3/nba/scores/json/AllTeams?key=4f101f522aed47a99cc7a9738c2fc57d')
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const logoMap = data.reduce((acc: Record<string, string>, team: any) => {
              acc[team.Key] = team.WikipediaLogoUrl;
              return acc;
            }, {});

            setTeamLogos(logoMap);

        } catch (error: any) {
            console.error('Error fetching team data:', error);
            setError(error.message || "Failed to fetch team logos")
        }
    }, []);

  useEffect(() => {
      fetchTeamLogos();
  }, [fetchTeamLogos]); // useCallback dependency

  const handleGameSelect = useCallback(async (eventId: number) => { // number not string
        if (!eventId) return;
        setSelectedEventId(eventId);
        setIsLoading(true);

        try {
          const response = await fetch(`/api/arbitrage/${eventId}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          if (data.error) {
            setError(data.error);
            setApiData(null);
          } else {
            setError('');
            setApiData(data.data);
          }
        } catch (err:any) {
          setError(err.message || 'Failed to fetch arbitrage data'); // Consistent error handling
          setApiData(null);
        } finally {
          setIsLoading(false);
        }
    }, []); // No dependencies that change frequently

  const handleStakeChange = useCallback((marketId: number, newStake: number) => {
    setTotalStakes((prev) => ({
      ...prev,
      [marketId]: newStake,
    }));
  }, []); // Corrected useCallback

  return (
    <div className="App">
      <header className="app-header">
        <h1>NBA Arbitrage Finder</h1>
        <p>Select a game to view available betting markets</p>
      </header>

      <main>
        {error && <div className="error-message">{error}</div>}

        {isLoading ? (
          <div className="loading-spinner">Loading...</div>
        ) : !selectedEventId ? (
          <div className="games-grid">
            {games.map((game) => (
                <GameCard
                 key={game.betting_event_id}
                 game={game}
                 teamLogos={teamLogos}
                 onSelect={handleGameSelect}
                />
            ))}
          </div>
        ) : (
          <MarketsView
            apiData={apiData}
            onBack={() => setSelectedEventId(null)}
            totalStakes={totalStakes}
            onStakeChange={handleStakeChange}
          />
        )}
      </main>
    </div>
  );
};

export default App;

