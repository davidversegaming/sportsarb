import requests
import json
from typing import Dict, List
from dataclasses import dataclass
from datetime import datetime
import time

@dataclass
class BettingOutcome:
    sportsbook: str
    odds: float
    value: float  # For over/under, spread values

@dataclass
class ArbitrageOpportunity:
    market_id: int
    market_type: str
    outcomes: List[BettingOutcome]
    profit_percentage: float
    required_stakes: Dict[str, float]

class ArbitrageFinder:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.sportsdata.io/v3/nba/odds/json/BettingMarkets"

    def fetch_betting_markets(self, event_id: int) -> dict:
        url = f"{self.base_url}/{event_id}"
        params = {
            "key": self.api_key,
            "include": "available"
        }
        
        # Print the full URL for debugging
        full_url = f"{url}?key={self.api_key}&include=available"
        print(f"Attempting to fetch data from: {full_url}")
        
        try:
            response = requests.get(url, params=params)
            print(f"Response status code: {response.status_code}")
            print(f"Response content: {response.text[:200]}...")  # Print first 200 chars of response
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error making request: {str(e)}")
            raise

    def calculate_arbitrage(self, outcomes: List[BettingOutcome]) -> tuple[float, Dict[str, float]]:
        """
        Calculate if there's an arbitrage opportunity and return profit % and stakes
        """
        # Convert decimal odds to probabilities
        total_probability = sum(1/outcome.odds for outcome in outcomes)
        
        # If total probability is less than 1, arbitrage exists
        if total_probability < 1:
            profit_percentage = (1 - total_probability) * 100
            
            # Calculate optimal stakes for a total stake of 1000
            total_stake = 1000
            stakes = {
                outcome.sportsbook: (total_stake / outcome.odds) / total_probability 
                for outcome in outcomes
            }
            
            return profit_percentage, stakes
            
        return 0, {}

    def find_arbitrage_opportunities(self, event_id: int) -> List[ArbitrageOpportunity]:
        markets = self.fetch_betting_markets(event_id)
        opportunities = []
        
        print(f"\nAnalyzing {len(markets)} markets...")

        for market in markets:
            # Log market info
            print(f"\nChecking market {market.get('BettingMarketID')}:")
            print(f"Market Type: {market.get('BettingMarketType')}")
            print(f"Bet Type: {market.get('BettingBetType')}")
            print(f"Player: {market.get('PlayerName')}")
            print(f"Bets Available: {market.get('AnyBetsAvailable')}")
            
            # Add filter for Player Props
            if market.get("BettingMarketType") != "Player Prop" or not market.get("AnyBetsAvailable"):
                print("Skipping: Not a player prop or no bets available")
                continue

            # Group outcomes by market type and add safety checks
            outcomes = []
            print("\nBetting Outcomes:")
            for outcome in market.get("BettingOutcomes", []):
                print(f"Sportsbook: {outcome.get('SportsBook', {}).get('Name', 'N/A')}")
                print(f"Odds: {outcome.get('PayoutDecimal', 'N/A')}")
                print(f"Value: {outcome.get('Value', 'N/A')}")
                print(f"Type: {outcome.get('BettingOutcomeType', 'N/A')}")
                
                if outcome.get("SportsBook") and outcome.get("PayoutDecimal"):
                    outcomes.append(
                        BettingOutcome(
                            sportsbook=outcome["SportsBook"]["Name"],
                            odds=outcome["PayoutDecimal"],
                            value=outcome.get("Value")
                        )
                    )

            if len(outcomes) < 2:
                print(f"Skipping: Only found {len(outcomes)} valid outcomes (need at least 2)")
                continue

            profit_percentage, stakes = self.calculate_arbitrage(outcomes)
            print(f"Calculated profit percentage: {profit_percentage}%")
            
            if profit_percentage > 0:
                print("Found arbitrage opportunity!")
                opportunities.append(ArbitrageOpportunity(
                    market_id=market["BettingMarketID"],
                    market_type=market["BettingMarketType"],
                    outcomes=outcomes,
                    profit_percentage=profit_percentage,
                    required_stakes=stakes
                ))

        print(f"\nFound {len(opportunities)} total arbitrage opportunities")
        return opportunities

def main():
    api_key = "4f101f522aed47a99cc7a9738c2fc57d"
    
    # Get event ID from user input
    try:
        event_id = int(input("Enter the event ID: "))
    except ValueError:
        print("Please enter a valid number for the event ID")
        return
    
    finder = ArbitrageFinder(api_key)
    opportunities = finder.find_arbitrage_opportunities(event_id)
    
    if opportunities:
        print(f"Found {len(opportunities)} arbitrage opportunities!")
        for opp in opportunities:
            print(f"\nMarket: {opp.market_type}")
            print(f"Profit: {opp.profit_percentage:.2f}%")
            print("Required stakes:")
            for sportsbook, stake in opp.required_stakes.items():
                print(f"  {sportsbook}: ${stake:.2f}")
    else:
        print("No arbitrage opportunities found.")

if __name__ == "__main__":
    main()
