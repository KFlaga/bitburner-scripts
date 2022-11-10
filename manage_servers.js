import {formatMoney} from "utils.js";

const maxServerRam = 1048576;

/** @param {NS} ns */
function getMinServerRam(ns) {
    const allServers = ns.getPurchasedServers();
    if(allServers.length == 0) {
        return [0, ""];
    }

    let minRam = 1e9;
    let minServer = "";
    for (const server of allServers) {
        if(ns.getServerMaxRam(server) < minRam) {
            minRam = ns.getServerMaxRam(server);
            minServer = server;
        }
    }

    return [minRam, minServer];
}

/** @param {NS} ns */
async function sellServer(ns, server) {
    if(ns.serverExists(server)) {
        ns.killall(server);
        ns.deleteServer(server);
    }
}

/** @param {NS} ns */
export async function main(ns) {
    let min_ram = ns.args[0];
    if(min_ram == "MAX") {
        min_ram = maxServerRam;
    }
    ns.disableLog("sleep");
    ns.disableLog("getServerMaxRam");

    while(true) {
        if(getMinServerRam(ns)[0] == maxServerRam && ns.getPurchasedServers().length == ns.getPurchasedServerLimit()) {
            ns.print('MAX SERVERS')
            ns.toast('MAX SERVERS')
            ns.exit();
        }

        const nextRam = Math.min(maxServerRam, Math.max(min_ram, getMinServerRam(ns)[0] * 4));
        if(ns.getPurchasedServers().length >= ns.getPurchasedServerLimit()) {
            if(ns.getPlayer().money > ns.getPurchasedServerCost(nextRam)) {
                const minServer = getMinServerRam(ns)[1];

                await sellServer(ns, minServer);
                await sellServer(ns, minServer);
                await sellServer(ns, minServer);
                await sellServer(ns, minServer);
                await sellServer(ns, minServer);
                await sellServer(ns, minServer);
            }
        }

        ns.print("Next server to buy: " + nextRam + " for " + formatMoney(ns.getPurchasedServerCost(nextRam)));
        ns.purchaseServer("s" + nextRam.toString(), nextRam);
        await ns.sleep(3000);
    }
}