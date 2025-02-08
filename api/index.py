from fastapi import FastAPI
import requests
from datetime import datetime
from typing import Dict, List

app = FastAPI()

API_KEY = "4f101f522aed47a99cc7a9738c2fc57d"
BASE_URL = "https://api.sportsdata.io/v3/nba/odds/json"

def calculate_arbitrage(outcomes: Dict[str, Dict[str, float]]) -> tuple[float, dict]:
    """
    Calculate if there's an arbitrage opportunity between different sportsbooks
    Returns: (profit_percentage, optimal_stakes)
    """
    # Convert American odds to decimal
    decimal_odds = {}
    for book, lines in outcomes.items():
        decimal_odds[book] = {}
        for bet_type, odds in lines.items():
            if odds > 0:
                decimal_odds[book][bet_type] = 1 + (odds / 100)
            else:
                decimal_odds[book][bet_type] = 1 + (100 / abs(odds))
    
    # Calculate implied probabilities
    total_probability = 0
    best_odds = {}
    
    # Find best odds for each outcome type
    for book, lines in decimal_odds.items():
        for bet_type, odds in lines.items():
            if bet_type not in best_odds or odds > best_odds[bet_type][1]:
                best_odds[bet_type] = (book, odds)
    
    # Calculate total probability using best odds
    for bet_type, (book, odds) in best_odds.items():
        total_probability += 1 / odds
    
    # If total probability < 1, there's an arbitrage opportunity
    if total_probability < 1:
        profit_percentage = (1 - total_probability) * 100
        
        # Calculate optimal stakes for a total stake of 1000
        total_stake = 1000
        stakes = {}
        for bet_type, (book, odds) in best_odds.items():
            stake = (total_stake / odds) / total_probability
            stakes[f"{book} {bet_type}"] = round(stake, 2)
        
        return profit_percentage, stakes
    
    return 0, {}

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
        
        player_props = []
        if isinstance(data, list):
            for market in data:
                if (market.get("BettingMarketType") == "Player Prop" and 
                    market.get("AnyBetsAvailable") == True):
                    
                    # Group outcomes by sportsbook
                    sportsbook_outcomes = {}
                    outcome_types = set()
                    
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
                    
                    # Check for arbitrage opportunities
                    odds_for_arbitrage = {
                        book: {
                            outcome_type: outcomes[outcome_type]["odds"]
                            for outcome_type in outcomes
                        }
                        for book, outcomes in sportsbook_outcomes.items()
                        if len(outcomes) == len(outcome_types)
                    }
                    
                    profit_percentage, optimal_stakes = calculate_arbitrage(odds_for_arbitrage)
                    
                    prop_data = {
                        "market_id": market.get("BettingMarketID"),
                        "player_name": market.get("PlayerName"),
                        "bet_type": market.get("BettingBetType"),
                        "market_type": market.get("BettingMarketType"),
                        "outcome_types": list(outcome_types),
                        "sportsbooks": [
                            {
                                "name": sportsbook,
                                "outcomes": outcomes
                            }
                            for sportsbook, outcomes in sportsbook_outcomes.items()
                            if len(outcomes) == len(outcome_types)
                        ],
                        "arbitrage": {
                            "profit_percentage": round(profit_percentage, 2),
                            "optimal_stakes": optimal_stakes
                        } if profit_percentage > 0 else None
                    }
                    
                    if prop_data["sportsbooks"]:
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
