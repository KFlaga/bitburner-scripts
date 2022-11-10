import { _m, _b, _t, _q, _Q, Jobs, Researches } from "corp/defines.js";
import { Loop, runOncePerTurn } from "corp/loop.js";
import * as act from "corp/actions.js";


const producedMaterials = {
    'Agriculture': [ 'Food', 'Plants' ],
    'Software': [ 'AI Cores' ],
    'Healthcare': [ ],
    'Robotics': [ 'Robots' ],
};

const realEstateCoeffs = {
    'Agriculture': [0.5, 0.71],
    'Software': [0.4, 0.50],
    'Healthcare': [0.05, 0.20],
    'Robotics': [0.05, 0.25],
}

const officeCoeffs = {
    'Agriculture': [1.0, 3],
    'Software': [1.5, 3],
    'Healthcare': [1.5, 15],
    'Robotics': [1.5, 15],
}


const workersAllocation = [
    {
        condition: (industry) => !industry.api.makesProducts,
        capital: [
            { job: Jobs.Operations, rate: 0.35, minSlots: 1 },
            { job: Jobs.Engineer, rate: 0.35, minSlots: 1 },
            { job: Jobs.Business, rate: 0.05, minSlots: 1 },
            { job: Jobs.Research, rate: 0.10, minSlots: 1 },
            { job: Jobs.Management, rate: 0.20, minSlots: 0 },
        ],
        other: [
            { job: Jobs.Operations, rate: 0.35, minSlots: 1 },
            { job: Jobs.Engineer, rate: 0.35, minSlots: 1 },
            { job: Jobs.Business, rate: 0.05, minSlots: 1 },
            { job: Jobs.Research, rate: 0.10, minSlots: 1 },
            { job: Jobs.Management, rate: 0.20, minSlots: 0 },
        ]
    },
    {
        condition: (industry) => industry.finishedProductsCount == 0,
        capital: [
            { job: Jobs.Operations, rate: 0.40, minSlots: 1 },
            { job: Jobs.Engineer, rate: 0.40, minSlots: 1 },
            { job: Jobs.Business, rate: 0.02, minSlots: 1 },
            { job: Jobs.Research, rate: 0.10, minSlots: 1 },
            { job: Jobs.Management, rate: 0.08, minSlots: 0 },
        ],
        other: [
            { job: Jobs.Research, rate: 1.00, minSlots: 1 },
            { job: Jobs.Operations, rate: 0.00, minSlots: 0 },
            { job: Jobs.Engineer, rate: 0.00, minSlots: 0 },
            { job: Jobs.Business, rate: 0.00, minSlots: 0 },
            { job: Jobs.Management, rate: 0.00, minSlots: 0 },
        ]
    },
    {
        condition:  (industry) => !industry.hasSmartMarket(),
        capital: [
            { job: Jobs.Operations, rate: 0.35, minSlots: 1 },
            { job: Jobs.Engineer, rate: 0.30, minSlots: 1 },
            { job: Jobs.Business, rate: 0.02, minSlots: 1 },
            { job: Jobs.Research, rate: 0.15, minSlots: 1 },
            { job: Jobs.Management, rate: 0.18, minSlots: 0 },
        ],
        other: [
            { job: Jobs.Operations, rate: 0.30, minSlots: 1 },
            { job: Jobs.Engineer, rate: 0.25, minSlots: 1 },
            { job: Jobs.Business, rate: 0.02, minSlots: 1 },
            { job: Jobs.Research, rate: 0.25, minSlots: 1 },
            { job: Jobs.Management, rate: 0.18, minSlots: 0 },
        ]
    },
    {
        condition: (industry) => true,
        capital: [
            { job: Jobs.Operations, rate: 0.30, minSlots: 1 },
            { job: Jobs.Engineer, rate: 0.30, minSlots: 1 },
            { job: Jobs.Business, rate: 0.10, minSlots: 1 },
            { job: Jobs.Management, rate: 0.25, minSlots: 0 },
            { job: Jobs.Research, rate: 0.05, minSlots: 1 },
        ],
        other: [
            { job: Jobs.Operations, rate: 0.25, minSlots: 1 },
            { job: Jobs.Engineer, rate: 0.25, minSlots: 1 },
            { job: Jobs.Business, rate: 0.20, minSlots: 1 },
            { job: Jobs.Management, rate: 0.25, minSlots: 0 },
            { job: Jobs.Research, rate: 0.05, minSlots: 1 },
        ]
    }
];

const researches = [
    { name: Researches.DataCenter, buyAt: 7000 },
    { name: Researches.SmartMarket1, buyAt: 75000 },
    { name: Researches.SmartMarket2, buyAt: 55000 },
    { name: Researches.Capacity0, buyAt: 60000 },
    { name: Researches.Capacity1, buyAt: 55000 },
    { name: Researches.Capacity2, buyAt: 80000 },
    { name: Researches.Drones, buyAt: 100000 },
    { name: Researches.DronesProduction, buyAt: 90000 },
    { name: Researches.DronesWarehouse, buyAt: 90000 },
    { name: Researches.Assemblers, buyAt: 100000 },
    { name: Researches.Drugs0, buyAt: 110000 },
    { name: Researches.Drugs1, buyAt: 120000 },
    { name: Researches.Drugs2, buyAt: 130000 },
    { name: Researches.JoyWire, buyAt: 140000 },
    { name: Researches.Overclock1, buyAt: 150000 },
    { name: Researches.Overclock2, buyAt: 160000 },
];

/** @param {NS} ns 
 *  @param {Industry} industry 
*/
export function loopIndustry(ns, industry) {
    // Every loop, so we check every porduction step 
    act.manageWarehouse(ns, industry, 0.80);

    if (runOncePerTurn(industry.name)) {
        let allocation = 0;
        while(!workersAllocation[allocation].condition(industry)) {
            allocation++;
        }
                    
        act.manageResearch(ns, industry, researches);
        act.upgradeOffices(ns, industry, ...officeCoeffs[industry.name]);
        act.assignEmployeesAllCities(industry, workersAllocation[allocation]);
        act.manageMaterials(ns, industry, producedMaterials[industry.name]);
        act.manageProducts(ns, industry);
        act.manageRealEstate(ns, industry, Loop.instance.isInvestCheckTime ? 0 : realEstateCoeffs[industry.name][0], realEstateCoeffs[industry.name][1]);
        if(industry.hasSmartMarket()) {
            act.manageAdverts(ns, industry, 0);
        } else {
            act.manageAdverts(ns, industry, 3);
        }
    }
}