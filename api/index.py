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
    
    # Fetch data from the API
    try:
        response = requests.get(url)
        data = response.json()
        
        # Return both the URL and some basic data
        return {
            "debug_url": url,
            "data": {
                "market_count": len(data) if isinstance(data, list) else 0,
                "first_market": data[0] if isinstance(data, list) and len(data) > 0 else None
            }
        }
    except Exception as e:
        return {
            "debug_url": url,
            "error": str(e)
        }
