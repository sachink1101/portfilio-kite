import logging
import time
import os
import json
import sys
from urllib.parse import urlparse, parse_qs
from kiteconnect import KiteConnect
import requests
import pyotp
from flask import Flask, jsonify, send_from_directory

# Setup logging
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Load credentials
CREDENTIALS_FILE = "credentials.json"
TOKEN_FILE = "token.txt"

# Prefer environment variables on Render; fallback to local credentials.json
credentials = {}
env_keys = [
    "CLIENT_ID",
    "PASSWORD",
    "AUTH_SECRET",
    "API_KEY",
    "API_SECRET",
]
if all(os.getenv(k) for k in env_keys):
    credentials = {k: os.getenv(k) for k in env_keys}
else:
    with open(CREDENTIALS_FILE, "r") as f:
        credentials = json.load(f)

user_id = credentials["CLIENT_ID"]
password = credentials["PASSWORD"]
totp_secret = credentials["AUTH_SECRET"]
api_key = credentials["API_KEY"]
api_secret = credentials["API_SECRET"]

kite = KiteConnect(api_key=api_key)
access_token = None

# Flask app
app = Flask(__name__, static_folder="static", template_folder="templates")


def read_token_file():
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            return f.read().strip()
    return None


def write_token_file(token):
    with open(TOKEN_FILE, "w") as f:
        f.write(token)


def setup_authentication():
    """Perform fresh login + 2FA + generate new access token."""
    global access_token

    try:
        session = requests.Session()

        # Step 1: Login with user ID & password
        resp = session.post(
            "https://kite.zerodha.com/api/login",
            data={"user_id": user_id, "password": password},
        )
        resp.raise_for_status()
        request_id = resp.json().get("data", {}).get("request_id")
        if not request_id:
            raise Exception("Login failed: request_id missing")

        # Step 2: Submit TOTP
        otp = pyotp.TOTP(totp_secret).now()
        resp2 = session.post(
            "https://kite.zerodha.com/api/twofa",
            data={"user_id": user_id, "request_id": request_id, "twofa_value": otp},
        )
        resp2.raise_for_status()

        # Step 3: Get request_token via redirect
        resp3 = session.get(
            f"https://kite.trade/connect/login?api_key={api_key}", allow_redirects=True
        )
        parsed = urlparse(resp3.url)
        query_params = parse_qs(parsed.query)
        request_token = query_params.get("request_token", [None])[0]

        if not request_token and resp3.history:
            last = resp3.history[-1]
            location = last.headers.get("Location", "")
            request_token = parse_qs(urlparse(location).query).get(
                "request_token", [None]
            )[0]

        if not request_token:
            raise Exception("Failed to obtain request_token")

        # Step 4: Generate access token
        data = kite.generate_session(request_token, api_secret=api_secret)
        access_token = data["access_token"]
        kite.set_access_token(access_token)

        # Save to file
        write_token_file(access_token)

        logger.info("New access token generated and saved.")
        profile = kite.profile()
        logger.info("Logged in as %s", profile["user_name"])

        return True

    except Exception as e:
        logger.error("Authentication failed: %s", e)
        return False


def authenticate():
    """Check saved token, else login fresh."""
    global access_token
    token = read_token_file()
    if token:
        try:
            kite.set_access_token(token)
            kite.profile()  # test
            access_token = token
            logger.info("Reused saved access token.")
            return True
        except Exception:
            logger.warning("Saved token invalid, logging in fresh...")

    return setup_authentication()


def get_positions_data():
    try:
        positions = kite.positions()
        net_positions = positions.get("net", [])
        data = []
        for pos in net_positions:
            data.append({
                "tradingsymbol": pos.get("tradingsymbol"),
                "quantity": pos.get("quantity"),
                "pnl": pos.get("pnl"),
                "average_price": pos.get("average_price"),
                "last_price": pos.get("last_price"),
            })
        return data
    except Exception as e:
        logger.error("Error fetching positions: %s", e)
        return []


@app.route("/api/positions")
def api_positions():
    # Ensure we're authenticated; try reuse then fresh if needed
    if not access_token:
        if not authenticate():
            return jsonify({"error": "authentication_failed"}), 401
    else:
        try:
            kite.profile()
        except Exception:
            if not setup_authentication():
                return jsonify({"error": "authentication_failed"}), 401
    positions = get_positions_data()
    total_pl = sum((p.get("pnl") or 0) for p in positions)
    return jsonify({
        "positions": positions,
        "total_pnl": total_pl
    })


@app.route("/")
def index():
    # Serve built frontend from /static (Vite build). Fallback to legacy static/index.html
    index_path = os.path.join(app.static_folder, "index.html")
    if os.path.exists(index_path):
        return send_from_directory(app.static_folder, "index.html")
    return send_from_directory(app.static_folder, "index.html")


def main():
    # Optional eager auth on local run
    authenticate()
    logger.info("Starting web server...")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))


if __name__ == "__main__":
    main()
