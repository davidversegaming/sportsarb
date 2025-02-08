from fastapi import FastAPI, WebSocket
from fastapi.websockets import WebSocketDisconnect
import requests
from datetime import datetime, timedelta
from typing import Dict, List
import asyncio
import json

app = FastAPI()

API_KEY = "4f101f522aed47a99cc7a9738c2fc57d"
BASE_URL = "https://api.sportsdata.io/v3/nba/odds/json"

# Manage WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        # Send message to all connected clients
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                # Remove dead connections
                await self.disconnect(connection)

manager = ConnectionManager()

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle any incoming messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)

# Background task to check for arbitrage opportunities
@app.on_event("startup")
async def start_arbitrage_monitoring():
    asyncio.create_task(monitor_arbitrage_opportunities())

async def monitor_arbitrage_opportunities():
    while True:
        try:
            # Get current games (using existing function)
            response = await get_scheduled_games()
            games = response.get("games", [])
            
            for game in games:
                # Check each game for arbitrage opportunities
                event_id = game["betting_event_id"]
                arbitrage_data = await get_arbitrage(event_id)
                
                # If arbitrage opportunities exist, broadcast to all clients
                if arbitrage_data.get("data", {}).get("market_count", 0) > 0:
                    await manager.broadcast({
                        "type": "arbitrage_update",
                        "game": game,
                        "opportunities": arbitrage_data["data"]
                    })
            
            # Wait 30 seconds before checking again
            await asyncio.sleep(30)
            
        except Exception as e:
            print(f"Error in arbitrage monitoring: {e}")
            await asyncio.sleep(5)  # Wait before retry

def calculate_arbitrage(outcomes: Dict[str, Dict[str, dict]], market_data: dict) -> tuple[float, dict, float]:
    """
    Calculate if there's an arbitrage opportunity between different sportsbooks
    Returns: (profit_percentage, optimal_stakes, guaranteed_profit)
    """
    # First, group outcomes by their value
    outcomes_by_value = {}
    for book, lines in outcomes.items():
        for bet_type, data in lines.items():
            value = data["value"]
            odds = data["odds"]
            
            if value not in outcomes_by_value:
                outcomes_by_value[value] = {}
            if book not in outcomes_by_value[value]:
                outcomes_by_value[value][book] = {}
            
            outcomes_by_value[value][book][bet_type] = odds
    
    # Check each value group for arbitrage
    best_arbitrage = (0, {}, 0)
    
    for value, books_odds in outcomes_by_value.items():
        # Convert American odds to decimal
        decimal_odds = {}
        for book, lines in books_odds.items():
            decimal_odds[book] = {}
            for bet_type, odds in lines.items():
                if odds > 0:
                    decimal_odds[book][bet_type] = 1 + (odds / 100)
                else:
                    decimal_odds[book][bet_type] = 1 + (100 / abs(odds))
        
        # Find best odds for each outcome type
        best_odds = {}
        for book, lines in decimal_odds.items():
            for bet_type, odds in lines.items():
                if bet_type not in best_odds or odds > best_odds[bet_type][1]:
                    best_odds[bet_type] = (book, odds)
        
        # Calculate total probability using best odds
        total_probability = sum(1 / odds for _, odds in best_odds.values())
        
        # If total probability < 1, there's an arbitrage opportunity
        if total_probability < 1:
            profit_percentage = (1 - total_probability) * 100
            
            # Calculate optimal stakes for a total stake of $20
            total_stake = 20
            guaranteed_profit = round(total_stake * (1 - total_probability), 2)
            
            stakes = {}
            for bet_type, (book, odds) in best_odds.items():
                stake = (total_stake / odds) / total_probability
                potential_win = stake * odds
                
                # Find original American odds and URL for this book/bet combination
                original_odds = None
                url = None
                for b, lines in books_odds.items():
                    if b == book and bet_type in lines:
                        original_odds = lines[bet_type]
                        # Get URL from original outcome data
                        for outcome in market_data.get("BettingOutcomes", []):
                            if (outcome.get("SportsBook", {}).get("Name") == book and 
                                outcome.get("BettingOutcomeType") == bet_type):
                                url = outcome.get("SportsbookUrl")
                                break
                        break
                
                stakes[f"{book} {bet_type} ({value})"] = {
                    "stake": round(stake, 2),
                    "win": round(potential_win, 2),
                    "profit": guaranteed_profit,
                    "odds": original_odds,
                    "url": url
                }
            
            # Keep the best arbitrage opportunity
            if profit_percentage > best_arbitrage[0]:
                best_arbitrage = (profit_percentage, stakes, guaranteed_profit)
    
    return best_arbitrage

@app.get("/api/games")
async def get_scheduled_games():
    url = f"{BASE_URL}/BettingEvents/2025REG?key={API_KEY}"
    try:
        response = requests.get(url)
        data = response.json()
        
        if not isinstance(data, list):
            return {"error": f"Expected list but got {type(data)}", "data": data}
        
        # Get current time and 48 hours from now
        now = datetime.utcnow()
        cutoff = now + timedelta(hours=48)
            
        scheduled_games = []
        for game in data:
            if isinstance(game, dict) and game.get("GameStatus") == "Scheduled":
                # Parse game start time
                start_time = datetime.fromisoformat(game.get("GameStartTime").replace('Z', '+00:00'))
                
                # Only include games in next 48 hours
                if now <= start_time <= cutoff:
                    # Get arbitrage opportunities for this game
                    markets_url = f"{BASE_URL}/BettingMarkets/{game.get('BettingEventID')}?key={API_KEY}&include=available"
                    markets_response = requests.get(markets_url)
                    markets_data = markets_response.json()
                    
                    has_arbitrage = False
                    best_profit = 0
                    
                    if isinstance(markets_data, list):
                        for market in markets_data:
                            if (market.get("BettingMarketType") == "Player Prop" and 
                                market.get("AnyBetsAvailable") == True):
                                
                                # Group outcomes by sportsbook
                                sportsbook_outcomes = {}
                                for outcome in market.get("BettingOutcomes", []):
                                    if (outcome.get("IsAvailable") and 
                                        outcome.get("BettingOutcomeType") in ["Over", "Under"]):
                                        sportsbook = outcome.get("SportsBook", {}).get("Name")
                                        outcome_type = outcome.get("BettingOutcomeType")
                                        
                                        if sportsbook not in sportsbook_outcomes:
                                            sportsbook_outcomes[sportsbook] = {}
                                        
                                        sportsbook_outcomes[sportsbook][outcome_type] = {
                                            "odds": outcome.get("PayoutAmerican"),
                                            "value": outcome.get("Value")
                                        }
                                
                                # Check for arbitrage opportunities
                                odds_for_arbitrage = {
                                    book: outcomes
                                    for book, outcomes in sportsbook_outcomes.items()
                                    if len(outcomes) == 2  # Must have both Over and Under
                                }
                                
                                profit_percentage, _, _ = calculate_arbitrage(odds_for_arbitrage, market)
                                if profit_percentage > best_profit:
                                    best_profit = profit_percentage
                                    has_arbitrage = True
                    
                    scheduled_games.append({
                        "betting_event_id": game.get("BettingEventID"),
                        "name": game.get("Name"),
                        "start_time": game.get("StartDate"),
                        "away_team": game.get("AwayTeam"),
                        "home_team": game.get("HomeTeam"),
                        "status": game.get("GameStatus"),
                        "has_arbitrage": has_arbitrage,
                        "best_profit": round(best_profit, 2) if has_arbitrage else 0
                    })
        
        # Sort by start time
        scheduled_games.sort(key=lambda x: x["start_time"])
        
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
                        if (outcome.get("IsAvailable") and 
                            outcome.get("BettingOutcomeType") in ["Over", "Under"]):
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
                        book: outcomes
                        for book, outcomes in sportsbook_outcomes.items()
                        if len(outcomes) == 2  # Must have both Over and Under
                    }
                    
                    profit_percentage, optimal_stakes, guaranteed_profit = calculate_arbitrage(odds_for_arbitrage, market)
                    
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
                            if len(outcomes) == 2  # Must have both Over and Under
                        ],
                        "arbitrage": {
                            "profit_percentage": round(profit_percentage, 2),
                            "optimal_stakes": optimal_stakes,
                            "guaranteed_profit": guaranteed_profit
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
