import {getDistributableServers, formatMoney} from "utils.js";

/** @param {NS} ns */
export async function main(ns) {
    let ram = ns.args[0];

    let allServers = getDistributableServers(ns);

    let threadCapacity = 0;
    let freeThreads = 0;
    for (let server of allServers) {
        let freeRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
        threadCapacity = threadCapacity + Math.floor(ns.getServerMaxRam(server) / ram);
        freeThreads = freeThreads + Math.floor(freeRam / ram);
    }

    ns.toast("THREAD CAPACITY: " + formatMoney(threadCapacity));
    ns.toast("FREE THREADS: " + formatMoney(freeThreads));
}