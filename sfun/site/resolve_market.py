import time
from web3 import Web3
import json
from datetime import datetime

RPC_URL = "https://rpc.soniclabs.com"
PRIVATE_KEY = "0x09afdeb0e3b4792fb99a9caae9d249c44bbb77404e2580df5176815210720a9f"
MARKET_ADDRESS = "0x8610A6BF0C9829865596f658CD64e94A65b636Ff"

MAX_MARKET_ID = 50  # adjust as needed

# Load ABI
with open("site/contractABI.json") as f:
    abi = json.load(f)["marketAbi"]

# Connect
w3 = Web3(Web3.HTTPProvider(RPC_URL))
acct = w3.eth.account.from_key(PRIVATE_KEY)
address = acct.address

contract = w3.eth.contract(address=MARKET_ADDRESS, abi=abi)

def ts(t):
    return datetime.utcfromtimestamp(t).strftime("%Y-%m-%d %H:%M:%S")

def resolve_market(market_id):
    try:
        tx = contract.functions.resolveMarket(market_id).build_transaction({
            "from": address,
            "nonce": w3.eth.get_transaction_count(address),
            "gas": 300000,
            "gasPrice": w3.eth.gas_price
        })

        signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        if receipt.status == 1:
            return ("SUCCESS", tx_hash.hex())
        else:
            return ("REVERTED", tx_hash.hex())

    except Exception as e:
        return ("ERROR", str(e))

import threading
import itertools
import sys
import time

def start_spinner(message="Analyzing"):
    done = False

    def animate():
        for c in itertools.cycle(['|', '/', '-', '\\']):
            if done:
                break
            sys.stdout.write(f'\r{message} {c}')
            sys.stdout.flush()
            time.sleep(0.1)
        sys.stdout.write('\r')

    t = threading.Thread(target=animate)
    t.start()
    return lambda: setattr(sys.modules[__name__], 'done', True)
def analyze_and_execute():
    now_ts = int(time.time())
    report = {
        "timestamp": ts(now_ts),
        "checked": 0,
        "nonexistent": 0,
        "active": 0,
        "not_ready": 0,
        "already_resolved": 0,
        "resolved_now": [],
        "errors": []
    }

    for market_id in range(MAX_MARKET_ID):
        try:
            m = contract.functions.markets(market_id).call()
            report["checked"] += 1

            startPrice, endPrice, startTime, endTime, upPool, downPool, resolved, feeTaken = m

            if startTime == 0:
                report["nonexistent"] += 1
                continue

            if resolved:
                report["already_resolved"] += 1
                continue

            if now_ts < endTime:
                report["not_ready"] += 1
                continue

            # Market needs resolution
            status, info = resolve_market(market_id)

            if status == "SUCCESS":
                report["resolved_now"].append({
                    "market": market_id,
                    "tx": info
                })
            else:
                report["errors"].append({
                    "market": market_id,
                    "error": info
                })

        except Exception as e:
            report["errors"].append({
                "market": market_id,
                "error": str(e)
            })

    return report

def print_report(r):
    print("\n====================================================")
    print("        MARKET ANALYSIS & EXECUTION REPORT")
    print("====================================================")
    print(f"Timestamp: {r['timestamp']}")
    print("----------------------------------------------------")
    print(f"Markets scanned:        {r['checked']}")
    print(f"Non-existent markets:   {r['nonexistent']}")
    print(f"Already resolved:       {r['already_resolved']}")
    print(f"Not ready to resolve:   {r['not_ready']}")
    print("----------------------------------------------------")

    if r["resolved_now"]:
        print("Resolved this cycle:")
        for item in r["resolved_now"]:
            print(f"  • Market {item['market']} → TX {item['tx']}")
    else:
        print("Resolved this cycle:    None")

    if r["errors"]:
        print("\nErrors:")
        for item in r["errors"]:
            print(f"  • Market {item['market']} → {item['error']}")
    else:
        print("\nErrors:                 None")

    print("====================================================\n")

print("=== Sonic Market Resolver Bot Started ===")
print(f"Connected: {w3.is_connected()}")
print(f"Wallet: {address}\n")






while True:
    report = analyze_and_execute()
    stop = start_spinner("Analyzing markets")
    report = analyze_and_execute()
    stop()
    print_report(report)

    print_report(report)
    time.sleep(60)

