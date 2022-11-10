import * as utils from "utils.js";

/** @param {NS} ns */
export async function main(ns) {
    while (true) {
        utils.walkNodes(ns, ns.getHostname(), function (node) {
            utils.crack(ns, node);
        });
        await ns.sleep(60000);
    }
}