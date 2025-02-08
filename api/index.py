from fastapi import FastAPI
import requests

app = FastAPI()

@app.get("/api/arbitrage/{event_id}")
async def get_arbitrage(event_id: int):
    base_url = "https://api.sportsdata.io/v3/nba/odds/json/BettingMarkets"
    api_key = "4f101f522aed47a99cc7a9738c2fc57d"
    
    # Just return the constructed URL
    url = f"{base_url}/{event_id}?key={api_key}&include=available"
    return {"debug_url": url}
