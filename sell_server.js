/** @param {NS} ns */
export async function main(ns) {
    var server = ns.args[0];
    ns.killall(server);
    await ns.sleep(2000);
    ns.deleteServer(server);
}