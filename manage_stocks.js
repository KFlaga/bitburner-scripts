import { formatMoney, isIn } from "utils.js"

// Spread (Bid Price & Ask Price)
// The bid price is the maximum price at which someone will buy a stock on the stock market.

// The ask price is the minimum price that a seller is willing to receive for a stock on the stock market

// The ask price will always be higher than the bid price (This is because if a seller is willing to receive 
// less than the bid price, that transaction is guaranteed to happen). The difference between the bid and ask 
// price is known as the spread. A stock’s “price” will be the average of the bid and ask price.

// The bid and ask price are important because these are the prices at which a transaction actually occurs. 
// If you purchase a stock in the long position, the cost of your purchase depends on that stock’s ask price. 
// If you then try to sell that stock (still in the long position), the price at which you sell is the stock’s 
// bid price. Note that this is reversed for a short position. Purchasing a stock in the short position will 
// occur at the stock’s bid price, and selling a stock in the short position will occur at the stock’s ask price.


/** @param {NS} ns */
function getLongCount(ns, stockName) {
    var position = ns.stock.getPosition(stockName);
    return position[0];
}

/** @param {NS} ns */
function getLongPrice(ns, stockName) {
    var position = ns.stock.getPosition(stockName);
    return position[1];
}

/** @param {NS} ns */
function sellBadPositions(ns, sellTreshold) {
    var allStockNames = ns.stock.getSymbols();
    var totalSellPrice = 0;
    for (var stockName of allStockNames) {
        var mySharesLongCount = getLongCount(ns, stockName);
        var forecast = ns.stock.getForecast(stockName);
        if (mySharesLongCount > 0 && forecast < sellTreshold) {
            var sellPrice = ns.stock.sellStock(stockName, mySharesLongCount);
            totalSellPrice = totalSellPrice + sellPrice * mySharesLongCount;
            // ns.print("Sold " + stockName + " x" + mySharesLongCount + " for " + formatMoney(sellPrice * mySharesLongCount));
        }
    }
    return totalSellPrice;
}

/** @param {NS} ns */
function getSortedBestStocks(ns, buyTreshold) {
    var allStockNames = ns.stock.getSymbols();
    var sortedByForecast = allStockNames.sort((a, b) => {
        var fa = ns.stock.getForecast(a);
        var fb = ns.stock.getForecast(b);
        if (fa < fb) {
            return 1;
        } else if (fa > fb) {
            return -1;
        } else {
            return 0;
        }
    });
    var bestStocks = sortedByForecast.filter((x) => { return ns.stock.getForecast(x) > buyTreshold; });
    return bestStocks;
}

/** @param {NS} ns */
function checkStockAvailability(ns) {
    try {
        if (!ns.stock.hasWSEAccount()) {
            if (!ns.stock.purchaseWseAccount()) {
                return false;
            }
        }
        if (!ns.stock.hasTIXAPIAccess()) {
            if (!ns.stock.purchaseTixApi()) {
                return false;
            }
        }
        if (!ns.stock.hasTIXAPIAccess()) {
            if (!ns.stock.purchase4SMarketData()) {
                return false;
            }
        }
        if (!ns.stock.has4SDataTIXAPI()) {
            if (!ns.stock.purchase4SMarketDataTixApi()) {
                return false;
            }
        }
        return true;
    }
    catch (x) {
    }
    return false;
}

/** @param {NS} ns */
function buyBestStocks(ns, bestStocks, investMoney, investingTreshold, specialUpStocks, specialDownStocks) {
    for (var stockName of bestStocks) {
        var availableMoney = Math.min(investMoney, ns.getPlayer().money);
        if (availableMoney < investingTreshold) {
            break;
        }

        if (isIn(specialUpStocks, stockName) || isIn(specialDownStocks, stockName)) {
            continue;
        }

        var maxShares = ns.stock.getMaxShares(stockName);
        var toBuy = maxShares - getLongCount(ns, stockName);
        var costOfAll = ns.stock.getPurchaseCost(stockName, toBuy, "Long");
        if (costOfAll < investingTreshold) {
            continue;
        }

        if (costOfAll > availableMoney) {
            toBuy = Math.floor(toBuy * availableMoney / costOfAll);
        }
        var buyPrice = ns.stock.buyStock(stockName, toBuy);
        if (buyPrice > 0) {
            // ns.print("Bought " + stockName + " x" + toBuy + " for " + formatMoney(buyPrice * toBuy));
            investMoney = investMoney - buyPrice * toBuy;
        }
    }
    return investMoney;
}

/** @param {NS} ns */
function dumpPositions(ns, sellTreshold, specialUpStocks, specialDownStocks) {
    var allStockNames = ns.stock.getSymbols();

    var upPositions = "";
    var downPositions = "";

    var serverNames = {
        "ECP": "ecorp", // ECorp
        "MGCP": "megacorp", // Megacorp
        "BLD": "blade", // Blade industries
        "CLRK": "clarkinc", // clark
        "OMTK": "omnitek", //  omnitek
        "KGI": "", // kugaigong
        "FLCM": "fulcrumtech", // fulcrum
        "FSIG": "4sigma", // four sigma
        "STM": "stormtech", // storm
        "DCOMM": "defcomm", // defcomm
        "HLS": "The-Cave,", // helios
        "VITA": "vitalife", // vitalife
        "ICRS": "icarus", // icarus
        "UNV": "univ-energy", // universal
        "AERO": "aerocorp", // aerocorp
        "OMN": "omnia", // omnia
        "SLRS": "solaris", // solaris
        "GLH": "global-pharm", // global pharm
        "NVMD": "nova-med", // nova med
        "WDS": "", // watchdog security
        "LXO": "lexo-corp", // lexo
        "RHOC": "rho-construction", // rho const.
        "APHE": "alpha-ent", // alpha ent.
        "SYSC": "syscore", // syscore
        "CTK": "computek", // computek
        "NTLK": "netlink", // netlink
        "OMN": "omnia", // omnia
        "OMGA": "omega-net",
        "FNS": "foodnstuff", // 
        "SGC": "sigma-cosmetics", //
        "JGN": "joesguns", // 
        "CTYS": "catalyst", // catalyst vent.
        "MDYN": "microdyne", // microdyne
        "TITN": "titan-labs", // titan
    };

    ns.print(specialDownStocks)
    ns.print(specialUpStocks)
    for (var stockName of allStockNames) {
        if (isIn(specialUpStocks, stockName)) {
            ns.print("IN U " + stockName)
            upPositions += serverNames[stockName] + "\n";
        } else if (isIn(specialDownStocks, stockName)) {
            ns.print("IN D " + stockName)
            downPositions += serverNames[stockName] + "\n";
        } else {
            ns.print("NOT IN " + stockName)
            var stockCount = getLongCount(ns, stockName);
            if (stockCount > 0) {
                upPositions += serverNames[stockName] + "\n";
            } else if (ns.stock.getForecast(stockName) > sellTreshold) {
                upPositions += serverNames[stockName] + "\n";
            } else {
                // downPositions += serverNames[stockName] + "\n";
            }
        }
    }

    ns.write("stock-up.txt", upPositions, "w");
    ns.write("stock-down.txt", downPositions, "w");

    for (var server of ns.getPurchasedServers()) {
        ns.scp(["stock-up.txt", "stock-down.txt"], server);
    }
}

/** @param {NS} ns */
function getSpecialStocks(ns, fileName) {
    if (ns.fileExists(fileName)) {
        var xs = ns.read(fileName).split(",");
        return xs;
    }
    return [];
}

/** @param {NS} ns */
export async function main(ns) {
    var maxMoneyToInvest = 0.1;
    if (ns.args.length > 0) {
        maxMoneyToInvest = ns.args[0];
    }
    var maxMoneyToReInvest = 0.75;
    if (ns.args.length > 1) {
        maxMoneyToReInvest = ns.args[1];
    }
    var investingTreshold = 100 * 1000 * 1000; // don't buy anything for less than 100m
    var sellTreshold = 0.52;
    var buyTreshold = 0.56;
    if (ns.args.length > 3) {
        sellTreshold = ns.args[2];
        buyTreshold = ns.args[3];
    }

    ns.disableLog("sleep");
    ns.disableLog("scp");

    while (!checkStockAvailability(ns)) {
        await ns.sleep(60000);
    }

    var money = ns.getPlayer().money;
    var investMoney = money * maxMoneyToInvest;

    while (true) {
        var newMoney = ns.getPlayer().money;
        var earning = newMoney - money;
        if (earning > 0) {
            // ns.print("earning: " + formatMoney(earning));
            investMoney = investMoney + earning * maxMoneyToInvest;
        }
        money = newMoney;

        investMoney = investMoney + sellBadPositions(ns, sellTreshold) * maxMoneyToReInvest;
        // ns.print("To invest: " + formatMoney(investMoney));

        var specialUpStocks = getSpecialStocks(ns, "stock-special-up.txt");
        var specialDownStocks = getSpecialStocks(ns, "stock-special-down.txt");

        var availableMoney = Math.min(investMoney, ns.getPlayer().money);
        if (availableMoney > investingTreshold) {
            var bestStocks = getSortedBestStocks(ns, buyTreshold);
            investMoney = buyBestStocks(ns, bestStocks, investMoney, investingTreshold, specialUpStocks, specialDownStocks);
        }

        dumpPositions(ns, sellTreshold, specialUpStocks, specialDownStocks);
        await ns.sleep(2000);
    }
}