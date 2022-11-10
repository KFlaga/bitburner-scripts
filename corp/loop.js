import { _m, _b, _t, _q, _Q, Industries, funds, hasIndustry } from "corp/defines.js";


export class Loop {
    /** @type Loop */ static get instance() {
        return window.loopData;
    }

    constructor(ns) {
        this.ns = ns;
        /** @type Corporation */ this.corp = ns.corporation;
        this.lastFunds = funds(ns);
        this.income = 0;

        this.upgradeFundsMultiplier = 0.25;
        this.upgradeFunds = this.upgradeFundsMultiplier * this.lastFunds;

        this.lastCycleRevenue = 0;
        this.lastCycleExpenses = 0;
        this.isInvestCheckTime = false;

        this.maxLoopsPerTurn = 15;

        this.loopCounter = 0;
        this.turnCounter = 0;

        this.lastTurnLoop = 0;

        this.counters = {};

        window.loopData = this;
    }

    loop() {
        this.loopCounter++;

        if (this.lastTurnLoop + this.maxLoopsPerTurn < this.loopCounter) {
            // Force next turn
            this.nextTurn();
        } else if (hasIndustry(this.ns, Industries.Agriculture)) {
            if (this.corp.getDivision(Industries.Agriculture).lastCycleRevenue != this.lastCycleRevenue ||
                this.corp.getDivision(Industries.Agriculture).lastCycleExpenses != this.lastCycleExpenses) {
                // Detected change in money per cycle - so we have new turn
                this.nextTurn();
            }
        }
    }

    nextTurn() {
        this.turnCounter++;
        this.lastTurnLoop = this.loopCounter;
        if (hasIndustry(this.ns, Industries.Agriculture)) {
            this.lastCycleRevenue = this.corp.getDivision(Industries.Agriculture).lastCycleRevenue;
            this.lastCycleExpenses = this.corp.getDivision(Industries.Agriculture).lastCycleExpenses;
        }

        this.income = funds(this.ns) - this.lastFunds;
        this.lastFunds = funds(this.ns);
        this.upgradeFunds += Math.max(0, this.upgradeFundsMultiplier * this.income);
    }

    get loopTime() {
        return this.corp.getBonusTime() > 1000 ? 100 : 1000;
    }
}

export function runOncePerTurn(key) {
    if (Loop.instance.counters[key] === Loop.instance.turnCounter) {
        return false;
    }
    Loop.instance.counters[key] = Loop.instance.turnCounter;
    return true;
}