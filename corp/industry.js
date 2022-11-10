import { _m, _b, _t, _q, _Q, Industries, Cities, Upgrades, Jobs, Researches, funds, hasIndustry, totalNewCityCost, newCityCost, warehouseCost  } from "corp/defines.js";
import { isIn } from "corp/toolkit.js";


class City {
    /** @param {NS} ns */
    constructor(ns, industry, city) {
        this.ns = ns;
        /** @type Corporation */ this.corp = ns.corporation;
        /** @type string */ this.industry = industry;
        /** @type string */ this.name = city;
        
        this.lastTurnMaxUsedWarehouseSize = 0;
        this.currentTurnMaxUsedWarehouseSize = 0;
    }

    /** @returns Office */
    get office() {
        return this.corp.getOffice(this.industry, this.name);
    }

    /** @returns Warehouse */
    get warehouse() {
        return this.corp.getWarehouse(this.industry, this.name);
    }

    /** @returns Materal */
    material(matName) {
        return this.corp.getMaterial(this.industry, this.name, matName);
    }

    /** @returns Employee */
    employee(eName) {
        return this.corp.getEmployee(this.industry, this.name, eName);
    }

    assignJob(empl, job) {
        this.corp.assignJob(this.industry, this.name, empl.name, job);
    }

    upgradeOfficeSize(size, maxMoney) {
        maxMoney = Math.min(maxMoney, funds(this.ns));
        if(this.corp.getOfficeSizeUpgradeCost(this.industry, this.name, size) < maxMoney) {
            this.corp.upgradeOfficeSize(this.industry, this.name, size);
        }
    }

    hireAll() {
        while (this.office.employees.length < this.office.size) {
            this.corp.hireEmployee(this.industry, this.name);
        }
    }

    expand() {
        if(!isIn(this.corp.getDivision(this.industry).cities, this.name)) {
            if (funds(this.ns) > totalNewCityCost) {
                this.corp.expandCity(this.industry, this.name);
                this.corp.purchaseWarehouse(this.industry, this.name);
            }
        } else if(!this.corp.hasWarehouse(this.industry, this.name)) {
            if (funds(this.ns) > warehouseCost) {
                this.corp.purchaseWarehouse(this.industry, this.name);
            }
        }
    }

    get availableWarehouseSpace() {
        return this.warehouse.size - this.lastTurnMaxUsedWarehouseSize;
    }
};

export class Industry {
    /** @param {NS} ns */
    constructor(ns, industry) {
        this.ns = ns;
        /** @type Corporation */ this.corp = ns.corporation;
        /** @type string */ this.name = industry;

        this.cities = [];
        for (const city of Object.values(Cities)) {
            this.cities.push(new City(ns, this.name, city));
        }
        this.capital = this.cities.find((c) => c.name == Cities.Sector12);
    }

    /** @returns Division */
    get api() {
        return this.corp.getDivision(this.name);
    }

    /** @returns City */
    city(name) {
        return this.cities.find((c) => c.name == name);
    }

    /** @returns Product */
    product(prodName) {
        return this.corp.getProduct(this.industry, prodName);
    }

    isEstablished() {
        if(hasIndustry(this.ns, this.name) && this.api.cities.length == 6) {
            return Object.values(Cities).every((c) => this.corp.hasWarehouse(this.name, c));
        }
        return false;
    }

    expandToAll() {
        for (const city of Object.values(Cities)) {
            this.city(city).expand();
        }
    }

    establish() {
        if (!hasIndustry(this.ns, this.name)) {
            if(funds(this.ns) > this.corp.getExpandIndustryCost(this.name) + 5 * totalNewCityCost) {
                this.corp.expandIndustry(this.name, this.name);
                this.expandToAll();
            }
        } else if (this.api.cities.length < 6) {
            this.expandToAll();
        }
    }

    enableSmartSupply() {
        if (this.corp.hasUnlockUpgrade(Upgrades.SmartSupply)) {
            for (const city of Object.values(Cities)) {
                this.corp.setSmartSupply(this.name, city, true);
            }
        }
    }

    hasSmartMarket() {
        return this.corp.hasResearched(this.name, Researches.SmartMarket2);
    }

    get maxProducts() {
        return this.corp.hasResearched(this.name, Researches.Capacity2) ? 5 :
               this.corp.hasResearched(this.name, Researches.Capacity1) ? 4 :
                                                                          3;
    }

    get finishedProducts() {
        return this.api.products.filter((p) => this.corp.getProduct(this.name, p).developmentProgress >= 100-1e-12);
    }

    get finishedProductsCount() {
        return this.finishedProducts.length;
    }

    isDevelopingProduct() {
        return this.api.products.findIndex((p) => this.corp.getProduct(this.name, p).developmentProgress < 100-1e-12) != -1;
    }
}