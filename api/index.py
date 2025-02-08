from fastapi import FastAPI
import requests

app = FastAPI()

@app.get("/api/arbitrage/{event_id}")
async def get_arbitrage(event_id: int):
    base_url = "https://api.sportsdata.io/v3/nba/odds/json/BettingMarkets"
    api_key = "4f101f522aed47a99cc7a9738c2fc57d"
    
    url = f"{base_url}/{event_id}?key={api_key}&include=available"
    
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
