from fastapi import FastAPI
import requests
from datetime import datetime

app = FastAPI()

API_KEY = "4f101f522aed47a99cc7a9738c2fc57d"
BASE_URL = "https://api.sportsdata.io/v3/nba/odds/json"

@app.get("/api/games")
async def get_scheduled_games():
    # Fix the URL to use the correct endpoint
    url = f"{BASE_URL}/BettingEvents/2025REG?key={API_KEY}"
    try:
        response = requests.get(url)
        data = response.json()
        
        # Debug print
        print(f"API Response type: {type(data)}")
        print(f"API Response: {data[:200]}...")  # Print first 200 chars
        
        # Make sure data is a list
        if not isinstance(data, list):
            return {"error": f"Expected list but got {type(data)}", "data": data}
            
        scheduled_games = []
        for game in data:
            if isinstance(game, dict) and game.get("GameStatus") == "Scheduled":
                scheduled_games.append({
                    "betting_event_id": game.get("BettingEventID"),
                    "name": game.get("Name"),
                    "start_time": game.get("StartDate"),
                    "away_team": game.get("AwayTeam"),
                    "home_team": game.get("HomeTeam"),
                    "status": game.get("GameStatus")
                })
        
        return {"games": scheduled_games}
    except Exception as e:
        print(f"Error in get_scheduled_games: {str(e)}")
        return {"error": str(e)}

@app.get("/api/arbitrage/{event_id}")
async def get_arbitrage(event_id: int):
    url = f"{BASE_URL}/BettingMarkets/{event_id}?key={API_KEY}&include=available"
    
    try:
        response = requests.get(url)
        data = response.json()
        
        # Filter for player props and available bets
        player_props = []
        if isinstance(data, list):
            for market in data:
                if (market.get("BettingMarketType") == "Player Prop" and 
                    market.get("AnyBetsAvailable") == True):
                    
                    # Group outcomes by sportsbook
                    sportsbook_outcomes = {}
                    outcome_types = set()  # Track what types of outcomes we have
                    
                    for outcome in market.get("BettingOutcomes", []):
                        if outcome.get("IsAvailable"):
                            sportsbook = outcome.get("SportsBook", {}).get("Name")
                            outcome_type = outcome.get("BettingOutcomeType")
                            
                            if sportsbook not in sportsbook_outcomes:
                                sportsbook_outcomes[sportsbook] = {}
                            
                            outcome_types.add(outcome_type)
                            sportsbook_outcomes[sportsbook][outcome_type] = {
                                "odds": outcome.get("PayoutAmerican"),
                                "value": outcome.get("Value")
                            }
                    
                    # Add relevant market info
                    prop_data = {
                        "market_id": market.get("BettingMarketID"),
                        "player_name": market.get("PlayerName"),
                        "bet_type": market.get("BettingBetType"),
                        "market_type": market.get("BettingMarketType"),
                        "outcome_types": list(outcome_types),  # Include the types of outcomes
                        "sportsbooks": [
                            {
                                "name": sportsbook,
                                "outcomes": outcomes
                            }
                            for sportsbook, outcomes in sportsbook_outcomes.items()
                            if len(outcomes) == len(outcome_types)  # Only include if sportsbook has all outcome types
                        ]
                    }
                    
                    if prop_data["sportsbooks"]:  # Only add if there are available outcomes
                        player_props.append(prop_data)
        
        return {
            "debug_url": url,
            "data": {
                "market_count": len(player_props),
                "markets": player_props
            }
        }
    except Exception as e:
        return {
            "debug_url": url,
            "error": str(e)
        }
