import { _m, _b, _t, _q, _Q, Industries, Cities, Upgrades, Jobs, Researches, funds } from "corp/defines.js";
import { Industry } from "corp/industry.js";
import { loopIndustry } from "corp/loop_industry.js";
import { buyUpgrades, establishCorp, unlockUpgrade } from "corp/actions.js";
import { Loop, runOncePerTurn } from "corp/loop.js";


const CorpStates = {
    establishCorp: 0,
    agriculture: 1,
    healthcare: 2,
    robotics: 3,
    endgame: 4,
};

/** @param {NS} ns */
function manageUpgrades(ns, corpState) {
    let upgrades = [];
    let unlocks = [];

    let warehouseLevel = function(ind) {
        return ns.corporation.getDivision(ind).cities
               .map((c) => ns.corporation.getWarehouse(ind, c).level)
               .reduce((a, b) => a + b);
    }
    let income = Loop.instance.income;

    if (corpState == CorpStates.establishCorp) {
        // no upgrades
    } else if (corpState == CorpStates.agriculture) {
        unlocks = [Upgrades.SmartSupply];

        if(income > 2 * _m) {
            unlocks.push(Upgrades.Export);
        }
        upgrades = [
            { name: Upgrades.Warehouse, maxLevel: Math.floor((warehouseLevel(Industries.Agriculture) - 10) / 10) },
            { name: Upgrades.Production, maxCost: income * 10 },
            { name: Upgrades.Effeciency, maxCost: income * 7 },
            { name: Upgrades.Intelligence, maxCost: income * 6 },
            { name: Upgrades.TickAdvert, maxCost: income * 100, maxLevel: 1 },
        ];

    } else if (corpState == CorpStates.healthcare) {
        unlocks = [Upgrades.SmartSupply, Upgrades.Export];
        upgrades = [
            { name: Upgrades.TickAdvert, maxLevel: 5 },
            { name: Upgrades.Research, maxCost: 1 * _t },
            { name: Upgrades.Warehouse, maxLevel: Math.floor(warehouseLevel(Industries.Healthcare) / 10) },
            { name: Upgrades.Production, maxCost: income * 8 },
            { name: Upgrades.Intelligence, maxCost: income * 5 },
            { name: Upgrades.Effeciency, maxCost: income * 5 },
            { name: Upgrades.Creativity, maxCost: income * 3 },
            { name: Upgrades.Charisma, maxCost: income * 3 },
        ];
    } else {
        unlocks = [Upgrades.SmartSupply, Upgrades.Export];
        if (funds(ns) > 4 * _q) {
            unlocks = unlocks.concat([Upgrades.Tax1, Upgrades.Tax2]);
        }
        upgrades = [
            { name: Upgrades.TickAdvert, maxLevel: 5 },
            { name: Upgrades.Research, maxCost: 50 * _t },
            { name: Upgrades.Advert, maxCost: income * 40 },
            { name: Upgrades.Production, maxCost: income * 10 },
            { name: Upgrades.Warehouse, maxCost: income * 15 },
            { name: Upgrades.Intelligence, maxCost: income * 5 },
            { name: Upgrades.Creativity, maxCost: income * 5 },
            { name: Upgrades.Effeciency, maxCost: income * 6 },
            { name: Upgrades.Charisma, maxCost: income * 5 },
            { name: Upgrades.Sales, maxCost: income * 5 },
        ];
    }
    buyUpgrades(ns, upgrades, unlocks);
}

/** @param {NS} ns */
let manageShares = function() {
    let shareValues = [0, 0, 0];
    let idx = 0;

    let f = (ns) => {
        if(!runOncePerTurn("manageShares")) {
            return;
        }

        if ([Upgrades.Tax1, Upgrades.Tax2].every((u) => ns.corporation.hasUnlockUpgrade(u))) {
            // Now true investment returns begin, we'll soon overflow with money
            ns.corporation.issueDividends(0.25);
        }

        if (ns.corporation.getCorporation().public) {
            return;
        }

        // Sometimes share price is buggy, so some workarounds
        if(Number.isNaN(ns.corporation.getCorporation().sharePrice)) {
            return;
        }
        shareValues[idx] = ns.corporation.getCorporation().sharePrice;
        idx = (idx + 1) % shareValues.length;
        let sharePrice = Math.min(...shareValues);

        // Go pubic when we may gain 200t for 200m shares if we haven't got 2nd investor
        // Otherwise go for 1q
        if (ns.corporation.getInvestmentOffer().round < 2 && sharePrice > 1 * _m) {
            ns.corporation.goPublic(200 * _m);
            ns.corporation.issueDividends(0.1);
        } else if (sharePrice > 10 * _m) {
            ns.corporation.goPublic(100 * _m);
            ns.corporation.issueDividends(0.1);
        }
    }
    return f;
}();

/** @param {NS} ns */
function establishFirstDivision(ns, industries) {
    // 1st buy Agriculture department as it is fastest to expand with
    industries.agriculture.establish();
    unlockUpgrade(ns, Upgrades.SmartSupply);
    industries.agriculture.enableSmartSupply();
    for (let city of industries.agriculture.cities) {
        ns.corporation.sellMaterial(city.industry, city.name, "Food", "MAX", "MP*1.0");
        ns.corporation.sellMaterial(city.industry, city.name, "Plants", "MAX", "MP*1.0");
    }
}

function raiseAgricultureAndBuyHealthcare(ns, industries) {
    // 1st buy Agriculture department as it is fastest to expand with
    loopIndustry(ns, industries.agriculture);

    // 1st investor should give money to have at least 1t, so we can expand to much more lucrative healthcare
    if (ns.corporation.getInvestmentOffer().round <= 1
        && funds(ns) + ns.corporation.getInvestmentOffer().funds >= 1 * _t) {
        ns.corporation.acceptInvestmentOffer();
    }

    if(funds(ns) > 0.9 * _t) {
        industries.healthcare.establish();
        industries.healthcare.enableSmartSupply();
        unlockUpgrade(ns, Upgrades.Export);
    }
}

function raiseHealthcareAndBuyRobotics(ns, industries) {
    // At this point we may abandon looping Agriculture as its gains will soon be marginal
    for (let city of industries.agriculture.cities) {
        ns.corporation.sellMaterial(city.industry, city.name, "Food", "MAX", "MP*1.0");
        ns.corporation.sellMaterial(city.industry, city.name, "Plants", "MAX", "MP*1.0");
        ns.corporation.buyMaterial(city.industry, city.name, "Real Estate", 0);
    }
    loopIndustry(ns, industries.healthcare);

    // After a hospital is up and running we should easily get > 300t from 2nd investor 
    if (ns.corporation.getInvestmentOffer().round <= 2 && ns.corporation.getInvestmentOffer().funds >= 300 * _t) {
        ns.corporation.acceptInvestmentOffer();
    }

    if (funds(ns) >= 3 * _t) {
        industries.robotics.establish();
        industries.robotics.enableSmartSupply();
        for (let city of industries.robotics.cities) {
            ns.corporation.sellMaterial(city.industry, city.name, "Robots", "MAX", "MP*1.0");
        }
    }
}

function raiseHealthcareAndRobotics(ns, industries) {
    // Expand both for a while, but as Robotics gains income much faster than Healthcare
    // after some spending on adverts, we' abanon it soon as well
    loopIndustry(ns, industries.robotics);
    loopIndustry(ns, industries.healthcare);
}

function raiseRobotics(ns, industries) {
    // Now wait for ultimate gains
    loopIndustry(ns, industries.robotics);
}

const corpStates = [{
    run: establishFirstDivision,
    until: (industries) => !industries.agriculture.isEstablished()
}, {
    run: raiseAgricultureAndBuyHealthcare,
    until: (industries) => !industries.healthcare.isEstablished()
}, {
    run: raiseHealthcareAndBuyRobotics,
    until: (industries) => !industries.robotics.isEstablished()
}, {
    run: raiseHealthcareAndRobotics,
    until: (industries) => industries.robotics.api.lastCycleRevenue * 2 < industries.healthcare.api.lastCycleRevenue
}, {
    run: raiseRobotics,
    until: (industries) => true
}];

/** @param {NS} ns */
export async function main(ns) {
    // This needs SourceFile 3-3 to work properly
    // Otherwise with SourceFile 3-1 or in BitNode 3 one may pause in Debug mode and
    // change upgrades for OfficeAPI and WarehouseAPI to 1.

    ns.disableLog("sleep");
    let loopData = new Loop(ns);

    await establishCorp(ns);

    let industries = {
        agriculture: new Industry(ns, Industries.Agriculture),
        healthcare: new Industry(ns, Industries.Healthcare),
        robotics: new Industry(ns, Industries.Robotics),
    }

    while (true) {
        loopData.loop();

        // Script must have ability to be rerun from start, so every loop we start with clean state
        // Well, we could also store it in file, but what fun is it
        let currentState = 0;

        ns.print("LOOP: " + loopData.loopCounter + " TURN: " + loopData.turnCounter)

        // Every few minutes we cut unnecessary expenses to rise corp valuation
        // It is probably averaged over 5 or so cycles
        loopData.isInvestCheckTime = (loopData.turnCounter % 60 > 52);

        while (!corpStates[currentState].until(industries)) {
            currentState++;
        }
        corpStates[currentState].run(ns, industries);

        manageUpgrades(ns, currentState);
        manageShares(ns);

        await ns.sleep(loopData.loopTime);
    }
}