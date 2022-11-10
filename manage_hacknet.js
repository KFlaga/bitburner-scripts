/** @param {NS} ns */
export async function main(ns) {
    let maxLevel = ns.args[0];
    let maxRam = ns.args[1];
    let maxCore = ns.args[2];
    let maxNodes = ns.args[3];
    ns.disableLog("sleep");

    let shouldBuyRam = function(lvl, ram) {
        let l2 = Math.log2(ram);
        return ram < 64 && ram < maxRam && lvl > (70 + l2*5);
    }
    
    let shouldBuyCore = function(lvl, ram, cores) {
        return ram == 64 && cores < maxCore && lvl > (100 + cores * 10);
    }

    while (true) {
        for (let i = 0; i < ns.hacknet.numNodes(); i = i + 1) {
            let node = ns.hacknet.getNodeStats(i);
            if(shouldBuyRam(node.level, node.ram)) {
                ns.hacknet.upgradeRam(i);
            } else if(shouldBuyCore(node.level, node.ram, node.cores)) {
                ns.hacknet.upgradeCore(i);
            } else if(node.level < maxLevel) {
                ns.hacknet.upgradeLevel(i);
            }
        }

        if (ns.hacknet.numNodes() < maxNodes) {
            ns.hacknet.purchaseNode();
        }

        await ns.sleep(300);
    }
}