// -------------------------------
// Contract Addresses
// -------------------------------
const MARKET_ADDRESS = "0x8610A6BF0C9829865596f658CD64e94A65b636Ff";
const ORACLE_ADDRESS = "0x681eD408f1D31F5F37A16271d9862B5ED10c9c11";
const USDC_ADDRESS   = "0x29219dd400f2Bf60E5a23d13Be72B486D4038894";

let oracleAbi = null;
let marketAbi = null;
let erc20Abi = null;

let provider, signer, account;
let oracle, market, usdc;


// -------------------------------
// Load ABI JSON
// -------------------------------
(async function loadAbi() {
  try {
    const r = await fetch("contractABI.json");
    if (!r.ok) throw new Error("Failed to load contractABI.json");

    const json = await r.json();

    if (!json.oracleAbi || !json.marketAbi || !json.erc20Abi) {
      throw new Error("ABI JSON missing required keys");
    }

    oracleAbi = json.oracleAbi;
    marketAbi = json.marketAbi;
    erc20Abi  = json.erc20Abi;

    document.getElementById("connect").disabled = false;

    attachHandlers();
    console.log("ABIs loaded");
  } catch (err) {
    console.error("ABI load error:", err);
    alert("Could not load contractABI.json. Check console.");
  }
})();


// -------------------------------
// Connect Wallet
// -------------------------------
async function connect() {
  if (!window.ethereum) return alert("MetaMask not found");

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts"
  });

  account = accounts[0];
  document.getElementById("account").innerText = "Connected: " + account;

  provider = new ethers.providers.Web3Provider(window.ethereum);
  signer = provider.getSigner();

  oracle = new ethers.Contract(ORACLE_ADDRESS, oracleAbi, signer);
  market = new ethers.Contract(MARKET_ADDRESS, marketAbi, signer);
  usdc   = new ethers.Contract(USDC_ADDRESS, erc20Abi, signer);

  updateAllowanceDisplay();
}


// -------------------------------
// Allowance Display
// -------------------------------
async function updateAllowanceDisplay() {
  if (!account) return;

  const allowance = await usdc.allowance(account, MARKET_ADDRESS);
  document.getElementById("approveStatus").innerText =
    "Allowance: " + allowance.toString();
}


// -------------------------------
// Oracle Functions
// -------------------------------
async function readPrice() {
  try {
    const p = await oracle.getPrice();
    document.getElementById("oracleOutput").innerText = "Price: " + p.toString();
  } catch (err) {
    console.error(err);
    alert("Failed to read price");
  }
}

async function setPrice() {
  try {
    const newPrice = document.getElementById("newPrice").value;
    const tx = await oracle.setPrice(newPrice);
    await tx.wait();
    alert("Price updated");
  } catch (err) {
    console.error(err);
    alert("Failed to set price");
  }
}


// -------------------------------
// USDC Approval
// -------------------------------
async function approveUSDC() {
  try {
    const tx = await usdc.approve(MARKET_ADDRESS, ethers.constants.MaxUint256);
    await tx.wait();
    alert("USDC Approved");
    updateAllowanceDisplay();
  } catch (err) {
    console.error(err);
    alert("Approval failed");
  }
}


// -------------------------------
// Market Functions
// -------------------------------
async function createMarket() {
  try {
    const tx = await market.createMarket();
    await tx.wait();
    alert("Market created");
  } catch (err) {
    console.error(err);
    alert("Failed to create market");
  }
}

async function resolveMarket() {
  try {
    const id = document.getElementById("resolveId").value;
    const tx = await market.resolveMarket(id);
    await tx.wait();
    alert("Market resolved");
  } catch (err) {
    console.error(err);
    alert("Failed to resolve market");
  }
}


// -------------------------------
// Betting
// -------------------------------
async function betUp() {
  try {
    const id = document.getElementById("betId").value;
    const amount = document.getElementById("betAmount").value;

    // Convert decimal USDC → integer (6 decimals)
    const parsedAmount = ethers.utils.parseUnits(amount, 6);

    const tx = await market.betUp(id, parsedAmount);
    await tx.wait();
    alert("Bet UP placed");
  } catch (err) {
    console.error(err);
    alert("Bet UP failed");
  }
}

async function betDown() {
  try {
    const id = document.getElementById("betId").value;
    const amount = document.getElementById("betAmount").value;

    const parsedAmount = ethers.utils.parseUnits(amount, 6);

    const tx = await market.betDown(id, parsedAmount);
    await tx.wait();
    alert("Bet DOWN placed");
  } catch (err) {
    console.error(err);
    alert("Bet DOWN failed");
  }
}



// -------------------------------
// Claim Winnings
// -------------------------------
async function claimWinnings() {
  try {
    const id = document.getElementById("claimId").value;
    const tx = await market.claim(id);
    await tx.wait();
    alert("Claim successful");
  } catch (err) {
    console.error(err);
    alert("Claim failed");
  }
}



// -------------------------------
// Attach Button Handlers
// -------------------------------
function attachHandlers() {
  document.getElementById("connect").onclick = connect;

  document.getElementById("readPrice").onclick = readPrice;
  document.getElementById("setPrice").onclick = setPrice;

  document.getElementById("approveUSDC").onclick = approveUSDC;

  document.getElementById("createMarket").onclick = createMarket;
  document.getElementById("resolveMarket").onclick = resolveMarket;

  document.getElementById("betUp").onclick = betUp;
  document.getElementById("betDown").onclick = betDown;

  document.getElementById("claim").onclick = claimWinnings;

}

async function updateTimeLeft() {
  try {
    const id = document.getElementById("betId").value;

    if (!id) {
      document.getElementById("timeLeft").innerText = "Enter a market ID";
      return;
    }

    const m = await market.markets(id);

    // Detect non-existent market
    if (Number(m.startTime) === 0) {
      document.getElementById("timeLeft").innerText = "Market does not exist";
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const end = Number(m.endTime);

    if (now >= end) {
      document.getElementById("timeLeft").innerText = "Market ended";
      return;
    }

    const secondsLeft = end - now;
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;

    document.getElementById("timeLeft").innerText =
      `Time left: ${minutes}:${seconds.toString().padStart(2, "0")}`;

  } catch (err) {
    console.error("updateTimeLeft error:", err);
    document.getElementById("timeLeft").innerText = "Invalid market ID";
  }
}


setInterval(updateTimeLeft, 1000);
document.getElementById("betId").addEventListener("input", updateTimeLeft);
