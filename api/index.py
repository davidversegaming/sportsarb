from fastapi import FastAPI
import requests

app = FastAPI()

API_KEY = "4f101f522aed47a99cc7a9738c2fc57d"
BASE_URL = "https://api.sportsdata.io/v3/nba/odds/json"

@app.get("/api/games")
async def get_scheduled_games():
    # Fetch scheduled games
    url = f"{BASE_URL}/BettingEventsByDate/2024?key={API_KEY}"
    try:
        response = requests.get(url)
        data = response.json()
        
        # Filter for scheduled games and format them
        scheduled_games = [
            {
                "betting_event_id": game["BettingEventID"],
                "game_time": game["DateTime"],
                "away_team": game["AwayTeam"],
                "home_team": game["HomeTeam"]
            }
            for game in data
            if game["GameStatus"] == "Scheduled"
        ]
        
        return {"games": scheduled_games}
    except Exception as e:
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
