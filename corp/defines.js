import {canEval} from "corp/toolkit.js";


export const _m = 1e6;
export const _b = 1e9;
export const _t = 1e12;
export const _q = 1e15;
export const _Q = 1e18;

export const Industries = {
    Food: 'Food',
    Tobacco: 'Tobacco',
    Software: 'Software',
    Agriculture: 'Agriculture',
    Fishing: 'Fishing',
    Utilities: 'Utilities',
    Chemical: 'Chemical',
    Pharmaceutical: 'Pharmaceutical',
    Energy: 'Energy',
    Mining: 'Mining',
    Computers: 'Hardware',
    RealEstate: 'RealEstate',
    Healthcare: 'Healthcare',
    Robotics: 'Robotics',
};

export const Cities = {
    Aevum: 'Aevum',
    Chongqing: 'Chongqing',
    Ishima: 'Ishima',
    NewTokyo: 'New Tokyo',
    Sector12: 'Sector-12',
    Volhaven: 'Volhaven'
};

export const Upgrades = {
    SmartSupply: 'Smart Supply',
    Export: 'Export',
    Production: 'Smart Factories',
    Warehouse: 'Smart Storage',
    TickAdvert: 'DreamSense',
    Advert: 'Wilson Analytics',
    Effeciency: 'FocusWires',
    Intelligence: 'Neural Accelerators',
    Research: 'Project Insight',
    Charisma: 'Speech Processor Implants',
    Creativity: 'Nuoptimal Nootropic Injector Implants',
    Sales: 'ABC SalesBots',
    Tax1: 'Shady Accounting',
    Tax2: 'Government Partnership',
};

export const Jobs = {
    Operations: 'Operations',
    Engineer: 'Engineer',
    Business: 'Business',
    Management: 'Management',
    Research: 'Research & Development',
    Training: 'Training',
    Unassigned: 'Unassigned'
};

export const Researches = {
    DataCenter: 'Hi-Tech R&D Laboratory',
    SmartMarket1: 'Market-TA.I',
    SmartMarket2: 'Market-TA.II',
    Capacity0: 'uPgrade: Fulcrum',
    Capacity1: 'uPgrade: Capacity.I',
    Capacity2: 'uPgrade: Capacity.II',
    Drones: 'Drones',
    DronesProduction: 'Drones - Assembly',
    DronesWarehouse: 'Drones - Transport',
    Assemblers: 'Self-Correcting Assemblers',
    Drugs0: 'Automatic Drug Administration',
    Drugs1: 'Go-Juice',
    Drugs2: 'CPH4 Injections',
    JoyWire: 'JoyWire',
    Overclock1: 'Overclock',
    Overclock2: 'Sti.mu',
};


export const newCityCost = 4 * _b;
export const warehouseCost = 5 * _b;
export const totalNewCityCost = newCityCost + warehouseCost;

export const realEstateVolume = 1.0/200.0;

export function hasCorp(ns) {
    return canEval(() => ns.corporation.getCorporation().name);
}

export function hasIndustry(ns, name) {
    return canEval(() => ns.corporation.getDivision(name).name);
}

export let funds = (ns) => ns.corporation.getCorporation().funds;