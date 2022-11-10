import {walkNodes} from "utils.js"

/** @param {NS} ns */
export async function main(ns) {
    walkNodes(ns, "home", function(node) {
        var cmds = ns.ls(node, "command-");
        for(var i = 0; i < cmds.length; i = i + 1) {
            ns.rm(cmds[i]);
        }
    }, true);
}