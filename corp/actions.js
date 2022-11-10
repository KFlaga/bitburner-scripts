import { _m, _b, _t, _q, _Q, Industries, Cities, Upgrades, Jobs, Researches, funds, realEstateVolume, hasCorp } from "corp/defines.js";
import { Loop, runOncePerTurn } from "corp/loop.js";
import { maxIndex, forEach2 } from "corp/toolkit.js";


export async function establishCorp(ns) {
    while (!hasCorp(ns)) {
        if (ns.getPlayer().money > 150 * _b) {
            ns.corporation.createCorporation("mycorp", true);
            return;
        }
        await ns.sleep(60000);
    }
}

// Don't know how useful those scores are as there are only vague hints about them in game
function employeeScore(empl, job) {
    if(job == Jobs.Production) return empl.cha * -.3 + empl.cre * -.3 + empl.eff * 2.9 + empl.int * -.3;
    if(job == Jobs.Engineer) return empl.cha * -.3 + empl.cre * -.3 + empl.eff * 1.6 + empl.int * 1.0;
    if(job == Jobs.Business) return empl.cha * 2.0 + empl.cre * 0.5 + empl.eff * -.5 + empl.int * 0.0;
    if(job == Jobs.Management) return empl.cha * 1.5 + empl.cre * 0.5 + empl.eff * -.5 + empl.int * 0.5;
    if(job == Jobs.Researcher) return empl.cha * -.3 + empl.cre * 1.0 + empl.eff * -.3 + empl.int * 1.6;
    return 0;
}

/** @param {City} city 
 *  @param {[{ job: string, rate: number, minSlots: number }]} allocations 
 */
export function assignEmployees(city, allocations) {
    let office = city.office;
    let allEmpl = office.employees.length;
    let freeEmployees = office.employees
        .map((eName) => city.employee(eName))
        .filter((empl) => empl.pos === Jobs.Unassigned);

    for (let alloc of allocations) {
        let targetEmpl = Math.max(alloc.minSlots, Math.round(allEmpl * alloc.rate));
        let missingEmpl = targetEmpl - office.employeeJobs[alloc.job];
        let toHire = Math.min(missingEmpl, freeEmployees.length);
        if(toHire > 0) {
            freeEmployees.sort((a, b) => employeeScore(b, alloc.job) - employeeScore(a, alloc.job));
            for (let i = 0; i < toHire; ++i) {
                city.assignJob(freeEmployees[i], alloc.job);
            }
        } else {
            let tooManyEmployees = office.employees
                .map((eName) => city.employee(eName))
                .filter((empl) => empl.pos === alloc.job)
                .sort((a, b) => employeeScore(a, alloc.job) - employeeScore(b, alloc.job));
                
            for (let i = 0; i < -toHire; ++i) {
                city.assignJob(tooManyEmployees[i], Jobs.Unassigned);
            }
            freeEmployees.concat(tooManyEmployees.splice(0, toHire));
        }
    }
}

/** @param {Industry} industry 
 *  @param {{ capital: [any], other: [any] }} allocations 
 */
export function assignEmployeesAllCities(industry, allocations) {
    for (let city of industry.cities) {
        let alloc = (city === industry.capital) ? allocations.capital : allocations.other;
        assignEmployees(city, alloc);
    }
}

/** @param {NS} ns 
 *  @param {Industry} industry 
 *  @param {number} capitalFactor 
 *  @param {number} upgradeSize 
 */
export function upgradeOffices(ns, industry, capitalFactor, upgradeSize) {
    let workersInCapital = industry.capital.office.size;
    let workersInOther = Math.ceil(workersInCapital / capitalFactor);
    let incomeLimit = Loop.instance.income * 100;
    let fundsLimit = Math.sqrt(Math.max(0, funds(ns))) * 50000;
    let maxUpgradeMoney = Math.max(incomeLimit, fundsLimit);

    // First upgrade other cities to match capital
    for (let city of industry.cities) {
        if (city.office.size + upgradeSize / 2 < workersInOther) {
            city.upgradeOfficeSize(upgradeSize, maxUpgradeMoney);
        }
    }
    industry.capital.upgradeOfficeSize(upgradeSize, maxUpgradeMoney);

    for (let city of industry.cities) {
        city.hireAll();
    }
}

/** @param {NS} ns 
 *  @param {Industry} industry 
 *  @param {number} incomeFactor 
 *  @param {number} maxAmountFactor 
 */
export function manageRealEstate(ns, industry, incomeFactor, maxAmountFactor) {
    for (let city of industry.cities) {
        let maxAmount = city.warehouse.size * maxAmountFactor / realEstateVolume;
        if (city.material("Real Estate").qty < maxAmount) {
            let reCost = city.material("Real Estate").cost;
            let incomeLimit = (Loop.instance.income * incomeFactor) / (reCost * 60); // 360 is 6 cities * per 10 sec
            let fundsLimit = Math.sqrt(Math.max(0, funds(ns))) * 50 * incomeFactor / (reCost * 60);
            let spaceLimit = (maxAmount - city.material("Real Estate").qty) / 60;
            let buyAmount = Math.max(0, Math.min(Math.max(incomeLimit, fundsLimit), spaceLimit));
            ns.corporation.buyMaterial(industry.name, city.name, "Real Estate", buyAmount);
        } else {
            ns.corporation.buyMaterial(industry.name, city.name, "Real Estate", 0);
        }
    }
}

/** @param {NS} ns 
 *  @param {Industry} industry 
 *  @param {string} material 
 */
export function manageMaterialSales(ns, industry, material) {
    for (let city of industry.cities) {
        if (industry.hasSmartMarket()) {
            ns.corporation.sellMaterial(industry.name, city.name, material, "MAX", "MP");
            ns.corporation.setMaterialMarketTA2(industry.name, city.name, material, true);
        } else {
            let sellCost = city.material(material).sCost;
            let sellFactor = 1.0;
            if (typeof sellCost === "string") {
                sellFactor = Number.parseFloat(sellCost.substr(3));
            }
            if (city.material(material).qty > city.material(material).prod*40) {
                sellFactor *= 0.90;
            } else if (city.material(material).qty > city.material(material).prod*15) {
                sellFactor *= 0.98;
            } else if (city.material(material).qty == 0) {
                sellFactor *= 1.005;
            }
            sellFactor = Math.max(0.75, sellFactor);
            ns.corporation.sellMaterial(industry.name, city.name, material, "MAX", "MP*"+sellFactor.toFixed(5));
        }
    }
}

/** @param {NS} ns 
 *  @param {Industry} industry 
 *  @param {string} product 
 */
export function manageProductSales(ns, industry, product) {
    if (ns.corporation.getProduct(industry.name, product).developmentProgress < 100) {
        return;
    }

    if (industry.hasSmartMarket()) {
        ns.corporation.setProductMarketTA2(industry.name, product, true);
    }
    // No reason to mnage Products manually
    // To sell it for more than ~1.05 we need to invest a lot into its development + adverts
    // at which point we should have smart market upgrade. And unsold products takes a lot of space.
    for (let city of industry.cities) {
        ns.corporation.sellProduct(industry.name, city.name, product, "MAX", "MP*1.0", true);
    }
}


/** @param {NS} ns 
 *  @param {Industry} industry 
 *  @param {[{ name: string, buyAt: number }]} researches 
 */
export function manageResearch(ns, industry, researches) {
    for (let res of researches) {
        if (!ns.corporation.hasResearched(industry.name, res.name)) {
            if (industry.api.research > res.buyAt) {
                ns.corporation.research(industry.name, res.name);
            }
            break;
        }
    }
}

/** @param {NS} ns 
 *  @param {Industry} industry 
 *  @param {number} maxCount 
 */
export function manageAdverts(ns, industry, maxCount) {
    if (maxCount == 0 || ns.corporation.getHireAdVertCount(industry.name) < maxCount) {
        ns.corporation.hireAdVert(industry.name);
    }
}


/** @param {NS} ns 
 *  @param {string} upgrade 
 */
export function unlockUpgrade(ns, upgrade) {
    if(!ns.corporation.hasUnlockUpgrade(upgrade) && funds(ns) > ns.corporation.getUnlockUpgradeCost(upgrade)) {
        ns.corporation.unlockUpgrade(upgrade);
    }
}

/** @param {NS} ns 
 *  @param {string} upgrade 
 */
export function levelUpgrade(ns, upgrade) {
    let cost = ns.corporation.getUpgradeLevelCost(upgrade);
    if (funds(ns) > cost && Loop.instance.upgradeFunds > cost) {
        ns.corporation.levelUpgrade(upgrade);
        Loop.instance.upgradeFunds -= cost;
    }
}

/** @param {NS} ns
 *  @param {[{ name: string, maxCost: number, maxLevel: number }]} upgrades
 *  @param {[string]} unlocks
 */
export function buyUpgrades(ns, upgrades, unlocks) {
    if (runOncePerTurn("buyUpgrades")) {
        let startMoney = 0;
        while (startMoney != Loop.instance.upgradeFunds) {
            startMoney = Loop.instance.upgradeFunds;

            for (const u of unlocks) {
                unlockUpgrade(ns, u);
            }
            for (const u of upgrades) {
                if ((!("maxCost" in u) || ns.corporation.getUpgradeLevelCost(u.name) < u.maxCost) &&
                    (!("maxLevel" in u) || ns.corporation.getUpgradeLevel(u.name) < u.maxLevel)) {
                    levelUpgrade(ns, u.name);
                }
            }

        }

    }
}

/** @param {NS} ns 
 *  @param {Industry} industry 
*/
export function manageProducts(ns, industry) {
    if(!industry.api.makesProducts) {
        return;
    }

    for (let product of industry.api.products) {
        manageProductSales(ns, industry, product);
    }

    if (industry.api.products.length < industry.maxProducts && !industry.isDevelopingProduct() && funds(ns) > 2*_b) {
        let investments = Math.min(funds(ns) * 0.45, Math.max(1*_b, industry.api.lastCycleRevenue*1000));
        let productName = "p" + investments.toExponential(1);
        while (productName in industry.api.products) {
            productName += "x";
        }
        ns.corporation.makeProduct(industry.name, industry.capital.name, "p" + investments.toExponential(1), investments, investments);
    } else if (industry.finishedProductsCount == 5) {
        let minRatingIdx = maxIndex(industry.api.products, (p) => -ns.corporation.getProduct(industry.name, p).rat);
        ns.corporation.discontinueProduct(industry.name, industry.api.products[minRatingIdx]);
    }
}

/** @param {NS} ns 
 *  @param {Industry} industry 
 *  @param {[string]} materials 
*/
export function manageMaterials(ns, industry, materials) {
    for (const mat of materials) {
        manageMaterialSales(ns, industry, mat);
    }
}

/** @param {NS} ns 
 *  @param {Industry} industry 
 *  @param {number} expandSize 
*/
export function manageWarehouse(ns, industry, expandSize) {
    if(runOncePerTurn(industry.name + "manageWarehouse")) {
        industry.enableSmartSupply();
        for (let city of industry.cities) {
            city.lastTurnMaxUsedWarehouseSize = city.currentTurnMaxUsedWarehouseSize;
            city.currentTurnMaxUsedWarehouseSize = 0;
            if (city.lastTurnMaxUsedWarehouseSize > city.warehouse.size * expandSize) {
                ns.corporation.upgradeWarehouse(industry.name, city.name);
            }
        }
    }

    for (let city of industry.cities) {
        city.currentTurnMaxUsedWarehouseSize = Math.max(city.warehouse.sizeUsed, city.currentTurnMaxUsedWarehouseSize);
    }
}